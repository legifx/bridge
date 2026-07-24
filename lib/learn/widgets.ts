import { z } from "zod";

/**
 * Interactive learning widgets. The model never emits code or HTML — it fills a
 * typed, size-bounded spec for one of a fixed set of widget types, which the app
 * renders with dedicated, safe React components. This keeps generated content
 * expressive but injection-proof.
 *
 * The agent picks the type(s) that best FIT the concept, and frames the labels
 * through the learner's interest where it is natural.
 */
const num = z.number().finite();

export const WIDGET_TYPES = ["scale", "steps", "barChart", "diagram", "formula"] as const;

export const WidgetSchema = z.discriminatedUnion("type", [
  // A value (or values) on a labeled range — pH, temperature, probability, a rating.
  z.object({
    type: z.literal("scale"),
    title: z.string().min(1).max(90),
    caption: z.string().max(240).optional(),
    min: num,
    max: num,
    unit: z.string().max(16).optional(),
    markers: z.array(z.object({ value: num, label: z.string().min(1).max(70) })).min(1).max(6),
    zones: z
      .array(z.object({ from: num, to: num, label: z.string().max(50) }))
      .max(5)
      .optional(),
  }),
  // A sequence/process revealed step by step — any cycle or ordered mechanism.
  z.object({
    type: z.literal("steps"),
    title: z.string().min(1).max(90),
    caption: z.string().max(240).optional(),
    steps: z
      .array(z.object({ label: z.string().min(1).max(90), detail: z.string().min(1).max(280) }))
      .min(2)
      .max(7),
  }),
  // Comparison of quantities.
  z.object({
    type: z.literal("barChart"),
    title: z.string().min(1).max(90),
    caption: z.string().max(240).optional(),
    unit: z.string().max(16).optional(),
    bars: z.array(z.object({ label: z.string().min(1).max(48), value: num })).min(2).max(7),
  }),
  // Parts of a whole around a center — structure, anatomy, composition.
  z.object({
    type: z.literal("diagram"),
    title: z.string().min(1).max(90),
    caption: z.string().max(240).optional(),
    center: z.string().min(1).max(48),
    parts: z
      .array(z.object({ label: z.string().min(1).max(48), note: z.string().max(160) }))
      .min(2)
      .max(6),
  }),
  // An interactive quantitative relationship — sliders drive a computed result.
  z.object({
    type: z.literal("formula"),
    title: z.string().min(1).max(90),
    caption: z.string().max(240).optional(),
    // math expression over the variable symbols, e.g. "m * a" or "0.5*m*v^2"
    expression: z.string().min(1).max(200),
    result: z.object({
      label: z.string().min(1).max(48),
      unit: z.string().max(16).optional(),
      decimals: z.number().int().min(0).max(4).optional(),
    }),
    variables: z
      .array(
        z.object({
          symbol: z.string().min(1).max(8).regex(/^[A-Za-z][A-Za-z0-9_]*$/),
          label: z.string().min(1).max(48),
          min: num,
          max: num,
          default: num,
          unit: z.string().max(16).optional(),
          step: num.positive().optional(),
        }),
      )
      .min(1)
      .max(4),
  }),
]);
export type Widget = z.infer<typeof WidgetSchema>;
export type WidgetType = Widget["type"];

/** The generator returns up to two widgets for a concept. */
export const VisualizationsSchema = z.object({
  visualizations: z.array(WidgetSchema).max(2),
});
export type Visualizations = z.infer<typeof VisualizationsSchema>;
