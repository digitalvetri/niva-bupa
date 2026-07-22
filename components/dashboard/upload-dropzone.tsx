"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import { useDashboard } from "./provider";
import { cn } from "@/lib/utils";

type Result = { snapshotId: string; status: string; rowCount: number; issueCount: number; durationMs: number; error?: string };

export function UploadDropzone() {
  const router = useRouter();
  const { reloadSnapshots, setParam } = useDashboard();
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<Result | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [drag, setDrag] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      if (!/\.csv$/i.test(file.name)) throw new Error("Please upload a .csv New Business report.");
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/reports/upload", { method: "POST", body: form });
      const json = (await res.json()) as Result & { error?: string };
      if (!res.ok && res.status !== 200) {
        setError(json.error ?? `Upload failed (HTTP ${res.status})`);
        setResult(json.status ? json : null);
      } else {
        setResult(json);
        await reloadSnapshots();
        if (json.status === "READY") {
          setParam("snapshot", json.snapshotId);
          setTimeout(() => router.push(`/pulse?snapshot=${json.snapshotId}`), 600);
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      className={cn("border-2 border-dashed transition-colors", drag && "border-primary bg-primary/5")}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) void upload(f); }}
    >
      <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        {busy ? (
          <><Loader2 className="h-8 w-8 animate-spin text-primary" /><div className="text-sm text-fg-muted">Ingesting…</div></>
        ) : (
          <>
            <UploadCloud className="h-8 w-8 text-fg-subtle" />
            <div className="text-sm text-fg">Drop a New Business CSV here, or</div>
            <button onClick={() => inputRef.current?.click()} className="rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-fg hover:bg-primary/90">
              Choose file
            </button>
            <div className="text-xs text-fg-subtle">UTF-8 CSV up to 20 MB · immutable snapshot · re-uploads deduped</div>
          </>
        )}
        <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />

        {result && (
          <div className={cn("mt-2 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm", result.status === "READY" ? "border-[color:var(--won)]/30 bg-[color:var(--won)]/10 text-fg" : "border-[color:var(--action)]/30 bg-[color:var(--action)]/10 text-fg")}>
            {result.status === "READY" ? <CheckCircle2 className="h-4 w-4 text-won" /> : <AlertTriangle className="h-4 w-4 text-action" />}
            {result.error ? result.error : `${result.status} · ${result.rowCount} cases · ${result.issueCount} issue(s) · ${result.durationMs}ms`}
          </div>
        )}
        {error && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-[color:var(--action)]/30 bg-[color:var(--action)]/10 px-3 py-2 text-sm text-fg">
            <AlertTriangle className="h-4 w-4 text-action" /> {error}
          </div>
        )}
      </div>
    </Card>
  );
}
