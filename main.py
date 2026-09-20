"""
main.py  —  Command-line entry point for the crack-detection pipeline.

Examples
--------
# One image, save the mask + overlay to outputs/figures/
python main.py --input data/raw/images/001.jpg

# A whole folder, and evaluate against ground-truth masks
python main.py --input data/raw/images --gt data/raw/masks --csv outputs/metrics.csv

# Score a baseline without disturbing the shipped parameters
python main.py --input data/raw/images --gt data/raw/masks --method otsu     --params outputs/tuned_params_otsu.json --csv outputs/metrics_otsu.csv
"""
import argparse
import csv
import json
import os
import sys

import cv2

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))
from pipeline import detect_cracks, overlay_mask          # noqa: E402
from evaluate import (pixel_metrics, average_metrics, confusion_counts,      # noqa: E402
                      total_confusion, micro_metrics, format_confusion)

METRIC_KEYS = ("precision", "recall", "iou", "dice")

IMG_EXT = (".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff")


def list_images(path):
    if os.path.isfile(path):
        return [path]
    return [
        os.path.join(path, f)
        for f in sorted(os.listdir(path))
        if f.lower().endswith(IMG_EXT)
    ]


def find_gt(gt_dir, image_path):
    """Match a ground-truth mask by file stem."""
    if not gt_dir:
        return None
    stem = os.path.splitext(os.path.basename(image_path))[0]
    for f in os.listdir(gt_dir):
        if os.path.splitext(f)[0] == stem:
            return os.path.join(gt_dir, f)
    return None


def main():
    ap = argparse.ArgumentParser(description="Concrete crack detection")
    ap.add_argument("--input", required=True, help="image file or folder")
    ap.add_argument("--gt", default=None, help="ground-truth mask folder")
    ap.add_argument("--method", default="adaptive",
                    choices=["adaptive", "otsu", "canny", "sobel"])
    ap.add_argument("--outdir", default="data/results")
    ap.add_argument("--figdir", default="outputs/figures")
    ap.add_argument("--csv", default=None, help="write metrics to this CSV")
    ap.add_argument("--params", default=None,
                    help="JSON file of pipeline parameters; overrides the "
                         "tuned/default values (used to score a baseline)")
    ap.add_argument("--confusion", default=None,
                    help="write the dataset-level confusion matrix to this file")
    args = ap.parse_args()

    params = None
    if args.params:
        with open(args.params) as f:
            params = json.load(f)
        print(f"using parameters from {args.params}: {params}")

    os.makedirs(args.outdir, exist_ok=True)
    os.makedirs(args.figdir, exist_ok=True)

    all_metrics = []
    all_counts = []
    for img_path in list_images(args.input):
        stem_check = os.path.splitext(os.path.basename(img_path))[0].lower()
        if stem_check in ("sample",):          # skip synthetic test image
            continue
        image = cv2.imread(img_path)
        if image is None:
            print(f"[skip] could not read {img_path}")
            continue

        mask = detect_cracks(image, method=args.method, params=params)
        stem = os.path.splitext(os.path.basename(img_path))[0]

        cv2.imwrite(os.path.join(args.outdir, f"{stem}_mask.png"), mask)
        cv2.imwrite(os.path.join(args.figdir, f"{stem}_overlay.png"),
                    overlay_mask(image, mask))

        gt_path = find_gt(args.gt, img_path)
        if gt_path:
            gt = cv2.imread(gt_path, cv2.IMREAD_GRAYSCALE)
            m = pixel_metrics(mask, gt)
            counts = confusion_counts(mask, gt)
            all_counts.append(counts)
            m["image"] = stem
            all_metrics.append(dict(m, **counts))
            print(f"{stem}: IoU={m['iou']} Dice={m['dice']} "
                  f"P={m['precision']} R={m['recall']}")
        else:
            print(f"{stem}: mask saved (no ground truth)")

    if all_metrics:
        macro = average_metrics([{k: m[k] for k in METRIC_KEYS}
                                 for m in all_metrics])
        totals = total_confusion(all_counts)
        micro = micro_metrics(all_counts)

        print()
        print(format_confusion(totals))
        print()
        print("=== Average over", len(all_metrics), "images ===")
        print("macro (mean of per-image scores):", macro)
        print("micro (all pixels pooled)       :", micro)

        if args.confusion:
            os.makedirs(os.path.dirname(args.confusion) or ".", exist_ok=True)
            with open(args.confusion, "w") as f:
                f.write(format_confusion(totals) + "\n\n")
                f.write(f"images: {len(all_metrics)}\n")
                f.write(f"macro: {macro}\n")
                f.write(f"micro: {micro}\n")
            print(f"confusion matrix -> {args.confusion}")

        if args.csv:
            os.makedirs(os.path.dirname(args.csv) or ".", exist_ok=True)
            fields = ["image"] + list(METRIC_KEYS) + ["tp", "fp", "fn", "tn"]
            with open(args.csv, "w", newline="") as f:
                w = csv.DictWriter(f, fieldnames=fields)
                w.writeheader()
                w.writerows(all_metrics)
                w.writerow({"image": "AVERAGE", **macro, **totals})
            print(f"metrics -> {args.csv}")


if __name__ == "__main__":
    main()
