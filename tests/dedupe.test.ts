import { describe, it, expect } from "vitest";
import { dedupeConcepts } from "@/lib/extraction/dedupe";
import type { ExtractedConcept } from "@/lib/extraction/types";

function c(id: string, prerequisiteIds: string[] = []): ExtractedConcept {
  return { id, label: id, definition: `def ${id}`, sourceQuote: id, difficulty: 2, prerequisiteIds };
}

// Simple 2-D unit vectors so cosine is easy to reason about.
const V = {
  ionA: new Float32Array([1, 0]),
  ionB: new Float32Array([0.99, 0.01]), // ~identical to ionA -> should merge
  atom: new Float32Array([0, 1]), // orthogonal -> stays separate
};

describe("dedupeConcepts", () => {
  it("merges near-duplicate concepts above the threshold", () => {
    const concepts = [c("ion"), c("ion-charged"), c("atom")];
    const embeddings = [V.ionA, V.ionB, V.atom];
    const { concepts: merged, idMap } = dedupeConcepts(concepts, embeddings, 0.86);

    expect(merged).toHaveLength(2); // ion + ion-charged collapse
    const canonical = idMap.get("ion-charged");
    expect(canonical).toBe("ion"); // earliest is canonical
    const ionNode = merged.find((m) => m.id === "ion")!;
    expect(ionNode.mergedFrom).toContain("ion-charged");
  });

  it("keeps distinct concepts separate", () => {
    const concepts = [c("ion"), c("atom")];
    const { concepts: merged } = dedupeConcepts(concepts, [V.ionA, V.atom], 0.86);
    expect(merged).toHaveLength(2);
  });

  it("remaps prerequisite ids to canonical ids and drops self-references", () => {
    // "bond" requires "ion-charged", which merges into "ion".
    const concepts = [c("ion"), c("ion-charged"), c("bond", ["ion-charged"])];
    const embeddings = [V.ionA, V.ionB, new Float32Array([-1, 0])];
    const { concepts: merged } = dedupeConcepts(concepts, embeddings, 0.86);
    const bond = merged.find((m) => m.id === "bond")!;
    expect(bond.prerequisiteIds).toEqual(["ion"]);
  });
});
