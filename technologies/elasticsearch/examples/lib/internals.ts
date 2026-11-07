/**
 * Lucene internals and relevance evaluation, modelled:
 *  - postings compression: delta encoding + fixed-width bit packing in blocks of 128
 *    (frame of reference), with a variable-length tail
 *  - conjunction (AND) of postings with skipping vs a naive merge
 *  - the _rank_eval metrics: precision@k, recall@k, MRR, DCG / nDCG, ERR
 */

export const BLOCK = 128;

export interface EncodedPostings {
  blocks: { bitsPerValue: number; packed: Uint32Array; first: number; maxDoc: number }[];
  tail: number[]; // < 128 remaining deltas, stored as plain varints in Lucene; plain numbers here
  count: number;
}

function bitsFor(max: number): number {
  return max === 0 ? 0 : 32 - Math.clz32(max);
}

function pack(values: number[], bits: number): Uint32Array {
  const out = new Uint32Array(Math.ceil((values.length * bits) / 32));
  let bitPos = 0;
  for (const v of values) {
    for (let b = 0; b < bits; b++, bitPos++)
      if ((v >>> b) & 1) out[bitPos >>> 5]! |= 1 << (bitPos & 31);
  }
  return out;
}

function unpack(packed: Uint32Array, bits: number, n: number): number[] {
  const out: number[] = [];
  let bitPos = 0;
  for (let i = 0; i < n; i++) {
    let v = 0;
    for (let b = 0; b < bits; b++, bitPos++)
      if ((packed[bitPos >>> 5]! >>> (bitPos & 31)) & 1) v |= 1 << b;
    out.push(v >>> 0);
  }
  return out;
}

/** Encode strictly increasing doc ids. */
export function encodePostings(docs: number[]): EncodedPostings {
  for (let i = 1; i < docs.length; i++)
    if (docs[i]! <= docs[i - 1]!) throw new Error('doc ids must be strictly increasing');
  const deltas = docs.map((d, i) => (i === 0 ? d : d - docs[i - 1]!));
  const blocks: EncodedPostings['blocks'] = [];
  let i = 0;
  for (; i + BLOCK <= deltas.length; i += BLOCK) {
    const slice = deltas.slice(i, i + BLOCK);
    const bits = bitsFor(Math.max(...slice));
    blocks.push({
      bitsPerValue: bits,
      packed: pack(slice, bits),
      first: docs[i]!,
      maxDoc: docs[i + BLOCK - 1]!,
    });
  }
  return { blocks, tail: deltas.slice(i), count: docs.length };
}

export function decodePostings(e: EncodedPostings): number[] {
  const deltas = [...e.blocks.flatMap((b) => unpack(b.packed, b.bitsPerValue, BLOCK)), ...e.tail];
  const out: number[] = [];
  let prev = 0;
  deltas.forEach((d, i) => {
    prev = i === 0 ? d : prev + d;
    out.push(prev);
  });
  return out;
}

export function encodedBytes(e: EncodedPostings): number {
  // packed blocks + one byte of bit width per block + ~varint bytes for the tail
  return (
    e.blocks.reduce((n, b) => n + b.packed.byteLength + 1, 0) +
    e.tail.reduce((n, d) => n + Math.max(1, Math.ceil(bitsFor(d) / 7)), 0)
  );
}

/**
 * Intersect sorted lists, driving with the shortest and advancing the others with
 * exponential (galloping) search, the way Lucene's ConjunctionDISI calls advance(target).
 * Returns the result and how many comparisons were made.
 */
export function intersectWithSkips(lists: number[][]): { docs: number[]; comparisons: number } {
  const sorted = [...lists].sort((a, b) => a.length - b.length);
  const lead = sorted[0] ?? [];
  const pos = sorted.map(() => 0);
  let comparisons = 0;
  const out: number[] = [];
  outer: for (const target of lead) {
    for (let li = 1; li < sorted.length; li++) {
      const l = sorted[li]!;
      let lo = pos[li]!;
      let step = 1;
      let hi = lo;
      while (hi < l.length && l[hi]! < target) {
        comparisons++;
        lo = hi;
        hi += step;
        step *= 2;
      }
      hi = Math.min(hi, l.length);
      while (lo < hi) {
        comparisons++;
        const mid = (lo + hi) >>> 1;
        if (l[mid]! < target) lo = mid + 1;
        else hi = mid;
      }
      pos[li] = lo;
      if (lo >= l.length) break outer;
      if (l[lo] !== target) continue outer;
    }
    out.push(target);
  }
  return { docs: out, comparisons };
}

export function intersectNaive(lists: number[][]): { docs: number[]; comparisons: number } {
  let comparisons = 0;
  let acc = lists[0] ?? [];
  for (const l of lists.slice(1)) {
    const next: number[] = [];
    let i = 0;
    let j = 0;
    while (i < acc.length && j < l.length) {
      comparisons++;
      if (acc[i] === l[j]) {
        next.push(acc[i]!);
        i++;
        j++;
      } else if (acc[i]! < l[j]!) i++;
      else j++;
    }
    acc = next;
  }
  return { docs: acc, comparisons };
}

// ---------------------------------------------------------------------------
// _rank_eval metrics (definitions as in the Ranking Evaluation API)
// ---------------------------------------------------------------------------

/** ratings: doc id -> graded relevance (0 = irrelevant). Unrated docs count as irrelevant unless ignoreUnlabeled. */
export type Ratings = Map<string, number>;

export function precisionAtK(
  hits: string[],
  r: Ratings,
  k = 10,
  threshold = 1,
  ignoreUnlabeled = false,
): number {
  const top = hits.slice(0, k).filter((h) => !ignoreUnlabeled || r.has(h));
  if (top.length === 0) return 0;
  return top.filter((h) => (r.get(h) ?? 0) >= threshold).length / top.length;
}

export function recallAtK(hits: string[], r: Ratings, k = 10, threshold = 1): number {
  const relevant = [...r.values()].filter((v) => v >= threshold).length;
  if (relevant === 0) return 0;
  return hits.slice(0, k).filter((h) => (r.get(h) ?? 0) >= threshold).length / relevant;
}

export function reciprocalRank(hits: string[], r: Ratings, k = 10, threshold = 1): number {
  const i = hits.slice(0, k).findIndex((h) => (r.get(h) ?? 0) >= threshold);
  return i === -1 ? 0 : 1 / (i + 1);
}

export function dcg(hits: string[], r: Ratings, k = 10): number {
  return hits.slice(0, k).reduce((s, h, i) => s + (2 ** (r.get(h) ?? 0) - 1) / Math.log2(i + 2), 0);
}

export function ndcg(hits: string[], r: Ratings, k = 10): number {
  const ideal = [...r.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const idcg = dcg(ideal, r, k);
  return idcg === 0 ? 0 : dcg(hits, r, k) / idcg;
}

/** Expected Reciprocal Rank (Chapelle et al., 2009) with maximum relevance grade maxRel. */
export function err(hits: string[], r: Ratings, maxRel: number, k = 10): number {
  let p = 1;
  let score = 0;
  hits.slice(0, k).forEach((h, i) => {
    const g = r.get(h) ?? 0;
    const prob = (2 ** g - 1) / 2 ** maxRel;
    score += (p * prob) / (i + 1);
    p *= 1 - prob;
  });
  return score;
}
