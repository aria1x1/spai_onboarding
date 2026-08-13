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
// Supabase client + auth (email magic link). The publishable key is safe to
// ship in frontend code — RLS is what actually restricts access (see
// CLAUDE.md). `supabase` here is the UMD global from the CDN <script> tag in
// index.html; `supabaseClient` is our instance of it.
// ---------------------------------------------------------------------------

const SUPABASE_URL = "https://ifrgkxbfhbdiscbqxjnj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ahfSSk_--us1NkbQGMC-3w__v7HPO5Z";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { flowType: "pkce" },
});

let currentSession = null;

async function initAuth() {
  // getSession() also performs the PKCE code exchange when the page loads
  // with a magic-link `?code=...` in the URL. If that exchange fails (link
  // already used, opened in a different browser than the one that requested
  // it, etc.) this must not prevent the app from rendering at all — fall
  // back to "logged out" and let the user try logging in again.
  try {
    const { data } = await supabaseClient.auth.getSession();
    currentSession = data.session;
  } catch (err) {
    console.error("initAuth: getSession failed:", err);
    currentSession = null;
  }
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    currentSession = session;
    renderNavAuth();
    render();
  });
}

function getSession() {
  if (!currentSession) return null;
  return { id: currentSession.user.id, email: currentSession.user.email, accessToken: currentSession.access_token };
}

async function signInWithMagicLink(email) {
  const { error } = await supabaseClient.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + "/" },
  });
  if (error) throw error;
}

async function signOut() {
  await supabaseClient.auth.signOut();
}

// ---------------------------------------------------------------------------
// Posts (read-only, anon-accessible) + bookmarks (RLS-scoped to auth.uid())
// ---------------------------------------------------------------------------

async function fetchPosts() {
  const { data, error } = await supabaseClient.from("posts").select("*").order("published_at", { ascending: false });
  if (error) {
    console.error("fetchPosts failed:", error);
    return [];
  }
  return data;
}

async function fetchBookmarks(userId) {
  const { data, error } = await supabaseClient.from("bookmarks").select("post_id").eq("user_id", userId);
  if (error) {
    console.error("fetchBookmarks failed:", error);
    return [];
  }
  return data;
}

async function toggleBookmark(userId, postId) {
  const { data: existing, error: selectError } = await supabaseClient
    .from("bookmarks")
    .select("id")
    .eq("user_id", userId)
    .eq("post_id", postId)
    .maybeSingle();
  if (selectError) throw selectError;

  if (existing) {
    const { error } = await supabaseClient.from("bookmarks").delete().eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabaseClient.from("bookmarks").insert({ user_id: userId, post_id: postId });
    if (error) throw error;
  }
}

async function bookmarkedIdSet() {
  const session = getSession();
  if (!session) return new Set();
  const bookmarks = await fetchBookmarks(session.id);
  return new Set(bookmarks.map((b) => b.post_id));
}

// ---------------------------------------------------------------------------
// AI chatbot — answers come from api/chat.js (Claude API with a FinTech-
// specialized system prompt); the archive is read straight from `chat_logs`
// (api/chat.js writes it, RLS scopes reads to the caller's own rows).
// ---------------------------------------------------------------------------

async function sendChatMessage(question) {
  const session = getSession();
  const resp = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: JSON.stringify({ question }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || `chat request failed (${resp.status})`);
  return data.answer;
}

async function fetchChatLogs(userId) {
  const { data, error } = await supabaseClient
    .from("chat_logs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("fetchChatLogs failed:", error);
    return [];
  }
  return data;
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

function bookmarkButtonHtml(post, bookmarkedIds) {
  const isBookmarked = Boolean(bookmarkedIds && bookmarkedIds.has(post.id));
  return `<button type="button" class="bookmark-btn ${isBookmarked ? "is-bookmarked" : ""}" data-bookmark-toggle="${post.id}" aria-label="${isBookmarked ? "북마크 해제" : "북마크 추가"}" title="${isBookmarked ? "북마크 해제" : "북마크 추가"}">${isBookmarked ? "★" : "☆"}</button>`;
}

function postCardHtml(post, bookmarkedIds) {
  const bodyText = post.summary || post.raw_excerpt || "요약 준비 중입니다.";
  return `
    <article class="card">
      <div class="card__meta">
        ${badgeHtml(post.source)}
        <span class="card__date type-caption">${formatDate(post.published_at)}</span>
        ${bookmarkButtonHtml(post, bookmarkedIds)}
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
  const bookmarkedIds = await bookmarkedIdSet();

  return `
    ${digestHtml(newsPosts)}
    ${filterBarHtml(state, TECH_SOURCE_KEYS)}
    <section class="feed">
      ${
        filtered.length
          ? filtered.map((p) => postCardHtml(p, bookmarkedIds)).join("")
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
  const bookmarkedIds = await bookmarkedIdSet();

  return `
    <h2 class="type-headline">Fintech</h2>
    ${filterBarHtml(state, FINTECH_SOURCE_KEYS)}
    <section class="feed">
      ${
        filtered.length
          ? filtered.map((p) => postCardHtml(p, bookmarkedIds)).join("")
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
  const bookmarkedIds = await bookmarkedIdSet();

  return `
    <h2 class="type-headline">${escapeHtml(SOURCES[sourceKey].label)}</h2>
    <section class="feed">
      ${
        filtered.length
          ? filtered.map((p) => postCardHtml(p, bookmarkedIds)).join("")
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
  const bookmarkedIds = await bookmarkedIdSet();

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
            ? dayPosts.map((p) => postCardHtml(p, bookmarkedIds)).join("")
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
  const bookmarkedIds = await bookmarkedIdSet();

  return `
    <a class="back-link" href="#/">← 통합 피드로 돌아가기</a>
    <article class="detail">
      <div class="detail__meta">
        ${badgeHtml(post.source)}
        <span class="card__date type-caption">${formatDate(post.published_at)}</span>
        ${bookmarkButtonHtml(post, bookmarkedIds)}
      </div>
      <h1 class="detail__title type-headline">${escapeHtml(post.title)}</h1>
      <p class="detail__summary type-body">${escapeHtml(bodyText)}</p>
      <a class="type-link" href="${escapeHtml(post.url)}" target="_blank" rel="noopener">원문 보기 →</a>
    </article>
  `;
}

async function renderBookmarks() {
  const session = getSession();
  if (!session) {
    location.hash = "/login?next=" + encodeURIComponent("/bookmarks");
    return "";
  }
  const posts = await fetchPosts();
  const bookmarks = await fetchBookmarks(session.id);
  const bookmarkedIds = new Set(bookmarks.map((b) => b.post_id));
  const bookmarkedPosts = posts
    .filter((p) => bookmarkedIds.has(p.id))
    .sort((a, b) => (a.published_at < b.published_at ? 1 : -1));

  return `
    <h2 class="type-headline">북마크</h2>
    <section class="feed">
      ${
        bookmarkedPosts.length
          ? bookmarkedPosts.map((p) => postCardHtml(p, bookmarkedIds)).join("")
          : emptyStateHtml("아직 북마크한 항목이 없습니다.")
      }
    </section>
  `;
}

function chatEntryHtml(entry) {
  return `
    <article class="chat-entry">
      <p class="chat-entry__question type-body">${escapeHtml(entry.question)}</p>
      <p class="chat-entry__answer type-body">${escapeHtml(entry.answer)}</p>
      <span class="chat-entry__date type-caption">${formatDate(entry.created_at)}</span>
    </article>
  `;
}

async function renderChat() {
  const session = getSession();
  if (!session) {
    location.hash = "/login?next=" + encodeURIComponent("/chat");
    return "";
  }
  const logs = await fetchChatLogs(session.id);

  return `
    <h2 class="type-headline">AI 챗봇 — 핀테크 용어 질문</h2>
    <p class="auth-note type-body">궁금한 핀테크 용어나 개념을 질문해보세요. 질문/답변은 아카이브에 자동 저장됩니다.</p>
    <form class="chat-form" id="chatForm">
      <div class="field">
        <label for="chatQuestion">질문</label>
        <input type="text" id="chatQuestion" name="question" required placeholder="예: BNPL이 뭐야?" />
      </div>
      <button type="submit" class="pill pill-primary">질문하기</button>
      <p class="auth-note type-body" id="chatError" hidden></p>
    </form>
    <h3 class="type-headline">아카이브</h3>
    <div class="chat-log">
      ${logs.length ? logs.map(chatEntryHtml).join("") : emptyStateHtml("아직 질문한 내용이 없습니다.")}
    </div>
  `;
}

function renderLogin(query) {
  const session = getSession();
  const next = query.next || "/";
  if (session) {
    return `
      <h2 class="type-headline">로그인</h2>
      <p class="auth-note type-body">이미 ${escapeHtml(session.email)}로 로그인되어 있습니다.</p>
      <a class="type-link" href="#${next}">돌아가기 →</a>
    `;
  }

  return `
    <h2 class="type-headline">로그인</h2>
    <p class="auth-note type-body">이메일 매직링크로 로그인합니다. 비밀번호는 없습니다.</p>
    <form class="auth-form" id="loginForm">
      <div class="field">
        <label for="loginEmail">이메일</label>
        <input type="email" id="loginEmail" name="email" required placeholder="you@example.com" />
      </div>
      <button type="submit" class="pill pill-primary">매직링크로 로그인</button>
      <p class="auth-note type-body" id="loginStatus" hidden></p>
    </form>
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
  } else if (path === "/bookmarks") {
    html = await renderBookmarks();
  } else if (path === "/chat") {
    html = await renderChat();
  } else if (path === "/login") {
    html = renderLogin(query);
  } else if (itemMatch) {
    html = await renderItem(itemMatch[1]);
  } else {
    html = emptyStateHtml("페이지를 찾을 수 없습니다.");
  }

  app.innerHTML = html;
  wireHomeInteractions();
  wireBookmarkButtons();
  wireLoginForm();
  wireChatForm();
  renderNavAuth();
}

function wireBookmarkButtons() {
  document.querySelectorAll("[data-bookmark-toggle]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const session = getSession();
      if (!session) {
        const { path, query } = parseHash();
        const queryString = new URLSearchParams(query).toString();
        location.hash = "/login?next=" + encodeURIComponent(path + (queryString ? "?" + queryString : ""));
        return;
      }
      const postId = Number(btn.dataset.bookmarkToggle);
      try {
        await toggleBookmark(session.id, postId);
        render();
      } catch (err) {
        console.error("toggleBookmark failed:", err);
        alert("북마크 처리 중 오류가 발생했습니다. 다시 시도해주세요.");
      }
    });
  });
}

function wireLoginForm() {
  const form = document.getElementById("loginForm");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    if (!email) return;
    const statusEl = document.getElementById("loginStatus");
    const submitBtn = form.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    try {
      await signInWithMagicLink(email);
      form.querySelector(".field").remove();
      submitBtn.remove();
      statusEl.hidden = false;
      statusEl.textContent = `${email}로 매직링크를 보냈습니다. 이메일의 링크를 클릭하면 로그인이 완료됩니다.`;
    } catch (err) {
      console.error("signInWithMagicLink failed:", err);
      submitBtn.disabled = false;
      statusEl.hidden = false;
      statusEl.textContent = "매직링크 전송에 실패했습니다. 이메일 주소를 확인하고 다시 시도해주세요.";
    }
  });
}

function wireChatForm() {
  const form = document.getElementById("chatForm");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const session = getSession();
    if (!session) return;
    const question = form.question.value.trim();
    if (!question) return;
    const submitBtn = form.querySelector("button[type=submit]");
    const errorEl = document.getElementById("chatError");
    submitBtn.disabled = true;
    errorEl.hidden = true;
    try {
      await sendChatMessage(question);
      render();
    } catch (err) {
      console.error("sendChatMessage failed:", err);
      submitBtn.disabled = false;
      errorEl.hidden = false;
      errorEl.textContent = "답변을 가져오지 못했습니다. 잠시 후 다시 시도해주세요.";
    }
  });
}

function renderNavAuth() {
  const el = document.getElementById("navAuth");
  if (!el) return;
  const session = getSession();
  if (session) {
    el.innerHTML = `<span class="nav-auth__email" title="${escapeHtml(session.email)}">${escapeHtml(
      session.email
    )}</span> · <button type="button" class="link-btn" id="logoutBtn">로그아웃</button>`;
    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await signOut();
      render();
    });
  } else {
    el.innerHTML = `<a href="#/login">로그인</a>`;
  }
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
window.addEventListener("DOMContentLoaded", async () => {
  wireNavToggle();
  try {
    await initAuth();
  } catch (err) {
    // initAuth() already catches its own known failure modes; this is a
    // last-resort guard so an unexpected error still can't leave the page
    // permanently blank on first load.
    console.error("initAuth failed unexpectedly:", err);
  }
  render();
});
