import { prisma } from "@/lib/db/prisma";

/**
 * Teacher view data (§5, §7). Aggregates ONLY: concept-level counts across the
 * whole cohort. No learner ids, no names, no interest profiles ever leave here.
 * "Bridge profiles material, not children."
 */
export type CohortConcept = {
  conceptLabel: string;
  attempts: number;
  correct: number;
  struggleRate: number; // 0..1, higher = harder for the cohort
  masteredCount: number; // distinct learners who reached mastery
};

const MASTERY_ELO = 1350;

export async function getCohortStruggles(): Promise<CohortConcept[]> {
  // Reviews carry the answer outcomes; group by the concept's label so two
  // learners studying "Ionic bond" roll up together, with no per-learner data.
  const reviews = await prisma.review.findMany({
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

  // Mastered counts: distinct concepts (per learner) above the mastery Elo.
  const mastered = await prisma.concept.groupBy({
    by: ["label"],
    where: { elo: { gte: MASTERY_ELO } },
    _count: { _all: true },
  });
  const masteredByLabel = new Map(mastered.map((m) => [m.label, m._count._all]));

  const rows: CohortConcept[] = [...byLabel.entries()].map(([conceptLabel, agg]) => ({
    conceptLabel,
    attempts: agg.attempts,
    correct: agg.correct,
    struggleRate: agg.attempts ? 1 - agg.correct / agg.attempts : 0,
    masteredCount: masteredByLabel.get(conceptLabel) ?? 0,
  }));

  // Hardest first.
  rows.sort((a, b) => b.struggleRate - a.struggleRate || b.attempts - a.attempts);
  return rows;
}
