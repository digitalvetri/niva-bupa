// Machine-readable metric catalog (§5 /metrics/catalog). Phase 3 bot reads this to build tools.
import type { MetricFn } from "./types.js";
import { totals, premiumByBranch, funnel, stuckSummary, stuckCases, agentLeaderboard } from "./metrics.js";

export type CatalogEntry = {
  id: string;
  description: string;
  outputShape: "scalar" | "table" | "rows";
  fn: MetricFn;
};

export const CATALOG: Record<string, CatalogEntry> = {
  totals: { id: "totals", description: "Logged/issued premium, case & issued counts, conversion %, avg ticket", outputShape: "scalar", fn: totals as MetricFn },
  premium_by_branch: { id: "premium_by_branch", description: "Cases, logged, issued, conversion% per login branch, ranked", outputShape: "table", fn: premiumByBranch as MetricFn },
  funnel: { id: "funnel", description: "Cases + logged premium per FunnelStage, ordered", outputShape: "table", fn: funnel as MetricFn },
  stuck_summary: { id: "stuck_summary", description: "Count + premium of stuck cases grouped by normalized lead status", outputShape: "table", fn: stuckSummary as MetricFn },
  stuck_cases: { id: "stuck_cases", description: "Row-level stuck cases sorted by logged premium desc", outputShape: "rows", fn: stuckCases as MetricFn },
  agent_leaderboard: { id: "agent_leaderboard", description: "Per agent: cases, logged, issued, conversion%, stuck count", outputShape: "table", fn: agentLeaderboard as MetricFn },
};

export function getMetric(name: string): CatalogEntry | undefined {
  return CATALOG[name];
}

export function catalogManifest() {
  return Object.values(CATALOG).map(({ id, description, outputShape }) => ({ id, description, outputShape }));
}
