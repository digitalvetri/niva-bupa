// Deterministic tests for the metrics added to complete the §6.2 catalog for the bot.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma, ensureFixture } from "./helpers";
import { CATALOG, getMetric } from "../lib/metrics/catalog";
import type { GroupRow, PortabilityRow, StuckCaseRow, AgeingBucketRow, GeoRow, TenureRow, TicketRow } from "../lib/metrics/metrics";

let snapshotId: string;
beforeAll(async () => {
  ({ snapshotId } = await ensureFixture());
});
afterAll(async () => {
  await prisma.$disconnect();
});

const run = <T>(name: string) => getMetric(name)!.fn(prisma, snapshotId, {}) as Promise<{ data: T; meta: { rowsMatched: number } }>;

describe("§6.2 completed catalog", () => {
  it("premium_by_product: REASSURE_3.0_BLACK top — 18 cases, ₹11,41,243", async () => {
    const { data } = await run<GroupRow[]>("premium_by_product");
    const top = data[0]!;
    expect(top.key).toBe("REASSURE_3.0_BLACK");
    expect(top.cases).toBe(18);
    expect(top.logged).toBe(1141243);
    expect(top.display.logged).toBe("₹11.41L");
  });

  it("am_leaderboard: Swetha Mahadevan top — ₹3,12,535 / 7 cases (₹3.13L)", async () => {
    const { data } = await run<GroupRow[]>("am_leaderboard");
    const top = data[0]!;
    expect(top.key).toBe("Swetha Mahadevan");
    expect(top.logged).toBe(312535);
    expect(top.cases).toBe(7);
    expect(top.display.logged).toBe("₹3.13L");
  });

  it("premium_by_plan_type: Family Floater 51 (case-merged) vs Individual 29", async () => {
    const { data } = await run<GroupRow[]>("premium_by_plan_type");
    const byKey = new Map(data.map((r) => [r.key, r.cases]));
    expect(byKey.get("FAMILY_FLOATER")).toBe(51);
    expect(byKey.get("INDIVIDUAL")).toBe(29);
  });

  it("portability_summary: 30 port / 50 fresh, port logged ₹16,73,965", async () => {
    const { data } = await run<PortabilityRow[]>("portability_summary");
    const port = data.find((r) => r.segment === "Portability")!;
    const fresh = data.find((r) => r.segment === "Fresh")!;
    expect(port.cases).toBe(30);
    expect(port.logged).toBe(1673965);
    expect(fresh.cases).toBe(50);
  });

  it("discrepancy_cases: 8 cases incl. SARITHA N", async () => {
    const { data } = await run<StuckCaseRow[]>("discrepancy_cases");
    expect(data.length).toBe(8);
    expect(data.some((c) => c.customerName === "SARITHA N")).toBe(true);
  });

  it("ageing_buckets (pending): 0-3=18, 4-7=8, 8-14=4 (total 30)", async () => {
    const { data } = await run<AgeingBucketRow[]>("ageing_buckets");
    const byBucket = new Map(data.map((r) => [r.bucket, r.cases]));
    expect(byBucket.get("0-3")).toBe(18);
    expect(byBucket.get("4-7")).toBe(8);
    expect(byBucket.get("8-14")).toBe(4);
    expect(data.reduce((s, r) => s + r.cases, 0)).toBe(30);
  });

  it("high_value_stuck: 12 cases ≥₹50,000, top NAGARAJAN P ₹1,45,951", async () => {
    const { data } = await run<StuckCaseRow[]>("high_value_stuck");
    expect(data.length).toBe(12);
    expect(data[0]!.customerName).toMatch(/^NAGARAJAN\s+P$/);
    expect(data[0]!.loggedPremium).toBe(145951);
    for (const c of data) expect(c.loggedPremium).toBeGreaterThanOrEqual(50000);
  });

  it("geo_customer: 5 out-of-state cases (GOA/KARNATAKA/TELANGANA)", async () => {
    const { data } = await run<GeoRow[]>("geo_customer");
    const oos = data.filter((r) => r.state !== "TAMIL NADU").reduce((s, r) => s + r.cases, 0);
    expect(oos).toBe(5);
  });

  it("tenure_mix + ticket_size_distribution reconcile to 80 cases", async () => {
    const tenure = await run<TenureRow[]>("tenure_mix");
    const ticket = await run<TicketRow[]>("ticket_size_distribution");
    expect(tenure.data.reduce((s, r) => s + r.cases, 0)).toBe(80);
    expect(ticket.data.reduce((s, r) => s + r.cases, 0)).toBe(80);
  });

  it("catalog exposes 17 metrics", () => {
    expect(Object.keys(CATALOG).length).toBe(17);
  });
});
