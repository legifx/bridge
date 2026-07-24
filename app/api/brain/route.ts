import { NextResponse } from "next/server";
import { getCurrentLearner } from "@/lib/db/learner";
import { buildBrainTree } from "@/lib/brain/tree";
import { summarizeBrain } from "@/lib/brain/summary";

export const runtime = "nodejs";
// Serverless ceiling: the brain summary is generated.
// 60s is the ceiling every Vercel plan allows and 4x the platform default;
// raise it in vercel.json on plans that permit more.
export const maxDuration = 60;

/** The learner's second brain: clustered tree + transparent summary. */
export async function GET() {
  const learner = await getCurrentLearner();
  if (!learner) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const tree = await buildBrainTree(learner.id);
  const summary = summarizeBrain(tree, learner.displayName, learner.language);
  return NextResponse.json({ ...tree, summary });
}
