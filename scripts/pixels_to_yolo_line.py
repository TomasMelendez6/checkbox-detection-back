#!/usr/bin/env python3
"""Print one YOLO label line from a pixel bbox (x2,y2 exclusive)."""

from __future__ import annotations

import argparse
import sys

import cv2


def to_yolo_line(img_w: int, img_h: int, x1: int, y1: int, x2: int, y2: int, class_id: int = 0) -> str:
    w = max(0, x2 - x1)
    h = max(0, y2 - y1)
    if w <= 0 or h <= 0:
        raise ValueError("empty box")
    xc = (x1 + x2) / 2.0 / img_w
    yc = (y1 + y2) / 2.0 / img_h
    wn = w / float(img_w)
    hn = h / float(img_h)
    return f"{class_id} {xc:.6f} {yc:.6f} {wn:.6f} {hn:.6f}"


def main() -> int:
    p = argparse.ArgumentParser(
        description="Print one YOLO label line from pixel coordinates (x2,y2 = exclusive corner)."
    )
    p.add_argument("--image", required=True, help="Image to read width/height from")
    p.add_argument(
        "--box",
        type=int,
        nargs=4,
        metavar=("X1", "Y1", "X2", "Y2"),
        action="append",
        help="One box; repeat --box for several lines",
    )
    args = p.parse_args()
    bgr = cv2.imread(args.image, cv2.IMREAD_COLOR)
    if bgr is None:
        print("failed to read image", file=sys.stderr)
        return 2
    H, W = bgr.shape[:2]
    if not args.box:
        print("pass at least one --box x1 y1 x2 y2", file=sys.stderr)
        return 2
    for b in args.box:
        x1, y1, x2, y2 = b
        line = to_yolo_line(W, H, x1, y1, x2, y2)
        print(line)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
