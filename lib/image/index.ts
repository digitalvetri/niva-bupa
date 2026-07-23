// Image-generation provider layer for report backgrounds. Pluggable, key-per-tenant (paste in
// Settings). The image is DECORATIVE ONLY — accurate numbers are always rendered as HTML on top,
// so a model never sees or draws a figure. Every provider returns a base64 data URL so the poster
// can composite it same-origin (html-to-image would taint on a cross-origin <img>).

export type ImageProviderId = "pollinations" | "cloudflare" | "openai" | "stability" | "gemini";

export type ImageGenSettings = {
  provider?: string;
  apiKey?: string;
  accountId?: string; // Cloudflare account id (only provider that needs it)
  model?: string;
};

export type ImageProviderMeta = {
  id: ImageProviderId;
  label: string;
  needsKey: boolean;
  needsAccount: boolean;
  keyHint: string;
  defaultModel: string;
  free: boolean;
  note: string;
};

export const IMAGE_PROVIDERS: ImageProviderMeta[] = [
  { id: "pollinations", label: "Pollinations", needsKey: false, needsAccount: false, keyHint: "no key needed", defaultModel: "flux", free: true, note: "Free, no key — great for a quick start." },
  { id: "cloudflare", label: "Cloudflare Workers AI", needsKey: true, needsAccount: true, keyHint: "API token", defaultModel: "@cf/black-forest-labs/flux-1-schnell", free: true, note: "Generous free daily allowance. Needs account ID + API token." },
  { id: "gemini", label: "Google Gemini (Imagen)", needsKey: true, needsAccount: false, keyHint: "AI Studio API key", defaultModel: "imagen-3.0-generate-002", free: false, note: "Free AI Studio key; Imagen may require billing enabled." },
  { id: "openai", label: "OpenAI", needsKey: true, needsAccount: false, keyHint: "sk-…", defaultModel: "gpt-image-1", free: false, note: "Paid. gpt-image-1 / DALL·E." },
  { id: "stability", label: "Stability AI", needsKey: true, needsAccount: false, keyHint: "sk-…", defaultModel: "core", free: false, note: "Signup credits then paid." },
];

export function isImageProviderId(v: unknown): v is ImageProviderId {
  return typeof v === "string" && IMAGE_PROVIDERS.some((p) => p.id === v);
}

export function imageProviderMeta(id: string): ImageProviderMeta | undefined {
  return IMAGE_PROVIDERS.find((p) => p.id === id);
}

/** True when the stored config has everything the chosen provider needs to run. */
export function imageGenConfigured(s?: ImageGenSettings): boolean {
  if (!s?.provider || !isImageProviderId(s.provider)) return false;
  const meta = imageProviderMeta(s.provider)!;
  if (meta.needsKey && !s.apiKey) return false;
  if (meta.needsAccount && !s.accountId) return false;
  return true;
}

/** Brand-appropriate, TEXT-FREE prompt. No words/letters/numbers so the model can't garble data. */
export function backgroundPrompt(scopeLabel: string): string {
  return (
    `Wide abstract corporate banner background for a premium health-insurance performance report. ` +
    `Deep navy blue to royal blue gradient with subtle teal and soft gold accents, faint geometric ` +
    `line patterns, gentle glowing data-network and heartbeat-pulse motifs, elegant fintech aesthetic, ` +
    `clean and uncluttered with plenty of empty dark space. ` +
    `Absolutely no text, no words, no letters, no numbers, no charts, no logos.` +
    (scopeLabel ? ` Theme: ${scopeLabel} region.` : "")
  );
}

function toDataUrl(buf: ArrayBuffer, mime: string): string {
  return `data:${mime};base64,${Buffer.from(buf).toString("base64")}`;
}

async function failText(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  return `${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 300)}` : ""}`;
}

/**
 * Generate one decorative background for the given config. `seed` varies output on regeneration.
 * Returns a base64 data URL. Throws with a provider-named message on failure (surfaced to the UI).
 */
export async function generateBackground(config: ImageGenSettings, prompt: string, seed: number): Promise<string> {
  if (!isImageProviderId(config.provider ?? "")) throw new Error("No image provider configured");
  const provider = config.provider as ImageProviderId;
  const model = config.model?.trim() || imageProviderMeta(provider)!.defaultModel;

  switch (provider) {
    case "pollinations": {
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1280&height=360&nologo=true&model=${encodeURIComponent(model)}&seed=${seed}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Pollinations: ${await failText(res)}`);
      return toDataUrl(await res.arrayBuffer(), res.headers.get("content-type") || "image/jpeg");
    }

    case "cloudflare": {
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${model}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ prompt, seed }),
      });
      if (!res.ok) throw new Error(`Cloudflare Workers AI: ${await failText(res)}`);
      // flux-1-schnell returns JSON { result: { image: "<base64>" } }; SDXL returns raw image bytes.
      const ctype = res.headers.get("content-type") || "";
      if (ctype.includes("application/json")) {
        const j = (await res.json()) as { result?: { image?: string }; success?: boolean; errors?: unknown };
        const b64 = j.result?.image;
        if (!b64) throw new Error(`Cloudflare Workers AI: no image in response (${JSON.stringify(j.errors ?? j).slice(0, 200)})`);
        return `data:image/jpeg;base64,${b64}`;
      }
      return toDataUrl(await res.arrayBuffer(), ctype || "image/png");
    }

    case "openai": {
      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ model, prompt, n: 1, size: "1536x1024" }),
      });
      if (!res.ok) throw new Error(`OpenAI: ${await failText(res)}`);
      const j = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
      const b64 = j.data?.[0]?.b64_json;
      if (b64) return `data:image/png;base64,${b64}`;
      const remote = j.data?.[0]?.url;
      if (remote) {
        const img = await fetch(remote);
        return toDataUrl(await img.arrayBuffer(), img.headers.get("content-type") || "image/png");
      }
      throw new Error("OpenAI: no image in response");
    }

    case "stability": {
      const form = new FormData();
      form.set("prompt", prompt);
      form.set("aspect_ratio", "21:9");
      form.set("output_format", "jpeg");
      form.set("seed", String(seed % 4294967294));
      const res = await fetch(`https://api.stability.ai/v2beta/stable-image/generate/${model}`, {
        method: "POST",
        headers: { authorization: `Bearer ${config.apiKey}`, accept: "application/json" },
        body: form,
      });
      if (!res.ok) throw new Error(`Stability AI: ${await failText(res)}`);
      const j = (await res.json()) as { image?: string };
      if (!j.image) throw new Error("Stability AI: no image in response");
      return `data:image/jpeg;base64,${j.image}`;
    }

    case "gemini": {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${config.apiKey}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1, aspectRatio: "16:9" } }),
      });
      if (!res.ok) throw new Error(`Gemini (Imagen): ${await failText(res)}`);
      const j = (await res.json()) as { predictions?: { bytesBase64Encoded?: string; mimeType?: string }[] };
      const p = j.predictions?.[0];
      if (!p?.bytesBase64Encoded) throw new Error("Gemini (Imagen): no image in response");
      return `data:${p.mimeType || "image/png"};base64,${p.bytesBase64Encoded}`;
    }
  }
}
