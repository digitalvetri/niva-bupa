// Branch grouping — roll up New Business login-branches into the ROTN target branches so a branch
// with no target of its own (e.g. Trichy, Chennai) is counted under its parent (Thanjavur, Hosur)
// and measured against that parent's GWP target.
import type { BranchRow } from "@/lib/metrics/metrics";

export const DEFAULT_BRANCH_GROUPS: Record<string, string> = {
  Trichy: "Thanjavur",
  Chennai: "Hosur",
};

export function canonicalBranch(branch: string, groups: Record<string, string>): string {
  return groups[branch] ?? branch;
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

export type ConsolidatedBranch = {
  branch: string;
  members: string[]; // the raw login-branches folded into this row
  cases: number;
  logged: number;
  issued: number;
  issued_count: number;
  conversion_pct: number;
  target: number | null; // ₹ target (from GWP-derived branch targets)
  achievement_pct: number | null; // issued vs target
};

export function consolidateBranches(rows: BranchRow[], groups: Record<string, string>, branchTargets: Record<string, number>): ConsolidatedBranch[] {
  const map = new Map<string, ConsolidatedBranch>();
  for (const r of rows) {
    const canon = canonicalBranch(r.branch, groups);
    const e = map.get(canon) ?? { branch: canon, members: [], cases: 0, logged: 0, issued: 0, issued_count: 0, conversion_pct: 0, target: null, achievement_pct: null };
    e.cases += r.cases;
    e.logged += r.logged;
    e.issued += r.issued;
    e.issued_count += r.issued_count;
    e.members.push(r.branch);
    map.set(canon, e);
  }
  return [...map.values()]
    .map((e) => {
      const target = branchTargets[e.branch] ?? null;
      return { ...e, conversion_pct: pct(e.issued_count, e.cases), target, achievement_pct: target && target > 0 ? pct(e.issued, target) : null };
    })
    .sort((a, b) => b.logged - a.logged);
}
