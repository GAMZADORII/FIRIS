import os
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

import cv2
import numpy as np
from fastapi.testclient import TestClient

from app.main import app
from app.services.live_frame_service import LiveFramePublisher, frame_path


class LiveFrameTest(unittest.TestCase):
    def test_annotated_frame_is_served_only_with_key_and_expires(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {
            "LIVE_FRAME_DIR": directory, "AI_API_KEY": "test-key"
        }):
            source = np.zeros((100, 100, 3), dtype=np.uint8)
            detection = {"boxes": [{"label": "fire", "confidence": 0.8,
                                      "xyxy": [10, 20, 80, 90]}]}
            LiveFramePublisher().publish("camera-1", source, detection)
            client = TestClient(app)
            self.assertEqual(client.get("/cameras/camera-1/frame").status_code, 401)
            response = client.get("/cameras/camera-1/frame", headers={"X-AI-API-KEY": "test-key"})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers["content-type"], "image/jpeg")
            decoded = cv2.imdecode(np.frombuffer(response.content, dtype=np.uint8), cv2.IMREAD_COLOR)
            self.assertGreater(int(decoded[20, 30, 2]), 150)  # red FIRE box
            self.assertLess(int(decoded[20, 30, 0]), 100)
            self.assertEqual(int(source[20, 30, 2]), 0)  # original remains unchanged
            path = frame_path("camera-1")
            os.utime(path, (time.time() - 10, time.time() - 10))
            self.assertEqual(client.get("/cameras/camera-1/frame", headers={
                "X-AI-API-KEY": "test-key"}).status_code, 503)

    def test_camera_id_cannot_escape_frame_directory(self):
        with self.assertRaises(ValueError):
            frame_path("../other")


if __name__ == "__main__":
    unittest.main()
