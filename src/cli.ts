import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { buildPdf } from "./core/pdf.js";
import { buildDeliveryList, subtitleFor } from "./core/rows.js";
import type { SortMode } from "./core/types.js";
import { extractMemos } from "./node/extract.js";

const HELP = `Usage: delivery-list <memo.pdf...> [options]

Options:
  --out=<file|dir>   Write one file, or a directory for several inputs (default: output/)
  --sort=memo|area|name   Row order (default: memo)
  --parts=1..5       Address parts to keep (default: 3)
  --title=<text>     Heading printed on the PDF
  --no-group         Do not print area bands when sorting by area
  --help             Show this help

Everything runs offline. No file is uploaded anywhere.`;

function parseArgs(argv: string[]) {
  const flags: Record<string, string | true> = {};
  const files: string[] = [];
  for (const arg of argv) {
    if (!arg.startsWith("--")) files.push(arg);
    else {
      const [key, ...rest] = arg.slice(2).split("=");
      flags[key] = rest.length ? rest.join("=") : true;
    }
  }
  return { flags, files };
}

function isDirectory(path: string) {
  return existsSync(path) && statSync(path).isDirectory();
}

const { flags, files } = parseArgs(process.argv.slice(2));
if (flags.help || !files.length) {
  console.log(HELP);
  process.exit(files.length ? 0 : 1);
}

const sort = (String(flags.sort ?? "memo") as SortMode);
if (!["memo", "area", "name"].includes(sort)) {
  console.error("--sort must be memo, area or name");
  process.exit(1);
}
const parts = Number(flags.parts ?? 3);
if (!Number.isInteger(parts) || parts < 1 || parts > 5) {
  console.error("--parts must be a whole number from 1 to 5");
  process.exit(1);
}
const title = String(flags.title ?? "DIVYASHRI KD INDANE - Delivery List");
const outArg = flags.out ? String(flags.out) : "output";
const groupByArea = !flags["no-group"] && sort === "area";

for (const file of files) {
  if (!existsSync(file)) {
    console.error(`Not found: ${file}`);
    process.exitCode = 1;
    continue;
  }
  let out: string;
  if (files.length === 1 && extname(outArg).toLowerCase() === ".pdf") out = outArg;
  else out = join(outArg, `Delivery_List_${basename(file).replace(/\.pdf$/i, "").replace(/[^\w.-]+/g, "_")}.pdf`);

  try {
    const memos = await extractMemos(file);
    const { rows, stats, warnings } = buildDeliveryList(memos, { sort, parts });
    const pdf = await buildPdf(rows, {
      title,
      subtitle: subtitleFor(stats),
      groupByArea,
    });
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, pdf);
    if (warnings.length) {
      console.warn(`WARNING: ${warnings.length} field issue(s) in ${basename(file)}:`);
      warnings.forEach((w) => console.warn(`  - ${w}`));
    }
    console.log(
      `${rows.length} entries (${stats.cash} cash, ${stats.online} online, ${stats.areas.length} areas) -> ${out}`,
    );
  } catch (err) {
    console.error(`Failed to convert ${file}: ${(err as Error).message}`);
    process.exitCode = 1;
  }
}
