"use client";
import * as React from "react";
import { ChevronDown, Check, Database } from "lucide-react";
import { useDashboard } from "./provider";
import { cn } from "@/lib/utils";

export function SnapshotSwitcher() {
  const { snapshots, snapshotId, setParam, loadingSnapshots } = useDashboard();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const ready = snapshots.filter((s) => s.status === "READY");
  const current = ready.find((s) => s.id === snapshotId);

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-9 items-center gap-2 rounded-lg border bg-surface px-3 text-sm text-fg hover:bg-surface-2"
      >
        <Database className="h-4 w-4 text-fg-subtle" />
        <span className="max-w-[220px] truncate">
          {loadingSnapshots ? "Loading…" : current ? current.fileName : "No snapshot"}
        </span>
        <ChevronDown className="h-4 w-4 text-fg-subtle" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-80 overflow-hidden rounded-lg border bg-surface shadow-xl">
          {ready.length === 0 && <div className="px-3 py-3 text-xs text-fg-subtle">No ready snapshots yet — upload a report.</div>}
          {ready.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setParam("snapshot", s.id);
                setOpen(false);
              }}
              className={cn("flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-surface-2", s.id === snapshotId && "bg-surface-2")}
            >
              <div className="min-w-0">
                <div className="truncate text-sm text-fg">{s.fileName}</div>
                <div className="text-[11px] text-fg-subtle tnum">
                  {s._count.cases} cases · {new Date(s.createdAt).toLocaleString()}
                </div>
              </div>
              {s.id === snapshotId && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
