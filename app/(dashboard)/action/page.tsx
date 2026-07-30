"use client";
import * as React from "react";
import { PhoneCall, Clock, MessageCircle, AlertTriangle } from "lucide-react";
import { Card, Button, Badge } from "@/components/ui/primitives";
import { PageHeader } from "@/components/dashboard/kpi-card";
import { LoadingBlock, EmptyState, ErrorState } from "@/components/dashboard/states";
import { useMetric } from "@/components/dashboard/use-metric";
import { useDashboard } from "@/components/dashboard/provider";
import { NudgeModal } from "@/components/dashboard/nudge-modal";
import { STAGE_LABEL, heatFor, HEAT_COLOR } from "@/lib/theme";
import { formatINR } from "@/lib/metrics/format";
import type { StuckCaseRow } from "@/lib/metrics/metrics";

export default function ActionPage() {
  const { snapshotId, loadingSnapshots } = useDashboard();
  const cases = useMetric<StuckCaseRow[]>("high_value_stuck");
  const [nudge, setNudge] = React.useState<StuckCaseRow | null>(null);

  if (!snapshotId && !loadingSnapshots)
    return (<><PageHeader title="Today's Call List" /><EmptyState title="No snapshot yet" hint="Upload a report to see who needs a follow-up." /></>);

  const rows = (cases.data ?? []).slice(0, 12);
  const totalStuck = rows.reduce((s, r) => s + r.loggedPremium, 0);

  return (
    <>
      <PageHeader
        title="Today's Call List"
        subtitle="Highest-value pending cases to follow up first"
        right={rows.length ? <div className="text-right"><div className="text-lg font-bold text-fg">{formatINR(totalStuck)}</div><div className="text-xs text-fg-muted">{rows.length} priority cases</div></div> : undefined}
      />

      {cases.loading ? (
        <LoadingBlock className="h-64" />
      ) : cases.error ? (
        <ErrorState message={cases.error} />
      ) : rows.length === 0 ? (
        <EmptyState title="Nothing high-value is stuck 🎉" hint="No pending cases above your high-value threshold. Adjust it in Settings." />
      ) : (
        <div className="space-y-2.5">
          {rows.map((r, i) => {
            const heat = heatFor(r.funnelStage);
            const ageing = r.ageingDays ?? 0;
            const urgent = ageing >= 7;
            return (
              <Card key={r.applicationNo} className="relative overflow-hidden">
                <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: HEAT_COLOR[heat] }} />
                <div className="flex flex-col gap-3 py-3 pl-5 pr-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-bold text-fg-muted">{i + 1}</span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-fg">{r.customerName}</div>
                      <div className="truncate text-xs text-fg-muted">{r.productGenre} · {r.branch} · {r.agentName}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pl-10 sm:pl-0">
                    <Badge tone={heat === "action" ? "action" : heat === "won" ? "won" : "pending"}>{STAGE_LABEL[r.funnelStage] ?? r.leadStatus}</Badge>
                    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ${urgent ? "bg-[color:var(--action)]/15 text-action" : "text-fg-subtle"}`}>
                      <Clock className="h-3 w-3" /> {ageing}d
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 pl-10 sm:justify-end sm:pl-0">
                    <div className="text-right">
                      <div className="text-base font-bold text-fg tabular-nums">{r.display.logged}</div>
                    </div>
                    <Button size="sm" onClick={() => setNudge(r)}>
                      <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}

          <div className="flex items-center gap-2 pt-2 text-xs text-fg-subtle">
            <AlertTriangle className="h-3.5 w-3.5" /> Ranked by logged premium. "WhatsApp" drafts a ready-to-send nudge to the agent.
          </div>
        </div>
      )}

      {nudge && <NudgeModal row={nudge} onClose={() => setNudge(null)} />}
    </>
  );
}
