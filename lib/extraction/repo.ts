import { prisma } from "@/lib/db/prisma";
import { topologicalSort, type Edge } from "./graph";

export type ConceptVM = {
  id: string;
  label: string;
  definition: string;
  sourceQuote: string;
  difficulty: number;
  elo: number;
  mastery: number; // 0..1, for coloring nodes
  sourceId: string | null;
  reviewEnabled: boolean;
  dueAt: string | null; // next spaced-repetition due date, if any reviews exist
  /** demo quota: this aspect is already paid for, so opening it costs nothing */
  charged: boolean;
};

export type SourceVM = {
  id: string;
  title: string;
  subject: string | null;
  kind: string;
  createdAt: string;
  count: number;
};

export type LearnerGraph = {
  concepts: ConceptVM[];
  sources: SourceVM[];
  edges: Edge[];
  order: string[]; // concept ids in learning order
};

/** Map an Elo (default 1200) to a 0..1 mastery band for the concept map. */
export function eloToMastery(elo: number): number {
  return Math.max(0, Math.min(1, (elo - 1000) / 600));
}

export async function getLearnerGraph(learnerId: string): Promise<LearnerGraph> {
  const concepts = await prisma.concept.findMany({
    where: { learnerId },
    orderBy: { id: "asc" },
    include: { reviews: { orderBy: { answeredAt: "desc" }, take: 1 } },
  });
  const sources = await prisma.source.findMany({
    where: { learnerId },
    orderBy: { createdAt: "asc" },
  });
  const ids = concepts.map((c) => c.id);
  const idSet = new Set(ids);

  const edgeRows = await prisma.conceptEdge.findMany({
    where: { fromConceptId: { in: ids }, toConceptId: { in: ids } },
  });
  const edges: Edge[] = edgeRows
    .filter((e) => idSet.has(e.fromConceptId) && idSet.has(e.toConceptId))
    .map((e) => ({ from: e.fromConceptId, to: e.toConceptId }));

  const { order } = topologicalSort(ids, edges);

  const countBySource = new Map<string, number>();
  for (const c of concepts) {
    if (c.sourceId) countBySource.set(c.sourceId, (countBySource.get(c.sourceId) ?? 0) + 1);
  }

  return {
    concepts: concepts.map((c) => ({
      id: c.id,
      label: c.label,
      definition: c.definition,
      sourceQuote: c.sourceQuote,
      difficulty: c.difficulty,
      elo: c.elo,
      mastery: eloToMastery(c.elo),
      sourceId: c.sourceId,
      reviewEnabled: c.reviewEnabled,
      dueAt: c.reviews[0]?.nextDueAt.toISOString() ?? null,
      charged: c.charged,
    })),
    sources: sources.map((s) => ({
      id: s.id,
      title: s.title ?? "Untitled capture",
      subject: s.subject,
      kind: s.kind,
      createdAt: s.createdAt.toISOString(),
      count: countBySource.get(s.id) ?? 0,
    })),
    edges,
    order,
  };
}
