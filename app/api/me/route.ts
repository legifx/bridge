import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentLearner, LEARNER_COOKIE } from "@/lib/db/learner";
import { verifyPassword } from "@/lib/auth/password";
import { st } from "@/lib/i18n";
import { isPublicDemo, quotaState } from "@/lib/quota";
import { dbConfig } from "@/lib/db/prisma";
import { prisma } from "@/lib/db/prisma";
import { readJson, tooLargeResponse, BodyTooLargeError } from "@/lib/api/body";

export const runtime = "nodejs";

/** Session info for the shell: who is signed in, and how much demo budget is left. */
export async function GET() {
  const learner = await getCurrentLearner();
  let dbReachable = true;
  try {
    await prisma.learner.count();
  } catch {
    dbReachable = false;
  }
  return NextResponse.json({
    learner: learner
      ? {
          id: learner.id,
          displayName: learner.displayName,
          language: learner.language,
          gradeSystem: learner.gradeSystem,
        }
      : null,
    publicDemo: isPublicDemo(),
    db: { ...dbConfig(), reachable: dbReachable },
    quota: learner && !learner.unlimited ? quotaState(learner.aiUnits) : null,
  });
}

/**
 * Delete this profile and everything attached to it.
 *
 * Learners can create a profile in two taps; being unable to remove one is not
 * a defensible position for an app that stores a person's interests, uploaded
 * school material and answers. Every relation cascades from Learner (see
 * schema.prisma), so one delete really does take the concepts, sources,
 * bridges, reviews, brain items and interview logs with it.
 *
 * The account password is required when the profile has one — a stolen session
 * must not be enough to wipe someone's work.
 */
const DeleteSchema = z.object({ password: z.string().max(128).optional() });

export async function DELETE(req: Request) {
  const learner = await getCurrentLearner();
  if (!learner) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let raw: unknown = null;
  try {
    raw = await readJson(req);
  } catch (err) {
    if (err instanceof BodyTooLargeError) return tooLargeResponse();
  }
  const parsed = DeleteSchema.safeParse(raw ?? {});
  const password = parsed.success ? parsed.data.password?.trim() : undefined;

  if (learner.passwordHash) {
    if (!password || !(await verifyPassword(password, learner.passwordHash))) {
      return NextResponse.json({ error: st(learner.language, "signin.wrongPassword") }, { status: 401 });
    }
  }

  await prisma.learner.delete({ where: { id: learner.id } });

  const res = NextResponse.json({ deleted: true });
  res.cookies.set(LEARNER_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

const PatchSchema = z.object({
  language: z.string().min(2).max(8).regex(/^[a-z-]+$/i).optional(),
  gradeSystem: z.string().min(2).max(16).regex(/^[a-z]+$/i).optional(),
});

/** Update learner settings — main language and/or country grade system. */
export async function PATCH(req: Request) {
  const learner = await getCurrentLearner();
  if (!learner) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let raw: unknown = null;
  try {
    raw = await readJson(req);
  } catch (err) {
    if (err instanceof BodyTooLargeError) return tooLargeResponse();
    // malformed JSON — the schema below turns it into the usual 400
  }
  const parsed = PatchSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid settings." }, { status: 400 });

  const data: { language?: string; gradeSystem?: string } = {};
  if (parsed.data.language) data.language = parsed.data.language.toLowerCase();
  if (parsed.data.gradeSystem) data.gradeSystem = parsed.data.gradeSystem.toLowerCase();
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  await prisma.learner.update({ where: { id: learner.id }, data });
  return NextResponse.json({ ok: true, ...data });
}
