import { z } from "zod";

/**
 * Onboarding v3 contracts. The interview is server-driven: the API returns
 * typed Interaction objects and the client renders one component per `kind`.
 * Everything the LLM produces is Zod-validated; everything that must stay
 * secret (word tiers, decoys) lives only in the server-side session state.
 */

export const TIERS = ["novice", "hobbyist", "insider"] as const;
export type Tier = (typeof TIERS)[number];

/** Verified vocabulary depth of a domain — selects the anchor register. */
export type Depth = "novice" | "hobbyist" | "deep";

// ---------------------------------------------------------------------------
// Interactions served to the client
// ---------------------------------------------------------------------------

export type ThisOrThatStep = {
  kind: "thisorthat";
  id: string;
  domain: string;
  prompt: string;
  left: string;
  right: string;
};

export type SliderStep = {
  kind: "slider";
  id: string;
  domain: string;
  prompt: string;
  leftLabel: string;
  rightLabel: string;
};

export type SubOptionsStep = {
  kind: "suboptions";
  id: string;
  domain: string;
  prompt: string;
  options: string[];
};

/**
 * The word magnet: a shuffled mix of real terms (three tiers) and plausible
 * decoys. The client only ever sees the flat word list — which terms are
 * decoys and which tier a term belongs to never leaves the server.
 */
export type WordMagnetStep = {
  kind: "wordmagnet";
  id: string;
  domain: string;
  prompt: string;
  words: string[];
};

export type Interaction = ThisOrThatStep | SliderStep | SubOptionsStep | WordMagnetStep;

// ---------------------------------------------------------------------------
// Answers posted back
// ---------------------------------------------------------------------------

export const AnswerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("thisorthat"), id: z.string(), value: z.string().max(120) }),
  z.object({ kind: z.literal("slider"), id: z.string(), value: z.number().min(0).max(1) }),
  z.object({ kind: z.literal("suboptions"), id: z.string(), values: z.array(z.string().max(80)).max(8) }),
  z.object({ kind: z.literal("wordmagnet"), id: z.string(), picked: z.array(z.string().max(60)).max(24) }),
]);
export type Answer = z.infer<typeof AnswerSchema>;

// ---------------------------------------------------------------------------
// Server-side session state (persisted as JSON on OnboardingSession.state)
// ---------------------------------------------------------------------------

export type MagnetWord = { term: string; tier: Tier | "decoy" };

export type DomainState = {
  key: string; // slug, used in interaction ids
  name: string;
  seeds: string[]; // the raw seed texts that fed this domain
  role?: string; // from the this-or-that (e.g. "I play myself")
  handsOn?: number; // slider 0..1 (watching .. doing)
  facets?: string[]; // from sub-options
  magnet?: { words: MagnetWord[]; picked?: string[] };
  depth?: Depth;
  evidence?: number; // 0..1, from the verified word magnet
  anchors?: string[];
  tagline?: string;
};

export type InterviewState = {
  domains: DomainState[];
  served: number; // total interactions served (hard-capped)
  pending: string[]; // ids of served-but-unanswered interactions
};

// ---------------------------------------------------------------------------
// What a finished interview returns to the client (the mirror screen)
// ---------------------------------------------------------------------------

export type MirrorDomain = {
  id: string; // InterestDomain id
  name: string;
  tagline: string;
  depth: Depth;
  evidence: number;
  confidence: number;
  anchors: string[];
};

// ---------------------------------------------------------------------------
// LLM output schemas (one per generator call)
// ---------------------------------------------------------------------------

/** Call A — interview plan: normalize seeds into domains + drill questions. */
export const PlanSchema = z.object({
  domains: z
    .array(
      z.object({
        name: z.string().min(2).max(48),
        roleQuestion: z
          .object({
            prompt: z.string().min(4).max(160),
            left: z.string().min(1).max(60),
            right: z.string().min(1).max(60),
          })
          .nullable(),
        slider: z
          .object({
            prompt: z.string().min(4).max(160),
            leftLabel: z.string().min(1).max(40),
            rightLabel: z.string().min(1).max(40),
          })
          .nullable(),
        subQuestion: z
          .object({
            prompt: z.string().min(4).max(160),
            options: z.array(z.string().min(1).max(60)).min(3).max(6),
          })
          .nullable(),
      }),
    )
    .min(1)
    .max(4),
});
export type Plan = z.infer<typeof PlanSchema>;

/** Call B — word magnets with tiered terms + decoys. */
export const MagnetGenSchema = z.object({
  magnets: z
    .array(
      z.object({
        domain: z.string().min(2).max(60),
        // Deliberately loose bounds: one under- or over-filled set must not
        // fail the whole call — sanitizeMagnet enforces usability per set.
        words: z
          .array(
            z.object({
              term: z.string().min(2).max(60),
              tier: z.enum(["novice", "hobbyist", "insider", "decoy"]),
            }),
          )
          .min(1)
          .max(40),
      }),
    )
    .min(1)
    .max(4),
});
export type MagnetGen = z.infer<typeof MagnetGenSchema>;

/** Call B2 — independent audit of the generated magnets (same generate->verify
 *  pattern as the bridge engine): terms to drop because they are ambiguous,
 *  not real usage, or decoys that actually exist. */
export const MagnetAuditSchema = z.object({
  audits: z.array(
    z.object({
      domain: z.string(),
      drop: z.array(z.string()).max(12),
    }),
  ),
});
export type MagnetAudit = z.infer<typeof MagnetAuditSchema>;

/** Call C — profile synthesis: final naming + register-matched extra anchors. */
export const SynthesisSchema = z.object({
  domains: z
    .array(
      z.object({
        name: z.string().min(2).max(48),
        tagline: z.string().max(120),
        extraAnchors: z.array(z.string().min(2).max(40)).max(6),
      }),
    )
    .max(4),
});
export type Synthesis = z.infer<typeof SynthesisSchema>;
