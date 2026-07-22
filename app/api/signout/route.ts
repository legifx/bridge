import { NextResponse } from "next/server";
import { LEARNER_COOKIE } from "@/lib/db/learner";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(LEARNER_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
