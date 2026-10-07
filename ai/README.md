
## 로컬 실행

`ai/.env.example`을 `ai/.env`로 복사하고 Backend와 동일한 AI_API_KEY를 입력합니다. 실제 키는 커밋하지 않습니다. 모델은 Git LFS 실제 파일이어야 합니다.

```powershell
cd ai
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

별도 터미널에서 카메라 폴더 분석을 시작합니다.

```powershell
cd ai
python -m app.services.multi_camera_service --model yolo --sample-fps 3
```

FastAPI 실행만으로 영상 분석은 시작되지 않습니다. Backend·AI API·분석 worker를 함께 실행해야 합니다.

## 입력·저장 경로

- 입력 우선순위: `--root` → `VIDEO_STORAGE_DIR` → 프로젝트 최상위 `storage/videos`
- `--root` 상대경로는 현재 작업 디렉터리 기준입니다.
- `VIDEO_STORAGE_DIR`, `EVENT_STORAGE_DIR`, `LIVE_FRAME_DIR`의 상대경로는 `ai` 디렉터리 기준입니다.
- events/live 환경변수를 비우면 프로젝트 최상위 `storage/events`, `storage/live`를 사용합니다.
- `AI_MODELS_DIR=./model`은 기존 모델 코드대로 작업 디렉터리 기준이므로 로컬 명령은 `ai`에서 실행합니다.
- Backend의 EVENT_STORAGE_DIR도 AI와 같은 실제 저장소를 가리켜야 합니다. Docker에서는 양쪽 컨테이너 경로도 동일하게 맞춥니다.

원본 영상은 직접 `storage/videos/CAM001/001.mp4` 등에 넣습니다. 폴더명이 Backend에 등록된 cameraId입니다. 카메라 최대 4대, 카메라별 파일명 순서, 처리 완료 중복 방지·새 파일 탐색·SharedDetector를 유지합니다. 추론 호출은 공유 Lock으로 직렬화됩니다.

## 이벤트 저장

```text
storage/events/{UUID}/
├─ snapshot.jpg          원본 스냅샷
├─ event.mp4             원본 프레임 이벤트 영상
├─ event_annotated.mp4   박스·라벨·confidence 이벤트 영상
└─ event.json            snapshot/video/annotated_video 및 탐지 정보
```

시간 기반 판정이 확정되면 스냅샷 저장 → Backend POST → 후속 프레임 수집 → 두 MP4 저장 → 기존 PATCH 순서로 동작합니다. 기본 전 약 5초 + 후 약 5초이며 영상 시작·끝 또는 정상 종료 시 짧아질 수 있습니다. 디코딩된 프레임을 JPEG 버퍼 후 MP4로 재인코딩하므로 원본 파일의 무손실 복사나 오디오 보존은 아닙니다.

두 MP4의 프레임 수·FPS는 같습니다. 추론 사이 프레임은 마지막 추론의 박스를 재사용하고, 다음 추론에서 박스가 없으면 지웁니다. 추가 추론은 없습니다. 두 JPEG 버퍼와 MP4 인코딩으로 CPU·메모리·디스크 사용량은 늘어납니다.

Backend에는 기존 `event.mp4` 경로만 PATCH합니다. `annotated_video`는 event.json에 기록하며, 박스 영상용 DB/API/Frontend 조회 연결은 후속 작업입니다. 이벤트별 UUID는 Backend 숫자 eventId와 다릅니다.

## 라이브 화면과 단일 영상

`storage/live/CAM001.jpg`는 최신 박스 JPEG 한 장을 덮어씁니다. AI API와 분석 worker가 같은 LIVE_FRAME_DIR을 사용해야 합니다. Backend는 AI HTTP API를 프록시하므로 live 파일 마운트가 필요하지 않습니다. 이벤트 원본 조회는 사용자 JWT가 필요한 Backend snapshot/video API를 사용합니다.

```powershell
python -m app.services.video_service --source ../storage/videos/CAM001/001.mp4 --camera-id CAM001 --realtime
python -m app.services.video_service --source rtsp://camera/stream --camera-id CAM001
```

FastAPI `/predict`는 단일 이미지 추론, `/events/confirm`은 수동 스냅샷 저장입니다. `/health`는 실제 영상 성능이나 전체 연동 성공을 보장하지 않습니다.

## 검증과 남은 제약

```powershell
python -m unittest tests.test_event_storage tests.test_video_service tests.test_multi_camera_service -v
```

정상 재시작하면 같은 원본을 다시 분석합니다. 영상 경계에서 버퍼·시간 판정 상태는 초기화됩니다. Backend POST/PATCH 실패 복구, 처리 이력 영속화, 저장 기간·디스크 정리, mp4v 브라우저 재생 검증은 별도 작업입니다.
