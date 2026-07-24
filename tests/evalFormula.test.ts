import { describe, it, expect } from "vitest";
import { evalExpression } from "@/lib/learn/evalFormula";

describe("safe formula evaluator", () => {
  it("evaluates arithmetic with precedence and parentheses", () => {
    expect(evalExpression("2 + 3 * 4", {})).toBe(14);
    expect(evalExpression("(2 + 3) * 4", {})).toBe(20);
    expect(evalExpression("2 ^ 3 ^ 2", {})).toBe(512); // right-assoc
    expect(evalExpression("-3 + 5", {})).toBe(2);
    expect(evalExpression("10 / 4", {})).toBe(2.5);
  });

  it("resolves variables and constants", () => {
    expect(evalExpression("m * a", { m: 2, a: 9.8 })).toBeCloseTo(19.6);
    expect(evalExpression("0.5 * m * v^2", { m: 4, v: 3 })).toBe(18);
    expect(evalExpression("2 * pi * r", { r: 1 })).toBeCloseTo(2 * Math.PI);
  });

  it("supports whitelisted functions with correct arity", () => {
    expect(evalExpression("sqrt(16)", {})).toBe(4);
    expect(evalExpression("max(3, 7)", {})).toBe(7);
    expect(evalExpression("pow(2, 10)", {})).toBe(1024);
    expect(evalExpression("sqrt(2, 3)", {})).toBeNull(); // wrong arity
  });

  it("rejects anything outside the grammar (no code execution)", () => {
    expect(evalExpression("process.exit(1)", {})).toBeNull();
    expect(evalExpression("1; drop table", {})).toBeNull();
    expect(evalExpression("alert(1)", {})).toBeNull(); // unknown function
    expect(evalExpression("m + ", { m: 1 })).toBeNull();
    expect(evalExpression("__proto__", {})).toBeNull(); // unknown identifier
    expect(evalExpression("2 + unknownVar", {})).toBeNull();
  });

  it("returns null for non-finite results", () => {
    expect(evalExpression("1 / 0", {})).toBeNull();
  });
});
