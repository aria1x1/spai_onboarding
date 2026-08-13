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

**2026-08-13 결정 (Fintech 탭 / 북마크 / AI 챗봇 확장):**
- 북마크와 AI 챗봇 아카이브는 "누구의 것인지"가 있어야 하는 사용자별 데이터다. 기존 PRD는 "계정 없음"을 전제했으나, 사용자와 협의해 **Supabase Auth 이메일 매직링크**로 최소한의 로그인을 도입하기로 결정함. 비밀번호/OAuth는 도입하지 않는다.
- AI 챗봇 응답 생성(Claude API 호출)도 브라우저에서 직접 하면 API 키가 노출되므로, `api/collect.js`와 동일한 이유로 서버리스 함수 1개(`api/chat.js`)를 추가 예외로 허용한다.
- Fintech 4개 소스는 별도 테이블을 만들지 않고 기존 `posts` 테이블의 `source` 값 종류만 늘려서 처리한다 (아래 기술 스택 참고). 스키마를 늘리지 않는 선택.

## 파일 구성 (고정)
```
index.html       # 마크업만
style.css        # 전체 스타일
app.js           # 전체 클라이언트 로직 (Supabase JS SDK로 데이터 조회/필터링/렌더링, Auth 세션 관리)
api/collect.js   # 예외: Vercel Serverless Function — RSS/HTML 수집 + Claude 요약 + Supabase 저장 (테크 3소스 + 핀테크 4소스)
api/chat.js      # 예외: Vercel Serverless Function — 핀테크 특화 시스템 프롬프트로 Claude API 호출, 응답을 chat_logs에 저장
vercel.json      # 예외: Vercel Cron 설정
```
- 프론트엔드 파일은 `index.html`, `style.css`, `app.js` 3개만 유지한다. 컴포넌트 분리, 별도 JS 모듈 파일, CSS 분리 등 추가 파일 생성 금지.
- `api/collect.js`, `api/chat.js`, `vercel.json`은 PRD의 "주기적 서버 수집"과 "AI 챗봇" 요구사항을 위한 필수 예외이며, 이 세 개 외에는 백엔드 파일을 늘리지 않는다.

## 기술 스택
- **프론트엔드**: 바닐라 HTML/CSS/JS(ES6+)만 사용. React/Vue 등 프레임워크, Webpack/Vite 등 번들러, TypeScript 도입 금지 (빌드 스텝 없이 그대로 배포).
- **외부 라이브러리**: npm install 금지. 필요한 경우 CDN `<script>` 태그로만 로드 (예: `@supabase/supabase-js`).
- **데이터 저장소**: Supabase(Postgres). 다음 3개 테이블을 사용한다.
  - `posts` (source, title, url, published_at, summary, raw_excerpt, fetched_at): 테크 3소스 + 핀테크 4소스 공용. `source` 값에 `fintech_global` / `fintech_futures` / `thisweekinfintech` / `fintechtimes`를 추가한다. 새 컬럼은 만들지 않는다.
  - `bookmarks` (id, user_id, post_id, created_at): `user_id`는 `auth.uid()`를 참조. `(user_id, post_id)` 유니크 제약으로 중복 북마크를 방지한다.
  - `chat_logs` (id, user_id, question, answer, created_at): 챗봇 아카이브. 멀티턴 스레드가 아니므로 대화방 개념 없이 질문/답변 1행씩 저장한다.
  - `app.js`는 Supabase anon key로 `posts`에 **읽기 전용(SELECT)**만 수행한다. RLS 정책으로 anon 역할은 SELECT만 허용하고 INSERT/UPDATE/DELETE는 service role에서만 가능하도록 설정한다.
  - `bookmarks`, `chat_logs`는 로그인 세션(Supabase Auth JWT)으로 접근한다. RLS로 `auth.uid() = user_id`인 행만 SELECT/INSERT/DELETE 가능하도록 제한해 계정 간 데이터가 섞이지 않게 한다. anon 역할은 이 두 테이블에 접근 권한이 없다.
  - `localStorage`는 대시보드 데이터 저장용이 아니라 **사용자 개인 설정**(마지막 선택한 필터, 테마 등 UI 상태)에만 사용한다. 로그인 세션 자체는 Supabase JS SDK가 관리하는 저장소를 그대로 사용한다(별도 커스텀 세션 저장 로직 금지).
- **인증**: Supabase Auth 이메일 매직링크(OTP) 방식만 사용한다. 비밀번호, OAuth 소셜 로그인은 추가하지 않는다. `app.js`에서 로그인 상태에 따라 북마크 버튼/AI 챗봇 탭 접근을 분기한다.
- **배포**: Vercel에 정적 사이트로 배포. `api/collect.js`, `api/chat.js`는 Vercel Serverless Function으로 함께 배포된다.
- **수집/요약 스케줄링**: `vercel.json`의 `crons` 설정으로 `api/collect.js`를 주기적으로 호출한다. 이 함수 안에서:
  1. GitHub/Hugging Face/LangChain RSS + 데일리 테크 뉴스 + 4개 핀테크 소스를 서버사이드로 fetch (CORS 문제 없음)
  2. Claude API로 신규 항목만 요약 (API 키는 서버 환경에서만 사용)
  3. Supabase에 service role key로 upsert (URL 기준 중복 방지)
- **AI 챗봇 처리**: `app.js`가 로그인 세션 토큰과 질문 텍스트를 `api/chat.js`로 전달하면, 이 함수가 (1) 토큰으로 사용자를 확인하고 (2) 핀테크 특화 시스템 프롬프트로 Claude API를 호출한 뒤 (3) 질문/답변을 `chat_logs`에 저장하고 답변을 응답으로 돌려준다. 로그인하지 않은 요청은 거부한다.

## 비밀키 관리
- `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`는 Vercel 환경변수로만 관리한다. 프론트엔드 코드(`app.js`, `index.html`)에 절대 하드코딩하지 않는다. `api/chat.js`도 `ANTHROPIC_API_KEY`를 서버 환경변수로만 읽는다.
- 프론트엔드에 넣어도 되는 키는 Supabase **anon(public) key**뿐이며, 이 키는 RLS로 `posts` SELECT 및 로그인 사용자 본인 소유 행 접근만 허용되므로 노출되어도 안전한 범위로 제한한다.

## 코딩 규칙
- `app.js`는 프레임워크 없이 DOM API를 직접 다룬다. 상태 관리 라이브러리 도입 금지.
- 소스별 배지 색상, 카드 레이아웃 등은 `style.css` 한 파일에만 정의한다.
- 개별 소스 수집 실패가 다른 소스에 영향을 주지 않도록 `api/collect.js` 내에서 소스별로 에러를 격리한다 (PRD 검증 기준 대응). 핀테크 4소스도 동일한 격리 원칙을 적용한다.
- Supabase/Auth/Claude API 연동 전까지는 `fetchPosts()`처럼 실제 호출을 대체하는 mock 함수를 하나씩 두고, 나머지 로직은 그 함수만 바꾸면 실제 연동으로 전환되도록 작성한다 (예: `fetchBookmarks()`, `sendChatMessage()`). mock과 실제 연동 로직을 뒤섞지 않는다.

## 참고
- 기존에 로컬 검증용으로 만들었던 Python/FastAPI 프로토타입(`tech-dashboard/app/*.py`)은 이 아키텍처 결정에 따라 더 이상 사용하지 않는다. 신규 구현은 이 문서 기준(정적 프론트 + Supabase + Vercel)으로 새로 진행한다.
