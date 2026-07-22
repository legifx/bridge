import { prisma } from "@/lib/db/prisma";
import { embed, vecToBytes } from "@/lib/ml/embeddings";
import { recordSignal } from "@/lib/brain/record";
import { depthToProfile } from "@/lib/onboarding/score";
import type { Depth, MirrorDomain } from "@/lib/onboarding/types";

/**
 * Profile builder v2 — the evidence-based successor of buildProfile.
 *
 * v1 mapped SELF-REPORTED intensity onto a fixed starting confidence. Here the
 * inputs come out of the verified interview: `depth` and `evidence` were
 * earned through the word magnet, the anchors are terms the learner actually
 * recognized. depthToProfile turns that into confidence, a warm Thompson
 * prior (alpha/beta) and second-brain seed weights.
 *
 * Existing domains with the same name are UPDATED, never deleted — a re-run
 * must not destroy bridges/reviews hanging off an old domain row.
 */

export type VerifiedDomainInput = {
  name: string;
  tagline: string;
  anchors: string[];
  depth: Depth;
  evidence: number;
  role?: string;
};

export async function buildProfileV2(
  learnerId: string,
  inputs: VerifiedDomainInput[],
): Promise<MirrorDomain[]> {
  const existing = await prisma.interestDomain.findMany({ where: { learnerId } });
  const byName = new Map(existing.map((d) => [d.name.trim().toLowerCase(), d]));

  const out: MirrorDomain[] = [];
  for (const input of inputs) {
    const seeds = depthToProfile(input.depth, input.evidence);
    const text = input.anchors.length ? `${input.name}. ${input.anchors.join(", ")}` : input.name;
    const emb = await embed(text);

    const prev = byName.get(input.name.trim().toLowerCase());
    const data = {
      name: input.name,
      anchors: JSON.stringify(input.anchors),
      embedding: vecToBytes(emb),
      confidence: seeds.confidence,
      depth: input.depth,
    };
    const row = prev
      ? await prisma.interestDomain.update({
          where: { id: prev.id },
          // Never shrink a learned posterior: keep the stronger alpha.
          data: { ...data, alpha: Math.max(prev.alpha, seeds.alpha) },
        })
      : await prisma.interestDomain.create({
          data: { ...data, learnerId, alpha: seeds.alpha, beta: seeds.beta },
        });

    // Second brain: the domain as an interest item, its verified anchors as
    // leaves, and the role as a plain signal — all weighted by evidence.
    await recordSignal({
      learnerId,
      kind: "interest",
      label: input.name,
      text,
      weight: seeds.interestWeight,
      embedding: emb,
      sourceRef: row.id,
    });
    for (const anchor of input.anchors.slice(0, 6)) {
      await recordSignal({
        learnerId,
        kind: "anchor",
        label: anchor,
        text: `${anchor} (${input.name})`,
        weight: seeds.anchorWeight,
        sourceRef: row.id,
      });
    }
    if (input.role) {
      await recordSignal({
        learnerId,
        kind: "signal",
        label: `${input.name} · ${input.role}`,
        text: `${input.role} — ${input.name}`,
        weight: 0.6,
        sourceRef: row.id,
      });
    }

    out.push({
      id: row.id,
      name: row.name,
      tagline: input.tagline,
      depth: input.depth,
      evidence: input.evidence,
      confidence: row.confidence,
      anchors: input.anchors,
    });
  }
  return out;
}
