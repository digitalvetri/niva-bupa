// Map one raw CSV row (object keyed by header name) -> a normalized NbCase input,
// accumulating IngestionIssue records. Applies §2.3 rules in order via the primitives.

import {
  toNull,
  normalizeName,
  titleCase,
  upperState,
  normalizePlanType,
  normalizeChannel,
  normalizeAgentName,
  parseMoney,
  parseSumAssured,
  parseTenure,
  parseBool,
  parseIntOrNull,
  parseUsDate,
  normalizeRider,
} from "./normalize.js";
import { mapFunnelStage } from "./funnelStage.js";

export type RawRow = Record<string, string>;

export type IssueDraft = {
  rowNumber: number;
  severity: "info" | "warn" | "error";
  message: string;
  rawRow?: RawRow;
};

// A parsed case ready for Prisma createMany (snapshotId/tenantId attached by ingest).
export type ParsedCase = {
  applicationNo: string;
  policyNo: string | null;
  customerId: string | null;
  customerName: string;
  customerCity: string | null;
  customerState: string | null;
  planType: string | null;
  productGenre: string;
  planName: string | null;
  insuredLives: number | null;
  sumAssured: string | null;
  isUnlimitedSi: boolean;
  loggedPremium: string;
  issuedPremium: string;
  loadingPremium: string;
  loginBranch: string;
  channel: string | null;
  agentCode: string | null;
  agentName: string;
  amId: string | null;
  amName: string | null;
  salesStatusRaw: string | null;
  leadStatusRaw: string | null;
  funnelStage: string;
  discrepancy: boolean;
  statusAgeing: number | null;
  loginAgeing: number | null;
  isPortability: boolean;
  tenureYears: number | null;
  loggedDate: Date | null;
  issuedDate: Date | null;
  policyStart: Date | null;
  policyEnd: Date | null;
  riders: Record<string, boolean | string>;
  raw: RawRow;
};

// Rider / benefit block (§2.1). Collapsed into JSONB — we never make 35 columns.
export const RIDER_COLUMNS = [
  "Safe Guard",
  "Annual Aggregate Deductible Option",
  "Co-Payment",
  "Room Type Modification",
  "Preferred Partner Network",
  "PED Modification",
  "Future Ready",
  "Fast Forward",
  "Borderless",
  "Well Consult",
  "Cash-Bag",
  "Co-payment for Borderless",
  "Acute Care",
  "Amount in Acute Care(Best Care)",
  "Disease Management",
  "Temporal Total Disability",
  "TTD Deductible Options",
  "Specific Disease Wait time Modification",
  "Annual Health Check-up",
  "Pre-Post Enhancement",
  "Modern Treatment Enhancement",
  "Second Medical Opinion",
  "Unlock Network",
  "Borderless with SI",
  "Borderless with Copy",
  "Borderless Specific Illness With SI",
  "Borderless Specific Illness With Co-pay",
  "Cash-Bag+",
  "Annual Health Checkup",
  "ElderOne",
  "NivaBupaOne",
  "Specific PED modification",
  "HeadsUp",
] as const;

/** Look up a header value tolerantly (headers may carry trailing spaces in the source). */
function get(row: RawRow, key: string): string {
  if (key in row) return row[key] ?? "";
  const hit = Object.keys(row).find((k) => k.trim() === key);
  return hit ? row[hit] ?? "" : "";
}

export type ParseRowResult =
  | { skip: true; issue: IssueDraft }
  | { skip: false; parsedCase: ParsedCase; issues: IssueDraft[] };

/**
 * Parse a single raw row. `rowNumber` is 1-based over data rows (header excluded).
 * Returns skip=true for blank rows (§2.3 rule 6).
 */
export function parseRow(row: RawRow, rowNumber: number): ParseRowResult {
  const applicationNo = toNull(get(row, "Application Number"));
  const customerName = normalizeName(get(row, "Full Name"));

  // Rule 6: no application_no AND no customer_name -> skip + info issue.
  if (applicationNo == null && customerName === "") {
    return {
      skip: true,
      issue: { rowNumber, severity: "info", message: "Blank row skipped (no application number or name)", rawRow: row },
    };
  }

  const issues: IssueDraft[] = [];

  const logged = parseMoney(get(row, "Logged Premium"));
  if (!logged.ok) issues.push({ rowNumber, severity: "warn", message: `Non-numeric Logged Premium "${get(row, "Logged Premium")}" -> 0` });
  const issued = parseMoney(get(row, "Issued Premium"));
  if (!issued.ok) issues.push({ rowNumber, severity: "warn", message: `Non-numeric Issued Premium "${get(row, "Issued Premium")}" -> 0` });
  const loading = parseMoney(get(row, "Loading Premium"));
  if (!loading.ok) issues.push({ rowNumber, severity: "warn", message: `Non-numeric Loading Premium "${get(row, "Loading Premium")}" -> 0` });

  const sa = parseSumAssured(get(row, "Sum Assured"));

  const policyNo = toNull(get(row, "Policy Number"));
  const funnel = mapFunnelStage(get(row, "Sales Status"), policyNo);
  if (funnel.unmapped) {
    issues.push({ rowNumber, severity: "warn", message: `Unmapped Sales Status "${get(row, "Sales Status")}" -> OTHER` });
  }

  // Date parse warnings (only when a non-empty value failed to parse).
  const dateFields: [string, Date | null][] = [];
  const parseDated = (col: string): Date | null => {
    const rawVal = get(row, col);
    const d = parseUsDate(rawVal);
    if (d == null && toNull(rawVal) != null) issues.push({ rowNumber, severity: "warn", message: `Unparseable date in ${col}: "${rawVal}"` });
    dateFields.push([col, d]);
    return d;
  };
  const loggedDate = parseDated("Logged Date");
  const issuedDate = parseDated("Issued Date");
  const policyStart = parseDated("Policy Start Date");
  const policyEnd = parseDated("Policy End Date");

  // Riders JSONB — only keep non-null cells to stay compact.
  const riders: Record<string, boolean | string> = {};
  for (const col of RIDER_COLUMNS) {
    const val = normalizeRider(get(row, col));
    if (val !== null) riders[col] = val;
  }

  const loginBranch = titleCase(get(row, "Login Branch")) ?? "UNKNOWN";
  const productGenre = toNull(get(row, "Product Genre")) ?? "UNKNOWN";

  const parsedCase: ParsedCase = {
    applicationNo: applicationNo ?? "",
    policyNo,
    customerId: toNull(get(row, "Customer ID")),
    customerName,
    customerCity: titleCase(get(row, "Customer City")),
    customerState: upperState(get(row, "Customer State")),
    planType: normalizePlanType(get(row, "Plan Type")),
    productGenre,
    planName: toNull(get(row, "Plan Name")),
    insuredLives: parseIntOrNull(get(row, "Insured Lives")),
    sumAssured: sa.numeric,
    isUnlimitedSi: sa.isUnlimited,
    loggedPremium: logged.amount,
    issuedPremium: issued.amount,
    loadingPremium: loading.amount,
    loginBranch,
    channel: normalizeChannel(get(row, "Channel")),
    agentCode: toNull(get(row, "Agent Code")),
    agentName: normalizeAgentName(get(row, "Agent Name")),
    amId: toNull(get(row, "Agency Manager ID")),
    amName: toNull(get(row, "Agency Manager Name")),
    salesStatusRaw: toNull(get(row, "Sales Status")),
    leadStatusRaw: toNull(get(row, "Lead Status")),
    funnelStage: funnel.stage,
    discrepancy: toNull(get(row, "Discrepancy Status")) != null,
    statusAgeing: parseIntOrNull(get(row, "Current Status Ageing")),
    loginAgeing: parseIntOrNull(get(row, "Login Ageing")),
    isPortability: parseBool(get(row, "Is Portability")),
    tenureYears: parseTenure(get(row, "TENURE")),
    loggedDate,
    issuedDate,
    policyStart,
    policyEnd,
    riders,
    raw: row,
  };

  return { skip: false, parsedCase, issues };
}
