/**
 * Recompute every stored vector with the current embedding model.
 *
 * Bridge stores embeddings for concepts, interest domains and second-brain
 * items, and matches them by cosine similarity. Vectors from two different
 * models share a dimension but not a space: mixing them does not throw, it just
 * silently returns nonsense similarities. So a model change is only half done
 * until this has run.
 *
 * Usage:
 *   node scripts/reembed.mjs --dry            # count what would change
 *   node scripts/reembed.mjs --apply          # rewrite the vectors
 *   DATABASE_URL=… node scripts/reembed.mjs --apply
 *
 * Safe to re-run and safe to interrupt: each row is written on its own, so a
 * killed run leaves a partially migrated database that the next run finishes.
 * Nothing is deleted.
 */
import { PrismaClient } from "@prisma/client";

const apply = process.argv.includes("--apply");
if (!apply && !process.argv.includes("--dry")) {
  console.error("Pass --dry (report) or --apply (rewrite).");
  process.exit(1);
}

const prisma = new PrismaClient();
const { embed, EMBEDDING_MODEL, EMBED_DIM } = await import("../lib/ml/embeddings.ts").catch(async () => {
  // The library is TypeScript; when run outside a TS loader, fall back to the
  // same transformers call so this script works with plain `node`.
  const t = await import("@xenova/transformers");
  const model = process.env.EMBEDDING_MODEL || "Xenova/paraphrase-multilingual-MiniLM-L12-v2";
  const pipe = await t.pipeline("feature-extraction", model);
  return {
    EMBEDDING_MODEL: model,
    EMBED_DIM: 384,
    embed: async (text) =>
      Float32Array.from((await pipe(text, { pooling: "mean", normalize: true })).data),
  };
});

function vecToBytes(vec) {
  return Buffer.from(new Float32Array(vec).buffer);
}

console.log(`model: ${EMBEDDING_MODEL}`);
console.log(apply ? "mode: APPLY (rewriting vectors)" : "mode: dry run (nothing is written)");

let changed = 0;
let skipped = 0;

async function pass(name, load, textOf, write) {
  const rows = await load();
  console.log(`\n${name}: ${rows.length} rows`);
  for (const row of rows) {
    const text = textOf(row);
    if (!text || !text.trim()) {
      skipped += 1;
      continue;
    }
    if (!apply) {
      changed += 1;
      continue;
    }
    const vec = await embed(text);
    if (vec.length !== EMBED_DIM) {
      throw new Error(`model returned ${vec.length} dims, schema expects ${EMBED_DIM}`);
    }
    await write(row, vecToBytes(vec));
    changed += 1;
    if (changed % 25 === 0) process.stdout.write(`  ${changed}\r`);
  }
}

// The text used here MUST match what the app embeds at write time, or the
// migrated vectors would sit at slightly different points than new ones.
await pass(
  "Concept",
  () => prisma.concept.findMany({ select: { id: true, label: true, definition: true } }),
  (c) => `${c.label}. ${c.definition}`,
  (c, embedding) => prisma.concept.update({ where: { id: c.id }, data: { embedding } }),
);

await pass(
  "InterestDomain",
  () => prisma.interestDomain.findMany({ select: { id: true, name: true, anchors: true } }),
  (d) => {
    let anchors = [];
    try {
      anchors = JSON.parse(d.anchors ?? "[]");
    } catch {
      anchors = [];
    }
    return `${d.name}. ${anchors.join(", ")}`;
  },
  (d, embedding) => prisma.interestDomain.update({ where: { id: d.id }, data: { embedding } }),
);

await pass(
  "BrainItem",
  () => prisma.brainItem.findMany({ select: { id: true, text: true } }),
  (b) => b.text,
  (b, embedding) => prisma.brainItem.update({ where: { id: b.id }, data: { embedding } }),
);

console.log(`\n${apply ? "rewrote" : "would rewrite"} ${changed} vectors, skipped ${skipped} empty`);
if (!apply) console.log("Re-run with --apply to write them.");
await prisma.$disconnect();
