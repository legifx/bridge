import { z } from "zod";

/** One concept as returned by the extraction model (BUILD_PROMPT §3, Stage 1). */
export const ExtractedConceptSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  definition: z.string().min(1),
  sourceQuote: z.string().min(1),
  difficulty: z.number().int().min(1).max(5),
  prerequisiteIds: z.array(z.string()),
});
export type ExtractedConcept = z.infer<typeof ExtractedConceptSchema>;

export const ExtractionResultSchema = z.object({
  title: z.string().min(1).optional(),
  subject: z.string().min(1).optional(),
  concepts: z.array(ExtractedConceptSchema),
});
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

/** A concept after dedupe + graph build, ready to store and render. */
export type GraphConcept = ExtractedConcept & {
  /** ids this concept was merged with during embedding dedupe. */
  mergedFrom: string[];
};

export type ConceptGraph = {
  title: string;
  /** broad parent topic ("Überordner") used to group capture folders on the map. */
  subject: string | null;
  concepts: GraphConcept[];
  edges: Array<{ from: string; to: string }>;
  /** topologically sorted concept ids — the learning order. */
  order: string[];
  hadCycle: boolean;
};
