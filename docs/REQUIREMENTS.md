# FIRIS 요구사항

## 문서 우선 개발
기능 개발 전 REQUIREMENTS, ARCHITECTURE, ERD, API_SPEC을 먼저 확인한다.
설계 변경은 코드보다 먼저 관련 문서에 반영한다. 미정 사항은 임의로 구현하지 않고 문서에서 확정한다.

## 현재 구현 범위
AI `GET /health`, Backend `GET /api/health`, Frontend 네 페이지의 placeholder와 라우팅만 구현한다.
아래 항목은 향후 개발 요구사항이며 현재 구현 완료를 의미하지 않는다.
AI 학습/추론, Entity, 테이블/시드 생성, JWT 인증, 작업자/관리자 기능, Dashboard UI, Docker 배포는 구현하지 않는다.

## 계정 및 인증
- ADMIN은 DB에 1개 사전 등록할 예정이다. 관리자 회원가입·추가·비밀번호 변경·찾기 기능은 없고 비밀번호는 고정한다.
- ADMIN만 작업자를 관리한다. 관리자 초기 데이터도 현재 생성하지 않는다.
- WORKER는 관리자가 생성하며 loginId는 `W000001` 형식으로 자동 발급한다.
- 최초 임시 비밀번호를 사용하고 최초 로그인 후 변경을 강제한다. `must_change_password`로 관리한다.
- 비밀번호 분실 시 사용자 초기화 요청 없이 관리자가 작업자 관리 화면에서 직접 초기화한다. 이후 다시 변경을 강제한다.
- 작업자는 `ACTIVE` / `INACTIVE` 상태를 사용하며 삭제하지 않고 비활성화한다.

## Camera
- CCTV는 프로젝트 시작 시 미리 등록된 고정 데이터이다. 추가·수정·삭제 기능은 없다.
- cameraId는 `camera-1`, `camera-2` 등이며 상태는 `ONLINE` / `OFFLINE`이다.

## AI 및 이벤트
- MobileNet 계열 모델을 사용할 예정이며 PyTorch 또는 TensorFlow는 추후 선택한다.
- Bounding Box가 필요한 객체 탐지가 될 수 있으므로 일반 classification 구조에 종속하지 않는다.
- AI 주요 클래스는 `FIRE`, `SMOKE`이다. 필요 시 Backend에서 `FIRE_SMOKE`를 표현한다.
- CCTV → 탐지 → 일정 시간 지속 확인 → 위험 확정 → Backend 이벤트 생성 → Snapshot 저장 → 이벤트 전후 Frame Buffer → mp4 생성 → Backend 영상 경로 업데이트 순서이다.
- 위험 확정 즉시 `POST /api/ai/events`를 호출하고 Backend는 FIRE_EVENT를 생성하여 eventId를 반환한다.
- AI는 eventId를 보관하고 이후 영상 수집과 mp4 생성을 마치면 `PATCH /api/ai/events/{eventId}/media`를 호출한다.
- Backend는 영상 생성을 기다렸다가 이벤트를 생성하면 안 된다.
- 지속 시간, 임계값, 버퍼 길이, 중복 이벤트 정책은 추후 결정한다.

## Media 및 검수
- 이미지·영상 Binary를 DB에 저장하지 않는다. DB에는 `snapshot_path`, `video_path` 등 경로만 저장한다.
- 실제 파일은 `ai/storage/events/` 등 파일 저장소에 둔다.
- 검수 결과는 `TRUE_FIRE` / `FALSE_POSITIVE`이다.
- 오탐 사유는 `STEAM`, `LIGHT`, `REFLECTION`, `DUST`, `WELDING`, `ETC` 등이다.
- 한 이벤트에 최종 검수 정보는 하나만 존재한다.

## Frontend
- `/login`: Login. 향후 로그인 및 최초/초기화 후 비밀번호 변경 흐름을 제공한다.
- `/dashboard`: 별도 실시간 관제 페이지로 분리하지 않는 통합 관제 화면이다. 전체 페이지의 세로 스크롤이 발생하지 않도록 설계한다.
- Dashboard에 실시간 CCTV, FIRE/SMOKE Bounding Box 또는 Detection Overlay, 오늘 발생 이벤트, 미검수 이벤트, 실제 화재, 오탐, ONLINE CCTV, 최근 위험 이벤트를 표시한다.
- `/history`: 날짜, CCTV, 이벤트 타입, 검수 상태 필터와 이벤트 이력을 제공한다.
- 이벤트 상세에는 Snapshot, Event Video, Confidence, 발생 시각, 검수 결과를 표시한다. 상세 표시 방식은 미정이다.
- `/admin`: 작업자 목록, 추가, 비밀번호 초기화, ACTIVE/INACTIVE 변경을 제공한다.
- WORKER에게 Admin 메뉴를 노출하지 않는다. Backend에서도 ADMIN 권한을 검증하도록 향후 설계한다.
- 현재는 인증 및 메뉴가 없으므로 네 placeholder URL에 직접 접근할 수 있다.

## 제외 기능
회원가입, 사용자 비밀번호 찾기/초기화 요청, 관리자 비밀번호 변경/추가,
CCTV 추가/수정/삭제, 시설 관리, 자동 AI 재학습, 이메일/SMS 알림은 프로젝트 범위에서 제외한다.
