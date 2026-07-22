// §6.2 metric catalog — Phase 1 subset. Each is a pure (db, snapshotId, filters) -> MetricResult.
// Dashboard AND bot read from these. No query logic lives anywhere else.

import type { PrismaClient } from "@prisma/client";
import { FUNNEL_ORDER } from "../ingest/funnelStage";
import { buildWhere, meta, dnum, type Filters, type MetricResult } from "./types";
import { formatINR, formatINRFull, formatPct } from "./format";

/** stuck = funnel_stage != ISSUED AND logged_premium > 0 (§2.2).
 *  AND-merged (not spread) so user filters like minLoggedPremium / funnelStage aren't clobbered. */
function stuckWhere(snapshotId: string, filters: Filters) {
  return { AND: [buildWhere(snapshotId, filters), { funnelStage: { not: "ISSUED" }, loggedPremium: { gt: 0 } }] };
}

/** Normalize inconsistent lead_status_raw for grouping (§6.2 stuck_summary). */
export function normalizeLeadStatus(raw: string | null | undefined): string {
  if (!raw || !raw.trim()) return "Unspecified";
  return raw
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .split(" ")
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

// ── totals ───────────────────────────────────────────────────────────────────
export type TotalsData = {
  logged_premium: number;
  issued_premium: number;
  case_count: number;
  issued_count: number;
  conversion_pct: number;
  avg_ticket: number;
  display: { logged: string; issued: string; avg_ticket: string };
};

export async function totals(db: PrismaClient, snapshotId: string, filters: Filters): Promise<MetricResult<TotalsData>> {
  const where = buildWhere(snapshotId, filters);
  const agg = await db.nbCase.aggregate({ where, _count: { _all: true }, _sum: { loggedPremium: true, issuedPremium: true } });
  const issuedCount = await db.nbCase.count({ where: { ...where, funnelStage: "ISSUED" } });
  const caseCount = agg._count._all;
  const logged = dnum(agg._sum.loggedPremium);
  const issued = dnum(agg._sum.issuedPremium);
  const avgTicket = caseCount ? logged / caseCount : 0;
  return {
    id: "totals",
    data: {
      logged_premium: logged,
      issued_premium: issued,
      case_count: caseCount,
      issued_count: issuedCount,
      conversion_pct: formatPct(issuedCount, caseCount),
      avg_ticket: avgTicket,
      display: { logged: formatINR(logged), issued: formatINR(issued), avg_ticket: formatINR(avgTicket) },
    },
    meta: meta(snapshotId, filters, caseCount),
  };
}

// ── premium_by_branch ──────────────────────────────────────────────────────────
export type BranchRow = {
  branch: string;
  cases: number;
  logged: number;
  issued: number;
  issued_count: number;
  conversion_pct: number;
  display: { logged: string; issued: string };
};

export async function premiumByBranch(db: PrismaClient, snapshotId: string, filters: Filters): Promise<MetricResult<BranchRow[]>> {
  const where = buildWhere(snapshotId, filters);
  const grouped = await db.nbCase.groupBy({ by: ["loginBranch"], where, _count: { _all: true }, _sum: { loggedPremium: true, issuedPremium: true } });
  const issuedByBranch = await db.nbCase.groupBy({ by: ["loginBranch"], where: { ...where, funnelStage: "ISSUED" }, _count: { _all: true } });
  const issuedMap = new Map(issuedByBranch.map((r) => [r.loginBranch, r._count._all]));

  const rows: BranchRow[] = grouped
    .map((r) => {
      const logged = dnum(r._sum.loggedPremium);
      const issued = dnum(r._sum.issuedPremium);
      const issuedCount = issuedMap.get(r.loginBranch) ?? 0;
      return {
        branch: r.loginBranch,
        cases: r._count._all,
        logged,
        issued,
        issued_count: issuedCount,
        conversion_pct: formatPct(issuedCount, r._count._all),
        display: { logged: formatINR(logged), issued: formatINR(issued) },
      };
    })
    .sort((a, b) => b.logged - a.logged);

  const total = rows.reduce((s, r) => s + r.cases, 0);
  return { id: "premium_by_branch", data: rows, meta: meta(snapshotId, filters, total) };
}

// ── funnel ─────────────────────────────────────────────────────────────────────
export type FunnelRow = { stage: string; cases: number; logged: number; display: { logged: string } };

export async function funnel(db: PrismaClient, snapshotId: string, filters: Filters): Promise<MetricResult<FunnelRow[]>> {
  const where = buildWhere(snapshotId, filters);
  const grouped = await db.nbCase.groupBy({ by: ["funnelStage"], where, _count: { _all: true }, _sum: { loggedPremium: true } });
  const map = new Map(grouped.map((r) => [r.funnelStage, r]));
  const rows: FunnelRow[] = FUNNEL_ORDER.filter((s) => map.has(s)).map((s) => {
    const r = map.get(s)!;
    const logged = dnum(r._sum.loggedPremium);
    return { stage: s, cases: r._count._all, logged, display: { logged: formatINR(logged) } };
  });
  const total = rows.reduce((s, r) => s + r.cases, 0);
  return { id: "funnel", data: rows, meta: meta(snapshotId, filters, total) };
}

// ── stuck_summary ────────────────────────────────────────────────────────────────
export type StuckSummaryRow = { leadStatus: string; count: number; premium: number; display: { premium: string } };

export async function stuckSummary(db: PrismaClient, snapshotId: string, filters: Filters): Promise<MetricResult<StuckSummaryRow[]>> {
  const rows = await db.nbCase.findMany({ where: stuckWhere(snapshotId, filters), select: { leadStatusRaw: true, loggedPremium: true } });
  const agg = new Map<string, { count: number; premium: number }>();
  for (const r of rows) {
    const key = normalizeLeadStatus(r.leadStatusRaw);
    const cur = agg.get(key) ?? { count: 0, premium: 0 };
    cur.count += 1;
    cur.premium += dnum(r.loggedPremium);
    agg.set(key, cur);
  }
  const data: StuckSummaryRow[] = [...agg.entries()]
    .map(([leadStatus, v]) => ({ leadStatus, count: v.count, premium: v.premium, display: { premium: formatINR(v.premium) } }))
    .sort((a, b) => b.premium - a.premium);
  return { id: "stuck_summary", data, meta: meta(snapshotId, filters, rows.length) };
}

// ── stuck_cases ──────────────────────────────────────────────────────────────────
export type StuckCaseRow = {
  applicationNo: string;
  customerName: string;
  branch: string;
  agentName: string;
  funnelStage: string;
  leadStatus: string;
  loggedPremium: number;
  statusAgeing: number | null;
  display: { logged: string; loggedFull: string };
};

export async function stuckCases(db: PrismaClient, snapshotId: string, filters: Filters): Promise<MetricResult<StuckCaseRow[]>> {
  const rows = await db.nbCase.findMany({
    where: stuckWhere(snapshotId, filters),
    orderBy: { loggedPremium: "desc" },
    select: {
      applicationNo: true, customerName: true, loginBranch: true, agentName: true,
      funnelStage: true, leadStatusRaw: true, loggedPremium: true, statusAgeing: true,
    },
  });
  const data: StuckCaseRow[] = rows.map((r) => {
    const logged = dnum(r.loggedPremium);
    return {
      applicationNo: r.applicationNo,
      customerName: r.customerName,
      branch: r.loginBranch,
      agentName: r.agentName,
      funnelStage: r.funnelStage,
      leadStatus: normalizeLeadStatus(r.leadStatusRaw),
      loggedPremium: logged,
      statusAgeing: r.statusAgeing,
      display: { logged: formatINR(logged), loggedFull: formatINRFull(logged) },
    };
  });
  return { id: "stuck_cases", data, meta: meta(snapshotId, filters, data.length) };
}

// ── agent_leaderboard ────────────────────────────────────────────────────────────
export type AgentRow = {
  agentName: string;
  cases: number;
  logged: number;
  issued: number;
  conversion_pct: number;
  stuck_count: number;
  unassigned: boolean;
  display: { logged: string; issued: string };
};

export async function agentLeaderboard(db: PrismaClient, snapshotId: string, filters: Filters): Promise<MetricResult<AgentRow[]>> {
  const where = buildWhere(snapshotId, filters);
  const grouped = await db.nbCase.groupBy({ by: ["agentName"], where, _count: { _all: true }, _sum: { loggedPremium: true, issuedPremium: true } });
  const issued = await db.nbCase.groupBy({ by: ["agentName"], where: { ...where, funnelStage: "ISSUED" }, _count: { _all: true } });
  const stuck = await db.nbCase.groupBy({ by: ["agentName"], where: { ...where, funnelStage: { not: "ISSUED" }, loggedPremium: { gt: 0 } }, _count: { _all: true } });
  const issuedMap = new Map(issued.map((r) => [r.agentName, r._count._all]));
  const stuckMap = new Map(stuck.map((r) => [r.agentName, r._count._all]));

  const rows: AgentRow[] = grouped
    .map((r) => {
      const logged = dnum(r._sum.loggedPremium);
      const iss = dnum(r._sum.issuedPremium);
      const issuedCount = issuedMap.get(r.agentName) ?? 0;
      return {
        agentName: r.agentName,
        cases: r._count._all,
        logged,
        issued: iss,
        conversion_pct: formatPct(issuedCount, r._count._all),
        stuck_count: stuckMap.get(r.agentName) ?? 0,
        unassigned: r.agentName === "UNASSIGNED",
        display: { logged: formatINR(logged), issued: formatINR(iss) },
      };
    })
    // Rank by logged desc, but UNASSIGNED always sinks to the bottom (edge 5).
    .sort((a, b) => (a.unassigned === b.unassigned ? b.logged - a.logged : a.unassigned ? 1 : -1));

  const total = rows.reduce((s, r) => s + r.cases, 0);
  return { id: "agent_leaderboard", data: rows, meta: meta(snapshotId, filters, total) };
}
