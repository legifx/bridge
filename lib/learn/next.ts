import { MASTERY_FORMING } from "@/lib/mastery";

/**
 * What should this learner do next — and what is standing in the way?
 *
 * The prerequisite graph and the mastery estimate were both computed and then
 * used only to sort a list. Nobody was ever told "this builds on something you
 * have not got yet", which is the single most useful thing a prerequisite edge
 * can say. These are pure functions over data the app already has, so the rule
 * is inspectable and testable rather than buried in a component.
 */

export type NextCandidate = {
  id: string;
  mastery: number;
  reviewEnabled: boolean;
  dueAt: string | null;
  /** true once the learner has actually sat a check on it */
  started: boolean;
};

export type Edge = { from: string; to: string };

/** A concept counts as solid enough to build on at the "forming" band. */
export const PREREQ_READY = MASTERY_FORMING;

/**
 * Prerequisites of `conceptId` that are not solid yet, most fragile first.
 * These are the concepts to name when a learner opens something too early.
 */
export function blockingPrerequisites(
  conceptId: string,
  concepts: NextCandidate[],
  edges: Edge[],
): NextCandidate[] {
  const byId = new Map(concepts.map((c) => [c.id, c]));
  return edges
    .filter((e) => e.to === conceptId)
    .map((e) => byId.get(e.from))
    .filter((c): c is NextCandidate => Boolean(c) && c!.mastery < PREREQ_READY)
    .sort((a, b) => a.mastery - b.mastery);
}

export type Recommendation =
  | { kind: "due"; id: string }
  | { kind: "ready"; id: string }
  | { kind: "weakest"; id: string }
  | null;

/**
 * The next concept worth opening.
 *
 *   due     — spaced repetition says now, and forgetting beats new material
 *   ready   — not started, and everything it builds on is solid
 *   weakest — nothing is due and nothing is unblocked, so shore up the shakiest
 *
 * `order` is the topologically sorted learning order, used as the tie-break so
 * the suggestion follows the material's own sequence rather than an id.
 */
export function recommendNext(
  concepts: NextCandidate[],
  edges: Edge[],
  order: string[],
  now: number,
): Recommendation {
  if (concepts.length === 0) return null;
  const rank = new Map(order.map((id, i) => [id, i]));
  const seq = (c: NextCandidate) => rank.get(c.id) ?? Number.MAX_SAFE_INTEGER;

  const due = concepts
    .filter((c) => c.reviewEnabled && c.dueAt !== null && new Date(c.dueAt).getTime() <= now)
    // most overdue first: the one closest to being forgotten
    .sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime());
  if (due.length > 0) return { kind: "due", id: due[0].id };

  const ready = concepts
    .filter((c) => !c.started && blockingPrerequisites(c.id, concepts, edges).length === 0)
    .sort((a, b) => seq(a) - seq(b));
  if (ready.length > 0) return { kind: "ready", id: ready[0].id };

  const weakest = [...concepts].sort((a, b) => a.mastery - b.mastery || seq(a) - seq(b));
  return weakest.length > 0 ? { kind: "weakest", id: weakest[0].id } : null;
}
