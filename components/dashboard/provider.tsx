"use client";
import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { Filters } from "@/lib/metrics/types";

export type SnapshotMeta = {
  id: string;
  fileName: string;
  status: string;
  rowCount: number;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
  _count: { issues: number; cases: number };
};

type Ctx = {
  snapshots: SnapshotMeta[];
  loadingSnapshots: boolean;
  snapshotId: string | null;
  compareId: string | null;
  filters: Filters; // parsed global filters (branch / funnelStage / productGenre)
  setParam: (key: string, value: string | null) => void;
  reloadSnapshots: () => Promise<void>;
};

const DashboardCtx = React.createContext<Ctx | null>(null);

// Comma-separated multi-value params kept in the URL so state is shareable and Phase 3's
// bot can read the exact same filter context.
const MULTI = ["branch", "stage", "product"] as const;

function parseFilters(sp: URLSearchParams): Filters {
  const f: Filters = {};
  const branch = sp.get("branch");
  const stage = sp.get("stage");
  const product = sp.get("product");
  if (branch) f.branch = branch.split(",");
  if (stage) f.funnelStage = stage.split(",");
  if (product) f.productGenre = product.split(",");
  return f;
}

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [snapshots, setSnapshots] = React.useState<SnapshotMeta[]>([]);
  const [loadingSnapshots, setLoading] = React.useState(true);

  const reloadSnapshots = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reports", { cache: "no-store" });
      const json = await res.json();
      setSnapshots(json.snapshots ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void reloadSnapshots();
  }, [reloadSnapshots]);

  const urlSnapshot = sp.get("snapshot");
  const readySnapshots = snapshots.filter((s) => s.status === "READY");
  const snapshotId = urlSnapshot ?? readySnapshots[0]?.id ?? null;
  const compareId = sp.get("compare");

  const setParam = React.useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(Array.from(sp.entries()));
      if (value == null || value === "") next.delete(key);
      else next.set(key, value);
      // Reset pagination when filters/snapshot change.
      if (key !== "page") next.delete("page");
      router.push(`${pathname}?${next.toString()}`);
    },
    [sp, router, pathname],
  );

  const filters = React.useMemo(() => parseFilters(sp), [sp]);

  const value: Ctx = {
    snapshots,
    loadingSnapshots,
    snapshotId,
    compareId,
    filters,
    setParam,
    reloadSnapshots,
  };
  return <DashboardCtx.Provider value={value}>{children}</DashboardCtx.Provider>;
}

export function useDashboard(): Ctx {
  const ctx = React.useContext(DashboardCtx);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}

export { MULTI };
