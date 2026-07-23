"use client";
import * as React from "react";
import { NivaBupaLogo } from "@/components/brand/niva-bupa-logo";
import { formatINR, formatINRFull, formatPct } from "@/lib/metrics/format";
import { STAGE_LABEL } from "@/lib/theme";
import type { PosterData } from "./use-poster-data";

// Fixed brand palette — the poster is theme-independent so exported PNGs look identical anywhere.
const C = {
  navy: "#0b1f4d",
  navy2: "#13306e",
  ink: "#1a2233",
  muted: "#5a647a",
  line: "#e4e8f0",
  bg: "#f4f6fa",
  blue: "#1e50a0",
  green: "#16a34a",
  amber: "#d97706",
  red: "#dc2626",
  card: "#ffffff",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getUTCDate().toString().padStart(2, "0")} ${d.toLocaleString("en", { month: "short", timeZone: "UTC" })}`;
}

function achievementColor(pct: number) {
  return pct >= 70 ? C.green : pct >= 30 ? C.amber : C.red;
}

export const Poster = React.forwardRef<HTMLDivElement, { data: PosterData }>(function Poster({ data }, ref) {
  const t = data.totals;
  const bizDays = data.daily.filter((d) => d.logged > 0).length;
  const zeroDays = data.daily.filter((d) => d.logged === 0).length;
  const topDay = [...data.daily].sort((a, b) => b.logged - a.logged)[0];
  const maxDaily = Math.max(1, ...data.daily.map((d) => d.logged));
  const achievement = data.target ? formatPct(t.issued_premium, data.target) : null;
  const observations = buildObservations(data, { bizDays, zeroDays, topDay });

  return (
    <div ref={ref} style={{ width: 1040, background: C.bg, color: C.ink, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: C.navy, padding: "18px 24px", display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ background: "#fff", borderRadius: 10, padding: "8px 10px" }}>
          <NivaBupaLogo className="" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#fff", fontSize: 26, fontWeight: 800, letterSpacing: 0.5 }}>
            {data.branch ? `${data.scopeLabel.toUpperCase()} — BRANCH PERFORMANCE` : "TERRITORY PERFORMANCE ANALYSIS"}
          </div>
          <div style={{ display: "inline-block", marginTop: 6, background: "#f7c948", color: C.navy, fontWeight: 700, fontSize: 13, padding: "3px 12px", borderRadius: 20 }}>
            PERIOD: {fmtDate(data.period.start)} – {fmtDate(data.period.end)}
          </div>
        </div>
        {achievement != null ? (
          <Gauge label="Business Achievement" pct={achievement} sub={`${formatINR(t.issued_premium)} / ${formatINR(data.target!)}`} />
        ) : (
          <div style={{ textAlign: "right", color: "#cdd7ee" }}>
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>Total Business</div>
            <div style={{ color: "#fff", fontSize: 30, fontWeight: 800 }}>{formatINR(t.logged_premium)}</div>
          </div>
        )}
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, padding: "16px 24px 4px" }}>
        <Kpi label="Logged Premium" value={formatINR(t.logged_premium)} sub={`${t.case_count} cases`} bar={C.blue} />
        <Kpi label="Issued Premium" value={formatINR(t.issued_premium)} sub={`${t.issued_count} issued`} bar={C.green} />
        <Kpi label="Conversion" value={`${t.conversion_pct}%`} sub={`${t.issued_count}/${t.case_count}`} bar={C.navy2} />
        <Kpi label="Stuck Premium" value={formatINR(t.stuck_premium)} sub={`${t.stuck_count} pending`} bar={C.red} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 16, padding: "10px 24px 4px" }}>
        {/* LEFT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {data.branch ? (
            <Section title="Business logged — day-wise">
              <DayWise daily={data.daily} />
              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <MiniStat label="Business days" value={String(bizDays)} />
                <MiniStat label="Zero days" value={String(zeroDays)} color={C.red} />
                <MiniStat label="Avg / biz day" value={formatINR(bizDays ? t.logged_premium / bizDays : 0)} />
              </div>
            </Section>
          ) : (
            <Section title="Branch performance summary">
              <BranchTable branches={data.branches} />
            </Section>
          )}
          <Section title="Daily business trend">
            <TrendBars daily={data.daily} max={maxDaily} />
          </Section>
        </div>

        {/* RIGHT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Section title="Pipeline / funnel">
            <BarRows items={data.funnel.map((f) => ({ label: STAGE_LABEL[f.stage] ?? f.stage, value: f.logged, count: f.cases }))} />
          </Section>
          <Section title={data.branch ? "Top agents" : "Top agents (territory)"}>
            <BarRows items={data.agents.map((a) => ({ label: a.agentName, value: a.logged, count: a.cases }))} />
          </Section>
          <Section title="Product mix">
            <BarRows items={data.products.map((p) => ({ label: p.key, value: p.logged, count: p.cases }))} />
          </Section>
        </div>
      </div>

      {/* Observations */}
      <div style={{ padding: "6px 24px 4px" }}>
        <Section title="Key observations">
          <ul style={{ margin: 0, paddingLeft: 18, columns: 2, columnGap: 28, fontSize: 13, lineHeight: 1.6, color: C.ink }}>
            {observations.map((o, i) => <li key={i} style={{ marginBottom: 4 }}>{o}</li>)}
          </ul>
        </Section>
      </div>

      {/* Footer */}
      <div style={{ background: C.navy, color: "#cdd7ee", fontSize: 12, padding: "10px 24px", marginTop: 8, display: "flex", justifyContent: "space-between" }}>
        <span>Territory IQ · Niva Bupa Health Insurance</span>
        <span>Generated from uploaded New Business report{achievement == null ? " · set a branch target for achievement %" : ""}</span>
      </div>
    </div>
  );
});

// ── pieces ───────────────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ background: C.navy2, color: "#fff", fontWeight: 700, fontSize: 13, padding: "7px 12px" }}>{title}</div>
      <div style={{ padding: 12 }}>{children}</div>
    </div>
  );
}

function Kpi({ label, value, sub, bar }: { label: string; value: string; sub: string; bar: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: bar }} />
      <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.6, color: C.muted, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: C.ink, marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: 11, color: C.muted }}>{sub}</div>
    </div>
  );
}

function MiniStat({ label, value, color = C.ink }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ flex: 1, background: C.bg, borderRadius: 8, padding: "6px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 15, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
    </div>
  );
}

function Gauge({ label, pct, sub }: { label: string; pct: number; sub: string }) {
  const color = achievementColor(pct);
  return (
    <div style={{ textAlign: "center", background: "#ffffff", borderRadius: 10, padding: "8px 14px", minWidth: 150 }}>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{pct}%</div>
      <div style={{ fontSize: 10.5, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 11, color: C.ink, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function DayWise({ daily }: { daily: PosterData["daily"] }) {
  const half = Math.ceil(daily.length / 2);
  const cols = [daily.slice(0, half), daily.slice(half)];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      {cols.map((col, ci) => (
        <table key={ci} style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <tbody>
            {col.map((d) => (
              <tr key={d.date} style={{ borderBottom: `1px solid ${C.line}` }}>
                <td style={{ padding: "4px 2px", color: C.muted }}>{d.date.slice(5)}</td>
                <td style={{ padding: "4px 2px", textAlign: "right", fontWeight: 700, color: d.logged === 0 ? C.red : C.ink }}>
                  {d.logged === 0 ? "0" : formatINRFull(d.logged)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </div>
  );
}

function TrendBars({ daily, max }: { daily: PosterData["daily"]; max: number }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 120 }}>
      {daily.map((d) => (
        <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ width: "100%", height: `${(d.logged / max) * 96}px`, minHeight: d.logged > 0 ? 2 : 0, background: C.blue, borderRadius: "3px 3px 0 0" }} />
          <div style={{ fontSize: 8, color: C.muted, transform: "rotate(-60deg)", whiteSpace: "nowrap", marginTop: 2 }}>{d.date.slice(5)}</div>
        </div>
      ))}
    </div>
  );
}

function BarRows({ items }: { items: { label: string; value: number; count: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((it) => (
        <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <div style={{ width: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: C.muted }}>{it.label}</div>
          <div style={{ flex: 1, height: 14, background: C.bg, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${Math.max(3, (it.value / max) * 100)}%`, height: "100%", background: C.blue, borderRadius: 4 }} />
          </div>
          <div style={{ width: 70, textAlign: "right", fontWeight: 700 }}>{formatINR(it.value)}</div>
          <div style={{ width: 24, textAlign: "right", color: C.muted }}>{it.count}</div>
        </div>
      ))}
    </div>
  );
}

function BranchTable({ branches }: { branches: PosterData["branches"] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead>
        <tr style={{ color: C.muted, textAlign: "left" }}>
          <th style={{ padding: "3px 4px" }}>Branch</th>
          <th style={{ padding: "3px 4px", textAlign: "right" }}>Cases</th>
          <th style={{ padding: "3px 4px", textAlign: "right" }}>Logged</th>
          <th style={{ padding: "3px 4px", textAlign: "right" }}>Issued</th>
          <th style={{ padding: "3px 4px", textAlign: "right" }}>Conv.</th>
        </tr>
      </thead>
      <tbody>
        {branches.map((b) => (
          <tr key={b.branch} style={{ borderTop: `1px solid ${C.line}` }}>
            <td style={{ padding: "4px", fontWeight: 700 }}>{b.branch}</td>
            <td style={{ padding: "4px", textAlign: "right" }}>{b.cases}</td>
            <td style={{ padding: "4px", textAlign: "right" }}>{b.display.logged}</td>
            <td style={{ padding: "4px", textAlign: "right", color: C.muted }}>{b.display.issued}</td>
            <td style={{ padding: "4px", textAlign: "right", fontWeight: 700, color: achievementColor(b.conversion_pct) }}>{b.conversion_pct}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function buildObservations(data: PosterData, x: { bizDays: number; zeroDays: number; topDay?: PosterData["daily"][number] }): string[] {
  const t = data.totals;
  const out: string[] = [];
  out.push(`Total business ${formatINR(t.logged_premium)} across ${t.case_count} cases; ${formatINR(t.issued_premium)} issued.`);
  out.push(`Conversion ${t.conversion_pct}% — ${t.conversion_pct >= 60 ? "healthy" : t.conversion_pct >= 40 ? "moderate" : "needs improvement"}.`);
  if (x.topDay && x.topDay.logged > 0) out.push(`Peak day ${x.topDay.date.slice(5)} at ${formatINR(x.topDay.logged)}.`);
  out.push(`Business on ${x.bizDays} of ${data.daily.length} days${x.zeroDays ? `; ${x.zeroDays} zero-business day(s)` : ""}.`);
  if (t.stuck_count > 0) out.push(`${formatINR(t.stuck_premium)} stuck across ${t.stuck_count} pending cases — work the pipeline.`);
  if (data.agents[0]) out.push(`Top agent ${data.agents[0].agentName} — ${formatINR(data.agents[0].logged)} across ${data.agents[0].cases} cases.`);
  if (data.branch && data.target) out.push(`Business achievement ${formatPct(t.issued_premium, data.target)}% vs target ${formatINR(data.target)}.`);
  if (!data.branch && data.branches[0]) out.push(`Top branch ${data.branches[0].branch} — ${data.branches[0].display.logged}.`);
  return out;
}
