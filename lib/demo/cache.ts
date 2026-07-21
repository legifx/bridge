/**
 * DEMO_MODE response cache (§8).
 *
 * Maps a stable demoKey to a canned AI response so the entire flow runs with no
 * API key and no token burn. Keys are namespaced by stage, e.g.:
 *   "extract:chem"                          -> Stage 1 concept graph
 *   "bridge:<conceptId>:<domainSlug>"       -> Stage 3 generated bridge
 *   "verify:<conceptId>:<domainSlug>"       -> Stage 3 verifier verdict
 *
 * Bridge/verify fixtures are added in Day 3-4. Unknown keys throw loudly so a
 * missing fixture is caught during development, never silently empty in a demo.
 */
import { CHEM_EXTRACTION } from "./chem";

const registry: Record<string, unknown> = {
  "extract:chem": CHEM_EXTRACTION,
  // Any text pasted while DEMO_MODE=true resolves to the chemistry chapter,
  // so a judge without a key still sees a real concept graph.
  "extract:default": CHEM_EXTRACTION,
};

export function registerDemoResponse(key: string, value: unknown): void {
  registry[key] = value;
}

export function getDemoResponse(key: string): unknown {
  if (key in registry) return registry[key];
  // Fall back to the default per-stage fixture when a specific one is missing.
  const stage = key.split(":")[0];
  const fallback = `${stage}:default`;
  if (fallback in registry) return registry[fallback];
  throw new Error(
    `DEMO_MODE: no cached response for "${key}". Add a fixture in lib/demo or set DEMO_MODE=false with a real OPENROUTER_API_KEY.`,
  );
}
