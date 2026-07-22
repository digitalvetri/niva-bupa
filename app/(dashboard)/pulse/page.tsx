"use client";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/primitives";
import { KpiCard, PageHeader } from "@/components/dashboard/kpi-card";
import { LoadingCards, LoadingBlock, ErrorState, EmptyState } from "@/components/dashboard/states";
import { useMetric } from "@/components/dashboard/use-metric";
import { useDashboard } from "@/components/dashboard/provider";
import { TrendChart } from "@/components/charts/trend-chart";
import { BarList } from "@/components/charts/bar-list";
import { STAGE_LABEL, heatFor, HEAT_COLOR } from "@/lib/theme";
import { formatINR } from "@/lib/metrics/format";
import type { TotalsData, FunnelRow, BranchRow, TrendPoint } from "@/lib/metrics/metrics";

export default function PulsePage() {
  const { snapshotId, loadingSnapshots } = useDashboard();
  const totals = useMetric<TotalsData>("totals");
  const funnel = useMetric<FunnelRow[]>("funnel");
  const branches = useMetric<BranchRow[]>("premium_by_branch");
  const trend = useMetric<TrendPoint[]>("daily_trend");

  if (!snapshotId && !loadingSnapshots)
    return (
      <>
        <PageHeader title="Pulse" />
        <EmptyState title="No snapshot yet" hint="Upload a New Business report from the Uploads screen to get started." />
      </>
    );

  return (
    <>
      <PageHeader title="Pulse" subtitle="Territory-wide new business at a glance" />

      {/* KPI row */}
      {totals.loading ? (
        <LoadingCards />
      ) : totals.error ? (
        <ErrorState message={totals.error} />
      ) : totals.data ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label="Logged Premium" value={totals.data.display.logged} sub={`${totals.data.case_count} cases`} accent="primary" />
          <KpiCard label="Issued Premium" value={totals.data.display.issued} sub={`${totals.data.issued_count} issued`} accent="won" />
          <KpiCard label="Conversion" value={`${totals.data.conversion_pct}%`} sub={`${totals.data.issued_count}/${totals.data.case_count}`} accent="neutral" />
          <KpiCard label="Stuck Premium" value={totals.data.display.stuck} sub={`${totals.data.stuck_count} cases pending`} accent="action" />
        </div>
      ) : null}

      {/* Attention banner */}
      <AttentionBanner totals={totals.data} funnel={funnel.data} />

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Trend */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Daily trend — logged vs issued</CardTitle>
          </CardHeader>
          <CardBody>
            {trend.loading ? <LoadingBlock className="h-52" /> : trend.error ? <ErrorState message={trend.error} /> : trend.data && trend.data.length ? (
              <TrendChart data={trend.data} />
            ) : (
              <EmptyState title="No dated cases in this snapshot" />
            )}
          </CardBody>
        </Card>

        {/* Mini funnel */}
        <Card>
          <CardHeader><CardTitle>Funnel</CardTitle></CardHeader>
          <CardBody>
            {funnel.loading ? <LoadingBlock className="h-52" /> : funnel.error ? <ErrorState message={funnel.error} /> : funnel.data ? (
              <BarList
                items={funnel.data.map((f) => ({
                  label: STAGE_LABEL[f.stage] ?? f.stage,
                  value: f.logged,
                  count: f.cases,
                  color: HEAT_COLOR[heatFor(f.stage)],
                }))}
              />
            ) : null}
          </CardBody>
        </Card>
      </div>

      {/* Top / bottom branches */}
      <Card className="mt-4">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Branches by logged premium</CardTitle>
        </CardHeader>
        <CardBody>
          {branches.loading ? <LoadingBlock className="h-40" /> : branches.error ? <ErrorState message={branches.error} /> : branches.data ? (
            <BarList items={branches.data.map((b) => ({ label: b.branch, value: b.logged, count: b.cases }))} />
          ) : null}
        </CardBody>
      </Card>
    </>
  );
}

function AttentionBanner({ totals, funnel }: { totals: TotalsData | null; funnel: FunnelRow[] | null }) {
  if (!totals || totals.stuck_count === 0) return null;
  const tele = funnel?.find((f) => f.stage === "TELE_UW_REQUIRED")?.cases ?? 0;
  const needsAction = (funnel ?? [])
    .filter((f) => heatFor(f.stage) === "action")
    .reduce((s, f) => s + f.cases, 0);
  return (
    <div className="mt-4 flex items-start gap-3 rounded-xl border border-[color:var(--action)]/30 bg-[color:var(--action)]/5 px-4 py-3">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-action" />
      <div className="text-sm text-fg">
        <span className="font-semibold">{formatINR(totals.stuck_premium)}</span> stuck across{" "}
        <span className="font-semibold tabular-nums">{totals.stuck_count}</span> cases
        {needsAction > 0 && (
          <>
            {" "}— <span className="font-semibold tabular-nums">{needsAction}</span> need action
            {tele > 0 && <span className="text-fg-muted"> ({tele} tele-UW)</span>}
          </>
        )}
        .
        <span className="ml-2 inline-flex items-center gap-1 text-xs text-fg-muted"><TrendingUp className="h-3.5 w-3.5" /> Work the Pipeline to release it.</span>
      </div>
    </div>
  );
}
