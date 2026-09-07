"""
prepare_crackforest.py  —  Convert the CrackForest dataset into the format
this project expects: images in data/raw/images/, binary PNG masks in
data/raw/masks/ (same filename stem).

CrackForest stores ground truth as MATLAB .mat files whose `groundTruth`
struct has a `Segmentation` matrix (1 = background, >1 = crack). We turn that
into a 0/255 PNG mask.

Usage
-----
python src/prepare_crackforest.py --src data/CrackForest
# then:  python main.py --input data/raw/images --gt data/raw/masks --csv outputs/metrics.csv
"""
import argparse
import os
import glob

import cv2
import numpy as np

try:
    from scipy.io import loadmat
except ImportError:
    raise SystemExit("Please install scipy first:  pip install scipy")


def mask_from_mat(mat_path):
    """Extract a 0/255 crack mask from a CrackForest .mat file."""
    data = loadmat(mat_path)
    gt = data["groundTruth"]
    # groundTruth is a MATLAB cell/struct array; dig out 'Segmentation'
    seg = gt[0, 0]["Segmentation"]
    seg = np.asarray(seg)
    mask = np.where(seg > 1, 255, 0).astype(np.uint8)
    return mask


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True,
                    help="path to the cloned CrackForest-dataset folder")
    ap.add_argument("--img-out", default="data/raw/images")
    ap.add_argument("--mask-out", default="data/raw/masks")
    args = ap.parse_args()

    img_dir = os.path.join(args.src, "image")
    gt_dir = os.path.join(args.src, "groundTruth")
    if not os.path.isdir(img_dir) or not os.path.isdir(gt_dir):
        raise SystemExit(
            f"Expected '{img_dir}' and '{gt_dir}'. "
            "Point --src at the CrackForest-dataset root."
        )

    os.makedirs(args.img_out, exist_ok=True)
    os.makedirs(args.mask_out, exist_ok=True)

    n = 0
    for img_path in sorted(glob.glob(os.path.join(img_dir, "*"))):
        stem = os.path.splitext(os.path.basename(img_path))[0]
        mat_path = os.path.join(gt_dir, stem + ".mat")
        if not os.path.exists(mat_path):
            print(f"[skip] no ground truth for {stem}")
            continue

        img = cv2.imread(img_path)
        mask = mask_from_mat(mat_path)

        cv2.imwrite(os.path.join(args.img_out, stem + ".jpg"), img)
        cv2.imwrite(os.path.join(args.mask_out, stem + ".png"), mask)
        n += 1

    print(f"Prepared {n} image/mask pairs -> {args.img_out} , {args.mask_out}")


if __name__ == "__main__":
    main()
