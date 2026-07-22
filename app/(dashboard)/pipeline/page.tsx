"use client";
import * as React from "react";
import { Clock, MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/dashboard/kpi-card";
import { NudgeModal } from "@/components/dashboard/nudge-modal";
import { LoadingBlock, ErrorState, EmptyState } from "@/components/dashboard/states";
import { useMetric } from "@/components/dashboard/use-metric";
import { useDashboard } from "@/components/dashboard/provider";
import { HeatBar } from "@/components/heat-bar";
import { STAGE_LABEL, PIPELINE_STAGES, heatFor, HEAT_COLOR } from "@/lib/theme";
import { formatINR } from "@/lib/metrics/format";
import { cn } from "@/lib/utils";
import type { StuckCaseRow } from "@/lib/metrics/metrics";

export default function PipelinePage() {
  const { snapshotId, loadingSnapshots } = useDashboard();
  const stuck = useMetric<StuckCaseRow[]>("stuck_cases");

  if (!snapshotId && !loadingSnapshots)
    return (<><PageHeader title="Pipeline" /><EmptyState title="No snapshot yet" /></>);

  const byStage = new Map<string, StuckCaseRow[]>();
  for (const s of PIPELINE_STAGES) byStage.set(s, []);
  for (const c of stuck.data ?? []) {
    if (!byStage.has(c.funnelStage)) byStage.set(c.funnelStage, []);
    byStage.get(c.funnelStage)!.push(c);
  }
  const columns = Array.from(byStage.entries()).filter(([, rows]) => rows.length > 0);
  const total = stuck.data?.length ?? 0;

  return (
    <>
      <PageHeader title="Pipeline" subtitle={`${total} pending cases — read-only kanban`} />
      {stuck.loading ? (
        <LoadingBlock className="h-96" />
      ) : stuck.error ? (
        <ErrorState message={stuck.error} />
      ) : total === 0 ? (
        <EmptyState title="Nothing pending 🎉" hint="Every case in this snapshot is issued." />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map(([stage, rows]) => {
            const colTotal = rows.reduce((s, r) => s + r.loggedPremium, 0);
            return (
              <div key={stage} className="flex w-72 shrink-0 flex-col">
                <div className="mb-2 flex items-center justify-between rounded-lg border bg-surface px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: HEAT_COLOR[heatFor(stage)] }} />
                    <span className="text-sm font-medium">{STAGE_LABEL[stage] ?? stage}</span>
                  </div>
                  <div className="text-xs text-fg-subtle tabular-nums">{rows.length} · {formatINR(colTotal)}</div>
                </div>
                <div className="space-y-2">
                  {rows.map((c) => <PipelineCard key={c.applicationNo} c={c} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function PipelineCard({ c }: { c: StuckCaseRow }) {
  const [nudge, setNudge] = React.useState(false);
  const ageing = c.ageingDays ?? 0;
  const hot = ageing >= 7;
  return (
    <div className="group relative overflow-hidden rounded-lg border bg-surface p-3 pl-4">
      <HeatBar stage={c.funnelStage} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-fg">{c.customerName}</div>
          <div className="truncate text-xs text-fg-subtle">{c.branch} · {c.agentName}</div>
        </div>
        <div className="shrink-0 text-right text-sm font-semibold tabular-nums text-fg">{formatINR(c.loggedPremium)}</div>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="truncate text-xs text-fg-muted">{c.leadStatus}</span>
        <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] tabular-nums", hot ? "border-[color:var(--action)]/40 bg-[color:var(--action)]/10 text-action animate-pulse-ring" : "border-border text-fg-subtle")}>
          <Clock className="h-3 w-3" /> {ageing}d
        </span>
      </div>
      <button
        onClick={() => setNudge(true)}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-[color:var(--won)]/30 bg-[color:var(--won)]/10 py-1.5 text-xs font-medium text-won opacity-0 transition-opacity hover:bg-[color:var(--won)]/20 group-hover:opacity-100"
      >
        <MessageCircle className="h-3.5 w-3.5" /> Nudge on WhatsApp
      </button>
      {nudge && <NudgeModal row={c} onClose={() => setNudge(false)} />}
    </div>
  );
}
