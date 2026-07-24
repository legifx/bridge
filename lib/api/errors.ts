/**
 * One place that turns a thrown error into an HTTP response.
 *
 * Raw exception text must not reach the browser: it carries upstream URLs,
 * provider payloads and setup hints like "OPENROUTER_API_KEY is not set" —
 * useful in a server log, not on a learner's screen (and not in a public demo's
 * network tab). The learner gets a localized sentence that says what to do
 * next; the details stay in the log, and in development they are echoed back so
 * self-hosting stays debuggable.
 */
import { NextResponse } from "next/server";
import { st } from "@/lib/i18n";
import type { MsgKey } from "@/lib/i18n";

type Statused = { status?: number; name?: string };

/** Which localized message fits this failure? */
export function messageKeyFor(err: unknown): MsgKey {
  const e = (err ?? {}) as Statused;
  if (e.status === 429) return "err.aiBusy";
  if (e.name === "APIConnectionTimeoutError" || e.name === "AbortError") return "err.aiSlow";
  return "err.aiFailed";
}

/**
 * Log `err` with a route tag and answer with a safe, localized message.
 * `status` defaults to 502 for upstream problems (it is not the client's fault)
 * and 429 when the provider rate-limited us.
 */
export function apiError(
  where: string,
  err: unknown,
  language?: string | null,
  status?: number,
  /** Override the message when the caller knows better than the heuristic. */
  messageKey?: MsgKey,
): NextResponse {
  console.error(`${where}:`, err);
  const key = messageKey ?? messageKeyFor(err);
  const body: { error: string; detail?: string } = { error: st(language, key) };
  if (process.env.NODE_ENV !== "production" && err instanceof Error) body.detail = err.message;
  return NextResponse.json(body, { status: status ?? (key === "err.aiBusy" ? 429 : 502) });
}
