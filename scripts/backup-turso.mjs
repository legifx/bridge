/**
 * Back up the hosted (Turso) database to a local file.
 *
 * There was no backup of production at all: a bad migration, a wrong DELETE or
 * a dropped account and the learners' material was simply gone. This dumps
 * every table as newline-delimited JSON, gzipped, one file per run.
 *
 * Usage:
 *   TURSO_DATABASE_URL=libsql://… TURSO_AUTH_TOKEN=… \
 *   BACKUP_DIR=/mnt/e/backups/bridge node scripts/backup-turso.mjs
 *
 * The default target is /mnt/e (the SSD). That is not a preference: the root
 * disk on this server is a 5400rpm laptop drive whose IOPS budget is the thing
 * that takes the whole machine down when it saturates, and a backup is exactly
 * the kind of sustained sequential write that must not go there.
 *
 * Exit codes: 0 written, 1 failed (so a systemd unit or CI can alert on it).
 */
import { createWriteStream } from "node:fs";
import { mkdir, readdir, stat, unlink } from "node:fs/promises";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { join } from "node:path";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
const dir = process.env.BACKUP_DIR || "/mnt/e/backups/bridge";
const keep = Number(process.env.BACKUP_KEEP || 14);

if (!url) {
  console.error("TURSO_DATABASE_URL is not set — nothing to back up.");
  process.exit(1);
}

/** Tables are read from the database itself, so a new model is included
 *  automatically instead of being silently missed until it is needed. */
async function listTables(client) {
  const res = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream%'",
  );
  return res.rows.map((r) => String(r.name)).sort();
}

/**
 * libsql returns blob columns as ArrayBuffer, NOT as Uint8Array. Checking for
 * Uint8Array here looked right and silently serialized every stored embedding
 * as `{}` — a backup that appeared complete and would have restored a database
 * with no vectors in it, which is worse than having no backup at all.
 */
function isBlob(v) {
  return v instanceof ArrayBuffer || ArrayBuffer.isView(v);
}

/** Rows in pages: one findMany over a large table would buffer it all in memory. */
async function* dumpTable(client, table, pageSize = 500) {
  let offset = 0;
  for (;;) {
    const res = await client.execute({
      sql: `SELECT * FROM "${table}" LIMIT ? OFFSET ?`,
      args: [pageSize, offset],
    });
    if (res.rows.length === 0) return;
    for (const row of res.rows) {
      const obj = {};
      for (const [k, v] of Object.entries(row)) {
        // Blobs (the stored embeddings) are not JSON — keep them as base64 so a
        // restore is lossless rather than "everything except the vectors".
        obj[k] = isBlob(v) ? { $b64: Buffer.from(v).toString("base64") } : v;
      }
      yield { table, row: obj };
    }
    offset += res.rows.length;
    if (res.rows.length < pageSize) return;
  }
}

async function prune() {
  const files = (await readdir(dir))
    .filter((f) => f.startsWith("bridge-") && f.endsWith(".ndjson.gz"))
    .sort();
  for (const f of files.slice(0, Math.max(0, files.length - keep))) {
    await unlink(join(dir, f));
    console.log(`pruned ${f}`);
  }
}

async function main() {
  const { createClient } = await import("@libsql/client");
  const client = createClient({ url, authToken });

  await mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = join(dir, `bridge-${stamp}.ndjson.gz`);

  const tables = await listTables(client);
  if (tables.length === 0) throw new Error("no tables found — refusing to write an empty backup");
  console.log(`tables: ${tables.join(", ")}`);

  let rows = 0;
  async function* lines() {
    yield `${JSON.stringify({ meta: { at: new Date().toISOString(), tables } })}\n`;
    for (const table of tables) {
      for await (const rec of dumpTable(client, table)) {
        rows += 1;
        yield `${JSON.stringify(rec)}\n`;
      }
    }
  }

  await pipeline(Readable.from(lines()), createGzip(), createWriteStream(target));
  const { size } = await stat(target);

  // An "empty backup" is worse than none, because it looks like a backup.
  if (rows === 0) {
    await unlink(target);
    throw new Error("database returned zero rows — not writing a backup that restores nothing");
  }

  console.log(`wrote ${target} (${rows} rows, ${(size / 1024).toFixed(1)} KiB)`);
  await prune();
  client.close();
}

main().catch((err) => {
  console.error("backup failed:", err?.message ?? err);
  process.exit(1);
});
