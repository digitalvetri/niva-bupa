"use client";
import * as React from "react";
import { GitCompare, ChevronDown, X } from "lucide-react";
import { useDashboard } from "./provider";
import { cn } from "@/lib/utils";

export function ComparePicker() {
  const { snapshots, snapshotId, compareId, setParam } = useDashboard();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const ready = snapshots.filter((s) => s.status === "READY" && s.id !== snapshotId);
  const current = snapshots.find((s) => s.id === compareId);

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (ready.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn("inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm hover:bg-surface-2", compareId ? "border-primary/40 bg-primary/10 text-primary" : "bg-surface text-fg-muted")}
      >
        <GitCompare className="h-4 w-4" />
        {compareId ? `vs ${current?.fileName ?? "snapshot"}` : "Compare with…"}
        {compareId ? <X className="h-3.5 w-3.5" onClick={(e) => { e.stopPropagation(); setParam("compare", null); }} /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-72 overflow-hidden rounded-lg border bg-surface shadow-xl">
          {ready.map((s) => (
            <button key={s.id} onClick={() => { setParam("compare", s.id); setOpen(false); }} className={cn("flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface-2", s.id === compareId && "bg-surface-2")}>
              <span className="truncate">{s.fileName}</span>
              <span className="text-[11px] text-fg-subtle tabular-nums">{s._count.cases}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
