"use client";
import * as React from "react";
import { useDashboard } from "./provider";
import type { CompareResult } from "@/lib/metrics/compare";

/** Fetch a metric diffed against the compare snapshot (when one is selected). */
export function useCompare(name: string): { data: CompareResult | null; loading: boolean } {
  const { snapshotId, compareId, filters } = useDashboard();
  const [data, setData] = React.useState<CompareResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const key = `${name}|${snapshotId}|${compareId}|${JSON.stringify(filters)}`;

  React.useEffect(() => {
    if (!snapshotId || !compareId) { setData(null); return; }
    let alive = true;
    setLoading(true);
    const params = new URLSearchParams({ snapshotId, compareSnapshotId: compareId });
    if (Object.keys(filters).length) params.set("filters", JSON.stringify(filters));
    fetch(`/api/metrics/${name}?${params.toString()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (!alive) return;
        // Only accept an actual compare result (has `cells`). An error response, or a plain
        // metric result (e.g. when compare == active snapshot), has no cells -> treat as none.
        const d = json?.data;
        setData(d && Array.isArray(d.cells) ? (d as CompareResult) : null);
      })
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [key]);

  return { data, loading };
}
