# FIRIS 통합 119 모의 접수센터

기준: dev 56f56a7040d92704c75623626e27cdd4db61c076. 기존 Spring Boot Backend 하나가 FIRIS 프론트와 119 프론트를 함께 처리한다. 실제 119 신고 서비스가 아니다.

## 연결과 실행

```text
FIRIS :5173 → POST /api/events/{eventId}/mock-119-reports (ADMIN/WORKER JWT)
                         ↓
              Backend :8080 → 기존 MySQL firis에 저장
                         ↓ DB commit 후 알림
              /ws/mock-119-center → 119 화면 :5174
                         ↓
              GET /api/mock-119-center/reports 로 실제 목록 조회
```

백엔드와 WebSocket은 같은 프로세스·포트를 사용한다. 두 프론트는 각각 실행한다. Docker Compose에 119 프론트와 센터 환경변수를 연결한다. Jenkins는 변경하지 않는다. 새 119 백엔드나 별도 DB는 없다.

Backend 실행 환경 또는 `backend/.env`에서 다음 값을 설정한다. 예시 파일 자체가 실행 설정은 아니므로 자신의 `.env`에 반영한다.

```dotenv
MOCK_119_DELIVERY_MODE=integrated
MOCK_119_CENTER_ENABLED=true
MOCK_119_ALLOWED_ORIGINS=http://localhost:5174,http://127.0.0.1:5174,http://localhost:5173,http://127.0.0.1:5173
MOCK_119_SITE_ADDRESS=시연용 사업장 주소
MOCK_119_CONTROL_ROOM_PHONE=0212345678
CONTACT_ONBOARDING_ENFORCED=false
```

DB_URL, DB_USERNAME, DB_PASSWORD, JWT_SECRET 및 기존 초기 계정 설정도 필요하다. Docker에서는 기존 mysql 서비스와 firis-mysql-data 볼륨을 유지한다. 데이터 초기화나 볼륨 삭제는 필요하지 않다. 기존 DB에 변경 사항을 적용하기 전 백업·스키마 변경 검토가 필요하며 이 작업에서는 실제 MySQL을 변경하지 않았다.

센터 API·WebSocket은 로그인 없는 시연용이다. 기본 설정은 `center-enabled=false`로 닫혀 있다. 활성화하면 신고자 연락처와 이벤트 영상 접근·대응 상태 변경이 가능하므로 격리된 시연 환경에서만 사용한다. CORS/Origin 목록은 인증을 대체하지 않는다. FIRIS의 기존 JWT 및 ADMIN/WORKER 권한은 유지한다.

통합 모드에서 `MOCK_119_WS_URL`, `MOCK_119_API_KEY`는 사용하지 않는다. `MOCK_119_DELIVERY_MODE=external`이면 기존 외부 서버 전송 및 REPORT_ACK 계약을 그대로 사용하며, 외부 접수 기록을 통합 센터 목록에 자동으로 가져오지 않는다.

로컬 실행:

```powershell
cd backend
./gradlew.bat bootRun
# 별도 터미널: frontend에서 yarn dev
# 별도 터미널: 119-center-frontend에서 npm ci 후 npm run dev
```

브라우저용 VITE_API_BASE_URL에는 실제 FIRIS Backend 주소를 넣는다. 원격 접속 시 localhost나 Docker 내부 서비스명을 브라우저 주소로 사용하지 않는다. HTTPS 서버에서는 WebSocket도 WSS로 연결한다. 허용 Origin에는 두 프론트의 실제 접속 주소를 설정한다.

## 기존 신고 API

ADMIN/WORKER JWT로 기존 preview/POST 경로를 사용한다. POST 요청 본문은 없다.

| Method | Endpoint | 권한 | 응답 |
| --- | --- | --- | --- |
| GET | /api/events/{eventId}/mock-119-preview | ADMIN/WORKER | 신고 정보, readyToReport, missingFields |
| POST | /api/events/{eventId}/mock-119-reports | ADMIN/WORKER | reportId, eventId, status, receiptId, responseStatus |
| GET | /api/events/{eventId}/mock-119-report | ADMIN/WORKER | 동일 신고 상태 |

통합 모드의 `ACCEPTED`는 센터 DB 등록 성공이며 센터 직원의 출동 접수와 구분한다. 최초 responseStatus는 PENDING이다. 이벤트당 기존 UNIQUE 제약·동일 requestId 및 최초 신고자 재시도 정책을 유지한다. DB commit 후 WebSocket 알림을 보내므로 브라우저가 닫혀 있어도 저장된 신고는 성공한다. 방송 실패를 신고 전송 실패로 처리하지 않는다.

주요 오류: 입력한 정보 형식 오류·완료된 이벤트 400, 인증 401, 권한 403, 이벤트 없음 404, 센터 비활성 또는 외부 전송 실패 502. 기존 신고 재요청은 동일 신고를 반환한다.

## 기존 계정 기능과의 경계

계정·로그인·연락처 등록 API와 동의 관련 코드는 수정하지 않는다. 메인 프론트 변경은 mock119Socket.js와 FireAlert.jsx 두 파일뿐이다. 연락처 등록 화면·라우트·로그인 이동 변경은 포함하지 않는다.

119 신고는 기존 계정의 저장된 연락처를 읽는다. 119 화면에 동의 문안·체크박스는 없다. report 패키지에서는 연락처가 비어 있어도 신고를 허용하지만 기존 auth/contact API의 정책은 별도 담당 코드 그대로 유지한다. 연락처가 없어도 신고 가능하며 이번 코드가 새로운 등록 흐름을 만들지 않는다.

## 센터 API

아래 API는 MOCK_119_CENTER_ENABLED=true일 때만 사용 가능하다. 동의·로그인 화면은 없다.

| Method | Endpoint | Request | Response / 주요 오류 |
| --- | --- | --- | --- |
| GET | /api/mock-119-center/reports | page=0, size=100 (1~100) | Spring Page: content, totalElements, totalPages; 잘못된 페이지 400 |
| GET | /api/mock-119-center/reports/{reportId} | 없음 | 신고·대응 시각·이력; 없음/외부 접수 행 404 |
| PATCH | /api/mock-119-center/reports/{reportId}/response-status | 아래 JSON | 변경된 상세; 잘못된 전이 400, 상태 충돌 409, 없음 404 |
| GET | /api/mock-119-center/reports/{reportId}/video | annotated=true 선택 | MP4; 영상 준비 전/없음 404 |
| GET | /api/mock-119-center/reports/{reportId}/snapshot | 없음 | JPEG; 없음 404 |

```json
{ "expectedStatus": "PENDING", "responseStatus": "DISPATCHED" }
```

처리 흐름:

```text
PENDING → 접수 완료 → DISPATCHED → 서버에서 60초 후 ARRIVED → 대응 완료 → CLOSED
```

브라우저에서 ARRIVED를 직접 확정할 수 없다. 출동 예정 시각은 DB에 저장되고 서버가 1초 주기로 갱신한다. 브라우저·서버 재시작 후에도 저장된 마감 시각을 사용한다. 반복된 동일 단계 요청은 중복 이력을 만들지 않고 현재 결과를 반환한다. 모든 변경은 이벤트 행을 먼저 잠그고 현재 신고를 다시 읽어 처리한다.

신고 상세 필드: reportId, eventId, requestId, receiptId, cameraId, siteAddress, detailLocation, specialNotes, eventType, confidence(0~1), detectedAt, reportedAt, reporterName, reporterPhone, controlRoomPhone, responseStatus, dispatchAt, arrivalAt, closedAt, history[{status, occurredAt}]. 시각은 Asia/Seoul 기준 오프셋 없는 ISO 문자열이다.

더미 신고·영상·로컬 상태 시뮬레이션 파일은 제거했다. 기존 출동 지도 디자인과 고정 시연 거리는 유지한다. 발생 위치는 메인 FIRIS의 CCTV 표시 순서에 맞춘 공장 A~E·창고 A~D 개념 배치도이며 실제 cameraId로 구역을 강조한다. 실제 지리·평면도·이동 거리 측정 결과를 의미하지 않는다. 처리 상태와 시각은 서버가 기준이다. 탐지 영상은 기존 EventMediaController의 경로·파일 검증을 재사용하며 센터에 등록된 이벤트만 접근한다.

## WebSocket

주소: `ws://localhost:8080/ws/mock-119-center` (HTTPS에서는 WSS).

```json
{ "type": "REPORT_CREATED", "reportId": 12, "eventId": 27 }
```

상태 변경은 REPORT_UPDATED. 개인정보·영상 경로는 방송하지 않는다. 브라우저는 메시지를 받으면 HTTP 목록을 다시 조회한다. 브라우저 발신 PING에 PONG을 응답하며 상태 변경 메시지는 받지 않는다. 원시 WebSocket을 사용하며 STOMP·SockJS·별도 메시지 브로커는 필요하지 않다.

프론트는 재연결·재접속 시 목록 재조회, 지수형 재연결 대기, heartbeat 및 30초 보완 조회를 수행한다. 연결 중단·새로고침에도 실제 상태는 DB가 기준이며 localStorage나 더미 데이터를 운영 데이터로 사용하지 않는다. 현재 단일 Backend 인스턴스를 전제로 한다. 향후 다중 인스턴스는 인스턴스 간 방송 경로가 필요하다.

## FIRIS 완료와 DB

센터 CLOSED 전환과 FIRE_EVENT.response_completed_at 갱신은 같은 트랜잭션이다. 센터 완료는 작업자의 TRUE_FIRE 검수를 임의 생성하지 않는다. 미검수 상태는 검수 전까지 남을 수 있으며 대응 완료와 구분한다. 이미 오탐 검수된 이벤트는 센터 완료 400으로 거절한다. FIRIS 화면은 방송을 받아 이벤트를 재조회하고 완료된 이벤트의 알림을 제거한다. 기존 최초 eventId 기준선 정책은 유지하며 이후 조회에서 완료된 이벤트를 알림에 넣지 않는다.

기존 MOCK_119_REPORT에 nullable response_status, dispatch_at, arrival_at, closed_at 추가. 기존 외부 접수 행은 response_status=null로 유지한다.

MOCK_119_REPORT_HISTORY: history_id PK, report_id FK, status, occurred_at. 신규 접수·출동·도착·완료 이력을 저장한다. 기존 계정·이벤트·미디어 관계와 DB 볼륨을 유지한다.

## 검증 범위

백엔드 테스트에는 메모리 H2 전용 DB에서 실제 HTTP·WebSocket 연결, 기존 계정의 연락처 조회, 등록 후 방송·조회, 중복 신고, 잘못된 전이·상태 충돌, 도착·완료·이력 및 FIRIS 완료 시각을 확인하는 통합 테스트가 포함된다. 기존 MySQL 연결·데이터를 사용하지 않는다.

백엔드 테스트, 두 프론트 빌드, 서버 시각 표시 테스트는 수행한다. 실제 MySQL 마이그레이션, Docker 배포, 실제 AI 영상·장치 및 브라우저 전체 조작은 별도 검증 대상이다.

## 최종 수정 범위

- 메인 frontend: src/api/mock119Socket.js 추가, src/components/Console/FireAlert.jsx 수정만 포함.
- backend: report 패키지, 센터 관련 설정 및 테스트만 변경.
- 공통 SecurityConfig: 센터 활성화 조건·센터 경로 허용·센터 Origin 추가만 변경.
- 공통 ErrorCode: MOCK_119_STATE_CONFLICT 한 항목만 추가. 기존 오류·연락처 안내는 그대로 유지.
- build.gradle: WebSocket 및 테스트용 H2 의존성만 추가.
- 기존 Account/AuthService/연락처 DTO/인증 테스트 및 메인 App/Login 코드는 변경 없음.
- 기존 공동 문서 API_SPEC/ARCHITECTURE/ERD/REQUIREMENTS도 원복. 신규 119 문서에 센터 계약만 정리.
- Docker Compose 통합을 추가하여 기존 Backend 8080과 두 프론트 5173/5174를 한 번에 실행한다. Jenkins는 변경하지 않는다.

ADMIN과 WORKER 모두 119 신고 미리보기·전송 가능. 활성 계정 검사와 입력된 연락처의 형식 검사는 유지하며 계정·로그인 API는 수정하지 않는다.

사업장 주소·관제실 번호·신고자 연락처·상세위치는 선택값이다. 비어 있어도 readyToReport=true이며 신고를 저장한다. 기존 NOT NULL 전화번호 컬럼에는 빈 문자열을 저장해 스키마 변경을 요구하지 않는다. 입력한 전화번호 형식과 주소 길이 제한은 유지한다.

## Docker 실행 (최종)

```powershell
cd C:\Users\gold4\Desktop\FIRIS
docker compose up -d --build
```

메인 http://localhost:5173, 센터 http://localhost:5174. 더 이상 테스트용 8081/5175와 터미널 3개를 사용하지 않는다. 다음 실행부터 기존 MySQL 볼륨은 그대로 사용하며 down -v나 DB 초기화는 필요하지 않다.

Compose는 MOCK_119_DELIVERY_MODE=integrated와 MOCK_119_CENTER_ENABLED=true를 Backend 컨테이너에 전달한다. 브라우저 API 주소는 기본 http://localhost:8080이며 두 Origin을 허용한다. 필요한 경우 프로젝트 루트 .env에서 설정하고 서비스를 다시 생성한다. backend/.env는 컨테이너에 자동 전달되지 않는다.

실제 Docker 전환 검증: Backend 건강 확인 200, 두 프론트 HTML 200, 센터 목록 200, WebSocket Origin localhost:5174의 PING/PONG 성공, 기존 신고 원본/박스 영상·스냅샷 조회 200. 전체 브라우저 재생·새 신고 E2E를 다시 수행한 것은 아니다. MySQL named volume firis_firis-mysql-data와 기존 AI 실행 명령을 유지했다.
