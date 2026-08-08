"use client";
import * as React from "react";
import { Search } from "lucide-react";
import { Card, Table, Th, Td, Input } from "@/components/ui/primitives";
import { PageHeader } from "@/components/dashboard/kpi-card";
import { LoadingBlock, EmptyState } from "@/components/dashboard/states";
import { useCoding, useCodingData } from "@/components/coding/provider";
import type { CodingLeadRow, CodingMasterLists } from "@/lib/coding/metrics";

const STATUS_CLS: Record<string, string> = {
  VERIFIED: "bg-[color:var(--won)]/15 text-won",
  IDENTIFIED: "bg-primary/15 text-primary",
  DUPLICATE: "bg-[color:var(--pending)]/15 text-pending",
  INVALID: "bg-[color:var(--action)]/15 text-action",
};

function Select({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 rounded-lg border bg-surface px-3 text-sm text-fg focus:border-primary focus:outline-none">
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

export default function Leads() {
  const { snapshotId, loading } = useCoding();
  const [f, setF] = React.useState({ th: "", branch: "", status: "", source: "", q: "" });
  const master = useCodingData<CodingMasterLists>("master");
  const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v)) as Record<string, string>;
  const { data, loading: l } = useCodingData<CodingLeadRow[]>("leads", params);
  const [rows, setRows] = React.useState<CodingLeadRow[]>([]);
  React.useEffect(() => { setRows(data ?? []); }, [data]);

  async function setStatus(id: string, status: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r))); // optimistic
    await fetch("/api/coding/lead", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status }) }).catch(() => {});
  }

  if (!snapshotId && !loading) return (<><PageHeader title="Leads" /><EmptyState title="No upload yet" hint="Upload the Mission 300 file." /></>);
  const m = master.data;

  return (
    <>
      <PageHeader title="Leads" subtitle={`Identified competitor agents${data ? ` · ${rows.length} shown` : ""}`} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border bg-surface px-3">
          <Search className="h-4 w-4 text-fg-subtle" />
          <input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Agent, mobile, lead ID…" className="h-9 w-48 bg-transparent text-sm text-fg outline-none" />
        </div>
        <Select value={f.th} onChange={(v) => setF({ ...f, th: v })} options={m?.ths ?? []} placeholder="All THs" />
        <Select value={f.branch} onChange={(v) => setF({ ...f, branch: v })} options={(m?.branches ?? []).map((b) => b.branch)} placeholder="All branches" />
        <Select value={f.status} onChange={(v) => setF({ ...f, status: v })} options={m?.statuses ?? []} placeholder="All statuses" />
        <Select value={f.source} onChange={(v) => setF({ ...f, source: v })} options={m?.sources ?? []} placeholder="All sources" />
      </div>
      <Card>
        {l || !data ? <div className="p-4"><LoadingBlock className="h-64" /></div> : rows.length === 0 ? <div className="p-4"><EmptyState title="No leads match" /></div> : (
          <Table>
            <thead><tr><Th>Lead ID</Th><Th>Date</Th><Th>Agent</Th><Th>Mobile</Th><Th>Competitor</Th><Th>TH</Th><Th>Branch</Th><Th>BDM</Th><Th>Source</Th><Th>Exp.</Th><Th>Status</Th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.leadId}>
                  <Td className="font-mono text-xs">{r.leadId}</Td>
                  <Td className="tabular-nums text-fg-muted">{r.date ?? "—"}</Td>
                  <Td className="font-medium">{r.agentName}</Td>
                  <Td className="tabular-nums text-fg-muted">{r.mobile ?? "—"}</Td>
                  <Td>{r.competitor ?? "—"}</Td>
                  <Td className="text-fg-muted">{r.th}</Td>
                  <Td className="text-fg-muted">{r.branch}</Td>
                  <Td className="text-fg-muted">{r.bdm ?? "—"}</Td>
                  <Td className="text-fg-muted">{r.source ?? "—"}</Td>
                  <Td className="text-fg-muted">{r.experience ?? "—"}</Td>
                  <Td>
                    <select
                      value={r.status}
                      onChange={(e) => setStatus(r.id, e.target.value)}
                      className={`cursor-pointer rounded-md border-0 px-2 py-1 text-xs font-semibold outline-none ${STATUS_CLS[r.status] ?? "bg-surface-2 text-fg-muted"}`}
                      title="Change status — pick Verified to confirm the recruit"
                    >
                      <option value="IDENTIFIED">IDENTIFIED</option>
                      <option value="VERIFIED">VERIFIED</option>
                      <option value="DUPLICATE">DUPLICATE</option>
                      <option value="INVALID">INVALID</option>
                    </select>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
