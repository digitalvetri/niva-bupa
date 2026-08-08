// GET /api/coding/snapshots — list coding uploads for the snapshot switcher.
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { contextFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { tenantId } = contextFromRequest(req);
  if (!tenantId) return NextResponse.json({ error: "Missing tenant" }, { status: 401 });
  const snapshots = await prisma.codingSnapshot.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    select: { id: true, fileName: true, status: true, rowCount: true, missionTarget: true, createdAt: true },
  });
  return NextResponse.json({ snapshots });
}
