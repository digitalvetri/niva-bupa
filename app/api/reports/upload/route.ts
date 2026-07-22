// POST /api/reports/upload — multipart ingest trigger (§4, §5). Minimal, no UI.
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ingestCsv } from "@/lib/ingest/ingest";
import { contextFromRequest } from "@/lib/auth";
import { ensureDevTenant } from "@/lib/tenant";
import { rateLimit } from "@/lib/ratelimit";
import { captureError, trackMetric } from "@/lib/observability";

export const runtime = "nodejs";
const MAX_BYTES = 20 * 1024 * 1024; // §4: files up to 20 MB
const MAX_MB = MAX_BYTES / (1024 * 1024);
const UPLOAD_LIMIT = { limit: 10, windowMs: 60_000 }; // 10 uploads/min/user

export async function POST(req: NextRequest) {
  const { tenantId, userId } = contextFromRequest(req);
  if (!tenantId) return NextResponse.json({ error: "Missing tenant (x-tenant-id)" }, { status: 401 });

  const rl = rateLimit(`upload:${tenantId}:${userId}`, UPLOAD_LIMIT.limit, UPLOAD_LIMIT.windowMs);
  if (!rl.ok) return NextResponse.json({ error: `Too many uploads — try again in ${rl.retryAfterSec}s.` }, { status: 429 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided — attach a .csv in the 'file' field." }, { status: 400 });
  if (!/\.csv$/i.test(file.name)) return NextResponse.json({ error: `Only .csv New Business reports are supported (got "${file.name}").` }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: `File is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is ${MAX_MB} MB.` }, { status: 413 });

  try {
    await ensureDevTenant(prisma, tenantId);
    const content = await file.text();
    const result = await ingestCsv(prisma, { tenantId, uploadedById: userId, fileName: file.name, content });
    // §11: track ingestion issue count as an observability metric.
    trackMetric("ingestion.issues", result.issueCount, { tenant: tenantId, status: result.status });
    trackMetric("ingestion.uploads", 1, { status: result.status });
    const status = result.status === "FAILED" ? 422 : 200;
    return NextResponse.json(result, { status });
  } catch (e) {
    captureError(e, { route: "reports/upload", tenant: tenantId, file: file.name });
    return NextResponse.json({ error: "Upload failed while processing the file. Please retry; if it persists the file may be malformed." }, { status: 500 });
  }
}
