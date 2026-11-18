import { parsePageMemos, type TextItem } from "@/src/core/parse";
import type { RawMemo } from "@/src/core/types";

type Pdfjs = typeof import("pdfjs-dist");
let pdfjsPromise: Promise<Pdfjs> | null = null;

async function loadPdfjs(): Promise<Pdfjs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return mod;
    });
  }
  return pdfjsPromise;
}

/** Read the distributor's bulk memo entirely in the browser. No network calls. */
export async function extractMemosFromPdf(
  data: ArrayBuffer,
  onProgress?: (page: number, pages: number) => void,
): Promise<RawMemo[]> {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({
    data: new Uint8Array(data),
    standardFontDataUrl: "/pdfjs/standard_fonts/",
    useSystemFonts: false,
    verbosity: 0,
  });
  const pdf = await task.promise;
  const memos: RawMemo[] = [];
  try {
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
      const page = await pdf.getPage(pageNo);
      const height = page.getViewport({ scale: 1 }).height;
      const content = await page.getTextContent();
      const items: TextItem[] = (content.items as any[])
        .filter((item) => typeof item.str === "string" && item.str.trim() !== "")
        .map((item) => ({
          str: item.str as string,
          x: item.transform[4] as number,
          y: height - (item.transform[5] as number),
          w: (item.width as number) ?? 0,
        }));
      memos.push(...parsePageMemos(items));
      onProgress?.(pageNo, pdf.numPages);
      // Let the browser paint the progress bar between pages.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  } finally {
    await task.destroy();
  }
  return memos;
}
