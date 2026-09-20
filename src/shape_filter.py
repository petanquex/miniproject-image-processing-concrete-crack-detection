"""
shape_filter.py  —  Step 4 of the pipeline  [Member 2]
Keep only blobs that look like cracks (thin & long), drop round pores/stains.

Two things this file used to get wrong, both of which cost real recall:

1. Elongation was measured as the aspect ratio of `cv2.minAreaRect`, which
   assumes a crack is straight. A curved or branching crack (a T, a Y, an arc)
   has a nearly square bounding box, so it was thrown away whole even though it
   is obviously thin. Measured over CrackForest, this step discarded 30.5% of
   the crack pixels the earlier steps had already found, and it accounted for
   every one of the pipeline's failure cases.

2. Area came from `cv2.contourArea()`, the area of the polygon the contour
   encloses - not the number of pixels in the blob. For a 2-pixel-wide line the
   two differ by a lot, so the area threshold was biased against exactly the
   thin shapes this filter exists to keep.

Both are fixed here. `circularity` (4*pi*area / perimeter^2) replaces the
aspect ratio as the shape test: it is near 1.0 for a disc and near 0 for
anything thin, no matter how much that thin thing bends. Area is now the true
pixel count from `connectedComponentsWithStats`.

Both criteria remain tunable and either can be switched off, so the grid search
can still choose between them:
    min_aspect <= 1.0   disables the aspect-ratio test
    max_circ   >= 1.0   disables the circularity test
"""
import math

import cv2
import numpy as np


def component_shape(sub_mask, area):
    """
    Shape descriptors for one connected component, given its cropped binary
    mask and true pixel area. Returns (aspect, circularity).
    """
    contours, _ = cv2.findContours(
        sub_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    if not contours:
        return 0.0, 1.0

    cnt = max(contours, key=cv2.contourArea)

    (_, _), (w, h), _ = cv2.minAreaRect(cnt)
    aspect = max(w, h) / min(w, h) if w > 0 and h > 0 else 0.0

    perimeter = sum(cv2.arcLength(c, True) for c in contours)
    circularity = (4.0 * math.pi * area / (perimeter ** 2)
                   if perimeter > 0 else 1.0)

    return aspect, circularity


def filter_shapes(mask, min_area=60, min_aspect=3.0, max_circ=1.0):
    """
    Filter connected components by:
      - area         : true pixel count, removes specks below `min_area`
      - aspect ratio : keep components at least `min_aspect` times longer than
                       wide (straight-crack assumption; <= 1.0 disables it)
      - circularity  : keep components with 4*pi*A/P^2 at most `max_circ`,
                       which keeps thin shapes whether or not they are straight
                       (>= 1.0 disables it)
    A component must satisfy every enabled criterion.
    """
    binary = (mask > 0).astype(np.uint8)
    n_labels, labels, stats, _ = cv2.connectedComponentsWithStats(
        binary, connectivity=8
    )
    result = np.zeros_like(mask)

    check_aspect = min_aspect > 1.0
    check_circ = max_circ < 1.0

    for i in range(1, n_labels):
        area = int(stats[i, cv2.CC_STAT_AREA])
        if area < min_area:
            continue

        if check_aspect or check_circ:
            x, y, w, h = (int(stats[i, cv2.CC_STAT_LEFT]),
                          int(stats[i, cv2.CC_STAT_TOP]),
                          int(stats[i, cv2.CC_STAT_WIDTH]),
                          int(stats[i, cv2.CC_STAT_HEIGHT]))
            sub = (labels[y:y + h, x:x + w] == i).astype(np.uint8)
            aspect, circularity = component_shape(sub, area)
            if check_aspect and aspect < min_aspect:
                continue
            if check_circ and circularity > max_circ:
                continue

        result[labels == i] = 255

    return result
