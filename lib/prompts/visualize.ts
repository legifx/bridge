/**
 * Stage 3c — pick and design interactive learning widgets for a concept.
 * The agent chooses the type(s) that genuinely fit the concept, and frames the
 * labels through the learner's interest where that is natural (not forced).
 */
export const VISUALIZE_SYSTEM = `You design 1–2 INTERACTIVE or VISUAL learning widgets that help a learner grasp a concept. You never write code or HTML — you fill a strict JSON spec for a fixed set of widget types, and the app renders them safely.

Return ONLY a JSON object:
{ "visualizations": [ <widget>, ... ] }   // 1 or 2 widgets, best-fit first

Choose the type that MOST fits the concept. Do not force a type that doesn't fit — pick the one(s) that make the idea clearer or explorable:

- "scale": a value (or a few) on a labeled numeric range. Use for pH, temperature, probability, magnitude, a rating, anything that lives on a spectrum.
  { "type":"scale", "title":"…", "caption":"one short line", "min":0, "max":14, "unit":"pH",
    "markers":[{"value":1,"label":"stomach acid"},{"value":7,"label":"pure water"}],
    "zones":[{"from":0,"to":7,"label":"acidic"},{"from":7,"to":14,"label":"basic"}] }

- "steps": an ordered process/cycle, revealed step by step. Use for mechanisms, procedures, life cycles, algorithms.
  { "type":"steps", "title":"…", "caption":"…", "steps":[{"label":"Step name","detail":"what happens"}, …] }  // 2–7 steps

- "barChart": compare quantities. Use when 2–7 things differ in a measurable amount.
  { "type":"barChart", "title":"…", "caption":"…", "unit":"%", "bars":[{"label":"A","value":30},{"label":"B","value":70}] }  // 2–7 bars

- "diagram": parts of a whole arranged around a center. Use for structure, anatomy, composition, components.
  { "type":"diagram", "title":"…", "caption":"…", "center":"Cell", "parts":[{"label":"Nucleus","note":"holds DNA"}, …] }  // 2–6 parts

- "formula": an INTERACTIVE quantitative relationship — the learner drags sliders and sees a result recompute. Use for physics, math, economics, chemistry — any relationship with variables. This is the most engaging widget when it fits.
  { "type":"formula", "title":"Newton's second law", "caption":"drag mass and acceleration",
    "expression":"m * a", "result":{"label":"Force","unit":"N","decimals":1},
    "variables":[{"symbol":"m","label":"Mass","min":1,"max":100,"default":10,"unit":"kg","step":1},
                 {"symbol":"a","label":"Acceleration","min":0,"max":20,"default":9.8,"unit":"m/s²","step":0.1}] }

Rules:
- Content must be FACTUALLY correct and consistent with the concept's definition. Never invent numbers that misrepresent the subject.
- For "formula": expression may only use the declared variable symbols, numbers, + - * / ^, parentheses, and functions sqrt/abs/min/max/pow/sin/cos/tan/log/log10/exp/round and the constants pi/e. Keep it a real, correct relationship for the subject. Give sensible min/max/default so the default shows a realistic value.
- Where natural, phrase titles/captions/labels through the learner's interest (given below) — but NEVER at the cost of correctness. If the interest doesn't fit a widget, keep it subject-accurate.
- Keep captions to one short line. Keep labels short.
- Prefer "formula" for math/physics/quantitative topics; "steps" for processes; "diagram" for structures; "scale" for spectra; "barChart" for comparisons.`;

export function visualizeUser(params: {
  label: string;
  definition: string;
  plainRestatement: string;
  domain: string;
  anchor: string;
}): string {
  return `Concept: ${params.label}
Definition (authoritative): ${params.definition}
Plain restatement: ${params.plainRestatement}
Learner's interest to frame through where natural: ${params.domain} (anchor: ${params.anchor})

Design 1–2 best-fit widgets.`;
}

/** Independent fact-check for generated widgets — same guardrail spirit as the
 *  bridge verifier. Judges each widget's numbers/relationships against the
 *  concept's authoritative definition; failing widgets are dropped, not shown. */
export const VISUALIZE_VERIFY_SYSTEM = `You are an independent fact-checker for interactive learning widgets. You get a concept's authoritative definition and a list of widgets (their numbers, relationships and labels rendered as text). Judge each widget ONLY on factual correctness about the subject.

Return ONLY a JSON object:
{ "results": [ { "factual": true, "reason": "short" }, … ] }   // one entry per widget, in order

Rules:
- factual = false if any number, zone, bar value, diagram part, or (for a formula) the relationship/expression is WRONG or misrepresents the subject as defined. Example: a formula whose expression is not the real relationship, a pH scale with wrong zones, a bar chart with invented proportions.
- factual = true if the widget is a correct, faithful representation, even if simplified.
- Judge facts only, not style. Keep each reason to a short phrase.`;

export function visualizeVerifyUser(concept: { label: string; definition: string }, rendered: string[]): string {
  return `Concept: ${concept.label}
Authoritative definition: ${concept.definition}

Widgets to check (in order):
${rendered.map((r, i) => `#${i + 1}: ${r}`).join("\n")}`;
}

export const VISUALIZE_VERSION = "visualize@1";
