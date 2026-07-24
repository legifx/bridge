import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentLearner } from "@/lib/db/learner";
import { updateBeta } from "@/lib/adaptive/thompson";
import { recordSignal, averageVec } from "@/lib/brain/record";
import { bytesToVec } from "@/lib/ml/vector";
import { readJson, tooLargeResponse, BodyTooLargeError } from "@/lib/api/body";

export const runtime = "nodejs";

const BodySchema = z.object({ bridgeId: z.string().min(1), clicked: z.boolean() });

/**
 * "That clicked" / "Didn't land" — the reward signal for Thompson sampling,
 * and a second-brain write: the domain x concept pairing lands as a signal
 * whose embedding is averaged from vectors we already store (no model call).
 */
export async function POST(req: Request) {
  let raw: unknown = null;
  try {
    raw = await readJson(req);
  } catch (err) {
    if (err instanceof BodyTooLargeError) return tooLargeResponse();
    // malformed JSON — the schema below turns it into the usual 400
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "bridgeId and clicked required." }, { status: 400 });

  // This endpoint WRITES into a learner's profile: it moves the interest
  // bandit and adds a second-brain signal. Without a sign-in and an ownership
  // check, anyone holding a bridge id could reshape a stranger's interest
  // profile — so both are required, and a foreign bridge is simply "not found".
  const learner = await getCurrentLearner();
  if (!learner) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const bridge = await prisma.bridge.findFirst({
    where: { id: parsed.data.bridgeId, concept: { learnerId: learner.id } },
    include: {
      domain: true,
      concept: { select: { id: true, label: true, embedding: true, learnerId: true } },
    },
  });
  if (!bridge) return NextResponse.json({ error: "Bridge not found." }, { status: 404 });

  await prisma.feedback.create({ data: { bridgeId: bridge.id, clicked: parsed.data.clicked } });

  // Bandit update on the domain.
  const { alpha, beta } = updateBeta(bridge.domain, parsed.data.clicked);
  const confidence = alpha / (alpha + beta);
  await prisma.interestDomain.update({
    where: { id: bridge.domain.id },
    data: { alpha, beta, confidence },
  });

  // Second-brain signal — clicked bridges strengthen the pairing far more.
  if (bridge.concept.embedding) {
    await recordSignal({
      learnerId: bridge.concept.learnerId,
      kind: "signal",
      label: `${bridge.domain.name} ↔ ${bridge.concept.label}`,
      text: `${bridge.domain.name} explained ${bridge.concept.label}`,
      weight: parsed.data.clicked ? 0.6 : 0.15,
      embedding: averageVec(
        [bytesToVec(bridge.domain.embedding), bytesToVec(bridge.concept.embedding)],
        [2, 1], // the interest side carries more signal than the concept side
      ),
      sourceRef: bridge.id,
    });
  }

  return NextResponse.json({ domainId: bridge.domain.id, alpha, beta, successRate: confidence });
}
