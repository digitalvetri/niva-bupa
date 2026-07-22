// Machine-readable metric catalog (§5 /metrics/catalog). Phase 3 bot reads this to build tools.
import type { MetricFn } from "./types";
import {
  totals, premiumByBranch, funnel, stuckSummary, stuckCases, agentLeaderboard, dailyTrend,
  premiumByProduct, premiumByPlanType, amLeaderboard, portabilitySummary, discrepancyCases,
  ageingBuckets, highValueStuck, geoCustomer, tenureMix, ticketSizeDistribution,
} from "./metrics";

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
  daily_trend: { id: "daily_trend", description: "Logged & issued premium per loggedDate within snapshot", outputShape: "table", fn: dailyTrend as MetricFn },
  premium_by_product: { id: "premium_by_product", description: "Cases, logged, issued, conversion% per product genre, ranked", outputShape: "table", fn: premiumByProduct as MetricFn },
  premium_by_plan_type: { id: "premium_by_plan_type", description: "Family floater vs individual split", outputShape: "table", fn: premiumByPlanType as MetricFn },
  am_leaderboard: { id: "am_leaderboard", description: "Per agency manager: cases, logged, issued, conversion%", outputShape: "table", fn: amLeaderboard as MetricFn },
  portability_summary: { id: "portability_summary", description: "Portability vs fresh: count, premium, conversion%", outputShape: "table", fn: portabilitySummary as MetricFn },
  discrepancy_cases: { id: "discrepancy_cases", description: "Row-level cases with a discrepancy flag", outputShape: "rows", fn: discrepancyCases as MetricFn },
  ageing_buckets: { id: "ageing_buckets", description: "Pending cases by ageing days: 0-3, 4-7, 8-14, 15+", outputShape: "table", fn: ageingBuckets as MetricFn },
  high_value_stuck: { id: "high_value_stuck", description: "Stuck cases at or above the high-value threshold (default ₹50,000), sorted by premium", outputShape: "rows", fn: highValueStuck as MetricFn },
  geo_customer: { id: "geo_customer", description: "Cases + premium by customer state (out-of-state customers included)", outputShape: "table", fn: geoCustomer as MetricFn },
  tenure_mix: { id: "tenure_mix", description: "Cases + premium by tenure years (1/2/3/5)", outputShape: "table", fn: tenureMix as MetricFn },
  ticket_size_distribution: { id: "ticket_size_distribution", description: "Histogram of logged premium bands: <10K, 10-25K, 25-50K, 50K-1L, 1L+", outputShape: "table", fn: ticketSizeDistribution as MetricFn },
};

export function getMetric(name: string): CatalogEntry | undefined {
  return CATALOG[name];
}

export function catalogManifest() {
  return Object.values(CATALOG).map(({ id, description, outputShape }) => ({ id, description, outputShape }));
}
