/**
 * Restore a backup written by scripts/backup-turso.mjs.
 *
 * A backup nobody has ever restored is a hope, not a backup — the blob bug this
 * script found on its first run (embeddings serialized as `{}`) is exactly the
 * kind of thing that only shows up when you try to put the data back.
 *
 * Usage (DESTRUCTIVE — it empties the target tables first):
 *   TARGET_DATABASE_URL=file:/tmp/restore-check.db \
 *   node scripts/restore-turso.mjs /mnt/e/backups/bridge/bridge-….ndjson.gz
 *
 * Refuses to touch the URL in TURSO_DATABASE_URL unless RESTORE_TO_PROD=yes:
 * the common case is restoring into a scratch database to VERIFY the backup,
 * and "verify the backup" must not be one typo away from "overwrite production".
 */
import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";
import readline from "node:readline";

const file = process.argv[2];
const target = process.env.TARGET_DATABASE_URL;

if (!file || !target) {
  console.error("Usage: TARGET_DATABASE_URL=… node scripts/restore-turso.mjs <backup.ndjson.gz>");
  process.exit(1);
}
if (target === process.env.TURSO_DATABASE_URL && process.env.RESTORE_TO_PROD !== "yes") {
  console.error("Refusing to restore over TURSO_DATABASE_URL. Set RESTORE_TO_PROD=yes if you mean it.");
  process.exit(1);
}

const { createClient } = await import("@libsql/client");
const client = createClient({ url: target, authToken: process.env.TARGET_AUTH_TOKEN });

const rl = readline.createInterface({ input: createReadStream(file).pipe(createGunzip()) });

let meta = null;
const buffered = new Map(); // table -> rows, so tables can be emptied once, up front
for await (const line of rl) {
  if (!line.trim()) continue;
  const rec = JSON.parse(line);
  if (rec.meta) {
    meta = rec.meta;
    continue;
  }
  if (!buffered.has(rec.table)) buffered.set(rec.table, []);
  buffered.get(rec.table).push(rec.row);
}
if (!meta) throw new Error("no meta line — this is not a bridge backup");

/**
 * Parents before children. The dump is alphabetical, which put BrainItem before
 * Learner and failed on a foreign key on the very first restore attempt. The
 * order is derived from the target schema itself (PRAGMA foreign_key_list) so it
 * keeps working when a model is added.
 */
async function topoOrder(tables) {
  const deps = new Map();
  for (const t of tables) {
    const res = await client.execute(`PRAGMA foreign_key_list("${t}")`);
    const parents = new Set(
      res.rows.map((r) => String(r.table)).filter((p) => p !== t && tables.includes(p)),
    );
    deps.set(t, parents);
  }
  const ordered = [];
  const done = new Set();
  // Cycles are possible in principle; the guard stops an infinite loop and the
  // leftovers are appended, where PRAGMA foreign_keys=OFF still lets them land.
  for (let pass = 0; pass < tables.length + 1 && done.size < tables.length; pass++) {
    for (const t of tables) {
      if (done.has(t)) continue;
      if ([...deps.get(t)].every((p) => done.has(p))) {
        ordered.push(t);
        done.add(t);
      }
    }
  }
  return [...ordered, ...tables.filter((t) => !done.has(t))];
}

// Belt and braces: even in the right order, a self-referencing row can trip the
// check mid-restore. The database is a scratch target by policy (see the guard
// at the top), so relaxing enforcement for the load is safe.
await client.execute("PRAGMA foreign_keys = OFF");

const order = await topoOrder([...buffered.keys()]);
// Children first when emptying, parents first when filling.
for (const table of [...order].reverse()) await client.execute(`DELETE FROM "${table}"`);

let total = 0;
for (const table of order) {
  const rows = buffered.get(table);
  for (const row of rows) {
    const cols = Object.keys(row);
    const args = cols.map((c) => {
      const v = row[c];
      // Back to bytes. Anything else would store the literal string "[object
      // Object]" where a 384-dimension vector belongs.
      return v && typeof v === "object" && v.$b64 ? Buffer.from(v.$b64, "base64") : v;
    });
    await client.execute({
      sql: `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${cols.map(() => "?").join(",")})`,
      args,
    });
    total += 1;
  }
  console.log(`${table}: ${rows.length}`);
}

await client.execute("PRAGMA foreign_keys = ON");
console.log(`restored ${total} rows from ${file} (taken ${meta.at})`);
client.close();
