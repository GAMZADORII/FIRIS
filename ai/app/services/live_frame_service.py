"""Publish the latest annotated JPEG for an authenticated Dashboard poll."""

from __future__ import annotations

import os
import re
import time
from pathlib import Path

import cv2


AI_ROOT = Path(__file__).resolve().parents[2]
PROJECT_ROOT = AI_ROOT.parent
CAMERA_ID = re.compile(r"^[A-Za-z0-9_-]{1,30}$")


def live_frame_dir() -> Path:
    configured = os.getenv("LIVE_FRAME_DIR")
    path = Path(configured) if configured else PROJECT_ROOT / "storage" / "live"
    return (path if path.is_absolute() else AI_ROOT / path).resolve()


def frame_path(camera_id: str) -> Path:
    if not CAMERA_ID.fullmatch(camera_id):
        raise ValueError("invalid cameraId")
    return live_frame_dir() / f"{camera_id}.jpg"


def annotate(frame, detection: dict):
    annotated = frame.copy()
    height, width = annotated.shape[:2]
    for box in detection.get("boxes", []):
        if box.get("label") not in ("fire", "smoke") or len(box.get("xyxy", [])) != 4:
            continue
        x1, y1, x2, y2 = [int(v) for v in box["xyxy"]]
        x1, x2 = sorted((max(0, min(width - 1, x1)), max(0, min(width - 1, x2))))
        y1, y2 = sorted((max(0, min(height - 1, y1)), max(0, min(height - 1, y2))))
        if x1 == x2 or y1 == y2:
            continue
        color = (0, 0, 255) if box["label"] == "fire" else (0, 180, 255)
        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
        label = f"{box['label'].upper()} {float(box.get('confidence', 0)):.2f}"
        cv2.putText(annotated, label, (x1, max(15, y1 - 5)), cv2.FONT_HERSHEY_SIMPLEX,
                    0.5, color, 2, cv2.LINE_AA)
    return annotated


class LiveFramePublisher:
    def publish(self, camera_id: str, frame, detection: dict) -> None:
        success, jpeg = cv2.imencode(".jpg", annotate(frame, detection),
                                    [cv2.IMWRITE_JPEG_QUALITY, 85])
        if not success:
            raise RuntimeError("Failed to encode live frame")
        self.publish_encoded(camera_id, jpeg.tobytes())

    def publish_encoded(self, camera_id: str, jpeg: bytes) -> None:
        path = frame_path(camera_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(".jpg.tmp")
        temporary.write_bytes(jpeg)
        temporary.replace(path)


def read_latest_frame(camera_id: str, max_age_seconds: float = 5.0) -> bytes:
    path = frame_path(camera_id)
    try:
        stat = path.stat()
        if time.time() - stat.st_mtime > max_age_seconds:
            raise TimeoutError("live frame is stale")
        return path.read_bytes()
    except FileNotFoundError:
        raise FileNotFoundError("live frame unavailable") from None
