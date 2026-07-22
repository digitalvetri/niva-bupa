// POST /api/nudge — queue a WhatsApp nudge (§9). Enforces the 20/day/user cap; missing phone
// returns a copy-to-clipboard fallback.
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { contextFromRequest } from "@/lib/auth";
import { queueNudge, type NudgeInput } from "@/lib/nudge/nudge";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { tenantId, userId } = contextFromRequest(req);
  if (!tenantId) return NextResponse.json({ error: "Missing tenant" }, { status: 401 });

  let body: Partial<NudgeInput>;
  try {
    body = (await req.json()) as Partial<NudgeInput>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.caseId || !body.message || !body.toName) {
    return NextResponse.json({ error: "caseId, toName and message are required" }, { status: 400 });
  }

  const result = await queueNudge(
    prisma,
    { tenantId, userId, caseId: body.caseId, toName: body.toName, agentCode: body.agentCode ?? null, message: body.message },
    Date.now(),
  );
  const status = result.status === "BLOCKED" ? 429 : 200;
  return NextResponse.json(result, { status });
}
