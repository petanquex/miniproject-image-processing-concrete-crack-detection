"""
main.py  —  Command-line entry point for the crack-detection pipeline.

Examples
--------
# One image, save the mask + overlay to outputs/figures/
python main.py --input data/raw/images/sample.jpg

# A whole folder, and evaluate against ground-truth masks
python main.py --input data/raw/images --gt data/raw/masks --csv outputs/metrics.csv

# Use global Otsu instead of adaptive thresholding
python main.py --input data/raw/images/sample.jpg --method otsu
"""
import argparse
import csv
import os
import sys

import cv2

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))
from pipeline import detect_cracks, overlay_mask          # noqa: E402
from evaluate import pixel_metrics, average_metrics        # noqa: E402

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
                    choices=["adaptive", "otsu"])
    ap.add_argument("--outdir", default="data/results")
    ap.add_argument("--figdir", default="outputs/figures")
    ap.add_argument("--csv", default=None, help="write metrics to this CSV")
    args = ap.parse_args()

    os.makedirs(args.outdir, exist_ok=True)
    os.makedirs(args.figdir, exist_ok=True)

    all_metrics = []
    for img_path in list_images(args.input):
        image = cv2.imread(img_path)
        if image is None:
            print(f"[skip] could not read {img_path}")
            continue

        mask = detect_cracks(image, method=args.method)
        stem = os.path.splitext(os.path.basename(img_path))[0]

        cv2.imwrite(os.path.join(args.outdir, f"{stem}_mask.png"), mask)
        cv2.imwrite(os.path.join(args.figdir, f"{stem}_overlay.png"),
                    overlay_mask(image, mask))

        gt_path = find_gt(args.gt, img_path)
        if gt_path:
            gt = cv2.imread(gt_path, cv2.IMREAD_GRAYSCALE)
            m = pixel_metrics(mask, gt)
            m["image"] = stem
            all_metrics.append(m)
            print(f"{stem}: IoU={m['iou']} Dice={m['dice']} "
                  f"P={m['precision']} R={m['recall']}")
        else:
            print(f"{stem}: mask saved (no ground truth)")

    if all_metrics:
        avg = average_metrics([{k: v for k, v in m.items() if k != "image"}
                               for m in all_metrics])
        print("\n=== Average ===")
        print(avg)
        if args.csv:
            os.makedirs(os.path.dirname(args.csv) or ".", exist_ok=True)
            with open(args.csv, "w", newline="") as f:
                w = csv.DictWriter(
                    f, fieldnames=["image", "precision", "recall", "iou", "dice"])
                w.writeheader()
                w.writerows(all_metrics)
                w.writerow({"image": "AVERAGE", **avg})
            print(f"metrics -> {args.csv}")


if __name__ == "__main__":
    main()
