import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { buildDeliveryList } from "./core/rows.js";
import { extractMemos } from "./node/extract.js";

const root = join(import.meta.dirname, "..");
const fixturesDir = join(root, "test");
const outDir = join(root, "test", "expected");
mkdirSync(outDir, { recursive: true });

const fixtures = readdirSync(fixturesDir).filter((f) => /\.pdf$/i.test(f)).sort();
for (const file of fixtures) {
  const memos = await extractMemos(join(fixturesDir, file));
  const result = buildDeliveryList(memos, { sort: "memo", parts: 3 });
  const name = basename(file).replace(/\.pdf$/i, "");
  const payload = {
    fixture: file,
    memoCount: memos.length,
    stats: result.stats,
    warnings: result.warnings,
    rows: result.rows,
  };
  writeFileSync(join(outDir, `${name}.json`), JSON.stringify(payload, null, 2) + "\n");
  console.log(`${memos.length} memos -> test/expected/${name}.json`);
}
