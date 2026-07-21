import { z } from "zod";

/** LLM enrichment of the free-text interest answer. */
export const FreeTextDomainSchema = z.object({
  name: z.string(),
  vocabularyAnchors: z.array(z.string()),
});
export type FreeTextDomain = z.infer<typeof FreeTextDomainSchema>;

/** A domain as stored + surfaced (mirrors InterestDomain row). */
export type DomainVM = {
  id: string;
  name: string;
  anchors: string[];
  alpha: number;
  beta: number;
  confidence: number;
  successRate: number;
};

/** The concept<->domain match shown in the UI, e.g. "Ionic bond <-> handshake, 0.71". */
export type Match = {
  domainId: string;
  domainName: string;
  anchor: string; // the best-matching anchor
  similarity: number; // cosine, 0..1
  banditScore: number; // Thompson sample used for the choice
};
