// Application-level tenant isolation + branch scoping — the enforceable equivalent of Supabase
// RLS at the API boundary (§10/§11). Every snapshot-scoped route asserts ownership before reading.
import type { PrismaClient } from "@prisma/client";
import type { RequestContext } from "./auth";
import type { Filters } from "./metrics/types";

export class AccessError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AccessError";
    this.status = status;
  }
}

/**
 * Assert the snapshot belongs to the caller's tenant. Returns 404 (not 403) for a cross-tenant
 * id so the API never confirms another tenant's snapshot exists.
 */
export async function requireSnapshot(db: PrismaClient, snapshotId: string, ctx: RequestContext): Promise<void> {
  if (!ctx.tenantId) throw new AccessError("Missing tenant", 401);
  const snap = await db.reportSnapshot.findUnique({ where: { id: snapshotId }, select: { tenantId: true } });
  if (!snap || snap.tenantId !== ctx.tenantId) throw new AccessError("Snapshot not found", 404);
}

/**
 * Apply the caller's branch scope to filters. A branch-scoped user can only ever query within
 * their branches — even if they pass a broader branch filter. Empty scope = all branches.
 */
// Sentinel branch that matches no row — used when the requested branch is outside the caller's
// scope, so the intersection is empty. Without it, an empty array falls through buildWhere's
// length guard and would return ALL branches (a scope-escape).
const SCOPE_DENY = "__SCOPE_DENY__";

export function scopedFilters(filters: Filters, ctx: RequestContext): Filters {
  if (ctx.branchScope.length === 0) return filters;
  const allowed = filters.branch?.length ? filters.branch.filter((b) => ctx.branchScope.includes(b)) : ctx.branchScope;
  return { ...filters, branch: allowed.length ? allowed : [SCOPE_DENY] };
}
