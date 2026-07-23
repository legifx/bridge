import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { LEARNER_COOKIE, isValidUsername, normalizeHandle } from "@/lib/db/learner";
import { hashPassword, verifyPassword, isValidPassword, safeEqual } from "@/lib/auth/password";
import { st } from "@/lib/i18n";

export const runtime = "nodejs";

// Seeded "Explore" profiles (the sign-in page's demo buttons). These stay open
// and passwordless on purpose; every other account is protected by a password.
const DEMO_HANDLES = new Set(["mara", "theo"]);

// Brute-force lockout: after FAIL_THRESHOLD consecutive wrong passwords, block
// the account with exponential backoff (30s, doubling, capped at 15 min). This
// is per-account and DB-backed, so it holds up on serverless too.
const FAIL_THRESHOLD = 5;
const BASE_LOCK_MS = 30_000;
const MAX_LOCK_MS = 15 * 60_000;

const BodySchema = z.object({
  username: z.string().min(1).max(60),
  // the client's current UI language — no learner exists yet at this point
  language: z.string().min(2).max(8).optional(),
  // optional account lock: set on first sign-in of a new name, checked after.
  password: z.string().max(128).optional(),
  // optional owner code: grants unlimited AI budget when it matches the env.
  ownerCode: z.string().max(128).optional(),
});

/**
 * Sign-in (public demo). A name resolves to the same profile every time. New
 * names may set a password to lock the profile; a locked profile then requires
 * that password. Legacy/seed profiles without a password stay open (Explore).
 * Passing the OWNER_UNLOCK_CODE marks the account unlimited (no AI budget).
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
  const password = parsed.data.password?.trim() || undefined;
  const ownerCode = parsed.data.ownerCode?.trim() || undefined;
  const envOwnerCode = (process.env.OWNER_UNLOCK_CODE || "").trim();
  const ownerUnlock = !!ownerCode && !!envOwnerCode && safeEqual(ownerCode, envOwnerCode);

  let learner;
  try {
    const existing = await prisma.learner.findUnique({
      where: { handle },
      include: { _count: { select: { domains: true } } },
    });

    if (existing) {
      if (existing.passwordHash) {
        // Too many recent failures → temporarily blocked.
        if (existing.lockedUntil && existing.lockedUntil.getTime() > Date.now()) {
          const retryAfter = Math.ceil((existing.lockedUntil.getTime() - Date.now()) / 1000);
          return NextResponse.json(
            { error: st(lang, "signin.tooManyAttempts"), retryAfter },
            { status: 429 },
          );
        }
        // Locked profile → the password must match, every time.
        if (!password || !(await verifyPassword(password, existing.passwordHash))) {
          const attempts = existing.failedAttempts + 1;
          const data: { failedAttempts: number; lockedUntil?: Date } = { failedAttempts: attempts };
          if (attempts >= FAIL_THRESHOLD) {
            const backoff = Math.min(MAX_LOCK_MS, BASE_LOCK_MS * 2 ** (attempts - FAIL_THRESHOLD));
            data.lockedUntil = new Date(Date.now() + backoff);
          }
          await prisma.learner.update({ where: { id: existing.id }, data });
          return NextResponse.json({ error: st(lang, "signin.wrongPassword") }, { status: 401 });
        }
        // Correct password → clear any failure counters.
        if (existing.failedAttempts > 0 || existing.lockedUntil) {
          await prisma.learner.update({
            where: { id: existing.id },
            data: { failedAttempts: 0, lockedUntil: null },
          });
        }
      } else if (!DEMO_HANDLES.has(handle)) {
        // A real account that never had a password yet. Trust-on-first-use: the
        // password entered now becomes the account's permanent password, and a
        // name alone can no longer open it. A password is required to proceed —
        // otherwise the profile would stay open forever.
        if (!password) {
          return NextResponse.json({ error: st(lang, "signin.passwordRequired") }, { status: 400 });
        }
        if (!isValidPassword(password)) {
          return NextResponse.json({ error: st(lang, "signin.passwordTooShort") }, { status: 400 });
        }
        await prisma.learner.update({
          where: { id: existing.id },
          data: { passwordHash: await hashPassword(password) },
        });
      }
      // else: seeded demo profile (mara/theo) — deliberately open, never locked.

      // Owner code can be applied to an existing account to lift its budget.
      if (ownerUnlock && !existing.unlimited) {
        await prisma.learner.update({ where: { id: existing.id }, data: { unlimited: true } });
      }
      learner = existing;
    } else {
      // New name → a password is required to create the account.
      if (!password) {
        return NextResponse.json({ error: st(lang, "signin.passwordRequired") }, { status: 400 });
      }
      if (!isValidPassword(password)) {
        return NextResponse.json({ error: st(lang, "signin.passwordTooShort") }, { status: 400 });
      }
      const created = await prisma.learner.create({
        data: {
          displayName,
          handle,
          passwordHash: await hashPassword(password),
          unlimited: ownerUnlock,
          ...(lang ? { language: lang } : {}),
        },
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
