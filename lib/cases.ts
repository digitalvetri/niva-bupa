// §5 /cases — filterable, server-paginated case list. Query logic lives here (never in a component).
// Reuses the §6.1 Filters + buildWhere so the table shares the metric engine's filter semantics.
import type { Prisma, PrismaClient } from "@prisma/client";
import { buildWhere, dnum, type Filters } from "./metrics/types";
import { normalizeLeadStatus } from "./metrics/metrics";

export type CaseSort =
  | "loggedPremium" | "issuedPremium" | "statusAgeing" | "customerName" | "loginBranch" | "funnelStage";

export type CasesQuery = {
  page?: number; // 1-based
  pageSize?: number;
  sort?: CaseSort;
  dir?: "asc" | "desc";
  search?: string; // customerName / applicationNo contains
};

export type CaseListRow = {
  id: string;
  applicationNo: string;
  customerName: string;
  loginBranch: string;
  agentName: string;
  productGenre: string;
  planType: string | null;
  funnelStage: string;
  leadStatus: string;
  loggedPremium: number;
  issuedPremium: number;
  statusAgeing: number | null;
  loginAgeing: number | null;
  ageingDays: number | null; // statusAgeing ?? loginAgeing (see stuck_cases note)
  isPortability: boolean;
  discrepancy: boolean;
};

export type CasesResult = {
  rows: CaseListRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const MAX_PAGE_SIZE = 200;

export async function listCases(db: PrismaClient, snapshotId: string, filters: Filters, q: CasesQuery = {}): Promise<CasesResult> {
  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, q.pageSize ?? 25));
  const sort: CaseSort = q.sort ?? "loggedPremium";
  const dir = q.dir ?? "desc";

  const where: Prisma.NbCaseWhereInput = buildWhere(snapshotId, filters);
  if (q.search?.trim()) {
    const s = q.search.trim();
    where.OR = [
      { customerName: { contains: s, mode: "insensitive" } },
      { applicationNo: { contains: s, mode: "insensitive" } },
    ];
  }

  const [total, rows] = await Promise.all([
    db.nbCase.count({ where }),
    db.nbCase.findMany({
      where,
      orderBy: { [sort]: dir },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, applicationNo: true, customerName: true, loginBranch: true, agentName: true,
        productGenre: true, planType: true, funnelStage: true, leadStatusRaw: true,
        loggedPremium: true, issuedPremium: true, statusAgeing: true, loginAgeing: true, isPortability: true, discrepancy: true,
      },
    }),
  ]);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      applicationNo: r.applicationNo,
      customerName: r.customerName,
      loginBranch: r.loginBranch,
      agentName: r.agentName,
      productGenre: r.productGenre,
      planType: r.planType,
      funnelStage: r.funnelStage,
      leadStatus: normalizeLeadStatus(r.leadStatusRaw),
      loggedPremium: dnum(r.loggedPremium),
      issuedPremium: dnum(r.issuedPremium),
      statusAgeing: r.statusAgeing,
      loginAgeing: r.loginAgeing,
      ageingDays: r.statusAgeing ?? r.loginAgeing,
      isPortability: r.isPortability,
      discrepancy: r.discrepancy,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
