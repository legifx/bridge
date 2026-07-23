/**
 * LLM access layer.
 *
 * One provider: OpenRouter (OpenAI-compatible). All calls return structured
 * JSON validated against a Zod schema — we never parse prose (§2). Calls are
 * always live; there is no mock layer. The public demo protects the API budget
 * with a small per-profile quota instead (lib/quota.ts).
 */
import OpenAI from "openai";
import type { ZodType } from "zod";
import { languageName } from "@/lib/i18n";

// Primary model: cheap paid, vision-capable, reliable multilingual output.
// Free-tier models proved unreliable here (rate limits + broken German), so
// they are opt-in via env only. On failure we retry with a stronger model.
const MODEL = process.env.OPENROUTER_MODEL || "google/gemini-3.1-flash-lite";
const FALLBACK_MODEL = process.env.OPENROUTER_FALLBACK_MODEL || "google/gemini-3.5-flash";

// Capture (document understanding) uses a stronger model than chat-sized
// calls: reading a full notebook page / PDF faithfully is the one step where
// accuracy is worth paying for.
export const CAPTURE_MODEL = process.env.OPENROUTER_CAPTURE_MODEL || "google/gemini-3.5-flash";

let clientSingleton: OpenAI | null = null;
function client(): OpenAI {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to .env (see .env.example) to enable live AI.",
    );
  }
  if (!clientSingleton) {
    clientSingleton = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://github.com/legifx/bridge",
        "X-Title": "Bridge",
      },
    });
  }
  return clientSingleton;
}

export type ImageInput = { dataUrl: string };

export type LlmCall<T> = {
  system: string;
  user: string;
  images?: ImageInput[];
  schema: ZodType<T>;
  /** Lower = more deterministic. Default 0.4. */
  temperature?: number;
  /** Learner's main language (BCP-47-ish, e.g. "de"). Learner-facing strings are written in it. */
  language?: string;
  /** Override the primary model for this call (e.g. CAPTURE_MODEL). */
  model?: string;
};

function withLanguage(system: string, language?: string): string {
  const name = languageName(language);
  if (!name) return system;
  return `${system}\n\nLANGUAGE: The learner's main language is ${name} (${language}). Write every learner-facing string value (questions, explanations, titles, feedback) in ${name}, with flawless spelling and grammar — proofread each string before emitting it. Never mix in English words unless the English term is the established technical term with no common ${name} equivalent. Keep JSON keys, ids, and enum values exactly as specified, in English. Keep verbatim source quotes in the source's original language.`;
}

function extractJson(text: string): unknown {
  // Models occasionally wrap JSON in prose or fences despite instructions.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in model output");
  return JSON.parse(candidate.slice(start, end + 1));
}

/** Make one live JSON call. The returned value is always schema-validated. */
export async function llmJson<T>(call: LlmCall<T>): Promise<T> {
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
        { role: "system", content: withLanguage(call.system, call.language) },
        { role: "user", content },
      ],
    });

  const primary = call.model ?? MODEL;
  let res;
  try {
    res = await complete(primary);
  } catch (err) {
    // On rate-limit / upstream failure, retry once with the paid fallback model.
    const status = (err as { status?: number })?.status;
    if (FALLBACK_MODEL && FALLBACK_MODEL !== primary && (status === 429 || (status ?? 500) >= 500)) {
      res = await complete(FALLBACK_MODEL);
    } else {
      throw err;
    }
  }

  const raw = res.choices[0]?.message?.content ?? "";
  return call.schema.parse(extractJson(raw));
}
