import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { readJson, tooLargeResponse, BodyTooLargeError } from "@/lib/api/body";
import { getCurrentLearner } from "@/lib/db/learner";
import { getLearnerGraph } from "@/lib/extraction/repo";
import { getDomainVMs } from "@/lib/profile/repo";
import { isPublicDemo } from "@/lib/quota";

export const runtime = "nodejs";

export async function GET() {
  const learner = await getCurrentLearner();
  if (!learner) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const [graph, domains] = await Promise.all([
    getLearnerGraph(learner.id),
    getDomainVMs(learner.id),
  ]);
  return NextResponse.json({
    learner: { id: learner.id, displayName: learner.displayName, readingLevel: learner.readingLevel },
    ...graph,
    domains,
    // Does starting a new aspect spend budget here? The learn screen uses this
    // to decide whether it may generate on open or must ask first.
    demo: isPublicDemo() && !learner.unlimited,
  });
}

const EditSchema = z.object({
  conceptId: z.string().min(1),
  label: z.string().trim().min(1).max(120).optional(),
  definition: z.string().trim().min(1).max(2000).optional(),
});

async function readBody(req: Request) {
  try {
    return { raw: await readJson(req) };
  } catch (err) {
    if (err instanceof BodyTooLargeError) return { tooLarge: true as const };
    return { raw: null };
  }
}

/**
 * Correct a concept the extraction got wrong.
 *
 * Until now there was no way to fix one: a misread definition stayed forever
 * and was dutifully explained, tested and rescheduled. The stored embedding is
 * cleared on an edit so the next bridge re-embeds the corrected text instead of
 * matching interests against the old wording.
 */
export async function PATCH(req: Request) {
  const body = await readBody(req);
  if ("tooLarge" in body) return tooLargeResponse();
  const parsed = EditSchema.safeParse(body.raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid edit." }, { status: 400 });
  const { conceptId, label, definition } = parsed.data;
  if (!label && !definition) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });

  const learner = await getCurrentLearner();
  if (!learner) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const concept = await prisma.concept.findFirst({ where: { id: conceptId, learnerId: learner.id } });
  if (!concept) return NextResponse.json({ error: "Concept not found." }, { status: 404 });

  const updated = await prisma.concept.update({
    where: { id: concept.id },
    data: {
      ...(label ? { label } : {}),
      ...(definition ? { definition } : {}),
      // The vector describes the old text; drop it rather than keep a stale match.
      ...(definition || label ? { embedding: null } : {}),
    },
  });
  return NextResponse.json({ concept: { id: updated.id, label: updated.label, definition: updated.definition } });
}

/** Remove a concept the material never really contained. */
export async function DELETE(req: Request) {
  const body = await readBody(req);
  if ("tooLarge" in body) return tooLargeResponse();
  const parsed = z.object({ conceptId: z.string().min(1) }).safeParse(body.raw);
  if (!parsed.success) return NextResponse.json({ error: "conceptId required." }, { status: 400 });

  const learner = await getCurrentLearner();
  if (!learner) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const concept = await prisma.concept.findFirst({
    where: { id: parsed.data.conceptId, learnerId: learner.id },
  });
  if (!concept) return NextResponse.json({ error: "Concept not found." }, { status: 404 });

  // Bridges, reviews and edges hang off the concept and cascade with it.
  await prisma.concept.delete({ where: { id: concept.id } });
  return NextResponse.json({ deleted: true });
}
