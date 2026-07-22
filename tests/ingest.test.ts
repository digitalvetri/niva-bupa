import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma, ensureFixture, readFixture, TEST_TENANT_ID } from "./helpers";
import { ingestCsv, fingerprintOk } from "../lib/ingest/ingest";

let snapshotId: string;

beforeAll(async () => {
  ({ snapshotId } = await ensureFixture());
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("§4 ingestion pipeline over the real fixture", () => {
  it("marks the snapshot READY", async () => {
    const snap = await prisma.reportSnapshot.findUniqueOrThrow({ where: { id: snapshotId } });
    expect(snap.status).toBe("READY");
  });

  it("persists 80 cases (81 lines: 80 real + 1 trailing blank skipped)", async () => {
    const count = await prisma.nbCase.count({ where: { snapshotId } });
    expect(count).toBe(80);
    const snap = await prisma.reportSnapshot.findUniqueOrThrow({ where: { id: snapshotId } });
    expect(snap.rowCount).toBe(80);
  });

  it("records the trailing blank row as an info issue, not a dropped case (edge 2)", async () => {
    const blank = await prisma.ingestionIssue.findMany({ where: { snapshotId, severity: "info" } });
    expect(blank.length).toBe(1);
    expect(blank[0]!.message).toMatch(/blank row/i);
  });

  it("has 8 distinct branches, normalized (ERODE merged to Erode, no empty branch)", async () => {
    const branches = await prisma.nbCase.groupBy({ by: ["loginBranch"], where: { snapshotId } });
    const names = branches.map((b) => b.loginBranch).sort();
    expect(names.length).toBe(8);
    expect(names).toContain("Erode");
    expect(names).not.toContain("ERODE");
    expect(names).not.toContain("");
    expect(names).not.toContain("UNKNOWN");
  });

  it("computes periodStart/End from logged dates", async () => {
    const snap = await prisma.reportSnapshot.findUniqueOrThrow({ where: { id: snapshotId } });
    expect(snap.periodStart).not.toBeNull();
    expect(snap.periodEnd).not.toBeNull();
    expect(snap.periodStart!.getTime()).toBeLessThanOrEqual(snap.periodEnd!.getTime());
  });

  it("fingerprint accepts the real header, rejects a foreign one (edge 12)", () => {
    const realHeaders = readFixture().split(/\r?\n/)[0]!.replace(/^﻿/, "").split(",");
    expect(fingerprintOk(realHeaders).ok).toBe(true);
    const foreign = ["Order ID", "SKU", "Qty", "Price", "Customer", "Date", "Region", "Status"];
    expect(fingerprintOk(foreign).ok).toBe(false);
  });

  it("dedupes an identical re-upload by hash (edge 11)", async () => {
    const res = await ingestCsv(prisma, {
      tenantId: TEST_TENANT_ID,
      uploadedById: "test-user",
      fileName: "nb_sample.csv",
      content: readFixture(),
    });
    expect(res.snapshotId).toBe(snapshotId);
    expect(res.error).toMatch(/already uploaded/i);
    // dedup invariant: exactly one snapshot for this file's hash (other tests craft other files).
    const snap = await prisma.reportSnapshot.findUniqueOrThrow({ where: { id: snapshotId } });
    const sameHash = await prisma.reportSnapshot.count({ where: { tenantId: TEST_TENANT_ID, fileHash: snap.fileHash } });
    expect(sameHash).toBe(1);
  });

  it("fails loudly on an unrecognized format (edge 12)", async () => {
    const junk = "Order ID,SKU,Qty,Price\n1,ABC,2,100\n2,DEF,1,50\n";
    const res = await ingestCsv(prisma, {
      tenantId: TEST_TENANT_ID,
      uploadedById: "test-user",
      fileName: "orders.csv",
      content: junk,
    });
    expect(res.status).toBe("FAILED");
    expect(res.error).toMatch(/unrecognized report format/i);
    const issues = await prisma.ingestionIssue.findMany({ where: { snapshotId: res.snapshotId, severity: "error" } });
    expect(issues.length).toBeGreaterThan(0);
  });
});
