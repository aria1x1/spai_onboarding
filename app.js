// Tech Update Dashboard — client-side app.
// Data model matches the PRD/CLAUDE.md `posts` table shape:
// { id, source, title, url, published_at, summary, raw_excerpt }
// NOTE: MOCK_POSTS below stands in for the real Supabase read until
// api/collect.js + Supabase are wired up. Swap `fetchPosts()` only.

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

const MOCK_POSTS = [
  {
    id: 1,
    source: "github",
    title: "From coder to orchestrator: how agents shift the role of a developer",
    url: "https://github.blog/developer-skills/career-growth/from-coder-to-orchestrator/",
    published_at: "2026-08-11T09:00:00Z",
    summary:
      "개발자가 코드 자체보다 코드 주변의 전달 시스템을 더 많이 소유하게 되는 흐름을 짚는다. 에이전트가 반복 작업을 맡으면서 개발자의 역할이 '작성자'에서 '오케스트레이터'로 이동하고 있다는 것이 핵심 주장이다. GitHub Universe에서 관련 세션이 예정되어 있다.",
    raw_excerpt: "",
  },
  {
    id: 2,
    source: "github",
    title: "Using the GitHub Copilot SDK for Java",
    url: "https://github.blog/engineering/using-the-github-copilot-sdk-for-java/",
    published_at: "2026-08-10T09:00:00Z",
    summary:
      "Java 개발자를 위한 새로운 Copilot SDK 사용법을 소개한다. 어노테이션과 가상 스레드를 활용해 관용적인 Java 코드에서 Copilot을 직접 구동할 수 있다는 내용이 핵심이다.",
    raw_excerpt: "",
  },
  {
    id: 3,
    source: "huggingface",
    title: "Scaling diffusion transformers for open video generation on consumer GPUs",
    url: "https://huggingface.co/blog/scaling-diffusion-transformers-open-video",
    published_at: "2026-08-11T14:00:00Z",
    summary:
      "소비자용 GPU에서도 실행 가능한 수준으로 디퓨전 트랜스포머 기반 비디오 생성 모델을 경량화한 연구를 소개한다. 메모리 사용량을 줄이기 위한 체크포인팅 전략과 양자화 기법을 함께 다룬다.",
    raw_excerpt: "",
  },
  {
    id: 4,
    source: "huggingface",
    title: "Introducing the 2026 State of Open Models report",
    url: "https://huggingface.co/blog/state-of-open-models-2026",
    published_at: "2026-08-09T11:00:00Z",
    summary: "",
    raw_excerpt:
      "이 글은 아직 요약이 생성되지 않아 원문 발췌만 표시됩니다. 2026년 오픈소스 모델 생태계의 다운로드 추이, 라이선스 분포, 커뮤니티 기여 현황을 다루는 연례 리포트가 공개되었습니다.",
  },
  {
    id: 5,
    source: "langchain",
    title: "Building monday.com's Sidekick: why capable agents need more than just tools",
    url: "https://www.langchain.com/blog/building-monday-com-sidekick",
    published_at: "2026-08-08T10:00:00Z",
    summary:
      "단순히 도구 호출 능력만으로는 실제 프로덕션 에이전트를 만들 수 없다는 사례 연구. monday.com의 Sidekick 에이전트를 만들며 겪은 메모리, 평가, 오류 복구 설계 이슈를 정리했다.",
    raw_excerpt: "",
  },
  {
    id: 6,
    source: "langchain",
    title:
      "왜 초장문 제목은 카드 레이아웃에서 줄바꿈과 말줄임 처리를 반드시 함께 테스트해야만 실제 서비스에서 사고 없이 배포될 수 있는가에 대한 아주 긴 예시 제목입니다",
    url: "https://www.langchain.com/blog/long-title-overflow-test-example",
    published_at: "2026-08-07T10:00:00Z",
    summary:
      "이 항목은 디자인 QA용 의도적인 긴 텍스트 샘플입니다. 카드 제목과 요약이 좁은 모바일 화면에서도 레이아웃을 깨지 않고 줄바꿈되는지, 4줄 이상일 때 말줄임(...)이 정상 동작하는지 확인하기 위해 일부러 매우 긴 문장을 반복해서 채워 넣습니다. 실제 배포 데이터에는 이렇게 긴 제목/요약이 등장하지 않을 수도 있지만, 방어적으로 스타일을 검증해 두는 것이 안전합니다.",
    raw_excerpt: "",
  },
  {
    id: 7,
    source: "news",
    title: "Nvidia Nemotron 3.5 Lightning and NeMo Switchyard",
    url: "https://blogs.nvidia.com/blog/nemotron-lightning-switchyard-rtx-dgx/",
    published_at: "2026-08-11T05:00:00Z",
    summary: "",
    raw_excerpt: "Hacker News 포인트: 183 (원문은 외부 링크로, 본문 발췌가 제공되지 않습니다)",
  },
  {
    id: 8,
    source: "news",
    title: "Compression is prediction",
    url: "https://ngrok.com/blog/compression-is-prediction",
    published_at: "2026-08-11T02:00:00Z",
    summary: "",
    raw_excerpt: "Hacker News 포인트: 263 (원문은 외부 링크로, 본문 발췌가 제공되지 않습니다)",
  },
  {
    id: 9,
    source: "news",
    title: "Go is an ideal language for AI-assisted software engineering",
    url: "https://developers.googleblog.com/why-go-is-an-ideal-language-for-ai-assisted-software-engineering/",
    published_at: "2026-08-08T03:00:00Z",
    summary: "",
    raw_excerpt: "Hacker News 포인트: 146 (원문은 외부 링크로, 본문 발췌가 제공되지 않습니다)",
  },
  {
    id: 10,
    source: "fintech_global",
    title: "Stablecoin settlement rails see record cross-border volume in July",
    url: "https://fintech.global/2026/08/11/stablecoin-settlement-rails-record-cross-border-volume/",
    published_at: "2026-08-11T07:00:00Z",
    summary:
      "7월 스테이블코인 기반 국경 간 결제 정산량이 사상 최고치를 기록했다는 소식. 기존 SWIFT 대비 정산 속도와 수수료 이점이 확산의 주요 동인으로 지목된다.",
    raw_excerpt: "",
  },
  {
    id: 11,
    source: "fintech_futures",
    title: "UK challenger bank rolls out embedded lending for SME marketplaces",
    url: "https://www.fintechfutures.com/2026/08/uk-challenger-bank-embedded-lending-sme-marketplaces/",
    published_at: "2026-08-11T08:30:00Z",
    summary:
      "영국 챌린저뱅크가 중소기업 마켓플레이스에 임베디드 대출 상품을 출시했다는 소식. 마켓플레이스 체크아웃 단계에서 즉시 신용 한도를 제공하는 방식이 핵심이다.",
    raw_excerpt: "",
  },
  {
    id: 12,
    source: "thisweekinfintech",
    title: "Weekly roundup: BNPL consolidation, open banking API updates, and Q2 funding data",
    url: "https://www.thisweekinfintech.com/weekly-roundup-bnpl-open-banking-q2-funding/",
    published_at: "2026-08-10T12:00:00Z",
    summary: "",
    raw_excerpt:
      "이 글은 아직 요약이 생성되지 않아 원문 발췌만 표시됩니다. BNPL 업계 통합 동향, 오픈뱅킹 API 표준 업데이트, 2분기 핀테크 펀딩 데이터를 다루는 주간 다이제스트입니다.",
  },
  {
    id: 13,
    source: "fintechtimes",
    title: "국내 핀테크사, 마이데이터 2.0 대응한 자산관리 서비스 개편",
    url: "https://fintechtimes.co.kr/2026/08/11/mydata-2-0-asset-management-revamp/",
    published_at: "2026-08-11T10:00:00Z",
    summary:
      "국내 주요 핀테크사들이 마이데이터 2.0 시행에 맞춰 자산관리 서비스를 개편하고 있다는 소식. 데이터 제공 범위 확대와 API 표준 변경에 따른 대응 방안을 정리했다.",
    raw_excerpt: "",
  },
];

// ---------------------------------------------------------------------------
// Mock auth + bookmarks — stand-ins for Supabase Auth (email magic link) and
// the `bookmarks` table (RLS-scoped to auth.uid()). Swap getSession/mockSignIn/
// mockSignOut/fetchBookmarks/toggleBookmark for real Supabase calls later;
// nothing else in this file should need to change.
// ---------------------------------------------------------------------------

const SESSION_STORAGE_KEY = "techdash:mockSession";
const BOOKMARKS_STORAGE_KEY = "techdash:mockBookmarks";

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function mockSignIn(email) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ email }));
}

function mockSignOut() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

function loadAllBookmarks() {
  try {
    return JSON.parse(localStorage.getItem(BOOKMARKS_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveAllBookmarks(bookmarks) {
  localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(bookmarks));
}

async function fetchBookmarks(email) {
  return loadAllBookmarks().filter((b) => b.user_email === email);
}

async function toggleBookmark(email, postId) {
  const all = loadAllBookmarks();
  const idx = all.findIndex((b) => b.user_email === email && b.post_id === postId);
  if (idx >= 0) {
    all.splice(idx, 1);
  } else {
    all.push({ user_email: email, post_id: postId, created_at: new Date().toISOString() });
  }
  saveAllBookmarks(all);
}

async function bookmarkedIdSet() {
  const session = getSession();
  if (!session) return new Set();
  const bookmarks = await fetchBookmarks(session.email);
  return new Set(bookmarks.map((b) => b.post_id));
}

// ---------------------------------------------------------------------------
// Mock AI chatbot — stand-in for api/chat.js (Claude API with a FinTech-
// specialized system prompt) and the `chat_logs` table. Swap sendChatMessage
// for a fetch("/api/chat", ...) call and fetchChatLogs for a Supabase read
// later; the view/render code below should not need to change.
// ---------------------------------------------------------------------------

const CHAT_LOGS_STORAGE_KEY = "techdash:mockChatLogs";

const MOCK_FINTECH_GLOSSARY = [
  {
    keywords: ["bnpl", "선구매 후결제", "후불결제"],
    answer:
      "BNPL(Buy Now, Pay Later)은 구매 시점에 전액을 지불하지 않고 정해진 기간에 나눠 갚는 후불결제 서비스입니다. 신용카드 할부와 달리 별도 카드 발급 없이 체크아웃 단계에서 즉시 심사·승인되는 경우가 많고, 가맹점이 수수료를 부담하는 구조가 일반적입니다.",
  },
  {
    keywords: ["오픈뱅킹", "open banking"],
    answer:
      "오픈뱅킹은 은행이 표준화된 API를 통해 결제·계좌 정보를 제3자 서비스에 개방하는 체계입니다. 사용자 동의를 전제로 여러 은행의 계좌를 하나의 앱에서 조회·이체할 수 있게 해주는 것이 핵심입니다.",
  },
  {
    keywords: ["마이데이터", "mydata"],
    answer:
      "마이데이터는 금융소비자가 본인의 금융 데이터를 여러 기관에서 통합 조회하고, 원하는 사업자에게 데이터 전송을 요청할 수 있게 하는 제도입니다. 개인이 자신의 데이터 활용을 직접 통제한다는 점이 핵심입니다.",
  },
  {
    keywords: ["스테이블코인", "stablecoin"],
    answer:
      "스테이블코인은 달러 등 법정화폐나 자산에 가치를 고정시켜 가격 변동성을 낮춘 암호화폐입니다. 변동성이 큰 다른 코인과 달리 결제·정산 수단으로 활용하기 위해 설계되었습니다.",
  },
  {
    keywords: ["임베디드 금융", "embedded finance", "임베디드 대출", "임베디드 결제"],
    answer:
      "임베디드 금융은 은행이 아닌 비금융 플랫폼(쇼핑몰, 마켓플레이스 등)이 결제·대출·보험 같은 금융 서비스를 자사 서비스 흐름 안에 직접 내장해 제공하는 방식입니다. 사용자는 별도 금융 앱으로 이동하지 않고 이용 중인 서비스 안에서 금융 기능을 이용합니다.",
  },
];

function lookupGlossaryAnswer(question) {
  const normalized = question.toLowerCase();
  const match = MOCK_FINTECH_GLOSSARY.find((entry) =>
    entry.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))
  );
  if (match) return match.answer;
  return `"${question}"에 대한 답변(모의 응답): 이 용어는 아직 목업 용어집에 없어 일반적인 설명으로 대체합니다. 실제 연동 시에는 api/chat.js를 통해 핀테크 특화 프롬프트로 Claude API가 답변을 생성합니다.`;
}

async function sendChatMessage(question) {
  return lookupGlossaryAnswer(question);
}

function loadAllChatLogs() {
  try {
    return JSON.parse(localStorage.getItem(CHAT_LOGS_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveAllChatLogs(logs) {
  localStorage.setItem(CHAT_LOGS_STORAGE_KEY, JSON.stringify(logs));
}

async function fetchChatLogs(email) {
  return loadAllChatLogs()
    .filter((log) => log.user_email === email)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

async function addChatLog(email, question, answer) {
  const all = loadAllChatLogs();
  all.push({ user_email: email, question, answer, created_at: new Date().toISOString() });
  saveAllChatLogs(all);
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

// Stand-in for the future Supabase read. Keep this the only function that
// needs to change when api/collect.js + Supabase are wired up.
async function fetchPosts() {
  return MOCK_POSTS;
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
  const bookmarks = await fetchBookmarks(session.email);
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
  const logs = await fetchChatLogs(session.email);

  return `
    <h2 class="type-headline">AI 챗봇 — 핀테크 용어 질문</h2>
    <p class="auth-note type-body">궁금한 핀테크 용어나 개념을 질문해보세요. 질문/답변은 아카이브에 자동 저장됩니다.</p>
    <form class="chat-form" id="chatForm">
      <div class="field">
        <label for="chatQuestion">질문</label>
        <input type="text" id="chatQuestion" name="question" required placeholder="예: BNPL이 뭐야?" />
      </div>
      <button type="submit" class="pill pill-primary">질문하기</button>
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
    <form class="auth-form" id="loginForm" data-next="${escapeHtml(next)}">
      <div class="field">
        <label for="loginEmail">이메일</label>
        <input type="email" id="loginEmail" name="email" required placeholder="you@example.com" />
      </div>
      <button type="submit" class="pill pill-primary">매직링크로 로그인</button>
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
      await toggleBookmark(session.email, postId);
      render();
    });
  });
}

function wireLoginForm() {
  const form = document.getElementById("loginForm");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    if (!email) return;
    mockSignIn(email);
    const next = form.dataset.next || "/";
    if (next === parseHash().path) {
      render();
    } else {
      location.hash = next;
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
    submitBtn.disabled = true;
    const answer = await sendChatMessage(question);
    await addChatLog(session.email, question, answer);
    render();
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
    document.getElementById("logoutBtn").addEventListener("click", () => {
      mockSignOut();
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
window.addEventListener("DOMContentLoaded", () => {
  wireNavToggle();
  render();
});
