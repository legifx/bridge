import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentLearner } from "@/lib/db/learner";
import { readJson, tooLargeResponse, BodyTooLargeError } from "@/lib/api/body";

export const runtime = "nodejs";

/**
 * Delete a capture folder and everything extracted from it.
 *
 * A photograph that came out unreadable, or a page captured twice, was
 * permanent: its concepts stayed on the map and in the review rotation forever.
 * The schema only nulls `sourceId` on delete, which would leave the concepts
 * behind as orphans with no folder — so they are removed explicitly, which is
 * also what "delete this capture" plainly means.
 */
export async function DELETE(req: Request) {
  let raw: unknown = null;
  try {
    raw = await readJson(req);
  } catch (err) {
    if (err instanceof BodyTooLargeError) return tooLargeResponse();
  }
  const parsed = z.object({ sourceId: z.string().min(1) }).safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "sourceId required." }, { status: 400 });

  const learner = await getCurrentLearner();
  if (!learner) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const source = await prisma.source.findFirst({
    where: { id: parsed.data.sourceId, learnerId: learner.id },
  });
  if (!source) return NextResponse.json({ error: "Capture not found." }, { status: 404 });

  const [{ count }] = await prisma.$transaction([
    prisma.concept.deleteMany({ where: { sourceId: source.id, learnerId: learner.id } }),
    prisma.source.delete({ where: { id: source.id } }),
  ]);

  return NextResponse.json({ deleted: true, concepts: count });
}
