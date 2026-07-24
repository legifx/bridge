import { llmJson } from "@/lib/llm/client";
import { VISUALIZE_SYSTEM, visualizeUser } from "@/lib/prompts/visualize";
import { VisualizationsSchema, type Widget } from "./widgets";
import { evalExpression } from "./evalFormula";

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
    return visualizations.filter((w) => {
      if (w.type !== "formula") return true;
      const vars = Object.fromEntries(w.variables.map((v) => [v.symbol, v.default]));
      return evalExpression(w.expression, vars) !== null;
    });
  } catch {
    return [];
  }
}
