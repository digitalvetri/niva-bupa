import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma, ensureFixture, TEST_TENANT_ID } from "./helpers";
import { draftNudge, queueNudge, DAILY_NUDGE_CAP, type CaseContext } from "../lib/nudge/nudge";
import { parseAgentPhoneCsv, updateSettings, getSettings } from "../lib/nudge/settings";

const NOW = Date.UTC(2026, 6, 22, 10, 0, 0); // fixed clock

const CASE: CaseContext = {
  applicationNo: "APP123", customerName: "NAGARAJAN P", agentName: "K SIVAPRAKASH", agentCode: "A1",
  loggedPremium: 145951, productGenre: "REASSURE_3.0_BLACK", leadStatus: "Tele Uw Required", ageingDays: 3,
};

beforeAll(async () => {
  await ensureFixture(); // creates the test tenant
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("§9 nudge draft (template)", () => {
  it("fills the case context into the §9 template", () => {
    const msg = draftNudge(CASE, "Territory Head");
    expect(msg).toContain("Hi K SIVAPRAKASH");
    expect(msg).toContain("case APP123");
    expect(msg).toContain("NAGARAJAN P");
    expect(msg).toContain("₹1,45,951");
    expect(msg).toContain("(REASSURE_3.0_BLACK)");
    expect(msg).toContain("*Tele Uw Required*");
    expect(msg).toContain("for 3 days");
    expect(msg.endsWith("— Territory Head")).toBe(true);
  });
  it("singular day", () => {
    expect(draftNudge({ ...CASE, ageingDays: 1 }, "TH")).toContain("for 1 day.");
  });
});

describe("§9 agent phone CSV", () => {
  it("parses code,phone rows, skips header, strips formatting", () => {
    const map = parseAgentPhoneCsv("agent_code,phone\nA1, +91 98765 43210\nA2,9876500000\n,skip\n");
    expect(map).toEqual({ A1: "+919876543210", A2: "9876500000" });
  });
});

describe("§9 queueNudge", () => {
  it("missing phone -> copy-to-clipboard FALLBACK, logged as FAILED", async () => {
    const r = await queueNudge(prisma, { tenantId: TEST_TENANT_ID, userId: "u", caseId: "APP123", toName: "K SIVAPRAKASH", agentCode: "NOPHONE", message: "m" }, NOW);
    expect(r.status).toBe("FALLBACK");
    if (r.status === "FALLBACK") expect(r.reason).toBe("no_phone");
    const log = await prisma.nudgeLog.findMany({ where: { tenantId: TEST_TENANT_ID, caseId: "APP123" } });
    expect(log.length).toBe(1);
  });

  it("with a mapped phone -> QUEUED (no webhook configured)", async () => {
    await updateSettings(prisma, TEST_TENANT_ID, { agentPhones: { A1: "+919876543210" } });
    const s = await getSettings(prisma, TEST_TENANT_ID);
    expect(s.agentPhones.A1).toBe("+919876543210");
    const r = await queueNudge(prisma, { tenantId: TEST_TENANT_ID, userId: "u", caseId: "APP999", toName: "K SIVAPRAKASH", agentCode: "A1", message: "m" }, NOW);
    expect(r.status).toBe("QUEUED");
    if (r.status === "QUEUED") expect(r.toPhone).toBe("+919876543210");
  });

  it("enforces the 20/day/user cap", async () => {
    const cap = "cap-tenant";
    for (let i = 0; i < DAILY_NUDGE_CAP; i++) {
      await prisma.nudgeLog.create({ data: { tenantId: cap, caseId: `C${i}`, toName: "x", toPhone: "+91", message: "m", status: "QUEUED", createdAt: new Date(NOW) } });
    }
    const r = await queueNudge(prisma, { tenantId: cap, userId: "u", caseId: "C21", toName: "x", agentCode: "A1", message: "m" }, NOW);
    expect(r.status).toBe("BLOCKED");
    if (r.status === "BLOCKED") expect(r.sentToday).toBe(DAILY_NUDGE_CAP);
  });
});
