import type { PrismaClient } from "@prisma/client";

// Phase 2 dev convenience: guarantee the default tenant row exists so browser upload works
// without a manual seed. Real tenant creation happens at Supabase signup (§10) in Phase 5.
export async function ensureDevTenant(db: PrismaClient, tenantId: string): Promise<void> {
  if (process.env.NODE_ENV === "production") return;
  await db.tenant.upsert({
    where: { id: tenantId },
    update: {},
    create: { id: tenantId, name: "Demo Territory", settings: { high_value_threshold: 50000, currency: "INR" } },
  });
}
