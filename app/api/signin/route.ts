import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { LEARNER_COOKIE, isValidUsername, normalizeHandle } from "@/lib/db/learner";

export const runtime = "nodejs";

const BodySchema = z.object({ username: z.string().min(1).max(60) });

/**
 * Username-only sign-in (public demo). The same handle always resolves to the
 * same profile — deliberately open test accounts, hence the "no private data"
 * notice in the UI. New handles get a fresh learner and go through onboarding.
 */
export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !isValidUsername(parsed.data.username)) {
    return NextResponse.json(
      { error: "Pick a name between 2 and 24 characters (letters, numbers, spaces)." },
      { status: 400 },
    );
  }

  const displayName = parsed.data.username.trim().replace(/\s+/g, " ");
  const handle = normalizeHandle(displayName);

  let learner = await prisma.learner.findUnique({
    where: { handle },
    include: { _count: { select: { domains: true } } },
  });
  if (!learner) {
    const created = await prisma.learner.create({ data: { displayName, handle } });
    learner = { ...created, _count: { domains: 0 } };
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
