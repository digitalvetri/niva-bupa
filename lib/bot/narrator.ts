// §7.3 Narrator — gets the user question + tool results JSON + language hint, and writes the
// answer. It must quote ONLY numbers present in the tool results. Streamed over SSE.
import { anthropic, BOT_MODEL } from "./anthropic";
import type { LanguageHint } from "./transliterate";

const NARRATOR_SYSTEM = `You write short answers about an insurance New Business report. You are given the user's question and the JSON results of deterministic metric tools. The tool results are the ONLY source of truth for numbers.

Hard rules:
- NEVER state a number (premium, count, percentage, ₹ value) that is not present verbatim in the tool results JSON. Do not add, average, or recompute anything.
- Prefer the pre-formatted "display" strings from the results (e.g. ₹31.77L, 62.5%) — they use Indian formatting.
- Lead with the key number. Keep it to at most 4 sentences. A small table is fine when it helps.
- Match the user's language register: if they wrote Tanglish (Tamil in Latin script), answer in Tanglish; if Tamil, answer in Tamil; if English, answer in English. Keep numbers in Indian format either way.
- If the results include a "needsInterpretation" note, clearly separate fact (from the numbers) from any hypothesis, and label the hypothesis as such.
- End with exactly one short, relevant follow-up suggestion.
- If the tool results are empty or zero rows, say there's no matching data — do not invent any.`;

export type NarratorInput = {
  question: string;
  language: LanguageHint;
  toolResults: unknown;
  needsInterpretation?: boolean;
};

function buildUserContent(input: NarratorInput): string {
  return [
    `User question: ${input.question}`,
    `Language register: ${input.language}`,
    input.needsInterpretation ? `Note: needsInterpretation = true (separate fact from hypothesis).` : "",
    ``,
    `Tool results (the ONLY source of numbers):`,
    "```json",
    JSON.stringify(input.toolResults, null, 2),
    "```",
    ``,
    `Write the answer now.`,
  ].filter(Boolean).join("\n");
}

/** Stream the narration; yields text deltas. Accumulate them for the final message. */
export async function* narrate(input: NarratorInput): AsyncGenerator<string, void, unknown> {
  const stream = anthropic().messages.stream({
    model: BOT_MODEL,
    max_tokens: 1024,
    system: NARRATOR_SYSTEM,
    messages: [{ role: "user", content: buildUserContent(input) }],
  });
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
}
