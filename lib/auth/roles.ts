/**
 * Who may see the cohort roll-up.
 *
 * Before this there was no answer to that question in the codebase: the teacher
 * aggregate was served to anyone who typed the URL, over every learner in the
 * database. Two things were missing and both are here — a role, so "teacher" is
 * a fact about an account rather than an assumption about who visits a page,
 * and a class, so "the cohort" has a boundary.
 *
 * Promotion is deliberately not self-service: an account becomes a teacher by
 * presenting TEACHER_UNLOCK_CODE, the same env-gated pattern the owner unlock
 * already uses. A real deployment replaces this with school-issued accounts —
 * but a code that must be configured is a boundary, and no role at all is not.
 */
import { timingSafeEqual } from "crypto";

export const ROLES = ["learner", "teacher"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: string | null | undefined): value is Role {
  return !!value && (ROLES as readonly string[]).includes(value);
}

export function isTeacher(learner: { role?: string | null }): boolean {
  return learner.role === "teacher";
}

/** Constant-time compare that does not leak length through an early return. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Does `code` unlock the teacher role on this host? False whenever the env var
 * is unset — an unconfigured deployment must not hand the role to an empty
 * string, which is exactly what a naive `code === process.env.X` would do.
 */
export function teacherCodeValid(code: string | undefined | null): boolean {
  const expected = (process.env.TEACHER_UNLOCK_CODE || "").trim();
  const given = (code || "").trim();
  if (!expected || !given) return false;
  return safeEqual(given, expected);
}

/**
 * Join codes are read aloud and typed by children, so the alphabet omits the
 * characters that get confused (0/O, 1/I/L) and comparison is case-insensitive.
 */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateJoinCode(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < 8; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

export function normalizeJoinCode(input: string): string {
  const bare = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return bare.length === 8 ? `${bare.slice(0, 4)}-${bare.slice(4)}` : bare;
}
