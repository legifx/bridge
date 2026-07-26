import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { EMBEDDINGS_ENABLED } from "@/lib/ml/embeddings";
import { SESSIONS_SIGNED } from "@/lib/auth/session";
import { reportError } from "@/lib/observability/report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness + readiness in one call, for an uptime monitor.
 *
 * There was no way to ask this app whether it was working. On 2026-07-26 a
 * deploy went out that returned 500 on every concept read, and the deployment
 * itself reported READY the whole time — because "the build succeeded" and "the
 * app works" are different questions and only the first one was being asked.
 *
 * So the checks here are the ones that actually broke, or can:
 *  - the database answers a real query (not just "the URL is set")
 *  - the schema has the columns this build expects — the exact failure above
 *  - the pieces whose absence silently degrades behaviour rather than crashing
 *    (unsigned sessions, disabled embeddings, missing AI key)
 *
 * Deliberately unauthenticated and deliberately boolean: an uptime monitor
 * cannot log in, so nothing here may reveal a value, a count or a name.
 */
type Check = { ok: boolean; detail?: string };

const CHECK_TIMEOUT_MS = 5_000;

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

async function checkDatabase(): Promise<Check> {
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, CHECK_TIMEOUT_MS);
    return { ok: true };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.name : "unreachable" };
  }
}

/**
 * Does the live schema carry the columns this build reads? Selecting them is
 * the only honest test — Prisma emits every column of the model, so a missing
 * one fails here exactly as it fails in a real request.
 */
async function checkSchema(): Promise<Check> {
  try {
    await withTimeout(
      prisma.concept.findFirst({ select: { id: true, misconceptions: true } }),
      CHECK_TIMEOUT_MS,
    );
    await withTimeout(prisma.learner.findFirst({ select: { id: true, role: true } }), CHECK_TIMEOUT_MS);
    return { ok: true };
  } catch (err) {
    // "no such column" belongs in the log too: it means a migration is missing
    // on this host, which nobody finds out about until a learner hits it.
    reportError("api/health", "schema check failed", err);
    return { ok: false, detail: "missing column — a migration has not reached this database" };
  }
}

export async function GET() {
  const [database, schema] = await Promise.all([checkDatabase(), checkSchema()]);

  const checks: Record<string, Check> = {
    database,
    schema,
    aiConfigured: { ok: Boolean(process.env.OPENROUTER_API_KEY) },
    sessionsSigned: {
      ok: SESSIONS_SIGNED,
      detail: SESSIONS_SIGNED ? undefined : "AUTH_SECRET unset — cookies are forgeable",
    },
    embeddings: {
      ok: EMBEDDINGS_ENABLED,
      detail: EMBEDDINGS_ENABLED ? undefined : "disabled — onboarding and matching are off",
    },
  };

  // Only the two data checks decide up/down. The rest are configuration facts a
  // monitor should surface without paging someone at 3am.
  const healthy = database.ok && schema.ok;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      env: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
      checks,
      at: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
