// GET/POST /api/targets — the ROTN FY target sheet (GWP + recruitment + activation).
// Saving also derives the GWP branch targets (₹) into settings.branchTargets, so the New Business
// "Territory Achievement" bar and report posters reflect the GWP target automatically.
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { contextFromRequest } from "@/lib/auth";
import { ensureDevTenant } from "@/lib/tenant";
import { getSettings, updateSettings } from "@/lib/nudge/settings";
import { defaultRotnTargets, ytdTarget, fyTotal, TARGET_BRANCHES, type RotnTargets } from "@/lib/targets/rotn";

export const runtime = "nodejs";

function coerce(input: unknown): RotnTargets {
  const base = defaultRotnTargets();
  if (!input || typeof input !== "object") return base;
  const t = input as Partial<RotnTargets>;
  const data = (t.data && typeof t.data === "object" ? t.data : base.data) as RotnTargets["data"];
  // Ensure every cell is a finite number; keep 12 months per branch.
  const clean: RotnTargets["data"] = {};
  for (const [cat, branches] of Object.entries(data)) {
    clean[cat] = {};
    for (const [b, arr] of Object.entries(branches as Record<string, unknown>)) {
      const nums = Array.isArray(arr) ? arr.slice(0, 12).map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0)) : [];
      while (nums.length < 12) nums.push(0);
      clean[cat][b] = nums;
    }
  }
  return {
    fiscalYear: typeof t.fiscalYear === "string" ? t.fiscalYear : base.fiscalYear,
    monthsClosed: Math.max(0, Math.min(12, Math.round(Number(t.monthsClosed ?? base.monthsClosed)) || 0)),
    data: clean,
  };
}

/** GWP (lakhs) → per-branch ₹ target for the New Business achievement. Uses YTD when months have closed, else FY. */
function gwpBranchTargets(t: RotnTargets): Record<string, number> {
  const out: Record<string, number> = {};
  for (const b of TARGET_BRANCHES) {
    const lakhs = t.monthsClosed > 0 ? ytdTarget(t, "GWP", b) : fyTotal(t, "GWP", b);
    if (lakhs > 0) out[b] = Math.round(lakhs * 100000);
  }
  return out;
}

export async function GET(req: NextRequest) {
  const { tenantId } = contextFromRequest(req);
  if (!tenantId) return NextResponse.json({ error: "Missing tenant" }, { status: 401 });
  await ensureDevTenant(prisma, tenantId);
  const s = await getSettings(prisma, tenantId);
  const targets = s.rotnTargets ? coerce(s.rotnTargets) : defaultRotnTargets();
  return NextResponse.json({ targets });
}

export async function POST(req: NextRequest) {
  const { tenantId } = contextFromRequest(req);
  if (!tenantId) return NextResponse.json({ error: "Missing tenant" }, { status: 401 });
  await ensureDevTenant(prisma, tenantId);

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const targets = coerce(body);

  await updateSettings(prisma, tenantId, { rotnTargets: targets, branchTargets: gwpBranchTargets(targets) });
  return NextResponse.json({ ok: true, targets });
}
