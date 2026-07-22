/**
 * Build the skill tree: cluster the learner's brain items, attach each interest
 * domain (and its bandit success rate) to its nearest cluster, then hang the
 * learned concepts ("skills") off the cluster whose domain actually bridged
 * them. Everything is our own vector math over stored embeddings — it works
 * read-only, with no model and no API.
 */
import { prisma } from "@/lib/db/prisma";
import { bytesToVec, cosine } from "@/lib/ml/vector";
import { successRate } from "@/lib/adaptive/thompson";
import { eloToMastery } from "@/lib/extraction/repo";
import { clusterItems, type BrainVec } from "./cluster";

export type TreeSkill = { id: string; label: string; mastery: number };

export type TreeBranch = {
  label: string;
  totalWeight: number;
  confidence: number;
  successRate: number | null; // bandit posterior mean, if a domain maps here
  items: { label: string; kind: string; weight: number }[];
  skills: TreeSkill[];
};

export type BrainTree = {
  branches: TreeBranch[];
  stats: { signals: number; totalWeight: number; branches: number; skills: number };
};

const DOMAIN_MATCH_THRESHOLD = 0.5;

export async function buildBrainTree(learnerId: string): Promise<BrainTree> {
  const [items, domains, concepts, bridges] = await Promise.all([
    prisma.brainItem.findMany({ where: { learnerId } }),
    prisma.interestDomain.findMany({ where: { learnerId } }),
    prisma.concept.findMany({ where: { learnerId } }),
    prisma.bridge.findMany({
      where: { status: "accepted", concept: { learnerId } },
      select: { conceptId: true, domainId: true },
    }),
  ]);

  const vecs: BrainVec[] = items.map((i) => ({
    id: i.id,
    kind: i.kind,
    label: i.label,
    weight: i.weight,
    vec: bytesToVec(i.embedding),
  }));
  const clusters = clusterItems(vecs);

  // Map each domain to its best-matching cluster.
  const domainCluster = new Map<string, number>(); // domainId -> cluster index
  for (const d of domains) {
    const dv = bytesToVec(d.embedding);
    let bestIdx = -1;
    let bestSim = DOMAIN_MATCH_THRESHOLD;
    clusters.forEach((c, idx) => {
      const sim = cosine(c.centroid, dv);
      if (sim > bestSim) {
        bestSim = sim;
        bestIdx = idx;
      }
    });
    if (bestIdx >= 0) domainCluster.set(d.id, bestIdx);
  }

  // Skills: a concept hangs off the cluster whose domain bridged it (accepted).
  const conceptById = new Map(concepts.map((c) => [c.id, c]));
  const clusterSkills = new Map<number, Map<string, TreeSkill>>();
  for (const b of bridges) {
    const idx = domainCluster.get(b.domainId);
    const concept = conceptById.get(b.conceptId);
    if (idx === undefined || !concept) continue;
    const bucket = clusterSkills.get(idx) ?? new Map<string, TreeSkill>();
    bucket.set(concept.id, {
      id: concept.id,
      label: concept.label,
      mastery: eloToMastery(concept.elo),
    });
    clusterSkills.set(idx, bucket);
  }

  // Success rate per cluster: the bandit posterior of its heaviest-matching domain.
  const clusterRate = new Map<number, number>();
  for (const d of domains) {
    const idx = domainCluster.get(d.id);
    if (idx === undefined) continue;
    if (!clusterRate.has(idx)) clusterRate.set(idx, successRate(d));
  }

  const branches: TreeBranch[] = clusters.map((c, idx) => ({
    label: c.label,
    totalWeight: c.totalWeight,
    confidence: c.confidence,
    successRate: clusterRate.get(idx) ?? null,
    items: c.items
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 8)
      .map((i) => ({ label: i.label, kind: i.kind, weight: i.weight })),
    skills: [...(clusterSkills.get(idx)?.values() ?? [])].sort((a, b) => b.mastery - a.mastery),
  }));

  return {
    branches,
    stats: {
      signals: items.length,
      totalWeight: items.reduce((s, i) => s + i.weight, 0),
      branches: branches.length,
      skills: branches.reduce((s, b) => s + b.skills.length, 0),
    },
  };
}
