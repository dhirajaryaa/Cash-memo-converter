// Pure string logic: no I/O, no AI, no network. Rules are regexes so they stay easy to tweak.

// Relative markers: S/o, W/O, D/o, C/o, H/o, G/o, M/o ... (the slash is mandatory so "Colony" never matches)
const REL = /^\s*(?:[SWDCHBFGM]\/O?|SON OF\b|WIFE OF\b|DAUGHTER OF\b|GRANDSON OF\b|MOTHER OF\b)/i;
const SALUTATION = /^(MR|MRS|MS|MISS|SHRI|SMT|SRI|DR)\.?\s+/i;
const ACRONYMS = new Set([
  "IOC", "IOCL", "SCB", "RK", "NH", "PO", "PS", "MO", "PMUY", "LPG", "GST", "HSN", "KYC", "DAC",
]);
const SMALL = new Set(["of", "and", "the", "at", "in", "on", "by", "to", "from", "for", "with"]);
const NOISE = /^(patna|bihar|na|nill|nil|n\/a|pa|\.|kyc\b.*|[a-z])$/i;

function capWord(w: string, index: number): string {
  if (ACRONYMS.has(w.toUpperCase())) return w.toUpperCase();
  if (/^\d/.test(w)) return w;
  if (w.length > 1 && (w === w.toUpperCase() || w === w.toLowerCase())) {
    if (index > 0 && SMALL.has(w.toLowerCase())) return w.toLowerCase();
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }
  return w;
}

/** Address-style title case: fixes ALL-CAPS or all-lower words, leaves mixed case alone. */
export function titleCasePart(p: string): string {
  return p.split(" ").map(capWord).join(" ");
}

/** Name-style title case: every word gets a capital, including a lowercase word after another word. */
export function titleCaseName(p: string): string {
  return p
    .split(" ")
    .map((w, i) => (w === w.toUpperCase() || w === w.toLowerCase() ? capWord(w, i) : w))
    .join(" ");
}

export function cleanName(raw: string): string {
  let n = raw.replace(/\s+A$/, "").replace(/[\s.]+$/, "").trim();
  n = n.replace(SALUTATION, "").replace(/\s{2,}/g, " ").trim();
  return titleCaseName(n);
}

function cleanPart(input: string): string {
  let p = input
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^[\s.\-]+|[\s.\-]+$/g, "")
    .replace(/^(PO|MO)\s*[-.:]\s*/i, "")
    .replace(/\s+Patna\.?$/i, "")
    .replace(/\b\d{6}\b/g, "")
    .replace(/^(Na|Nill|Nil|Patna)\s+/i, "")
    .replace(/\s+Ps-.*$/i, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s.\-]+|[\s.\-]+$/g, "");
  if (!p || NOISE.test(p)) return "";
  return titleCasePart(p);
}

/** lines = address lines exactly as printed in the memo (between "Address :" and "Landmark"). */
export function shortenAddress(lines: string[], maxParts = 3): string {
  const parts: string[] = [];
  for (const line of lines) {
    if (/^(patna,\s*patna|bihar)/i.test(line.trim())) continue;
    for (const raw of line.split(",")) {
      if (REL.test(raw)) continue;
      if (/^(PS|P\.S)[-\s.]/i.test(raw.trim())) continue;
      const p = cleanPart(raw);
      if (p) parts.push(p);
    }
  }
  // drop exact duplicates, then parts fully contained in another part ("70' road" in "70' Road Dashratha")
  const uniq = parts.filter((p, i) => parts.findIndex((q) => q.toLowerCase() === p.toLowerCase()) === i);
  const fin = uniq.filter((p) => !uniq.some((q) => q !== p && q.toLowerCase().includes(p.toLowerCase())));
  return fin.slice(0, Math.max(1, maxParts)).join(", ");
}
