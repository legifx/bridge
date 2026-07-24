import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { cosine, bytesToVec } from "@/lib/ml/vector";
import { embed, EMBEDDINGS_ENABLED } from "@/lib/ml/embeddings";
import type { BridgeBody } from "@/lib/bridge/types";
import { DEMO_HANDLES } from "@/lib/demo/profiles";

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

  // This page is public (no sign-in), so it may only ever read the two seeded
  // demo profiles. Taking "the two oldest learners" happened to be the seeds on
  // this deployment — but on a fresh database it would put two real people's
  // names and study material on an open URL.
  const seeded = await prisma.learner.findMany({
    where: { handle: { in: [...DEMO_HANDLES] } },
    orderBy: { createdAt: "asc" },
  });
  const learners = [...DEMO_HANDLES]
    .map((h) => seeded.find((l) => l.handle === h))
    .filter((l): l is (typeof seeded)[number] => Boolean(l));
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
    // Best-anchor similarity when embeddings are available; otherwise the stored
    // concept<->domain cosine (serverless demo has no runtime embedding model).
    let similarity = 0;
    if (concept.embedding) {
      const cvec = bytesToVec(concept.embedding);
      similarity = EMBEDDINGS_ENABLED
        ? await bestAnchorSimilarity(cvec, bridge.domain.anchors)
        : Math.max(0, Math.min(1, cosine(cvec, bytesToVec(bridge.domain.embedding))));
    }
    panels.push({
      displayName: learner.displayName,
      domainName: bridge.domain.name,
      similarity,
      body: JSON.parse(bridge.body) as BridgeBody,
    });
  }

  return NextResponse.json({ concept: chosen, labels, panels });
}
