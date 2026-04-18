#!/usr/bin/env python3
"""Heuristic checkbox detection (OpenCV). JSON on stdout."""

from __future__ import annotations

import argparse
import json
import sys
from typing import List, Tuple

import cv2
import numpy as np

Box = Tuple[int, int, int, int, bool]  # x1,y1,x2,y2,is_checked

DETECTOR_VERSION = "median-local-ring-v3-elongated-blob"


def iou(a: Tuple[int, int, int, int], b: Tuple[int, int, int, int]) -> float:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0, ix2 - ix1), max(0, iy2 - iy1)
    inter = iw * ih
    if inter == 0:
        return 0.0
    aa = max(0, ax2 - ax1) * max(0, ay2 - ay1)
    bb = max(0, bx2 - bx1) * max(0, by2 - by1)
    union = aa + bb - inter
    return inter / union if union > 0 else 0.0


def nms(boxes: List[Tuple[int, int, int, int]], thr: float = 0.35) -> List[int]:
    if not boxes:
        return []
    areas = [(max(0, x2 - x1) * max(0, y2 - y1), i) for i, (x1, y1, x2, y2) in enumerate(boxes)]
    areas.sort(reverse=True)
    keep: List[int] = []
    suppressed = [False] * len(boxes)
    for _, idx in areas:
        if suppressed[idx]:
            continue
        keep.append(idx)
        for j in range(len(boxes)):
            if j == idx or suppressed[j]:
                continue
            if iou(boxes[idx], boxes[j]) > thr:
                suppressed[j] = True
    return keep


def plausible_checkbox(th: np.ndarray, x1: int, y1: int, x2: int, y2: int) -> bool:
    H, W = th.shape[:2]
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(W, x2), min(H, y2)
    bw, bh = x2 - x1, y2 - y1
    max_px = int(0.12 * min(H, W)) + 1
    if min(bw, bh) < 8 or max(bw, bh) > max(48, max_px):
        return False
    roi = th[y1:y2, x1:x2]
    h0, w0 = roi.shape[:2]
    if h0 < 8 or w0 < 8:
        return False
    roi_f = roi.astype(np.float32) / 255.0
    midy, midx = h0 // 2, w0 // 2
    ink = roi > 200
    quads = (
        ink[:midy, :midx],
        ink[:midy, midx:],
        ink[midy:, :midx],
        ink[midy:, midx:],
    )
    dens = [float(np.mean(q)) for q in quads if q.size > 0]
    if len(dens) < 4:
        return False
    qs = float(np.std(dens))
    if qs > 0.34:
        return False
    ar = bw / float(bh) if bh > 0 else 1.0
    if max(ar, 1.0 / ar) > 1.55:
        inset2 = max(1, int(0.25 * min(h0, w0)))
        core2 = roi_f[inset2 : h0 - inset2, inset2 : w0 - inset2]
        ring2 = np.concatenate(
            [
                roi_f[:inset2, :].ravel(),
                roi_f[h0 - inset2 :, :].ravel(),
                roi_f[inset2 : h0 - inset2, :inset2].ravel(),
                roi_f[inset2 : h0 - inset2, w0 - inset2 :].ravel(),
            ]
        )
        if ring2.size == 0 or core2.size == 0:
            return True
        r_ink = float(np.mean(ring2))
        c_ink = float(np.mean(core2))
        if max(r_ink, c_ink) >= 0.65:
            return True
        if c_ink > r_ink + 0.08 and c_ink < 0.48:
            return False
    return True


def classify(gray: np.ndarray, x1: int, y1: int, x2: int, y2: int, bright_ref: float) -> bool:
    h, w = gray.shape[:2]
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w, x2), min(h, y2)
    if x2 - x1 < 4 or y2 - y1 < 4:
        return False
    bw, bh = x2 - x1, y2 - y1
    pad = max(5, int(0.9 * min(bw, bh)))
    px1, py1 = max(0, x1 - pad), max(0, y1 - pad)
    px2, py2 = min(w, x2 + pad), min(h, y2 + pad)
    patch = gray[py1:py2, px1:px2]
    ph, pw = patch.shape
    if ph < 2 or pw < 2:
        return False
    qx1, qy1 = x1 - px1, y1 - py1
    qx2, qy2 = x2 - px1, y2 - py1
    if qx2 - qx1 > 2 and qy2 - qy1 > 2:
        qx1, qy1, qx2, qy2 = qx1 + 1, qy1 + 1, qx2 - 1, qy2 - 1
    ys, xs = np.mgrid[0:ph, 0:pw]
    ring = (xs < qx1) | (xs >= qx2) | (ys < qy1) | (ys >= qy2)
    ring_px = patch[ring]
    if ring_px.size >= 12:
        paper_local = float(np.mean(ring_px))
    else:
        paper_local = max(float(np.mean(gray)), bright_ref * 0.85)
    if paper_local < 130:
        return False
    inset = max(2, int(0.32 * min(bw, bh)))
    inner = gray[y1 + inset : y2 - inset, x1 + inset : x2 - inset]
    if inner.size == 0:
        return False
    med = float(np.median(inner))
    return med < paper_local - 10.0


def detect(gray: np.ndarray) -> List[Box]:
    h, w = gray.shape[:2]
    img_area = float(h * w)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    th = cv2.adaptiveThreshold(
        blur, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 25, 10
    )
    contours, _ = cv2.findContours(th, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    bright_ref = float(np.percentile(blur, 97))
    if bright_ref < 1:
        bright_ref = 255.0

    raw: List[Tuple[int, int, int, int]] = []
    for cnt in contours:
        a = abs(cv2.contourArea(cnt))
        if a < img_area * 9e-5 or a > img_area * 0.0025:
            continue
        peri = cv2.arcLength(cnt, True)
        if peri < 1:
            continue
        approx = cv2.approxPolyDP(cnt, 0.035 * peri, True)
        if len(approx) != 4:
            continue
        x, y, bw, bh = cv2.boundingRect(approx)
        ar = bw / float(bh) if bh > 0 else 0
        if ar < 0.55 or ar > 1.9:
            continue
        x1, y1, x2, y2 = x, y, x + bw, y + bh
        if not plausible_checkbox(th, x1, y1, x2, y2):
            continue
        raw.append((x1, y1, x2, y2))

    keep_idx = nms(raw, thr=0.35)
    out: List[Box] = []
    for i in keep_idx:
        x1, y1, x2, y2 = raw[i]
        chk = classify(gray, x1, y1, x2, y2, bright_ref)
        out.append((x1, y1, x2, y2, chk))
    return out


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--image", required=True)
    args = p.parse_args()

    bgr = cv2.imread(args.image, cv2.IMREAD_COLOR)
    if bgr is None:
        print("failed to read image", file=sys.stderr)
        return 2

    orig_h, orig_w = int(bgr.shape[0]), int(bgr.shape[1])

    scale = 1.0
    max_side = max(orig_h, orig_w)
    if max_side > 2200:
        scale = 2200.0 / max_side
        bgr = cv2.resize(bgr, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)

    boxes = detect(gray)
    payload = {
        "detector_version": DETECTOR_VERSION,
        "image_width": orig_w,
        "image_height": orig_h,
        "boxes": [
            {
                "bbox": [
                    int(round(x1 / scale)),
                    int(round(y1 / scale)),
                    int(round(x2 / scale)),
                    int(round(y2 / scale)),
                ],
                "is_checked": bool(chk),
            }
            for (x1, y1, x2, y2, chk) in boxes
        ]
    }
    sys.stdout.write(json.dumps(payload))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
