/**
 * Session cookie integrity.
 *
 * The cookie carries the learner id. On its own that makes the session a
 * bearer token that anyone can *write*: with a known id, setting the cookie by
 * hand opens the profile and walks straight past the account password. Ids are
 * random, so this was never a practical break-in — but "the password only holds
 * as long as nobody learns an id" is not a property worth relying on.
 *
 * So the cookie value is `<id>.<hmac>`, signed with AUTH_SECRET. Forging one
 * requires the secret, not just an id.
 *
 * With no AUTH_SECRET configured the app keeps accepting plain ids — a fresh
 * clone must still work with nothing but a database URL. Set AUTH_SECRET (any
 * long random string) on a hosted deployment and the cookie becomes
 * unforgeable; existing sessions are signed out once on the switch.
 */
import { createHmac, timingSafeEqual } from "crypto";

const SECRET = (process.env.AUTH_SECRET || "").trim();
/** Are sessions cryptographically signed on this host? */
export const SESSIONS_SIGNED = SECRET.length >= 16;

function sign(id: string): string {
  return createHmac("sha256", SECRET).update(id).digest("base64url");
}

/** Cookie value for a learner id. */
export function encodeSession(id: string): string {
  return SESSIONS_SIGNED ? `${id}.${sign(id)}` : id;
}

/**
 * Learner id from a cookie value, or null when it is missing or forged.
 * When signing is on, an unsigned (legacy) cookie is rejected — the visitor
 * simply signs in again, and the account password is enforced as it should be.
 */
export function decodeSession(value: string | undefined | null): string | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (!SESSIONS_SIGNED) {
    // Unsigned host: tolerate both shapes so turning signing on and off again
    // does not strand anyone.
    return dot === -1 ? value : value.slice(0, dot);
  }
  if (dot <= 0) return null;
  const id = value.slice(0, dot);
  const given = Buffer.from(value.slice(dot + 1));
  const expected = Buffer.from(sign(id));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return id;
}
