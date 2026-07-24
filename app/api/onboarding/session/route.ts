import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { st } from "@/lib/i18n";
import { getCurrentLearner } from "@/lib/db/learner";
import { checkInterestText } from "@/lib/profile/guard";
import { EMBEDDINGS_ENABLED } from "@/lib/ml/embeddings";
import { startInterview, continueInterview } from "@/lib/onboarding/engine";
import { AnswerSchema } from "@/lib/onboarding/types";
import { apiError } from "@/lib/api/errors";

export const runtime = "nodejs";
// Serverless ceiling: interview turns, generated live.
// 60s is the ceiling every Vercel plan allows and 4x the platform default;
// raise it in vercel.json on plans that permit more.
export const maxDuration = 60;

const StartSchema = z.object({
  seeds: z.array(z.string().min(2).max(80)).min(1).max(8),
  // main language, chosen on the first onboarding screen (updatable later via /api/me)
  language: z.string().min(2).max(8).optional(),
});

const ContinueSchema = z.object({
  sessionId: z.string().min(1),
  answers: z.array(AnswerSchema).min(1).max(20),
});

const RemoveSchema = z.object({
  op: z.literal("removeDomain"),
  domainId: z.string().min(1),
});

/** Start a new adaptive interview from the learner's seed interests. */
export async function POST(req: Request) {
  const learner = await getCurrentLearner();
  if (!learner) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  if (!EMBEDDINGS_ENABLED) {
    return NextResponse.json(
      { error: st(learner.language, "err.embeddings") },
      { status: 503 },
    );
  }

  const parsed = StartSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Give at least one interest (2-80 characters each)." }, { status: 400 });
  }

  // Privacy guard on every seed (§7) — refuse sensitive input before it is stored.
  for (const seed of parsed.data.seeds) {
    const guard = checkInterestText(seed);
    if (!guard.ok) {
      return NextResponse.json({ error: guard.message, topic: guard.topic }, { status: 422 });
    }
  }

  // Onboarding is free — it's the one-time profile build, not a learning
  // aspect. The demo budget is spent per concept studied (see chargeConcept).
  let language = learner.language;
  if (parsed.data.language && parsed.data.language !== learner.language) {
    language = parsed.data.language;
    await prisma.learner.update({ where: { id: learner.id }, data: { language } });
  }

  try {
    const batch = await startInterview(learner.id, parsed.data.seeds, language);
    return NextResponse.json({ ...batch, quota: null });
  } catch (err) {
    return apiError("onboarding/session:start", err, language);
  }
}

/** Answer a batch of interview steps, or correct the mirrored profile. */
export async function PATCH(req: Request) {
  const learner = await getCurrentLearner();
  if (!learner) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => null);

  const remove = RemoveSchema.safeParse(body);
  if (remove.success) {
    const domain = await prisma.interestDomain.findFirst({
      where: { id: remove.data.domainId, learnerId: learner.id },
    });
    if (!domain) return NextResponse.json({ error: "Domain not found." }, { status: 404 });
    // The learner explicitly rejects this reading of their profile: remove the
    // domain and every second-brain item that was seeded from it.
    await prisma.brainItem.deleteMany({ where: { learnerId: learner.id, sourceRef: domain.id } });
    await prisma.interestDomain.delete({ where: { id: domain.id } });
    return NextResponse.json({ ok: true });
  }

  const parsed = ContinueSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid interview payload." }, { status: 400 });
  }

  try {
    const batch = await continueInterview(
      learner.id,
      parsed.data.sessionId,
      parsed.data.answers,
      learner.language,
    );
    return NextResponse.json(batch);
  } catch (err) {
    // A stale/finished session is the client's problem to handle (409), not an
    // upstream failure — keep that distinction, without echoing the raw text.
    const message = err instanceof Error ? err.message : "";
    const stale = /not found|finished/i.test(message);
    return apiError(
      "onboarding/session:answer",
      err,
      learner.language,
      stale ? 409 : undefined,
      stale ? "err.sessionStale" : undefined,
    );
  }
}
