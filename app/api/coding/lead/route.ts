// PATCH /api/coding/lead — update a single lead's status (Identified → Verified / Duplicate / Invalid).
// This is the recruitment workflow: a TH/BM verifies a recruited agent.
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { contextFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

const VALID = ["IDENTIFIED", "VERIFIED", "DUPLICATE", "INVALID"];

export async function PATCH(req: NextRequest) {
  const { tenantId } = contextFromRequest(req);
  if (!tenantId) return NextResponse.json({ error: "Missing tenant" }, { status: 401 });

  let body: { id?: string; status?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.id || !body.status || !VALID.includes(body.status)) {
    return NextResponse.json({ error: "id and a valid status are required" }, { status: 400 });
  }

  // Tenant isolation: only update a lead the caller owns.
  const updated = await prisma.codingLead.updateMany({
    where: { id: body.id, tenantId },
    data: { status: body.status, isDuplicate: body.status === "DUPLICATE" },
  });
  if (updated.count === 0) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  return NextResponse.json({ ok: true, status: body.status });
}
