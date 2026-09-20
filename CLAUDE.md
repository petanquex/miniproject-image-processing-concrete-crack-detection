# CLAUDE.md

Project context for Claude Code. Read this first, then help with the pending work below.

## What this project is

**Concrete Crack Detection** — an Image Processing mini project that detects structural
cracks on concrete surfaces using **traditional image processing only (OpenCV)**.
No deep learning / no ML models — the goal is to prove the image-processing math.
Team of 2–3 people. Deliverables: working pipeline, evaluation on a public dataset,
a proposal deck, and a report.

## Pipeline (4 steps)

1. **Pre-processing** (`src/preprocessing.py`) — grayscale → Gaussian blur → CLAHE
2. **Segmentation** (`src/segmentation.py`) — Adaptive Thresholding (default) or Otsu → binary mask
3. **Morphological filtering** (`src/morphology.py`) — Closing reconnects cracks, Opening removes noise
4. **Shape analysis** (`src/shape_filter.py`) — keep thin/long contours (area + aspect ratio), drop round pores/stains

`src/pipeline.py` chains all four. `src/evaluate.py` computes **pixel-level** metrics:
Precision, Recall, IoU (Jaccard), Dice (F1).

## Layout

```
main.py                 CLI entry point (single image or a folder + evaluation)
src/preprocessing.py    step 1
src/segmentation.py     step 2  (segment_adaptive, segment_otsu)
src/morphology.py       step 3
src/shape_filter.py     step 4
src/pipeline.py         detect_cracks(); loads outputs/tuned_params.json if present
src/evaluate.py         pixel_metrics(), average_metrics()
src/tune.py             grid-search params to maximize mean Dice, --apply writes tuned_params.json
src/prepare_crackforest.py  convert CrackForest .mat ground truth -> PNG masks
notebooks/demo.ipynb    step-by-step visual demo
data/raw/{images,masks} input images + ground-truth masks (same filename stem)
data/results/           generated masks
outputs/figures/        overlays;  outputs/metrics.csv = scores
docs/                   proposal doc, presentation script, slides
proposal/               proposal deck (.pptx), script (.docx/.pdf), video
relatedWork/            Dorafshan et al. 2016 (the reference paper this follows)
```

## Environment

Windows + PowerShell. Use the project virtualenv:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt          # opencv-python, numpy, matplotlib, scipy
```

Always run inside the activated `.venv`. Verify with `python -c "import cv2; print(cv2.__version__)"`.

## How to run

```powershell
# detect on the whole folder and evaluate against ground truth
python main.py --input data\raw\images --gt data\raw\masks --csv outputs\metrics.csv

# use Otsu instead of adaptive thresholding
python main.py --input data\raw\images\001.jpg --method otsu

# get the dataset (if data/raw is empty)
git clone https://github.com/cuilimeng/CrackForest-dataset.git data\CrackForest
python src\prepare_crackforest.py --src data\CrackForest
```

## Dataset

CrackForest (CFD): 118 urban road images, pixel-level ground truth stored as MATLAB
`.mat` (`groundTruth.Segmentation`, value > 1 = crack). `prepare_crackforest.py`
converts these to 0/255 PNG masks in `data/raw/masks/`.

## Current status

Cleanup, tuning, and full re-evaluation are done (2026-09-14). Full log, per-image
analysis, and failure cases: `docs/Tuning Journal.md`.

Mean pixel-level metrics on the 118 real CrackForest images (synthetic `sample`
removed — the earlier ≈0.21 / ≈0.32 figures had it included and were inflated):

| Metric    | Baseline (commit `723e49d` defaults) | Tuned (`outputs/tuned_params.json`) |
|-----------|--------------------------------------|-------------------------------------|
| Precision | 0.2479                               | **0.5349**                          |
| Recall    | 0.5982                               | 0.5194                              |
| IoU       | 0.2051                               | **0.3399**                          |
| Dice      | 0.3201                               | **0.4872**                          |

- Baseline params: `block_size=35, C=10, close_ksize=5, open_ksize=3, min_area=60, min_aspect=3.0`
- Tuned params:    `block_size=35, C=15, close_ksize=3, open_ksize=3, min_area=50, min_aspect=3.0`
  (grid search on a 25-image subset, Dice 0.5272 there → 0.4872 on all 118, mild overfit)

Reproduce:
```powershell
python src\tune.py --images data\raw\images --masks data\raw\masks --subset 25 --apply
python main.py --input data\raw\images --gt data\raw\masks --csv outputs\metrics.csv
```

## Next work

- Best tuned values sit on the edge of the search grid (C at max; kernels and
  min_area at min) — widen `GRID` in `src/tune.py` and re-tune.
- Tune on all images (`--subset 0`) or a train/test split to reduce overfitting.
- Compare against Otsu (`--method otsu`) to relate to Dorafshan et al. (2016).
- Weakest images after tuning: 065, 042, 023, 084 (use as failure cases in the report).

## Conventions

- Traditional image processing only — do **not** introduce DL/ML.
- One responsibility per `src/*.py` file (matches the team's task split).
- Masks are `uint8` 0/255; crack = 255.
- Ground-truth and prediction are matched by filename stem.
- Keep generated files (results, figures, metrics, tuned_params.json, venv, dataset)
  out of git — see `.gitignore`.

## Reference

Dorafshan, Maguire, Qi (2016). *Automatic Surface Crack Detection in Concrete
Structures Using OTSU Thresholding and Morphological Operations.* PDF in `relatedWork/`.
