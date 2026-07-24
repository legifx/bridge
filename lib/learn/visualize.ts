import { z } from "zod";
import { llmJson } from "@/lib/llm/client";
import {
  VISUALIZE_SYSTEM,
  visualizeUser,
  VISUALIZE_VERIFY_SYSTEM,
  visualizeVerifyUser,
} from "@/lib/prompts/visualize";
import { VisualizationsSchema, type Widget } from "./widgets";
import { evalExpression } from "./evalFormula";

/** Compact text rendering of a widget for the fact-checker. */
function renderWidget(w: Widget): string {
  switch (w.type) {
    case "scale":
      return `scale "${w.title}" ${w.min}..${w.max}${w.unit ?? ""}; markers: ${w.markers
        .map((m) => `${m.value}=${m.label}`)
        .join(", ")}${w.zones?.length ? `; zones: ${w.zones.map((z) => `${z.from}-${z.to} ${z.label}`).join(", ")}` : ""}`;
    case "steps":
      return `steps "${w.title}": ${w.steps.map((s, i) => `${i + 1}. ${s.label}: ${s.detail}`).join(" | ")}`;
    case "barChart":
      return `bar chart "${w.title}"${w.unit ? ` (${w.unit})` : ""}: ${w.bars.map((b) => `${b.label}=${b.value}`).join(", ")}`;
    case "diagram":
      return `diagram "${w.title}", center ${w.center}; parts: ${w.parts.map((p) => `${p.label}: ${p.note}`).join(", ")}`;
    case "formula":
      return `formula "${w.title}": ${w.result.label} = ${w.expression}${w.result.unit ? ` [${w.result.unit}]` : ""}; variables: ${w.variables
        .map((v) => `${v.symbol}=${v.label}[${v.min}..${v.max}]${v.unit ?? ""}`)
        .join(", ")}`;
  }
}

const VerifySchema = z.object({
  results: z.array(z.object({ factual: z.boolean(), reason: z.string() })),
});

/** Independent fact-check: drop any widget flagged as factually wrong. */
async function verifyVisualizations(
  concept: { label: string; definition: string },
  widgets: Widget[],
): Promise<Widget[]> {
  if (widgets.length === 0) return widgets;
  try {
    const { results } = await llmJson({
      system: VISUALIZE_VERIFY_SYSTEM,
      user: visualizeVerifyUser(concept, widgets.map(renderWidget)),
      schema: VerifySchema,
      temperature: 0,
    });
    // Keep a widget unless the verifier explicitly flags it false. A missing
    // verdict (short/reordered list) defaults to keep — the generator already
    // works from the verified definition, so we don't want to over-drop.
    return widgets.filter((_, i) => results[i]?.factual !== false);
  } catch {
    return widgets; // verification is best-effort; never block on it
  }
}

/**
 * Generate interactive widgets for a concept. Degrades gracefully: any failure
 * (LLM error, invalid JSON, unusable formula) returns an empty list, so the
 * learn flow never breaks over the visualization step.
 */
export async function generateVisualizations(params: {
  label: string;
  definition: string;
  plainRestatement: string;
  domain: string;
  anchor: string;
  language?: string;
}): Promise<Widget[]> {
  try {
    const { visualizations } = await llmJson({
      system: VISUALIZE_SYSTEM,
      language: params.language,
      user: visualizeUser(params),
      schema: VisualizationsSchema,
      temperature: 0.5,
    });
    // Drop any formula widget whose expression can't be evaluated safely at its
    // defaults — a broken interactive is worse than none.
    const usable = visualizations.filter((w) => {
      if (w.type !== "formula") return true;
      const vars = Object.fromEntries(w.variables.map((v) => [v.symbol, v.default]));
      return evalExpression(w.expression, vars) !== null;
    });
    // Independent fact-check: drop widgets whose numbers/relationships are wrong.
    return verifyVisualizations({ label: params.label, definition: params.definition }, usable);
  } catch {
    return [];
  }
}
