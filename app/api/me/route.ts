import { NextResponse } from "next/server";
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
    learner: learner ? { id: learner.id, displayName: learner.displayName } : null,
    publicDemo: isPublicDemo(),
    db: { ...dbConfig(), reachable: dbReachable },
    quota: learner ? quotaState(learner.aiUnits) : null,
  });
}
