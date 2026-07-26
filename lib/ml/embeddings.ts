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

/**
 * Multilingual on purpose. The previous model (all-MiniLM-L6-v2) was trained on
 * English, and Bridge ships in ten languages — every non-English interest was
 * being matched through an English vector space. Measured on German pairs, the
 * old model separated related from unrelated text by 0.065-0.236 cosine; this
 * one by 0.529-0.752. At 0.065 the interest matcher was not really deciding
 * anything: "Basketball im Verein" scored 0.499 against "Sport im Team" and
 * 0.434 against "Kuchen backen".
 *
 * Same 384 dimensions, so nothing in the schema changes — but the vector SPACE
 * is different, so stored vectors from the old model are meaningless here.
 * Switching requires `node scripts/reembed.mjs`, which is why the model name is
 * recorded per row (see EMBEDDING_MODEL) rather than assumed.
 *
 * Cost of the change: ~134 MB of model instead of ~27 MB, which is paid on a
 * cold serverless instance. Overridable for hosts where that trade is wrong.
 */
const MODEL = process.env.EMBEDDING_MODEL || "Xenova/paraphrase-multilingual-MiniLM-L12-v2";

/** The model that produced the vectors currently in the database. */
export const EMBEDDING_MODEL = MODEL;

// Escape hatch for constrained hosts; on Vercel the model runs with its cache
// pointed at /tmp (the only writable path), see getExtractor below.
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
    extractorPromise = import("@xenova/transformers").then((m) => {
      // Where the ~134 MB model is cached. On Vercel /tmp is the only writable
      // path; elsewhere it is worth pointing somewhere deliberate, because the
      // default lands in the project directory — which on this server is a
      // 5400rpm disk whose IOPS budget is the machine's real bottleneck.
      const cacheDir = process.env.EMBEDDING_CACHE_DIR || (process.env.VERCEL ? "/tmp/xenova-cache" : undefined);
      if (cacheDir) m.env.cacheDir = cacheDir;
      return m.pipeline("feature-extraction", MODEL);
    });
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
