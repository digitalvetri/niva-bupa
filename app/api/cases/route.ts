// GET /api/cases?snapshotId=&filters=<json>&page=&pageSize=&sort=&dir=&search= (§5)
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { listCases, type CaseSort, type CasesQuery } from "@/lib/cases";
import { contextFromRequest } from "@/lib/auth";
import { requireSnapshot, scopedFilters, AccessError } from "@/lib/access";
import type { Filters } from "@/lib/metrics/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const snapshotId = searchParams.get("snapshotId");
  if (!snapshotId) return NextResponse.json({ error: "snapshotId is required" }, { status: 400 });

  let filters: Filters = {};
  const rawFilters = searchParams.get("filters");
  if (rawFilters) {
    try {
      filters = JSON.parse(rawFilters) as Filters;
    } catch {
      return NextResponse.json({ error: "filters must be valid JSON" }, { status: 400 });
    }
  }

  const ctx = contextFromRequest(req);
  try {
    await requireSnapshot(prisma, snapshotId, ctx);
    filters = scopedFilters(filters, ctx);
  } catch (e) {
    if (e instanceof AccessError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const q: CasesQuery = {
    page: numParam(searchParams.get("page")),
    pageSize: numParam(searchParams.get("pageSize")),
    sort: (searchParams.get("sort") as CaseSort) ?? undefined,
    dir: searchParams.get("dir") === "asc" ? "asc" : searchParams.get("dir") === "desc" ? "desc" : undefined,
    search: searchParams.get("search") ?? undefined,
  };

  const result = await listCases(prisma, snapshotId, filters, q);
  return NextResponse.json(result);
}

function numParam(v: string | null): number | undefined {
  if (v == null) return undefined;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}
