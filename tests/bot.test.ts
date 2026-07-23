// Deterministic bot tests — no API credentials required. These cover everything in the
// router→execute→narrate pipeline EXCEPT the two LLM calls: transliteration, tool schemas,
// the numeric-drift guard, and the fact that executing a metric gives exact numbers.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma, ensureFixture } from "./helpers";
import { canonicalBranch, normalizeFilters, detectLanguage } from "../lib/bot/transliterate";
import { buildTools, FILTERS_SCHEMA, METRIC_TOOL_NAMES } from "../lib/bot/tools";
import { canonicalizeNumber, checkNumericDrift } from "../lib/bot/numericGuard";
import { getMetric } from "../lib/metrics/catalog";
import type { TotalsData, BranchRow, StuckCaseRow, AgentRow } from "../lib/metrics/metrics";

describe("§7.2 branch transliteration", () => {
  it.each([
    ["Kovai", "Coimbatore"],
    ["kovai", "Coimbatore"],
    ["Nellai", "Tirunelveli"],
    ["Selam", "Salem"],
    ["Tanjore", "Thanjavur"],
    ["ERODE", "Erode"],
    ["salem", "Salem"],
  ])("%s -> %s", (raw, out) => {
    expect(canonicalBranch(raw)).toBe(out);
  });

  it("normalizeFilters canonicalizes branches and uppercases states", () => {
    const f = normalizeFilters({ branch: ["Selam", "kovai"], customerState: ["karnataka"] });
    expect(f.branch).toEqual(["Salem", "Coimbatore"]);
    expect(f.customerState).toEqual(["KARNATAKA"]);
  });
});

describe("§7.1/7.3 language register detection", () => {
  it.each([
    ["Salem la evlo pending irukku?", "tanglish"],
    ["Yaaru follow up pannanum innaiku?", "tanglish"],
    ["What is the total logged premium?", "english"],
    ["சேலம் எத்தனை pending", "tamil"],
  ])("%s -> %s", (text, hint) => {
    expect(detectLanguage(text)).toBe(hint);
  });
});

describe("§7.1 metric catalog exposed as tools", () => {
  it("one tool per metric + snapshot_compare + a 'none' escape hatch", () => {
    const tools = buildTools();
    expect(tools.some((t) => t.name === "none")).toBe(true);
    expect(tools.some((t) => t.name === "snapshot_compare")).toBe(true);
    const metricTools = tools.filter((t) => t.name !== "none" && t.name !== "snapshot_compare");
    expect(metricTools.length).toBe(METRIC_TOOL_NAMES.size);
    expect(metricTools.map((t) => t.name).sort()).toEqual([...METRIC_TOOL_NAMES].sort());
  });
  it("every plain metric tool uses the shared Filters schema (locked down)", () => {
    for (const t of buildTools().filter((t) => t.name !== "none" && t.name !== "snapshot_compare")) {
      expect(t.parameters).toBe(FILTERS_SCHEMA);
    }
    expect((FILTERS_SCHEMA as { additionalProperties: boolean }).additionalProperties).toBe(false);
  });
});

describe("numeric-drift guard (structural: no invented numbers)", () => {
  const results = [{ metric: "totals", data: { logged_premium: 3177434, conversion_pct: 62.5, display: { logged: "₹31.77L" } }, meta: { rowsMatched: 80 } }];

  it("canonicalizes ₹/%/L/comma forms to a comparable core", () => {
    expect(canonicalizeNumber("₹31.77L")).toBe("31.77");
    expect(canonicalizeNumber("8,57,759")).toBe("857759");
    expect(canonicalizeNumber("62.50%")).toBe("62.5");
  });

  it("passes a faithful narration", () => {
    const good = checkNumericDrift("Logged premium is ₹31.77L across 80 cases, a 62.5% conversion. Break it by branch?", results);
    expect(good.ok).toBe(true);
  });

  it("flags a hallucinated number", () => {
    const bad = checkNumericDrift("Logged premium is ₹45.00L this week.", results);
    expect(bad.ok).toBe(false);
    expect(bad.offending).toContain("₹45.00L");
  });

  it("allows the raw grouped form of a number in the results", () => {
    const ok = checkNumericDrift("That's ₹31,77,434 in total.", results);
    expect(ok.ok).toBe(true);
  });
});

// The core numeric-accuracy guarantee (§7.1): the server executes the REAL metric functions.
// This is the deterministic half of the §14 DoD — no LLM involved.
describe("executor exactness — routed metric returns engine-exact numbers", () => {
  let snapshotId: string;
  beforeAll(async () => {
    ({ snapshotId } = await ensureFixture());
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("totals -> ₹31,77,434 logged", async () => {
    const r = await getMetric("totals")!.fn(prisma, snapshotId, {});
    expect((r.data as TotalsData).logged_premium).toBe(3177434);
  });

  it("premium_by_branch with normalized 'Selam' filter -> Salem 857,759", async () => {
    const filters = normalizeFilters({ branch: ["Selam"] }); // as a router might pass it
    const r = await getMetric("premium_by_branch")!.fn(prisma, snapshotId, filters);
    const rows = r.data as BranchRow[];
    expect(rows.length).toBe(1);
    expect(rows[0]!.branch).toBe("Salem");
    expect(rows[0]!.logged).toBe(857759);
  });

  it("stuck_cases (Salem, Pending) -> 10 pending, matches Pulse", async () => {
    const filters = normalizeFilters({ branch: ["Selam"], bucket: ["Pending"] });
    const r = await getMetric("stuck_cases")!.fn(prisma, snapshotId, filters);
    expect((r.data as StuckCaseRow[]).length).toBe(10);
  });

  it("agent_leaderboard -> K SIVAPRAKASH #1 at 297,314", async () => {
    const r = await getMetric("agent_leaderboard")!.fn(prisma, snapshotId, {});
    const top = (r.data as AgentRow[])[0]!;
    expect(top.agentName).toBe("K SIVAPRAKASH");
    expect(top.logged).toBe(297314);
  });
});
