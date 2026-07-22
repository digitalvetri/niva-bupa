// Shared presentation mapping — funnel stage -> label + heat color. Client-safe (pure).
import type { FunnelStage } from "./ingest/funnelStage";

export type Heat = "won" | "pending" | "action" | "review";

export const STAGE_LABEL: Record<string, string> = {
  ISSUED: "Issued",
  UNDERWRITING: "Underwriting",
  OPERATIONS: "Operations",
  TELE_UW_REQUIRED: "Tele-UW required",
  REQUIREMENT_RAISED: "Requirement raised",
  COUNTER_OFFER: "Counter offer",
  UNKNOWN: "Review",
  OTHER: "Other",
};

// §8 heat-bar: green Won / amber Pending / red Needs-action / grey Review.
const STAGE_HEAT: Record<string, Heat> = {
  ISSUED: "won",
  UNDERWRITING: "pending",
  OPERATIONS: "pending",
  TELE_UW_REQUIRED: "action",
  REQUIREMENT_RAISED: "action",
  COUNTER_OFFER: "action",
  UNKNOWN: "review",
  OTHER: "review",
};

export function heatFor(stage: string): Heat {
  return STAGE_HEAT[stage] ?? "review";
}

export const HEAT_COLOR: Record<Heat, string> = {
  won: "var(--won)",
  pending: "var(--pending)",
  action: "var(--action)",
  review: "var(--review)",
};

export const HEAT_LABEL: Record<Heat, string> = {
  won: "Won",
  pending: "Pending",
  action: "Needs action",
  review: "Review",
};

// Pipeline kanban columns (§3): pending stages grouped, needs-action first.
export const PIPELINE_STAGES: FunnelStage[] = [
  "TELE_UW_REQUIRED",
  "REQUIREMENT_RAISED",
  "COUNTER_OFFER",
  "UNDERWRITING",
  "OPERATIONS",
  "UNKNOWN",
];

export const CHART = {
  logged: "var(--chart-logged)",
  issued: "var(--chart-issued)",
  grid: "var(--border)",
  axis: "var(--fg-subtle)",
};
