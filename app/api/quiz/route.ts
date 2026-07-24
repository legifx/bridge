import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentLearner } from "@/lib/db/learner";
import { generateQuiz } from "@/lib/quiz";
import { chargeConcept, quotaExceededResponse } from "@/lib/quota";
import { st } from "@/lib/i18n";
import { readJson, tooLargeResponse, BodyTooLargeError } from "@/lib/api/body";

export const runtime = "nodejs";
// Serverless ceiling: one generation call, plus a fallback-model retry.
// 60s is the ceiling every Vercel plan allows and 4x the platform default;
// raise it in vercel.json on plans that permit more.
export const maxDuration = 60;

const BodySchema = z.object({ conceptId: z.string().min(1), tasks: z.boolean().optional() });

export async function POST(req: Request) {
  let raw: unknown = null;
  try {
    raw = await readJson(req);
  } catch (err) {
    if (err instanceof BodyTooLargeError) return tooLargeResponse();
    // malformed JSON — the schema below turns it into the usual 400
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "conceptId required." }, { status: 400 });

  const learner = await getCurrentLearner();
  if (!learner) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const concept = await prisma.concept.findFirst({
    where: { id: parsed.data.conceptId, learnerId: learner.id },
  });
  if (!concept) return NextResponse.json({ error: "Concept not found." }, { status: 404 });

  const charge = await chargeConcept(learner.id, concept.id);
  if (!charge.ok) return quotaExceededResponse(charge.quota, learner.language);

  try {
    const quiz = await generateQuiz(concept, learner.language, { tasks: parsed.data.tasks });
    return NextResponse.json({ quiz, quota: charge.quota });
  } catch (err) {
    // The model occasionally returns unparseable output even after the fallback
    // retry — surface a readable error instead of an empty 500 the client can't
    // show. The learner can simply try again.
    console.error("quiz: generation failed", err);
    return NextResponse.json({ error: st(learner.language, "check.couldNotLoad") }, { status: 502 });
  }
}
