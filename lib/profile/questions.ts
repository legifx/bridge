/**
 * Onboarding: 5 tap questions with concrete options (§5). Each option maps to an
 * interest DOMAIN plus a few concrete vocabulary anchors — real nouns from that
 * world the bridge engine is allowed to use. Onboarding must take < 45s, so the
 * options are specific and tappable, never abstract.
 */
export type Option = {
  id: string;
  label: string;
  domain: string;
  anchors: string[];
};

export type Question = {
  id: string;
  prompt: string;
  options: Option[];
};

export const QUESTIONS: Question[] = [
  {
    id: "video",
    prompt: "What would you happily watch a 3-hour video about?",
    options: [
      { id: "v-esports", label: "A pro esports tournament", domain: "competitive gaming", anchors: ["ranked ladder", "cooldown", "team composition", "map control", "patch notes"] },
      { id: "v-football", label: "Football tactics breakdowns", domain: "football tactics", anchors: ["formation", "pressing", "transfer window", "possession", "counter-attack"] },
      { id: "v-horses", label: "Horse riding and stable care", domain: "horse riding", anchors: ["gait", "grooming", "tack", "dressage", "feed schedule"] },
      { id: "v-cars", label: "Rebuilding a car engine", domain: "car mechanics", anchors: ["torque", "timing belt", "combustion", "gear ratio", "coolant"] },
    ],
  },
  {
    id: "explain",
    prompt: "What do you explain to friends without being asked?",
    options: [
      { id: "e-music", label: "How a song was produced", domain: "music production", anchors: ["bassline", "sidechain", "tempo", "mixdown", "sample"] },
      { id: "e-cooking", label: "Why a recipe works", domain: "cooking", anchors: ["reduction", "sear", "emulsion", "proof", "seasoning"] },
      { id: "e-basketball", label: "A basketball play", domain: "basketball", anchors: ["pick and roll", "zone defense", "assist", "rebound", "fast break"] },
      { id: "e-fashion", label: "How an outfit is put together", domain: "fashion", anchors: ["silhouette", "layering", "palette", "fabric", "proportion"] },
    ],
  },
  {
    id: "fix",
    prompt: "Something breaks. What are you itching to fix?",
    options: [
      { id: "f-bike", label: "A bike with a slipping chain", domain: "cycling mechanics", anchors: ["derailleur", "cassette", "tension", "brake pad", "cadence"] },
      { id: "f-pc", label: "A PC that won't boot", domain: "pc building", anchors: ["motherboard", "thermal paste", "bottleneck", "BIOS", "airflow"] },
      { id: "f-garden", label: "A garden bed that won't grow", domain: "gardening", anchors: ["soil pH", "compost", "root rot", "pruning", "germination"] },
      { id: "f-guitar", label: "A guitar that won't stay in tune", domain: "guitar", anchors: ["intonation", "truss rod", "string gauge", "fretboard", "pickup"] },
    ],
  },
  {
    id: "lose-time",
    prompt: "Where do you lose track of time?",
    options: [
      { id: "l-strategy", label: "Deep strategy games", domain: "strategy games", anchors: ["tech tree", "economy", "unit counter", "map awareness", "tempo"] },
      { id: "l-skate", label: "At the skate park", domain: "skateboarding", anchors: ["ollie", "grind", "deck", "balance", "line"] },
      { id: "l-baking", label: "Baking bread", domain: "baking", anchors: ["gluten", "hydration", "fermentation", "crumb", "oven spring"] },
      { id: "l-astronomy", label: "Looking at the night sky", domain: "astronomy", anchors: ["orbit", "constellation", "light-year", "phase", "gravity well"] },
    ],
  },
  {
    id: "collect",
    prompt: "What do you keep learning more about?",
    options: [
      { id: "c-cards", label: "Trading card game metas", domain: "trading card games", anchors: ["mana curve", "deck archetype", "synergy", "tempo", "sideboard"] },
      { id: "c-coffee", label: "Coffee brewing", domain: "coffee brewing", anchors: ["extraction", "grind size", "bloom", "ratio", "roast"] },
      { id: "c-running", label: "Running and training plans", domain: "distance running", anchors: ["pace", "VO2 max", "taper", "cadence", "intervals"] },
      { id: "c-photography", label: "Photography", domain: "photography", anchors: ["aperture", "exposure", "focal length", "composition", "white balance"] },
    ],
  },
];

/** Flat lookup of every option by id. */
export const OPTION_BY_ID: Record<string, Option> = Object.fromEntries(
  QUESTIONS.flatMap((q) => q.options).map((o) => [o.id, o]),
);
