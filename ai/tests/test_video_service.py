import unittest
from unittest.mock import patch

import numpy as np

from app.services.video_service import process_video


class Capture:
    def __init__(self, frame_count=60):
        self.frames = [np.zeros((16, 16, 3), dtype=np.uint8) for _ in range(frame_count)]
        self.index = 0
        self.released = False

    def isOpened(self):
        return True

    def get(self, _property):
        return 10.0

    def read(self):
        if self.index >= len(self.frames):
            return False, None
        frame = self.frames[self.index]
        self.index += 1
        return True, frame

    def release(self):
        self.released = True


class Storage:
    def __init__(self, calls):
        self.calls = calls

    def save_snapshot(self, frame, detection):
        self.calls.append(("snapshot", frame.shape))
        return {"snapshot": "/shared/events/local-1/snapshot.jpg", "video": None}

    def save_metadata(self, metadata):
        self.calls.append(("metadata", metadata["backend_event_id"]))

    def write_video(self, metadata, frames, fps):
        self.calls.append(("video", len(frames), fps))
        metadata["video"] = "/shared/events/local-1/event.mp4"
        return metadata


class Client:
    def __init__(self, calls):
        self.calls = calls

    def create_event(self, payload):
        self.calls.append(("post", payload))
        return 31

    def update_media(self, event_id, video_path, pre_seconds, post_seconds):
        self.calls.append(("patch", event_id, video_path, pre_seconds, post_seconds))


class Publisher:
    def publish(self, camera_id, frame, detection):
        pass


class VideoServiceTest(unittest.TestCase):
    def test_snapshot_post_postframes_video_patch_order(self):
        calls = []
        capture = Capture()
        samples = 0

        def detector(_image, _model, _threshold):
            nonlocal samples
            samples += 1
            detected = ["fire"] if samples <= 12 else []
            return {"detected": detected, "probabilities": {"fire": 0.9}, "boxes": []}

        with patch("app.services.video_service.cv2.VideoCapture", return_value=capture):
            events = process_video("sample.mp4", "camera-1", buffer_seconds=2,
                                   post_seconds=1, client=Client(calls), storage=Storage(calls),
                                   detector=detector, publisher=Publisher())

        self.assertEqual([call[0] for call in calls], ["snapshot", "post", "metadata", "video", "patch"])
        self.assertEqual(calls[1][1]["eventType"], "FIRE")
        self.assertEqual(calls[1][1]["cameraId"], "camera-1")
        self.assertEqual(calls[4][1:], (31, "/shared/events/local-1/event.mp4", 2, 1))
        self.assertGreater(calls[3][1], 20)  # event video includes post-confirmation frames
        self.assertEqual(len(events), 1)
        self.assertTrue(capture.released)

    def test_failed_post_never_writes_or_patches_video(self):
        calls = []
        capture = Capture(30)

        class FailingClient(Client):
            def create_event(self, payload):
                super().create_event(payload)
                raise RuntimeError("Backend unavailable")

        def detector(*_args):
            return {"detected": ["smoke"], "probabilities": {"smoke": 0.8}, "boxes": []}

        with patch("app.services.video_service.cv2.VideoCapture", return_value=capture):
            with self.assertRaisesRegex(RuntimeError, "Backend unavailable"):
                process_video("sample.mp4", "camera-1", client=FailingClient(calls),
                              storage=Storage(calls), detector=detector, publisher=Publisher())
        self.assertEqual([call[0] for call in calls], ["snapshot", "post"])
        self.assertTrue(capture.released)


if __name__ == "__main__":
    unittest.main()
