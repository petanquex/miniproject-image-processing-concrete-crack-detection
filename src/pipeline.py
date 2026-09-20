"""
pipeline.py  —  Full crack-detection pipeline
Chains all four steps: Pre-processing -> Segmentation -> Morphology -> Shape filtering.
"""
import json
import os

import cv2
import numpy as np

from preprocessing import preprocess
from segmentation import segment, segment_adaptive
from morphology import apply_morphology
from shape_filter import filter_shapes

# Default parameters. These are overridden by outputs/tuned_params.json when it
# exists (created by src/tune.py), so a tuning run improves results with no code
# change. Heuristic starting point for CrackForest-style images (thin dark
# cracks, ~480x320): a larger threshold window + stricter C favor precision,
# and a stronger opening + area/aspect filter drop background speckle.
DEFAULT_PARAMS = {
    "blur_ksize": 5,
    "clip_limit": 2.0,
    "tile": 8,
    "block_size": 51,
    "C": 12,
    "close_ksize": 5,
    "open_ksize": 5,
    "min_area": 120,
    "min_aspect": 3.0,
    # circularity 4*pi*A/P^2; 1.0 disables the test, lower keeps only thin
    # shapes regardless of how much they curve
    "max_circ": 1.0,
    # only used by the edge-based baselines (method=canny / sobel)
    "canny_lo": 50,
    "canny_hi": 150,
}

_TUNED_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "outputs", "tuned_params.json"
)


def load_params(overrides=None):
    """Merge DEFAULT_PARAMS <- tuned_params.json <- explicit overrides."""
    params = dict(DEFAULT_PARAMS)
    if os.path.exists(_TUNED_PATH):
        try:
            with open(_TUNED_PATH) as f:
                params.update(json.load(f))
        except (ValueError, OSError):
            pass
    if overrides:
        params.update({k: v for k, v in overrides.items() if v is not None})
    return params


def detect_cracks(image, method="adaptive", params=None, return_stages=False):
    """
    Run the pipeline on a BGR image (numpy array).
    Returns the final binary crack mask (uint8, 0/255).
    `params` overrides the tuned/default parameters for any stage.
    """
    p = load_params(params)

    gray = preprocess(image, blur_ksize=p["blur_ksize"],
                      clip_limit=p["clip_limit"], tile=p["tile"])
    if method == "adaptive":
        seg = segment_adaptive(gray, block_size=p["block_size"], C=p["C"])
    elif method in ("canny", "sobel"):
        seg = segment(gray, method=method,
                      canny_lo=p["canny_lo"], canny_hi=p["canny_hi"])
    else:
        seg = segment(gray, method=method)
    morph = apply_morphology(seg, p["close_ksize"], p["open_ksize"])
    mask = filter_shapes(morph, p["min_area"], p["min_aspect"],
                         p["max_circ"])

    if return_stages:
        stages = {
            "gray": gray,
            "segmented": seg,
            "morphology": morph,
            "final": mask,
        }
        return mask, stages
    return mask


def overlay_mask(image, mask, color=(0, 0, 255), alpha=0.5):
    """Paint the detected cracks onto the original image (for figures)."""
    if image.ndim == 2:
        image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
    overlay = image.copy()
    overlay[mask > 0] = color
    return cv2.addWeighted(overlay, alpha, image, 1 - alpha, 0)
