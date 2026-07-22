// GET/POST /api/settings — high-value threshold + agent_code->phone mapping CSV (§9 Settings).
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { contextFromRequest } from "@/lib/auth";
import { getSettings, updateSettings, parseAgentPhoneCsv, type TenantSettings } from "@/lib/nudge/settings";
import { ensureDevTenant } from "@/lib/tenant";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { tenantId } = contextFromRequest(req);
  if (!tenantId) return NextResponse.json({ error: "Missing tenant" }, { status: 401 });
  await ensureDevTenant(prisma, tenantId);
  return NextResponse.json(await getSettings(prisma, tenantId));
}

export async function POST(req: NextRequest) {
  const { tenantId } = contextFromRequest(req);
  if (!tenantId) return NextResponse.json({ error: "Missing tenant" }, { status: 401 });
  await ensureDevTenant(prisma, tenantId);

  let body: { high_value_threshold?: number; agentPhonesCsv?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Partial<TenantSettings> = {};
  if (typeof body.high_value_threshold === "number" && body.high_value_threshold >= 0) patch.high_value_threshold = Math.round(body.high_value_threshold);
  if (typeof body.agentPhonesCsv === "string") {
    const parsed = parseAgentPhoneCsv(body.agentPhonesCsv);
    if (Object.keys(parsed).length) patch.agentPhones = parsed;
  }
  const next = await updateSettings(prisma, tenantId, patch);
  return NextResponse.json({ settings: next, imported: patch.agentPhones ? Object.keys(patch.agentPhones).length : 0 });
}
