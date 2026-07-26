import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * The ceiling that did not exist when the provider key hit its own daily cap.
 * What matters here is the failure MODE: refuse before spending, name the real
 * reason, and never let a bookkeeping problem become an outage.
 */
const db = { aiSpend: { findUnique: vi.fn(), upsert: vi.fn() } };
vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
const reported: Array<[string, string]> = [];
vi.mock("@/lib/observability/report", () => ({
  reportError: (where: string, message: string) => reported.push([where, message]),
  reportWarn: (where: string, message: string) => reported.push([where, message]),
}));

const ENV = { ...process.env };
beforeEach(() => {
  vi.resetAllMocks();
  reported.length = 0;
  process.env.AI_DAILY_BUDGET_USD = "1";
});
afterEach(() => {
  process.env = { ...ENV };
});

const mod = () => import("@/lib/llm/budget");

describe("dailyBudgetUsd", () => {
  it("is off unless configured with a positive number", async () => {
    const { dailyBudgetUsd } = await mod();
    expect(dailyBudgetUsd()).toBe(1);
    for (const bad of ["0", "-2", "abc", ""]) {
      process.env.AI_DAILY_BUDGET_USD = bad;
      expect(dailyBudgetUsd()).toBe(0);
    }
    delete process.env.AI_DAILY_BUDGET_USD;
    expect(dailyBudgetUsd()).toBe(0);
  });
});

describe("todayKey", () => {
  it("is a UTC day key, so instances in different regions share one bucket", async () => {
    const { todayKey } = await mod();
    expect(todayKey(new Date("2026-07-26T23:30:00+02:00"))).toBe("2026-07-26");
    expect(todayKey(new Date("2026-07-27T00:30:00Z"))).toBe("2026-07-27");
  });
});

describe("assertWithinBudget", () => {
  it("allows a call below the ceiling", async () => {
    db.aiSpend.findUnique.mockResolvedValue({ microUsd: 400_000, calls: 12 });
    const { assertWithinBudget } = await mod();
    await expect(assertWithinBudget()).resolves.toBeUndefined();
  });

  it("refuses once the ceiling is reached", async () => {
    db.aiSpend.findUnique.mockResolvedValue({ microUsd: 1_000_000, calls: 30 });
    const { assertWithinBudget, BudgetExhaustedError } = await mod();
    await expect(assertWithinBudget()).rejects.toBeInstanceOf(BudgetExhaustedError);
  });

  it("does nothing at all when no ceiling is configured", async () => {
    delete process.env.AI_DAILY_BUDGET_USD;
    const { assertWithinBudget } = await mod();
    await expect(assertWithinBudget()).resolves.toBeUndefined();
    expect(db.aiSpend.findUnique).not.toHaveBeenCalled();
  });

  // A cost guard that cannot read its ledger must not take the app down with it.
  it("fails open and reports when the ledger is unreadable", async () => {
    db.aiSpend.findUnique.mockRejectedValue(new Error("db down"));
    const { assertWithinBudget } = await mod();
    await expect(assertWithinBudget()).resolves.toBeUndefined();
    expect(reported.some(([where]) => where === "llm/budget")).toBe(true);
  });
});

describe("recordSpend", () => {
  it("increments atomically rather than writing back a read value", async () => {
    db.aiSpend.upsert.mockResolvedValue({});
    db.aiSpend.findUnique.mockResolvedValue({ microUsd: 10, calls: 1 });
    const { recordSpend } = await mod();
    await recordSpend(0.000_012_5, "test-model");

    const arg = db.aiSpend.upsert.mock.calls[0][0];
    expect(arg.update.microUsd).toEqual({ increment: 13 }); // rounded from 12.5
    expect(arg.update.calls).toEqual({ increment: 1 });
  });

  it("ignores zero, negative and missing costs", async () => {
    const { recordSpend } = await mod();
    await recordSpend(0, "m");
    await recordSpend(-1, "m");
    await recordSpend(NaN, "m");
    expect(db.aiSpend.upsert).not.toHaveBeenCalled();
  });

  it("never throws when the ledger write fails", async () => {
    db.aiSpend.upsert.mockRejectedValue(new Error("db down"));
    const { recordSpend } = await mod();
    await expect(recordSpend(0.01, "m")).resolves.toBeUndefined();
    expect(reported.some(([, msg]) => /record spend/.test(msg))).toBe(true);
  });
});

describe("isProviderBudgetError", () => {
  it("recognizes the provider running out of credit", async () => {
    const { isProviderBudgetError } = await mod();
    expect(isProviderBudgetError({ status: 402 })).toBe(true);
    // The exact text OpenRouter returned on 2026-07-26.
    expect(isProviderBudgetError({ message: "This request requires more credits, or fewer max_tokens." })).toBe(true);
    expect(isProviderBudgetError({ status: 500, message: "upstream exploded" })).toBe(false);
    expect(isProviderBudgetError(null)).toBe(false);
  });
});
