import { prisma } from "@/lib/db/prisma";
import { updateElo, difficultyToElo } from "./elo";
import { scheduleReview, qualityFromAnswer, INITIAL_SRS, type SrsState } from "./sm2";

/** Reconstruct SM-2 repetitions from the stored interval (we don't store it separately). */
function repetitionsFromInterval(interval: number): number {
  if (interval <= 0) return 0;
  if (interval === 1) return 1;
  if (interval === 6) return 2;
  return 3;
}

/**
 * Record one quiz answer: update the concept's Elo mastery and schedule the next
 * review with SM-2-lite. Returns the new mastery Elo and days until next review.
 */
export async function recordAnswer(params: {
  conceptId: string;
  correct: boolean;
  confident: boolean;
}): Promise<{ elo: number; nextIntervalDays: number }> {
  const concept = await prisma.concept.findUniqueOrThrow({ where: { id: params.conceptId } });

  // Elo: learner ability (concept.elo) vs the concept's difficulty rating.
  const difficultyElo = difficultyToElo(concept.difficulty);
  const { ability } = updateElo(concept.elo, difficultyElo, params.correct);

  // SM-2: advance from the last review's state.
  const last = await prisma.review.findFirst({
    where: { conceptId: params.conceptId },
    orderBy: { answeredAt: "desc" },
  });
  const prior: SrsState = last
    ? { easeFactor: last.easeFactor, interval: last.interval, repetitions: repetitionsFromInterval(last.interval) }
    : INITIAL_SRS;
  const quality = qualityFromAnswer(params.correct, params.confident);
  const next = scheduleReview(prior, quality);

  const nextDueAt = new Date(Date.now() + next.nextIntervalDays * 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.concept.update({ where: { id: concept.id }, data: { elo: ability } }),
    prisma.review.create({
      data: {
        conceptId: concept.id,
        correct: params.correct,
        easeFactor: next.easeFactor,
        interval: next.interval,
        nextDueAt,
      },
    }),
  ]);

  return { elo: ability, nextIntervalDays: next.nextIntervalDays };
}
