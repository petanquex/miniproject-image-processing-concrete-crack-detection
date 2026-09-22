// English presentation deck for Concrete Crack Detection (mirrors the Thai deck).
const pptxgen = require("pptxgenjs");
const path = require("path");
const p = new pptxgen();
p.layout = "LAYOUT_WIDE"; // 13.3 x 7.5
const FIG = f => path.join(__dirname, "figures", f);

const DARK = "2E3338", SLATE = "5B6770", LIGHT = "F4F4F2", WHITE = "FFFFFF";
const AMBER = "E8871E", AMBERD = "B5670F", INK = "222629", GOOD = "2C7A52";
const HF = "Cambria", BF = "Calibri";

function bg(s, c) { s.background = { color: c }; }
function title(s, t, sub) {
  s.addText(t, { x: 0.7, y: 0.5, w: 11.9, h: 0.8, fontFace: HF, fontSize: 32, bold: true, color: INK });
  if (sub) s.addText(sub, { x: 0.72, y: 1.28, w: 11.9, h: 0.5, fontFace: BF, fontSize: 15, color: SLATE, italic: true });
}
function circleNum(s, n, x, y, d, fill) {
  s.addShape(p.ShapeType.ellipse, { x, y, w: d, h: d, fill: { color: fill } });
  s.addText(String(n), { x, y, w: d, h: d, align: "center", valign: "middle", fontFace: HF, fontSize: 20, bold: true, color: WHITE });
}
function imgFit(file, W, H, x, y, boxW, boxH, s, opts = {}) {
  const ar = W / H;
  let w = boxW, h = boxW / ar;
  if (h > boxH) { h = boxH; w = boxH * ar; }
  s.addImage({ path: file, x: x + (boxW - w) / 2, y: y + (boxH - h) / 2, w, h, ...opts });
}
function hCell() { return { fill: DARK, color: WHITE, bold: true, align: "center", fontFace: BF, fontSize: 13 }; }
function bCell(v, label, last, hl) { return { text: v, options: { align: label ? "left" : "center", bold: label || last || hl, color: hl ? AMBERD : INK, fill: hl ? "FBEEDD" : (label ? "F0F2F4" : WHITE) } }; }

/* 1 — Title */
let s = p.addSlide(); bg(s, DARK);
for (let i = 0; i < 8; i++) s.addShape(p.ShapeType.line, { x: i * 1.7, y: 5.0 + (i % 2 ? 0.35 : -0.15), w: 1.7, h: 0.4, line: { color: AMBER, width: 3 }, flipV: i % 2 === 0 });
s.addText("IMAGE PROCESSING · MINI PROJECT", { x: 0.8, y: 1.0, w: 11, h: 0.4, fontFace: BF, fontSize: 14, color: AMBER, charSpacing: 3, bold: true });
s.addText("Concrete Crack Detection", { x: 0.8, y: 1.6, w: 11.7, h: 1.1, fontFace: HF, fontSize: 48, bold: true, color: WHITE });
s.addText("Detecting structural cracks with traditional image processing — no deep learning — evaluated on 118 CrackForest images",
  { x: 0.8, y: 2.9, w: 11, h: 0.9, fontFace: BF, fontSize: 18, color: "CBD1D6" });
s.addText([{ text: "Presented by  ", options: { color: "9AA3AA" } }, { text: "Member 1  ·  Member 2  ·  Member 3", options: { color: WHITE, bold: true } }],
  { x: 0.8, y: 6.4, w: 11, h: 0.5, fontFace: BF, fontSize: 16 });

/* 2 — Problem & Motivation */
s = p.addSlide(); bg(s, LIGHT);
title(s, "Problem & Motivation", "Why automatic crack detection matters");
s.addText("Last year's earthquake affecting Thailand put the safety of buildings and infrastructure in focus. Cracks on concrete walls and columns are one of the earliest warning signs of structural deterioration.",
  { x: 0.7, y: 2.1, w: 6.3, h: 3.2, fontFace: BF, fontSize: 17, color: INK, valign: "top", lineSpacingMultiple: 1.3 });
const cards2 = [["Manual inspection is slow", "Large or hard-to-reach areas take time and cost"], ["Results vary by inspector", "Accuracy depends on individual experience"], ["Needs a screening aid", "Let the computer flag where to re-check"]];
let cy = 2.05;
cards2.forEach((c, i) => {
  s.addShape(p.ShapeType.roundRect, { x: 7.5, y: cy, w: 5.1, h: 1.1, rectRadius: 0.08, fill: { color: WHITE }, line: { color: "DDDDDD", width: 1 }, shadow: { type: "outer", color: "BBBBBB", blur: 6, offset: 2, angle: 90, opacity: 0.5 } });
  s.addShape(p.ShapeType.ellipse, { x: 7.75, y: cy + 0.3, w: 0.5, h: 0.5, fill: { color: AMBER } });
  s.addText(String(i + 1), { x: 7.75, y: cy + 0.3, w: 0.5, h: 0.5, align: "center", valign: "middle", fontFace: HF, fontSize: 18, bold: true, color: WHITE });
  s.addText([{ text: c[0] + "\n", options: { bold: true, fontSize: 15, color: INK } }, { text: c[1], options: { fontSize: 12, color: SLATE } }],
    { x: 8.45, y: cy + 0.12, w: 3.95, h: 0.9, fontFace: BF, valign: "middle", lineSpacingMultiple: 1.05 });
  cy += 1.25;
});

/* 3 — Objective & Scope */
s = p.addSlide(); bg(s, LIGHT);
title(s, "Objective & Scope");
s.addShape(p.ShapeType.roundRect, { x: 0.7, y: 1.5, w: 11.9, h: 1.15, rectRadius: 0.08, fill: { color: DARK } });
s.addText([{ text: "Objective   ", options: { color: AMBER, bold: true } }, { text: "Automatically detect cracks on concrete and separate real structural cracks from normal rough texture, pores, or stains.", options: { color: WHITE } }],
  { x: 1.0, y: 1.5, w: 11.3, h: 1.15, fontFace: BF, fontSize: 16, valign: "middle", lineSpacingMultiple: 1.15 });
const sc = [["Technique", "Traditional image processing only (OpenCV); no deep learning, to prove the underlying math"],
  ["Data", "CrackForest, 118 images 480×320 with pixel-level ground truth (converted from .mat to PNG)"],
  ["Task split", "Member 1 image prep · Member 2 algorithm & tuning · Member 3 evaluation & summary"],
  ["Out of scope", "Severity grading, real-world width in mm, and real-time video processing"]];
let gx = 0.7, gy = 3.0, gw = 5.85, gh = 1.75;
sc.forEach((c, i) => {
  const x = gx + (i % 2) * (gw + 0.2), y = gy + Math.floor(i / 2) * (gh + 0.2);
  s.addShape(p.ShapeType.roundRect, { x, y, w: gw, h: gh, rectRadius: 0.06, fill: { color: WHITE }, line: { color: "DDDDDD", width: 1 } });
  s.addShape(p.ShapeType.rect, { x: x + 0.3, y: y + 0.34, w: 0.14, h: 0.14, fill: { color: AMBER } });
  s.addText(c[0], { x: x + 0.55, y: y + 0.22, w: gw - 0.8, h: 0.4, fontFace: HF, fontSize: 18, bold: true, color: INK });
  s.addText(c[1], { x: x + 0.3, y: y + 0.72, w: gw - 0.6, h: 0.9, fontFace: BF, fontSize: 13.5, color: SLATE, valign: "top", lineSpacingMultiple: 1.15 });
});

/* 4 — Pipeline overview + figure */
s = p.addSlide(); bg(s, LIGHT);
title(s, "Pipeline Overview — 4 Steps", "From a photo to a clean crack mask");
imgFit(FIG("pipeline_stages.png"), 2470, 806, 0.7, 2.0, 11.9, 3.1, s);
s.addText("Gray → contrast → Adaptive Threshold (still noisy) → Morphology → shape filter → final,  vs. ground truth",
  { x: 0.7, y: 5.3, w: 11.9, h: 0.5, align: "center", fontFace: BF, fontSize: 14, italic: true, color: AMBERD });
s.addText("Figure 1 — output of each step (image 001 top row, 074 bottom row)", { x: 0.7, y: 5.85, w: 11.9, h: 0.4, align: "center", fontFace: BF, fontSize: 12, color: SLATE });

/* 5 — 4 steps detail */
s = p.addSlide(); bg(s, LIGHT);
title(s, "The Four Steps");
const steps = [["Pre-processing", "Grayscale, Gaussian blur, CLAHE contrast so dark cracks stand out"],
  ["Segmentation", "Adaptive Threshold compares each pixel to its neighbourhood; robust to uneven light"],
  ["Morphological", "Closing reconnects broken cracks; Opening removes small noise"],
  ["Shape Analysis", "Filter by area + circularity; keep thin lines, drop round blobs"]];
let px = 0.7, py = 1.9, pw = 2.95, ph = 3.9, gap = 0.3;
steps.forEach((st, i) => {
  const x = px + i * (pw + gap);
  s.addShape(p.ShapeType.roundRect, { x, y: py, w: pw, h: ph, rectRadius: 0.07, fill: { color: WHITE }, line: { color: "DDDDDD", width: 1 }, shadow: { type: "outer", color: "BBBBBB", blur: 6, offset: 2, angle: 90, opacity: 0.45 } });
  circleNum(s, i + 1, x + pw / 2 - 0.4, py + 0.35, 0.8, AMBER);
  s.addText(st[0], { x: x + 0.2, y: py + 1.35, w: pw - 0.4, h: 0.6, align: "center", fontFace: HF, fontSize: 16, bold: true, color: INK });
  s.addText(st[1], { x: x + 0.25, y: py + 2.0, w: pw - 0.5, h: 1.7, align: "center", fontFace: BF, fontSize: 13, color: SLATE, valign: "top", lineSpacingMultiple: 1.2 });
  if (i < 3) s.addShape(p.ShapeType.rightArrow, { x: x + pw + 0.02, y: py + ph / 2 - 0.16, w: 0.26, h: 0.32, fill: { color: AMBER } });
});
s.addText("All parameters come from grid search, not guesswork (stored in outputs/tuned_params.json)", { x: 0.7, y: 6.1, w: 11.9, h: 0.5, align: "center", fontFace: BF, fontSize: 14, italic: true, color: AMBERD });

/* 6 — Evaluation methodology */
s = p.addSlide(); bg(s, LIGHT);
title(s, "Trustworthy Evaluation", "Measured per pixel, with a separate train / test split");
const m6 = [["Train / held-out split", "Parameters fitted on 59 images, then scored on 59 unseen images. The gap is only 0.001"],
  ["Pick good AND stable", "Split the training set into 5 folds and choose the max of (mean − std) to avoid flukes"],
  ["Not Accuracy", "Cracks are only 2.29% of pixels; predicting \"no crack\" already scores 0.977 — use IoU and Dice"]];
let yy = 1.95;
m6.forEach((c, i) => {
  s.addShape(p.ShapeType.roundRect, { x: 0.7, y: yy, w: 11.9, h: 1.35, rectRadius: 0.07, fill: { color: WHITE }, line: { color: "DDDDDD", width: 1 } });
  s.addShape(p.ShapeType.ellipse, { x: 1.0, y: yy + 0.42, w: 0.52, h: 0.52, fill: { color: DARK } });
  s.addText(String(i + 1), { x: 1.0, y: yy + 0.42, w: 0.52, h: 0.52, align: "center", valign: "middle", fontFace: HF, fontSize: 18, bold: true, color: AMBER });
  s.addText([{ text: c[0] + "\n", options: { bold: true, fontSize: 17, color: INK } }, { text: c[1], options: { fontSize: 14, color: SLATE } }],
    { x: 1.75, y: yy + 0.15, w: 10.6, h: 1.05, fontFace: BF, valign: "middle", lineSpacingMultiple: 1.15 });
  yy += 1.55;
});

/* 7 — Metrics explainer */
s = p.addSlide(); bg(s, LIGHT);
title(s, "The Metrics", "Measured per pixel: predicted mask vs. ground truth");
imgFit(FIG("metric_diagram.png"), 996, 584, 0.5, 1.9, 6.2, 3.6, s);
s.addText([
  { text: "TP", options: { color: "1E5A3A", bold: true } }, { text: " correct   ", options: { color: SLATE } },
  { text: "FP", options: { color: AMBERD, bold: true } }, { text: " over-predicted   ", options: { color: SLATE } },
  { text: "FN", options: { color: "2E5E8E", bold: true } }, { text: " missed", options: { color: SLATE } },
], { x: 0.5, y: 5.5, w: 6.2, h: 0.4, align: "center", fontFace: BF, fontSize: 14 });
s.addText("From 118 real images:  TP 180,802 · FP 171,802 · FN 233,636", { x: 0.5, y: 5.95, w: 6.2, h: 0.4, align: "center", fontFace: BF, fontSize: 12, italic: true, color: SLATE });
const mets = [
  ["Precision", "TP / (TP + FP)", "0.53", "Of predicted crack pixels, how many are correct (cuts false alarms)", INK],
  ["Recall", "TP / (TP + FN)", "0.57", "Of real crack pixels, how many were found (cuts misses)", INK],
  ["IoU", "TP / (TP + FP + FN)", "0.35", "Overlap of the two areas · the segmentation standard", INK],
  ["Dice (F1)", "2·TP / (2·TP + FP + FN)", "0.50", "Harmonic mean of P & R · the headline number", AMBERD],
];
let myy = 1.9;
mets.forEach(m => {
  const hl = m[4] === AMBERD;
  s.addShape(p.ShapeType.roundRect, { x: 7.0, y: myy, w: 5.6, h: 1.12, rectRadius: 0.06, fill: { color: hl ? "FBEEDD" : WHITE }, line: { color: hl ? AMBER : "DDDDDD", width: 1 } });
  s.addText(m[0], { x: 7.25, y: myy + 0.12, w: 2.6, h: 0.4, fontFace: HF, fontSize: 17, bold: true, color: m[4] });
  s.addText(m[1], { x: 7.25, y: myy + 0.55, w: 3.2, h: 0.4, fontFace: "Consolas", fontSize: 13, color: SLATE });
  s.addText(m[2], { x: 10.2, y: myy + 0.1, w: 2.2, h: 0.55, align: "right", fontFace: HF, fontSize: 26, bold: true, color: m[4] });
  s.addText(m[3], { x: 7.25, y: myy + 0.74, w: 5.1, h: 0.34, fontFace: BF, fontSize: 11, color: SLATE });
  myy += 1.23;
});
s.addNotes("[Member 3] Explain the metrics: count TP/FP/FN per pixel. Precision = how much of what we predicted is right, Recall = how much of the real cracks we found, IoU/Dice combine both into one overlap score. Dice is the headline number.");

/* 8 — Headline results */
s = p.addSlide(); bg(s, LIGHT);
title(s, "Results", "Mean pixel-level metrics over all 118 real images");
const tiles = [["Dice (F1)", "0.5024", "from 0.3201", AMBER], ["IoU", "0.3533", "from 0.2051", INK], ["Precision", "0.5273", "from 0.2479", INK], ["Recall", "0.5732", "from 0.5982", INK]];
let tx = 0.7;
tiles.forEach(t => {
  s.addShape(p.ShapeType.roundRect, { x: tx, y: 1.9, w: 2.9, h: 1.7, rectRadius: 0.07, fill: { color: WHITE }, line: { color: "DDDDDD", width: 1 } });
  s.addText(t[0], { x: tx, y: 2.05, w: 2.9, h: 0.4, align: "center", fontFace: BF, fontSize: 13, bold: true, color: SLATE });
  s.addText(t[1], { x: tx, y: 2.45, w: 2.9, h: 0.7, align: "center", fontFace: HF, fontSize: 36, bold: true, color: t[3] });
  s.addText(t[2], { x: tx, y: 3.18, w: 2.9, h: 0.3, align: "center", fontFace: BF, fontSize: 12, color: "9AA3AA" });
  tx += 3.05;
});
s.addText("Dice progression across tuning rounds", { x: 0.7, y: 3.9, w: 11.9, h: 0.4, fontFace: HF, fontSize: 15, bold: true, color: INK });
s.addTable([
  [{ text: "", options: { fill: DARK } }, { text: "Baseline", options: hCell() }, { text: "Round 1", options: hCell() }, { text: "Round 2", options: hCell() }, { text: "Round 3", options: hCell() }],
  ["Precision", "0.2479", "0.5349", "0.4990", "0.5273"].map((v, i) => bCell(v, i === 0, i === 4)),
  ["Recall", "0.5982", "0.5194", "0.5781", "0.5732"].map((v, i) => bCell(v, i === 0, i === 4)),
  ["IoU", "0.2051", "0.3399", "0.3492", "0.3533"].map((v, i) => bCell(v, i === 0, i === 4)),
  ["Dice", "0.3201", "0.4872", "0.4991", "0.5024"].map((v, i) => bCell(v, i === 0, i === 4, true)),
], { x: 0.7, y: 4.35, w: 11.9, colW: [2.3, 2.4, 2.4, 2.4, 2.4], fontFace: BF, fontSize: 14, border: { type: "solid", color: "DDDDDD", pt: 1 }, valign: "middle", rowH: 0.42 });
s.addText("Precision more than doubled — the system stopped calling plain texture a crack, while Recall barely dropped", { x: 0.7, y: 6.55, w: 11.9, h: 0.4, fontFace: BF, fontSize: 13, italic: true, color: AMBERD });

/* 9 — Method comparison + figure */
s = p.addSlide(); bg(s, LIGHT);
title(s, "Compared to Other Methods", "Every method tuned the same way, all four steps active");
s.addTable([
  ["Method", "Dice (held-out)", "Dice (118)", "Wins", "False Pos."].map(h => ({ text: h, options: hCell() })),
  ...[["Adaptive", "0.5105", "0.5024", "102", "171,802", true], ["Sobel", "0.3159", "0.2927", "8", "463,628"], ["Otsu", "0.2257", "0.2428", "5", "392,289"], ["Canny", "0.2237", "0.2107", "3", "1,457,995"]]
    .map(r => r.slice(0, 5).map((v, i) => ({ text: v, options: { align: i === 0 ? "left" : "center", bold: i === 0 || r[5], color: INK, fill: r[5] ? "FBEEDD" : (i === 0 ? "F0F2F4" : WHITE), fontFace: BF, fontSize: 12 } })))
], { x: 0.7, y: 1.95, w: 6.1, colW: [1.3, 1.4, 1.1, 0.9, 1.4], border: { type: "solid", color: "DDDDDD", pt: 1 }, valign: "middle", rowH: 0.5, fontSize: 12, fontFace: BF });
s.addText("Canny & Sobel respond to sudden brightness changes — everywhere on pavement from asphalt texture, stain edges and shadows. Otsu uses one global threshold, so it grabs shadows as cracks. Adaptive asks the more specific question: is this pixel darker than its neighbours?",
  { x: 0.7, y: 4.5, w: 6.1, h: 2.3, fontFace: BF, fontSize: 14, color: INK, valign: "top", lineSpacingMultiple: 1.25 });
imgFit(FIG("method_comparison.png"), 2496, 1209, 7.0, 2.0, 5.6, 4.4, s);
s.addText("Figure 2 — masks from each method on the same image", { x: 7.0, y: 6.35, w: 5.6, h: 0.4, align: "center", fontFace: BF, fontSize: 12, color: SLATE });

/* 10 — Key finding: shape filter */
s = p.addSlide(); bg(s, DARK);
s.addText("Key Lesson", { x: 0.8, y: 0.6, w: 12, h: 0.7, fontFace: HF, fontSize: 34, bold: true, color: WHITE });
s.addText("The old shape criterion (aspect ratio) made results worse", { x: 0.82, y: 1.45, w: 12, h: 0.5, fontFace: BF, fontSize: 18, color: AMBER, italic: true });
s.addText([
  { text: "Aspect ratio ", options: { bold: true, color: WHITE } },
  { text: "of the bounding box assumes a crack is straight — a T-shaped or branching crack has a near-square box and gets discarded whole.", options: { color: "CBD1D6" } }],
  { x: 0.8, y: 2.15, w: 6.0, h: 2.0, fontFace: BF, fontSize: 16, valign: "top", lineSpacingMultiple: 1.3 });
s.addText([
  { text: "Circularity ", options: { bold: true, color: WHITE } },
  { text: "= 4·π·area / perimeter² does not depend on curvature, so thin cracks pass however much they bend. Images that scored 0.0000 came back to 0.58.", options: { color: "CBD1D6" } }],
  { x: 0.8, y: 4.25, w: 6.0, h: 2.0, fontFace: BF, fontSize: 16, valign: "top", lineSpacingMultiple: 1.3 });
const crit = [["circularity (new)", 0.5243, true], ["no shape filter", 0.5201, false], ["both criteria", 0.5030, false], ["aspect ratio (old)", 0.4997, false]];
let by = 2.3;
crit.forEach(c => {
  s.addText(c[0], { x: 7.0, y: by, w: 3.0, h: 0.4, fontFace: BF, fontSize: 13, color: c[2] ? WHITE : "AEB6BC", bold: c[2] });
  s.addShape(p.ShapeType.rect, { x: 10.0, y: by + 0.02, w: 2.5, h: 0.3, fill: { color: "3A4046" } });
  s.addShape(p.ShapeType.rect, { x: 10.0, y: by + 0.02, w: 2.5 * (c[1] / 0.55), h: 0.3, fill: { color: c[2] ? AMBER : "6B747B" } });
  s.addText(c[1].toFixed(4), { x: 10.0, y: by - 0.02, w: 2.5, h: 0.34, align: "right", fontFace: HF, fontSize: 11, color: WHITE, bold: c[2] });
  by += 0.72;
});
s.addText("Best Dice on training images. The old criterion (0.4997) is worse than no shape filter (0.5201) — the new one (0.5243) is the first to justify this step.", { x: 7.0, y: 5.5, w: 5.6, h: 1.0, fontFace: BF, fontSize: 13, italic: true, color: AMBER, valign: "top", lineSpacingMultiple: 1.2 });

/* 11 — Success & failure cases */
s = p.addSlide(); bg(s, LIGHT);
title(s, "Example Results", "original · ground truth · prediction · overlay");
imgFit(FIG("success_cases.png"), 1690, 1612, 0.7, 1.85, 5.7, 3.7, s);
s.addText("Works well — clear crack contrast and a uniform background", { x: 0.7, y: 5.6, w: 5.7, h: 0.4, align: "center", fontFace: BF, fontSize: 12, bold: true, color: GOOD });
imgFit(FIG("failure_cases.png"), 1690, 1612, 6.9, 1.85, 5.7, 3.7, s);
s.addText("Low scores — some are ground-truth issues, not detection errors", { x: 6.9, y: 5.6, w: 5.7, h: 0.4, align: "center", fontFace: BF, fontSize: 12, bold: true, color: AMBERD });
s.addText("Image 021: the system finds real crazing on the painted lane line that CrackForest did not annotate → a pixel metric punishes finding what the annotator did not draw",
  { x: 0.7, y: 6.15, w: 11.9, h: 0.9, align: "center", fontFace: BF, fontSize: 13, italic: true, color: SLATE, valign: "top", lineSpacingMultiple: 1.15 });

/* 12 — Future + conclusion */
s = p.addSlide(); bg(s, DARK);
s.addText("Future Work & Conclusion", { x: 0.8, y: 0.6, w: 12, h: 0.8, fontFace: HF, fontSize: 34, bold: true, color: WHITE });
s.addText("The pipeline runs at 7.0 ms/image (143 img/s) — light enough for small hardware", { x: 0.82, y: 1.5, w: 12, h: 0.5, fontFace: BF, fontSize: 17, color: AMBER, italic: true });
const fut = [["Embed Edge AI", "Optimize to run on ESP32/FPGA with inspection drones"], ["Improve step 4", "It still discards 20.2% of found crack pixels — recoverable"], ["Real width", "Convert to millimetres to grade crack severity"], ["Test indoor concrete", "Current data is road surface, harder than the brief"]];
let fx = 0.8, fy = 2.5, fw = 2.9, fh = 2.2;
fut.forEach((f, i) => {
  const x = fx + i * (fw + 0.2);
  s.addShape(p.ShapeType.roundRect, { x, y: fy, w: fw, h: fh, rectRadius: 0.07, fill: { color: "3A4046" }, line: { color: "4E555B", width: 1 } });
  circleNum(s, i + 1, x + 0.3, fy + 0.3, 0.65, AMBER);
  s.addText(f[0], { x: x + 0.3, y: fy + 1.05, w: fw - 0.6, h: 0.4, fontFace: HF, fontSize: 16, bold: true, color: WHITE });
  s.addText(f[1], { x: x + 0.3, y: fy + 1.45, w: fw - 0.55, h: 0.7, fontFace: BF, fontSize: 12, color: "CBD1D6", valign: "top", lineSpacingMultiple: 1.15 });
});
s.addText([{ text: "In short: ", options: { bold: true, color: AMBER } }, { text: "systematically tuned traditional image processing reaches Dice 0.5024 on real images, and Adaptive Threshold beats Otsu/Canny/Sobel on 102 of 118 images.", options: { color: WHITE } }],
  { x: 0.8, y: 5.15, w: 11.8, h: 0.9, fontFace: BF, fontSize: 15, valign: "top", lineSpacingMultiple: 1.25 });
s.addText("Thank you", { x: 0.8, y: 6.25, w: 11.7, h: 0.7, fontFace: HF, fontSize: 26, bold: true, color: WHITE });

/* speaker notes */
p.slides[0].addNotes("[Member 1] Hello, today we present our project: Concrete Crack Detection using traditional image processing.");
p.slides[1].addNotes("[Member 1] Motivated by the earthquake; cracks are an early warning sign, but manual inspection is slow and inconsistent.");
p.slides[2].addNotes("[Member 1] Goal: separate real cracks from normal texture, using traditional IP only, tested on 118 CrackForest images.");
p.slides[3].addNotes("[Member 2] Four-step pipeline; steps 3-4 mainly clean up the noise that step 2 picks up.");
p.slides[4].addNotes("[Member 2] Walk through each step: pre-processing, adaptive threshold, morphology, shape analysis. Parameters from grid search.");
p.slides[5].addNotes("[Member 3] Pixel-level evaluation, separate train/test, and no accuracy because the data is imbalanced.");
p.slides[7].addNotes("[Member 3] Headline Dice 0.5024 from 0.3201; the big change is precision more than doubling.");
p.slides[8].addNotes("[Member 3] Adaptive beats the others on 102/118 images because edge and Otsu are fooled by texture and shadows.");
p.slides[9].addNotes("[Member 2] Lesson: the old aspect-ratio criterion discarded curved cracks; switching to circularity clearly helped.");
p.slides[10].addNotes("[Member 3] Good and failing cases; some failures are ground-truth issues, not the system's fault.");
p.slides[11].addNotes("[Member 1] Future work toward Edge AI / drones; the pipeline is fast enough. Conclusion and thanks.");

p.writeFile({ fileName: path.join(__dirname, "Concrete Crack Detection - Presentation (EN).pptx") }).then(f => console.log("WROTE", f));
