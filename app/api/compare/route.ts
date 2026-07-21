import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { cosine, bytesToVec } from "@/lib/ml/vector";
import { embed } from "@/lib/ml/embeddings";
import type { BridgeBody } from "@/lib/bridge/types";

/** Best-anchor similarity — the same metric the learn session shows. */
async function bestAnchorSimilarity(conceptVec: Float32Array, anchorsJson: string): Promise<number> {
  let anchors: string[] = [];
  try {
    const v = JSON.parse(anchorsJson);
    if (Array.isArray(v)) anchors = v.filter((x) => typeof x === "string");
  } catch {
    /* ignore */
  }
  let best = 0;
  for (const a of anchors) best = Math.max(best, cosine(conceptVec, await embed(a)));
  return Math.max(0, Math.min(1, best));
}

export const runtime = "nodejs";

/**
 * Split-screen data (§8, §11): the SAME concept, bridged through two maximally
 * different interest profiles. Reads pre-generated accepted bridges so the
 * comparison is instant and needs no API key.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const label = url.searchParams.get("concept");

  const learners = await prisma.learner.findMany({ orderBy: { createdAt: "asc" }, take: 2 });
  if (learners.length < 2) {
    return NextResponse.json({ error: "Need two seeded profiles to compare.", panels: [] }, { status: 200 });
  }

  // Labels present for the first learner — the selectable concepts.
  const firstConcepts = await prisma.concept.findMany({
    where: { learnerId: learners[0].id },
    select: { label: true },
    orderBy: { difficulty: "asc" },
  });
  const labels = [...new Set(firstConcepts.map((c) => c.label))];
  const chosen = label && labels.includes(label) ? label : labels[0];

  const panels = [];
  for (const learner of learners) {
    const concept = await prisma.concept.findFirst({ where: { learnerId: learner.id, label: chosen } });
    if (!concept) continue;
    const bridge = await prisma.bridge.findFirst({
      where: { conceptId: concept.id, status: "accepted" },
      orderBy: { createdAt: "desc" },
      include: { domain: true },
    });
    if (!bridge) {
      panels.push({ displayName: learner.displayName, domainName: null, similarity: 0, body: null });
      continue;
    }
    const similarity = concept.embedding
      ? await bestAnchorSimilarity(bytesToVec(concept.embedding), bridge.domain.anchors)
      : 0;
    panels.push({
      displayName: learner.displayName,
      domainName: bridge.domain.name,
      similarity,
      body: JSON.parse(bridge.body) as BridgeBody,
    });
  }

  return NextResponse.json({ concept: chosen, labels, panels });
}
