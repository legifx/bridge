/**
 * Runtime schema bootstrap for the hosted (Turso) database.
 *
 * `prisma migrate` cannot talk to libSQL URLs, so new columns historically had
 * to be replayed by hand with scripts/migrate-remote.mjs BEFORE each deploy —
 * forgetting that took the public demo down twice ("no such column: …").
 * This closes the trap: on the first query of a fresh lambda, any pending
 * runtime migration below is applied idempotently against Turso, using the
 * same `_applied_migrations` ledger as migrate-remote.mjs.
 *
 * Rules for entries: additive, idempotent statements only (ADD COLUMN,
 * CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS). Anything that
 * rewrites tables still belongs in migrate-remote.mjs, run manually.
 */

type RuntimeMigration = { name: string; statements: string[] };

// Keep names identical to the prisma/migrations folder so the ledger stays
// consistent no matter which path applied a migration first.
const RUNTIME_MIGRATIONS: RuntimeMigration[] = [
  {
    name: "20260722183446_main_language_and_subject_folders",
    statements: [
      `ALTER TABLE "Source" ADD COLUMN "subject" TEXT`,
      `ALTER TABLE "Learner" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en'`,
    ],
  },
  {
    // data backfill: seeded demo folders predate the subject column
    name: "20260722190000_backfill_demo_subject",
    statements: [
      `UPDATE "Source" SET "subject" = 'Chemistry' WHERE "subject" IS NULL AND "title" = 'Chemical bonding'`,
    ],
  },
  {
    name: "20260723150000_account_password_unlimited",
    statements: [
      `ALTER TABLE "Learner" ADD COLUMN "passwordHash" TEXT`,
      `ALTER TABLE "Learner" ADD COLUMN "unlimited" BOOLEAN NOT NULL DEFAULT false`,
    ],
  },
  {
    name: "20260723183000_signin_lockout",
    statements: [
      `ALTER TABLE "Learner" ADD COLUMN "failedAttempts" INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE "Learner" ADD COLUMN "lockedUntil" DATETIME`,
    ],
  },
];

async function run(): Promise<void> {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) return;
  try {
    const { createClient } = await import("@libsql/client");
    const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
    await client.execute(
      "CREATE TABLE IF NOT EXISTS _applied_migrations (name TEXT PRIMARY KEY, appliedAt TEXT DEFAULT CURRENT_TIMESTAMP)",
    );
    const done = new Set(
      (await client.execute("SELECT name FROM _applied_migrations")).rows.map((r) => String(r.name)),
    );
    for (const m of RUNTIME_MIGRATIONS) {
      if (done.has(m.name)) continue;
      for (const sql of m.statements) {
        try {
          await client.execute(sql);
        } catch (err) {
          // Another lambda won the race, or migrate-remote ran without the
          // ledger entry — an already-existing column is success, not failure.
          if (!/duplicate column/i.test(String(err))) throw err;
        }
      }
      await client.execute({
        sql: "INSERT OR IGNORE INTO _applied_migrations (name) VALUES (?)",
        args: [m.name],
      });
      console.log(`turso bootstrap: applied ${m.name}`);
    }
    client.close();
  } catch (err) {
    // Never brick the app over bootstrap — queries will surface real problems.
    console.error("turso bootstrap failed", err);
  }
}

let pending: Promise<void> | null = null;

/** Resolves once the hosted schema is up to date (no-op off Turso). Memoized per lambda. */
export function ensureHostedSchema(): Promise<void> {
  if (!pending) pending = run();
  return pending;
}
