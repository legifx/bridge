import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentLearner } from "@/lib/db/learner";

export const runtime = "nodejs";

/**
 * Everything this app knows about the signed-in learner, as one JSON file.
 *
 * The counterpart to deletion: leaving should not mean losing the material and
 * the profile you built. Embeddings are omitted — they are derived numbers,
 * they would dwarf the readable content, and the text they were computed from
 * is right here.
 */
export async function GET() {
  const learner = await getCurrentLearner();
  if (!learner) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const [domains, sources, concepts, brainItems, interviews] = await Promise.all([
    prisma.interestDomain.findMany({
      where: { learnerId: learner.id },
      select: { name: true, anchors: true, depth: true, confidence: true, alpha: true, beta: true },
    }),
    prisma.source.findMany({
      where: { learnerId: learner.id },
      select: { id: true, title: true, subject: true, kind: true, rawText: true, createdAt: true },
    }),
    prisma.concept.findMany({
      where: { learnerId: learner.id },
      select: {
        id: true,
        label: true,
        definition: true,
        sourceQuote: true,
        difficulty: true,
        elo: true,
        reviewEnabled: true,
        sourceId: true,
        bridges: {
          select: { body: true, status: true, attempt: true, verdictJson: true, createdAt: true },
        },
        reviews: { select: { correct: true, answeredAt: true, nextDueAt: true, detailJson: true } },
      },
    }),
    prisma.brainItem.findMany({
      where: { learnerId: learner.id },
      select: { kind: true, label: true, text: true, weight: true, createdAt: true },
    }),
    prisma.onboardingSession.findMany({
      where: { learnerId: learner.id },
      select: { phase: true, status: true, log: true, createdAt: true },
    }),
  ]);

  const body = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      note: "Your Bridge data. Embeddings (derived vectors) are omitted; the text they came from is included.",
      profile: {
        displayName: learner.displayName,
        handle: learner.handle,
        language: learner.language,
        gradeSystem: learner.gradeSystem,
        readingLevel: learner.readingLevel,
        createdAt: learner.createdAt,
      },
      interests: domains,
      captures: sources,
      concepts,
      secondBrain: brainItems,
      onboarding: interviews,
    },
    null,
    2,
  );

  return new NextResponse(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="bridge-data-${learner.handle ?? "profile"}.json"`,
      // Never cached anywhere: this is the learner's whole record.
      "cache-control": "no-store",
    },
  });
}
