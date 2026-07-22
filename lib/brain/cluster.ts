/**
 * Second-brain clustering — pure, unit-tested code (tests/braincluster.test.ts).
 *
 * Greedy weighted clustering over unit vectors: items are visited heaviest
 * first; an item joins the first cluster whose centroid is within `threshold`
 * cosine similarity, otherwise it founds a new cluster. Centroids are
 * weight-weighted means, re-normalized after every merge. The heaviest member
 * names the cluster. Confidence is the weighted mean cosine of members to the
 * final centroid — an honest "how coherent is this interest" number.
 */
import { cosine } from "@/lib/ml/vector";

export type BrainVec = {
  id: string;
  kind: string; // interest | anchor | signal
  label: string;
  weight: number;
  vec: Float32Array;
};

export type BrainCluster = {
  label: string;
  totalWeight: number;
  confidence: number; // 0..1
  centroid: Float32Array;
  items: BrainVec[];
};

function normalize(v: Float32Array): Float32Array {
  let n = 0;
  for (let i = 0; i < v.length; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / n;
  return out;
}

export function clusterItems(items: BrainVec[], threshold = 0.55): BrainCluster[] {
  const sorted = [...items].sort((a, b) => b.weight - a.weight);
  const clusters: { centroid: Float32Array; weight: number; items: BrainVec[] }[] = [];

  for (const item of sorted) {
    let joined = false;
    for (const c of clusters) {
      if (cosine(c.centroid, item.vec) >= threshold) {
        // weight-weighted centroid update, then re-normalize
        const merged = new Float32Array(c.centroid.length);
        for (let i = 0; i < merged.length; i++) {
          merged[i] = c.centroid[i] * c.weight + item.vec[i] * item.weight;
        }
        c.centroid = normalize(merged);
        c.weight += item.weight;
        c.items.push(item);
        joined = true;
        break;
      }
    }
    if (!joined) {
      clusters.push({ centroid: normalize(item.vec), weight: item.weight, items: [item] });
    }
  }

  return clusters
    .map((c) => {
      const totalWeight = c.items.reduce((s, i) => s + i.weight, 0);
      const confidence =
        c.items.reduce((s, i) => s + cosine(c.centroid, i.vec) * i.weight, 0) /
        (totalWeight || 1);
      // heaviest member names the cluster
      const head = c.items.reduce((a, b) => (b.weight > a.weight ? b : a), c.items[0]);
      return {
        label: head.label,
        totalWeight,
        confidence: Math.max(0, Math.min(1, confidence)),
        centroid: c.centroid,
        items: c.items,
      };
    })
    .sort((a, b) => b.totalWeight - a.totalWeight);
}
