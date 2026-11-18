// Copies the pdf.js worker + standard font data into public/ so the browser
// build is completely self-hosted. Runs automatically after npm install.
import { copyFileSync, cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "pdfjs-dist");
const pub = join(root, "public");

if (!existsSync(from)) {
  console.warn("pdfjs-dist is not installed yet; skipping pdf.js asset copy.");
  process.exit(0);
}

mkdirSync(pub, { recursive: true });
copyFileSync(join(from, "build", "pdf.worker.min.mjs"), join(pub, "pdf.worker.min.mjs"));

const fontsSrc = join(from, "standard_fonts");
const fontsDest = join(pub, "pdfjs", "standard_fonts");
if (existsSync(fontsSrc)) {
  mkdirSync(fontsDest, { recursive: true });
  cpSync(fontsSrc, fontsDest, { recursive: true });
}

console.log("Copied pdf.js worker and standard fonts to public/.");
