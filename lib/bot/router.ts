// §7.1 Intent Router — a Claude call whose tools ARE the metric catalog. It picks tool(s) +
// filters; it never returns numbers. Server then executes the real metric functions.
import { anthropic, BOT_MODEL } from "./anthropic";
import { buildTools, METRIC_TOOL_NAMES } from "./tools";
import { normalizeFilters } from "./transliterate";
import type { Filters } from "../metrics/types";

export type RouterCall = { metricId: string; filters: Filters };
export type RouterResult =
  | { scope: "in"; calls: RouterCall[]; needsInterpretation: boolean }
  | { scope: "out"; message: string };

export type ChatTurn = { role: "user" | "assistant"; content: string };

const MAX_TOOLS_PER_TURN = 3;

// §7.2 router system prompt (embedded, adapted to this catalog).
const ROUTER_SYSTEM = `You answer questions about an insurance New Business (NB) report by calling metric tools. You NEVER state numbers yourself — a separate step runs the tools and writes the answer.

Rules:
- ALWAYS call at least one metric tool (max ${MAX_TOOLS_PER_TURN} per turn). Never answer numbers from memory.
- Map colloquial / Tamil-Tanglish terms to filters:
  - "pending" / "stuck" / "aakala" / "aagala" / "not issued" -> bucket:["Pending"]
  - "issued" / "converted" / "mudinja" / "policy issued" -> funnelStage:["ISSUED"]
  - "port" / "portability cases" -> isPortability:true
  - "fresh" (non-port) -> isPortability:false
  - "big cases" / "high value" -> minLoggedPremium:50000
  - "discrepancy" cases -> discrepancyOnly:true
- Branch names may be Tamil transliterations — pass them through; they are normalized server-side. Examples: Selam=Salem, Kovai=Coimbatore, Nellai=Tirunelveli, Tanjore=Thanjavur.
- Pick the most specific metric: totals (overall premium/conversion), premium_by_branch, funnel (stage breakdown), stuck_summary (stuck grouped by lead status), stuck_cases (row-level stuck list), agent_leaderboard, daily_trend.
- "who should I follow up / call today", "yaaru follow up pannanum" -> stuck_cases (optionally minLoggedPremium:50000 for high-value).
- Follow-ups like "and by agent?" INHERIT the previous turn's filters — carry them forward.
- If the question needs interpretation the tools can't fully give (e.g. "why is Salem underperforming"), still call the closest metric(s).
- If the question is out of scope for this report (weather, policy wording, medical/IRDAI/legal advice, chit-chat), call the "none" tool.`;

export async function routeQuestion(history: ChatTurn[]): Promise<RouterResult> {
  const tools = buildTools();
  const resp = await anthropic().messages.create({
    model: BOT_MODEL,
    max_tokens: 1024,
    system: ROUTER_SYSTEM,
    tools: tools as never,
    tool_choice: { type: "any" }, // force a tool call — never a bare text answer
    messages: history.map((t) => ({ role: t.role, content: t.content })),
  });

  const toolUses = resp.content.filter((b): b is Extract<typeof b, { type: "tool_use" }> => b.type === "tool_use");
  if (toolUses.length === 0) {
    // Should not happen with tool_choice:any, but degrade gracefully.
    return { scope: "out", message: "I couldn't map that to the report. Try asking about premium, branches, agents, or stuck cases." };
  }

  const noneCall = toolUses.find((t) => t.name === "none");
  if (noneCall && !toolUses.some((t) => METRIC_TOOL_NAMES.has(t.name))) {
    const reason = (noneCall.input as { reason?: string })?.reason;
    return {
      scope: "out",
      message: reason ?? "That's outside what this New Business report covers. Ask me about premium, branches, agents, products, or stuck cases.",
    };
  }

  const calls: RouterCall[] = toolUses
    .filter((t) => METRIC_TOOL_NAMES.has(t.name) || t.name === "snapshot_compare")
    .slice(0, MAX_TOOLS_PER_TURN)
    .map((t) => ({ metricId: t.name, filters: normalizeFilters(t.input as Filters) }));

  return { scope: "in", calls, needsInterpretation: false };
}
