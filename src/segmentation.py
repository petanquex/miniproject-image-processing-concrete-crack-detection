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
    if method == "canny":
        return segment_canny(gray, **kwargs)
    if method == "sobel":
        return segment_sobel(gray, **kwargs)
    return segment_adaptive(gray, **kwargs)


def segment_canny(gray, canny_lo=50, canny_hi=150):
    """
    Edge-based baseline (Canny). Included so the report can justify choosing a
    threshold-based method with a measured number rather than a citation.

    Note what this returns: Canny marks the two *boundaries* of a crack, not
    its interior, so a crack comes out as a pair of thin parallel lines with a
    gap between them. The closing step that follows is what merges them back
    into a filled region - which is why the edge-based variants need a much
    larger close_ksize than adaptive thresholding does.
    """
    return cv2.Canny(gray, canny_lo, canny_hi)


def segment_sobel(gray, canny_lo=0, canny_hi=0):
    """
    Edge-based baseline (Sobel). Gradient magnitude, thresholded.
    canny_lo <= 0 thresholds the magnitude with Otsu; otherwise canny_lo is
    used as a fixed threshold. (The argument names are shared with
    segment_canny so both fit the same parameter grid.)
    """
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    mag = cv2.magnitude(gx, gy)
    mag = cv2.normalize(mag, None, 0, 255, cv2.NORM_MINMAX).astype("uint8")
    if canny_lo <= 0:
        _, mask = cv2.threshold(mag, 0, 255,
                                cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    else:
        _, mask = cv2.threshold(mag, canny_lo, 255, cv2.THRESH_BINARY)
    return mask
