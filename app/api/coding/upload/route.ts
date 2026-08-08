// POST /api/coding/upload — ingest a Mission 300 workbook (xlsx). Server-side only.
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { contextFromRequest } from "@/lib/auth";
import { ensureDevTenant } from "@/lib/tenant";
import { ingestCodingXlsx } from "@/lib/coding/ingest";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { tenantId, userId } = contextFromRequest(req);
  if (!tenantId) return NextResponse.json({ error: "Missing tenant" }, { status: 401 });
  await ensureDevTenant(prisma, tenantId);

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  if (!/\.(xlsx|xls)$/i.test(file.name)) return NextResponse.json({ error: "Please upload the Mission 300 Excel file (.xlsx)." }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await ingestCodingXlsx(prisma, { tenantId, uploadedById: userId, fileName: file.name, buffer });
  return NextResponse.json(result);
}
