import { describe, it, expect } from "vitest";
import { clusterItems, type BrainVec } from "@/lib/brain/cluster";

function v(id: string, label: string, weight: number, vec: number[]): BrainVec {
  return { id, kind: "interest", label, weight, vec: new Float32Array(vec) };
}

describe("brain clustering", () => {
  it("groups nearby vectors and separates distant ones", () => {
    const items = [
      v("a", "gaming", 2, [1, 0.05, 0]),
      v("b", "esports", 1, [0.98, 0.1, 0]),
      v("c", "horses", 1.5, [0, 1, 0.05]),
    ];
    const clusters = clusterItems(items, 0.55);
    expect(clusters).toHaveLength(2);
    expect(clusters[0].items.map((i) => i.id).sort()).toEqual(["a", "b"]);
  });

  it("names the cluster after its heaviest member and sums weights", () => {
    const items = [
      v("a", "esports", 1, [1, 0, 0]),
      v("b", "competitive gaming", 3, [0.97, 0.08, 0]),
    ];
    const [c] = clusterItems(items, 0.55);
    expect(c.label).toBe("competitive gaming");
    expect(c.totalWeight).toBeCloseTo(4, 5);
  });

  it("orders clusters by total weight, heaviest first", () => {
    const items = [
      v("a", "small", 0.5, [1, 0, 0]),
      v("b", "big", 5, [0, 1, 0]),
    ];
    const clusters = clusterItems(items, 0.55);
    expect(clusters[0].label).toBe("big");
  });

  it("confidence is 1 for identical members and lower for looser ones", () => {
    const tight = clusterItems([v("a", "x", 1, [1, 0, 0]), v("b", "y", 1, [1, 0, 0])], 0.55)[0];
    const loose = clusterItems([v("a", "x", 1, [1, 0, 0]), v("b", "y", 1, [0.75, 0.66, 0])], 0.55)[0];
    expect(tight.confidence).toBeCloseTo(1, 3);
    expect(loose.confidence).toBeLessThan(tight.confidence);
  });

  it("a lone item forms its own cluster with its own label", () => {
    const clusters = clusterItems([v("a", "astronomy", 1.2, [0, 0, 1])], 0.55);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].label).toBe("astronomy");
    expect(clusters[0].confidence).toBeCloseTo(1, 3);
  });
});
