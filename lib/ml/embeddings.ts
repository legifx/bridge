/**
 * Local sentence embeddings via @xenova/transformers (all-MiniLM-L6-v2).
 * Runs in the Node runtime — no API key, no network, no per-token cost.
 * The model is downloaded once and cached under ./.cache on first use.
 *
 * The heavy dependency is loaded via dynamic import so it never bloats bundles
 * that don't embed. On serverless hosts (read-only FS, no ONNX), set
 * EMBEDDINGS_DISABLED=1 — the seeded read-only demo uses stored vectors instead.
 */
export { cosine, vecToBytes, bytesToVec } from "./vector";

export const EMBED_DIM = 384;
const MODEL = "Xenova/all-MiniLM-L6-v2";

export const EMBEDDINGS_ENABLED = process.env.EMBEDDINGS_DISABLED !== "1";

export class EmbeddingsDisabledError extends Error {
  constructor() {
    super("Embeddings are disabled on this host (EMBEDDINGS_DISABLED=1).");
    this.name = "EmbeddingsDisabledError";
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractorPromise: Promise<any> | null = null;

async function getExtractor() {
  if (!EMBEDDINGS_ENABLED) throw new EmbeddingsDisabledError();
  if (!extractorPromise) {
    extractorPromise = import("@xenova/transformers").then(({ pipeline }) =>
      pipeline("feature-extraction", MODEL),
    );
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
