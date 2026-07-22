"use client";
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
import type { BranchRow, FunnelRow, AgentRow, StuckCaseRow } from "@/lib/metrics/metrics";

function convTone(pct: number) {
  if (pct >= 70) return "text-won";
  if (pct >= 40) return "text-pending";
  return "text-action";
}

export default function BranchesPage() {
  const { filters, setParam, snapshotId, loadingSnapshots } = useDashboard();
  const branches = useMetric<BranchRow[]>("premium_by_branch");
  const selected = filters.branch?.length === 1 ? filters.branch[0]! : null;

  if (!snapshotId && !loadingSnapshots) return (<><PageHeader title="Branches" /><EmptyState title="No snapshot yet" /></>);

  return (
    <>
      <PageHeader title="Branches" subtitle="Login-branch leaderboard" />
      <Card>
        {branches.loading ? <div className="p-4"><LoadingBlock className="h-64" /></div> : branches.error ? <div className="p-4"><ErrorState message={branches.error} /></div> : branches.data ? (
          <Table>
            <thead>
              <tr><Th>Branch</Th><Th className="text-right">Cases</Th><Th className="text-right">Logged</Th><Th className="text-right">Issued</Th><Th className="text-right">Conversion</Th><Th></Th></tr>
            </thead>
            <tbody>
              {branches.data.map((b) => (
                <tr key={b.branch} className={cn("cursor-pointer hover:bg-surface-2/50", selected === b.branch && "bg-surface-2/60")} onClick={() => setParam("branch", selected === b.branch ? null : b.branch)}>
                  <Td className="font-medium">{b.branch}</Td>
                  <Td className="text-right tabular-nums">{b.cases}</Td>
                  <Td className="text-right tabular-nums">{b.display.logged}</Td>
                  <Td className="text-right tabular-nums text-fg-muted">{b.display.issued}</Td>
                  <Td className={cn("text-right tabular-nums font-medium", convTone(b.conversion_pct))}>{b.conversion_pct}%</Td>
                  <Td className="text-right"><ChevronRight className="ml-auto h-4 w-4 text-fg-subtle" /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : null}
      </Card>

      {selected && <BranchDetail branch={selected} onClose={() => setParam("branch", null)} />}
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
