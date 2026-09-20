"""
tune_preprocess.py  -  Tune and ablate step 1 (pre-processing)  [Member 1]

tune.py cannot search these parameters: it pre-processes every image once and
reuses the result for all ~4000 combinations, which is what makes it fast, but
it also means blur_ksize / clip_limit / tile were never part of any search.
They have been at their day-one defaults the whole project.

This script closes that gap. Steps 2-4 are held fixed at the shipped values
from outputs/tuned_params.json, and only the pre-processing parameters vary, so
any difference in Dice is attributable to step 1 alone.

Selection uses the same protocol as select_params.py: search on the training
half, score the winner once on the held-out half, and prefer combinations that
are stable across 5 folds (mean - std) rather than whichever one peaks.

Usage
-----
python src/tune_preprocess.py
python src/tune_preprocess.py --csv outputs/tune_results_preprocess.csv --apply
"""
import argparse
import csv
import itertools
import json
import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from preprocessing import preprocess              # noqa: E402
from pipeline import load_params                  # noqa: E402
from tune import load_pairs, split_pairs, KEYS, run_per_image   # noqa: E402
from select_params import read_results, VARIANTS               # noqa: E402
from evaluate import average_metrics              # noqa: E402

PRE_KEYS = ["blur_ksize", "clip_limit", "tile"]

# blur_ksize = 1 means "no blur"; clip_limit = 0 means "no CLAHE".
# Both are ablations, not just small values.
PRE_GRID = {
    "blur_ksize": [1, 3, 5, 7, 9],
    "clip_limit": [0.0, 1.0, 2.0, 3.0, 4.0],
    "tile": [4, 8, 16],
}

TUNED_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "outputs", "tuned_params.json")


def pre_combos():
    """All pre-processing combinations, minus duplicates.

    When CLAHE is off the tile size does nothing, so those combinations would
    otherwise be evaluated three times each.
    """
    seen, out = set(), []
    for values in itertools.product(*[PRE_GRID[k] for k in PRE_KEYS]):
        p = dict(zip(PRE_KEYS, values))
        if p["clip_limit"] <= 0:
            p["tile"] = PRE_GRID["tile"][0]
        key = tuple(p[k] for k in PRE_KEYS)
        if key not in seen:
            seen.add(key)
            out.append(p)
    return out


def describe(p):
    blur = "no blur" if p["blur_ksize"] <= 1 else f"blur {p['blur_ksize']}"
    clahe = ("no CLAHE" if p["clip_limit"] <= 0
             else f"CLAHE {p['clip_limit']}/{p['tile']}")
    return f"{blur}, {clahe}"


def dices(pairs, pre, fixed):
    """Per-image Dice for one pre-processing setting."""
    grays, gts = [], []
    for img_path, mask_path in pairs:
        grays.append(preprocess(cv2.imread(img_path), **pre))
        gts.append(cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE))
    metrics = run_per_image(grays, gts, fixed)
    return np.array([m["dice"] for m in metrics]), metrics


def fold_score(d, n_folds=5):
    fm = np.array([d[np.arange(len(d)) % n_folds == f].mean()
                   for f in range(n_folds)])
    return fm.mean() - fm.std(), fm.mean()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--images", default="data/raw/images")
    ap.add_argument("--masks", default="data/raw/masks")
    ap.add_argument("--holdout", type=float, default=0.5)
    ap.add_argument("--csv", default=None)
    ap.add_argument("--joint", nargs="+", default=None, metavar="CSV",
                    help="tune.py result CSVs. For each of the top --joint-top "
                         "pre-processing settings, re-select steps 2-4 from "
                         "those results so an alternative is not judged with "
                         "parameters fitted to the current pre-processing.")
    ap.add_argument("--joint-top", type=int, default=5)
    ap.add_argument("--joint-shortlist", type=int, default=200)
    ap.add_argument("--variant", default="full", choices=sorted(VARIANTS))
    ap.add_argument("--apply", action="store_true",
                    help="merge the winner into outputs/tuned_params.json "
                         "(steps 2-4 are left untouched)")
    args = ap.parse_args()

    fixed = {k: load_params()[k] for k in KEYS}
    print("steps 2-4 held fixed at:", fixed)

    pairs = load_pairs(args.images, args.masks, 0)
    train_pairs, test_pairs = split_pairs(pairs, args.holdout)
    print(f"train {len(train_pairs)} images / held-out {len(test_pairs)} images")

    combos = pre_combos()
    print(f"Testing {len(combos)} pre-processing combinations...\n")

    results = []
    for i, pre in enumerate(combos, 1):
        d, _ = dices(train_pairs, pre, fixed)
        stable, mean = fold_score(d)
        results.append((stable, mean, pre))
        if i % 10 == 0:
            print(f"  ...{i}/{len(combos)}")
    results.sort(reverse=True, key=lambda r: r[0])

    print(f"\n=== TOP (train folds) ===\n{'stable':>7} {'mean':>7}  setting")
    for stable, mean, pre in results[:10]:
        print(f"{stable:7.4f} {mean:7.4f}  {describe(pre)}")

    print(f"\n=== ABLATION: is each step worth keeping? ===")
    print(f"{'blur':>6} {'CLAHE':>6} {'best mean Dice':>15}  best setting")
    groups = {
        (True, True): "both on",
        (True, False): "blur only",
        (False, True): "CLAHE only",
        (False, False): "neither",
    }
    for (has_blur, has_clahe), label in groups.items():
        sub = [r for r in results
               if (r[2]["blur_ksize"] > 1) == has_blur
               and (r[2]["clip_limit"] > 0) == has_clahe]
        if not sub:
            continue
        best = max(sub, key=lambda r: r[1])
        print(f"{str(has_blur):>6} {str(has_clahe):>6} {best[1]:>15.4f}  "
              f"{describe(best[2])}")

    if args.joint:
        combos2 = read_results(args.joint)
        keep = VARIANTS[args.variant]
        shortlist = sorted(
            (kv for kv in combos2.items() if keep(dict(zip(KEYS, kv[0])))),
            key=lambda kv: -kv[1])[:args.joint_shortlist]
        print(f"\n=== JOINT: re-selecting steps 2-4 ({len(shortlist)} "
              f"candidates, variant={args.variant}) for each setting ===")
        print(f"{'train':>7} {'held-out':>9}  pre-processing / steps 2-4")
        joint_rows = []
        for _, _, pre in results[:args.joint_top]:
            tr_g, tr_m = [], []
            for img_path, mask_path in train_pairs:
                tr_g.append(preprocess(cv2.imread(img_path), **pre))
                tr_m.append(cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE))
            best_p, best_s = None, -1.0
            for values, _ in shortlist:
                p2 = dict(zip(KEYS, values))
                d = np.array([m["dice"] for m in run_per_image(tr_g, tr_m, p2)])
                stable, _ = fold_score(d)
                if stable > best_s:
                    best_s, best_p = stable, p2
            _, m_tr = dices(train_pairs, pre, best_p)
            _, m_te = dices(test_pairs, pre, best_p)
            tr_d = average_metrics(m_tr)["dice"]
            te_d = average_metrics(m_te)["dice"]
            joint_rows.append((te_d, pre, best_p))
            print(f"{tr_d:7.4f} {te_d:9.4f}  {describe(pre)} / {best_p}")
        winner = max(joint_rows, key=lambda r: r[0])
        print(f"\nBest under joint re-selection: {describe(winner[1])} "
              f"-> held-out Dice {winner[0]:.4f}")

    best = results[0][2]
    print("\nSelected:", best, f"({describe(best)})")
    if test_pairs:
        _, m = dices(test_pairs, best, fixed)
        print("Held-out:", average_metrics(m))
    _, m = dices(pairs, best, fixed)
    print("All images:", average_metrics(m))

    if args.csv:
        os.makedirs(os.path.dirname(args.csv) or ".", exist_ok=True)
        with open(args.csv, "w", newline="") as f:
            w = csv.writer(f)
            w.writerow(PRE_KEYS + ["stable_score", "mean_dice"])
            for stable, mean, pre in results:
                w.writerow([pre[k] for k in PRE_KEYS] + [round(stable, 4),
                                                         round(mean, 4)])
        print(f"Wrote {args.csv}")

    if args.apply:
        params = {}
        if os.path.exists(TUNED_PATH):
            with open(TUNED_PATH) as f:
                params = json.load(f)
        params.update(best)          # merge: steps 2-4 keep their tuned values
        with open(TUNED_PATH, "w") as f:
            json.dump(params, f, indent=2)
        print(f"Merged into {TUNED_PATH}: {params}")


if __name__ == "__main__":
    main()
