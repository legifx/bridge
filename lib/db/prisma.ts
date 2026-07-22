import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import fs from "node:fs";
import path from "node:path";

/**
 * Database strategy, in order:
 * 1. TURSO_DATABASE_URL set  -> hosted libSQL (SQLite-compatible). This is the
 *    persistent store for the public demo: same schema, same queries, two env
 *    vars. Sign-in names survive deploys and lambda recycling.
 * 2. On Vercel without Turso -> copy the seeded template (prisma/demo.db) into
 *    /tmp (the only writable path). Works, but ephemeral per instance.
 * 3. Locally                 -> DATABASE_URL from .env (file:./dev.db).
 */
function makeClient(): PrismaClient {
  if (process.env.TURSO_DATABASE_URL) {
    const adapter = new PrismaLibSQL({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    return new PrismaClient({ adapter });
  }

  if (process.env.VERCEL) {
    const tmp = "/tmp/bridge.db";
    if (!fs.existsSync(tmp)) {
      const template = path.join(process.cwd(), "prisma", "demo.db");
      if (fs.existsSync(template)) fs.copyFileSync(template, tmp);
    }
    return new PrismaClient({ datasources: { db: { url: `file:${tmp}` } } });
  }

  return new PrismaClient();
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
