import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentLearner } from "@/lib/db/learner";
import { generateJoinCode, normalizeJoinCode, isTeacher, teacherCodeValid } from "@/lib/auth/roles";
import { readJson, tooLargeResponse, BodyTooLargeError } from "@/lib/api/body";
import { reportError } from "@/lib/observability/report";

export const runtime = "nodejs";

const BodySchema = z.discriminatedUnion("op", [
  // Present the configured code to become a teacher. Idempotent.
  z.object({ op: z.literal("becomeTeacher"), code: z.string().min(1).max(128) }),
  z.object({ op: z.literal("createClass"), name: z.string().min(1).max(60) }),
  z.object({ op: z.literal("join"), joinCode: z.string().min(4).max(20) }),
  z.object({ op: z.literal("leave") }),
]);

/** The caller's own class context — never anyone else's. */
export async function GET() {
  const learner = await getCurrentLearner();
  if (!learner) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const owned = isTeacher(learner)
    ? await prisma.schoolClass.findMany({
        where: { teacherId: learner.id },
        select: { id: true, name: true, joinCode: true, _count: { select: { members: true } } },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const member = learner.classId
    ? await prisma.schoolClass.findUnique({
        where: { id: learner.classId },
        // A learner sees the class NAME, never its join code and never its roster.
        select: { id: true, name: true },
      })
    : null;

  return NextResponse.json({ role: learner.role, ownedClasses: owned, memberOf: member });
}

export async function POST(req: Request) {
  const learner = await getCurrentLearner();
  if (!learner) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let raw: unknown = null;
  try {
    raw = await readJson(req);
  } catch (err) {
    if (err instanceof BodyTooLargeError) return tooLargeResponse();
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const body = parsed.data;

  try {
    if (body.op === "becomeTeacher") {
      if (!teacherCodeValid(body.code)) {
        // Same answer for "wrong code" and "no code configured on this host":
        // whether the feature exists here is not something to probe for.
        return NextResponse.json({ error: "That code is not valid." }, { status: 403 });
      }
      await prisma.learner.update({ where: { id: learner.id }, data: { role: "teacher" } });
      return NextResponse.json({ ok: true, role: "teacher" });
    }

    if (body.op === "createClass") {
      if (!isTeacher(learner)) return NextResponse.json({ error: "Teachers only." }, { status: 403 });
      // Retry on the (astronomically unlikely) code collision rather than 500.
      for (let attempt = 0; attempt < 5; attempt++) {
        const joinCode = generateJoinCode(randomBytes(8));
        const existing = await prisma.schoolClass.findUnique({ where: { joinCode }, select: { id: true } });
        if (existing) continue;
        const created = await prisma.schoolClass.create({
          data: { name: body.name.trim(), joinCode, teacherId: learner.id },
          select: { id: true, name: true, joinCode: true },
        });
        return NextResponse.json({ ok: true, class: created });
      }
      return NextResponse.json({ error: "Could not allocate a join code." }, { status: 503 });
    }

    if (body.op === "join") {
      const target = await prisma.schoolClass.findUnique({
        where: { joinCode: normalizeJoinCode(body.joinCode) },
        select: { id: true, name: true, teacherId: true },
      });
      if (!target) return NextResponse.json({ error: "No class with that code." }, { status: 404 });
      // A teacher joining their own class would put them in their own cohort
      // numbers, which is not what the aggregate means.
      if (target.teacherId === learner.id) {
        return NextResponse.json({ error: "You already own this class." }, { status: 400 });
      }
      await prisma.learner.update({ where: { id: learner.id }, data: { classId: target.id } });
      return NextResponse.json({ ok: true, class: { id: target.id, name: target.name } });
    }

    await prisma.learner.update({ where: { id: learner.id }, data: { classId: null } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    reportError("api/classes", `class op failed: ${body.op}`, err);
    return NextResponse.json({ error: "Could not complete that right now." }, { status: 503 });
  }
}
