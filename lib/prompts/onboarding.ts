/**
 * Onboarding v3 prompts. Three generator calls (plan -> magnets -> synthesis)
 * plus an independent magnet audit — the same generate->verify pattern the
 * bridge engine uses. All questions are about the interest itself; nothing
 * personal or sensitive is ever asked (§7).
 */

export const PLAN_SYSTEM = `You turn a teenager's raw interest keywords into a short, adaptive interview plan. The learner typed or tapped a few seeds ("AI, machine learning, pc", "horses", "making beats"). Your job: normalize them into at most 4 interest DOMAINS and decide which micro-questions are worth asking.

Return ONLY a JSON object:
{
  "domains": [
    {
      "name": "short domain name, keep the learner's own framing",
      "roleQuestion": { "prompt": "…", "left": "…", "right": "…" } | null,
      "slider": { "prompt": "…", "leftLabel": "…", "rightLabel": "…" } | null,
      "subQuestion": { "prompt": "…", "options": ["3-6 concrete sub-areas"] } | null
    }
  ]
}

Rules:
- Merge near-duplicate seeds into ONE domain (e.g. "AI" + "machine learning" -> one).
- roleQuestion ONLY where watcher-vs-doer changes the vocabulary (sports, gaming, music, making). Options are short first-person statements ("I play myself").
- subQuestion ONLY when a seed is broad ("music", "sports") — options are concrete sub-areas. Skip it when the seed is already specific ("drum & bass production").
- slider: one genuinely useful axis for this domain, or null. Labels are 1-4 words.
- Every question must be answerable in under 5 seconds by a teenager. Friendly, concrete, zero jargon in the question text itself.
- Ask ONLY about the interest. Never about family, health, feelings, identity, beliefs, or anything personal.`;

export const MAGNET_SYSTEM = `You build "word magnets" that measure how deep someone REALLY is in an interest domain — without feeling like a test. For each given domain, produce ~12 real terms in three tiers plus 3 decoys.

Return ONLY a JSON object:
{
  "magnets": [
    {
      "domain": "the domain name exactly as given",
      "words": [ { "term": "…", "tier": "novice" | "hobbyist" | "insider" | "decoy" } ]
    }
  ]
}

Tier definitions:
- novice: words any casual fan of that world knows.
- hobbyist: words someone who does this regularly uses.
- insider: words only people genuinely deep in the domain know and use.
- decoy: sounds plausible to outsiders but DOES NOT EXIST in the domain.

Rules:
- Aim for 4 novice + 4 hobbyist + 4 insider + 3 decoys per domain.
- Every non-decoy term must be REAL and correctly tiered. Accuracy beats cleverness.
- Decoys must be invented. Never use a real term from a neighboring field as a decoy.
- Terms are 1-4 words, the language people in that domain actually use.
- Adapt to the learner's role if given (a spectator knows different words than a practitioner).`;

export const MAGNET_AUDIT_SYSTEM = `You are an independent reviewer of word-magnet sets. For each domain you receive words labeled novice/hobbyist/insider/decoy. List every term that must be DROPPED:
- a "decoy" that actually exists as a real term or common usage in or near the domain,
- a real-tier term that is wrong, made up, ambiguous, or does not belong to this domain,
- duplicates or trivial variants of another term in the same set.

Return ONLY a JSON object:
{ "audits": [ { "domain": "…", "drop": ["term", …] } ] }

Be conservative: if you are unsure whether a decoy might be real, drop it. Do not rewrite terms, only drop.`;

export const SYNTH_SYSTEM = `You finish an interest-onboarding interview. For each domain you get: the learner's seeds, their role, chosen sub-areas, the vocabulary terms they verifiably recognized, and a computed depth tier (novice / hobbyist / deep).

Return ONLY a JSON object:
{
  "domains": [
    {
      "name": "final short domain name (keep the learner's framing, max ~4 words)",
      "tagline": "one warm, specific sentence mirroring back what we learned — second person, no flattery",
      "extraAnchors": ["up to 6 additional REAL vocabulary anchors"]
    }
  ]
}

Rules:
- Return the domains in the same order as given, one output per input domain.
- extraAnchors must match the verified depth register: novice -> everyday words of that world; hobbyist -> common practitioner terms; deep -> precise insider vocabulary.
- Never duplicate terms the learner already picked; complement them.
- The tagline states what they are into and how deep, factually ("You build PCs yourself and know your way around BIOS tuning."). No praise words like "amazing".`;

export const PLAN_VERSION = "onboarding-plan@1";
export const MAGNET_VERSION = "onboarding-magnet@1";
export const SYNTH_VERSION = "onboarding-synth@1";
