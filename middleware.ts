import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Kept in sync with lib/db/learner.ts — middleware runs on the edge and must
// not import the Prisma-backed module.
const LEARNER_COOKIE = "learnerId";

/**
 * Security headers, applied to every response.
 *
 * The CSP is nonce-based rather than `unsafe-inline`: Next stamps the nonce
 * onto the scripts it injects, so a script that the app did not emit cannot
 * run — which is the whole point of having a policy. Development additionally
 * needs `unsafe-eval` (the dev bundler) and websockets (fast refresh).
 *
 *   img-src data:/blob: — captures are read as data URLs before upload
 *   connect-src 'self'  — the app never talks to a third party from the browser;
 *                         the model calls all happen server-side
 *   frame-ancestors 'none' — nothing about this app should be embeddable
 */
function securityHeaders(nonce: string): Record<string, string> {
  const dev = process.env.NODE_ENV !== "production";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${dev ? "'unsafe-eval'" : ""}`.trim(),
    // Tailwind ships as a stylesheet, but Next inlines critical CSS and React
    // sets style attributes — those cannot carry a nonce.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
  ].join("; ");

  return {
    "Content-Security-Policy": csp,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    // The app itself uses the camera (capture) and microphone (dictation);
    // everything else is switched off.
    "Permissions-Policy": "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()",
    "X-Frame-Options": "DENY",
    "Cross-Origin-Opener-Policy": "same-origin",
  };
}

/**
 * Personal screens require a signed-in profile; visitors without a session
 * land on /signin. Aggregate/showcase pages (/compare, /teacher) stay open.
 */
export function middleware(req: NextRequest) {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const headers = securityHeaders(nonce);

  const guarded = !PUBLIC_PATH.test(req.nextUrl.pathname);
  if (guarded && !req.cookies.has(LEARNER_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = "/signin";
    const res = NextResponse.redirect(url);
    for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
    return res;
  }

  // Hand the nonce to the renderer (Next reads this request header and stamps
  // it onto its own script tags), and set the policy on the way out.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", headers["Content-Security-Policy"]);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
  return res;
}

/** Pages that stay open to visitors without a session. */
const PUBLIC_PATH = /^\/(signin|compare|teacher|project|api|_next|icons|manifest\.webmanifest|favicon\.ico)(\/|$)/;

export const config = {
  // Everything except static assets: the headers belong on every document, and
  // the sign-in redirect only applies to the guarded paths above.
  matcher: ["/((?!_next/static|_next/image|icons|favicon\\.ico).*)"],
};
