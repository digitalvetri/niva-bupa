// GET /api/metrics/:name?snapshotId=&filters=<json> (§5, §6). Reads the shared metric engine.
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getMetric } from "@/lib/metrics/catalog";
import { compareMetric } from "@/lib/metrics/compare";
import { getSettings } from "@/lib/nudge/settings";
import { contextFromRequest } from "@/lib/auth";
import type { Filters } from "@/lib/metrics/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: { name: string } }) {
  const metric = getMetric(params.name);
  if (!metric) return NextResponse.json({ error: `Unknown metric "${params.name}"` }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const snapshotId = searchParams.get("snapshotId");
  if (!snapshotId) return NextResponse.json({ error: "snapshotId is required" }, { status: 400 });

  let filters: Filters = {};
  const raw = searchParams.get("filters");
  if (raw) {
    try {
      filters = JSON.parse(raw) as Filters;
    } catch {
      return NextResponse.json({ error: "filters must be valid JSON" }, { status: 400 });
    }
  }

  // high_value_stuck honors the tenant's configured threshold (§2.2 / Settings) unless overridden.
  if (params.name === "high_value_stuck" && filters.minLoggedPremium === undefined) {
    const { tenantId } = contextFromRequest(req);
    if (tenantId) filters = { ...filters, minLoggedPremium: (await getSettings(prisma, tenantId)).high_value_threshold };
  }

  // §5: compareSnapshotId turns any metric into a value/prev/delta/delta_pct diff.
  const compareSnapshotId = searchParams.get("compareSnapshotId");
  if (compareSnapshotId && compareSnapshotId !== snapshotId) {
    const result = await compareMetric(prisma, params.name, snapshotId, compareSnapshotId, filters);
    return NextResponse.json(result);
  }

  const result = await metric.fn(prisma, snapshotId, filters);
  return NextResponse.json(result);
}
