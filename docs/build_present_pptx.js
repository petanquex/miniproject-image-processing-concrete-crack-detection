// Final presentation deck (Thai, results-focused) for Concrete Crack Detection.
const pptxgen = require("pptxgenjs");
const path = require("path");
const p = new pptxgen();
p.layout = "LAYOUT_WIDE"; // 13.3 x 7.5
const FIG = f => path.join(__dirname, "figures", f);

const DARK = "2E3338", SLATE = "5B6770", LIGHT = "F4F4F2", WHITE = "FFFFFF";
const AMBER = "E8871E", AMBERD = "B5670F", INK = "222629", GOOD = "2C7A52";
const HF = "Leelawadee UI", BF = "Leelawadee UI"; // Thai-safe on Windows

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
  return { w, h };
}

/* 1 — Title */
let s = p.addSlide(); bg(s, DARK);
for (let i = 0; i < 8; i++) s.addShape(p.ShapeType.line, { x: i * 1.7, y: 5.0 + (i % 2 ? 0.35 : -0.15), w: 1.7, h: 0.4, line: { color: AMBER, width: 3 }, flipV: i % 2 === 0 });
s.addText("IMAGE PROCESSING · MINI PROJECT", { x: 0.8, y: 1.0, w: 11, h: 0.4, fontFace: BF, fontSize: 14, color: AMBER, charSpacing: 3, bold: true });
s.addText("ระบบตรวจจับรอยร้าวบนพื้นผิวคอนกรีต", { x: 0.8, y: 1.6, w: 11.7, h: 1.1, fontFace: HF, fontSize: 44, bold: true, color: WHITE });
s.addText("ตรวจจับรอยร้าวเชิงโครงสร้างด้วยการประมวลผลภาพแบบดั้งเดิม (ไม่ใช้ Deep Learning) วัดผลบน CrackForest 118 ภาพ",
  { x: 0.8, y: 2.9, w: 11, h: 0.9, fontFace: BF, fontSize: 18, color: "CBD1D6" });
s.addText([{ text: "นำเสนอโดย  ", options: { color: "9AA3AA" } }, { text: "สมาชิก 1  ·  สมาชิก 2  ·  สมาชิก 3", options: { color: WHITE, bold: true } }],
  { x: 0.8, y: 6.4, w: 11, h: 0.5, fontFace: BF, fontSize: 16 });

/* 2 — Problem & Motivation */
s = p.addSlide(); bg(s, LIGHT);
title(s, "ปัญหาและแรงบันดาลใจ", "ทำไมต้องตรวจจับรอยร้าวอัตโนมัติ");
s.addText("เหตุการณ์แผ่นดินไหวที่กระทบประเทศไทยทำให้ความปลอดภัยของอาคารและโครงสร้างพื้นฐานถูกให้ความสำคัญมากขึ้น รอยร้าวบนคอนกรีตเป็นสัญญาณเตือนแรกสุดของการเสื่อมสภาพเชิงโครงสร้าง",
  { x: 0.7, y: 2.1, w: 6.3, h: 3.2, fontFace: BF, fontSize: 17, color: INK, valign: "top", lineSpacingMultiple: 1.3 });
const cards2 = [["ตรวจด้วยสายตา ช้าและแพง", "พื้นที่ใหญ่หรือจุดเข้าถึงยาก ใช้เวลานาน"], ["ผลขึ้นกับคน", "ความแม่นยำต่างกันตามประสบการณ์ผู้ตรวจ"], ["ต้องการตัวช่วยคัดกรอง", "ให้คอมพิวเตอร์ชี้จุดที่ควรตรวจซ้ำ"]];
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
title(s, "จุดประสงค์และขอบเขต");
s.addShape(p.ShapeType.roundRect, { x: 0.7, y: 1.5, w: 11.9, h: 1.15, rectRadius: 0.08, fill: { color: DARK } });
s.addText([{ text: "จุดประสงค์   ", options: { color: AMBER, bold: true } }, { text: "ตรวจจับรอยร้าวบนคอนกรีตอัตโนมัติ และแยกรอยร้าวจริงออกจากผิวขรุขระ รูพรุน หรือรอยเปื้อน", options: { color: WHITE } }],
  { x: 1.0, y: 1.5, w: 11.3, h: 1.15, fontFace: BF, fontSize: 16, valign: "middle", lineSpacingMultiple: 1.15 });
const sc = [["เทคนิค", "Traditional Image Processing ล้วน (OpenCV) ไม่ใช้ Deep Learning เพื่อพิสูจน์ลอจิกทางคณิตศาสตร์"],
  ["ข้อมูล", "CrackForest 118 ภาพ 480×320 มีภาพเฉลยระดับพิกเซล (แปลงจาก .mat เป็น PNG)"],
  ["การแบ่งงาน", "คน 1 เตรียมภาพ · คน 2 อัลกอริทึม+จูน · คน 3 วัดผล+สรุป"],
  ["นอกขอบเขต", "ประเมินความรุนแรง วัดความกว้างจริง และงานวิดีโอเรียลไทม์"]];
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
title(s, "ภาพรวมไปป์ไลน์ 4 ขั้นตอน", "จากภาพถ่าย → mask รอยร้าวที่สะอาด");
imgFit(FIG("pipeline_stages.png"), 2470, 806, 0.7, 2.0, 11.9, 3.1, s);
s.addText("เทา → ปรับ contrast → Adaptive Threshold (ยังมี noise) → Morphology → กรองรูปทรง → ผลสุดท้าย  เทียบภาพเฉลย",
  { x: 0.7, y: 5.3, w: 11.9, h: 0.5, align: "center", fontFace: BF, fontSize: 14, italic: true, color: AMBERD });
s.addText("รูปที่ 1 — ผลของแต่ละขั้น (ภาพ 001 แถวบน, 074 แถวล่าง)", { x: 0.7, y: 5.85, w: 11.9, h: 0.4, align: "center", fontFace: BF, fontSize: 12, color: SLATE });

/* 5 — 4 steps detail */
s = p.addSlide(); bg(s, LIGHT);
title(s, "รายละเอียดแต่ละขั้นตอน");
const steps = [["Pre-processing", "เทา, Gaussian blur, เพิ่ม contrast ด้วย CLAHE ให้รอยร้าวเข้มตัดกับพื้น"],
  ["Segmentation", "Adaptive Threshold เทียบพิกเซลกับเพื่อนบ้าน ทนแสงไม่สม่ำเสมอ"],
  ["Morphological", "Closing เชื่อมรอยที่ขาด, Opening ลบ noise เล็ก ๆ"],
  ["Shape Analysis", "กรองด้วยพื้นที่ + circularity เก็บเฉพาะเส้นเรียว ทิ้งจุดกลม"]];
let px = 0.7, py = 1.9, pw = 2.95, ph = 3.9, gap = 0.3;
steps.forEach((st, i) => {
  const x = px + i * (pw + gap);
  s.addShape(p.ShapeType.roundRect, { x, y: py, w: pw, h: ph, rectRadius: 0.07, fill: { color: WHITE }, line: { color: "DDDDDD", width: 1 }, shadow: { type: "outer", color: "BBBBBB", blur: 6, offset: 2, angle: 90, opacity: 0.45 } });
  circleNum(s, i + 1, x + pw / 2 - 0.4, py + 0.35, 0.8, AMBER);
  s.addText(st[0], { x: x + 0.2, y: py + 1.35, w: pw - 0.4, h: 0.6, align: "center", fontFace: HF, fontSize: 16, bold: true, color: INK });
  s.addText(st[1], { x: x + 0.25, y: py + 2.0, w: pw - 0.5, h: 1.7, align: "center", fontFace: BF, fontSize: 13, color: SLATE, valign: "top", lineSpacingMultiple: 1.2 });
  if (i < 3) s.addShape(p.ShapeType.rightArrow, { x: x + pw + 0.02, y: py + ph / 2 - 0.16, w: 0.26, h: 0.32, fill: { color: AMBER } });
});
s.addText("พารามิเตอร์ทุกค่าได้จาก grid search ไม่ได้ตั้งด้วยการเดา (เก็บใน outputs/tuned_params.json)", { x: 0.7, y: 6.1, w: 11.9, h: 0.5, align: "center", fontFace: BF, fontSize: 14, italic: true, color: AMBERD });

/* 6 — Evaluation methodology */
s = p.addSlide(); bg(s, LIGHT);
title(s, "วิธีวัดผลให้เชื่อถือได้", "วัดระดับพิกเซล + แยกภาพฝึกกับภาพทดสอบ");
const m6 = [["แยก train / held-out", "ค้นหาพารามิเตอร์จาก 59 ภาพ แล้ววัดผลบนอีก 59 ภาพที่ไม่เคยเห็น ช่องว่างเหลือเพียง 0.001"],
  ["เลือกที่ดีและนิ่ง", "แบ่งภาพฝึกเป็น 5 กลุ่ม เลือกชุด (ค่าเฉลี่ย − ส่วนเบี่ยงเบน) สูงสุด กันผลฟลุก"],
  ["ไม่ใช้ Accuracy", "รอยร้าวมีแค่ 2.29% ตอบ \"ไม่มีรอยร้าว\" ทุกพิกเซลก็ได้ 0.977 — ใช้ IoU และ Dice แทน"]];
let yy = 1.95;
m6.forEach((c, i) => {
  s.addShape(p.ShapeType.roundRect, { x: 0.7, y: yy, w: 11.9, h: 1.35, rectRadius: 0.07, fill: { color: WHITE }, line: { color: "DDDDDD", width: 1 } });
  s.addShape(p.ShapeType.ellipse, { x: 1.0, y: yy + 0.42, w: 0.52, h: 0.52, fill: { color: DARK } });
  s.addText(String(i + 1), { x: 1.0, y: yy + 0.42, w: 0.52, h: 0.52, align: "center", valign: "middle", fontFace: HF, fontSize: 18, bold: true, color: AMBER });
  s.addText([{ text: c[0] + "\n", options: { bold: true, fontSize: 17, color: INK } }, { text: c[1], options: { fontSize: 14, color: SLATE } }],
    { x: 1.75, y: yy + 0.15, w: 10.6, h: 1.05, fontFace: BF, valign: "middle", lineSpacingMultiple: 1.15 });
  yy += 1.55;
});

/* 6b — Metrics explainer */
s = p.addSlide(); bg(s, LIGHT);
title(s, "ตัวชี้วัดที่ใช้วัดผล", "วัดทีละพิกเซล เทียบ mask ที่ทายกับภาพเฉลย");
imgFit(FIG("metric_diagram.png"), 996, 584, 0.5, 1.9, 6.2, 3.6, s);
s.addText([
  { text: "TP", options: { color: "1E5A3A", bold: true } }, { text: " ถูก   ", options: { color: SLATE } },
  { text: "FP", options: { color: AMBERD, bold: true } }, { text: " ทายเกิน   ", options: { color: SLATE } },
  { text: "FN", options: { color: "2E5E8E", bold: true } }, { text: " พลาด", options: { color: SLATE } },
], { x: 0.5, y: 5.5, w: 6.2, h: 0.4, align: "center", fontFace: BF, fontSize: 14 });
s.addText("จากงานจริง 118 ภาพ:  TP 180,802 · FP 171,802 · FN 233,636", { x: 0.5, y: 5.95, w: 6.2, h: 0.4, align: "center", fontFace: BF, fontSize: 12, italic: true, color: SLATE });
const mets = [
  ["Precision", "TP / (TP + FP)", "0.53", "ที่ทายว่ารอยร้าว ถูกจริงกี่ % (ลดเตือนลวง)", INK],
  ["Recall", "TP / (TP + FN)", "0.57", "รอยร้าวจริงทั้งหมด จับได้กี่ % (ลดที่พลาด)", INK],
  ["IoU", "TP / (TP + FP + FN)", "0.35", "ความซ้อนทับของสองพื้นที่ · มาตรฐาน segmentation", INK],
  ["Dice (F1)", "2·TP / (2·TP + FP + FN)", "0.50", "เฉลี่ยฮาร์มอนิกของ P&R · เลขหลักที่รายงาน", AMBERD],
];
let myy = 1.9;
mets.forEach(m => {
  const hl = m[4] === AMBERD;
  s.addShape(p.ShapeType.roundRect, { x: 7.0, y: myy, w: 5.6, h: 1.12, rectRadius: 0.06, fill: { color: hl ? "FBEEDD" : WHITE }, line: { color: hl ? AMBER : "DDDDDD", width: 1 } });
  s.addText(m[0], { x: 7.25, y: myy + 0.12, w: 2.5, h: 0.4, fontFace: HF, fontSize: 17, bold: true, color: m[4] });
  s.addText(m[1], { x: 7.25, y: myy + 0.55, w: 3.1, h: 0.4, fontFace: "Consolas", fontSize: 13, color: SLATE });
  s.addText(m[2], { x: 10.2, y: myy + 0.1, w: 2.2, h: 0.55, align: "right", fontFace: HF, fontSize: 26, bold: true, color: m[4] });
  s.addText(m[3], { x: 7.25, y: myy + 0.72, w: 5.1, h: 0.35, fontFace: BF, fontSize: 12, color: SLATE });
  myy += 1.23;
});
s.addNotes("[สมาชิก 3] อธิบายตัวชี้วัด: นับ TP/FP/FN ทีละพิกเซล  Precision = ถูกจริงกี่ % ของที่ทาย, Recall = จับได้กี่ % ของจริง, IoU = ความซ้อนทับ, Dice = เลขหลักที่รายงาน สองตัวแรกบอกมั่ว/พลาดแยกกัน สองตัวหลังรวมเป็นตัวเดียว");

/* 7 — Headline results */
s = p.addSlide(); bg(s, LIGHT);
title(s, "ผลการทดลอง", "ค่าเฉลี่ยระดับพิกเซลบนภาพจริงทั้ง 118 ภาพ");
const tiles = [["Dice (F1)", "0.5024", "จาก 0.3201", AMBER], ["IoU", "0.3533", "จาก 0.2051", INK], ["Precision", "0.5273", "จาก 0.2479", INK], ["Recall", "0.5732", "จาก 0.5982", INK]];
let tx = 0.7;
tiles.forEach(t => {
  s.addShape(p.ShapeType.roundRect, { x: tx, y: 1.9, w: 2.9, h: 1.7, rectRadius: 0.07, fill: { color: WHITE }, line: { color: "DDDDDD", width: 1 } });
  s.addText(t[0], { x: tx, y: 2.05, w: 2.9, h: 0.4, align: "center", fontFace: BF, fontSize: 13, bold: true, color: SLATE });
  s.addText(t[1], { x: tx, y: 2.45, w: 2.9, h: 0.7, align: "center", fontFace: HF, fontSize: 36, bold: true, color: t[3] });
  s.addText(t[2], { x: tx, y: 3.18, w: 2.9, h: 0.3, align: "center", fontFace: BF, fontSize: 12, color: "9AA3AA" });
  tx += 3.05;
});
s.addText("พัฒนาการของ Dice ตามรอบการจูน", { x: 0.7, y: 3.9, w: 11.9, h: 0.4, fontFace: HF, fontSize: 15, bold: true, color: INK });
s.addTable([
  [{ text: "", options: { fill: DARK } }, { text: "ค่าเริ่มต้น", options: hCell() }, { text: "รอบ 1", options: hCell() }, { text: "รอบ 2", options: hCell() }, { text: "รอบ 3", options: hCell() }],
  ["Precision", "0.2479", "0.5349", "0.4990", "0.5273"].map((v, i) => bCell(v, i === 0, i === 4)),
  ["Recall", "0.5982", "0.5194", "0.5781", "0.5732"].map((v, i) => bCell(v, i === 0, i === 4)),
  ["IoU", "0.2051", "0.3399", "0.3492", "0.3533"].map((v, i) => bCell(v, i === 0, i === 4)),
  ["Dice", "0.3201", "0.4872", "0.4991", "0.5024"].map((v, i) => bCell(v, i === 0, i === 4, true)),
], { x: 0.7, y: 4.35, w: 11.9, colW: [2.3, 2.4, 2.4, 2.4, 2.4], fontFace: BF, fontSize: 14, border: { type: "solid", color: "DDDDDD", pt: 1 }, valign: "middle", rowH: 0.42 });
s.addText("Precision เพิ่มกว่าเท่าตัว = ระบบเลิกทายพื้นผิวธรรมดาว่าเป็นรอยร้าว ขณะที่ Recall ลดเพียงเล็กน้อย", { x: 0.7, y: 6.55, w: 11.9, h: 0.4, fontFace: BF, fontSize: 13, italic: true, color: AMBERD });
function hCell() { return { fill: DARK, color: WHITE, bold: true, align: "center", fontFace: BF, fontSize: 13 }; }
function bCell(v, label, last, hl) { return { text: v, options: { align: label ? "left" : "center", bold: label || last || hl, color: hl ? AMBERD : INK, fill: hl ? "FBEEDD" : (label ? "F0F2F4" : WHITE) } }; }

/* 8 — Method comparison + figure */
s = p.addSlide(); bg(s, LIGHT);
title(s, "เทียบกับวิธีอื่น", "ทุกวิธีจูนด้วยกระบวนการเดียวกัน เปิดครบ 4 ขั้นตอน");
s.addTable([
  ["วิธี", "Dice (กันไว้)", "Dice (118)", "ชนะขาด", "False Positive"].map(h => ({ text: h, options: hCell() })),
  ...[["Adaptive", "0.5105", "0.5024", "102", "171,802", true], ["Sobel", "0.3159", "0.2927", "8", "463,628"], ["Otsu", "0.2257", "0.2428", "5", "392,289"], ["Canny", "0.2237", "0.2107", "3", "1,457,995"]]
    .map(r => r.slice(0, 5).map((v, i) => ({ text: v, options: { align: i === 0 ? "left" : "center", bold: i === 0 || r[5], color: INK, fill: r[5] ? "FBEEDD" : (i === 0 ? "F0F2F4" : WHITE), fontFace: BF, fontSize: 13 } })))
], { x: 0.7, y: 1.95, w: 6.1, colW: [1.5, 1.3, 1.1, 1.0, 1.2], border: { type: "solid", color: "DDDDDD", pt: 1 }, valign: "middle", rowH: 0.5, fontSize: 13, fontFace: BF });
s.addText("Edge (Canny/Sobel) ตอบสนองต่อ texture ยางมะตอย ขอบคราบ และเงา ส่วน Otsu ใช้ค่าขีดแบ่งค่าเดียวทั้งภาพ จึงตัดเงามาเป็นรอยร้าว Adaptive ถามคำถามที่เจาะจงกว่า: พิกเซลนี้มืดกว่าเพื่อนบ้านไหม",
  { x: 0.7, y: 4.5, w: 6.1, h: 2.3, fontFace: BF, fontSize: 14, color: INK, valign: "top", lineSpacingMultiple: 1.25 });
imgFit(FIG("method_comparison.png"), 2496, 1209, 7.0, 2.0, 5.6, 4.4, s);
s.addText("รูปที่ 2 — mask จากแต่ละวิธีบนภาพเดียวกัน", { x: 7.0, y: 6.35, w: 5.6, h: 0.4, align: "center", fontFace: BF, fontSize: 12, color: SLATE });

/* 9 — Key finding: shape filter */
s = p.addSlide(); bg(s, DARK);
s.addText("บทเรียนสำคัญ", { x: 0.8, y: 0.6, w: 12, h: 0.7, fontFace: HF, fontSize: 34, bold: true, color: WHITE });
s.addText("เกณฑ์กรองรูปทรงเดิม (aspect ratio) ทำให้ผลแย่ลง", { x: 0.82, y: 1.45, w: 12, h: 0.5, fontFace: BF, fontSize: 18, color: AMBER, italic: true });
s.addText([
  { text: "aspect ratio ", options: { bold: true, color: WHITE } },
  { text: "ของกรอบสี่เหลี่ยม สมมติว่ารอยร้าวเป็นเส้นตรง — รอยร้าวรูปตัว T หรือแตกแขนงจะมีกรอบเกือบจัตุรัส แล้วถูกตัดทิ้งทั้งเส้น", options: { color: "CBD1D6" } }],
  { x: 0.8, y: 2.15, w: 6.0, h: 2.0, fontFace: BF, fontSize: 16, valign: "top", lineSpacingMultiple: 1.3 });
s.addText([
  { text: "circularity ", options: { bold: true, color: WHITE } },
  { text: "= 4·π·area / perimeter² ไม่ขึ้นกับความโค้ง เก็บเส้นเรียวได้ทุกแบบ ทำให้ภาพที่เคยได้ 0.0000 กลับมาได้ 0.58", options: { color: "CBD1D6" } }],
  { x: 0.8, y: 4.25, w: 6.0, h: 2.0, fontFace: BF, fontSize: 16, valign: "top", lineSpacingMultiple: 1.3 });
// comparison bars
const crit = [["circularity (ใหม่)", 0.5243, true], ["ไม่กรองรูปทรง", 0.5201, false], ["ใช้ทั้งสองเกณฑ์", 0.5030, false], ["aspect ratio (เดิม)", 0.4997, false]];
let by = 2.3;
crit.forEach(c => {
  s.addText(c[0], { x: 7.0, y: by, w: 3.0, h: 0.4, fontFace: BF, fontSize: 13, color: c[2] ? WHITE : "AEB6BC", bold: c[2] });
  s.addShape(p.ShapeType.rect, { x: 10.0, y: by + 0.02, w: 2.5, h: 0.3, fill: { color: "3A4046" } });
  s.addShape(p.ShapeType.rect, { x: 10.0, y: by + 0.02, w: 2.5 * (c[1] / 0.55), h: 0.3, fill: { color: c[2] ? AMBER : "6B747B" } });
  s.addText(c[1].toFixed(4), { x: 10.0, y: by - 0.02, w: 2.5, h: 0.34, align: "right", fontFace: HF, fontSize: 11, color: WHITE, bold: c[2] });
  by += 0.72;
});
s.addText("เกณฑ์เดิม (0.4997) แย่กว่าการไม่กรองเลย (0.5201) — ครั้งแรกที่ขั้นตอนนี้มีเหตุผลเชิงตัวเลขรองรับ", { x: 7.0, y: 5.5, w: 5.6, h: 0.8, fontFace: BF, fontSize: 13, italic: true, color: AMBER, valign: "top", lineSpacingMultiple: 1.2 });

/* 10 — Success & failure cases */
s = p.addSlide(); bg(s, LIGHT);
title(s, "ตัวอย่างผลลัพธ์", "ต้นฉบับ · ภาพเฉลย · ผลทำนาย · ซ้อนทับ");
imgFit(FIG("success_cases.png"), 1690, 1612, 0.7, 1.85, 5.7, 3.7, s);
s.addText("กรณีที่ทำงานได้ดี — รอยร้าว contrast ชัด พื้นหลังสม่ำเสมอ", { x: 0.7, y: 5.6, w: 5.7, h: 0.4, align: "center", fontFace: BF, fontSize: 12, bold: true, color: GOOD });
imgFit(FIG("failure_cases.png"), 1690, 1612, 6.9, 1.85, 5.7, 3.7, s);
s.addText("กรณีที่คะแนนต่ำ — บางภาพเป็นปัญหาของภาพเฉลยเอง", { x: 6.9, y: 5.6, w: 5.7, h: 0.4, align: "center", fontFace: BF, fontSize: 12, bold: true, color: AMBERD });
s.addText("ภาพ 021: ระบบจับรอยแตกลายงาบนเส้นจราจรที่เป็นรอยจริง แต่ภาพเฉลยไม่ได้ทำเครื่องหมายไว้ → ตัววัดระดับพิกเซลลงโทษการเจอสิ่งที่คนวาดเฉลยไม่ได้วาด",
  { x: 0.7, y: 6.15, w: 11.9, h: 0.9, align: "center", fontFace: BF, fontSize: 13, italic: true, color: SLATE, valign: "top", lineSpacingMultiple: 1.15 });

/* 11 — Future + conclusion */
s = p.addSlide(); bg(s, DARK);
s.addText("การต่อยอด และสรุป", { x: 0.8, y: 0.6, w: 12, h: 0.8, fontFace: HF, fontSize: 34, bold: true, color: WHITE });
s.addText("ไปป์ไลน์เร็ว 7.0 ms/ภาพ (143 ภาพ/วินาที) — เหมาะกับการฝังลงฮาร์ดแวร์เล็ก", { x: 0.82, y: 1.5, w: 12, h: 0.5, fontFace: BF, fontSize: 17, color: AMBER, italic: true });
const fut = [["ฝัง Edge AI", "ปรับให้เบาลง รันบน ESP32/FPGA + โดรนสำรวจ"], ["ปรับขั้นที่ 4", "ยังตัดรอยร้าวจริงทิ้ง 20.2% เก็บกลับได้อีก"], ["วัดความกว้างจริง", "แปลงเป็นมิลลิเมตรเพื่อประเมินความรุนแรง"], ["ทดสอบผิวในอาคาร", "ชุดข้อมูลปัจจุบันเป็นผิวถนน ยากกว่าโจทย์ตั้งต้น"]];
let fx = 0.8, fy = 2.5, fw = 2.9, fh = 2.2;
fut.forEach((f, i) => {
  const x = fx + i * (fw + 0.2);
  s.addShape(p.ShapeType.roundRect, { x, y: fy, w: fw, h: fh, rectRadius: 0.07, fill: { color: "3A4046" }, line: { color: "4E555B", width: 1 } });
  circleNum(s, i + 1, x + 0.3, fy + 0.3, 0.65, AMBER);
  s.addText(f[0], { x: x + 0.3, y: fy + 1.05, w: fw - 0.6, h: 0.4, fontFace: HF, fontSize: 16, bold: true, color: WHITE });
  s.addText(f[1], { x: x + 0.3, y: fy + 1.45, w: fw - 0.55, h: 0.7, fontFace: BF, fontSize: 12, color: "CBD1D6", valign: "top", lineSpacingMultiple: 1.15 });
});
s.addText([{ text: "สรุป: ", options: { bold: true, color: AMBER } }, { text: "การประมวลผลภาพแบบดั้งเดิมที่จูนอย่างเป็นระบบ ได้ Dice 0.5024 บนภาพจริง และ Adaptive Threshold ชนะ Otsu/Canny/Sobel 102 จาก 118 ภาพ", options: { color: WHITE } }],
  { x: 0.8, y: 5.15, w: 11.8, h: 0.9, fontFace: BF, fontSize: 15, valign: "top", lineSpacingMultiple: 1.25 });
s.addText("ขอบคุณครับ/ค่ะ", { x: 0.8, y: 6.25, w: 11.7, h: 0.7, fontFace: HF, fontSize: 26, bold: true, color: WHITE });

/* speaker notes */
p.slides[0].addNotes("[สมาชิก 1] สวัสดีครับ/ค่ะ วันนี้นำเสนอโปรเจกต์ระบบตรวจจับรอยร้าวบนพื้นผิวคอนกรีต ด้วยการประมวลผลภาพแบบดั้งเดิม");
p.slides[1].addNotes("[สมาชิก 1] ที่มาจากแผ่นดินไหว รอยร้าวเป็นสัญญาณเตือนแรก แต่ตรวจด้วยคนช้าและขึ้นกับประสบการณ์");
p.slides[2].addNotes("[สมาชิก 1] จุดประสงค์คือแยกรอยร้าวจริงจากพื้นผิวปกติ ใช้ traditional IP ล้วน ทดสอบบน CrackForest 118 ภาพ");
p.slides[3].addNotes("[สมาชิก 2] ไปป์ไลน์ 4 ขั้น จะเห็นว่าขั้น 3-4 ทำหน้าที่กำจัด noise ที่ขั้น 2 ติดมา");
p.slides[4].addNotes("[สมาชิก 2] อธิบายแต่ละขั้น: pre-processing, adaptive threshold, morphology, shape analysis พารามิเตอร์มาจาก grid search");
p.slides[5].addNotes("[สมาชิก 3] วัดผลระดับพิกเซล แยกภาพฝึกกับภาพทดสอบ และไม่ใช้ accuracy เพราะข้อมูลไม่สมดุล");
p.slides[7].addNotes("[สมาชิก 3] ผลหลัก Dice 0.5024 จาก 0.3201 จุดที่เปลี่ยนมากคือ precision ที่เพิ่มเท่าตัว");
p.slides[8].addNotes("[สมาชิก 3] Adaptive ชนะวิธีอื่น 102/118 ภาพ เพราะ edge และ otsu ไวต่อ texture และเงา");
p.slides[9].addNotes("[สมาชิก 2] บทเรียน: เกณฑ์ aspect ratio เดิมตัดรอยร้าวโค้งทิ้ง เปลี่ยนเป็น circularity ดีขึ้นชัด");
p.slides[10].addNotes("[สมาชิก 3] ตัวอย่างผลดีและล้มเหลว บางกรณีเป็นปัญหาของภาพเฉลยเอง ไม่ใช่ของระบบ");
p.slides[11].addNotes("[สมาชิก 1] ต่อยอดสู่ Edge AI/โดรน ไปป์ไลน์เร็วพอ และสรุปผลงาน ขอบคุณครับ/ค่ะ");

p.writeFile({ fileName: path.join(__dirname, "Concrete Crack Detection - Presentation.pptx") }).then(f => console.log("WROTE", f));
