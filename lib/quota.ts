/**
 * Public-demo AI quota. Live LLM calls cost real money, so on the public demo
 * each profile gets a small budget of "AI units" (default 10):
 *   capture/extract = 2 · bridge = 1 · quiz = 1 · answer grading = 1
 * Self-hosted / local runs (no VERCEL env) are unlimited.
 */
import { NextResponse } from "next/server";
import { st } from "@/lib/i18n";
import { prisma } from "@/lib/db/prisma";

export function isPublicDemo(): boolean {
  return Boolean(process.env.VERCEL) || process.env.PUBLIC_DEMO === "true";
}

export function quotaLimit(): number {
  const n = Number(process.env.DEMO_AI_QUOTA);
  // Quota is now counted per LEARNING ASPECT (concept), not per request — so a
  // small budget goes a long way. Default 5 aspects.
  return Number.isFinite(n) && n > 0 ? n : 5;
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
  // Owner accounts (unlocked via OWNER_UNLOCK_CODE) bypass the demo budget.
  if (learner.unlimited) return { ok: true, quota: null };
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

/**
 * Charge for LEARNING one aspect (concept). The first billable request for a
 * concept spends exactly one unit and marks the concept paid; every further
 * request for that same concept (bridge re-roll, widgets, quiz, answer, relearn,
 * tasks) is then free — so a learner can never get stranded mid-aspect. Owner
 * accounts and self-hosted runs are unlimited.
 */
export async function chargeConcept(
  learnerId: string,
  conceptId: string,
): Promise<{ ok: boolean; quota: QuotaState }> {
  if (!isPublicDemo()) return { ok: true, quota: null };
  const [learner, concept] = await Promise.all([
    prisma.learner.findUnique({ where: { id: learnerId } }),
    prisma.concept.findUnique({ where: { id: conceptId } }),
  ]);
  if (!learner || !concept) return { ok: false, quota: quotaState(0) };
  if (learner.unlimited) return { ok: true, quota: null };
  // Already paid for this aspect → all further work on it is free.
  if (concept.charged) return { ok: true, quota: quotaState(learner.aiUnits) };
  const limit = quotaLimit();
  if (learner.aiUnits + 1 > limit) return { ok: false, quota: quotaState(learner.aiUnits) };
  const [updated] = await prisma.$transaction([
    prisma.learner.update({ where: { id: learnerId }, data: { aiUnits: { increment: 1 } } }),
    prisma.concept.update({ where: { id: conceptId }, data: { charged: true } }),
  ]);
  return { ok: true, quota: quotaState(updated.aiUnits) };
}

export function quotaExceededResponse(quota: QuotaState, language?: string) {
  return NextResponse.json({ error: st(language, "err.quota"), quota }, { status: 429 });
}
