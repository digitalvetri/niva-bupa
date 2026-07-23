"use client";
import * as React from "react";
import { useDashboard } from "@/components/dashboard/provider";
import type { TotalsData, TrendPoint, FunnelRow, BranchRow, AgentRow, GroupRow } from "@/lib/metrics/metrics";

export type PosterData = {
  scopeLabel: string; // "Territory" or the branch name
  branch: string | null;
  period: { start: string | null; end: string | null };
  totals: TotalsData;
  daily: TrendPoint[];
  funnel: FunnelRow[];
  branches: BranchRow[]; // for territory
  agents: AgentRow[];
  products: GroupRow[];
  target: number | null; // business target ₹ for this scope (from settings)
};

async function metric<T>(name: string, snapshotId: string, branch: string | null): Promise<T> {
  const params = new URLSearchParams({ snapshotId });
  if (branch) params.set("filters", JSON.stringify({ branch: [branch] }));
  const r = await fetch(`/api/metrics/${name}?${params.toString()}`, { cache: "no-store" });
  return (await r.json()).data as T;
}

/** Fetch everything a poster needs for the given scope (branch=null => territory). */
export function usePosterData(branch: string | null): { data: PosterData | null; loading: boolean; error: string | null } {
  const { snapshotId, snapshots } = useDashboard();
  const [data, setData] = React.useState<PosterData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!snapshotId) { setData(null); return; }
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      const [totals, daily, funnel, branches, agents, products, settings] = await Promise.all([
        metric<TotalsData>("totals", snapshotId, branch),
        metric<TrendPoint[]>("daily_trend", snapshotId, branch),
        metric<FunnelRow[]>("funnel", snapshotId, branch),
        metric<BranchRow[]>("premium_by_branch", snapshotId, null),
        metric<AgentRow[]>("agent_leaderboard", snapshotId, branch),
        metric<GroupRow[]>("premium_by_product", snapshotId, branch),
        fetch("/api/settings", { cache: "no-store" }).then((r) => r.json()),
      ]);
      const snap = snapshots.find((s) => s.id === snapshotId);
      const targets: Record<string, number> = settings?.branchTargets ?? {};
      const target = branch ? (targets[branch] ?? null) : (Object.keys(targets).length ? Object.values(targets).reduce((a, b) => a + (b as number), 0) : null);
      if (!alive) return;
      setData({
        scopeLabel: branch ?? "Territory",
        branch,
        period: { start: snap?.periodStart ?? null, end: snap?.periodEnd ?? null },
        totals, daily, funnel, branches, agents: agents.slice(0, 6), products: products.slice(0, 6), target,
      });
    })().catch((e) => alive && setError((e as Error).message)).finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotId, branch]);

  return { data, loading, error };
}
