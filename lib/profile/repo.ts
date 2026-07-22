import { prisma } from "@/lib/db/prisma";
import { successRate } from "@/lib/adaptive/thompson";
import type { DomainForMatch } from "./match";
import type { DomainVM } from "./types";

function parseAnchors(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Domains ready for the matcher (embedding bytes + anchors). */
export async function getDomainsForMatch(learnerId: string): Promise<DomainForMatch[]> {
  const rows = await prisma.interestDomain.findMany({ where: { learnerId } });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    embedding: r.embedding,
    anchors: parseAnchors(r.anchors),
    alpha: r.alpha,
    beta: r.beta,
    depth: r.depth,
  }));
}

/** Domains for display (chips, success rates). */
export async function getDomainVMs(learnerId: string): Promise<DomainVM[]> {
  const rows = await prisma.interestDomain.findMany({ where: { learnerId } });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    anchors: parseAnchors(r.anchors),
    alpha: r.alpha,
    beta: r.beta,
    confidence: r.confidence,
    successRate: successRate(r),
  }));
}
