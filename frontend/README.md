# FIRIS Frontend
React / Vite / JavaScript / React Router / Axios 관제 화면.
Node.js 22.12 이상 LTS 권장(Node 24에서 실행 확인).

프로젝트 루트에서:
```bash
cd frontend
corepack yarn install --immutable
corepack yarn start
```
http://localhost:5173 접속. `/`는 `/login`으로 이동한다.
`/login`은 Backend JWT 로그인, `/change-password`는 WORKER 첫 로그인 비밀번호 변경 화면이다. `/dashboard`는 CAM001~CAM004의 AI 분석 JPEG와 이벤트 집계, `/history`는 이력·상세·검수·미디어, `/admin`은 ADMIN 전용 작업자·CCTV·오탐 조회 화면이다. 백엔드와 AI 분석기가 함께 실행 중이어야 관제 영상이 보인다.

선택적으로 `cp .env.example .env` 후 VITE_API_BASE_URL을 설정하고 개발 서버를 재시작한다.
Axios 클라이언트 기본 주소는 http://localhost:8080 이다.
`VITE_` 값은 브라우저에 공개되므로 API 키/비밀번호를 넣지 않는다.

```bash
corepack yarn build
corepack yarn preview
```
Dashboard는 별도 관제 페이지 없이 전체 세로 스크롤 없는 통합 관제 화면이다. WORKER에게 Admin 메뉴를 숨기며, 서버에서도 ADMIN 권한을 검사한다. 학습 후보 지정은 Backend API가 없어 아직 연결하지 않았다.
개발 전 [PROJECT_CONTEXT](../docs/PROJECT_CONTEXT.md)와 요구사항·아키텍처·ERD·API 명세를 확인한다. 설계 변경은 팀 합의 → 문서 → 코드 순서를 따른다.

패키지 관리에는 Yarn 4를 사용하고 Vite는 실행·빌드 도구로 유지한다.
`corepack yarn dev`로도 실행할 수 있다. `yarn.lock`과 `.yarnrc.yml`은 Git에 커밋한다.
Corepack이 없으면 먼저 `npm install -g corepack`으로 설치한다.
페이지 폴더에는 .jsx/.css를 사용하고 App.jsx와 main.jsx는 React 진입점으로 유지한다.
페이지 컴포넌트는 .jsx, 스타일은 .css로 유지한다.
API 클라이언트(client.js), Vite 설정(vite.config.js), JSX 없는 일반 로직은 .js를 사용한다.
Yarn 설치 안내: https://yarnpkg.com/getting-started/install
