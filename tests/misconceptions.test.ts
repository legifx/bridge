import { describe, it, expect } from "vitest";
import { parseMisconceptions } from "@/lib/misconceptions";
import { dedupeConcepts } from "@/lib/extraction/dedupe";
import type { ExtractedConcept } from "@/lib/extraction/types";

describe("parseMisconceptions", () => {
  it("reads a stored JSON array", () => {
    expect(parseMisconceptions('["that O2 comes from the CO2","that energy is created"]')).toEqual([
      "that O2 comes from the CO2",
      "that energy is created",
    ]);
  });

  // Rows written before extract@6 carry null, and a learner-facing request must
  // not throw over a field that is only an optimisation.
  it("degrades to empty for legacy, malformed and non-array values", () => {
    expect(parseMisconceptions(null)).toEqual([]);
    expect(parseMisconceptions(undefined)).toEqual([]);
    expect(parseMisconceptions("not json")).toEqual([]);
    expect(parseMisconceptions('{"a":1}')).toEqual([]);
  });

  it("drops non-string and blank entries and caps the list", () => {
    expect(parseMisconceptions('["a", 3, "", "  ", "b", "c", "d"]')).toEqual(["a", "b", "c"]);
  });
});

describe("dedupeConcepts + misconceptions", () => {
  const concept = (id: string, traps?: string[]): ExtractedConcept => ({
    id,
    label: id,
    definition: `${id} definition`,
    sourceQuote: `${id} quote`,
    difficulty: 2,
    prerequisiteIds: [],
    commonMisconceptions: traps,
  });

  it("unions the traps of merged duplicates, capped at three", () => {
    const vec = (v: number[]) => Float32Array.from(v);
    const merged = dedupeConcepts(
      [concept("a", ["t1", "t2"]), concept("b", ["t2", "t3", "t4"])],
      [vec([1, 0]), vec([1, 0])], // identical → merged
    );
    expect(merged.concepts).toHaveLength(1);
    expect(merged.concepts[0].commonMisconceptions).toEqual(["t1", "t2", "t3"]);
  });

  it("leaves a concept without traps as an empty list", () => {
    const merged = dedupeConcepts([concept("a")], [Float32Array.from([1, 0])]);
    expect(merged.concepts[0].commonMisconceptions).toEqual([]);
  });
});
