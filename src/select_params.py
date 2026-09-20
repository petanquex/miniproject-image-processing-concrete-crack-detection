"""
select_params.py  -  Pick the final parameters from a tune.py results CSV.

tune.py ranks combinations by mean Dice on the search set. With ~4000
combinations that argmax is noisy: the winner is often a combination that got
lucky on a few images. This script does the selection in two stages, using
*only* the training half, and scores the winner once on the held-out half.

  stage 1   shortlist the top --shortlist combinations by mean Dice
  stage 2   re-score each on 5 folds of the training half and keep the
            combination with the best (mean - std), i.e. good *and* stable

--variant constrains which combinations may be selected, so the contribution of
each pipeline stage can be measured under an identical protocol:

  any     no constraint (the highest score the pipeline can reach)
  morph   morphology must be active   (close_ksize >= 3 and open_ksize >= 3)
  shape   the aspect filter must be active (min_aspect >= 2)
  full    both of the above - all four pipeline steps do real work

Usage
-----
python src/select_params.py --results outputs/tune_results_round2.csv
python src/select_params.py --results outputs/tune_results_round2.csv \
       outputs/tune_results_round2b.csv --variant full --apply
"""
import argparse
import csv
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from tune import load_pairs, split_pairs, load_stage, KEYS, run_per_image  # noqa: E402
from evaluate import average_metrics  # noqa: E402

CAST = {"block_size": int, "C": int, "close_ksize": int,
        "open_ksize": int, "min_area": int, "min_aspect": float}

VARIANTS = {
    "any":   lambda p: True,
    "morph": lambda p: p["close_ksize"] >= 3 and p["open_ksize"] >= 3,
    "shape": lambda p: p["min_aspect"] >= 2.0,
    "full":  lambda p: (p["close_ksize"] >= 3 and p["open_ksize"] >= 3
                        and p["min_aspect"] >= 2.0),
}


def read_results(paths):
    """Merge one or more tune.py CSVs into {params tuple: best mean Dice}."""
    combos = {}
    for path in paths:
        with open(path, newline="") as f:
            for row in csv.DictReader(f):
                key = tuple(CAST[k](row[k]) for k in KEYS)
                combos[key] = max(combos.get(key, 0.0), float(row["dice"]))
    return combos


def fold_score(dices, n_folds=5):
    """Mean minus standard deviation across folds: reward stable combinations."""
    fold_means = np.array([dices[np.arange(len(dices)) % n_folds == f].mean()
                           for f in range(n_folds)])
    return fold_means.mean() - fold_means.std(), fold_means.mean()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--results", nargs="+", required=True,
                    help="one or more CSVs written by tune.py --csv")
    ap.add_argument("--images", default="data/raw/images")
    ap.add_argument("--masks", default="data/raw/masks")
    ap.add_argument("--holdout", type=float, default=0.5,
                    help="must match the tune.py run that produced the CSVs")
    ap.add_argument("--method", default="adaptive", choices=["adaptive", "otsu"],
                    help="must match the tune.py run that produced the CSVs")
    ap.add_argument("--variant", default="any", choices=sorted(VARIANTS))
    ap.add_argument("--shortlist", type=int, default=300)
    ap.add_argument("--out", default="outputs/tuned_params.json",
                    help="where --apply writes the selected parameters")
    ap.add_argument("--apply", action="store_true",
                    help="write the selection to --out")
    args = ap.parse_args()

    if (args.apply and args.method != "adaptive"
            and args.out == ap.get_default("out")):
        raise SystemExit(
            "Otsu is a comparison baseline, not the shipped pipeline: writing "
            "it to the default tuned_params.json would change what main.py "
            "runs. Pass --out with a different path.")

    combos = read_results(args.results)
    keep = VARIANTS[args.variant]
    shortlist = sorted(
        (kv for kv in combos.items() if keep(dict(zip(KEYS, kv[0])))),
        key=lambda kv: -kv[1])[:args.shortlist]
    if not shortlist:
        raise SystemExit(f"No combination in the CSVs matches --variant {args.variant}.")
    print(f"{len(combos)} combinations -> {len(shortlist)} shortlisted "
          f"(variant={args.variant}, mean Dice "
          f"{shortlist[-1][1]:.4f}..{shortlist[0][1]:.4f})")

    pairs = load_pairs(args.images, args.masks, 0)
    train_pairs, test_pairs = split_pairs(pairs, args.holdout)
    train = load_stage(train_pairs)
    test = load_stage(test_pairs)
    print(f"train {len(train_pairs)} images / held-out {len(test_pairs)} images")

    scored = []
    for values, _ in shortlist:
        p = dict(zip(KEYS, values))
        dices = np.array([m["dice"]
                          for m in run_per_image(*train, p, args.method)])
        stable, mean = fold_score(dices)
        scored.append((stable, mean, p))
    scored.sort(reverse=True, key=lambda r: r[0])

    print(f"\n{'stable':>7} {'mean':>7}  params")
    for stable, mean, p in scored[:8]:
        print(f"{stable:7.4f} {mean:7.4f}  {p}")

    best = scored[0][2]
    print("\nSelected:", best)
    if test_pairs:
        print("Held-out:", average_metrics(run_per_image(*test, best, args.method)))
    allm = average_metrics(
        run_per_image(*[a + b for a, b in zip(train, test)], best, args.method))
    print("All images:", allm)

    if args.apply:
        os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
        with open(args.out, "w") as f:
            json.dump(best, f, indent=2)
        print("Wrote", args.out)


if __name__ == "__main__":
    main()
