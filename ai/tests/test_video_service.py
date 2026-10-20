import unittest
import cv2
import tempfile
import threading
from pathlib import Path
from unittest.mock import patch

import numpy as np

from app.services.video_service import process_video
from app.services.temporal_service import Confirmation


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

    def set(self, _property, value):
        self.index = min(int(value), len(self.frames))
        return True

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
    def test_slow_inference_does_not_stop_display_or_queue_more_inference(self):
        started, release = threading.Event(), threading.Event()
        calls, published = [], []
        capture = Capture(30)

        def detector(*_):
            calls.append(True)
            started.set()
            if not release.wait(2):
                raise AssertionError("display was blocked by inference")
            return {"detected": [], "probabilities": {}, "boxes": []}

        class Display:
            def publish_encoded(self, _camera, _jpeg):
                self_test.assertTrue(started.wait(2))
                published.append(True)
                if len(published) == 5:
                    self_test.assertEqual(len(calls), 1)
                    release.set()

        self_test = self
        with patch("app.services.video_service.cv2.VideoCapture", return_value=capture):
            process_video("sample.mp4", "CAM001", async_analysis=True, emit_events=False,
                          client=Client([]), storage=Storage([]), detector=detector, publisher=Display())
        self.assertEqual(len(published), 30)
        self.assertTrue(capture.released)

    def test_last_inference_is_observed_at_eof(self):
        release = threading.Event()
        capture = Capture(1)
        original_read = capture.read
        calls = []

        def read():
            value = original_read()
            if not value[0]:
                release.set()
            return value

        def detector(*_):
            self.assertTrue(release.wait(2))
            return {"detected": ["fire"], "probabilities": {"fire": 0.9}, "boxes": []}

        capture.read = read
        with patch("app.services.video_service.cv2.VideoCapture", return_value=capture), patch(
            "app.services.video_service.TemporalValidator"
        ) as validator:
            validator.return_value.observe.return_value = Confirmation("FIRE", 0.9)
            events = process_video("sample.mp4", "CAM001", async_analysis=True,
                                   client=Client(calls), storage=Storage(calls), detector=detector,
                                   publisher=Publisher())
        self.assertEqual(len(events), 1)
        validator.return_value.observe.assert_called_once()
        self.assertEqual(validator.return_value.observe.call_args.args[0], 0)
        self.assertEqual(calls[-1][0], "patch")

    def test_encoding_does_not_block_capture_and_is_drained_before_return(self):
        release = threading.Event()
        calls = []
        capture = Capture(60)
        self_test = self

        class SlowStorage(Storage):
            def write_video(self, *args, **kwargs):
                self_test.assertTrue(release.wait(2), "capture was blocked by encoding")
                return super().write_video(*args, **kwargs)

        class Display:
            def publish_encoded(self, _camera, _jpeg):
                if capture.index >= 45:
                    release.set()

        with patch("app.services.video_service.cv2.VideoCapture", return_value=capture):
            events = process_video("sample.mp4", "CAM001", post_seconds=1,
                                   client=Client(calls), storage=SlowStorage(calls),
                                   detector=lambda *_: {"detected": ["fire"], "probabilities": {"fire": 0.9}},
                                   publisher=Display())
        self.assertEqual(len(events), 1)
        self.assertEqual(calls[-1][0], "patch")
        self.assertEqual(capture.index, 60)

    def test_media_failure_is_logged_without_stopping_capture(self):
        calls = []
        capture = Capture(60)

        class FailedStorage(Storage):
            def write_video(self, *args, **kwargs):
                raise RuntimeError("encoder unavailable")

        with patch("app.services.video_service.cv2.VideoCapture", return_value=capture), self.assertLogs(
            "camera.events", level="ERROR"
        ) as logs:
            events = process_video("sample.mp4", "CAM001", post_seconds=1,
                                   client=Client(calls), storage=FailedStorage(calls),
                                   detector=lambda *_: {"detected": ["fire"], "probabilities": {"fire": 0.9}},
                                   publisher=Publisher())
        self.assertEqual(events, [])
        self.assertEqual(capture.index, 60)
        self.assertTrue(any("event_id=31" in line for line in logs.output))
        self.assertEqual(sum(call[0] == "post" for call in calls), 1)

    def test_realtime_playback_skips_stale_frames(self):
        capture = Capture(100)
        published = []

        class EncodedPublisher:
            def publish_encoded(self, camera_id, jpeg):
                published.append(camera_id)

        clock = iter([0.0, 0.0, 2.0, 10.0])
        with patch("app.services.video_service.cv2.VideoCapture", return_value=capture), patch(
            "app.services.video_service.time.monotonic", side_effect=lambda: next(clock, 10.0)
        ), patch("app.services.video_service.time.sleep"):
            process_video(
                "sample.mp4", "CAM001", realtime=True, emit_events=False,
                sample_fps=2, display_fps=4, max_realtime_lag_seconds=0.5,
                client=Client([]), storage=Storage([]),
                detector=lambda *_: {"detected": [], "probabilities": {}, "boxes": []},
                publisher=EncodedPublisher(),
            )
        self.assertGreater(capture.index, 20)
        self.assertLess(len(published), 20)

    def test_skipped_frames_are_resampled_at_source_fps(self):
        calls = []
        capture = Capture(61)

        def detector(*_args):
            return {"detected": ["fire"], "probabilities": {"fire": 0.9}, "boxes": []}

        clock = iter([0.0, 0.0, 1.0, 1.0, 2.0, 2.0])
        with patch("app.services.video_service.cv2.VideoCapture", return_value=capture), patch(
            "app.services.video_service.time.monotonic", side_effect=lambda: next(clock, 2.0)
        ), patch("app.services.video_service.time.sleep"):
            process_video(
                "sample.mp4", "CAM001", realtime=True, sample_fps=1,
                window_seconds=2, required_ratio=0.7, buffer_seconds=5, post_seconds=1,
                client=Client(calls), storage=Storage(calls), detector=detector,
                publisher=Publisher(), max_realtime_lag_seconds=0.5,
            )

        video_call = next(call for call in calls if call[0] == "video")
        self.assertEqual(video_call[1], 30)
        self.assertAlmostEqual(video_call[2], 10.0)
        self.assertEqual(calls[-1][3:], (2, 1))

    def test_sparse_frames_trim_prebuffer_and_post_overshoot_to_ten_seconds(self):
        calls = []
        capture = Capture(9)
        capture.frames = [np.full((16, 16, 3), i * 20, dtype=np.uint8) for i in range(9)]
        storage = Storage(calls)
        # Confirmation at 10s; retain [5s, 15s), even though reads arrive at
        # 2s intervals and the first frame after the post deadline is at 16s.
        clock = iter([0.0, *range(0, 18, 2)])
        with patch("app.services.video_service.cv2.VideoCapture", return_value=capture), patch(
            "app.services.video_service.time.monotonic", side_effect=lambda: next(clock)
        ), patch("app.services.video_service.TemporalValidator") as validator:
            validator.return_value.observe.side_effect = [
                None, None, None, None, None, Confirmation("FIRE", 0.9), None, None, None,
            ]
            process_video(
                0, "CAM001", client=Client(calls), storage=storage,
                detector=lambda *_: {"detected": [], "probabilities": {}, "boxes": []},
                publisher=Publisher(),
            )
        video_call = next(call for call in calls if call[0] == "video")
        self.assertEqual(video_call[1:], (100, 10.0))
        self.assertEqual(calls[-1][3:], (5, 5))
        self.assertEqual(len(storage.annotated_frames), 100)
        for index, expected in [(0, 40), (9, 40), (10, 60), (90, 140), (99, 140)]:
            frame = cv2.imdecode(np.frombuffer(storage.frames[index], dtype=np.uint8), cv2.IMREAD_COLOR)
            self.assertAlmostEqual(float(frame.mean()), expected, delta=1)
            self.assertEqual(storage.frames[index], storage.annotated_frames[index])

    def test_live_frames_update_between_inference_samples(self):
        capture = Capture(30)
        inferred = []
        published = []

        class EncodedPublisher:
            def publish_encoded(self, camera_id, jpeg):
                published.append((camera_id, jpeg))

        def detector(*_args):
            inferred.append(True)
            return {"detected": [], "probabilities": {}, "boxes": []}

        with patch("app.services.video_service.cv2.VideoCapture", return_value=capture):
            process_video("sample.mp4", "CAM001", sample_fps=2, display_fps=5,
                          emit_events=False, client=Client([]), storage=Storage([]),
                          detector=detector, publisher=EncodedPublisher())
        self.assertEqual(len(inferred), 6)
        self.assertEqual(len(published), 15)
        self.assertTrue(all(camera_id == "CAM001" and jpeg.startswith(b"\xff\xd8")
                            for camera_id, jpeg in published))

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
        open_video = cv2.VideoCapture
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
            for path in paths:
                saved = open_video(path)
                try:
                    self.assertTrue(saved.isOpened())
                    duration = saved.get(cv2.CAP_PROP_FRAME_COUNT) / saved.get(cv2.CAP_PROP_FPS)
                    self.assertAlmostEqual(duration, 3.0, places=2)
                finally:
                    saved.release()
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
