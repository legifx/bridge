import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentLearner } from "@/lib/db/learner";

export const runtime = "nodejs";

const BodySchema = z.object({ conceptId: z.string().min(1), enabled: z.boolean() });

/** Opt a concept in or out of spaced repetition (SM-2 scheduling). */
export async function POST(req: Request) {
  const learner = await getCurrentLearner();
  if (!learner) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "conceptId and enabled required." }, { status: 400 });

  const concept = await prisma.concept.findFirst({
    where: { id: parsed.data.conceptId, learnerId: learner.id },
  });
  if (!concept) return NextResponse.json({ error: "Concept not found." }, { status: 404 });

  await prisma.concept.update({
    where: { id: concept.id },
    data: { reviewEnabled: parsed.data.enabled },
  });
  return NextResponse.json({ ok: true, reviewEnabled: parsed.data.enabled });
}
