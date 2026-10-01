# FIRIS 프로젝트 기준 문서

> 현재 Backend 구현 범위: health check, AI 이벤트 생성·미디어 갱신 및 CAMERA/FIRE_EVENT/EVENT_MEDIA 매핑. [구현·검증 안내](AI_EVENT_IMPLEMENTATION.md)를 함께 확인한다. 금빈님 계정/JWT 및 MySQL 설정이 dev에 병합되어 이 브랜치에도 포함된다.


사용자가 제공한 팀 합의 내용을 기준으로 정리한 원문 보존 문서이다. 최종 발표 예정일은 **2026-10-16**이다.
기존 구조·API 필드·DB 컬럼·담당 역할을 임의로 바꾸지 않는다. 변경 이유를 먼저 설명하고 팀 합의 → 문서 변경 → 코드 변경 순서를 따른다.
정보가 부족하거나 기존 결정과 충돌하면 구현 전에 사용자에게 확인한다. 아래 기능 정의는 구현 완료를 뜻하지 않는다.

## 문서 상태 구분

- **현재 실행 상태**: health check, AI 이벤트 생성·미디어 갱신 코드와 네 페이지 placeholder가 있다. 이벤트 API의 서비스 단위 테스트는 DB 없이 검증했다. MySQL 통합 테스트는 전용 테스트 DB가 있을 때 실행하도록 구성했으나 아직 실제 MySQL에서 실행하지 않았다. 서버 실행에는 MySQL·카메라 데이터·API Key 설정이 필요하다. 실제 AI/Frontend 연동 완료를 의미하지 않는다.
- **최종 합의**: 앞으로 구현할 요구사항이다. 현재 구현 여부와 구분한다.
- **예시**: JSON의 비밀번호·ID·파일명, 탐지 수치 등 설명용 값이다. 실제 설정으로 확정하지 않는다.
- **확인 필요**: 담당자와 합의 후 문서에 반영할 사항이다. 임의 구현하지 않는다.
- **DB 현재 상태**: backend 기본 연결은 MySQL이다. 이벤트 API DB 통합 테스트는 별도 MySQL 테스트 DB에서 선택적으로 실행한다. MySQL 버전과 운영 스키마 관리 정책은 별도 확인이 필요하다.


## 현재 구현 상태와 해석 기준

- 초기 뼈대 이후 Backend의 AI 이벤트 생성·미디어 갱신 구현을 시작했다. 검증 범위와 설정은 AI_EVENT_IMPLEMENTATION.md를 따른다.
- JWT, 계정/작업자 관리, AI 탐지·학습, 검수 등은 최종 범위이다. 이 브랜치에는 금빈님 계정/JWT/MySQL 변경과 AI 이벤트 생성·미디어 갱신 코드가 함께 있다.
- 명시적으로 제외된 기능은 41절을 따른다.
- 이벤트 순서는 상세 명세인 16·27절을 적용한다. AI가 Snapshot을 확보하고 snapshotPath를 POST에 전달하며 Backend는 파일 Binary가 아닌 경로를 저장한다. 영상 완성은 기다리지 않는다.
- 예시의 임시 비밀번호, 시간·비율 임계값, 영상 전후 길이와 모델 구조 후보는 운영 설정이나 확정 파라미터가 아니다.
- 현재 합의된 Frontend 실행 환경은 React + Vite + Yarn 4이다. 화면 컴포넌트는 .jsx, 일반 로직/설정은 .js, 스타일은 .css이다.
- 세부 미정 사항은 각 문서에 표시한다. 예시에서 새로운 필드나 규칙을 임의로 추론하지 않는다.

## 0. 프로젝트 기본 정보

프로젝트명:

FIRIS

주제:

AI 화재·연기 조기 감지 관제 서비스

최종 발표 예정일:

2026-10-16

프로젝트 목적:

공장, 창고, 산업시설 등에 이미 설치된 CCTV 영상을 AI가 실시간으로 분석한다.

AI가 CCTV 영상에서:

- FIRE
- SMOKE

위험 장면을 탐지한다.

단순히 한 프레임에서 탐지되었다고 바로 화재 이벤트를 만드는 것이 아니라,
일정 시간 이상 위험 상태가 지속되는지 확인한 뒤
화재 의심 이벤트를 생성한다.

생성된 이벤트는 Backend에 저장되고,
사용자는 Frontend 관제 화면에서:

- 발생 CCTV
- 위치
- FIRE / SMOKE 유형
- Confidence
- Snapshot
- Event Video

를 확인한다.

이후 작업자 또는 관리자가 해당 이벤트를:

- 실제 화재
- 오탐

중 하나로 검수한다.

이 시스템은 기존 법정 화재 감지기나 소방 설비를 대체하는 시스템이 아니라,
CCTV 관제를 보조하는 AI 기반 안전 관제 시스템이다.

## 1. 전체 시스템 구조

전체 시스템 흐름:

CCTV / 영상
    ↓
AI Server
    ↓
Fire / Smoke Detection
    ↓
Temporal Validation
    ↓
위험 이벤트 확정
    ↓
AI Snapshot 확보 및 파일 저장
    ↓
POST /api/ai/events (snapshotPath 전달)
    ↓
Backend Event 생성 및 Snapshot 경로 저장
    ↓
Frontend에서 이벤트 조회 가능 (영상 완성을 기다리지 않음)
    ↓
AI Frame Buffer 기반 Event Video 생성
    ↓
Backend Media 정보 업데이트
    ↓
Frontend 통합 관제 Dashboard 표시
    ↓
작업자 / 관리자 확인
    ↓
TRUE_FIRE / FALSE_POSITIVE 검수
    ↓
이벤트·검수 이력 저장 및 통계 집계 (통계 전용 테이블 없음)

전체 기술 구조:

Frontend
- React
- Vite
- JavaScript
- JSX
- Axios
- React Router

Backend
- Java
- Spring Boot
- Gradle
- Spring Web
- Spring Data JPA
- Spring Security
- Validation

AI
- Python
- FastAPI
- OpenCV
- MobileNet 계열 모델
- PyTorch 또는 TensorFlow 계열 사용 가능

CI/CD
- Docker
- Docker Compose
- Jenkins
- GitHub

## 2. 개발 환경

프로젝트는 가능하면 WSL Ubuntu 환경을 기준으로 개발한다.

추천 프로젝트 위치:

/home/{username}/projects/FIRIS

예:

~/projects/FIRIS

가능하면 아래와 같이 Windows 파일시스템에 프로젝트를 두지 않는다.

/mnt/c/...

VS Code는 Windows에서 실행해도 되지만,
프로젝트와 Terminal은 WSL Ubuntu 환경에서 사용한다.

VS Code 좌측 하단에:

WSL: Ubuntu

가 표시되는 환경을 권장한다.

단 Frontend 담당자의 경우 Windows 환경 사용도 허용한다.

프로젝트 자체는 OS에 종속되지 않도록 구성한다.

## 3. Repository 구조

FIRIS는 하나의 GitHub Repository를 사용하는 Monorepo 방식으로 구성한다.

루트에 .git이 하나만 존재한다.

구조:

FIRIS/
├── ai/
├── backend/
├── frontend/
├── docs/
│   ├── PROJECT_CONTEXT.md
│   ├── REQUIREMENTS.md
│   ├── ARCHITECTURE.md
│   ├── ERD.md
│   └── API_SPEC.md
│
├── .gitignore
├── .gitattributes
├── .env.example
├── docker-compose.yml
└── README.md

ai, backend, frontend 내부에 별도의 Git Repository를 만들지 않는다.

## 4. Git 협업 방식

Branch:

main
dev
feature/*

main:
- 최종 안정 버전
- 최종 결과물 기준

dev:
- 전체 개발 통합 Branch

feature/*:
- 각 기능 개발 Branch

예:

feature/backend-event
feature/backend-auth
feature/backend-statistics
feature/ai-detection
feature/frontend-dashboard
feature/frontend-history
feature/cicd

기본 협업 흐름:

dev 최신화
    ↓
feature branch 생성
    ↓
기능 구현
    ↓
commit / push
    ↓
Pull Request
    ↓
dev merge

가능하면 main과 dev에서 직접 기능 개발하지 않는다.

팀원에게는 GitHub Repository Write 권한을 부여한다.

main과 dev는 Ruleset / Branch Protection을 사용할 수 있지만,
feature/* 생성 자체는 막지 않는다.

## 5. 팀 역할 분담

팀 인원은 총 5명이다.

### [박상현]

주 담당:

- Backend
- Git / GitHub 통합
- Backend 전체 통합
- AI ↔ Backend 연동
- ERD 설계 및 관리
- API 명세 설계 및 관리
- 전체 시스템 통합
- E2E 확인

주요 Domain:

FIRE_EVENT
EVENT_MEDIA
EVENT_REVIEW

담당 기능:

- AI 이벤트 수신
- FIRE_EVENT 생성
- Snapshot 정보 저장
- Event Media 관리
- AI 영상 생성 완료 후 media update
- Event 상세 조회
- 실제 화재 / 오탐 검수
- AI Server와 Backend 간 API 연동
- Backend Domain 통합
- Git 통합 관리

주요 API:

POST /api/ai/events

PATCH /api/ai/events/{eventId}/media

GET /api/events/{eventId}

PATCH /api/events/{eventId}/review

### [오금빈]

주 담당:

- Backend
- Notion 문서 관리

주요 Domain:

ACCOUNT
Authentication
Worker Management
Event Query
Statistics

담당 기능:

- 로그인
- 작업자 비밀번호 변경
- 작업자 관리
- 작업자 생성
- 작업자 활성 / 비활성
- 관리자 작업자 비밀번호 초기화
- 이벤트 목록 조회
- 이벤트 검색 / 필터
- Dashboard 통계 API
- Notion 정리

주요 API:

POST /api/auth/login

PATCH /api/auth/password

GET /api/admin/workers

POST /api/admin/workers

PATCH /api/admin/workers/{workerId}/status

PATCH /api/admin/workers/{workerId}/password-reset

GET /api/events

GET /api/statistics/dashboard

### [김형준]

주 담당:

AI 모델 학습 및 AI Server

담당 기능:

- Fire / Smoke 데이터 전처리
- AI 모델 학습
- 모델 비교
- 모델 튜닝
- AI 성능 평가
- 실시간 영상 추론
- Fire / Smoke 탐지
- Confidence 계산
- Temporal Validation
- 이벤트 Snapshot 생성
- Frame Buffer 관리
- Event Video 생성
- FastAPI AI Server 구현
- Backend 연동

AI → Backend 주요 API:

POST /api/ai/events

PATCH /api/ai/events/{eventId}/media

### [차나래]

주 담당:

- Frontend
- 발표자료 제작
- 최종 발표

Frontend 주요 화면:

1. Login
2. Integrated Monitoring Dashboard
3. Event History
4. Admin / Worker Management

담당:

- React + Vite Frontend
- Login UI
- Dashboard UI
- 실시간 CCTV 표시
- FIRE / SMOKE Overlay 표시
- 이벤트 알림
- Event History
- Event Detail Drawer / Modal
- 실제 화재 / 오탐 검수 UI
- Admin Worker Management UI
- Backend API 연동
- 최종 PPT
- 발표

### [신종건]

주 담당:

CI/CD

담당:

- Docker
- Docker Compose
- Jenkins
- AI Dockerfile
- Backend Dockerfile
- Frontend Dockerfile
- 전체 Container 구성
- 환경변수 처리
- Jenkins Pipeline
- GitHub 연동
- Build / Test / Deploy 자동화
- 통합 실행 환경 구성

## 6. 사용자 종류

사용자는 두 종류다.

ADMIN
WORKER

## 7. ADMIN 정책

관리자 계정은 기본적으로 DB에 1개를 사전 등록한다.

현재 프로젝트에서는 관리자 회원가입 기능을 만들지 않는다.

관리자:

- login 가능
- 고정된 관리자 계정 사용
- 작업자 관리 가능
- 작업자 생성 가능
- 작업자 비밀번호 초기화 가능
- 작업자 ACTIVE / INACTIVE 상태 변경 가능

현재 프로젝트 범위에서는:

- 관리자 회원가입 없음
- 관리자 계정 추가 없음
- 관리자 비밀번호 찾기 없음
- 관리자 비밀번호 초기화 요청 없음
- 관리자 비밀번호 변경 기능 없음

관리자 비밀번호는 DB에 평문 저장하지 않는다.

BCrypt Hash 형태로 저장한다.

## 8. WORKER 정책

작업자는 사용자가 직접 가입하지 않는다.

관리자가 작업자를 생성한다.

작업자 loginId 예:

W000001
W000002
W000003

형식으로 Backend에서 자동 생성한다.

작업자 생성 시:

role = WORKER

status = ACTIVE

must_change_password = true

로 저장한다.

최초 임시 비밀번호는 프로젝트 MVP 기준으로
공통 임시 비밀번호를 사용할 수 있다.

예:

qwe123

단 DB에는 절대 평문 비밀번호를 저장하지 않는다.

BCrypt Hash만 저장한다.

작업자는 최초 로그인 후 반드시 비밀번호를 변경한다.

비밀번호 변경 성공 후:

must_change_password = false

로 변경한다.

## 9. 작업자 비밀번호 분실 정책

작업자가 직접 비밀번호 초기화 요청을 보내는 기능은 만들지 않는다.

로그인 화면에는:

“비밀번호를 분실한 경우 관리자에게 문의해주세요.”

문구만 표시한다.

아래 기능은 만들지 않는다.

- Forgot Password
- Password Reset Request
- 이메일 초기화
- SMS 초기화

작업자가 비밀번호를 분실하면
관리자에게 시스템 외부 방식으로 문의한다.

관리자가 Admin 페이지에서:

[비밀번호 초기화]

를 직접 수행한다.

관리자만 아래 API를 호출할 수 있다.

PATCH /api/admin/workers/{workerId}/password-reset

초기화하면:

password_hash = BCrypt(공통 임시 비밀번호)

must_change_password = true

로 변경한다.

작업자에게 임시 비밀번호 전달은
관리자가 직접 수행한다.

다음 로그인 시 작업자는 다시 비밀번호를 변경해야 한다.

## 10. 작업자 상태 관리

작업자 계정을 삭제하지 않는다.

상태:

ACTIVE
INACTIVE

ACTIVE:
로그인 가능

INACTIVE:
로그인 불가

기존 검수 이력 보존을 위해
작업자를 DB에서 삭제하지 않는다.

## 11. CAMERA 정책

현재 프로젝트에서는 CCTV가 미리 등록되어 있는 것으로 가정한다.

따라서:

- CCTV 추가 기능 없음
- CCTV 수정 기능 없음
- CCTV 삭제 기능 없음

CCTV는 고정 Reference Data로 사용한다.

예:

camera-1
camera-2
camera-3
camera-4

상태:

ONLINE
OFFLINE

## 12. AI 모델 관련 현재 결정

현재 AI 모델은 MobileNet 계열을 사용하기로 결정한 상태다.

다만 세부 구조는 아직 완전히 확정하지 않는다.

중요:

일반 MobileNet Classification Model은
이미지 전체가 FIRE인지 SMOKE인지 분류할 수 있지만,
객체 위치 Bounding Box를 직접 제공하지 못한다.

최종 시연에서는 가능하면:

- FIRE 위치
- SMOKE 위치

에 Bounding Box를 표시하고 싶다.

따라서 현재 단계에서는 AI 구현 구조를
단순 MobileNet Classification에 강하게 종속시키지 않는다.

향후 AI 담당자가:

- SSD-MobileNet
- MobileNet Backbone + Detection Head
- 다른 Detection 방식

등을 선택할 수 있다.

즉 현재 확정 사항:

MobileNet Family 사용

현재 미확정 사항:

정확한 Detection Head / Bounding Box 구현 방식

Codex는 AI 구조를 임의로 확정하지 않는다.

AI 담당자가 최종 모델 구조를 정하기 전까지
AI Model Interface를 추상화해서 유지한다.

## 13. AI 클래스

기본 AI 탐지 클래스:

FIRE
SMOKE

Backend에서는 상황에 따라:

FIRE
SMOKE
FIRE_SMOKE

Event Type을 표현할 수 있다.

## 14. Temporal Validation

한 프레임에서 FIRE 또는 SMOKE가 탐지되었다고
즉시 화재 이벤트를 생성하지 않는다.

최근 일정 시간 동안의 AI 탐지 결과를 확인하고
일정 비율 이상 지속될 경우 이벤트를 확정한다.

예시 개념:

최근 3초 동안
70% 이상의 Frame에서 탐지

등의 방식.

정확한 Threshold 값은 AI 실험을 통해 조정한다.

현재는 단순한 Temporal Post-processing 방식으로 접근한다.

## 15. AI Frame Buffer

Frame Buffer는 Backend가 아니라 AI Server에 존재한다.

AI Server:

CCTV Frame
    ↓
AI Detection
    ↓
최근 Frame Buffer 유지

위험 이벤트가 확정되면:

이벤트 이전 약 5초 Frame

+

이벤트 이후 약 5초 Frame

을 이용하여 Event Video를 생성할 수 있다.

preSeconds / postSeconds는 추후 조정 가능하다.

## 16. 이벤트 생성 순서

매우 중요:

Backend가 Event Video가 완성될 때까지 기다린 뒤
이벤트를 생성하면 안 된다.

위험 이벤트가 Temporal Validation을 통과하면
AI는 즉시 Backend에 이벤트 생성 요청을 보낸다.

순서:

AI
↓
위험 이벤트 확정
↓
Snapshot 확보
↓
POST /api/ai/events
↓
Backend FIRE_EVENT 생성
↓
eventId 반환
↓
Frontend에서 이벤트 표시 가능
↓
AI는 계속 post-event Frame 수집
↓
Event Video 생성
↓
PATCH /api/ai/events/{eventId}/media
↓
Backend EVENT_MEDIA 업데이트

## 17. Media 저장 정책

영상 Binary 또는 이미지 Binary를 DB에 직접 저장하지 않는다.

파일 자체:

storage/events/

등에 저장한다.

DB에는 경로만 저장한다.

예:

snapshot_path

video_path

예:

/storage/events/event_31.jpg

/storage/events/event_31.mp4

## 18. 이벤트 검수

사용자는 AI 이벤트를 확인한 뒤
다음 중 하나로 검수한다.

TRUE_FIRE

FALSE_POSITIVE

검수 전:

UNREVIEWED

단 UNREVIEWED는 EVENT_REVIEW 테이블에 저장되는 값이 아니다.

EVENT_REVIEW Row가 없으면:

UNREVIEWED

로 판단한다.

FALSE_POSITIVE 선택 시
오탐 사유를 선택할 수 있다.

예:

STEAM
LIGHT
REFLECTION
DUST
WELDING
ETC

추가 Note도 입력 가능하다.

## 19. ERD

현재 확정된 주요 Table은 5개다.

ACCOUNT

CAMERA

FIRE_EVENT

EVENT_MEDIA

EVENT_REVIEW

### ACCOUNT

account_id BIGINT PK AUTO_INCREMENT

login_id VARCHAR(30) NOT NULL UNIQUE

password_hash VARCHAR(255) NOT NULL

name VARCHAR(50) NOT NULL

role VARCHAR(20) NOT NULL

values:

ADMIN
WORKER

must_change_password BOOLEAN NOT NULL DEFAULT FALSE

status VARCHAR(20) NOT NULL DEFAULT ACTIVE

values:

ACTIVE
INACTIVE

created_at DATETIME NOT NULL

updated_at DATETIME NOT NULL

### CAMERA

camera_id VARCHAR(30) PK

camera_name VARCHAR(50) NOT NULL

location VARCHAR(100)

stream_url VARCHAR(500)

status VARCHAR(20) NOT NULL DEFAULT ONLINE

values:

ONLINE
OFFLINE

### FIRE_EVENT

event_id BIGINT PK AUTO_INCREMENT

camera_id VARCHAR(30) NOT NULL FK

event_type VARCHAR(20) NOT NULL

values:

FIRE
SMOKE
FIRE_SMOKE

confidence DOUBLE NOT NULL

detected_at DATETIME NOT NULL

model_version VARCHAR(50)

created_at DATETIME NOT NULL

### EVENT_MEDIA

media_id BIGINT PK AUTO_INCREMENT

event_id BIGINT NOT NULL UNIQUE FK

snapshot_path VARCHAR(500)

video_path VARCHAR(500)

pre_seconds INT

post_seconds INT

created_at DATETIME NOT NULL

updated_at DATETIME NOT NULL

video_path는 Event 생성 직후에는 NULL일 수 있다.

### EVENT_REVIEW

review_id BIGINT PK AUTO_INCREMENT

event_id BIGINT NOT NULL UNIQUE FK

reviewer_id BIGINT NOT NULL FK

result VARCHAR(30) NOT NULL

values:

TRUE_FIRE
FALSE_POSITIVE

false_positive_reason VARCHAR(30)

values:

STEAM
LIGHT
REFLECTION
DUST
WELDING
ETC

note VARCHAR(500)

reviewed_at DATETIME NOT NULL

## 20. ERD 관계

CAMERA 1:N FIRE_EVENT

FIRE_EVENT 1:0..1 EVENT_MEDIA

FIRE_EVENT 1:0..1 EVENT_REVIEW

ACCOUNT 1:N EVENT_REVIEW

## 21. API 목록

현재 설계된 API:

AUTH

POST /api/auth/login

PATCH /api/auth/password

ADMIN WORKER

GET /api/admin/workers

POST /api/admin/workers

PATCH /api/admin/workers/{workerId}/status

PATCH /api/admin/workers/{workerId}/password-reset

CAMERA

GET /api/cameras

AI

POST /api/ai/events

PATCH /api/ai/events/{eventId}/media

EVENT

GET /api/events

GET /api/events/{eventId}

PATCH /api/events/{eventId}/review

STATISTICS

GET /api/statistics/dashboard

## 22. 인증

**최종 합의:** 사용자 JWT 인증. **이번 구현:** AI API Key 방식, 미설정·누락·불일치 시 401. 사용자 JWT는 금빈님 PR 병합으로 포함됐다.

Frontend 사용자는 JWT 사용.

Header:

Authorization: Bearer {accessToken}

AI Server → Backend 통신은
이번 구현에서는 X-AI-API-KEY 방식으로 인증한다.

Header 예:

X-AI-API-KEY: {apiKey}

## 23. 로그인 API

**예시 주의:** 아래 및 비밀번호 관련 예시의 qwe123은 실제 공통 임시 비밀번호로 확정된 값이 아니다.

POST /api/auth/login

Request:

```json
{
  "loginId": "W000001",
  "password": "qwe123"
}
```

Response 예:

```json
{
  "accessToken": "...",
  "account": {
    "accountId": 2,
    "loginId": "W000001",
    "name": "홍길동",
    "role": "WORKER",
    "mustChangePassword": true
  }
}
```

INACTIVE 사용자는 로그인할 수 없다.

## 24. 작업자 비밀번호 변경

PATCH /api/auth/password

Request:

```json
{
  "currentPassword": "qwe123",
  "newPassword": "worker1234!"
}
```

성공 시:

must_change_password = false

## 25. 작업자 생성

POST /api/admin/workers

ADMIN 전용.

Request:

```json
{
  "name": "홍길동"
}
```

Backend 자동 처리:

loginId 생성

예:

W000005

role = WORKER

status = ACTIVE

mustChangePassword = true

공통 임시 비밀번호 적용

Response 예:

```json
{
  "accountId": 5,
  "loginId": "W000005",
  "name": "홍길동",
  "temporaryPassword": "qwe123",
  "status": "ACTIVE"
}
```

## 26. 작업자 비밀번호 초기화

PATCH /api/admin/workers/{workerId}/password-reset

ADMIN만 호출 가능.

작업자 본인이 호출하는 API가 아니다.

Request Body:

없음

Response 예:

```json
{
  "loginId": "W000005",
  "temporaryPassword": "qwe123",
  "message": "비밀번호가 초기화되었습니다."
}
```

## 27. AI 이벤트 생성 API

**예시 주의:** event_31.jpg는 파일명 예시이며 아직 발급되지 않은 eventId로 파일명을 먼저 만들라는 규칙이 아니다. 파일명과 eventId 연결 방식은 확인이 필요하다. /storage/... 경로가 곧바로 브라우저 접근 URL이라는 뜻도 아니다.

POST /api/ai/events

AI Server 전용.

Request 예:

```json
{
  "cameraId": "camera-1",
  "eventType": "SMOKE",
  "confidence": 0.91,
  "detectedAt": "2026-10-07T14:30:25",
  "snapshotPath": "/storage/events/event_31.jpg",
  "modelVersion": "fire-v1"
}
```

Backend:

FIRE_EVENT 생성

EVENT_MEDIA 생성

AI가 전달한 snapshotPath를 DB에 저장 (이미지 파일 생성·저장은 AI/파일 저장소 담당)

Video Path는 NULL 가능

Response:

```json
{
  "eventId": 31,
  "reviewStatus": "UNREVIEWED"
}
```

## 28. AI Media Update API

PATCH /api/ai/events/{eventId}/media

Request:

```json
{
  "videoPath": "/storage/events/event_31.mp4",
  "preSeconds": 5,
  "postSeconds": 5
}
```

Response:

```json
{
  "eventId": 31,
  "videoAvailable": true
}
```

## 29. Event 목록 API

GET /api/events

지원할 Query:

page

size

eventType

reviewStatus

cameraId

from

to

필터 조합 가능.

reviewStatus:

UNREVIEWED

TRUE_FIRE

FALSE_POSITIVE

## 30. Event 상세 API

GET /api/events/{eventId}

반환 내용:

- Event 정보
- Camera 정보
- Event Type
- Confidence
- detectedAt
- modelVersion
- Snapshot
- Video
- preSeconds
- postSeconds
- Review 상태
- Review 정보

## 31. Review API

PATCH /api/events/{eventId}/review

FALSE_POSITIVE 예:

```json
{
  "result": "FALSE_POSITIVE",
  "falsePositiveReason": "STEAM",
  "note": "설비에서 발생한 증기로 확인"
}
```

TRUE_FIRE 예:

```json
{
  "result": "TRUE_FIRE",
  "note": "실제 화재 확인"
}
```

중요:

reviewerId를 Frontend Request에서 받지 않는다.

JWT의 로그인 사용자에서 accountId를 확인하여 저장한다.

## 32. Dashboard 통계 API

**확인 필요:** 화면의 “오늘 이벤트”와 아래 totalEvents의 집계 기간을 맞춰야 한다. 예시만으로 오늘/전체 범위를 확정하지 않는다. ONLINE CCTV 및 최근 이벤트 전달 계약도 별도 확인이 필요하다.

GET /api/statistics/dashboard

Response 예:

```json
{
  "totalEvents": 125,
  "eventTypes": {
    "fire": 32,
    "smoke": 88,
    "fireSmoke": 5
  },
  "reviews": {
    "trueFire": 17,
    "falsePositive": 28,
    "unreviewed": 80
  }
}
```

별도의 Statistics Table을 만들지 않는다.

FIRE_EVENT와 EVENT_REVIEW를 집계한다.

## 33. Frontend 최종 페이지

Frontend Main Page는 정확히 4개다.

1. Login
2. Dashboard
3. History
4. Admin

별도:

- Live Monitoring Page 없음
- Statistics Page 없음
- Event Detail Page 없음

필요한 상세 기능은:

Modal
Drawer
Side Panel

등으로 처리한다.

## 34. Login 페이지

표시:

- FIRIS
- ID / 사번
- 비밀번호
- 로그인

문구:

“비밀번호를 분실한 경우 관리자에게 문의해주세요.”

없어야 하는 기능:

- 회원가입
- 비밀번호 찾기
- 비밀번호 초기화 요청

최초 로그인 또는 관리자 초기화 후:

mustChangePassword = true

인 경우
비밀번호 변경 Modal을 표시한다.

## 35. Dashboard = 통합 관제

Dashboard와 Live Monitoring을 분리하지 않는다.

로그인 후 바로 Dashboard로 이동한다.

이 페이지는 FIRIS에서 가장 중요한 화면이다.

핵심 UX 원칙:

- Page Vertical Scroll 없음
- CCTV Always Visible
- CCTV가 가장 큰 영역
- 위험 정보를 즉시 확인
- 한 화면에서 관제 가능

화면 비율:

CCTV:

약 65~70%

실시간 현황:

약 30~35%

CCTV는 기본 4분할 2x2 Grid.

각 CCTV Card:

- Camera Name
- Location
- ONLINE / OFFLINE
- LIVE
- 영상
- FIRE / SMOKE
- Confidence
- Detection Overlay
- Bounding Box

위험 탐지 시:

Red Border

Red Warning Badge

우측 실시간 현황:

- 오늘 이벤트
- 미검수
- 실제 화재
- 오탐
- ONLINE CCTV
- FIRE / SMOKE / FIRE_SMOKE 현황

최근 위험 이벤트:

3~5개만 표시.

새 이벤트 발생 시:

Red Alert Toast

예:

화재 위험 이벤트 발생

CCTV 03
3번 구역
SMOKE 91%

[이벤트 확인]

## 36. History 페이지

이벤트 이력 조회.

Filter:

- 기간
- CCTV
- Event Type
- Review Status

Table:

- Event ID
- Snapshot Thumbnail
- 발생 시간
- CCTV
- 위치
- Event Type
- Confidence
- Review Status
- 상세보기

Pagination 사용.

Event Detail은 별도 페이지를 만들지 않는다.

상세보기 클릭:

Drawer 또는 Modal.

## 37. Event Detail Drawer

표시:

Snapshot

Event Video

Event ID

CCTV

Location

Event Type

Confidence

Detected Time

AI Model Version

Review Status

Review 결과

영상 설명:

표시 예시: 이벤트 발생 전 5초 ~ 발생 후 5초.
실제 안내 문구는 preSeconds/postSeconds를 사용한다. 전후 5초는 고정 규칙이 아니다.

영상 생성 중:

“이벤트 영상을 생성하고 있습니다.”

## 38. Review UI

Event Detail 내부에서:

[실제 화재]

[오탐]

선택.

오탐:

- 수증기
- 조명
- 빛 반사
- 먼지
- 용접
- 기타

Note 입력 가능.

검수 완료된 Event는 Read-only로 표시.

## 39. Admin 페이지

ADMIN 전용.

WORKER에게 메뉴 자체가 보이지 않는다.

기능:

- 작업자 목록
- 작업자 추가
- 비밀번호 초기화
- ACTIVE / INACTIVE 변경

삭제 기능 없음.

작업자 추가:

이름 입력

Backend는 loginId를 자동 생성한다.

MVP에서는 공통 임시 비밀번호를 사용할 수 있으며 적용한 값을 temporaryPassword로 반환한다.
실제 공통값은 확인 필요이며, 요청마다 무작위 비밀번호를 생성한다고 확정한 것은 아니다.

비밀번호 초기화:

관리자가 직접 버튼 클릭.

작업자가 요청하는 UI 없음.

## 40. Frontend Design 방향

서비스 디자인:

White + Red

산업용 안전 관제 Dashboard 느낌.

비율:

White 약 80%

Gray 약 15%

Red 약 5%

Red 용도:

- 위험 Alert
- Primary Button
- FIRE / SMOKE 강조
- Selected Navigation
- 위험 CCTV Border
- Important Badge

일반 SaaS보다:

Industrial
Safety Monitoring
Control Room

느낌을 우선한다.

## 41. 현재 프로젝트에서 제외하는 기능

아래 기능을 임의로 추가하지 않는다.

- 회원가입
- 작업자 비밀번호 찾기
- 작업자 비밀번호 초기화 요청
- 관리자 비밀번호 찾기
- 관리자 비밀번호 변경
- 관리자 계정 추가
- CCTV 추가
- CCTV 수정
- CCTV 삭제
- 건물 관리
- 시설 등록 관리
- 자동 AI 재학습
- 이메일 알림
- SMS 알림
- 복잡한 Multi Admin 구조

## 42. 초기 프로젝트 구조

AI:

ai/
├── app/
│   ├── main.py
│   ├── api/
│   ├── services/
│   ├── models/
│   └── utils/
│
├── model/
├── storage/
│   └── events/
├── requirements.txt
├── .env.example
└── README.md

초기 Health API:

GET /health

```json
{
  "status": "ok"
}
```

Backend:

backend/

Spring Boot / Gradle

Package 예:

common
auth
account
camera
event
review
statistics

초기 Health API:

GET /api/health

```json
{
  "status": "ok"
}
```

Frontend:

frontend/
├── src/
│   ├── api/
│   ├── components/
│   ├── layouts/
│   ├── pages/
│   │   ├── Login/
│   │   ├── Dashboard/
│   │   ├── History/
│   │   └── Admin/
│   ├── hooks/
│   ├── utils/
│   ├── App.jsx
│   └── main.jsx
│
├── package.json
└── README.md

React + Vite 사용.

Route:

/login

/dashboard

/history

/admin

## 43. 환경변수

실제 .env 파일은 Git에 올리지 않는다.

.env.example만 Commit한다.

Backend 예:

JWT_SECRET=

AI_API_KEY=

DB_URL=

AI 예:

BACKEND_URL=

AI_API_KEY=

MODEL_PATH=

Frontend:

VITE_API_BASE_URL=

## 44. .gitignore

다음 파일/폴더를 Git에서 제외한다.

Python Cache

Java Build

Gradle Cache

Node Modules

Vite Build

.env

IDE Files

Windows Files

WSL 불필요 파일

AI Model Weight

영상

AI Weight 예:

*.pt
*.pth
*.onnx
*.tflite

Video:

*.mp4
*.avi

단 필요한 빈 Directory는 .gitkeep으로 유지한다.

## 45. .gitattributes

Windows와 WSL 개발자가 섞여 있으므로
Line Ending 충돌을 방지한다.

예:

* text=auto

*.sh text eol=lf
*.py text eol=lf
*.java text eol=lf
*.js text eol=lf
*.jsx text eol=lf
*.json text eol=lf

*.bat text eol=crlf

## 46. 개발 원칙

앞으로 기능 구현은 아래 순서를 따른다.

요구사항 확인
    ↓
관련 문서 확인
    ↓
ERD / API 확인
    ↓
담당 기능 구현
    ↓
단위 실행 확인
    ↓
다른 파트 연동
    ↓
E2E 확인

Codex는 다음 행동을 하지 않는다.

- API 이름 임의 변경
- DB Column 임의 변경
- 새로운 Table 임의 생성
- Frontend 페이지 임의 추가
- 역할 분담 임의 변경
- AI 구조 임의 확정
- 필요하지 않은 대규모 Refactoring

## 47. 문서 관리 원칙

아래 문서를 프로젝트 설계 기준으로 사용한다.

docs/PROJECT_CONTEXT.md

docs/REQUIREMENTS.md

docs/ARCHITECTURE.md

docs/ERD.md

docs/API_SPEC.md

변경이 발생하면:

1. 팀 합의
2. 문서 변경
3. 코드 변경

순서를 지킨다.

## 48. 초기 뼈대 생성 당시 요청 (기록)

현재 단계에서는 전체 서비스를 한 번에 구현하지 않는다.

우선 이 프로젝트 구조와 요구사항을 이해한다.

그 다음:

1.

현재 작업 디렉터리가 FIRIS Repository Root인지 확인한다.

2.

아래 기본 구조가 없다면 생성한다.

ai/

backend/

frontend/

docs/

3.

위 내용을:

docs/PROJECT_CONTEXT.md

에 정리한다.

4.

PROJECT_CONTEXT.md를 기반으로:

REQUIREMENTS.md

ARCHITECTURE.md

ERD.md

API_SPEC.md

초안을 생성한다.

5.

AI / Backend / Frontend의
최소 실행 가능한 Skeleton을 구성한다.

6.

각 파트에서 Health Check 수준까지만 실행 가능하게 만든다.

7.

실제 비즈니스 기능은 아직 구현하지 않는다.

8.

완료 후:

- 생성/수정한 파일 목록
- 전체 Directory Tree
- 각 파일 역할
- AI 실행 방법
- Backend 실행 방법
- Frontend 실행 방법
- 다음 구현 추천 순서

를 설명한다.

## 49. 개발 기준 준수 지시

이 문서는 FIRIS의 현재 프로젝트 기준이다.

앞으로 내가:

“내 담당 백엔드 구현해줘”

“AI 연동 구현해줘”

“로그인 구현해줘”

“Frontend 연동해줘”

등의 요청을 하면
반드시 이 PROJECT_CONTEXT를 기준으로 작업한다.

정보가 불충분하거나
기존 결정과 충돌하는 요청이 들어오면
임의로 판단해서 구조를 변경하지 말고
먼저 나에게 확인한다.

위 내용은 초기 뼈대 생성 당시 범위이다. 이후 사용자가 승인한 담당 기능은 최신 구현 문서에 따라 단계적으로 개발한다. 이번에는 AI 이벤트 생성·미디어 갱신만 구현한다.
