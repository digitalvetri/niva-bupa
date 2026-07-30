// AI Executive Summary — a short "state of your territory" briefing for the Pulse screen.
// Numbers come ONLY from the deterministic metric engine. If an LLM provider is configured we let
// it *phrase* the briefing (guarded so it can't invent figures); otherwise a rules-based summary is
// composed from the same facts. Either way the ₹/% values are verified.
import type { PrismaClient } from "@prisma/client";
import type { LlmProvider } from "../bot/providers/types";
import type { Filters } from "../metrics/types";
import { totals, premiumByBranch, funnel, agentLeaderboard } from "../metrics/metrics";

const ACTION_STAGES = new Set(["TELE_UW_REQUIRED", "REQUIREMENT_RAISED", "COUNTER_OFFER"]);

export type SummaryFacts = {
  scope: string;
  logged: string;
  issued: string;
  conversion: number;
  cases: number;
  issued_count: number;
  stuck: string;
  stuck_count: number;
  needs_action: number;
  branch_count: number;
  top_branch_volume?: { name: string; logged: string; cases: number };
  top_branch_conversion?: { name: string; conversion: number; cases: number };
  weak_branch_conversion?: { name: string; conversion: number; cases: number };
  top_agent?: { name: string; logged: string; cases: number };
};

export async function buildSummaryFacts(db: PrismaClient, snapshotId: string, filters: Filters, scopeLabel = "This territory"): Promise<SummaryFacts> {
  const [t, br, fn, ag] = await Promise.all([
    totals(db, snapshotId, filters),
    premiumByBranch(db, snapshotId, filters),
    funnel(db, snapshotId, filters),
    agentLeaderboard(db, snapshotId, filters),
  ]);
  const branches = br.data;
  const eligible = branches.filter((b) => b.cases >= 3);
  const byConv = (eligible.length ? eligible : branches).slice().sort((a, b) => b.conversion_pct - a.conversion_pct);
  const needsAction = fn.data.filter((f) => ACTION_STAGES.has(f.stage)).reduce((s, f) => s + f.cases, 0);
  const topAgent = ag.data.filter((a) => a.agentName !== "UNASSIGNED")[0];
  const topVol = branches[0];
  const bestConv = byConv[0];
  const weakConv = byConv.length > 1 ? byConv[byConv.length - 1] : undefined;

  return {
    scope: scopeLabel,
    logged: t.data.display.logged,
    issued: t.data.display.issued,
    conversion: t.data.conversion_pct,
    cases: t.data.case_count,
    issued_count: t.data.issued_count,
    stuck: t.data.display.stuck,
    stuck_count: t.data.stuck_count,
    needs_action: needsAction,
    branch_count: branches.length,
    top_branch_volume: topVol ? { name: topVol.branch, logged: topVol.display.logged, cases: topVol.cases } : undefined,
    top_branch_conversion: bestConv ? { name: bestConv.branch, conversion: bestConv.conversion_pct, cases: bestConv.cases } : undefined,
    weak_branch_conversion: weakConv ? { name: weakConv.branch, conversion: weakConv.conversion_pct, cases: weakConv.cases } : undefined,
    top_agent: topAgent ? { name: topAgent.agentName, logged: topAgent.display?.logged ?? "", cases: topAgent.cases } : undefined,
  };
}

/** Rules-based briefing — always correct, no LLM needed. */
export function deterministicSummary(f: SummaryFacts): string {
  const parts: string[] = [];
  parts.push(`${f.scope} logged ${f.logged} across ${f.cases} cases, with ${f.issued} issued — a ${f.conversion}% conversion rate.`);
  if (f.top_branch_volume && f.top_branch_conversion) {
    parts.push(`${f.top_branch_volume.name} leads on volume (${f.top_branch_volume.logged}), while ${f.top_branch_conversion.name} converts best at ${f.top_branch_conversion.conversion}%.`);
  } else if (f.top_branch_volume) {
    parts.push(`${f.top_branch_volume.name} leads on volume (${f.top_branch_volume.logged}).`);
  }
  if (f.stuck_count > 0) {
    parts.push(`${f.stuck} is stuck across ${f.stuck_count} pending cases${f.needs_action > 0 ? `, ${f.needs_action} needing action` : ""} — the clearest opportunity to convert this week.`);
  }
  if (f.top_agent?.logged) parts.push(`Top performer: ${f.top_agent.name} (${f.top_agent.logged}).`);
  if (f.weak_branch_conversion && f.weak_branch_conversion.conversion < f.conversion) {
    parts.push(`Watch ${f.weak_branch_conversion.name} — conversion is lagging at ${f.weak_branch_conversion.conversion}%.`);
  }
  return parts.join(" ");
}

const SUMMARY_SYSTEM = `You are a sharp insurance business analyst writing a concise executive briefing for a Territory Head who manages new-business sales. You are given verified metric facts as JSON.

Rules:
- Use ONLY numbers present in the facts. Prefer the pre-formatted values (e.g. ₹31.77L, 62%). NEVER invent, average, or recompute a figure.
- Write 3–4 sentences of confident, plain-English prose. No bullet points, no headings, no preamble like "Here is".
- Cover, in a natural flow: total business + conversion, the standout branch, the biggest risk (stuck premium), the top performer, and end with ONE forward-looking recommendation.
- Tone: crisp, executive, like a trusted advisor. No hedging.`;

const MONEY_OR_PCT = /₹[\d.,]+\s?[A-Za-z]*|\d+(?:\.\d+)?\s?%/g;

function allowedTokens(f: SummaryFacts): Set<string> {
  const set = new Set<string>();
  const add = (v?: string | null) => { if (v) set.add(v.replace(/\s+/g, "")); };
  [f.logged, f.issued, f.stuck, f.top_branch_volume?.logged, f.top_agent?.logged].forEach(add);
  [f.conversion, f.top_branch_conversion?.conversion, f.weak_branch_conversion?.conversion].forEach((p) => { if (p != null) set.add(`${p}%`); });
  return set;
}

/** LLM-phrased briefing with a numeric guard; falls back to deterministic on any drift or error. */
export async function aiSummary(provider: LlmProvider, f: SummaryFacts): Promise<string> {
  try {
    let out = "";
    for await (const chunk of provider.narrate(SUMMARY_SYSTEM, `Verified facts (the ONLY source of numbers):\n\`\`\`json\n${JSON.stringify(f, null, 2)}\n\`\`\`\n\nWrite the briefing now.`)) {
      out += chunk;
    }
    const text = out.trim();
    if (!text) return deterministicSummary(f);
    // Numeric guard: every ₹/% token must exist in the verified facts.
    const allowed = allowedTokens(f);
    const used = text.match(MONEY_OR_PCT) ?? [];
    const drift = used.some((tok) => !allowed.has(tok.replace(/\s+/g, "")));
    return drift ? deterministicSummary(f) : text;
  } catch {
    return deterministicSummary(f);
  }
}
