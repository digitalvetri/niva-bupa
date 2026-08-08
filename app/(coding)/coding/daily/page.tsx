"use client";
import * as React from "react";
import { Card, CardBody, CardHeader, CardTitle, Table, Th, Td } from "@/components/ui/primitives";
import { PageHeader } from "@/components/dashboard/kpi-card";
import { LoadingBlock, EmptyState } from "@/components/dashboard/states";
import { useCoding, useCodingData } from "@/components/coding/provider";
import type { CodingDailyRow } from "@/lib/coding/metrics";

export default function DailyProgress() {
  const { snapshotId, loading } = useCoding();
  const { data, loading: l } = useCodingData<CodingDailyRow[]>("daily");
  if (!snapshotId && !loading) return (<><PageHeader title="Daily Progress" /><EmptyState title="No upload yet" hint="Upload the Mission 300 file." /></>);

  const rows = data ?? [];
  const maxCum = Math.max(1, ...rows.map((r) => r.cumulative_total));

  return (
    <>
      <PageHeader title="Daily Progress" subtitle="Leads added per day and cumulative build-up" />
      {l || !data ? <LoadingBlock className="h-64" /> : rows.length === 0 ? <EmptyState title="No dated leads in this file" /> : (
        <>
          <Card className="mb-4">
            <CardHeader><CardTitle>Cumulative build-up</CardTitle></CardHeader>
            <CardBody>
              <div className="flex items-end gap-1.5" style={{ height: 160 }}>
                {rows.map((r) => (
                  <div key={r.date} className="flex flex-1 flex-col items-center justify-end" title={`${r.date}: +${r.added}, cumulative ${r.cumulative_total}`}>
                    <div className="w-full rounded-t bg-primary/30" style={{ height: `${(r.cumulative_total / maxCum) * 130}px` }}>
                      <div className="w-full rounded-t bg-primary" style={{ height: `${(r.cumulative_verified / maxCum) * 130}px` }} />
                    </div>
                    <div className="mt-1 max-w-full truncate text-[8px] text-fg-subtle">{r.date.slice(5)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-4 text-xs text-fg-muted"><span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Verified</span><span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-primary/30" /> Cumulative total</span></div>
            </CardBody>
          </Card>

          <Card>
            <Table>
              <thead><tr><Th>Date</Th><Th className="text-right">Added</Th><Th className="text-right">Verified</Th><Th className="text-right">Cumulative Verified</Th><Th className="text-right">Cumulative Total</Th></tr></thead>
              <tbody>
                {[...rows].reverse().map((r) => (
                  <tr key={r.date}>
                    <Td className="font-medium tabular-nums">{r.date}</Td>
                    <Td className="text-right tabular-nums">{r.added}</Td>
                    <Td className="text-right font-bold tabular-nums text-won">{r.verified}</Td>
                    <Td className="text-right tabular-nums">{r.cumulative_verified}</Td>
                    <Td className="text-right tabular-nums text-fg-muted">{r.cumulative_total}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </>
      )}
    </>
  );
}
