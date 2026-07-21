import { describe, it, expect } from "vitest";
import { topologicalSort, hasCycle } from "@/lib/extraction/graph";

describe("topologicalSort", () => {
  it("orders prerequisites before dependents", () => {
    const nodes = ["ionic-bond", "atom", "ion", "valence"];
    const edges = [
      { from: "atom", to: "valence" },
      { from: "valence", to: "ion" },
      { from: "ion", to: "ionic-bond" },
    ];
    const { order, hadCycle } = topologicalSort(nodes, edges);
    expect(hadCycle).toBe(false);
    expect(order.indexOf("atom")).toBeLessThan(order.indexOf("valence"));
    expect(order.indexOf("valence")).toBeLessThan(order.indexOf("ion"));
    expect(order.indexOf("ion")).toBeLessThan(order.indexOf("ionic-bond"));
  });

  it("keeps all nodes even with no edges, in input order", () => {
    const nodes = ["a", "b", "c"];
    const { order, hadCycle } = topologicalSort(nodes, []);
    expect(hadCycle).toBe(false);
    expect(order).toEqual(["a", "b", "c"]);
  });

  it("detects a cycle and still returns every node", () => {
    const nodes = ["a", "b", "c"];
    const edges = [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
      { from: "c", to: "a" },
    ];
    const { order, hadCycle } = topologicalSort(nodes, edges);
    expect(hadCycle).toBe(true);
    expect([...order].sort()).toEqual(["a", "b", "c"]);
  });

  it("ignores edges to unknown nodes and self-loops", () => {
    const nodes = ["a", "b"];
    const edges = [
      { from: "a", to: "a" },
      { from: "a", to: "ghost" },
      { from: "a", to: "b" },
    ];
    const { order, hadCycle } = topologicalSort(nodes, edges);
    expect(hadCycle).toBe(false);
    expect(order).toEqual(["a", "b"]);
  });

  it("hasCycle agrees with topologicalSort", () => {
    expect(hasCycle(["a", "b"], [{ from: "a", to: "b" }])).toBe(false);
    expect(
      hasCycle(["a", "b"], [
        { from: "a", to: "b" },
        { from: "b", to: "a" },
      ]),
    ).toBe(true);
  });
});
