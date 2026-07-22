/**
 * Apply the SQLite migrations in prisma/migrations to a remote Turso (libSQL)
 * database. `prisma migrate` only talks to local files, so this small script
 * replays the same SQL against the hosted DB.
 *
 *   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... node scripts/migrate-remote.mjs
 *
 * Then seed it the same way:
 *   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npx prisma db seed
 */
import { createClient } from "@libsql/client";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error("Set TURSO_DATABASE_URL (and TURSO_AUTH_TOKEN).");
  process.exit(1);
}

const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const dir = join(process.cwd(), "prisma", "migrations");
const folders = readdirSync(dir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

await client.execute(
  "CREATE TABLE IF NOT EXISTS _applied_migrations (name TEXT PRIMARY KEY, appliedAt TEXT DEFAULT CURRENT_TIMESTAMP)",
);
const done = new Set(
  (await client.execute("SELECT name FROM _applied_migrations")).rows.map((r) => r.name),
);

for (const folder of folders) {
  if (done.has(folder)) {
    console.log("skip  ", folder);
    continue;
  }
  const sql = readFileSync(join(dir, folder, "migration.sql"), "utf8");
  await client.executeMultiple(sql);
  await client.execute({ sql: "INSERT INTO _applied_migrations (name) VALUES (?)", args: [folder] });
  console.log("apply ", folder);
}
console.log("Remote schema is up to date.");
