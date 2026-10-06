# AI ↔ Backend 연동 상태와 현장 검증

## 현재 구현

Dashboard 박스 표시 계약: AI 영상 처리기는 추론한 프레임에 FIRE/SMOKE 박스와 신뢰도를 그려 카메라별 최신 JPEG으로 발행한다. AI `GET /cameras/{cameraId}/frame`은 `X-AI-API-KEY`가 필요하며 최신 프레임이 없거나 오래되면 404/503을 반환한다. Backend `GET /api/cameras/{cameraId}/frame`은 사용자 JWT(ADMIN/WORKER)를 확인하고 등록 카메라에 한해 AI JPEG을 프록시한다. 프론트는 이 URL을 JWT 헤더로 주기적으로 요청해 이미지 Blob을 표시하면 된다. 모델 추론 주기만큼(기본 최대 5fps) 갱신되며, 분류 모델은 박스가 없다. 저장 이벤트 Snapshot/MP4는 원본 영상이다. 파일 입력을 시연할 때는 `--realtime`으로 실제 FPS에 맞춰 재생한다. 영상 처리 프로세스와 AI API 서버는 같은 `LIVE_FRAME_DIR`을 공유해야 한다.

`ai/app/services/video_service.py`를 카메라별 프로세스로 실행한다. 영상 프레임은 JPEG 압축 버퍼에 보관하고 초당 최대 5회 추론한다. 기본 시간 창 2초에서 10개 샘플 중 7개 이상이 같은 FIRE/SMOKE를 탐지하면 위험을 확정한다. 추론이 약간 느려지면 실제 창 안에 모인 결과의 70%를 사용하되 예상 10개 중 최소 6개는 필요하다(예: 9개 중 7개). Bounding Box가 있는 모델은 같은 영역(IoU 0.2 이상)의 탐지를 세고, 분류 모델은 클래스 탐지 수만 센다. 한 위험 장면에 이벤트를 반복 생성하지 않도록 확정 후 잠그고, 2초간 탐지가 사라진 후 다시 허용한다.

확정 시 AI 로컬 ID로 Snapshot을 저장하고, `X-AI-API-KEY`로 `POST /api/ai/events`를 호출한다. 성공 응답의 Backend `eventId`를 곧바로 `event.json`에 기록한다. 그 후 기본 5초간 프레임을 더 모아 MP4를 기록하고 `PATCH /api/ai/events/{eventId}/media`를 호출한다. 영상 파일이나 이미지 파일은 Backend 요청에 싣지 않고 경로만 보낸다. 파일명은 Backend eventId를 선행해서 사용하지 않는다.

## 실행 전 조건

- Backend MySQL에 `cameraId`가 등록되어 있고, Backend가 정상 실행 중이어야 한다.
- AI `.env`의 `BACKEND_URL`/`AI_API_KEY`가 실제 Backend와 일치해야 한다. 로컬 파일 경로는 `.env.example`을 따른다.
- Git LFS 실제 모델 가중치를 받아야 한다. 포인터만 있는 경우 추론할 수 없다.
- AI와 Backend가 같은 이벤트 저장소를 볼 수 있어야 한다. Backend는 JWT가 필요한 `/api/events/{eventId}/snapshot` 및 `/video`로 저장된 파일을 제공한다. Docker에서는 이벤트 저장소를 Backend에 읽기 전용으로 마운트한다.
- Docker 이미지에는 모델 파일이나 이벤트 저장소를 넣지 않는다. 컨테이너 실행 시 둘을 볼륨으로 연결해야 한다.

## 검증 범위와 실패 동작

AI 단위 테스트는 모델을 가짜 탐지기로, Backend를 가짜 응답으로 대체해 시간 창, 중복 방지, 요청 순서, 요청 실패를 검증한다. 로컬 AVI·실제 YOLO·MySQL·HTTP 통합 경로는 수동 검증했다. 모델 정확도, CCTV RTSP, 브라우저 미디어 재생은 별도 검증 대상이다.

2026-10-02 로컬 AVI 파일로 YOLO → Backend 이벤트 생성/미디어 갱신 → MySQL 저장을 확인했다. 최신 박스 JPEG을 AI/Backend 인증 API로 읽는 것도 확인했다. 프론트 화면 표시, 실제 RTSP 및 모델 정확도는 아직 검증하지 않았다. 제공된 영상에서는 불꽃 장면에서 FIRE 대신 SMOKE 탐지와 사람 주변 SMOKE 오탐이 관찰됐다. 모델 임계값·학습 데이터 검토가 필요하다.

POST가 실패하면 영상 처리 명령은 오류를 내고 중단한다. 자동 재전송은 중복 이벤트를 만들 수 있어 넣지 않았다. Snapshot은 AI 저장소에 남으므로 실패 처리 정책이 필요하다. PATCH 실패 시 MP4와 Backend eventId가 `event.json`에 남지만 Backend video_path는 비어 있다. 운영 재시도·복구 절차는 합의가 필요하다. 영상 파일이 조기 종료되면 확보된 후속 프레임만으로 MP4를 만들고 실제 수집 길이를 전송한다.

## AI 담당자와 함께 조정할 값

1. **시간 창/탐지 비율:** 현재 2초·5회/초·7/10은 2026-10-01 발표자료의 추가 지연 3초 이내 목표를 시험할 시작값이다. 실제 CCTV에서 시간당 오탐, 놓친 이벤트, 감지 지연을 비교해 확정한다.
2. **동일 영역 기준:** Bounding Box IoU 0.2는 임시값이다. 먼 거리의 작은 연기와 움직이는 연기에 맞는지 확인한다.
3. **재무장/이벤트 중복:** 2초간 탐지가 사라지면 새 이벤트를 허용한다. 같은 화재에서 중복 이벤트가 생기는지 검증한다.
4. **영상 FPS와 길이:** 기본 이전/이후 5초, 카메라가 보고하는 FPS를 사용한다. RTSP 지연·프레임 누락 때 영상 속도와 preSeconds/postSeconds가 실제 길이에 맞는지 확인한다.
5. **모델 및 Confidence:** 기본 YOLO 사용, FIRE/SMOKE/FIRE_SMOKE 분류와 Confidence 계산, 모델별 threshold를 실제 영상으로 확인한다. MobileNet 계열 사용 결정과 최종 YOLO 선택은 팀 설계 문서에서 정리한다.
6. **운영 복구:** POST 응답 유실, PATCH 실패, 저장소 부족, RTSP 끊김 때 중복 없이 복구하는 방식을 정한다. 브라우저에서 Snapshot/MP4를 읽을 경로/URL도 확정한다.
