# FIRIS Frontend
React / Vite / JavaScript / React Router / Axios 초기 프로젝트.
Node.js 22.12 이상 LTS 권장(Node 24에서 실행 확인).

프로젝트 루트에서:
```bash
cd frontend
npm ci
npm run dev
```
http://localhost:5173 접속. `/`는 `/login`으로 이동한다.
`/login`, `/dashboard`, `/history`, `/admin`에는 페이지 제목만 표시한다.
인증·권한 제어·메뉴·UI 디자인·Backend API 호출은 아직 없다.

선택적으로 `cp .env.example .env` 후 VITE_API_BASE_URL을 설정하고 개발 서버를 재시작한다.
Axios 클라이언트 기본 주소는 http://localhost:8080 이다.
`VITE_` 값은 브라우저에 공개되므로 API 키/비밀번호를 넣지 않는다.

```bash
npm run build
npm run preview
```
향후 Dashboard는 별도 관제 페이지 없이 전체 세로 스크롤 없는 통합 관제 화면으로 구성한다.
WORKER의 Admin 메뉴 숨김 및 서버 권한 검증은 향후 구현한다.
개발 전 [요구사항](../docs/REQUIREMENTS.md)과 다른 설계 문서를 확인하고 설계를 먼저 갱신한다.
