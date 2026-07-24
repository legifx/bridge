import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentLearner } from "@/lib/db/learner";
import { prisma } from "@/lib/db/prisma";
import { bytesToVec } from "@/lib/ml/vector";
import { embed } from "@/lib/ml/embeddings";
import { getDomainsForMatch } from "@/lib/profile/repo";
import { rankDomainsForConcept, buildMatch } from "@/lib/profile/match";
import { generateBestBridge } from "@/lib/bridge/engine";
import { generateVisualizations } from "@/lib/learn/visualize";
import { chargeAi, quotaExceededResponse } from "@/lib/quota";

export const runtime = "nodejs";

const BodySchema = z.object({ conceptId: z.string().min(1) });

export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "conceptId required." }, { status: 400 });

  const learner = await getCurrentLearner();
  if (!learner) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const concept = await prisma.concept.findFirst({
    where: { id: parsed.data.conceptId, learnerId: learner.id },
  });
  if (!concept) return NextResponse.json({ error: "Concept not found." }, { status: 404 });

  const domains = await getDomainsForMatch(learner.id);
  if (domains.length === 0) {
    return NextResponse.json({ error: "No interest profile yet. Finish onboarding first." }, { status: 409 });
  }

  // Concept vector: use the stored embedding, or compute it on the fly.
  const conceptVec = concept.embedding
    ? bytesToVec(concept.embedding)
    : await embed(`${concept.label}. ${concept.definition}`);

  // Rank domains and prepare the top few as candidates. If the best domain's
  // analogies all get rejected by the verifier, the engine tries the next one
  // before ever falling back to a plain, non-analogical explanation.
  const ranked = rankDomainsForConcept(conceptVec, domains);
  if (ranked.length === 0) return NextResponse.json({ error: "Could not match a domain." }, { status: 500 });
  const top = ranked.slice(0, 2);
  const candidates = await Promise.all(
    top.map(async ({ domain, bandit }) => ({
      domain: { id: domain.id, name: domain.name, anchors: domain.anchors, depth: domain.depth },
      match: await buildMatch(conceptVec, domain, bandit),
    })),
  );

  const charge = await chargeAi(learner.id, 1);
  if (!charge.ok) return quotaExceededResponse(charge.quota, learner.language);

  try {
    const result = await generateBestBridge({
      concept: {
        id: concept.id,
        label: concept.label,
        definition: concept.definition,
        sourceQuote: concept.sourceQuote,
      },
      candidates,
      readingLevel: learner.readingLevel,
      language: learner.language,
    });

    // Interactive widgets for the concept, framed through the chosen interest.
    // Non-fatal: an empty list just means a text-only explanation this time.
    const visualizations = await generateVisualizations({
      label: concept.label,
      definition: concept.definition,
      plainRestatement: result.body.plainRestatement,
      domain: result.match.domainName,
      anchor: result.match.anchor,
      language: learner.language,
    });

    return NextResponse.json({ ...result, visualizations, quota: charge.quota });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bridge generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
