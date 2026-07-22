"use client";
// Single-hue horizontal bar list (magnitude). Used for funnel + branch strip.
// Direct value labels (no axis needed), per-row hover, 4px rounded ends anchored at the baseline.
import { formatINR } from "@/lib/metrics/format";

export type BarItem = { label: string; value: number; count?: number; color?: string; sub?: string };

export function BarList({ items, valueFmt = formatINR }: { items: BarItem[]; valueFmt?: (n: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.label} className="group flex items-center gap-3" title={`${it.label}: ${valueFmt(it.value)}${it.count != null ? ` · ${it.count} cases` : ""}`}>
          <div className="w-32 shrink-0 truncate text-sm text-fg-muted">{it.label}</div>
          <div className="relative h-5 flex-1 overflow-hidden rounded bg-surface-2">
            <div
              className="absolute left-0 top-0 h-full rounded transition-[width]"
              style={{ width: `${Math.max(2, (it.value / max) * 100)}%`, background: it.color ?? "var(--chart-logged)" }}
            />
          </div>
          <div className="w-24 shrink-0 text-right text-sm tabular-nums text-fg">{valueFmt(it.value)}</div>
          {it.count != null && <div className="w-14 shrink-0 text-right text-xs tabular-nums text-fg-subtle">{it.count}</div>}
        </div>
      ))}
    </div>
  );
}
