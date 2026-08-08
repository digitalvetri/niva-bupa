// GET /api/coding/data?metric=&snapshotId=&... — read the coding metric engine.
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { contextFromRequest } from "@/lib/auth";
import { captureError } from "@/lib/observability";
import { getSettings } from "@/lib/nudge/settings";
import { readRotn, effectiveTargets } from "@/lib/targets/rotn";
import {
  codingTotals, codingLeaderboard, codingBranchDashboard, codingDaily, codingPivot, codingLeads, codingMasterLists, codingBreakdown,
} from "@/lib/coding/metrics";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { tenantId } = contextFromRequest(req);
  if (!tenantId) return NextResponse.json({ error: "Missing tenant" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const metric = searchParams.get("metric") ?? "totals";
  const snapshotId = searchParams.get("snapshotId");
  if (!snapshotId) return NextResponse.json({ error: "snapshotId required" }, { status: 400 });

  // Tenant isolation: the snapshot must belong to the caller.
  const snap = await prisma.codingSnapshot.findFirst({ where: { id: snapshotId, tenantId }, select: { id: true } });
  if (!snap) return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });

  // ROTN Agent Recruitment target (YTD/FY) overrides the file's mission + branch targets when set.
  const rotn = readRotn((await getSettings(prisma, tenantId)).rotnTargets);
  const agent = rotn ? effectiveTargets(rotn, "AGENT_RECRUITMENT") : null;

  try {
    switch (metric) {
      case "totals": return NextResponse.json({ data: await codingTotals(prisma, snapshotId, agent?.territory) });
      case "leaderboard": return NextResponse.json({ data: await codingLeaderboard(prisma, snapshotId) });
      case "branch": return NextResponse.json({ data: await codingBranchDashboard(prisma, snapshotId, agent?.byBranch) });
      case "daily": return NextResponse.json({ data: await codingDaily(prisma, snapshotId) });
      case "pivot": return NextResponse.json({ data: await codingPivot(prisma, snapshotId, searchParams.get("dim") ?? "th") });
      case "master": return NextResponse.json({ data: await codingMasterLists(prisma, snapshotId) });
      case "breakdown": return NextResponse.json({ data: await codingBreakdown(prisma, snapshotId, (searchParams.get("field") as never) ?? "status") });
      case "leads": {
        const f = (k: string) => searchParams.get(k) ?? undefined;
        return NextResponse.json({ data: await codingLeads(prisma, snapshotId, { th: f("th"), branch: f("branch"), status: f("status"), competitor: f("competitor"), source: f("source"), q: f("q") }) });
      }
      default: return NextResponse.json({ error: `Unknown metric "${metric}"` }, { status: 404 });
    }
  } catch (e) {
    captureError(e, { route: "coding/data", metric });
    return NextResponse.json({ error: "Failed to compute" }, { status: 500 });
  }
}
