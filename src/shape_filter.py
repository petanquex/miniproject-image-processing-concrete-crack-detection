"""
shape_filter.py  —  Step 4 of the pipeline  [Member 2]
Keep only blobs that look like cracks (thin & long), drop round pores/stains.
"""
import cv2
import numpy as np


def filter_shapes(mask, min_area=60, min_aspect=3.0):
    """
    Filter connected components by:
      - area          : remove specks smaller than `min_area` pixels
      - aspect ratio  : cracks are elongated; keep long/thin regions
    A component is kept if it is large enough AND elongated enough.
    """
    contours, _ = cv2.findContours(
        mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    result = np.zeros_like(mask)

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area:
            continue

        # elongation via the min-area rotated rectangle
        (_, _), (w, h), _ = cv2.minAreaRect(cnt)
        if w == 0 or h == 0:
            continue
        aspect = max(w, h) / min(w, h)

        if aspect >= min_aspect:
            cv2.drawContours(result, [cnt], -1, 255, thickness=cv2.FILLED)

    return result
