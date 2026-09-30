# FIRIS Backend
Java 17 / Spring Boot 3.5 / Gradle. Web, Data JPA, Security, Validation 포함. H2는 초기 실행 확인용 임시 DB이며 최종 DB 선정이 아니다.
Gradle은 별도 설치 없이 Wrapper를 사용한다. 최초 실행 시 인터넷 연결이 필요하다.

프로젝트 루트에서:
```bash
cd backend
./gradlew bootRun
```
Windows에서는 `gradlew.bat bootRun`을 사용한다.
`curl http://localhost:8080/api/health` → `{"status":"ok"}`.
빌드: `./gradlew build`.

현재 Skeleton의 기본 DB는 메모리 H2이며 `.env` 없이 실행된다. 테이블 자동 생성과 SQL 초기화는 꺼져 있다.
설정 변경이 필요하면 이 디렉터리에서 `cp .env.example .env` 후 수정한다.
`.env`는 properties 형식(`KEY=value`, 따옴표 없이)이며 backend 디렉터리에서 실행해야 읽힌다.
MySQL은 검토 중이며 최종 채택·버전은 확인이 필요하다. 현재 H2 드라이버만 포함되어 있으므로 MySQL 주소만 입력해 연결할 수는 없다. 확정 후 드라이버와 설정을 함께 변경한다.
JWT_SECRET, AI_API_KEY는 예약 항목이며 현재 인증에 사용하지 않는다.

`com.firis` 하위 common/auth/account/camera/event/review/statistics 패키지를 사용한다.
GET /api/health만 공개하고 다른 요청은 차단한다. JWT, Entity, 계정/테이블 생성은 미구현이다.
개발 전 [PROJECT_CONTEXT](../docs/PROJECT_CONTEXT.md)와 요구사항·아키텍처·ERD·API 명세를 확인한다. 설계 변경은 팀 합의 → 문서 → 코드 순서를 따른다.
