import type { Prisma, PrismaClient } from "@prisma/client";
import type { FunnelStage, Bucket } from "../ingest/funnelStage.js";

// §6.1 shared filter object.
export type Filters = {
  branch?: string[];
  agent?: string[];
  am?: string[];
  productGenre?: string[];
  planType?: string[];
  funnelStage?: string[];
  bucket?: Bucket[];
  isPortability?: boolean;
  discrepancyOnly?: boolean;
  minLoggedPremium?: number;
  customerState?: string[];
  dateFrom?: string; // ISO; on loggedDate
  dateTo?: string;
};

// §6.3 meta block — surfaced in UI as provenance.
export type MetricMeta = {
  rowsMatched: number;
  filtersApplied: Filters;
  snapshotId: string;
  computedAt: string;
};

export type MetricResult<T = unknown> = {
  id: string;
  data: T;
  meta: MetricMeta;
};

export type MetricFn<T = unknown> = (
  db: PrismaClient,
  snapshotId: string,
  filters: Filters,
) => Promise<MetricResult<T>>;

export const BUCKET_STAGES: Record<Bucket, FunnelStage[]> = {
  Won: ["ISSUED"],
  Pending: ["UNDERWRITING", "OPERATIONS", "TELE_UW_REQUIRED", "REQUIREMENT_RAISED", "COUNTER_OFFER"],
  Review: ["UNKNOWN", "OTHER"],
};

/** Build a Prisma where-clause scoped to one snapshot from the shared Filters. */
export function buildWhere(snapshotId: string, filters: Filters): Prisma.NbCaseWhereInput {
  const where: Prisma.NbCaseWhereInput = { snapshotId };

  if (filters.branch?.length) where.loginBranch = { in: filters.branch };
  if (filters.agent?.length) where.agentName = { in: filters.agent };
  if (filters.am?.length) where.amName = { in: filters.am };
  if (filters.productGenre?.length) where.productGenre = { in: filters.productGenre };
  if (filters.planType?.length) where.planType = { in: filters.planType };
  if (filters.customerState?.length) where.customerState = { in: filters.customerState };
  if (filters.isPortability !== undefined) where.isPortability = filters.isPortability;
  if (filters.discrepancyOnly) where.discrepancy = true;
  if (filters.minLoggedPremium !== undefined) where.loggedPremium = { gte: filters.minLoggedPremium };

  // funnelStage + bucket intersect into an allowed-stage set.
  const stageSets: string[][] = [];
  if (filters.funnelStage?.length) stageSets.push(filters.funnelStage);
  if (filters.bucket?.length) stageSets.push(filters.bucket.flatMap((b) => BUCKET_STAGES[b]));
  if (stageSets.length === 1) {
    where.funnelStage = { in: stageSets[0] };
  } else if (stageSets.length === 2) {
    const allowed = stageSets[0]!.filter((s) => stageSets[1]!.includes(s));
    where.funnelStage = { in: allowed };
  }

  if (filters.dateFrom || filters.dateTo) {
    where.loggedDate = {};
    if (filters.dateFrom) (where.loggedDate as Prisma.DateTimeFilter).gte = new Date(filters.dateFrom);
    if (filters.dateTo) (where.loggedDate as Prisma.DateTimeFilter).lte = new Date(filters.dateTo);
  }

  return where;
}

export function meta(snapshotId: string, filters: Filters, rowsMatched: number): MetricMeta {
  return { rowsMatched, filtersApplied: filters, snapshotId, computedAt: new Date().toISOString() };
}

/** Prisma Decimal | null -> number (exact for our magnitudes). */
export function dnum(d: Prisma.Decimal | null | undefined): number {
  return d == null ? 0 : Number(d);
}
