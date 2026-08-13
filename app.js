// Tech Update Dashboard — client-side app.
// Data model matches the PRD/CLAUDE.md `posts` table shape:
// { id, source, title, url, published_at, summary, raw_excerpt }

const SOURCES = {
  github: { label: "GitHub Blog", badgeClass: "badge-github", category: "tech" },
  huggingface: { label: "Hugging Face Blog", badgeClass: "badge-huggingface", category: "tech" },
  langchain: { label: "LangChain Blog", badgeClass: "badge-langchain", category: "tech" },
  news: { label: "Daily Tech News", badgeClass: "badge-news", category: "tech" },
  fintech_global: { label: "fintech.global", badgeClass: "badge-fintech-global", category: "fintech" },
  fintech_futures: { label: "FinTech Futures", badgeClass: "badge-fintech-futures", category: "fintech" },
  thisweekinfintech: { label: "This Week in Fintech", badgeClass: "badge-thisweekinfintech", category: "fintech" },
  fintechtimes: { label: "The Fintech Times", badgeClass: "badge-fintechtimes", category: "fintech" },
};
const SOURCE_KEYS = Object.keys(SOURCES);
const TECH_SOURCE_KEYS = SOURCE_KEYS.filter((key) => SOURCES[key].category === "tech");
const FINTECH_SOURCE_KEYS = SOURCE_KEYS.filter((key) => SOURCES[key].category === "fintech");

// ---------------------------------------------------------------------------
// Supabase client — read-only anon access to `posts` (RLS restricts anon to
// SELECT; see CLAUDE.md). `supabase` here is the UMD global from the CDN
// <script> tag in index.html; `supabaseClient` is our instance of it.
// ---------------------------------------------------------------------------

const SUPABASE_URL = "https://ifrgkxbfhbdiscbqxjnj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ahfSSk_--us1NkbQGMC-3w__v7HPO5Z";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function fetchPosts() {
  const { data, error } = await supabaseClient.from("posts").select("*").order("published_at", { ascending: false });
  if (error) {
    console.error("fetchPosts failed:", error);
    return [];
  }
  return data;
}

// ---------------------------------------------------------------------------
// AI chatbot — answers come from api/chat.js (Claude API with a FinTech-
// specialized system prompt). No login, no archive: each question/answer
// only lives on screen for that session.
// ---------------------------------------------------------------------------

async function sendChatMessage(question) {
  const resp = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || `chat request failed (${resp.status})`);
  return data.answer;
}

const FILTER_STORAGE_KEY = "techdash:lastFilter"; // UI preference only — never dashboard data.
const FINTECH_FILTER_STORAGE_KEY = "techdash:lastFintechFilter";

function loadSavedFilter(scope) {
  const key = scope === "fintech" ? FINTECH_FILTER_STORAGE_KEY : FILTER_STORAGE_KEY;
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}

function saveFilter(filter, scope) {
  const key = scope === "fintech" ? FINTECH_FILTER_STORAGE_KEY : FILTER_STORAGE_KEY;
  localStorage.setItem(key, JSON.stringify(filter));
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function formatDate(iso) {
  return (iso || "").slice(0, 10);
}

function badgeHtml(source) {
  const meta = SOURCES[source] || { label: source, badgeClass: "badge" };
  return `<span class="badge ${meta.badgeClass} type-caption">${escapeHtml(meta.label)}</span>`;
}

function postCardHtml(post) {
  const bodyText = post.summary || post.raw_excerpt || "요약 준비 중입니다.";
  return `
    <article class="card">
      <div class="card__meta">
        ${badgeHtml(post.source)}
        <span class="card__date type-caption">${formatDate(post.published_at)}</span>
      </div>
      <h3 class="card__title type-card-title"><a href="#/item/${post.id}">${escapeHtml(post.title)}</a></h3>
      <p class="card__summary type-body">${escapeHtml(bodyText)}</p>
      <a class="card__link type-link" href="${escapeHtml(post.url)}" target="_blank" rel="noopener">원문 보기 →</a>
    </article>
  `;
}

function emptyStateHtml(message) {
  return `<div class="empty-state type-body">${escapeHtml(message)}</div>`;
}

function filterBarHtml(state, sourceKeys) {
  const keys = sourceKeys || SOURCE_KEYS;
  const pills = keys.map((key) => {
    const selected = state.source === key ? "is-selected" : "";
    return `<button class="pill ${selected}" data-filter-source="${key}">${escapeHtml(SOURCES[key].label)}</button>`;
  }).join("");
  const allSelected = !state.source ? "is-selected" : "";

  return `
    <form class="filter-bar" id="filterForm">
      <div class="filter-bar__pills">
        <button type="button" class="pill ${allSelected}" data-filter-source="">전체</button>
        ${pills}
      </div>
      <div class="filter-bar__dates">
        <div class="field">
          <label for="dateFrom">시작일</label>
          <input type="date" id="dateFrom" name="date_from" value="${state.date_from || ""}" />
        </div>
        <div class="field">
          <label for="dateTo">종료일</label>
          <input type="date" id="dateTo" name="date_to" value="${state.date_to || ""}" />
        </div>
        <button type="submit" class="pill pill-primary pill-apply">필터 적용</button>
      </div>
    </form>
  `;
}

function applyFilters(posts, state) {
  return posts
    .filter((p) => !state.source || p.source === state.source)
    .filter((p) => !state.date_from || formatDate(p.published_at) >= state.date_from)
    .filter((p) => !state.date_to || formatDate(p.published_at) <= state.date_to)
    .sort((a, b) => (a.published_at < b.published_at ? 1 : -1));
}

function digestHtml(newsPosts) {
  const latestDay = newsPosts.reduce((max, p) => {
    const d = formatDate(p.published_at);
    return d > max ? d : max;
  }, "");
  const today = newsPosts.filter((p) => formatDate(p.published_at) === latestDay).slice(0, 5);

  const list = today.length
    ? `<ul class="color-block__list">${today
        .map((p) => `<li><a href="#/item/${p.id}">${escapeHtml(p.title)}</a></li>`)
        .join("")}</ul>`
    : `<p class="color-block__empty">아직 수집된 뉴스가 없습니다.</p>`;

  return `
    <section class="color-block">
      <p class="color-block__eyebrow type-eyebrow">Daily Digest</p>
      <h2 class="color-block__title type-headline">오늘의 데일리 뉴스 다이제스트</h2>
      ${list}
    </section>
  `;
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

async function renderHome(query) {
  const posts = (await fetchPosts()).filter((p) => TECH_SOURCE_KEYS.includes(p.source));
  const saved = loadSavedFilter();
  const state = {
    source: query.source ?? saved.source ?? "",
    date_from: query.date_from ?? saved.date_from ?? "",
    date_to: query.date_to ?? saved.date_to ?? "",
  };

  const newsPosts = posts.filter((p) => p.source === "news");
  const filtered = applyFilters(posts, state);

  return `
    ${digestHtml(newsPosts)}
    ${filterBarHtml(state, TECH_SOURCE_KEYS)}
    <section class="feed">
      ${
        filtered.length
          ? filtered.map((p) => postCardHtml(p)).join("")
          : emptyStateHtml("조건에 맞는 항목이 없습니다.")
      }
    </section>
  `;
}

async function renderFintech(query) {
  const posts = (await fetchPosts()).filter((p) => FINTECH_SOURCE_KEYS.includes(p.source));
  const saved = loadSavedFilter("fintech");
  const state = {
    source: query.source ?? saved.source ?? "",
    date_from: query.date_from ?? saved.date_from ?? "",
    date_to: query.date_to ?? saved.date_to ?? "",
  };

  const filtered = applyFilters(posts, state);

  return `
    <h2 class="type-headline">Fintech</h2>
    ${filterBarHtml(state, FINTECH_SOURCE_KEYS)}
    <section class="feed">
      ${
        filtered.length
          ? filtered.map((p) => postCardHtml(p)).join("")
          : emptyStateHtml("아직 수집된 항목이 없습니다.")
      }
    </section>
  `;
}

async function renderSource(sourceKey) {
  if (!SOURCES[sourceKey]) {
    return emptyStateHtml("알 수 없는 소스입니다.");
  }
  const posts = await fetchPosts();
  const filtered = applyFilters(posts, { source: sourceKey });

  return `
    <h2 class="type-headline">${escapeHtml(SOURCES[sourceKey].label)}</h2>
    <section class="feed">
      ${
        filtered.length
          ? filtered.map((p) => postCardHtml(p)).join("")
          : emptyStateHtml("아직 수집된 항목이 없습니다.")
      }
    </section>
  `;
}

async function renderArchive(query) {
  const posts = await fetchPosts();
  const newsPosts = applyFilters(posts, { source: "news" });
  const dates = [...new Set(newsPosts.map((p) => formatDate(p.published_at)))].sort((a, b) => (a < b ? 1 : -1));
  const selectedDate = query.date || dates[0] || "";
  const dayPosts = newsPosts.filter((p) => formatDate(p.published_at) === selectedDate);

  const dateListHtml = dates.length
    ? dates
        .map((d) => `<a class="${d === selectedDate ? "is-selected" : ""}" href="#/archive?date=${d}">${d}</a>`)
        .join("")
    : emptyStateHtml("아직 수집된 뉴스가 없습니다.");

  return `
    <h2 class="type-headline">데일리 뉴스 아카이브</h2>
    <div class="archive-layout">
      <nav class="date-list">${dateListHtml}</nav>
      <section class="feed">
        ${
          dayPosts.length
            ? dayPosts.map((p) => postCardHtml(p)).join("")
            : emptyStateHtml("선택한 날짜에 항목이 없습니다.")
        }
      </section>
    </div>
  `;
}

async function renderItem(id) {
  const posts = await fetchPosts();
  const post = posts.find((p) => String(p.id) === String(id));
  if (!post) {
    return emptyStateHtml("항목을 찾을 수 없습니다.");
  }
  const bodyText = post.summary || post.raw_excerpt || "요약 준비 중입니다.";

  return `
    <a class="back-link" href="#/">← 통합 피드로 돌아가기</a>
    <article class="detail">
      <div class="detail__meta">
        ${badgeHtml(post.source)}
        <span class="card__date type-caption">${formatDate(post.published_at)}</span>
      </div>
      <h1 class="detail__title type-headline">${escapeHtml(post.title)}</h1>
      <p class="detail__summary type-body">${escapeHtml(bodyText)}</p>
      <a class="type-link" href="${escapeHtml(post.url)}" target="_blank" rel="noopener">원문 보기 →</a>
    </article>
  `;
}

async function renderChat() {
  return `
    <h2 class="type-headline">AI 챗봇 — 핀테크 용어 질문</h2>
    <p class="auth-note type-body">궁금한 핀테크 용어나 개념을 질문해보세요.</p>
    <form class="chat-form" id="chatForm">
      <div class="field">
        <label for="chatQuestion">질문</label>
        <input type="text" id="chatQuestion" name="question" required placeholder="예: BNPL이 뭐야?" />
      </div>
      <button type="submit" class="pill pill-primary">질문하기</button>
      <p class="auth-note type-body" id="chatError" hidden></p>
    </form>
    <div class="chat-log" id="chatAnswer"></div>
  `;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

function parseHash() {
  const hash = location.hash.replace(/^#/, "") || "/";
  const [path, queryString] = hash.split("?");
  const query = Object.fromEntries(new URLSearchParams(queryString || ""));
  return { path: path || "/", query };
}

function setActiveNav(path) {
  document.querySelectorAll(".nav-links a").forEach((a) => {
    const route = a.getAttribute("data-route");
    const active = route === "/" ? path === "/" : path.startsWith(route);
    a.classList.toggle("is-active", active);
  });
}

async function render() {
  const app = document.getElementById("app");
  const { path, query } = parseHash();
  setActiveNav(path);

  let html = "";
  const sourceMatch = path.match(/^\/source\/([a-z]+)$/);
  const itemMatch = path.match(/^\/item\/(\d+)$/);

  if (path === "/") {
    html = await renderHome(query);
  } else if (sourceMatch) {
    html = await renderSource(sourceMatch[1]);
  } else if (path === "/archive") {
    html = await renderArchive(query);
  } else if (path === "/fintech") {
    html = await renderFintech(query);
  } else if (path === "/chat") {
    html = await renderChat();
  } else if (itemMatch) {
    html = await renderItem(itemMatch[1]);
  } else {
    html = emptyStateHtml("페이지를 찾을 수 없습니다.");
  }

  app.innerHTML = html;
  wireHomeInteractions();
  wireChatForm();
}

function chatEntryHtml(question, answer) {
  return `
    <article class="chat-entry">
      <p class="chat-entry__question type-body">${escapeHtml(question)}</p>
      <p class="chat-entry__answer type-body">${escapeHtml(answer)}</p>
    </article>
  `;
}

function wireChatForm() {
  const form = document.getElementById("chatForm");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const question = form.question.value.trim();
    if (!question) return;
    const submitBtn = form.querySelector("button[type=submit]");
    const errorEl = document.getElementById("chatError");
    const answerEl = document.getElementById("chatAnswer");
    submitBtn.disabled = true;
    errorEl.hidden = true;
    try {
      const answer = await sendChatMessage(question);
      answerEl.innerHTML = chatEntryHtml(question, answer);
      form.reset();
    } catch (err) {
      console.error("sendChatMessage failed:", err);
      errorEl.hidden = false;
      errorEl.textContent = "답변을 가져오지 못했습니다. 잠시 후 다시 시도해주세요.";
    } finally {
      submitBtn.disabled = false;
    }
  });
}

function wireHomeInteractions() {
  const form = document.getElementById("filterForm");
  if (!form) return;

  form.querySelectorAll("[data-filter-source]").forEach((btn) => {
    btn.addEventListener("click", () => {
      form.querySelectorAll("[data-filter-source]").forEach((b) => b.classList.remove("is-selected"));
      btn.classList.add("is-selected");
      form.dataset.selectedSource = btn.dataset.filterSource;
    });
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const basePath = parseHash().path === "/fintech" ? "/fintech" : "/";
    const scope = basePath === "/fintech" ? "fintech" : undefined;
    const state = {
      source: form.dataset.selectedSource ?? parseHash().query.source ?? "",
      date_from: form.date_from.value,
      date_to: form.date_to.value,
    };
    saveFilter(state, scope);
    const params = new URLSearchParams();
    if (state.source) params.set("source", state.source);
    if (state.date_from) params.set("date_from", state.date_from);
    if (state.date_to) params.set("date_to", state.date_to);
    location.hash = `${basePath}${params.toString() ? "?" + params.toString() : ""}`;
  });
}

function wireNavToggle() {
  const toggle = document.getElementById("navToggle");
  const links = document.getElementById("navLinks");
  toggle.addEventListener("click", () => {
    const isOpen = links.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
  links.addEventListener("click", (e) => {
    if (e.target.tagName === "A") {
      links.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });
}

window.addEventListener("hashchange", render);
window.addEventListener("DOMContentLoaded", () => {
  wireNavToggle();
  render();
});
