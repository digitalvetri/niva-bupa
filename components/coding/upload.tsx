"use client";
import * as React from "react";
import { UploadCloud, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCoding } from "./provider";

type Result = { snapshotId: string; status: string; rowCount: number; error?: string; added?: number; updated?: number };

export function CodingUpload() {
  const { reload, setSnapshotId } = useCoding();
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [drag, setDrag] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(true); setErr(null); setMsg(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch("/api/coding/upload", { method: "POST", body: form });
      const j = (await r.json()) as Result;
      if (j.status === "FAILED") { setErr(j.error ?? "Upload failed"); return; }
      setMsg(j.error ? j.error : `Master now has ${j.rowCount} leads — ${j.added ?? 0} new, ${j.updated ?? 0} updated (statuses preserved)`);
      await reload();
      if (j.snapshotId) setSnapshotId(j.snapshotId);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn("rounded-xl border-2 border-dashed bg-surface transition-colors", drag && "border-primary bg-primary/5")}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) void upload(f); }}
    >
      <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        {busy ? (
          <><Loader2 className="h-8 w-8 animate-spin text-primary" /><div className="text-sm text-fg-muted">Importing…</div></>
        ) : (
          <>
            <UploadCloud className="h-8 w-8 text-fg-subtle" />
            <div className="text-sm text-fg">Drop the Mission 300 Excel file here, or</div>
            <button onClick={() => inputRef.current?.click()} className="rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-fg hover:bg-primary/90">Choose .xlsx file</button>
            <div className="text-xs text-fg-subtle">Each upload is a snapshot · targets read from the workbook</div>
          </>
        )}
        <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
        {msg && <div className="mt-1 inline-flex items-center gap-2 rounded-lg border border-[color:var(--won)]/30 bg-[color:var(--won)]/10 px-3 py-2 text-sm text-fg"><CheckCircle2 className="h-4 w-4 text-won" /> {msg}</div>}
        {err && <div className="mt-1 inline-flex items-center gap-2 rounded-lg border border-[color:var(--action)]/30 bg-[color:var(--action)]/10 px-3 py-2 text-sm text-fg"><AlertTriangle className="h-4 w-4 text-action" /> {err}</div>}
      </div>
    </div>
  );
}
