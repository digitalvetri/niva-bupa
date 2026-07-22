// GET /api/cases/export — CSV of the current filtered case view (§8.2 S6 export).
import { type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { listCases, type CaseSort } from "@/lib/cases";
import { contextFromRequest } from "@/lib/auth";
import { requireSnapshot, scopedFilters, AccessError } from "@/lib/access";
import type { Filters } from "@/lib/metrics/types";

export const runtime = "nodejs";
const EXPORT_CAP = 10_000;

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const snapshotId = searchParams.get("snapshotId");
  if (!snapshotId) return new Response("snapshotId is required", { status: 400 });

  let filters: Filters = {};
  const raw = searchParams.get("filters");
  if (raw) { try { filters = JSON.parse(raw) as Filters; } catch { return new Response("bad filters", { status: 400 }); } }

  const ctx = contextFromRequest(req);
  try {
    await requireSnapshot(prisma, snapshotId, ctx);
    filters = scopedFilters(filters, ctx);
  } catch (e) {
    if (e instanceof AccessError) return new Response(e.message, { status: e.status });
    throw e;
  }

  const result = await listCases(prisma, snapshotId, filters, {
    page: 1,
    pageSize: EXPORT_CAP,
    sort: (searchParams.get("sort") as CaseSort) ?? "loggedPremium",
    dir: searchParams.get("dir") === "asc" ? "asc" : "desc",
    search: searchParams.get("search") ?? undefined,
  });

  const cols = ["applicationNo", "customerName", "loginBranch", "agentName", "productGenre", "planType", "funnelStage", "leadStatus", "loggedPremium", "issuedPremium", "statusAgeing", "isPortability", "discrepancy"] as const;
  const header = cols.join(",");
  const lines = result.rows.map((r) => cols.map((c) => csvCell((r as Record<string, unknown>)[c])).join(","));
  const csv = [header, ...lines].join("\r\n");

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="cases_${snapshotId.slice(0, 8)}.csv"`,
    },
  });
}
