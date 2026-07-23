// Tenant settings (§9 / §2.2): high-value threshold + agent_code -> phone mapping. Stored in
// Tenant.settings JSON to avoid a schema migration.
import type { PrismaClient } from "@prisma/client";
import type { ImageGenSettings } from "../image";

export type LlmSettings = { provider?: string; apiKey?: string; model?: string };

export type TenantSettings = {
  high_value_threshold: number;
  currency: string;
  agentPhones: Record<string, string>; // agentCode -> phone
  llm?: LlmSettings; // bot provider + API key (stored server-side; masked on read)
  imageGen?: ImageGenSettings; // report-background image provider + key (server-side; masked on read)
  branchTargets?: Record<string, number>; // branch -> business target (₹) for report achievement %
};

const DEFAULTS: TenantSettings = { high_value_threshold: 50000, currency: "INR", agentPhones: {} };

export async function getSettings(db: PrismaClient, tenantId: string): Promise<TenantSettings> {
  const t = await db.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  const s = (t?.settings ?? {}) as Partial<TenantSettings>;
  return { ...DEFAULTS, ...s, agentPhones: { ...(s.agentPhones ?? {}) } };
}

export async function updateSettings(db: PrismaClient, tenantId: string, patch: Partial<TenantSettings>): Promise<TenantSettings> {
  const current = await getSettings(db, tenantId);
  const next: TenantSettings = {
    ...current,
    ...patch,
    agentPhones: { ...current.agentPhones, ...(patch.agentPhones ?? {}) },
    branchTargets: { ...current.branchTargets, ...(patch.branchTargets ?? {}) },
    // Merge llm so e.g. changing the model doesn't wipe the stored key.
    llm: patch.llm ? { ...current.llm, ...patch.llm } : current.llm,
    // Same for the image-gen provider config.
    imageGen: patch.imageGen ? { ...current.imageGen, ...patch.imageGen } : current.imageGen,
  };
  await db.tenant.update({ where: { id: tenantId }, data: { settings: next as object } });
  return next;
}

/** Parse an "agent_code,phone" CSV (header optional) into a mapping. Non-digits stripped from phone. */
export function parseAgentPhoneCsv(csv: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const line of csv.split(/\r?\n/)) {
    const cols = line.split(",").map((c) => c.trim());
    if (cols.length < 2) continue;
    const [code, phoneRaw] = cols;
    if (!code || /agent/i.test(code) || /phone/i.test(phoneRaw ?? "")) continue; // skip header
    const phone = (phoneRaw ?? "").replace(/[^\d+]/g, "");
    if (code && phone) map[code] = phone;
  }
  return map;
}
