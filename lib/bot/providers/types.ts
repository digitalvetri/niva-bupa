// Provider-agnostic LLM interface. The bot needs exactly two capabilities from any provider:
//  1) route()   — given the conversation + tools, force a tool call and return the picked calls.
//  2) narrate() — stream a text answer.
// Claude is the default and recommended provider; Groq / OpenAI-compatible / Gemini are supported
// so a tenant can bring their own key.

export type ProviderId = "anthropic" | "groq" | "openai" | "gemini";

export type LlmTool = { name: string; description: string; parameters: Record<string, unknown> };
export type LlmToolCall = { name: string; input: Record<string, unknown> };
export type LlmTurn = { role: "user" | "assistant"; content: string };

export type LlmConfig = {
  provider: ProviderId;
  apiKey?: string; // optional for anthropic when resolved from env/profile
  model?: string;
};

export interface LlmProvider {
  /** Force a tool call over the conversation; return the picked tool calls (may be several). */
  route(system: string, messages: LlmTurn[], tools: LlmTool[]): Promise<LlmToolCall[]>;
  /** Stream the answer as text deltas. */
  narrate(system: string, userContent: string): AsyncGenerator<string, void, unknown>;
}

// Provider catalog for the Settings UI + default models.
export const PROVIDERS: { id: ProviderId; label: string; defaultModel: string; keyHint: string; recommended?: boolean }[] = [
  { id: "anthropic", label: "Anthropic (Claude)", defaultModel: "claude-sonnet-4-6", keyHint: "sk-ant-…", recommended: true },
  { id: "groq", label: "Groq (Llama)", defaultModel: "llama-3.3-70b-versatile", keyHint: "gsk_…" },
  { id: "openai", label: "OpenAI (GPT)", defaultModel: "gpt-4o-mini", keyHint: "sk-…" },
  { id: "gemini", label: "Google Gemini", defaultModel: "gemini-2.0-flash", keyHint: "AIza…" },
];

export function defaultModelFor(provider: ProviderId): string {
  return PROVIDERS.find((p) => p.id === provider)?.defaultModel ?? "";
}

export function isProviderId(v: unknown): v is ProviderId {
  return typeof v === "string" && PROVIDERS.some((p) => p.id === v);
}
