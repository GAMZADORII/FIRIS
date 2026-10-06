# FIRIS Backend
Java 17 / Spring Boot 3.5 / Gradle. Web, Data JPA, Security, Validation 및 MySQL 런타임 드라이버를 사용한다. DB 테스트는 별도 MySQL 테스트 DB를 사용한다.
Gradle은 별도 설치 없이 Wrapper를 사용한다. 최초 실행 시 인터넷 연결이 필요하다.

프로젝트 루트에서:
```bash
cd backend
./gradlew bootRun
```
Windows에서는 `gradlew.bat bootRun`을 사용한다.
`curl http://localhost:8080/api/health` → `{"status":"ok"}`.
빌드: `./gradlew build`.

현재 기본 DB는 MySQL이며 실행 전에 backend/.env의 연결 정보를 설정해야 한다. ddl-auto 기본값은 update이고 SQL 초기화는 꺼져 있다.
설정 변경이 필요하면 이 디렉터리에서 `cp .env.example .env` 후 수정한다.
`.env`는 properties 형식(`KEY=value`, 따옴표 없이)이며 backend 디렉터리에서 실행해야 읽힌다.
MySQL 드라이버가 포함되어 있다. 운영 MySQL 버전은 8.4.11이며 스키마 변경 관리 방식은 팀 확인이 필요하다.
JWT_SECRET은 사용자 인증에, AI_API_KEY는 /api/ai/** 인증에 사용한다. JWT_SECRET은 실제 통합/운영 환경에서 최소 32바이트로 반드시 설정한다. 미설정 상태에서는 하드코딩된 기본 Secret 대신 실행 중에만 유효한 임시 랜덤 키를 사용하므로 서버 재시작 시 기존 JWT가 무효화된다. AI_API_KEY 미설정 시 해당 요청을 차단한다.
초기 ADMIN을 자동 생성하려면 ADMIN_PASSWORD를 설정해야 한다. 미설정 시 약한 기본 비밀번호를 사용하지 않고 자동 생성을 건너뛴다. 작업자 생성/비밀번호 초기화를 사용하려면 WORKER_DEFAULT_PASSWORD도 설정해야 한다. 비밀번호와 Secret은 코드나 .env.example에 실제 값으로 작성하지 않는다.
`AI_SERVER_URL`은 최신 박스 표시 JPEG을 받아올 AI 서버 주소이다(기본 `http://127.0.0.1:8000`). `GET /api/cameras/{cameraId}/frame`은 ADMIN/WORKER JWT를 검사하고 등록된 카메라의 최신 JPEG을 AI에서 받아 전달한다. 프론트는 JWT 헤더를 포함해 주기적으로 요청한다.
`EVENT_STORAGE_DIR`은 AI 이벤트 파일이 있는 공유 저장소를 가리킨다(로컬 기본 `../storage/events`). 이벤트 목록·상세·검수와 `/api/events/{eventId}/snapshot`, `/video`는 사용자 JWT가 필요하다. Compose에서는 AI 이벤트 저장소를 Backend에 읽기 전용으로 마운트한다.

`com.firis` 하위 common/auth/account/camera/event/review/statistics 패키지를 사용한다.
GET /api/health는 공개한다. AI 이벤트 생성·미디어 갱신은 별도 API Key 체인으로 보호한다. CAMERA/FIRE_EVENT/EVENT_MEDIA/EVENT_REVIEW Entity와 ACCOUNT/JWT 코드가 포함되어 있다. 고정 CCTV 시드는 아직 없다.
개발 전 [PROJECT_CONTEXT](../docs/PROJECT_CONTEXT.md)와 요구사항·아키텍처·ERD·API 명세를 확인한다. 설계 변경은 팀 합의 → 문서 → 코드 순서를 따른다.

## AI 이벤트 API 검증

```bash
./gradlew test
```
DB 없는 서비스 단위 테스트는 기본 실행된다. MySQL 통합 테스트는 FIRIS_TEST_DB_URL, FIRIS_TEST_DB_USERNAME, FIRIS_TEST_DB_PASSWORD를 설정하면 전용 firis_test DB에서 실행된다. 예: `FIRIS_TEST_DB_URL=jdbc:mysql://localhost:3306/firis_test`. 이 DB의 테이블은 테스트가 생성·삭제하므로 실제 데이터가 있는 DB를 지정하지 않는다. MySQL이 준비되지 않았으면 통합 테스트는 건너뛰며 서비스 단위 테스트만 실행된다.
일반 bootRun은 MySQL을 사용하고 ddl-auto 기본값은 update이다. 실제 API 호출 전 고정 CCTV 데이터와 AI_API_KEY를 준비해야 한다.
요청·응답과 통합 유의사항은 [AI 이벤트 구현 안내](../docs/AI_EVENT_IMPLEMENTATION.md)를 확인한다.
