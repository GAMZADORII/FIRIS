"""Camera-local sliding-window confirmation for fire and smoke detections."""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from math import ceil


@dataclass(frozen=True)
class Confirmation:
    event_type: str
    confidence: float


def _overlap(left: list[float], right: list[float]) -> float:
    x1, y1 = max(left[0], right[0]), max(left[1], right[1])
    x2, y2 = min(left[2], right[2]), min(left[3], right[3])
    intersection = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    left_area = max(0.0, left[2] - left[0]) * max(0.0, left[3] - left[1])
    right_area = max(0.0, right[2] - right[0]) * max(0.0, right[3] - right[1])
    union = left_area + right_area - intersection
    return intersection / union if union else 0.0


class TemporalValidator:
    def __init__(self, window_seconds: float = 2.0, sample_fps: float = 5.0,
                 required_ratio: float = 0.7, clear_seconds: float = 2.0):
        if window_seconds <= 0 or sample_fps <= 0 or not 0 < required_ratio <= 1 or clear_seconds <= 0:
            raise ValueError("Temporal validation settings must be positive and ratio within (0, 1]")
        self.window_seconds = window_seconds
        self.sample_fps = sample_fps
        self.required_samples = ceil(window_seconds * sample_fps)
        self.minimum_samples = ceil(self.required_samples * 0.6)
        self.required_ratio = required_ratio
        self.clear_seconds = clear_seconds
        self.samples: deque[tuple[float, dict]] = deque(maxlen=self.required_samples)
        self.armed = True
        self.clear_since: float | None = None

    def observe(self, timestamp: float, detection: dict) -> Confirmation | None:
        self.samples.append((timestamp, detection))
        while self.samples and timestamp - self.samples[0][0] > self.window_seconds:
            self.samples.popleft()

        if not detection.get("detected"):
            if self.clear_since is None:
                self.clear_since = timestamp
            elif timestamp - self.clear_since >= self.clear_seconds:
                self.armed = True
        else:
            self.clear_since = None

        if not self.armed or len(self.samples) < self.minimum_samples:
            return None
        if self.samples[-1][0] - self.samples[0][0] < self.window_seconds - 1 / self.sample_fps - 1e-6:
            return None

        required_hits = ceil(len(self.samples) * self.required_ratio)
        confirmed = []
        for label in ("fire", "smoke"):
            positive = [sample for _, sample in self.samples if label in sample.get("detected", [])]
            if len(positive) < required_hits:
                continue
            # Detection models must support a common region; classification models have no boxes.
            candidates = [box["xyxy"] for sample in positive for box in sample.get("boxes", [])
                          if box.get("label") == label]
            if candidates and max(
                sum(any(box.get("label") == label and _overlap(candidate, box["xyxy"]) >= 0.2
                        for box in sample.get("boxes", [])) for sample in positive)
                for candidate in candidates
            ) < required_hits:
                continue
            confidence = max(float(sample.get("probabilities", {}).get(label, 0.0)) for sample in positive)
            confirmed.append((label, confidence))

        if not confirmed:
            return None
        self.armed = False
        labels = {label for label, _ in confirmed}
        event_type = "FIRE_SMOKE" if len(labels) == 2 else next(iter(labels)).upper()
        return Confirmation(event_type, max(confidence for _, confidence in confirmed))
