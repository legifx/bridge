import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Every API route that reads learner data must check the session.
 *
 * /api/teacher shipped without one: an unauthenticated GET returned the concept
 * labels of every learner in the database, on the live deployment, because the
 * page in front of it was parked and nobody re-checked the route behind it.
 * A route file is easy to add and easy to forget, so the check is mechanical.
 */
const PUBLIC_BY_DESIGN = new Set([
  "signin", // establishes the session
  "signout", // clearing a session needs no session
  "compare", // public showcase, hard-scoped to the seeded demo handles
]);

describe("API routes guard the session", () => {
  const apiDir = join(process.cwd(), "app", "api");
  const files: string[] = readdirSync(apiDir, { recursive: true, encoding: "utf8" })
    .filter((p) => p.endsWith("route.ts"))
    .map((p) => `app/api/${p.split(/[\\/]/).join("/")}`)
    .sort();

  it("finds the route files (guard against an empty scan)", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files)("%s calls getCurrentLearner", (rel) => {
    const name = rel.replace(/^app\/api\//, "").replace(/\/route\.ts$/, "");
    if (PUBLIC_BY_DESIGN.has(name)) return;
    const src = readFileSync(join(process.cwd(), rel), "utf8");
    expect(
      src.includes("getCurrentLearner"),
      `${rel} never calls getCurrentLearner. Either guard it, or add its name to ` +
        `PUBLIC_BY_DESIGN with the reason it is safe to serve unauthenticated.`,
    ).toBe(true);
  });
});
