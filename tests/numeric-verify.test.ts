import { describe, it, expect } from "vitest";
import { agreedNumerics, type Problem } from "@/lib/quiz";

const numeric = (prompt: string, answer: number, tolerance?: number): Problem => ({
  type: "numeric",
  prompt,
  answer,
  tolerance,
  solution: "worked solution",
});

const open = (prompt: string): Problem => ({ type: "open", prompt, solution: "model answer" });

/**
 * The rule that decides whether a practice problem is allowed to count against
 * a learner. The failure being prevented is the worst one an assessment app
 * has: marking a correct answer wrong because the generator miscalculated, then
 * lowering that learner's mastery on the strength of it.
 */
describe("agreedNumerics", () => {
  it("keeps a problem both solves agree on", () => {
    const problems = [numeric("A 3 kg cart accelerates at 4 m/s². Net force?", 12)];
    const { kept, dropped } = agreedNumerics(problems, [{ index: 0, value: 12 }]);
    expect(kept).toHaveLength(1);
    expect(dropped).toBe(0);
  });

  it("drops a problem the second solve disagrees with", () => {
    const problems = [numeric("A 3 kg cart accelerates at 4 m/s². Net force?", 7)];
    const { kept, dropped } = agreedNumerics(problems, [{ index: 0, value: 12 }]);
    expect(kept).toHaveLength(0);
    expect(dropped).toBe(1);
  });

  it("honours the problem's own tolerance", () => {
    const problems = [numeric("pH of the solution?", 7.0, 0.2)];
    expect(agreedNumerics(problems, [{ index: 0, value: 7.15 }]).kept).toHaveLength(1);
    expect(agreedNumerics(problems, [{ index: 0, value: 7.9 }]).kept).toHaveLength(0);
  });

  it("drops a problem the second solve called unsolvable", () => {
    const problems = [numeric("Speed of the train?", 42)];
    const { kept, dropped } = agreedNumerics(problems, [{ index: 0, value: null }]);
    expect(kept).toHaveLength(0);
    expect(dropped).toBe(1);
  });

  it("drops a problem the second solve skipped entirely", () => {
    // A short or reordered result list must not be read as agreement.
    const problems = [numeric("First?", 1), numeric("Second?", 2)];
    const { kept, dropped } = agreedNumerics(problems, [{ index: 0, value: 1 }]);
    expect(kept).toHaveLength(1);
    expect(dropped).toBe(1);
  });

  it("leaves non-numeric problems alone — this check cannot judge them", () => {
    const problems = [open("Explain why the reaction stops."), numeric("How many moles?", 3)];
    const { kept } = agreedNumerics(problems, [{ index: 1, value: 3 }]);
    expect(kept).toHaveLength(2);
  });

  it("matches results by index, not by position in the list", () => {
    const problems = [open("Why?"), numeric("How many?", 5)];
    // The solver numbered by problem index, so the numeric one is index 1.
    expect(agreedNumerics(problems, [{ index: 1, value: 5 }]).kept).toHaveLength(2);
    // A result claiming index 0 says nothing about the numeric problem.
    expect(agreedNumerics(problems, [{ index: 0, value: 5 }]).kept).toHaveLength(1);
  });

  it("keeps a check usable when every numeric problem fails verification", () => {
    const problems = [numeric("a?", 1), numeric("b?", 2), open("Explain.")];
    const { kept, dropped } = agreedNumerics(problems, [
      { index: 0, value: 9 },
      { index: 1, value: 9 },
    ]);
    expect(dropped).toBe(2);
    expect(kept).toEqual([problems[2]]); // the open question survives
  });
});
