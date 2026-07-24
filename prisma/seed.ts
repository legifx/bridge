/**
 * Seeded demo (§8). Two learners with maximally different interest domains
 * (competitive gaming vs horse riding), one real chemistry chapter each, and
 * pre-generated bridges (including the hand-written rejected attempt for the
 * showcase concept) — so the split-screen comparison and the reject -> accept
 * beat are explorable instantly. Bridges come from fixtures/templates, so the
 * seed NEVER calls the LLM and burns no API budget.
 *
 * Run: npx prisma db seed
 */
import { prisma } from "@/lib/db/prisma";
import { embed, vecToBytes } from "@/lib/ml/embeddings";
import { bytesToVec } from "@/lib/ml/vector";
import { CHEM_EXTRACTION, CHEM_SOURCE_TEXT } from "@/lib/demo/chem";
import { matchConceptToDomains } from "@/lib/profile/match";
import { getDomainsForMatch } from "@/lib/profile/repo";
import { BRIDGE_FIXTURES } from "@/lib/demo/bridges";
import { templateBody, slug } from "@/lib/bridge/template";
import { BridgeBodySchema, VerdictSchema, type Verdict } from "@/lib/bridge/types";
import { recordAnswer } from "@/lib/adaptive/review";
import { recordSignal, averageVec } from "@/lib/brain/record";

type Profile = { displayName: string; handle: string; domain: string; anchors: string[]; readingLevel: number };

const PROFILES: Profile[] = [
  {
    displayName: "Mara",
    handle: "mara",
    domain: "competitive gaming",
    anchors: ["ranked ladder", "cooldown", "roster transfer", "team composition", "map control", "patch notes"],
    readingLevel: 3,
  },
  {
    displayName: "Theo",
    handle: "theo",
    domain: "horse riding",
    anchors: ["gait", "grooming", "tack", "dressage", "feed schedule", "pecking order"],
    readingLevel: 3,
  },
];

async function wipe() {
  await prisma.brainItem.deleteMany();
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
    data: { displayName: p.displayName, handle: p.handle, readingLevel: p.readingLevel },
  });

  const domEmb = await embed(`${p.domain}. ${p.anchors.join(", ")}`);
  const domainRow = await prisma.interestDomain.create({
    data: {
      learnerId: learner.id,
      name: p.domain,
      anchors: JSON.stringify(p.anchors),
      embedding: vecToBytes(domEmb),
    },
  });

  // Second brain: the domain as a strong interest plus its anchors as leaves,
  // with varied weights so the demo tree looks lived-in.
  await recordSignal({
    learnerId: learner.id,
    kind: "interest",
    label: p.domain,
    text: `${p.domain}. ${p.anchors.join(", ")}`,
    weight: 2.6,
    embedding: domEmb,
    sourceRef: domainRow.id,
  });
  for (let i = 0; i < p.anchors.length; i++) {
    await recordSignal({
      learnerId: learner.id,
      kind: "anchor",
      label: p.anchors[i],
      text: `${p.anchors[i]} (${p.domain})`,
      weight: 0.4 + ((p.anchors.length - i) % 3) * 0.3,
      sourceRef: domainRow.id,
    });
  }

  const source = await prisma.source.create({
    data: {
      learnerId: learner.id,
      kind: "text",
      rawText: CHEM_SOURCE_TEXT,
      title: CHEM_EXTRACTION.title,
      subject: CHEM_EXTRACTION.subject,
    },
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
  console.log("Seeding demo data…");
  await wipe();

  for (const p of PROFILES) {
    const { learner, conceptIds } = await seedLearner(p);
    const domains = await getDomainsForMatch(learner.id);

    // Pre-generate a bridge for every concept — from fixtures/templates, never
    // the LLM. The showcase concept gets its hand-written rejected attempt too.
    const ACCEPT: Verdict = { factuallyConsistent: true, contradictions: [], analogyOverreach: false, verdict: "accept" };
    for (const conceptId of conceptIds) {
      const concept = await prisma.concept.findUniqueOrThrow({ where: { id: conceptId } });
      const conceptVec = concept.embedding
        ? new Float32Array(concept.embedding.buffer, concept.embedding.byteOffset, concept.embedding.byteLength / 4)
        : await embed(`${concept.label}. ${concept.definition}`);
      const match = await matchConceptToDomains(conceptVec, domains);
      if (!match) continue;
      const chosen = domains.find((d) => d.id === match.domainId)!;

      const key = `${slug(concept.label)}:${slug(chosen.name)}`;
      const a1Body = BRIDGE_FIXTURES[`bridge:${key}:a1`];
      const a1Verdict = BRIDGE_FIXTURES[`verify:${key}:a1`];
      const a2Body = BRIDGE_FIXTURES[`bridge:${key}:a2`];

      if (a1Body && a1Verdict && a2Body) {
        await prisma.bridge.create({
          data: {
            conceptId: concept.id,
            domainId: chosen.id,
            body: JSON.stringify(BridgeBodySchema.parse(a1Body)),
            status: "rejected",
            attempt: 1,
            verdictJson: JSON.stringify(VerdictSchema.parse(a1Verdict)),
          },
        });
        await prisma.bridge.create({
          data: {
            conceptId: concept.id,
            domainId: chosen.id,
            body: JSON.stringify(BridgeBodySchema.parse(a2Body)),
            status: "accepted",
            attempt: 2,
            verdictJson: JSON.stringify(ACCEPT),
          },
        });
      } else {
        const body = templateBody({
          label: concept.label,
          definition: concept.definition,
          match,
          anchors: chosen.anchors,
        });
        await prisma.bridge.create({
          data: {
            conceptId: concept.id,
            domainId: chosen.id,
            body: JSON.stringify(body),
            status: "accepted",
            attempt: 1,
            verdictJson: JSON.stringify(ACCEPT),
          },
        });
      }
    }

    // Simulated "that clicked" presses on the first few bridges, so the second
    // brain shows domain x concept signals and the tree looks alive.
    const learnerDomain = await prisma.interestDomain.findFirstOrThrow({
      where: { learnerId: learner.id },
    });
    const clickedConcepts = await prisma.concept.findMany({
      where: { learnerId: learner.id },
      orderBy: { difficulty: "asc" },
      take: 3,
    });
    for (const c of clickedConcepts) {
      if (!c.embedding) continue;
      await recordSignal({
        learnerId: learner.id,
        kind: "signal",
        label: `${learnerDomain.name} ↔ ${c.label}`,
        text: `${learnerDomain.name} explained ${c.label}`,
        weight: 0.6,
        embedding: averageVec(
          [bytesToVec(learnerDomain.embedding), bytesToVec(c.embedding)],
          [2, 1],
        ),
      });
    }

    // A few answered checks so the teacher aggregate + mastery colors have data.
    // Deterministic pattern: harder concepts get more misses.
    const concepts = await prisma.concept.findMany({ where: { learnerId: learner.id }, orderBy: { difficulty: "asc" } });
    for (let i = 0; i < concepts.length; i++) {
      const c = concepts[i];
      const score = c.difficulty <= 3 ? 0.9 : 0.35; // easy concepts mastered, hard ones struggled
      await recordAnswer({ conceptId: c.id, score });
      if (score >= 0.6) await recordAnswer({ conceptId: c.id, score: 0.95 });
    }
  }

  const counts = {
    learners: await prisma.learner.count(),
    domains: await prisma.interestDomain.count(),
    concepts: await prisma.concept.count(),
    bridges: await prisma.bridge.count(),
    rejected: await prisma.bridge.count({ where: { status: "rejected" } }),
    reviews: await prisma.review.count(),
    brainItems: await prisma.brainItem.count(),
  };
  console.log("Seed complete:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
