"use client";
import * as React from "react";
import { toPng } from "html-to-image";
import { Download, Loader2, ImageDown, Target } from "lucide-react";
import { Card, CardBody, Button, Input } from "@/components/ui/primitives";
import { PageHeader } from "@/components/dashboard/kpi-card";
import { LoadingBlock, EmptyState, ErrorState } from "@/components/dashboard/states";
import { useDashboard } from "@/components/dashboard/provider";
import { usePosterData } from "@/components/report/use-poster-data";
import { Poster } from "@/components/report/poster";
import type { BranchRow } from "@/lib/metrics/metrics";

export default function ReportsPage() {
  const { snapshotId, loadingSnapshots } = useDashboard();
  const [branches, setBranches] = React.useState<string[] | null>(null);
  const [downloadingAll, setDownloadingAll] = React.useState(false);
  const nodes = React.useRef<Map<string, HTMLDivElement>>(new Map());

  React.useEffect(() => {
    if (!snapshotId) return;
    fetch(`/api/metrics/premium_by_branch?snapshotId=${snapshotId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setBranches((j.data as BranchRow[]).map((b) => b.branch)));
  }, [snapshotId]);

  if (!snapshotId && !loadingSnapshots) return (<><PageHeader title="Reports" /><EmptyState title="No snapshot yet" hint="Upload a report first." /></>);
  if (!branches) return (<><PageHeader title="Reports" /><LoadingBlock className="h-64" /></>);

  const scopes: (string | null)[] = [null, ...branches];

  async function exportNode(node: HTMLDivElement, filename: string) {
    const url = await toPng(node, { pixelRatio: 2, cacheBust: true, backgroundColor: "#f4f6fa" });
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  }

  async function downloadAll() {
    setDownloadingAll(true);
    try {
      for (const scope of scopes) {
        const key = scope ?? "__territory__";
        const node = nodes.current.get(key);
        if (node) {
          await exportNode(node, `${(scope ?? "Territory").replace(/\s+/g, "_")}_performance.png`);
          await new Promise((r) => setTimeout(r, 200));
        }
      }
    } finally {
      setDownloadingAll(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Branded performance posters — one per branch + territory"
        right={
          <Button size="sm" onClick={downloadAll} disabled={downloadingAll}>
            {downloadingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageDown className="h-4 w-4" />} Download all ({scopes.length})
          </Button>
        }
      />
      <div className="space-y-6">
        {scopes.map((scope) => (
          <PosterCard
            key={scope ?? "__territory__"}
            scope={scope}
            registerNode={(el) => { const k = scope ?? "__territory__"; if (el) nodes.current.set(k, el); else nodes.current.delete(k); }}
            onDownload={exportNode}
          />
        ))}
      </div>
    </>
  );
}

function PosterCard({ scope, registerNode, onDownload }: { scope: string | null; registerNode: (el: HTMLDivElement | null) => void; onDownload: (node: HTMLDivElement, filename: string) => Promise<void> }) {
  const { snapshotId } = useDashboard();
  const { data, loading, error } = usePosterData(scope);
  const posterRef = React.useRef<HTMLDivElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [target, setTarget] = React.useState("");

  React.useEffect(() => { registerNode(posterRef.current); return () => registerNode(null); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveTarget() {
    if (!scope) return;
    const n = Number(target);
    if (!Number.isFinite(n) || n <= 0) return;
    await fetch("/api/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ branchTargets: { [scope]: n } }) });
    // reload poster data by nudging snapshotId dependency — simplest: refetch via full reload of this card
    window.location.reload();
  }

  async function download() {
    if (!posterRef.current) return;
    setBusy(true);
    try {
      await onDownload(posterRef.current, `${(scope ?? "Territory").replace(/\s+/g, "_")}_performance.png`);
    } finally {
      setBusy(false);
    }
  }

  const label = scope ?? "Territory";

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <div className="text-sm font-semibold">{label}{scope ? " branch" : " (overall)"}</div>
        <div className="flex items-center gap-2">
          {scope && (
            <div className="flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-fg-subtle" />
              <Input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="target ₹" className="h-8 w-28 text-xs" />
              <Button size="sm" variant="outline" onClick={saveTarget}>Set target</Button>
            </div>
          )}
          <Button size="sm" onClick={download} disabled={busy || !data}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} PNG
          </Button>
        </div>
      </div>
      <CardBody>
        {loading || !data ? <LoadingBlock className="h-72" /> : error ? <ErrorState message={error} /> : (
          <div className="overflow-x-auto">
            <Poster ref={posterRef} data={data} />
          </div>
        )}
      </CardBody>
    </Card>
  );
}
