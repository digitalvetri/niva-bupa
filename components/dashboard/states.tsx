"use client";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { Skeleton, Button } from "@/components/ui/primitives";

export function LoadingCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-28" />
      ))}
    </div>
  );
}

export function LoadingBlock({ className = "h-64" }: { className?: string }) {
  return <Skeleton className={className} />;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-[color:var(--action)]/30 bg-[color:var(--action)]/5 p-8 text-center">
      <AlertTriangle className="h-6 w-6 text-action" />
      <div className="text-sm text-fg">Couldn’t load this view</div>
      <div className="max-w-md text-xs text-fg-muted">{message}</div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-10 text-center">
      <Inbox className="h-6 w-6 text-fg-subtle" />
      <div className="text-sm text-fg-muted">{title}</div>
      {hint && <div className="text-xs text-fg-subtle">{hint}</div>}
    </div>
  );
}

export function Provenance({ rows, snapshotId, note }: { rows: number; snapshotId: string | null; note?: string }) {
  return (
    <div className="mt-2 inline-flex items-center gap-2 rounded-md border bg-surface-2 px-2 py-1 text-[11px] text-fg-subtle">
      <span className="tnum">{rows} rows</span>
      {note && <><span>·</span><span>{note}</span></>}
      <span>·</span>
      <span>snapshot {snapshotId ? snapshotId.slice(0, 8) : "—"}</span>
    </div>
  );
}
