/**
 * A teaching model of one Elasticsearch shard = one Lucene index:
 *
 *   index()  -> in-memory indexing buffer + translog append      (durable only after translog fsync)
 *   refresh  -> buffer becomes a new immutable segment            (visible to search: near-real-time)
 *   flush    -> Lucene commit (segments fsynced), translog trimmed (cheap recovery)
 *   merge    -> N segments rewritten into 1, deleted docs purged
 *
 * Each segment holds the per-field inverted index (term dictionary + postings with
 * positions), one-byte length norms (SmallFloat), column-oriented doc values, and
 * row-oriented stored fields (_source, _id).
 */
import {
  type Analyzer,
  analyze,
  keywordAnalyzer,
  standardAnalyzer,
  englishLikeAnalyzer,
  simpleAnalyzer,
  whitespaceAnalyzer,
} from './analysis.ts';
import {
  type Mapping,
  type LeafMapping,
  flatten,
  resolveField,
  isObject,
  type FieldMapping,
} from './mapping.ts';

// ---------------------------------------------------------------------------
// Lucene SmallFloat: document length is stored in ONE byte per field per doc.
// ---------------------------------------------------------------------------

function longToInt4(i: number): number {
  if (i < 0) throw new Error('only supports positive values');
  const numBits = i === 0 ? 0 : Math.floor(Math.log2(i)) + 1;
  if (numBits < 4) return i;
  const shift = numBits - 4;
  const encoded = Math.floor(i / 2 ** shift) & 0x07;
  return encoded | ((shift + 1) << 3);
}

function int4ToLong(i: number): number {
  const bits = i & 0x07;
  const shift = (i >>> 3) - 1;
  return shift < 0 ? bits : (bits | 0x08) * 2 ** shift;
}

const MAX_INT4 = longToInt4(2 ** 31 - 1);
/** Lengths below this are encoded exactly (24 for Lucene's int4 scheme). */
export const NUM_FREE_VALUES = 255 - MAX_INT4;

/** SmallFloat.intToByte4: lossy, monotonic encoding of a non-negative int into a byte. */
export function intToByte4(i: number): number {
  if (i < 0) throw new Error('only supports positive values');
  return i < NUM_FREE_VALUES ? i : NUM_FREE_VALUES + longToInt4(i - NUM_FREE_VALUES);
}

/** SmallFloat.byte4ToInt: decode; decode(encode(x)) <= x. */
export function byte4ToInt(b: number): number {
  return b < NUM_FREE_VALUES ? b : NUM_FREE_VALUES + int4ToLong(b - NUM_FREE_VALUES);
}

// ---------------------------------------------------------------------------
// Segment
// ---------------------------------------------------------------------------

export interface Posting {
  doc: number;
  freq: number;
  positions: number[];
}

export interface FieldIndex {
  postings: Map<string, Posting[]>;
  /** doc -> encoded length byte (absent when norms are disabled, e.g. keyword) */
  norms: Map<number, number>;
  /** sum of term frequencies over all docs (for avgdl) */
  sumTotalTermFreq: number;
  /** number of docs that have at least one term in this field */
  docCount: number;
}

export type DocValue = string | number | boolean;

let segmentCounter = 0;

export class Segment {
  readonly name: string;
  readonly maxDoc: number;
  readonly fields: Map<string, FieldIndex>;
  /** Column-oriented: field -> per-doc sorted values. Used for sort, aggs, scripts. */
  readonly docValues: Map<string, DocValue[][]>;
  /** Row-oriented: per-doc _source blob. Used for fetch. */
  readonly stored: Record<string, unknown>[];
  readonly ids: string[];
  readonly seqNos: number[];
  /** Live docs bitset. Deletes flip a bit; the doc's bytes stay until a merge. */
  live: boolean[];

  constructor(init: {
    fields: Map<string, FieldIndex>;
    docValues: Map<string, DocValue[][]>;
    stored: Record<string, unknown>[];
    ids: string[];
    seqNos: number[];
    live?: boolean[];
  }) {
    this.name = `_${(segmentCounter++).toString(36)}`;
    this.maxDoc = init.ids.length;
    this.fields = init.fields;
    this.docValues = init.docValues;
    this.stored = init.stored;
    this.ids = init.ids;
    this.seqNos = init.seqNos;
    this.live = init.live ?? init.ids.map(() => true);
  }

  get numDocs(): number {
    return this.live.filter(Boolean).length;
  }

  get deletedDocs(): number {
    return this.maxDoc - this.numDocs;
  }

  /** The term dictionary: sorted unique terms (Lucene stores it as an FST-indexed block tree). */
  termDictionary(field: string): string[] {
    return [...(this.fields.get(field)?.postings.keys() ?? [])].sort(compareBytes);
  }

  /** A point-in-time copy: later deletes do not change what an open reader sees. */
  snapshot(): Segment {
    const s = Object.create(Segment.prototype) as Segment;
    Object.assign(s, this, { live: [...this.live] });
    return s;
  }
}

/** Lucene orders terms by their UTF-8 bytes, not by UTF-16 code units. */
export function compareBytes(a: string, b: string): number {
  const ea = Buffer.from(a, 'utf8');
  const eb = Buffer.from(b, 'utf8');
  return Buffer.compare(ea, eb);
}

// ---------------------------------------------------------------------------
// Analyzer registry
// ---------------------------------------------------------------------------

export const BUILTIN_ANALYZERS: Record<string, Analyzer> = {
  standard: standardAnalyzer,
  english: englishLikeAnalyzer,
  simple: simpleAnalyzer,
  whitespace: whitespaceAnalyzer,
  keyword: keywordAnalyzer,
};

// ---------------------------------------------------------------------------
// Shard (one Lucene IndexWriter + translog)
// ---------------------------------------------------------------------------

export interface TranslogOp {
  op: 'index' | 'delete';
  id: string;
  seqNo: number;
  primaryTerm: number;
  source?: Record<string, unknown>;
}

interface Buffered {
  id: string;
  seqNo: number;
  source: Record<string, unknown>;
}

export class VersionConflictError extends Error {
  constructor(id: string, detail: string) {
    super(`version_conflict_engine_exception: [${id}]: ${detail}`);
  }
}

export interface IndexResult {
  _id: string;
  _seq_no: number;
  _primary_term: number;
  result: 'created' | 'updated' | 'deleted' | 'not_found';
}

export interface ShardOptions {
  mapping: Mapping;
  analyzers?: Record<string, Analyzer>;
  primaryTerm?: number;
  /**
   * index.translog.durability: `request` (default) fsyncs the translog before acknowledging
   * every write; `async` fsyncs every index.translog.sync_interval (default 5s), so a crash
   * can lose the acknowledged writes of the last interval.
   */
  durability?: 'request' | 'async';
}

/** A searchable point-in-time view (an IndexReader / a PIT). */
export interface Reader {
  segments: Segment[];
}

export class Shard {
  readonly mapping: Mapping;
  readonly analyzers: Record<string, Analyzer>;
  primaryTerm: number;

  /** Segments visible to search (as of the last refresh). */
  private searchable: Segment[] = [];
  /** Segments referenced by the last Lucene commit (durable on disk). */
  private committed: Segment[] = [];
  /** Docs indexed but not yet refreshed into a segment. */
  private buffer: Buffered[] = [];
  /** Ops since the last commit; replayed on recovery. */
  translog: TranslogOp[] = [];
  private nextSeqNo = 0;
  /** Live version map: realtime GET and optimistic concurrency need the latest seqNo per id. */
  private versions = new Map<
    string,
    { seqNo: number; primaryTerm: number; source: Record<string, unknown> | null }
  >();
  refreshCount = 0;
  readonly durability: 'request' | 'async';
  /** Number of translog ops that have been fsynced. */
  private syncedOps = 0;

  constructor(opts: ShardOptions) {
    this.durability = opts.durability ?? 'request';
    this.mapping = opts.mapping;
    this.analyzers = { ...BUILTIN_ANALYZERS, ...opts.analyzers };
    this.primaryTerm = opts.primaryTerm ?? 1;
  }

  get localCheckpoint(): number {
    return this.nextSeqNo - 1;
  }

  index(
    id: string,
    source: Record<string, unknown>,
    opts: { ifSeqNo?: number; ifPrimaryTerm?: number; opType?: 'index' | 'create' } = {},
  ): IndexResult {
    const current = this.versions.get(id);
    const exists = current !== undefined && current.source !== null;
    if (opts.opType === 'create' && exists) {
      throw new VersionConflictError(id, 'document already exists');
    }
    if (opts.ifSeqNo !== undefined || opts.ifPrimaryTerm !== undefined) {
      if (!exists || current.seqNo !== opts.ifSeqNo || current.primaryTerm !== opts.ifPrimaryTerm) {
        throw new VersionConflictError(
          id,
          `required seqNo [${opts.ifSeqNo}], primary term [${opts.ifPrimaryTerm}]. current document has seqNo [${current?.seqNo}] and primary term [${current?.primaryTerm}]`,
        );
      }
    }
    // Parse/validate against the mapping BEFORE taking a sequence number, as the primary does:
    // a malformed document is rejected (400) and never reaches the buffer or translog.
    this.buildSegment([{ id, seqNo: -1, source }]);
    const seqNo = this.nextSeqNo++;
    if (exists) this.deleteFromIndex(id);
    this.buffer.push({ id, seqNo, source: structuredClone(source) });
    this.versions.set(id, {
      seqNo,
      primaryTerm: this.primaryTerm,
      source: structuredClone(source),
    });
    this.translog.push({
      op: 'index',
      id,
      seqNo,
      primaryTerm: this.primaryTerm,
      source: structuredClone(source),
    });
    if (this.durability === 'request') this.syncTranslog();
    return {
      _id: id,
      _seq_no: seqNo,
      _primary_term: this.primaryTerm,
      result: exists ? 'updated' : 'created',
    };
  }

  delete(id: string): IndexResult {
    const current = this.versions.get(id);
    const seqNo = this.nextSeqNo++;
    this.translog.push({ op: 'delete', id, seqNo, primaryTerm: this.primaryTerm });
    if (this.durability === 'request') this.syncTranslog();
    if (!current || current.source === null) {
      return { _id: id, _seq_no: seqNo, _primary_term: this.primaryTerm, result: 'not_found' };
    }
    this.deleteFromIndex(id);
    this.versions.set(id, { seqNo, primaryTerm: this.primaryTerm, source: null });
    return { _id: id, _seq_no: seqNo, _primary_term: this.primaryTerm, result: 'deleted' };
  }

  /** Deletes mark the doc in the live-docs bitset of whichever segment holds it. */
  private deleteFromIndex(id: string): void {
    this.buffer = this.buffer.filter((b) => b.id !== id);
    // Only the live (searchable) segments: the last commit point is immutable; a crash
    // re-applies this delete from the translog.
    for (const seg of this.searchable) {
      const d = seg.ids.indexOf(id);
      if (d !== -1 && seg.live[d]) seg.live[d] = false;
    }
  }

  /** Realtime GET: served from the version map / translog, not from a searcher. */
  get(id: string): { found: boolean; _source?: Record<string, unknown>; _seq_no?: number } {
    const v = this.versions.get(id);
    if (!v || v.source === null) return { found: false };
    return { found: true, _source: structuredClone(v.source), _seq_no: v.seqNo };
  }

  /** Refresh: write the buffer as a new segment and open a new reader. Does NOT fsync. */
  refresh(): void {
    if (this.buffer.length > 0) {
      this.searchable = [...this.searchable, this.buildSegment(this.buffer)];
      this.buffer = [];
    }
    this.refreshCount++;
  }

  /** Flush = refresh + Lucene commit (fsync segments) + start a new translog generation. */
  flush(): void {
    this.refresh();
    this.committed = this.searchable.map((s) => s.snapshot());
    this.translog = [];
    this.syncedOps = 0;
  }

  /** fsync the translog (what `request` durability does before every ack). */
  syncTranslog(): void {
    this.syncedOps = this.translog.length;
  }

  /** Point-in-time reader over the currently searchable segments. */
  reader(): Reader {
    return { segments: this.searchable.map((s) => s.snapshot()) };
  }

  get segments(): readonly Segment[] {
    return this.searchable;
  }

  get bufferedDocs(): number {
    return this.buffer.length;
  }

  /**
   * Simulate a crash: in-memory buffer and un-committed segments are lost. Recovery opens
   * the last commit and replays the translog (ops above the commit's local checkpoint).
   */
  crashAndRecover(): Shard {
    const recovered = new Shard({
      mapping: this.mapping,
      analyzers: this.analyzers,
      primaryTerm: this.primaryTerm,
      durability: this.durability,
    });
    recovered.searchable = this.committed.map((s) => s.snapshot());
    recovered.committed = this.committed.map((s) => s.snapshot());
    for (const seg of recovered.searchable) {
      seg.ids.forEach((id, d) => {
        if (seg.live[d])
          recovered.versions.set(id, {
            seqNo: seg.seqNos[d]!,
            primaryTerm: this.primaryTerm,
            source: seg.stored[d]!,
          });
      });
      recovered.nextSeqNo = Math.max(recovered.nextSeqNo, ...seg.seqNos.map((n) => n + 1));
    }
    // Only the fsynced prefix of the translog survives the crash.
    const replay = this.translog.slice(0, this.syncedOps);
    for (const op of replay) {
      recovered.nextSeqNo = op.seqNo; // replay with the original sequence number
      if (op.op === 'index') recovered.index(op.id, op.source!);
      else recovered.delete(op.id);
    }
    recovered.refresh();
    return recovered;
  }

  /**
   * Merge: rewrite the given segments into one, physically dropping deleted docs.
   * Returns the new segment. Open readers keep the old segments alive (they hold snapshots).
   */
  merge(toMerge: Segment[]): Segment {
    const docs: Buffered[] = [];
    for (const seg of toMerge) {
      seg.ids.forEach((id, d) => {
        if (seg.live[d]) docs.push({ id, seqNo: seg.seqNos[d]!, source: seg.stored[d]! });
      });
    }
    const merged = this.buildSegment(docs);
    const set = new Set(toMerge);
    const firstIdx = this.searchable.findIndex((s) => set.has(s));
    const rest = this.searchable.filter((s) => !set.has(s));
    rest.splice(Math.max(0, firstIdx), 0, merged);
    this.searchable = rest;
    return merged;
  }

  /** `_forcemerge?max_num_segments=n` (n = 1 also expunges all deletes). */
  forceMerge(maxNumSegments = 1): void {
    this.refresh();
    while (this.searchable.length > maxNumSegments) {
      // merge the smallest segments first (as TieredMergePolicy prefers)
      const bySize = [...this.searchable].sort((a, b) => a.numDocs - b.numDocs);
      const count = Math.min(this.searchable.length - maxNumSegments + 1, 10);
      this.merge(bySize.slice(0, count));
    }
    if (
      maxNumSegments === 1 &&
      this.searchable.length === 1 &&
      this.searchable[0]!.deletedDocs > 0
    ) {
      this.merge([this.searchable[0]!]);
    }
  }

  /**
   * A simplified TieredMergePolicy: when more than `segmentsPerTier` segments exist,
   * merge the `mergeFactor` smallest ones. Segments whose deleted ratio exceeds
   * `deletesPctAllowed` are also candidates (ES default index.merge.policy.deletes_pct_allowed = 20).
   */
  maybeMerge(segmentsPerTier = 10, mergeFactor = 10, deletesPctAllowed = 20): Segment | null {
    const heavy = this.searchable.find(
      (s) => s.maxDoc > 0 && (s.deletedDocs / s.maxDoc) * 100 > deletesPctAllowed,
    );
    if (heavy) return this.merge([heavy]);
    if (this.searchable.length <= segmentsPerTier) return null;
    const bySize = [...this.searchable].sort((a, b) => a.numDocs - b.numDocs);
    return this.merge(bySize.slice(0, mergeFactor));
  }

  analyzerFor(field: LeafMapping, search = false): Analyzer {
    if (field.type !== 'text') return keywordAnalyzer;
    const name = (search ? field.search_analyzer : undefined) ?? field.analyzer ?? 'standard';
    const a = this.analyzers[name];
    if (!a)
      throw new Error(
        `illegal_argument_exception: analyzer [${name}] has not been configured in mappings`,
      );
    return a;
  }

  private buildSegment(docs: Buffered[]): Segment {
    const fields = new Map<string, FieldIndex>();
    const docValues = new Map<string, DocValue[][]>();
    const stored: Record<string, unknown>[] = [];
    const ids: string[] = [];
    const seqNos: number[] = [];
    const leafPaths = collectLeaves(this.mapping.properties, '');
    docs.forEach((bd, doc) => {
      ids.push(bd.id);
      seqNos.push(bd.seqNo);
      stored.push(bd.source);
      const root = flatten(this.mapping, bd.source).at(-1)!; // root doc only in this model
      // _id is indexed as a keyword term so that GET/update/delete can find it.
      addTerms(fields, '_id', doc, [{ term: bd.id, position: 0 }], false);
      for (const [path, leaf] of leafPaths) {
        const values = root.fields.get(path.split('#')[0]!);
        if (!values || values.length === 0) continue;
        this.indexLeaf(fields, docValues, path.replace('#', '.'), leaf, values, doc);
      }
    });
    // pad doc values so every doc has an entry
    for (const col of docValues.values()) for (let d = 0; d < docs.length; d++) col[d] ??= [];
    return new Segment({ fields, docValues, stored, ids, seqNos });
  }

  private indexLeaf(
    fields: Map<string, FieldIndex>,
    docValues: Map<string, DocValue[][]>,
    path: string,
    leaf: LeafMapping,
    values: unknown[],
    doc: number,
  ): void {
    const indexed = leaf.index ?? true;
    const hasDocValues = leaf.type === 'text' ? false : (leaf.doc_values ?? true);
    if (leaf.type === 'text') {
      if (!indexed) return;
      const analyzer = this.analyzerFor(leaf);
      const toks: { term: string; position: number }[] = [];
      // Multi-valued text: Lucene adds position_increment_gap (default 100) between values.
      let base = 0;
      for (const v of values) {
        const ts = analyze(analyzer, String(v));
        for (const t of ts) toks.push({ term: t.token, position: base + t.position });
        base += (ts.at(-1)?.position ?? -1) + 1 + 100;
      }
      addTerms(fields, path, doc, toks, true);
      return;
    }
    if (leaf.type === 'keyword') {
      const kept = values
        .map(String)
        .filter((s) => leaf.ignore_above === undefined || s.length <= leaf.ignore_above);
      const norm = leaf.normalizer ? this.analyzers[leaf.normalizer] : undefined;
      const normalized = kept.map((s) =>
        norm
          ? analyze(norm, s)
              .map((t) => t.token)
              .join('')
          : s,
      );
      if (indexed)
        addTerms(
          fields,
          path,
          doc,
          normalized.map((term) => ({ term, position: 0 })),
          false,
        );
      if (hasDocValues)
        pushDocValues(docValues, path, doc, [...new Set(normalized)].sort(compareBytes));
      return;
    }
    if (leaf.type === 'date') {
      const ms = values.map((v) => (typeof v === 'number' ? v : Date.parse(String(v))));
      if (ms.some(Number.isNaN))
        throw new Error(
          `document_parsing_exception: failed to parse field [${path}] of type [date]`,
        );
      if (indexed)
        addTerms(
          fields,
          path,
          doc,
          ms.map((n) => ({ term: String(n), position: 0 })),
          false,
        );
      if (hasDocValues)
        pushDocValues(
          docValues,
          path,
          doc,
          ms.sort((a, b) => a - b),
        );
      return;
    }
    if (leaf.type === 'boolean') {
      const bs = values.map((v) => v === true || v === 'true');
      if (indexed)
        addTerms(
          fields,
          path,
          doc,
          bs.map((b) => ({ term: String(b), position: 0 })),
          false,
        );
      if (hasDocValues) pushDocValues(docValues, path, doc, bs);
      return;
    }
    if (
      leaf.type === 'long' ||
      leaf.type === 'integer' ||
      leaf.type === 'double' ||
      leaf.type === 'float'
    ) {
      const ns = values.map((v) => {
        const n = Number(v);
        if (Number.isNaN(n))
          throw new Error(
            `document_parsing_exception: failed to parse field [${path}] of type [${leaf.type}]`,
          );
        return leaf.type === 'long' || leaf.type === 'integer'
          ? Math.trunc(n)
          : leaf.type === 'float'
            ? Math.fround(n)
            : n;
      });
      // Numbers are indexed as BKD points in Lucene; we model exact-match terms + doc values.
      if (indexed)
        addTerms(
          fields,
          path,
          doc,
          ns.map((n) => ({ term: String(n), position: 0 })),
          false,
        );
      if (hasDocValues)
        pushDocValues(
          docValues,
          path,
          doc,
          ns.sort((a, b) => a - b),
        );
    }
  }
}

function collectLeaves(
  props: Record<string, FieldMapping>,
  prefix: string,
): [string, LeafMapping][] {
  const out: [string, LeafMapping][] = [];
  for (const [name, m] of Object.entries(props)) {
    const full = prefix ? `${prefix}.${name}` : name;
    if (isObject(m)) {
      if (m.type === 'object') out.push(...collectLeaves(m.properties, full));
      continue;
    }
    out.push([full, m]);
    // multi-fields read the parent's value: encode as "parent#sub"
    for (const [sub, sm] of Object.entries(m.fields ?? {})) out.push([`${full}#${sub}`, sm]);
  }
  return out;
}

function addTerms(
  fields: Map<string, FieldIndex>,
  field: string,
  doc: number,
  toks: { term: string; position: number }[],
  norms: boolean,
): void {
  if (toks.length === 0) return;
  let fi = fields.get(field);
  if (!fi) {
    fi = { postings: new Map(), norms: new Map(), sumTotalTermFreq: 0, docCount: 0 };
    fields.set(field, fi);
  }
  const perTerm = new Map<string, number[]>();
  for (const t of toks) {
    const p = perTerm.get(t.term) ?? [];
    p.push(t.position);
    perTerm.set(t.term, p);
  }
  for (const [term, positions] of perTerm) {
    const list = fi.postings.get(term) ?? [];
    list.push({ doc, freq: positions.length, positions });
    fi.postings.set(term, list);
  }
  fi.sumTotalTermFreq += toks.length;
  fi.docCount += 1;
  if (norms) fi.norms.set(doc, intToByte4(toks.length));
}

function pushDocValues(
  dv: Map<string, DocValue[][]>,
  field: string,
  doc: number,
  values: DocValue[],
): void {
  const col = dv.get(field) ?? [];
  col[doc] = values;
  dv.set(field, col);
}

export { resolveField };
