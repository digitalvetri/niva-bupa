// Structural guard: every number the narrator emits must appear in the tool results.
// The narrator is *instructed* not to invent numbers (§7.1); this catches drift if it does.

// Match rupee/percent/lakh-crore/plain number tokens.
const NUMBER_TOKEN = /₹?\s?\d[\d,]*(?:\.\d+)?\s?(?:cr|l)?%?/gi;

/** Reduce a number token to a comparable canonical core: strip ₹ , % and a trailing L/Cr. */
export function canonicalizeNumber(token: string): string | null {
  let t = token.toLowerCase().replace(/₹|\s|,|%/g, "");
  t = t.replace(/(cr|l)$/i, ""); // "31.77l" -> "31.77", "1.2cr" -> "1.2"
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  // Normalize away trailing zeros so "62.50" == "62.5".
  return String(n);
}

function coresFrom(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(NUMBER_TOKEN)) {
    const c = canonicalizeNumber(m[0]);
    if (c !== null) out.push(c);
  }
  return out;
}

/** All canonical numeric cores present in any JSON-serializable value. */
export function numericCores(value: unknown): Set<string> {
  return new Set(coresFrom(JSON.stringify(value)));
}

/** True when `n` (raw number or a formatted token) appears in the given results. */
export function resultsContain(results: unknown, n: number | string): boolean {
  const core = canonicalizeNumber(String(n));
  return core !== null && numericCores(results).has(core);
}

export type DriftResult = { ok: boolean; offending: string[] };

/**
 * Verify the narration's numbers are all present in the tool results.
 * `toolResults` is any JSON-serializable structure (the executed MetricResults).
 * Single-digit integers (0–9) are always allowed (ordinals, "one follow-up", "top 5").
 */
export function checkNumericDrift(narration: string, toolResults: unknown): DriftResult {
  const allowed = new Set(coresFrom(JSON.stringify(toolResults)));
  const offending: string[] = [];
  for (const m of narration.matchAll(NUMBER_TOKEN)) {
    const core = canonicalizeNumber(m[0]);
    if (core === null) continue;
    if (allowed.has(core)) continue;
    // Trivial single-digit integers are safe (not data-bearing claims).
    if (/^\d$/.test(core)) continue;
    offending.push(m[0].trim());
  }
  return { ok: offending.length === 0, offending };
}
