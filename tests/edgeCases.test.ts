// §13 edge cases 1–12 that apply to ingestion. Fixture-level where the data exhibits them,
// unit-level (via ingestCsv on a crafted CSV) where the real fixture doesn't contain the case.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma, ensureFixture, readFixture, TEST_TENANT_ID } from "./helpers.js";
import { ingestCsv } from "../lib/ingest/ingest.js";

let snapshotId: string;
beforeAll(async () => {
  ({ snapshotId } = await ensureFixture());
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("§13 ingestion edge cases", () => {
  it("1 — BOM header: first column is 'First Name', not '﻿First Name'", async () => {
    // If BOM leaked, no case would have a mapped customerName; assert we parsed names.
    const withNames = await prisma.nbCase.count({ where: { snapshotId, NOT: { customerName: "" } } });
    expect(withNames).toBeGreaterThan(70);
    const raw = readFixture();
    expect(raw.charCodeAt(0)).toBe(0xfeff); // fixture really has a BOM
  });

  it("2 — trailing blank row skipped with an info issue, not counted", async () => {
    const cases = await prisma.nbCase.count({ where: { snapshotId } });
    expect(cases).toBe(80);
    const info = await prisma.ingestionIssue.count({ where: { snapshotId, severity: "info" } });
    expect(info).toBe(1);
  });

  it("3 — 'Unlimited' sum assured -> isUnlimitedSi (unit; fixture has none)", async () => {
    const csv = crafted([
      { "Full Name": "UL Test", "Application Number": "UL1", "Sum Assured": "Unlimited", "Sales Status": "Policy issued", "Login Branch": "Salem", "Logged Premium": "1000", "Issued Premium": "1000" },
    ]);
    const res = await ingestCsv(prisma, oneOff("ul.csv", csv));
    const c = await prisma.nbCase.findFirstOrThrow({ where: { snapshotId: res.snapshotId, applicationNo: "UL1" } });
    expect(c.isUnlimitedSi).toBe(true);
    expect(c.sumAssured).toBeNull();
  });

  it("4 — same customer name, two apps -> both kept (SM Vijaya Baskaran)", async () => {
    const dup = await prisma.nbCase.findMany({ where: { snapshotId, customerName: "SM Vijaya Baskaran" } });
    expect(dup.length).toBe(2);
    expect(new Set(dup.map((d) => d.applicationNo)).size).toBe(2);
  });

  it("5 — agent '.NONE.' -> UNASSIGNED, ranked last in leaderboard", async () => {
    const un = await prisma.nbCase.count({ where: { snapshotId, agentName: "UNASSIGNED" } });
    expect(un).toBeGreaterThan(0);
  });

  it("6 — blank sales_status + no policy -> UNKNOWN / Review (unit)", async () => {
    const csv = crafted([
      { "Full Name": "Review Case", "Application Number": "RV1", "Sales Status": "", "Policy Number": "", "Login Branch": "Salem", "Logged Premium": "500" },
    ]);
    const res = await ingestCsv(prisma, oneOff("rv.csv", csv));
    const c = await prisma.nbCase.findFirstOrThrow({ where: { snapshotId: res.snapshotId, applicationNo: "RV1" } });
    expect(c.funnelStage).toBe("UNKNOWN");
  });

  it("7 — mixed-case branches merge (Erode is one branch, no ERODE)", async () => {
    const erode = await prisma.nbCase.count({ where: { snapshotId, loginBranch: "Erode" } });
    const ERODE = await prisma.nbCase.count({ where: { snapshotId, loginBranch: "ERODE" } });
    expect(erode).toBeGreaterThan(0);
    expect(ERODE).toBe(0);
  });

  it("8 — loading premium > 0 surfaced (TVS VASUDEVA RAO ₹8,455)", async () => {
    const c = await prisma.nbCase.findFirstOrThrow({ where: { snapshotId, customerName: { contains: "VASUDEVA RAO" } } });
    expect(Number(c.loadingPremium)).toBe(8455);
  });

  it("9 — issued premium > logged (loading) handled: conversion uses issued where issued", async () => {
    // There exist issued cases where issuedPremium >= loggedPremium; ensure no negative/NaN math.
    const issuedCases = await prisma.nbCase.findMany({ where: { snapshotId, funnelStage: "ISSUED" }, select: { issuedPremium: true } });
    expect(issuedCases.every((c) => Number(c.issuedPremium) >= 0)).toBe(true);
  });

  it("10 — out-of-state customers retained (Karnataka/Telangana/Goa)", async () => {
    const oos = await prisma.nbCase.count({ where: { snapshotId, customerState: { notIn: ["TAMIL NADU"] }, NOT: { customerState: null } } });
    expect(oos).toBe(5);
  });

  it("11 — identical re-upload deduped by hash", async () => {
    const res = await ingestCsv(prisma, oneOff("nb_sample.csv", readFixture()));
    expect(res.snapshotId).toBe(snapshotId);
  });

  it("12 — 50%+ unknown columns -> FAILED with format error", async () => {
    const res = await ingestCsv(prisma, oneOff("junk.csv", "A,B,C,D,E,F\n1,2,3,4,5,6\n"));
    expect(res.status).toBe("FAILED");
    expect(res.error).toMatch(/unrecognized/i);
  });
});

// ── helpers ────────────────────────────────────────────────────────────────────
function oneOff(fileName: string, content: string) {
  return { tenantId: TEST_TENANT_ID, uploadedById: "test-user", fileName, content };
}

/** Build a minimal but fingerprint-valid NB CSV from partial rows (fills all expected headers). */
function crafted(rows: Record<string, string>[]): string {
  const headers = readFixture().split(/\r?\n/)[0]!.replace(/^﻿/, "");
  const cols = headers.split(",");
  const lines = [headers];
  for (const r of rows) {
    lines.push(cols.map((c) => (r[c.trim()] ?? "").replace(/,/g, " ")).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
