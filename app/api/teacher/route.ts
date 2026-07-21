import { NextResponse } from "next/server";
import { getCohortStruggles } from "@/lib/teacher/aggregate";

export const runtime = "nodejs";

export async function GET() {
  const concepts = await getCohortStruggles();
  return NextResponse.json({ concepts });
}
