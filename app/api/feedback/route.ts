import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { updateBeta } from "@/lib/adaptive/thompson";

export const runtime = "nodejs";

const BodySchema = z.object({ bridgeId: z.string().min(1), clicked: z.boolean() });

/** "That clicked" / "Didn't land" — the reward signal for Thompson sampling. */
export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bridgeId and clicked required." }, { status: 400 });

  const bridge = await prisma.bridge.findUnique({ where: { id: parsed.data.bridgeId } });
  if (!bridge) return NextResponse.json({ error: "Bridge not found." }, { status: 404 });

  await prisma.feedback.create({ data: { bridgeId: bridge.id, clicked: parsed.data.clicked } });

  const domain = await prisma.interestDomain.findUnique({ where: { id: bridge.domainId } });
  if (domain) {
    const { alpha, beta } = updateBeta(domain, parsed.data.clicked);
    const confidence = alpha / (alpha + beta);
    await prisma.interestDomain.update({
      where: { id: domain.id },
      data: { alpha, beta, confidence },
    });
    return NextResponse.json({ domainId: domain.id, alpha, beta, successRate: confidence });
  }
  return NextResponse.json({ ok: true });
}
