import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma, ensureFixture } from "./helpers";
import { totals, premiumByBranch, funnel, stuckSummary, stuckCases, agentLeaderboard } from "../lib/metrics/metrics";

let snapshotId: string;

beforeAll(async () => {
  ({ snapshotId } = await ensureFixture());
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("§12 Phase 1 DoD — metric engine numbers vs the real fixture", () => {
  it("totals: logged 3,177,434 / issued 1,629,060 / 50 of 80 issued", async () => {
    const r = await totals(prisma, snapshotId, {});
    expect(r.data.logged_premium).toBe(3177434);
    expect(r.data.issued_premium).toBe(1629060);
    expect(r.data.issued_count).toBe(50);
    expect(r.data.case_count).toBe(80);
    // Conversion uses the true case count (80), not the spec's blank-inflated 81.
    expect(r.data.conversion_pct).toBe(62.5);
    expect(r.data.display.logged).toBe("₹31.77L");
    expect(r.data.display.issued).toBe("₹16.29L");
    expect(r.meta.rowsMatched).toBe(80);
  });

  it("premium_by_branch: Salem top, 21 cases, ₹8,57,759 logged", async () => {
    const r = await premiumByBranch(prisma, snapshotId, {});
    expect(r.data.length).toBe(8);
    const top = r.data[0]!;
    expect(top.branch).toBe("Salem");
    expect(top.cases).toBe(21);
    expect(top.logged).toBe(857759);
    expect(top.display.logged).toBe("₹8.58L");
    // sorted descending by logged
    for (let i = 1; i < r.data.length; i++) expect(r.data[i - 1]!.logged).toBeGreaterThanOrEqual(r.data[i]!.logged);
  });

  it("funnel: 50 ISSUED cases, ordered", async () => {
    const r = await funnel(prisma, snapshotId, {});
    const issued = r.data.find((x) => x.stage === "ISSUED")!;
    expect(issued.cases).toBe(50);
    expect(r.data.reduce((s, x) => s + x.cases, 0)).toBe(80);
    expect(r.data[0]!.stage).toBe("ISSUED"); // ISSUED first in canonical order
  });

  it("agent_leaderboard: K SIVAPRAKASH #1 at ₹2,97,314 across 6 cases", async () => {
    const r = await agentLeaderboard(prisma, snapshotId, {});
    const top = r.data[0]!;
    expect(top.agentName).toBe("K SIVAPRAKASH");
    expect(top.logged).toBe(297314);
    expect(top.cases).toBe(6);
  });

  it("stuck_cases: 30 cases, top NAGARAJAN P at ₹1,45,951", async () => {
    const r = await stuckCases(prisma, snapshotId, {});
    expect(r.data.length).toBe(30);
    const top = r.data[0]!;
    expect(top.customerName).toMatch(/^NAGARAJAN\s+P$/);
    expect(top.loggedPremium).toBe(145951);
    expect(top.display.loggedFull).toBe("₹1,45,951");
    // none are ISSUED, all have premium > 0
    for (const c of r.data) {
      expect(c.funnelStage).not.toBe("ISSUED");
      expect(c.loggedPremium).toBeGreaterThan(0);
    }
  });

  it("stuck_summary: totals reconcile with stuck_cases (30 cases)", async () => {
    const r = await stuckSummary(prisma, snapshotId, {});
    const totalCount = r.data.reduce((s, x) => s + x.count, 0);
    const totalPrem = r.data.reduce((s, x) => s + x.premium, 0);
    expect(totalCount).toBe(30);
    expect(Math.round(totalPrem)).toBe(1560417); // sum of stuck logged premium (verified vs fixture)
  });

  it("stuck filters compose: minLoggedPremium narrows stuck_cases (not clobbered)", async () => {
    const all = await stuckCases(prisma, snapshotId, {});
    const big = await stuckCases(prisma, snapshotId, { minLoggedPremium: 50000 });
    expect(big.data.length).toBeLessThan(all.data.length);
    expect(big.data.length).toBeGreaterThan(0);
    for (const c of big.data) expect(c.loggedPremium).toBeGreaterThanOrEqual(50000);
    // still a strict subset of the 30 stuck cases
    const allApps = new Set(all.data.map((c) => c.applicationNo));
    for (const c of big.data) expect(allApps.has(c.applicationNo)).toBe(true);
  });

  it("filters compose: Salem-only totals are a strict subset", async () => {
    const all = await totals(prisma, snapshotId, {});
    const salem = await totals(prisma, snapshotId, { branch: ["Salem"] });
    expect(salem.data.case_count).toBe(21);
    expect(salem.data.logged_premium).toBe(857759);
    expect(salem.data.logged_premium).toBeLessThan(all.data.logged_premium);
  });
});
