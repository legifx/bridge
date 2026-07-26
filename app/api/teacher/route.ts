import { NextResponse } from "next/server";
import { getCurrentLearner } from "@/lib/db/learner";
import { getCohortStruggles } from "@/lib/teacher/aggregate";

export const runtime = "nodejs";

/**
 * Cohort struggle aggregate. The PAGE is parked behind a redirect, but this
 * route was reachable by anyone: no session check at all, returning the concept
 * labels of every learner in the database to an unauthenticated caller. The
 * payload is aggregate-only by design (no ids, no names), but concept labels are
 * learner-uploaded material and a handful of learners makes an "aggregate" of
 * one — so it does not belong on the open internet.
 *
 * A session is the floor, not the finished answer: there is no teacher role yet,
 * so any signed-in learner still sees the cohort roll-up. Scoping this to a real
 * teacher (and to their own class) is part of building the teacher view for real.
 */
export async function GET() {
  const learner = await getCurrentLearner();
  if (!learner) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const concepts = await getCohortStruggles();
  return NextResponse.json({ concepts });
}
