// GET /api/reports — snapshot list for the switcher + compare picker + Uploads screen (§5).
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { contextFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { tenantId } = contextFromRequest(req);
  if (!tenantId) return NextResponse.json({ error: "Missing tenant" }, { status: 401 });

  const snapshots = await prisma.reportSnapshot.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, fileName: true, status: true, rowCount: true,
      periodStart: true, periodEnd: true, createdAt: true,
      _count: { select: { issues: true, cases: true } },
    },
  });
  return NextResponse.json({ snapshots });
}
