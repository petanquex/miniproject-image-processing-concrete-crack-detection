"""
segmentation.py  —  Step 2 of the pipeline  [Member 2]
Separate dark crack pixels from the background into a binary mask.
Cracks are darker than concrete, so we invert: crack = 255 (white), background = 0.
"""
import cv2


def segment_adaptive(gray, block_size=35, C=10):
    """
    Adaptive thresholding — robust to uneven lighting.
    block_size must be an odd number > 1.
    """
    block_size = block_size if block_size % 2 == 1 else block_size + 1
    mask = cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        block_size, C,
    )
    return mask


def segment_otsu(gray):
    """Global Otsu thresholding — baseline for comparison."""
    _, mask = cv2.threshold(
        gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
    )
    return mask


def segment(gray, method="adaptive", **kwargs):
    """Dispatch to the chosen segmentation method."""
    if method == "otsu":
        return segment_otsu(gray)
    return segment_adaptive(gray, **kwargs)
