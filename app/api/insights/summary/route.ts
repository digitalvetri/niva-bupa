// GET /api/insights/summary?snapshotId=&filters= — the AI Executive Summary for Pulse.
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { contextFromRequest } from "@/lib/auth";
import { requireSnapshot, scopedFilters, AccessError } from "@/lib/access";
import { getSettings } from "@/lib/nudge/settings";
import { resolveLlmConfig, getProvider } from "@/lib/bot/providers";
import { captureError } from "@/lib/observability";
import { buildSummaryFacts, deterministicSummary, aiSummary } from "@/lib/insights/summary";
import type { Filters } from "@/lib/metrics/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const snapshotId = searchParams.get("snapshotId");
  if (!snapshotId) return NextResponse.json({ error: "snapshotId is required" }, { status: 400 });

  let filters: Filters = {};
  const raw = searchParams.get("filters");
  if (raw) {
    try { filters = JSON.parse(raw) as Filters; } catch { return NextResponse.json({ error: "filters must be valid JSON" }, { status: 400 }); }
  }

  const ctx = contextFromRequest(req);
  try {
    await requireSnapshot(prisma, snapshotId, ctx);
    filters = scopedFilters(filters, ctx);
    const scopeLabel = filters.branch?.length === 1 ? `${filters.branch[0]} branch` : "This territory";
    const facts = await buildSummaryFacts(prisma, snapshotId, filters, scopeLabel);

    const llmConfig = resolveLlmConfig((await getSettings(prisma, ctx.tenantId)).llm);
    if (llmConfig) {
      const summary = await aiSummary(getProvider(llmConfig), facts);
      return NextResponse.json({ summary, generatedBy: "ai", facts });
    }
    return NextResponse.json({ summary: deterministicSummary(facts), generatedBy: "rules", facts });
  } catch (e) {
    if (e instanceof AccessError) return NextResponse.json({ error: e.message }, { status: e.status });
    captureError(e, { route: "insights/summary" });
    return NextResponse.json({ error: "Failed to build summary" }, { status: 500 });
  }
}
