// Auth shim. In production this is a Supabase JWT (tenant_id + role + branch_scope claims, §10)
// enforced by Postgres RLS. Here identity comes from headers so the isolation logic is testable
// end-to-end; the SAME context object is what RLS policies would key on.
import type { NextRequest } from "next/server";

export type Role = "TERRITORY_HEAD" | "BRANCH_MANAGER" | "AGENCY_MANAGER" | "VIEWER";

export type RequestContext = {
  tenantId: string;
  userId: string;
  role: Role;
  branchScope: string[]; // empty = all branches
};

export function contextFromRequest(req: NextRequest): RequestContext {
  const tenantId = req.headers.get("x-tenant-id") ?? process.env.DEFAULT_TENANT_ID ?? "";
  const userId = req.headers.get("x-user-id") ?? "system";
  const role = (req.headers.get("x-role") as Role) ?? "TERRITORY_HEAD";
  const branchScope = (req.headers.get("x-branch-scope") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return { tenantId, userId, role, branchScope };
}
