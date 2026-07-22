// GET /api/reports/:id/issues — ingestion issues for the Uploads drawer (§5).
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const issues = await prisma.ingestionIssue.findMany({
    where: { snapshotId: params.id },
    orderBy: [{ severity: "asc" }, { rowNumber: "asc" }],
    select: { id: true, rowNumber: true, severity: true, message: true },
  });
  const counts = { info: 0, warn: 0, error: 0 } as Record<string, number>;
  for (const i of issues) counts[i.severity] = (counts[i.severity] ?? 0) + 1;
  return NextResponse.json({ issues, counts });
}
