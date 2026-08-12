// Tech Update Dashboard — client-side app.
// Data model matches the PRD/CLAUDE.md `posts` table shape:
// { id, source, title, url, published_at, summary, raw_excerpt }
// NOTE: MOCK_POSTS below stands in for the real Supabase read until
// api/collect.js + Supabase are wired up. Swap `fetchPosts()` only.

const SOURCES = {
  github: { label: "GitHub Blog", badgeClass: "badge-github" },
  huggingface: { label: "Hugging Face Blog", badgeClass: "badge-huggingface" },
  langchain: { label: "LangChain Blog", badgeClass: "badge-langchain" },
  news: { label: "Daily Tech News", badgeClass: "badge-news" },
};
const SOURCE_KEYS = Object.keys(SOURCES);

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
];

const FILTER_STORAGE_KEY = "techdash:lastFilter"; // UI preference only — never dashboard data.

function loadSavedFilter() {
  try {
    return JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveFilter(filter) {
  localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filter));
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

function filterBarHtml(state) {
  const pills = SOURCE_KEYS.map((key) => {
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
  const posts = await fetchPosts();
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
    ${filterBarHtml(state)}
    <section class="feed">
      ${filtered.length ? filtered.map(postCardHtml).join("") : emptyStateHtml("조건에 맞는 항목이 없습니다.")}
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
      ${filtered.length ? filtered.map(postCardHtml).join("") : emptyStateHtml("아직 수집된 항목이 없습니다.")}
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
        ${dayPosts.length ? dayPosts.map(postCardHtml).join("") : emptyStateHtml("선택한 날짜에 항목이 없습니다.")}
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
  } else if (itemMatch) {
    html = await renderItem(itemMatch[1]);
  } else {
    html = emptyStateHtml("페이지를 찾을 수 없습니다.");
  }

  app.innerHTML = html;
  wireHomeInteractions();
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
    const state = {
      source: form.dataset.selectedSource ?? parseHash().query.source ?? "",
      date_from: form.date_from.value,
      date_to: form.date_to.value,
    };
    saveFilter(state);
    const params = new URLSearchParams();
    if (state.source) params.set("source", state.source);
    if (state.date_from) params.set("date_from", state.date_from);
    if (state.date_to) params.set("date_to", state.date_to);
    location.hash = `/${params.toString() ? "?" + params.toString() : ""}`;
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
