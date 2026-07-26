import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentLearner } from "@/lib/db/learner";
import { isTeacher } from "@/lib/auth/roles";
import { getCohortStruggles } from "@/lib/teacher/aggregate";

export const runtime = "nodejs";

/**
 * Cohort struggle aggregate for ONE class.
 *
 * This route had no session check at all and rolled up every learner in the
 * database — reachable by anyone, because the page in front of it is parked
 * behind a redirect and nobody re-checked the route behind it. Three boundaries
 * now stand between a caller and the numbers: a session, the teacher role, and
 * ownership of the class being asked about.
 */
export async function GET(req: Request) {
  const learner = await getCurrentLearner();
  if (!learner) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!isTeacher(learner)) return NextResponse.json({ error: "Teachers only." }, { status: 403 });

  const requested = new URL(req.url).searchParams.get("classId");

  // Default to the teacher's own first class; an explicit id must still be one
  // they own, or this is just the old hole with a query parameter in front.
  const own = await prisma.schoolClass.findMany({
    where: { teacherId: learner.id },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  if (own.length === 0) {
    return NextResponse.json({ classes: [], concepts: [], withheld: 0, learners: 0 });
  }
  const target = requested ? own.find((c) => c.id === requested) : own[0];
  if (!target) return NextResponse.json({ error: "Class not found." }, { status: 404 });

  const result = await getCohortStruggles(target.id);
  return NextResponse.json({ classes: own, classId: target.id, ...result });
}
