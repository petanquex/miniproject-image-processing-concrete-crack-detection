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

`src/pipeline.py` chains all four. `src/evaluate.py` builds the pixel-level **confusion matrix** (TP/FP/FN/TN) and derives
Precision, Recall, IoU (Jaccard), Dice (F1), reported both macro (mean of per-image
scores) and micro (all pixels pooled).

## Layout

```
main.py                 CLI entry point (single image or a folder + evaluation)
src/preprocessing.py    step 1
src/segmentation.py     step 2  (segment_adaptive, segment_otsu)
src/morphology.py       step 3
src/shape_filter.py     step 4
src/pipeline.py         detect_cracks(); loads outputs/tuned_params.json if present
src/evaluate.py         confusion_counts(), pixel_metrics(), average_metrics (macro),
                        micro_metrics(), format_confusion()
src/tune.py             grid-search params to maximize mean Dice; --holdout splits train/test
src/select_params.py    2-stage selection from a tune.py CSV; --variant constrains which
                        pipeline steps must stay active; --apply writes tuned_params.json
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

Round 2 of tuning is done (2026-09-20). Full log, ablation table, per-image analysis
and failure cases: `docs/Tuning Journal.md`.

Mean pixel-level metrics on the 118 real CrackForest images (the synthetic `sample`
image is skipped by `main.py`):

| Metric    | Baseline (`723e49d` defaults) | Round 1 tuned | **Round 2 tuned (current)** |
|-----------|-------------------------------|---------------|-----------------------------|
| Precision | 0.2479                        | **0.5349**    | 0.4990                      |
| Recall    | 0.5982                        | 0.5194        | **0.5781**                  |
| IoU       | 0.2051                        | 0.3399        | **0.3492**                  |
| Dice      | 0.3201                        | 0.4872        | **0.4991**                  |

Round 2 also reports an honest held-out number: the parameters were selected using
only 59 training images and score **Dice 0.5068 / IoU 0.3546** on the 59 images held
out of the search. Round 1 had a 0.040 train/test gap; round 2's is 0.001.

- Baseline params: `block_size=35, C=10, close_ksize=5, open_ksize=3, min_area=60, min_aspect=3.0`
- Round 1:         `block_size=35, C=15, close_ksize=3, open_ksize=3, min_area=50, min_aspect=3.0`
- Round 2 (current, in `outputs/tuned_params.json`):
                   `block_size=51, C=15, close_ksize=3, open_ksize=3, min_area=80, min_aspect=3.0`

**Ablation (same selection protocol, held-out Dice).** Left unconstrained, the search
turns morphology and the aspect filter off (`ksize=1`, `min_aspect=1.0`) because
`min_area` already removes the noise that opening removed, and opening breaks the very
thin CrackForest cracks. The shipped parameters deliberately keep all four steps active;
that costs 0.0145 Dice:

| Variant                    | Held-out Dice | All 118 |
|----------------------------|---------------|---------|
| unconstrained              | 0.5213        | 0.5205  |
| morphology forced on       | 0.5003        | 0.4888  |
| aspect filter forced on    | 0.5142        | 0.5090  |
| **all 4 steps on (shipped)** | **0.5068**  | 0.4991  |

Reproduce:
```powershell
python src\tune.py --subset 0 --holdout 0.5 --csv outputs\tune_results_round2.csv
python src\select_params.py --results outputs\tune_results_round2.csv --variant full --apply
python main.py --input data\raw\images --gt data\raw\masks --csv outputs\metrics.csv
```

**Otsu baseline (the comparison the brief asks for).** `tune.py --method otsu` searches
the morphology/shape parameters for Otsu separately, so the comparison is fair. Under
the identical protocol (selected on train, scored on held-out, all four steps active):

| Method       | Held-out Dice | All 118 (macro) | All 118 (micro) |
|--------------|---------------|-----------------|-----------------|
| **Adaptive** | **0.5068**    | **0.4991**      | **0.4708**      |
| Otsu         | 0.2262        | 0.2433          | 0.2612          |

Adaptive wins on 116 of 118 images. Otsu wins only on 023 and 104 — 023 is one of
adaptive's own failure cases. Otsu's false positives are 2.5x adaptive's (394,732 vs
157,115 pixels): one global threshold cannot cope with the uneven lighting and shadows
in road images, which is the numerical argument for choosing adaptive.

**Accuracy is a trap here** and the confusion matrix shows why: crack pixels are 2.29%
of all pixels, so predicting "no crack" everywhere already scores ~0.977. Adaptive's
accuracy is 0.9782 and Otsu's is 0.9621 — nearly identical, while their Dice differs
by 2x. Report IoU and Dice.

Otsu params live in `outputs/tuned_params_otsu.json`; `main.py --params <file>` scores
a baseline without touching the shipped `tuned_params.json`.

## Next work

- **Write the report** — no report file exists yet. `docs/Tuning Journal.md` already has
  the material: before/after tables, the A-D ablation, the Otsu comparison, confusion
  matrices, and failure cases.
- Add a Canny/Sobel edge-based baseline: the brief (section 4) wants the literature
  review to justify threshold-based over edge-based, and a measured number is stronger
  than citing the paper alone.
- Failure-case figure panels (image / ground truth / prediction) for 021, 065, 042, 023.
- Work out why 021 and 052 regressed between tuning round 1 and round 2 — likely the
  larger `block_size`.
- Merge the `tuning-round-1` branch into `main`.

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
