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

## 파일 구성 (고정)
```
index.html       # 마크업만
style.css        # 전체 스타일
app.js           # 전체 클라이언트 로직 (Supabase JS SDK로 데이터 조회/필터링/렌더링)
api/collect.js   # 예외: Vercel Serverless Function — RSS 수집 + Claude 요약 + Supabase 저장
vercel.json      # 예외: Vercel Cron 설정
```
- 프론트엔드 파일은 `index.html`, `style.css`, `app.js` 3개만 유지한다. 컴포넌트 분리, 별도 JS 모듈 파일, CSS 분리 등 추가 파일 생성 금지.
- `api/collect.js`와 `vercel.json`은 PRD의 "주기적 서버 수집" 요구사항을 위한 필수 예외이며, 이 두 개 외에는 백엔드 파일을 늘리지 않는다.

## 기술 스택
- **프론트엔드**: 바닐라 HTML/CSS/JS(ES6+)만 사용. React/Vue 등 프레임워크, Webpack/Vite 등 번들러, TypeScript 도입 금지 (빌드 스텝 없이 그대로 배포).
- **외부 라이브러리**: npm install 금지. 필요한 경우 CDN `<script>` 태그로만 로드 (예: `@supabase/supabase-js`).
- **데이터 저장소**: Supabase(Postgres) 테이블 하나(`posts`: source, title, url, published_at, summary, raw_excerpt, fetched_at)에 수집 데이터를 저장한다.
  - `app.js`는 Supabase anon key로 **읽기 전용(SELECT)**만 수행한다. RLS 정책으로 anon 역할은 SELECT만 허용하고 INSERT/UPDATE/DELETE는 service role에서만 가능하도록 설정한다.
  - `localStorage`는 대시보드 데이터 저장용이 아니라 **사용자 개인 설정**(마지막 선택한 필터, 테마 등 UI 상태)에만 사용한다.
- **배포**: Vercel에 정적 사이트로 배포. `api/collect.js`는 Vercel Serverless Function으로 함께 배포된다.
- **수집/요약 스케줄링**: `vercel.json`의 `crons` 설정으로 `api/collect.js`를 주기적으로 호출한다. 이 함수 안에서:
  1. GitHub/Hugging Face/LangChain RSS + 데일리 테크 뉴스 소스를 서버사이드로 fetch (CORS 문제 없음)
  2. Claude API로 신규 항목만 요약 (API 키는 서버 환경에서만 사용)
  3. Supabase에 service role key로 upsert (URL 기준 중복 방지)

## 비밀키 관리
- `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`는 Vercel 환경변수로만 관리한다. 프론트엔드 코드(`app.js`, `index.html`)에 절대 하드코딩하지 않는다.
- 프론트엔드에 넣어도 되는 키는 Supabase **anon(public) key**뿐이며, 이 키는 RLS로 SELECT만 허용되므로 노출되어도 안전한 범위로 제한한다.

## 코딩 규칙
- `app.js`는 프레임워크 없이 DOM API를 직접 다룬다. 상태 관리 라이브러리 도입 금지.
- 소스별 배지 색상, 카드 레이아웃 등은 `style.css` 한 파일에만 정의한다.
- 개별 소스 수집 실패가 다른 소스에 영향을 주지 않도록 `api/collect.js` 내에서 소스별로 에러를 격리한다 (PRD 검증 기준 대응).

## 참고
- 기존에 로컬 검증용으로 만들었던 Python/FastAPI 프로토타입(`tech-dashboard/app/*.py`)은 이 아키텍처 결정에 따라 더 이상 사용하지 않는다. 신규 구현은 이 문서 기준(정적 프론트 + Supabase + Vercel)으로 새로 진행한다.
