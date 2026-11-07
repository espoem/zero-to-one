/**
 * Teaching models for Elasticsearch vector search:
 *  - Elasticsearch's similarity-to-score transformations for dense_vector
 *  - exact (brute-force) kNN as ground truth and recall@k
 *  - scalar quantisation (int8 / int4) and 1-bit binary quantisation with oversampled
 *    float rescoring (the idea behind BBQ + rescore_vector)
 *  - pre-filtered vs post-filtered kNN
 *  - Reciprocal Rank Fusion
 * HNSW itself is owned by the data-systems track (examples/12-vector-ann-hnsw.test.ts there).
 */

export type Vec = Float32Array;

/** Deterministic PRNG (mulberry32) so tests are reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Gaussian via Box-Muller. */
export function gaussian(r: () => number): number {
  const u = Math.max(r(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

export function normalize(v: Vec): Vec {
  const n = Math.hypot(...v);
  return Float32Array.from(v, (x) => x / n);
}

/** Clustered unit vectors: a realistic shape for embeddings (not uniform noise). */
export function dataset(n: number, dims: number, seed: number, clusters = 8): Vec[] {
  const r = rng(seed);
  const centers = Array.from({ length: clusters }, () =>
    normalize(Float32Array.from({ length: dims }, () => gaussian(r))),
  );
  return Array.from({ length: n }, () => {
    const c = centers[Math.floor(r() * clusters)]!;
    return normalize(Float32Array.from(c, (x) => x + ((0.35 * gaussian(r)) / Math.sqrt(dims)) * 4));
  });
}

export const dot = (a: Vec, b: Vec) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
};
export const l2sq = (a: Vec, b: Vec) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i]! - b[i]!) ** 2;
  return s;
};
export const cosine = (a: Vec, b: Vec) => dot(a, b) / (Math.hypot(...a) * Math.hypot(...b));

export type Similarity = 'cosine' | 'dot_product' | 'l2_norm' | 'max_inner_product';

/** The `_score` Elasticsearch reports for a kNN hit (scores must be non-negative in Lucene). */
export function esScore(sim: Similarity, q: Vec, d: Vec): number {
  switch (sim) {
    case 'cosine':
      return (1 + cosine(q, d)) / 2;
    case 'dot_product':
      return (1 + dot(q, d)) / 2; // vectors must be unit length
    case 'l2_norm':
      return 1 / (1 + l2sq(q, d));
    case 'max_inner_product': {
      const x = dot(q, d);
      return x < 0 ? 1 / (1 - x) : x + 1;
    }
  }
}

export function exactKnn(
  q: Vec,
  docs: Vec[],
  k: number,
  sim: Similarity = 'cosine',
  filter?: (i: number) => boolean,
): number[] {
  return docs
    .map((d, i) => ({ i, s: esScore(sim, q, d) }))
    .filter(({ i }) => !filter || filter(i))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, k)
    .map(({ i }) => i);
}

export function recallAtK(approx: number[], truth: number[]): number {
  const t = new Set(truth);
  return approx.filter((i) => t.has(i)).length / truth.length;
}

// ---------------------------------------------------------------------------
// Quantisation
// ---------------------------------------------------------------------------

export interface ScalarQuantizer {
  bits: 4 | 7 | 8;
  lo: number;
  hi: number;
}

/**
 * Lucene's scalar quantiser picks [lo, hi] from quantiles of the segment's values
 * (confidence_interval) so outliers do not waste the integer range.
 */
export function fitScalar(docs: Vec[], bits: 4 | 7 | 8, confidence = 0.99): ScalarQuantizer {
  const all = docs.flatMap((d) => [...d]).sort((a, b) => a - b);
  const tail = (1 - confidence) / 2;
  return {
    bits,
    lo: all[Math.floor(tail * (all.length - 1))]!,
    hi: all[Math.ceil((1 - tail) * (all.length - 1))]!,
  };
}

export function quantize(q: ScalarQuantizer, v: Vec): Uint8Array {
  const levels = 2 ** q.bits - 1;
  return Uint8Array.from(v, (x) =>
    Math.round(((Math.min(Math.max(x, q.lo), q.hi) - q.lo) / (q.hi - q.lo)) * levels),
  );
}

export function dequantize(q: ScalarQuantizer, c: Uint8Array): Vec {
  const levels = 2 ** q.bits - 1;
  return Float32Array.from(c, (x) => q.lo + (x / levels) * (q.hi - q.lo));
}

/** Bytes per vector for each storage form (vector data only, excluding the HNSW graph). */
export function bytesPerVector(dims: number, form: 'float' | 'int8' | 'int4' | 'bbq'): number {
  switch (form) {
    case 'float':
      return dims * 4;
    case 'int8':
      return dims + 4; // + a float correction term
    case 'int4':
      return Math.ceil(dims / 2) + 4;
    case 'bbq':
      return Math.ceil(dims / 8) + 14; // 1 bit per dim + a few float corrective factors (approximate)
  }
}

/** 1-bit quantisation around a centroid (the core of BBQ, without its corrective factors). */
export function binaryCodes(docs: Vec[]): { centroid: Vec; codes: Uint8Array[] } {
  const dims = docs[0]!.length;
  const centroid = new Float32Array(dims);
  for (const d of docs) for (let i = 0; i < dims; i++) centroid[i]! += d[i]! / docs.length;
  const code = (v: Vec) => {
    const out = new Uint8Array(Math.ceil(dims / 8));
    for (let i = 0; i < dims; i++) if (v[i]! - centroid[i]! > 0) out[i >> 3]! |= 1 << (i & 7);
    return out;
  };
  return { centroid, codes: docs.map(code) };
}

function popcount8(x: number): number {
  let c = 0;
  while (x) {
    x &= x - 1;
    c++;
  }
  return c;
}

export function hamming(a: Uint8Array, b: Uint8Array): number {
  let h = 0;
  for (let i = 0; i < a.length; i++) h += popcount8(a[i]! ^ b[i]!);
  return h;
}

/**
 * Approximate kNN with binary codes, optionally oversampling and rescoring the best
 * `k * oversample` candidates with full-precision vectors (rescore_vector.oversample).
 */
export function binaryKnn(q: Vec, docs: Vec[], k: number, oversample = 1): number[] {
  const { centroid, codes } = binaryCodes(docs);
  const dims = q.length;
  const qc = new Uint8Array(Math.ceil(dims / 8));
  for (let i = 0; i < dims; i++) if (q[i]! - centroid[i]! > 0) qc[i >> 3]! |= 1 << (i & 7);
  const cands = codes
    .map((c, i) => ({ i, h: hamming(qc, c) }))
    .sort((a, b) => a.h - b.h || a.i - b.i)
    .slice(0, Math.ceil(k * oversample));
  if (oversample <= 1) return cands.slice(0, k).map((c) => c.i);
  return cands
    .map(({ i }) => ({ i, s: cosine(q, docs[i]!) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, k)
    .map((c) => c.i);
}

// ---------------------------------------------------------------------------
// Filtering and fusion
// ---------------------------------------------------------------------------

/** Post-filtering: take the global top num_candidates, then apply the filter. */
export function postFilteredKnn(
  q: Vec,
  docs: Vec[],
  k: number,
  numCandidates: number,
  filter: (i: number) => boolean,
): number[] {
  return exactKnn(q, docs, numCandidates).filter(filter).slice(0, k);
}

/** Reciprocal Rank Fusion: score(d) = sum over lists of 1 / (rank_constant + rank(d)), ranks from 1. */
export function rrf(
  lists: string[][],
  rankConstant = 60,
  rankWindowSize = Infinity,
): { id: string; score: number }[] {
  const scores = new Map<string, number>();
  for (const list of lists) {
    list
      .slice(0, rankWindowSize)
      .forEach((id, idx) => scores.set(id, (scores.get(id) ?? 0) + 1 / (rankConstant + idx + 1)));
  }
  return [...scores]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
}

/** Linear combination after min-max normalisation (the `linear` retriever with `minmax`). */
export function linearFusion(
  lists: { id: string; score: number }[][],
  weights: number[],
): { id: string; score: number }[] {
  const out = new Map<string, number>();
  lists.forEach((list, li) => {
    const scores = list.map((h) => h.score);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    for (const h of list) {
      const norm = max === min ? 1 : (h.score - min) / (max - min);
      out.set(h.id, (out.get(h.id) ?? 0) + weights[li]! * norm);
    }
  });
  return [...out]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
}
