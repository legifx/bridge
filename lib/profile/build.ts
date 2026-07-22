import { prisma } from "@/lib/db/prisma";
import { embed, vecToBytes } from "@/lib/ml/embeddings";
import { recordSignal } from "@/lib/brain/record";
import { llmJson } from "@/lib/llm/client";
import { PROFILE_SYSTEM } from "@/lib/prompts/profile";
import { OPTION_BY_ID } from "./questions";
import { checkInterestText } from "./guard";
import { FreeTextDomainSchema, type DomainVM } from "./types";
import { successRate } from "@/lib/adaptive/thompson";

type BuildInput = {
  learnerId: string;
  readingLevel: number;
  selectionIds: string[];
  freeText: string;
};

type RawDomain = { name: string; anchors: string[] };

/** Merge tapped options + the enriched free-text answer into unique domains. */
async function collectDomains(input: BuildInput): Promise<RawDomain[]> {
  const byName = new Map<string, Set<string>>();

  for (const id of input.selectionIds) {
    const opt = OPTION_BY_ID[id];
    if (!opt) continue;
    const set = byName.get(opt.domain) ?? new Set<string>();
    opt.anchors.forEach((a) => set.add(a));
    byName.set(opt.domain, set);
  }

  const guard = checkInterestText(input.freeText);
  if (guard.ok && guard.text) {
    try {
      const enriched = await llmJson({
        system: PROFILE_SYSTEM,
        user: guard.text,
        schema: FreeTextDomainSchema,
        temperature: 0.3,
      });
      if (enriched.name) {
        const set = byName.get(enriched.name) ?? new Set<string>();
        enriched.vocabularyAnchors.forEach((a) => set.add(a));
        byName.set(enriched.name, set);
      }
    } catch {
      // Free-text enrichment is best-effort; tapped options still stand.
    }
  }

  return [...byName.entries()].map(([name, anchors]) => ({ name, anchors: [...anchors] }));
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
    const emb = await embed(`${d.name}. ${d.anchors.join(", ")}`);
    const row = await prisma.interestDomain.create({
      data: {
        learnerId: learner.id,
        name: d.name,
        anchors: JSON.stringify(d.anchors),
        embedding: vecToBytes(emb),
      },
    });

    // Seed the second brain: the domain itself plus its concrete anchors.
    await recordSignal({
      learnerId: learner.id,
      kind: "interest",
      label: d.name,
      text: `${d.name}. ${d.anchors.join(", ")}`,
      weight: 1.2,
      embedding: emb,
      sourceRef: row.id,
    });
    for (const anchor of d.anchors.slice(0, 6)) {
      await recordSignal({
        learnerId: learner.id,
        kind: "anchor",
        label: anchor,
        text: `${anchor} (${d.name})`,
        weight: 0.4,
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
