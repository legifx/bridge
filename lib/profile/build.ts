import { prisma } from "@/lib/db/prisma";
import { embed, vecToBytes } from "@/lib/ml/embeddings";
import { recordSignal } from "@/lib/brain/record";
import { llmJson } from "@/lib/llm/client";
import { PROFILE_SYSTEM } from "@/lib/prompts/profile";
import { OPTION_BY_ID } from "./questions";
import { checkInterestText } from "./guard";
import { FreeTextDomainSchema, type DomainVM } from "./types";
import { successRate } from "@/lib/adaptive/thompson";

/**
 * Intensity is the learner's own calibration, set during onboarding: picking
 * "music" as the least-bad option in a lineup is NOT the same as being deep
 * into music. The weights below flow into the interest domain's starting
 * confidence and into the second brain, so a "casual" pick starts light and
 * only grows if the evidence (clicked bridges) actually accumulates.
 */
export type Intensity = "casual" | "into" | "deep";

const INTENSITY = {
  casual: { interest: 0.5, anchor: 0.2, confidence: 0.35 },
  into: { interest: 1.2, anchor: 0.4, confidence: 0.5 },
  deep: { interest: 2.4, anchor: 0.6, confidence: 0.7 },
} as const;

export type BuildInput = {
  learnerId: string;
  readingLevel: number;
  picks: Array<{ id: string; intensity: Intensity }>;
  custom: Array<{ text: string; intensity: Intensity }>;
};

type RawDomain = { name: string; anchors: string[]; intensity: Intensity };

const RANK: Record<Intensity, number> = { casual: 0, into: 1, deep: 2 };

/** Merge tapped options + the learner's own free-text interests into domains. */
async function collectDomains(input: BuildInput): Promise<RawDomain[]> {
  const byName = new Map<string, RawDomain>();

  const upsert = (name: string, anchors: string[], intensity: Intensity) => {
    const prev = byName.get(name);
    if (prev) {
      anchors.forEach((a) => !prev.anchors.includes(a) && prev.anchors.push(a));
      if (RANK[intensity] > RANK[prev.intensity]) prev.intensity = intensity;
    } else {
      byName.set(name, { name, anchors: [...anchors], intensity });
    }
  };

  for (const pick of input.picks) {
    const opt = OPTION_BY_ID[pick.id];
    if (opt) upsert(opt.domain, opt.anchors, pick.intensity);
  }

  // Each custom interest is enriched by the LLM into a named domain + anchors.
  for (const c of input.custom) {
    const guard = checkInterestText(c.text);
    if (!guard.ok || !guard.text) continue;
    try {
      const enriched = await llmJson({
        system: PROFILE_SYSTEM,
        user: guard.text,
        schema: FreeTextDomainSchema,
        temperature: 0.3,
      });
      if (enriched.name) upsert(enriched.name, enriched.vocabularyAnchors, c.intensity);
    } catch {
      // Best-effort: a failed enrichment must not sink the whole onboarding.
    }
  }

  return [...byName.values()];
}

export async function buildProfile(input: BuildInput): Promise<{ learnerId: string; domains: DomainVM[] }> {
  const domains = await collectDomains(input);

  // Onboarding runs for the signed-in learner (created at sign-in).
  const learner = await prisma.learner.update({
    where: { id: input.learnerId },
    data: { readingLevel: Math.max(1, Math.min(5, input.readingLevel || 3)) },
  });

  const created: DomainVM[] = [];
  for (const d of domains) {
    const w = INTENSITY[d.intensity];
    const emb = await embed(`${d.name}. ${d.anchors.join(", ")}`);
    const row = await prisma.interestDomain.create({
      data: {
        learnerId: learner.id,
        name: d.name,
        anchors: JSON.stringify(d.anchors),
        embedding: vecToBytes(emb),
        confidence: w.confidence,
      },
    });

    // Seed the second brain, scaled by how deep the learner says this goes.
    await recordSignal({
      learnerId: learner.id,
      kind: "interest",
      label: d.name,
      text: `${d.name}. ${d.anchors.join(", ")}`,
      weight: w.interest,
      embedding: emb,
      sourceRef: row.id,
    });
    for (const anchor of d.anchors.slice(0, 6)) {
      await recordSignal({
        learnerId: learner.id,
        kind: "anchor",
        label: anchor,
        text: `${anchor} (${d.name})`,
        weight: w.anchor,
        sourceRef: row.id,
      });
    }

    created.push({
      id: row.id,
      name: row.name,
      anchors: d.anchors,
      alpha: row.alpha,
      beta: row.beta,
      confidence: row.confidence,
      successRate: successRate(row),
    });
  }

  return { learnerId: learner.id, domains: created };
}
