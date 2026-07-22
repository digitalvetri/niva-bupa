// Client-safe §9 nudge draft (no DB imports). Used by both the server queue and the modal.
import { formatINRFull } from "../metrics/format";

export type CaseContext = {
  applicationNo: string;
  customerName: string;
  agentName: string;
  agentCode: string | null;
  loggedPremium: number;
  productGenre: string;
  leadStatus: string;
  ageingDays: number | null;
};

/** §9 message template — editable in the modal before sending. */
export function draftNudge(c: CaseContext, thName: string): string {
  const ageing = c.ageingDays ?? 0;
  return `Hi ${c.agentName}, case ${c.applicationNo} — ${c.customerName}, ${formatINRFull(c.loggedPremium)} (${c.productGenre}) is pending at *${c.leadStatus}* for ${ageing} day${ageing === 1 ? "" : "s"}. Please complete the requirement today. — ${thName}`;
}
