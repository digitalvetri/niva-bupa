"use client";
import * as React from "react";
import { Card, Table, Th, Td, Button } from "@/components/ui/primitives";
import { PageHeader } from "@/components/dashboard/kpi-card";
import { LoadingBlock, EmptyState } from "@/components/dashboard/states";
import { useCoding, useCodingData } from "@/components/coding/provider";
import type { CodingPivotRow } from "@/lib/coding/metrics";

const DIMS: [string, string][] = [["th", "Territory Head"], ["branch", "Branch"], ["competitor", "Competitor"], ["source", "Source"], ["experience", "Experience"]];

export default function Pivot() {
  const { snapshotId, loading } = useCoding();
  const [dim, setDim] = React.useState("th");
  const { data, loading: l } = useCodingData<{ dim: string; rows: CodingPivotRow[] }>("pivot", { dim });
  if (!snapshotId && !loading) return (<><PageHeader title="Pivot Table" /><EmptyState title="No upload yet" hint="Upload the Mission 300 file." /></>);

  const rows = data?.rows ?? [];
  const totals = rows.reduce((a, r) => ({ IDENTIFIED: a.IDENTIFIED + r.IDENTIFIED, VERIFIED: a.VERIFIED + r.VERIFIED, DUPLICATE: a.DUPLICATE + r.DUPLICATE, INVALID: a.INVALID + r.INVALID, total: a.total + r.total }), { IDENTIFIED: 0, VERIFIED: 0, DUPLICATE: 0, INVALID: 0, total: 0 });

  return (
    <>
      <PageHeader title="Pivot Table" subtitle="Cross-tabulate leads by dimension × status" />
      <div className="mb-4 flex flex-wrap gap-2">
        {DIMS.map(([k, label]) => (
          <Button key={k} size="sm" variant={dim === k ? "default" : "outline"} onClick={() => setDim(k)}>{label}</Button>
        ))}
      </div>
      <Card>
        {l || !data ? <div className="p-4"><LoadingBlock className="h-64" /></div> : (
          <Table>
            <thead><tr><Th>{DIMS.find((d) => d[0] === dim)?.[1]}</Th><Th className="text-right">Identified</Th><Th className="text-right">Verified</Th><Th className="text-right">Duplicate</Th><Th className="text-right">Invalid</Th><Th className="text-right">Total</Th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <Td className="font-medium">{r.key}</Td>
                  <Td className="text-right tabular-nums">{r.IDENTIFIED}</Td>
                  <Td className="text-right font-semibold tabular-nums text-won">{r.VERIFIED}</Td>
                  <Td className="text-right tabular-nums text-pending">{r.DUPLICATE}</Td>
                  <Td className="text-right tabular-nums text-action">{r.INVALID}</Td>
                  <Td className="text-right font-bold tabular-nums">{r.total}</Td>
                </tr>
              ))}
              <tr className="border-t-2 border-border font-bold">
                <Td>Grand Total</Td>
                <Td className="text-right tabular-nums">{totals.IDENTIFIED}</Td>
                <Td className="text-right tabular-nums text-won">{totals.VERIFIED}</Td>
                <Td className="text-right tabular-nums text-pending">{totals.DUPLICATE}</Td>
                <Td className="text-right tabular-nums text-action">{totals.INVALID}</Td>
                <Td className="text-right tabular-nums">{totals.total}</Td>
              </tr>
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
