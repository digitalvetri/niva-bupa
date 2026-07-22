import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma, ensureFixture } from "./helpers";
import { totals, dailyTrend } from "../lib/metrics/metrics";
import { listCases } from "../lib/cases";

let snapshotId: string;
beforeAll(async () => {
  ({ snapshotId } = await ensureFixture());
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("Phase 2 backend additions", () => {
  it("totals exposes stuck_premium ₹15,60,417 / stuck_count 30 for the Pulse KPI + banner", async () => {
    const r = await totals(prisma, snapshotId, {});
    expect(r.data.stuck_premium).toBe(1560417);
    expect(r.data.stuck_count).toBe(30);
    expect(r.data.display.stuck).toBe("₹15.60L");
  });

  it("daily_trend: dates ascending, logged reconciles with dated cases", async () => {
    const r = await dailyTrend(prisma, snapshotId, {});
    expect(r.data.length).toBeGreaterThan(0);
    for (let i = 1; i < r.data.length; i++) expect(r.data[i - 1]!.date <= r.data[i]!.date).toBe(true);
    const trendLogged = r.data.reduce((s, p) => s + p.logged, 0);
    const dated = await prisma.nbCase.aggregate({ where: { snapshotId, loggedDate: { not: null } }, _sum: { loggedPremium: true } });
    expect(trendLogged).toBe(Number(dated._sum.loggedPremium));
  });

  it("listCases: server pagination + total", async () => {
    const p1 = await listCases(prisma, snapshotId, {}, { page: 1, pageSize: 25 });
    expect(p1.total).toBe(80);
    expect(p1.rows.length).toBe(25);
    expect(p1.totalPages).toBe(4);
    // default sort loggedPremium desc
    for (let i = 1; i < p1.rows.length; i++) expect(p1.rows[i - 1]!.loggedPremium).toBeGreaterThanOrEqual(p1.rows[i]!.loggedPremium);
    const p4 = await listCases(prisma, snapshotId, {}, { page: 4, pageSize: 25 });
    expect(p4.rows.length).toBe(5); // 80 = 25*3 + 5
  });

  it("listCases: filters + search compose with the metric engine's Filters", async () => {
    const salem = await listCases(prisma, snapshotId, { branch: ["Salem"] }, { pageSize: 100 });
    expect(salem.total).toBe(21);
    expect(salem.rows.every((r) => r.loginBranch === "Salem")).toBe(true);
    const search = await listCases(prisma, snapshotId, {}, { search: "NAGARAJAN" });
    expect(search.total).toBeGreaterThanOrEqual(1);
    expect(search.rows.some((r) => /NAGARAJAN/i.test(r.customerName))).toBe(true);
  });

  it("listCases: pending bucket = the 30 pipeline cases", async () => {
    const pending = await listCases(prisma, snapshotId, { bucket: ["Pending"] }, { pageSize: 100 });
    expect(pending.total).toBe(30);
    expect(pending.rows.every((r) => r.funnelStage !== "ISSUED")).toBe(true);
  });
});
