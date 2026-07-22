/**
 * Writing to the second brain. Every signal either strengthens an existing
 * near-duplicate item (cosine >= MERGE_THRESHOLD) or inserts a new one — so
 * repeated signals mature into strong interests instead of piling up rows.
 *
 * Callers may pass a precomputed `embedding` (e.g. averaged from stored
 * vectors) so this works even where the local model is unavailable
 * (serverless). Without an embedding and with embeddings disabled, the signal
 * is skipped rather than failing the caller's request.
 */
import { prisma } from "@/lib/db/prisma";
import { EMBEDDINGS_ENABLED, embed } from "@/lib/ml/embeddings";
import { cosine, vecToBytes, bytesToVec } from "@/lib/ml/vector";

export const MERGE_THRESHOLD = 0.92;

export type SignalInput = {
  learnerId: string;
  kind: "interest" | "anchor" | "signal";
  label: string;
  text: string;
  weight: number;
  embedding?: Float32Array;
  sourceRef?: string;
};

/** Weighted average of stored vectors — lets signals derive their embedding
 *  from vectors we already have, with no model call. */
export function averageVec(vecs: Float32Array[], weights?: number[]): Float32Array {
  const out = new Float32Array(vecs[0].length);
  vecs.forEach((v, i) => {
    const w = weights?.[i] ?? 1;
    for (let j = 0; j < out.length; j++) out[j] += v[j] * w;
  });
  let n = 0;
  for (let j = 0; j < out.length; j++) n += out[j] * out[j];
  n = Math.sqrt(n) || 1;
  for (let j = 0; j < out.length; j++) out[j] /= n;
  return out;
}

export async function recordSignal(input: SignalInput): Promise<{ merged: boolean } | null> {
  let vec = input.embedding;
  if (!vec) {
    if (!EMBEDDINGS_ENABLED) return null; // read-only host, skip silently
    vec = await embed(input.text);
  }

  // Look for a near-duplicate item to strengthen.
  const existing = await prisma.brainItem.findMany({ where: { learnerId: input.learnerId } });
  let best: { id: string; weight: number; sim: number } | null = null;
  for (const item of existing) {
    const sim = cosine(vec, bytesToVec(item.embedding));
    if (sim >= MERGE_THRESHOLD && (!best || sim > best.sim)) {
      best = { id: item.id, weight: item.weight, sim };
    }
  }

  if (best) {
    await prisma.brainItem.update({
      where: { id: best.id },
      data: { weight: best.weight + input.weight },
    });
    return { merged: true };
  }

  await prisma.brainItem.create({
    data: {
      learnerId: input.learnerId,
      kind: input.kind,
      label: input.label,
      text: input.text,
      embedding: vecToBytes(vec),
      weight: input.weight,
      sourceRef: input.sourceRef,
    },
  });
  return { merged: false };
}
