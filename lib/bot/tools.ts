// Expose the metric catalog as Claude tools — one tool per metric, params = the §6.1 Filters
// type (§7.1). The router picks tool(s) + filters; the server executes the real metric functions.
import { catalogManifest } from "../metrics/catalog";

// Shared JSON Schema for the Filters object (§6.1). additionalProperties:false so the router
// can't smuggle freeform fields into the deterministic query path.
export const FILTERS_SCHEMA = {
  type: "object" as const,
  additionalProperties: false,
  properties: {
    branch: { type: "array", items: { type: "string" }, description: "Login branch names (canonical Title Case: Salem, Coimbatore, Erode, Tirunelveli, Chennai, Hosur, Thanjavur, Trichy)" },
    agent: { type: "array", items: { type: "string" }, description: "Agent names (exact, e.g. K SIVAPRAKASH)" },
    am: { type: "array", items: { type: "string" }, description: "Agency manager names" },
    productGenre: { type: "array", items: { type: "string" }, description: "Product genre (e.g. REASSURE_3.0_BLACK)" },
    planType: { type: "array", items: { type: "string", enum: ["FAMILY_FLOATER", "INDIVIDUAL", "OTHER"] } },
    funnelStage: { type: "array", items: { type: "string", enum: ["ISSUED", "UNDERWRITING", "OPERATIONS", "TELE_UW_REQUIRED", "REQUIREMENT_RAISED", "COUNTER_OFFER", "UNKNOWN", "OTHER"] } },
    bucket: { type: "array", items: { type: "string", enum: ["Won", "Pending", "Review"] }, description: "Coarse bucket: Won=issued, Pending=stuck/in-progress, Review=unknown" },
    isPortability: { type: "boolean", description: "true = portability (port) cases only" },
    discrepancyOnly: { type: "boolean", description: "true = only cases with a discrepancy flag" },
    minLoggedPremium: { type: "number", description: "Minimum logged premium (e.g. 50000 for 'big cases')" },
    customerState: { type: "array", items: { type: "string" }, description: "Customer state UPPERCASE (e.g. KARNATAKA)" },
    dateFrom: { type: "string", description: "ISO date lower bound on logged date" },
    dateTo: { type: "string", description: "ISO date upper bound on logged date" },
  },
} as const;

export type AnthropicTool = { name: string; description: string; input_schema: typeof FILTERS_SCHEMA | Record<string, unknown> };

/** Metric tools + a `none` escape hatch for out-of-scope questions (§7.2). */
export function buildTools(): AnthropicTool[] {
  const metricTools: AnthropicTool[] = catalogManifest().map((m) => ({
    name: m.id,
    description: `${m.description}. Returns a ${m.outputShape}. Call with a Filters object (all fields optional).`,
    input_schema: FILTERS_SCHEMA,
  }));
  // snapshot_compare works over another metric across the active + comparison snapshots (§6.2).
  metricTools.push({
    name: "snapshot_compare",
    description: "Compare a metric week-over-week across the active snapshot and the selected comparison snapshot (value, prev, delta, delta_pct). Use for 'which branches improved', 'compared to last week', WoW change. Set `metric` to the base metric to diff.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        metric: { type: "string", enum: ["totals", "premium_by_branch", "premium_by_product", "agent_leaderboard", "funnel"], description: "Base metric to diff across snapshots" },
        ...FILTERS_SCHEMA.properties,
      },
      required: ["metric"],
    },
  });
  metricTools.push({
    name: "none",
    description:
      "Use ONLY when the question is out of scope for this New Business report — weather, policy wording, medical/IRDAI/legal advice, general chit-chat. Do NOT use for any question answerable from the report data.",
    input_schema: { type: "object", additionalProperties: false, properties: { reason: { type: "string" } } },
  });
  return metricTools;
}

export const METRIC_TOOL_NAMES = new Set(catalogManifest().map((m) => m.id));
