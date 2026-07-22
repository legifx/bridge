import { cookies } from "next/headers";
import { prisma } from "./prisma";

export const LEARNER_COOKIE = "learnerId";

/** Normalize a sign-in name into a shared handle: trimmed, lowercased,
 *  single-spaced. On the public demo, the same handle = the same profile —
 *  by design (open test accounts, no private data). */
export function normalizeHandle(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 24);
}

export function isValidUsername(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= 24 && /^[\p{L}\p{N} _.\-]+$/u.test(trimmed);
}

/**
 * The signed-in learner, from the session cookie. Returns null when signed
 * out — there is deliberately NO fallback to another profile.
 */
export async function getCurrentLearner() {
  const jar = await cookies();
  const id = jar.get(LEARNER_COOKIE)?.value;
  if (!id) return null;
  return prisma.learner.findUnique({ where: { id } });
}
