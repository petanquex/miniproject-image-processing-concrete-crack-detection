"""
evaluate.py  —  Pixel-level evaluation  [Member 3]
Compare a predicted mask against a ground-truth mask.
Metrics: Precision, Recall, IoU (Jaccard), Dice (F1).
"""
import numpy as np


def _binarize(mask):
    """Force a mask to boolean (crack = True)."""
    return np.asarray(mask) > 0


def pixel_metrics(pred, gt):
    """
    Return a dict of pixel-level metrics for one image.
    pred, gt : 2-D arrays (any positive value = crack).
    """
    p = _binarize(pred)
    g = _binarize(gt)

    tp = np.logical_and(p, g).sum()
    fp = np.logical_and(p, ~g).sum()
    fn = np.logical_and(~p, g).sum()

    eps = 1e-9
    precision = tp / (tp + fp + eps)
    recall = tp / (tp + fn + eps)
    iou = tp / (tp + fp + fn + eps)
    dice = 2 * tp / (2 * tp + fp + fn + eps)

    return {
        "precision": round(float(precision), 4),
        "recall": round(float(recall), 4),
        "iou": round(float(iou), 4),
        "dice": round(float(dice), 4),
    }


def average_metrics(list_of_metrics):
    """Average a list of per-image metric dicts."""
    if not list_of_metrics:
        return {}
    keys = list_of_metrics[0].keys()
    return {
        k: round(float(np.mean([m[k] for m in list_of_metrics])), 4)
        for k in keys
    }
