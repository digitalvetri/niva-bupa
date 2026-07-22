"use client";
import * as React from "react";
import { useDashboard } from "./provider";
import type { Filters } from "@/lib/metrics/types";

type State<T> = { data: T | null; loading: boolean; error: string | null };

function mergeFilters(a: Filters, b?: Filters): Filters {
  if (!b) return a;
  return { ...a, ...b };
}

/** Fetch one metric for the current snapshot + merged (global + extra) filters. */
export function useMetric<T = unknown>(name: string, extra?: Filters): State<T> & { meta: unknown } {
  const { snapshotId, filters } = useDashboard();
  const [state, setState] = React.useState<State<T>>({ data: null, loading: true, error: null });
  const [meta, setMeta] = React.useState<unknown>(null);
  const merged = mergeFilters(filters, extra);
  const key = `${name}|${snapshotId}|${JSON.stringify(merged)}`;

  React.useEffect(() => {
    if (!snapshotId) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    const params = new URLSearchParams({ snapshotId });
    if (Object.keys(merged).length) params.set("filters", JSON.stringify(merged));
    fetch(`/api/metrics/${name}?${params.toString()}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? `HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (!alive) return;
        setState({ data: json.data as T, loading: false, error: null });
        setMeta(json.meta);
      })
      .catch((e: Error) => alive && setState({ data: null, loading: false, error: e.message }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { ...state, meta };
}
