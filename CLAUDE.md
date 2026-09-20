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
4. **Shape analysis** (`src/shape_filter.py`) — keep thin contours by pixel area and
   circularity (curvature-independent), drop round pores/stains

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

Three tuning rounds, the four-method comparison, the step-1 ablation and the step-4
rewrite are done (2026-09-20). Full log and every table: `docs/Tuning Journal.md`.

Shipped parameters (`outputs/tuned_params.json`):
`blur_ksize=5, clip_limit=2.0, tile=8, block_size=35, C=15, close_ksize=3,
open_ksize=3, min_area=120, min_aspect=1.0, max_circ=0.4`

Mean pixel-level metrics on the 118 real CrackForest images:

| Metric    | Baseline (`723e49d`) | Round 1 | Round 2 | **Current** |
|-----------|----------------------|---------|---------|-------------|
| Precision | 0.2479               | 0.5349  | 0.4990  | **0.5273**  |
| Recall    | 0.5982               | 0.5194  | 0.5781  | 0.5732      |
| IoU       | 0.2051               | 0.3399  | 0.3492  | **0.3533**  |
| Dice      | 0.3201               | 0.4872  | 0.4991  | **0.5024**  |

Parameters are selected on 59 training images and scored once on the 59 held out of
every search: **Dice 0.5105 / IoU 0.3606** there.

**Step 4 was measuring the wrong thing.** It used the aspect ratio of
`cv2.minAreaRect`, which assumes a crack is straight — a curved or branching crack has
a near-square bounding box and was discarded whole, which is why `min_aspect` ran to
the bottom of every grid. `filter_shapes()` now uses circularity
(`4*pi*area/perimeter^2`), near 0 for anything thin however much it bends, and takes
area as the true pixel count from `connectedComponentsWithStats` rather than
`cv2.contourArea` (polygon area, which under-measures thin shapes). Best train Dice by
criterion: **circularity 0.5243, no shape test 0.5201, both 0.5030, aspect 0.4997** —
the old criterion was worse than not filtering by shape at all, the new one is better,
so step 4 earns its place for the first time. Step 4 now discards 20.2% of the crack
pixels the earlier steps found, down from 30.5%; 065 went 0.0000 -> 0.5844, 021
0.0000 -> 0.3632, 084 0.1878 -> 0.4976. It is a trade, not a free win: 63 images
improved and 55 got worse (072, 105 and 049 regressed noticeably).

**Method comparison** — each method gets its own grid search under the identical
protocol, all four steps active:

| Method       | Held-out Dice | All 118 (macro) | Wins outright | False positives |
|--------------|---------------|-----------------|---------------|-----------------|
| **Adaptive** | **0.5105**    | **0.5024**      | **102 / 118** | **171,802**     |
| Sobel        | 0.3159        | 0.2927          | 8             | 463,628         |
| Otsu         | 0.2257        | 0.2428          | 5             | 392,289         |
| Canny        | 0.2237        | 0.2107          | 3             | 1,457,995       |

Edge operators fire on asphalt texture, stain borders and shadows as strongly as on
crack edges; adaptive thresholding asks the more specific question ("is this pixel
darker than its neighbourhood?"). All three baselines turn circularity *off* when
offered it — their masks are blobs, not thin structures, so a thinness test cannot
separate signal from noise there. Baseline parameters are in
`outputs/tuned_params_<method>.json`; `main.py --params <file>` scores one without
touching the shipped configuration.

**Accuracy is a trap** — crack pixels are 2.29% of the dataset, so predicting "no crack"
everywhere scores ~0.977. Adaptive scores 0.9776 and Otsu 0.9621 while their Dice
differs by 2x. Report IoU and Dice.

**Step ablations.** Step 1 (`src/tune_preprocess.py`, mean Dice on training folds): both
on 0.4929, CLAHE only 0.4197, neither 0.2699, blur only 0.2306 — CLAHE carries the step,
and blur *without* CLAHE is worse than doing nothing. Steps 2-4 (`--variant`, held-out
Dice): unconstrained 0.5174, all four steps on 0.5105. The shipped configuration keeps
every step active, which now costs 0.007.

**Some remaining failures are ground-truth artefacts, not detection errors.** On 021 the
pipeline finds the crazing in the painted road line — real cracks that CrackForest does
not annotate — so precision reads 0.239. On 084 the annotation is drawn far thicker than
the crack, capping recall at 0.383 while precision is 0.711. Worth saying in the report:
a pixel-level metric punishes finding what the annotator did not draw, and the stroke
width of the ground truth directly bounds recall.

Reproduce:
```powershell
python src\tune.py --subset 0 --holdout 0.5 --csv outputs\tune_results_round3.csv
python src\select_params.py --results outputs\tune_results_round3.csv --variant full --apply
python main.py --input data\raw\images --gt data\raw\masks --csv outputs\metrics.csv --confusion outputs\confusion_adaptive.txt
```

## Next work

- **Write the report** — the largest remaining task; no report file exists yet.
  `docs/Tuning Journal.md` holds the material and `src/make_figures.py` the figures.
- Read the papers now in `relatedWork/` and write the literature review around them.
- Measure per-image runtime to support the brief's section 8 (ESP32 / FPGA / drone).
- Look at 072, 105 and 049, which regressed when step 4 changed.
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
