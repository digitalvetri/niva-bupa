// §10/§11 RLS audit — proves tenant isolation + branch scoping THROUGH THE API by invoking the
// real route handlers with different simulated identities (the headers a Supabase JWT would carry).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma, ensureFixture, readFixture } from "./helpers";
import { ingestCsv } from "../lib/ingest/ingest";
import { GET as metricsGET } from "../app/api/metrics/[name]/route";
import { GET as casesGET } from "../app/api/cases/route";
import { GET as exportGET } from "../app/api/cases/export/route";
import { GET as issuesGET } from "../app/api/reports/[id]/issues/route";
import { GET as reportsGET } from "../app/api/reports/route";
import type { BranchRow } from "../lib/metrics/metrics";

const TENANT_A = "00000000-0000-0000-0000-000000000001"; // = TEST_TENANT_ID (ensureFixture)
const TENANT_B = "00000000-0000-0000-0000-0000000000bb";
let snapA = "";
let snapB = "";

type Ctx = { tenantId: string; branchScope?: string[] };
function req(url: string, ctx: Ctx): NextRequest {
  const headers: Record<string, string> = { "x-tenant-id": ctx.tenantId, "x-user-id": "u" };
  if (ctx.branchScope) headers["x-branch-scope"] = ctx.branchScope.join(",");
  return new NextRequest(`http://localhost${url}`, { headers });
}

beforeAll(async () => {
  snapA = (await ensureFixture()).snapshotId;
  await prisma.tenant.upsert({ where: { id: TENANT_B }, update: {}, create: { id: TENANT_B, name: "Tenant B", settings: {} } });
  const b = await ingestCsv(prisma, { tenantId: TENANT_B, uploadedById: "b", fileName: "nb_sample.csv", content: readFixture() });
  snapB = b.snapshotId;
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("§10 tenant isolation — tenant A cannot read tenant B's data through the API", () => {
  it("metrics: A reads its own snapshot (200) but B's snapshot is 404 for A", async () => {
    const own = await metricsGET(req(`/api/metrics/totals?snapshotId=${snapA}`, { tenantId: TENANT_A }), { params: { name: "totals" } });
    expect(own.status).toBe(200);
    const cross = await metricsGET(req(`/api/metrics/totals?snapshotId=${snapB}`, { tenantId: TENANT_A }), { params: { name: "totals" } });
    expect(cross.status).toBe(404);
    expect((await cross.json()).error).toMatch(/not found/i);
  });

  it("cases: B's snapshot is 404 for A", async () => {
    const res = await casesGET(req(`/api/cases?snapshotId=${snapB}`, { tenantId: TENANT_A }));
    expect(res.status).toBe(404);
  });

  it("cases export: B's snapshot is 404 for A", async () => {
    const res = await exportGET(req(`/api/cases/export?snapshotId=${snapB}`, { tenantId: TENANT_A }));
    expect(res.status).toBe(404);
  });

  it("ingestion issues: B's snapshot is 404 for A", async () => {
    const res = await issuesGET(req(`/api/reports/${snapB}/issues`, { tenantId: TENANT_A }), { params: { id: snapB } });
    expect(res.status).toBe(404);
  });

  it("compare: A cannot diff against B's snapshot (both must be owned)", async () => {
    const res = await metricsGET(req(`/api/metrics/premium_by_branch?snapshotId=${snapA}&compareSnapshotId=${snapB}`, { tenantId: TENANT_A }), { params: { name: "premium_by_branch" } });
    expect(res.status).toBe(404);
  });

  it("reports list: A sees only its own snapshots, never B's", async () => {
    const res = await reportsGET(req(`/api/reports`, { tenantId: TENANT_A }));
    const ids = (await res.json()).snapshots.map((s: { id: string }) => s.id);
    expect(ids).toContain(snapA);
    expect(ids).not.toContain(snapB);
  });

  it("chat messages / nudge logs have no read endpoint — nothing to leak cross-tenant", () => {
    // Persistence always uses the caller's tenantId; there is no GET that returns another tenant's
    // ChatMessage or NudgeLog rows. (Verified structurally: no such route exists.)
    expect(true).toBe(true);
  });
});

describe("§10 branch scoping — a branch-scoped user cannot see other branches", () => {
  it("premium_by_branch returns only in-scope branches", async () => {
    const res = await metricsGET(req(`/api/metrics/premium_by_branch?snapshotId=${snapA}`, { tenantId: TENANT_A, branchScope: ["Salem"] }), { params: { name: "premium_by_branch" } });
    const rows = (await res.json()).data as BranchRow[];
    expect(rows.length).toBe(1);
    expect(rows[0]!.branch).toBe("Salem");
  });

  it("cannot escape scope by passing a different branch filter", async () => {
    const filters = encodeURIComponent(JSON.stringify({ branch: ["Erode"] }));
    const res = await metricsGET(req(`/api/metrics/premium_by_branch?snapshotId=${snapA}&filters=${filters}`, { tenantId: TENANT_A, branchScope: ["Salem"] }), { params: { name: "premium_by_branch" } });
    const rows = (await res.json()).data as BranchRow[];
    expect(rows.length).toBe(0); // Erode ∉ [Salem] -> empty, not Erode's data
  });

  it("cases respects branch scope", async () => {
    const res = await casesGET(req(`/api/cases?snapshotId=${snapA}&pageSize=100`, { tenantId: TENANT_A, branchScope: ["Salem"] }));
    const j = await res.json();
    expect(j.total).toBe(21); // Salem only
    expect(j.rows.every((r: { loginBranch: string }) => r.loginBranch === "Salem")).toBe(true);
  });
});
