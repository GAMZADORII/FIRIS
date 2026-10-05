import unittest

from app.services.temporal_service import TemporalValidator


def result(*labels, box=None):
    return {
        "detected": list(labels),
        "probabilities": {label: 0.9 for label in labels},
        "boxes": [{"label": labels[0], "xyxy": box}] if box is not None else [],
    }


class TemporalValidatorTest(unittest.TestCase):
    def test_seven_of_ten_confirms_once_and_rearms_after_clear(self):
        validator = TemporalValidator()
        observations = [result("fire") if i in (0, 1, 2, 4, 5, 7, 9) else result()
                        for i in range(10)]
        confirmations = [validator.observe(i * 0.2, sample) for i, sample in enumerate(observations)]
        self.assertEqual([item.event_type for item in confirmations if item], ["FIRE"])
        self.assertIsNone(validator.observe(2.0, result("fire")))
        for i in range(11, 22):
            validator.observe(i * 0.2, result())
        second = [validator.observe(i * 0.2, result("smoke")) for i in range(22, 32)]
        self.assertEqual([item.event_type for item in second if item], ["SMOKE"])

    def test_same_region_required_for_boxes(self):
        validator = TemporalValidator()
        for i in range(9):
            validator.observe(i * 0.2, result("fire", box=[i * 100, 0, i * 100 + 20, 20]))
        self.assertIsNone(validator.observe(1.8, result("fire", box=[900, 0, 920, 20])))

    def test_both_labels_map_to_fire_smoke(self):
        validator = TemporalValidator()
        for i in range(9):
            self.assertIsNone(validator.observe(i * 0.2, result("fire", "smoke")))
        self.assertEqual(validator.observe(1.8, result("fire", "smoke")).event_type, "FIRE_SMOKE")

    def test_six_of_ten_does_not_confirm(self):
        validator = TemporalValidator()
        for i in range(10):
            self.assertIsNone(validator.observe(i * 0.2, result("smoke") if i < 6 else result()))

    def test_sustained_detection_creates_only_one_event(self):
        validator = TemporalValidator()
        confirmations = [validator.observe(i * 0.2, result("fire")) for i in range(40)]
        self.assertEqual(sum(value is not None for value in confirmations), 1)

    def test_sparse_samples_do_not_confirm(self):
        validator = TemporalValidator()
        for i in range(10):
            self.assertIsNone(validator.observe(i * 0.5, result("fire")))

    def test_four_samples_per_second_still_confirms_with_seven_of_nine(self):
        validator = TemporalValidator()
        confirmations = [validator.observe(i * 0.25, result("fire") if i < 7 else result())
                         for i in range(9)]
        self.assertEqual([item.event_type for item in confirmations if item], ["FIRE"])


if __name__ == "__main__":
    unittest.main()
