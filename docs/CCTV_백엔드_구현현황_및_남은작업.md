
## 코드로 확인된 기능

| 영역 | 현재 상태 |
|---|---|
| 인증/계정 | JWT 로그인, 비밀번호 변경, 관리자 작업자 목록/생성/상태 변경/비밀번호 초기화 구현. 작업자 일반 정보 수정 API는 미구현 |
| AI → Backend | 이벤트 생성 및 미디어 경로 갱신 API 구현 |
| AI 분석 | 영상 입력, 시간 기반 탐지 판정, 원본 프레임 snapshot/전후 MP4 저장, 박스를 그린 최신 JPEG 생성 구현 |
| JPEG 전달 | JWT 인증 후 Backend가 AI의 최신 JPEG를 전달하는 API 구현 |
| 이번 추가 | GET /api/cameras, 로컬 MP4 제공 및 구간 요청, DB 등록 SQL, 시연 MP4 3개 |
| 프론트 | 로그인/대시보드/이력/관리 화면은 제목 중심 골격. 실제 CCTV 및 박스 이미지 표시 연동 미구현 |
| 이벤트/통계 | 이벤트 목록·상세·검수·인증된 미디어 조회 구현. Dashboard 통계 API는 집계 기준 확정 후 구현 |
| 인프라 | MySQL 8.4.11, Backend, AI의 Docker Compose 로컬 통합 실행 구성이 완료됨. Jenkins는 현재 이미지 빌드 중심이며 실제 배포 자동화는 별도 필요 |

팀의 기존 docs/AI_INTEGRATION.md에는 로컬 영상 → AI → Backend → MySQL 및 최신 JPEG 수동 검증이 기록돼 있습니다. 이는 팀 기록이며 이번 작업에서 실제 모델/DB로 재검증한 결과는 아닙니다.

## 화면 방식

원본 MP4는 그대로 두고 브라우저 video로 재생합니다. 박스 화면은 AI가 박스를 그린 JPEG를 Backend를 통해 주기적으로 받아 교체해 표시합니다. 두 화면이 자동 동기화되는 구조는 아닙니다.
기본 추론 설정은 영상 시간 기준 최대 5회/초이며, 로컬 파일을 실제 시간에 맞추려면 --realtime이 필요합니다. 파일 끝에서 AI 처리는 종료되고 자동 반복하지 않습니다.

## 다음 작업 우선순위

1. 실제 모델 가중치 확보 및 실행 환경변수/카메라 DB 등록. ZIP의 모델 파일은 Git LFS 포인터입니다.
2. 프론트 카메라 목록/원본 video 및 JWT 인증 JPEG 요청 연동. JPEG 미생성·오래됨·AI 중단 상태도 표시해야 합니다.
3. AI 담당과 파일 반복 실행/여러 카메라 운영 방식 및 실제 클래스 매핑 확인. 불꽃→SMOKE 혼동과 사람 주변 오탐을 검증하고 2초·70% 기준은 평가 후 결정합니다.
4. Backend 이벤트 조회/검수 API 및 인증된 snapshot/이벤트 MP4 접근 구현. 현재 DB의 AI 로컬 절대 경로는 브라우저 URL이 아닙니다. 저장 MP4의 브라우저 코덱 호환도 확인해야 합니다.
5. 통계 API 및 화면 연동, AI 이벤트 전송/경로 갱신 실패 재시도와 파일 보관 정책 검토.
6. 인프라 담당과 실행/배포 환경 통합. 서로 다른 서버에서는 파일 경로와 공유 저장소를 별도로 맞춰야 합니다.
x
## 보안 및 검증 경계

- /api/cameras 및 /api/cameras/{id}/frame은 기존 ADMIN/WORKER 인증을 유지합니다.
- /videos/*.mp4는 로컬 시연용으로 GET/HEAD 공개입니다. 민감한 CCTV를 두지 마세요.
- 기존 설정의 기본 JWT/계정 비밀번호 대신 환경변수를 반드시 설정하세요.
- AI /predict, /events/confirm은 현재 인증이 없으므로 외부에 그대로 공개하지 마세요.
- Backend test/bootJar 성공: 14개 통과, DB 설정을 요구하는 8개 건너뜀.
- AI 시간 판정/Backend client 단위 테스트 10개 통과. 실제 YOLO/DB/브라우저 통합은 이번 작업에서 미검증.
- 최신 AI 코드, CameraFrameController, CameraRepository, 프론트 및 인프라 코드는 변경하지 않았습니다.

실행법, API 규격, 변경 파일: backend/docs/camera-api.md
DB 수동 등록: backend/docs/camera-sample.sql
