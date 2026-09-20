"""
tune.py  —  Grid-search pipeline parameters to maximize mean Dice/IoU.

Searches over adaptive-threshold, morphology, and shape-filter parameters,
evaluates each combination on a subset of CrackForest, and prints the top
results. Copy the best values into the defaults in segmentation.py /
morphology.py / shape_filter.py (or use --apply to write a tuned_params.json).

Usage
-----
python src/tune.py --images data/raw/images --masks data/raw/masks --subset 25
python src/tune.py --images data/raw/images --masks data/raw/masks --subset 25 --apply
"""
import argparse
import glob
import itertools
import json
import os

import cv2
import numpy as np

import sys
sys.path.insert(0, os.path.dirname(__file__))
from preprocessing import preprocess          # noqa: E402
from segmentation import segment_adaptive      # noqa: E402
from morphology import apply_morphology         # noqa: E402
from shape_filter import filter_shapes          # noqa: E402
from evaluate import pixel_metrics, average_metrics  # noqa: E402

# ---- search space (edit these lists to widen/narrow the search) ----
GRID = {
    "block_size": [25, 35, 51, 75],
    "C":          [5, 10, 15],
    "close_ksize":[3, 5, 7],
    "open_ksize": [3, 5],
    "min_area":   [50, 120, 250],
    "min_aspect": [2.0, 3.0, 4.0],
}


def load_pairs(img_dir, mask_dir, subset):
    pairs = []
    for img_path in sorted(glob.glob(os.path.join(img_dir, "*"))):
        stem = os.path.splitext(os.path.basename(img_path))[0]
        # find matching mask by stem
        matches = glob.glob(os.path.join(mask_dir, stem + ".*"))
        if not matches:
            continue
        pairs.append((img_path, matches[0]))
    if subset and subset < len(pairs):
        # evenly sample `subset` pairs for a fast, representative search
        idx = np.linspace(0, len(pairs) - 1, subset).astype(int)
        pairs = [pairs[i] for i in idx]
    return pairs


def run_combo(pre_grays, gts, p):
    metrics = []
    for gray, gt in zip(pre_grays, gts):
        seg = segment_adaptive(gray, block_size=p["block_size"], C=p["C"])
        morph = apply_morphology(seg, p["close_ksize"], p["open_ksize"])
        mask = filter_shapes(morph, p["min_area"], p["min_aspect"])
        metrics.append(pixel_metrics(mask, gt))
    return average_metrics(metrics)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--images", default="data/raw/images")
    ap.add_argument("--masks", default="data/raw/masks")
    ap.add_argument("--subset", type=int, default=25,
                    help="how many images to search on (0 = all)")
    ap.add_argument("--apply", action="store_true",
                    help="write best params to outputs/tuned_params.json")
    ap.add_argument("--top", type=int, default=8)
    args = ap.parse_args()

    pairs = load_pairs(args.images, args.masks, args.subset)
    if not pairs:
        raise SystemExit("No image/mask pairs found — check --images/--masks.")
    print(f"Searching on {len(pairs)} images...")

    # pre-process once (same for every combo) to save time
    pre_grays, gts = [], []
    for img_path, mask_path in pairs:
        img = cv2.imread(img_path)
        gt = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
        pre_grays.append(preprocess(img))
        gts.append(gt)

    keys = list(GRID.keys())
    combos = list(itertools.product(*[GRID[k] for k in keys]))
    print(f"Testing {len(combos)} parameter combinations...\n")

    results = []
    for i, values in enumerate(combos, 1):
        p = dict(zip(keys, values))
        m = run_combo(pre_grays, gts, p)
        results.append((m["dice"], m["iou"], m["precision"], m["recall"], p))
        if i % 50 == 0:
            print(f"  ...{i}/{len(combos)}")

    results.sort(reverse=True, key=lambda r: r[0])  # by Dice
    print("\n=== TOP RESULTS (by Dice) ===")
    print(f"{'Dice':>6} {'IoU':>6} {'Prec':>6} {'Rec':>6}  params")
    for dice, iou, prec, rec, p in results[:args.top]:
        print(f"{dice:>6} {iou:>6} {prec:>6} {rec:>6}  {p}")

    best = results[0][4]
    print("\nBest params:", best)

    if args.apply:
        os.makedirs("outputs", exist_ok=True)
        with open("outputs/tuned_params.json", "w") as f:
            json.dump(best, f, indent=2)
        print("Wrote outputs/tuned_params.json")


if __name__ == "__main__":
    main()
