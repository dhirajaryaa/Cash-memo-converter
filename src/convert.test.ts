import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { buildPdf } from "./core/pdf.js";
import { buildDeliveryList, csvFor, subtitleFor, UNASSIGNED_AREA } from "./core/rows.js";
import type { SortMode } from "./core/types.js";
import { extractMemos } from "./node/extract.js";

const root = join(import.meta.dirname, "..");
const fixtureDir = join(root, "test");
const fixtureFiles = existsSync(fixtureDir)
  ? readdirSync(fixtureDir)
      .filter((f) => /^Cash Memo Bulk .*\.pdf$/i.test(f))
      .sort()
  : [];
assert.ok(
  fixtureFiles.length === 0 || fixtureFiles.length === 3,
  "either no fixtures, or the three cash-memo fixtures are expected",
);
if (fixtureFiles.length === 0) {
  console.log("no fixtures in test/ - skipping memo regression checks (see test/README.md)");
}

const expectedCounts: Record<string, number> = {
  "Cash Memo Bulk - 2026-11-08T070641.046.PDF": 32,
  "Cash Memo Bulk - 2026-11-14T065105.595.PDF": 37,
  "Cash Memo Bulk - 2026-11-17T155226.602.PDF": 66,
};

async function pdfText(bytes: Uint8Array): Promise<{ pages: number; text: string }> {
  const task = getDocument({ data: bytes, useSystemFonts: true, verbosity: 0 });
  const pdf = await task.promise;
  const chunks: string[] = [];
  try {
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      chunks.push((tc.items as any[]).map((i) => i.str ?? "").join(" "));
    }
  } finally {
    await task.destroy();
  }
  return { pages: pdf.numPages, text: chunks.join(" ").replace(/\s+/g, " ") };
}

for (const file of fixtureFiles) {
  const fixturePath = join(fixtureDir, file);
  const memos = await extractMemos(fixturePath);
  const expectedCount = expectedCounts[file];
  assert.equal(memos.length, expectedCount, `${file}: memo count`);

  // Exact regression snapshot for every extracted field and printed row.
  const snapshotPath = join(
    fixtureDir,
    "expected",
    `${basename(file).replace(/\.pdf$/i, "")}.json`,
  );
  assert.ok(existsSync(snapshotPath), `${file}: missing snapshot, run npm run snapshots`);
  const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
  assert.equal(snapshot.memoCount, expectedCount);
  const exact = buildDeliveryList(memos, { sort: "memo", parts: 3 });
  assert.deepEqual(exact.rows, snapshot.rows, `${file}: exact row output`);
  assert.deepEqual(exact.stats, snapshot.stats, `${file}: exact stats`);

  // Every parameter combination the CLI and web app expose.
  for (const sort of ["memo", "area", "name"] as SortMode[]) {
    for (let parts = 1; parts <= 3; parts++) {
      const { rows, stats } = buildDeliveryList(memos, { sort, parts });
      assert.equal(rows.length, expectedCount, `${file}: ${sort}/${parts} row count`);
      assert.equal(stats.total, expectedCount);
      assert.equal(stats.cash + stats.online, expectedCount);
      assert.equal(stats.areas.reduce((n, a) => n + a.count, 0), expectedCount);

      for (const [i, row] of rows.entries()) {
        assert.ok(row.name.length > 0, `${file}: row ${i + 1} name`);
        assert.match(row.mobile, /^\d{10}$/, `${file}: row ${i + 1} mobile`);
        assert.match(row.bookingDate, /^\d\d-\d\d-\d{4}$/, `${file}: row ${i + 1} date`);
        assert.ok(row.invoiceNo.length > 0, `${file}: row ${i + 1} invoice`);
        assert.ok(row.payment === "Cash" || row.payment === "Online");
        assert.ok(row.area.length > 0);
        assert.ok(row.address.split(", ").length <= parts, `${file}: row ${i + 1} address parts <= ${parts}`);
      }

      if (sort === "area") {
        const keys = rows.map((r) => (r.area === UNASSIGNED_AREA ? "\uffff" : r.area));
        assert.deepEqual(keys, [...keys].sort((a, b) => a.localeCompare(b, "en")), `${file}: area order`);
      }
      if (sort === "name") {
        const names = rows.map((r) => r.name);
        assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, "en")), `${file}: name order`);
      }
    }
  }

  // Known hard cases from the real memos.
  if (file.includes("2026-11-14")) {
    const pmuy = memos.find((m) => m.name.includes("KUNTI DEVI"));
    assert.ok(pmuy, "KUNTI DEVI memo exists");
    assert.equal(pmuy.area, "Sipara", "Domestic[PMUY]/ Sipara is parsed as Sipara");
  }
  if (file.includes("2026-11-17")) {
    const blankArea = memos.find((m) => m.name.includes("Shyam Devi"));
    assert.ok(blankArea, "Shyam Devi memo exists");
    assert.equal(blankArea.area, "", "blank Category/Area stays blank in the raw memo");
    const blankRow = buildDeliveryList([blankArea], { parts: 3 }).rows[0];
    assert.equal(blankRow.area, UNASSIGNED_AREA, "blank area falls back to Unassigned");
  }

  // Render and read back the real PDF, including every mobile number and invoice.
  const rowsForPdf = buildDeliveryList(memos, { sort: "area", parts: 3 });
  const bytes = await buildPdf(rowsForPdf.rows, {
    title: "DIVYASHRI KD INDANE - Delivery List",
    subtitle: subtitleFor(rowsForPdf.stats, new Date(2026, 10, 18)),
    groupByArea: true,
  });
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
  const { pages, text } = await pdfText(bytes);
  assert.ok(pages >= 1, `${file}: PDF has pages`);
  for (const label of ["Sr.", "Name", "Address", "Mobile", "Payment", "DAC", "Booking", "Date", "Page 1"]) {
    assert.ok(text.includes(label), `${file}: PDF contains "${label}"`);
  }
  for (const row of rowsForPdf.rows) {
    assert.ok(text.includes(row.mobile), `${file}: PDF contains mobile ${row.mobile}`);
    assert.ok(text.includes(row.name), `${file}: PDF contains name ${row.name}`);
  }
  for (const group of rowsForPdf.stats.areas) {
    assert.ok(text.includes(group.area.toUpperCase()), `${file}: PDF contains area band ${group.area}`);
  }

  console.log(
    `${basename(file)}: ${memos.length} memos, all options pass, ${pages}-page PDF verified`,
  );
}

// Empty input still produces a valid one-page PDF.
const empty = await buildPdf([], { title: "Delivery List", subtitle: "Empty" });
const emptyText = await pdfText(empty);
assert.equal(emptyText.pages, 1);
assert.ok(emptyText.text.includes("No entries"));

const csv = csvFor([
  {
    name: 'Ram "Raju" Kumar',
    address: "Dariyapur, Patna",
    area: "Dariyapur",
    mobile: "9000000000",
    payment: "Cash",
    bookingDate: "01-01-2026",
    invoiceNo: "5-1",
  },
]);
assert.ok(csv.startsWith('"Sr.","Name","Address"'));
assert.ok(csv.includes('"Ram ""Raju"" Kumar"'));

console.log("all conversion tests ok");
