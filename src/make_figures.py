"""
make_figures.py  -  Build the figure panels for the report  [Member 3]

Two kinds of figure:

  --images 021 065 042 023
      one row per image: original, ground truth, prediction, overlay.
      Use it for the failure-case section - the row shows at a glance whether
      the pipeline missed the crack (empty prediction) or found the wrong
      thing (prediction covers something that is not a crack).

  --compare 001 023
      one row per image, one column per method, so adaptive / otsu / canny /
      sobel can be looked at side by side on the same image.

Usage
-----
python src/make_figures.py --images 021 065 042 023 --out outputs/figures/failure_cases.png
python src/make_figures.py --compare 001 023 --methods adaptive otsu canny --out outputs/figures/method_comparison.png
"""
import argparse
import glob
import os
import sys

import cv2
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt   # noqa: E402

sys.path.insert(0, os.path.dirname(__file__))
from pipeline import detect_cracks, overlay_mask   # noqa: E402
from evaluate import pixel_metrics                 # noqa: E402

BASELINE_PARAMS = {
    "otsu": "outputs/tuned_params_otsu.json",
    "canny": "outputs/tuned_params_canny.json",
    "sobel": "outputs/tuned_params_sobel.json",
}


def find(folder, stem):
    hits = glob.glob(os.path.join(folder, stem + ".*"))
    if not hits:
        raise SystemExit(f"no file for '{stem}' in {folder}")
    return hits[0]


def load_params_for(method):
    """Baselines are scored with their own tuned parameters, if present."""
    path = BASELINE_PARAMS.get(method)
    if path and os.path.exists(path):
        import json
        with open(path) as f:
            return json.load(f)
    return None


def rgb(img):
    return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)


def panel_failures(stems, images, masks, out):
    fig, axes = plt.subplots(len(stems), 4,
                             figsize=(13, 3.1 * len(stems)), squeeze=False)
    for row, stem in enumerate(stems):
        image = cv2.imread(find(images, stem))
        gt = cv2.imread(find(masks, stem), cv2.IMREAD_GRAYSCALE)
        pred = detect_cracks(image)
        m = pixel_metrics(pred, gt)
        cells = [
            (rgb(image), f"{stem} - original"),
            (gt, "ground truth"),
            (pred, "prediction"),
            (rgb(overlay_mask(image, pred)), "overlay"),
        ]
        for col, (img, title) in enumerate(cells):
            ax = axes[row][col]
            ax.imshow(img, cmap=None if img.ndim == 3 else "gray")
            ax.set_title(title, fontsize=9)
            ax.axis("off")
        axes[row][3].set_title(
            f"overlay - Dice {m['dice']:.3f}  P {m['precision']:.3f}  "
            f"R {m['recall']:.3f}", fontsize=9)
    fig.tight_layout()
    fig.savefig(out, dpi=130)
    print(f"wrote {out}")


def panel_compare(stems, methods, images, masks, out):
    ncol = len(methods) + 2
    fig, axes = plt.subplots(len(stems), ncol,
                             figsize=(3.2 * ncol, 3.1 * len(stems)),
                             squeeze=False)
    for row, stem in enumerate(stems):
        image = cv2.imread(find(images, stem))
        gt = cv2.imread(find(masks, stem), cv2.IMREAD_GRAYSCALE)
        axes[row][0].imshow(rgb(image))
        axes[row][0].set_title(f"{stem} - original", fontsize=9)
        axes[row][1].imshow(gt, cmap="gray")
        axes[row][1].set_title("ground truth", fontsize=9)
        for col, method in enumerate(methods, start=2):
            pred = detect_cracks(image, method=method,
                                 params=load_params_for(method))
            m = pixel_metrics(pred, gt)
            axes[row][col].imshow(pred, cmap="gray")
            axes[row][col].set_title(f"{method} - Dice {m['dice']:.3f}",
                                     fontsize=9)
        for ax in axes[row]:
            ax.axis("off")
    fig.tight_layout()
    fig.savefig(out, dpi=130)
    print(f"wrote {out}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--images-dir", default="data/raw/images")
    ap.add_argument("--masks-dir", default="data/raw/masks")
    ap.add_argument("--images", nargs="+", help="stems for the failure panel")
    ap.add_argument("--compare", nargs="+", help="stems for the method panel")
    ap.add_argument("--methods", nargs="+",
                    default=["adaptive", "otsu", "canny", "sobel"])
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    if not args.images and not args.compare:
        raise SystemExit("pass --images or --compare")
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    if args.images:
        panel_failures(args.images, args.images_dir, args.masks_dir, args.out)
    else:
        panel_compare(args.compare, args.methods,
                      args.images_dir, args.masks_dir, args.out)


if __name__ == "__main__":
    main()
