import { NextResponse } from "next/server";
import { LEARNER_COOKIE } from "@/lib/db/learner";

export const runtime = "nodejs";

function cleared(res: NextResponse) {
  res.cookies.set(LEARNER_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

/** Also reachable via GET so a stale session can be cleared by a plain link. */
export async function GET(req: Request) {
  return cleared(NextResponse.redirect(new URL("/signin?expired=1", req.url)));
}

export async function POST() {
  return cleared(NextResponse.json({ ok: true }));
}
