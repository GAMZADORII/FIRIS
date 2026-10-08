"""Convert existing event MP4V clips to browser-playable H.264, preserving originals."""

from __future__ import annotations

import argparse
import os
import subprocess
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def video_codec(path: Path) -> str:
    result = subprocess.run([
        "ffprobe", "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=codec_name", "-of", "default=nw=1:nk=1", str(path),
    ], check=True, capture_output=True, text=True)
    return result.stdout.strip()


def transcode(path: Path) -> bool:
    codec = video_codec(path)
    if codec == "h264":
        return False
    if codec != "mpeg4":
        raise RuntimeError(f"Unsupported video codec {codec!r}: {path}")
    temporary = path.with_name(path.stem + ".h264.tmp.mp4")
    backup = path.with_name(path.name + ".mp4v.bak")
    if backup.exists():
        raise FileExistsError(f"Original backup already exists: {backup}")
    if temporary.exists():
        raise FileExistsError(f"Temporary output already exists: {temporary}")
    try:
        subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(path),
            "-an", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
            "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart", str(temporary),
        ], check=True)
        if video_codec(temporary) != "h264":
            raise RuntimeError(f"H.264 verification failed: {temporary}")
        os.link(path, backup)
        temporary.replace(path)
        return True
    finally:
        temporary.unlink(missing_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=PROJECT_ROOT / "storage" / "events")
    args = parser.parse_args()
    clips = sorted(path for path in args.root.glob("*/event*.mp4")
                   if path.name in ("event.mp4", "event_annotated.mp4"))
    converted = 0
    for index, path in enumerate(clips, 1):
        if transcode(path):
            converted += 1
        if index % 10 == 0 or index == len(clips):
            print(f"checked {index}/{len(clips)}, converted {converted}", flush=True)


if __name__ == "__main__":
    main()
