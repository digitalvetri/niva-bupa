"use client";
import * as React from "react";
import { NivaBupaLogo } from "@/components/brand/niva-bupa-logo";
import { formatINR, formatINRFull, formatPct } from "@/lib/metrics/format";
import { STAGE_LABEL } from "@/lib/theme";
import type { PosterData } from "./use-poster-data";

// Fixed brand palette — theme-independent so exported PNGs look identical anywhere.
// Anchored on the Niva Bupa mark: bright cyan + orange, over a deep navy canvas.
const C = {
  navy: "#0b2148",
  navy2: "#173a7e",
  ink: "#0f1c34",
  muted: "#5b6980",
  faint: "#95a1b5",
  line: "#e7ecf4",
  bg: "#eef2f8",
  card: "#ffffff",
  cyan: "#00a9e0",
  cyanDk: "#0782ad",
  orange: "#f7a81b",
  green: "#16a34a",
  amber: "#d97706",
  red: "#e11d48",
  indigo: "#6366f1",
};

const STAGE_COLOR: Record<string, string> = {
  ISSUED: C.green,
  UNDERWRITING: C.cyan,
  OPERATIONS: C.indigo,
  TELE_UW_REQUIRED: C.amber,
  REQUIREMENT_RAISED: C.amber,
  COUNTER_OFFER: C.red,
  UNKNOWN: C.faint,
  OTHER: C.faint,
};
const PRODUCT_COLORS = [C.cyan, "#0ea5a4", C.indigo, C.orange, "#0891b2", "#7c3aed", C.faint];

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getUTCDate().toString().padStart(2, "0")} ${d.toLocaleString("en", { month: "short", timeZone: "UTC" })}`;
}
function achievementColor(pct: number) {
  return pct >= 70 ? C.green : pct >= 40 ? C.amber : C.red;
}
function bucketOf(stage: string): "Won" | "Pending" | "Review" {
  if (stage === "ISSUED") return "Won";
  if (stage === "UNKNOWN" || stage === "OTHER") return "Review";
  return "Pending";
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

  // Pipeline-health buckets (Won / Pending / Review) by logged premium — feeds the donut.
  const buckets = { Won: 0, Pending: 0, Review: 0 };
  for (const f of data.funnel) buckets[bucketOf(f.stage)] += f.logged;
  const donutSegments = [
    { label: "Won", value: buckets.Won, color: C.green },
    { label: "Pending", value: buckets.Pending, color: C.amber },
    { label: "Review", value: buckets.Review, color: C.faint },
  ].filter((s) => s.value > 0);

  return (
    <div ref={ref} style={{ position: "relative", width: 1080, background: C.bg, color: C.ink, fontFamily: "'Inter','Segoe UI',system-ui,-apple-system,sans-serif", overflow: "hidden" }}>
      {/* AI-generated decorative watermark — behind everything; numbers stay HTML on top */}
      {hasArt && (
        <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: `url(${backgroundUrl})`, backgroundSize: "cover", backgroundPosition: "center", opacity: 0.045, zIndex: 0 }} />
      )}

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* ── Header ─────────────────────────────────────────────── */}
        <div style={{ position: "relative", padding: "24px 30px 26px", overflow: "hidden", background: `linear-gradient(125deg, ${C.navy} 0%, ${C.navy2} 100%)` }}>
          {hasArt && (
            <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0 }}>
              <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${backgroundUrl})`, backgroundSize: "cover", backgroundPosition: "center" }} />
              <div style={{ position: "absolute", inset: 0, background: `linear-gradient(115deg, ${C.navy}f7 0%, ${C.navy2}e6 52%, ${C.navy2}73 100%)` }} />
            </div>
          )}
          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 22 }}>
            <div style={{ background: "#fff", borderRadius: 14, padding: "11px 15px", boxShadow: "0 6px 18px rgba(0,0,0,0.22)" }}>
              <NivaBupaLogo className="" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: C.cyan, fontSize: 12, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase" }}>
                {data.branch ? "Branch Performance Report" : "Territory Performance Report"}
              </div>
              <div style={{ color: "#fff", fontSize: 32, fontWeight: 800, letterSpacing: 0.2, marginTop: 3, lineHeight: 1.08 }}>
                {data.branch ? data.scopeLabel : "Tamil Nadu Territory"}
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 10, background: "rgba(247,168,27,0.16)", border: "1px solid rgba(247,168,27,0.55)", color: C.orange, fontWeight: 700, fontSize: 12, padding: "4px 13px", borderRadius: 20 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.orange }} />
                {fmtDate(data.period.start)} – {fmtDate(data.period.end)}
              </div>
            </div>
            {achievement != null ? (
              <ArcGauge pct={achievement} sub={`${formatINR(t.issued_premium)} / ${formatINR(data.target!)}`} />
            ) : (
              <div style={{ textAlign: "right" }}>
                <div style={{ color: C.cyan, fontSize: 11, textTransform: "uppercase", letterSpacing: 1.6, fontWeight: 700 }}>Total Business</div>
                <div style={{ color: "#fff", fontSize: 40, fontWeight: 800, lineHeight: 1.05 }}>{formatINR(t.logged_premium)}</div>
                <div style={{ color: "#cbd6ec", fontSize: 12 }}>{t.case_count} cases · {t.issued_count} issued</div>
              </div>
            )}
          </div>
        </div>
        {/* brand accent rule */}
        <div style={{ height: 4, background: `linear-gradient(90deg, ${C.cyan} 0%, ${C.cyan} 62%, ${C.orange} 62%, ${C.orange} 100%)` }} />

        {/* ── KPI row ────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, padding: "18px 30px 6px" }}>
          <Kpi label="Logged Premium" value={formatINR(t.logged_premium)} sub={`${t.case_count} cases`} color={C.cyan} />
          <Kpi label="Issued Premium" value={formatINR(t.issued_premium)} sub={`${t.issued_count} issued`} color={C.green} />
          <Kpi label="Conversion" value={`${t.conversion_pct}%`} sub={`${t.issued_count} of ${t.case_count}`} color={C.indigo} />
          <Kpi label="Stuck Premium" value={formatINR(t.stuck_premium)} sub={`${t.stuck_count} pending`} color={C.red} />
        </div>

        {/* ── Insight banner ────────────────────────────────────── */}
        <div style={{ padding: "10px 30px 4px" }}>
          <InsightBanner data={data} topDay={topDay} />
        </div>

        {/* ── Body: two columns ─────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1.12fr 1fr", gap: 18, padding: "8px 30px 6px", alignItems: "start" }}>
          {/* LEFT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {data.branch ? (
              <Section title="Business logged — day-wise" accent={C.cyan}>
                <DayWise daily={data.daily} />
                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  <MiniStat label="Business days" value={String(bizDays)} color={C.green} />
                  <MiniStat label="Zero days" value={String(zeroDays)} color={zeroDays ? C.red : C.muted} />
                  <MiniStat label="Avg / biz day" value={formatINR(bizDays ? t.logged_premium / bizDays : 0)} color={C.ink} />
                </div>
              </Section>
            ) : (
              <Section title="Branch performance" accent={C.cyan}>
                <BranchLeaderboard branches={data.branches} />
              </Section>
            )}
            <Section title="Daily business trend" accent={C.orange}>
              <TrendChart daily={data.daily} topDate={topDay?.date} />
            </Section>
          </div>

          {/* RIGHT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Section title="Pipeline health" accent={C.indigo}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <Donut segments={donutSegments} centerTop={`${t.conversion_pct}%`} centerSub="WON" />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  {donutSegments.map((s) => (
                    <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
                      <span style={{ flex: 1, color: C.ink, fontWeight: 600 }}>{s.label}</span>
                      <span style={{ fontWeight: 800, color: C.ink }}>{formatINR(s.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ height: 1, background: C.line, margin: "12px 0" }} />
              <RankBars items={data.funnel.map((f) => ({ label: STAGE_LABEL[f.stage] ?? f.stage, value: f.logged, count: f.cases, color: STAGE_COLOR[f.stage] ?? C.cyan }))} showRank={false} />
            </Section>
            <Section title={data.branch ? "Top agents" : "Top agents (territory)"} accent={C.orange}>
              <RankBars items={data.agents.map((a) => ({ label: a.agentName, value: a.logged, count: a.cases }))} showRank />
            </Section>
            <Section title="Product mix" accent="#0ea5a4">
              <RankBars items={data.products.map((p, i) => ({ label: p.key, value: p.logged, count: p.cases, color: PRODUCT_COLORS[i % PRODUCT_COLORS.length] }))} showRank={false} />
            </Section>
          </div>
        </div>

        {/* ── Observations ──────────────────────────────────────── */}
        <div style={{ padding: "8px 30px 6px" }}>
          <Section title="Key observations" accent={C.navy2}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 26, rowGap: 8 }}>
              {observations.map((o, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, lineHeight: 1.45, color: C.ink }}>
                  <span style={{ flexShrink: 0, marginTop: 5, width: 6, height: 6, borderRadius: "50%", background: C.cyan }} />
                  <span>{o}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* ── Footer ────────────────────────────────────────────── */}
        <div style={{ background: C.navy, color: "#aebbdb", fontSize: 11.5, padding: "13px 30px", marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 600, color: "#d3ddf0" }}>Territory IQ · Niva Bupa Health Insurance</span>
          <span>Generated from uploaded New Business report{achievement == null ? " · set a target for achievement %" : ""} · DigitalVetri.AI</span>
        </div>
      </div>
    </div>
  );
});

// ── pieces ───────────────────────────────────────────────────────────────────────
function Section({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 8px rgba(15,28,52,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 17px", borderBottom: `1px solid ${C.line}` }}>
        <span style={{ width: 4, height: 16, borderRadius: 3, background: accent }} />
        <span style={{ fontWeight: 700, fontSize: 14, color: C.ink, letterSpacing: 0.2 }}>{title}</span>
      </div>
      <div style={{ padding: 17 }}>{children}</div>
    </div>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: "15px 17px 14px", position: "relative", overflow: "hidden", boxShadow: "0 2px 8px rgba(15,28,52,0.06)" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 4, background: color }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />
        <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.7, color: C.muted, fontWeight: 700 }}>{label}</div>
      </div>
      <div style={{ fontSize: 29, fontWeight: 800, color: C.ink, marginTop: 6, letterSpacing: -0.4 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: C.faint, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function InsightBanner({ data, topDay }: { data: PosterData; topDay?: PosterData["daily"][number] }) {
  const t = data.totals;
  const convWord = t.conversion_pct >= 60 ? "healthy" : t.conversion_pct >= 40 ? "moderate" : "soft";
  const lead = data.branch
    ? `${data.scopeLabel} converted ${t.conversion_pct}% (${convWord}) on ${formatINR(t.logged_premium)} logged`
    : (() => {
        const eligible = data.branches.filter((b) => b.cases >= 3);
        const top = (eligible.length ? eligible : data.branches).slice().sort((a, b) => b.conversion_pct - a.conversion_pct)[0];
        return top ? `${top.branch} leads conversion at ${top.conversion_pct}%; territory at ${t.conversion_pct}%` : `Territory conversion ${t.conversion_pct}%`;
      })();
  const risk = t.stuck_count > 0 ? `${formatINR(t.stuck_premium)} stuck across ${t.stuck_count} cases — prioritise follow-up` : (topDay && topDay.logged > 0 ? `peak ${formatINR(topDay.logged)} on ${topDay.date.slice(5)}` : "");

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, background: "linear-gradient(90deg, rgba(0,169,224,0.09), rgba(247,168,27,0.07))", border: `1px solid ${C.line}`, borderLeft: `5px solid ${C.orange}`, borderRadius: 14, padding: "13px 18px" }}>
      <div style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 10, background: C.navy, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 L3 14 h7 l-1 8 10-12 h-7 z" /></svg>
      </div>
      <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.4 }}>
        <span style={{ fontWeight: 800 }}>{lead}.</span>
        {risk && <span style={{ color: C.muted, fontWeight: 600 }}>{" "}{risk.charAt(0).toUpperCase() + risk.slice(1)}.</span>}
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ flex: 1, background: C.bg, borderRadius: 11, padding: "10px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 9.5, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 2, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

function ArcGauge({ pct, sub }: { pct: number; sub: string }) {
  const size = 136, stroke = 13, r = (size - stroke) / 2, cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, pct)) / 100) * circ;
  const color = achievementColor(pct);
  return (
    <div style={{ textAlign: "center", background: "rgba(255,255,255,0.08)", borderRadius: 16, padding: "10px 16px 12px" }}>
      <svg width={size} height={size} style={{ display: "block", margin: "0 auto" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={stroke} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${dash} ${circ - dash}`} transform={`rotate(-90 ${cx} ${cy})`} />
        <text x={cx} y={cy - 1} textAnchor="middle" fontSize="31" fontWeight="800" fill="#fff">{pct}%</text>
        <text x={cx} y={cy + 19} textAnchor="middle" fontSize="10" fontWeight="700" fill={C.cyan} letterSpacing="1.5">ACHIEVED</text>
      </svg>
      <div style={{ fontSize: 11, color: "#cbd6ec", marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function Donut({ segments, centerTop, centerSub }: { segments: { label: string; value: number; color: string }[]; centerTop: string; centerSub: string }) {
  const size = 128, stroke = 17, r = (size - stroke) / 2, cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  let acc = 0;
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.bg} strokeWidth={stroke} />
      {segments.map((s) => {
        const dash = (s.value / total) * circ;
        const el = (
          <circle key={s.label} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={stroke} strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-acc} transform={`rotate(-90 ${cx} ${cy})`} />
        );
        acc += dash;
        return el;
      })}
      <text x={cx} y={cy - 1} textAnchor="middle" fontSize="24" fontWeight="800" fill={C.ink}>{centerTop}</text>
      <text x={cx} y={cy + 16} textAnchor="middle" fontSize="9.5" fontWeight="700" fill={C.muted} letterSpacing="1.5">{centerSub}</text>
    </svg>
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
                <td style={{ padding: "6px 2px", color: C.muted }}>{d.date.slice(5)}</td>
                <td style={{ padding: "6px 2px", textAlign: "right", fontWeight: 700, color: d.logged === 0 ? C.red : C.ink }}>
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
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 122, borderBottom: `2px solid ${C.line}` }}>
        {daily.map((d) => {
          const isTop = d.date === topDate && d.logged > 0;
          const h = (d.logged / max) * 110;
          return (
            <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, color: isTop ? C.orange : "transparent", marginBottom: 2, whiteSpace: "nowrap" }}>{isTop ? formatINR(d.logged) : "·"}</div>
              <div style={{ width: "72%", height: `${Math.max(d.logged > 0 ? 3 : 0, h)}px`, borderRadius: "5px 5px 0 0", background: isTop ? `linear-gradient(180deg, ${C.orange}, #e08c00)` : `linear-gradient(180deg, ${C.cyan}, ${C.cyanDk})` }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 4, marginTop: 5 }}>
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
            <span style={{ flexShrink: 0, width: 19, height: 19, borderRadius: "50%", background: i < 3 ? C.navy2 : C.bg, color: i < 3 ? "#fff" : C.muted, fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
          )}
          <div style={{ width: showRank ? 116 : 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: C.ink, fontWeight: 600 }} title={it.label}>{it.label}</div>
          <div style={{ flex: 1, height: 16, background: C.bg, borderRadius: 6, overflow: "hidden" }}>
            <div style={{ width: `${Math.max(4, (it.value / max) * 100)}%`, height: "100%", borderRadius: 6, background: `linear-gradient(90deg, ${it.color ?? C.cyan}, ${it.color ? shade(it.color) : C.cyanDk})` }} />
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
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      <div style={{ display: "grid", gridTemplateColumns: "22px 1fr 96px 56px", gap: 8, fontSize: 9.5, textTransform: "uppercase", letterSpacing: 0.5, color: C.faint, fontWeight: 700, paddingBottom: 2 }}>
        <span></span><span>Branch</span><span>Logged</span><span style={{ textAlign: "right" }}>Conv.</span>
      </div>
      {branches.map((b, i) => (
        <div key={b.branch} style={{ display: "grid", gridTemplateColumns: "22px 1fr 96px 56px", gap: 8, alignItems: "center", fontSize: 12.5 }}>
          <span style={{ width: 20, height: 20, borderRadius: "50%", background: i < 3 ? C.navy2 : C.bg, color: i < 3 ? "#fff" : C.muted, fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
          <div>
            <div style={{ fontWeight: 700, color: C.ink }}>{b.branch}</div>
            <div style={{ marginTop: 3, height: 5, background: C.bg, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${Math.max(4, (b.logged / max) * 100)}%`, height: "100%", background: `linear-gradient(90deg, ${C.cyan}, #0ea5a4)`, borderRadius: 3 }} />
            </div>
          </div>
          <div style={{ fontWeight: 800, color: C.ink }}>{b.display.logged}<span style={{ color: C.faint, fontWeight: 500, fontSize: 10.5 }}> · {b.cases}c</span></div>
          <div style={{ textAlign: "right", fontWeight: 800, color: achievementColor(b.conversion_pct) }}>{b.conversion_pct}%</div>
        </div>
      ))}
    </div>
  );
}

// Slightly darken a hex color for gradient ends (keeps bars from looking flat).
function shade(hex: string): string {
  const m = hex.replace("#", "");
  if (m.length !== 6) return hex;
  const n = parseInt(m, 16);
  const r = Math.max(0, ((n >> 16) & 255) - 34), g = Math.max(0, ((n >> 8) & 255) - 34), b = Math.max(0, (n & 255) - 34);
  return `rgb(${r},${g},${b})`;
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
