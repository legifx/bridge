import { prisma } from "@/lib/db/prisma";
import { updateEloScore, difficultyToElo } from "./elo";
import { scheduleReview, INITIAL_SRS, type SrsState } from "./sm2";

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
  /** Fraction of the check's points earned, 0..1 — drives mastery + scheduling. */
  score: number;
  /** JSON snapshot of the check breakdown, for the review log detail view. */
  detail?: unknown;
}): Promise<{ elo: number; nextIntervalDays: number }> {
  const concept = await prisma.concept.findUniqueOrThrow({ where: { id: params.conceptId } });
  const score = Math.max(0, Math.min(1, params.score));
  const correct = score >= 0.6; // a pass, for the review log's boolean + SRS lapse

  // Elo: mastery moves continuously with the actual score, not win/loss.
  const difficultyElo = difficultyToElo(concept.difficulty);
  const { ability } = updateEloScore(concept.elo, difficultyElo, score);

  // SM-2: advance from the last review's state. Quality scales with the score.
  const last = await prisma.review.findFirst({
    where: { conceptId: params.conceptId },
    orderBy: { answeredAt: "desc" },
  });
  const prior: SrsState = last
    ? { easeFactor: last.easeFactor, interval: last.interval, repetitions: repetitionsFromInterval(last.interval) }
    : INITIAL_SRS;
  const quality = Math.round(score * 5); // 0..5 SM-2 quality
  const next = scheduleReview(prior, quality);

  const nextDueAt = new Date(Date.now() + next.nextIntervalDays * 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.concept.update({ where: { id: concept.id }, data: { elo: ability } }),
    prisma.review.create({
      data: {
        conceptId: concept.id,
        correct,
        easeFactor: next.easeFactor,
        interval: next.interval,
        nextDueAt,
        detailJson: params.detail === undefined ? null : JSON.stringify(params.detail),
      },
    }),
  ]);

  return { elo: ability, nextIntervalDays: next.nextIntervalDays };
}
