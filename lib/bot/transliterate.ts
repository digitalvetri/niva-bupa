// §7.2 Tamil/Tanglish handling: branch transliteration + deterministic filter normalization,
// so numbers never depend on the LLM spelling a branch the canonical way.
import type { Filters } from "../metrics/types";

// Canonical branches observed in the data.
const CANONICAL_BRANCHES = ["Salem", "Coimbatore", "Erode", "Tirunelveli", "Chennai", "Hosur", "Thanjavur", "Trichy"];

// Colloquial / Tamil transliteration → canonical (keys lowercased). §7.2.
const BRANCH_ALIASES: Record<string, string> = {
  kovai: "Coimbatore",
  koyamputhur: "Coimbatore",
  nellai: "Tirunelveli",
  selam: "Salem",
  salem: "Salem",
  tanjore: "Thanjavur",
  thanjavur: "Thanjavur",
  tanjavur: "Thanjavur",
  trichy: "Trichy",
  tiruchi: "Trichy",
  erode: "Erode",
  hosur: "Hosur",
  chennai: "Chennai",
};

/** Map any branch spelling (Tamil transliteration / casing) to its canonical form. */
export function canonicalBranch(raw: string): string {
  const key = raw.trim().toLowerCase();
  if (BRANCH_ALIASES[key]) return BRANCH_ALIASES[key];
  // Title-case fallback for anything unmapped.
  const titled = raw.trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  const exact = CANONICAL_BRANCHES.find((b) => b.toLowerCase() === titled.toLowerCase());
  return exact ?? titled;
}

/** Deterministically normalize router-provided filters before they hit the metric engine. */
export function normalizeFilters(filters: Filters | undefined | null): Filters {
  if (!filters) return {};
  const out: Filters = { ...filters };
  if (out.branch) out.branch = out.branch.map(canonicalBranch);
  if (out.customerState) out.customerState = out.customerState.map((s) => s.trim().toUpperCase());
  return out;
}

// Common Tanglish tokens → helps the narrator match the user's register (§7.3).
const TANGLISH_TOKENS = [
  "evlo", "enna", "irukku", "irruku", "pannanum", "panna", "yaaru", "yaru", "la", "ku",
  "mudinja", "aakala", "aagala", "epdi", "eppadi", "vera", "innaiku", "innaikku", "romba",
];

export type LanguageHint = "tamil" | "tanglish" | "english";

/** Crude language-register detector for the narrator's language hint (§7.1). */
export function detectLanguage(text: string): LanguageHint {
  if (/[஀-௿]/.test(text)) return "tamil"; // Tamil unicode block
  const words = text.toLowerCase().split(/\s+/);
  if (words.some((w) => TANGLISH_TOKENS.includes(w.replace(/[?.,!]/g, "")))) return "tanglish";
  return "english";
}
