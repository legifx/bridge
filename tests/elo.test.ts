import { describe, it, expect } from "vitest";
import { updateEloScore, expectedScore, difficultyToElo, DEFAULT_ELO } from "@/lib/adaptive/elo";

// These tests cover the function the app actually calls on every check. (The
// earlier suite exercised a binary variant that no code path used, which is the
// worst kind of green: it says the mastery maths is tested when it is not.)
describe("Elo mastery", () => {
  it("expected score is 0.5 for equal ratings", () => {
    expect(expectedScore(1200, 1200)).toBeCloseTo(0.5, 5);
  });

  it("a full score raises ability and lowers concept difficulty", () => {
    const { ability, difficulty } = updateEloScore(1200, 1200, 1);
    expect(ability).toBeGreaterThan(1200);
    expect(difficulty).toBeLessThan(1200);
  });

  it("a zero score lowers ability and raises concept difficulty", () => {
    const { ability, difficulty } = updateEloScore(1200, 1200, 0);
    expect(ability).toBeLessThan(1200);
    expect(difficulty).toBeGreaterThan(1200);
  });

  it("scoring exactly what was expected moves nothing", () => {
    const { ability, difficulty } = updateEloScore(1200, 1200, 0.5);
    expect(ability).toBeCloseTo(1200, 5);
    expect(difficulty).toBeCloseTo(1200, 5);
  });

  it("mastery moves continuously with the score, not all-or-nothing", () => {
    const weak = updateEloScore(1200, 1200, 0.55).ability;
    const good = updateEloScore(1200, 1200, 0.8).ability;
    const perfect = updateEloScore(1200, 1200, 1).ability;
    expect(weak).toBeLessThan(good);
    expect(good).toBeLessThan(perfect);
  });

  it("rating changes are symmetric (zero-sum)", () => {
    const before = 1200;
    const { ability, difficulty } = updateEloScore(before, before, 1);
    expect(ability - before).toBeCloseTo(before - difficulty, 5);
  });

  it("beating a much harder concept gains more than beating an easy one", () => {
    const hard = updateEloScore(1200, 1600, 1).ability - 1200;
    const easy = updateEloScore(1200, 1000, 1).ability - 1200;
    expect(hard).toBeGreaterThan(easy);
  });

  it("clamps scores outside 0..1 instead of exploding the rating", () => {
    expect(updateEloScore(1200, 1200, 5).ability).toBeCloseTo(updateEloScore(1200, 1200, 1).ability, 5);
    expect(updateEloScore(1200, 1200, -3).ability).toBeCloseTo(updateEloScore(1200, 1200, 0).ability, 5);
  });

  it("difficultyToElo maps 1..5 onto a rising scale", () => {
    expect(difficultyToElo(1)).toBe(1000);
    expect(difficultyToElo(5)).toBe(1600);
    expect(difficultyToElo(3)).toBeLessThan(DEFAULT_ELO + 200);
  });
});
