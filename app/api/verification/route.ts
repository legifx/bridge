import { NextResponse } from "next/server";
import { getCurrentLearner } from "@/lib/db/learner";
import { getVerificationLog } from "@/lib/bridge/log";

export const runtime = "nodejs";

export async function GET() {
  const learner = await getCurrentLearner();
  const entries = await getVerificationLog(learner.id);
  return NextResponse.json({ entries });
}
