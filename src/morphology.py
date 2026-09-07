"""
morphology.py  —  Step 3 of the pipeline  [Member 2]
Closing reconnects broken cracks; Opening removes small noise blobs.
"""
import cv2
import numpy as np


def apply_morphology(mask, close_ksize=5, open_ksize=3):
    """
    1) Closing  (dilate then erode) -> bridge gaps in a crack line.
    2) Opening  (erode then dilate)  -> delete tiny noise specks.
    """
    close_kernel = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE, (close_ksize, close_ksize)
    )
    open_kernel = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE, (open_ksize, open_ksize)
    )
    closed = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, close_kernel)
    cleaned = cv2.morphologyEx(closed, cv2.MORPH_OPEN, open_kernel)
    return cleaned
