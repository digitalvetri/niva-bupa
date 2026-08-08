"use client";
import * as React from "react";
import { Card, Table, Th, Td } from "@/components/ui/primitives";
import { PageHeader } from "@/components/dashboard/kpi-card";
import { LoadingBlock, EmptyState } from "@/components/dashboard/states";
import { useCoding, useCodingData } from "@/components/coding/provider";
import type { CodingRankRow } from "@/lib/coding/metrics";

const achColor = (p: number | null) => (p == null ? "text-fg-subtle" : p >= 70 ? "text-won" : p >= 40 ? "text-pending" : "text-action");

export default function BranchDashboard() {
  const { snapshotId, loading } = useCoding();
  const { data, loading: l } = useCodingData<CodingRankRow[]>("branch");
  if (!snapshotId && !loading) return (<><PageHeader title="Branch Dashboard" /><EmptyState title="No upload yet" hint="Upload the Mission 300 file." /></>);
  return (
    <>
      <PageHeader title="Branch Dashboard" subtitle="Recruitment performance by branch" />
      <Card>
        {l || !data ? <div className="p-4"><LoadingBlock className="h-64" /></div> : (
          <Table>
            <thead><tr><Th>#</Th><Th>Branch</Th><Th>BM</Th><Th>TH</Th><Th className="text-right">Target</Th><Th className="text-right">Verified</Th><Th className="text-right">Pending</Th><Th className="text-right">Achievement</Th></tr></thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.name}>
                  <Td><span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${r.rank <= 3 ? "bg-primary text-primary-fg" : "bg-surface-2 text-fg-muted"}`}>{r.rank}</span></Td>
                  <Td className="font-medium">{r.name}</Td>
                  <Td className="text-fg-muted">{r.bm ?? "—"}</Td>
                  <Td className="text-fg-muted">{r.th ?? "—"}</Td>
                  <Td className="text-right tabular-nums text-fg-muted">{r.target ?? "—"}</Td>
                  <Td className="text-right font-bold tabular-nums">{r.verified}</Td>
                  <Td className="text-right tabular-nums">{r.pending ?? "—"}</Td>
                  <Td className={`text-right font-bold tabular-nums ${achColor(r.achievement_pct)}`}>{r.achievement_pct == null ? "—" : `${r.achievement_pct}%`}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
