import { prisma } from "@/lib/db/prisma";
import { embed, vecToBytes } from "@/lib/ml/embeddings";
import { llmJson } from "@/lib/llm/client";
import { PROFILE_SYSTEM } from "@/lib/prompts/profile";
import { OPTION_BY_ID } from "./questions";
import { checkInterestText } from "./guard";
import { FreeTextDomainSchema, type DomainVM } from "./types";
import { successRate } from "@/lib/adaptive/thompson";

type BuildInput = {
  displayName: string;
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
        demoKey: "profile:default",
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

  const learner = await prisma.learner.create({
    data: {
      displayName: input.displayName || "You",
      readingLevel: Math.max(1, Math.min(5, input.readingLevel || 3)),
    },
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
