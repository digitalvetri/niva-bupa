import { GoogleGenerativeAI, FunctionCallingMode, type FunctionDeclaration } from "@google/generative-ai";
import type { LlmProvider, LlmTool, LlmToolCall, LlmTurn } from "./types";

// Google Gemini via @google/generative-ai. Gemini's function-declaration schema is close to JSON
// Schema but rejects `additionalProperties`, so we strip it recursively. Types (object/array/
// string/number/boolean) already match Gemini's SchemaType string values.
function toGeminiSchema(node: unknown): Record<string, unknown> {
  if (node == null || typeof node !== "object") return node as Record<string, unknown>;
  const src = node as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src)) {
    if (k === "additionalProperties") continue;
    if (k === "properties" && v && typeof v === "object") {
      const props: Record<string, unknown> = {};
      for (const [pk, pv] of Object.entries(v as Record<string, unknown>)) props[pk] = toGeminiSchema(pv);
      out[k] = props;
    } else if (k === "items") {
      out[k] = toGeminiSchema(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export class GeminiProvider implements LlmProvider {
  private genAI: GoogleGenerativeAI;
  constructor(private model: string, apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async route(system: string, messages: LlmTurn[], tools: LlmTool[]): Promise<LlmToolCall[]> {
    const functionDeclarations = tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: toGeminiSchema(t.parameters),
    })) as unknown as FunctionDeclaration[];
    const model = this.genAI.getGenerativeModel({
      model: this.model,
      systemInstruction: system,
      tools: [{ functionDeclarations }],
      toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.ANY } },
    });
    const result = await model.generateContent({
      contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    });
    const calls = result.response.functionCalls() ?? [];
    return calls.map((c) => ({ name: c.name, input: (c.args ?? {}) as Record<string, unknown> }));
  }

  async *narrate(system: string, userContent: string): AsyncGenerator<string, void, unknown> {
    const model = this.genAI.getGenerativeModel({ model: this.model, systemInstruction: system });
    const result = await model.generateContentStream({ contents: [{ role: "user", parts: [{ text: userContent }] }] });
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
  }
}
