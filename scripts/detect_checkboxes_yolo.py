#!/usr/bin/env python3
"""YOLO checkbox detection; JSON on stdout (same shape as detect_checkboxes.py)."""

from __future__ import annotations

import argparse
import contextlib
import importlib.util
import io
import json
import os
import sys
from typing import Any, List

import cv2
import numpy as np

def _env_float(key: str, default: float) -> float:
    v = os.environ.get(key, "").strip()
    if not v:
        return default
    try:
        return float(v)
    except ValueError:
        return default


def _default_weights() -> str:
    w = os.environ.get("DETECTOR_WEIGHTS", "").strip()
    if w:
        return w
    return os.path.join("runs", "detect", "checkbox", "weights", "best.pt")


def _load_heuristic_classify():
    path = os.path.join(os.path.dirname(__file__), "detect_checkboxes.py")
    spec = importlib.util.spec_from_file_location("detect_checkboxes_heur", path)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod.classify


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--image", required=True)
    p.add_argument(
        "--weights",
        default=_default_weights(),
        help="YOLO .pt weights; env DETECTOR_WEIGHTS overrides default path",
    )
    p.add_argument(
        "--conf",
        type=float,
        default=_env_float("DETECTOR_CONF", 0.25),
        help="min confidence; env DETECTOR_CONF overrides default",
    )
    p.add_argument("--iou", type=float, default=0.45, help="NMS iou threshold")
    p.add_argument(
        "--no-classify",
        action="store_true",
        help="if set, is_checked is always false (only boxes)",
    )
    args = p.parse_args()

    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    os.chdir(root)

    os.environ.setdefault("YOLO_VERBOSE", "False")
    os.environ.setdefault("ULTRALYTICS_VERBOSE", "False")

    try:
        with contextlib.redirect_stdout(io.StringIO()):
            from ultralytics import YOLO
    except ImportError:
        print("install: pip install -r requirements-ml.txt", file=sys.stderr)
        return 2

    weights = args.weights if os.path.isabs(args.weights) else os.path.join(root, args.weights)
    if not os.path.isfile(weights):
        print(f"missing weights: {weights}", file=sys.stderr)
        return 2

    img_path = args.image if os.path.isabs(args.image) else os.path.join(root, args.image)
    img_path = os.path.normpath(img_path)
    bgr = cv2.imread(img_path, cv2.IMREAD_COLOR)
    if bgr is None:
        print("failed to read image", file=sys.stderr)
        return 2

    orig_h, orig_w = int(bgr.shape[0]), int(bgr.shape[1])
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    bright_ref = float(np.percentile(blur, 97))
    if bright_ref < 1:
        bright_ref = 255.0

    classify = _load_heuristic_classify() if not args.no_classify else None

    with contextlib.redirect_stdout(io.StringIO()):
        model = YOLO(weights)
        res = model.predict(
            source=bgr,
            conf=args.conf,
            iou=args.iou,
            verbose=False,
        )
    if not res:
        boxes_out: List[dict[str, Any]] = []
    else:
        r0 = res[0]
        xyxy = r0.boxes.xyxy.cpu().numpy() if r0.boxes is not None and len(r0.boxes) else np.zeros((0, 4))
        confs = r0.boxes.conf.cpu().numpy() if r0.boxes is not None and len(r0.boxes) else []
        boxes_out = []
        for i, row in enumerate(xyxy):
            x1, y1, x2, y2 = float(row[0]), float(row[1]), float(row[2]), float(row[3])
            xi1 = int(round(x1))
            yi1 = int(round(y1))
            xi2 = int(round(x2))
            yi2 = int(round(y2))
            chk = False
            if classify is not None:
                chk = bool(classify(gray, xi1, yi1, xi2, yi2, bright_ref))
            boxes_out.append(
                {
                    "bbox": [xi1, yi1, xi2, yi2],
                    "is_checked": chk,
                    "confidence": float(confs[i]) if len(confs) > i else None,
                }
            )

    # API model only has bbox + is_checked; strip confidence for strict match
    payload = {
        "boxes": [{"bbox": b["bbox"], "is_checked": b["is_checked"]} for b in boxes_out],
    }
    sys.stdout.write(json.dumps(payload))
    sys.stdout.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
