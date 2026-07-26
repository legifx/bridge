/**
 * One place that records that something went wrong.
 *
 * Until now the whole app's operational visibility was six scattered
 * `console.error` calls with free-text messages. A production 500 was noticed
 * because a person went looking — which is exactly how a live outage went
 * unnoticed on 2026-07-26.
 *
 * This does two things and deliberately no more:
 *  - emits ONE structured JSON line per event, so a log drain can filter and
 *    alert on `level` and `where` instead of grepping prose;
 *  - forwards to an optional webhook (ERROR_WEBHOOK_URL) so an alert can reach
 *    a human without adding a vendor SDK to the bundle.
 *
 * It never throws and never blocks the response: a broken reporter must not
 * turn a handled error into an unhandled one.
 */

export type Level = "error" | "warn" | "info";

export type ReportFields = {
  /** Route or subsystem tag, e.g. "api/bridge" — the field you alert on. */
  where: string;
  /** Short, stable description. Not the raw exception text. */
  message: string;
  /** Anything structured worth keeping. Values are redacted before emit. */
  context?: Record<string, unknown>;
  error?: unknown;
};

/** Keys whose values must never reach a log line or a webhook. */
const SECRET_KEY = /(secret|token|password|authorization|cookie|apikey|api_key|dsn)/i;
/** Values that look like credentials even under an innocent key. */
const SECRET_VALUE = /\b(sk-[A-Za-z0-9_-]{8,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+)/;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[deep]";
  if (typeof value === "string") return SECRET_VALUE.test(value) ? "[redacted]" : value.slice(0, 500);
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SECRET_KEY.test(k) ? "[redacted]" : redact(v, depth + 1);
  }
  return out;
}

/** The parts of a thrown value worth keeping, without the free-text sprawl. */
function describe(err: unknown): Record<string, unknown> | undefined {
  if (err === undefined || err === null) return undefined;
  if (err instanceof Error) {
    const withStatus = err as Error & { status?: number; code?: string };
    return {
      name: err.name,
      message: String(err.message).slice(0, 500),
      status: withStatus.status,
      code: withStatus.code,
      // First frames only: enough to locate, short enough to log on every hit.
      stack: err.stack?.split("\n").slice(1, 4).map((l) => l.trim()),
    };
  }
  return { value: String(err).slice(0, 300) };
}

let webhookFailed = false;

function forward(payload: Record<string, unknown>): void {
  const url = process.env.ERROR_WEBHOOK_URL;
  // One failure disables forwarding for the process: a webhook that is down
  // must not add a failing request to every failing request.
  if (!url || webhookFailed || payload.level !== "error") return;
  void fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {
    webhookFailed = true;
  });
}

/** Record an event. Safe to call from anywhere; never throws. */
export function report(level: Level, fields: ReportFields): void {
  try {
    const payload: Record<string, unknown> = {
      level,
      where: fields.where,
      message: fields.message,
      app: "bridge",
      env: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
      release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
      at: new Date().toISOString(),
    };
    const ctx = fields.context ? redact(fields.context) : undefined;
    if (ctx && Object.keys(ctx as object).length) payload.context = ctx;
    const err = describe(fields.error);
    if (err) payload.error = redact(err);

    const line = JSON.stringify(payload);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);

    forward(payload);
  } catch {
    // Reporting is best-effort by definition.
  }
}

export const reportError = (where: string, message: string, error?: unknown, context?: Record<string, unknown>) =>
  report("error", { where, message, error, context });

export const reportWarn = (where: string, message: string, context?: Record<string, unknown>) =>
  report("warn", { where, message, context });
