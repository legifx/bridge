import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, isValidPassword, safeEqual, MIN_PASSWORD_LENGTH } from "@/lib/auth/password";

/**
 * The module that decides whether a password opens an account had no tests at
 * all. Everything else about sign-in was covered — the lockout, the session
 * signature — while the comparison itself was taken on trust.
 */
describe("hashPassword / verifyPassword", () => {
  it("accepts the right password and rejects a wrong one", async () => {
    const stored = await hashPassword("richtiges-passwort");
    expect(await verifyPassword("richtiges-passwort", stored)).toBe(true);
    expect(await verifyPassword("falsches-passwort", stored)).toBe(false);
    expect(await verifyPassword("", stored)).toBe(false);
  });

  it("salts: the same password hashes differently every time", async () => {
    const a = await hashPassword("gleiches-passwort");
    const b = await hashPassword("gleiches-passwort");
    expect(a).not.toBe(b);
    // ...and both still verify, so the salt is stored and read back correctly.
    expect(await verifyPassword("gleiches-passwort", a)).toBe(true);
    expect(await verifyPassword("gleiches-passwort", b)).toBe(true);
  });

  it("stores the documented format and never the password itself", async () => {
    const stored = await hashPassword("geheim-1234");
    expect(stored).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    expect(stored).not.toContain("geheim");
  });

  it("is case and whitespace sensitive", async () => {
    const stored = await hashPassword("Passwort");
    expect(await verifyPassword("passwort", stored)).toBe(false);
    expect(await verifyPassword("Passwort ", stored)).toBe(false);
  });

  // A malformed or truncated column must read as "does not match", never throw
  // — a crash here would be a 500 on the sign-in path for every affected row.
  it("returns false for malformed stored values instead of throwing", async () => {
    for (const bad of ["", "nonsense", "scrypt$onlyonepart", "bcrypt$aa$bb", "scrypt$$", "$$"]) {
      await expect(verifyPassword("irgendwas", bad)).resolves.toBe(false);
    }
  });

  it("rejects a hash whose length was tampered with", async () => {
    const stored = await hashPassword("geheim-1234");
    const [, salt, hash] = stored.split("$");
    expect(await verifyPassword("geheim-1234", `scrypt$${salt}$${hash.slice(0, 40)}`)).toBe(false);
  });

  it("handles unicode and long passwords", async () => {
    const pw = "Größe-😀-Ünïcode-" + "x".repeat(100);
    const stored = await hashPassword(pw);
    expect(await verifyPassword(pw, stored)).toBe(true);
    expect(await verifyPassword(pw + "y", stored)).toBe(false);
  });
});

describe("isValidPassword", () => {
  it("enforces the documented bounds", () => {
    expect(isValidPassword("x".repeat(MIN_PASSWORD_LENGTH))).toBe(true);
    expect(isValidPassword("x".repeat(MIN_PASSWORD_LENGTH - 1))).toBe(false);
    expect(isValidPassword("x".repeat(128))).toBe(true);
    expect(isValidPassword("x".repeat(129))).toBe(false);
  });

  it("rejects non-strings rather than coercing them", () => {
    expect(isValidPassword(undefined as unknown as string)).toBe(false);
    expect(isValidPassword(null as unknown as string)).toBe(false);
    expect(isValidPassword(12345678 as unknown as string)).toBe(false);
  });
});

describe("safeEqual", () => {
  it("compares by value", () => {
    expect(safeEqual("code-abc", "code-abc")).toBe(true);
    expect(safeEqual("code-abc", "code-abd")).toBe(false);
  });

  // It hashes first specifically so different lengths do not throw.
  it("handles different lengths without throwing", () => {
    expect(safeEqual("kurz", "sehr-viel-laenger")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
    expect(safeEqual("", "x")).toBe(false);
  });
});
