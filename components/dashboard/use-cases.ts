"use client";
import * as React from "react";
import { useDashboard } from "./provider";
import type { CasesResult, CaseSort } from "@/lib/cases";

export type CasesUiQuery = { page: number; pageSize: number; sort: CaseSort; dir: "asc" | "desc"; search: string };

export function useCases(q: CasesUiQuery): { data: CasesResult | null; loading: boolean; error: string | null } {
  const { snapshotId, filters } = useDashboard();
  const [data, setData] = React.useState<CasesResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const key = `${snapshotId}|${JSON.stringify(filters)}|${q.page}|${q.pageSize}|${q.sort}|${q.dir}|${q.search}`;

  React.useEffect(() => {
    if (!snapshotId) { setData(null); setLoading(false); return; }
    let alive = true;
    setLoading(true);
    const params = new URLSearchParams({ snapshotId, page: String(q.page), pageSize: String(q.pageSize), sort: q.sort, dir: q.dir });
    if (Object.keys(filters).length) params.set("filters", JSON.stringify(filters));
    if (q.search.trim()) params.set("search", q.search.trim());
    fetch(`/api/cases?${params.toString()}`, { cache: "no-store" })
      .then(async (r) => { if (!r.ok) throw new Error((await r.json()).error ?? `HTTP ${r.status}`); return r.json(); })
      .then((json) => { if (alive) { setData(json); setError(null); } })
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data, loading, error };
}

/** Build the /api/cases CSV-export URL for the current snapshot + filters (server streams the filtered view). */
export function useCasesExportUrl(sort: CaseSort, dir: "asc" | "desc", search: string): string | null {
  const { snapshotId, filters } = useDashboard();
  if (!snapshotId) return null;
  const params = new URLSearchParams({ snapshotId, sort, dir, format: "csv" });
  if (Object.keys(filters).length) params.set("filters", JSON.stringify(filters));
  if (search.trim()) params.set("search", search.trim());
  return `/api/cases/export?${params.toString()}`;
}
