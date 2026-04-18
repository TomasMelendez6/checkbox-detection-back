#!/usr/bin/env python3
"""Train YOLOv8 on data/dataset (single class: checkbox)."""

from __future__ import annotations

import argparse
import os
import sys


def main() -> int:
    p = argparse.ArgumentParser(description="Train YOLOv8n checkbox detector.")
    p.add_argument(
        "--data",
        default=os.path.join("data", "dataset", "data.yaml"),
        help="Path to data.yaml",
    )
    p.add_argument("--model", default="yolov8n.pt", help="Base weights (yolov8n.pt, yolov8s.pt, ...)")
    p.add_argument("--epochs", type=int, default=150)
    p.add_argument("--imgsz", type=int, default=640)
    p.add_argument("--batch", type=int, default=8)
    p.add_argument("--patience", type=int, default=40, help="Early stopping patience")
    p.add_argument("--name", default="checkbox", help="run name under runs/detect/")
    args = p.parse_args()

    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    os.chdir(root)

    data_yaml = os.path.abspath(args.data)
    if not os.path.isfile(data_yaml):
        print(f"missing data yaml: {data_yaml}", file=sys.stderr)
        return 2

    try:
        from ultralytics import YOLO
    except ImportError:
        print("install: pip install -r requirements-ml.txt", file=sys.stderr)
        return 2

    model = YOLO(args.model)
    model.train(
        data=data_yaml,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        patience=args.patience,
        name=args.name,
        exist_ok=True,
    )
    print(f"done. weights: runs/detect/{args.name}/weights/best.pt")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
