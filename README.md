# FIRIS
AI 기반 화재·연기 조기 감지 관제 서비스. AI / Backend / Frontend를 하나의 Repository에서 독립적으로 개발한다.
현재는 health check 두 개와 네 페이지 placeholder를 실행하는 초기 뼈대이다.

## 구조
```text
FIRIS/
├── ai/                 # FastAPI, 향후 탐지/버퍼/미디어 처리
├── backend/            # Spring Boot, 향후 계정/이벤트/검수 관리
├── frontend/           # React 관제 화면
├── docs/               # 개발 기준 문서
├── .gitignore
├── .env.example        # 전체 환경변수 안내
├── docker-compose.yml  # 예약 파일, 배포 서비스 없음
└── README.md
```

## 기술 스택
| 파트 | 현재 | 향후 |
| --- | --- | --- |
| AI | Python, FastAPI, Uvicorn, OpenCV headless | PyTorch 또는 TensorFlow, MobileNet 계열 탐지 |
| Backend | Java 17, Spring Boot 3.5, Gradle Wrapper, Web/JPA/Security/Validation, H2 | JWT, 도메인 Entity/API |
| Frontend | React, Vite, JavaScript, Axios, React Router | 통합 Dashboard, History, 계정 관리 |

## 실행
각각 별도 터미널에서 루트 기준으로 실행한다. 첫 설치에는 인터넷이 필요하다.
Python 3.11 이상, JDK 17, Node.js 22.12 이상 LTS를 준비한다.

### AI
```bash
cd ai
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
`curl http://localhost:8000/health` → `{"status":"ok"}`.

### Backend
```bash
cd backend
./gradlew bootRun
```
`curl http://localhost:8080/api/health` → `{"status":"ok"}`.
Windows는 `gradlew.bat bootRun`. 메모리 H2를 사용하며 테이블은 생성하지 않는다.

### Frontend
```bash
cd frontend
npm ci
npm run dev
```
http://localhost:5173 에서 `/login`, `/dashboard`, `/history`, `/admin` 확인.
빌드 검증은 Backend `./gradlew build`, Frontend `npm run build`.
파트별 설정/Windows 안내는 각 폴더의 README를 참고한다.

## 환경변수 및 파일
`.env`는 커밋하지 않고 `.env.example`만 관리한다. 기본 실행에는 `.env`가 필요 없다.
Backend/Frontend는 필요 시 해당 폴더의 예제를 `.env`로 복사한다.
루트 예제는 안내용이며 공통 자동 로더는 없다. AI 환경변수와 JWT/API 키는 향후 기능용 예약 항목이다.
VITE_ 환경변수에 비밀 값을 넣지 않는다.
모델 weight와 이벤트 영상/이미지는 Git에서 제외하며 필요한 빈 폴더는 `.gitkeep`으로 유지한다.

## 개발 기준 문서
- [REQUIREMENTS](docs/REQUIREMENTS.md): 계정, CCTV, 탐지, 화면, 제외 범위
- [ARCHITECTURE](docs/ARCHITECTURE.md): 파트 책임과 이벤트/미디어 흐름
- [ERD](docs/ERD.md): 향후 테이블과 관계 (Entity/DDL 없음)
- [API_SPEC](docs/API_SPEC.md): 현재 health check와 향후 이벤트 API

**기능 구현 전 문서를 먼저 확인한다. 설계 변경은 코드보다 먼저 문서에 반영한다.**
현재 AI 학습/추론, JWT, DB 테이블/시드, 관리자/작업자 기능, Dashboard UI, Docker 배포는 구현하지 않는다.

## Git branch 전략
| Branch | 용도 |
| --- | --- |
| main | 최종 안정 버전 |
| dev | 통합 개발 |
| feature/* | 각 기능 개발 |

`dev`에서 `feature/*`를 분기하고 검토 후 `dev`로 통합한다. 안정화한 버전을 `main`에 반영한다.

## 초기 실행 검증
2026-09-30 로컬 환경(Python 3.14.7, Java 17.0.20, Node.js 24.20.0)에서 확인했다.
- AI: 의존성 검사 및 OpenCV import 성공, Uvicorn 실행 후 GET /health → 200 / `{"status":"ok"}`.
- Backend: Gradle build 성공, bootRun 실행 후 GET /api/health → 200 / `{"status":"ok"}`.
- Frontend: npm install 및 build 성공, Vite 실행 후 네 페이지 경로 모두 HTTP 200.
- .gitignore: 실제 환경 파일/모델/이벤트 이미지·영상 제외와 예제/.gitkeep/Wrapper 보존 확인.
- 브라우저 렌더링 자동 검증은 실행 환경의 Chromium 시작 중 SIGSEGV로 완료하지 못했다.
- 검증용 서버는 확인 후 종료했다. 자동 테스트 스위트는 현재 포함하지 않는다.

호환성 참고: [Spring Boot 3.5 실행 요구사항](https://docs.spring.io/spring-boot/3.5/system-requirements.html),
[Vite 실행 안내](https://vite.dev/guide/).
