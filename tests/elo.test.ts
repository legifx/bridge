import { describe, it, expect } from "vitest";
import { updateElo, expectedScore, difficultyToElo, DEFAULT_ELO } from "@/lib/adaptive/elo";

describe("Elo mastery", () => {
  it("expected score is 0.5 for equal ratings", () => {
    expect(expectedScore(1200, 1200)).toBeCloseTo(0.5, 5);
  });

  it("a correct answer raises ability and lowers concept difficulty", () => {
    const { ability, difficulty } = updateElo(1200, 1200, true);
    expect(ability).toBeGreaterThan(1200);
    expect(difficulty).toBeLessThan(1200);
  });

  it("a wrong answer lowers ability and raises concept difficulty", () => {
    const { ability, difficulty } = updateElo(1200, 1200, false);
    expect(ability).toBeLessThan(1200);
    expect(difficulty).toBeGreaterThan(1200);
  });

  it("rating changes are symmetric (zero-sum)", () => {
    const before = 1200;
    const { ability, difficulty } = updateElo(before, before, true);
    expect(ability - before).toBeCloseTo(before - difficulty, 5);
  });

  it("beating a much harder concept gains more than beating an easy one", () => {
    const hard = updateElo(1200, 1600, true).ability - 1200;
    const easy = updateElo(1200, 1000, true).ability - 1200;
    expect(hard).toBeGreaterThan(easy);
  });

  it("difficultyToElo maps 1..5 onto a rising scale", () => {
    expect(difficultyToElo(1)).toBe(1000);
    expect(difficultyToElo(5)).toBe(1600);
    expect(difficultyToElo(3)).toBeLessThan(DEFAULT_ELO + 200);
  });
});
