# FIRIS API 명세 초안

> 현재 Backend에는 health check, 계정/JWT·작업자 관리, 카메라 조회/최신 프레임 프록시, AI 이벤트 생성·미디어 갱신, 이벤트 목록·상세·검수·인증된 미디어 조회가 구현되어 있다. Dashboard 통계 API는 집계 기준 확정 후 구현한다. [구현·검증 안내](AI_EVENT_IMPLEMENTATION.md)를 함께 확인한다.


기준: [PROJECT_CONTEXT](PROJECT_CONTEXT.md) 21~32절. 아래 필드명과 경로를 임의 변경하지 않는다.
**현재 health check, AI 이벤트 생성·미디어 갱신, 최신 박스 JPEG 조회, 계정/JWT, 이벤트 목록·상세·검수 및 인증된 미디어 조회 API가 구현되어 있다. 로컬 AVI·실제 YOLO·MySQL 연동은 확인했으며, 실제 CCTV RTSP와 프론트 표시 검증은 남아 있다. Dashboard 통계 API는 집계 기간과 응답 계약 확정 후 구현할 예정이다.**
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
| PATCH | /api/auth/contact | 계정 담당 | 최초 로그인 WORKER 연락처 및 개인정보 동의 등록 |
| GET | /api/auth/contact-consent | 계정 담당 | 현재 연락처 동의 문안 버전 조회 |
| GET | /api/auth/contact | 계정 담당 | 본인 등록 연락처·동의 상태 조회 |
| POST | /api/events/{eventId}/mock-119-reports | 박상현 | WORKER가 119 모의 신고 요청 |
| GET | /api/events/{eventId}/mock-119-preview | 박상현 | 신고 확인 창 데이터 조회 |
| GET | /api/events/{eventId}/mock-119-report | 박상현 | 모의 신고 접수 상태 조회 |
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
    "mustChangePassword": true,
    "contactOnboardingRequired": true
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

신규 WORKER는 비밀번호 변경 후 `contactOnboardingRequired=true`가 된다. `CONTACT_ONBOARDING_ENFORCED=true`이면 완료 전 관제 API에 접근할 수 없다. 프론트 첫 로그인 화면 연결 전 기본값은 `false`이며, 이 기간에도 모의 신고에는 연락처·동의가 필요하다. 기존 계정에는 연락처 등록을 소급 강제하지 않는다.

## 24-1. 최초 연락처 및 개인정보 동의 등록

GET /api/auth/contact-consent — WORKER JWT 필요. 현재 동의 문안 버전을 `{ "version": "v1" }`로 반환한다. 프론트는 이 버전에 대응하는 확정 문안을 표시한다.

GET /api/auth/contact — WORKER JWT 필요. 본인 연락처와 최초 등록 상태를 조회한다. 기존 계정의 연락처가 비어 있으면 모의 신고 전 등록 화면을 안내한다.

PATCH /api/auth/contact — WORKER JWT 필요. 최초 비밀번호 변경을 마친 뒤 호출한다.

```json
{
  "contactPhone": "01012345678",
  "consentAccepted": true,
  "consentVersion": "v1"
}
```

서버는 전화번호를 숫자로 정규화하고 동의한 문안 버전·서버 시각을 기록한다. 동의하지 않거나 서버의 현재 문안 버전과 다르면 저장하지 않는다. 성공 응답에는 `contactOnboardingRequired=false`, `contactPhone`, `consentVersion`, `consentedAt`이 포함된다. ADMIN과 이미 등록한 WORKER는 이 API를 다시 호출할 수 없다. `CONTACT_ONBOARDING_ENFORCED=true`로 전환하면 신규 WORKER는 비밀번호 변경과 연락처 등록을 모두 완료하기 전까지 관제 API가 403을 반환한다. 기존 WORKER는 관제 이용을 계속할 수 있으나 모의 신고하려면 본인 연락처를 등록해야 한다. 관리자 비밀번호 초기화는 연락처 동의 상태를 변경하지 않는다.

`v1`은 API 예시 버전이다. 실제 화면에 표시할 개인정보 문안의 목적·항목·보유 기간·거부 시 불이익을 팀에서 확정하고 같은 버전을 프론트·백엔드에 적용한다. 이메일은 요청하거나 저장하지 않는다. 119 모의서버에 보내는 신고 메시지와 관제실 번호는 해당 기능의 별도 계약에서 정의한다.

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

인증된 미디어 조회: `GET /api/events/{eventId}/snapshot`은 JPEG, `GET /api/events/{eventId}/video`는 원본 MP4, `GET /api/events/{eventId}/video/annotated`는 바운딩 박스 MP4를 반환한다. 세 요청 모두 사용자 JWT가 필요하며, 파일이 아직 없거나 공유 저장소에서 읽을 수 없으면 404이다. 박스 MP4는 저장된 원본 `event.mp4`와 같은 이벤트 폴더의 `event_annotated.mp4`만 조회한다. Backend의 `EVENT_STORAGE_DIR`은 AI와 같은 이벤트 저장소를 가리켜야 한다.

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

## 119 모의 신고 API 및 WebSocket 계약

이 기능은 **모의서버 접수**이며 실제 119 신고가 아니다. WORKER가 이벤트 화면의 신고 버튼을 눌러 시작한다. ADMIN이나 연락처·동의 등록 전 WORKER는 신고할 수 없다. 실제 전송은 Backend가 수행하고 Frontend는 모의서버에 직접 연결하지 않는다.

`GET /api/events/{eventId}/mock-119-preview` — WORKER JWT 필요. 신고 확인 창을 열 때 조회한다. 이벤트·카메라·로그인 계정과 서버 설정을 조합하며 실제 신고를 생성하지 않는다. 화면의 영상 클립은 별도 `GET /api/events/{eventId}/video`를 사용하고, 오탐 처리는 `PATCH /api/events/{eventId}/review`를 사용한다.

```json
{
  "eventId": 27,
  "eventType": "FIRE",
  "siteAddress": "경기도 ○○시 ○○로 123",
  "controlRoomPhone": "041-123-4567",
  "detailLocation": "제1공장 2층 생산라인 A",
  "detectedAt": "2026-10-07T14:32:18",
  "reporterName": "홍길동",
  "reporterPhone": "01012345678",
  "specialNotes": "리튬배터리 보관구역",
  "readyToReport": true,
  "missingFields": []
}
```

`siteAddress`와 `controlRoomPhone`은 Backend 설정 `MOCK_119_SITE_ADDRESS`, `MOCK_119_CONTROL_ROOM_PHONE`에서 가져온다. `detailLocation`은 신고 당시 `CAMERA.location`, `specialNotes`는 `CAMERA.report_note`에서 가져온다. 특이사항이 없으면 `null`이며 화면은 '특이사항 없음'으로 표시할 수 있다. 기존 카메라의 `report_note`는 수동 등록 전까지 `null`이다. 주소·관제실 번호·상세위치·담당자 연락처 중 하나라도 없으면 `readyToReport=false`와 `missingFields`를 반환하고 확인 버튼을 비활성화한다. 예시 주소는 실제 사업장 정보가 아니다.

신규 카메라 등록 요청에는 선택적 `reportNote`(최대 500자)를 넣을 수 있다. 이미 등록된 CAM001~CAM004의 상세위치나 특이사항을 바꿔야 한다면 현재 카메라 수정 API가 없으므로 관리자 승인 아래 DB에서 `CAMERA.location`, `CAMERA.report_note`를 갱신한다. 시연 전에 실제 위치와 문구를 확인한다.

`POST /api/events/{eventId}/mock-119-reports` — WORKER JWT 필요

요청 본문 없음. 확인 창에 표시된 서버 값을 다시 조회해 신고한다. 화면이 보내는 주소·전화번호·담당자 정보는 신뢰하지 않는다. 성공 응답은 아래와 같다.

Backend는 JWT에서 신고자 계정을 확인하고 저장된 `contactPhone`과 동의 기록을 사용한다. 최초 요청에서 고유 `requestId`를 생성하고, 동일 이벤트의 재시도에는 같은 `requestId`와 당시의 주소·위치·특이사항·번호를 사용한다. 재시도는 최초 신고자만 가능하다. 이미 접수 완료된 이벤트에는 재전송하지 않는다.

응답 예 (`200`):

```json
{ "reportId": 12, "eventId": 27, "status": "ACCEPTED", "receiptId": "MOCK-119-001" }
```

모의서버 미설정·연결 실패·응답 오류·타임아웃이면 기록을 `FAILED`로 남기고 `502`를 반환한다. 필수 신고 정보가 미설정이면 `400`, 최초 등록이 필요한 신규 WORKER는 `403`, 이벤트가 없으면 `404`를 반환한다. 전송 중 같은 요청은 `PENDING`을 반환한다. `GET /api/events/{eventId}/mock-119-report`로 `PENDING`, `ACCEPTED`, `FAILED`와 접수 ID를 조회한다.

Backend → 모의서버 WebSocket 접속 주소는 `MOCK_119_WS_URL`로 설정한다. 예: `ws://localhost:8090/ws/reports`. 선택적으로 `MOCK_119_API_KEY`를 `X-MOCK-119-KEY` 헤더로 보낸다. 테스트 환경 외부에서는 `wss://`를 사용한다. 한 요청당 연결하고, 아래 메시지 1개를 보낸 뒤 최대 5초간 확인 응답을 기다린다.

Backend 발신 JSON:

```json
{
  "type": "FIRE_REPORT",
  "requestId": "11b47ee2-6b20-40b1-bb3d-f4510e7d9b2a",
  "eventId": 27,
  "cameraId": "CAM003",
  "siteAddress": "경기도 ○○시 ○○로 123",
  "detailLocation": "제1공장 2층 생산라인 A",
  "specialNotes": "리튬배터리 보관구역",
  "eventType": "FIRE",
  "detectedAt": "2026-10-08T14:02:00",
  "reporterLoginId": "W000001",
  "reporterName": "홍길동",
  "reporterPhone": "01012345678",
  "controlRoomPhone": "0411234567"
}
```

모의서버 수신 확인 JSON:

```json
{
  "type": "REPORT_ACK",
  "requestId": "11b47ee2-6b20-40b1-bb3d-f4510e7d9b2a",
  "status": "ACCEPTED",
  "receiptId": "MOCK-119-001"
}
```

모의서버는 `requestId`가 같은 재시도를 중복 접수하지 않고 동일한 `receiptId`를 반환해야 한다. 거절 시 `status: "REJECTED"`, 선택적 `reason`을 보낸다. Backend는 `requestId`가 다르거나 접수 ID가 없는 응답을 접수 완료로 처리하지 않는다. 이 계약은 모의서버 담당자의 구현 기준이며, 변경 시 양쪽 코드보다 문서를 먼저 수정한다.

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
