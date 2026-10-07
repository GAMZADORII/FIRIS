import unittest
import cv2
import tempfile
from pathlib import Path
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

    def write_video(self, metadata, frames, fps, annotated_frames=None):
        self.calls.append(("video", len(frames), fps))
        self.frames = frames
        self.annotated_frames = annotated_frames
        metadata["video"] = "/shared/events/local-1/event.mp4"
        metadata["annotated_video"] = "/shared/events/local-1/event_annotated.mp4"
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
    def test_repeat_playback_updates_live_frames_without_new_event(self):
        calls = []
        capture = Capture(30)

        class TrackingPublisher:
            def publish(self, camera_id, frame, detection):
                calls.append(("frame", camera_id))

        def detector(*_args):
            return {"detected": ["fire"], "probabilities": {"fire": 0.9}, "boxes": []}

        with patch("app.services.video_service.cv2.VideoCapture", return_value=capture):
            result = process_video("sample.mp4", "CAM001", emit_events=False,
                                   client=Client(calls), storage=Storage(calls),
                                   detector=detector, publisher=TrackingPublisher())
        self.assertEqual(result, [])
        self.assertTrue(calls)
        self.assertTrue(all(call[0] == "frame" for call in calls))

    def test_process_video_generates_both_real_mp4s(self):
        from app.services.event_service import EventStorage
        capture = Capture(40)
        capture.frames = [np.zeros((100, 100, 3), dtype=np.uint8) for _ in capture.frames]
        def detector(*_args):
            return {"detected": ["fire"], "probabilities": {"fire": 0.9}, "boxes": [
                {"label": "fire", "confidence": 0.9, "xyxy": [10, 20, 80, 90]}
            ]}
        with tempfile.TemporaryDirectory() as directory, patch(
            "app.services.video_service.cv2.VideoCapture", return_value=capture
        ):
            events = process_video(
                "sample.mp4", "CAM001", buffer_seconds=2, post_seconds=1,
                client=Client([]), storage=EventStorage(Path(directory)),
                detector=detector, publisher=Publisher(),
            )
            self.assertEqual(len(events), 1)
            paths = [events[0][key] for key in ("video", "annotated_video")]
            self.assertTrue(all(Path(path).is_file() for path in paths))
        # Storage codec decoding/frame equality is independently tested in EventStorageTest.

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


    def test_annotated_buffers_match_and_reuse_samples_without_extra_inference(self):
        calls = []
        capture = Capture(40)
        capture.frames = [np.zeros((100, 100, 3), dtype=np.uint8) for _ in capture.frames]
        storage = Storage(calls)
        samples = 0

        def detector(*_args):
            nonlocal samples
            samples += 1
            active = samples <= 11
            return {
                "detected": ["fire"] if active else [],
                "probabilities": {"fire": 0.9 if active else 0.0},
                "boxes": [{"label": "fire", "confidence": 0.9, "xyxy": [10, 20, 80, 90]}] if active else [],
            }

        with patch("app.services.video_service.cv2.VideoCapture", return_value=capture):
            events = process_video(
                "sample.mp4", "CAM001", buffer_seconds=2, post_seconds=1,
                client=Client(calls), storage=storage, detector=detector, publisher=Publisher(),
            )
        self.assertEqual(samples, 20)  # 40 frames at 10fps, sampled at 5fps
        self.assertEqual(len(events), 1)
        self.assertEqual(len(storage.frames), len(storage.annotated_frames))
        original = cv2.imdecode(np.frombuffer(storage.frames[0], dtype=np.uint8), cv2.IMREAD_COLOR)
        annotated = cv2.imdecode(np.frombuffer(storage.annotated_frames[0], dtype=np.uint8), cv2.IMREAD_COLOR)
        self.assertLess(int(original[20, 30, 2]), 20)
        self.assertGreater(int(annotated[20, 30, 2]), 100)
        # Last frames follow a no-detection sample: old boxes must be cleared.
        last = cv2.imdecode(np.frombuffer(storage.annotated_frames[-1], dtype=np.uint8), cv2.IMREAD_COLOR)
        self.assertLess(int(last[20, 30, 2]), 20)
        self.assertEqual(calls[-1][2], "/shared/events/local-1/event.mp4")
        self.assertTrue(all(not frame.any() for frame in capture.frames))

    def test_short_input_finishes_both_buffers_at_eof(self):
        capture = Capture(21)
        storage = Storage([])
        def detector(*_args):
            return {"detected": ["fire"], "probabilities": {"fire": 0.9}, "boxes": []}
        with patch("app.services.video_service.cv2.VideoCapture", return_value=capture):
            events = process_video(
                "short.mp4", "CAM001", post_seconds=5, client=Client([]),
                storage=storage, detector=detector, publisher=Publisher(),
            )
        self.assertEqual(len(events), 1)
        self.assertEqual(len(storage.frames), len(storage.annotated_frames))
        self.assertTrue(capture.released)


if __name__ == "__main__":
    unittest.main()
