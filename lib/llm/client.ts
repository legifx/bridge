/**
 * LLM access layer.
 *
 * One provider: OpenRouter (OpenAI-compatible). All calls return structured
 * JSON validated against a Zod schema — we never parse prose (§2).
 *
 * DEMO_MODE (or a missing key) short-circuits to cached responses so the full
 * flow works with no key and no API burn (§8).
 */
import OpenAI from "openai";
import type { ZodType } from "zod";
import { getDemoResponse } from "@/lib/demo/cache";

// Primary model (default: free, vision-capable). Free tiers are occasionally
// rate-limited upstream (429), so we fall back to a cheap paid model on failure.
const MODEL = process.env.OPENROUTER_MODEL || "google/gemma-4-31b-it:free";
const FALLBACK_MODEL = process.env.OPENROUTER_FALLBACK_MODEL || "google/gemini-3.1-flash-lite";

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true" || !process.env.OPENROUTER_API_KEY;
}

let clientSingleton: OpenAI | null = null;
function client(): OpenAI {
  if (!clientSingleton) {
    clientSingleton = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://github.com/bridge-app",
        "X-Title": "Bridge",
      },
    });
  }
  return clientSingleton;
}

export type ImageInput = { dataUrl: string };

export type LlmCall<T> = {
  /** Stable tag used to look up the cached demo response for this call. */
  demoKey: string;
  system: string;
  user: string;
  images?: ImageInput[];
  schema: ZodType<T>;
  /** Lower = more deterministic. Default 0.4. */
  temperature?: number;
};

function extractJson(text: string): unknown {
  // Models occasionally wrap JSON in prose or fences despite instructions.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in model output");
  return JSON.parse(candidate.slice(start, end + 1));
}

/**
 * Make one JSON call. In demo mode, returns the cached response for `demoKey`.
 * The returned value is always schema-validated.
 */
export async function llmJson<T>(call: LlmCall<T>): Promise<T> {
  if (isDemoMode()) {
    const cached = getDemoResponse(call.demoKey);
    return call.schema.parse(cached);
  }

  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: "text", text: call.user },
  ];
  for (const img of call.images ?? []) {
    content.push({ type: "image_url", image_url: { url: img.dataUrl } });
  }

  const complete = (model: string) =>
    client().chat.completions.create({
      model,
      temperature: call.temperature ?? 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: call.system },
        { role: "user", content },
      ],
    });

  let res;
  try {
    res = await complete(MODEL);
  } catch (err) {
    // On rate-limit / upstream failure, retry once with the paid fallback model.
    const status = (err as { status?: number })?.status;
    if (FALLBACK_MODEL && FALLBACK_MODEL !== MODEL && (status === 429 || (status ?? 500) >= 500)) {
      res = await complete(FALLBACK_MODEL);
    } else {
      throw err;
    }
  }

  const raw = res.choices[0]?.message?.content ?? "";
  return call.schema.parse(extractJson(raw));
}
