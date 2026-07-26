import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { RUNTIME_MIGRATIONS } from "@/lib/db/bootstrap";

/**
 * The hosted database is Turso, which `prisma migrate` cannot reach: a new
 * column only exists in production if it is ALSO listed in RUNTIME_MIGRATIONS.
 * Adding a migration folder and forgetting that entry has taken the public demo
 * down three times with "no such column" — the third time was a Concept column
 * added without an entry, which 500'd every concept read until it was noticed.
 *
 * The comment in bootstrap.ts asked people to remember. This makes the suite
 * remember instead.
 */

// Everything up to and including this migration is the schema Turso was first
// created with; the runtime bootstrap only exists for what came after.
const TURSO_BASELINE = "20260722163741_onboarding_v3";

describe("Turso runtime bootstrap", () => {
  const folders = readdirSync(join(process.cwd(), "prisma", "migrations"), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  const registered = new Set(RUNTIME_MIGRATIONS.map((m) => m.name));
  const afterBaseline = folders.filter((n) => n > TURSO_BASELINE);

  it("has the baseline and some migrations after it (guard against an empty scan)", () => {
    expect(folders).toContain(TURSO_BASELINE);
    expect(afterBaseline.length).toBeGreaterThan(0);
  });

  it.each(afterBaseline)("%s is registered in RUNTIME_MIGRATIONS", (name) => {
    expect(
      registered.has(name),
      `prisma/migrations/${name} has no entry in RUNTIME_MIGRATIONS (lib/db/bootstrap.ts). ` +
        `Without one the column never reaches Turso and production 500s on the first query that reads it.`,
    ).toBe(true);
  });

  it("only uses additive, idempotent statements", () => {
    for (const m of RUNTIME_MIGRATIONS) {
      for (const sql of m.statements) {
        expect(
          /^\s*(ALTER TABLE .* ADD COLUMN|CREATE TABLE IF NOT EXISTS|CREATE INDEX IF NOT EXISTS|CREATE UNIQUE INDEX IF NOT EXISTS|UPDATE )/i.test(sql),
          `${m.name}: "${sql}" is not additive/idempotent — table rewrites belong in migrate-remote.mjs`,
        ).toBe(true);
      }
    }
  });
});
