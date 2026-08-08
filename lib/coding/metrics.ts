// Coding module metric engine — deterministic aggregates over CodingLead, mirroring the workbook's
// Dashboard / Leaderboard / Branch Dashboard / Daily Progress / Pivot sheets.
import type { PrismaClient, Prisma } from "@prisma/client";

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);
const normName = (s: string) => s.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();

/** Best-effort match of a lead's TH/branch name to a targets key (handles "K Arunkodi" vs "K. Arunkodi"). */
function matchTarget<T>(targets: Record<string, T>, name: string): T | null {
  if (targets[name] != null) return targets[name];
  const n = normName(name);
  for (const [k, v] of Object.entries(targets)) if (normName(k) === n) return v;
  for (const [k, v] of Object.entries(targets)) { const kn = normName(k); if (kn.startsWith(n) || n.startsWith(kn)) return v; }
  return null;
}

export type CodingTotals = {
  total: number; verified: number; identified: number; duplicate: number; invalid: number;
  pending: number; mission: number; achievement_pct: number; active_branches: number;
  today_collection: number; today_date: string | null; active_ths: number;
};

export async function codingTotals(db: PrismaClient, snapshotId: string, missionOverride?: number): Promise<CodingTotals> {
  const snap = await db.codingSnapshot.findUniqueOrThrow({ where: { id: snapshotId }, select: { missionTarget: true } });
  const grp = await db.codingLead.groupBy({ by: ["status"], where: { snapshotId }, _count: { _all: true } });
  const cnt = (s: string) => grp.find((g) => g.status === s)?._count._all ?? 0;
  const verified = cnt("VERIFIED"), identified = cnt("IDENTIFIED"), duplicate = cnt("DUPLICATE"), invalid = cnt("INVALID");
  const branches = await db.codingLead.findMany({ where: { snapshotId }, select: { branch: true }, distinct: ["branch"] });
  const ths = await db.codingLead.findMany({ where: { snapshotId }, select: { th: true }, distinct: ["th"] });
  const maxDate = (await db.codingLead.aggregate({ where: { snapshotId, date: { not: null } }, _max: { date: true } }))._max.date;
  const today = maxDate ? await db.codingLead.count({ where: { snapshotId, date: maxDate } }) : 0;
  const mission = missionOverride && missionOverride > 0 ? Math.round(missionOverride) : snap.missionTarget;
  return {
    total: verified + identified + duplicate + invalid, verified, identified, duplicate, invalid,
    pending: Math.max(0, mission - verified), mission, achievement_pct: pct(verified, mission),
    active_branches: branches.length, active_ths: ths.length, today_collection: today, today_date: maxDate ? maxDate.toISOString().slice(0, 10) : null,
  };
}

export type CodingRankRow = { name: string; bm?: string | null; th?: string | null; target: number | null; verified: number; identified: number; total: number; pending: number | null; achievement_pct: number | null; rank: number };

async function rankBy(db: PrismaClient, snapshotId: string, dim: "th" | "branch"): Promise<Map<string, { verified: number; identified: number; total: number }>> {
  const grp = await db.codingLead.groupBy({ by: [dim, "status"], where: { snapshotId }, _count: { _all: true } });
  const map = new Map<string, { verified: number; identified: number; total: number }>();
  for (const g of grp) {
    const key = (g as unknown as Record<string, string>)[dim] ?? "UNKNOWN";
    const e = map.get(key) ?? { verified: 0, identified: 0, total: 0 };
    const n = g._count._all;
    e.total += n;
    if (g.status === "VERIFIED") e.verified += n;
    if (g.status === "IDENTIFIED") e.identified += n;
    map.set(key, e);
  }
  return map;
}
function rankSort(rows: CodingRankRow[]): CodingRankRow[] {
  rows.sort((a, b) => b.verified - a.verified || b.total - a.total || a.name.localeCompare(b.name));
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

export async function codingLeaderboard(db: PrismaClient, snapshotId: string): Promise<CodingRankRow[]> {
  const snap = await db.codingSnapshot.findUniqueOrThrow({ where: { id: snapshotId }, select: { targets: true } });
  const byTh = ((snap.targets as { byTh?: Record<string, number> })?.byTh) ?? {};
  const map = await rankBy(db, snapshotId, "th");
  // include TH targets that have no leads yet
  for (const k of Object.keys(byTh)) if (![...map.keys()].some((m) => normName(m) === normName(k))) map.set(k, { verified: 0, identified: 0, total: 0 });
  const rows: CodingRankRow[] = [...map.entries()].map(([name, e]) => {
    const target = matchTarget(byTh, name);
    return { name, target, verified: e.verified, identified: e.identified, total: e.total, pending: target != null ? Math.max(0, target - e.verified) : null, achievement_pct: target ? pct(e.verified, target) : null, rank: 0 };
  });
  return rankSort(rows);
}

export async function codingBranchDashboard(db: PrismaClient, snapshotId: string, branchTargetOverride?: Record<string, number>): Promise<CodingRankRow[]> {
  const snap = await db.codingSnapshot.findUniqueOrThrow({ where: { id: snapshotId }, select: { targets: true } });
  const byBranch = ((snap.targets as { byBranch?: Record<string, { target: number; bm: string | null; th: string | null }> })?.byBranch) ?? {};
  const map = await rankBy(db, snapshotId, "branch");
  for (const k of Object.keys(byBranch)) if (![...map.keys()].some((m) => normName(m) === normName(k))) map.set(k, { verified: 0, identified: 0, total: 0 });
  const rows: CodingRankRow[] = [...map.entries()].map(([name, e]) => {
    const t = matchTarget(byBranch, name);
    const override = branchTargetOverride ? matchTarget(branchTargetOverride, name) : null;
    const target = override != null && override > 0 ? Math.round(override) : t?.target ?? null;
    return { name, bm: t?.bm ?? null, th: t?.th ?? null, target, verified: e.verified, identified: e.identified, total: e.total, pending: target != null ? Math.max(0, target - e.verified) : null, achievement_pct: target ? pct(e.verified, target) : null, rank: 0 };
  });
  return rankSort(rows);
}

export type CodingDailyRow = { date: string; added: number; verified: number; cumulative_verified: number; cumulative_total: number };
export async function codingDaily(db: PrismaClient, snapshotId: string): Promise<CodingDailyRow[]> {
  const rows = await db.codingLead.findMany({ where: { snapshotId, date: { not: null } }, select: { date: true, status: true }, orderBy: { date: "asc" } });
  const byDay = new Map<string, { added: number; verified: number }>();
  for (const r of rows) {
    const d = r.date!.toISOString().slice(0, 10);
    const e = byDay.get(d) ?? { added: 0, verified: 0 };
    e.added += 1;
    if (r.status === "VERIFIED") e.verified += 1;
    byDay.set(d, e);
  }
  let cumV = 0, cumT = 0;
  return [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, e]) => { cumV += e.verified; cumT += e.added; return { date, added: e.added, verified: e.verified, cumulative_verified: cumV, cumulative_total: cumT }; });
}

const PIVOT_DIMS = ["th", "branch", "competitor", "source", "experience"] as const;
export type PivotDim = (typeof PIVOT_DIMS)[number];
export type CodingPivotRow = { key: string; IDENTIFIED: number; VERIFIED: number; DUPLICATE: number; INVALID: number; total: number };
export async function codingPivot(db: PrismaClient, snapshotId: string, rowDim: string): Promise<{ dim: PivotDim; rows: CodingPivotRow[] }> {
  const dim: PivotDim = (PIVOT_DIMS as readonly string[]).includes(rowDim) ? (rowDim as PivotDim) : "th";
  const grp = await db.codingLead.groupBy({ by: [dim, "status"], where: { snapshotId }, _count: { _all: true } });
  const map = new Map<string, CodingPivotRow>();
  for (const g of grp) {
    const key = (g as unknown as Record<string, string | null>)[dim] ?? "—";
    const row = map.get(key) ?? { key, IDENTIFIED: 0, VERIFIED: 0, DUPLICATE: 0, INVALID: 0, total: 0 };
    const n = g._count._all;
    const rr = row as unknown as Record<string, number>;
    rr[g.status] = (rr[g.status] ?? 0) + n;
    row.total += n;
    map.set(key, row);
  }
  return { dim, rows: [...map.values()].sort((a, b) => b.total - a.total) };
}

export type GroupCount = { key: string; count: number };
export async function codingBreakdown(db: PrismaClient, snapshotId: string, field: "status" | "source" | "competitor" | "experience"): Promise<GroupCount[]> {
  const grp = await db.codingLead.groupBy({ by: [field], where: { snapshotId }, _count: { _all: true } });
  return grp.map((g) => ({ key: (g as unknown as Record<string, string | null>)[field] ?? "—", count: g._count._all })).sort((a, b) => b.count - a.count);
}

export type CodingLeadRow = {
  id: string; leadId: string; date: string | null; th: string; branch: string; bdm: string | null; agentName: string;
  mobile: string | null; competitor: string | null; city: string | null; experience: string | null; source: string | null; status: string; remarks: string | null; isDuplicate: boolean;
};
export type CodingLeadFilters = { th?: string; branch?: string; status?: string; competitor?: string; source?: string; q?: string };
export async function codingLeads(db: PrismaClient, snapshotId: string, filters: CodingLeadFilters = {}): Promise<CodingLeadRow[]> {
  const where: Prisma.CodingLeadWhereInput = { snapshotId };
  if (filters.th) where.th = filters.th;
  if (filters.branch) where.branch = filters.branch;
  if (filters.status) where.status = filters.status;
  if (filters.competitor) where.competitor = filters.competitor;
  if (filters.source) where.source = filters.source;
  if (filters.q) where.OR = [{ agentName: { contains: filters.q, mode: "insensitive" } }, { mobile: { contains: filters.q } }, { leadId: { contains: filters.q, mode: "insensitive" } }];
  const rows = await db.codingLead.findMany({ where, orderBy: [{ date: "desc" }, { leadId: "asc" }], take: 2000 });
  return rows.map((r) => ({ id: r.id, leadId: r.leadId, date: r.date ? r.date.toISOString().slice(0, 10) : null, th: r.th, branch: r.branch, bdm: r.bdm, agentName: r.agentName, mobile: r.mobile, competitor: r.competitor, city: r.city, experience: r.experience, source: r.source, status: r.status, remarks: r.remarks, isDuplicate: r.isDuplicate }));
}

export type CodingMasterLists = { ths: string[]; branches: { branch: string; bm: string | null; th: string | null; target: number | null }[]; competitors: string[]; sources: string[]; statuses: string[] };
export async function codingMasterLists(db: PrismaClient, snapshotId: string): Promise<CodingMasterLists> {
  const snap = await db.codingSnapshot.findUniqueOrThrow({ where: { id: snapshotId }, select: { targets: true } });
  const byTh = ((snap.targets as { byTh?: Record<string, number> })?.byTh) ?? {};
  const byBranch = ((snap.targets as { byBranch?: Record<string, { target: number; bm: string | null; th: string | null }> })?.byBranch) ?? {};
  const distinct = async (f: "th" | "competitor" | "source"): Promise<string[]> => (await db.codingLead.findMany({ where: { snapshotId }, select: { [f]: true } as never, distinct: [f] })).map((r) => (r as unknown as Record<string, string | null>)[f]).filter((x): x is string => Boolean(x));
  const ths = [...new Set([...Object.keys(byTh), ...(await distinct("th"))])].sort();
  const branchKeys = [...new Set([...Object.keys(byBranch), ...(await db.codingLead.findMany({ where: { snapshotId }, select: { branch: true }, distinct: ["branch"] })).map((r) => r.branch)])];
  const branches = branchKeys.map((branch) => ({ branch, bm: byBranch[branch]?.bm ?? null, th: byBranch[branch]?.th ?? null, target: byBranch[branch]?.target ?? null })).sort((a, b) => a.branch.localeCompare(b.branch));
  return { ths, branches, competitors: (await distinct("competitor")).sort(), sources: (await distinct("source")).sort(), statuses: ["IDENTIFIED", "VERIFIED", "DUPLICATE", "INVALID"] };
}
