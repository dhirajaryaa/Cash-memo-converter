import { cleanName, shortenAddress } from "./address.js";
import type { ConvertOptions, ConvertResult, ConvertStats, DeliveryRow, RawMemo } from "./types.js";

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export const UNASSIGNED_AREA = "Unassigned";

function warningsFor(m: RawMemo): string[] {
  const w: string[] = [];
  const who = m.name ? cleanName(m.name) : "(no name)";
  if (!m.name) w.push(`${who}: no customer name`);
  if (!/^\d{10}$/.test(m.mobile)) w.push(`${who}: no valid 10-digit mobile`);
  if (!/^\d\d-\d\d-\d{4}$/.test(m.bookingDate)) w.push(`${who}: no booking date`);
  if (!Number.isFinite(m.netPayable)) w.push(`${who}: no net payable amount`);
  if (!m.area) w.push(`${who}: category/area is blank in the memo`);
  return w;
}

function sortRows(rows: DeliveryRow[], mode: ConvertOptions["sort"]): DeliveryRow[] {
  if (mode === "area") {
    return rows.sort(
      (a, b) =>
        (a.area === UNASSIGNED_AREA ? 1 : 0) - (b.area === UNASSIGNED_AREA ? 1 : 0) ||
        collator.compare(a.area, b.area) ||
        collator.compare(a.name, b.name),
    );
  }
  if (mode === "name") return rows.sort((a, b) => collator.compare(a.name, b.name));
  return rows;
}

export function buildDeliveryList(memos: RawMemo[], options: ConvertOptions = {}): ConvertResult {
  const parts = Math.min(5, Math.max(1, Math.round(options.parts ?? 3)));
  const rows: DeliveryRow[] = memos.map((m) => ({
    name: cleanName(m.name),
    address: shortenAddress(m.addressLines, parts),
    area: m.area || UNASSIGNED_AREA,
    mobile: m.mobile,
    payment: m.netPayable === 0 ? "Online" : "Cash",
    bookingDate: m.bookingDate,
    invoiceNo: m.invoiceNo,
  }));

  sortRows(rows, options.sort ?? "memo");

  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.area, (counts.get(r.area) ?? 0) + 1);
  const areas = [...counts]
    .map(([area, count]) => ({ area, count }))
    .sort(
      (a, b) =>
        (a.area === UNASSIGNED_AREA ? 1 : 0) - (b.area === UNASSIGNED_AREA ? 1 : 0) ||
        collator.compare(a.area, b.area),
    );

  const online = rows.filter((r) => r.payment === "Online").length;
  const warnings = memos.flatMap(warningsFor);
  const stats: ConvertStats = {
    total: rows.length,
    cash: rows.length - online,
    online,
    areas,
    missingFields: warnings.length,
  };

  return { rows, stats, warnings };
}

export function subtitleFor(stats: ConvertStats, date = new Date()): string {
  const d = date.toLocaleDateString("en-GB").replace(/\//g, "-");
  return `Date: ${d}   |   Total: ${stats.total}   |   Cash: ${stats.cash}   |   Online: ${stats.online}`;
}

export function csvFor(rows: DeliveryRow[]): string {
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const head = ["Sr.", "Name", "Address", "Mobile", "Area", "Payment", "Booking Date", "Invoice No"];
  const body = rows.map((r, i) =>
    [String(i + 1), r.name, r.address, r.mobile, r.area, r.payment, r.bookingDate, r.invoiceNo].map(esc).join(","),
  );
  return [head.map(esc).join(","), ...body].join("\r\n");
}
