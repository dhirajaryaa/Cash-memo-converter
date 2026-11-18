import { readFileSync } from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export interface RawMemo {
  name: string;
  addressLines: string[];
  mobile: string;
  bookingDate: string;
  netPayable: number;
  area: string;
}

interface Item { str: string; x: number; y: number; w: number }

// Column boundaries of the Indane bulk memo layout (A4 points).
const LEFT_MAX = 236;
const MID_MAX = 376;

function column(items: Item[], from: number, to: number): string[] {
  // pdf.js gives one item per text run, so a column is simply "runs that start inside its x-range"
  const sel = items.filter((it) => it.x >= from && it.x < to);
  sel.sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: { y: number; parts: Item[] }[] = [];
  for (const it of sel) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) < 2.5) last.parts.push(it);
    else lines.push({ y: it.y, parts: [it] });
  }
  return lines
    .map((l) => l.parts.sort((a, b) => a.x - b.x).map((p) => p.str).join(" ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function parseMemo(items: Item[]): RawMemo {
  const left = column(items, 0, LEFT_MAX);
  const right = column(items, MID_MAX, 10000);
  const get = (lines: string[], re: RegExp) => {
    for (const l of lines) { const m = l.match(re); if (m) return m[1].trim(); }
    return "";
  };
  const a = left.findIndex((l) => l.startsWith("Address :"));
  const b = left.findIndex((l) => l.startsWith("Landmark"));
  const addressLines = a >= 0
    ? [left[a].slice("Address :".length).trim(), ...left.slice(a + 1, b > a ? b : undefined)].filter(Boolean)
    : [];
  return {
    name: get(right, /^Name\s*:\s*(.+)$/),
    addressLines,
    mobile: get(right, /^Mobile\s*:\s*(\d+)/),
    bookingDate: get(right, /Booking Date\s*:\s*(\d\d-\d\d-\d{4})/),
    netPayable: parseFloat(get(right, /Net Payable\(Rs\.\)\s*:\s*([\d.]+)/) || "NaN"),
    area: get(right, /Category\/Area\s*:\s*Domestic\/\s*(.+)$/),
  };
}

export async function extractMemos(path: string): Promise<RawMemo[]> {
  const data = new Uint8Array(readFileSync(path));
  const pdf = await getDocument({ data, useSystemFonts: true, verbosity: 0 }).promise;
  const out: RawMemo[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const H = page.getViewport({ scale: 1 }).height;
    const tc = await page.getTextContent();
    const items: Item[] = tc.items
      .filter((i: any) => typeof i.str === "string" && i.str.trim() !== "")
      .map((i: any) => ({ str: i.str as string, x: i.transform[4] as number, y: H - (i.transform[5] as number), w: i.width as number }));
    // anchors: "Tax Invoice" in the middle column; one memo starts a new cluster >100pt below the last
    const tops = items
      .filter((i) => i.str.startsWith("Tax Invoice") && i.x > LEFT_MAX - 10 && i.x < LEFT_MAX + 20)
      .map((i) => i.y)
      .sort((x, y) => x - y);
    const starts: number[] = [];
    for (const t of tops) if (!starts.length || t - starts[starts.length - 1] > 100) starts.push(t);
    starts.forEach((s, k) => {
      const y0 = s - 5, y1 = k + 1 < starts.length ? starts[k + 1] - 5 : H + 1;
      out.push(parseMemo(items.filter((i) => i.y >= y0 && i.y < y1)));
    });
  }
  return out;
}
