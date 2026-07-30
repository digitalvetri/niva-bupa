"use client";
import * as React from "react";
import { Target } from "lucide-react";
import { useDashboard } from "./provider";
import { useMetric } from "./use-metric";
import { formatINR, formatPct } from "@/lib/metrics/format";
import type { TotalsData } from "@/lib/metrics/metrics";

// Territory achievement bar — issued premium vs the sum of configured branch targets.
// Renders only when at least one branch target is set (Settings → Branch targets).
export function TargetProgress() {
  const { snapshotId, filters } = useDashboard();
  const totals = useMetric<TotalsData>("totals");
  const [target, setTarget] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((s) => {
        if (!alive) return;
        const t = (s?.branchTargets ?? {}) as Record<string, number>;
        // If a single branch is filtered, use that branch's target; else the territory sum.
        const branch = filters.branch?.length === 1 ? filters.branch[0] : null;
        const total = branch ? Number(t[branch] ?? 0) : Object.values(t).reduce((a, b) => a + (Number(b) || 0), 0);
        setTarget(total);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [filters]);

  if (!snapshotId || !totals.data || target <= 0) return null;
  const issued = totals.data.issued_premium;
  const pct = formatPct(issued, target);
  const clamped = Math.min(100, pct);
  const color = pct >= 70 ? "var(--won)" : pct >= 40 ? "var(--pending)" : "var(--action)";
  const remaining = Math.max(0, target - issued);

  return (
    <div className="mt-4 rounded-xl border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-fg">
          <Target className="h-4 w-4 text-primary" /> Territory Achievement
        </div>
        <div className="text-sm text-fg-muted">
          <span className="font-bold text-fg">{formatINR(issued)}</span> of {formatINR(target)}
        </div>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(2, clamped)}%`, background: color }} />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-xs">
        <span className="font-bold" style={{ color }}>{pct}% achieved</span>
        <span className="text-fg-subtle">{remaining > 0 ? `${formatINR(remaining)} to target` : "Target met 🎉"}</span>
      </div>
    </div>
  );
}
