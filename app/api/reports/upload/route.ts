// POST /api/reports/upload — multipart ingest trigger (§4, §5). Minimal, no UI.
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ingestCsv } from "@/lib/ingest/ingest";
import { contextFromRequest } from "@/lib/auth";
import { ensureDevTenant } from "@/lib/tenant";

export const runtime = "nodejs";
const MAX_BYTES = 20 * 1024 * 1024; // §4: files up to 20 MB

export async function POST(req: NextRequest) {
  const { tenantId, userId } = contextFromRequest(req);
  if (!tenantId) return NextResponse.json({ error: "Missing tenant (x-tenant-id)" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided (multipart field 'file')" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: `File exceeds ${MAX_BYTES} bytes` }, { status: 413 });

  await ensureDevTenant(prisma, tenantId);
  const content = await file.text();
  const result = await ingestCsv(prisma, { tenantId, uploadedById: userId, fileName: file.name, content });
  const status = result.status === "FAILED" ? 422 : 200;
  return NextResponse.json(result, { status });
}
