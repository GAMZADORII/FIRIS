# AI 서버 진입점 - 상태 확인, 추론 및 확정 이벤트 스냅샷 API
import json
from pathlib import Path

import cv2
import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, Header, HTTPException, Response, UploadFile
from PIL import UnidentifiedImageError

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from app.models import AVAILABLE_MODELS, model_status, predict
from app.services.event_service import EventStorage
from app.services.live_frame_service import read_latest_frame
import os
import secrets


app = FastAPI(title="Fire and Smoke AI", version="1.0.0")


@app.get("/health")
def health():
    models = model_status()
    return {"status": "ok" if all(models.values()) else "degraded", "models": models}


@app.get("/cameras/{camera_id}/frame")
def latest_camera_frame(camera_id: str, x_ai_api_key: str | None = Header(None)):
    expected = os.getenv("AI_API_KEY", "")
    if not expected or not x_ai_api_key or not secrets.compare_digest(expected, x_ai_api_key):
        raise HTTPException(status_code=401, detail="AI authentication required")
    try:
        frame = read_latest_frame(camera_id)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except TimeoutError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    return Response(frame, media_type="image/jpeg", headers={"Cache-Control": "no-store"})


@app.post("/predict")
async def predict_image(
    image: UploadFile = File(...),
    model: str = Form("yolo"),
    threshold: float | None = Form(None),
):
    if model not in AVAILABLE_MODELS:
        raise HTTPException(status_code=400, detail=f"model must be one of {sorted(AVAILABLE_MODELS)}")
    if threshold is not None and not 0 <= threshold <= 1:
        raise HTTPException(status_code=400, detail="threshold must be between 0 and 1")
    payload = await image.read()
    if not payload:
        raise HTTPException(status_code=400, detail="empty image")
    try:
        return {"filename": image.filename, **predict(payload, model, threshold)}
    except (UnidentifiedImageError, OSError) as error:
        raise HTTPException(status_code=400, detail="upload a JPG or PNG image") from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@app.post("/events/confirm")
async def confirm_event_snapshot(
    image: UploadFile = File(...),
    detection: str = Form("{}"),
):
    payload = await image.read()
    frame = cv2.imdecode(np.frombuffer(payload, dtype=np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="upload a JPG or PNG image")
    try:
        detection_data = json.loads(detection)
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=400, detail="detection must be valid JSON") from error
    if not isinstance(detection_data, dict):
        raise HTTPException(status_code=400, detail="detection must be a JSON object")
    return EventStorage().save_snapshot(frame, detection_data)
