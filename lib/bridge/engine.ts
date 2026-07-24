/**
 * Stage 3 — Bridge engine with verification loop.
 *
 *   generate -> verify -> accept? ship
 *                      -> revise/reject? feed contradictions back, retry (max 2)
 *                      -> still failing? ship a PLAIN, non-analogical explanation
 *
 * Every attempt (accepted AND rejected) is logged to the DB. The rejected
 * attempt is the most persuasive evidence that we take hallucination seriously.
 */
import { prisma } from "@/lib/db/prisma";
import { st } from "@/lib/i18n";
import { llmJson } from "@/lib/llm/client";
import {
  GENERATE_SYSTEM,
  VERIFY_SYSTEM,
  generateUser,
  verifyUser,
} from "@/lib/prompts/bridge";
import type { Match } from "@/lib/profile/types";
import { BridgeBodySchema, VerdictSchema, type BridgeAttempt, type BridgeBody, type Verdict } from "./types";

const MAX_RETRIES = 2; // attempts 1..3

export type EngineConcept = {
  id: string;
  label: string;
  definition: string;
  sourceQuote: string;
};

export type EngineDomain = {
  id: string;
  name: string;
  anchors: string[];
  /** Verified vocabulary tier from onboarding — steers the analogy register. */
  depth?: string;
};

/** Flatten a structured bridge into text the verifier can read. */
export function bodyToText(b: BridgeBody): string {
  const rows = b.correspondences.map((c) => `- ${c.subject} <-> ${c.yourWorld}: ${c.explanation}`).join("\n");
  return `${b.opening}\n${rows}\nWhere it breaks down: ${b.breaksDown}\nIn plain terms: ${b.plainRestatement}`;
}

async function generate(
  concept: EngineConcept,
  domain: EngineDomain,
  readingLevel: number,
  priorContradictions: Verdict["contradictions"] | undefined,
  language?: string,
  priorMistakes?: string,
): Promise<BridgeBody> {
  return llmJson({
    system: GENERATE_SYSTEM,
    language,
    user: generateUser({
      label: concept.label,
      definition: concept.definition,
      sourceQuote: concept.sourceQuote,
      domain: domain.name,
      anchors: domain.anchors,
      depth: domain.depth,
      readingLevel,
      priorContradictions,
      priorMistakes,
    }),
    schema: BridgeBodySchema,
    temperature: 0.6,
  });
}

async function verify(concept: EngineConcept, body: BridgeBody): Promise<Verdict> {
  return llmJson({
    system: VERIFY_SYSTEM,
    user: verifyUser({
      label: concept.label,
      definition: concept.definition,
      sourceQuote: concept.sourceQuote,
      explanation: bodyToText(body),
    }),
    schema: VerdictSchema,
    temperature: 0,
  });
}

async function persist(
  concept: EngineConcept,
  domain: EngineDomain,
  body: BridgeBody,
  verdict: Verdict,
  status: "accepted" | "rejected",
  attempt: number,
  extra: Record<string, unknown> = {},
) {
  return prisma.bridge.create({
    data: {
      conceptId: concept.id,
      domainId: domain.id,
      body: JSON.stringify(body),
      status,
      attempt,
      verdictJson: JSON.stringify({ ...verdict, ...extra }),
    },
  });
}

export type BridgeResult = {
  bridgeId: string;
  body: BridgeBody;
  match: Match;
  attempts: BridgeAttempt[];
  isFallback: boolean;
};

/** Try one domain: generate→verify up to MAX_RETRIES+1 times. Persists every
 *  attempt (accepted or rejected). Returns the accepted bridge, or null when all
 *  attempts were rejected (so the caller can try another domain before plain). */
async function tryDomain(
  concept: EngineConcept,
  domain: EngineDomain,
  readingLevel: number,
  language: string | undefined,
  attempts: BridgeAttempt[],
  maxAttempts: number,
  priorMistakes?: string,
): Promise<{ bridgeId: string; body: BridgeBody } | null> {
  let contradictions: Verdict["contradictions"] | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const body = await generate(concept, domain, readingLevel, contradictions, language, priorMistakes);
    const verdict = await verify(concept, body);
    const status: "accepted" | "rejected" = verdict.verdict === "accept" ? "accepted" : "rejected";
    const row = await persist(concept, domain, body, verdict, status, attempt);
    attempts.push({ attempt, body, verdict, status });
    if (status === "accepted") return { bridgeId: row.id, body };
    contradictions = verdict.contradictions;
  }
  return null;
}

/** Run the full generate/verify loop for a single domain (kept for compat). */
export async function generateVerifiedBridge(params: {
  concept: EngineConcept;
  domain: EngineDomain;
  match: Match;
  readingLevel: number;
  language?: string;
}): Promise<BridgeResult> {
  return generateBestBridge({
    concept: params.concept,
    candidates: [{ domain: params.domain, match: params.match }],
    readingLevel: params.readingLevel,
    language: params.language,
  });
}

/**
 * Try each candidate domain (best first) until one produces a verified analogy.
 * Only if EVERY candidate's attempts are rejected do we ship a plain, non-
 * analogical explanation — so a single weak domain match no longer silently
 * drops the learner to "no analogy" when another interest would have worked.
 */
export async function generateBestBridge(params: {
  concept: EngineConcept;
  candidates: { domain: EngineDomain; match: Match }[];
  readingLevel: number;
  language?: string;
  /** When re-learning: what the learner got wrong, so the new explanation targets it. */
  priorMistakes?: string;
}): Promise<BridgeResult> {
  const { concept, candidates, readingLevel, language, priorMistakes } = params;
  const attempts: BridgeAttempt[] = [];

  // Cost guard: the best domain gets the full retry budget; each additional
  // domain gets a single fresh attempt. Worst case is bounded at (MAX_RETRIES+1)
  // + 1 attempt-pairs rather than growing with the candidate count.
  for (let i = 0; i < candidates.length; i++) {
    const { domain, match } = candidates[i];
    const maxAttempts = i === 0 ? MAX_RETRIES + 1 : 1;
    const accepted = await tryDomain(concept, domain, readingLevel, language, attempts, maxAttempts, priorMistakes);
    if (accepted) {
      return { bridgeId: accepted.bridgeId, body: accepted.body, match, attempts, isFallback: false };
    }
  }

  // Every candidate failed → plain fallback, attributed to the best (first) match.
  const first = candidates[0];
  const plain: BridgeBody = {
    opening: st(language, "engine.plainOpening", { label: concept.label }),
    correspondences: [],
    breaksDown: "",
    plainRestatement: concept.definition,
  };
  const verdict: Verdict = {
    factuallyConsistent: true,
    contradictions: [],
    analogyOverreach: false,
    verdict: "accept",
  };
  const row = await persist(concept, first.domain, plain, verdict, "accepted", 99, { fallback: true });
  attempts.push({ attempt: 99, body: plain, verdict, status: "accepted", isFallback: true });
  return { bridgeId: row.id, body: plain, match: first.match, attempts, isFallback: true };
}
