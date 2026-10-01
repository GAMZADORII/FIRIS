# AI 모델 학습 - YOLO11n 화재·연기 객체 탐지 전용 실행 파일
from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

import numpy as np

from train_all import PROJECT_ROOT, discover_aihub, discover_dfire, metrics, optimize_thresholds
from yolo_model import train_yolo


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-root", type=Path, default=PROJECT_ROOT / "raw")
    parser.add_argument("--output", type=Path, default=PROJECT_ROOT / "ai_model" / "results_yolo11n_final")
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--image-size", type=int, default=640)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--smoke-test", action="store_true")
    return parser.parse_args()


def main():
    args = parse_args()
    random.seed(args.seed)
    np.random.seed(args.seed)
    samples = discover_dfire(args.data_root) + discover_aihub(args.data_root)
    splits = {name: [row for row in samples if row.split == name] for name in ("train", "val", "test")}
    if args.smoke_test:
        rng = random.Random(args.seed)
        limits = {"train": 128, "val": 64, "test": 64}
        splits = {
            name: rng.sample(rows, min(limits[name], len(rows)))
            for name, rows in splits.items()
        }
        args.epochs = 1
        args.image_size = 320
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "models").mkdir(exist_ok=True)
    print(f"split={{{', '.join(f'{name}: {len(rows)}' for name, rows in splits.items())}}}", flush=True)
    result = train_yolo(
        splits,
        args.data_root,
        args.output,
        args.epochs,
        args.image_size,
        args.batch_size,
        args.seed,
        optimize_thresholds,
        metrics,
        args.smoke_test,
    )
    (args.output / "metrics.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(result, ensure_ascii=False, indent=2), flush=True)


if __name__ == "__main__":
    main()
