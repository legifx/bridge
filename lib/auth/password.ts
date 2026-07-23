/**
 * Password hashing for the optional account lock. Uses Node's built-in scrypt
 * (no dependency, no native build). Stored format: `scrypt$<saltHex>$<hashHex>`.
 *
 * This is a lightweight guard for open demo accounts — enough that a name alone
 * no longer opens a protected profile — not a high-security credential store.
 */
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const KEYLEN = 32;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scryptAsync(password, salt, KEYLEN)) as Buffer;
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  const derived = (await scryptAsync(password, salt, KEYLEN)) as Buffer;
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/** Password rules for a new account. Kept deliberately gentle for a demo. */
export const MIN_PASSWORD_LENGTH = 4;
export function isValidPassword(password: string): boolean {
  return typeof password === "string" && password.length >= MIN_PASSWORD_LENGTH && password.length <= 128;
}
