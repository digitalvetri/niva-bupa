import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma, readFixture } from "./helpers";
import { ingestCsv } from "../lib/ingest/ingest";
import { anonymizeCsv } from "../lib/dev/anonymize";
import { totals, premiumByBranch, agentLeaderboard, type BranchRow, type AgentRow, type TotalsData } from "../lib/metrics/metrics";

const ANON_TENANT = "00000000-0000-0000-0000-0000000000a0";
let snapshotId = "";

beforeAll(async () => {
  await prisma.tenant.upsert({ where: { id: ANON_TENANT }, update: {}, create: { id: ANON_TENANT, name: "Anon", settings: {} } });
  const res = await ingestCsv(prisma, { tenantId: ANON_TENANT, uploadedById: "t", fileName: "anon.csv", content: anonymizeCsv(readFixture()) });
  snapshotId = res.snapshotId;
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("§11 anonymize — removes real names, keeps aggregates", () => {
  it("no real customer/agent/AM names survive", () => {
    const anon = anonymizeCsv(readFixture());
    for (const name of ["NAGARAJAN", "K SIVAPRAKASH", "Swetha Mahadevan", "SARITHA", "Tamilselvi"]) {
      expect(anon.includes(name), `leaked: ${name}`).toBe(false);
    }
    expect(anon).toMatch(/Customer 0\d\d/); // pseudonyms present
    expect(anon).toMatch(/Agent 0\d\d/);
  });

  it("aggregates are identical (referential integrity preserved)", async () => {
    const t = (await totals(prisma, snapshotId, {})).data as TotalsData;
    expect(t.logged_premium).toBe(3177434);
    expect(t.case_count).toBe(80);

    const branches = (await premiumByBranch(prisma, snapshotId, {})).data as BranchRow[];
    const salem = branches.find((b) => b.branch === "Salem")!;
    expect(salem.cases).toBe(21);
    expect(salem.logged).toBe(857759);

    // Top agent keeps 6 cases / ₹2,97,314 — but under a pseudonym (not the real name).
    const top = ((await agentLeaderboard(prisma, snapshotId, {})).data as AgentRow[])[0]!;
    expect(top.cases).toBe(6);
    expect(top.logged).toBe(297314);
    expect(top.agentName).not.toBe("K SIVAPRAKASH");
    expect(top.agentName).toMatch(/^Agent /);
  });
});
