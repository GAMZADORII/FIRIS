"""Analyze one video source, confirm persistent danger, then notify Backend."""

from __future__ import annotations

import argparse
import logging
import time
from collections import deque
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from math import ceil
from pathlib import Path
from typing import TYPE_CHECKING
from zoneinfo import ZoneInfo

import cv2
from dotenv import load_dotenv

from app.services.backend_client import BackendEventClient
from app.services.live_frame_service import LiveFramePublisher, annotate
from app.services.temporal_service import TemporalValidator

if TYPE_CHECKING:
    import threading

    from app.services.event_service import EventStorage

log = logging.getLogger("camera.events")


def process_video(source: str | int, camera_id: str, model: str = "yolo",
                  threshold: float | None = None, buffer_seconds: int = 5,
                  post_seconds: int = 5, sample_fps: float = 5.0,
                  window_seconds: float = 2.0, required_ratio: float = 0.7,
                  client: BackendEventClient | None = None,
                  storage: EventStorage | None = None,
                  detector=None, publisher: LiveFramePublisher | None = None,
                  realtime: bool = False,
                  emit_events: bool = True,
                  display_fps: float = 10.0,
                  max_realtime_lag_seconds: float = 0.5,
                  async_analysis: bool = False,
                  stop: threading.Event | None = None) -> list[dict]:
    if (not camera_id or buffer_seconds < 0 or post_seconds < 0 or display_fps <= 0
            or max_realtime_lag_seconds < 0):
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
    validator = TemporalValidator(window_seconds, effective_sample_fps, required_ratio,
                                  adaptive_window=True)
    pre_frames = deque()
    pre_annotated_frames = deque()
    pre_timestamps = deque()
    latest_result = {"detected": [], "probabilities": {}, "boxes": []}
    live = isinstance(source, int) or str(source).startswith(("rtsp://", "http://", "https://"))
    started = time.monotonic()
    next_sample_at = 0.0
    next_display_at = 0.0
    frame_index = 0
    pending = None
    events = []
    media_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix=f"{camera_id}-media")
    media_jobs = deque()
    inference_executor = (ThreadPoolExecutor(max_workers=1, thread_name_prefix=f"{camera_id}-inference")
                          if async_analysis else None)
    inference_job = None
    inference_input = None
    latest_result_at = None
    last_reason = None
    last_reason_at = -10.0
    max_result_age = 6.0

    def collect_media(wait=False):
        while media_jobs and (wait or media_jobs[0].done()):
            job = media_jobs.popleft()
            try:
                events.append(job.result())
            except Exception:
                # Do not replay the source (and duplicate registered events) on
                # an encoding/PATCH failure. The event ID is logged by the job.
                log.exception("%s: media_save_failed", camera_id)

    def write_event(pending):
        clip_end = min(pending["last_timestamp"], pending["timestamp"] + post_seconds)
        clip_span = clip_end - pending["first_timestamp"]
        # Preserve elapsed time at a fixed FPS, holding the most recent frame
        # across gaps caused by inference or realtime frame skipping.
        frame_count = max(1, ceil(clip_span * fps - 1e-7))
        frames, annotated_frames = [], []
        source_index = 0
        for index in range(frame_count):
            at = pending["first_timestamp"] + index / fps
            while (source_index + 1 < len(pending["timestamps"])
                   and pending["timestamps"][source_index + 1] <= at + 1e-9):
                source_index += 1
            frames.append(pending["frames"][source_index])
            annotated_frames.append(pending["annotated_frames"][source_index])
        try:
            metadata = storage.write_video(
                pending["metadata"], frames, fps,
                annotated_frames=annotated_frames,
            )
            actual_pre = round(max(0.0, pending["timestamp"] - pending["first_timestamp"]))
            actual_post = round(max(0.0, clip_end - pending["timestamp"]))
            client.update_media(pending["backend_id"], metadata["video"], actual_pre, actual_post)
            log.info("%s: media_saved event_id=%s pre=%s post=%s", camera_id,
                     pending["backend_id"], actual_pre, actual_post)
            return metadata
        except Exception:
            log.exception("%s: media_save_failed event_id=%s", camera_id, pending["backend_id"])
            raise

    def finish_event() -> None:
        nonlocal pending
        if pending is None:
            return
        collect_media()
        if len(media_jobs) >= 2:
            log.warning("%s: media_queue_full; waiting without dropping event", camera_id)
            collect_media(wait=True)
        media_jobs.append(media_executor.submit(write_event, pending))
        pending = None

    def observe_result(sample_timestamp, sample_frame, result, timestamp):
        nonlocal pending, last_reason, last_reason_at
        # Observe each completed inference exactly once, at its source time.
        confirmation = validator.observe(sample_timestamp, result)
        reason = validator.reason
        if reason != last_reason or timestamp - last_reason_at >= 10:
            log.info("%s: decision=%s samples=%s/%s window=%.2fs", camera_id, reason,
                     len(validator.samples), validator.minimum_samples, validator.active_window_seconds)
            last_reason, last_reason_at = reason, timestamp
        if confirmation is None:
            return
        if pending is not None:
            validator.armed = True
            log.info("%s: clip_in_progress; deferring new confirmation", camera_id)
            return

        metadata = storage.save_snapshot(sample_frame, result)
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
        log.info("%s: event_created event_id=%s type=%s", camera_id, backend_id, confirmation.event_type)
        clip_start = max(pre_timestamps[0], sample_timestamp - buffer_seconds)
        start_index = 0
        while (start_index + 1 < len(pre_timestamps)
               and pre_timestamps[start_index + 1] <= clip_start):
            start_index += 1
        pending = {
            "metadata": metadata,
            "backend_id": backend_id,
            "timestamp": sample_timestamp,
            "first_timestamp": clip_start,
            "last_timestamp": timestamp,
            "frames": list(pre_frames)[start_index:],
            "annotated_frames": list(pre_annotated_frames)[start_index:],
            "timestamps": list(pre_timestamps)[start_index:],
        }
        if timestamp - sample_timestamp >= post_seconds:
            finish_event()

    try:
        while stop is None or not stop.is_set():
            collect_media()
            ok, frame = capture.read()
            if not ok:
                break
            timestamp = time.monotonic() - started if live else frame_index / fps
            if realtime and not live:
                elapsed = time.monotonic() - started
                lag = elapsed - timestamp
                if lag > max_realtime_lag_seconds:
                    target_frame = max(frame_index, int(elapsed * fps))
                    if capture.set(cv2.CAP_PROP_POS_FRAMES, target_frame):
                        frame_index = target_frame
                        continue
                delay = timestamp - elapsed
                if delay > 0:
                    time.sleep(delay)
            frame_index += 1
            encoded, jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            if not encoded:
                continue
            packed_frame = jpeg.tobytes()
            sampled = False
            sample_timestamp, sample_frame = timestamp, frame
            if inference_job is not None and inference_job.done():
                latest_result = inference_job.result()
                sample_timestamp, sample_frame = inference_input
                inference_job = None
                sampled = timestamp - sample_timestamp <= max_result_age
                latest_result_at = sample_timestamp
                if not sampled:
                    latest_result = {"detected": [], "probabilities": {}, "boxes": []}
                    log.warning("%s: stale_inference age=%.2fs", camera_id, timestamp - sample_timestamp)
            if latest_result_at is not None and timestamp - latest_result_at > max_result_age:
                latest_result = {"detected": [], "probabilities": {}, "boxes": []}
            if timestamp + 1e-9 >= next_sample_at and inference_job is None:
                next_sample_at = timestamp + 1 / effective_sample_fps
                if inference_executor is None:
                    latest_result = detector(packed_frame, model, threshold)
                    sampled = True
                else:
                    inference_input = (timestamp, frame.copy())
                    inference_job = inference_executor.submit(detector, packed_frame, model, threshold)
            # Reuse the latest inference between samples; never run extra inference.
            annotated_ok, annotated_jpeg = cv2.imencode(
                ".jpg", annotate(frame, latest_result), [cv2.IMWRITE_JPEG_QUALITY, 85]
            )
            if not annotated_ok:
                raise RuntimeError("Failed to encode annotated event frame")
            packed_annotated = annotated_jpeg.tobytes()
            if timestamp + 1e-9 >= next_display_at:
                next_display_at = timestamp + 1 / display_fps
                if hasattr(publisher, "publish_encoded"):
                    publisher.publish_encoded(camera_id, packed_annotated)
                else:
                    publisher.publish(camera_id, frame, latest_result)
            pre_frames.append(packed_frame)
            pre_annotated_frames.append(packed_annotated)
            pre_timestamps.append(timestamp)
            # Keep only the time window plus its preceding frame, used to fill
            # the exact left boundary when a skipped-frame gap crosses it.
            cutoff = timestamp - buffer_seconds - (max_result_age if async_analysis else 0)
            while len(pre_timestamps) > 1 and pre_timestamps[1] <= cutoff:
                pre_timestamps.popleft()
                pre_frames.popleft()
                pre_annotated_frames.popleft()

            if pending is not None:
                pending["frames"].append(packed_frame)
                pending["annotated_frames"].append(packed_annotated)
                pending["timestamps"].append(timestamp)
                pending["last_timestamp"] = timestamp
                if timestamp - pending["timestamp"] >= post_seconds:
                    finish_event()

            if not sampled or not emit_events:
                continue
            result = latest_result
            observe_result(sample_timestamp, sample_frame, result, timestamp)
        # Drain the final submitted inference before closing a finite source.
        if inference_job is not None:
            result = inference_job.result()
            sample_timestamp, sample_frame = inference_input
            last_timestamp = pre_timestamps[-1] if pre_timestamps else sample_timestamp
            if emit_events and last_timestamp - sample_timestamp <= max_result_age:
                observe_result(sample_timestamp, sample_frame, result, last_timestamp)
        finish_event()  # A finite input may end before the requested post-event duration.
    finally:
        capture.release()
        try:
            # Preserve an already registered clip even if later inference fails.
            finish_event()
        finally:
            if inference_executor is not None:
                inference_executor.shutdown(wait=True, cancel_futures=True)
            media_executor.shutdown(wait=True)
            collect_media(wait=True)
    return events


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Analyze a camera or video and submit confirmed events")
    parser.add_argument("--source", required=True, help="video file, RTSP URL, or camera device number")
    parser.add_argument("--camera-id", required=True, help="ID already registered in Backend CAMERA")
    parser.add_argument("--model", default="yolo")
    parser.add_argument("--realtime", action="store_true", help="pace a video file at its recorded FPS")
    args = parser.parse_args()
    source = int(args.source) if args.source.isdecimal() else args.source
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(threadName)s] %(message)s")
    process_video(source, args.camera_id, model=args.model, realtime=args.realtime,
                  async_analysis=args.realtime or isinstance(source, int)
                  or str(source).startswith(("rtsp://", "http://", "https://")))
