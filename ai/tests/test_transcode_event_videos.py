import tempfile
import unittest
from pathlib import Path

import cv2
import numpy as np

from scripts.transcode_event_videos import transcode, video_codec


class TranscodeEventVideosTest(unittest.TestCase):
    def test_existing_mp4v_is_replaced_with_h264_and_original_is_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "event.mp4"
            writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), 10, (32, 32))
            self.assertTrue(writer.isOpened())
            for _ in range(5):
                writer.write(np.zeros((32, 32, 3), dtype=np.uint8))
            writer.release()

            self.assertEqual(video_codec(path), "mpeg4")
            self.assertTrue(transcode(path))
            self.assertEqual(video_codec(path), "h264")
            self.assertEqual(video_codec(path.with_name("event.mp4.mp4v.bak")), "mpeg4")
            self.assertFalse(transcode(path))


if __name__ == "__main__":
    unittest.main()
