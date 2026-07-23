// POST /api/report/background — generate ONE decorative, brand-styled background for the report
// posters using the tenant's configured image provider. Returns a same-origin base64 data URL so
// html-to-image can composite it without tainting the canvas. The image is decoration only — all
// numbers are rendered as HTML on top, so no figure is ever drawn by a model.
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { contextFromRequest } from "@/lib/auth";
import { ensureDevTenant } from "@/lib/tenant";
import { getSettings } from "@/lib/nudge/settings";
import { generateBackground, backgroundPrompt, imageGenConfigured } from "@/lib/image";

export const runtime = "nodejs";
export const maxDuration = 60;

// In-memory cache so nine posters share one generated image and a reload doesn't re-bill the key.
// Keyed by tenant; a regenerate (refresh=true) overwrites it with a fresh seed.
const cache = new Map<string, { dataUrl: string; at: number }>();
// In-flight generations, keyed by tenant, so concurrent requests (StrictMode double-fire, multiple
// tabs) collapse onto ONE provider call instead of racing into a rate-limit (e.g. Pollinations 429).
const inflight = new Map<string, Promise<string>>();

export async function POST(req: NextRequest) {
  const { tenantId } = contextFromRequest(req);
  if (!tenantId) return NextResponse.json({ error: "Missing tenant" }, { status: 401 });
  await ensureDevTenant(prisma, tenantId);

  let body: { refresh?: boolean; scopeLabel?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* empty body is fine */
  }

  const settings = await getSettings(prisma, tenantId);
  if (!imageGenConfigured(settings.imageGen)) {
    return NextResponse.json({ configured: false }, { status: 200 });
  }

  if (!body.refresh) {
    const hit = cache.get(tenantId);
    if (hit) return NextResponse.json({ configured: true, dataUrl: hit.dataUrl, cached: true });
    // A generation is already running for this tenant — join it instead of starting another.
    const pending = inflight.get(tenantId);
    if (pending) {
      try {
        const dataUrl = await pending;
        return NextResponse.json({ configured: true, dataUrl, cached: true });
      } catch {
        /* fall through and try our own generation below */
      }
    }
  }

  const seed = Math.floor(Math.random() * 1_000_000);
  const task = generateBackground(settings.imageGen!, backgroundPrompt(body.scopeLabel ?? ""), seed);
  inflight.set(tenantId, task);
  try {
    const dataUrl = await task;
    cache.set(tenantId, { dataUrl, at: Date.now() });
    return NextResponse.json({ configured: true, dataUrl, cached: false });
  } catch (e) {
    return NextResponse.json({ configured: true, error: (e as Error).message }, { status: 502 });
  } finally {
    if (inflight.get(tenantId) === task) inflight.delete(tenantId);
  }
}
