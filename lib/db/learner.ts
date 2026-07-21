import { cookies } from "next/headers";
import { prisma } from "./prisma";

export const LEARNER_COOKIE = "learnerId";

/**
 * There is no account system (§7): a learner is a local profile. The current
 * learner is tracked by a cookie so the demo can switch between seeded profiles.
 * Falls back to the most recent learner, then to a fresh demo learner.
 */
export async function getCurrentLearner() {
  const jar = await cookies();
  const id = jar.get(LEARNER_COOKIE)?.value;
  if (id) {
    const found = await prisma.learner.findUnique({ where: { id } });
    if (found) return found;
  }
  const recent = await prisma.learner.findFirst({ orderBy: { createdAt: "desc" } });
  if (recent) return recent;
  return prisma.learner.create({ data: { displayName: "You", readingLevel: 3 } });
}

/** Day-1 helper kept for the text-extraction path. */
export async function getOrCreateDemoLearner() {
  return getCurrentLearner();
}
