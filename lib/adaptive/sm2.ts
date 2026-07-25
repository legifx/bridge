/**
 * Scheduling: SM-2-lite spaced repetition over concepts.
 * Based on the SuperMemo-2 algorithm, trimmed to what we need.
 *
 * quality q is 0..5 (how well the item was recalled). q < 3 is a lapse.
 */

export type SrsState = {
  easeFactor: number; // >= 1.3
  interval: number; // days until next review
  repetitions: number; // consecutive successful reviews
};

export const INITIAL_SRS: SrsState = { easeFactor: 2.5, interval: 0, repetitions: 0 };

/** A check's score (0..1) as an SM-2 quality (0..5). Below 3 is a lapse, so
 *  anything under 50 % of the points restarts the ladder. */
export function qualityFromScore(score: number): number {
  return Math.round(Math.max(0, Math.min(1, score)) * 5);
}

/**
 * Advance the SRS state by one review.
 * Returns the next state and the number of days until it is next due.
 */
export function scheduleReview(state: SrsState, quality: number): SrsState & { nextIntervalDays: number } {
  const q = Math.max(0, Math.min(5, quality));

  // Ease factor update (bounded at 1.3).
  const easeFactor = Math.max(1.3, state.easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  if (q < 3) {
    // Lapse — restart the ladder.
    return { easeFactor, interval: 1, repetitions: 0, nextIntervalDays: 1 };
  }

  const repetitions = state.repetitions + 1;
  let interval: number;
  if (repetitions === 1) interval = 1;
  else if (repetitions === 2) interval = 6;
  else interval = Math.round(state.interval * easeFactor);

  return { easeFactor, interval, repetitions, nextIntervalDays: interval };
}
