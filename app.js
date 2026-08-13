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

// Temporary fallback shown only while `posts` is empty in Supabase (e.g.
// api/collect.js hasn't run/succeeded yet on Vercel). Real article titles
// and URLs pulled from each source's live feed on 2026-08-13 — see
// CLAUDE.md "임시 조치 (목업 데이터 fallback)". Delete this block once
// api/collect.js is confirmed populating `posts` for real.
const MOCK_POSTS = [
  { id: 9000001, source: "github", title: "GitHub availability report: July 2026", url: "https://github.blog/news-insights/company-news/github-availability-report-july-2026/", published_at: "2026-08-12T22:17:32Z", summary: "2026년 7월 GitHub 서비스에서 발생한 8건의 장애를 정리한 가동성 보고서입니다. 8월 6일 GitHub Actions 장애의 영향과 원인 분석 진행 상황을 다루고, Azure로의 인프라 이전을 가속화해 격리성과 복원력을 높이겠다는 계획을 밝혔습니다." },
  { id: 9000002, source: "github", title: "Write your first prompt with the GitHub Copilot app", url: "https://github.blog/ai-and-ml/github-copilot/write-your-first-prompt-with-the-github-copilot-app/", published_at: "2026-08-12T19:00:00Z", summary: "GitHub Copilot 앱에서 첫 프롬프트를 작성하는 방법을 안내하는 글입니다. 적절한 컨텍스트와 모델을 선택하는 법, 첫 작업을 자신 있게 시작하는 팁을 다룹니다." },
  { id: 9000003, source: "github", title: "Your contributors are AI-first now. Is your project?", url: "https://github.blog/open-source/maintainers/your-contributors-are-ai-first-now-is-your-project/", published_at: "2026-08-12T18:00:08Z", summary: "AI 기여자가 이미 오픈소스 프로젝트의 이슈·PR 큐에 들어오고 있다는 내용입니다. AutoGPT 메인테이너 Nicholas Tindle이 AI 기여자를 다루기 위한 저장소 가이드라인과 경계 설정 방법을 공유합니다." },
  { id: 9000004, source: "huggingface", title: "Introducing OlmoEarth embeddings: Custom embedding exports from OlmoEarth Studio for downstream analysis", url: "https://huggingface.co/blog/allenai/olmoearth-embeddings", published_at: "2026-08-12T16:14:36Z", summary: "OlmoEarth Studio에서 다운스트림 분석용 커스텀 임베딩을 내보낼 수 있는 기능을 소개합니다. 위성·지구관측 데이터를 임베딩으로 변환해 별도 모델 학습 없이 분류·검색 등에 활용할 수 있습니다." },
  { id: 9000005, source: "huggingface", title: "LFM2.5-VL-3B for Better and Faster Vision Capabilities for the Edge", url: "https://huggingface.co/blog/LiquidAI/lfm2-5-vl-3b", published_at: "2026-08-12T14:00:51Z", summary: "엣지 환경에서 더 빠르고 정확한 비전 처리를 지원하는 30억 파라미터급 비전-언어 모델 LFM2.5-VL-3B를 소개합니다. 온디바이스 추론 성능과 정확도 개선에 초점을 맞췄습니다." },
  { id: 9000006, source: "huggingface", title: "Thinking of ACE? We Can Do It with Fewer Tokens", url: "https://huggingface.co/blog/ibm-research/altk-evolve-sldd", published_at: "2026-08-11T13:37:10Z", summary: "IBM Research가 제안하는 ALTK/Evolve-SLDD 기법을 소개합니다. ACE(Agentic Context Engineering) 방식보다 더 적은 토큰으로 비슷한 성능을 얻는 방법을 다룹니다." },
  { id: 9000007, source: "langchain", title: "Why managed agents are the next big thing in agent building", url: "https://www.langchain.com/blog/why-managed-agents-are-the-next-big-thing-in-agent-building", published_at: "2026-08-13T00:00:06Z", summary: "Managed Deep Agents는 런타임, 스트리밍, 샌드박스, 평가, 메모리, 인증까지 내장된 관리형 방식으로 Deep Agent를 만들고 배포할 수 있게 해줍니다. 매니지드 에이전트가 에이전트 개발의 다음 흐름이 될 것이라는 전망을 다룹니다." },
  { id: 9000008, source: "langchain", title: "LangSmith BYOC on AWS is generally available", url: "https://www.langchain.com/blog/langsmith-byoc-is-now-generally-available-on-aws", published_at: "2026-08-12T18:50:08Z", summary: "LangSmith의 BYOC(Bring Your Own Cloud)가 AWS에서 정식 출시되었습니다. 엔터프라이즈 팀이 자사 VPC 안에서 관찰성(observability), 평가, 배포를 관리형으로 이용할 수 있습니다." },
  { id: 9000009, source: "langchain", title: "What is an AI agent?", url: "https://www.langchain.com/blog/what-is-an-agent", published_at: "2026-08-12T08:57:48Z", summary: "AI 에이전트가 무엇인지, LLM 루프 안에서 어떻게 동작하는지, 워크플로우와의 차이점을 설명하는 입문 가이드입니다. 신뢰할 수 있는 프로덕션급 자율 시스템을 만들기 위한 기초 개념을 다룹니다." },
  { id: 9000010, source: "news", title: "Show HN: Ballet – Workflow automation that writes integrations against any API", url: "https://www.ballet.dev/", published_at: "2026-08-13T00:01:43Z", summary: "임의의 API에 대한 연동 코드를 자동으로 작성해주는 워크플로우 자동화 도구 Ballet를 소개하는 Show HN 게시물입니다." },
  { id: 9000011, source: "news", title: "Happy 45th Birthday to the IBM PC and Model F/XT", url: "https://sharktastica.co.uk/articles/pc-fxt-45", published_at: "2026-08-12T23:50:33Z", summary: "IBM PC와 Model F/XT 키보드 출시 45주년을 기념하는 회고 글로, 초기 IBM PC의 하드웨어와 역사적 의미를 다룹니다." },
  { id: 9000012, source: "news", title: "Build Wide, Ship Narrow", url: "https://adapt.com/blog/build-wide-ship-narrow", published_at: "2026-08-12T23:43:48Z", summary: "제품을 넓게 탐색하되 실제로 출시할 때는 좁고 명확한 범위로 좁혀야 한다는 제품 개발 전략을 다루는 글입니다." },
  { id: 9000013, source: "fintech_global", title: "Comply Exchange's August report tracks global tax shake-up", url: "https://fintech.global/2026/08/12/comply-exchanges-august-report-tracks-global-tax-shake-up/", published_at: "2026-08-12T17:25:18Z", summary: "Comply Exchange의 2026년 7월 컴플라이언스 리포트에 따르면, 여러 국가의 세무당국이 FATCA·CRS·CARF 보고 체계를 더 엄격하게 강화하고 있다는 내용을 다룹니다." },
  { id: 9000014, source: "fintech_global", title: "Why the AI trade splintered beneath a steady market", url: "https://fintech.global/2026/08/12/why-the-ai-trade-splintered-beneath-a-steady-market/", published_at: "2026-08-12T17:13:39Z", summary: "Exante의 7월 주식시장 리뷰로, 표면적으로는 잠잠했던 지수 뒤에서 AI 관련 종목들의 로테이션이 크게 흔들렸다는 분석을 담고 있습니다." },
  { id: 9000015, source: "fintech_global", title: "How Identomat is tackling financial crime at the identity layer", url: "https://fintech.global/2026/08/12/how-identomat-is-tackling-financial-crime-at-the-identity-layer/", published_at: "2026-08-12T16:43:36Z", summary: "신원 인증 스타트업 Identomat의 CEO David Lomiashvili와의 인터뷰로, 신원 계층에서 금융 범죄를 예방하는 자동화 접근법을 다룹니다." },
  { id: 9000016, source: "fintech_futures", title: "Thomaston Savings Bank overhauls ATM network with Diebold Nixdorf", url: "https://www.fintechfutures.com/branches-atms/thomaston-savings-bank-atm-technology-diebold-nixdorf", published_at: "2026-08-13T06:00:00Z", summary: "Thomaston Savings Bank가 Diebold Nixdorf의 DM7V 디스펜싱 모듈과 자동화된 운영 추적 도구로 ATM 네트워크를 전면 개편했다는 소식입니다." },
  { id: 9000017, source: "fintech_futures", title: "In trust we trust", url: "https://www.fintechfutures.com/bankingtech/in-trust-we-trust", published_at: "2026-08-13T04:30:00Z", summary: "금융업의 핵심 가치인 신뢰가 어떻게 변화해왔는지, 오늘날 신뢰를 얻기 위해 필요한 조건이 무엇인지 다루는 칼럼입니다." },
  { id: 9000018, source: "fintech_futures", title: "Cleversoft to acquire UK regtech FS Assist", url: "https://www.fintechfutures.com/m-a/cleversoft-to-acquire-fs-assist", published_at: "2026-08-12T11:26:51Z", summary: "PE가 투자한 컴플라이언스 기업 Cleversoft가 영국 레그테크 기업 FS Assist를 인수하며 유럽 확장을 이어간다는 소식입니다." },
  { id: 9000019, source: "thisweekinfintech", title: "Coinbase Brings Its Global Tokenization Ambitions to Abu Dhabi | TWIF - MENA", url: "https://www.thisweekinfintech.com/p/coinbase-brings-its-global-tokenization-ambitions-to-abu-dhabi-twif-mena", published_at: "2026-08-13T09:00:00Z", summary: "Coinbase가 아부다비를 거점으로 글로벌 토큰화(tokenization) 사업 확장에 나섰다는 소식을 다루는 TWIF MENA 뉴스레터입니다." },
  { id: 9000020, source: "thisweekinfintech", title: "The Public Ledger: Prime Time for Chime", url: "https://www.thisweekinfintech.com/p/the-public-ledger-prime-time-for-chime", published_at: "2026-08-13T08:59:00Z", summary: "네오뱅크 Chime이 본격적인 성장기에 접어들었다는 분석을 담은 The Public Ledger 칼럼입니다." },
  { id: 9000021, source: "thisweekinfintech", title: "Monzo Hits 1 Million Business Customers | TWIF UK and Europe", url: "https://www.thisweekinfintech.com/p/monzo-hits-1-million-business-customers-twif-uk-and-europe", published_at: "2026-08-13T08:58:00Z", summary: "영국 네오뱅크 Monzo가 비즈니스 고객 100만 명을 돌파했다는 소식을 다루는 TWIF UK·유럽 뉴스레터입니다." },
  { id: 9000022, source: "fintechtimes", title: "LG화학, 독립이사 참가 해외 거버넌스 기업설명회(NDR) 첫 개최", url: "https://www.fintechtimes.co.kr/news/article.html?no=57954", published_at: "2026-08-13T13:42:51+09:00", summary: "LG화학이 8월 13일 홍콩·싱가포르에서 열리는 해외 거버넌스 기업설명회(NDR)에 독립이사를 처음으로 참가시킨다고 밝혔습니다. 이사회 운영 현황과 개정 상법 대응을 공유하는 자리입니다." },
  { id: 9000023, source: "fintechtimes", title: "다올투자증권, 전사 AI 활용 역량 강화 교육 실시", url: "https://www.fintechtimes.co.kr/news/article.html?no=57953", published_at: "2026-08-13T13:35:36+09:00", summary: "다올투자증권이 전 임직원을 대상으로 생성형 AI 활용 역량 강화 교육을 실시합니다. 프롬프트 핵심 기법부터 데이터 분석, 실무 적용까지 다루며 업무 생산성 향상을 목표로 합니다." },
  { id: 9000024, source: "fintechtimes", title: "KB금융, 독립유공자 후손 소상공인 지원하는 '명품가게' 2차년도 참여자 모집", url: "https://www.fintechtimes.co.kr/news/article.html?no=57951", published_at: "2026-08-13T13:08:41+09:00", summary: "KB금융그룹이 광복절을 맞아 독립유공자 후손 소상공인을 지원하는 '명품가게' 프로젝트의 2차년도 참여자를 모집합니다. 점포·주거환경 개선을 통해 안정적인 생업 기반을 지원하는 사회공헌 프로젝트입니다." },
];

async function fetchPosts() {
  const { data, error } = await supabaseClient.from("posts").select("*").order("published_at", { ascending: false });
  if (error) {
    console.error("fetchPosts failed:", error);
    return MOCK_POSTS;
  }
  return data.length ? data : MOCK_POSTS;
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
    <section class="chat-panel">
      <header class="chat-panel__header">
        <h2 class="type-headline">AI 챗봇</h2>
        <p class="type-body-sm chat-panel__hint">궁금한 핀테크 용어나 개념을 질문해보세요.</p>
      </header>
      <div class="chat-log" id="chatAnswer" aria-live="polite"></div>
      <form class="chat-form" id="chatForm">
        <input
          type="text"
          id="chatQuestion"
          name="question"
          required
          autocomplete="off"
          aria-label="질문"
          placeholder="예: BNPL이 뭐야?"
        />
        <button type="submit" class="pill pill-primary chat-form__send">질문하기</button>
      </form>
      <p class="chat-form__error type-body-sm" id="chatError" hidden></p>
    </section>
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

// Claude answers use "**bold**" for emphasis; escape first so the markdown
// markers themselves can't smuggle in HTML, then turn the escaped markers
// into <strong> around the (already-escaped) inner text.
function renderChatText(text) {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function chatBubbleHtml(role, text) {
  return `<div class="chat-bubble chat-bubble--${role}"><p class="type-body">${renderChatText(text)}</p></div>`;
}

const CHAT_LOADING_HTML = `
  <div class="chat-bubble chat-bubble--bot chat-bubble--loading">
    <span></span><span></span><span></span>
  </div>
`;

function wireChatForm() {
  const form = document.getElementById("chatForm");
  if (!form) return;
  const log = document.getElementById("chatAnswer");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const question = form.question.value.trim();
    if (!question) return;
    const submitBtn = form.querySelector("button[type=submit]");
    const errorEl = document.getElementById("chatError");
    submitBtn.disabled = true;
    errorEl.hidden = true;
    form.reset();

    log.insertAdjacentHTML("beforeend", chatBubbleHtml("user", question));
    log.insertAdjacentHTML("beforeend", CHAT_LOADING_HTML);
    const loadingBubble = log.lastElementChild;
    log.scrollTop = log.scrollHeight;

    try {
      const answer = await sendChatMessage(question);
      loadingBubble.outerHTML = chatBubbleHtml("bot", answer);
    } catch (err) {
      console.error("sendChatMessage failed:", err);
      loadingBubble.remove();
      errorEl.hidden = false;
      errorEl.textContent = "답변을 가져오지 못했습니다. 잠시 후 다시 시도해주세요.";
    } finally {
      submitBtn.disabled = false;
      log.scrollTop = log.scrollHeight;
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
