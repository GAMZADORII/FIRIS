# AI 이벤트 서비스 - 확정 이벤트 JPG 스냅샷 및 MP4 영상 저장
from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from uuid import uuid4

import cv2
import numpy as np


AI_ROOT = Path(__file__).resolve().parents[2]
PROJECT_ROOT = AI_ROOT.parent


def event_storage_dir() -> Path:
    configured = os.getenv("EVENT_STORAGE_DIR")
    path = Path(configured) if configured else PROJECT_ROOT / "storage" / "events"
    return (path if path.is_absolute() else AI_ROOT / path).resolve()


class EventStorage:
    def __init__(self, root: Path | None = None):
        self.root = Path(root).resolve() if root is not None else event_storage_dir()
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
            "annotated_video": None,
            "detection": detection,
        }
        self.save_metadata(metadata)
        return metadata

    def save_metadata(self, metadata: dict) -> None:
        event_dir = Path(metadata["snapshot"]).parent
        temporary = event_dir / "event.json.tmp"
        temporary.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(event_dir / "event.json")

    def write_video(self, metadata: dict, frames: list[bytes], fps: float,
                    annotated_frames: list[bytes] | None = None) -> dict:
        if not frames or fps <= 0:
            raise ValueError("Video needs frames and a positive FPS")
        if annotated_frames is not None and len(annotated_frames) != len(frames):
            raise ValueError("Original and annotated videos must have matching frame counts")
        event_dir = Path(metadata["snapshot"]).parent
        video = event_dir / "event.mp4"
        self._write_mp4(video, frames, fps)
        metadata["video"] = str(video)
        if annotated_frames is not None:
            annotated_video = event_dir / "event_annotated.mp4"
            self._write_mp4(annotated_video, annotated_frames, fps)
            metadata["annotated_video"] = str(annotated_video)
        self.save_metadata(metadata)
        return metadata

    @staticmethod
    def _write_mp4(video: Path, frames: list[bytes], fps: float) -> None:
        first = cv2.imdecode(np.frombuffer(frames[0], dtype=np.uint8), cv2.IMREAD_COLOR)
        if first is None:
            raise ValueError("Buffered video frame is not a valid JPEG")
        height, width = first.shape[:2]
        temporary = video.with_name(video.stem + ".tmp.mp4")
        command = [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "rawvideo", "-pixel_format", "bgr24", "-video_size", f"{width}x{height}",
            "-framerate", str(fps), "-i", "pipe:0", "-an", "-c:v", "libx264",
            "-preset", "ultrafast", "-crf", "28",
            "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart", str(temporary),
        ]
        try:
            encoder = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL,
                                       stderr=subprocess.PIPE)
        except OSError as error:
            raise RuntimeError("FFmpeg H.264 encoder is unavailable") from error
        try:
            try:
                for packed_frame in frames:
                    buffered_frame = cv2.imdecode(np.frombuffer(packed_frame, dtype=np.uint8), cv2.IMREAD_COLOR)
                    if buffered_frame is None or buffered_frame.shape[:2] != (height, width):
                        raise ValueError("Buffered video frames must have one valid image size")
                    encoder.stdin.write(buffered_frame.tobytes())
            finally:
                encoder.stdin.close()
            error_output = encoder.stderr.read()
            if encoder.wait() != 0:
                raise RuntimeError(f"Failed to encode H.264 event video: {error_output.decode(errors='replace')[:300]}")
            temporary.replace(video)
        except Exception:
            if encoder.poll() is None:
                encoder.terminate()
                encoder.wait()
            temporary.unlink(missing_ok=True)
            raise
        finally:
            encoder.stderr.close()
