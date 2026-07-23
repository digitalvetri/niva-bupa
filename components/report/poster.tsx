"use client";
import * as React from "react";
import { NivaBupaLogo } from "@/components/brand/niva-bupa-logo";
import { formatINR, formatINRFull, formatPct } from "@/lib/metrics/format";
import { STAGE_LABEL } from "@/lib/theme";
import type { PosterData } from "./use-poster-data";

// Fixed brand palette — the poster is theme-independent so exported PNGs look identical anywhere.
const C = {
  navy: "#0b1f4d",
  navy2: "#16367e",
  ink: "#0f1c34",
  muted: "#64748b",
  faint: "#94a3b8",
  line: "#e6ebf3",
  bg: "#eef2f9",
  blue: "#2563eb",
  blueDark: "#1e40af",
  teal: "#0ea5a4",
  gold: "#f5b301",
  green: "#16a34a",
  amber: "#d97706",
  red: "#dc2626",
  card: "#ffffff",
};

// Per-stage accent for the funnel (won → green, action-needed → amber/red, review → grey).
const STAGE_COLOR: Record<string, string> = {
  ISSUED: C.green,
  UNDERWRITING: C.blue,
  OPERATIONS: "#6366f1",
  TELE_UW_REQUIRED: C.amber,
  REQUIREMENT_RAISED: C.amber,
  COUNTER_OFFER: C.red,
  UNKNOWN: C.faint,
  OTHER: C.faint,
};
const PRODUCT_COLORS = [C.blue, C.teal, "#6366f1", C.gold, "#0891b2", "#7c3aed", C.faint];

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getUTCDate().toString().padStart(2, "0")} ${d.toLocaleString("en", { month: "short", timeZone: "UTC" })}`;
}
function achievementColor(pct: number) {
  return pct >= 70 ? C.green : pct >= 40 ? C.amber : C.red;
}

type PosterProps = { data: PosterData; backgroundUrl?: string | null };

export const Poster = React.forwardRef<HTMLDivElement, PosterProps>(function Poster({ data, backgroundUrl }, ref) {
  const t = data.totals;
  const bizDays = data.daily.filter((d) => d.logged > 0).length;
  const zeroDays = data.daily.filter((d) => d.logged === 0).length;
  const topDay = [...data.daily].sort((a, b) => b.logged - a.logged)[0];
  const achievement = data.target ? formatPct(t.issued_premium, data.target) : null;
  const observations = buildObservations(data, { bizDays, zeroDays, topDay });
  const hasArt = Boolean(backgroundUrl);

  return (
    <div ref={ref} style={{ position: "relative", width: 1080, background: C.bg, color: C.ink, fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", overflow: "hidden" }}>
      {/* AI-generated decorative watermark — behind everything at low opacity; numbers stay HTML on top */}
      {hasArt && (
        <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: `url(${backgroundUrl})`, backgroundSize: "cover", backgroundPosition: "center", opacity: 0.05, zIndex: 0 }} />
      )}

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* ── Header ─────────────────────────────────────────────── */}
        <div style={{ position: "relative", padding: "22px 28px 24px", overflow: "hidden", background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navy2} 100%)` }}>
          {hasArt && (
            <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0 }}>
              <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${backgroundUrl})`, backgroundSize: "cover", backgroundPosition: "center" }} />
              <div style={{ position: "absolute", inset: 0, background: `linear-gradient(115deg, ${C.navy}f5 0%, ${C.navy2}e0 50%, ${C.navy2}70 100%)` }} />
            </div>
          )}
          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ background: "#fff", borderRadius: 12, padding: "9px 12px", boxShadow: "0 4px 14px rgba(0,0,0,0.18)" }}>
              <NivaBupaLogo className="" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#8fb0ff", fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>
                {data.branch ? "Branch Performance Report" : "Territory Performance Report"}
              </div>
              <div style={{ color: "#fff", fontSize: 30, fontWeight: 800, letterSpacing: 0.3, marginTop: 2, lineHeight: 1.1 }}>
                {data.branch ? data.scopeLabel : "Tamil Nadu Territory"}
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 9, background: "rgba(245,179,1,0.18)", border: "1px solid rgba(245,179,1,0.5)", color: C.gold, fontWeight: 700, fontSize: 12, padding: "4px 12px", borderRadius: 20 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.gold }} />
                {fmtDate(data.period.start)} – {fmtDate(data.period.end)}
              </div>
            </div>
            {achievement != null ? (
              <ArcGauge pct={achievement} sub={`${formatINR(t.issued_premium)} / ${formatINR(data.target!)}`} />
            ) : (
              <div style={{ textAlign: "right" }}>
                <div style={{ color: "#8fb0ff", fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700 }}>Total Business</div>
                <div style={{ color: "#fff", fontSize: 38, fontWeight: 800, lineHeight: 1.1 }}>{formatINR(t.logged_premium)}</div>
                <div style={{ color: "#cdd7ee", fontSize: 12 }}>{t.case_count} cases · {t.issued_count} issued</div>
              </div>
            )}
          </div>
        </div>

        {/* ── KPI row ────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, padding: "18px 28px 6px" }}>
          <Kpi label="Logged Premium" value={formatINR(t.logged_premium)} sub={`${t.case_count} cases`} color={C.blue} />
          <Kpi label="Issued Premium" value={formatINR(t.issued_premium)} sub={`${t.issued_count} issued`} color={C.green} />
          <Kpi label="Conversion" value={`${t.conversion_pct}%`} sub={`${t.issued_count} of ${t.case_count}`} color={C.teal} />
          <Kpi label="Stuck Premium" value={formatINR(t.stuck_premium)} sub={`${t.stuck_count} pending`} color={C.red} />
        </div>

        {/* ── Body: two columns ─────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1.12fr 1fr", gap: 18, padding: "10px 28px 6px", alignItems: "start" }}>
          {/* LEFT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {data.branch ? (
              <Section title="Business logged — day-wise" accent={C.blue}>
                <DayWise daily={data.daily} />
                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  <MiniStat label="Business days" value={String(bizDays)} color={C.green} />
                  <MiniStat label="Zero days" value={String(zeroDays)} color={zeroDays ? C.red : C.muted} />
                  <MiniStat label="Avg / biz day" value={formatINR(bizDays ? t.logged_premium / bizDays : 0)} color={C.ink} />
                </div>
              </Section>
            ) : (
              <Section title="Branch performance" accent={C.blue}>
                <BranchLeaderboard branches={data.branches} />
              </Section>
            )}
            <Section title="Daily business trend" accent={C.teal}>
              <TrendChart daily={data.daily} topDate={topDay?.date} />
            </Section>
          </div>

          {/* RIGHT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Section title="Pipeline / funnel" accent="#6366f1">
              <RankBars items={data.funnel.map((f) => ({ label: STAGE_LABEL[f.stage] ?? f.stage, value: f.logged, count: f.cases, color: STAGE_COLOR[f.stage] ?? C.blue }))} showRank={false} />
            </Section>
            <Section title={data.branch ? "Top agents" : "Top agents (territory)"} accent={C.gold}>
              <RankBars items={data.agents.map((a) => ({ label: a.agentName, value: a.logged, count: a.cases }))} showRank />
            </Section>
            <Section title="Product mix" accent={C.teal}>
              <RankBars items={data.products.map((p, i) => ({ label: p.key, value: p.logged, count: p.cases, color: PRODUCT_COLORS[i % PRODUCT_COLORS.length] }))} showRank={false} />
            </Section>
          </div>
        </div>

        {/* ── Observations ──────────────────────────────────────── */}
        <div style={{ padding: "8px 28px 6px" }}>
          <Section title="Key observations" accent={C.navy2}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 24, rowGap: 8 }}>
              {observations.map((o, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, lineHeight: 1.45, color: C.ink }}>
                  <span style={{ flexShrink: 0, marginTop: 5, width: 6, height: 6, borderRadius: "50%", background: C.blue }} />
                  <span>{o}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* ── Footer ────────────────────────────────────────────── */}
        <div style={{ background: C.navy, color: "#aebbdb", fontSize: 11.5, padding: "12px 28px", marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 600, color: "#cdd7ee" }}>Territory IQ · Niva Bupa Health Insurance</span>
          <span>Generated from uploaded New Business report{achievement == null ? " · set a target for achievement %" : ""} · DigitalVetri.AI</span>
        </div>
      </div>
    </div>
  );
});

// ── pieces ───────────────────────────────────────────────────────────────────────
function Section({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 3px rgba(15,28,52,0.05)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 16px", borderBottom: `1px solid ${C.line}` }}>
        <span style={{ width: 4, height: 15, borderRadius: 3, background: accent }} />
        <span style={{ fontWeight: 700, fontSize: 13.5, color: C.ink, letterSpacing: 0.2 }}>{title}</span>
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "14px 16px", position: "relative", overflow: "hidden", boxShadow: "0 1px 3px rgba(15,28,52,0.05)" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 5, background: color }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />
        <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.7, color: C.muted, fontWeight: 700 }}>{label}</div>
      </div>
      <div style={{ fontSize: 27, fontWeight: 800, color: C.ink, marginTop: 5, letterSpacing: -0.3 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: C.faint, marginTop: 1 }}>{sub}</div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ flex: 1, background: C.bg, borderRadius: 10, padding: "9px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 17, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 9.5, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 1, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

function ArcGauge({ pct, sub }: { pct: number; sub: string }) {
  const size = 132, stroke = 13, r = (size - stroke) / 2, cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, pct)) / 100) * circ;
  const color = achievementColor(pct);
  return (
    <div style={{ textAlign: "center", background: "rgba(255,255,255,0.08)", borderRadius: 14, padding: "10px 14px 12px" }}>
      <svg width={size} height={size} style={{ display: "block", margin: "0 auto" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={stroke} />
        <circle
          cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${dash} ${circ - dash}`} transform={`rotate(-90 ${cx} ${cy})`}
        />
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="30" fontWeight="800" fill="#fff">{pct}%</text>
        <text x={cx} y={cy + 18} textAnchor="middle" fontSize="10" fontWeight="700" fill="#8fb0ff" letterSpacing="1">ACHIEVED</text>
      </svg>
      <div style={{ fontSize: 11, color: "#cdd7ee", marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function DayWise({ daily }: { daily: PosterData["daily"] }) {
  const half = Math.ceil(daily.length / 2);
  const cols = [daily.slice(0, half), daily.slice(half)];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
      {cols.map((col, ci) => (
        <table key={ci} style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <tbody>
            {col.map((d) => (
              <tr key={d.date} style={{ borderBottom: `1px solid ${C.line}` }}>
                <td style={{ padding: "5px 2px", color: C.muted }}>{d.date.slice(5)}</td>
                <td style={{ padding: "5px 2px", textAlign: "right", fontWeight: 700, color: d.logged === 0 ? C.red : C.ink }}>
                  {d.logged === 0 ? "—" : formatINRFull(d.logged)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </div>
  );
}

function TrendChart({ daily, topDate }: { daily: PosterData["daily"]; topDate?: string }) {
  const max = Math.max(1, ...daily.map((d) => d.logged));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 120, borderBottom: `2px solid ${C.line}`, paddingBottom: 0 }}>
        {daily.map((d) => {
          const isTop = d.date === topDate && d.logged > 0;
          const h = (d.logged / max) * 108;
          return (
            <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: isTop ? C.gold : "transparent", marginBottom: 2, whiteSpace: "nowrap" }}>{isTop ? formatINR(d.logged) : "·"}</div>
              <div style={{
                width: "72%", height: `${Math.max(d.logged > 0 ? 3 : 0, h)}px`, borderRadius: "4px 4px 0 0",
                background: isTop ? `linear-gradient(180deg, ${C.gold}, #e59400)` : `linear-gradient(180deg, ${C.blue}, ${C.blueDark})`,
              }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
        {daily.map((d, i) => (
          <div key={d.date} style={{ flex: 1, textAlign: "center", fontSize: 8, color: C.faint }}>{i % 2 === 0 ? d.date.slice(5) : ""}</div>
        ))}
      </div>
    </div>
  );
}

function RankBars({ items, showRank }: { items: { label: string; value: number; count: number; color?: string }[]; showRank: boolean }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {items.map((it, i) => (
        <div key={it.label + i} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12 }}>
          {showRank && (
            <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: "50%", background: i < 3 ? C.navy2 : C.bg, color: i < 3 ? "#fff" : C.muted, fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
          )}
          <div style={{ width: showRank ? 118 : 132, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: C.ink, fontWeight: 600 }} title={it.label}>{it.label}</div>
          <div style={{ flex: 1, height: 16, background: C.bg, borderRadius: 5, overflow: "hidden" }}>
            <div style={{ width: `${Math.max(4, (it.value / max) * 100)}%`, height: "100%", borderRadius: 5, background: `linear-gradient(90deg, ${(it.color ?? C.blue)}, ${(it.color ?? C.blueDark)})` }} />
          </div>
          <div style={{ width: 64, textAlign: "right", fontWeight: 800, color: C.ink }}>{formatINR(it.value)}</div>
          <div style={{ width: 22, textAlign: "right", color: C.faint, fontSize: 11 }}>{it.count}</div>
        </div>
      ))}
    </div>
  );
}

function BranchLeaderboard({ branches }: { branches: PosterData["branches"] }) {
  const max = Math.max(1, ...branches.map((b) => b.logged));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "22px 1fr 92px 58px", gap: 8, fontSize: 9.5, textTransform: "uppercase", letterSpacing: 0.5, color: C.faint, fontWeight: 700, paddingBottom: 2 }}>
        <span></span><span>Branch</span><span style={{ textAlign: "left" }}>Logged</span><span style={{ textAlign: "right" }}>Conv.</span>
      </div>
      {branches.map((b, i) => (
        <div key={b.branch} style={{ display: "grid", gridTemplateColumns: "22px 1fr 92px 58px", gap: 8, alignItems: "center", fontSize: 12.5 }}>
          <span style={{ width: 20, height: 20, borderRadius: "50%", background: i < 3 ? C.navy2 : C.bg, color: i < 3 ? "#fff" : C.muted, fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
          <div>
            <div style={{ fontWeight: 700, color: C.ink }}>{b.branch}</div>
            <div style={{ marginTop: 3, height: 5, background: C.bg, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${Math.max(4, (b.logged / max) * 100)}%`, height: "100%", background: `linear-gradient(90deg, ${C.blue}, ${C.teal})`, borderRadius: 3 }} />
            </div>
          </div>
          <div style={{ fontWeight: 800, color: C.ink }}>{b.display.logged}<span style={{ color: C.faint, fontWeight: 500, fontSize: 10.5 }}> · {b.cases}c</span></div>
          <div style={{ textAlign: "right", fontWeight: 800, color: achievementColor(b.conversion_pct) }}>{b.conversion_pct}%</div>
        </div>
      ))}
    </div>
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
