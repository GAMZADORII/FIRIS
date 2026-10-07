<!-- AI 서버 - YOLO11 멀티카메라 영상 분석 사용 방법 -->
# YOLO11 멀티카메라 사용 방법

## 1. 영상 폴더 구성

`storage/videos` 아래에 카메라 ID별 폴더를 만들고 영상을 넣습니다.

```text
storage/videos/
├─ CAM001/
│  ├─ 001.mp4
│  └─ 002.mp4
├─ CAM002/
│  └─ 001.mp4
├─ CAM003/
│  └─ 001.mp4
└─ CAM004/
   └─ 001.mp4
```

지원 형식은 `.mp4`, `.avi`, `.mov`, `.mkv`입니다. 각 폴더에서 영상 하나의 분석이 끝나면 다음 영상을 이름순으로 분석합니다. 실행 중 새 영상을 넣어도 자동으로 발견합니다.

## 2. 환경 설정

`ai/.env`에 다음 값을 설정합니다.

```env
BACKEND_URL=http://localhost:8080
AI_API_KEY=백엔드와_동일한_API_KEY
VIDEO_STORAGE_DIR=../storage/videos
LIVE_FRAME_DIR=../storage/live
EVENT_STORAGE_DIR=../storage/events
```

백엔드에는 `CAM001`부터 `CAM004`까지 동일한 카메라 ID가 등록되어 있어야 이벤트를 생성할 수 있습니다.

## 3. AI API 서버 실행

첫 번째 PowerShell에서 실행합니다.

```powershell
cd D:\Firis\FIRIS\ai
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

상태 확인:

```text
http://127.0.0.1:8000/health
```

Swagger UI:

```text
http://127.0.0.1:8000/docs
```

## 4. 멀티카메라 분석 실행

두 번째 PowerShell에서 실행합니다.

```powershell
cd D:\Firis\FIRIS\ai
python -m app.services.multi_camera_service --model yolo --sample-fps 3
```

시연 중 4개 영상 목록을 계속 재생하려면 `--loop`를 추가합니다. Docker Compose의 `ai-worker` 서비스는 이 옵션으로 자동 실행합니다. 반복 재생 중에도 최신 박스 화면은 갱신되지만, 같은 실행에서 이미 처리한 파일의 이벤트는 다시 등록하지 않습니다. worker를 재시작하면 이 기록은 초기화됩니다.

검증된 모델 기본 임계값을 사용하려면 `--threshold`를 생략합니다. 임계값을 직접 지정하려면 다음과 같이 실행합니다.

```powershell
python -m app.services.multi_camera_service --model yolo --sample-fps 3 --threshold 0.4
```

`--threshold 0.9`는 모델의 confidence를 높이지 않으며, confidence가 0.9 미만인 탐지를 숨깁니다.

## 5. 카메라별 바운딩박스 화면 확인

AI 서버는 카메라별 최신 바운딩박스 JPEG를 제공합니다.

```text
GET http://127.0.0.1:8000/cameras/CAM001/frame
GET http://127.0.0.1:8000/cameras/CAM002/frame
GET http://127.0.0.1:8000/cameras/CAM003/frame
GET http://127.0.0.1:8000/cameras/CAM004/frame
```

각 요청에 인증 헤더를 포함합니다.

```http
X-AI-API-Key: ai/.env의 AI_API_KEY 값
```

일반 `<img>` 요청은 인증 헤더를 직접 추가하기 어려우므로 프론트에서는 `fetch()`로 JPEG를 받아 Blob URL로 표시하거나, 백엔드 프록시를 통해 조회합니다.

## 6. 영상 및 이벤트 저장 위치

```text
storage/live/       카메라별 최신 바운딩박스 JPEG
storage/events/     확정 이벤트 스냅샷과 이벤트 영상
```

백엔드에는 미디어 파일 자체가 아니라 이벤트 정보와 원본 저장 경로가 전달됩니다.

이벤트별 UUID 폴더에 `snapshot.jpg`, `event.mp4`, `event_annotated.mp4`, `event.json`이 생성됩니다. 두 MP4는 동일 구간·FPS이며, 박스 영상은 마지막 추론 결과를 프레임 사이에 재사용합니다. Backend 원본 영상 API는 기존대로 유지되며 박스 MP4 조회 연결은 후속 작업입니다.

상대 storage 환경변수는 `ai` 디렉터리 기준입니다. `--root`를 명시하면 작업 디렉터리 기준 경로가 우선합니다. API와 worker를 별도 컨테이너로 실행한다면 동일한 events/live 볼륨을 공유하고 worker에 videos를 읽기 전용 마운트해야 합니다.

## 7. 종료 및 재처리

멀티카메라 실행 창에서 `Ctrl+C`를 눌러 종료합니다. 기본 실행은 한 번 처리한 영상을 같은 실행 중 다시 처리하지 않습니다. `--loop` 실행은 영상 목록을 순서대로 반복합니다.

## 8. 자동 테스트

```powershell
cd D:\Firis\FIRIS\ai
python -m unittest tests.test_multi_camera_service -v
```

카메라 병렬 처리, 순차·새 파일 처리, 입력 경로 우선순위와 실제 MP4의 연속 live 갱신을 검증합니다.
