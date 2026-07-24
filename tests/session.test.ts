import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Session cookies. The property under test is not "it round-trips" but
 * "a cookie nobody signed does not open a profile".
 */
async function loadWith(secret: string | undefined) {
  vi.resetModules();
  if (secret === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = secret;
  return import("@/lib/auth/session");
}

const ORIGINAL = process.env.AUTH_SECRET;
beforeEach(() => vi.resetModules());
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = ORIGINAL;
});

describe("signed sessions (AUTH_SECRET set)", () => {
  it("round-trips a learner id", async () => {
    const { encodeSession, decodeSession, SESSIONS_SIGNED } = await loadWith("a-long-enough-test-secret");
    expect(SESSIONS_SIGNED).toBe(true);
    const cookie = encodeSession("clx123abc");
    expect(cookie).not.toBe("clx123abc");
    expect(decodeSession(cookie)).toBe("clx123abc");
  });

  it("rejects a hand-written cookie for a known id", async () => {
    const { decodeSession } = await loadWith("a-long-enough-test-secret");
    expect(decodeSession("clx123abc")).toBeNull();
    expect(decodeSession("clx123abc.")).toBeNull();
    expect(decodeSession("clx123abc.deadbeef")).toBeNull();
  });

  it("rejects a signature lifted from another id", async () => {
    const { encodeSession, decodeSession } = await loadWith("a-long-enough-test-secret");
    const sig = encodeSession("victim").split(".")[1];
    expect(decodeSession(`attacker.${sig}`)).toBeNull();
  });

  it("rejects cookies signed with a different secret", async () => {
    const { encodeSession } = await loadWith("secret-number-one-is-long");
    const cookie = encodeSession("clx123abc");
    const { decodeSession } = await loadWith("secret-number-two-is-long");
    expect(decodeSession(cookie)).toBeNull();
  });

  it("ignores a secret too short to be worth anything", async () => {
    const { SESSIONS_SIGNED, decodeSession } = await loadWith("short");
    expect(SESSIONS_SIGNED).toBe(false);
    expect(decodeSession("clx123abc")).toBe("clx123abc"); // unsigned mode
  });
});

describe("unsigned fallback (no AUTH_SECRET)", () => {
  it("keeps a fresh clone working with a bare id", async () => {
    const { encodeSession, decodeSession, SESSIONS_SIGNED } = await loadWith(undefined);
    expect(SESSIONS_SIGNED).toBe(false);
    expect(encodeSession("clx123abc")).toBe("clx123abc");
    expect(decodeSession("clx123abc")).toBe("clx123abc");
  });

  it("still reads a previously signed cookie", async () => {
    const { encodeSession } = await loadWith("a-long-enough-test-secret");
    const signed = encodeSession("clx123abc");
    const { decodeSession } = await loadWith(undefined);
    expect(decodeSession(signed)).toBe("clx123abc");
  });

  it("treats an empty cookie as signed out", async () => {
    const { decodeSession } = await loadWith(undefined);
    expect(decodeSession("")).toBeNull();
    expect(decodeSession(undefined)).toBeNull();
  });
});
