// GET /api/cases?snapshotId=&filters=<json>&page=&pageSize=&sort=&dir=&search= (§5)
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { listCases, type CaseSort, type CasesQuery } from "@/lib/cases";
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
