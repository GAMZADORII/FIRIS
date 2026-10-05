<!-- AI 서버 - YOLO11 멀티카메라 영상 분석 사용 방법 -->
# YOLO11 멀티카메라 사용 방법

## 1. 영상 폴더 구성

`ai/videos` 아래에 카메라 ID별 폴더를 만들고 영상을 넣습니다.

```text
ai/videos/
├─ camera-1/
│  ├─ 01.mp4
│  └─ 02.mp4
├─ camera-2/
│  └─ 01.mp4
├─ camera-3/
│  └─ 01.mp4
└─ camera-4/
   └─ 01.mp4
```

지원 형식은 `.mp4`, `.avi`, `.mov`, `.mkv`입니다. 각 폴더에서 영상 하나의 분석이 끝나면 다음 영상을 이름순으로 분석합니다. 실행 중 새 영상을 넣어도 자동으로 발견합니다.

## 2. 환경 설정

`ai/.env`에 다음 값을 설정합니다.

```env
BACKEND_URL=http://localhost:8080
AI_API_KEY=백엔드와_동일한_API_KEY
LIVE_FRAME_DIR=D:/Firis/FIRIS/ai/storage/live
EVENT_STORAGE_DIR=D:/Firis/FIRIS/ai/storage/events
```

백엔드에는 `camera-1`부터 `camera-4`까지 동일한 카메라 ID가 등록되어 있어야 이벤트를 생성할 수 있습니다.

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
python -m app.services.multi_camera_service --root videos --model yolo --sample-fps 3
```

검증된 모델 기본 임계값을 사용하려면 `--threshold`를 생략합니다. 임계값을 직접 지정하려면 다음과 같이 실행합니다.

```powershell
python -m app.services.multi_camera_service --root videos --model yolo --sample-fps 3 --threshold 0.4
```

`--threshold 0.9`는 모델의 confidence를 높이지 않으며, confidence가 0.9 미만인 탐지를 숨깁니다.

## 5. 카메라별 바운딩박스 화면 확인

AI 서버는 카메라별 최신 바운딩박스 JPEG를 제공합니다.

```text
GET http://127.0.0.1:8000/cameras/camera-1/frame
GET http://127.0.0.1:8000/cameras/camera-2/frame
GET http://127.0.0.1:8000/cameras/camera-3/frame
GET http://127.0.0.1:8000/cameras/camera-4/frame
```

각 요청에 인증 헤더를 포함합니다.

```http
X-AI-API-Key: ai/.env의 AI_API_KEY 값
```

일반 `<img>` 요청은 인증 헤더를 직접 추가하기 어려우므로 프론트에서는 `fetch()`로 JPEG를 받아 Blob URL로 표시하거나, 백엔드 프록시를 통해 조회합니다.

## 6. 영상 및 이벤트 저장 위치

```text
ai/storage/live/       카메라별 최신 바운딩박스 JPEG
ai/storage/events/     확정 이벤트 스냅샷과 이벤트 영상
```

백엔드에는 미디어 파일 자체가 아니라 이벤트 정보와 저장 경로가 전달됩니다.

## 7. 종료 및 재처리

멀티카메라 실행 창에서 `Ctrl+C`를 눌러 종료합니다. 한 번 처리한 영상은 같은 실행 중에는 다시 처리하지 않습니다. 동일 영상을 다시 처리하려면 프로세스를 재시작합니다.

## 8. 자동 테스트

```powershell
cd D:\Firis\FIRIS\ai
python -m unittest tests.test_multi_camera_service -v
```

정상 결과는 `Ran 2 tests`와 `OK`입니다.
