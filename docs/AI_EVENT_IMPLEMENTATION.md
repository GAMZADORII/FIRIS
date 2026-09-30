# AI 이벤트 API 구현

박상현 담당의 이벤트 생성 및 미디어 갱신만 구현한다. 기존 API 경로·필드와 ERD를 유지한다.
최신 dev에 병합된 계정/JWT 및 MySQL 설정을 유지한다. 이벤트 코드에서는 공통 SecurityConfig와 DB 연결 설정을 수정하지 않는다. MySQL 버전은 이 작업에서 새로 지정하지 않는다.

## 이번 구현 기준
- POST /api/ai/events: 201, eventId 및 UNREVIEWED 반환. FIRE_EVENT와 EVENT_MEDIA를 한 트랜잭션에 저장한다.
- PATCH /api/ai/events/{eventId}/media: 200, eventId 및 videoAvailable=true 반환. 기존 Snapshot 경로는 보존한다.
- 두 API는 X-AI-API-KEY를 AI_API_KEY 환경 설정과 비교한다. 키 미설정 시 차단하며 빈 키로 접근할 수 없다.
- /api/ai/** 전용 @Order(1) SecurityFilterChain을 사용하여 사용자 JWT 체인과 분리한다. 체인에서는 합의된 POST /api/ai/events 및 PATCH /api/ai/events/{eventId}/media만 허용하고 다른 AI 경로는 차단한다. AI API에서만 CSRF를 비활성화한다.
- 인증 오류 401, 필수값/형식/길이 오류 400, 미등록 Camera/Event는 404이다.
- 오류 JSON은 금빈님 브랜치와 같은 code/message 형태로 제공하되 이벤트 패키지 내에서만 처리한다.
- Confidence는 유한한 0~1 값, cameraId/eventType/confidence/detectedAt/snapshotPath는 필수이다. modelVersion은 선택이다.
- videoPath 및 0 이상의 preSeconds/postSeconds는 갱신 시 필수이다. 문자열 최대 길이는 ERD와 일치한다.
- detectedAt은 오프셋 없는 한국시간(Asia/Seoul)으로 전달한다. createdAt/updatedAt도 한국시간 기준이다.
- 경로는 메타데이터로만 저장하며 서버 파일 읽기/쓰기나 외부 URL 요청을 하지 않는다. 경로의 실제 접근 가능 여부는 확인하지 않는다.
- videoAvailable은 경로 등록 완료를 뜻하며 파일 존재·브라우저 재생 검증 결과는 아니다.

## 범위와 통합 유의사항
- CAMERA 매핑과 Repository는 이벤트 FK 검증용이다. CCTV CRUD/조회 API나 실제 CCTV 시드는 추가하지 않는다.
- 동일 PATCH 재전송은 동일 미디어 행을 갱신한다. 이벤트 행 잠금으로 동시 갱신의 유실을 방지한다.
- POST에는 멱등성 식별자가 없다. 각 성공 요청은 별도 이벤트를 만든다. 응답 유실 시 무조건 재전송하지 말고 중복 방지 계약을 AI 담당자와 확정한다.
- 영상 생성 실패/재시도·보존 정책, 공통 오류 코드 최종 통합은 후속 합의 대상이다.
- MySQL 통합 테스트에서만 전용 firis_test DB에 create-drop과 테스트 CCTV를 사용한다. FIRIS_TEST_DB_URL이 없으면 해당 테스트는 건너뛴다. dev의 MySQL ddl-auto 기본값 update를 유지한다.
- MySQL 실제 서버 연결 검증은 아직 수행하지 않았다. 실행 전 MySQL DB와 고정 CCTV 등록이 필요하다.
- build.gradle은 MySQL 드라이버를 유지한다. JUnit 및 Spring Boot 테스트 의존성을 추가했다.
- 사용자 JWT 필터는 공통 체인에 유지된다. AI API Key 체인은 별도 순서로 등록된다.

## 검증
backend에서 ./gradlew test 실행. DB 없는 단위 테스트에는 MySQL이나 실제 .env가 필요 없다. DB 통합 테스트에는 전용 firis_test MySQL과 FIRIS_TEST_DB_URL/USERNAME/PASSWORD가 필요하다.
실제 서버 호출 시 AI_API_KEY를 설정하고 MySQL에 고정 CAMERA 데이터를 등록해야 한다. dev의 ddl-auto 기본값은 update이며 운영 스키마 관리 방식은 팀 합의가 필요하다.
사용자 로그인·이벤트 조회·검수 API는 이 작업에 포함하지 않는다.

## 현재 검증 결과

- `./gradlew build` 성공. DB 없는 서비스 단위 테스트 3개 통과.
- MySQL 통합 테스트 8개는 `FIRIS_TEST_DB_URL`이 없어서 건너뛰었다. MySQL 연결과 실제 HTTP/DB 트랜잭션 결과는 아직 검증하지 않았다.
- 통합 테스트는 `firis_test` 이름의 **전용 빈 MySQL DB**를 사용하고 테스트가 테이블을 생성·삭제한다. 실제 데이터가 있는 DB를 지정하지 않는다.
- 실행 전 `FIRIS_TEST_DB_URL=jdbc:mysql://localhost:3306/firis_test`, `FIRIS_TEST_DB_USERNAME`, `FIRIS_TEST_DB_PASSWORD`를 설정한다. 이 값은 Git에 커밋하지 않는다.
- 실제 AI 서버 통신과 브라우저 미디어 재생은 아직 검증하지 않았다.
