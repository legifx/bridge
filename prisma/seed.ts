/**
 * Seeded demo (§8). Two learners with maximally different interest domains
 * (competitive gaming vs horse riding), one real chemistry chapter each, and
 * pre-generated bridges over the same concepts — so the split-screen comparison
 * and the reject -> accept beat work in 20 seconds with no camera and no API key.
 *
 * Run: npx prisma db seed   (loads .env; forces DEMO_MODE so it never burns API)
 */
process.env.DEMO_MODE = "true";

import { prisma } from "@/lib/db/prisma";
import { embed, vecToBytes } from "@/lib/ml/embeddings";
import { CHEM_EXTRACTION, CHEM_SOURCE_TEXT } from "@/lib/demo/chem";
import { matchConceptToDomains } from "@/lib/profile/match";
import { getDomainsForMatch } from "@/lib/profile/repo";
import { generateVerifiedBridge } from "@/lib/bridge/engine";
import { recordAnswer } from "@/lib/adaptive/review";

type Profile = { displayName: string; domain: string; anchors: string[]; readingLevel: number };

const PROFILES: Profile[] = [
  {
    displayName: "Mara",
    domain: "competitive gaming",
    anchors: ["ranked ladder", "cooldown", "roster transfer", "team composition", "map control", "patch notes"],
    readingLevel: 3,
  },
  {
    displayName: "Theo",
    domain: "horse riding",
    anchors: ["gait", "grooming", "tack", "dressage", "feed schedule", "pecking order"],
    readingLevel: 3,
  },
];

async function wipe() {
  await prisma.feedback.deleteMany();
  await prisma.review.deleteMany();
  await prisma.bridge.deleteMany();
  await prisma.conceptEdge.deleteMany();
  await prisma.concept.deleteMany();
  await prisma.source.deleteMany();
  await prisma.interestDomain.deleteMany();
  await prisma.learner.deleteMany();
  await prisma.classSnapshot.deleteMany();
}

async function seedLearner(p: Profile) {
  const learner = await prisma.learner.create({
    data: { displayName: p.displayName, readingLevel: p.readingLevel },
  });

  const domEmb = await embed(`${p.domain}. ${p.anchors.join(", ")}`);
  await prisma.interestDomain.create({
    data: {
      learnerId: learner.id,
      name: p.domain,
      anchors: JSON.stringify(p.anchors),
      embedding: vecToBytes(domEmb),
    },
  });

  const source = await prisma.source.create({
    data: { learnerId: learner.id, kind: "text", rawText: CHEM_SOURCE_TEXT },
  });

  // Concepts + embeddings + prerequisite edges.
  const idMap = new Map<string, string>();
  for (const c of CHEM_EXTRACTION.concepts) {
    const emb = await embed(`${c.label}. ${c.definition}`);
    const row = await prisma.concept.create({
      data: {
        learnerId: learner.id,
        sourceId: source.id,
        label: c.label,
        definition: c.definition,
        sourceQuote: c.sourceQuote,
        difficulty: c.difficulty,
        embedding: vecToBytes(emb),
      },
    });
    idMap.set(c.id, row.id);
  }
  for (const c of CHEM_EXTRACTION.concepts) {
    for (const pre of c.prerequisiteIds) {
      const from = idMap.get(pre);
      const to = idMap.get(c.id);
      if (from && to) await prisma.conceptEdge.create({ data: { fromConceptId: from, toConceptId: to } });
    }
  }

  return { learner, conceptIds: [...idMap.values()] };
}

async function main() {
  console.log("Seeding demo data (DEMO_MODE)…");
  await wipe();

  for (const p of PROFILES) {
    const { learner, conceptIds } = await seedLearner(p);
    const domains = await getDomainsForMatch(learner.id);

    // Pre-generate a bridge for every concept.
    for (const conceptId of conceptIds) {
      const concept = await prisma.concept.findUniqueOrThrow({ where: { id: conceptId } });
      const conceptVec = concept.embedding
        ? new Float32Array(concept.embedding.buffer, concept.embedding.byteOffset, concept.embedding.byteLength / 4)
        : await embed(`${concept.label}. ${concept.definition}`);
      const match = await matchConceptToDomains(conceptVec, domains);
      if (!match) continue;
      const chosen = domains.find((d) => d.id === match.domainId)!;
      await generateVerifiedBridge({
        concept: { id: concept.id, label: concept.label, definition: concept.definition, sourceQuote: concept.sourceQuote },
        domain: { id: chosen.id, name: chosen.name, anchors: chosen.anchors },
        match,
        readingLevel: learner.readingLevel,
      });
    }

    // A few answered checks so the teacher aggregate + mastery colors have data.
    // Deterministic pattern: harder concepts get more misses.
    const concepts = await prisma.concept.findMany({ where: { learnerId: learner.id }, orderBy: { difficulty: "asc" } });
    for (let i = 0; i < concepts.length; i++) {
      const c = concepts[i];
      const correct = c.difficulty <= 3; // easy concepts mastered, hard ones struggled
      await recordAnswer({ conceptId: c.id, correct, confident: correct });
      if (correct) await recordAnswer({ conceptId: c.id, correct: true, confident: true });
    }
  }

  const counts = {
    learners: await prisma.learner.count(),
    domains: await prisma.interestDomain.count(),
    concepts: await prisma.concept.count(),
    bridges: await prisma.bridge.count(),
    rejected: await prisma.bridge.count({ where: { status: "rejected" } }),
    reviews: await prisma.review.count(),
  };
  console.log("Seed complete:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
