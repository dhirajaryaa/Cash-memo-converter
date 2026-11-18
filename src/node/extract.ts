import { readFileSync } from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { LEFT_MAX, parsePageMemos, type TextItem } from "../core/parse.js";
import type { RawMemo } from "../core/types.js";

export interface ExtractProgress {
  page: number;
  pages: number;
}

export async function extractMemosFromBytes(
  data: Uint8Array,
  onProgress?: (p: ExtractProgress) => void,
): Promise<RawMemo[]> {
  const task = getDocument({ data, useSystemFonts: true, verbosity: 0 });
  const pdf = await task.promise;
  const out: RawMemo[] = [];
  try {
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const H = page.getViewport({ scale: 1 }).height;
      const tc = await page.getTextContent();
      const items: TextItem[] = (tc.items as any[])
        .filter((i) => typeof i.str === "string" && i.str.trim() !== "")
        .map((i) => ({
          str: i.str as string,
          x: i.transform[4] as number,
          y: H - (i.transform[5] as number),
          w: (i.width as number) ?? 0,
        }));
      out.push(...parsePageMemos(items));
      onProgress?.({ page: p, pages: pdf.numPages });
    }
  } finally {
    await task.destroy();
  }
  return out;
}

export async function extractMemos(
  path: string,
  onProgress?: (p: ExtractProgress) => void,
): Promise<RawMemo[]> {
  return extractMemosFromBytes(new Uint8Array(readFileSync(path)), onProgress);
}

export { LEFT_MAX };
