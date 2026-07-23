"use client";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export type KpiDelta = { label: string; pct: number | null; up: boolean; good: boolean };

// KPI stat tile (dataviz: a headline number is a tile, not a chart). WoW delta shows when a
// comparison snapshot is selected; `good` colors improvement green vs. worsening red.
export function KpiCard({
  label,
  value,
  sub,
  accent,
  delta,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "primary" | "won" | "action" | "neutral";
  delta?: KpiDelta | null;
}) {
  const bar: Record<string, string> = { primary: "var(--primary)", won: "var(--won)", action: "var(--action)", neutral: "var(--review)" };
  return (
    <Card className="p-4">
      {accent && <span className="absolute left-0 top-0 h-full w-1" style={{ background: bar[accent] }} />}
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-medium uppercase tracking-wide text-fg-subtle">{label}</div>
        {delta && (
          <span className={cn("inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums", delta.good ? "bg-[color:var(--won)]/15 text-won" : "bg-[color:var(--action)]/15 text-action")}>
            {delta.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {delta.pct != null ? `${Math.abs(delta.pct)}%` : delta.label}
          </span>
        )}
      </div>
      <div className={cn("mt-1.5 text-2xl font-semibold tabular-nums text-fg")}>{value}</div>
      {sub && <div className="mt-1 text-xs text-fg-muted tabular-nums">{sub}</div>}
      {delta && <div className="mt-0.5 text-[11px] text-fg-subtle tabular-nums">{delta.label} WoW</div>}
    </Card>
  );
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <div>
        <h1 className="text-lg font-semibold text-fg sm:text-xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-fg-muted">{subtitle}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}
