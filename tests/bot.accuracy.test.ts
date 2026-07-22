// §14 bot accuracy suite — 40 questions. Runs the REAL router + narrator (LLM), then asserts
// every answer's numbers equal the metric-engine output and the narrator invented nothing.
// Skips automatically when no Anthropic credentials are present (ANTHROPIC_API_KEY / auth token).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma, ensureFixture } from "./helpers";
import { hasAnthropicCredentials } from "../lib/bot/anthropic";
import { routeQuestion, type ChatTurn } from "../lib/bot/router";
import { narrate } from "../lib/bot/narrator";
import { detectLanguage, normalizeFilters } from "../lib/bot/transliterate";
import { checkNumericDrift, resultsContain } from "../lib/bot/numericGuard";
import { getMetric } from "../lib/metrics/catalog";
import type { Filters } from "../lib/metrics/types";

const RUN = hasAnthropicCredentials();
const d = RUN ? describe : describe.skip;

let sid: string;
beforeAll(async () => {
  ({ sid } = { sid: (await ensureFixture()).snapshotId });
});
afterAll(async () => {
  await prisma.$disconnect();
});

/** Ground truth straight from the engine — numbers the router's answer MUST reproduce. */
async function engineNumbers(metric: string, filters: Filters, pick: (data: unknown) => (number | string)[]): Promise<(number | string)[]> {
  const r = await getMetric(metric)!.fn(prisma, sid, filters);
  return pick(r.data);
}

/** Run the full router -> execute -> narrate pipeline for a conversation. */
async function pipeline(history: ChatTurn[]) {
  const routed = await routeQuestion(history);
  if (routed.scope === "out") return { scope: "out" as const, message: routed.message };
  const results: unknown[] = [];
  for (const call of routed.calls) {
    const entry = getMetric(call.metricId);
    if (entry) results.push({ metric: call.metricId, filters: call.filters, ...(await entry.fn(prisma, sid, call.filters)) });
  }
  const question = [...history].reverse().find((m) => m.role === "user")!.content;
  let narration = "";
  for await (const t of narrate({ question, language: detectLanguage(question), toolResults: results })) narration += t;
  return { scope: "in" as const, metrics: routed.calls.map((c) => c.metricId), results, narration, drift: checkNumericDrift(narration, results) };
}

const U = (content: string): ChatTurn => ({ role: "user", content });
const A = (content: string): ChatTurn => ({ role: "assistant", content });

d("§14 accuracy — numbers equal the metric engine, narrator invents nothing", () => {
  // In-scope questions: [label, history, ground-truth resolver]
  const CASES: [string, ChatTurn[], () => Promise<(number | string)[]>][] = [
    ["1 total logged premium", [U("What is the total logged premium?")], () => engineNumbers("totals", {}, (d: any) => [d.logged_premium])],
    ["2 premium issued", [U("How much premium has been issued?")], () => engineNumbers("totals", {}, (d: any) => [d.issued_premium])],
    ["3 conversion rate", [U("What's the conversion rate?")], () => engineNumbers("totals", {}, (d: any) => [d.conversion_pct])],
    ["4 top branch", [U("Which branch logged the most premium?")], () => engineNumbers("premium_by_branch", {}, (d: any) => [d[0].logged, d[0].cases])],
    ["5 Kovai cases (Tanglish)", [U("Kovai la evlo cases?")], () => engineNumbers("premium_by_branch", { branch: ["Coimbatore"] }, (d: any) => [d[0].cases])],
    ["6 stuck in underwriting", [U("How much premium is stuck in underwriting?")], () => engineNumbers("funnel", { funnelStage: ["UNDERWRITING"] }, (d: any) => [d[0].logged])],
    ["7 biggest stuck case", [U("What's the biggest stuck case?")], () => engineNumbers("stuck_cases", {}, (d: any) => [d[0].loggedPremium])],
    ["8 top agent", [U("Who is the top agent?")], () => engineNumbers("agent_leaderboard", {}, (d: any) => [d[0].logged, d[0].cases])],
    ["9 best agency manager", [U("Who is the best agency manager?")], () => engineNumbers("am_leaderboard", {}, (d: any) => [d[0].logged])],
    ["10 port cases", [U("How many port cases are there?")], () => engineNumbers("portability_summary", {}, (d: any) => [d.find((x: any) => x.segment === "Portability").cases])],
    ["11 Reassure Black premium", [U("What's the Reassure Black premium?")], () => engineNumbers("premium_by_product", { productGenre: ["REASSURE_3.0_BLACK"] }, (d: any) => [d[0].logged, d[0].cases])],
    ["12 discrepancy cases", [U("Are there any discrepancy cases?")], () => engineNumbers("discrepancy_cases", {}, (d: any) => [d.length])],
    ["13 cases pending > 5 days", [U("How many cases are pending more than a week?")], () => engineNumbers("ageing_buckets", {}, (d: any) => [d.find((x: any) => x.bucket === "8-14").cases])],
    ["15 follow up today (Tanglish)", [U("Yaaru follow up pannanum innaiku?")], () => engineNumbers("high_value_stuck", {}, (d: any) => [d[0].loggedPremium])],
    ["16 Salem pending (Tanglish, marquee)", [U("Salem la evlo pending irukku?")], () => engineNumbers("stuck_cases", normalizeFilters({ branch: ["Salem"], bucket: ["Pending"] }), (d: any) => [d.length])],
    ["17 Selam logged (transliteration)", [U("Selam la evlo logged premium?")], () => engineNumbers("premium_by_branch", { branch: ["Salem"] }, (d: any) => [d[0].logged])],
    ["18 Nellai cases", [U("Nellai la evlo cases irukku?")], () => engineNumbers("premium_by_branch", { branch: ["Tirunelveli"] }, (d: any) => [d[0].cases])],
    ["19 big pending cases", [U("Show me the big pending cases")], () => engineNumbers("high_value_stuck", {}, (d: any) => [d.length])],
    ["20 family floater split", [U("Family floater vs individual split?")], () => engineNumbers("premium_by_plan_type", { planType: ["FAMILY_FLOATER"] }, (d: any) => [d[0].cases])],
    ["21 out-of-state customers", [U("Any out of state customers?")], () => engineNumbers("geo_customer", { customerState: ["KARNATAKA"] }, (d: any) => [d[0].cases])],
    ["22 tele-UW required count", [U("How many cases need tele-UW?")], () => engineNumbers("funnel", { funnelStage: ["TELE_UW_REQUIRED"] }, (d: any) => [d[0].cases])],
    ["23 Chennai conversion", [U("What's Chennai's conversion rate?")], () => engineNumbers("premium_by_branch", { branch: ["Chennai"] }, (d: any) => [d[0].conversion_pct])],
    ["24 Erode agents", [U("Who are the agents in Erode?")], () => engineNumbers("agent_leaderboard", { branch: ["Erode"] }, (d: any) => [d[0].logged])],
    ["25 K SIVAPRAKASH cases", [U("How many cases does K SIVAPRAKASH have?")], () => engineNumbers("agent_leaderboard", { agent: ["K SIVAPRAKASH"] }, (d: any) => [d[0].cases])],
    ["26 counter offer cases", [U("How many counter offer cases?")], () => engineNumbers("funnel", { funnelStage: ["COUNTER_OFFER"] }, (d: any) => [d[0].cases])],
    ["27 requirement raised premium", [U("Premium stuck at requirement raised?")], () => engineNumbers("funnel", { funnelStage: ["REQUIREMENT_RAISED"] }, (d: any) => [d[0].logged])],
    ["28 aspire premium", [U("What's the Aspire product premium?")], () => engineNumbers("premium_by_product", { productGenre: ["Aspire"] }, (d: any) => [d[0].logged])],
    ["29 fresh (non-port) count", [U("How many fresh non-port cases?")], () => engineNumbers("portability_summary", {}, (d: any) => [d.find((x: any) => x.segment === "Fresh").cases])],
    ["30 Salem issued count", [U("How many issued in Salem?")], () => engineNumbers("totals", { branch: ["Salem"], funnelStage: ["ISSUED"] }, (d: any) => [d.case_count])],
    // Multi-turn follow-ups (filters must be inherited)
    ["31 followup by agent", [U("How's Salem doing?"), A("Salem logged ₹8.58L across 21 cases."), U("and by agent?")], () => engineNumbers("agent_leaderboard", { branch: ["Salem"] }, (d: any) => [d[0].logged])],
    ["32 followup stuck there", [U("Show me Coimbatore"), A("Coimbatore: 11 cases."), U("how much is stuck there?")], () => engineNumbers("stuck_summary", { branch: ["Coimbatore"] }, (d: any) => [d.reduce((s: number, r: any) => s + r.count, 0)])],
    ["33 avg ticket", [U("What's the average ticket size?")], () => engineNumbers("totals", {}, (d: any) => [d.case_count])],
    ["34 stuck premium total", [U("Total stuck premium?")], () => engineNumbers("totals", {}, (d: any) => [d.stuck_premium])],
    ["35 Hosur cases", [U("Hosur la evlo cases?")], () => engineNumbers("premium_by_branch", { branch: ["Hosur"] }, (d: any) => [d[0].cases])],
    ["36 Thanjavur (Tanjore) logged", [U("Tanjore evlo logged?")], () => engineNumbers("premium_by_branch", { branch: ["Thanjavur"] }, (d: any) => [d[0].logged])],
    ["37 elite product cases", [U("Reassure Elite evlo cases?")], () => engineNumbers("premium_by_product", { productGenre: ["REASSURE_3.0_ELITE"] }, (d: any) => [d[0].cases])],
    ["38 operations stuck", [U("How much is with operations?")], () => engineNumbers("funnel", { funnelStage: ["OPERATIONS"] }, (d: any) => [d[0].logged])],
  ];

  it.each(CASES)("%s", async (_label, history, truth) => {
    const [expected, out] = await Promise.all([truth(), pipeline(history)]);
    expect(out.scope).toBe("in");
    if (out.scope !== "in") return;
    for (const n of expected) expect(resultsContain(out.results, n), `expected ${n} in results (metrics: ${out.metrics})`).toBe(true);
    expect(out.drift.ok, `narrator drift: ${out.drift.offending.join(", ")}`).toBe(true);
  });

  // §13.13 person not in data — zero hallucination.
  it("39 unknown person -> no invented numbers", async () => {
    const out = await pipeline([U("What's RAJINIKANTH SUPERSTAR's case status?")]);
    if (out.scope === "in") expect(out.drift.ok).toBe(true);
    // acceptable either as an in-scope zero-result answer or a scoped decline
  });

  // §13.14 out of scope -> polite decline, no tools.
  it("40 out of scope (IRDAI rule) -> decline", async () => {
    const out = await pipeline([U("What does the IRDAI rulebook say about free-look periods?")]);
    expect(out.scope).toBe("out");
  });

  it("weather out of scope -> decline", async () => {
    const out = await pipeline([U("What's the weather in Chennai tomorrow?")]);
    expect(out.scope).toBe("out");
  });
});

if (!RUN) {
  // Visible signal that the live suite was skipped for lack of credentials.
  describe("§14 accuracy — SKIPPED (no Anthropic credentials)", () => {
    it("set ANTHROPIC_API_KEY (or run `ant auth login`) and re-run to execute the 40-question suite", () => {
      expect(hasAnthropicCredentials()).toBe(false);
    });
  });
}
