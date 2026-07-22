import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { updateBeta } from "@/lib/adaptive/thompson";
import { recordSignal, averageVec } from "@/lib/brain/record";
import { bytesToVec } from "@/lib/ml/vector";

export const runtime = "nodejs";

const BodySchema = z.object({ bridgeId: z.string().min(1), clicked: z.boolean() });

/**
 * "That clicked" / "Didn't land" — the reward signal for Thompson sampling,
 * and a second-brain write: the domain x concept pairing lands as a signal
 * whose embedding is averaged from vectors we already store (no model call).
 */
export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bridgeId and clicked required." }, { status: 400 });

  const bridge = await prisma.bridge.findUnique({
    where: { id: parsed.data.bridgeId },
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
