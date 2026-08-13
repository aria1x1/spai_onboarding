# CLAUDE.md

Tech Update 대시보드 프로젝트의 작업 규칙입니다. 제품 요구사항은 `PRD.md` 참고.

## 작업 방식
- **한 번에 한 태스크만 진행한다.** 여러 기능/파일을 동시에 벌이지 않고, 작업 범위를 작게 쪼개 하나씩 끝낸 뒤 다음으로 넘어간다.
- **변경 후에는 반드시 브라우저에서 직접 열어 확인한다.** 코드 작성이 끝났다고 완료로 보지 않고, 로컬/배포 환경에서 실제 화면을 띄워 의도한 대로 동작하는지(레이아웃, 데이터 표시, 필터 등) 눈으로 검증한 다음에 해당 태스크를 완료 처리한다. 타입 체크/린트 통과만으로는 완료로 간주하지 않는다.

## 아키텍처 결정 배경
처음 요청받은 기술 규칙은 "순수 HTML/CSS/JS, index.html/style.css/app.js 3개 파일, localStorage 저장"이었으나, PRD의 핵심 기능(3.1/3.2: 여러 소스를 주기적으로 서버에서 수집·요약)과 직접 충돌했다:
- localStorage는 브라우저별 저장소라 자동 주기 수집이 불가능하고 기기 간 공유도 안 됨
- 브라우저에서 RSS를 직접 fetch하면 CORS로 막힘 (github.blog, huggingface.co, blog.langchain.dev 등)
- 브라우저 JS에서 Claude API를 직접 호출하면 API 키가 페이지 소스에 노출됨

사용자와 협의 후 **Supabase(DB) + Vercel(호스팅/서버리스 함수) 조합으로 위 문제를 해결**하기로 결정함 (2026-08-12). 프론트엔드의 "3파일 원칙"은 유지하되, 수집/요약을 위한 서버리스 함수 1개만 예외로 허용한다.

**2026-08-13 결정 (Fintech 탭 / AI 챗봇 확장):**
- AI 챗봇 응답 생성(Claude API 호출)을 브라우저에서 직접 하면 API 키가 노출되므로, `api/collect.js`와 동일한 이유로 서버리스 함수 1개(`api/chat.js`)를 추가 예외로 허용한다.
- Fintech 4개 소스는 별도 테이블을 만들지 않고 기존 `posts` 테이블의 `source` 값 종류만 늘려서 처리한다 (아래 기술 스택 참고). 스키마를 늘리지 않는 선택.

**2026-08-13 롤백 결정 (로그인/북마크 제거):** 같은 날 도입했던 Supabase Auth 이메일 매직링크 로그인이 실제로 붙지 않아(매직링크 세션 복원 계속 실패) 사용자와 협의해 **로그인 기능 자체를 제거**하기로 결정함. 로그인에 의존하던 기능도 함께 정리한다:
- 북마크 기능 삭제 (로그인 없이는 "내 북마크"라는 개념이 성립하지 않음. `bookmarks` 테이블/RLS 정책도 더 이상 사용하지 않음).
- AI 챗봇의 질문/답변 아카이브 저장 삭제. 챗봇 자체는 유지하되 로그인 없이 누구나 쓸 수 있고, 답변은 저장하지 않고 화면에만 표시한다 (`chat_logs` 테이블/RLS 정책도 더 이상 사용하지 않음).
- Fintech 뉴스 수집(`api/collect.js`)은 로그인과 무관하므로 이번 롤백의 영향을 받지 않고 그대로 유지한다.

**2026-08-13 임시 조치 (목업 데이터 fallback):** 배포 후 `posts`가 계속 비어 있는 것으로 확인됨 — `api/collect.js`가 Vercel 크론으로 아직 한 번도 성공적으로 돌지 않았거나 환경변수가 누락된 것으로 추정. 사용자가 화면에 뭔가 보이는 상태를 먼저 원해서, `app.js`에 `MOCK_POSTS`(8개 소스 각 3건, 2026-08-13에 각 소스 실제 RSS/아카이브에서 가져온 실제 제목·URL)를 하드코딩하고 `fetchPosts()`가 Supabase 조회 결과가 비어 있거나 실패할 때만 이를 반환하도록 함. 이 예외는 "app.js는 mock 없이 Supabase만 읽는다"는 기존 원칙을 임시로 깨는 것이며, `api/collect.js`가 실제로 `posts`를 채우는 것이 확인되면(Vercel 환경변수·크론 점검) `MOCK_POSTS`와 관련 fallback 분기를 반드시 삭제한다.

**2026-08-13 결정 (챗봇을 Gemini API로 전환):** `api/chat.js`를 Haiku → Sonnet 5로 올린 뒤에도 배포 환경에서 답변 요청이 계속 실패("답변을 가져오지 못했습니다")했음. 정확한 원인(환경변수 누락, 신규 도입한 `web_search_20260209` 도구 문제 등)을 진단하기 전에 사용자가 Claude 대신 **Gemini API로 전환**하기로 결정함 — 따라서 원인이 Claude/Anthropic 쪽 설정 문제였을 가능성은 확인되지 않은 채로 남아 있다. `api/chat.js`만 Gemini(`gemini-flash-latest`, REST `v1beta/models/{model}:generateContent` 엔드포인트)를 호출하도록 바뀌었고, system prompt·요청 검증·응답 미저장 원칙은 그대로 유지한다. `api/collect.js`는 이 결정과 무관하게 그대로 Claude(`claude-haiku-4-5-20251001`)를 계속 사용한다. `google_search` 그라운딩 도구는 curl로 확인해보니 이 API 키에서 429(RESOURCE_EXHAUSTED)를 반환해 뺐다 — 일반 텍스트 생성 할당량과 별도로 그라운딩 전용 할당량/결제가 필요한 것으로 추정되며, 확인 전까지는 검색 없이 모델 자체 지식으로만 답변한다.

## 파일 구성 (고정)
```
index.html       # 마크업만
style.css        # 전체 스타일
app.js           # 전체 클라이언트 로직 (Supabase JS SDK로 posts 조회/필터링/렌더링, 로그인 없음)
api/collect.js   # 예외: Vercel Serverless Function — RSS/HTML 수집 + Claude 요약 + Supabase 저장 (테크 3소스 + 핀테크 4소스)
api/chat.js      # 예외: Vercel Serverless Function — 핀테크 특화 시스템 프롬프트로 Gemini API 호출 (로그인 불필요, 응답은 저장하지 않음)
vercel.json      # 예외: Vercel Cron 설정
```
- 프론트엔드 파일은 `index.html`, `style.css`, `app.js` 3개만 유지한다. 컴포넌트 분리, 별도 JS 모듈 파일, CSS 분리 등 추가 파일 생성 금지.
- `api/collect.js`, `api/chat.js`, `vercel.json`은 PRD의 "주기적 서버 수집"과 "AI 챗봇" 요구사항을 위한 필수 예외이며, 이 세 개 외에는 백엔드 파일을 늘리지 않는다.

## 기술 스택
- **프론트엔드**: 바닐라 HTML/CSS/JS(ES6+)만 사용. React/Vue 등 프레임워크, Webpack/Vite 등 번들러, TypeScript 도입 금지 (빌드 스텝 없이 그대로 배포).
- **외부 라이브러리**: npm install 금지. 필요한 경우 CDN `<script>` 태그로만 로드 (예: `@supabase/supabase-js`).
- **데이터 저장소**: Supabase(Postgres). `posts` 테이블 하나만 사용한다.
  - `posts` (source, title, url, published_at, summary, raw_excerpt, fetched_at): 테크 3소스 + 핀테크 4소스 공용. `source` 값에 `fintech_global` / `fintech_futures` / `thisweekinfintech` / `fintechtimes`를 추가한다. 새 컬럼은 만들지 않는다.
  - `app.js`는 Supabase anon key로 `posts`에 **읽기 전용(SELECT)**만 수행한다. RLS 정책으로 anon 역할은 SELECT만 허용하고 INSERT/UPDATE/DELETE는 service role에서만 가능하도록 설정한다.
  - `localStorage`는 대시보드 데이터 저장용이 아니라 **사용자 개인 설정**(마지막 선택한 필터, 테마 등 UI 상태)에만 사용한다.
- **인증**: 로그인 기능 없음 (2026-08-13 롤백 결정, 위 아키텍처 결정 배경 참고). 뉴스 피드와 AI 챗봇 모두 누구나 사용할 수 있다.
- **배포**: Vercel에 정적 사이트로 배포. `api/collect.js`, `api/chat.js`는 Vercel Serverless Function으로 함께 배포된다.
- **수집/요약 스케줄링**: `vercel.json`의 `crons` 설정으로 `api/collect.js`를 주기적으로 호출한다. 이 함수 안에서:
  1. GitHub/Hugging Face/LangChain RSS + 데일리 테크 뉴스 + 4개 핀테크 소스를 서버사이드로 fetch (CORS 문제 없음)
  2. Claude API로 신규 항목만 요약 (API 키는 서버 환경에서만 사용)
  3. Supabase에 service role key로 upsert (URL 기준 중복 방지)
- **AI 챗봇 처리**: `app.js`가 질문 텍스트를 `api/chat.js`로 전달하면, 이 함수가 핀테크 특화 시스템 프롬프트로 Gemini API(`v1beta/models/{model}:generateContent`)를 호출한 뒤 답변을 응답으로 돌려준다 (2026-08-13, Claude에서 전환 — 위 아키텍처 결정 배경 참고). `google_search` 그라운딩 도구는 할당량 문제로 빠져 있어 모델 자체 지식으로만 답변한다. 로그인/사용자 식별 없이 누구나 호출할 수 있고, 질문/답변은 서버에 저장하지 않는다.
- **소스별 수집 방식** (2026-08-13 실제 URL 확인, `api/collect.js`의 `SOURCES`가 최종 소스):
  - GitHub Blog: RSS `https://github.blog/feed/`
  - Hugging Face Blog: RSS `https://huggingface.co/blog/feed.xml` (전체 아카이브를 반환하므로 최신 `MAX_ITEMS_PER_SOURCE`개만 사용)
  - LangChain Blog: RSS `https://www.langchain.com/blog/rss.xml` (`blog.langchain.dev/rss/`는 더 이상 유효하지 않고 이 주소로 리다이렉트됨)
  - Daily Tech News: RSS `https://hnrss.org/frontpage` (Hacker News는 공식 RSS가 없어 서드파티 프록시 사용)
  - fintech.global: RSS `https://fintech.global/feed/`
  - FinTech Futures: RSS `https://www.fintechfutures.com/rss.xml` (`/feed/`는 404)
  - This Week in Fintech: **RSS 없음** — Beehiiv 커스텀 도메인이라 `/feed` 계열이 전부 404. `https://www.thisweekinfintech.com/archive`를 HTML로 받아 `aria-label` 속성에서 제목을 추출하는 방식으로 대체. 발행일을 알 수 없어 수집 시각을 `published_at`으로 대신 사용.
  - The Fintech Times: RSS `https://fintechtimes.co.kr/data/rss/news.xml` (홈페이지 `<link rel="alternate">`에서 발견, `/feed/`는 404)

## 비밀키 관리
- `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`는 Vercel 환경변수로만 관리한다. 프론트엔드 코드(`app.js`, `index.html`)에 절대 하드코딩하지 않는다.
- 프론트엔드에 넣어도 되는 키는 Supabase **anon(public) key**뿐이며, 이 키는 RLS로 `posts` SELECT만 허용하므로 노출되어도 안전한 범위로 제한한다. (2026-08-13) `app.js` 상단의 `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY`가 이 키다 — 새 publishable key 포맷(`sb_publishable_...`)을 사용했다.
- `api/collect.js`, `api/chat.js`가 실제로 요구하는 Vercel 환경변수 (2026-08-13 Gemini 전환 반영 기준):
  - `SUPABASE_URL` — 프로젝트 REST 엔드포인트 베이스 URL (`https://<ref>.supabase.co`). `api/collect.js`에서만 사용.
  - `SUPABASE_SERVICE_ROLE_KEY` — `posts` 쓰기에 사용. `api/collect.js`에서만 사용 (로그인/`chat_logs`가 없어진 `api/chat.js`는 더 이상 Supabase를 호출하지 않는다).
  - `ANTHROPIC_API_KEY` — `api/collect.js` 전용. Claude Messages API 직접 호출(SDK 없이 `fetch`)에 사용, 모델은 `claude-haiku-4-5-20251001`(대량 요약, 비용 우선).
  - `GEMINI_API_KEY` — `api/chat.js` 전용 (2026-08-13, Claude에서 전환 — 위 아키텍처 결정 배경 참고). Gemini `generateContent` API 직접 호출(SDK 없이 `fetch`)에 사용, 모델은 `gemini-flash-latest`.
  - `CRON_SECRET` — `api/collect.js` 전용. Vercel Cron은 이 값이 설정되어 있으면 자동으로 `Authorization: Bearer $CRON_SECRET` 헤더를 붙여 호출하므로, 함수는 이 헤더를 검증해 무단 호출(과금 남용)을 막는다.
- 두 함수 모두 npm 패키지(Anthropic SDK, Google SDK, `@supabase/supabase-js` 등) 없이 Supabase REST(PostgREST), Claude API, Gemini API를 순수 `fetch`로 직접 호출한다 (백엔드도 "파일 3개 + 예외 2개" 원칙을 지키기 위해 `package.json`/`node_modules`를 추가하지 않기로 함, 2026-08-13 결정).

## 코딩 규칙
- `app.js`는 프레임워크 없이 DOM API를 직접 다룬다. 상태 관리 라이브러리 도입 금지.
- 소스별 배지 색상, 카드 레이아웃 등은 `style.css` 한 파일에만 정의한다.
- 개별 소스 수집 실패가 다른 소스에 영향을 주지 않도록 `api/collect.js` 내에서 소스별로 에러를 격리한다 (PRD 검증 기준 대응). 핀테크 4소스도 동일한 격리 원칙을 적용한다.
- `app.js`는 실제 Supabase 클라이언트로 연동되어 있다 — `fetchPosts`는 Supabase REST(PostgREST via JS SDK)로 `posts`를 읽기 전용 조회하고, `sendChatMessage`는 `fetch("/api/chat")`로 질문을 보내고 답변을 화면에만 표시한다(저장 없음). `SUPABASE_URL`/publishable key는 `app.js` 상단에 하드코딩되어 있다 (RLS로 보호되므로 노출되어도 안전, 위 비밀키 관리 절 참고).
- 로그인/북마크/챗봇 아카이브는 2026-08-13에 도입했다가 같은 날 롤백했다 (위 아키텍처 결정 배경 참고). `app.js`에 세션 관리, 매직링크, 북마크 관련 코드를 다시 추가하지 않는다.

## 참고
- 기존에 로컬 검증용으로 만들었던 Python/FastAPI 프로토타입(`tech-dashboard/app/*.py`)은 이 아키텍처 결정에 따라 더 이상 사용하지 않는다. 신규 구현은 이 문서 기준(정적 프론트 + Supabase + Vercel)으로 새로 진행한다.
