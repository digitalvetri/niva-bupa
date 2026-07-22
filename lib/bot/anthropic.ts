// Anthropic client + model config for the bot (§7). Router and narrator both use this model.
import Anthropic from "@anthropic-ai/sdk";

// Spec §7 names Claude Sonnet (claude-sonnet-4-6) for both calls; overridable via env.
export const BOT_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

let client: Anthropic | null = null;

/** Lazily construct the client (resolves ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / ant profile). */
export function anthropic(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

/** True when some Anthropic credential is available (key or auth token). */
export function hasAnthropicCredentials(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}
