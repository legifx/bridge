import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentLearner } from "@/lib/db/learner";
import { gradeFreeRecall } from "@/lib/quiz";
import { recordAnswer } from "@/lib/adaptive/review";
import { eloToMastery } from "@/lib/extraction/repo";
import { chargeAi, quotaExceededResponse } from "@/lib/quota";

export const runtime = "nodejs";

const BodySchema = z.object({
  conceptId: z.string().min(1),
  freeAnswer: z.string().max(1000),
  mcqCorrect: z.boolean(),
});

export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid answer payload." }, { status: 400 });

  const learner = await getCurrentLearner();
  if (!learner) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const concept = await prisma.concept.findFirst({
    where: { id: parsed.data.conceptId, learnerId: learner.id },
  });
  if (!concept) return NextResponse.json({ error: "Concept not found." }, { status: 404 });

  const charge = await chargeAi(learner.id, 1);
  if (!charge.ok) return quotaExceededResponse(charge.quota, learner.language);

  const grade = await gradeFreeRecall(concept, parsed.data.freeAnswer, learner.language);
  const correct = grade.correct && parsed.data.mcqCorrect;

  const { elo, nextIntervalDays } = await recordAnswer({
    conceptId: concept.id,
    correct,
    confident: grade.confident && parsed.data.mcqCorrect,
  });

  // Once a concept has actually been recalled, it belongs in the spaced-
  // repetition rotation by default — otherwise the whole review flow only works
  // if the learner remembers to flip a toggle. They can still opt out on the
  // check screen (reviewEnabled=false), which we then respect.
  let reviewEnabled = concept.reviewEnabled;
  if (!reviewEnabled) {
    await prisma.concept.update({ where: { id: concept.id }, data: { reviewEnabled: true } });
    reviewEnabled = true;
  }

  return NextResponse.json({ grade, correct, mastery: eloToMastery(elo), nextIntervalDays, reviewEnabled });
}
