/**
 * Teaching models of the distributed aggregation algorithms Elasticsearch uses:
 *  - `terms`: per-shard top-`shard_size`, coordinator merge, error bounds
 *  - `cardinality`: HyperLogLog++ style sketch, mergeable across shards
 *  - metric reduce: why avg must be reduced as (sum, count)
 *  - histogram / date_histogram bucket keys
 *  - `composite`: paginated, exhaustive bucket enumeration with `after`
 */
import { murmur3x86_32 } from './routing.ts';

// ---------------------------------------------------------------------------
// terms aggregation
// ---------------------------------------------------------------------------

export interface TermsBucket {
  key: string;
  doc_count: number;
  doc_count_error_upper_bound?: number;
}

export interface TermsResult {
  doc_count_error_upper_bound: number;
  sum_other_doc_count: number;
  buckets: TermsBucket[];
}

/** Default shard_size = size * 1.5 + 10 (when ordering by _count desc). */
export function defaultShardSize(size: number): number {
  return Math.floor(size * 1.5 + 10);
}

function countTerms(values: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return m;
}

const byCountThenKey = (a: [string, number], b: [string, number]) =>
  b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);

/**
 * Each shard returns its top `shardSize` terms by doc count. The coordinator sums counts,
 * keeps the top `size`, and reports error bounds:
 *  - per shard, the count of the LAST term it returned is the most any unreturned term could have
 *    had there (0 if the shard returned all of its terms);
 *  - doc_count_error_upper_bound = sum of those per-shard maxima;
 *  - per bucket (show_term_doc_count_error), the sum over shards that did NOT return the term.
 */
export function termsAgg(
  shards: string[][],
  size: number,
  shardSize = defaultShardSize(size),
): TermsResult {
  if (shardSize < size) shardSize = size; // ES raises shard_size to size
  const perShard = shards.map((vals) => {
    const all = [...countTerms(vals)].sort(byCountThenKey);
    const top = all.slice(0, shardSize);
    const complete = top.length === all.length;
    return { top: new Map(top), lastCount: complete ? 0 : (top.at(-1)?.[1] ?? 0) };
  });
  const merged = new Map<string, number>();
  for (const s of perShard) for (const [k, c] of s.top) merged.set(k, (merged.get(k) ?? 0) + c);
  const chosen = [...merged].sort(byCountThenKey).slice(0, size);
  const totalDocs = shards.reduce((n, s) => n + s.length, 0);
  const buckets = chosen.map(([key, doc_count]) => ({
    key,
    doc_count,
    doc_count_error_upper_bound: perShard.reduce(
      (e, s) => e + (s.top.has(key) ? 0 : s.lastCount),
      0,
    ),
  }));
  return {
    doc_count_error_upper_bound: perShard.reduce((e, s) => e + s.lastCount, 0),
    sum_other_doc_count: totalDocs - buckets.reduce((n, b) => n + b.doc_count, 0),
    buckets,
  };
}

/** The exact answer, for comparison. */
export function exactTerms(shards: string[][], size: number): TermsBucket[] {
  return [...countTerms(shards.flat())]
    .sort(byCountThenKey)
    .slice(0, size)
    .map(([key, doc_count]) => ({ key, doc_count }));
}

// ---------------------------------------------------------------------------
// cardinality: HyperLogLog (with exact counting below precision_threshold)
// ---------------------------------------------------------------------------

export class Hll {
  readonly p: number;
  readonly m: number;
  readonly registers: Uint8Array;
  /** Exact set of hashes while small (HLL++ "linear counting" phase). */
  private exact: Set<number> | null;
  readonly threshold: number;

  /**
   * @param precisionThreshold ES `precision_threshold` (default 3000, max 40000): counts are
   *   expected to be close to exact below it.
   */
  constructor(p = 14, precisionThreshold = 3000) {
    this.p = p;
    this.m = 1 << p;
    this.registers = new Uint8Array(this.m);
    this.threshold = Math.min(precisionThreshold, 40000);
    this.exact = new Set();
  }

  static hash(value: string): number {
    return murmur3x86_32(new Uint8Array(Buffer.from(value, 'utf8'))) >>> 0;
  }

  add(value: string): void {
    this.addHash(Hll.hash(value));
  }

  addHash(h: number): void {
    if (this.exact) {
      this.exact.add(h);
      if (this.exact.size > this.threshold) this.exact = null;
    }
    const idx = h >>> (32 - this.p);
    const w = (h << this.p) >>> 0;
    const rank = w === 0 ? 32 - this.p + 1 : Math.clz32(w) + 1;
    if (rank > this.registers[idx]!) this.registers[idx] = rank;
  }

  /** Merging = register-wise max; this is what makes the sketch shard-reducible. */
  merge(other: Hll): void {
    if (other.p !== this.p) throw new Error('precision mismatch');
    for (let i = 0; i < this.m; i++)
      this.registers[i] = Math.max(this.registers[i]!, other.registers[i]!);
    if (this.exact && other.exact) {
      for (const h of other.exact) this.exact.add(h);
      if (this.exact.size > this.threshold) this.exact = null;
    } else {
      this.exact = null;
    }
  }

  estimate(): number {
    if (this.exact) return this.exact.size;
    const alpha = 0.7213 / (1 + 1.079 / this.m);
    let sum = 0;
    let zeros = 0;
    for (const r of this.registers) {
      sum += 2 ** -r;
      if (r === 0) zeros++;
    }
    const raw = (alpha * this.m * this.m) / sum;
    if (raw <= 2.5 * this.m && zeros > 0) return this.m * Math.log(this.m / zeros); // linear counting
    return raw;
  }

  /** Standard error of HLL: 1.04 / sqrt(m). */
  get standardError(): number {
    return 1.04 / Math.sqrt(this.m);
  }
}

// ---------------------------------------------------------------------------
// Metric reduction
// ---------------------------------------------------------------------------

export interface AvgPartial {
  sum: number;
  count: number;
}

export const avgPartial = (xs: number[]): AvgPartial => ({
  sum: xs.reduce((a, b) => a + b, 0),
  count: xs.length,
});
export const reduceAvg = (ps: AvgPartial[]): number =>
  ps.reduce((a, p) => a + p.sum, 0) / ps.reduce((a, p) => a + p.count, 0);
/** The WRONG reduction: averaging shard averages. */
export const avgOfAvgs = (shards: number[][]): number =>
  shards.map((s) => s.reduce((a, b) => a + b, 0) / s.length).reduce((a, b) => a + b, 0) /
  shards.length;

// ---------------------------------------------------------------------------
// Histogram keys
// ---------------------------------------------------------------------------

/** histogram: key = floor((value - offset) / interval) * interval + offset */
export function histogramKey(value: number, interval: number, offset = 0): number {
  if (interval <= 0) throw new Error('[interval] must be >0 for histogram aggregation');
  return Math.floor((value - offset) / interval) * interval + offset;
}

/** date_histogram fixed_interval in ms (UTC). */
export function fixedIntervalKey(epochMs: number, intervalMs: number): number {
  return histogramKey(epochMs, intervalMs);
}

/**
 * date_histogram calendar_interval: 1d / 1M in a time zone with a fixed offset (minutes).
 * Keys are the UTC instant of local midnight / local first-of-month.
 */
export function calendarKey(epochMs: number, unit: 'day' | 'month', tzOffsetMinutes = 0): number {
  const local = new Date(epochMs + tzOffsetMinutes * 60000);
  const y = local.getUTCFullYear();
  const mo = local.getUTCMonth();
  const d = unit === 'day' ? local.getUTCDate() : 1;
  return Date.UTC(y, mo, d) - tzOffsetMinutes * 60000;
}

// ---------------------------------------------------------------------------
// Composite aggregation
// ---------------------------------------------------------------------------

export interface CompositePage {
  buckets: { key: Record<string, string | number>; doc_count: number }[];
  after_key?: Record<string, string | number>;
}

/**
 * Composite: buckets are enumerated in the sorted order of their composite key; `after`
 * resumes strictly after the given key. Every bucket is visited exactly once, regardless
 * of the number of shards: unlike `terms`, the result is exact.
 */
export function composite(
  docs: Record<string, string | number>[],
  sources: string[],
  size: number,
  after?: Record<string, string | number>,
): CompositePage {
  const counts = new Map<string, number>();
  for (const d of docs) {
    if (sources.some((s) => d[s] === undefined)) continue; // missing values are skipped by default
    const k = JSON.stringify(sources.map((s) => d[s]!));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const cmp = (a: (string | number)[], b: (string | number)[]) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! < b[i]! ? -1 : 1;
    return 0;
  };
  let keys = [...counts.keys()].map((k) => JSON.parse(k) as (string | number)[]).sort(cmp);
  if (after) {
    const a = sources.map((s) => after[s]!);
    keys = keys.filter((k) => cmp(k, a) > 0);
  }
  const page = keys.slice(0, size);
  const buckets = page.map((k) => ({
    key: Object.fromEntries(sources.map((s, i) => [s, k[i]!])),
    doc_count: counts.get(JSON.stringify(k))!,
  }));
  return buckets.length > 0 ? { buckets, after_key: buckets.at(-1)!.key } : { buckets };
}

/** search.max_buckets (default 65536): a single response may not create more buckets. */
export function checkMaxBuckets(n: number, max = 65536): void {
  if (n > max)
    throw new Error(
      `too_many_buckets_exception: Trying to create too many buckets. Must be less than or equal to: [${max}] but was [${n}].`,
    );
}
