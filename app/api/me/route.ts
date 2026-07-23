import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentLearner } from "@/lib/db/learner";
import { isPublicDemo, quotaState } from "@/lib/quota";
import { dbConfig } from "@/lib/db/prisma";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

/** Session info for the shell: who is signed in, and how much demo budget is left. */
export async function GET() {
  const learner = await getCurrentLearner();
  let dbReachable = true;
  try {
    await prisma.learner.count();
  } catch {
    dbReachable = false;
  }
  return NextResponse.json({
    learner: learner
      ? { id: learner.id, displayName: learner.displayName, language: learner.language }
      : null,
    publicDemo: isPublicDemo(),
    db: { ...dbConfig(), reachable: dbReachable },
    quota: learner && !learner.unlimited ? quotaState(learner.aiUnits) : null,
  });
}

const PatchSchema = z.object({
  language: z
    .string()
    .min(2)
    .max(8)
    .regex(/^[a-z-]+$/i),
});

/** Update learner settings — currently just the main language. */
export async function PATCH(req: Request) {
  const learner = await getCurrentLearner();
  if (!learner) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid settings." }, { status: 400 });

  await prisma.learner.update({
    where: { id: learner.id },
    data: { language: parsed.data.language.toLowerCase() },
  });
  return NextResponse.json({ ok: true, language: parsed.data.language.toLowerCase() });
}
