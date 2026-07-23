import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentLearner } from "@/lib/db/learner";
import { generateQuiz } from "@/lib/quiz";
import { chargeAi, quotaExceededResponse } from "@/lib/quota";

export const runtime = "nodejs";

const BodySchema = z.object({ conceptId: z.string().min(1) });

export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "conceptId required." }, { status: 400 });

  const learner = await getCurrentLearner();
  if (!learner) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const concept = await prisma.concept.findFirst({
    where: { id: parsed.data.conceptId, learnerId: learner.id },
  });
  if (!concept) return NextResponse.json({ error: "Concept not found." }, { status: 404 });

  const charge = await chargeAi(learner.id, 1);
  if (!charge.ok) return quotaExceededResponse(charge.quota, learner.language);

  const quiz = await generateQuiz(concept, learner.language);
  return NextResponse.json({ quiz, quota: charge.quota });
}
