// GET/POST /api/settings — high-value threshold + agent_code->phone mapping CSV (§9) + the bot's
// LLM provider/API key. The API key is stored server-side and NEVER returned raw (masked on GET).
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { contextFromRequest } from "@/lib/auth";
import { getSettings, updateSettings, parseAgentPhoneCsv, type TenantSettings, type LlmSettings } from "@/lib/nudge/settings";
import { ensureDevTenant } from "@/lib/tenant";
import { isProviderId, resolveLlmConfig, defaultModelFor } from "@/lib/bot/providers";
import { isImageProviderId, imageGenConfigured, imageProviderMeta, type ImageGenSettings } from "@/lib/image";

export const runtime = "nodejs";

/** Public view of settings — the API key is masked to provider + last 4 only. */
function publicView(s: TenantSettings) {
  const key = s.llm?.apiKey ?? "";
  return {
    high_value_threshold: s.high_value_threshold,
    currency: s.currency,
    agentPhones: s.agentPhones,
    branchTargets: s.branchTargets ?? {},
    branchGroups: s.branchGroups ?? {},
    llm: {
      provider: s.llm?.provider ?? null,
      model: s.llm?.model ?? (s.llm?.provider ? defaultModelFor(s.llm.provider as never) : null),
      configured: Boolean(resolveLlmConfig(s.llm)),
      keyLast4: key ? key.slice(-4) : null,
      source: s.llm?.apiKey ? "settings" : resolveLlmConfig(s.llm) ? "env" : null,
    },
    imageGen: {
      provider: s.imageGen?.provider ?? null,
      model: s.imageGen?.model ?? (s.imageGen?.provider ? imageProviderMeta(s.imageGen.provider)?.defaultModel ?? null : null),
      accountLast4: s.imageGen?.accountId ? s.imageGen.accountId.slice(-4) : null,
      keyLast4: s.imageGen?.apiKey ? s.imageGen.apiKey.slice(-4) : null,
      configured: imageGenConfigured(s.imageGen),
    },
  };
}

export async function GET(req: NextRequest) {
  const { tenantId } = contextFromRequest(req);
  if (!tenantId) return NextResponse.json({ error: "Missing tenant" }, { status: 401 });
  await ensureDevTenant(prisma, tenantId);
  return NextResponse.json(publicView(await getSettings(prisma, tenantId)));
}

export async function POST(req: NextRequest) {
  const { tenantId } = contextFromRequest(req);
  if (!tenantId) return NextResponse.json({ error: "Missing tenant" }, { status: 401 });
  await ensureDevTenant(prisma, tenantId);

  let body: {
    high_value_threshold?: number;
    agentPhonesCsv?: string;
    branchTargets?: Record<string, number>;
    branchGroups?: Record<string, string>;
    llm?: { provider?: string; apiKey?: string; model?: string; clear?: boolean };
    imageGen?: { provider?: string; apiKey?: string; accountId?: string; model?: string; clear?: boolean };
  };
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
  if (body.branchTargets && typeof body.branchTargets === "object") {
    const clean: Record<string, number> = {};
    for (const [b, v] of Object.entries(body.branchTargets)) if (typeof v === "number" && v >= 0) clean[b] = Math.round(v);
    patch.branchTargets = clean;
  }
  if (body.branchGroups && typeof body.branchGroups === "object") {
    const clean: Record<string, string> = {};
    // Only store non-identity mappings (a branch that rolls up into a different parent).
    for (const [b, v] of Object.entries(body.branchGroups)) if (typeof v === "string" && v && v !== b) clean[b] = v;
    patch.branchGroups = clean;
  }

  if (body.llm) {
    if (body.llm.clear) {
      patch.llm = { provider: undefined, apiKey: undefined, model: undefined };
    } else {
      if (body.llm.provider !== undefined && !isProviderId(body.llm.provider)) {
        return NextResponse.json({ error: `Unknown provider "${body.llm.provider}"` }, { status: 400 });
      }
      const llm: LlmSettings = {};
      if (body.llm.provider) llm.provider = body.llm.provider;
      // Only overwrite the key when a non-empty value is sent (empty string = "leave unchanged").
      if (typeof body.llm.apiKey === "string" && body.llm.apiKey.trim()) llm.apiKey = body.llm.apiKey.trim();
      if (typeof body.llm.model === "string") llm.model = body.llm.model.trim() || undefined;
      patch.llm = llm;
    }
  }

  if (body.imageGen) {
    if (body.imageGen.clear) {
      patch.imageGen = { provider: undefined, apiKey: undefined, accountId: undefined, model: undefined };
    } else {
      if (body.imageGen.provider !== undefined && !isImageProviderId(body.imageGen.provider)) {
        return NextResponse.json({ error: `Unknown image provider "${body.imageGen.provider}"` }, { status: 400 });
      }
      const img: ImageGenSettings = {};
      if (body.imageGen.provider) img.provider = body.imageGen.provider;
      // Empty string = "leave unchanged"; only overwrite secrets when a value is sent.
      if (typeof body.imageGen.apiKey === "string" && body.imageGen.apiKey.trim()) img.apiKey = body.imageGen.apiKey.trim();
      if (typeof body.imageGen.accountId === "string" && body.imageGen.accountId.trim()) img.accountId = body.imageGen.accountId.trim();
      if (typeof body.imageGen.model === "string") img.model = body.imageGen.model.trim() || undefined;
      patch.imageGen = img;
    }
  }

  const next = await updateSettings(prisma, tenantId, patch);
  return NextResponse.json({ settings: publicView(next), imported: patch.agentPhones ? Object.keys(patch.agentPhones).length : 0 });
}
