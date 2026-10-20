# AI 학습 데이터 - 화재/연기 YOLO 데이터셋 정제 파이프라인
from __future__ import annotations

import argparse
import hashlib
import json
import random
import shutil
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFont, UnidentifiedImageError


IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
SPLITS = ("train", "val", "test")
TARGET_NAMES = {0: "smoke", 1: "fire"}


@dataclass(frozen=True)
class Box:
    cls: int
    x: float
    y: float
    w: float
    h: float


def image_files(directory: Path) -> list[Path]:
    if not directory.exists():
        return []
    return sorted(p for p in directory.rglob("*") if p.is_file() and p.suffix.lower() in IMAGE_SUFFIXES)


def label_path(image: Path, images_dir: Path, labels_dir: Path) -> Path:
    return (labels_dir / image.relative_to(images_dir)).with_suffix(".txt")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def dhash(image: Image.Image, size: int = 8) -> int:
    gray = image.convert("L").resize((size + 1, size), Image.Resampling.LANCZOS)
    pixels = list(gray.getdata())
    value = 0
    for row in range(size):
        offset = row * (size + 1)
        for col in range(size):
            value = (value << 1) | (pixels[offset + col] > pixels[offset + col + 1])
    return value


def hamming(left: int, right: int) -> int:
    return (left ^ right).bit_count()


def iou(left: Box, right: Box) -> float:
    lx1, ly1, lx2, ly2 = left.x - left.w / 2, left.y - left.h / 2, left.x + left.w / 2, left.y + left.h / 2
    rx1, ry1, rx2, ry2 = right.x - right.w / 2, right.y - right.h / 2, right.x + right.w / 2, right.y + right.h / 2
    inter = max(0.0, min(lx2, rx2) - max(lx1, rx1)) * max(0.0, min(ly2, ry2) - max(ly1, ry1))
    union = left.w * left.h + right.w * right.h - inter
    return inter / union if union > 0 else 0.0


def parse_labels(path: Path, class_map: dict[int, int], stats: Counter) -> list[Box]:
    if not path.exists():
        stats["missing_label"] += 1
        return []
    clean: list[Box] = []
    for raw in path.read_text(encoding="utf-8-sig").splitlines():
        parts = raw.split()
        if len(parts) != 5:
            stats["invalid_line"] += 1
            continue
        try:
            old_cls = int(parts[0])
            values = [float(value) for value in parts[1:]]
        except ValueError:
            stats["invalid_line"] += 1
            continue
        if old_cls not in class_map or class_map[old_cls] not in TARGET_NAMES:
            stats["invalid_class"] += 1
            continue
        x, y, w, h = values
        if not all(0.0 <= value <= 1.0 for value in values) or w <= 0 or h <= 0:
            stats["out_of_range"] += 1
            continue
        if w < 0.005 or h < 0.005:
            stats["tiny_box"] += 1
            continue
        candidate = Box(class_map[old_cls], x, y, w, h)
        if any(candidate.cls == prior.cls and iou(candidate, prior) >= 0.98 for prior in clean):
            stats["duplicate_box"] += 1
            continue
        clean.append(candidate)
    return clean


def write_labels(path: Path, boxes: Iterable[Box]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = "\n".join(f"{b.cls} {b.x:.6f} {b.y:.6f} {b.w:.6f} {b.h:.6f}" for b in boxes)
    path.write_text(text + ("\n" if text else ""), encoding="utf-8")


def render_sample(image_path: Path, boxes: list[Box], output: Path) -> None:
    with Image.open(image_path) as source:
        image = source.convert("RGB")
    draw = ImageDraw.Draw(image)
    width, height = image.size
    colors = {0: "#32CD32", 1: "#FF3030"}
    for box in boxes:
        x1, y1 = (box.x - box.w / 2) * width, (box.y - box.h / 2) * height
        x2, y2 = (box.x + box.w / 2) * width, (box.y + box.h / 2) * height
        draw.rectangle((x1, y1, x2, y2), outline=colors[box.cls], width=max(2, width // 400))
        draw.text((x1 + 2, max(0, y1 - 12)), f"{box.cls}={TARGET_NAMES[box.cls]}", fill=colors[box.cls], font=ImageFont.load_default())
    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output, quality=90)


def source_layout(root: Path, split: str) -> tuple[Path, Path]:
    candidates = [
        (root / "images" / split, root / "labels" / split),
        (root / split / "images", root / split / "labels"),
    ]
    return next(((images, labels) for images, labels in candidates if images.exists()), candidates[0])


def parse_source(spec: str) -> tuple[str, Path, dict[int, int]]:
    parts = spec.split("::")
    if len(parts) not in (2, 3):
        raise ValueError("--source 형식: 이름::경로[::기존번호=새번호,...]")
    name, path = parts[0].strip(), Path(parts[1]).expanduser().resolve()
    mapping = {0: 0, 1: 1}
    if len(parts) == 3:
        mapping = {}
        for item in parts[2].split(","):
            old, new = item.split("=")
            mapping[int(old)] = int(new)
    if not name or not path.exists():
        raise FileNotFoundError(f"데이터 소스를 찾을 수 없습니다: {spec}")
    return name, path, mapping


def copy_backgrounds(background_dir: Path | None, output: Path, wanted: int, known_hashes: set[str], stats: Counter) -> int:
    if not background_dir or wanted <= 0:
        return 0
    added = 0
    for source in image_files(background_dir):
        try:
            with Image.open(source) as image:
                image.verify()
            digest = sha256(source)
        except (OSError, UnidentifiedImageError):
            stats["broken_background"] += 1
            continue
        if digest in known_hashes:
            continue
        name = f"background_{digest[:12]}{source.suffix.lower()}"
        destination = output / "images" / "train" / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        write_labels(output / "labels" / "train" / f"background_{digest[:12]}.txt", [])
        known_hashes.add(digest)
        added += 1
        if added >= wanted:
            break
    stats["background_added"] += added
    return added


def augment_minority(output: Path, counts: Counter, max_ratio: float, stats: Counter) -> None:
    minority = 0 if counts[0] < counts[1] else 1
    majority = 1 - minority
    if counts[minority] == 0 or counts[majority] <= max_ratio * counts[minority]:
        return
    candidates: list[tuple[Path, list[Box]]] = []
    images_dir, labels_dir = output / "images" / "train", output / "labels" / "train"
    for image_path in image_files(images_dir):
        boxes = parse_labels(label_path(image_path, images_dir, labels_dir), {0: 0, 1: 1}, Counter())
        gain = sum(box.cls == minority for box in boxes)
        majority_gain = sum(box.cls == majority for box in boxes)
        if gain and majority_gain < max_ratio * gain:
            candidates.append((image_path, boxes))
    candidates.sort(key=lambda item: sum(box.cls == minority for box in item[1]), reverse=True)
    index = 0
    limit = max(1, len(candidates) * 3)
    while candidates and counts[majority] > max_ratio * counts[minority] and index < limit:
        image_path, boxes = candidates[index % len(candidates)]
        with Image.open(image_path) as source:
            flipped = source.convert("RGB").transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        stem = f"{image_path.stem}_minority_flip_{index:05d}"
        flipped.save(images_dir / f"{stem}.jpg", quality=95)
        flipped_boxes = [Box(box.cls, 1.0 - box.x, box.y, box.w, box.h) for box in boxes]
        write_labels(labels_dir / f"{stem}.txt", flipped_boxes)
        counts.update(box.cls for box in flipped_boxes)
        stats["minority_augmented_images"] += 1
        index += 1


def trim_train_backgrounds(output: Path, target_ratio: float, stats: Counter) -> None:
    images_dir, labels_dir = output / "images" / "train", output / "labels" / "train"
    images = image_files(images_dir)
    backgrounds = [image for image in images if not label_path(image, images_dir, labels_dir).read_text(encoding="utf-8").strip()]
    labeled_count = len(images) - len(backgrounds)
    target_count = round(labeled_count * target_ratio / (1 - target_ratio))
    for image in backgrounds[target_count:]:
        image.unlink()
        label_path(image, images_dir, labels_dir).unlink(missing_ok=True)
        stats["excess_background_removed"] += 1


def main() -> None:
    parser = argparse.ArgumentParser(description="YOLO fire/smoke 데이터셋을 원본 보존 방식으로 정제")
    parser.add_argument("--source", action="append", required=True, help="이름::경로[::기존=새,...]")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--background-dir", type=Path)
    parser.add_argument("--background-ratio", type=float, default=0.075)
    parser.add_argument("--near-duplicate-distance", type=int, default=4)
    parser.add_argument("--max-class-ratio", type=float, default=3.0)
    parser.add_argument("--val-ratio", type=float, default=0.10)
    parser.add_argument("--sample-count", type=int, default=6)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    if not 0.05 <= args.background_ratio <= 0.10:
        parser.error("--background-ratio는 0.05~0.10이어야 합니다.")
    if not 0.0 <= args.val_ratio < 0.5:
        parser.error("--val-ratio는 0 이상 0.5 미만이어야 합니다.")
    if args.output.exists() and any(args.output.iterdir()):
        parser.error("출력 폴더가 비어 있지 않습니다. 원본/기존 결과 보호를 위해 새 경로를 사용하세요.")

    random.seed(args.seed)
    sources = [parse_source(spec) for spec in args.source]
    args.output.mkdir(parents=True, exist_ok=True)
    stats: Counter = Counter()
    records: dict[str, list[dict]] = defaultdict(list)
    exact_seen: dict[str, str] = {}
    test_hashes: list[int] = []

    # test를 먼저 고정하여 train/test 중복 시 train만 제외한다.
    for split in ("test", "val", "train"):
        for source_name, root, class_map in sources:
            images_dir, labels_dir = source_layout(root, split)
            image_stems = {path.relative_to(images_dir).with_suffix("") for path in image_files(images_dir)}
            if labels_dir.exists():
                stats["orphan_label"] += sum(
                    1 for path in labels_dir.rglob("*.txt") if path.relative_to(labels_dir).with_suffix("") not in image_stems
                )
            for image_path in image_files(images_dir):
                try:
                    with Image.open(image_path) as image:
                        image.verify()
                    with Image.open(image_path) as image:
                        perceptual = dhash(image)
                    digest = sha256(image_path)
                except (OSError, UnidentifiedImageError):
                    stats["broken_image"] += 1
                    continue
                if digest in exact_seen:
                    stats["exact_duplicate"] += 1
                    continue
                if split == "train" and any(hamming(perceptual, test_hash) <= args.near_duplicate_distance for test_hash in test_hashes):
                    stats["train_test_near_duplicate"] += 1
                    continue
                source_label = label_path(image_path, images_dir, labels_dir)
                if not source_label.exists():
                    stats["missing_label"] += 1
                    continue
                boxes = parse_labels(source_label, class_map, stats)
                unique = f"{source_name}_{digest[:12]}{image_path.suffix.lower()}"
                destination = args.output / "images" / split / unique
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(image_path, destination)
                write_labels(args.output / "labels" / split / Path(unique).with_suffix(".txt"), boxes)
                exact_seen[digest] = split
                if split == "test":
                    test_hashes.append(perceptual)
                records[split].append({"image": destination, "boxes": boxes, "source": source_name, "hash": digest})

    if not records["val"] and records["train"] and args.val_ratio:
        candidates = records["train"][:]
        random.Random(args.seed).shuffle(candidates)
        selected = {item["hash"] for item in candidates[: round(len(candidates) * args.val_ratio)]}
        kept_train = []
        for item in records["train"]:
            if item["hash"] not in selected:
                kept_train.append(item)
                continue
            old_image = item["image"]
            old_label = args.output / "labels" / "train" / old_image.with_suffix(".txt").name
            new_image = args.output / "images" / "val" / old_image.name
            new_label = args.output / "labels" / "val" / old_label.name
            new_image.parent.mkdir(parents=True, exist_ok=True)
            new_label.parent.mkdir(parents=True, exist_ok=True)
            old_image.replace(new_image)
            old_label.replace(new_label)
            item["image"] = new_image
            records["val"].append(item)
        records["train"] = kept_train
        stats["auto_val_images"] = len(records["val"])

    for source_name, _, _ in sources:
        candidates = [item for split in SPLITS for item in records[split] if item["source"] == source_name and item["boxes"]]
        random.shuffle(candidates)
        for index, item in enumerate(candidates[: args.sample_count]):
            render_sample(item["image"], item["boxes"], args.output / "audit_samples" / source_name / f"sample_{index:02d}.jpg")

    train_records = records["train"]
    background_count = sum(not item["boxes"] for item in train_records)
    target_backgrounds = round((len(train_records) * args.background_ratio - background_count) / (1 - args.background_ratio))
    copy_backgrounds(args.background_dir, args.output, max(0, target_backgrounds), set(exact_seen), stats)
    trim_train_backgrounds(args.output, args.background_ratio, stats)

    class_counts: Counter = Counter(box.cls for item in train_records for box in item["boxes"])
    augment_minority(args.output, class_counts, args.max_class_ratio, stats)
    final_train = len(image_files(args.output / "images" / "train"))
    final_backgrounds = sum(1 for path in (args.output / "labels" / "train").glob("*.txt") if not path.read_text(encoding="utf-8").strip())
    stats.update({"train_images": final_train, "val_images": len(records["val"]), "test_images": len(records["test"]), "smoke_boxes": class_counts[0], "fire_boxes": class_counts[1]})
    report = {
        "class_definition": TARGET_NAMES,
        "source_class_maps": {name: mapping for name, _, mapping in sources},
        "background_ratio": final_backgrounds / final_train if final_train else 0.0,
        "stats": dict(sorted(stats.items())),
        "note": "audit_samples에서 0=smoke(초록), 1=fire(빨강)를 육안 확인하세요.",
    }
    (args.output / "data.yaml").write_text(
        f"path: {args.output.as_posix()}\ntrain: images/train\nval: images/val\ntest: images/test\nnames:\n  0: smoke\n  1: fire\n",
        encoding="utf-8",
    )
    (args.output / "cleaning_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
