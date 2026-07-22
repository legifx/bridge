import type { BridgeBody } from "./types";
import type { Match } from "@/lib/profile/types";

/** kebab slug for demo keys. */
export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/**
 * Deterministic, on-topic bridge used by the seed for any concept that has no
 * hand-written fixture. It never invents facts — it restates the real
 * definition and maps it onto the matched anchor — so the demo stays truthful
 * without spending API budget. Hand-written fixtures override it where they exist.
 */
export function templateBody(params: {
  label: string;
  definition: string;
  match: Match;
  anchors: string[];
}): BridgeBody {
  const { label, definition, match } = params;
  const other = params.anchors.filter((a) => a !== match.anchor).slice(0, 1)[0] ?? match.domainName;
  return {
    opening: `Think about ${match.domainName}. ${label} works a little like ${match.anchor}.`,
    correspondences: [
      {
        subject: label,
        yourWorld: match.anchor,
        explanation: `Just as ${match.anchor} plays its role in ${match.domainName}, ${label.toLowerCase()} plays the matching role here: ${definition}`,
      },
      {
        subject: `how ${label.toLowerCase()} behaves`,
        yourWorld: other,
        explanation: `The way ${other} fits into ${match.domainName} mirrors how this idea connects to what comes before and after it.`,
      },
    ],
    breaksDown: `The analogy is only a handle. ${match.anchor} is from ${match.domainName}; ${label.toLowerCase()} is a ${"subject"} idea and follows the subject's own rules, not ${match.domainName}'s.`,
    plainRestatement: definition,
  };
}
