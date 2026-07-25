/**
 * Mastery estimate: Elo. A quiz answer is a "match" between the learner's
 * ability and the concept's difficulty. Both ratings move after each answer,
 * so mastery rises as questions are answered and a concept that trips people up
 * drifts harder. Mastery drives what to review next.
 */

export const K_FACTOR = 24;
export const DEFAULT_ELO = 1200;

/** Expected score of A against B under the logistic Elo model. */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Update both ratings after one answer.
 *
 * The "match outcome" is a partial score 0..1 — the fraction of a check's
 * points earned — rather than a win or a loss, so mastery moves with how well
 * the learner actually did. (A binary answer is just the score 0 or 1, which is
 * why there is only one function here.)
 */
export function updateEloScore(
  ability: number,
  difficulty: number,
  score: number,
  k = K_FACTOR,
): { ability: number; difficulty: number } {
  const s = Math.max(0, Math.min(1, score));
  const expected = expectedScore(ability, difficulty);
  return {
    ability: ability + k * (s - expected),
    difficulty: difficulty + k * (expected - s),
  };
}

/** Seed a concept's difficulty rating from its 1..5 difficulty tag. */
export function difficultyToElo(difficulty: number): number {
  return 1000 + (difficulty - 1) * 150; // 1 -> 1000, 5 -> 1600
}
