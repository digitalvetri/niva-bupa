"use client";
import * as React from "react";
import { ChevronRight } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle, Table, Th, Td, Button } from "@/components/ui/primitives";
import { PageHeader } from "@/components/dashboard/kpi-card";
import { LoadingBlock, ErrorState, EmptyState } from "@/components/dashboard/states";
import { useMetric } from "@/components/dashboard/use-metric";
import { useDashboard } from "@/components/dashboard/provider";
import { BarList } from "@/components/charts/bar-list";
import { STAGE_LABEL, heatFor, HEAT_COLOR } from "@/lib/theme";
import { formatINR } from "@/lib/metrics/format";
import { cn } from "@/lib/utils";
import { consolidateBranches, DEFAULT_BRANCH_GROUPS } from "@/lib/branch-group";
import type { BranchRow, FunnelRow, AgentRow, StuckCaseRow } from "@/lib/metrics/metrics";

function convTone(pct: number) {
  if (pct >= 70) return "text-won";
  if (pct >= 40) return "text-pending";
  return "text-action";
}

export default function BranchesPage() {
  const { setParam, snapshotId, loadingSnapshots } = useDashboard();
  const branches = useMetric<BranchRow[]>("premium_by_branch");
  const [groups, setGroups] = React.useState<Record<string, string>>(DEFAULT_BRANCH_GROUPS);
  const [branchTargets, setBranchTargets] = React.useState<Record<string, number>>({});
  const [selected, setSelected] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/settings", { cache: "no-store" }).then((r) => r.json()).then((s) => {
      setGroups({ ...DEFAULT_BRANCH_GROUPS, ...(s.branchGroups ?? {}) });
      setBranchTargets(s.branchTargets ?? {});
    }).catch(() => {});
  }, []);

  if (!snapshotId && !loadingSnapshots) return (<><PageHeader title="Branches" /><EmptyState title="No snapshot yet" /></>);
  const rows = branches.data ? consolidateBranches(branches.data, groups, branchTargets) : [];

  function toggle(canon: string, members: string[]) {
    if (selected === canon) { setSelected(null); setParam("branch", null); }
    else { setSelected(canon); setParam("branch", members.join(",")); }
  }

  return (
    <>
      <PageHeader title="Branches" subtitle="Login-branch leaderboard vs GWP target" />
      <Card>
        {branches.loading ? <div className="p-4"><LoadingBlock className="h-64" /></div> : branches.error ? <div className="p-4"><ErrorState message={branches.error} /></div> : rows.length ? (
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr><Th>Branch</Th><Th className="text-right">Cases</Th><Th className="text-right">Logged</Th><Th className="text-right">Issued</Th><Th className="text-right">Target</Th><Th className="text-right">Achieved</Th><Th className="text-right">Conversion</Th><Th></Th></tr>
              </thead>
              <tbody>
                {rows.map((b) => {
                  const extra = b.members.filter((m) => m !== b.branch);
                  return (
                    <tr key={b.branch} className={cn("cursor-pointer hover:bg-surface-2/50", selected === b.branch && "bg-surface-2/60")} onClick={() => toggle(b.branch, b.members)}>
                      <Td className="font-medium">{b.branch}{extra.length > 0 && <span className="ml-1.5 text-[10px] font-normal text-fg-subtle">+ {extra.join(", ")}</span>}</Td>
                      <Td className="text-right tabular-nums">{b.cases}</Td>
                      <Td className="text-right tabular-nums">{formatINR(b.logged)}</Td>
                      <Td className="text-right tabular-nums text-fg-muted">{formatINR(b.issued)}</Td>
                      <Td className="text-right tabular-nums text-fg-muted">{b.target != null ? formatINR(b.target) : "—"}</Td>
                      <Td className={cn("text-right tabular-nums font-semibold", b.achievement_pct != null ? convTone(b.achievement_pct) : "text-fg-subtle")}>{b.achievement_pct != null ? `${b.achievement_pct}%` : "—"}</Td>
                      <Td className={cn("text-right tabular-nums font-medium", convTone(b.conversion_pct))}>{b.conversion_pct}%</Td>
                      <Td className="text-right"><ChevronRight className="ml-auto h-4 w-4 text-fg-subtle" /></Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        ) : null}
      </Card>

      {selected && <BranchDetail branch={selected} onClose={() => { setSelected(null); setParam("branch", null); }} />}
    </>
  );
}

function BranchDetail({ branch, onClose }: { branch: string; onClose: () => void }) {
  // Scoped to the selected branch via the global filter — reuses the same metric functions.
  const funnel = useMetric<FunnelRow[]>("funnel");
  const agents = useMetric<AgentRow[]>("agent_leaderboard");
  const stuck = useMetric<StuckCaseRow[]>("stuck_cases");

  return (
    <div className="mt-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{branch}</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>Clear</Button>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Funnel</CardTitle></CardHeader>
          <CardBody>{funnel.data ? <BarList items={funnel.data.map((f) => ({ label: STAGE_LABEL[f.stage] ?? f.stage, value: f.logged, count: f.cases, color: HEAT_COLOR[heatFor(f.stage)] }))} /> : <LoadingBlock className="h-40" />}</CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Agents</CardTitle></CardHeader>
          <CardBody>{agents.data ? <BarList items={agents.data.slice(0, 8).map((a) => ({ label: a.agentName, value: a.logged, count: a.cases }))} /> : <LoadingBlock className="h-40" />}</CardBody>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader><CardTitle>Stuck cases in {branch}</CardTitle></CardHeader>
        <CardBody>
          {stuck.data ? (stuck.data.length === 0 ? <EmptyState title="No stuck cases" /> : (
            <Table>
              <thead><tr><Th>Customer</Th><Th>Stage</Th><Th>Agent</Th><Th className="text-right">Logged</Th><Th className="text-right">Ageing</Th></tr></thead>
              <tbody>
                {stuck.data.map((c) => (
                  <tr key={c.applicationNo}>
                    <Td className="font-medium">{c.customerName}</Td>
                    <Td className="text-xs text-fg-muted">{c.leadStatus}</Td>
                    <Td className="text-fg-muted">{c.agentName}</Td>
                    <Td className="text-right tabular-nums">{c.display.loggedFull}</Td>
                    <Td className="text-right tabular-nums">{c.ageingDays != null ? `${c.ageingDays}d` : "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )) : <LoadingBlock className="h-40" />}
        </CardBody>
      </Card>
    </div>
  );
}
