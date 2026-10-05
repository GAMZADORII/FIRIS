# AI 모델 모듈 - YOLO 화재·연기 클래스 계약 및 중복 박스 제거 검증
import io
import unittest
from unittest.mock import MagicMock, patch

import torch
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app
from app.models.inference import YOLO_NMS_IOU, load_model, predict


class YoloModelValidationTest(unittest.TestCase):
    def tearDown(self):
        load_model.cache_clear()

    def test_rejects_coco_model_before_class_ids_are_mapped(self):
        coco = MagicMock()
        coco.names = {0: "person", 1: "bicycle"}

        with patch("ultralytics.YOLO", return_value=coco):
            with self.assertRaisesRegex(RuntimeError, "FIRE/SMOKE model"):
                load_model("yolo")

    def test_accepts_fire_smoke_model(self):
        fire_smoke = MagicMock()
        fire_smoke.names = {0: "smoke", 1: "fire"}

        with patch("ultralytics.YOLO", return_value=fire_smoke):
            loaded = load_model("yolo")

        self.assertIs(loaded["model"], fire_smoke)
        self.assertEqual(loaded["thresholds"], [0.4, 0.4])

    def test_predict_endpoint_reports_invalid_yolo_as_unavailable(self):
        with patch("app.main.predict", side_effect=RuntimeError("invalid FIRE/SMOKE model")):
            response = TestClient(app).post(
                "/predict",
                data={"model": "yolo"},
                files={"image": ("sample.jpg", b"image", "image/jpeg")},
            )

        self.assertEqual(response.status_code, 503)
        self.assertIn("FIRE/SMOKE", response.json()["detail"])

    def test_yolo_uses_stricter_nms_to_remove_duplicate_boxes(self):
        boxes = MagicMock()
        boxes.xyxy.cpu.return_value.numpy.return_value = torch.empty((0, 4)).numpy()
        boxes.cls.cpu.return_value.numpy.return_value = torch.empty(0).numpy()
        boxes.conf.cpu.return_value.numpy.return_value = torch.empty(0).numpy()
        result = MagicMock(boxes=boxes)
        model = MagicMock()
        model.predict.return_value = [result]
        image = io.BytesIO()
        Image.new("RGB", (8, 8)).save(image, format="JPEG")

        with patch("app.models.inference.load_model", return_value={
            "model": model, "image_size": 640, "thresholds": [0.25, 0.25]
        }):
            predict(image.getvalue(), "yolo")

        self.assertEqual(model.predict.call_args.kwargs["iou"], YOLO_NMS_IOU)
        self.assertEqual(YOLO_NMS_IOU, 0.5)


if __name__ == "__main__":
    unittest.main()
