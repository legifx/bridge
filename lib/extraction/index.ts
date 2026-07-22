/**
 * Stage 1 orchestration — Vision/Text → Concept Graph.
 *
 *   raw material  --LLM-->  ExtractedConcept[]
 *                 --local embeddings-->  dedupe (cosine >= 0.86)
 *                 --our code-->  prerequisite DAG, cycle check, topo sort
 *
 * The LLM only returns concepts. All graph logic is our own code.
 */
import { llmJson, type ImageInput } from "@/lib/llm/client";
import { embed } from "@/lib/ml/embeddings";
import { EXTRACT_SYSTEM } from "@/lib/prompts/extract";
import { dedupeConcepts } from "./dedupe";
import { topologicalSort, type Edge } from "./graph";
import { ExtractionResultSchema, type ConceptGraph } from "./types";

export type ExtractInput = {
  text?: string;
  images?: ImageInput[];
};

export type ExtractOutput = {
  graph: ConceptGraph;
  /** canonical concept id -> embedding, for persistence and Stage-3 matching. */
  embeddings: Map<string, Float32Array>;
};

/** Text used to embed a concept — label carries the most signal, definition disambiguates. */
function conceptText(label: string, definition: string): string {
  return `${label}. ${definition}`;
}

export async function extractConceptGraph(input: ExtractInput): Promise<ExtractOutput> {
  const userText =
    input.text?.trim() ||
    "Extract the concept graph from the attached image(s) of study material.";

  const { concepts } = await llmJson({
    system: EXTRACT_SYSTEM,
    user: userText,
    images: input.images,
    schema: ExtractionResultSchema,
    temperature: 0.2,
  });

  // Embed every raw concept (order preserved) for dedupe.
  const rawEmbeddings = await Promise.all(
    concepts.map((c) => embed(conceptText(c.label, c.definition))),
  );

  const { concepts: merged, idMap } = dedupeConcepts(concepts, rawEmbeddings);

  // Map canonical id -> its embedding (embedding of the cluster's canonical concept).
  const embByOriginalId = new Map<string, Float32Array>();
  concepts.forEach((c, i) => embByOriginalId.set(c.id, rawEmbeddings[i]));
  const embeddings = new Map<string, Float32Array>();
  for (const c of merged) embeddings.set(c.id, embByOriginalId.get(c.id)!);

  // Build edges (prerequisite -> concept) from remapped prerequisiteIds.
  const ids = merged.map((c) => c.id);
  const idSet = new Set(ids);
  const edges: Edge[] = [];
  for (const c of merged) {
    for (const p of c.prerequisiteIds) {
      const from = idMap.get(p) ?? p;
      if (idSet.has(from) && from !== c.id) edges.push({ from, to: c.id });
    }
  }

  const { order, hadCycle } = topologicalSort(ids, edges);

  return {
    graph: { concepts: merged, edges, order, hadCycle },
    embeddings,
  };
}
