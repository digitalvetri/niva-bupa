// §6.2 snapshot_compare — works generically over ANY metric in the catalog: run the metric on
// two snapshots and diff (value, prev, delta, delta_pct). No hand-written comparison per screen.
import type { PrismaClient } from "@prisma/client";
import { getMetric } from "./catalog";
import { meta, type Filters, type MetricResult } from "./types";
import { formatINR } from "./format";

export type CompareCell = { key: string; label: string; value: number; prev: number; delta: number; delta_pct: number | null; display: { value: string; delta: string } };
export type CompareResult = { kind: "scalar" | "table"; metric: string; snapshotId: string; compareSnapshotId: string; cells: CompareCell[] };

// Identifying key + primary numeric value for a table row (covers every table metric shape).
function rowKey(row: Record<string, unknown>): string {
  const v = row.branch ?? row.agentName ?? row.stage ?? row.leadStatus ?? row.key ?? row.segment ?? row.state ?? row.band ?? row.bucket ?? row.tenureYears ?? row.date;
  return String(v ?? "—");
}
function rowValue(row: Record<string, unknown>): number {
  const v = row.logged ?? row.premium ?? row.cases ?? row.count ?? row.loggedPremium ?? 0;
  return typeof v === "number" ? v : 0;
}

// Scalar (totals) fields worth diffing on the KPI cards.
const SCALAR_FIELDS: { key: string; label: string; money: boolean }[] = [
  { key: "logged_premium", label: "Logged", money: true },
  { key: "issued_premium", label: "Issued", money: true },
  { key: "case_count", label: "Cases", money: false },
  { key: "issued_count", label: "Issued cases", money: false },
  { key: "conversion_pct", label: "Conversion %", money: false },
  { key: "stuck_premium", label: "Stuck", money: true },
];

function pct(delta: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round((delta / prev) * 1000) / 10;
}

function cell(key: string, label: string, value: number, prev: number, money: boolean): CompareCell {
  const delta = value - prev;
  return {
    key, label, value, prev, delta, delta_pct: pct(delta, prev),
    display: { value: money ? formatINR(value) : String(value), delta: `${delta >= 0 ? "+" : ""}${money ? formatINR(delta) : delta}` },
  };
}

export async function compareMetric(db: PrismaClient, metricId: string, snapshotId: string, compareSnapshotId: string, filters: Filters): Promise<MetricResult<CompareResult>> {
  const entry = getMetric(metricId);
  if (!entry) throw new Error(`Unknown metric "${metricId}"`);

  const [cur, prev] = await Promise.all([entry.fn(db, snapshotId, filters), entry.fn(db, compareSnapshotId, filters)]);
  const curData = cur.data as unknown;
  const prevData = prev.data as unknown;

  let cells: CompareCell[];
  let kind: "scalar" | "table";

  if (Array.isArray(curData)) {
    kind = "table";
    const prevMap = new Map((prevData as Record<string, unknown>[]).map((r) => [rowKey(r), rowValue(r)]));
    const seen = new Set<string>();
    cells = (curData as Record<string, unknown>[]).map((r) => {
      const k = rowKey(r);
      seen.add(k);
      return cell(k, k, rowValue(r), prevMap.get(k) ?? 0, true);
    });
    // Rows that existed previously but vanished this snapshot.
    for (const [k, v] of prevMap) if (!seen.has(k)) cells.push(cell(k, k, 0, v, true));
    cells.sort((a, b) => b.delta - a.delta);
  } else {
    kind = "scalar";
    const c = curData as Record<string, number>;
    const p = prevData as Record<string, number>;
    cells = SCALAR_FIELDS.filter((f) => f.key in c).map((f) => cell(f.key, f.label, c[f.key] ?? 0, p[f.key] ?? 0, f.money));
  }

  return {
    id: "snapshot_compare",
    data: { kind, metric: metricId, snapshotId, compareSnapshotId, cells },
    meta: meta(snapshotId, filters, cur.meta.rowsMatched),
  };
}
