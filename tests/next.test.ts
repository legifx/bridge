import { describe, it, expect } from "vitest";
import { recommendNext, blockingPrerequisites, type NextCandidate, type Edge } from "@/lib/learn/next";

const c = (
  id: string,
  mastery: number,
  extra: Partial<NextCandidate> = {},
): NextCandidate => ({ id, mastery, reviewEnabled: false, dueAt: null, started: false, ...extra });

const NOW = new Date("2026-07-26T12:00:00Z").getTime();
const ago = (days: number) => new Date(NOW - days * 86400000).toISOString();
const ahead = (days: number) => new Date(NOW + days * 86400000).toISOString();

describe("blockingPrerequisites", () => {
  const edges: Edge[] = [
    { from: "atom", to: "ion" },
    { from: "electron", to: "ion" },
  ];

  it("names the prerequisites that are not solid yet", () => {
    const concepts = [c("atom", 0.8), c("electron", 0.1), c("ion", 0)];
    expect(blockingPrerequisites("ion", concepts, edges).map((x) => x.id)).toEqual(["electron"]);
  });

  it("returns the most fragile one first", () => {
    const concepts = [c("atom", 0.3), c("electron", 0.05), c("ion", 0)];
    expect(blockingPrerequisites("ion", concepts, edges).map((x) => x.id)).toEqual(["electron", "atom"]);
  });

  it("says nothing when everything it builds on is solid", () => {
    const concepts = [c("atom", 0.9), c("electron", 0.7), c("ion", 0)];
    expect(blockingPrerequisites("ion", concepts, edges)).toEqual([]);
  });

  it("ignores edges pointing at other concepts", () => {
    const concepts = [c("atom", 0), c("electron", 0), c("ion", 0)];
    expect(blockingPrerequisites("atom", concepts, edges)).toEqual([]);
  });
});

describe("recommendNext", () => {
  const order = ["atom", "electron", "ion", "bond"];
  const edges: Edge[] = [
    { from: "atom", to: "ion" },
    { from: "ion", to: "bond" },
  ];

  it("puts a due review first — forgetting beats new material", () => {
    const concepts = [
      c("atom", 0.9, { reviewEnabled: true, dueAt: ago(2), started: true }),
      c("electron", 0),
    ];
    expect(recommendNext(concepts, edges, order, NOW)).toEqual({ kind: "due", id: "atom" });
  });

  it("picks the most overdue of several", () => {
    const concepts = [
      c("atom", 0.9, { reviewEnabled: true, dueAt: ago(1), started: true }),
      c("ion", 0.5, { reviewEnabled: true, dueAt: ago(9), started: true }),
    ];
    expect(recommendNext(concepts, edges, order, NOW)).toEqual({ kind: "due", id: "ion" });
  });

  it("ignores reviews that are not due yet", () => {
    const concepts = [
      c("atom", 0.9, { reviewEnabled: true, dueAt: ahead(3), started: true }),
      c("electron", 0),
    ];
    expect(recommendNext(concepts, edges, order, NOW)).toEqual({ kind: "ready", id: "electron" });
  });

  it("suggests an unstarted concept whose prerequisites are solid", () => {
    const concepts = [c("atom", 0.8, { started: true }), c("ion", 0)];
    expect(recommendNext(concepts, edges, order, NOW)).toEqual({ kind: "ready", id: "ion" });
  });

  it("does not suggest something the learner is not ready for", () => {
    // "ion" builds on "atom", which is still shaky — so atom itself is the pick.
    const concepts = [c("atom", 0.1), c("ion", 0)];
    expect(recommendNext(concepts, edges, order, NOW)).toEqual({ kind: "ready", id: "atom" });
  });

  it("follows the material's own order among equally ready concepts", () => {
    const concepts = [c("electron", 0), c("atom", 0)];
    expect(recommendNext(concepts, edges, order, NOW)).toEqual({ kind: "ready", id: "atom" });
  });

  it("falls back to the shakiest concept when everything is started and blocked", () => {
    const concepts = [
      c("atom", 0.7, { started: true }),
      c("ion", 0.2, { started: true }),
      c("bond", 0.45, { started: true }),
    ];
    expect(recommendNext(concepts, edges, order, NOW)).toEqual({ kind: "weakest", id: "ion" });
  });

  it("returns nothing for an empty map", () => {
    expect(recommendNext([], [], [], NOW)).toBeNull();
  });
});
