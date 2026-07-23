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

// Per-task model routing — each task runs on the model that is best-in-class
// for it AND cheap, instead of one expensive generalist (measured 2026-07-23
// against the live OpenRouter catalogue, real German + JSON + OCR test calls):
//
//   MODEL   — all learner-facing text (interview, bridges, quiz, grading).
//     Gemini 2.5 Flash Lite: chosen for LATENCY. Qwen3.5 Flash scored a touch
//     higher on hard languages but runs ~20s per call over OpenRouter, which
//     made the multi-step onboarding interview take ~3 min. Gemini answers in
//     ~1.5s (10x faster) with no real grammar errors (neutral judge: 8/10
//     across Ukrainian/Turkish/Arabic vs Qwen's 7-9) — the right trade for
//     screens the learner waits on live. Same cheap price tier.
//   CAPTURE_MODEL — document understanding (vision OCR + full transcription).
//     Qwen3-VL 32B: the document/OCR master class (read "ü"/"→" correctly where
//     others didn't) and, thanks to lean output, ~75x cheaper per capture than
//     gemini-3.5-flash on the same page.
//   FALLBACK_MODEL — retry target on 429/5xx. gemini-3.1-flash-lite: reliable,
//     multimodal, fast — a distinct model from the primary so a provider blip
//     on one has a real alternative.
//
// Free-tier models are opt-in via env only (rate limits + broken German).
const MODEL = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash-lite";
const FALLBACK_MODEL = process.env.OPENROUTER_FALLBACK_MODEL || "google/gemini-3.1-flash-lite";
export const CAPTURE_MODEL = process.env.OPENROUTER_CAPTURE_MODEL || "qwen/qwen3-vl-32b-instruct";

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

  // One attempt = complete + extract + schema-validate. Fast models occasionally
  // emit malformed JSON on complex nested schemas, so a parse/validation failure
  // is retried on the fallback model too — not only network 429/5xx. This is what
  // keeps the onboarding magnets from silently degrading to the English fixture.
  const attempt = async (model: string): Promise<T> => {
    const res = await complete(model);
    const raw = res.choices[0]?.message?.content ?? "";
    return call.schema.parse(extractJson(raw));
  };

  const primary = call.model ?? MODEL;
  try {
    return await attempt(primary);
  } catch (err) {
    if (!FALLBACK_MODEL || FALLBACK_MODEL === primary) throw err;
    // Retry on rate-limit/upstream errors AND on malformed-JSON / schema errors.
    const status = (err as { status?: number })?.status;
    const retriable = status === 429 || (status ?? 500) >= 500 || status === undefined;
    if (!retriable) throw err;
    return await attempt(FALLBACK_MODEL);
  }
}
