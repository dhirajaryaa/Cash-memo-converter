import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import type { DeliveryRow } from "./types.js";

export interface PdfOptions {
  title: string;
  subtitle: string;
  /** Print an area band before each route/area group (used with Sort by area). */
  groupByArea?: boolean;
  onProgress?: (done: number, total: number) => void;
}

const MM = 72 / 25.4;
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 9.5 * MM;
const MARGIN_TOP = 10 * MM;
const MARGIN_BOTTOM = 12 * MM;
const COLS = [
  { h: "Sr.", w: 9 },
  { h: "Name", w: 36 },
  { h: "Address", w: 62 },
  { h: "Mobile", w: 25 },
  { h: "Payment", w: 17 },
  { h: "DAC", w: 18 },
  { h: "Booking Date", w: 24 },
].map((c) => ({ ...c, w: c.w * MM }));
const PAD = 3;
const PAD_Y = 2.6;
const GROUP_H = 15;
const BLACK = rgb(0, 0, 0);
const WHITE = rgb(1, 1, 1);
const BAND = rgb(0.94, 0.94, 0.92);
const STRIPE = rgb(0.972, 0.972, 0.965);
const MUTED = rgb(0.35, 0.35, 0.35);

const CHAR_MAP: Record<string, string> = {
  "\u2018": "'", "\u2019": "'", "\u201a": "'", "\u201b": "'",
  "\u201c": '"', "\u201d": '"', "\u201e": '"', "\u201f": '"',
  "\u2013": "-", "\u2014": "-", "\u2212": "-", "\u2022": "-", "\u00b7": ".",
  "\u20b9": "Rs.", "\u00a0": " ", "\u200b": "", "\u200c": "", "\u200d": "",
};

const safe = (s: string) =>
  [...s]
    .map((c) => {
      if (CHAR_MAP[c] !== undefined) return CHAR_MAP[c];
      return c.charCodeAt(0) < 256 ? c : "?";
    })
    .join("");

function wrap(text: string, font: PDFFont, size: number, maxW: number, maxLines: number): string[] {
  const words = safe(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const t = cur ? cur + " " + word : word;
    if (font.widthOfTextAtSize(t, size) <= maxW) {
      cur = t;
      continue;
    }
    if (cur) lines.push(cur);
    cur = "";
    // A single long word (e.g. a house number) must not spill past the cell.
    if (font.widthOfTextAtSize(word, size) > maxW) {
      let chunk = "";
      for (const ch of word) {
        if (font.widthOfTextAtSize(chunk + ch, size) > maxW) {
          if (chunk) lines.push(chunk);
          chunk = ch;
        } else chunk += ch;
      }
      cur = chunk;
    } else {
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, maxLines);
}

export async function buildPdf(rows: DeliveryRow[], options: PdfOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(safe(options.title));
  doc.setSubject("Delivery list generated offline from Indane cash memos");
  doc.setAuthor("Delivery List (offline)");
  doc.setCreator("Delivery List (offline)");
  doc.setProducer("pdf-lib");
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const tableW = COLS.reduce((s, c) => s + c.w, 0);
  const xs: number[] = [];
  COLS.reduce((x, c) => (xs.push(x), x + c.w), MARGIN_X);

  let page!: PDFPage;
  let y = 0;
  let pageNo = 0;

  const drawGroup = (area: string, count: number) => {
    page.drawRectangle({ x: MARGIN_X, y: y - GROUP_H, width: tableW, height: GROUP_H, color: BAND });
    const label = safe(`${area.toUpperCase()}  -  ${count} ${count === 1 ? "entry" : "entries"}`);
    page.drawText(label, { x: MARGIN_X + PAD + 1, y: y - GROUP_H + 4.6, size: 8.5, font: bold, color: BLACK });
    y -= GROUP_H;
  };

  const drawHeader = () => {
    const hh = 26;
    page.drawRectangle({ x: MARGIN_X, y: y - hh, width: tableW, height: hh, color: BLACK });
    COLS.forEach((c, i) => {
      const ls = c.h === "Booking Date" ? ["Booking", "Date"] : [c.h];
      ls.forEach((l, k) => {
        const tw = bold.widthOfTextAtSize(l, 10);
        const ty = y - hh / 2 - 3.5 + (ls.length === 2 ? (k === 0 ? 6 : -6) : 0);
        page.drawText(l, { x: xs[i] + (c.w - tw) / 2, y: ty, size: 10, font: bold, color: WHITE });
      });
    });
    y -= hh;
  };

  const newPage = (first: boolean, group?: { area: string; count: number }) => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    pageNo++;
    page.drawText(`Page ${pageNo}`, { x: PAGE_W - MARGIN_X - 30, y: 6 * MM, size: 8, font: reg, color: MUTED });
    y = PAGE_H - MARGIN_TOP;
    if (first) {
      page.drawText(safe(options.title), { x: MARGIN_X, y: y - 14, size: 14, font: bold, color: BLACK });
      page.drawText(safe(options.subtitle), { x: MARGIN_X, y: y - 29, size: 10, font: reg, color: BLACK });
      y -= 29 + 3 * MM;
    }
    drawHeader();
    if (group) drawGroup(group.area, group.count);
  };

  newPage(true);

  let group: { area: string; count: number } | undefined;
  let lastArea = "";
  for (let idx = 0; idx < rows.length; idx++) {
    const r = rows[idx];
    const nameL = wrap(r.name, bold, 10, COLS[1].w - 2 * PAD, 3);
    const addrL = wrap(r.address, reg, 9, COLS[2].w - 2 * PAD, 3);
    const h = Math.max(nameL.length * 12.5, addrL.length * 11, 12.5) + 2 * PAD_Y;

    if (options.groupByArea && r.area !== lastArea) {
      group = { area: r.area, count: rows.filter((x) => x.area === r.area).length };
      lastArea = r.area;
      // Keep the band with at least its first row instead of leaving it alone at the page foot.
      if (y - GROUP_H - h < MARGIN_BOTTOM) newPage(false, group);
      else drawGroup(group.area, group.count);
    }

    if (y - h < MARGIN_BOTTOM) newPage(false, options.groupByArea ? group : undefined);

    if (idx % 2 === 1) {
      page.drawRectangle({ x: MARGIN_X, y: y - h, width: tableW, height: h, color: STRIPE });
    }
    const top = y;
    const cellText = (
      ci: number,
      lines: string[],
      font: PDFFont,
      size: number,
      lead: number,
      center = false,
    ) => {
      const block = lines.length * lead;
      lines.forEach((l, k) => {
        const tw = font.widthOfTextAtSize(l, size);
        const x = center ? xs[ci] + (COLS[ci].w - tw) / 2 : xs[ci] + PAD;
        page.drawText(l, {
          x,
          y: top - h / 2 + block / 2 - lead * (k + 1) + (lead - size) / 2 + size * 0.2,
          size,
          font,
          color: BLACK,
        });
      });
    };
    cellText(0, [String(idx + 1)], reg, 10, 12.5, true);
    cellText(1, nameL, bold, 10, 12.5);
    cellText(2, addrL, reg, 9, 11);
    cellText(3, [safe(r.mobile)], reg, 10, 12.5);
    cellText(4, [r.payment], reg, 10, 12.5, true);
    cellText(6, [safe(r.bookingDate)], reg, 10, 12.5, true);
    // grid
    page.drawLine({ start: { x: MARGIN_X, y: top - h }, end: { x: MARGIN_X + tableW, y: top - h }, thickness: 0.5, color: BLACK });
    xs.concat([MARGIN_X + tableW]).forEach((x) =>
      page.drawLine({ start: { x, y: top }, end: { x, y: top - h }, thickness: 0.5, color: BLACK }),
    );
    y -= h;
    if (options.onProgress && (idx % 10 === 0 || idx === rows.length - 1)) options.onProgress(idx + 1, rows.length);
  }

  if (!rows.length) {
    page.drawText("No entries in this cash memo.", { x: MARGIN_X, y: y - 18, size: 11, font: reg, color: BLACK });
  }

  return doc.save();
}
