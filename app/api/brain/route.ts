import { NextResponse } from "next/server";
import { getCurrentLearner } from "@/lib/db/learner";
import { buildBrainTree } from "@/lib/brain/tree";
import { summarizeBrain } from "@/lib/brain/summary";

export const runtime = "nodejs";

/** The learner's second brain: clustered tree + transparent summary. */
export async function GET() {
  const learner = await getCurrentLearner();
  const tree = await buildBrainTree(learner.id);
  const summary = summarizeBrain(tree, learner.displayName);
  return NextResponse.json({ ...tree, summary });
}
