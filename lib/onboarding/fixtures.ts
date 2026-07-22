import type { MagnetWord } from "./types";

/**
 * Curated fallbacks so the interview NEVER dies with the LLM: hand-written,
 * fact-checked word magnets for common domains (matched by keyword) and
 * generic drill-question templates. Decoys are deliberately plausible-sounding
 * to outsiders and obviously fake to anyone actually in the domain.
 */

type Fixture = { keywords: string[]; words: MagnetWord[] };

const m = (tier: MagnetWord["tier"], ...terms: string[]): MagnetWord[] =>
  terms.map((term) => ({ term, tier }));

const FIXTURES: Fixture[] = [
  {
    keywords: ["gaming", "esports", "shooter", "video game", "league", "valorant", "fortnite"],
    words: [
      ...m("novice", "respawn", "loadout", "lobby", "skin"),
      ...m("hobbyist", "cooldown", "patch notes", "map control", "team composition"),
      ...m("insider", "frame data", "input buffering", "peeker's advantage", "macro play"),
      ...m("decoy", "render cooldown", "aim latency tax", "spawn elasticity"),
    ],
  },
  {
    keywords: ["pc", "computer", "hardware", "tech", "building pcs"],
    words: [
      ...m("novice", "USB port", "monitor", "download", "keyboard"),
      ...m("hobbyist", "motherboard", "BIOS", "thermal paste", "airflow"),
      ...m("insider", "XMP profile", "undervolting", "PCIe lanes", "cable management"),
      ...m("decoy", "socket defragmentation", "DDR lubricant", "quantum heatsink"),
    ],
  },
  {
    keywords: ["football", "soccer", "fußball"],
    words: [
      ...m("novice", "penalty", "goalkeeper", "corner kick", "offside"),
      ...m("hobbyist", "pressing", "formation", "counter-attack", "possession"),
      ...m("insider", "half-spaces", "low block", "expected goals", "inverted full-back"),
      ...m("decoy", "reverse offside", "phantom pressing", "goal-side handicap"),
    ],
  },
  {
    keywords: ["music production", "producing", "beats", "dj", "producer"],
    words: [
      ...m("novice", "beat", "remix", "chorus", "playlist"),
      ...m("hobbyist", "bassline", "tempo", "sample", "mixdown"),
      ...m("insider", "sidechain compression", "LUFS", "wet/dry mix", "parallel compression"),
      ...m("decoy", "MIDI varnish", "chord defragmentation", "tempo greasing"),
    ],
  },
  {
    keywords: ["car", "cars", "engine", "mechanic", "auto"],
    words: [
      ...m("novice", "horsepower", "fuel tank", "dashboard", "oil change"),
      ...m("hobbyist", "torque", "timing belt", "coolant", "gear ratio"),
      ...m("insider", "rev matching", "compression ratio", "valve clearance", "limited-slip differential"),
      ...m("decoy", "piston polarity", "exhaust priming fluid", "brake torque battery"),
    ],
  },
  {
    keywords: ["cooking", "baking", "kitchen", "food", "recipes"],
    words: [
      ...m("novice", "recipe", "frying pan", "seasoning", "oven"),
      ...m("hobbyist", "sear", "reduction", "emulsion", "proofing"),
      ...m("insider", "maillard reaction", "mise en place", "deglazing", "tempering chocolate"),
      ...m("decoy", "umami crystallization", "gluten polishing", "steam marination"),
    ],
  },
  {
    keywords: ["horse", "riding", "equestrian", "pony"],
    words: [
      ...m("novice", "saddle", "stable", "pony", "riding lessons"),
      ...m("hobbyist", "gait", "grooming", "tack", "dressage"),
      ...m("insider", "half-halt", "collection", "lateral work", "bitless bridle"),
      ...m("decoy", "saddle calibration", "mane torque", "hoof pressure rating"),
    ],
  },
  {
    keywords: ["running", "fitness", "gym", "training", "workout", "sport"],
    words: [
      ...m("novice", "warm-up", "jogging", "stretching", "gym"),
      ...m("hobbyist", "pace", "intervals", "cadence", "taper"),
      ...m("insider", "VO2 max", "lactate threshold", "negative splits", "zone 2"),
      ...m("decoy", "oxygen loading belt", "stride defragmentation", "muscle latency index"),
    ],
  },
];

/** Find a curated magnet for a domain name, or null. */
export function findFixtureMagnet(domainName: string): MagnetWord[] | null {
  const n = domainName.trim().toLowerCase();
  for (const f of FIXTURES) {
    if (f.keywords.some((k) => n.includes(k) || k.includes(n))) return f.words;
  }
  return null;
}

/** Generic drill templates used when the plan call fails or returns nothing. */
export function fallbackRoleQuestion(name: string) {
  return {
    prompt: `${name} — which is closer to you?`,
    left: "I watch / follow it",
    right: "I do it myself",
  };
}

export function fallbackSlider(name: string) {
  return {
    prompt: `When you spend time on ${name}, it's mostly…`,
    leftLabel: "relaxing / casual",
    rightLabel: "learning / improving",
  };
}
