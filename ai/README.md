# FIRIS AI
FastAPI health check 초기 프로젝트. Python 3.11 이상을 사용한다.
OpenCV는 서버용 headless 패키지를 사용한다. PyTorch/TensorFlow와 MobileNet 추론은 향후 도입한다.

프로젝트 루트에서:
```bash
cd ai
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
Windows PowerShell에서는 가상환경 활성화에 `.venv\Scripts\Activate.ps1`을 사용한다.
`curl http://localhost:8000/health` → `{"status":"ok"}`.

`.env.example`은 BACKEND_URL, AI_API_KEY, MODEL_PATH 예약 항목이다.
현재 health check는 환경변수를 읽지 않으며 `.env` 없이 실행된다.
`model/`은 모델 weight, `storage/events/`는 이벤트 파일 저장용이며 `.gitkeep` 외 데이터는 Git에서 제외된다.
`app/api`, `services`, `models`, `utils`는 향후 역할별 구현 위치이다.
개발 전 [PROJECT_CONTEXT](../docs/PROJECT_CONTEXT.md)와 요구사항·아키텍처·ERD·API 명세를 확인한다. 설계 변경은 팀 합의 → 문서 → 코드 순서를 따른다.
