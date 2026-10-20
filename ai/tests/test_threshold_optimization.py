# AI 모델 학습 - 6개 평가 지표 공동 임계값 최적화 검증
import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "training"))

from train_all import metrics, optimize_thresholds


class ThresholdOptimizationTest(unittest.TestCase):
    def test_selected_thresholds_maximize_the_weakest_required_metric(self):
        y_true = np.asarray(
            [[0, 0], [1, 0], [0, 1], [1, 1], [0, 0], [1, 0], [0, 1], [1, 1]],
            dtype=np.int8,
        )
        y_prob = np.asarray(
            [[0.10, 0.20], [0.58, 0.25], [0.30, 0.62], [0.72, 0.75],
             [0.42, 0.15], [0.55, 0.48], [0.47, 0.56], [0.65, 0.68]],
            dtype=np.float32,
        )
        thresholds = optimize_thresholds(y_true, y_prob)
        selected = metrics(y_true, y_prob, thresholds)
        default = metrics(y_true, y_prob, np.asarray([0.5, 0.5]))
        names = ("subset_accuracy", "precision_micro", "recall_micro", "f1_micro", "smoke_f1", "fire_f1")
        self.assertGreaterEqual(min(selected[name] for name in names), min(default[name] for name in names))
        self.assertEqual(thresholds.shape, (2,))


if __name__ == "__main__":
    unittest.main()
