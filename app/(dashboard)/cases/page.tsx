"use client";
import * as React from "react";
import { Search, Download, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";
import { Card, Table, Th, Td, Badge, Button, Input } from "@/components/ui/primitives";
import { PageHeader } from "@/components/dashboard/kpi-card";
import { LoadingBlock, ErrorState, EmptyState } from "@/components/dashboard/states";
import { useCases, useCasesExportUrl, type CasesUiQuery } from "@/components/dashboard/use-cases";
import { useDashboard } from "@/components/dashboard/provider";
import { STAGE_LABEL, heatFor, HEAT_COLOR } from "@/lib/theme";
import { formatINRFull } from "@/lib/metrics/format";
import type { CaseSort } from "@/lib/cases";

const SORTS: { key: CaseSort; label: string; align?: string }[] = [
  { key: "customerName", label: "Customer" },
  { key: "loginBranch", label: "Branch" },
  { key: "funnelStage", label: "Stage" },
  { key: "loggedPremium", label: "Logged", align: "text-right" },
  { key: "statusAgeing", label: "Ageing", align: "text-right" },
];

export default function CasesPage() {
  const { snapshotId, loadingSnapshots } = useDashboard();
  const [q, setQ] = React.useState<CasesUiQuery>({ page: 1, pageSize: 25, sort: "loggedPremium", dir: "desc", search: "" });
  const [searchInput, setSearchInput] = React.useState("");
  const { data, loading, error } = useCases(q);
  const exportUrl = useCasesExportUrl(q.sort, q.dir, q.search);

  // debounce search
  React.useEffect(() => {
    const t = setTimeout(() => setQ((prev) => ({ ...prev, search: searchInput, page: 1 })), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  function sortBy(key: CaseSort) {
    setQ((prev) => ({ ...prev, sort: key, dir: prev.sort === key && prev.dir === "desc" ? "asc" : "desc", page: 1 }));
  }

  if (!snapshotId && !loadingSnapshots) return (<><PageHeader title="Cases" /><EmptyState title="No snapshot yet" /></>);

  return (
    <>
      <PageHeader title="Cases" subtitle={data ? `${data.total} cases match` : "All cases"} right={
        <a href={exportUrl ?? "#"} className="inline-flex h-9 items-center gap-1.5 rounded-lg border bg-surface px-3 text-sm text-fg-muted hover:bg-surface-2">
          <Download className="h-4 w-4" /> Export CSV
        </a>
      } />

      <div className="mb-3 flex items-center gap-2">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-fg-subtle" />
          <Input className="pl-8" placeholder="Search customer or application no…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
        </div>
      </div>

      <Card>
        {loading && !data ? <div className="p-4"><LoadingBlock className="h-96" /></div> : error ? <div className="p-4"><ErrorState message={error} /></div> : data && data.rows.length === 0 ? (
          <div className="p-4"><EmptyState title="No cases match these filters" hint="Try clearing filters or the search box." /></div>
        ) : data ? (
          <>
            <Table>
              <thead>
                <tr>
                  {SORTS.map((s) => (
                    <Th key={s.key} className={s.align}>
                      <button onClick={() => sortBy(s.key)} className="inline-flex items-center gap-1 hover:text-fg">
                        {s.label} <ArrowUpDown className={`h-3 w-3 ${q.sort === s.key ? "text-primary" : "text-fg-subtle/50"}`} />
                      </button>
                    </Th>
                  ))}
                  <Th>Agent</Th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-2/40">
                    <Td>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: HEAT_COLOR[heatFor(r.funnelStage)] }} />
                        <span className="font-medium">{r.customerName}</span>
                        {r.isPortability && <Badge tone="neutral" className="ml-1">Port</Badge>}
                        {r.discrepancy && <Badge tone="action" className="ml-1">Disc</Badge>}
                      </div>
                      <div className="text-xs text-fg-subtle">{r.applicationNo}</div>
                    </Td>
                    <Td>{r.loginBranch}</Td>
                    <Td><span className="text-xs text-fg-muted">{STAGE_LABEL[r.funnelStage] ?? r.funnelStage}</span></Td>
                    <Td className="text-right tabular-nums">{formatINRFull(r.loggedPremium)}</Td>
                    <Td className="text-right tabular-nums">{r.ageingDays != null ? `${r.ageingDays}d` : "—"}</Td>
                    <Td className="text-fg-muted">{r.agentName}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="flex items-center justify-between px-3 py-3 text-sm">
              <div className="text-fg-subtle tabular-nums">Page {data.page} of {data.totalPages} · {data.total} cases</div>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => setQ((p) => ({ ...p, page: p.page - 1 }))}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" disabled={data.page >= data.totalPages} onClick={() => setQ((p) => ({ ...p, page: p.page + 1 }))}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </>
        ) : null}
      </Card>
    </>
  );
}
