import { prisma } from "./prisma";

/**
 * For Day-1 there is no account system (§7: a learner is a local profile).
 * We use a single default learner until onboarding lands in Day 5.
 */
export async function getOrCreateDemoLearner() {
  const existing = await prisma.learner.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) return existing;
  return prisma.learner.create({
    data: { displayName: "You", readingLevel: 3 },
  });
}
