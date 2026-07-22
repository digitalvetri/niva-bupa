// Phase 1 auth shim. Real Supabase JWT -> tenant_id resolution lands in Phase 5 (§10).
// Until then, tenant/user come from headers (service-role ingestion is server-side only).
import type { NextRequest } from "next/server";

export type RequestContext = { tenantId: string; userId: string };

export function contextFromRequest(req: NextRequest): RequestContext {
  const tenantId = req.headers.get("x-tenant-id") ?? process.env.DEFAULT_TENANT_ID ?? "";
  const userId = req.headers.get("x-user-id") ?? "system";
  return { tenantId, userId };
}
