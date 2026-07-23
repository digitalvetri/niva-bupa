"use client";
import * as React from "react";
import { toPng } from "html-to-image";
import { Download, Loader2, ImageDown, Target, Sparkles, RefreshCw, Settings2 } from "lucide-react";
import Link from "next/link";
import { Card, CardBody, Button, Input } from "@/components/ui/primitives";
import { PageHeader } from "@/components/dashboard/kpi-card";
import { LoadingBlock, EmptyState, ErrorState } from "@/components/dashboard/states";
import { useDashboard } from "@/components/dashboard/provider";
import { usePosterData } from "@/components/report/use-poster-data";
import { Poster } from "@/components/report/poster";
import type { BranchRow } from "@/lib/metrics/metrics";

/** Shared AI-background state for all posters (one generation, reused across scopes). */
function useBackground() {
  const [dataUrl, setDataUrl] = React.useState<string | null>(null);
  const [configured, setConfigured] = React.useState<boolean | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [on, setOn] = React.useState(true);

  const fetchBg = React.useCallback(async (refresh: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/report/background", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refresh }) });
      const j = await r.json();
      setConfigured(Boolean(j.configured));
      if (j.dataUrl) {
        setDataUrl(j.dataUrl);
        setError(null); // a good image supersedes any prior transient failure
      } else if (j.error) {
        // Only surface the error if we have nothing to show; otherwise keep the existing art.
        setDataUrl((cur) => { if (!cur) setError(j.error); return cur; });
      }
    } catch (e) {
      setDataUrl((cur) => { if (!cur) setError((e as Error).message); return cur; });
    } finally {
      setBusy(false);
    }
  }, []);

  React.useEffect(() => { fetchBg(false); }, [fetchBg]);

  return { dataUrl: on ? dataUrl : null, rawUrl: dataUrl, configured, busy, error, on, setOn, regenerate: () => fetchBg(true) };
}

export default function ReportsPage() {
  const { snapshotId, loadingSnapshots } = useDashboard();
  const [branches, setBranches] = React.useState<string[] | null>(null);
  const [downloadingAll, setDownloadingAll] = React.useState(false);
  const nodes = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const bg = useBackground();

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
          <div className="flex flex-wrap items-center gap-2">
            {bg.configured && (
              <>
                <label className="flex items-center gap-1.5 text-xs text-fg-muted">
                  <input type="checkbox" checked={bg.on} onChange={(e) => bg.setOn(e.target.checked)} className="accent-primary" />
                  <Sparkles className="h-3.5 w-3.5" /> AI background
                </label>
                <Button variant="outline" size="sm" onClick={bg.regenerate} disabled={bg.busy}>
                  {bg.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Regenerate
                </Button>
              </>
            )}
            <Button size="sm" onClick={downloadAll} disabled={downloadingAll}>
              {downloadingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageDown className="h-4 w-4" />} Download all ({scopes.length})
            </Button>
          </div>
        }
      />
      {bg.configured === false && (
        <Card className="mb-4 border-primary/30">
          <CardBody className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="flex items-center gap-2 text-sm text-fg-muted">
              <Sparkles className="h-4 w-4 text-primary" />
              Add an image-generation key to render an AI-designed branded background behind these posters. Numbers stay exact — the art is decoration only.
            </div>
            <Link href="/settings"><Button size="sm" variant="outline"><Settings2 className="h-3.5 w-3.5" /> Configure in Settings</Button></Link>
          </CardBody>
        </Card>
      )}
      {bg.configured && bg.error && (
        <Card className="mb-4 border-red-500/30">
          <CardBody className="py-3 text-sm text-red-500">Image generation failed: {bg.error}. Posters render without the AI background.</CardBody>
        </Card>
      )}
      <div className="space-y-6">
        {scopes.map((scope) => (
          <PosterCard
            key={scope ?? "__territory__"}
            scope={scope}
            backgroundUrl={bg.dataUrl}
            registerNode={(el) => { const k = scope ?? "__territory__"; if (el) nodes.current.set(k, el); else nodes.current.delete(k); }}
            onDownload={exportNode}
          />
        ))}
      </div>
    </>
  );
}

// Fit the fixed-width (1080px) poster into whatever width is available, scaling down only.
// The poster node itself stays 1080px so PNG export is always full-resolution; only the on-screen
// preview is transformed. Returns the frame ref to measure and the computed scale.
function useFitScale(natural: number) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const compute = () => { const w = el.clientWidth; if (w > 0) setScale(Math.min(1, w / natural)); };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [natural]);
  return { ref, scale };
}

function PosterCard({ scope, backgroundUrl, registerNode, onDownload }: { scope: string | null; backgroundUrl: string | null; registerNode: (el: HTMLDivElement | null) => void; onDownload: (node: HTMLDivElement, filename: string) => Promise<void> }) {
  const { snapshotId } = useDashboard();
  const { data, loading, error } = usePosterData(scope);
  const posterRef = React.useRef<HTMLDivElement>(null);
  const { ref: frameRef, scale } = useFitScale(1080);
  const [posterH, setPosterH] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [target, setTarget] = React.useState("");

  React.useEffect(() => { registerNode(posterRef.current); return () => registerNode(null); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track the poster's natural (unscaled) height so the scaled frame reserves the right space.
  React.useLayoutEffect(() => {
    const h = posterRef.current?.offsetHeight ?? 0;
    setPosterH((prev) => (Math.abs(prev - h) > 1 ? h : prev));
  });

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
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5 sm:px-4">
        <div className="text-sm font-semibold">{label}{scope ? " branch" : " (overall)"}</div>
        <div className="flex flex-wrap items-center gap-2">
          {scope && (
            <div className="flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-fg-subtle" />
              <Input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="target ₹" className="h-8 w-24 text-xs sm:w-28" />
              <Button size="sm" variant="outline" onClick={saveTarget}>Set target</Button>
            </div>
          )}
          <Button size="sm" onClick={download} disabled={busy || !data}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} PNG
          </Button>
        </div>
      </div>
      <CardBody className="p-2 sm:p-4">
        {/* frame is ALWAYS rendered so useFitScale can measure it and attach its ResizeObserver;
            the poster inside is conditional. Height reserves the scaled poster's space. */}
        <div ref={frameRef} style={{ width: "100%", overflow: "hidden", height: data && posterH ? Math.round(posterH * scale) : undefined }}>
          {loading || !data ? <LoadingBlock className="h-72" /> : error ? <ErrorState message={error} /> : (
            <div style={{ width: 1080, transformOrigin: "top left", transform: `scale(${scale})` }}>
              <Poster ref={posterRef} data={data} backgroundUrl={backgroundUrl} />
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
