import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { buildPdf } from "../core/pdf.js";
import { buildDeliveryList, subtitleFor } from "../core/rows.js";
import type { SortMode } from "../core/types.js";
import { extractMemos } from "./extract.js";

const root = join(import.meta.dirname, "..", "..");
const fixtureDir = join(root, "test");
const outRoot = join(root, "output");
const title = "DIVYASHRI KD INDANE - Delivery List";
const generatedAt = new Date().toISOString();

const variants: { slug: string; sort: SortMode; parts: number; groupByArea: boolean; label: string }[] = [
  { slug: "01-memo-order", sort: "memo", parts: 3, groupByArea: false, label: "Memo order, 3-part address" },
  { slug: "02-by-area", sort: "area", parts: 3, groupByArea: true, label: "Route/area order, area bands, 3-part address" },
  { slug: "03-by-name", sort: "name", parts: 3, groupByArea: false, label: "Name order, 3-part address" },
  { slug: "04-two-part-address", sort: "area", parts: 2, groupByArea: true, label: "Route/area order, 2-part address" },
  { slug: "05-short-address", sort: "area", parts: 1, groupByArea: true, label: "Route/area order, 1-part address" },
];

const fixtures = readdirSync(fixtureDir).filter((f) => /^Cash Memo Bulk .*\.pdf$/i.test(f)).sort();
const manifest: any = { generatedAt, title, fixtures: [] };

for (const file of fixtures) {
  const memos = await extractMemos(join(fixtureDir, file));
  const stem = basename(file).replace(/\.pdf$/i, "").replace(/[^\w.-]+/g, "_");
  const dir = join(outRoot, stem);
  mkdirSync(dir, { recursive: true });
  const entry: any = { fixture: file, memoCount: memos.length, folder: relative(root, dir), variants: [] };

  for (const v of variants) {
    const { rows, stats, warnings } = buildDeliveryList(memos, { sort: v.sort, parts: v.parts });
    const bytes = await buildPdf(rows, {
      title,
      subtitle: subtitleFor(stats),
      groupByArea: v.groupByArea,
    });
    const out = join(dir, `${v.slug}.pdf`);
    writeFileSync(out, bytes);
    entry.variants.push({
      label: v.label,
      sort: v.sort,
      parts: v.parts,
      groupByArea: v.groupByArea,
      entries: rows.length,
      cash: stats.cash,
      online: stats.online,
      areas: stats.areas,
      warnings,
      file: relative(root, out),
      bytes: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
    console.log(`${rows.length} entries  ${v.slug}  -> ${relative(root, out)}`);
  }
  manifest.fixtures.push(entry);
}

writeFileSync(join(outRoot, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`\nWrote ${manifest.fixtures.reduce((n: number, f: any) => n + f.variants.length, 0)} PDFs to output/`);
