import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Kept in sync with lib/db/learner.ts — middleware runs on the edge and must
// not import the Prisma-backed module.
const LEARNER_COOKIE = "learnerId";

/**
 * Personal screens require a signed-in profile; visitors without a session
 * land on /signin. Aggregate/showcase pages (/compare, /teacher) stay open.
 */
export function middleware(req: NextRequest) {
  if (!req.cookies.has(LEARNER_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = "/signin";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!signin|compare|teacher|project|api|_next|icons|manifest\\.webmanifest|favicon\\.ico).*)",
  ],
};
