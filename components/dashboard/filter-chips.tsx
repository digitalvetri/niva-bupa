"use client";
import * as React from "react";
import { X, SlidersHorizontal, Check } from "lucide-react";
import { useDashboard } from "./provider";
import { useMetric } from "./use-metric";
import { STAGE_LABEL } from "@/lib/theme";
import { FUNNEL_ORDER } from "@/lib/ingest/funnelStage";
import { cn } from "@/lib/utils";
import type { BranchRow } from "@/lib/metrics/metrics";

function toggleCsv(current: string | undefined, value: string): string | null {
  const set = new Set(current ? current.split(",") : []);
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return set.size ? Array.from(set).join(",") : null;
}

export function FilterChips() {
  const { filters, setParam } = useDashboard();
  const { data: branches } = useMetric<BranchRow[]>("premium_by_branch");
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const activeBranches = filters.branch ?? [];
  const activeStages = filters.funnelStage ?? [];
  const anyActive = activeBranches.length + activeStages.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2" ref={ref}>
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border bg-surface px-3 text-sm text-fg-muted hover:bg-surface-2"
        >
          <SlidersHorizontal className="h-4 w-4" /> Filters
        </button>
        {open && (
          <div className="absolute z-30 mt-1 w-64 rounded-lg border bg-surface p-3 shadow-xl">
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-fg-subtle">Branch</div>
            <div className="mb-3 max-h-40 space-y-0.5 overflow-y-auto">
              {(branches ?? []).map((b) => (
                <CheckRow key={b.branch} label={`${b.branch}`} count={b.cases} checked={activeBranches.includes(b.branch)} onClick={() => setParam("branch", toggleCsv(filters.branch?.join(","), b.branch))} />
              ))}
            </div>
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-fg-subtle">Stage</div>
            <div className="space-y-0.5">
              {FUNNEL_ORDER.map((s) => (
                <CheckRow key={s} label={STAGE_LABEL[s] ?? s} checked={activeStages.includes(s)} onClick={() => setParam("stage", toggleCsv(filters.funnelStage?.join(","), s))} />
              ))}
            </div>
          </div>
        )}
      </div>

      {activeBranches.map((b) => (
        <Chip key={`b-${b}`} label={b} onRemove={() => setParam("branch", toggleCsv(filters.branch?.join(","), b))} />
      ))}
      {activeStages.map((s) => (
        <Chip key={`s-${s}`} label={STAGE_LABEL[s] ?? s} onRemove={() => setParam("stage", toggleCsv(filters.funnelStage?.join(","), s))} />
      ))}
      {anyActive && (
        <button onClick={() => { setParam("branch", null); setParam("stage", null); }} className="text-xs text-fg-subtle underline-offset-2 hover:text-fg hover:underline">
          Clear
        </button>
      )}
    </div>
  );
}

function CheckRow({ label, count, checked, onClick }: { label: string; count?: number; checked: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-sm hover:bg-surface-2">
      <span className="flex items-center gap-2">
        <span className={cn("flex h-4 w-4 items-center justify-center rounded border", checked ? "border-primary bg-primary text-primary-fg" : "border-border")}>
          {checked && <Check className="h-3 w-3" />}
        </span>
        {label}
      </span>
      {count != null && <span className="text-xs text-fg-subtle tnum">{count}</span>}
    </button>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border bg-primary/10 px-2 py-1 text-xs text-primary">
      {label}
      <button onClick={onRemove} className="hover:text-fg"><X className="h-3 w-3" /></button>
    </span>
  );
}
