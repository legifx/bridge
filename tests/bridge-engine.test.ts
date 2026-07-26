import { describe, it, expect, beforeEach, vi } from "vitest";
import type { BridgeBody, Verdict } from "@/lib/bridge/types";

/**
 * The generate → verify → retry → fallback loop is the heart of the app and had
 * no tests: everything around it was covered while the control flow that
 * decides what a learner actually sees was taken on trust.
 *
 * The LLM and the database are mocked. What is under test is the sequencing:
 * does a rejection retry, does the rejection reason reach the next attempt, does
 * a second interest get a turn, and does a learner always end up with something.
 */
const calls: Array<{ system: string; user: string }> = [];
let generateQueue: BridgeBody[] = [];
let verifyQueue: Verdict[] = [];

vi.mock("@/lib/llm/client", () => ({
  llmJson: vi.fn(async ({ system, user }: { system: string; user: string }) => {
    calls.push({ system, user });
    // The verifier's system prompt is the one that fact-checks; everything else
    // in this loop is a generation.
    if (system.includes("independent fact-checker")) {
      return verifyQueue.shift() ?? accept;
    }
    return generateQueue.shift() ?? body("fallback text");
  }),
}));

const created: Array<Record<string, unknown>> = [];
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    bridge: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return { id: `bridge-${created.length}` };
      }),
    },
  },
}));

const body = (opening: string): BridgeBody => ({
  opening,
  correspondences: [{ subject: "s", yourWorld: "w", explanation: "e" }],
  breaksDown: "the analogy suggests X, but in reality Y",
  plainRestatement: "plain",
});

const accept: Verdict = {
  factuallyConsistent: true, contradictions: [], analogyOverreach: false,
  ageAppropriate: true, verdict: "accept",
};
const reject = (claim: string, reason: string): Verdict => ({
  factuallyConsistent: false,
  contradictions: [{ claim, reason }],
  analogyOverreach: true, ageAppropriate: true, verdict: "revise",
});
const inappropriate: Verdict = { ...accept, ageAppropriate: false, verdict: "accept" };

const concept = { id: "C1", label: "Photosynthese", definition: "d", sourceQuote: "q" };
const domainA = { id: "D1", name: "Kochen", anchors: ["Pfanne"] };
const domainB = { id: "D2", name: "Basketball", anchors: ["Korb"] };
const match = { domainName: "x", anchor: "y", score: 1 } as never;

beforeEach(() => {
  calls.length = 0;
  created.length = 0;
  generateQueue = [];
  verifyQueue = [];
});

async function engine() {
  return import("@/lib/bridge/engine");
}

describe("generateBestBridge", () => {
  it("ships the first attempt when the verifier accepts it", async () => {
    generateQueue = [body("erster Versuch")];
    verifyQueue = [accept];

    const { generateBestBridge } = await engine();
    const r = await generateBestBridge({
      concept, candidates: [{ domain: domainA, match }], readingLevel: 3,
    });

    expect(r.isFallback).toBe(false);
    expect(r.body.opening).toBe("erster Versuch");
    expect(r.attempts).toHaveLength(1);
    expect(created[0].status).toBe("accepted");
  });

  // The point of the loop: a rejection must come back as instructions, not just
  // as a retry, or the second attempt repeats the first one's mistake.
  it("feeds the contradictions into the next attempt", async () => {
    generateQueue = [body("mit Fehler"), body("korrigiert")];
    verifyQueue = [reject("Pflanzen erzeugen Energie", "Energie wird umgewandelt, nicht erzeugt"), accept];

    const { generateBestBridge } = await engine();
    const r = await generateBestBridge({
      concept, candidates: [{ domain: domainA, match }], readingLevel: 3,
    });

    expect(r.body.opening).toBe("korrigiert");
    expect(r.attempts).toHaveLength(2);
    const secondGeneration = calls.filter((c) => !c.system.includes("independent fact-checker"))[1];
    expect(secondGeneration.user).toContain("Energie wird umgewandelt, nicht erzeugt");
  });

  it("persists rejected attempts too, so the verification log is honest", async () => {
    generateQueue = [body("verworfen"), body("angenommen")];
    verifyQueue = [reject("x", "y"), accept];

    const { generateBestBridge } = await engine();
    await generateBestBridge({ concept, candidates: [{ domain: domainA, match }], readingLevel: 3 });

    expect(created.map((c) => c.status)).toEqual(["rejected", "accepted"]);
  });

  // Age-appropriateness is a rejection even when every fact checks out —
  // an accept verdict with ageAppropriate:false must not reach a child.
  it("rejects an inappropriate explanation despite an accept verdict", async () => {
    generateQueue = [body("unpassendes Bild"), body("harmlos")];
    verifyQueue = [inappropriate, accept];

    const { generateBestBridge } = await engine();
    const r = await generateBestBridge({
      concept, candidates: [{ domain: domainA, match }], readingLevel: 3,
    });

    expect(r.body.opening).toBe("harmlos");
    expect(created[0].status).toBe("rejected");
  });

  it("tries the next interest when the first one cannot be verified", async () => {
    // Domain A gets the full retry budget (3 attempts), then B gets one.
    generateQueue = [body("a1"), body("a2"), body("a3"), body("b1")];
    verifyQueue = [reject("x", "y"), reject("x", "y"), reject("x", "y"), accept];

    const { generateBestBridge } = await engine();
    const r = await generateBestBridge({
      concept,
      candidates: [{ domain: domainA, match }, { domain: domainB, match }],
      readingLevel: 3,
    });

    expect(r.isFallback).toBe(false);
    expect(r.body.opening).toBe("b1");
    expect(r.attempts).toHaveLength(4);
  });

  // The learner must never be left with nothing: when no analogy survives, the
  // plain definition ships instead of an error.
  it("falls back to the plain definition when every candidate fails", async () => {
    generateQueue = Array.from({ length: 6 }, (_, i) => body(`v${i}`));
    verifyQueue = Array.from({ length: 6 }, () => reject("x", "y"));

    const { generateBestBridge } = await engine();
    const r = await generateBestBridge({
      concept,
      candidates: [{ domain: domainA, match }, { domain: domainB, match }],
      readingLevel: 3,
    });

    expect(r.isFallback).toBe(true);
    expect(r.body.correspondences).toEqual([]);
    expect(r.body.plainRestatement).toBe(concept.definition);
    expect(created.at(-1)?.status).toBe("accepted");
  });

  // A serverless function is killed at a hard ceiling; the loop must stop
  // retrying while it still has time to ship something.
  it("stops retrying when the wall-clock budget is spent", async () => {
    generateQueue = Array.from({ length: 6 }, (_, i) => body(`v${i}`));
    verifyQueue = Array.from({ length: 6 }, () => reject("x", "y"));

    const { generateBestBridge } = await engine();
    const r = await generateBestBridge({
      concept,
      candidates: [{ domain: domainA, match }, { domain: domainB, match }],
      readingLevel: 3,
      budgetMs: 1, // no room for a second generate/verify pair
    });

    expect(r.isFallback).toBe(true);
    expect(r.attempts.filter((a) => !a.isFallback)).toHaveLength(1);
  });

  it("passes the concept's misconceptions to both the generator and the verifier", async () => {
    generateQueue = [body("mit Fallen")];
    verifyQueue = [accept];

    const { generateBestBridge } = await engine();
    await generateBestBridge({
      concept: { ...concept, misconceptions: ["dass Sauerstoff aus dem CO2 stammt"] },
      candidates: [{ domain: domainA, match }],
      readingLevel: 3,
    });

    expect(calls).toHaveLength(2);
    for (const c of calls) expect(c.user).toContain("dass Sauerstoff aus dem CO2 stammt");
  });
});

describe("bodyToText", () => {
  it("includes the breaksDown line, so the verifier can judge it", async () => {
    const { bodyToText } = await engine();
    const text = bodyToText(body("opening"));
    expect(text).toContain("the analogy suggests X, but in reality Y");
    expect(text).toContain("plain");
  });
});
