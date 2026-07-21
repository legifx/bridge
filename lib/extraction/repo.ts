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
};

export type LearnerGraph = {
  concepts: ConceptVM[];
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

  return {
    concepts: concepts.map((c) => ({
      id: c.id,
      label: c.label,
      definition: c.definition,
      sourceQuote: c.sourceQuote,
      difficulty: c.difficulty,
      elo: c.elo,
      mastery: eloToMastery(c.elo),
    })),
    edges,
    order,
  };
}
