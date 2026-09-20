# Concrete Crack Detection

Automated detection of structural cracks on concrete surfaces using **traditional
image processing** (no deep learning). Built for an Image Processing mini project,
split across a 2–3 person team.

## Pipeline

1. **Pre-processing** — grayscale, Gaussian blur, CLAHE contrast
2. **Segmentation** — Adaptive Thresholding → binary mask
   (Otsu, Canny and Sobel are available as baselines for comparison)
3. **Morphological filtering** — Closing reconnects cracks, Opening removes noise
4. **Shape analysis** — keep thin/long contours, drop round pores & stains

Evaluation is **pixel-level**, from the confusion matrix: Precision, Recall,
IoU and Dice, reported both macro (mean over images) and micro (all pixels pooled).

## Setup

```bash
pip install -r requirements.txt
```

## Usage

```bash
# single image
python main.py --input data/raw/images/001.jpg

# whole folder + evaluate against ground-truth masks
python main.py --input data/raw/images --gt data/raw/masks --csv outputs/metrics.csv

# whole folder + confusion matrix
python main.py --input data/raw/images --gt data/raw/masks --confusion outputs/confusion.txt

# score a baseline (otsu / canny / sobel) without touching the shipped parameters
python main.py --input data/raw/images --gt data/raw/masks --method otsu     --params outputs/tuned_params_otsu.json --csv outputs/metrics_otsu.csv
```

Masks are written to `data/results/`, overlays to `outputs/figures/`.

## Datasets (pixel-level ground truth)

- CrackForest / CFD — https://github.com/cuilimeng/CrackForest-dataset
- DeepCrack — https://github.com/yhlleo/DeepCrack
- Crack500 — https://github.com/khanhha/crack_segmentation

Put images in `data/raw/images/` and matching masks (same filename) in `data/raw/masks/`.

## Structure

```
data/        raw images + masks, and generated results
src/         pipeline modules (one file per step) + tuning/selection scripts
notebooks/   demo.ipynb — step-by-step visual walkthrough
outputs/     figures + metrics.csv
docs/        proposal, presentation script, slides, Tuning Journal.md
main.py      command-line entry point
```

## Team split

- **Member 1** — pre-processing (`src/preprocessing.py`)
- **Member 2** — algorithm: segmentation, morphology, shape filter
- **Member 3** — evaluation (`src/evaluate.py`) + results/figures

## Reference

Dorafshan, Maguire, Qi (2016), *Automatic Surface Crack Detection in Concrete
Structures Using OTSU Thresholding and Morphological Operations.*
