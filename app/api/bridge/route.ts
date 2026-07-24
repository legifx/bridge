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
import { chargeConcept, quotaExceededResponse } from "@/lib/quota";

export const runtime = "nodejs";

const BodySchema = z.object({
  conceptId: z.string().min(1),
  // optional: the learner explicitly chose which interest to explain through
  domainId: z.string().min(1).optional(),
  // optional: re-learn — the new explanation should target last time's mistakes
  relearn: z.boolean().optional(),
});

/** Turn the last check's stored breakdown into a short natural-language hint. */
function mistakesSummary(detailJson: string | null): string | undefined {
  if (!detailJson) return undefined;
  let d: {
    freeCorrect?: boolean;
    mcqCorrect?: boolean;
    problems?: { correct: boolean; feedback: string | null }[];
  };
  try {
    d = JSON.parse(detailJson);
  } catch {
    return undefined;
  }
  const parts: string[] = [];
  if (d.freeCorrect === false) parts.push("recalling the definition in their own words");
  if (d.mcqCorrect === false) parts.push("the multiple-choice question");
  const wrongProblems = (d.problems ?? []).filter((p) => !p.correct);
  if (wrongProblems.length) {
    const notes = wrongProblems.map((p) => p.feedback).filter(Boolean);
    parts.push(
      `solving the practice problem(s)${notes.length ? ` (${notes.join("; ")})` : ""}`,
    );
  }
  return parts.length ? parts.join(", ") : undefined;
}

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

  // If the learner explicitly chose an interest, explain through exactly that
  // one and nudge the Brain toward it (a manual pick is a real preference
  // signal). Otherwise rank domains and try the top two before a plain fallback.
  const chosen = parsed.data.domainId ? domains.find((d) => d.id === parsed.data.domainId) : undefined;
  let top: { domain: (typeof domains)[number]; bandit: number }[];
  if (chosen) {
    top = [{ domain: chosen, bandit: chosen.alpha / (chosen.alpha + chosen.beta) }];
    // Brain effect: bump the chosen domain's bandit so it leans this way next time.
    await prisma.interestDomain.update({
      where: { id: chosen.id },
      data: {
        alpha: { increment: 0.5 },
        confidence: (chosen.alpha + 0.5) / (chosen.alpha + 0.5 + chosen.beta),
      },
    });
  } else {
    const ranked = rankDomainsForConcept(conceptVec, domains);
    if (ranked.length === 0) return NextResponse.json({ error: "Could not match a domain." }, { status: 500 });
    top = ranked.slice(0, 2);
  }
  const candidates = await Promise.all(
    top.map(async ({ domain, bandit }) => ({
      domain: { id: domain.id, name: domain.name, anchors: domain.anchors, depth: domain.depth },
      match: await buildMatch(conceptVec, domain, bandit),
    })),
  );

  // On re-learn, pull what the learner got wrong last time so the new
  // explanation can target it with a fresh angle.
  let priorMistakes: string | undefined;
  if (parsed.data.relearn) {
    const last = await prisma.review.findFirst({
      where: { conceptId: concept.id },
      orderBy: { answeredAt: "desc" },
      select: { detailJson: true },
    });
    priorMistakes = mistakesSummary(last?.detailJson ?? null);
  }

  const charge = await chargeConcept(learner.id, concept.id);
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
      priorMistakes,
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
