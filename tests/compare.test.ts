import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma, ensureFixture, readFixture, TEST_TENANT_ID } from "./helpers";
import { ingestCsv } from "../lib/ingest/ingest";
import { synthPrevWeekCsv, SYNTH_PREV_FILENAME } from "../lib/dev/synth";
import { compareMetric } from "../lib/metrics/compare";
import { getMetric } from "../lib/metrics/catalog";
import type { TotalsData, BranchRow } from "../lib/metrics/metrics";

let current: string;
let previous: string;

beforeAll(async () => {
  current = (await ensureFixture()).snapshotId;
  const res = await ingestCsv(prisma, { tenantId: TEST_TENANT_ID, uploadedById: "test", fileName: SYNTH_PREV_FILENAME, content: synthPrevWeekCsv(readFixture()) });
  previous = res.snapshotId;
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("§6.2 snapshot_compare — generic value/prev/delta/delta_pct", () => {
  it("distinct snapshots (synthetic prev-week ingested)", () => {
    expect(previous).not.toBe(current);
  });

  it("totals: delta math matches the two engine runs exactly", async () => {
    const cur = ((await getMetric("totals")!.fn(prisma, current, {})).data as TotalsData);
    const prev = ((await getMetric("totals")!.fn(prisma, previous, {})).data as TotalsData);
    const cmp = (await compareMetric(prisma, "totals", current, previous, {})).data;

    expect(cmp.kind).toBe("scalar");
    const logged = cmp.cells.find((c) => c.key === "logged_premium")!;
    expect(logged.value).toBe(cur.logged_premium); // 3,177,434
    expect(logged.prev).toBe(prev.logged_premium);
    expect(logged.delta).toBe(cur.logged_premium - prev.logged_premium);
    expect(logged.delta_pct).toBe(Math.round((logged.delta / logged.prev) * 1000) / 10);
    // Premiums were scaled down last week -> current week improved.
    expect(logged.delta).toBeGreaterThan(0);
    // Some issued cases were pushed back last week -> current conversion higher.
    const conv = cmp.cells.find((c) => c.key === "conversion_pct")!;
    expect(conv.value).toBe(62.5);
    expect(conv.delta).toBeGreaterThan(0);
  });

  it("premium_by_branch: per-branch deltas, sorted by delta desc", async () => {
    const curRows = (await getMetric("premium_by_branch")!.fn(prisma, current, {})).data as BranchRow[];
    const prevRows = (await getMetric("premium_by_branch")!.fn(prisma, previous, {})).data as BranchRow[];
    const prevMap = new Map(prevRows.map((r) => [r.branch, r.logged]));
    const cmp = (await compareMetric(prisma, "premium_by_branch", current, previous, {})).data;

    expect(cmp.kind).toBe("table");
    for (let i = 1; i < cmp.cells.length; i++) expect(cmp.cells[i - 1]!.delta).toBeGreaterThanOrEqual(cmp.cells[i]!.delta);
    const salem = cmp.cells.find((c) => c.key === "Salem")!;
    const curSalem = curRows.find((r) => r.branch === "Salem")!.logged;
    expect(salem.value).toBe(curSalem);
    expect(salem.prev).toBe(prevMap.get("Salem") ?? 0);
    expect(salem.delta).toBe(curSalem - (prevMap.get("Salem") ?? 0));
  });

  it("answers 'which branches improved this week?' — top-delta branch is well-defined", async () => {
    // Ground truth for the marquee Phase 4 bot DoD (the live bot path needs credentials).
    const cmp = (await compareMetric(prisma, "premium_by_branch", current, previous, {})).data;
    const improved = cmp.cells.filter((c) => c.delta > 0);
    expect(improved.length).toBeGreaterThan(0);
    const top = cmp.cells[0]!; // sorted by delta desc
    expect(top.delta).toBeGreaterThan(0);
    expect(top.value).toBe(top.prev + top.delta);
    expect(top.delta_pct).toBe(Math.round((top.delta / top.prev) * 1000) / 10);
  });

  it("respects filters on both sides (Salem-only compare)", async () => {
    const cmp = (await compareMetric(prisma, "totals", current, previous, { branch: ["Salem"] })).data;
    const cases = cmp.cells.find((c) => c.key === "case_count")!;
    expect(cases.value).toBe(21); // Salem cases unchanged across snapshots
  });
});
