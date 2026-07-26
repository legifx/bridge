/**
 * `Concept.misconceptions` is stored as a JSON string[] (SQLite has no array
 * type). Every read goes through here so a malformed or legacy value degrades to
 * "no known traps" instead of throwing on a learner-facing request — rows created
 * before extract@6 simply have null.
 */
export function parseMisconceptions(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((m): m is string => typeof m === "string" && m.trim().length > 0).slice(0, 3);
  } catch {
    return [];
  }
}
