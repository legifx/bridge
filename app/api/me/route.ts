import { NextResponse } from "next/server";
import { getCurrentLearner } from "@/lib/db/learner";
import { isPublicDemo, quotaState } from "@/lib/quota";

export const runtime = "nodejs";

/** Session info for the shell: who is signed in, and how much demo budget is left. */
export async function GET() {
  const learner = await getCurrentLearner();
  return NextResponse.json({
    learner: learner ? { id: learner.id, displayName: learner.displayName } : null,
    publicDemo: isPublicDemo(),
    quota: learner ? quotaState(learner.aiUnits) : null,
  });
}
