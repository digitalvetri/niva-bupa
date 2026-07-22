"use client";
import { Card } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

// KPI stat tile (dataviz: a headline number is a tile, not a chart). WoW delta slot lands in Phase 4.
export function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "primary" | "won" | "action" | "neutral";
}) {
  const bar: Record<string, string> = {
    primary: "var(--primary)",
    won: "var(--won)",
    action: "var(--action)",
    neutral: "var(--review)",
  };
  return (
    <Card className="p-4">
      {accent && <span className="absolute left-0 top-0 h-full w-1" style={{ background: bar[accent] }} />}
      <div className="text-xs font-medium uppercase tracking-wide text-fg-subtle">{label}</div>
      <div className={cn("mt-1.5 text-2xl font-semibold tabular-nums text-fg")}>{value}</div>
      {sub && <div className="mt-1 text-xs text-fg-muted tabular-nums">{sub}</div>}
    </Card>
  );
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-fg">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-fg-muted">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}
