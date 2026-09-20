"""
html_to_docx.py  -  Convert docs/Report.html into a .docx  [Member 3]

The report is written once, as HTML. This turns that same file into a Word
document so there is one source of truth: edit Report.html, re-run this, and
both versions stay in step.

It writes the OOXML by hand into a zip, so it needs no extra packages - only
the standard library plus the HTML the repo already contains. It understands
the subset of markup the report actually uses:

  h1 h2 h3 h4      headings (the section number in <span class="n"> is kept)
  p, ul/li         body text and bulleted lists
  table            bordered tables, with <caption> as a caption line
  figure + img     images, scaled to the text column, with the caption below
  pre              monospaced block on a shaded background
  div.note         call-out box (its .lab becomes the box's heading)
  div.tiles        the key-figure row, rewritten into a table
  div.params       the parameter grid, rewritten into a table
  div.cm           the confusion matrix, rewritten into a table
  figure.chart     a bar chart, rendered as a label/value table

Everything else (nav, footer chrome, the page's own styling) is skipped.

Usage
-----
python src/html_to_docx.py
python src/html_to_docx.py --html docs/Report.html --out docs/Report.docx
"""
import argparse
import os
import re
import struct
import zipfile
from html.parser import HTMLParser
from xml.sax.saxutils import escape

# ---- page geometry: A4 with 1 inch margins ----------------------------------
EMU_PER_INCH = 914400
TWIP_PER_INCH = 1440
CONTENT_WIDTH_IN = 6.27          # A4 (8.27in) minus two 1in margins
BODY_FONT = "Tahoma"             # installed everywhere and renders Thai well
MONO_FONT = "Consolas"

W = ('xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
     'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
     'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" '
     'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
     'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"')


def png_size(path):
    """Width and height of a PNG, straight from its IHDR chunk."""
    with open(path, "rb") as f:
        head = f.read(24)
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"not a PNG: {path}")
    return struct.unpack(">II", head[16:24])


# ---- OOXML fragments --------------------------------------------------------
def rpr(bold=False, size=None, color=None, mono=False, italic=False,
        caps=False):
    """A run-properties block. Thai is a complex script, so every size and
    font has to be set twice - once normally and once with the `cs` suffix -
    or Word styles the Latin characters and leaves the Thai at its default."""
    font = MONO_FONT if mono else BODY_FONT
    out = [f'<w:rFonts w:ascii="{font}" w:hAnsi="{font}" w:cs="{font}"/>']
    if bold:
        out.append("<w:b/><w:bCs/>")
    if italic:
        out.append("<w:i/><w:iCs/>")
    if caps:
        out.append("<w:caps/>")
    if color:
        out.append(f'<w:color w:val="{color}"/>')
    if size:
        half = int(size * 2)
        out.append(f'<w:sz w:val="{half}"/><w:szCs w:val="{half}"/>')
    return "<w:rPr>" + "".join(out) + "</w:rPr>"


def run(text, **kw):
    if not text:
        return ""
    return (f"<w:r>{rpr(**kw)}"
            f'<w:t xml:space="preserve">{escape(text)}</w:t></w:r>')


def para(runs, align=None, space_before=0, space_after=120, indent=0,
         hanging=0, shade=None, border=None, keep_next=False, line=276):
    pr = ['<w:spacing w:before="%d" w:after="%d" w:line="%d" '
          'w:lineRule="auto"/>' % (space_before, space_after, line)]
    if align:
        pr.append(f'<w:jc w:val="{align}"/>')
    if indent or hanging:
        pr.append(f'<w:ind w:left="{indent}" w:hanging="{hanging}"/>')
    if shade:
        pr.append(f'<w:shd w:val="clear" w:fill="{shade}"/>')
    if border:
        pr.append('<w:pBdr><w:left w:val="single" w:sz="18" w:space="8" '
                  f'w:color="{border}"/></w:pBdr>')
    if keep_next:
        pr.append("<w:keepNext/>")
    return f'<w:p><w:pPr>{"".join(pr)}</w:pPr>{runs}</w:p>'


HEADING_SPEC = {1: (20, True, "1A1A1A"), 2: (15, True, "B5372C"),
                3: (12.5, True, "1A1A1A"), 4: (11, True, "444444")}


def heading(text, level):
    size, bold, color = HEADING_SPEC[level]
    before = {1: 0, 2: 360, 3: 280, 4: 200}[level]
    body = run(text, bold=bold, size=size, color=color)
    bdr = ""
    if level == 2:
        bdr = ('<w:pBdr><w:bottom w:val="single" w:sz="8" w:space="4" '
               'w:color="B5372C"/></w:pBdr>')
    return (f'<w:p><w:pPr><w:keepNext/><w:spacing w:before="{before}" '
            f'w:after="140" w:line="276" w:lineRule="auto"/>{bdr}</w:pPr>'
            f"{body}</w:p>")


def table(rows, header=True, widths=None, caption=None):
    """rows: list of list of (text, {run kwargs}) or plain strings."""
    ncol = max(len(r) for r in rows)
    if widths is None:
        widths = [int(CONTENT_WIDTH_IN * TWIP_PER_INCH / ncol)] * ncol
    grid = "".join(f'<w:gridCol w:w="{w}"/>' for w in widths)
    borders = ("<w:tblBorders>" + "".join(
        f'<w:{e} w:val="single" w:sz="4" w:space="0" w:color="D0D5DA"/>'
        for e in ("top", "left", "bottom", "right", "insideH", "insideV")
    ) + "</w:tblBorders>")
    out = [f"<w:tbl><w:tblPr>"
           f'<w:tblW w:w="{sum(widths)}" w:type="dxa"/>{borders}'
           f'<w:tblCellMar><w:top w:w="60" w:type="dxa"/>'
           f'<w:left w:w="110" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/>'
           f'<w:right w:w="110" w:type="dxa"/></w:tblCellMar>'
           f"</w:tblPr><w:tblGrid>{grid}</w:tblGrid>"]
    for i, row in enumerate(rows):
        head = header and i == 0
        cells = []
        for j in range(ncol):
            cell = row[j] if j < len(row) else ""
            text, kw = cell if isinstance(cell, tuple) else (cell, {})
            kw = dict(kw)
            kw.setdefault("size", 9.5)
            if head:
                kw["bold"] = True
            shade = "F0F2F4" if head else None
            body = para(run(text, **kw), space_after=0, space_before=0,
                        line=240, align=kw.pop("align", None))
            shd = (f'<w:shd w:val="clear" w:fill="{shade}"/>' if shade else "")
            cells.append(f'<w:tc><w:tcPr><w:tcW w:w="{widths[j]}" '
                         f'w:type="dxa"/>{shd}'
                         f'<w:vAlign w:val="top"/></w:tcPr>{body}</w:tc>')
        trpr = "<w:trPr><w:tblHeader/></w:trPr>" if head else ""
        out.append(f"<w:tr>{trpr}{''.join(cells)}</w:tr>")
    out.append("</w:tbl>")
    block = "".join(out)
    if caption:
        block = para(run(caption, size=8.5, bold=True, color="6B7278",
                         caps=True), space_after=60, keep_next=True) + block
    return block + para("", space_after=0)


def image(rel_id, name, width_px, height_px, max_in=CONTENT_WIDTH_IN):
    w_in = min(max_in, width_px / 96)
    h_in = w_in * height_px / width_px
    cx, cy = int(w_in * EMU_PER_INCH), int(h_in * EMU_PER_INCH)
    drawing = (
        f'<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">'
        f'<wp:extent cx="{cx}" cy="{cy}"/><wp:docPr id="{rel_id[3:]}" '
        f'name="{escape(name)}"/><a:graphic><a:graphicData '
        f'uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        f'<pic:pic><pic:nvPicPr><pic:cNvPr id="{rel_id[3:]}" '
        f'name="{escape(name)}"/><pic:cNvPicPr/></pic:nvPicPr>'
        f'<pic:blipFill><a:blip r:embed="{rel_id}"/>'
        f"<a:stretch><a:fillRect/></a:stretch></pic:blipFill>"
        f'<pic:spPr><a:xfrm><a:off x="0" y="0"/>'
        f'<a:ext cx="{cx}" cy="{cy}"/></a:xfrm>'
        f'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>'
        f"</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>")
    return para(drawing, align="center", space_before=160, space_after=80)


# ---- normalise the page's own widgets into plain tables ---------------------
# The report uses a few CSS grids that carry tabular data but are not <table>
# elements. Rewriting them before parsing is simpler and far less fragile than
# teaching the parser to recognise every container.
CELL_RE = r'<div class="(?:%s)">(.*?)</div>'


def cells(block, classes):
    return re.findall(CELL_RE % "|".join(classes), block, re.S)


def normalise(html):
    # section numbers: "<span class='n'>6</span>ผล..." -> "6. ผล..."
    html = re.sub(r'<span class="n">(\d+)</span>',
                  lambda m: m.group(1) + ". ", html)

    def tiles(m):
        rows = ["<tr><th>ตัวชี้วัด</th><th>ค่า</th><th>หมายเหตุ</th></tr>"]
        for tile in re.findall(r'<div class="tile[^"]*">(.*?)</div>\s*(?=<div class="tile|</div>)',
                               m.group(1) + "</div>", re.S):
            k, v, s_ = (cells(tile, ["k"]), cells(tile, ["v"]), cells(tile, ["s"]))
            if k:
                rows.append("<tr><td>%s</td><td>%s</td><td>%s</td></tr>"
                            % (k[0], v[0] if v else "", s_[0] if s_ else ""))
        return "<table><caption>ผลลัพธ์โดยสรุป</caption>" + "".join(rows) + "</table>"

    def params(m):
        rows = ["<tr><th>พารามิเตอร์</th><th>ค่า</th><th>ความหมาย</th></tr>"]
        pk = cells(m.group(1), ["pk"]); pv = cells(m.group(1), ["pv"])
        pn = cells(m.group(1), ["pn"])
        for i in range(len(pk)):
            rows.append("<tr><td>%s</td><td>%s</td><td>%s</td></tr>"
                        % (pk[i], pv[i] if i < len(pv) else "",
                           pn[i] if i < len(pn) else ""))
        return ("<table><caption>พารามิเตอร์ที่ใช้จริง</caption>"
                + "".join(rows) + "</table>")

    def cm(m):
        body = m.group(1)
        vals = re.findall(r'<div class="q">(.*?)</div><div class="val">(.*?)</div>',
                          body, re.S)
        if len(vals) < 4:
            return ""
        (q1, v1), (q2, v2), (q3, v3), (q4, v4) = vals[:4]
        return ("<table><caption>Confusion matrix ระดับพิกเซล</caption>"
                "<tr><th></th><th>ภาพเฉลย: รอยร้าว</th><th>ภาพเฉลย: พื้นหลัง</th></tr>"
                f"<tr><td>ทำนาย: รอยร้าว</td><td>{q1} {v1}</td><td>{q2} {v2}</td></tr>"
                f"<tr><td>ทำนาย: พื้นหลัง</td><td>{q3} {v3}</td><td>{q4} {v4}</td></tr>"
                "</table>")

    html = re.sub(r'<div class="tiles">(.*?)\n\s*</div>', tiles, html, flags=re.S)
    html = re.sub(r'<div class="params">(.*?)\n\s*</div>', params, html, flags=re.S)
    html = re.sub(r'<div class="cm">(.*?)\n\s*</div>', cm, html, flags=re.S)
    return html


# ---- HTML -> document model -------------------------------------------------
class ReportParser(HTMLParser):
    """Walks the report and emits OOXML blocks. The report's markup is known,
    so this tracks just the containers that change how text is rendered."""

    SKIP = {"nav", "style", "script", "head", "title", "link"}
    VOID = {"img", "br", "hr", "link", "meta", "input", "source"}

    def __init__(self, media_dir, add_image):
        super().__init__(convert_charrefs=True)
        self.out = []
        self.add_image = add_image
        self.media_dir = media_dir
        self.depth = 0
        self.skip_from = None
        self.stack = []          # (tag, classes)
        self.buf = []            # (text, kwargs) runs for the current block
        self.cell = None
        self.row = None
        self.rows = None
        self.caption = None
        self.in_caption = False
        self.bold = 0
        self.mono = 0
        self.bars = None
        self.pending_fig = None

    # -- helpers --
    def cls(self, attrs):
        return set(dict(attrs).get("class", "").split())

    def inside(self, name):
        return any(t == name for t, _ in self.stack)

    def inside_class(self, c):
        return any(c in cl for _, cl in self.stack)

    def text_now(self):
        return "".join(t for t, _ in self.buf).strip()

    def flush(self, fn):
        runs = "".join(run(t, **k) for t, k in self.buf if t)
        self.buf = []
        if runs.strip():
            self.out.append(fn(runs))

    # -- tags --
    def handle_starttag(self, tag, attrs):
        cl = self.cls(attrs)
        if tag not in self.VOID:
            self.depth += 1
        if self.skip_from is not None:
            return
        if tag in self.SKIP or "nav" in cl:
            # a void element such as <link> never closes, so it must not open
            # a skipped region - there would be nothing to end it
            if tag not in self.VOID:
                self.skip_from = self.depth
            return
        # text sitting in a container that has no paragraph of its own (the
        # masthead meta line, for instance) would otherwise leak into whatever
        # block comes next - flush it before opening one
        BLOCK = {"h1", "h2", "h3", "h4", "p", "li", "pre", "table", "figure",
                 "div", "ul", "ol", "figcaption"}
        if (tag in BLOCK and self.buf and self.cell is None
                and self.bars is None):
            self.flush(lambda r: para(r, space_after=160))

        self.stack.append((tag, cl))

        if tag in ("b", "strong"):
            self.bold += 1
        elif tag == "code":
            self.mono += 1
        elif tag == "img":
            src = dict(attrs).get("src", "")
            path = os.path.join(self.media_dir, os.path.basename(src))
            if os.path.exists(path):
                rid, name = self.add_image(path)
                w, h = png_size(path)
                self.out.append(image(rid, name, w, h))
        elif tag == "table":
            self.rows, self.caption = [], None
        elif tag == "tr":
            self.row = []
        elif tag in ("td", "th"):
            self.cell = []
        elif tag == "caption":
            self.in_caption = True
        elif tag == "figure" and "chart" in cl:
            self.bars = []
        elif tag == "div" and "bar" in cl:
            self.bar_on = "on" in cl

    def handle_endtag(self, tag):
        if self.skip_from is not None:
            if self.depth == self.skip_from:
                self.skip_from = None
            self.depth -= 1
            return
        if tag not in self.VOID:
            self.depth -= 1
        cl = set()
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                cl = self.stack[i][1]
                del self.stack[i:]
                break

        if tag in ("b", "strong"):
            self.bold = max(0, self.bold - 1)
        elif tag == "code":
            self.mono = max(0, self.mono - 1)
        elif tag in ("td", "th"):
            text = "".join(t for t, _ in self.cell or []).strip()
            self.row.append((re.sub(r"\s+", " ", text), {}))
            self.cell = None
        elif tag == "tr":
            if self.row:
                self.rows.append(self.row)
            self.row = None
        elif tag == "caption":
            self.in_caption = False
        elif tag == "table":
            if self.rows:
                self.out.append(table(self.rows, caption=self.caption))
            self.rows = None
        elif tag in ("h1", "h2", "h3", "h4"):
            text = re.sub(r"\s+", " ", self.text_now())
            self.buf = []
            lvl = int(tag[1])
            if text:
                self.out.append(heading(text, lvl))
        elif tag == "p":
            if self.bars is not None or self.rows is not None:
                self.buf = []
                return
            if "dek" in cl or "lede" in cl:
                self.flush(lambda r: para(r, space_after=200))
            elif "lab" in cl:
                self.flush(lambda r: para(r, space_after=40, indent=170,
                                          shade="F7F2F1", border="B5372C"))
            else:
                self.flush(lambda r: para(r, space_after=160))
        elif tag == "li":
            self.flush(lambda r: para(r, indent=360, hanging=180,
                                      space_after=80))
        elif tag == "pre":
            text = "".join(t for t, _ in self.buf)
            self.buf = []
            for line in text.strip("\n").split("\n"):
                self.out.append(para(
                    run(line or " ", mono=True, size=8.5, color="3A4046"),
                    shade="F2F4F6", space_after=0, space_before=0, line=240,
                    indent=120))
            self.out.append(para("", space_after=140))
        elif tag == "figcaption":
            self.flush(lambda r: para(r, space_after=220, align="center"))
        elif tag == "figure" and self.bars is not None:
            if self.bars:
                self.out.append(table(
                    [[("รายการ", {}), ("ค่า", {})]] + self.bars,
                    widths=[int(CONTENT_WIDTH_IN * TWIP_PER_INCH * 0.62),
                            int(CONTENT_WIDTH_IN * TWIP_PER_INCH * 0.38)],
                    caption=self.chart_title))
            self.bars = None
        elif tag == "div":
            if "bar" in cl and self.bars is not None:
                parts = [t.strip() for t, _ in self.buf if t.strip()]
                self.buf = []
                if len(parts) >= 2:
                    kw = {"bold": True} if getattr(self, "bar_on", False) else {}
                    self.bars.append([(parts[0], kw),
                                      (parts[-1], dict(kw, mono=True))])
            elif "note" in cl:
                self.buf = []

    def handle_data(self, data):
        if self.skip_from is not None or not data.strip():
            if self.cell is not None and data.strip() == "":
                return
            if not data.strip():
                return
        text = data if self.inside("pre") else re.sub(r"\s+", " ", data)
        if self.in_caption:
            self.caption = (self.caption or "") + text.strip()
            return
        if self.cell is not None:
            self.cell.append((text, {}))
            return
        if self.bars is not None and self.inside_class("ct"):
            self.chart_title = text.strip()
            return
        if self.bars is not None and self.inside_class("cs"):
            return
        kw = {}
        if self.bold:
            kw["bold"] = True
        if self.mono or self.inside_class("mono") or self.inside_class("num"):
            kw["mono"] = True
        if self.inside("pre"):
            return
        self.buf.append((text, kw))


# ---- package ----------------------------------------------------------------
def build(html_path, out_path):
    media, rels = [], []

    def add_image(path):
        name = os.path.basename(path)
        for i, (p, _) in enumerate(media):
            if p == path:
                return f"rId{100 + i}", name
        media.append((path, name))
        return f"rId{100 + len(media) - 1}", name

    media_dir = os.path.join(os.path.dirname(html_path), "figures")
    parser = ReportParser(media_dir, add_image)
    with open(html_path, encoding="utf-8") as f:
        parser.feed(normalise(f.read()))
    body = "".join(parser.out)

    sect = ('<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'
            '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" '
            'w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>'
            "</w:sectPr>")
    document = (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                f"<w:document {W}><w:body>{body}{sect}</w:body></w:document>")

    styles = (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
              f"<w:styles {W}><w:docDefaults><w:rPrDefault><w:rPr>"
              f'<w:rFonts w:ascii="{BODY_FONT}" w:hAnsi="{BODY_FONT}" '
              f'w:cs="{BODY_FONT}"/>'
              f'<w:sz w:val="21"/><w:szCs w:val="21"/>'
              f'<w:lang w:val="en-US" w:bidi="th-TH"/>'
              f"</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr>"
              f'<w:spacing w:after="140" w:line="276" w:lineRule="auto"/>'
              f"</w:pPr></w:pPrDefault></w:docDefaults></w:styles>")

    img_rels = "".join(
        f'<Relationship Id="rId{100 + i}" Type="http://schemas.openxmlformats'
        f'.org/officeDocument/2006/relationships/image" '
        f'Target="media/{name}"/>' for i, (_, name) in enumerate(media))
    doc_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/'
        '2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/'
        'officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        f"{img_rels}</Relationships>")

    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/'
        'content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats'
        '-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Default Extension="png" ContentType="image/png"/>'
        '<Override PartName="/word/document.xml" ContentType="application/vnd.'
        'openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        '<Override PartName="/word/styles.xml" ContentType="application/vnd.'
        'openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
        "</Types>")

    root_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/'
        '2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/'
        'officeDocument/2006/relationships/officeDocument" '
        'Target="word/document.xml"/></Relationships>')

    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", content_types)
        z.writestr("_rels/.rels", root_rels)
        z.writestr("word/document.xml", document)
        z.writestr("word/styles.xml", styles)
        z.writestr("word/_rels/document.xml.rels", doc_rels)
        for path, name in media:
            z.write(path, f"word/media/{name}")

    print(f"wrote {out_path}  ({os.path.getsize(out_path) / 1024:.0f} KB, "
          f"{len(parser.out)} blocks, {len(media)} images)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--html", default="docs/Report.html")
    ap.add_argument("--out", default="docs/Report.docx")
    args = ap.parse_args()
    build(args.html, args.out)


if __name__ == "__main__":
    main()
