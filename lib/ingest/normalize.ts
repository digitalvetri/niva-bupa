// §2.3 normalization primitives. Each is a small pure function, individually unit-tested.
// Order of application lives in parseRow.ts; these are the building blocks.

const NULL_TOKENS = new Set(["", "n/a", "na", "-"]);

/** Strip a UTF-8 BOM if present (real file is UTF-8 *with* BOM). */
export function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

/** Trim + treat "N/A" | "NA" | "" | "-" as null (case-insensitive). Rule §2.3(2). */
export function toNull(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  return NULL_TOKENS.has(t.toLowerCase()) ? null : t;
}

/** Collapse internal runs of whitespace to a single space. */
export function collapseSpaces(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Customer name: collapse double spaces, trim trailing " ." / stray dots. §2.1 */
export function normalizeName(raw: string | null | undefined): string {
  const v = toNull(raw);
  if (v == null) return "";
  return collapseSpaces(v).replace(/[\s.]+$/g, "").trim() || collapseSpaces(v);
}

/** Title Case for branch names ("ERODE" -> "Erode"). §2.3(3) */
export function titleCase(raw: string | null | undefined): string | null {
  const v = toNull(raw);
  if (v == null) return null;
  return v
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** State names uppercased ("Tamil Nadu"/"TAMIL NADU" -> "TAMIL NADU"). §2.3(3) */
export function upperState(raw: string | null | undefined): string | null {
  const v = toNull(raw);
  return v == null ? null : v.toUpperCase();
}

/** "Family Floater"/"Family floater" -> FAMILY_FLOATER; "Individual" -> INDIVIDUAL; else OTHER. */
export function normalizePlanType(raw: string | null | undefined): "FAMILY_FLOATER" | "INDIVIDUAL" | "OTHER" | null {
  const v = toNull(raw);
  if (v == null) return null;
  const l = v.toLowerCase();
  if (l.includes("family") && l.includes("floater")) return "FAMILY_FLOATER";
  if (l === "individual") return "INDIVIDUAL";
  return "OTHER";
}

/** "AGENCY"/"Agency" -> AGENCY (uppercased channel token). */
export function normalizeChannel(raw: string | null | undefined): string | null {
  const v = toNull(raw);
  return v == null ? null : v.toUpperCase();
}

/** Agent name; ".NONE." (any case) -> UNASSIGNED. Trailing " ." trimmed like other names. §2.1 / edge 5 */
export function normalizeAgentName(raw: string | null | undefined): string {
  const v = toNull(raw);
  if (v == null) return "UNASSIGNED";
  if (v.replace(/\./g, "").trim().toUpperCase() === "NONE") return "UNASSIGNED";
  const cleaned = normalizeName(v);
  return cleaned || "UNASSIGNED";
}

export type MoneyParse = { amount: string; ok: boolean };

/** Strip commas; non-numeric -> "0" + not ok (caller logs warn). Never rounds. §2.3(4) */
export function parseMoney(raw: string | null | undefined): MoneyParse {
  const v = (raw ?? "").trim();
  if (v === "") return { amount: "0", ok: true }; // blank money -> 0 (spec: blank -> 0), not a warn
  const cleaned = v.replace(/,/g, "").replace(/₹/g, "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return { amount: "0", ok: false };
  return { amount: cleaned, ok: true };
}

export type SumAssuredParse = { numeric: string | null; isUnlimited: boolean };

/** "Unlimited" -> numeric NULL + isUnlimited. Otherwise numeric string or null. §2.1 / edge 3 */
export function parseSumAssured(raw: string | null | undefined): SumAssuredParse {
  const v = toNull(raw);
  if (v == null) return { numeric: null, isUnlimited: false };
  if (v.toLowerCase() === "unlimited") return { numeric: null, isUnlimited: true };
  const m = parseMoney(v);
  return { numeric: m.ok ? m.amount : null, isUnlimited: false };
}

/** "1"/"3"/"5" or "Annual"/"3 Yearly"/"5 Yearly" -> 1/3/5. §2.1 */
export function parseTenure(raw: string | null | undefined): number | null {
  const v = toNull(raw);
  if (v == null) return null;
  const l = v.toLowerCase();
  if (l === "annual") return 1;
  const m = l.match(/(\d+)/);
  if (m) {
    const n = parseInt(m[1]!, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Yes/No (case-insensitive) -> bool. Anything else / null -> false. */
export function parseBool(raw: string | null | undefined): boolean {
  const v = toNull(raw);
  if (v == null) return false;
  return ["yes", "y", "true", "1"].includes(v.toLowerCase());
}

/** Integer or null (for ageing / insured lives). "N/A" -> null. */
export function parseIntOrNull(raw: string | null | undefined): number | null {
  const v = toNull(raw);
  if (v == null) return null;
  const n = parseInt(v.replace(/,/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

/** M/D/YYYY explicit parser (US style). Failures -> null. §2.3(5) */
export function parseUsDate(raw: string | null | undefined): Date | null {
  const v = toNull(raw);
  if (v == null) return null;
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+.*)?$/);
  if (!m) return null;
  const month = parseInt(m[1]!, 10);
  const day = parseInt(m[2]!, 10);
  const year = parseInt(m[3]!, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  // Reject overflow (e.g. 2/30 rolling into March).
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return d;
}

/** Rider cell: Y/Yes/true -> true; N/No/NO/false -> false; NA/N/A/blank -> null;
 *  anything else (amounts, free text) -> trimmed raw string. §2.1 riders block */
export function normalizeRider(raw: string | null | undefined): boolean | string | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (t === "") return null;
  const l = t.toLowerCase();
  if (["na", "n/a", "-"].includes(l)) return null;
  if (["y", "yes", "true"].includes(l)) return true;
  if (["n", "no", "false"].includes(l)) return false;
  return t;
}
