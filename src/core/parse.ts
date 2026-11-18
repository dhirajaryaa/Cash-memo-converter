import type { RawMemo } from "./types.js";

export interface TextItem {
  str: string;
  x: number;
  y: number;
  w: number;
}

// Column boundaries of the Indane bulk memo layout (A4 points).
export const LEFT_MAX = 236;
export const MID_MAX = 376;

function column(items: TextItem[], from: number, to: number): string[] {
  // pdf.js gives one item per text run, so a column is simply "runs that start inside its x-range"
  const sel = items.filter((it) => it.x >= from && it.x < to);
  sel.sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: { y: number; parts: TextItem[] }[] = [];
  for (const it of sel) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) < 2.5) last.parts.push(it);
    else lines.push({ y: it.y, parts: [it] });
  }
  return lines
    .map((l) => l.parts.sort((a, b) => a.x - b.x).map((p) => p.str).join(" ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function get(lines: string[], re: RegExp): string {
  for (const l of lines) {
    const m = l.match(re);
    if (m) return m[1].trim();
  }
  return "";
}

function cleanArea(raw: string): string {
  return raw
    .replace(/\s+(Mobile|Booking Date|Equipment\/Qty|Net Payable|Cons No)\b.*$/i, "")
    .replace(/^[^/]*\/\s*/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function parseMemo(items: TextItem[]): RawMemo {
  const left = column(items, 0, LEFT_MAX);
  const right = column(items, MID_MAX, 10000);

  const a = left.findIndex((l) => l.startsWith("Address :"));
  const b = left.findIndex((l) => l.startsWith("Landmark"));
  const addressLines = a >= 0
    ? [left[a].slice("Address :".length).trim(), ...left.slice(a + 1, b > a ? b : undefined)]
        .map((l) => l.trim())
        .filter((l) => l && l !== ":" && l !== "A")
    : [];

  return {
    name: get(right, /^Name\s*:\s*(.+)$/),
    addressLines,
    mobile: get(right, /^Mobile\s*:\s*(\d{10})/),
    bookingDate: get(right, /Booking Date\s*:\s*(\d\d-\d\d-\d{4})/),
    netPayable: parseFloat(get(right, /Net Payable\(Rs\.\)\s*:\s*([\d.]+)/) || "NaN"),
    area: cleanArea(get(right, /Category\/Area\s*:\s*(.+)$/)),
    invoiceNo: get(right, /Tax Invoice\s*:\s*([0-9][0-9-]*)/),
  };
}

/**
 * Split one PDF page's text runs into individual memos.
 * All y values must already be measured from the top of the page.
 */
export function parsePageMemos(items: TextItem[]): RawMemo[] {
  // anchors: "Tax Invoice" in the middle column; one memo starts a new cluster >100pt below the last
  const tops = items
    .filter((i) => i.str.startsWith("Tax Invoice") && i.x > LEFT_MAX - 10 && i.x < LEFT_MAX + 20)
    .map((i) => i.y)
    .sort((x, y) => x - y);
  const starts: number[] = [];
  for (const t of tops) if (!starts.length || t - starts[starts.length - 1] > 100) starts.push(t);
  return starts.map((s, k) => {
    const y0 = s - 5;
    const y1 = k + 1 < starts.length ? starts[k + 1] - 5 : Number.POSITIVE_INFINITY;
    return parseMemo(items.filter((i) => i.y >= y0 && i.y < y1));
  });
}
