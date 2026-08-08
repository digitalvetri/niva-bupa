"use client";
import * as React from "react";
import { Target, CheckCircle2, Clock, Building2, Users, Copy, XCircle, Star } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/primitives";
import { PageHeader, KpiCard } from "@/components/dashboard/kpi-card";
import { LoadingBlock, LoadingCards, EmptyState } from "@/components/dashboard/states";
import { useCoding, useCodingData } from "@/components/coding/provider";
import { CodingUpload } from "@/components/coding/upload";
import type { CodingTotals, CodingRankRow } from "@/lib/coding/metrics";

export default function CodingDashboard() {
  const { snapshotId, loading } = useCoding();
  const totals = useCodingData<CodingTotals>("totals");
  const leaderboard = useCodingData<CodingRankRow[]>("leaderboard");
  const branches = useCodingData<CodingRankRow[]>("branch");

  if (!snapshotId && !loading)
    return (
      <>
        <PageHeader title="Mission 300 · Coding" subtitle="Competitor-agent recruitment command center" />
        <Card><CardBody><div className="mb-4 text-sm text-fg-muted">Upload the Mission 300 workbook to begin.</div><CodingUpload /></CardBody></Card>
      </>
    );

  const t = totals.data;
  const achievement = t ? Math.min(100, t.achievement_pct) : 0;

  return (
    <>
      <PageHeader title="Mission 300 · Coding" subtitle="Competitor-agent recruitment command center" />

      {!t ? <LoadingCards /> : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard label="Mission Target" value={String(t.mission)} sub="agents to recruit" accent="neutral" />
            <KpiCard label="Verified" value={String(t.verified)} sub="confirmed recruits" accent="won" />
            <KpiCard label="Pending" value={String(t.pending)} sub="to reach target" accent="action" />
            <KpiCard label="Achievement" value={`${t.achievement_pct}%`} sub={`${t.verified}/${t.mission}`} accent="primary" />
          </div>

          {/* Mission progress */}
          <div className="mt-4 rounded-xl border bg-surface p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 font-semibold text-fg"><Target className="h-4 w-4 text-primary" /> Mission Progress</span>
              <span className="text-fg-muted"><span className="font-bold text-fg">{t.verified}</span> verified of {t.mission}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(1, achievement)}%` }} /></div>
            <div className="mt-1.5 text-xs font-bold text-primary">{t.achievement_pct}% achieved</div>
          </div>

          {/* Secondary stats */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <MiniStat icon={Users} label="Identified" value={t.identified} tone="text-primary" />
            <MiniStat icon={Star} label="Today" value={t.today_collection} tone="text-fg" sub={t.today_date ?? undefined} />
            <MiniStat icon={Copy} label="Duplicate" value={t.duplicate} tone="text-pending" />
            <MiniStat icon={XCircle} label="Invalid" value={t.invalid} tone="text-action" />
            <MiniStat icon={Building2} label="Branches" value={t.active_branches} tone="text-fg" />
            <MiniStat icon={CheckCircle2} label="Total Leads" value={t.total} tone="text-fg" />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Top Territory Heads</CardTitle></CardHeader>
              <CardBody>
                {leaderboard.loading || !leaderboard.data ? <LoadingBlock className="h-40" /> :
                  <CountBars items={leaderboard.data.slice(0, 8).map((r) => ({ label: r.name, total: r.total, verified: r.verified }))} />}
              </CardBody>
            </Card>
            <Card>
              <CardHeader><CardTitle>Top Branches</CardTitle></CardHeader>
              <CardBody>
                {branches.loading || !branches.data ? <LoadingBlock className="h-40" /> :
                  <CountBars items={branches.data.slice(0, 8).map((r) => ({ label: r.name, total: r.total, verified: r.verified }))} />}
              </CardBody>
            </Card>
          </div>

          <div className="mt-4">
            <Card><CardHeader><CardTitle>Import a new day&apos;s file</CardTitle></CardHeader><CardBody><CodingUpload /></CardBody></Card>
          </div>
        </>
      )}
    </>
  );
}

function CountBars({ items }: { items: { label: string; total: number; verified: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.total));
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-3 text-sm">
          <div className="w-28 shrink-0 truncate text-fg-muted sm:w-36" title={it.label}>{it.label}</div>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(3, (it.total / max) * 100)}%` }} />
          </div>
          <div className="w-20 shrink-0 text-right tabular-nums"><span className="font-bold text-fg">{it.total}</span> <span className="text-xs text-fg-subtle">leads</span></div>
          <div className="w-14 shrink-0 text-right text-xs font-semibold tabular-nums text-won">{it.verified} ✓</div>
        </div>
      ))}
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, tone, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; tone: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-surface p-3">
      <div className="flex items-center gap-1.5 text-xs text-fg-muted"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className={`mt-1 text-2xl font-bold ${tone}`}>{value}</div>
      {sub && <div className="text-[10px] text-fg-subtle">{sub}</div>}
    </div>
  );
}
