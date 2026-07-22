"use client";
import * as React from "react";
import { ChevronRight, ChevronDown, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import { PageHeader } from "@/components/dashboard/kpi-card";
import { LoadingBlock, ErrorState, EmptyState } from "@/components/dashboard/states";
import { useMetric } from "@/components/dashboard/use-metric";
import { useDashboard } from "@/components/dashboard/provider";
import { cn } from "@/lib/utils";
import type { GroupRow, AgentRow } from "@/lib/metrics/metrics";

function convTone(pct: number) {
  return pct >= 70 ? "text-won" : pct >= 40 ? "text-pending" : "text-action";
}

export default function PeoplePage() {
  const { snapshotId, loadingSnapshots } = useDashboard();
  const ams = useMetric<GroupRow[]>("am_leaderboard");

  if (!snapshotId && !loadingSnapshots) return (<><PageHeader title="People" /><EmptyState title="No snapshot yet" /></>);

  return (
    <>
      <PageHeader title="People" subtitle="Agency managers → agents" />
      <Card className="p-2">
        {ams.loading ? <div className="p-3"><LoadingBlock className="h-64" /></div> : ams.error ? <div className="p-3"><ErrorState message={ams.error} /></div> : ams.data ? (
          <div className="divide-y divide-border/60">
            {ams.data.map((am) => <AmNode key={am.key} am={am} />)}
          </div>
        ) : null}
      </Card>
    </>
  );
}

function AmNode({ am }: { am: GroupRow }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-surface-2/50">
        {open ? <ChevronDown className="h-4 w-4 text-fg-subtle" /> : <ChevronRight className="h-4 w-4 text-fg-subtle" />}
        <span className="flex-1 truncate text-sm font-medium">{am.key}</span>
        <span className="text-xs text-fg-subtle tabular-nums">{am.cases} cases</span>
        <span className="w-24 text-right text-sm tabular-nums text-fg-muted">{am.display.logged}</span>
        <span className={cn("w-14 text-right text-sm font-medium tabular-nums", convTone(am.conversion_pct))}>{am.conversion_pct}%</span>
      </button>
      {open && <AgentList amName={am.key} />}
    </div>
  );
}

function AgentList({ amName }: { amName: string }) {
  const agents = useMetric<AgentRow[]>("agent_leaderboard", { am: [amName] });
  if (agents.loading) return <div className="px-10 py-2"><LoadingBlock className="h-16" /></div>;
  if (!agents.data || agents.data.length === 0) return <div className="px-10 py-2 text-xs text-fg-subtle">No agents.</div>;
  return (
    <div className="bg-surface-2/30 pb-1">
      {agents.data.map((a) => (
        <div key={a.agentName} className="flex items-center gap-2 py-1.5 pl-11 pr-3 text-sm">
          <span className="flex-1 truncate text-fg-muted">{a.agentName}{a.unassigned && <span className="ml-1 text-fg-subtle">⚠</span>}</span>
          {a.stuck_count > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded bg-[color:var(--action)]/10 px-1.5 py-0.5 text-[11px] text-action tabular-nums"><AlertTriangle className="h-3 w-3" />{a.stuck_count}</span>
          )}
          <span className="text-xs text-fg-subtle tabular-nums">{a.cases}</span>
          <span className="w-24 text-right tabular-nums text-fg">{a.display.logged}</span>
          <span className={cn("w-14 text-right tabular-nums", convTone(a.conversion_pct))}>{a.conversion_pct}%</span>
        </div>
      ))}
    </div>
  );
}
