// §2.2 Sales Status -> FunnelStage mapping (canonical enum).

export type FunnelStage =
  | "ISSUED"
  | "UNDERWRITING"
  | "OPERATIONS"
  | "TELE_UW_REQUIRED"
  | "REQUIREMENT_RAISED"
  | "COUNTER_OFFER"
  | "UNKNOWN"
  | "OTHER";

export type Bucket = "Won" | "Pending" | "Review";

// Keyed by lowercased, trimmed sales_status raw value.
const SALES_STATUS_MAP: Record<string, FunnelStage> = {
  "policy issued": "ISSUED",
  "under processing with underwriting": "UNDERWRITING",
  "under processing with operations": "OPERATIONS",
  "tele underwriting required": "TELE_UW_REQUIRED",
  "additional requirement raised": "REQUIREMENT_RAISED",
  "counter offer proposed": "COUNTER_OFFER",
  "counter offer triggered": "COUNTER_OFFER",
  "counter offer loading": "COUNTER_OFFER",
};

export type FunnelStageResult = {
  stage: FunnelStage;
  /** true when the raw value was non-empty but not in the map -> OTHER + warn issue. */
  unmapped: boolean;
};

/**
 * Map a raw sales_status to a FunnelStage.
 * - blank/null with no policy number -> UNKNOWN (bucket Review). §2.2 last row / edge 6
 * - blank/null but a policy exists -> treat as ISSUED-adjacent UNKNOWN? Spec ties blank->UNKNOWN only
 *   "with no policy_no"; a blank status WITH a policy is still ambiguous, so we keep UNKNOWN.
 * - unknown non-empty value -> OTHER, flagged for a warn issue. §2.3(3)
 */
export function mapFunnelStage(salesStatusRaw: string | null | undefined, policyNo: string | null): FunnelStageResult {
  const v = (salesStatusRaw ?? "").trim();
  if (v === "") return { stage: "UNKNOWN", unmapped: false };
  const mapped = SALES_STATUS_MAP[v.toLowerCase()];
  if (mapped) return { stage: mapped, unmapped: false };
  return { stage: "OTHER", unmapped: true };
}

const STAGE_BUCKET: Record<FunnelStage, Bucket> = {
  ISSUED: "Won",
  UNDERWRITING: "Pending",
  OPERATIONS: "Pending",
  TELE_UW_REQUIRED: "Pending",
  REQUIREMENT_RAISED: "Pending",
  COUNTER_OFFER: "Pending",
  UNKNOWN: "Review",
  OTHER: "Review",
};

export function bucketFor(stage: FunnelStage): Bucket {
  return STAGE_BUCKET[stage];
}

// §8.2 heat-bar: red = needs action.
const NEEDS_ACTION = new Set<FunnelStage>(["TELE_UW_REQUIRED", "REQUIREMENT_RAISED", "COUNTER_OFFER"]);
export function isNeedsAction(stage: FunnelStage): boolean {
  return NEEDS_ACTION.has(stage);
}

// Canonical display order for the funnel metric.
export const FUNNEL_ORDER: FunnelStage[] = [
  "ISSUED",
  "UNDERWRITING",
  "OPERATIONS",
  "TELE_UW_REQUIRED",
  "REQUIREMENT_RAISED",
  "COUNTER_OFFER",
  "UNKNOWN",
  "OTHER",
];
