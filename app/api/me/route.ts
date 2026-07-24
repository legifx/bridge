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
      ? {
          id: learner.id,
          displayName: learner.displayName,
          language: learner.language,
          gradeSystem: learner.gradeSystem,
        }
      : null,
    publicDemo: isPublicDemo(),
    db: { ...dbConfig(), reachable: dbReachable },
    quota: learner && !learner.unlimited ? quotaState(learner.aiUnits) : null,
  });
}

const PatchSchema = z.object({
  language: z.string().min(2).max(8).regex(/^[a-z-]+$/i).optional(),
  gradeSystem: z.string().min(2).max(16).regex(/^[a-z]+$/i).optional(),
});

/** Update learner settings — main language and/or country grade system. */
export async function PATCH(req: Request) {
  const learner = await getCurrentLearner();
  if (!learner) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid settings." }, { status: 400 });

  const data: { language?: string; gradeSystem?: string } = {};
  if (parsed.data.language) data.language = parsed.data.language.toLowerCase();
  if (parsed.data.gradeSystem) data.gradeSystem = parsed.data.gradeSystem.toLowerCase();
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  await prisma.learner.update({ where: { id: learner.id }, data });
  return NextResponse.json({ ok: true, ...data });
}
