import { writeFileSync } from "node:fs";
import { basename } from "node:path";
import { extractMemos } from "./extract.js";
import { cleanName, shortenAddress } from "./address.js";
import { buildPdf, Row } from "./pdf.js";

// Usage: node dist/index.js <memo.pdf> [out.pdf] [--sort=area|name] [--parts=3]
const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith("--")).map((a) => a.slice(2).split("=") as [string, string]));
const files = args.filter((a) => !a.startsWith("--"));
if (!files[0]) { console.error("Usage: node dist/index.js <memo.pdf> [out.pdf] [--sort=area|name] [--parts=3]"); process.exit(1); }
const out = files[1] ?? `Delivery_List_${basename(files[0]).replace(/\.pdf$/i, "")}.pdf`;
const parts = Number(flags.parts ?? 3);

const memos = await extractMemos(files[0]);
const bad = memos.filter((m) => !m.name || !m.mobile || !m.bookingDate || Number.isNaN(m.netPayable));
if (bad.length) console.warn(`WARNING: ${bad.length} memo(s) have missing fields, check them manually:`, bad.map((b) => b.name || "(no name)"));

let list = memos.map((m) => ({
  area: m.area,
  row: {
    name: cleanName(m.name),
    address: shortenAddress(m.addressLines, parts),
    mobile: m.mobile,
    payment: m.netPayable === 0 ? "Online" : "Cash",
    bookingDate: m.bookingDate,
  } as Row,
}));
if (flags.sort === "area") list.sort((a, b) => a.area.localeCompare(b.area) || a.row.name.localeCompare(b.row.name));
if (flags.sort === "name") list.sort((a, b) => a.row.name.localeCompare(b.row.name));
const rows = list.map((l) => l.row);

const today = new Date().toLocaleDateString("en-GB").replace(/\//g, "-");
const online = rows.filter((r) => r.payment === "Online").length;
const pdf = await buildPdf(rows, "DIVYASHRI KD INDANE - Delivery List",
  `Date: ${today}   |   Total: ${rows.length}   |   Cash: ${rows.length - online}   |   Online: ${online}`);
writeFileSync(out, pdf);
console.log(`${rows.length} entries -> ${out}`);
