// Rebuild Report.docx as a proper Word document (clean styles, TOC, tables, figures).
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, TableOfContents,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  AlignmentType, ImageRun, PageBreak, LevelFormat, Numbering
} = require("docx");

const FONT = "TH Sarabun New";
const MONO = "Consolas";
const INK = "14171A", INK2 = "555D65", INK3 = "7C858D";
const ACCENT = "B5372C", DATA = "2E5E8E", GOOD = "2C7A52";
const HDR_FILL = "E7EBEE", HL_FILL = "F1F4F6";
const NOTE_ACCENT = "F6E4E1", NOTE_DATA = "E1EAF3";
const CW = 9026; // content width in DXA (A4, 1in margins)
const FIGDIR = path.join(__dirname, "figures");

// ---- inline **bold** parser ----
function runs(text, base = {}) {
  const out = [];
  text.split(/(\*\*[^*]+\*\*)/g).forEach(seg => {
    if (!seg) return;
    if (seg.startsWith("**") && seg.endsWith("**"))
      out.push(new TextRun({ text: seg.slice(2, -2), bold: true, font: FONT, ...base }));
    else out.push(new TextRun({ text: seg, font: FONT, ...base }));
  });
  return out;
}
function P(text, opts = {}) {
  const { size = 30, color = INK, italic = false, align, indent, spacingAfter = 120, spacingBefore = 0, bullet } = opts;
  return new Paragraph({
    alignment: align,
    indent,
    bullet: bullet != null ? { level: bullet } : undefined,
    spacing: { after: spacingAfter, before: spacingBefore, line: 300 },
    children: runs(text, { size, color, italic }),
  });
}
function H1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 140 },
    children: [new TextRun({ text, font: FONT, bold: true, size: 40, color: INK })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: INK, space: 6 } },
  });
}
function H2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2, spacing: { before: 260, after: 100 },
    children: [new TextRun({ text, font: FONT, bold: true, size: 32, color: INK })],
  });
}
function H3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, font: FONT, bold: true, size: 28, color: INK2 })],
  });
}
function cellP(text, { bold = false, align, color = INK, size = 28, mono = false } = {}) {
  const font = mono ? MONO : FONT;
  const children = [];
  if (text === "" || text == null) {
    children.push(new TextRun({ text: "", font }));
  } else {
    String(text).split(/(\*\*[^*]+\*\*)/g).forEach(seg => {
      if (!seg) return;
      const b = seg.startsWith("**") && seg.endsWith("**");
      children.push(new TextRun({ text: b ? seg.slice(2, -2) : seg, bold: bold || b, font, size, color }));
    });
    if (children.length === 0) children.push(new TextRun({ text: "", font }));
  }
  return new Paragraph({ alignment: align, spacing: { after: 20, line: 264 }, children });
}
function noBorders() {
  const n = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return { top: n, bottom: n, left: n, right: n, insideHorizontal: n, insideVertical: n };
}
function thinBorders() {
  const b = { style: BorderStyle.SINGLE, size: 4, color: "D4D9DD" };
  return { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b };
}
// generic table: cols = array of fractions; rows = array of arrays of {t, ...opts}; header = array of strings
function makeTable(header, rows, fracs, { headerAlignRight = [] } = {}) {
  const widths = fracs.map(f => Math.round(CW * f));
  widths[widths.length - 1] = CW - widths.slice(0, -1).reduce((a, b) => a + b, 0);
  const mkRow = (cells, isHeader, isHL) => new TableRow({
    tableHeader: isHeader,
    children: cells.map((c, i) => new TableCell({
      width: { size: widths[i], type: WidthType.DXA },
      shading: isHeader ? { type: ShadingType.CLEAR, fill: HDR_FILL, color: "auto" }
        : (isHL ? { type: ShadingType.CLEAR, fill: HL_FILL, color: "auto" } : undefined),
      margins: { top: 40, bottom: 40, left: 90, right: 90 },
      children: [cellP(c.t, {
        bold: isHeader || c.bold, align: c.align, color: c.color, size: c.size || 28, mono: c.mono,
      })],
    })),
  });
  const trs = [];
  if (header) trs.push(mkRow(header.map((h, i) => ({ t: h, align: headerAlignRight.includes(i) ? AlignmentType.RIGHT : undefined })), true, false));
  rows.forEach(r => trs.push(mkRow(r, false, r._hl)));
  return new Table({ columnWidths: widths, width: { size: CW, type: WidthType.DXA }, borders: thinBorders(), rows: trs });
}
// note: plain bold-lead-in paragraph + body text (no border, no shading box)
function note(label, paras, fill = NOTE_ACCENT, labColor = ACCENT) {
  const kids = [new Paragraph({ spacing: { before: 120, after: 40 }, children: [new TextRun({ text: label, font: FONT, bold: true, size: 26, color: INK })] })];
  paras.forEach((t, i) => kids.push(P(t, { size: 28, spacingAfter: i === paras.length - 1 ? 120 : 60 })));
  return new Table({
    columnWidths: [CW], width: { size: CW, type: WidthType.DXA }, borders: noBorders(),
    rows: [new TableRow({ children: [new TableCell({
      width: { size: CW, type: WidthType.DXA },
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      borders: noBorders(),
      children: kids,
    })] })],
  });
}
function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
function figure(fname, caption) {
  const p = path.join(FIGDIR, fname);
  const { w, h } = pngSize(p);
  const width = 602, height = Math.round(width * h / w);
  return [
    new Paragraph({ spacing: { before: 120, after: 40 }, alignment: AlignmentType.CENTER,
      children: [new ImageRun({ type: "png", data: fs.readFileSync(p), transformation: { width, height } })] }),
    new Paragraph({ spacing: { after: 160 }, children: runs(caption, { size: 24, color: INK2, italic: true }) }),
  ];
}
function spacer() { return new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "", font: FONT })] }); }

// =================== BUILD ===================
const body = [];

// ----- Title block -----
body.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: "รายงานโครงงาน · IMAGE PROCESSING", font: FONT, bold: true, size: 22, color: ACCENT, allCaps: true })] }));
body.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "ระบบตรวจจับรอยร้าวบนพื้นผิวคอนกรีต", font: FONT, bold: true, size: 52, color: INK })] }));
body.push(new Paragraph({ spacing: { after: 60 }, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: "D4D9DD", space: 8 } },
  children: runs("ตรวจจับรอยร้าวเชิงโครงสร้างด้วยเทคนิคการประมวลผลภาพแบบดั้งเดิมล้วน ไม่ใช้ Deep Learning วัดผลระดับพิกเซลบนชุดข้อมูลสาธารณะ CrackForest จำนวน 118 ภาพ", { size: 30, color: INK2 }) }));
body.push(new Paragraph({ spacing: { before: 100, after: 40 }, children: runs("**ชุดข้อมูล** CrackForest (CFD) · 118 ภาพ · 480×320 px      **เครื่องมือ** Python + OpenCV      **ทีม** 3 คน      **วันที่** 20 กันยายน 2569", { size: 24, color: INK3 }) }));

// key metrics tile table
body.push(makeTable(
  ["Dice (F1)", "IoU", "Precision", "Recall", "ความเร็ว"],
  [[
    { t: "0.5024", bold: true, align: AlignmentType.CENTER, color: ACCENT, size: 36 },
    { t: "0.3533", bold: true, align: AlignmentType.CENTER, size: 36 },
    { t: "0.5273", bold: true, align: AlignmentType.CENTER, size: 36 },
    { t: "0.5732", bold: true, align: AlignmentType.CENTER, size: 36 },
    { t: "7.0 ms", bold: true, align: AlignmentType.CENTER, size: 36 },
  ], [
    { t: "จาก 0.3201", align: AlignmentType.CENTER, color: INK3, size: 22 },
    { t: "จาก 0.2051", align: AlignmentType.CENTER, color: INK3, size: 22 },
    { t: "จาก 0.2479", align: AlignmentType.CENTER, color: INK3, size: 22 },
    { t: "จาก 0.5982", align: AlignmentType.CENTER, color: INK3, size: 22 },
    { t: "143 ภาพ/วินาที", align: AlignmentType.CENTER, color: INK3, size: 22 },
  ]],
  [0.2, 0.2, 0.2, 0.2, 0.2]
));

// ----- TOC -----
body.push(new Paragraph({ spacing: { before: 260, after: 80 }, children: [new TextRun({ text: "สารบัญ", font: FONT, bold: true, size: 30, color: INK2 })] }));
body.push(new TableOfContents("สารบัญ", { hyperlink: true, headingStyleRange: "1-3" }));
body.push(new Paragraph({ children: [new PageBreak()] }));

// ----- บทสรุป -----
body.push(H1("บทสรุป"));
body.push(P("ระบบใช้ไปป์ไลน์ 4 ขั้นตอน — ปรับภาพ, แยกพิกเซลด้วย Adaptive Thresholding, จัดการด้วย Morphology และกรองด้วยรูปทรง — ได้ **Dice 0.5024 / IoU 0.3533** บนภาพจริงทั้ง 118 ภาพ ดีขึ้นจากค่าเริ่มต้น 0.3201 / 0.2051", { size: 32 }));
body.push(P("ตัวเลขที่รายงานทุกค่าเลือกพารามิเตอร์จากภาพฝึก 59 ภาพ แล้ววัดผลบนภาพที่กันไว้อีก 59 ภาพ ซึ่งไม่เคยถูกใช้ในการค้นหาเลย (**Dice 0.5105** บนชุดที่กันไว้) จึงไม่ใช่ตัวเลขที่จูนมาเข้ากับข้อสอบของตัวเอง"));
body.push(P("ข้อค้นพบสำคัญ 3 อย่างจากการทดลอง:"));
body.push(P("**Adaptive Thresholding ชนะวิธีอื่นขาด** — ชนะ Otsu, Canny และ Sobel รวม 102 จาก 118 ภาพ ทั้งที่ทุกวิธีถูกจูนด้วยกระบวนการเดียวกัน", { bullet: 0 }));
body.push(P("**เกณฑ์กรองรูปทรงเดิมทำให้ผลแย่ลง** — การวัดความเรียวด้วยอัตราส่วนกรอบสี่เหลี่ยมตัดรอยร้าวที่โค้งทิ้งทั้งเส้น เปลี่ยนไปใช้ค่า circularity แล้วภาพที่เคยได้ 0.0000 กลับมาได้ 0.58", { bullet: 0 }));
body.push(P("**Accuracy ใช้วัดงานนี้ไม่ได้** — พิกเซลรอยร้าวมีแค่ 2.29% ของภาพ ระบบที่ตอบว่า \"ไม่มีรอยร้าว\" ทุกพิกเซลจะได้ accuracy ประมาณ 0.977 ทันที", { bullet: 0 }));

// ----- 1 -----
body.push(H1("1. ปัญหาที่สนใจ แรงบันดาลใจ และแหล่งที่มา"));
body.push(P("เหตุการณ์แผ่นดินไหวที่ส่งผลกระทบต่อประเทศไทยในปีที่ผ่านมาทำให้เกิดความตื่นตัวเรื่องความปลอดภัยของอาคารและโครงสร้างพื้นฐานอย่างกว้างขวาง รอยร้าวบนผนังหรือเสาคอนกรีตเป็นหนึ่งในสัญญาณเตือนแรกสุดของการเสื่อมสภาพเชิงโครงสร้าง"));
body.push(P("การตรวจสอบด้วยสายตามนุษย์ (Visual Inspection) ยังเป็นวิธีหลักในปัจจุบัน แต่เมื่อพื้นที่ตรวจสอบมีขนาดใหญ่หรืออยู่ในจุดที่เข้าถึงยาก วิธีนี้ใช้เวลานาน มีต้นทุนสูง และผลลัพธ์ขึ้นกับประสบการณ์ของผู้ตรวจแต่ละคน จึงเกิดแนวคิดที่จะให้คอมพิวเตอร์ช่วยวิเคราะห์ภาพถ่ายพื้นผิว เพื่อคัดกรองเบื้องต้นว่าบริเวณใดควรให้วิศวกรเข้าไปตรวจสอบซ้ำ"));

// ----- 2 -----
body.push(H1("2. จุดประสงค์ของงาน"));
body.push(P("พัฒนาระบบประมวลผลภาพที่ตรวจจับและดึงลักษณะเส้นของรอยร้าวบนพื้นผิวคอนกรีตออกมาได้อัตโนมัติ โดยต้องแยกแยะระหว่าง **รอยร้าวที่เกิดจากความเสียหายเชิงโครงสร้าง** กับ **พื้นผิวขรุขระปกติ รูพรุน หรือรอยเปื้อน** ให้ได้"));
body.push(P("เงื่อนไขสำคัญของงานนี้คือใช้เทคนิคการประมวลผลภาพแบบดั้งเดิมเท่านั้น ไม่ใช้โมเดล Deep Learning เพื่อให้ทุกขั้นตอนอธิบายได้ด้วยคณิตศาสตร์ของการจัดการภาพ และเพื่อให้เห็นว่าแต่ละเทคนิคให้ผลเท่าไรเมื่อวัดอย่างเป็นระบบ"));

// ----- 3 -----
body.push(H1("3. ขอบเขตของงาน"));
body.push(makeTable(["หัวข้อ", "ขอบเขต"],
  [
    [{ t: "เป้าหมาย", bold: true }, { t: "โปรแกรมต้นแบบที่รับภาพถ่ายพื้นผิวแล้วไฮไลต์บริเวณที่เป็นรอยร้าว พร้อมวัดผลเทียบภาพเฉลยได้" }],
    [{ t: "ข้อมูล", bold: true }, { t: "CrackForest (CFD) 118 ภาพ ขนาด 480×320 พิกเซล มีภาพเฉลยระดับพิกเซล เก็บเป็นไฟล์ MATLAB .mat แปลงเป็น PNG ด้วย src/prepare_crackforest.py" }],
    [{ t: "เทคนิค", bold: true }, { t: "Traditional Image Processing ล้วน (OpenCV) ไม่ใช้ Deep Learning" }],
    [{ t: "การแบ่งงาน", bold: true }, { t: "คนที่ 1 การเตรียมภาพ · คนที่ 2 อัลกอริทึมและการปรับจูน · คนที่ 3 การวัดผลและสรุปผล" }],
    [{ t: "นอกขอบเขต", bold: true }, { t: "การประเมินความรุนแรงของรอยร้าว การวัดความกว้างเป็นหน่วยจริง และการทำงานบนวิดีโอแบบเรียลไทม์" }],
  ], [0.22, 0.78]));
body.push(spacer());
body.push(note("ข้อจำกัดของชุดข้อมูล", [
  "CrackForest เป็นภาพ**ผิวถนนในเมือง** ไม่ใช่ผิวคอนกรีตในอาคาร ผิวถนนมี texture ของยางมะตอย คราบ และเงาที่ไม่สม่ำเสมอ ซึ่งยากกว่าภาพคอนกรีตระยะใกล้ที่ถ่ายในแสงควบคุม ตัวเลขที่ได้จึงควรอ่านในฐานะผลบนกรณีที่ยาก ไม่ใช่เพดานของวิธี",
], NOTE_DATA, DATA));

// ----- 4 -----
body.push(H1("4. งานวิจัยที่เกี่ยวข้อง"));
body.push(P("งานตรวจจับรอยร้าวด้วยการประมวลผลภาพแบบดั้งเดิมแบ่งได้เป็นสองสายหลัก คือ **สายที่ใช้ค่าขีดแบ่งความสว่าง (Threshold-based)** ซึ่งอาศัยข้อเท็จจริงที่ว่ารอยร้าวมืดกว่าผิวรอบข้าง และ **สายที่ใช้ขอบภาพ (Edge-based)** ซึ่งอาศัยการเปลี่ยนความสว่างอย่างฉับพลันบริเวณขอบรอยร้าว โครงงานนี้เลือกสายแรกเป็นวิธีหลัก และนำสายที่สองมาวัดเทียบด้วยการทดลองของตัวเอง (หัวข้อ 6)"));
body.push(makeTable(["เอกสาร", "บทบาทต่อโครงงาน"],
  [
    [{ t: "**Dorafshan, Maguire & Qi (2016)** — Automatic Surface Crack Detection in Concrete Structures Using OTSU Thresholding and Morphological Operations" }, { t: "เปเปอร์หลักที่โครงงานนี้เดินตาม เสนอการใช้ Otsu thresholding ร่วมกับ morphological operations บนภาพผิวคอนกรีต เป็นที่มาของโครงไปป์ไลน์ threshold → morphology → กรองรูปทรง" }],
    [{ t: "**Huang et al. (2025)** — A review of machine vision-based crack detection for asphalt pavements" }, { t: "บทความปริทัศน์ ระบุว่าเทคนิคดั้งเดิม (thresholding, Sobel/Canny/Prewitt, morphology) ทำงานได้ดีเมื่อพื้นหลังไม่ซับซ้อน แต่ **มีความทนทานต่ำเมื่อแสงและพื้นหลังซับซ้อน** ขณะที่ Deep Learning รับมือได้ดีกว่าแต่ต้องใช้ข้อมูลเฉลยจำนวนมากและทรัพยากรสูง" }],
    [{ t: "**Han et al. (2021)** — An Advanced Otsu Method Integrated with Edge Detection and Decision Tree" }, { t: "ตัวอย่างงานที่ผสม Otsu เข้ากับการตรวจจับขอบ แสดงว่าทั้งสองสายไม่จำเป็นต้องแยกจากกัน" }],
    [{ t: "**Pavement crack detection using Otsu thresholding (2018)** และงานกลุ่ม Otsu บนผิวถนน" }, { t: "งานฝั่ง Otsu บนผิวถนนโดยเฉพาะ ใช้เทียบเคียงกับผลการทดลองของโครงงานนี้ที่พบว่า Otsu ทำงานได้ไม่ดีบน CrackForest" }],
  ], [0.4, 0.6]));
body.push(spacer());
body.push(note("ข้อสังเกตที่นำไปสู่การออกแบบ", [
  "ประเด็นที่บทความปริทัศน์ชี้ไว้ — ว่าเทคนิคดั้งเดิมอ่อนแอเมื่อแสงไม่สม่ำเสมอ — ตรงกับสิ่งที่วัดได้จริงในโครงงานนี้ Otsu ซึ่งใช้ค่าขีดแบ่ง**ค่าเดียวทั้งภาพ** ได้ Dice เพียง 0.2428 ขณะที่ Adaptive Thresholding ซึ่งเทียบพิกเซลกับเพื่อนบ้านในหน้าต่างเล็ก ๆ ได้ 0.5024 ความต่างนี้คือเหตุผลเชิงตัวเลขของการเลือกวิธีหลัก",
]));

// ----- 5 -----
body.push(H1("5. ขั้นตอนและกระบวนการที่เลือกใช้"));
body.push(P("ไปป์ไลน์แบ่งเป็น 4 ขั้นตอน แต่ละขั้นเขียนแยกเป็นไฟล์ของตัวเองใน src/ และเชื่อมต่อกันใน src/pipeline.py"));
figure("pipeline_stages.png", "**รูปที่ 1 — ผลลัพธ์ของแต่ละขั้นตอน** ภาพ 001 (แถวบน) และ 074 (แถวล่าง) จากซ้าย: ภาพต้นฉบับ, ภาพหลังปรับ contrast, ผลจาก Adaptive Thresholding ที่ยังเต็มไปด้วย noise, ผลหลัง morphology, ผลสุดท้ายหลังกรองด้วยรูปทรง และภาพเฉลย").forEach(x => body.push(x));
body.push(H3("ขั้นที่ 1 — การเตรียมภาพ (Pre-processing)"));
body.push(P("แปลงภาพสีเป็นภาพระดับเทา ลดสัญญาณรบกวนด้วย Gaussian Blur ขนาด 5×5 แล้วเพิ่ม contrast เฉพาะที่ด้วย CLAHE (clip limit 2.0, tile 8×8) ขั้นตอนนี้ทำให้รอยร้าวสีเข้มตัดกับผิวรอบข้างชัดขึ้นก่อนเข้าสู่การแยกพิกเซล"));
body.push(H3("ขั้นที่ 2 — การแยกพิกเซล (Segmentation)"));
body.push(P("ใช้ Adaptive Thresholding แบบ Gaussian หน้าต่าง 35×35 ค่าชดเชย C = 15 หลักการคือเทียบความสว่างของแต่ละพิกเซลกับ**ค่าเฉลี่ยของเพื่อนบ้านในหน้าต่าง** ไม่ใช่กับทั้งภาพ พิกเซลที่มืดกว่าเพื่อนบ้านเกินค่า C จะถูกนับเป็นรอยร้าว วิธีนี้จึงไม่สนใจว่าโดยรวมภาพนั้นสว่างหรือมืด ทำให้ทนต่อเงาและแสงไม่สม่ำเสมอ"));
body.push(H3("ขั้นที่ 3 — Morphological Filtering"));
body.push(P("ใช้ Closing (ขยายแล้วหด) ด้วย kernel วงรีขนาด 3×3 เพื่อเชื่อมรอยร้าวที่ขาดเป็นช่วง ๆ ให้ต่อกัน ตามด้วย Opening (หดแล้วขยาย) ขนาด 3×3 เพื่อลบจุดรบกวนเล็ก ๆ ที่ไม่ใช่รอยร้าว"));
body.push(H3("ขั้นที่ 4 — การวิเคราะห์รูปทรง (Shape Analysis)"));
body.push(P("ดึง connected component ที่เหลือแล้วกรองด้วยเกณฑ์สองข้อ: **พื้นที่** (นับจำนวนพิกเซลจริง ต้องไม่น้อยกว่า 120 พิกเซล) และ **ความเรียว** วัดด้วย circularity = 4·π·area / perimeter² (ยิ่งค่าน้อยยิ่งเรียว วงกลมสมบูรณ์ได้ 1.0 เก็บไว้เมื่อ ≤ 0.4)"));
body.push(P("จุดสำคัญคือ circularity **ไม่ขึ้นกับความโค้งของรอยร้าว** รอยร้าวที่เป็นรูปตัว T หรือแตกแขนงก็ยังได้ค่าต่ำเพราะมันเรียวจริง ซึ่งต่างจากเกณฑ์ที่ใช้ในตอนแรก (รายละเอียดในหัวข้อ 6)"));
body.push(H3("พารามิเตอร์ที่ใช้จริง (จาก grid search, เก็บใน outputs/tuned_params.json)"));
body.push(makeTable(["พารามิเตอร์", "ค่า", "ความหมาย"],
  [
    [{ t: "blur_ksize", mono: true }, { t: "5", align: AlignmentType.RIGHT, mono: true }, { t: "ขนาด Gaussian blur" }],
    [{ t: "clip_limit", mono: true }, { t: "2.0", align: AlignmentType.RIGHT, mono: true }, { t: "ความแรงของ CLAHE" }],
    [{ t: "tile", mono: true }, { t: "8", align: AlignmentType.RIGHT, mono: true }, { t: "ขนาดช่องของ CLAHE" }],
    [{ t: "block_size", mono: true }, { t: "35", align: AlignmentType.RIGHT, mono: true }, { t: "หน้าต่าง adaptive threshold" }],
    [{ t: "C", mono: true }, { t: "15", align: AlignmentType.RIGHT, mono: true }, { t: "ค่าชดเชยความมืด" }],
    [{ t: "close_ksize", mono: true }, { t: "3", align: AlignmentType.RIGHT, mono: true }, { t: "kernel เชื่อมรอยร้าว" }],
    [{ t: "open_ksize", mono: true }, { t: "3", align: AlignmentType.RIGHT, mono: true }, { t: "kernel ลบ noise" }],
    [{ t: "min_area", mono: true }, { t: "120", align: AlignmentType.RIGHT, mono: true }, { t: "พื้นที่ต่ำสุด (พิกเซล)" }],
    [{ t: "max_circ", mono: true }, { t: "0.4", align: AlignmentType.RIGHT, mono: true }, { t: "ความกลมสูงสุดที่ยอมรับ" }],
  ], [0.28, 0.14, 0.58], { headerAlignRight: [1] }));

// ----- 6 -----
body.push(H1("6. ผลการทดลอง"));
body.push(P("ความคาดหวังตั้งแต่ต้นคือให้ระบบสร้าง binary mask ที่ไฮไลต์เฉพาะเส้นรอยร้าว และกรอง noise จากความขรุขระ รูพรุน และเงาออกได้ระดับหนึ่ง ผลที่ได้เป็นไปตามนั้น แต่มีเงื่อนไขที่ต้องอธิบาย", { size: 32 }));
body.push(H3("วิธีการวัดที่ทำให้ตัวเลขเชื่อถือได้"));
body.push(P("การจูนพารามิเตอร์บนภาพชุดเดียวกับที่ใช้วัดผลจะทำให้ได้ตัวเลขที่สูงเกินจริง โครงงานนี้จึงแบ่งภาพ 118 ภาพออกเป็นสองส่วนแบบสลับกัน (ภาพเว้นภาพ) **ค้นหาพารามิเตอร์จาก 59 ภาพแรก และวัดผลบน 59 ภาพที่เหลือซึ่งไม่เคยถูกแตะระหว่างการค้นหา**"));
body.push(P("นอกจากนี้ เมื่อทดลองเกือบ 5,000 ชุดพารามิเตอร์ ชุดที่ได้คะแนนสูงสุดมักเป็นชุดที่ \"ฟลุก\" กับภาพไม่กี่ภาพ จึงไม่เลือกด้วยคะแนนสูงสุดตรง ๆ แต่แบ่งภาพฝึกเป็น 5 กลุ่มแล้วเลือกชุดที่ได้คะแนน (ค่าเฉลี่ย − ส่วนเบี่ยงเบน) สูงสุด คือเลือกชุดที่ทั้ง**ดี**และ**นิ่ง** ผลคือช่องว่างระหว่างคะแนนภาพฝึกกับภาพที่กันไว้เหลือเพียง **0.001**"));
body.push(H3("พัฒนาการของคะแนน (Dice บนภาพจริงทั้ง 118 ภาพ, ค่าเฉลี่ย macro)"));
body.push(makeTable(["Metric", "ค่าเริ่มต้น", "รอบที่ 1", "รอบที่ 2", "รอบที่ 3", "เปลี่ยนแปลง"],
  [
    [{ t: "Precision" }, { t: "0.2479", align: AlignmentType.RIGHT, mono: true }, { t: "0.5349", align: AlignmentType.RIGHT, mono: true }, { t: "0.4990", align: AlignmentType.RIGHT, mono: true }, { t: "0.5273", align: AlignmentType.RIGHT, mono: true, bold: true }, { t: "+0.279", align: AlignmentType.RIGHT, mono: true, color: GOOD }],
    [{ t: "Recall" }, { t: "0.5982", align: AlignmentType.RIGHT, mono: true }, { t: "0.5194", align: AlignmentType.RIGHT, mono: true }, { t: "0.5781", align: AlignmentType.RIGHT, mono: true }, { t: "0.5732", align: AlignmentType.RIGHT, mono: true, bold: true }, { t: "−0.025", align: AlignmentType.RIGHT, mono: true, color: ACCENT }],
    [{ t: "IoU" }, { t: "0.2051", align: AlignmentType.RIGHT, mono: true }, { t: "0.3399", align: AlignmentType.RIGHT, mono: true }, { t: "0.3492", align: AlignmentType.RIGHT, mono: true }, { t: "0.3533", align: AlignmentType.RIGHT, mono: true, bold: true }, { t: "+0.148", align: AlignmentType.RIGHT, mono: true, color: GOOD }],
    Object.assign([{ t: "Dice (F1)", bold: true }, { t: "0.3201", align: AlignmentType.RIGHT, mono: true }, { t: "0.4872", align: AlignmentType.RIGHT, mono: true }, { t: "0.4991", align: AlignmentType.RIGHT, mono: true }, { t: "0.5024", align: AlignmentType.RIGHT, mono: true, bold: true }, { t: "+0.182", align: AlignmentType.RIGHT, mono: true, color: GOOD, bold: true }], { _hl: true }),
  ], [0.2, 0.16, 0.16, 0.16, 0.16, 0.16], { headerAlignRight: [1, 2, 3, 4, 5] }));
body.push(P("สิ่งที่เปลี่ยนมากที่สุดคือ precision ที่เพิ่มกว่าเท่าตัว หมายความว่าระบบเลิกทายพื้นผิวธรรมดาว่าเป็นรอยร้าว ขณะที่ recall ลดลงเพียงเล็กน้อย", { spacingBefore: 80 }));

body.push(H3("เทียบกับวิธีอื่น (ทุกวิธีจูนด้วยกระบวนการเดียวกัน เปิดครบ 4 ขั้นตอน)"));
body.push(makeTable(["วิธี", "Dice (กันไว้)", "Dice (118)", "มัธยฐาน", "Dice ≥ 0.5", "ชนะขาด", "False positive"],
  [
    Object.assign([{ t: "Adaptive", bold: true }, { t: "0.5105", align: AlignmentType.RIGHT, mono: true, bold: true }, { t: "0.5024", align: AlignmentType.RIGHT, mono: true }, { t: "0.5427", align: AlignmentType.RIGHT, mono: true }, { t: "73", align: AlignmentType.RIGHT, mono: true }, { t: "102", align: AlignmentType.RIGHT, mono: true }, { t: "171,802", align: AlignmentType.RIGHT, mono: true }], { _hl: true }),
    [{ t: "Sobel" }, { t: "0.3159", align: AlignmentType.RIGHT, mono: true }, { t: "0.2927", align: AlignmentType.RIGHT, mono: true }, { t: "0.2759", align: AlignmentType.RIGHT, mono: true }, { t: "14", align: AlignmentType.RIGHT, mono: true }, { t: "8", align: AlignmentType.RIGHT, mono: true }, { t: "463,628", align: AlignmentType.RIGHT, mono: true }],
    [{ t: "Otsu" }, { t: "0.2257", align: AlignmentType.RIGHT, mono: true }, { t: "0.2428", align: AlignmentType.RIGHT, mono: true }, { t: "0.2540", align: AlignmentType.RIGHT, mono: true }, { t: "9", align: AlignmentType.RIGHT, mono: true }, { t: "5", align: AlignmentType.RIGHT, mono: true }, { t: "392,289", align: AlignmentType.RIGHT, mono: true }],
    [{ t: "Canny" }, { t: "0.2237", align: AlignmentType.RIGHT, mono: true }, { t: "0.2107", align: AlignmentType.RIGHT, mono: true }, { t: "0.1865", align: AlignmentType.RIGHT, mono: true }, { t: "9", align: AlignmentType.RIGHT, mono: true }, { t: "3", align: AlignmentType.RIGHT, mono: true }, { t: "1,457,995", align: AlignmentType.RIGHT, mono: true }],
  ], [0.18, 0.16, 0.14, 0.13, 0.12, 0.11, 0.16], { headerAlignRight: [1, 2, 3, 4, 5, 6] }));
figure("method_comparison.png", "**รูปที่ 2 — mask จากแต่ละวิธีบนภาพเดียวกัน** Otsu, Canny และ Sobel ให้พื้นที่สีขาวจำนวนมากที่ไม่ใช่รอยร้าว ขณะที่ Adaptive ให้เส้นที่ใกล้เคียงภาพเฉลยมากกว่า").forEach(x => body.push(x));
body.push(P("**เหตุผลที่ผลออกมาเช่นนี้** — Canny และ Sobel ตอบสนองต่อการเปลี่ยนความสว่างอย่างฉับพลัน ซึ่งบนผิวถนนมีอยู่ทั่วไปจาก texture ของยางมะตอย ขอบคราบ และเงา ทั้งหมดนี้ให้ gradient แรงพอ ๆ กับขอบรอยร้าว ส่วน Otsu หาค่าขีดแบ่งค่าเดียวสำหรับทั้งภาพ จึงตัดเอาบริเวณที่มืดกว่าค่าเฉลี่ย เช่น เงา มาเป็นรอยร้าวด้วย"));
body.push(note("เทียบกับ Dorafshan et al. (2016)", [
  "เปเปอร์อ้างอิงใช้ Otsu แล้วได้ผลดี ซึ่งดูขัดกับผลที่วัดได้ที่นี่ แต่เปเปอร์นั้นทำกับ**ภาพผิวคอนกรีตระยะใกล้ในสภาพแสงที่ควบคุมได้** ขณะที่ CrackForest เป็นผิวถนนในเมือง ผลที่ต่างกันจึงไม่ได้ขัดกับเปเปอร์ แต่สะท้อนว่า**เงื่อนไขการถ่ายภาพเป็นตัวกำหนดว่า global threshold ใช้ได้หรือไม่**",
], NOTE_DATA, DATA));

body.push(H3("บทเรียนสำคัญ: เกณฑ์กรองรูปทรงเดิมทำให้ผลแย่ลง"));
body.push(P("ในสองรอบแรก ขั้นที่ 4 วัดความเรียวด้วย**อัตราส่วนด้านของกรอบสี่เหลี่ยมหมุนได้**ที่ครอบ contour ไว้ ซึ่งตั้งอยู่บนสมมติฐานเงียบ ๆ ว่ารอยร้าวเป็นเส้นตรง แต่รอยร้าวจริงโค้งและแตกแขนง รอยร้าวรูปตัว T จะมีกรอบครอบเกือบเป็นสี่เหลี่ยมจัตุรัส ได้อัตราส่วนใกล้ 1 แล้วถูกตัดทิ้ง**ทั้งเส้น** เมื่อวัดทั้งชุดข้อมูลพบว่าขั้นที่ 4 ตัดพิกเซลรอยร้าวจริงที่สามขั้นแรกหาเจอแล้วทิ้งไปถึง 30.5%"));
body.push(H3("เกณฑ์กรองรูปทรงแบบใดให้ผลดีที่สุด (Dice สูงสุดบนภาพฝึก)"));
body.push(makeTable(["เกณฑ์", "Dice สูงสุด", "หมายเหตุ"],
  [
    Object.assign([{ t: "circularity (ใหม่)", bold: true }, { t: "0.5243", align: AlignmentType.RIGHT, mono: true, bold: true }, { t: "ดีกว่าการไม่กรองรูปทรง" }], { _hl: true }),
    [{ t: "ไม่กรองรูปทรง" }, { t: "0.5201", align: AlignmentType.RIGHT, mono: true }, { t: "เส้นอ้างอิง" }],
    [{ t: "ใช้ทั้งสองเกณฑ์" }, { t: "0.5030", align: AlignmentType.RIGHT, mono: true }, { t: "" }],
    [{ t: "aspect ratio (เดิม)" }, { t: "0.4997", align: AlignmentType.RIGHT, mono: true, color: ACCENT }, { t: "แย่กว่าการไม่กรองเลย" }],
  ], [0.34, 0.22, 0.44], { headerAlignRight: [1] }));
body.push(P("ผลที่สำคัญที่สุดคือ **เกณฑ์เดิมแย่กว่าการไม่กรองรูปทรงเลย** (0.4997 เทียบกับ 0.5201) แปลว่าตลอดสองรอบแรก การวิเคราะห์รูปทรงทำให้ผลแย่ลง ส่วนเกณฑ์ใหม่ดีกว่าการไม่กรอง (0.5243) จึงเป็นครั้งแรกที่ขั้นตอนนี้มีเหตุผลเชิงตัวเลขรองรับการมีอยู่ของมัน", { spacingBefore: 80 }));
body.push(H3("ภาพที่เคยล้มเหลว หลังเปลี่ยนเกณฑ์"));
body.push(makeTable(["ภาพ", "Dice เดิม", "Dice ใหม่", "Recall เดิม", "Recall ใหม่"],
  [
    [{ t: "065" }, { t: "0.0000", align: AlignmentType.RIGHT, mono: true }, { t: "0.5844", align: AlignmentType.RIGHT, mono: true, bold: true }, { t: "0.000", align: AlignmentType.RIGHT, mono: true }, { t: "0.931", align: AlignmentType.RIGHT, mono: true }],
    [{ t: "021" }, { t: "0.0000", align: AlignmentType.RIGHT, mono: true }, { t: "0.3632", align: AlignmentType.RIGHT, mono: true, bold: true }, { t: "0.000", align: AlignmentType.RIGHT, mono: true }, { t: "0.756", align: AlignmentType.RIGHT, mono: true }],
    [{ t: "084" }, { t: "0.1878", align: AlignmentType.RIGHT, mono: true }, { t: "0.4976", align: AlignmentType.RIGHT, mono: true, bold: true }, { t: "0.111", align: AlignmentType.RIGHT, mono: true }, { t: "0.383", align: AlignmentType.RIGHT, mono: true }],
    [{ t: "097" }, { t: "0.1640", align: AlignmentType.RIGHT, mono: true }, { t: "0.2698", align: AlignmentType.RIGHT, mono: true }, { t: "0.092", align: AlignmentType.RIGHT, mono: true }, { t: "0.163", align: AlignmentType.RIGHT, mono: true }],
  ], [0.2, 0.2, 0.2, 0.2, 0.2], { headerAlignRight: [1, 2, 3, 4] }));
body.push(spacer());
body.push(note("รายงานตามจริง", [
  "การเปลี่ยนเกณฑ์นี้**ไม่ใช่กำไรล้วน** เมื่อดูรายภาพพบว่าดีขึ้น 63 ภาพ แต่แย่ลง 55 ภาพ ค่าเฉลี่ยรวมจึงขยับขึ้นเพียง +0.0033 มีภาพที่ถอยหลังชัดเจน เช่น 072 (0.632 → 0.379) และ 049 (0.171 → 0.000) สิ่งที่ดีขึ้นแน่นอนคือ**การกระจายตัว**: ภาพที่ได้ Dice ≥ 0.5 เพิ่มจาก 68 เป็น 73 ภาพ และภาพที่ได้ 0.0000 ลดจาก 2 เหลือ 1 ภาพ",
]));
body.push(H3("ตัวอย่างผลลัพธ์ที่ดี"));
figure("success_cases.png", "**รูปที่ 3 — กรณีที่ระบบทำงานได้ดี** ภาพ 001, 022, 074 และ 112 เส้นรอยร้าวถูกลากตามได้ต่อเนื่อง และพื้นผิวรอบข้างถูกกรองออกเกือบหมด ภาพกลุ่มนี้มีรอยร้าว contrast ชัดและพื้นหลังค่อนข้างสม่ำเสมอ").forEach(x => body.push(x));
body.push(H3("กรณีที่ยังล้มเหลว"));
figure("failure_cases.png", "**รูปที่ 4 — กรณีที่คะแนนต่ำ และสาเหตุที่ต่างกัน** แถวบนลงล่าง: 021, 065, 084 และ 042 สามกรณีแรกมีสาเหตุที่ไม่ใช่ความผิดของการตรวจจับโดยตรง ส่วน 042 คือกรณีที่ล้มเหลวจริง").forEach(x => body.push(x));
body.push(note("บางกรณีเป็นปัญหาของภาพเฉลย ไม่ใช่ของระบบ", [
  "**ภาพ 021** — ระบบลากตามรอยร้าวได้ดี (recall 0.756) แต่ precision เหลือเพียง 0.239 เพราะไปจับรอยแตกลายงาบนเส้นจราจรสีขาวด้วย ซึ่งเป็นรอยแตกจริง แต่ผู้จัดทำภาพเฉลยของ CrackForest ไม่ได้ทำเครื่องหมายไว้",
  "**ภาพ 084** — ภาพเฉลยวาดรอยร้าวไว้หนากว่ารอยจริงมาก ขณะที่ผลทำนายเป็นเส้นบางตามรอยจริง ทำให้ recall ถูกจำกัดอยู่ที่ 0.383 ทั้งที่ precision สูงถึง 0.711",
  "บทเรียนคือ **ตัววัดระดับพิกเซลลงโทษการตรวจเจอสิ่งที่คนวาดเฉลยไม่ได้วาด** และความหนาของเส้นในภาพเฉลยเป็นเพดานของ recall โดยตรง ส่วนภาพ 042 เป็นความล้มเหลวจริง — รอยร้าวจางจนแทบไม่มี contrast ให้จับ",
]));

// ----- 7 -----
body.push(H1("7. หลักการประเมินผล"));
body.push(P("การประเมินทำในระดับพิกเซล โดยเทียบ binary mask ที่โปรแกรมสร้างกับภาพเฉลยทีละพิกเซล แล้วนับเป็น confusion matrix ซึ่งเป็นที่มาของทุกค่าที่รายงาน"));
body.push(makeTable(["", "ภาพเฉลย: รอยร้าว", "ภาพเฉลย: พื้นหลัง"],
  [
    [{ t: "ทำนาย: รอยร้าว", bold: true }, { t: "TP = 180,802", align: AlignmentType.RIGHT, mono: true, color: GOOD }, { t: "FP = 171,802", align: AlignmentType.RIGHT, mono: true, color: ACCENT }],
    [{ t: "ทำนาย: พื้นหลัง", bold: true }, { t: "FN = 233,636", align: AlignmentType.RIGHT, mono: true, color: ACCENT }, { t: "TN = 17,538,560", align: AlignmentType.RIGHT, mono: true }],
  ], [0.3, 0.35, 0.35], { headerAlignRight: [1, 2] }));
body.push(P("รวม 18,124,800 พิกเซล จาก 118 ภาพ เป็นพิกเซลรอยร้าว 414,438 พิกเซล หรือ **2.29%** ของทั้งหมด", { size: 26, color: INK3, spacingBefore: 60 }));
body.push(H3("ตัวชี้วัดที่ใช้"));
body.push(makeTable(["ตัวชี้วัด", "สูตร", "ความหมายในงานนี้"],
  [
    [{ t: "Precision", bold: true }, { t: "TP / (TP + FP)", mono: true }, { t: "ที่ทายว่าเป็นรอยร้าว ถูกจริงกี่ส่วน — ลดการแจ้งเตือนลวงจากรอยเปื้อนและเงา" }],
    [{ t: "Recall", bold: true }, { t: "TP / (TP + FN)", mono: true }, { t: "รอยร้าวจริงทั้งหมด ตรวจเจอกี่ส่วน — ลดรอยร้าวที่หลุดรอดไป" }],
    [{ t: "IoU", bold: true }, { t: "TP / (TP + FP + FN)", mono: true }, { t: "ความซ้อนทับระหว่าง mask กับเฉลย ตัวชี้วัดมาตรฐานของงาน segmentation" }],
    [{ t: "Dice (F1)", bold: true }, { t: "2·TP / (2·TP + FP + FN)", mono: true }, { t: "ค่าเฉลี่ยฮาร์มอนิกของ precision กับ recall ตัวเลขหลักที่ใช้รายงาน" }],
  ], [0.18, 0.3, 0.52]));
body.push(spacer());
body.push(note("ทำไมไม่ใช้ Accuracy", [
  "พิกเซลรอยร้าวมีเพียง 2.29% ของภาพ ระบบที่ตอบว่า \"ไม่มีรอยร้าว\" ทุกพิกเซลจะได้ accuracy ประมาณ **0.977** ทันที ในการทดลองนี้ Adaptive ได้ accuracy 0.9776 ส่วน Otsu ได้ 0.9621 ต่างกันแทบไม่เห็น ทั้งที่ Dice ต่างกันกว่าเท่าตัว (0.5024 เทียบกับ 0.2428) **Accuracy จึงแยกระบบที่ดีออกจากระบบที่แย่ไม่ได้ในงานที่ข้อมูลไม่สมดุลขนาดนี้** ตัวเลขที่มีความหมายคือ IoU และ Dice",
]));
body.push(H3("Macro เทียบกับ Micro"));
body.push(P("รายงานค่าเฉลี่ยสองแบบ **Macro** คือเฉลี่ยคะแนนของแต่ละภาพ ทุกภาพน้ำหนักเท่ากัน ส่วน **Micro** คือรวมพิกเซลทั้งชุดข้อมูลก่อนแล้วคำนวณครั้งเดียว ภาพที่มีรอยร้าวยาวจึงมีน้ำหนักมากกว่า"));
body.push(makeTable(["ค่าเฉลี่ย", "Precision", "Recall", "IoU", "Dice", "Accuracy"],
  [
    Object.assign([{ t: "Macro (รายภาพ)", bold: true }, { t: "0.5273", align: AlignmentType.RIGHT, mono: true }, { t: "0.5732", align: AlignmentType.RIGHT, mono: true }, { t: "0.3533", align: AlignmentType.RIGHT, mono: true }, { t: "0.5024", align: AlignmentType.RIGHT, mono: true }, { t: "—", align: AlignmentType.RIGHT }], { _hl: true }),
    [{ t: "Micro (รวมพิกเซล)" }, { t: "0.5128", align: AlignmentType.RIGHT, mono: true }, { t: "0.4363", align: AlignmentType.RIGHT, mono: true }, { t: "0.3084", align: AlignmentType.RIGHT, mono: true }, { t: "0.4714", align: AlignmentType.RIGHT, mono: true }, { t: "0.9776", align: AlignmentType.RIGHT, mono: true }],
  ], [0.24, 0.152, 0.152, 0.152, 0.152, 0.152], { headerAlignRight: [1, 2, 3, 4, 5] }));
body.push(P("Micro ต่ำกว่า macro เล็กน้อย โดยเฉพาะ recall แปลว่าภาพที่มีรอยร้าวยาว ๆ ยังเป็นกลุ่มที่ระบบเก็บได้ไม่ครบ แม้หลังปรับปรุงแล้ว ขั้นที่ 4 ยังตัดพิกเซลรอยร้าวจริงทิ้ง 20.2% (ลดจาก 30.5%) ถ้าไม่ตัดทิ้งเลย micro-recall จะขึ้นจาก 0.4363 เป็น 0.5469 — นี่คือเพดานที่ยังเหลือให้ไล่ตาม", { spacingBefore: 80 }));

// ----- 8 -----
body.push(H1("8. การต่อยอด"));
body.push(P("ไปป์ไลน์นี้ใช้เฉพาะการคูณ การเปรียบเทียบ และการดำเนินการกับเพื่อนบ้านในหน้าต่างเล็ก ๆ ไม่มีการคูณเมทริกซ์ขนาดใหญ่หรือน้ำหนักโมเดลที่ต้องเก็บ จึงเหมาะกับการย้ายลงฮาร์ดแวร์ขนาดเล็ก"));
body.push(H3("เวลาประมวลผลต่อภาพ (480×320 บนซีพียูโน้ตบุ๊ก)"));
body.push(makeTable(["ขั้นตอน", "เวลา", "สัดส่วน"],
  [
    [{ t: "1 · การเตรียมภาพ" }, { t: "0.70 ms", align: AlignmentType.RIGHT, mono: true }, { t: "13.7%", align: AlignmentType.RIGHT, mono: true }],
    [{ t: "2 · การแยกพิกเซล" }, { t: "1.51 ms", align: AlignmentType.RIGHT, mono: true }, { t: "29.6%", align: AlignmentType.RIGHT, mono: true }],
    [{ t: "3 · Morphology" }, { t: "0.20 ms", align: AlignmentType.RIGHT, mono: true }, { t: "3.9%", align: AlignmentType.RIGHT, mono: true }],
    [{ t: "4 · การวิเคราะห์รูปทรง" }, { t: "2.70 ms", align: AlignmentType.RIGHT, mono: true }, { t: "52.9%", align: AlignmentType.RIGHT, mono: true }],
    Object.assign([{ t: "รวมทั้งไปป์ไลน์", bold: true }, { t: "7.00 ms", align: AlignmentType.RIGHT, mono: true, bold: true }, { t: "143 ภาพ/วินาที", align: AlignmentType.RIGHT, mono: true, bold: true }], { _hl: true }),
  ], [0.5, 0.25, 0.25], { headerAlignRight: [1, 2] }));
body.push(P("ที่ 143 ภาพต่อวินาที งานนี้เหลือ headroom มากพอที่จะรันบนบอร์ดที่ช้ากว่าซีพียูนี้หลายสิบเท่าแล้วยังทำงานได้แบบเรียลไทม์ และ**ขั้นตอนที่ 4 กินเวลาเกินครึ่ง** ซึ่งเป็นจุดแรกที่ควร optimize หากจะย้ายลงบอร์ดจริง", { spacingBefore: 80 }));
body.push(H3("ทิศทางที่ทำต่อได้"));
body.push(P("**ฝังลงฮาร์ดแวร์ขนาดเล็ก** — ปรับอัลกอริทึมให้เบาลงแล้วนำไปรันบน ESP32, STM32 หรือบอร์ด FPGA ติดตั้งร่วมกับกล้องและโดรนสำรวจ เพื่อบินถ่ายรอยร้าวตามซอกตึกหรือใต้สะพานที่คนเข้าถึงยาก แล้วส่งการแจ้งเตือนพร้อมพิกัดเข้าระบบส่วนกลาง", { bullet: 0 }));
body.push(P("**ปรับปรุงขั้นที่ 4 ต่อ** — ยังมีพิกเซลรอยร้าวที่ถูกตัดทิ้ง 20.2% เกณฑ์อย่างอัตราส่วนความยาวเส้นแกนกลาง (skeleton) ต่อพื้นที่ น่าจะเก็บส่วนนี้กลับมาได้อีก", { bullet: 0 }));
body.push(P("**วัดความกว้างของรอยร้าวเป็นหน่วยจริง** — ถ้าทราบระยะกล้องหรือมีวัตถุอ้างอิงในภาพ จะแปลงความกว้างเป็นมิลลิเมตรได้ ซึ่งเป็นตัวเลขที่วิศวกรใช้ตัดสินระดับความรุนแรงจริง", { bullet: 0 }));
body.push(P("**ทดสอบกับภาพผิวคอนกรีตในอาคาร** — ชุดข้อมูลที่ใช้เป็นผิวถนน การทดสอบกับผิวคอนกรีตในสภาพแสงที่ควบคุมได้น่าจะให้ผลดีกว่านี้ และตรงกับโจทย์ตั้งต้นมากกว่า", { bullet: 0 }));

// ----- Appendix -----
body.push(H1("ภาคผนวก"));
body.push(H3("ขั้นตอนที่ 1 มีประโยชน์จริงแค่ไหน (ปิดแต่ละส่วนแล้ววัดผล)"));
body.push(makeTable(["Gaussian Blur", "CLAHE", "Dice ดีที่สุด"],
  [
    Object.assign([{ t: "เปิด" }, { t: "เปิด" }, { t: "0.4929", align: AlignmentType.RIGHT, mono: true, bold: true }], { _hl: true }),
    [{ t: "ปิด" }, { t: "เปิด" }, { t: "0.4197", align: AlignmentType.RIGHT, mono: true }],
    [{ t: "ปิด" }, { t: "ปิด" }, { t: "0.2699", align: AlignmentType.RIGHT, mono: true }],
    [{ t: "เปิด" }, { t: "ปิด" }, { t: "0.2306", align: AlignmentType.RIGHT, mono: true, color: ACCENT }],
  ], [0.34, 0.33, 0.33], { headerAlignRight: [2] }));
body.push(P("CLAHE คือหัวใจของขั้นตอนนี้ ถ้าเอาออก Dice หายไปกว่าครึ่ง ที่น่าสนใจกว่าคือ **การเบลออย่างเดียวให้ผลแย่กว่าการไม่ทำอะไรเลย** (0.2306 เทียบกับ 0.2699) เพราะรอยร้าวบางมาก การเบลอไปกลบมันทิ้ง การเบลอจะคุ้มก็ต่อเมื่อมี CLAHE ดึง contrast กลับคืนมาให้", { spacingBefore: 80 }));
body.push(H3("โครงสร้างโค้ด"));
body.push(makeTable(["ไฟล์", "หน้าที่"],
  [
    [{ t: "src/preprocessing.py", mono: true }, { t: "ขั้นที่ 1 · เทา → เบลอ → CLAHE" }],
    [{ t: "src/segmentation.py", mono: true }, { t: "ขั้นที่ 2 · adaptive, otsu, canny, sobel" }],
    [{ t: "src/morphology.py", mono: true }, { t: "ขั้นที่ 3 · closing แล้ว opening" }],
    [{ t: "src/shape_filter.py", mono: true }, { t: "ขั้นที่ 4 · กรองด้วยพื้นที่และ circularity" }],
    [{ t: "src/pipeline.py", mono: true }, { t: "เชื่อมทั้งสี่ขั้น และโหลดพารามิเตอร์ที่จูนไว้" }],
    [{ t: "src/evaluate.py", mono: true }, { t: "confusion matrix และตัวชี้วัดทั้งหมด" }],
    [{ t: "src/tune.py", mono: true }, { t: "grid search ขั้นที่ 2–4 พร้อมการแบ่ง train/held-out" }],
    [{ t: "src/select_params.py", mono: true }, { t: "เลือกพารามิเตอร์แบบสองขั้นด้วยความนิ่งข้าม fold" }],
    [{ t: "src/make_figures.py", mono: true }, { t: "สร้างแผงรูปสำหรับรายงาน" }],
    [{ t: "main.py", mono: true }, { t: "คำสั่งหลัก รับภาพเดี่ยวหรือทั้งโฟลเดอร์" }],
  ], [0.32, 0.68]));
body.push(H3("ข้อจำกัดที่ควรระบุ"));
body.push(P("ทดสอบบนชุดข้อมูลเดียว (CrackForest) ซึ่งเป็นผิวถนน ไม่ใช่ผิวคอนกรีตในอาคารตามโจทย์ตั้งต้น", { bullet: 0 }));
body.push(P("ภาพทั้งหมดมีขนาดเท่ากัน (480×320) ยังไม่ได้ทดสอบกับภาพความละเอียดอื่น ซึ่งจะกระทบค่า block_size และ min_area โดยตรง", { bullet: 0 }));
body.push(P("ระบบบอกได้ว่าพิกเซลใดเป็นรอยร้าว แต่ยังไม่ประเมินความรุนแรงหรือความกว้างเป็นหน่วยจริง", { bullet: 0 }));
body.push(P("ตัวเลขบางส่วนถูกจำกัดด้วยคุณภาพของภาพเฉลยเอง ตามที่อธิบายไว้ในหัวข้อ 6", { bullet: 0 }));
body.push(spacer());
body.push(P("รายงานฉบับนี้อ้างอิงตัวเลขจาก outputs/metrics.csv และผลการค้นหาพารามิเตอร์ใน outputs/tune_results_*.csv ซึ่งสร้างซ้ำได้ด้วยขั้นตอนใน docs/Tuning Journal.md · เอกสารอ้างอิงหลัก: Dorafshan, Maguire & Qi (2016).", { size: 24, color: INK3 }));

// ---- assemble ----
const doc = new Document({
  styles: {
    default: {
      document: { run: { font: FONT, size: 30, color: INK }, paragraph: { spacing: { line: 300 } } },
      heading1: { run: { font: FONT, bold: true, size: 40, color: INK } },
      heading2: { run: { font: FONT, bold: true, size: 32, color: INK } },
      heading3: { run: { font: FONT, bold: true, size: 28, color: INK2 } },
    },
  },
  numbering: {
    config: [{ reference: "b", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 460, hanging: 240 } } } }] }],
  },
  sections: [{
    properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
    children: body,
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(path.join(__dirname, "Report.docx"), buf);
  console.log("WROTE Report.docx", buf.length, "bytes");
});
