// Vercel Serverless Function (Node.js runtime, CommonJS, zero npm dependencies
// per CLAUDE.md). Triggered by vercel.json's cron. Fetches new posts from the
// 3 tech sources + 4 fintech sources, summarizes new items with Claude, and
// upserts into Supabase `posts`. Each source is isolated: one source failing
// (feed down, parse error, etc.) must not affect the others.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

const CLAUDE_MODEL = "claude-haiku-4-5-20251001";
const USER_AGENT = "Mozilla/5.0 (compatible; TechUpdateDashboardBot/1.0)";
// Some feeds (e.g. Hugging Face's) return their entire historical archive,
// not just recent posts. Cap per source per run so a cold/empty `posts`
// table doesn't trigger hundreds of Claude calls (cost + function timeout).
const MAX_ITEMS_PER_SOURCE = 15;

// Verified by hand against each site on 2026-08-13 (see CLAUDE.md). Sites
// change their feed paths without notice, so if a source starts returning 0
// items, re-check its URL before assuming the parser broke.
const SOURCES = [
  { key: "github", type: "rss", url: "https://github.blog/feed/" },
  { key: "huggingface", type: "rss", url: "https://huggingface.co/blog/feed.xml" },
  { key: "langchain", type: "rss", url: "https://www.langchain.com/blog/rss.xml" },
  { key: "news", type: "rss", url: "https://hnrss.org/frontpage" },
  { key: "fintech_global", type: "rss", url: "https://fintech.global/feed/" },
  { key: "fintech_futures", type: "rss", url: "https://www.fintechfutures.com/rss.xml" },
  // This Week in Fintech runs on Beehiiv behind a custom domain; Beehiiv's
  // usual /feed RSS route 404s on the custom domain, so we scrape the
  // archive page's post links instead. No publish date is recoverable from
  // this markup, so published_at falls back to the collection run time.
  { key: "thisweekinfintech", type: "html-archive", url: "https://www.thisweekinfintech.com/archive" },
  { key: "fintechtimes", type: "rss", url: "https://fintechtimes.co.kr/data/rss/news.xml" },
];

module.exports = async function handler(req, res) {
  if (!CRON_SECRET || req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ANTHROPIC_API_KEY) {
    res.status(500).json({ error: "missing required environment variables" });
    return;
  }

  const results = {};

  for (const source of SOURCES) {
    try {
      const rawItems = source.type === "rss" ? await collectRss(source.url) : await collectArchiveHtml(source.url);
      const items = rawItems
        .map((item) => ({ ...item, source: source.key }))
        .sort((a, b) => (a.published_at < b.published_at ? 1 : -1))
        .slice(0, MAX_ITEMS_PER_SOURCE);
      const insertedCount = await summarizeAndStoreNewItems(items);
      results[source.key] = { ok: true, found: items.length, inserted: insertedCount };
    } catch (err) {
      console.error(`[collect] source "${source.key}" failed:`, err);
      results[source.key] = { ok: false, error: String((err && err.message) || err) };
    }
  }

  res.status(200).json({ ranAt: new Date().toISOString(), results });
};

// ---------------------------------------------------------------------------
// Fetch + parse
// ---------------------------------------------------------------------------

async function collectRss(feedUrl) {
  const resp = await fetch(feedUrl, { headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml, text/xml" } });
  if (!resp.ok) throw new Error(`fetch ${feedUrl} -> ${resp.status}`);
  const xml = await resp.text();
  return parseRssItems(xml);
}

function parseRssItems(xml) {
  const itemBlocks = xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) || [];
  return itemBlocks
    .map((block) => {
      const title = htmlDecode(stripTags(extractTag(block, "title") || ""));
      const url = htmlDecode(stripTags(extractTag(block, "link") || "")).trim();
      const pubDateRaw = extractTag(block, "pubDate") || extractTag(block, "dc:date") || extractTag(block, "published");
      const description = htmlDecode(stripTags(extractTag(block, "description") || extractTag(block, "content:encoded") || ""));
      if (!title || !url) return null;
      const parsedDate = pubDateRaw ? new Date(pubDateRaw) : null;
      const published_at = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : new Date().toISOString();
      return {
        title: truncate(title, 300),
        url,
        published_at,
        raw_excerpt: truncate(description.trim(), 800),
      };
    })
    .filter(Boolean);
}

function extractTag(block, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  if (!m) return null;
  const inner = m[1].trim();
  const cdataMatch = inner.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
  return cdataMatch ? cdataMatch[1] : inner;
}

function stripTags(str) {
  return str.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

function htmlDecode(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

function truncate(str, max) {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

async function collectArchiveHtml(pageUrl) {
  const resp = await fetch(pageUrl, { headers: { "User-Agent": USER_AGENT } });
  if (!resp.ok) throw new Error(`fetch ${pageUrl} -> ${resp.status}`);
  const html = await resp.text();
  const base = new URL(pageUrl).origin;

  const seen = new Set();
  const items = [];
  const linkRe = /<a\s+href="(\/p\/[^"]+)"[^>]*aria-label="([^"]+)"/g;
  let m;
  while ((m = linkRe.exec(html))) {
    const path = m[1];
    if (seen.has(path)) continue;
    seen.add(path);
    const title = htmlDecode(m[2]).trim();
    if (!title) continue;
    items.push({
      title: truncate(title, 300),
      url: base + path,
      published_at: new Date().toISOString(),
      raw_excerpt: "",
    });
  }
  return items;
}

// ---------------------------------------------------------------------------
// Summarize new items + write to Supabase
// ---------------------------------------------------------------------------

async function summarizeAndStoreNewItems(items) {
  const dedupedByUrl = new Map();
  for (const item of items) {
    if (item.url) dedupedByUrl.set(item.url, item);
  }
  const candidates = [...dedupedByUrl.values()];
  if (!candidates.length) return 0;

  const existingUrls = await fetchExistingUrls(candidates.map((c) => c.url));
  const newItems = candidates.filter((c) => !existingUrls.has(c.url));
  if (!newItems.length) return 0;

  const rows = await Promise.all(
    newItems.map(async (item) => {
      let summary = null;
      try {
        summary = await summarizeWithClaude(item.title, item.raw_excerpt);
      } catch (err) {
        console.error(`[collect] summarize failed for ${item.url}:`, err);
      }
      return {
        source: item.source,
        title: item.title,
        url: item.url,
        published_at: item.published_at,
        summary,
        raw_excerpt: item.raw_excerpt || null,
        fetched_at: new Date().toISOString(),
      };
    })
  );

  await insertPosts(rows);
  return rows.length;
}

async function summarizeWithClaude(title, excerpt) {
  const prompt = excerpt
    ? `다음은 뉴스 글의 제목과 본문 발췌입니다. 한국어로 3~5줄 이내로 핵심을 요약하세요. 발췌에 없는 내용을 지어내지 마세요.\n\n제목: ${title}\n\n발췌: ${excerpt}`
    : `다음은 뉴스 글의 제목뿐이며 본문 발췌는 없습니다. 제목만 보고 짐작할 수 있는 일반적인 주제를 한국어 2~3줄로 담백하게 설명하세요. 구체적인 숫자나 세부 사실은 지어내지 마세요.\n\n제목: ${title}`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!resp.ok) {
    throw new Error(`Claude API ${resp.status}: ${await resp.text()}`);
  }
  const data = await resp.json();
  const text = data.content && data.content[0] && data.content[0].text;
  return text ? text.trim() : null;
}

async function fetchExistingUrls(urls) {
  // Ordered by most recently fetched: since we only ever consider the newest
  // MAX_ITEMS_PER_SOURCE items per run, anything genuinely still-new will be
  // caught even if this select is capped by PostgREST's default row limit.
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/posts?select=url&order=fetched_at.desc`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!resp.ok) throw new Error(`supabase select posts -> ${resp.status}: ${await resp.text()}`);
  const rows = await resp.json();
  const existing = new Set(rows.map((r) => r.url));
  return new Set(urls.filter((u) => existing.has(u)));
}

async function insertPosts(rows) {
  if (!rows.length) return;
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/posts`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!resp.ok) throw new Error(`supabase insert posts -> ${resp.status}: ${await resp.text()}`);
}
