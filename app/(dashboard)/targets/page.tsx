"use client";
import * as React from "react";
import { Save, Loader2, CheckCircle2, RotateCcw, Target } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle, Button } from "@/components/ui/primitives";
import { PageHeader } from "@/components/dashboard/kpi-card";
import { LoadingBlock } from "@/components/dashboard/states";
import { useDashboard } from "@/components/dashboard/provider";
import { DEFAULT_BRANCH_GROUPS } from "@/lib/branch-group";
import {
  MONTHS, TARGET_BRANCHES, CATEGORIES, defaultRotnTargets, fyTotal, ytdTarget, territoryFy, territoryYtd,
  type RotnTargets, type CategoryKey,
} from "@/lib/targets/rotn";
import { Loader2 as Spin, CheckCircle2 as Check } from "lucide-react";

const fmtMoneyCr = (lakhs: number) => `₹${(lakhs / 100).toFixed(2)} Cr`;
const fmtNum = (n: number) => (Math.round(n * 100) / 100).toLocaleString("en-IN");

export default function TargetsPage() {
  const [t, setT] = React.useState<RotnTargets | null>(null);
  const [cat, setCat] = React.useState<CategoryKey>("GWP");
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/targets", { cache: "no-store" }).then((r) => r.json()).then((j) => setT(j.targets ?? defaultRotnTargets())).catch(() => setT(defaultRotnTargets()));
  }, []);

  function setCell(branch: string, mi: number, value: string) {
    setT((prev) => {
      if (!prev) return prev;
      const catData = { ...(prev.data[cat] ?? {}) };
      const arr = [...(catData[branch] ?? Array(12).fill(0))];
      arr[mi] = value === "" ? 0 : Number(value);
      catData[branch] = arr;
      return { ...prev, data: { ...prev.data, [cat]: catData } };
    });
    setSaved(false);
  }

  async function save() {
    if (!t) return;
    setSaving(true); setSaved(false);
    try {
      const r = await fetch("/api/targets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(t) });
      const j = await r.json();
      if (j.targets) setT(j.targets);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  if (!t) return (<><PageHeader title="Territory Targets" /><LoadingBlock className="h-64" /></>);

  const meta = CATEGORIES.find((c) => c.key === cat)!;
  const isMoney = !!meta.isMoney;

  return (
    <>
      <PageHeader
        title="Territory Targets"
        subtitle={`ROTN FY ${t.fiscalYear} · set branch × month targets — reflected in Business & Coding achievement`}
        right={
          <div className="flex flex-wrap items-center gap-2">
            {saved && <span className="inline-flex items-center gap-1 text-sm text-won"><CheckCircle2 className="h-4 w-4" /> Saved</span>}
            <Button size="sm" variant="outline" onClick={() => { setT(defaultRotnTargets()); setSaved(false); }}><RotateCcw className="h-3.5 w-3.5" /> Reset to poster</Button>
            <Button size="sm" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save targets</Button>
          </div>
        }
      />

      {/* Annual territory totals */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {CATEGORIES.map((c) => (
          <button key={c.key} onClick={() => setCat(c.key)} className={`rounded-xl border p-3 text-left transition ${cat === c.key ? "border-primary bg-primary/5" : "bg-surface hover:bg-surface-2"}`}>
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-fg-muted"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: c.accent }} /> {c.label}</div>
            <div className="mt-1 text-xl font-bold text-fg">{c.isMoney ? fmtMoneyCr(territoryFy(t, c.key)) : fmtNum(territoryFy(t, c.key))}</div>
            <div className="text-[10px] text-fg-subtle">annual target</div>
          </button>
        ))}
      </div>

      {/* Months-closed selector */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border bg-surface px-4 py-3 text-sm">
        <Target className="h-4 w-4 text-primary" />
        <span className="text-fg-muted">Actuals entered through:</span>
        <select value={t.monthsClosed} onChange={(e) => { setT({ ...t, monthsClosed: Number(e.target.value) }); setSaved(false); }} className="h-8 rounded-lg border bg-surface px-2 text-sm text-fg focus:border-primary focus:outline-none">
          <option value={0}>Not started</option>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <span className="text-xs text-fg-subtle">— YTD target for {meta.label}: <strong className="text-fg">{isMoney ? fmtMoneyCr(territoryYtd(t, cat)) : fmtNum(territoryYtd(t, cat))}</strong> (drives achievement %)</span>
      </div>

      {/* Editable grid */}
      <Card className="mt-4">
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-white" style={{ background: meta.accent }}>
                <th className="sticky left-0 z-10 px-3 py-2 text-left" style={{ background: meta.accent }}>Branch</th>
                {MONTHS.map((m) => <th key={m} className="px-1.5 py-2 text-center font-semibold">{m}</th>)}
                <th className="px-2 py-2 text-right">FY Total</th>
                <th className="px-2 py-2 text-right">YTD</th>
              </tr>
            </thead>
            <tbody>
              {TARGET_BRANCHES.map((b) => (
                <tr key={b} className="border-b">
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-surface px-3 py-1.5 font-medium">{b}</td>
                  {MONTHS.map((m, mi) => (
                    <td key={m} className="px-0.5 py-1">
                      <input
                        type="number"
                        value={t.data[cat]?.[b]?.[mi] ?? 0}
                        onChange={(e) => setCell(b, mi, e.target.value)}
                        step={isMoney ? "0.01" : "1"}
                        className="h-8 w-14 rounded border bg-surface-2 px-1 text-right text-xs tabular-nums text-fg focus:border-primary focus:outline-none"
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1 text-right font-bold tabular-nums">{fmtNum(fyTotal(t, cat, b))}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-fg-muted">{fmtNum(ytdTarget(t, cat, b))}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-border font-bold" style={{ background: `${meta.accent}12` }}>
                <td className="sticky left-0 z-10 px-3 py-2" style={{ background: `${meta.accent}12` }}>Territory Total</td>
                {MONTHS.map((_, mi) => (
                  <td key={mi} className="px-1.5 py-2 text-center text-xs tabular-nums">{fmtNum(TARGET_BRANCHES.reduce((s, b) => s + (t.data[cat]?.[b]?.[mi] ?? 0), 0))}</td>
                ))}
                <td className="px-2 py-2 text-right tabular-nums">{fmtNum(territoryFy(t, cat))}</td>
                <td className="px-2 py-2 text-right tabular-nums">{fmtNum(territoryYtd(t, cat))}</td>
              </tr>
            </tbody>
          </table>
        </CardBody>
      </Card>

      <p className="mt-3 text-xs text-fg-subtle">Seeded from your FY {t.fiscalYear} target poster. Edit any cell; FY totals recompute live. Saving pushes the GWP target into the New Business achievement, and the Agent Recruitment target into the Coding dashboard.</p>

      <BranchGrouping />
    </>
  );
}

// Roll up report (login) branches into a target branch, e.g. Trichy → Thanjavur, Chennai → Hosur.
function BranchGrouping() {
  const { snapshotId } = useDashboard();
  const [nbBranches, setNbBranches] = React.useState<string[]>([]);
  const [groups, setGroups] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/settings", { cache: "no-store" }).then((r) => r.json()).then((s) => setGroups({ ...DEFAULT_BRANCH_GROUPS, ...(s.branchGroups ?? {}) })).catch(() => setGroups(DEFAULT_BRANCH_GROUPS));
  }, []);
  React.useEffect(() => {
    if (!snapshotId) return;
    fetch(`/api/metrics/premium_by_branch?snapshotId=${snapshotId}`, { cache: "no-store" }).then((r) => r.json()).then((j) => setNbBranches((j.data ?? []).map((b: { branch: string }) => b.branch))).catch(() => {});
  }, [snapshotId]);

  async function save() {
    setSaving(true); setSaved(false);
    try {
      const map: Record<string, string> = {};
      for (const b of nbBranches) map[b] = groups[b] ?? b;
      await fetch("/api/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ branchGroups: map }) });
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  if (!snapshotId) return null;

  return (
    <Card className="mt-6">
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Branch grouping</CardTitle>
        <div className="flex items-center gap-2">
          {saved && <span className="inline-flex items-center gap-1 text-sm text-won"><Check className="h-4 w-4" /> Saved</span>}
          <Button size="sm" onClick={save} disabled={saving}>{saving ? <Spin className="h-3.5 w-3.5 animate-spin" /> : null} Save grouping</Button>
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        <p className="text-sm text-fg-muted">Roll a report branch up into a target branch — its business & recruitment count under the parent and are measured against the parent&apos;s target (e.g. <strong className="text-fg">Trichy → Thanjavur</strong>, <strong className="text-fg">Chennai → Hosur</strong>).</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {nbBranches.map((b) => (
            <div key={b} className="flex items-center gap-2 rounded-lg border bg-surface px-3 py-2">
              <span className="flex-1 truncate text-sm font-medium">{b}</span>
              <span className="text-fg-subtle">→</span>
              <select value={groups[b] ?? b} onChange={(e) => { setGroups({ ...groups, [b]: e.target.value }); setSaved(false); }} className="h-8 rounded-lg border bg-surface-2 px-2 text-sm text-fg focus:border-primary focus:outline-none">
                {[b, ...TARGET_BRANCHES.filter((x) => x !== b)].map((opt) => <option key={opt} value={opt}>{opt === b ? `${opt} (itself)` : opt}</option>)}
              </select>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
