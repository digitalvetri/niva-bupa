// DigitalVetri signature heat-bar: left-edge state indicator on cards & pipeline rows (§8).
// Color is redundant with an always-present label elsewhere on the card (never color-alone).
import { cn } from "@/lib/utils";
import { heatFor, HEAT_COLOR, HEAT_LABEL, type Heat } from "@/lib/theme";

export function HeatBar({ stage, className }: { stage: string; className?: string }) {
  const heat = heatFor(stage);
  return (
    <span
      aria-label={HEAT_LABEL[heat]}
      title={HEAT_LABEL[heat]}
      className={cn("absolute left-0 top-0 h-full w-1", className)}
      style={{ background: HEAT_COLOR[heat] }}
    />
  );
}

export function HeatDot({ heat, className }: { heat: Heat; className?: string }) {
  return <span className={cn("inline-block h-2 w-2 rounded-full", className)} style={{ background: HEAT_COLOR[heat] }} aria-hidden />;
}
