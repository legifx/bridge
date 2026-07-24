import { z } from "zod";

/**
 * A generated bridge is structured, not prose — so the UI can render the paired
 * correspondence rows (subject term <-> your term) and the "where it breaks
 * down" block as first-class elements (§6 signature visualization).
 */
export const BridgeBodySchema = z.object({
  opening: z.string().min(1),
  // at least two structural correspondences — not a one-line simile
  correspondences: z
    .array(
      z.object({
        subject: z.string().min(1), // subject term
        yourWorld: z.string().min(1), // the matched interest term
        explanation: z.string().min(1),
      }),
    )
    .min(2),
  breaksDown: z.string().min(1), // where the analogy fails (pedagogically important)
  plainRestatement: z.string().min(1), // the concept in plain subject vocabulary
});
export type BridgeBody = z.infer<typeof BridgeBodySchema>;

/** The independent verifier's verdict (§3, Stage 3b). */
export const VerdictSchema = z.object({
  factuallyConsistent: z.boolean(),
  contradictions: z.array(z.object({ claim: z.string(), reason: z.string() })),
  analogyOverreach: z.boolean(),
  /**
   * School-appropriate for a minor? Interests are learner-chosen and some of
   * them (shooters, MMA, motorsport crashes) have imagery that must not be
   * carried into a lesson. Optional so verdicts stored before this check
   * still parse; absent means "not assessed", which is treated as fine.
   */
  ageAppropriate: z.boolean().optional(),
  verdict: z.enum(["accept", "revise", "reject"]),
});
export type Verdict = z.infer<typeof VerdictSchema>;

export type BridgeAttempt = {
  attempt: number;
  body: BridgeBody;
  verdict: Verdict;
  status: "accepted" | "rejected";
  isFallback?: boolean;
};
