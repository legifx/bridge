/**
 * Pure vector math — no model, no dependencies. Kept separate from
 * embeddings.ts so unit tests don't pull in @xenova/transformers.
 */

/** Cosine similarity between two equal-length vectors. */
export function cosine(a: Float32Array | number[], b: Float32Array | number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Serialize a vector to bytes for SQLite (Bytes column). Copies into a fresh ArrayBuffer. */
export function vecToBytes(v: Float32Array): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(v.byteLength);
  bytes.set(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
  return bytes;
}

/** Read a vector back from bytes. */
export function bytesToVec(b: Uint8Array): Float32Array {
  return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);
}
