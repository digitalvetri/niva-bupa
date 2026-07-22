// §11 PII discipline — the router never receives customer names, even after a row-level answer;
// and row-level answers return only the rows the question needs.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma, ensureFixture } from "./helpers";
import { sanitizeHistoryForRouter } from "../lib/bot/pii";
import { getMetric } from "../lib/metrics/catalog";
import type { ChatTurn } from "../lib/bot/router";
import type { StuckCaseRow } from "../lib/metrics/metrics";

let snapshotId: string;
let names: string[] = [];

beforeAll(async () => {
  snapshotId = (await ensureFixture()).snapshotId;
  const stuck = (await getMetric("stuck_cases")!.fn(prisma, snapshotId, {})).data as StuckCaseRow[];
  names = stuck.map((c) => c.customerName);
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("§11 router receives no customer PII", () => {
  it("strips prior assistant narration (which carried real names) before routing", () => {
    // A realistic multi-turn conversation where turn 2's answer named actual stuck cases.
    const history: ChatTurn[] = [
      { role: "user", content: "Yaaru follow up pannanum innaiku?" },
      { role: "assistant", content: `Top follow-ups: ${names.slice(0, 3).join(", ")} — ₹1,45,951 pending.` },
      { role: "user", content: "and by agent?" },
    ];
    const sanitized = sanitizeHistoryForRouter(history);
    const wire = JSON.stringify(sanitized);

    // No fixture customer name survives into what the router would see.
    for (const n of names) expect(wire.includes(n), `name leaked: ${n}`).toBe(false);
    // The row-level premium figure is gone too.
    expect(wire).not.toContain("1,45,951");
    // But the user's own questions (the topic + follow-up) are preserved.
    expect(wire).toContain("Yaaru follow up pannanum");
    expect(wire).toContain("and by agent?");
  });
});

describe("§11 row-level answers send only the rows needed", () => {
  it("stuck_cases scoped to a branch returns only that branch's rows, not all 30", async () => {
    const all = (await getMetric("stuck_cases")!.fn(prisma, snapshotId, {})).data as StuckCaseRow[];
    const salem = (await getMetric("stuck_cases")!.fn(prisma, snapshotId, { branch: ["Salem"] })).data as StuckCaseRow[];
    expect(all.length).toBe(30);
    expect(salem.length).toBe(10);
    expect(salem.every((c) => c.branch === "Salem")).toBe(true);
    expect(salem.length).toBeLessThan(all.length);
  });
});
