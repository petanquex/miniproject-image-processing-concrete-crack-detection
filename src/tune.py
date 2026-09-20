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

Use --holdout to keep part of the dataset out of the search, so the reported
score is measured on images the parameters were never fitted on:

python src/tune.py --subset 0 --holdout 0.5 --apply
"""
import argparse
import csv
import glob
import itertools
import json
import os

import cv2
import numpy as np

import sys
sys.path.insert(0, os.path.dirname(__file__))
from preprocessing import preprocess          # noqa: E402
from segmentation import segment_adaptive, segment_otsu  # noqa: E402
from morphology import apply_morphology         # noqa: E402
from shape_filter import filter_shapes          # noqa: E402
from evaluate import pixel_metrics, average_metrics  # noqa: E402

# ---- search space (edit these lists to widen/narrow the search) ----
# Round 2: the round-1 best sat on the edge of the old grid (C at the maximum,
# kernels and min_area at the minimum), so every edge is pushed outwards here.
# ksize = 1 means "skip this morphological step" (a 1x1 kernel is a no-op).
GRID = {
    "block_size": [15, 25, 35, 51, 75],
    "C":          [10, 12, 15, 18, 21, 25],
    "close_ksize":[1, 3, 5],
    "open_ksize": [1, 3],
    "min_area":   [10, 20, 35, 50, 80],
    "min_aspect": [1.5, 2.0, 3.0, 4.0],
}

# Otsu picks one global threshold from the histogram: it has no window size and
# no offset, so those two columns stay at 0 and only the morphology and shape
# parameters are searched. Keeping the same six columns lets one CSV format and
# one selection script serve both methods.
GRID_OTSU = {
    "block_size": [0],
    "C":          [0],
    "close_ksize":[1, 3, 5],
    "open_ksize": [1, 3],
    "min_area":   [10, 20, 35, 50, 80, 120],
    "min_aspect": [1.0, 1.5, 2.0, 3.0, 4.0],
}

KEYS = list(GRID.keys())


def grid_for(method):
    return GRID_OTSU if method == "otsu" else GRID


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


def split_pairs(pairs, holdout):
    """
    Split into (train, test). Test images are taken at a fixed stride so both
    halves span the whole dataset instead of one contiguous block.
    holdout <= 0 puts everything in train and leaves test empty.
    """
    if holdout <= 0:
        return pairs, []
    step = max(2, int(round(1.0 / holdout)))
    test = pairs[step - 1::step]
    test_set = set(test)
    train = [q for q in pairs if q not in test_set]
    return train, test


def load_stage(pairs):
    """Read + pre-process once; the result is reused by every combination."""
    pre_grays, gts = [], []
    for img_path, mask_path in pairs:
        pre_grays.append(preprocess(cv2.imread(img_path)))
        gts.append(cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE))
    return pre_grays, gts


def run_per_image(pre_grays, gts, p, method="adaptive"):
    """Run the tunable part of the pipeline; return one metrics dict per image."""
    metrics = []
    for gray, gt in zip(pre_grays, gts):
        if method == "otsu":
            seg = segment_otsu(gray)
        else:
            seg = segment_adaptive(gray, block_size=p["block_size"], C=p["C"])
        morph = apply_morphology(seg, p["close_ksize"], p["open_ksize"])
        mask = filter_shapes(morph, p["min_area"], p["min_aspect"])
        metrics.append(pixel_metrics(mask, gt))
    return metrics


def run_combo(pre_grays, gts, p, method="adaptive"):
    return average_metrics(run_per_image(pre_grays, gts, p, method))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--images", default="data/raw/images")
    ap.add_argument("--masks", default="data/raw/masks")
    ap.add_argument("--subset", type=int, default=25,
                    help="how many images to search on (0 = all)")
    ap.add_argument("--holdout", type=float, default=0.0,
                    help="fraction of images kept out of the search and used "
                         "only to score the winner (0 = no split)")
    ap.add_argument("--apply", action="store_true",
                    help="write best params to outputs/tuned_params.json")
    ap.add_argument("--method", default="adaptive", choices=["adaptive", "otsu"],
                    help="which segmentation step to search over")
    ap.add_argument("--top", type=int, default=8)
    ap.add_argument("--csv", default=None,
                    help="write every combination and its scores to this file")
    args = ap.parse_args()

    if args.apply and args.method != "adaptive":
        raise SystemExit(
            "--apply only makes sense for the adaptive method: the shipped "
            "pipeline uses adaptive thresholding and tuned_params.json has no "
            "method field. Otsu is a comparison baseline - drop --apply.")

    pairs = load_pairs(args.images, args.masks, args.subset)
    if not pairs:
        raise SystemExit("No image/mask pairs found - check --images/--masks.")

    train_pairs, test_pairs = split_pairs(pairs, args.holdout)
    if test_pairs:
        print(f"Searching on {len(train_pairs)} images, "
              f"holding out {len(test_pairs)} for scoring...")
    else:
        print(f"Searching on {len(train_pairs)} images...")

    # pre-process once (same for every combo) to save time
    pre_grays, gts = load_stage(train_pairs)
    test_grays, test_gts = load_stage(test_pairs)

    grid = grid_for(args.method)
    keys = KEYS
    combos = list(itertools.product(*[grid[k] for k in keys]))
    print(f"Testing {len(combos)} parameter combinations...\n")

    results = []
    for i, values in enumerate(combos, 1):
        p = dict(zip(keys, values))
        m = run_combo(pre_grays, gts, p, args.method)
        results.append((m["dice"], m["iou"], m["precision"], m["recall"], p))
        if i % 100 == 0:
            print(f"  ...{i}/{len(combos)}")

    results.sort(reverse=True, key=lambda r: r[0])  # by Dice

    label = "train" if test_pairs else "search set"
    print(f"\n=== TOP RESULTS (by Dice on the {label}) ===")
    header = f"{'Dice':>6} {'IoU':>6} {'Prec':>6} {'Rec':>6}"
    if test_pairs:
        header += f" | {'Dice*':>6} {'IoU*':>6}"
    print(header + "  params")
    for dice, iou, prec, rec, p in results[:args.top]:
        line = f"{dice:>6} {iou:>6} {prec:>6} {rec:>6}"
        if test_pairs:
            t = run_combo(test_grays, test_gts, p, args.method)
            line += f" | {t['dice']:>6} {t['iou']:>6}"
        print(line + f"  {p}")
    if test_pairs:
        print("(* = held-out images, never used in the search)")

    best = results[0][4]
    print("\nBest params:", best)
    if test_pairs:
        t = run_combo(test_grays, test_gts, best, args.method)
        print("Held-out score:", t)

    if args.csv:
        os.makedirs(os.path.dirname(args.csv) or ".", exist_ok=True)
        with open(args.csv, "w", newline="") as f:
            w = csv.writer(f)
            w.writerow(keys + ["precision", "recall", "iou", "dice"])
            for dice, iou, prec, rec, p in results:
                w.writerow([p[k] for k in keys] + [prec, rec, iou, dice])
        print(f"Wrote {args.csv}")

    if args.apply:
        os.makedirs("outputs", exist_ok=True)
        with open("outputs/tuned_params.json", "w") as f:
            json.dump(best, f, indent=2)
        print("Wrote outputs/tuned_params.json")


if __name__ == "__main__":
    main()
