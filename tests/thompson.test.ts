import { describe, it, expect } from "vitest";
import { updateBeta, successRate, selectArm, type Arm } from "@/lib/adaptive/thompson";
import { mulberry32 } from "@/lib/adaptive/rng";

describe("Thompson sampling", () => {
  it("updates alpha on success and beta on failure", () => {
    expect(updateBeta({ alpha: 1, beta: 1 }, true)).toEqual({ alpha: 2, beta: 1 });
    expect(updateBeta({ alpha: 1, beta: 1 }, false)).toEqual({ alpha: 1, beta: 2 });
  });

  it("successRate is the posterior mean", () => {
    expect(successRate({ alpha: 3, beta: 1 })).toBeCloseTo(0.75, 5);
  });

  it("favors the arm with the stronger posterior over many draws", () => {
    const arms: Arm[] = [
      { id: "good", alpha: 30, beta: 3 }, // ~0.91
      { id: "bad", alpha: 3, beta: 30 }, // ~0.09
    ];
    const rng = mulberry32(42);
    let goodWins = 0;
    for (let i = 0; i < 200; i++) {
      if (selectArm(arms, rng).chosenId === "good") goodWins++;
    }
    expect(goodWins).toBeGreaterThan(180); // strongly prefers the good arm
  });

  it("still explores an uncertain arm sometimes", () => {
    const arms: Arm[] = [
      { id: "known", alpha: 8, beta: 4 }, // ~0.67, fairly certain
      { id: "unknown", alpha: 1, beta: 1 }, // uniform — high variance
    ];
    const rng = mulberry32(7);
    let unknownChosen = 0;
    for (let i = 0; i < 200; i++) {
      if (selectArm(arms, rng).chosenId === "unknown") unknownChosen++;
    }
    // exploration: the uniform arm wins a meaningful minority of the time
    expect(unknownChosen).toBeGreaterThan(20);
    expect(unknownChosen).toBeLessThan(180);
  });

  it("is deterministic for a fixed seed", () => {
    const arms: Arm[] = [
      { id: "a", alpha: 2, beta: 2 },
      { id: "b", alpha: 5, beta: 1 },
    ];
    const first = selectArm(arms, mulberry32(99)).chosenId;
    const second = selectArm(arms, mulberry32(99)).chosenId;
    expect(first).toBe(second);
  });
});
