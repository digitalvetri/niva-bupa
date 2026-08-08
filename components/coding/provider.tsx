"use client";
import * as React from "react";

export type CodingSnap = { id: string; fileName: string; status: string; rowCount: number; missionTarget: number; createdAt: string };

type Ctx = {
  snapshots: CodingSnap[];
  snapshotId: string | null;
  setSnapshotId: (id: string) => void;
  loading: boolean;
  reload: () => Promise<CodingSnap[]>;
};
const CodingCtx = React.createContext<Ctx | null>(null);

export function CodingProvider({ children }: { children: React.ReactNode }) {
  const [snapshots, setSnapshots] = React.useState<CodingSnap[]>([]);
  const [snapshotId, setSnapshotId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const j = await fetch("/api/coding/snapshots", { cache: "no-store" }).then((r) => r.json());
      const snaps: CodingSnap[] = j.snapshots ?? [];
      setSnapshots(snaps);
      setSnapshotId((prev) => prev ?? snaps.find((s) => s.status === "READY")?.id ?? null);
      return snaps;
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void reload(); }, [reload]);

  return <CodingCtx.Provider value={{ snapshots, snapshotId, setSnapshotId, loading, reload }}>{children}</CodingCtx.Provider>;
}

export function useCoding(): Ctx {
  const ctx = React.useContext(CodingCtx);
  if (!ctx) throw new Error("useCoding must be used within CodingProvider");
  return ctx;
}

/** Fetch one coding metric for the active snapshot. */
export function useCodingData<T>(metric: string, params: Record<string, string> = {}): { data: T | null; loading: boolean } {
  const { snapshotId } = useCoding();
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(false);
  const key = JSON.stringify(params);
  React.useEffect(() => {
    if (!snapshotId) { setData(null); return; }
    let alive = true;
    setLoading(true);
    const p = new URLSearchParams({ metric, snapshotId, ...params });
    fetch(`/api/coding/data?${p.toString()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { data: null }))
      .then((j) => { if (alive) setData(j.data as T); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotId, metric, key]);
  return { data, loading };
}
