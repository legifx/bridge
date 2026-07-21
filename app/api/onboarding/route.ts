import { NextResponse } from "next/server";
import { z } from "zod";
import { buildProfile } from "@/lib/profile/build";
import { checkInterestText } from "@/lib/profile/guard";
import { LEARNER_COOKIE } from "@/lib/db/learner";

export const runtime = "nodejs";

const BodySchema = z.object({
  displayName: z.string().max(60).optional(),
  readingLevel: z.number().int().min(1).max(5).optional(),
  selectionIds: z.array(z.string()).max(10),
  freeText: z.string().max(300).optional(),
});

export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid onboarding payload." }, { status: 400 });
  }
  const { displayName, readingLevel, selectionIds, freeText } = parsed.data;

  // Privacy guard on free text (§7) — refuse sensitive input before storing.
  const guard = checkInterestText(freeText ?? "");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.message, topic: guard.topic }, { status: 422 });
  }

  if (selectionIds.length === 0 && !guard.text) {
    return NextResponse.json({ error: "Pick at least one option or tell us an interest." }, { status: 400 });
  }

  try {
    const { learnerId, domains } = await buildProfile({
      displayName: displayName ?? "You",
      readingLevel: readingLevel ?? 3,
      selectionIds,
      freeText: guard.text,
    });

    const res = NextResponse.json({ learnerId, domains });
    res.cookies.set(LEARNER_COOKIE, learnerId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onboarding failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
