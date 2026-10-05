# FIRIS AI 서버

Python 3.11 이상. FastAPI `/predict`는 단일 이미지 추론용이며 `/events/confirm`은 수동 스냅샷 저장용이다. CCTV/영상 파일에서 지속 탐지 및 Backend 연동은 별도 영상 처리 명령으로 실행한다.

```bash
cd ai
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

설정은 `.env.example`을 `.env`로 복사해 입력한다. `BACKEND_URL`은 Backend 주소, `AI_API_KEY`는 Backend와 동일한 AI API Key이다. `AI_MODELS_DIR`과 `EVENT_STORAGE_DIR`은 비우면 각각 `ai/model`, `ai/storage/events`를 사용한다. 실제 모델 파일은 Git LFS로 받아야 한다. `/health`는 모델 파일의 존재와 Git LFS 포인터 여부만 확인하며 실제 추론 성공을 보장하지 않는다.

영상 처리 예:

```bash
python -m app.services.video_service --source ./sample.mp4 --camera-id camera-1
python -m app.services.video_service --source ./sample.mp4 --camera-id camera-1 --realtime
python -m app.services.video_service --source 'rtsp://camera/stream' --camera-id camera-1
```

`camera-1`은 Backend `CAMERA`에 미리 등록되어 있어야 한다. 기본 모델은 `yolo`이며 `--model mobilenet_v2` 등으로 바꿀 수 있다. Backend와 저장 파일을 함께 사용하려면 `EVENT_STORAGE_DIR`을 양쪽 서비스에서 접근 가능한 공유 저장소로 설정해야 한다. 현재 Backend는 파일 경로만 저장하며 미디어 파일 제공 API는 없다.

Dashboard용 최신 프레임은 YOLO 박스를 그린 JPEG이다. AI 서버와 영상 처리 명령을 동시에 실행하고 같은 `LIVE_FRAME_DIR`(기본 `ai/storage/live`)을 사용한다. AI `GET /cameras/{cameraId}/frame`은 `X-AI-API-KEY`가 필요하다. Backend `GET /api/cameras/{cameraId}/frame`은 사용자 JWT로 접근하며, 프론트는 응답 JPEG을 약 200~500ms 간격으로 갱신할 수 있다. 파일 영상 시연에는 `--realtime`을 사용한다. 원본 이벤트 MP4/스냅샷에는 박스를 그리지 않는다.

기본 판정은 초당 5회 추론, 최근 2초의 10회 중 7회 이상 같은 FIRE/SMOKE 탐지이다. 확정 직후 스냅샷 경로로 Backend 이벤트를 생성하고, 기본 5초의 후속 프레임을 수집해 MP4를 저장한 뒤 미디어 경로를 갱신한다. 상세와 현장 검증 항목은 [AI 연동 안내](../docs/AI_INTEGRATION.md)를 참고한다.

```bash
python -m unittest discover -s tests -v
```

Windows PowerShell에서는 `.venv\Scripts\Activate.ps1`로 가상환경을 활성화한다. 학습 코드는 `training/`, 실행 모델은 `model/`, 이벤트 저장 파일은 `storage/events/`에 둔다.
