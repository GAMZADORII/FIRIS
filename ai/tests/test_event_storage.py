import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import cv2
import numpy as np

from app.services.event_service import AI_ROOT, PROJECT_ROOT, EventStorage, event_storage_dir
from app.services.live_frame_service import annotate, live_frame_dir


class EventStorageTest(unittest.TestCase):
    def test_snapshot_and_both_videos_are_real_matching_media_files(self):
        with tempfile.TemporaryDirectory() as directory:
            storage = EventStorage(Path(directory))
            frame = np.zeros((100, 100, 3), dtype=np.uint8)
            detection = {"detected": ["fire"], "boxes": [
                {"label": "fire", "confidence": 0.9, "xyxy": [10, 20, 80, 90]}
            ]}
            metadata = storage.save_snapshot(frame, detection)
            original = cv2.imencode(".jpg", frame)[1].tobytes()
            annotated = cv2.imencode(".jpg", annotate(frame, detection))[1].tobytes()
            metadata["backend_event_id"] = 31
            stored = storage.write_video(metadata, [original] * 10, 10, [annotated] * 10)
            counts, rates, decoded = [], [], []
            for key in ("video", "annotated_video"):
                video = cv2.VideoCapture(stored[key])
                try:
                    self.assertTrue(video.isOpened())
                    counts.append(video.get(cv2.CAP_PROP_FRAME_COUNT))
                    rates.append(video.get(cv2.CAP_PROP_FPS))
                    ok, image = video.read()
                    self.assertTrue(ok)
                    decoded.append(image)
                finally:
                    video.release()
            self.assertEqual(counts, [10, 10])
            self.assertEqual(rates, [10, 10])
            for key in ("video", "annotated_video"):
                codec = subprocess.check_output([
                    "ffprobe", "-v", "error", "-select_streams", "v:0",
                    "-show_entries", "stream=codec_name", "-of", "default=nw=1:nk=1", stored[key]
                ], text=True).strip()
                self.assertEqual(codec, "h264")
            self.assertLess(int(decoded[0][20, 30, 2]), 30)
            self.assertGreater(int(decoded[1][20, 30, 2]), 100)
            self.assertLess(int(cv2.imread(stored["snapshot"])[20, 30, 2]), 20)
            self.assertFalse(frame.any())
            saved = json.loads(Path(stored["snapshot"]).with_name("event.json").read_text(encoding="utf-8"))
            self.assertEqual(saved["backend_event_id"], 31)
            self.assertEqual(saved["annotated_video"], stored["annotated_video"])
            self.assertFalse(list(Path(directory).rglob("*.tmp*")))

    def test_original_only_call_remains_supported(self):
        with tempfile.TemporaryDirectory() as directory:
            storage = EventStorage(Path(directory))
            frame = np.zeros((32, 32, 3), dtype=np.uint8)
            metadata = storage.save_snapshot(frame, {})
            packed = cv2.imencode(".jpg", frame)[1].tobytes()
            result = storage.write_video(metadata, [packed] * 10, 10)
            self.assertTrue(Path(result["video"]).is_file())
            self.assertIsNone(result["annotated_video"])

    def test_odd_sized_frames_are_padded_for_h264(self):
        with tempfile.TemporaryDirectory() as directory:
            storage = EventStorage(Path(directory))
            frame = np.zeros((33, 35, 3), dtype=np.uint8)
            metadata = storage.save_snapshot(frame, {})
            packed = cv2.imencode(".jpg", frame)[1].tobytes()
            result = storage.write_video(metadata, [packed], 5)
            video = cv2.VideoCapture(result["video"])
            try:
                self.assertTrue(video.isOpened())
                self.assertEqual(video.get(cv2.CAP_PROP_FRAME_WIDTH), 36)
                self.assertEqual(video.get(cv2.CAP_PROP_FRAME_HEIGHT), 34)
            finally:
                video.release()

    def test_mismatched_streams_are_rejected_before_writing(self):
        with tempfile.TemporaryDirectory() as directory:
            storage = EventStorage(Path(directory))
            frame = np.zeros((32, 32, 3), dtype=np.uint8)
            metadata = storage.save_snapshot(frame, {})
            packed = cv2.imencode(".jpg", frame)[1].tobytes()
            with self.assertRaisesRegex(ValueError, "matching frame counts"):
                storage.write_video(metadata, [packed], 10, [])
            self.assertFalse(Path(metadata["snapshot"]).with_name("event.mp4").exists())

    def test_storage_env_paths_are_dynamic_and_relative_to_ai(self):
        with patch.dict(os.environ, {"EVENT_STORAGE_DIR": "../storage/events",
                                     "LIVE_FRAME_DIR": "../storage/live"}):
            self.assertEqual(event_storage_dir(), (AI_ROOT / "../storage/events").resolve())
            self.assertEqual(live_frame_dir(), (PROJECT_ROOT / "storage/live").resolve())
        with patch.dict(os.environ, {"EVENT_STORAGE_DIR": "", "LIVE_FRAME_DIR": ""}):
            self.assertEqual(event_storage_dir(), (PROJECT_ROOT / "storage/events").resolve())
            self.assertEqual(live_frame_dir(), (PROJECT_ROOT / "storage/live").resolve())
        with tempfile.TemporaryDirectory() as directory:
            with patch.dict(os.environ, {"EVENT_STORAGE_DIR": directory, "LIVE_FRAME_DIR": directory}):
                self.assertEqual(event_storage_dir(), Path(directory).resolve())
                self.assertEqual(live_frame_dir(), Path(directory).resolve())

    def test_bad_frame_cleans_unfinished_mp4(self):
        with tempfile.TemporaryDirectory() as directory:
            storage = EventStorage(Path(directory))
            frame = np.zeros((32, 32, 3), dtype=np.uint8)
            metadata = storage.save_snapshot(frame, {})
            packed = cv2.imencode(".jpg", frame)[1].tobytes()
            with self.assertRaises(ValueError):
                storage.write_video(metadata, [packed, b"bad-jpeg"], 10)
            self.assertFalse(list(Path(directory).rglob("*.mp4")))


if __name__ == "__main__":
    unittest.main()
