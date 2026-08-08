"use client";
import * as React from "react";
import { Card, CardBody, CardHeader, CardTitle, Table, Th, Td } from "@/components/ui/primitives";
import { PageHeader } from "@/components/dashboard/kpi-card";
import { LoadingBlock, EmptyState } from "@/components/dashboard/states";
import { useCoding, useCodingData } from "@/components/coding/provider";
import type { CodingMasterLists } from "@/lib/coding/metrics";

function Pills({ items }: { items: string[] }) {
  return <div className="flex flex-wrap gap-1.5">{items.map((i) => <span key={i} className="rounded-md bg-surface-2 px-2 py-1 text-xs text-fg">{i}</span>)}</div>;
}

export default function MasterLists() {
  const { snapshotId, loading } = useCoding();
  const { data, loading: l } = useCodingData<CodingMasterLists>("master");
  if (!snapshotId && !loading) return (<><PageHeader title="Master Lists" /><EmptyState title="No upload yet" hint="Upload the Mission 300 file." /></>);
  if (l || !data) return (<><PageHeader title="Master Lists" /><LoadingBlock className="h-64" /></>);

  return (
    <>
      <PageHeader title="Master Lists" subtitle="Reference data captured from the workbook" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Territory Heads ({data.ths.length})</CardTitle></CardHeader>
          <CardBody><Pills items={data.ths} /></CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Competitors ({data.competitors.length})</CardTitle></CardHeader>
          <CardBody><Pills items={data.competitors} /></CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Sources ({data.sources.length})</CardTitle></CardHeader>
          <CardBody><Pills items={data.sources} /></CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Statuses</CardTitle></CardHeader>
          <CardBody><Pills items={data.statuses} /></CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Branches ({data.branches.length})</CardTitle></CardHeader>
        <Table>
          <thead><tr><Th>Branch</Th><Th>Branch Manager</Th><Th>Territory Head</Th><Th className="text-right">Target</Th></tr></thead>
          <tbody>
            {data.branches.map((b) => (
              <tr key={b.branch}>
                <Td className="font-medium">{b.branch}</Td>
                <Td className="text-fg-muted">{b.bm ?? "—"}</Td>
                <Td className="text-fg-muted">{b.th ?? "—"}</Td>
                <Td className="text-right tabular-nums">{b.target ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
