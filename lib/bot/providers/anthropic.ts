import Anthropic from "@anthropic-ai/sdk";
import type { LlmProvider, LlmTool, LlmToolCall, LlmTurn } from "./types";

// Claude via the Anthropic SDK. apiKey optional — when omitted the SDK resolves
// ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / an `ant auth login` profile from the environment.
export class AnthropicProvider implements LlmProvider {
  private client: Anthropic;
  constructor(private model: string, apiKey?: string) {
    this.client = apiKey ? new Anthropic({ apiKey }) : new Anthropic();
  }

  async route(system: string, messages: LlmTurn[], tools: LlmTool[]): Promise<LlmToolCall[]> {
    const resp = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system,
      tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters as never })),
      tool_choice: { type: "any" },
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });
    return resp.content
      .filter((b): b is Extract<typeof b, { type: "tool_use" }> => b.type === "tool_use")
      .map((b) => ({ name: b.name, input: (b.input ?? {}) as Record<string, unknown> }));
  }

  async *narrate(system: string, userContent: string): AsyncGenerator<string, void, unknown> {
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: userContent }],
    });
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield event.delta.text;
    }
  }
}
