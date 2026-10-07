# CCTV 다중 채널 - 카메라별 영상 큐 순차 처리 검증
import os
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

import cv2
import numpy as np

from app.services.event_service import EventStorage
from app.services.live_frame_service import frame_path
from app.services.multi_camera_service import AI_ROOT, PROJECT_ROOT, run_camera, video_storage_dir
from app.services.video_service import process_video as analyze_video


class MultiCameraServiceTest(unittest.TestCase):
    def test_four_camera_workers_process_in_parallel(self):
        stop = threading.Event()
        barrier = threading.Barrier(4)
        calls = []
        lock = threading.Lock()

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            folders = []
            for index in range(4):
                folder = root / f"camera-{index + 1}"
                folder.mkdir()
                (folder / "01.mp4").touch()
                folders.append(folder)

            def process(_source, camera_id, **_options):
                with lock:
                    calls.append(camera_id)
                barrier.wait(timeout=2)
                stop.set()

            with patch("app.services.multi_camera_service.process_video", side_effect=process):
                workers = [
                    threading.Thread(target=run_camera, args=(folder.name, folder, stop))
                    for folder in folders
                ]
                for worker in workers:
                    worker.start()
                for worker in workers:
                    worker.join(timeout=3)

        self.assertEqual(set(calls), {"camera-1", "camera-2", "camera-3", "camera-4"})
        self.assertTrue(all(not worker.is_alive() for worker in workers))

    def test_each_video_is_processed_once_and_new_video_is_picked_up(self):
        stop = threading.Event()
        calls = []

        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            first = folder / "01.mp4"
            first.touch()

            def process(source, camera_id, **options):
                calls.append((Path(source).name, camera_id, options["threshold"]))
                if len(calls) == 1:
                    (folder / "02.mp4").touch()
                elif len(calls) == 2:
                    stop.set()

            with patch("app.services.multi_camera_service.process_video", side_effect=process):
                run_camera("camera-1", folder, stop, threshold=0.9)

        self.assertEqual(calls, [("01.mp4", "camera-1", 0.9),
                                 ("02.mp4", "camera-1", 0.9)])

    def test_input_root_precedence(self):
        with patch.dict(os.environ, {"VIDEO_STORAGE_DIR": "../storage/videos"}):
            self.assertEqual(video_storage_dir(), (AI_ROOT / "../storage/videos").resolve())
            self.assertEqual(video_storage_dir("explicit"), Path("explicit").resolve())
        with patch.dict(os.environ, {"VIDEO_STORAGE_DIR": ""}):
            self.assertEqual(video_storage_dir(), (PROJECT_ROOT / "storage/videos").resolve())
        with tempfile.TemporaryDirectory() as directory:
            with patch.dict(os.environ, {"VIDEO_STORAGE_DIR": directory}):
                self.assertEqual(video_storage_dir(), Path(directory).resolve())

    def test_real_videos_continue_updating_one_camera_frame(self):
        stop = threading.Event()
        calls = []
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            folder = root / "CAM001"
            folder.mkdir()
            for name, value in (("001.mp4", 0), ("002.mp4", 255)):
                writer = cv2.VideoWriter(
                    str(folder / name), cv2.VideoWriter_fourcc(*"mp4v"), 10, (32, 32)
                )
                self.assertTrue(writer.isOpened())
                for _ in range(5):
                    writer.write(np.full((32, 32, 3), value, dtype=np.uint8))
                writer.release()

            def process(source, camera_id, **options):
                result = analyze_video(source, camera_id, **options)
                calls.append((Path(source).name, frame_path(camera_id).read_bytes()))
                if len(calls) == 2:
                    stop.set()
                return result

            with patch.dict(os.environ, {"LIVE_FRAME_DIR": str(root / "live")}), patch(
                "app.services.multi_camera_service.process_video", side_effect=process
            ):
                run_camera(
                    "CAM001", folder, stop, sample_fps=5,
                    detector=lambda *_: {"detected": [], "probabilities": {}, "boxes": []},
                    client=object(), storage=EventStorage(root / "events"),
                )
        self.assertEqual([name for name, _ in calls], ["001.mp4", "002.mp4"])
        self.assertNotEqual(calls[0][1], calls[1][1])


if __name__ == "__main__":
    unittest.main()
