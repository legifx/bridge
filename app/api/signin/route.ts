import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { LEARNER_COOKIE, isValidUsername, normalizeHandle } from "@/lib/db/learner";
import { st } from "@/lib/i18n";

export const runtime = "nodejs";

const BodySchema = z.object({
  username: z.string().min(1).max(60),
  // the client's current UI language — no learner exists yet at this point
  language: z.string().min(2).max(8).optional(),
});

/**
 * Username-only sign-in (public demo). The same handle always resolves to the
 * same profile — deliberately open test accounts, hence the "no private data"
 * notice in the UI. New handles get a fresh learner and go through onboarding.
 */
export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  const lang = parsed.success ? parsed.data.language : undefined;
  if (!parsed.success || !isValidUsername(parsed.data.username)) {
    return NextResponse.json({ error: st(lang, "signin.invalidName") }, { status: 400 });
  }

  const displayName = parsed.data.username.trim().replace(/\s+/g, " ");
  const handle = normalizeHandle(displayName);

  let learner;
  try {
    learner = await prisma.learner.findUnique({
      where: { handle },
      include: { _count: { select: { domains: true } } },
    });
    if (!learner) {
      // Seed the learner's language from the UI immediately, so the very first
      // brain/summary render is already in their language (not English).
      const created = await prisma.learner.create({
        data: { displayName, handle, ...(lang ? { language: lang } : {}) },
      });
      learner = { ...created, _count: { domains: 0 } };
    }
  } catch (err) {
    // Never fall through with an empty body: the client would only see
    // "Unexpected end of JSON input" instead of what actually broke.
    console.error("signin: database unavailable", err);
    return NextResponse.json(
      { error: "The database is unavailable right now. Please try again in a moment." },
      { status: 503 },
    );
  }

  const res = NextResponse.json({
    learnerId: learner.id,
    displayName: learner.displayName,
    hasProfile: learner._count.domains > 0,
  });
  res.cookies.set(LEARNER_COOKIE, learner.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
