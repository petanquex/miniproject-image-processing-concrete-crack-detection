"""
evaluate.py  —  Pixel-level evaluation  [Member 3]
Compare a predicted mask against a ground-truth mask.

Everything here is derived from the pixel-level confusion matrix:

                      ground truth
                    crack     background
    pred  crack       TP           FP
          background  FN           TN

Metrics: Precision, Recall, IoU (Jaccard), Dice (F1).
Accuracy is reported for completeness only — crack pixels are a few percent of
an image, so predicting "no crack" everywhere already scores ~0.97 and says
nothing. IoU and Dice are the meaningful numbers on imbalanced data.
"""
import numpy as np

EPS = 1e-9


def _binarize(mask):
    """Force a mask to boolean (crack = True)."""
    return np.asarray(mask) > 0


def confusion_counts(pred, gt):
    """
    Pixel-level confusion matrix for one image, as counts.
    pred, gt : 2-D arrays (any positive value = crack).
    """
    p = _binarize(pred)
    g = _binarize(gt)
    return {
        "tp": int(np.logical_and(p, g).sum()),
        "fp": int(np.logical_and(p, ~g).sum()),
        "fn": int(np.logical_and(~p, g).sum()),
        "tn": int(np.logical_and(~p, ~g).sum()),
    }


def metrics_from_counts(counts):
    """Turn a confusion matrix into the reported metrics."""
    tp, fp, fn, tn = (counts[k] for k in ("tp", "fp", "fn", "tn"))
    return {
        "precision": round(tp / (tp + fp + EPS), 4),
        "recall": round(tp / (tp + fn + EPS), 4),
        "iou": round(tp / (tp + fp + fn + EPS), 4),
        "dice": round(2 * tp / (2 * tp + fp + fn + EPS), 4),
        "specificity": round(tn / (tn + fp + EPS), 4),
        "accuracy": round((tp + tn) / (tp + fp + fn + tn + EPS), 4),
    }


def pixel_metrics(pred, gt):
    """
    Return a dict of pixel-level metrics for one image:
    precision, recall, iou, dice.
    """
    m = metrics_from_counts(confusion_counts(pred, gt))
    return {k: m[k] for k in ("precision", "recall", "iou", "dice")}


def average_metrics(list_of_metrics):
    """
    Macro average: the mean of the per-image scores, so every image counts the
    same regardless of how much crack it contains. This is the headline number.
    """
    if not list_of_metrics:
        return {}
    keys = list_of_metrics[0].keys()
    return {
        k: round(float(np.mean([m[k] for m in list_of_metrics])), 4)
        for k in keys
    }


def total_confusion(list_of_counts):
    """Sum per-image confusion matrices into one dataset-level matrix."""
    total = {"tp": 0, "fp": 0, "fn": 0, "tn": 0}
    for c in list_of_counts:
        for k in total:
            total[k] += c[k]
    return total


def micro_metrics(list_of_counts):
    """
    Micro average: pool every pixel in the dataset, then compute the metrics
    once. Images with long cracks dominate, so this usually differs from the
    macro average — reporting both shows whether a good score comes from a few
    easy images or from the dataset as a whole.
    """
    return metrics_from_counts(total_confusion(list_of_counts))


def format_confusion(counts, title="Pixel-level confusion matrix"):
    """Render a confusion matrix as a small text table."""
    tp, fp, fn, tn = (counts[k] for k in ("tp", "fp", "fn", "tn"))
    total = tp + fp + fn + tn
    col = max(14, max(len(f"{v:,}") for v in (tp, fp, fn, tn)) + 2)
    lines = [
        title,
        f"{'':<18}{'GT crack':>{col}}{'GT background':>{col}}",
        f"{'pred crack':<18}{tp:>{col},}{fp:>{col},}",
        f"{'pred background':<18}{fn:>{col},}{tn:>{col},}",
        f"total pixels: {total:,}   crack pixels: {tp + fn:,} "
        f"({100.0 * (tp + fn) / max(total, 1):.2f}% of all pixels)",
    ]
    return "\n".join(lines)
