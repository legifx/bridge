/**
 * Domain selection: Thompson sampling over a Beta(α, β) posterior per interest
 * domain — "did this analogy work?". This is a genuine multi-armed bandit: it
 * balances exploiting the domain that has worked with exploring uncertain ones.
 *
 * Two things move the posterior. The learner taps "that clicked" / "that
 * didn't" (updateBeta), and — the stronger evidence — they then sit a check and
 * score on it (updateBetaScore). A tap is a self-report made while wanting to
 * move on; the check is what actually stuck. Choice samples θ_d ~ Beta(α_d,
 * β_d) and picks the max.
 */
import { mulberry32, sampleBeta, type Rng } from "./rng";

export type Arm = {
  id: string;
  alpha: number; // successes + 1 (prior Beta(1,1) = uniform)
  beta: number; // failures + 1
};

/** Update a Beta posterior from one feedback event. */
export function updateBeta(arm: Pick<Arm, "alpha" | "beta">, clicked: boolean): { alpha: number; beta: number } {
  return clicked
    ? { alpha: arm.alpha + 1, beta: arm.beta }
    : { alpha: arm.alpha, beta: arm.beta + 1 };
}

/**
 * Update from a graded outcome in 0..1 rather than a yes/no.
 *
 * The check score is the strongest signal the app has about whether an interest
 * actually explains things to this learner, and it was going nowhere: only the
 * thumbs tap moved the bandit. A score splits one observation between the two
 * counters — 0.8 is mostly a success and a little a failure — which is the
 * Bayesian update for a Bernoulli reward observed with partial credit.
 *
 * `weight` scales how much one outcome counts, so a check can be made to carry
 * more than a tap without changing the arithmetic.
 */
export function updateBetaScore(
  arm: Pick<Arm, "alpha" | "beta">,
  score: number,
  weight = 1,
): { alpha: number; beta: number } {
  const s = Math.max(0, Math.min(1, score));
  const w = Math.max(0, weight);
  return { alpha: arm.alpha + s * w, beta: arm.beta + (1 - s) * w };
}

/** Posterior mean success rate, for display. */
export function successRate(arm: Pick<Arm, "alpha" | "beta">): number {
  return arm.alpha / (arm.alpha + arm.beta);
}

/**
 * Thompson choice: sample once per arm, return the id with the highest sample.
 * Pass an `rng` for deterministic tests; defaults to a fresh seeded stream.
 */
export function selectArm(arms: Arm[], rng: Rng = mulberry32((Date.now?.() ?? 1) >>> 0)): {
  chosenId: string;
  samples: Record<string, number>;
} {
  if (arms.length === 0) throw new Error("selectArm: no arms");
  const samples: Record<string, number> = {};
  let chosenId = arms[0].id;
  let best = -Infinity;
  for (const arm of arms) {
    const theta = sampleBeta(arm.alpha, arm.beta, rng);
    samples[arm.id] = theta;
    if (theta > best) {
      best = theta;
      chosenId = arm.id;
    }
  }
  return { chosenId, samples };
}
