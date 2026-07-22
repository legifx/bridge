import { NextResponse } from "next/server";
import { z } from "zod";
import { buildProfile } from "@/lib/profile/build";
import { checkInterestText } from "@/lib/profile/guard";
import { getCurrentLearner } from "@/lib/db/learner";

export const runtime = "nodejs";

const BodySchema = z.object({
  readingLevel: z.number().int().min(1).max(5).optional(),
  selectionIds: z.array(z.string()).max(10),
  freeText: z.string().max(300).optional(),
});

export async function POST(req: Request) {
  const learner = await getCurrentLearner();
  if (!learner) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid onboarding payload." }, { status: 400 });
  }
  const { readingLevel, selectionIds, freeText } = parsed.data;

  // Privacy guard on free text (§7) — refuse sensitive input before storing.
  const guard = checkInterestText(freeText ?? "");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.message, topic: guard.topic }, { status: 422 });
  }

  if (selectionIds.length === 0 && !guard.text) {
    return NextResponse.json({ error: "Pick at least one option or tell us an interest." }, { status: 400 });
  }

  try {
    const { domains } = await buildProfile({
      learnerId: learner.id,
      readingLevel: readingLevel ?? 3,
      selectionIds,
      freeText: guard.text,
    });

    return NextResponse.json({ learnerId: learner.id, domains });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onboarding failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
