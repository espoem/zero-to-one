// Helpers for the Redis Query Engine (FT.*), vectors and probabilistic structures.

/**
 * TAG values in FT.SEARCH query syntax: punctuation and whitespace inside {…} must be escaped
 * with a backslash, otherwise they are parsed as query operators or separators.
 * (DIALECT 2+; see the "Query syntax" and "Tag fields" docs.)
 */
const TAG_SPECIAL = /[,.<>{}[\]"':;!@#$%^&*()\-+=~|/\\ ]/g;
export function escapeTag(value: string): string {
  return value.replace(TAG_SPECIAL, (c) => `\\${c}`);
}

export function tagQuery(field: string, values: string[]): string {
  if (!/^\w+$/.test(field)) throw new Error(`unsafe field name: ${field}`);
  return `@${field}:{${values.map(escapeTag).join(' | ')}}`;
}

/** NUMERIC range: [min max], '(' makes a bound exclusive, -inf/+inf allowed. */
export function numericRange(
  field: string,
  min: number,
  max: number,
  opts: { minExclusive?: boolean; maxExclusive?: boolean } = {},
): string {
  const f = (v: number) => (v === -Infinity ? '-inf' : v === Infinity ? '+inf' : String(v));
  if (min > max) throw new Error('min > max');
  return `@${field}:[${opts.minExclusive ? '(' : ''}${f(min)} ${opts.maxExclusive ? '(' : ''}${f(max)}]`;
}

/** Vectors are passed to FT.SEARCH / stored in hashes as little-endian FLOAT32 blobs. */
export function float32Blob(v: number[]): Buffer {
  const buf = Buffer.alloc(v.length * 4);
  v.forEach((x, i) => buf.writeFloatLE(x, i * 4));
  return buf;
}
export function fromFloat32Blob(b: Buffer): number[] {
  const out: number[] = [];
  for (let i = 0; i < b.length; i += 4) out.push(b.readFloatLE(i));
  return out;
}

export const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i]!, 0);
export const norm = (a: number[]) => Math.sqrt(dot(a, a));
/** COSINE *distance* as reported by the query engine: 1 - cosine similarity (0 = same direction). */
export const cosineDistance = (a: number[], b: number[]) => 1 - dot(a, b) / (norm(a) * norm(b));
export const l2Squared = (a: number[], b: number[]) =>
  a.reduce((s, x, i) => s + (x - b[i]!) ** 2, 0);

/** Exact k-NN by brute force: what a FLAT index computes, and the ground truth for recall. */
export function knn(
  query: number[],
  items: Array<{ id: string; v: number[] }>,
  k: number,
  metric: 'COSINE' | 'L2' = 'COSINE',
) {
  const d = metric === 'COSINE' ? cosineDistance : l2Squared;
  return items
    .map((it) => ({ id: it.id, dist: d(query, it.v) }))
    .sort((a, b) => a.dist - b.dist || (a.id < b.id ? -1 : 1))
    .slice(0, k);
}

/** recall@k of an approximate result against the exact one. */
export function recallAtK(approx: string[], exact: string[]): number {
  const s = new Set(exact);
  return approx.filter((x) => s.has(x)).length / exact.length;
}

// ---------------------------------------------------------------------------------------------
// Bloom filter sizing as used by BF.RESERVE (math owned by algorithms/dsa M13)
// ---------------------------------------------------------------------------------------------

/** Optimal bits per element and hash count for a target false-positive rate p. */
export function bloomParams(p: number): { bitsPerElement: number; hashes: number } {
  if (!(p > 0 && p < 1)) throw new RangeError('error rate must be in (0, 1)');
  const bpe = -Math.log(p) / Math.LN2 ** 2;
  return { bitsPerElement: bpe, hashes: Math.ceil(-Math.log2(p)) };
}

export function bloomBytes(capacity: number, p: number): number {
  return Math.ceil((capacity * bloomParams(p).bitsPerElement) / 8);
}

/**
 * Scalable Bloom filter (BF.RESERVE … EXPANSION e): when a sub-filter fills up, a new one is
 * added with capacity × e and a tighter error rate (× r, r = 0.5), so the compound error stays
 * below p / (1 - r) = 2p. Returns the error bound and memory after `inserted` elements.
 */
export function scalableBloom(
  capacity: number,
  p: number,
  expansion: number,
  inserted: number,
  r = 0.5,
) {
  let cap = capacity;
  let err = p;
  let remaining = inserted;
  let filters = 0;
  let bytes = 0;
  let compound = 0;
  do {
    filters++;
    bytes += bloomBytes(cap, err);
    compound = 1 - (1 - compound) * (1 - err);
    remaining -= cap;
    cap *= expansion;
    err *= r;
  } while (remaining > 0);
  return { filters, bytes, compoundErrorBound: compound };
}

/** HyperLogLog as implemented by Redis: m = 2^14 registers, standard error 1.04/sqrt(m). */
export const HLL_REGISTERS = 16384;
export const HLL_STD_ERROR = 1.04 / Math.sqrt(HLL_REGISTERS);
