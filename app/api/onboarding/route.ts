import { NextResponse } from "next/server";
import { z } from "zod";
import { buildProfile } from "@/lib/profile/build";
import { checkInterestText } from "@/lib/profile/guard";
import { getCurrentLearner } from "@/lib/db/learner";
import { apiError } from "@/lib/api/errors";

export const runtime = "nodejs";
// Serverless ceiling: the multi-step interview synthesis.
// 60s is the ceiling every Vercel plan allows and 4x the platform default;
// raise it in vercel.json on plans that permit more.
export const maxDuration = 60;

const IntensitySchema = z.enum(["casual", "into", "deep"]);

const BodySchema = z.object({
  readingLevel: z.number().int().min(1).max(5).optional(),
  picks: z.array(z.object({ id: z.string(), intensity: IntensitySchema })).max(30),
  custom: z.array(z.object({ text: z.string().min(2).max(80), intensity: IntensitySchema })).max(6),
});

export async function POST(req: Request) {
  const learner = await getCurrentLearner();
  if (!learner) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid onboarding payload." }, { status: 400 });
  }
  const { readingLevel, picks, custom } = parsed.data;

  // Privacy guard on every free-text interest (§7) — refuse sensitive input early.
  for (const c of custom) {
    const guard = checkInterestText(c.text);
    if (!guard.ok) {
      return NextResponse.json({ error: guard.message, topic: guard.topic }, { status: 422 });
    }
  }

  if (picks.length === 0 && custom.length === 0) {
    return NextResponse.json(
      { error: "Tap at least one thing — or add your own interest. Skipping everything tells us nothing." },
      { status: 400 },
    );
  }

  try {
    const { domains } = await buildProfile({
      learnerId: learner.id,
      readingLevel: readingLevel ?? 3,
      picks,
      custom,
    });

    return NextResponse.json({ learnerId: learner.id, domains });
  } catch (err) {
    return apiError("onboarding", err, learner.language);
  }
}
