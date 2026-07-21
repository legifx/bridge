/**
 * Privacy guard (§7). Onboarding's free-text field must only capture interests —
 * never family, emotions, health, or anything sensitive. We refuse such input
 * before it is ever embedded or stored.
 *
 * This is a deliberately conservative keyword screen, not sentiment analysis:
 * cheap, transparent, and it fails safe.
 */
const BLOCKED_PATTERNS: Array<{ re: RegExp; topic: string }> = [
  { re: /\b(depress|anxiet|anxious|suicid|self[-\s]?harm|therapy|mental health|panic)\b/i, topic: "health" },
  { re: /\b(diagnos|disease|illness|medication|adhd|autis|disorder|disabilit)\b/i, topic: "health" },
  { re: /\b(mom|mum|dad|mother|father|parent|divorce|family|sibling|brother|sister)\b/i, topic: "family" },
  { re: /\b(depressed|lonely|sad|angry|afraid|scared|grief|trauma)\b/i, topic: "emotions" },
  { re: /\b(religion|religious|church|mosque|temple|god|faith|pray)\b/i, topic: "beliefs" },
  { re: /\b(gender|sexual|sexuality|orientation|race|ethnic|immigrat)\b/i, topic: "identity" },
];

export type GuardResult =
  | { ok: true; text: string }
  | { ok: false; topic: string; message: string };

export function checkInterestText(raw: string): GuardResult {
  const text = raw.trim();
  if (!text) return { ok: true, text: "" };
  for (const { re, topic } of BLOCKED_PATTERNS) {
    if (re.test(text)) {
      return {
        ok: false,
        topic,
        message:
          "Bridge only needs your interests — tell us about a hobby or something you're into, not personal details.",
      };
    }
  }
  return { ok: true, text };
}
