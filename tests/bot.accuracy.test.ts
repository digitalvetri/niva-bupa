// §14 bot accuracy suite — 40 questions. The GROUND-TRUTH half (engine resolvers) is
// credential-free and always runs, proving the harness + pinning expected values. The LIVE half
// (real router + narrator, exact-equality + no-drift) runs only with Anthropic credentials.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma, ensureFixture } from "./helpers";
import { resolveLlmConfig, getProvider } from "../lib/bot/providers";
import { routeQuestion, type ChatTurn } from "../lib/bot/router";
import { narrate } from "../lib/bot/narrator";
import { detectLanguage, normalizeFilters } from "../lib/bot/transliterate";
import { checkNumericDrift, resultsContain } from "../lib/bot/numericGuard";
import { getMetric } from "../lib/metrics/catalog";
import type { Filters } from "../lib/metrics/types";

// Live half runs whenever ANY provider is resolvable (tenant settings aren't available here, so
// this uses the env fallback — set ANTHROPIC_API_KEY, or ANTHROPIC_MODEL for a specific model).
const LLM_CONFIG = resolveLlmConfig();

let sid = "";

async function engineNumbers(metric: string, filters: Filters, pick: (data: any) => (number | string)[]): Promise<(number | string)[]> {
  const r = await getMetric(metric)!.fn(prisma, sid, filters);
  return pick(r.data);
}

const U = (content: string): ChatTurn => ({ role: "user", content });
const A = (content: string): ChatTurn => ({ role: "assistant", content });

// [label, conversation, ground-truth resolver]. Resolvers read module-level `sid` lazily.
const CASES: [string, ChatTurn[], () => Promise<(number | string)[]>][] = [
  ["1 total logged premium", [U("What is the total logged premium?")], () => engineNumbers("totals", {}, (d) => [d.logged_premium])],
  ["2 premium issued", [U("How much premium has been issued?")], () => engineNumbers("totals", {}, (d) => [d.issued_premium])],
  ["3 conversion rate", [U("What's the conversion rate?")], () => engineNumbers("totals", {}, (d) => [d.conversion_pct])],
  ["4 top branch", [U("Which branch logged the most premium?")], () => engineNumbers("premium_by_branch", {}, (d) => [d[0].logged, d[0].cases])],
  ["5 Kovai cases (Tanglish)", [U("Kovai la evlo cases?")], () => engineNumbers("premium_by_branch", { branch: ["Coimbatore"] }, (d) => [d[0].cases])],
  ["6 stuck in underwriting", [U("How much premium is stuck in underwriting?")], () => engineNumbers("funnel", { funnelStage: ["UNDERWRITING"] }, (d) => [d[0].logged])],
  ["7 biggest stuck case", [U("What's the biggest stuck case?")], () => engineNumbers("stuck_cases", {}, (d) => [d[0].loggedPremium])],
  ["8 top agent", [U("Who is the top agent?")], () => engineNumbers("agent_leaderboard", {}, (d) => [d[0].logged, d[0].cases])],
  ["9 best agency manager", [U("Who is the best agency manager?")], () => engineNumbers("am_leaderboard", {}, (d) => [d[0].logged])],
  ["10 port cases", [U("How many port cases are there?")], () => engineNumbers("portability_summary", {}, (d) => [d.find((x: any) => x.segment === "Portability").cases])],
  ["11 Reassure Black premium", [U("What's the Reassure Black premium?")], () => engineNumbers("premium_by_product", { productGenre: ["REASSURE_3.0_BLACK"] }, (d) => [d[0].logged, d[0].cases])],
  ["12 discrepancy cases", [U("Are there any discrepancy cases?")], () => engineNumbers("discrepancy_cases", {}, (d) => [d.length])],
  ["13 cases pending a week+", [U("How many cases are pending more than a week?")], () => engineNumbers("ageing_buckets", {}, (d) => [d.find((x: any) => x.bucket === "8-14").cases])],
  ["15 follow up today (Tanglish)", [U("Yaaru follow up pannanum innaiku?")], () => engineNumbers("high_value_stuck", {}, (d) => [d[0].loggedPremium])],
  ["16 Salem pending (Tanglish, marquee)", [U("Salem la evlo pending irukku?")], () => engineNumbers("stuck_cases", normalizeFilters({ branch: ["Salem"], bucket: ["Pending"] }), (d) => [d.length])],
  ["17 Selam logged (transliteration)", [U("Selam la evlo logged premium?")], () => engineNumbers("premium_by_branch", { branch: ["Salem"] }, (d) => [d[0].logged])],
  ["18 Nellai cases", [U("Nellai la evlo cases irukku?")], () => engineNumbers("premium_by_branch", { branch: ["Tirunelveli"] }, (d) => [d[0].cases])],
  ["19 big pending cases", [U("Show me the big pending cases")], () => engineNumbers("high_value_stuck", {}, (d) => [d.length])],
  ["20 family floater split", [U("Family floater vs individual split?")], () => engineNumbers("premium_by_plan_type", { planType: ["FAMILY_FLOATER"] }, (d) => [d[0].cases])],
  ["21 out-of-state (Karnataka)", [U("Any Karnataka customers?")], () => engineNumbers("geo_customer", { customerState: ["KARNATAKA"] }, (d) => [d[0].cases])],
  ["22 tele-UW required count", [U("How many cases need tele-UW?")], () => engineNumbers("funnel", { funnelStage: ["TELE_UW_REQUIRED"] }, (d) => [d[0].cases])],
  ["23 Chennai conversion", [U("What's Chennai's conversion rate?")], () => engineNumbers("premium_by_branch", { branch: ["Chennai"] }, (d) => [d[0].conversion_pct])],
  ["24 Erode agents", [U("Who are the agents in Erode?")], () => engineNumbers("agent_leaderboard", { branch: ["Erode"] }, (d) => [d[0].logged])],
  ["25 K SIVAPRAKASH cases", [U("How many cases does K SIVAPRAKASH have?")], () => engineNumbers("agent_leaderboard", { agent: ["K SIVAPRAKASH"] }, (d) => [d[0].cases])],
  ["26 counter offer cases", [U("How many counter offer cases?")], () => engineNumbers("funnel", { funnelStage: ["COUNTER_OFFER"] }, (d) => [d[0].cases])],
  ["27 requirement raised premium", [U("Premium stuck at requirement raised?")], () => engineNumbers("funnel", { funnelStage: ["REQUIREMENT_RAISED"] }, (d) => [d[0].logged])],
  ["28 aspire premium", [U("What's the Aspire product premium?")], () => engineNumbers("premium_by_product", { productGenre: ["Aspire"] }, (d) => [d[0].logged])],
  ["29 fresh (non-port) count", [U("How many fresh non-port cases?")], () => engineNumbers("portability_summary", {}, (d) => [d.find((x: any) => x.segment === "Fresh").cases])],
  ["30 Salem issued count", [U("How many issued in Salem?")], () => engineNumbers("totals", { branch: ["Salem"], funnelStage: ["ISSUED"] }, (d) => [d.case_count])],
  ["31 followup by agent (multi-turn)", [U("How's Salem doing?"), A("Salem logged ₹8.58L across 21 cases."), U("and by agent?")], () => engineNumbers("agent_leaderboard", { branch: ["Salem"] }, (d) => [d[0].logged])],
  ["32 followup stuck there (multi-turn)", [U("Show me Coimbatore"), A("Coimbatore: 11 cases."), U("how much is stuck there?")], () => engineNumbers("stuck_summary", { branch: ["Coimbatore"] }, (d) => [d.reduce((s: number, r: any) => s + r.count, 0)])],
  ["33 case count for avg ticket", [U("What's the average ticket size?")], () => engineNumbers("totals", {}, (d) => [d.case_count])],
  ["34 stuck premium total", [U("Total stuck premium?")], () => engineNumbers("totals", {}, (d) => [d.stuck_premium])],
  ["35 Hosur cases", [U("Hosur la evlo cases?")], () => engineNumbers("premium_by_branch", { branch: ["Hosur"] }, (d) => [d[0].cases])],
  ["36 Thanjavur (Tanjore) logged", [U("Tanjore evlo logged?")], () => engineNumbers("premium_by_branch", { branch: ["Thanjavur"] }, (d) => [d[0].logged])],
  ["37 elite product cases", [U("Reassure Elite evlo cases?")], () => engineNumbers("premium_by_product", { productGenre: ["REASSURE_3.0_ELITE"] }, (d) => [d[0].cases])],
  ["38 operations stuck", [U("How much is with operations?")], () => engineNumbers("funnel", { funnelStage: ["OPERATIONS"] }, (d) => [d[0].logged])],
];

// ── Always-run: prove the harness + pin ground-truth values (no LLM) ──────────────
describe("§14 harness — ground-truth resolvers (credential-free)", () => {
  beforeAll(async () => {
    sid = (await ensureFixture()).snapshotId;
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it.each(CASES)("%s resolves to finite engine numbers", async (_label, _history, truth) => {
    const nums = await truth();
    expect(nums.length).toBeGreaterThan(0);
    for (const n of nums) expect(Number.isFinite(Number(String(n).replace(/[₹,%LlCcr\s]/g, "")))).toBe(true);
  });
});

// ── Live: real router + narrator, exact numeric equality + no drift ────────────────
const RUN = LLM_CONFIG !== null;
(RUN ? describe : describe.skip)("§14 live accuracy — numbers equal the engine, narrator invents nothing", () => {
  // Guard: the describe body is evaluated even when skipped, so only build the provider when RUN.
  const provider = RUN ? getProvider(LLM_CONFIG!) : (null as never);
  beforeAll(async () => {
    sid = (await ensureFixture()).snapshotId;
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function pipeline(history: ChatTurn[]) {
    const routed = await routeQuestion(provider, history);
    if (routed.scope === "out") return { scope: "out" as const, message: routed.message };
    const results: unknown[] = [];
    for (const call of routed.calls) {
      const entry = getMetric(call.metricId);
      if (entry) results.push({ metric: call.metricId, filters: call.filters, ...(await entry.fn(prisma, sid, call.filters)) });
    }
    const question = [...history].reverse().find((m) => m.role === "user")!.content;
    let narration = "";
    for await (const t of narrate(provider, { question, language: detectLanguage(question), toolResults: results })) narration += t;
    return { scope: "in" as const, metrics: routed.calls.map((c) => c.metricId), results, narration, drift: checkNumericDrift(narration, results) };
  }

  it.each(CASES)("%s", async (_label, history, truth) => {
    const [expected, out] = await Promise.all([truth(), pipeline(history)]);
    expect(out.scope).toBe("in");
    if (out.scope !== "in") return;
    for (const n of expected) expect(resultsContain(out.results, n), `expected ${n} in results (metrics: ${out.metrics})`).toBe(true);
    expect(out.drift.ok, `narrator drift: ${out.drift.offending.join(", ")}`).toBe(true);
  });

  it("39 unknown person -> no invented numbers (§13.13)", async () => {
    const out = await pipeline([U("What's RAJINIKANTH SUPERSTAR's case status?")]);
    if (out.scope === "in") expect(out.drift.ok).toBe(true);
  });

  it("40 out of scope (IRDAI rule) -> decline (§13.14)", async () => {
    expect((await pipeline([U("What does the IRDAI rulebook say about free-look periods?")])).scope).toBe("out");
  });

  it("weather -> decline", async () => {
    expect((await pipeline([U("What's the weather in Chennai tomorrow?")])).scope).toBe("out");
  });
});

if (!RUN) {
  describe("§14 live accuracy — SKIPPED (no AI provider configured)", () => {
    it("set ANTHROPIC_API_KEY (or configure a provider key in Settings), then re-run the live suite", () => {
      expect(resolveLlmConfig()).toBeNull();
    });
  });
}
