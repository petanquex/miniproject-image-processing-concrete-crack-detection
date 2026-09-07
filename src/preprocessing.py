"""
preprocessing.py  —  Step 1 of the pipeline  [Member 1]
Grayscale -> noise reduction -> contrast enhancement.
"""
import cv2


def to_grayscale(image):
    """Convert a BGR image to single-channel grayscale."""
    if image.ndim == 2:
        return image
    return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)


def denoise(gray, ksize=5):
    """Reduce noise with a Gaussian blur (odd kernel size)."""
    ksize = ksize if ksize % 2 == 1 else ksize + 1
    return cv2.GaussianBlur(gray, (ksize, ksize), 0)


def enhance_contrast(gray, clip_limit=2.0, tile=8):
    """Boost local contrast with CLAHE so dark cracks stand out."""
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(tile, tile))
    return clahe.apply(gray)


def preprocess(image, blur_ksize=5, clip_limit=2.0, tile=8):
    """Full pre-processing step: gray -> blur -> CLAHE."""
    gray = to_grayscale(image)
    gray = denoise(gray, blur_ksize)
    gray = enhance_contrast(gray, clip_limit, tile)
    return gray
