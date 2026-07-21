/**
 * Embedding dedupe (BUILD_PROMPT §3, Stage 1).
 * The same concept coming from a photo and from a textbook should merge into
 * one node. We compare concept embeddings by cosine similarity and union any
 * pair above a threshold. Pure + unit-tested (tests/dedupe.test.ts).
 */
import { cosine } from "@/lib/ml/vector";
import type { ExtractedConcept, GraphConcept } from "./types";

export const DEDUPE_THRESHOLD = 0.86;

class UnionFind {
  private parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]];
      x = this.parent[x];
    }
    return x;
  }
  union(a: number, b: number) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[Math.max(ra, rb)] = Math.min(ra, rb); // keep earliest as root
  }
}

export type DedupeResult = {
  concepts: GraphConcept[];
  /** maps every original id (including merged-away ones) to its canonical id. */
  idMap: Map<string, string>;
};

/**
 * Merge near-duplicate concepts. `embeddings[i]` must correspond to
 * `concepts[i]`. The earliest occurrence of a cluster is canonical; its
 * definition/label win, and merged ids are recorded in `mergedFrom`.
 */
export function dedupeConcepts(
  concepts: ExtractedConcept[],
  embeddings: Float32Array[],
  threshold = DEDUPE_THRESHOLD,
): DedupeResult {
  const n = concepts.length;
  const uf = new UnionFind(n);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (cosine(embeddings[i], embeddings[j]) >= threshold) uf.union(i, j);
    }
  }

  // Group indices by canonical root.
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = uf.find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(i);
  }

  // Canonical id per original index.
  const idMap = new Map<string, string>();
  for (const [root, members] of groups) {
    const canonicalId = concepts[root].id;
    for (const m of members) idMap.set(concepts[m].id, canonicalId);
  }

  const merged: GraphConcept[] = [];
  for (const [root, members] of groups) {
    const base = concepts[root];
    // Union all prerequisites, remapped to canonical ids, minus self-references.
    const prereqs = new Set<string>();
    for (const m of members) {
      for (const p of concepts[m].prerequisiteIds) {
        const mapped = idMap.get(p) ?? p;
        if (mapped !== base.id) prereqs.add(mapped);
      }
    }
    merged.push({
      ...base,
      prerequisiteIds: [...prereqs],
      mergedFrom: members.filter((m) => m !== root).map((m) => concepts[m].id),
    });
  }

  return { concepts: merged, idMap };
}
