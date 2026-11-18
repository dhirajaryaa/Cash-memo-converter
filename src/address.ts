// Pure string logic: no I/O, no AI. Rules are plain regexes so they are easy to tweak.

// Relative markers: S/o, W/O, D/o, C/o, H/o, C/ ... (slash is mandatory so "Colony" never matches)
const REL = /^\s*([SWDCHBF]\/O?|SON OF\b|WIFE OF\b|DAUGHTER OF\b)/i;
const ACRONYMS = new Set(["IOC", "IOCL", "SCB", "RK", "NH"]);
const NOISE = /^(patna|bihar|na|nill|nil|n\/a|pa|\.|kyc\b.*|[a-z])$/i;

export function titleCasePart(p: string): string {
  // Fix ALL-CAPS words (and all-lower parts); words typed in normal mixed case are left alone.
  const allLower = p === p.toLowerCase();
  return p
    .split(" ")
    .map((w) => {
      if (ACRONYMS.has(w.toUpperCase())) return w.toUpperCase();
      if (/^\d+(st|nd|rd|th)$/i.test(w)) return w.toLowerCase();
      if (/\d/.test(w)) return w === w.toLowerCase() && !/^\d/.test(w) ? w : w.toUpperCase();
      if (w.length > 1 && (w === w.toUpperCase() || allLower)) return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      return w;
    })
    .join(" ");
}

export function cleanName(raw: string): string {
  const n = raw.replace(/\s+A$/, "").replace(/[\s.]+$/, "").trim();
  return titleCasePart(n);
}

/** lines = address lines exactly as printed in the memo (between "Address :" and "Landmark"). */
export function shortenAddress(lines: string[], maxParts = 3): string {
  const parts: string[] = [];
  for (const line of lines) {
    if (/^(patna,\s*patna|bihar)/i.test(line.trim())) continue;
    for (let p of line.split(",")) {
      p = p.trim().replace(/^[\s.\-]+|[\s.\-]+$/g, "");
      if (!p || REL.test(p) || /^(PS|P\.S)[-\s.]/i.test(p)) continue;
      p = p.replace(/^(MO|PO)-\s*/i, "");
      p = p.replace(/\s+Patna\.?$/i, "");
      p = p.replace(/\b\d{6}\b/g, "");
      p = p.replace(/^(Na|Nill|Nil|Patna)\s+/i, "");
      p = p.replace(/\s+Ps-.*$/i, "");
      p = p.replace(/\s{2,}/g, " ").replace(/^[\s.\-]+|[\s.\-]+$/g, "");
      if (!p || NOISE.test(p)) continue;
      parts.push(titleCasePart(p));
    }
  }
  // drop exact duplicates, then parts fully contained in another part ("70' road" in "70' Road Dashratha")
  const uniq = parts.filter((p, i) => parts.findIndex((q) => q.toLowerCase() === p.toLowerCase()) === i);
  const fin = uniq.filter(
    (p) => !uniq.some((q) => q !== p && q.toLowerCase().includes(p.toLowerCase()))
  );
  return fin.slice(0, maxParts).join(", ");
}
