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
        observations = [result("fire") if i in (0, 1, 2, 4, 5, 7, 9, 10) else result()
                        for i in range(11)]
        confirmations = [validator.observe(i * 0.2, sample) for i, sample in enumerate(observations)]
        self.assertEqual([item.event_type for item in confirmations if item], ["FIRE"])
        self.assertTrue(all(item is None for item in confirmations[:-1]))
        self.assertIsNone(validator.observe(2.2, result("fire")))
        for i in range(12, 23):
            validator.observe(i * 0.2, result())
        second = [validator.observe(i * 0.2, result("smoke")) for i in range(23, 34)]
        self.assertEqual([item.event_type for item in second if item], ["SMOKE"])

    def test_same_region_required_for_boxes(self):
        validator = TemporalValidator()
        for i in range(10):
            validator.observe(i * 0.2, result("fire", box=[i * 100, 0, i * 100 + 20, 20]))
        self.assertIsNone(validator.observe(2.0, result("fire", box=[1000, 0, 1020, 20])))

    def test_both_labels_map_to_fire_smoke(self):
        validator = TemporalValidator()
        for i in range(10):
            self.assertIsNone(validator.observe(i * 0.2, result("fire", "smoke")))
        self.assertEqual(validator.observe(2.0, result("fire", "smoke")).event_type, "FIRE_SMOKE")

    def test_six_of_ten_does_not_confirm(self):
        validator = TemporalValidator()
        for i in range(11):
            self.assertIsNone(validator.observe(i * 0.2, result("smoke") if i < 6 else result()))

    def test_sustained_detection_creates_only_one_event(self):
        validator = TemporalValidator()
        confirmations = [validator.observe(i * 0.2, result("fire")) for i in range(40)]
        self.assertEqual(sum(value is not None for value in confirmations), 1)

    def test_two_samples_two_seconds_apart_confirm(self):
        validator = TemporalValidator(sample_fps=1)
        self.assertIsNone(validator.observe(0.0, result("fire")))
        self.assertEqual(validator.observe(2.0, result("fire")).event_type, "FIRE")

    def test_samples_more_than_two_seconds_apart_do_not_confirm(self):
        validator = TemporalValidator()
        for i in range(10):
            self.assertIsNone(validator.observe(i * 2.1, result("fire")))

    def test_four_samples_per_second_still_confirms_with_seven_of_nine(self):
        validator = TemporalValidator()
        confirmations = [validator.observe(i * 0.25,
                                           result("fire") if i in (0, 1, 2, 3, 4, 6, 8) else result())
                         for i in range(9)]
        self.assertEqual([item.event_type for item in confirmations if item], ["FIRE"])

    def test_one_sample_per_second_requires_two_full_seconds(self):
        validator = TemporalValidator(sample_fps=1)
        self.assertIsNone(validator.observe(0.0, result("fire")))
        self.assertIsNone(validator.observe(1.0, result("fire")))
        self.assertEqual(validator.observe(2.0, result("fire")).event_type, "FIRE")

        missing_middle = TemporalValidator(sample_fps=1)
        self.assertIsNone(missing_middle.observe(0.0, result("fire")))
        self.assertEqual(missing_middle.observe(2.0, result("fire")).event_type, "FIRE")

    def test_three_samples_per_second_never_confirms_before_two_seconds(self):
        validator = TemporalValidator(sample_fps=3)
        for i in range(6):
            self.assertIsNone(validator.observe(i / 3, result("fire")))
        self.assertEqual(validator.observe(2.0, result("fire")).event_type, "FIRE")


if __name__ == "__main__":
    unittest.main()
