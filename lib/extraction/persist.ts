import { prisma } from "@/lib/db/prisma";
import { vecToBytes } from "@/lib/ml/embeddings";
import type { ConceptGraph } from "./types";

/**
 * Persist a concept graph for a learner: one Source, its Concepts (with stored
 * embeddings), and the prerequisite edges. Returns the DB ids in learning order.
 */
export async function saveConceptGraph(params: {
  learnerId: string;
  kind: "photo" | "pdf" | "text";
  rawText: string;
  imagePath?: string;
  graph: ConceptGraph;
  embeddings: Map<string, Float32Array>;
  /** append into an existing capture folder instead of creating a new one */
  existingSourceId?: string;
}): Promise<{ sourceId: string; conceptIdByLabelId: Map<string, string> }> {
  const { learnerId, kind, rawText, imagePath, graph, embeddings, existingSourceId } = params;

  let source;
  if (existingSourceId) {
    const prev = await prisma.source.findFirstOrThrow({
      where: { id: existingSourceId, learnerId },
    });
    source = await prisma.source.update({
      where: { id: prev.id },
      // backfill the parent subject if this folder never got one
      data: { rawText: `${prev.rawText}\n\n---\n\n${rawText}`, subject: prev.subject ?? graph.subject },
    });
  } else {
    source = await prisma.source.create({
      data: { learnerId, kind, rawText, imagePath, title: graph.title, subject: graph.subject },
    });
  }

  // Create concepts, mapping each extraction id -> DB cuid.
  const idMap = new Map<string, string>();
  for (const c of graph.concepts) {
    const emb = embeddings.get(c.id);
    const created = await prisma.concept.create({
      data: {
        learnerId,
        sourceId: source.id,
        label: c.label,
        definition: c.definition,
        sourceQuote: c.sourceQuote,
        difficulty: c.difficulty,
        embedding: emb ? vecToBytes(emb) : null,
      },
    });
    idMap.set(c.id, created.id);
  }

  // Create prerequisite edges using DB ids.
  for (const e of graph.edges) {
    const from = idMap.get(e.from);
    const to = idMap.get(e.to);
    if (from && to) {
      await prisma.conceptEdge.create({ data: { fromConceptId: from, toConceptId: to } });
    }
  }

  return { sourceId: source.id, conceptIdByLabelId: idMap };
}
