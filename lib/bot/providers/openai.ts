import OpenAI from "openai";
import type { LlmProvider, LlmTool, LlmToolCall, LlmTurn } from "./types";

// OpenAI-compatible chat-completions provider. Covers OpenAI and Groq (and any compatible
// endpoint) by swapping baseURL. Tools use the function-calling shape; narration streams deltas.
export class OpenAICompatibleProvider implements LlmProvider {
  private client: OpenAI;
  constructor(private model: string, apiKey: string, baseURL?: string) {
    this.client = new OpenAI({ apiKey, baseURL });
  }

  async route(system: string, messages: LlmTurn[], tools: LlmTool[]): Promise<LlmToolCall[]> {
    const resp = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 1024,
      messages: [{ role: "system", content: system }, ...messages.map((m) => ({ role: m.role, content: m.content }))],
      tools: tools.map((t) => ({ type: "function" as const, function: { name: t.name, description: t.description, parameters: t.parameters } })),
      tool_choice: "required",
    });
    const calls = resp.choices[0]?.message?.tool_calls ?? [];
    const out: LlmToolCall[] = [];
    for (const c of calls) {
      if (c.type !== "function") continue;
      let input: Record<string, unknown> = {};
      try {
        input = c.function.arguments ? (JSON.parse(c.function.arguments) as Record<string, unknown>) : {};
      } catch {
        /* leave empty on unparseable args */
      }
      out.push({ name: c.function.name, input });
    }
    return out;
  }

  async *narrate(system: string, userContent: string): AsyncGenerator<string, void, unknown> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 1024,
      stream: true,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
    });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  }
}
