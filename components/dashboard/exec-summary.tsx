"use client";
import * as React from "react";
import { Sparkles, ShieldCheck } from "lucide-react";
import { useDashboard } from "./provider";

type SummaryResp = { summary: string; generatedBy: "ai" | "rules" };

// Reveal text progressively (finishes in ~1s regardless of length) for an "AI is writing" feel.
function useTypewriter(text: string) {
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    setN(0);
    if (!text) return;
    const step = Math.max(1, Math.round(text.length / 80));
    const id = setInterval(() => {
      setN((v) => {
        const nv = v + step;
        if (nv >= text.length) { clearInterval(id); return text.length; }
        return nv;
      });
    }, 14);
    return () => clearInterval(id);
  }, [text]);
  return { shown: text.slice(0, n), done: n >= text.length };
}

export function ExecSummary() {
  const { snapshotId, filters } = useDashboard();
  const [data, setData] = React.useState<SummaryResp | null>(null);
  const [loading, setLoading] = React.useState(false);
  const filterKey = JSON.stringify(filters);

  React.useEffect(() => {
    if (!snapshotId) { setData(null); return; }
    let alive = true;
    setLoading(true);
    setData(null);
    const p = new URLSearchParams({ snapshotId });
    if (Object.keys(filters).length) p.set("filters", filterKey);
    fetch(`/api/insights/summary?${p.toString()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: SummaryResp | null) => { if (alive && j?.summary) setData(j); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotId, filterKey]);

  const { shown, done } = useTypewriter(data?.summary ?? "");
  if (!snapshotId) return null;

  return (
    <div className="relative mb-4 overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-surface to-surface p-4 shadow-sm sm:p-5">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="text-sm font-semibold text-fg">Territory Briefing</div>
        {data && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-[10px] text-fg-subtle">
            <ShieldCheck className="h-3 w-3" /> {data.generatedBy === "ai" ? "AI-generated" : "Auto-generated"} · verified numbers
          </span>
        )}
      </div>

      {loading || !data ? (
        <div className="space-y-2">
          <div className="h-3.5 w-[92%] animate-pulse rounded bg-surface-2" />
          <div className="h-3.5 w-[85%] animate-pulse rounded bg-surface-2" />
          <div className="h-3.5 w-[70%] animate-pulse rounded bg-surface-2" />
        </div>
      ) : (
        <p className="text-[15px] leading-relaxed text-fg">
          {shown}
          {!done && <span className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[2px] animate-pulse bg-primary align-middle" />}
        </p>
      )}
    </div>
  );
}
