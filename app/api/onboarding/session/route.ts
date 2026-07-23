import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { st } from "@/lib/i18n";
import { getCurrentLearner } from "@/lib/db/learner";
import { checkInterestText } from "@/lib/profile/guard";
import { EMBEDDINGS_ENABLED } from "@/lib/ml/embeddings";
import { startInterview, continueInterview } from "@/lib/onboarding/engine";
import { AnswerSchema } from "@/lib/onboarding/types";
import { chargeAi, quotaExceededResponse } from "@/lib/quota";

export const runtime = "nodejs";

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

  // The whole interview costs a flat 3 AI units (plan + magnets/audit + synthesis).
  const charge = await chargeAi(learner.id, 3);
  if (!charge.ok) return quotaExceededResponse(charge.quota, learner.language);

  let language = learner.language;
  if (parsed.data.language && parsed.data.language !== learner.language) {
    language = parsed.data.language;
    await prisma.learner.update({ where: { id: learner.id }, data: { language } });
  }

  try {
    const batch = await startInterview(learner.id, parsed.data.seeds, language);
    return NextResponse.json({ ...batch, quota: charge.quota });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not start the interview.";
    return NextResponse.json({ error: message }, { status: 500 });
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
    const message = err instanceof Error ? err.message : "Interview step failed.";
    const status = /not found|finished/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
