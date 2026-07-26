import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * The module that decides who pays for a model call had no tests. It is also
 * the only thing standing between a public URL and an unbounded provider bill,
 * so its edges — the double-charge race, the unlimited bypass, the
 * self-hosted-is-free switch — are worth pinning down.
 *
 * Prisma is mocked: these are rules, not queries.
 */
const db = {
  learner: { findUnique: vi.fn(), update: vi.fn() },
  concept: { findUnique: vi.fn(), updateMany: vi.fn() },
};
vi.mock("@/lib/db/prisma", () => ({ prisma: db }));

const ENV = { ...process.env };
beforeEach(() => {
  vi.resetAllMocks();
  process.env.PUBLIC_DEMO = "true"; // quota only applies on the public demo
  delete process.env.VERCEL;
  delete process.env.DEMO_AI_QUOTA;
});
afterEach(() => {
  process.env = { ...ENV };
});

async function mod() {
  return import("@/lib/quota");
}

describe("quotaLimit / quotaState", () => {
  it("defaults to 5 aspects and honours a valid override", async () => {
    const { quotaLimit } = await mod();
    expect(quotaLimit()).toBe(5);
    process.env.DEMO_AI_QUOTA = "12";
    expect(quotaLimit()).toBe(12);
  });

  it("ignores a nonsensical override instead of disabling the limit", async () => {
    const { quotaLimit } = await mod();
    for (const bad of ["0", "-3", "abc", ""]) {
      process.env.DEMO_AI_QUOTA = bad;
      expect(quotaLimit()).toBe(5);
    }
  });

  it("reports remaining, never negative", async () => {
    const { quotaState } = await mod();
    expect(quotaState(2)).toEqual({ used: 2, limit: 5, remaining: 3 });
    expect(quotaState(9)).toEqual({ used: 9, limit: 5, remaining: 0 });
  });

  it("is null (unlimited) when this is not the public demo", async () => {
    delete process.env.PUBLIC_DEMO;
    const { quotaState, isPublicDemo } = await mod();
    expect(isPublicDemo()).toBe(false);
    expect(quotaState(99)).toBeNull();
  });
});

describe("chargeConcept", () => {
  const learner = (over: Partial<{ aiUnits: number; unlimited: boolean }> = {}) => ({
    id: "L1", aiUnits: 0, unlimited: false, ...over,
  });

  it("charges one unit for the first request on an aspect", async () => {
    db.learner.findUnique.mockResolvedValue(learner());
    db.concept.findUnique.mockResolvedValue({ id: "C1", charged: false });
    db.concept.updateMany.mockResolvedValue({ count: 1 });
    db.learner.update.mockResolvedValue(learner({ aiUnits: 1 }));

    const { chargeConcept } = await mod();
    const r = await chargeConcept("L1", "C1");
    expect(r.ok).toBe(true);
    expect(r.quota).toEqual({ used: 1, limit: 5, remaining: 4 });
    expect(db.learner.update).toHaveBeenCalledOnce();
  });

  it("is free for every further request on an already-paid aspect", async () => {
    db.learner.findUnique.mockResolvedValue(learner({ aiUnits: 3 }));
    db.concept.findUnique.mockResolvedValue({ id: "C1", charged: true });

    const { chargeConcept } = await mod();
    const r = await chargeConcept("L1", "C1");
    expect(r.ok).toBe(true);
    expect(db.learner.update).not.toHaveBeenCalled();
  });

  // The reason the claim is a conditional updateMany and not a read-then-write:
  // two concurrent requests for the SAME aspect must not both spend a unit.
  it("does not double-charge when another request already claimed the aspect", async () => {
    db.learner.findUnique.mockResolvedValue(learner({ aiUnits: 1 }));
    db.concept.findUnique.mockResolvedValue({ id: "C1", charged: false });
    db.concept.updateMany.mockResolvedValue({ count: 0 }); // the other request won

    const { chargeConcept } = await mod();
    const r = await chargeConcept("L1", "C1");
    expect(r.ok).toBe(true);
    expect(db.learner.update).not.toHaveBeenCalled();
  });

  it("refuses once the budget is spent, and charges nothing", async () => {
    db.learner.findUnique.mockResolvedValue(learner({ aiUnits: 5 }));
    db.concept.findUnique.mockResolvedValue({ id: "C1", charged: false });

    const { chargeConcept } = await mod();
    const r = await chargeConcept("L1", "C1");
    expect(r.ok).toBe(false);
    expect(r.quota).toEqual({ used: 5, limit: 5, remaining: 0 });
    expect(db.concept.updateMany).not.toHaveBeenCalled();
    expect(db.learner.update).not.toHaveBeenCalled();
  });

  it("lets owner accounts through without touching the counter", async () => {
    db.learner.findUnique.mockResolvedValue(learner({ aiUnits: 99, unlimited: true }));
    db.concept.findUnique.mockResolvedValue({ id: "C1", charged: false });

    const { chargeConcept } = await mod();
    const r = await chargeConcept("L1", "C1");
    expect(r).toEqual({ ok: true, quota: null });
    expect(db.learner.update).not.toHaveBeenCalled();
  });

  it("refuses when the learner or concept does not exist", async () => {
    db.learner.findUnique.mockResolvedValue(null);
    db.concept.findUnique.mockResolvedValue({ id: "C1", charged: false });
    const { chargeConcept } = await mod();
    expect((await chargeConcept("nope", "C1")).ok).toBe(false);
  });

  it("does not charge at all when self-hosted", async () => {
    delete process.env.PUBLIC_DEMO;
    const { chargeConcept } = await mod();
    const r = await chargeConcept("L1", "C1");
    expect(r).toEqual({ ok: true, quota: null });
    expect(db.learner.findUnique).not.toHaveBeenCalled();
  });
});

describe("chargeAi", () => {
  it("refuses when the requested units would exceed the limit", async () => {
    db.learner.findUnique.mockResolvedValue({ id: "L1", aiUnits: 4, unlimited: false });
    const { chargeAi } = await mod();
    const r = await chargeAi("L1", 2);
    expect(r.ok).toBe(false);
    expect(db.learner.update).not.toHaveBeenCalled();
  });

  it("allows a charge that exactly reaches the limit", async () => {
    db.learner.findUnique.mockResolvedValue({ id: "L1", aiUnits: 4, unlimited: false });
    db.learner.update.mockResolvedValue({ aiUnits: 5 });
    const { chargeAi } = await mod();
    expect((await chargeAi("L1", 1)).ok).toBe(true);
  });
});
