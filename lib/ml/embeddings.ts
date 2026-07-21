/**
 * Local sentence embeddings via @xenova/transformers (all-MiniLM-L6-v2).
 * Runs in the Node runtime — no API key, no network, no per-token cost.
 * The model is downloaded once and cached under ./.cache on first use.
 */
import { pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";

export { cosine, vecToBytes, bytesToVec } from "./vector";

export const EMBED_DIM = 384;
const MODEL = "Xenova/all-MiniLM-L6-v2";

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = pipeline(
      "feature-extraction",
      MODEL,
    ) as Promise<FeatureExtractionPipeline>;
  }
  return extractorPromise;
}

/** Embed one string into a normalized (unit-length) Float32 vector. */
export async function embed(text: string): Promise<Float32Array> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Float32Array.from(output.data as Float32Array);
}

/** Embed many strings, preserving order. */
export async function embedMany(texts: string[]): Promise<Float32Array[]> {
  const out: Float32Array[] = [];
  for (const t of texts) out.push(await embed(t));
  return out;
}
