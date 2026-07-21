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
import { isDemoMode, llmJson } from "@/lib/llm/client";
import { getDemoResponse, hasDemoResponse } from "@/lib/demo/cache";
import {
  GENERATE_SYSTEM,
  VERIFY_SYSTEM,
  generateUser,
  verifyUser,
} from "@/lib/prompts/bridge";
import type { Match } from "@/lib/profile/types";
import { BridgeBodySchema, VerdictSchema, type BridgeAttempt, type BridgeBody, type Verdict } from "./types";
import { slug, templateBody } from "./template";

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
};

/** Flatten a structured bridge into text the verifier can read. */
export function bodyToText(b: BridgeBody): string {
  const rows = b.correspondences.map((c) => `- ${c.subject} <-> ${c.yourWorld}: ${c.explanation}`).join("\n");
  return `${b.opening}\n${rows}\nWhere it breaks down: ${b.breaksDown}\nIn plain terms: ${b.plainRestatement}`;
}

async function generate(
  concept: EngineConcept,
  domain: EngineDomain,
  match: Match,
  readingLevel: number,
  attempt: number,
  priorContradictions: Verdict["contradictions"] | undefined,
): Promise<BridgeBody> {
  const key = `bridge:${slug(concept.label)}:${slug(domain.name)}:a${attempt}`;
  if (isDemoMode()) {
    if (hasDemoResponse(key)) return BridgeBodySchema.parse(getDemoResponse(key));
    return templateBody({ label: concept.label, definition: concept.definition, match, anchors: domain.anchors });
  }
  return llmJson({
    demoKey: key,
    system: GENERATE_SYSTEM,
    user: generateUser({
      label: concept.label,
      definition: concept.definition,
      sourceQuote: concept.sourceQuote,
      domain: domain.name,
      anchors: domain.anchors,
      readingLevel,
      priorContradictions,
    }),
    schema: BridgeBodySchema,
    temperature: 0.6,
  });
}

async function verify(
  concept: EngineConcept,
  domain: EngineDomain,
  body: BridgeBody,
  attempt: number,
): Promise<Verdict> {
  const key = `verify:${slug(concept.label)}:${slug(domain.name)}:a${attempt}`;
  if (isDemoMode()) {
    if (hasDemoResponse(key)) return VerdictSchema.parse(getDemoResponse(key));
    return { factuallyConsistent: true, contradictions: [], analogyOverreach: false, verdict: "accept" };
  }
  return llmJson({
    demoKey: key,
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

/** Run the full generate/verify loop and persist every attempt. */
export async function generateVerifiedBridge(params: {
  concept: EngineConcept;
  domain: EngineDomain;
  match: Match;
  readingLevel: number;
}): Promise<BridgeResult> {
  const { concept, domain, match, readingLevel } = params;
  const attempts: BridgeAttempt[] = [];
  let contradictions: Verdict["contradictions"] | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    const body = await generate(concept, domain, match, readingLevel, attempt, contradictions);
    const verdict = await verify(concept, domain, body, attempt);
    const status: "accepted" | "rejected" = verdict.verdict === "accept" ? "accepted" : "rejected";
    const row = await persist(concept, domain, body, verdict, status, attempt);
    attempts.push({ attempt, body, verdict, status });

    if (status === "accepted") {
      return { bridgeId: row.id, body, match, attempts, isFallback: false };
    }
    contradictions = verdict.contradictions;
  }

  // Fallback: a plain, non-analogical explanation rather than shipping something wrong.
  const plain: BridgeBody = {
    opening: `Here is ${concept.label} in plain terms, without an analogy.`,
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
  const row = await persist(concept, domain, plain, verdict, "accepted", MAX_RETRIES + 2, {
    fallback: true,
  });
  attempts.push({ attempt: MAX_RETRIES + 2, body: plain, verdict, status: "accepted", isFallback: true });
  return { bridgeId: row.id, body: plain, match, attempts, isFallback: true };
}
