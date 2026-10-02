"""Analyze one video source, confirm persistent danger, then notify Backend."""

from __future__ import annotations

import argparse
import time
from collections import deque
from datetime import datetime
from math import ceil
from pathlib import Path
from typing import TYPE_CHECKING
from zoneinfo import ZoneInfo

import cv2
from dotenv import load_dotenv

from app.services.backend_client import BackendEventClient
from app.services.live_frame_service import LiveFramePublisher, frame_path
from app.services.temporal_service import TemporalValidator

if TYPE_CHECKING:
    from app.services.event_service import EventStorage


def process_video(source: str | int, camera_id: str, model: str = "yolo",
                  threshold: float | None = None, buffer_seconds: int = 5,
                  post_seconds: int = 5, sample_fps: float = 5.0,
                  window_seconds: float = 2.0, required_ratio: float = 0.7,
                  client: BackendEventClient | None = None,
                  storage: EventStorage | None = None,
                  detector=None, publisher: LiveFramePublisher | None = None,
                  realtime: bool = False) -> list[dict]:
    if not camera_id or buffer_seconds < 0 or post_seconds < 0:
        raise ValueError("camera_id is required and buffer durations must be nonnegative")
    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
    client = client or BackendEventClient()
    if storage is None:
        from app.services.event_service import EventStorage
        storage = EventStorage()
    if detector is None:
        from app.models import predict
        detector = predict
    publisher = publisher or LiveFramePublisher()
    capture = cv2.VideoCapture(source)
    if not capture.isOpened():
        raise RuntimeError(f"Cannot open video source: {source}")

    fps = capture.get(cv2.CAP_PROP_FPS)
    fps = fps if 1 <= fps <= 120 else 20.0
    effective_sample_fps = min(sample_fps, fps)
    validator = TemporalValidator(window_seconds, effective_sample_fps, required_ratio)
    pre_frames = deque(maxlen=max(1, ceil(fps * buffer_seconds)))
    live = isinstance(source, int) or str(source).startswith(("rtsp://", "http://", "https://"))
    started = time.monotonic()
    next_sample_at = 0.0
    frame_index = 0
    pending = None
    events = []

    def finish_event() -> None:
        nonlocal pending
        if pending is None:
            return
        metadata = storage.write_video(pending["metadata"], pending["frames"], fps)
        actual_post = round(max(0.0, pending["last_timestamp"] - pending["timestamp"]))
        client.update_media(pending["backend_id"], metadata["video"], pending["pre_seconds"], actual_post)
        events.append(metadata)
        pending = None

    try:
        while True:
            ok, frame = capture.read()
            if not ok:
                break
            timestamp = time.monotonic() - started if live else frame_index / fps
            if realtime and not live:
                delay = timestamp - (time.monotonic() - started)
                if delay > 0:
                    time.sleep(delay)
            frame_index += 1
            encoded, jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            if not encoded:
                continue
            packed_frame = jpeg.tobytes()
            pre_frames.append(packed_frame)

            if pending is not None:
                pending["frames"].append(packed_frame)
                pending["last_timestamp"] = timestamp
                if timestamp - pending["timestamp"] >= post_seconds:
                    finish_event()

            if timestamp + 1e-9 < next_sample_at:
                continue
            next_sample_at = timestamp + 1 / effective_sample_fps
            result = detector(packed_frame, model, threshold)
            publisher.publish(camera_id, frame, result)
            confirmation = validator.observe(timestamp, result)
            if confirmation is None or pending is not None:
                continue

            metadata = storage.save_snapshot(frame, result)
            detected_at = datetime.now(ZoneInfo("Asia/Seoul")).replace(tzinfo=None).isoformat(timespec="seconds")
            backend_id = client.create_event({
                "cameraId": camera_id,
                "eventType": confirmation.event_type,
                "confidence": confirmation.confidence,
                "detectedAt": detected_at,
                "snapshotPath": metadata["snapshot"],
                "modelVersion": model,
            })
            metadata["backend_event_id"] = backend_id
            metadata["camera_id"] = camera_id
            storage.save_metadata(metadata)
            pending = {
                "metadata": metadata,
                "backend_id": backend_id,
                "timestamp": timestamp,
                "last_timestamp": timestamp,
                "pre_seconds": round(max(0.0, (len(pre_frames) - 1) / fps)),
                "frames": list(pre_frames),
            }
            if post_seconds == 0:
                finish_event()
        finish_event()  # A finite input may end before the requested post-event duration.
    finally:
        capture.release()
    return events


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Analyze a camera or video and submit confirmed events")
    parser.add_argument("--source", required=True, help="video file, RTSP URL, or camera device number")
    parser.add_argument("--camera-id", required=True, help="ID already registered in Backend CAMERA")
    parser.add_argument("--model", default="yolo")
    parser.add_argument("--realtime", action="store_true", help="pace a video file at its recorded FPS")
    args = parser.parse_args()
    source = int(args.source) if args.source.isdecimal() else args.source
    process_video(source, args.camera_id, model=args.model, realtime=args.realtime)
