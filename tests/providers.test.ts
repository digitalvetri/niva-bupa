// Multi-provider abstraction — the deterministic parts (config resolution, tool schema conversion,
// key masking). The actual network calls need a real key and are covered by the §14 live suite.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveLlmConfig, getProvider, defaultModelFor, isProviderId, PROVIDERS } from "../lib/bot/providers";
import { AnthropicProvider } from "../lib/bot/providers/anthropic";
import { OpenAICompatibleProvider } from "../lib/bot/providers/openai";
import { GeminiProvider } from "../lib/bot/providers/gemini";

const ENV = process.env.ANTHROPIC_API_KEY;
beforeEach(() => { delete process.env.ANTHROPIC_API_KEY; delete process.env.ANTHROPIC_AUTH_TOKEN; });
afterEach(() => { if (ENV) process.env.ANTHROPIC_API_KEY = ENV; });

describe("provider catalog", () => {
  it("has the four providers with default models; anthropic recommended", () => {
    expect(PROVIDERS.map((p) => p.id).sort()).toEqual(["anthropic", "gemini", "groq", "openai"]);
    expect(PROVIDERS.find((p) => p.id === "anthropic")!.recommended).toBe(true);
    expect(defaultModelFor("groq")).toBe("llama-3.3-70b-versatile");
    expect(isProviderId("groq")).toBe(true);
    expect(isProviderId("cohere")).toBe(false);
  });
});

describe("resolveLlmConfig", () => {
  it("tenant provider+key wins", () => {
    const cfg = resolveLlmConfig({ provider: "groq", apiKey: "gsk_x", model: "llama-3.3-70b-versatile" });
    expect(cfg).toEqual({ provider: "groq", apiKey: "gsk_x", model: "llama-3.3-70b-versatile" });
  });
  it("ignores a provider with no key, falls back to env", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-env";
    const cfg = resolveLlmConfig({ provider: "gemini" }); // no key
    expect(cfg?.provider).toBe("anthropic");
  });
  it("returns null when nothing is configured", () => {
    expect(resolveLlmConfig(undefined)).toBeNull();
    expect(resolveLlmConfig({ provider: "openai" })).toBeNull();
  });
});

describe("getProvider builds the right adapter", () => {
  it("maps each provider id to its adapter", () => {
    expect(getProvider({ provider: "anthropic", model: "claude-sonnet-4-6" })).toBeInstanceOf(AnthropicProvider);
    expect(getProvider({ provider: "groq", apiKey: "gsk_x" })).toBeInstanceOf(OpenAICompatibleProvider);
    expect(getProvider({ provider: "openai", apiKey: "sk-x" })).toBeInstanceOf(OpenAICompatibleProvider);
    expect(getProvider({ provider: "gemini", apiKey: "AIza-x" })).toBeInstanceOf(GeminiProvider);
  });
  it("non-anthropic providers require a key", () => {
    expect(() => getProvider({ provider: "groq" })).toThrow(/Missing API key/);
  });
});
