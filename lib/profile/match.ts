/**
 * Match an interest domain to a concept (§ Stage 2/3). The choice combines two
 * signals, both computed in our own code and surfaced in the UI:
 *   - cosine similarity between the concept vector and the domain vector
 *   - the Thompson-sampled bandit score (how well this domain has worked)
 *
 * Then, inside the chosen domain, we pick the single anchor closest to the
 * concept so the UI can show "Ionic bond <-> handshake, 0.71".
 */
import { cosine } from "@/lib/ml/vector";
import { embed } from "@/lib/ml/embeddings";
import { bytesToVec } from "@/lib/ml/vector";
import { sampleBeta, mulberry32, type Rng } from "@/lib/adaptive/rng";
import type { Match } from "./types";

export type DomainForMatch = {
  id: string;
  name: string;
  embedding: Uint8Array; // stored bytes
  anchors: string[];
  alpha: number;
  beta: number;
};

/** Weight between semantic fit and learned success. */
const COSINE_WEIGHT = 0.5;
const BANDIT_WEIGHT = 0.5;

/**
 * Choose the best domain for a concept and the best anchor within it.
 * `rng` is injectable for deterministic behavior; defaults to a per-call seed.
 */
export async function matchConceptToDomains(
  conceptEmbedding: Float32Array,
  domains: DomainForMatch[],
  rng: Rng = mulberry32(((conceptEmbedding[0] * 1e6) | 0) >>> 0),
): Promise<Match | null> {
  if (domains.length === 0) return null;

  let best: { d: DomainForMatch; score: number; bandit: number } | null = null;
  for (const d of domains) {
    const domCos = cosine(conceptEmbedding, bytesToVec(d.embedding));
    const bandit = sampleBeta(d.alpha, d.beta, rng);
    const score = COSINE_WEIGHT * domCos + BANDIT_WEIGHT * bandit;
    if (!best || score > best.score) best = { d, score, bandit };
  }
  if (!best) return null;

  // Best anchor within the chosen domain, by cosine to the concept.
  let anchor = best.d.name;
  let similarity = cosine(conceptEmbedding, bytesToVec(best.d.embedding));
  for (const a of best.d.anchors) {
    const sim = cosine(conceptEmbedding, await embed(a));
    if (sim > similarity) {
      similarity = sim;
      anchor = a;
    }
  }

  return {
    domainId: best.d.id,
    domainName: best.d.name,
    anchor,
    similarity: Math.max(0, Math.min(1, similarity)),
    banditScore: best.bandit,
  };
}
