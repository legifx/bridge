import { NextResponse } from "next/server";
import { getCurrentLearner } from "@/lib/db/learner";
import { getLearnerGraph } from "@/lib/extraction/repo";
import { getDomainVMs } from "@/lib/profile/repo";

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
  });
}
