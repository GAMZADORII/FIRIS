# FIRIS API 명세 초안

> 현재 Backend 구현 범위: health check, AI 이벤트 생성·미디어 갱신 및 CAMERA/FIRE_EVENT/EVENT_MEDIA 매핑. [구현·검증 안내](AI_EVENT_IMPLEMENTATION.md)를 함께 확인한다. 금빈님 계정/JWT 및 MySQL 설정이 dev에 병합되어 이 브랜치에도 포함된다.


기준: [PROJECT_CONTEXT](PROJECT_CONTEXT.md) 21~32절. 아래 필드명과 경로를 임의 변경하지 않는다.
**현재 health check, AI 이벤트 생성·미디어 갱신, 최신 박스 JPEG 조회 API를 구현했다. 계정/JWT API는 병합된 dev에 포함됐다. 로컬 AVI·실제 YOLO·MySQL 연동은 확인했으며, 실제 CCTV RTSP와 프론트 표시 검증은 남아 있다. 이벤트 목록·상세·검수·통계 API는 아직 미구현이다.**
JSON 예시는 계약을 설명하며 비밀번호·ID·경로·시각은 실제 환경 설정이 아니다.

## 문서 상태 구분

- **현재 실행 상태**: health check, AI 이벤트 생성·미디어 갱신, 최신 박스 JPEG 조회, 로그인, 이벤트 이력·상세·검수 및 인증된 미디어 조회 Backend 코드가 있다. Frontend 이벤트 연동은 디자인 작업 이후 진행한다. 로컬 MySQL에서 검수 성공·중복 검수 409·검수자 저장을 임시 이벤트로 검증하고 해당 데이터를 삭제했다. Docker 컨테이너 실행, 전용 테스트 DB의 자동 통합 테스트와 실제 CCTV RTSP는 아직 검증하지 않았다.
- **최종 합의**: 앞으로 구현할 요구사항이다. 현재 구현 여부와 구분한다.
- **예시**: JSON의 비밀번호·ID·파일명, 탐지 수치 등 설명용 값이다. 실제 설정으로 확정하지 않는다.
- **확인 필요**: 담당자와 합의 후 문서에 반영할 사항이다. 임의 구현하지 않는다.
- **DB 현재 상태**: backend 기본 연결은 MySQL이다. 이벤트 API DB 통합 테스트는 별도 MySQL 테스트 DB에서 선택적으로 실행한다. MySQL 버전은 8.4.11로 확정했으며, 운영 스키마 관리 정책은 별도 확인이 필요하다.


## 현재 구현

| 서비스 | Method | 경로 | 응답 |
| --- | --- | --- | --- |
| AI :8000 | GET | /health | 200, status=ok/degraded 및 models 상태 |
| Backend :8080 | GET | /api/health | 200, {"status":"ok"} |
| Backend :8080 | POST | /api/ai/events | 201, eventId/reviewStatus (API Key 필요) |
| Backend :8080 | PATCH | /api/ai/events/{eventId}/media | 200, eventId/videoAvailable (API Key 필요) |
| AI :8000 | GET | /cameras/{cameraId}/frame | JPEG, X-AI-API-KEY 필요; 404 프레임 없음, 503 프레임 오래됨 |
| Backend :8080 | GET | /api/cameras/{cameraId}/frame | JPEG, 사용자 JWT(ADMIN/WORKER) 필요; 404 카메라/프레임 없음, 503 AI 연결 실패·오래된 프레임 |
| Backend :8080 | GET | /api/events, /api/events/{eventId} | 이벤트 이력·상세, 사용자 JWT 필요 |
| Backend :8080 | PATCH | /api/events/{eventId}/review | 단일 최종 검수, 사용자 JWT 필요 |
| Backend :8080 | GET | /api/events/{eventId}/snapshot, /video | 이벤트 미디어, 사용자 JWT 필요 |

이벤트 API의 Content-Type은 application/json이고 프레임 API의 응답은 image/jpeg이다. Backend health는 인증 없이 프로세스 응답만 확인한다. AI health는 모델 파일의 존재와 Git LFS 포인터 여부만 확인하며 실제 추론 성공은 검사하지 않는다. 두 Backend AI 이벤트 API는 API Key 인증과 준비된 DB를 필요로 한다.

## 전체 API 및 담당

| Method | 경로 | 담당 | 용도/권한 |
| --- | --- | --- | --- |
| POST | /api/auth/login | 오금빈 | 로그인 (INACTIVE 불가) |
| PATCH | /api/auth/password | 오금빈 | WORKER 비밀번호 변경 |
| GET | /api/admin/workers | 오금빈 | ADMIN 작업자 목록 |
| POST | /api/admin/workers | 오금빈 | ADMIN 작업자 생성 |
| PATCH | /api/admin/workers/{workerId}/status | 오금빈 | ADMIN 상태 변경 |
| PATCH | /api/admin/workers/{workerId}/password-reset | 오금빈 | ADMIN 비밀번호 초기화 |
| GET | /api/cameras | 담당 확인 필요 | 고정 CCTV 조회 |
| GET | /api/cameras/{cameraId}/frame | 박상현 | 최신 YOLO 박스 표시 JPEG, ADMIN/WORKER |
| POST | /api/ai/events | 박상현 (AI 호출: 김형준) | AI 이벤트 즉시 생성 |
| PATCH | /api/ai/events/{eventId}/media | 박상현 (AI 호출: 김형준) | AI 미디어 경로 갱신 |
| GET | /api/events | 오금빈 | 이벤트 검색/목록 |
| GET | /api/events/{eventId} | 박상현 | 이벤트 상세 |
| PATCH | /api/events/{eventId}/review | 박상현 | ADMIN/WORKER 검수 |
| GET | /api/statistics/dashboard | 오금빈 | 관제 통계 |

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

응답은 페이지 형식(`content`, `totalElements`, `totalPages`, `number`, `size`)이다. `content` 항목은 `eventId`, `cameraId`, `cameraName`, `location`, `eventType`, `confidence`(0~1), `detectedAt`(KST 로컬 시각), `modelVersion`, `reviewStatus`를 포함한다. 최신 발생 시각과 eventId 역순으로 정렬한다. `from`/`to`는 `YYYY-MM-DD`이며 양 끝 날짜를 포함한다. `size` 최대값은 100이다.

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

응답은 목록 항목의 필드에 `snapshotPath`, `videoPath`, `preSeconds`, `postSeconds`, `review`를 더한다. `review`는 미검수 시 `null`, 검수 시 `result`, `falsePositiveReason`, `note`, `reviewerId`, `reviewerName`, `reviewedAt`을 포함한다. 경로는 파일 경로일 뿐 브라우저 URL이 아니다.

인증된 미디어 조회: `GET /api/events/{eventId}/snapshot`은 JPEG, `GET /api/events/{eventId}/video`는 MP4를 반환한다. 두 요청 모두 사용자 JWT가 필요하며, 파일이 아직 없거나 공유 저장소에서 읽을 수 없으면 404이다. Backend의 `EVENT_STORAGE_DIR`은 AI와 같은 이벤트 저장소를 가리켜야 한다.

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

첫 검수만 허용하며 이미 검수된 이벤트의 재요청은 409를 반환한다. `FALSE_POSITIVE`는 사유가 필수이고, `TRUE_FIRE`에는 사유를 넣을 수 없다. 응답은 갱신된 이벤트 상세 형식이다.

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

## 계약 해석 및 미정 사항

- Snapshot 파일 자체는 AI/파일 저장소에 존재하며 POST의 snapshotPath를 EVENT_MEDIA.snapshot_path에 저장한다. 파일 Binary는 DB에 넣지 않는다.
- 이벤트 생성은 영상 완성을 기다리지 않는다. POST 응답 eventId로 이후 PATCH를 호출한다.
- UNREVIEWED는 검수 행 부재로 계산하며 검수 result 저장값이 아니다.
- 검수 완료 UI는 읽기 전용이다. 서버의 중복/동시 검수 요청 응답 정책은 구현 전에 확인한다.
- 이번 AI API의 detectedAt은 오프셋 없는 한국시간(Asia/Seoul)을 사용한다. 향후 조회 API의 from/to 경계 정책은 별도로 확정한다.
- 작업자 목록/상태 변경/CCTV 조회의 세부 요청·응답 JSON은 미정이다. 상태 변경 요청 필드도 임의로 정하지 않는다.
- 목록/상세의 응답 JSON 구조, 페이지 기본값/정렬/상한, AI 수신 Confidence는 0~1이며, 나머지 조회 계약은 확인 후 명세화한다.
- Dashboard 집계 기간(오늘/전체), ONLINE CCTV 및 최근 이벤트 데이터 전달 방식은 기존 예시 필드를 바꾸지 않고 담당자와 먼저 확인한다.
- workerId가 account_id에 대응하는 방식, API 성공 상태 코드/오류 형식, JWT 수명/갱신 및 AI API Key 검증은 AI_EVENT_IMPLEMENTATION.md를 따른다.
- 필드 필수 여부·문자열 길이 검증·재시도/멱등성 등 API에 아직 없는 조건은 ERD와 함께 확인한다.
