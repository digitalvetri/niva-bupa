import * as React from "react";
import { DashboardProvider } from "@/components/dashboard/provider";
import { Shell } from "@/components/dashboard/shell";

// Dashboard reads live snapshot/filter state from the URL — always dynamic.
export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <React.Suspense fallback={<div className="p-6 text-sm text-fg-muted">Loading…</div>}>
      <DashboardProvider>
        <Shell>{children}</Shell>
      </DashboardProvider>
    </React.Suspense>
  );
}
