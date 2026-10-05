# FIRIS 요구사항

> 현재 Backend 구현 범위: health check, AI 이벤트 생성·미디어 갱신 및 CAMERA/FIRE_EVENT/EVENT_MEDIA 매핑. [구현·검증 안내](AI_EVENT_IMPLEMENTATION.md)를 함께 확인한다. 금빈님 계정/JWT 및 MySQL 설정이 dev에 병합되어 이 브랜치에도 포함된다.


기준: [PROJECT_CONTEXT](PROJECT_CONTEXT.md). 설계 변경은 팀 합의 → 문서 → 코드 순서로 진행한다.

## 문서 상태 구분

- **현재 실행 상태**: health check, AI 이벤트 생성·미디어 갱신 코드와 네 페이지 placeholder가 있다. 이벤트 API의 서비스 단위 테스트는 DB 없이 검증했다. MySQL 통합 테스트는 전용 테스트 DB가 있을 때 실행하도록 구성했으나 아직 실제 MySQL에서 실행하지 않았다. 서버 실행에는 MySQL·카메라 데이터·API Key 설정이 필요하다. 실제 AI/Frontend 연동 완료를 의미하지 않는다.
- **최종 합의**: 앞으로 구현할 요구사항이다. 현재 구현 여부와 구분한다.
- **예시**: JSON의 비밀번호·ID·파일명, 탐지 수치 등 설명용 값이다. 실제 설정으로 확정하지 않는다.
- **확인 필요**: 담당자와 합의 후 문서에 반영할 사항이다. 임의 구현하지 않는다.
- **DB 현재 상태**: backend 기본 연결은 MySQL이다. 이벤트 API DB 통합 테스트는 별도 MySQL 테스트 DB에서 선택적으로 실행한다. MySQL 버전은 8.4.11로 확정했으며, 운영 스키마 관리 정책은 별도 확인이 필요하다.


## 구현 단계와 최종 범위

**초기 뼈대 이후 AI 이벤트 생성·미디어 갱신 구현을 시작했다. JWT 인증과 작업자/관리자 Backend 기능은 금빈님 PR 병합으로 dev에 포함됐다.**
현재 AI GET /health·단일 이미지 추론·영상 시간 창 판정과 Backend 이벤트 호출 코드, Backend GET /api/health 및 POST /api/ai/events·PATCH /api/ai/events/{eventId}/media, Frontend 네 페이지 placeholder와 라우팅이 있다. 실제 모델·MySQL·CCTV 통합 검증은 아직 필요하다.
이번 작업은 이벤트 관련 세 Entity와 두 AI 수신 API에 한정한다. 운영 테이블/시드, 학습/추론, 조회/검수 UI, 배포 구성은 별도 작업이다.

## 목적 및 일정

공장·창고·산업시설의 기존 CCTV를 분석하여 FIRE/SMOKE 위험 지속 여부를 확인하고 사람이 검수하도록 돕는다.
법정 화재 감지기와 소방 설비를 대체하지 않는 관제 보조 시스템이다. 최종 발표 예정일: **2026-10-16**.

## 계정과 인증

- 사용자 유형은 ADMIN, WORKER이다. Frontend 사용자는 JWT Bearer 인증을 사용한다.
- ADMIN 계정은 DB에 1개 사전 등록한다. 로그인 및 작업자 생성·조회·상태 변경·비밀번호 초기화를 담당한다.
- 관리자 회원가입·추가·비밀번호 찾기·변경·초기화 요청 기능은 없다. 비밀번호는 BCrypt hash로 저장한다.
- WORKER는 ADMIN이 생성하며 Backend가 W000001 형식의 loginId를 자동 발급한다.
- 생성 시 role=WORKER, status=ACTIVE, must_change_password=true이다.
- MVP 공통 임시 비밀번호를 사용할 수 있지만 실제 값은 예시와 구분하며 DB에는 BCrypt hash만 저장한다.
- 최초 로그인 및 관리자 초기화 후 비밀번호 변경을 강제한다. 성공하면 must_change_password=false이다.
- 로그인 화면에는 “비밀번호를 분실한 경우 관리자에게 문의해주세요.”를 표시한다. 사용자 초기화 요청 API/UI는 없다.
- 관리자가 비밀번호를 초기화하고 임시 비밀번호를 시스템 외부에서 직접 전달한다.
- ACTIVE는 로그인 가능, INACTIVE는 로그인 불가이다. 작업자는 삭제하지 않고 비활성화하여 검수 이력을 보존한다.

## Camera

CCTV는 camera-1 등 ID를 가진 고정 Reference Data이다. 추가·수정·삭제 기능은 없다.
카메라 이름, 위치, 스트림 URL을 관리하며 상태는 ONLINE/OFFLINE이다. 현재 시드는 생성하지 않는다.

## AI 및 이벤트

- MobileNet Family 사용은 확정이며 정확한 Detection Head/Bounding Box 방식은 AI 담당자가 결정한다.
- PyTorch 또는 TensorFlow를 사용할 수 있다. 일반 Classification에 종속하지 않고 모델 인터페이스를 추상화한다.
- AI 클래스는 FIRE/SMOKE이고 Backend Event Type은 FIRE/SMOKE/FIRE_SMOKE이다.
- 한 프레임만으로 이벤트를 만들지 않고 Temporal Validation을 적용한다. 최근 3초/70%는 실험용 예시이다.
- Frame Buffer는 AI에 둔다. 이벤트 전후 약 5초는 조정 가능한 예시이다.
- 위험 확정 → Snapshot 확보 → POST /api/ai/events → FIRE_EVENT 및 EVENT_MEDIA 생성 → eventId 반환 → 이후 프레임 수집/영상 저장 → PATCH /api/ai/events/{eventId}/media 순서를 따른다.
- 영상이 완성되기 전에 이벤트를 조회할 수 있어야 한다. 생성 직후 video_path는 NULL일 수 있다.
- 파일은 storage/events/ 등 저장소에 두고 DB에는 snapshot_path/video_path만 저장한다.

## 검수 및 통계

- ADMIN/WORKER는 TRUE_FIRE 또는 FALSE_POSITIVE로 검수한다.
- EVENT_REVIEW 행이 없으면 UNREVIEWED로 판단한다. UNREVIEWED를 result에 저장하지 않는다.
- 이벤트당 최종 검수 행은 최대 하나이다. UI에서 검수 완료 이벤트는 읽기 전용으로 표시한다.
- 오탐 사유는 STEAM/LIGHT/REFLECTION/DUST/WELDING/ETC이며 note를 입력할 수 있다.
- reviewerId를 요청으로 받지 않고 JWT의 로그인 accountId로 저장한다.
- 별도 Statistics Table 없이 FIRE_EVENT/EVENT_REVIEW를 집계한다.

## Frontend

주요 페이지는 정확히 Login, Dashboard, History, Admin 네 개이다.
별도 Live Monitoring/Statistics/Event Detail 페이지는 만들지 않고 상세는 Drawer/Modal/Side Panel로 처리한다.

| 페이지 | 요구사항 |
| --- | --- |
| Login /login | FIRIS, ID/사번, 비밀번호, 로그인, 관리자 문의 문구. mustChangePassword=true이면 비밀번호 변경 Modal |
| Dashboard /dashboard | 로그인 후 이동하는 통합 관제 화면. 페이지 전체 세로 스크롤 없음, CCTV 항상 노출 |
| History /history | 기간/CCTV/Event Type/Review Status 필터, 페이지네이션, 이벤트 상세 Drawer/Modal |
| Admin /admin | ADMIN 전용 작업자 목록/추가/초기화/활성·비활성. WORKER에게 메뉴 숨김, 삭제 기능 없음 |

Dashboard는 CCTV 65~70%, 현황 30~35%를 목표로 하고 기본 2x2 CCTV Grid를 사용한다.
카드에는 Camera Name, Location, ONLINE/OFFLINE, LIVE, 영상, FIRE/SMOKE, Confidence, Overlay/Bounding Box를 표시한다.
위험 시 Red Border/Warning Badge를 표시한다. 우측에는 오늘 이벤트/미검수/실제 화재/오탐/ONLINE CCTV 및 유형별 현황을 둔다.
최근 위험 이벤트 3~5개와 신규 이벤트 Red Alert Toast 및 이벤트 확인 동작을 제공한다.
History Table에는 ID, Snapshot Thumbnail, 발생 시간, CCTV, 위치, 유형, Confidence, 검수 상태, 상세보기를 표시한다.
상세에는 Snapshot, 영상, Event ID, CCTV/위치, 유형, Confidence, 발생 시각, 모델 버전, 전후 영상 길이, 검수 상태/결과를 표시한다.
영상 준비 중에는 “이벤트 영상을 생성하고 있습니다.”를 표시한다. 전후 길이 설명은 실제 preSeconds/postSeconds와 맞춘다.
검수 UI에는 실제 화재/오탐 선택과 사유·Note 입력을 둔다.
White 약 80%, Gray 약 15%, Red 약 5%의 산업용 안전 관제 디자인을 지향한다.
Red는 경고/Primary Button/유형 강조/선택 메뉴/위험 Border/중요 Badge에 사용한다.
현재 placeholder에는 위 UI와 인증·권한 동작이 구현되어 있지 않다.

## 최종 제외 기능

회원가입, 작업자 비밀번호 찾기·초기화 요청, 관리자 비밀번호 찾기·변경·추가·초기화 요청,
CCTV 추가·수정·삭제, 건물/시설 등록 관리, 자동 AI 재학습, 이메일/SMS 알림, 복잡한 Multi Admin 구조.

## 담당 및 개발 원칙

| 담당자 | 책임 |
| --- | --- |
| 박상현 | 이벤트 생성/미디어/상세/검수, AI 연동, Backend·Git·전체 통합, ERD/API, E2E |
| 오금빈 | 계정/JWT/작업자 관리, 이벤트 목록·검색, Dashboard 통계, Notion |
| 김형준 | 데이터/학습/모델 평가·튜닝, 추론/Temporal Validation/Frame Buffer/미디어, FastAPI/Backend 연동 |
| 차나래 | 네 페이지 및 상세/검수 UI, CCTV/Overlay/알림, API 연동, PPT/발표 |
| 신종건 | Docker/Compose/Jenkins, 파트별 Container, 환경변수 및 Build/Test/Deploy 자동화 |

문서·ERD/API 확인 → 담당 기능 단위 구현 → 단위 실행 → 파트 연동 → E2E 순서를 따른다.
API 이름, DB 컬럼, 테이블, 페이지, 역할, 모델 구조를 임의로 변경하지 않는다.
