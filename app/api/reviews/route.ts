import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentLearner } from "@/lib/db/learner";
import { eloToMastery } from "@/lib/extraction/repo";

export const runtime = "nodejs";

type CheckDetail = {
  /** fraction of the check's points earned, 0..1 */
  score?: number;
  earned?: number;
  total?: number;
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
      // The grade of THIS check (what the learner actually scored that day) —
      // the log used to show only long-term mastery, which is a different number
      // and made a good check look like a bad one. Older rows have no breakdown.
      score: typeof detail?.score === "number" ? detail.score : null,
      earned: typeof detail?.earned === "number" ? detail.earned : null,
      total: typeof detail?.total === "number" ? detail.total : null,
      mastery: eloToMastery(r.concept.elo),
      reviewEnabled: r.concept.reviewEnabled,
      detail,
    };
  });

  return NextResponse.json({ log });
}
