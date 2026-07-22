/**
 * Public-demo AI quota. Live LLM calls cost real money, so on the public demo
 * each profile gets a small budget of "AI units" (default 10):
 *   capture/extract = 2 · bridge = 1 · quiz = 1 · answer grading = 1
 * Self-hosted / local runs (no VERCEL env) are unlimited.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export function isPublicDemo(): boolean {
  return Boolean(process.env.VERCEL) || process.env.PUBLIC_DEMO === "true";
}

export function quotaLimit(): number {
  const n = Number(process.env.DEMO_AI_QUOTA);
  return Number.isFinite(n) && n > 0 ? n : 10;
}

export type QuotaState = { used: number; limit: number; remaining: number } | null;

export function quotaState(aiUnits: number): QuotaState {
  if (!isPublicDemo()) return null; // unlimited
  const limit = quotaLimit();
  return { used: aiUnits, limit, remaining: Math.max(0, limit - aiUnits) };
}

/**
 * Try to spend `units` from a learner's budget. Returns the new state, or
 * ok=false when the budget would be exceeded (nothing is charged then).
 */
export async function chargeAi(
  learnerId: string,
  units: number,
): Promise<{ ok: boolean; quota: QuotaState }> {
  if (!isPublicDemo()) return { ok: true, quota: null };
  const learner = await prisma.learner.findUnique({ where: { id: learnerId } });
  if (!learner) return { ok: false, quota: quotaState(0) };
  const limit = quotaLimit();
  if (learner.aiUnits + units > limit) {
    return { ok: false, quota: quotaState(learner.aiUnits) };
  }
  const updated = await prisma.learner.update({
    where: { id: learnerId },
    data: { aiUnits: { increment: units } },
  });
  return { ok: true, quota: quotaState(updated.aiUnits) };
}

export function quotaExceededResponse(quota: QuotaState) {
  return NextResponse.json(
    {
      error:
        "Demo budget used up for this profile. Sign in with a different name to keep exploring — or clone the repo and run Bridge with your own key.",
      quota,
    },
    { status: 429 },
  );
}
