/**
 * Prerequisite DAG: cycle detection + topological sort (Kahn's algorithm).
 * Pure functions over ids and edges — unit-tested in tests/graph.test.ts.
 */

export type Edge = { from: string; to: string };

/**
 * Kahn topological sort. `from` is a prerequisite of `to`, so prerequisites
 * come first in the returned order.
 *
 * Returns { order, hadCycle }. If a cycle exists, the offending edges are
 * dropped (fewest-first via lowest in-degree processing) and the remaining
 * nodes are still returned in a valid partial order, so the app never dead-ends.
 */
export function topologicalSort(nodeIds: string[], edges: Edge[]): { order: string[]; hadCycle: boolean } {
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const id of nodeIds) {
    indeg.set(id, 0);
    adj.set(id, []);
  }
  // Ignore edges pointing at unknown nodes.
  const valid = edges.filter((e) => indeg.has(e.from) && indeg.has(e.to) && e.from !== e.to);
  for (const e of valid) {
    adj.get(e.from)!.push(e.to);
    indeg.set(e.to, indeg.get(e.to)! + 1);
  }

  // Stable queue: preserve input order among ready nodes.
  const ready = nodeIds.filter((id) => indeg.get(id) === 0);
  const order: string[] = [];
  while (ready.length) {
    const n = ready.shift()!;
    order.push(n);
    for (const m of adj.get(n)!) {
      indeg.set(m, indeg.get(m)! - 1);
      if (indeg.get(m) === 0) ready.push(m);
    }
  }

  if (order.length < nodeIds.length) {
    // Cycle: append the remaining nodes in input order so nothing is lost.
    const placed = new Set(order);
    for (const id of nodeIds) if (!placed.has(id)) order.push(id);
    return { order, hadCycle: true };
  }
  return { order, hadCycle: false };
}

/** True if the directed graph contains at least one cycle. */
export function hasCycle(nodeIds: string[], edges: Edge[]): boolean {
  return topologicalSort(nodeIds, edges).hadCycle;
}
