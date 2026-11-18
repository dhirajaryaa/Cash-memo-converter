import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

export interface Row { name: string; address: string; mobile: string; payment: "Cash" | "Online"; bookingDate: string }

const MM = 72 / 25.4;
const PAGE_W = 595.28, PAGE_H = 841.89;
const MARGIN_X = 9.5 * MM, MARGIN_TOP = 10 * MM, MARGIN_BOTTOM = 12 * MM;
const COLS = [
  { h: "Sr.", w: 9 }, { h: "Name", w: 36 }, { h: "Address", w: 62 }, { h: "Mobile", w: 25 },
  { h: "Payment", w: 17 }, { h: "DAC", w: 18 }, { h: "Booking Date", w: 24 },
].map((c) => ({ ...c, w: c.w * MM }));
const PAD = 3, PAD_Y = 2.6;

const safe = (s: string) => [...s].map((c) => (c.charCodeAt(0) < 256 ? c : "?")).join("");

function wrap(text: string, font: PDFFont, size: number, maxW: number, maxLines: number): string[] {
  const words = safe(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (font.widthOfTextAtSize(t, size) <= maxW) cur = t;
    else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, maxLines);
}

export async function buildPdf(rows: Row[], title: string, subtitle: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0), white = rgb(1, 1, 1);
  const tableW = COLS.reduce((s, c) => s + c.w, 0);
  const xs: number[] = []; COLS.reduce((x, c) => (xs.push(x), x + c.w), MARGIN_X);

  let page!: PDFPage; let y = 0; let pageNo = 0;
  const newPage = (first: boolean) => {
    page = doc.addPage([PAGE_W, PAGE_H]); pageNo++;
    page.drawText(`Page ${pageNo}`, { x: PAGE_W - MARGIN_X - 30, y: 6 * MM, size: 8, font: reg, color: black });
    y = PAGE_H - MARGIN_TOP;
    if (first) {
      page.drawText(safe(title), { x: MARGIN_X, y: y - 14, size: 14, font: bold });
      page.drawText(safe(subtitle), { x: MARGIN_X, y: y - 29, size: 10, font: reg });
      y -= 29 + 3 * MM;
    }
    const hh = 26;
    page.drawRectangle({ x: MARGIN_X, y: y - hh, width: tableW, height: hh, color: black });
    COLS.forEach((c, i) => {
      const ls = c.h === "Booking Date" ? ["Booking", "Date"] : [c.h];
      ls.forEach((l, k) => {
        const tw = bold.widthOfTextAtSize(l, 10);
        const ty = y - hh / 2 - 3.5 + (ls.length === 2 ? (k === 0 ? 6 : -6) : 0);
        page.drawText(l, { x: xs[i] + (c.w - tw) / 2, y: ty, size: 10, font: bold, color: white });
      });
    });
    y -= hh;
  };

  newPage(true);
  rows.forEach((r, idx) => {
    const nameL = wrap(r.name, bold, 10, COLS[1].w - 2 * PAD, 2);
    const addrL = wrap(r.address, reg, 9, COLS[2].w - 2 * PAD, 2);
    const h = Math.max(nameL.length * 12.5, addrL.length * 11, 12.5) + 2 * PAD_Y;
    if (y - h < MARGIN_BOTTOM) newPage(false);
    const top = y;
    const cellText = (ci: number, lines: string[], font: PDFFont, size: number, lead: number, center = false) => {
      const block = lines.length * lead;
      lines.forEach((l, k) => {
        const tw = font.widthOfTextAtSize(l, size);
        const x = center ? xs[ci] + (COLS[ci].w - tw) / 2 : xs[ci] + PAD;
        page.drawText(l, { x, y: top - h / 2 + block / 2 - lead * (k + 1) + (lead - size) / 2 + size * 0.2, size, font, color: black });
      });
    };
    cellText(0, [String(idx + 1)], reg, 10, 12.5, true);
    cellText(1, nameL, bold, 10, 12.5);
    cellText(2, addrL, reg, 9, 11);
    cellText(3, [r.mobile], reg, 10, 12.5);
    cellText(4, [r.payment], reg, 10, 12.5, true);
    cellText(6, [r.bookingDate], reg, 10, 12.5, true);
    // grid
    page.drawLine({ start: { x: MARGIN_X, y: top - h }, end: { x: MARGIN_X + tableW, y: top - h }, thickness: 0.5, color: black });
    xs.concat([MARGIN_X + tableW]).forEach((x) =>
      page.drawLine({ start: { x, y: top }, end: { x, y: top - h }, thickness: 0.5, color: black }));
    y -= h;
  });
  return doc.save();
}
