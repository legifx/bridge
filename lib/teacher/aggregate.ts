import { prisma } from "@/lib/db/prisma";

/**
 * Teacher view data (§5, §7). Aggregates ONLY: concept-level counts. No learner
 * ids, no names, no interest profiles ever leave here.
 * "Bridge profiles material, not children."
 *
 * The scope is the part that was missing. This used to read every Review row in
 * the database and roll them up as "the cohort" — which made one school's
 * numbers visible to another, and with few learners made an "aggregate" of one.
 * It now takes a class and never leaves it.
 *
 * A class with very few answers is also a privacy problem in aggregate form: at
 * n=1 the "cohort struggle rate" IS that child's result. Rows below
 * MIN_COHORT_ANSWERS are withheld rather than shown.
 */
export type CohortConcept = {
  conceptLabel: string;
  attempts: number;
  correct: number;
  struggleRate: number; // 0..1, higher = harder for the cohort
  masteredCount: number; // distinct learners who reached mastery
};

const MASTERY_ELO = 1350;
/** Below this many answers a row describes an individual, not a cohort. */
export const MIN_COHORT_ANSWERS = 3;

export type CohortResult = {
  concepts: CohortConcept[];
  /** Rows withheld because the class is too small to anonymize them. */
  withheld: number;
  learners: number;
};

export async function getCohortStruggles(classId: string): Promise<CohortResult> {
  const members = await prisma.learner.findMany({
    where: { classId },
    select: { id: true },
  });
  const memberIds = members.map((m) => m.id);
  if (memberIds.length === 0) return { concepts: [], withheld: 0, learners: 0 };

  const reviews = await prisma.review.findMany({
    where: { concept: { learnerId: { in: memberIds } } },
    select: { correct: true, concept: { select: { label: true } } },
  });

  const byLabel = new Map<string, { attempts: number; correct: number }>();
  for (const r of reviews) {
    const key = r.concept.label;
    const agg = byLabel.get(key) ?? { attempts: 0, correct: 0 };
    agg.attempts += 1;
    if (r.correct) agg.correct += 1;
    byLabel.set(key, agg);
  }

  const mastered = await prisma.concept.groupBy({
    by: ["label"],
    where: { elo: { gte: MASTERY_ELO }, learnerId: { in: memberIds } },
    _count: { _all: true },
  });
  const masteredByLabel = new Map(mastered.map((m) => [m.label, m._count._all]));

  const all: CohortConcept[] = [...byLabel.entries()].map(([conceptLabel, agg]) => ({
    conceptLabel,
    attempts: agg.attempts,
    correct: agg.correct,
    struggleRate: agg.attempts ? 1 - agg.correct / agg.attempts : 0,
    masteredCount: masteredByLabel.get(conceptLabel) ?? 0,
  }));

  const concepts = all.filter((c) => c.attempts >= MIN_COHORT_ANSWERS);
  // Hardest first.
  concepts.sort((a, b) => b.struggleRate - a.struggleRate || b.attempts - a.attempts);

  return { concepts, withheld: all.length - concepts.length, learners: memberIds.length };
}
