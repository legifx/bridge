import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentLearner, LEARNER_COOKIE } from "@/lib/db/learner";

export const runtime = "nodejs";

/** List local learner profiles (for the demo profile switcher). */
export async function GET() {
  const [learners, current] = await Promise.all([
    prisma.learner.findMany({
      orderBy: { createdAt: "asc" },
      include: { domains: { select: { name: true } } },
    }),
    getCurrentLearner(),
  ]);
  return NextResponse.json({
    currentId: current.id,
    profiles: learners.map((l) => ({
      id: l.id,
      displayName: l.displayName,
      domains: l.domains.map((d) => d.name),
    })),
  });
}

const BodySchema = z.object({ learnerId: z.string().min(1) });

/** Switch the active profile. */
export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "learnerId required." }, { status: 400 });
  const exists = await prisma.learner.findUnique({ where: { id: parsed.data.learnerId } });
  if (!exists) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

  const res = NextResponse.json({ ok: true, currentId: exists.id });
  res.cookies.set(LEARNER_COOKIE, exists.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
