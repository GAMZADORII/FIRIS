"""Run one analysis worker per camera, each cycling through its own video folder."""

from __future__ import annotations

import argparse
import logging
import signal
import threading
from pathlib import Path
from typing import Callable

from dotenv import load_dotenv

from app.services.backend_client import BackendEventClient
from app.services.live_frame_service import CAMERA_ID
from app.services.video_service import process_video

VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv"}
MAX_CAMERAS = 4
EMPTY_FOLDER_DELAY = 5.0
ERROR_DELAY = 2.0

log = logging.getLogger("camera")


class SharedDetector:
    """Lets every camera share one loaded model; inference runs one call at a time."""

    def __init__(self, predict: Callable):
        self._predict = predict
        self._lock = threading.Lock()

    def __call__(self, image_bytes: bytes, model: str, threshold: float | None) -> dict:
        with self._lock:
            return self._predict(image_bytes, model, threshold)


def run_camera(camera_id: str, folder: Path, stop: threading.Event, **options) -> None:
    # The folder is rescanned every round, so new files are picked up without a restart.
    processed: set[Path] = set()
    while not stop.is_set():
        try:
            videos = sorted(
                p for p in folder.iterdir()
                if p.is_file() and p.suffix.lower() in VIDEO_EXTENSIONS and p not in processed
            )
        except OSError:
            log.exception("%s: cannot read %s", camera_id, folder)
            videos = []
        if not videos:
            stop.wait(EMPTY_FOLDER_DELAY)
            continue
        for video in videos:
            if stop.is_set():
                return
            log.info("%s -> %s", camera_id, video.name)
            try:
                process_video(str(video), camera_id, realtime=True, stop=stop, **options)
                processed.add(video)
            except Exception:
                # A broken file or a backend hiccup skips this video, not the whole camera.
                log.exception("%s: failed on %s, moving on", camera_id, video.name)
                stop.wait(ERROR_DELAY)


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyze several video folders as parallel cameras")
    parser.add_argument("--root", default="videos", help="folder with one subfolder per camera id")
    parser.add_argument("--model", default="yolo")
    parser.add_argument("--sample-fps", type=float, default=3.0)
    parser.add_argument("--threshold", type=float, default=None,
                        help="detection confidence cutoff (for example 0.9); default uses model thresholds")
    args = parser.parse_args()

    if args.threshold is not None and not 0 <= args.threshold <= 1:
        parser.error("--threshold must be between 0 and 1")

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(threadName)s] %(message)s")
    load_dotenv(Path(__file__).resolve().parents[2] / ".env")

    root = Path(args.root)
    folders = sorted(p for p in root.iterdir() if p.is_dir()) if root.is_dir() else []
    invalid = [p.name for p in folders if not CAMERA_ID.fullmatch(p.name)]
    if not folders or invalid or len(folders) > MAX_CAMERAS:
        parser.error(
            f"{root} needs 1-{MAX_CAMERAS} subfolders named with valid camera ids "
            f"(found: {len(folders)}, invalid: {invalid})"
        )

    from app.models import predict  # heavy import, only needed when actually running

    options = {
        "model": args.model,
        "sample_fps": args.sample_fps,
        "threshold": args.threshold,
        "detector": SharedDetector(predict),
        "client": BackendEventClient(),
    }
    stop = threading.Event()
    for sig in (signal.SIGINT, signal.SIGTERM):
        signal.signal(sig, lambda *_: stop.set())

    workers = [threading.Thread(target=run_camera, name=f.name, args=(f.name, f, stop), kwargs=options)
               for f in folders]
    for worker in workers:
        worker.start()
    while any(w.is_alive() for w in workers):
        for worker in workers:
            worker.join(timeout=0.5)


if __name__ == "__main__":
    main()
