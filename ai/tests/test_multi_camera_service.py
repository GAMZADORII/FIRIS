# CCTV 다중 채널 - 카메라별 영상 큐 순차 처리 검증
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

from app.services.multi_camera_service import run_camera


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


if __name__ == "__main__":
    unittest.main()
