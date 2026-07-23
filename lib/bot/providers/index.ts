import { AnthropicProvider } from "./anthropic";
import { OpenAICompatibleProvider } from "./openai";
import { GeminiProvider } from "./gemini";
import { defaultModelFor, isProviderId, type LlmConfig, type LlmProvider } from "./types";

export * from "./types";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

/** Construct the concrete provider for a resolved config. */
export function getProvider(config: LlmConfig): LlmProvider {
  const model = config.model || defaultModelFor(config.provider);
  switch (config.provider) {
    case "anthropic":
      return new AnthropicProvider(model, config.apiKey);
    case "groq":
      return new OpenAICompatibleProvider(model, requireKey(config), GROQ_BASE_URL);
    case "openai":
      return new OpenAICompatibleProvider(model, requireKey(config));
    case "gemini":
      return new GeminiProvider(model, requireKey(config));
  }
}

function requireKey(config: LlmConfig): string {
  if (!config.apiKey) throw new Error(`Missing API key for provider "${config.provider}"`);
  return config.apiKey;
}

export type StoredLlm = { provider?: string; apiKey?: string; model?: string };

/**
 * Resolve the effective LLM config: a tenant-configured provider+key wins; otherwise fall back to
 * an Anthropic key/profile in the environment. Returns null when no provider is available.
 */
export function resolveLlmConfig(stored?: StoredLlm): LlmConfig | null {
  if (stored?.provider && isProviderId(stored.provider) && stored.apiKey) {
    return { provider: stored.provider, apiKey: stored.apiKey, model: stored.model };
  }
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) {
    return { provider: "anthropic", model: process.env.ANTHROPIC_MODEL };
  }
  return null;
}
