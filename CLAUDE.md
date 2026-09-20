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
2. **Segmentation** (`src/segmentation.py`) — Adaptive Thresholding (default); Otsu,
   Canny and Sobel are implemented as comparison baselines → binary mask
3. **Morphological filtering** (`src/morphology.py`) — Closing reconnects cracks, Opening removes noise
4. **Shape analysis** (`src/shape_filter.py`) — keep thin/long contours (area + aspect ratio), drop round pores/stains

`src/pipeline.py` chains all four. `src/evaluate.py` builds the pixel-level **confusion matrix** (TP/FP/FN/TN) and derives
Precision, Recall, IoU (Jaccard), Dice (F1), reported both macro (mean of per-image
scores) and micro (all pixels pooled).

## Layout

```
main.py                 CLI entry point (single image or a folder + evaluation)
src/preprocessing.py    step 1
src/segmentation.py     step 2  (segment_adaptive, segment_otsu, segment_canny, segment_sobel)
src/morphology.py       step 3
src/shape_filter.py     step 4
src/pipeline.py         detect_cracks(); loads outputs/tuned_params.json if present
src/evaluate.py         confusion_counts(), pixel_metrics(), average_metrics (macro),
                        micro_metrics(), format_confusion()
src/tune.py             grid-search steps 2-4; --method adaptive|otsu|canny|sobel, --holdout
src/select_params.py    2-stage selection from a tune.py CSV; --variant constrains which
                        pipeline steps must stay active; --apply writes tuned_params.json
src/tune_preprocess.py  grid-search + ablate step 1; --joint re-optimises steps 2-4
src/make_figures.py     failure-case and method-comparison figure panels
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

Tuning, the method comparison and the step-1 ablation are done (2026-09-20). Full log,
all tables and the failure-case analysis: `docs/Tuning Journal.md`.

Shipped parameters (`outputs/tuned_params.json`):
`blur_ksize=5, clip_limit=2.0, tile=8, block_size=51, C=15, close_ksize=3, open_ksize=3,
min_area=80, min_aspect=3.0`

Mean pixel-level metrics on the 118 real CrackForest images:

| Metric    | Baseline (`723e49d`) | Round 1 | **Current** |
|-----------|----------------------|---------|-------------|
| Precision | 0.2479               | 0.5349  | 0.4990      |
| Recall    | 0.5982               | 0.5194  | **0.5781**  |
| IoU       | 0.2051               | 0.3399  | **0.3492**  |
| Dice      | 0.3201               | 0.4872  | **0.4991**  |

Parameters are selected on 59 training images and scored once on the 59 held-out
images: **Dice 0.5068 / IoU 0.3546** there, so the number is not fitted to its own
test set (round 1's train/test gap was 0.040; this is 0.001).

**Method comparison** — every method gets its own grid search under the identical
protocol, all four pipeline steps active:

| Method       | Held-out Dice | All 118 (macro) | All 118 (micro) | Wins outright |
|--------------|---------------|-----------------|-----------------|---------------|
| **Adaptive** | **0.5068**    | **0.4991**      | **0.4708**      | **108 / 118** |
| Sobel        | 0.3180        | 0.2956          | 0.2768          | 7             |
| Canny        | 0.2278        | 0.2127          | 0.1959          | 3             |
| Otsu         | 0.2262        | 0.2433          | 0.2612          | 1             |

Edge operators fire on asphalt texture, stain borders and shadows just as strongly as
on crack edges; adaptive thresholding asks the more specific question ("is this pixel
darker than its neighbourhood?"). Baseline parameters live in
`outputs/tuned_params_<method>.json`; `main.py --params <file>` scores one without
touching the shipped configuration.

**Accuracy is a trap** — crack pixels are 2.29% of the dataset, so predicting "no crack"
everywhere scores ~0.977. Adaptive scores 0.9782 and Otsu 0.9621 while their Dice differs
by 2x. Report IoU and Dice.

**Step ablation** (held-out Dice unless noted). Left unconstrained the search switches
morphology and the aspect filter off; the shipped configuration deliberately keeps all
four steps, which costs 0.0145:

| Variant                      | Dice       |
|------------------------------|------------|
| unconstrained                | 0.5213     |
| morphology forced on         | 0.5003     |
| aspect filter forced on      | 0.5142     |
| **all 4 steps on (shipped)** | **0.5068** |

Step 1 was ablated separately (`src/tune_preprocess.py`, mean Dice on the training
folds): both on 0.4929, CLAHE only 0.4197, neither 0.2699, blur only 0.2306. CLAHE
carries the step; blur *without* CLAHE is worse than doing nothing, because it smears
out thin cracks and nothing restores their contrast. The day-one defaults turned out to
be the best setting, and re-optimising steps 2-4 for each alternative keeps every
candidate within 0.005 Dice — pre-processing is not a sensitive knob here.

**Known defect, highest-value work left.** `filter_shapes()` measures elongation with
`cv2.minAreaRect`, which assumes a crack is straight. A curved or branching crack has a
near-square bounding box, so it is discarded whole: across the dataset step 4 throws
away **30.5% of the true crack pixels steps 1-3 had already found** (micro-recall 0.4246,
versus 0.6109 if it discarded nothing), and it accounts for every failure case - it
discards 100% of what was found on 021 and 065. A curvature-independent measure
(thinness `4*pi*area/perimeter^2`, or skeleton length over area) should replace it.
Separately, `cv2.contourArea()` measures enclosed polygon area rather than blob pixel
count, which under-measures exactly the thin shapes the filter is meant to keep;
`connectedComponentsWithStats` gives the true count.

Reproduce:
```powershell
python src\tune.py --subset 0 --holdout 0.5 --csv outputs\tune_results_round2.csv
python src\select_params.py --results outputs\tune_results_round2.csv --variant full --apply
python main.py --input data\raw\images --gt data\raw\masks --csv outputs\metrics.csv --confusion outputs\confusion.txt
```

## Next work

- **Fix the elongation criterion in step 4** (see above) — the largest remaining win.
- **Write the report** — no report file exists yet. `docs/Tuning Journal.md` has the
  material: before/after tables, the step ablations, the four-method comparison,
  confusion matrices and failure cases. Figures: `src/make_figures.py`.
- Download the edge-based papers cited in the journal into `relatedWork/` — the brief's
  section 4 wants the literature review to justify threshold-based over edge-based, and
  only the Dorafshan PDF is there.
- Measure per-image runtime to support the brief's section 8 (ESP32 / FPGA / drone).
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
