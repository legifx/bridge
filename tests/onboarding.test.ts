import { describe, it, expect } from "vitest";
import {
  scoreMagnet,
  depthToProfile,
  sanitizeMagnet,
  syncScore,
  shuffle,
  UNVERIFIED,
} from "@/lib/onboarding/score";
import type { DomainState, MagnetWord } from "@/lib/onboarding/types";

const m = (tier: MagnetWord["tier"], ...terms: string[]): MagnetWord[] =>
  terms.map((term) => ({ term, tier }));

// A standard 4/4/4+3 magnet, as generated for one domain.
const WORDS: MagnetWord[] = [
  ...m("novice", "respawn", "loadout", "lobby", "skin"),
  ...m("hobbyist", "cooldown", "patch notes", "map control", "team composition"),
  ...m("insider", "frame data", "input buffering", "peeker's advantage", "macro play"),
  ...m("decoy", "render cooldown", "aim latency tax", "spawn elasticity"),
];

describe("scoreMagnet", () => {
  it("rates a genuine insider as deep with strong evidence", () => {
    const s = scoreMagnet(WORDS, [
      "respawn",
      "loadout",
      "cooldown",
      "patch notes",
      "map control",
      "frame data",
      "input buffering",
      "peeker's advantage",
    ]);
    expect(s.depth).toBe("deep");
    expect(s.evidence).toBeGreaterThan(0.7);
    expect(s.decoyHits).toBe(0);
    expect(s.realPicks).toContain("frame data");
  });

  it("rates hobbyist-tier picks as hobbyist", () => {
    const s = scoreMagnet(WORDS, ["respawn", "lobby", "cooldown", "patch notes", "map control"]);
    expect(s.depth).toBe("hobbyist");
    expect(s.evidence).toBeGreaterThan(0.3);
    expect(s.evidence).toBeLessThan(0.8);
  });

  it("rates sparse novice picks as novice with weak evidence", () => {
    const s = scoreMagnet(WORDS, ["respawn"]);
    expect(s.depth).toBe("novice");
    expect(s.evidence).toBeLessThan(0.2);
  });

  it("collapses a larper who taps everything, decoys included", () => {
    const s = scoreMagnet(WORDS, WORDS.map((w) => w.term));
    expect(s.decoyHits).toBe(3);
    expect(s.depth).toBe("novice"); // decoys demote depth…
    expect(s.evidence).toBeLessThanOrEqual(0.25); // …and collapse evidence
  });

  it("dampens but does not destroy one accidental decoy", () => {
    const honest = scoreMagnet(WORDS, ["cooldown", "patch notes", "map control", "frame data"]);
    const oneSlip = scoreMagnet(WORDS, [
      "cooldown",
      "patch notes",
      "map control",
      "frame data",
      "render cooldown",
    ]);
    expect(oneSlip.evidence).toBeLessThan(honest.evidence);
    expect(oneSlip.evidence).toBeGreaterThan(honest.evidence * 0.4);
    expect(oneSlip.depth).toBe("hobbyist"); // deep requires zero decoy hits
  });

  it("matches picks case-insensitively and ignores unknown words", () => {
    const s = scoreMagnet(WORDS, ["RESPAWN", "not-a-served-word"]);
    expect(s.realPicks).toEqual(["respawn"]);
  });
});

describe("depthToProfile", () => {
  it("is monotonic in evidence", () => {
    const low = depthToProfile("hobbyist", 0.2);
    const high = depthToProfile("hobbyist", 0.9);
    expect(high.confidence).toBeGreaterThan(low.confidence);
    expect(high.alpha).toBeGreaterThan(low.alpha);
    expect(high.interestWeight).toBeGreaterThan(low.interestWeight);
  });

  it("stays inside honest confidence bounds", () => {
    expect(depthToProfile("novice", 0).confidence).toBeGreaterThanOrEqual(0.2);
    expect(depthToProfile("deep", 1).confidence).toBeLessThanOrEqual(0.9);
  });

  it("gives verified depth a warmer Thompson prior than novice", () => {
    const deep = depthToProfile("deep", 0.8);
    const novice = depthToProfile("novice", 0.1);
    expect(deep.alpha).toBeGreaterThan(novice.alpha);
    expect(novice.beta).toBeGreaterThan(deep.beta - 1);
  });
});

describe("sanitizeMagnet", () => {
  it("dedupes case-insensitively and keeps a usable set", () => {
    const out = sanitizeMagnet([...WORDS, { term: "Respawn", tier: "novice" }]);
    expect(out.filter((w) => w.term.toLowerCase() === "respawn")).toHaveLength(1);
    expect(out.length).toBe(WORDS.length);
  });

  it("caps runaway tiers", () => {
    const inflated = [...WORDS, ...m("insider", "x1", "x2", "x3", "x4", "x5")];
    const out = sanitizeMagnet(inflated);
    expect(out.filter((w) => w.tier === "insider")).toHaveLength(4);
  });

  it("rejects sets without enough real terms or decoys", () => {
    expect(sanitizeMagnet(m("novice", "a1", "a2"))).toEqual([]);
    expect(
      sanitizeMagnet([...m("novice", "a", "b", "c"), ...m("hobbyist", "d", "e", "f")]),
    ).toEqual([]); // no decoys -> unusable
  });
});

describe("syncScore", () => {
  const base: DomainState = { key: "d-0", name: "gaming", seeds: ["gaming"] };

  it("is 0 with no domains and grows seed -> drill -> verified", () => {
    expect(syncScore([])).toBe(0);
    const seeded = syncScore([base]);
    const drilled = syncScore([{ ...base, role: "I play myself" }]);
    const verified = syncScore([
      { ...base, role: "I play myself", evidence: 0.8, magnet: { words: [], picked: [] } },
    ]);
    expect(seeded).toBeGreaterThan(0);
    expect(drilled).toBeGreaterThan(seeded);
    expect(verified).toBeGreaterThan(drilled);
    expect(verified).toBeLessThanOrEqual(1);
  });

  it("does not let unverified extra domains inflate the score", () => {
    const verified = { ...base, role: "r", evidence: 0.9, magnet: { words: [], picked: [] } };
    expect(syncScore([verified, base])).toBeLessThan(syncScore([verified]));
  });
});

describe("shuffle", () => {
  it("preserves the members and leaves the input untouched", () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("UNVERIFIED default", () => {
  it("starts light — below any decent verified evidence", () => {
    expect(UNVERIFIED.evidence).toBeLessThan(0.4);
    expect(UNVERIFIED.depth).toBe("hobbyist");
  });
});
