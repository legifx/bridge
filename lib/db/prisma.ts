import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

/**
 * On serverless hosts (Vercel) the deployment filesystem is read-only, so the
 * SQLite file can't live next to the code. We ship a seeded template
 * (prisma/demo.db) and copy it into the only writable location, /tmp, on first
 * use — then point Prisma there. Locally, DATABASE_URL from .env is used as-is.
 */
function serverlessDatasourceUrl(): string | undefined {
  if (!process.env.VERCEL) return undefined;
  const tmp = "/tmp/bridge.db";
  if (!fs.existsSync(tmp)) {
    const template = path.join(process.cwd(), "prisma", "demo.db");
    if (fs.existsSync(template)) fs.copyFileSync(template, tmp);
  }
  return `file:${tmp}`;
}

function makeClient() {
  const url = serverlessDatasourceUrl();
  return url ? new PrismaClient({ datasources: { db: { url } } }) : new PrismaClient();
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
