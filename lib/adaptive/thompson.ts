/**
 * Domain selection: Thompson sampling over a Beta(α, β) posterior per interest
 * domain — "did this analogy work?". This is a genuine multi-armed bandit: it
 * balances exploiting the domain that has worked with exploring uncertain ones.
 *
 * After each session the learner taps "that clicked" / "that didn't", and we
 * bump α or β. Choice samples θ_d ~ Beta(α_d, β_d) and picks the max.
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
