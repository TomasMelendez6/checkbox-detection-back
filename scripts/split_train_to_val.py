#!/usr/bin/env python3
"""Move random image+label pairs from data/dataset/.../train to .../val."""

from __future__ import annotations

import argparse
import os
import random
import shutil
import sys

IMG_EXT = (".jpg", ".jpeg", ".png", ".bmp", ".webp")


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument(
        "--dataset",
        default=os.path.join("data", "dataset"),
        help="Root folder containing images/train, labels/train, images/val, labels/val",
    )
    p.add_argument(
        "--fraction",
        type=float,
        default=0.2,
        help="Fraction of train images to move to val (default 0.2 = 20%%)",
    )
    p.add_argument("--seed", type=int, default=42)
    args = p.parse_args()

    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    os.chdir(root)

    ds = os.path.abspath(args.dataset)
    img_train = os.path.join(ds, "images", "train")
    lbl_train = os.path.join(ds, "labels", "train")
    img_val = os.path.join(ds, "images", "val")
    lbl_val = os.path.join(ds, "labels", "val")

    for d in (img_train, lbl_train, img_val, lbl_val):
        os.makedirs(d, exist_ok=True)

    stems: list[str] = []
    for name in os.listdir(img_train):
        low = name.lower()
        if not low.endswith(IMG_EXT):
            continue
        stem, _ = os.path.splitext(name)
        stems.append(stem)

    if not stems:
        print(f"no images found in {img_train}", file=sys.stderr)
        return 2

    random.seed(args.seed)
    random.shuffle(stems)
    n_move = max(1, int(round(len(stems) * args.fraction)))
    to_move = set(stems[:n_move])

    moved = 0
    for stem in to_move:
        img_name = None
        for name in os.listdir(img_train):
            base, ext = os.path.splitext(name)
            if base.lower() != stem.lower():
                continue
            if ext.lower() not in IMG_EXT:
                continue
            img_name = name
            break
        if not img_name:
            continue
        stem_file, _ = os.path.splitext(img_name)
        src_img = os.path.join(img_train, img_name)
        dst_img = os.path.join(img_val, img_name)
        shutil.move(src_img, dst_img)
        src_lbl = os.path.join(lbl_train, stem_file + ".txt")
        dst_lbl = os.path.join(lbl_val, stem_file + ".txt")
        if os.path.isfile(src_lbl):
            shutil.move(src_lbl, dst_lbl)
        else:
            open(dst_lbl, "a").close()
        moved += 1

    print(f"moved {moved} pairs to val (from {len(stems)} train images, fraction={args.fraction})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
