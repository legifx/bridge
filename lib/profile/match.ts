/**
 * Match an interest domain to a concept (§ Stage 2/3). The choice combines two
 * signals, both computed in our own code and surfaced in the UI:
 *   - cosine similarity between the concept vector and the domain vector
 *   - the Thompson-sampled bandit score (how well this domain has worked)
 *
 * Then, inside the chosen domain, we pick the single anchor closest to the
 * concept so the UI can show "Ionic bond <-> handshake, 0.71".
 */
import { cosine, bytesToVec } from "@/lib/ml/vector";
import { embed, EMBEDDINGS_ENABLED } from "@/lib/ml/embeddings";
import { sampleBeta, mulberry32, type Rng } from "@/lib/adaptive/rng";
import type { Match } from "./types";

export type DomainForMatch = {
  id: string;
  name: string;
  embedding: Uint8Array; // stored bytes
  anchors: string[];
  alpha: number;
  beta: number;
  depth: string; // novice | hobbyist | deep — verified vocabulary tier
};

/** Weight between semantic fit and learned success. */
const COSINE_WEIGHT = 0.5;
const BANDIT_WEIGHT = 0.5;

/**
 * Choose the best domain for a concept and the best anchor within it.
 * `rng` is injectable for deterministic behavior; defaults to a per-call seed.
 */
/** Rank every domain for a concept (best first) by cosine + bandit score. */
export function rankDomainsForConcept(
  conceptEmbedding: Float32Array,
  domains: DomainForMatch[],
  rng: Rng = mulberry32(((conceptEmbedding[0] * 1e6) | 0) >>> 0),
): { domain: DomainForMatch; bandit: number }[] {
  return domains
    .map((d) => {
      const domCos = cosine(conceptEmbedding, bytesToVec(d.embedding));
      const bandit = sampleBeta(d.alpha, d.beta, rng);
      return { domain: d, bandit, score: COSINE_WEIGHT * domCos + BANDIT_WEIGHT * bandit };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ domain, bandit }) => ({ domain, bandit }));
}

/** Build the Match (best anchor + similarity) for one already-chosen domain. */
export async function buildMatch(
  conceptEmbedding: Float32Array,
  domain: DomainForMatch,
  banditScore: number,
): Promise<Match> {
  // Best anchor within the domain, by cosine to the concept. When embeddings are
  // disabled (serverless), fall back to the stored domain vector and the first
  // anchor — no runtime model load needed.
  let anchor = domain.anchors[0] ?? domain.name;
  let similarity = cosine(conceptEmbedding, bytesToVec(domain.embedding));
  if (EMBEDDINGS_ENABLED) {
    for (const a of domain.anchors) {
      const sim = cosine(conceptEmbedding, await embed(a));
      if (sim > similarity) {
        similarity = sim;
        anchor = a;
      }
    }
  }
  return {
    domainId: domain.id,
    domainName: domain.name,
    anchor,
    similarity: Math.max(0, Math.min(1, similarity)),
    banditScore,
  };
}

export async function matchConceptToDomains(
  conceptEmbedding: Float32Array,
  domains: DomainForMatch[],
  rng: Rng = mulberry32(((conceptEmbedding[0] * 1e6) | 0) >>> 0),
): Promise<Match | null> {
  const ranked = rankDomainsForConcept(conceptEmbedding, domains, rng);
  if (ranked.length === 0) return null;
  return buildMatch(conceptEmbedding, ranked[0].domain, ranked[0].bandit);
}
