/**
 * A teaching model of Elasticsearch search execution over the Lucene model in lucene.ts:
 *   - BM25 exactly as Lucene computes it (with one-byte length norms)
 *   - a Query DSL subset with real query/filter-context semantics
 *   - a multi-shard index with murmur3 routing, query-then-fetch and dfs_query_then_fetch
 *   - from/size limits, sort on doc values, search_after
 */
import { analyze } from './analysis.ts';
import { type Mapping, type LeafMapping, resolveField } from './mapping.ts';
import {
  Shard,
  type Reader,
  type Segment,
  byte4ToInt,
  type DocValue,
  compareBytes,
} from './lucene.ts';
import { shardId, defaultRoutingShards } from './routing.ts';

// ---------------------------------------------------------------------------
// BM25
// ---------------------------------------------------------------------------

export interface BM25Params {
  k1: number;
  b: number;
}

export const DEFAULT_BM25: BM25Params = { k1: 1.2, b: 0.75 };

/** Lucene BM25Similarity.idf: ln(1 + (N - n + 0.5) / (n + 0.5)); always > 0. */
export function idf(docFreq: number, docCount: number): number {
  return Math.log(1 + (docCount - docFreq + 0.5) / (docFreq + 0.5));
}

/** Lucene's tf component (Lucene >= 8 dropped the constant (k1 + 1) numerator). */
export function tfNorm(
  freq: number,
  dl: number,
  avgdl: number,
  p: BM25Params = DEFAULT_BM25,
): number {
  return freq / (freq + p.k1 * (1 - p.b + (p.b * dl) / avgdl));
}

export interface TermStats {
  docFreq: number; // docs containing the term (deleted docs still counted until merged)
  docCount: number; // docs with a value for the field
  sumTotalTermFreq: number;
}

/** One term's BM25 contribution for one doc. `dlEncoded` is the norm byte stored in the index. */
export function bm25(
  freq: number,
  dlEncoded: number,
  s: TermStats,
  boost = 1,
  p: BM25Params = DEFAULT_BM25,
): number {
  const avgdl = s.sumTotalTermFreq / s.docCount;
  const dl = byte4ToInt(dlEncoded);
  return boost * idf(s.docFreq, s.docCount) * tfNorm(freq, dl, avgdl, p);
}

// ---------------------------------------------------------------------------
// Query DSL subset
// ---------------------------------------------------------------------------

type FieldQ<T> = Record<string, T>;
export type Query =
  | { match_all: { boost?: number } }
  | { match_none: Record<string, never> }
  | { term: FieldQ<DocValue | { value: DocValue; boost?: number; case_insensitive?: boolean }> }
  | { terms: FieldQ<DocValue[]> }
  | { ids: { values: string[] } }
  | {
      match: FieldQ<
        | string
        | {
            query: string;
            operator?: 'or' | 'and';
            minimum_should_match?: number | string;
            boost?: number;
            fuzziness?: 'AUTO' | number;
          }
      >;
    }
  | { match_phrase: FieldQ<string | { query: string; slop?: number }> }
  | {
      multi_match: {
        query: string;
        fields: string[];
        type?: 'best_fields' | 'most_fields';
        tie_breaker?: number;
        operator?: 'or' | 'and';
      };
    }
  | { dis_max: { queries: Query[]; tie_breaker?: number } }
  | {
      range: FieldQ<{
        gte?: number | string;
        gt?: number | string;
        lte?: number | string;
        lt?: number | string;
      }>;
    }
  | { exists: { field: string } }
  | { prefix: FieldQ<string> }
  | {
      fuzzy: FieldQ<{
        value: string;
        fuzziness?: 'AUTO' | number;
        prefix_length?: number;
        transpositions?: boolean;
      }>;
    }
  | {
      bool: {
        must?: Query[];
        should?: Query[];
        filter?: Query[];
        must_not?: Query[];
        minimum_should_match?: number | string;
        boost?: number;
      };
    }
  | { constant_score: { filter: Query; boost?: number } };

export class QueryError extends Error {
  constructor(type: string, reason: string) {
    super(`${type}: ${reason}`);
  }
}

/** Global doc id inside a reader: segment ordinal + local doc. */
interface Ctx {
  reader: Reader;
  mapping: Mapping;
  shard: Shard;
  stats: StatsSource;
}

export interface StatsSource {
  term(field: string, term: string): TermStats;
}

/** Per-shard statistics (what query_then_fetch uses). Deleted docs are still counted. */
export function readerStats(reader: Reader): StatsSource {
  return {
    term(field, term) {
      let docFreq = 0;
      let docCount = 0;
      let sumTotalTermFreq = 0;
      for (const seg of reader.segments) {
        const fi = seg.fields.get(field);
        if (!fi) continue;
        docFreq += fi.postings.get(term)?.length ?? 0;
        docCount += fi.docCount;
        sumTotalTermFreq += fi.sumTotalTermFreq;
      }
      return { docFreq, docCount, sumTotalTermFreq };
    },
  };
}

/** dfs_query_then_fetch: sum the statistics of every shard first, then score with them. */
export function globalStats(readers: Reader[]): StatsSource {
  const per = readers.map(readerStats);
  return {
    term(field, term) {
      const all = per.map((p) => p.term(field, term));
      return {
        docFreq: all.reduce((a, s) => a + s.docFreq, 0),
        docCount: all.reduce((a, s) => a + s.docCount, 0),
        sumTotalTermFreq: all.reduce((a, s) => a + s.sumTotalTermFreq, 0),
      };
    },
  };
}

type Hits = Map<string, number>; // "seg:doc" -> score
const key = (s: number, d: number) => `${s}:${d}`;

function liveDocs(ctx: Ctx): string[] {
  const out: string[] = [];
  ctx.reader.segments.forEach((seg, s) => seg.live.forEach((l, d) => l && out.push(key(s, d))));
  return out;
}

function leaf(ctx: Ctx, field: string): LeafMapping {
  const m = resolveField(ctx.mapping, field);
  if (!m) return { type: 'keyword' }; // unmapped: behaves as matching nothing
  return m;
}

function termHits(ctx: Ctx, field: string, term: string, boost: number, scoring: boolean): Hits {
  const out: Hits = new Map();
  const m = leaf(ctx, field);
  const stats = ctx.stats.term(field, term);
  ctx.reader.segments.forEach((seg, s) => {
    const fi = seg.fields.get(field);
    for (const p of fi?.postings.get(term) ?? []) {
      if (!seg.live[p.doc]) continue;
      let score = boost;
      if (scoring) {
        // keyword/numeric fields omit norms: dl == avgdl effectively, so tf part is freq/(freq+k1)
        const norm = fi!.norms.get(p.doc);
        score =
          norm === undefined || m.type !== 'text'
            ? boost * idf(stats.docFreq, stats.docCount) * (p.freq / (p.freq + DEFAULT_BM25.k1))
            : bm25(p.freq, norm, stats, boost);
      }
      out.set(key(s, p.doc), score);
    }
  });
  return out;
}

function normalizeTermValue(m: LeafMapping, v: DocValue): string {
  if (m.type === 'date') return String(typeof v === 'number' ? v : Date.parse(String(v)));
  if (m.type === 'long' || m.type === 'integer') return String(Math.trunc(Number(v)));
  if (m.type === 'boolean') return String(v === true || v === 'true');
  return String(v);
}

function parseMsm(msm: number | string | undefined, optional: number): number {
  if (msm === undefined) return 0;
  if (typeof msm === 'number') return msm < 0 ? optional + msm : msm;
  const pct = /^(-?\d+)%$/.exec(msm);
  if (pct) {
    const v = Math.trunc((optional * Math.abs(Number(pct[1]))) / 100);
    return Number(pct[1]) < 0 ? optional - v : v;
  }
  return Number(msm);
}

/** Combine clause hit maps disjunctively (sum of scores) with a minimum match count. */
function disjunction(clauses: Hits[], minMatch: number): Hits {
  const counts = new Map<string, number>();
  const scores: Hits = new Map();
  for (const c of clauses) {
    for (const [k, s] of c) {
      counts.set(k, (counts.get(k) ?? 0) + 1);
      scores.set(k, (scores.get(k) ?? 0) + s);
    }
  }
  for (const [k, n] of counts) if (n < Math.max(1, minMatch)) scores.delete(k);
  return scores;
}

export function autoFuzziness(term: string): number {
  const n = [...term].length;
  return n <= 2 ? 0 : n <= 5 ? 1 : 2;
}

/** Optimal-string-alignment (Damerau) distance, as Lucene's FuzzyQuery with transpositions=true. */
export function editDistance(a: string, b: string, transpositions = true): number {
  const A = [...a];
  const B = [...b];
  const d: number[][] = Array.from({ length: A.length + 1 }, (_, i) =>
    Array.from({ length: B.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= A.length; i++) {
    for (let j = 1; j <= B.length; j++) {
      const cost = A[i - 1] === B[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (transpositions && i > 1 && j > 1 && A[i - 1] === B[j - 2] && A[i - 2] === B[j - 1]) {
        d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
      }
    }
  }
  return d[A.length]![B.length]!;
}

function allTerms(ctx: Ctx, field: string): Set<string> {
  const out = new Set<string>();
  for (const seg of ctx.reader.segments)
    for (const t of seg.fields.get(field)?.postings.keys() ?? []) out.add(t);
  return out;
}

function fuzzyExpand(
  ctx: Ctx,
  field: string,
  value: string,
  fuzziness: number,
  prefixLength: number,
  transpositions: boolean,
  maxExpansions = 50,
): string[] {
  const prefix = value.slice(0, prefixLength);
  const cands: [string, number][] = [];
  for (const t of allTerms(ctx, field)) {
    if (!t.startsWith(prefix)) continue;
    const dist = editDistance(t, value, transpositions);
    if (dist <= fuzziness) cands.push([t, dist]);
  }
  cands.sort((a, b) => a[1] - b[1] || compareBytes(a[0], b[0]));
  return cands.slice(0, maxExpansions).map(([t]) => t);
}

function phraseHits(ctx: Ctx, field: string, text: string, slop: number, scoring: boolean): Hits {
  const m = leaf(ctx, field);
  const toks = analyze(ctx.shard.analyzerFor(m, true), text);
  const out: Hits = new Map();
  if (toks.length === 0) return out;
  ctx.reader.segments.forEach((seg, s) => {
    const fi = seg.fields.get(field);
    if (!fi) return;
    const lists = toks.map(
      (t) => new Map((fi.postings.get(t.token) ?? []).map((p) => [p.doc, p.positions])),
    );
    for (const [doc, firstPositions] of lists[0]!) {
      if (!seg.live[doc] || !lists.every((l) => l.has(doc))) continue;
      // exact phrase (slop 0) or sloppy: every token i at position p0 + rel_i within `slop` total moves
      let matches = 0;
      for (const p0 of firstPositions) {
        let moved = 0;
        let ok = true;
        for (let i = 1; i < toks.length; i++) {
          const want = p0 + (toks[i]!.position - toks[0]!.position);
          const ps = lists[i]!.get(doc)!;
          const best = Math.min(...ps.map((p) => Math.abs(p - want)));
          moved += best;
          if (moved > slop) {
            ok = false;
            break;
          }
        }
        if (ok) matches++;
      }
      if (matches > 0) {
        let score = 1;
        if (scoring) {
          // PhraseQuery scores the phrase frequency against the summed idf of its terms
          const idfSum = toks.reduce((a, t) => {
            const st = ctx.stats.term(field, t.token);
            return a + idf(st.docFreq, st.docCount);
          }, 0);
          const st = ctx.stats.term(field, toks[0]!.token);
          score =
            idfSum *
            tfNorm(matches, byte4ToInt(fi.norms.get(doc) ?? 1), st.sumTotalTermFreq / st.docCount);
        }
        out.set(key(s, doc), score);
      }
    }
  });
  return out;
}

function docValues(seg: Segment, field: string, doc: number): DocValue[] {
  return seg.docValues.get(field)?.[doc] ?? [];
}

function toNumber(m: LeafMapping, v: number | string): number {
  return m.type === 'date' && typeof v === 'string' ? Date.parse(v) : Number(v);
}

/** Execute a query against a reader. `scoring=false` is filter context. */
export function execute(q: Query, ctx: Ctx, scoring = true): Hits {
  if ('match_all' in q) return new Map(liveDocs(ctx).map((k) => [k, q.match_all.boost ?? 1]));
  if ('match_none' in q) return new Map();
  if ('ids' in q) {
    const want = new Set(q.ids.values);
    const out: Hits = new Map();
    ctx.reader.segments.forEach((seg, s) =>
      seg.ids.forEach((id, d) => seg.live[d] && want.has(id) && out.set(key(s, d), 1)),
    );
    return out;
  }
  if ('term' in q) {
    const [field, spec] = Object.entries(q.term)[0]!;
    const isObj = typeof spec === 'object' && spec !== null;
    const value = isObj ? spec.value : spec;
    const boost = isObj ? (spec.boost ?? 1) : 1;
    const m = leaf(ctx, field);
    // term is NOT analyzed: on a `text` field it looks for the exact token in the index
    if (isObj && spec.case_insensitive) {
      const want = String(value).toLowerCase();
      const hitsets = [...allTerms(ctx, field)]
        .filter((t) => t.toLowerCase() === want)
        .map((t) => termHits(ctx, field, t, boost, false));
      return disjunction(hitsets, 1);
    }
    return termHits(ctx, field, normalizeTermValue(m, value), boost, scoring);
  }
  if ('terms' in q) {
    const [field, values] = Object.entries(q.terms)[0]!;
    const m = leaf(ctx, field);
    // terms is a constant-score query (score 1 per matching doc)
    const hits = disjunction(
      values.map((v) => termHits(ctx, field, normalizeTermValue(m, v), 1, false)),
      1,
    );
    return new Map([...hits.keys()].map((k) => [k, 1]));
  }
  if ('match' in q) {
    const [field, spec] = Object.entries(q.match)[0]!;
    const o = typeof spec === 'string' ? { query: spec } : spec;
    const m = leaf(ctx, field);
    const toks = [...new Set(analyze(ctx.shard.analyzerFor(m, true), o.query).map((t) => t.token))];
    const fuzz = o.fuzziness;
    const clauses = toks.map((t) => {
      if (fuzz === undefined) return termHits(ctx, field, t, o.boost ?? 1, scoring);
      const f = fuzz === 'AUTO' ? autoFuzziness(t) : fuzz;
      return disjunction(
        fuzzyExpand(ctx, field, t, f, 0, true).map((x) =>
          termHits(ctx, field, x, o.boost ?? 1, scoring),
        ),
        1,
      );
    });
    const minMatch =
      o.operator === 'and'
        ? clauses.length
        : Math.max(1, parseMsm(o.minimum_should_match, clauses.length));
    return disjunction(clauses, minMatch);
  }
  if ('match_phrase' in q) {
    const [field, spec] = Object.entries(q.match_phrase)[0]!;
    const o = typeof spec === 'string' ? { query: spec, slop: 0 } : spec;
    return phraseHits(ctx, field, o.query, o.slop ?? 0, scoring);
  }
  if ('multi_match' in q) {
    const mm = q.multi_match;
    const per = mm.fields.map((f) => {
      const [name, boostStr] = f.split('^');
      const h = execute(
        { match: { [name!]: { query: mm.query, operator: mm.operator ?? 'or' } } },
        ctx,
        scoring,
      );
      const b = boostStr ? Number(boostStr) : 1;
      return new Map([...h].map(([k, s]) => [k, s * b]));
    });
    if (mm.type === 'most_fields') return disjunction(per, 1);
    return disMax(per, mm.tie_breaker ?? 0);
  }
  if ('dis_max' in q)
    return disMax(
      q.dis_max.queries.map((c) => execute(c, ctx, scoring)),
      q.dis_max.tie_breaker ?? 0,
    );
  if ('range' in q) {
    const [field, r] = Object.entries(q.range)[0]!;
    const m = leaf(ctx, field);
    const out: Hits = new Map();
    ctx.reader.segments.forEach((seg, s) => {
      for (let d = 0; d < seg.maxDoc; d++) {
        if (!seg.live[d]) continue;
        const vals = docValues(seg, field, d);
        const ok = vals.some((raw) => {
          if (m.type === 'keyword') {
            const v = String(raw);
            return (
              (r.gte === undefined || compareBytes(v, String(r.gte)) >= 0) &&
              (r.gt === undefined || compareBytes(v, String(r.gt)) > 0) &&
              (r.lte === undefined || compareBytes(v, String(r.lte)) <= 0) &&
              (r.lt === undefined || compareBytes(v, String(r.lt)) < 0)
            );
          }
          const v = Number(raw);
          return (
            (r.gte === undefined || v >= toNumber(m, r.gte)) &&
            (r.gt === undefined || v > toNumber(m, r.gt)) &&
            (r.lte === undefined || v <= toNumber(m, r.lte)) &&
            (r.lt === undefined || v < toNumber(m, r.lt))
          );
        });
        if (ok) out.set(key(s, d), 1); // range is constant score
      }
    });
    return out;
  }
  if ('exists' in q) {
    const field = q.exists.field;
    const out: Hits = new Map();
    ctx.reader.segments.forEach((seg, s) => {
      const fi = seg.fields.get(field);
      const indexedDocs = new Set<number>();
      for (const ps of fi?.postings.values() ?? []) for (const p of ps) indexedDocs.add(p.doc);
      for (let d = 0; d < seg.maxDoc; d++) {
        if (seg.live[d] && (indexedDocs.has(d) || docValues(seg, field, d).length > 0))
          out.set(key(s, d), 1);
      }
    });
    return out;
  }
  if ('prefix' in q) {
    const [field, value] = Object.entries(q.prefix)[0]!;
    // multi-term queries rewrite to a constant-score query by default (rewrite: constant_score)
    const hits = disjunction(
      [...allTerms(ctx, field)]
        .filter((t) => t.startsWith(value))
        .map((t) => termHits(ctx, field, t, 1, false)),
      1,
    );
    return new Map([...hits.keys()].map((k) => [k, 1]));
  }
  if ('fuzzy' in q) {
    const [field, o] = Object.entries(q.fuzzy)[0]!;
    const f =
      o.fuzziness === undefined || o.fuzziness === 'AUTO' ? autoFuzziness(o.value) : o.fuzziness;
    const expanded = fuzzyExpand(
      ctx,
      field,
      o.value,
      f,
      o.prefix_length ?? 0,
      o.transpositions ?? true,
    );
    return disMax(
      expanded.map((t) => termHits(ctx, field, t, 1, scoring)),
      0,
    );
  }
  if ('constant_score' in q) {
    const h = execute(q.constant_score.filter, ctx, false);
    return new Map([...h.keys()].map((k) => [k, q.constant_score.boost ?? 1]));
  }
  if ('bool' in q) {
    const b = q.bool;
    const must = (b.must ?? []).map((c) => execute(c, ctx, scoring));
    const filter = (b.filter ?? []).map((c) => execute(c, ctx, false));
    const should = (b.should ?? []).map((c) => execute(c, ctx, scoring));
    const mustNot = (b.must_not ?? []).map((c) => execute(c, ctx, false));
    const required = [...must, ...filter];
    // default minimum_should_match: 1 if the bool has no must/filter clause, else 0
    const defaultMsm = required.length === 0 && should.length > 0 ? 1 : 0;
    const msm =
      b.minimum_should_match === undefined
        ? defaultMsm
        : parseMsm(b.minimum_should_match, should.length);
    let candidates: Set<string>;
    if (required.length > 0) {
      candidates = new Set(required[0]!.keys());
      for (const r of required.slice(1))
        candidates = new Set([...candidates].filter((k) => r.has(k)));
    } else if (should.length > 0) {
      candidates = new Set(should.flatMap((h) => [...h.keys()]));
    } else {
      candidates = new Set(liveDocs(ctx)); // only filter/must_not: everything else matches
    }
    const out: Hits = new Map();
    for (const k of candidates) {
      if (mustNot.some((h) => h.has(k))) continue;
      const shouldMatched = should.filter((h) => h.has(k));
      if (shouldMatched.length < msm) continue;
      // Lucene >= 7: score = sum of scoring clauses (no coord factor); filter/must_not add 0
      let score = 0;
      for (const h of must) score += h.get(k)!;
      for (const h of shouldMatched) score += h.get(k)!;
      out.set(k, scoring ? score * (b.boost ?? 1) : 0);
    }
    return out;
  }
  throw new QueryError('parsing_exception', `unknown query [${Object.keys(q)[0]}]`);
}

function disMax(parts: Hits[], tie: number): Hits {
  const out: Hits = new Map();
  const all = new Set(parts.flatMap((p) => [...p.keys()]));
  for (const k of all) {
    const scores = parts.map((p) => p.get(k)).filter((s): s is number => s !== undefined);
    const max = Math.max(...scores);
    const rest = scores.reduce((a, s) => a + s, 0) - max;
    out.set(k, max + tie * rest);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Index = N shards
// ---------------------------------------------------------------------------

export type SortSpec =
  | string
  | Record<string, 'asc' | 'desc' | { order: 'asc' | 'desc'; missing?: '_first' | '_last' }>;

export interface SearchRequest {
  query?: Query;
  from?: number;
  size?: number;
  sort?: SortSpec[];
  search_after?: DocValue[];
  track_total_hits?: boolean | number;
}

export interface Hit {
  _id: string;
  _score: number | null;
  _shard: number;
  _source: Record<string, unknown>;
  sort?: DocValue[];
}

export interface SearchResponse {
  hits: { total: { value: number; relation: 'eq' | 'gte' }; hits: Hit[] };
}

export interface IndexSettings {
  number_of_shards?: number;
  number_of_routing_shards?: number;
  max_result_window?: number;
}

export class Index {
  readonly name: string;
  readonly mapping: Mapping;
  readonly shards: Shard[];
  readonly settings: Required<IndexSettings>;

  constructor(
    name: string,
    mapping: Mapping,
    settings: IndexSettings = {},
    analyzers?: ConstructorParameters<typeof Shard>[0]['analyzers'],
  ) {
    const n = settings.number_of_shards ?? 1;
    this.name = name;
    this.mapping = mapping;
    this.settings = {
      number_of_shards: n,
      number_of_routing_shards: settings.number_of_routing_shards ?? defaultRoutingShards(n),
      max_result_window: settings.max_result_window ?? 10000,
    };
    this.shards = Array.from(
      { length: n },
      () => new Shard({ mapping, ...(analyzers ? { analyzers } : {}) }),
    );
  }

  shardFor(id: string, routing?: string): number {
    return shardId(routing ?? id, this.settings.number_of_shards);
  }

  index(
    id: string,
    source: Record<string, unknown>,
    opts: { routing?: string; refresh?: boolean } = {},
  ) {
    const s = this.shardFor(id, opts.routing);
    const r = this.shards[s]!.index(id, source);
    if (opts.refresh) this.shards[s]!.refresh();
    return { ...r, _shard: s };
  }

  /** GET by id: routed to exactly one shard; realtime. With the wrong routing it misses. */
  get(id: string, routing?: string) {
    return this.shards[this.shardFor(id, routing)]!.get(id);
  }

  refresh(): void {
    for (const s of this.shards) s.refresh();
  }

  search(
    req: SearchRequest = {},
    searchType: 'query_then_fetch' | 'dfs_query_then_fetch' = 'query_then_fetch',
  ): SearchResponse {
    const from = req.from ?? 0;
    const size = req.size ?? 10;
    if (from + size > this.settings.max_result_window) {
      throw new QueryError(
        'illegal_argument_exception',
        `Result window is too large, from + size must be less than or equal to: [${this.settings.max_result_window}] but was [${from + size}]. See the scroll api for a more efficient way to request large data sets.`,
      );
    }
    const readers = this.shards.map((s) => s.reader());
    const dfs = searchType === 'dfs_query_then_fetch' ? globalStats(readers) : undefined;
    const sort = req.sort ?? ['_score'];
    const collected: (Hit & { _key: (DocValue | number)[] })[] = [];
    readers.forEach((reader, shardIdx) => {
      const ctx: Ctx = {
        reader,
        mapping: this.mapping,
        shard: this.shards[shardIdx]!,
        stats: dfs ?? readerStats(reader),
      };
      const hits = execute(req.query ?? { match_all: {} }, ctx, true);
      for (const [k, score] of hits) {
        const [s, d] = k.split(':').map(Number) as [number, number];
        const seg = reader.segments[s]!;
        const sortValues = sort.map((spec) => this.sortValue(spec, seg, d, score));
        collected.push({
          _id: seg.ids[d]!,
          _score: score,
          _shard: shardIdx,
          _source: seg.stored[d]!,
          sort: sortValues,
          _key: [...sortValues, shardIdx, s, d],
        });
      }
    });
    const dirs = sort.map((spec) => sortOrder(spec));
    const cmp = (a: (DocValue | number)[], b: (DocValue | number)[]): number => {
      for (let i = 0; i < a.length; i++) {
        const dir = i < dirs.length ? dirs[i]! : 1;
        const x = a[i]!;
        const y = b[i]!;
        const c =
          typeof x === 'string' && typeof y === 'string'
            ? compareBytes(x, y)
            : Number(x) - Number(y);
        if (c !== 0) return c * dir;
      }
      return 0;
    };
    collected.sort((a, b) => cmp(a._key, b._key));
    let filtered = collected;
    if (req.search_after) {
      if (req.search_after.length !== sort.length)
        throw new QueryError(
          'illegal_argument_exception',
          'search_after has a different number of sort values than sort',
        );
      if (from !== 0)
        throw new QueryError(
          'illegal_argument_exception',
          '[from] parameter must be set to 0 when [search_after] is used',
        );
      filtered = collected.filter((h) => cmp(h.sort!, req.search_after!) > 0);
    }
    const scored = sort.some((s) => s === '_score' || (typeof s === 'object' && '_score' in s));
    const page = filtered
      .slice(from, from + size)
      .map(({ _key, ...h }) => ({ ...h, _score: scored ? h._score : null }));
    const limit =
      req.track_total_hits === true
        ? Infinity
        : typeof req.track_total_hits === 'number'
          ? req.track_total_hits
          : 10000;
    const total = collected.length;
    return {
      hits: {
        total: total > limit ? { value: limit, relation: 'gte' } : { value: total, relation: 'eq' },
        hits: page,
      },
    };
  }

  private sortValue(spec: SortSpec, seg: Segment, d: number, score: number): DocValue {
    const field = typeof spec === 'string' ? spec : Object.keys(spec)[0]!;
    if (field === '_score') return score;
    if (field === '_doc') return d;
    const m = resolveField(this.mapping, field);
    if (m?.type === 'text' && !m.fielddata) {
      throw new QueryError(
        'illegal_argument_exception',
        `Text fields are not optimised for operations that require per-document field data like aggregations and sorting, so these operations are disabled by default. Please use a keyword field instead. Alternatively, set fielddata=true on [${field}] in order to load field data by uninverting the inverted index. Note that this can use significant memory.`,
      );
    }
    const vals = seg.docValues.get(field)?.[d] ?? [];
    const order = sortOrder(spec);
    // multi-valued: asc sorts by min, desc by max (default sort mode)
    if (vals.length === 0) return order === 1 ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER; // missing: _last
    return order === 1 ? vals[0]! : vals[vals.length - 1]!;
  }
}

function sortOrder(spec: SortSpec): 1 | -1 {
  if (typeof spec === 'string') return spec === '_score' ? -1 : 1;
  const v = Object.values(spec)[0]!;
  const o = typeof v === 'string' ? v : v.order;
  return o === 'desc' ? -1 : 1;
}

/** Convenience for tests: run a query on one shard's current reader. */
export function searchShard(
  shard: Shard,
  q: Query,
  scoring = true,
): { id: string; score: number }[] {
  const reader = shard.reader();
  const hits = execute(
    q,
    { reader, mapping: shard.mapping, shard, stats: readerStats(reader) },
    scoring,
  );
  return [...hits]
    .map(([k, score]) => {
      const [s, d] = k.split(':').map(Number) as [number, number];
      return { id: reader.segments[s]!.ids[d]!, score };
    })
    .sort((a, b) => b.score - a.score || compareBytes(a.id, b.id));
}
