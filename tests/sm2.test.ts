import { describe, it, expect } from "vitest";
import { scheduleReview, qualityFromAnswer, INITIAL_SRS } from "@/lib/adaptive/sm2";

describe("SM-2-lite scheduling", () => {
  it("grows the interval 1 -> 6 -> ease-scaled on successive passes", () => {
    const r1 = scheduleReview(INITIAL_SRS, 5);
    expect(r1.interval).toBe(1);
    const r2 = scheduleReview(r1, 5);
    expect(r2.interval).toBe(6);
    const r3 = scheduleReview(r2, 5);
    expect(r3.interval).toBe(Math.round(6 * r3.easeFactor));
    expect(r3.interval).toBeGreaterThan(6);
  });

  it("resets the ladder on a lapse (q < 3)", () => {
    const grown = scheduleReview(scheduleReview(INITIAL_SRS, 5), 5); // interval 6
    const lapsed = scheduleReview(grown, 1);
    expect(lapsed.interval).toBe(1);
    expect(lapsed.repetitions).toBe(0);
  });

  it("never lets the ease factor fall below 1.3", () => {
    let state = INITIAL_SRS;
    for (let i = 0; i < 10; i++) state = scheduleReview(state, 0);
    expect(state.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it("a perfect answer keeps the ease factor from dropping", () => {
    const r = scheduleReview(INITIAL_SRS, 5);
    expect(r.easeFactor).toBeGreaterThanOrEqual(INITIAL_SRS.easeFactor);
  });

  it("qualityFromAnswer maps outcomes into SM-2 range", () => {
    expect(qualityFromAnswer(false)).toBeLessThan(3);
    expect(qualityFromAnswer(true, true)).toBe(5);
    expect(qualityFromAnswer(true, false)).toBe(3);
  });
});
