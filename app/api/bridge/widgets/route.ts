import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentLearner } from "@/lib/db/learner";
import { generateVisualizations } from "@/lib/learn/visualize";
import type { BridgeBody } from "@/lib/bridge/types";

export const runtime = "nodejs";
// Two model calls (generate + fact-check) on their own budget.
export const maxDuration = 60;

const BodySchema = z.object({ bridgeId: z.string().min(1) });

/**
 * The interactive widgets for a bridge, generated on their own request.
 *
 * They used to be produced inside the bridge call, which meant the learner
 * stared at a loader for two extra model round-trips before seeing a single
 * word of the explanation. Split out, the text lands as soon as it is verified
 * and the widgets drop in underneath it while it is being read.
 *
 * No budget is charged here: the aspect was already paid for when its bridge
 * was generated (see chargeConcept), and this is part of that same aspect.
 */
export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bridgeId required." }, { status: 400 });

  const learner = await getCurrentLearner();
  if (!learner) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const bridge = await prisma.bridge.findFirst({
    where: { id: parsed.data.bridgeId, concept: { learnerId: learner.id } },
    include: { concept: true, domain: { select: { name: true } } },
  });
  if (!bridge) return NextResponse.json({ error: "Bridge not found." }, { status: 404 });

  // Already generated (a retry, a second tab) — hand back what is stored.
  let cached: {
    match?: { domainName?: string; anchor?: string };
    visualizations?: unknown[];
    widgetsDone?: boolean;
  } = {};
  try {
    cached = bridge.renderJson ? JSON.parse(bridge.renderJson) : {};
  } catch {
    cached = {};
  }
  // Settled already — including "this concept got none", which must not turn
  // into a fresh pair of model calls on every visit. Rows written before the
  // flag existed count as settled when they carry widgets.
  if (cached.widgetsDone || (cached.visualizations?.length ?? 0) > 0) {
    return NextResponse.json({ visualizations: cached.visualizations ?? [] });
  }

  try {
    const body = JSON.parse(bridge.body) as BridgeBody;
    const visualizations = await generateVisualizations({
      label: bridge.concept.label,
      definition: bridge.concept.definition,
      plainRestatement: body.plainRestatement,
      domain: cached.match?.domainName ?? bridge.domain.name,
      anchor: cached.match?.anchor ?? "",
      language: learner.language,
      budgetMs: (maxDuration - 8) * 1000,
    });

    // Fold them into the render cache so a later visit needs no call at all.
    await prisma.bridge
      .update({
        where: { id: bridge.id },
        data: { renderJson: JSON.stringify({ ...cached, visualizations, widgetsDone: true }) },
      })
      .catch(() => {});

    return NextResponse.json({ visualizations });
  } catch (err) {
    // Widgets are a bonus: never let their failure look like a broken lesson.
    console.error("bridge/widgets:", err);
    return NextResponse.json({ visualizations: [] });
  }
}
