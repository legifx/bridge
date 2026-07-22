import type { Depth, DomainState, MagnetWord } from "./types";

/**
 * Pure scoring for the adaptive interview. Confidence here is EARNED, not
 * claimed: the word magnet mixes real terms (three tiers) with plausible
 * decoys, and what the learner actually taps determines both the vocabulary
 * depth of a domain and how much evidence backs it. No LLM, no DB — all of
 * this is unit-tested.
 */

export const MAX_DOMAINS = 4;
export const MAX_STEPS = 14; // hard cap on served interactions per interview

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const norm = (s: string) => s.trim().toLowerCase();

export type MagnetScore = {
  depth: Depth;
  evidence: number; // 0..1
  decoyHits: number;
  realPicks: string[]; // picked terms that are real, in shown order
};

/**
 * Score one answered word magnet.
 *
 * Depth comes from the tier distribution of the real picks; decoy hits both
 * demote the depth and collapse the evidence multiplicatively — someone who
 * taps everything (larping) ends up "novice" with weak evidence, not "deep".
 */
export function scoreMagnet(words: MagnetWord[], picked: string[]): MagnetScore {
  const pickedSet = new Set(picked.map(norm));
  let novice = 0;
  let hobbyist = 0;
  let insider = 0;
  let decoyHits = 0;
  const realPicks: string[] = [];

  for (const w of words) {
    if (!pickedSet.has(norm(w.term))) continue;
    if (w.tier === "decoy") {
      decoyHits++;
      continue;
    }
    realPicks.push(w.term);
    if (w.tier === "novice") novice++;
    else if (w.tier === "hobbyist") hobbyist++;
    else insider++;
  }

  let depth: Depth;
  if (insider >= 3 && decoyHits === 0) depth = "deep";
  else if (insider + hobbyist >= 3 && decoyHits <= 1) depth = "hobbyist";
  else depth = "novice";

  // Raw signal strength, then a multiplicative decoy penalty: one accidental
  // decoy roughly halves the evidence, two or more collapse it.
  const raw = clamp01((novice * 0.5 + hobbyist * 1.5 + insider * 2.5) / 10);
  const penalty = decoyHits === 0 ? 1 : decoyHits === 1 ? 0.55 : 0.2;
  const evidence = clamp01(raw * penalty);

  return { depth, evidence, decoyHits, realPicks };
}

/** Fallback when a domain could not be verified (no magnet generated). */
export const UNVERIFIED: Pick<MagnetScore, "depth" | "evidence"> = {
  depth: "hobbyist",
  evidence: 0.25,
};

export type ProfileSeeds = {
  confidence: number;
  alpha: number; // Thompson warm start: verified interests are tried first
  beta: number;
  interestWeight: number; // second-brain seed weight for the domain item
  anchorWeight: number; // second-brain seed weight per anchor item
};

/** Map verified depth + evidence onto the profile's starting parameters. */
export function depthToProfile(depth: Depth, evidence: number): ProfileSeeds {
  const e = clamp01(evidence);
  const bonus = depth === "deep" ? 0.15 : depth === "hobbyist" ? 0.05 : 0;
  return {
    confidence: Math.max(0.2, Math.min(0.9, 0.3 + 0.45 * e + bonus)),
    alpha: 1 + Math.round(e * 4),
    beta: 1 + (depth === "novice" ? 1 : 0),
    interestWeight: 0.8 + 2.2 * e,
    anchorWeight: 0.25 + 0.45 * e,
  };
}

/**
 * The brain-sync meter (0..1). Per domain: naming it is worth a fifth,
 * drilling (role/slider/facets) a bit more, and the remaining ~two thirds
 * must be earned through verified evidence. Average over domains, so adding
 * unverified domains does not inflate the score.
 */
export function syncScore(domains: DomainState[]): number {
  if (domains.length === 0) return 0;
  let total = 0;
  for (const d of domains) {
    let s = 0.2;
    if (d.role !== undefined || d.handsOn !== undefined || (d.facets?.length ?? 0) > 0) s += 0.15;
    if (d.magnet?.picked !== undefined) s += 0.65 * (d.evidence ?? 0);
    total += s;
  }
  return Math.round(clamp01(total / domains.length) * 100) / 100;
}

/**
 * Sanitize a generated word-magnet set: dedupe (case-insensitive), cap each
 * tier at 4 and decoys at 3, and require a usable minimum (>= 6 real terms and
 * >= 2 decoys). Returns [] when the set is not usable — the caller then falls
 * back to a curated fixture or skips verification for that domain.
 */
export function sanitizeMagnet(words: MagnetWord[]): MagnetWord[] {
  const seen = new Set<string>();
  const caps: Record<string, number> = { novice: 0, hobbyist: 0, insider: 0, decoy: 0 };
  const out: MagnetWord[] = [];
  for (const w of words) {
    const term = w.term.trim();
    const key = norm(term);
    if (term.length < 2 || seen.has(key)) continue;
    const cap = w.tier === "decoy" ? 3 : 4;
    if (caps[w.tier] >= cap) continue;
    seen.add(key);
    caps[w.tier]++;
    out.push({ term, tier: w.tier });
  }
  const real = out.length - caps.decoy;
  if (real < 6 || caps.decoy < 2) return [];
  return out;
}

/** Fisher-Yates shuffle (fresh array) — the served word order must not leak tiers. */
export function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
