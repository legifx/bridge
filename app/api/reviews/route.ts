import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentLearner } from "@/lib/db/learner";
import { eloToMastery } from "@/lib/extraction/repo";

export const runtime = "nodejs";

type CheckDetail = {
  freeCorrect?: boolean;
  freeFeedback?: string;
  mcqCorrect?: boolean;
  problems?: { correct: boolean; feedback: string | null }[];
};

/** The learning log: the learner's recent checks, newest first, with the
 *  breakdown of what was right/wrong for the detail view. */
export async function GET() {
  const learner = await getCurrentLearner();
  if (!learner) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const reviews = await prisma.review.findMany({
    where: { concept: { learnerId: learner.id } },
    orderBy: { answeredAt: "desc" },
    take: 40,
    include: { concept: { select: { id: true, label: true, elo: true, reviewEnabled: true } } },
  });

  const log = reviews.map((r) => {
    let detail: CheckDetail | null = null;
    if (r.detailJson) {
      try {
        detail = JSON.parse(r.detailJson) as CheckDetail;
      } catch {
        detail = null;
      }
    }
    return {
      id: r.id,
      conceptId: r.concept.id,
      label: r.concept.label,
      correct: r.correct,
      answeredAt: r.answeredAt.toISOString(),
      dueAt: r.nextDueAt.toISOString(),
      mastery: eloToMastery(r.concept.elo),
      reviewEnabled: r.concept.reviewEnabled,
      detail,
    };
  });

  return NextResponse.json({ log });
}
