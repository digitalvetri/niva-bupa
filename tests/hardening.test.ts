// §11 hardening — rate limiting, observability counters, and human-readable failure paths.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma, TEST_TENANT_ID } from "./helpers";
import { rateLimit, resetRateLimits } from "../lib/ratelimit";
import { trackMetric, getMetricTotal } from "../lib/observability";
import { ensureDevTenant } from "../lib/tenant";
import { POST as uploadPOST } from "../app/api/reports/upload/route";

beforeAll(async () => {
  await ensureDevTenant(prisma, TEST_TENANT_ID);
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("rate limiter (fixed window)", () => {
  it("allows up to the limit then blocks, and resets after the window", () => {
    resetRateLimits();
    const key = "t:u";
    const t0 = 1_000_000;
    expect(rateLimit(key, 2, 1000, t0).ok).toBe(true);
    expect(rateLimit(key, 2, 1000, t0 + 100).ok).toBe(true);
    const blocked = rateLimit(key, 2, 1000, t0 + 200);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    // after the window rolls over
    expect(rateLimit(key, 2, 1000, t0 + 1100).ok).toBe(true);
  });
});

describe("observability counter", () => {
  it("accumulates tracked metrics", () => {
    const before = getMetricTotal("test.counter");
    trackMetric("test.counter", 3);
    trackMetric("test.counter", 2);
    expect(getMetricTotal("test.counter")).toBe(before + 5);
  });
});

// Build a multipart upload request for the real handler.
function uploadReq(fileName: string, content: string): NextRequest {
  const form = new FormData();
  form.append("file", new File([content], fileName, { type: "text/csv" }));
  return new NextRequest("http://localhost/api/reports/upload", {
    method: "POST",
    headers: { "x-tenant-id": TEST_TENANT_ID, "x-user-id": "u" },
    body: form,
  });
}

describe("§4 failure paths return human-readable messages", () => {
  it("non-.csv file -> 415 with a clear message", async () => {
    const res = await uploadPOST(uploadReq("report.xlsx", "junk"));
    expect(res.status).toBe(415);
    expect((await res.json()).error).toMatch(/only \.csv/i);
  });

  it("unrecognized format -> 422 with a clear message", async () => {
    const res = await uploadPOST(uploadReq("orders.csv", "Order ID,SKU,Qty\n1,A,2\n"));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/unrecognized report format/i);
  });

  it("missing file -> 400", async () => {
    const req = new NextRequest("http://localhost/api/reports/upload", { method: "POST", headers: { "x-tenant-id": TEST_TENANT_ID }, body: new FormData() });
    const res = await uploadPOST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/no file/i);
  });
});
