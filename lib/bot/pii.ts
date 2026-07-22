// §11 PII discipline for the router. The router (intent classification) must receive ONLY the
// user's questions + the tool catalog — never customer names/IDs. Prior *assistant* narration can
// contain row-level PII (from stuck_cases / case_lookup answers), so we strip it before routing.
// Follow-up resolution ("and by agent?") still works: the topic/filters live in the USER turns.
import type { ChatTurn } from "./router";

const ASSISTANT_STUB = "(You answered the previous question. Any filters or topic from earlier are implied by the user's turns.)";

/** Replace assistant turns with a non-PII stub; keep user turns (the questions) verbatim. */
export function sanitizeHistoryForRouter(history: ChatTurn[]): ChatTurn[] {
  return history.map((t) => (t.role === "assistant" ? { role: "assistant" as const, content: ASSISTANT_STUB } : t));
}
