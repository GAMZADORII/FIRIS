import tempfile
import unittest
from pathlib import Path

import cv2
import numpy as np

from app.services.event_service import EventStorage


class EventStorageTest(unittest.TestCase):
    def test_snapshot_and_video_are_real_media_files(self):
        with tempfile.TemporaryDirectory() as directory:
            storage = EventStorage(Path(directory))
            frame = np.zeros((32, 32, 3), dtype=np.uint8)
            metadata = storage.save_snapshot(frame, {"detected": ["fire"]})
            self.assertIsNotNone(cv2.imread(metadata["snapshot"]))
            metadata["backend_event_id"] = 31
            storage.save_metadata(metadata)
            self.assertIn('"backend_event_id": 31', Path(metadata["snapshot"]).with_name("event.json").read_text())
            packed = cv2.imencode(".jpg", frame)[1].tobytes()
            stored = storage.write_video(metadata, [packed] * 10, 10)
            video = cv2.VideoCapture(stored["video"])
            try:
                self.assertTrue(video.isOpened())
                self.assertTrue(video.read()[0])
            finally:
                video.release()
            self.assertIn('"backend_event_id": 31', Path(stored["video"]).with_name("event.json").read_text())


if __name__ == "__main__":
    unittest.main()
