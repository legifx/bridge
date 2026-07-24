/**
 * Find (and optionally remove) rows whose learner no longer exists.
 *
 * Deleting a Learner cascades — verified — so orphans should not appear. They
 * do exist in databases that predate the delete endpoint, where profiles were
 * removed by hand. Rows like these are the worst kind of leftover: someone's
 * interest profile and second brain, with nobody left to own them, invisible to
 * every screen in the app.
 *
 *   node scripts/prune-orphans.mjs            # report only (default)
 *   node scripts/prune-orphans.mjs --apply    # actually delete
 *
 * Honours DATABASE_URL, or TURSO_DATABASE_URL/TURSO_AUTH_TOKEN for the hosted
 * database, exactly like the app does.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

const apply = process.argv.includes("--apply");

const prisma = process.env.TURSO_DATABASE_URL
  ? new PrismaClient({
      adapter: new PrismaLibSQL({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
      }),
    })
  : new PrismaClient();

const MODELS = [
  ["interestDomain", "interest domains"],
  ["brainItem", "second-brain items"],
  ["onboardingSession", "interview sessions"],
  ["concept", "concepts"],
  ["source", "captures"],
];

const learners = await prisma.learner.findMany({ select: { id: true } });
const alive = learners.map((l) => l.id);

let total = 0;
for (const [model, label] of MODELS) {
  const where = { learnerId: { notIn: alive } };
  const count = await prisma[model].count({ where });
  total += count;
  if (count === 0) continue;
  if (apply) {
    await prisma[model].deleteMany({ where });
    console.log(`removed ${count} orphaned ${label}`);
  } else {
    console.log(`${count} orphaned ${label}`);
  }
}

if (total === 0) console.log("no orphaned rows — every row has a learner.");
else if (!apply) console.log(`\n${total} rows belong to profiles that no longer exist.`);
else console.log(`\ndone — ${total} rows removed.`);

await prisma.$disconnect();
