# AI 이벤트 서비스 - 확정 이벤트 JPG 스냅샷 및 MP4 영상 저장
from __future__ import annotations

import json
import os
from pathlib import Path
from uuid import uuid4

import cv2
import numpy as np


PROJECT_ROOT = Path(__file__).resolve().parents[2]
EVENT_STORAGE = Path(os.getenv("EVENT_STORAGE_DIR") or PROJECT_ROOT / "storage" / "events").resolve()


class EventStorage:
    def __init__(self, root: Path = EVENT_STORAGE):
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)

    def save_snapshot(self, frame, detection: dict) -> dict:
        event_id = uuid4().hex
        event_dir = self.root / event_id
        event_dir.mkdir(parents=True, exist_ok=False)
        snapshot = event_dir / "snapshot.jpg"
        if not cv2.imwrite(str(snapshot), frame):
            raise RuntimeError("Failed to save event snapshot")
        metadata = {
            "event_id": event_id,
            "snapshot": str(snapshot),
            "video": None,
            "detection": detection,
        }
        self.save_metadata(metadata)
        return metadata

    def save_metadata(self, metadata: dict) -> None:
        event_dir = Path(metadata["snapshot"]).parent
        temporary = event_dir / "event.json.tmp"
        temporary.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(event_dir / "event.json")

    def write_video(self, metadata: dict, frames: list[bytes], fps: float) -> dict:
        if not frames or fps <= 0:
            raise ValueError("Video needs frames and a positive FPS")
        event_dir = Path(metadata["snapshot"]).parent
        video = event_dir / "event.mp4"
        first = cv2.imdecode(np.frombuffer(frames[0], dtype=np.uint8), cv2.IMREAD_COLOR)
        if first is None:
            raise ValueError("Buffered video frame is not a valid JPEG")
        height, width = first.shape[:2]
        writer = cv2.VideoWriter(str(video), cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height))
        if not writer.isOpened():
            raise RuntimeError("Failed to open event video")
        try:
            for packed_frame in frames:
                buffered_frame = cv2.imdecode(np.frombuffer(packed_frame, dtype=np.uint8), cv2.IMREAD_COLOR)
                if buffered_frame is None or buffered_frame.shape[:2] != (height, width):
                    raise ValueError("Buffered video frames must have one valid image size")
                writer.write(buffered_frame)
        finally:
            writer.release()
        metadata["video"] = str(video)
        self.save_metadata(metadata)
        return metadata
