"""
pipeline.py  —  Full crack-detection pipeline
Chains all four steps: Pre-processing -> Segmentation -> Morphology -> Shape filtering.
"""
import cv2
import numpy as np

from preprocessing import preprocess
from segmentation import segment
from morphology import apply_morphology
from shape_filter import filter_shapes


def detect_cracks(image, method="adaptive", return_stages=False):
    """
    Run the pipeline on a BGR image (numpy array).
    Returns the final binary crack mask (uint8, 0/255).
    If return_stages=True, also returns a dict of intermediate images.
    """
    gray = preprocess(image)
    seg = segment(gray, method=method)
    morph = apply_morphology(seg)
    mask = filter_shapes(morph)

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
