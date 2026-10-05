# FIRIS ERD 설계 초안

> 현재 Backend 구현 범위: health check, AI 이벤트 생성·미디어 갱신 및 CAMERA/FIRE_EVENT/EVENT_MEDIA 매핑. [구현·검증 안내](AI_EVENT_IMPLEMENTATION.md)를 함께 확인한다. 금빈님 계정/JWT 및 MySQL 설정이 dev에 병합되어 이 브랜치에도 포함된다.


기준: [PROJECT_CONTEXT](PROJECT_CONTEXT.md) 19~20절. 아래 컬럼명·타입·제약은 팀이 제공한 설계이며 임의 변경하지 않는다.
**CAMERA/FIRE_EVENT/EVENT_MEDIA Entity를 구현했다. ACCOUNT는 금빈님 코드로 구현됐고 EVENT_REVIEW는 미구현이다. 운영 DDL·migration과 CAMERA 시드는 별도 작업이다.** 현재 기본 설정은 MySQL 8.4.11이며 운영 스키마 관리 정책은 확인이 필요하다.

## 문서 상태 구분

- **현재 실행 상태**: health check, AI 이벤트 생성·미디어 갱신 코드와 네 페이지 placeholder가 있다. 이벤트 API의 서비스 단위 테스트는 DB 없이 검증했다. MySQL 통합 테스트는 전용 테스트 DB가 있을 때 실행하도록 구성했으나 아직 실제 MySQL에서 실행하지 않았다. 서버 실행에는 MySQL·카메라 데이터·API Key 설정이 필요하다. 실제 AI/Frontend 연동 완료를 의미하지 않는다.
- **최종 합의**: 앞으로 구현할 요구사항이다. 현재 구현 여부와 구분한다.
- **예시**: JSON의 비밀번호·ID·파일명, 탐지 수치 등 설명용 값이다. 실제 설정으로 확정하지 않는다.
- **확인 필요**: 담당자와 합의 후 문서에 반영할 사항이다. 임의 구현하지 않는다.
- **DB 현재 상태**: backend 기본 연결은 MySQL이다. 이벤트 API DB 통합 테스트는 별도 MySQL 테스트 DB에서 선택적으로 실행한다. MySQL 버전은 8.4.11로 확정했으며, 운영 스키마 관리 정책은 별도 확인이 필요하다.


## ACCOUNT

| 컬럼 | 타입 및 제약 |
| --- | --- |
| account_id | BIGINT PK AUTO_INCREMENT |
| login_id | VARCHAR(30) NOT NULL UNIQUE |
| password_hash | VARCHAR(255) NOT NULL |
| name | VARCHAR(50) NOT NULL |
| role | VARCHAR(20) NOT NULL |
| must_change_password | BOOLEAN NOT NULL DEFAULT FALSE |
| status | VARCHAR(20) NOT NULL DEFAULT ACTIVE |
| created_at | DATETIME NOT NULL |
| updated_at | DATETIME NOT NULL |

## CAMERA

| 컬럼 | 타입 및 제약 |
| --- | --- |
| camera_id | VARCHAR(30) PK |
| camera_name | VARCHAR(50) NOT NULL |
| location | VARCHAR(100) |
| stream_url | VARCHAR(500) |
| status | VARCHAR(20) NOT NULL DEFAULT ONLINE |

## FIRE_EVENT

| 컬럼 | 타입 및 제약 |
| --- | --- |
| event_id | BIGINT PK AUTO_INCREMENT |
| camera_id | VARCHAR(30) NOT NULL FK |
| event_type | VARCHAR(20) NOT NULL |
| confidence | DOUBLE NOT NULL |
| detected_at | DATETIME NOT NULL |
| model_version | VARCHAR(50) |
| created_at | DATETIME NOT NULL |

## EVENT_MEDIA

| 컬럼 | 타입 및 제약 |
| --- | --- |
| media_id | BIGINT PK AUTO_INCREMENT |
| event_id | BIGINT NOT NULL UNIQUE FK |
| snapshot_path | VARCHAR(500) |
| video_path | VARCHAR(500) |
| pre_seconds | INT |
| post_seconds | INT |
| created_at | DATETIME NOT NULL |
| updated_at | DATETIME NOT NULL |

## EVENT_REVIEW

| 컬럼 | 타입 및 제약 |
| --- | --- |
| review_id | BIGINT PK AUTO_INCREMENT |
| event_id | BIGINT NOT NULL UNIQUE FK |
| reviewer_id | BIGINT NOT NULL FK |
| result | VARCHAR(30) NOT NULL |
| false_positive_reason | VARCHAR(30) |
| note | VARCHAR(500) |
| reviewed_at | DATETIME NOT NULL |

## 값 및 관계

- ACCOUNT.role: ADMIN / WORKER. status: ACTIVE / INACTIVE.
- ACCOUNT.must_change_password는 DB 기본값 FALSE이나 WORKER 생성·초기화 시 TRUE로 설정한다.
- CAMERA.status: ONLINE / OFFLINE. camera_id는 camera-1 등의 고정 데이터 ID이다.
- FIRE_EVENT.event_type: FIRE / SMOKE / FIRE_SMOKE.
- EVENT_REVIEW.result: TRUE_FIRE / FALSE_POSITIVE. UNREVIEWED는 저장하지 않고 검수 행 부재로 판단한다.
- EVENT_REVIEW.false_positive_reason: STEAM / LIGHT / REFLECTION / DUST / WELDING / ETC.
- password_hash는 BCrypt hash만 저장한다. 미디어 Binary는 저장하지 않는다.
- EVENT_MEDIA.video_path는 생성 직후 NULL일 수 있다.

| 관계 | 참조 |
| --- | --- |
| CAMERA 1:N FIRE_EVENT | FIRE_EVENT.camera_id → CAMERA.camera_id |
| FIRE_EVENT 1:0..1 EVENT_MEDIA | EVENT_MEDIA.event_id → FIRE_EVENT.event_id (UNIQUE) |
| FIRE_EVENT 1:0..1 EVENT_REVIEW | EVENT_REVIEW.event_id → FIRE_EVENT.event_id (UNIQUE) |
| ACCOUNT 1:N EVENT_REVIEW | EVENT_REVIEW.reviewer_id → ACCOUNT.account_id |

AI 이벤트 생성 API는 FIRE_EVENT와 Snapshot 경로를 가진 EVENT_MEDIA를 생성한다.
관계의 0..1은 저장 구조상 최대 하나를 뜻한다. 최종 검수도 이벤트당 하나이다.
검수자는 JWT에서 가져오고, 작업자를 삭제하지 않아 검수 이력을 유지한다.
통계 전용 테이블은 만들지 않는다. 외래키 삭제 정책, 추가 인덱스, 시간대 등 명시되지 않은 정책은 구현 전에 확인한다.
