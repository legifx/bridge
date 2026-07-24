/**
 * The seeded "Explore" profiles. They are the only accounts that stay open
 * without a password, and the only ones whose learning content is shown on the
 * public (unauthenticated) showcase pages.
 */
export const DEMO_HANDLES = ["mara", "theo"] as const;

export const DEMO_HANDLE_SET: ReadonlySet<string> = new Set<string>(DEMO_HANDLES);

export function isDemoHandle(handle: string): boolean {
  return DEMO_HANDLE_SET.has(handle);
}
