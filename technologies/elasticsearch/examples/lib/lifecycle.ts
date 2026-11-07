/**
 * Teaching models for the ingest and data-lifecycle features:
 *  - ingest pipelines (processors, `if`, `ignore_failure`, `on_failure`, simulate)
 *  - the _bulk NDJSON format and per-item results
 *  - aliases with atomic actions and write indices
 *  - data streams (backing indices, append-only, rollover)
 *  - ILM rollover conditions and phase transitions by min_age
 */

// ---------------------------------------------------------------------------
// Ingest pipelines
// ---------------------------------------------------------------------------

export type Doc = Record<string, unknown>;

export interface Processor {
  type:
    | 'set'
    | 'rename'
    | 'lowercase'
    | 'convert'
    | 'remove'
    | 'dissect'
    | 'date'
    | 'script'
    | 'fail'
    | 'drop';
  field?: string;
  target_field?: string;
  value?: unknown;
  to?: 'integer' | 'long' | 'double' | 'boolean' | 'string';
  pattern?: string;
  formats?: string[];
  message?: string;
  /** Painless-like condition, modelled as a predicate on the doc. */
  if?: (ctx: Doc) => boolean;
  ignore_failure?: boolean;
  ignore_missing?: boolean;
  override?: boolean;
  on_failure?: Processor[];
  /** script processor body, modelled as a JS function mutating ctx. */
  source?: (ctx: Doc) => void;
}

export class IngestError extends Error {}

function getPath(doc: Doc, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Doc)[k] : undefined), doc);
}

function setPath(doc: Doc, path: string, v: unknown): void {
  const parts = path.split('.');
  let o = doc;
  for (const k of parts.slice(0, -1)) {
    if (!o[k] || typeof o[k] !== 'object') o[k] = {};
    o = o[k] as Doc;
  }
  o[parts.at(-1)!] = v;
}

function delPath(doc: Doc, path: string): boolean {
  const parts = path.split('.');
  const parent = parts.length === 1 ? doc : getPath(doc, parts.slice(0, -1).join('.'));
  if (!parent || typeof parent !== 'object' || !(parts.at(-1)! in (parent as Doc))) return false;
  delete (parent as Doc)[parts.at(-1)!];
  return true;
}

function missing(p: Processor): never {
  throw new IngestError(`field [${p.field}] not present as part of path [${p.field}]`);
}

/** Dissect: %{key} placeholders separated by literal delimiters. */
export function dissect(pattern: string, input: string): Record<string, string> {
  const re = new RegExp(
    '^' +
      pattern
        .split(/(%\{[^}]*\})/)
        .map((part) => {
          const m = /^%\{([^}]*)\}$/.exec(part);
          if (!m) return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          return m[1] === '' || m[1]!.startsWith('?')
            ? '(?:.*?)'
            : `(?<${m[1]!.replace(/\W/g, '_')}>.*?)`;
        })
        .join('') +
      '$',
  );
  const m = re.exec(input);
  if (!m)
    throw new IngestError(
      `Unable to find match for dissect pattern: ${pattern} against source: ${input}`,
    );
  return { ...m.groups };
}

function runOne(p: Processor, ctx: Doc): 'drop' | void {
  switch (p.type) {
    case 'set':
      if (p.override === false && getPath(ctx, p.field!) !== undefined) return;
      setPath(ctx, p.field!, structuredClone(p.value));
      return;
    case 'rename': {
      const v = getPath(ctx, p.field!);
      if (v === undefined) {
        if (p.ignore_missing) return;
        missing(p);
      }
      if (getPath(ctx, p.target_field!) !== undefined)
        throw new IngestError(`field [${p.target_field}] already exists`);
      delPath(ctx, p.field!);
      setPath(ctx, p.target_field!, v);
      return;
    }
    case 'lowercase': {
      const v = getPath(ctx, p.field!);
      if (v === undefined) {
        if (p.ignore_missing) return;
        missing(p);
      }
      setPath(ctx, p.target_field ?? p.field!, String(v).toLowerCase());
      return;
    }
    case 'convert': {
      const v = getPath(ctx, p.field!);
      if (v === undefined) {
        if (p.ignore_missing) return;
        missing(p);
      }
      let out: unknown;
      if (p.to === 'integer' || p.to === 'long') {
        if (!/^-?\d+$/.test(String(v)))
          throw new IngestError(`unable to convert [${String(v)}] to ${p.to}`);
        out = Number(v);
      } else if (p.to === 'double') {
        out = Number(v);
        if (Number.isNaN(out)) throw new IngestError(`unable to convert [${String(v)}] to double`);
      } else if (p.to === 'boolean') {
        if (!/^(true|false)$/i.test(String(v)))
          throw new IngestError(`[${String(v)}] is not a boolean value`);
        out = /^true$/i.test(String(v));
      } else out = String(v);
      setPath(ctx, p.target_field ?? p.field!, out);
      return;
    }
    case 'remove':
      if (!delPath(ctx, p.field!) && !p.ignore_missing) missing(p);
      return;
    case 'dissect': {
      const v = getPath(ctx, p.field!);
      if (v === undefined) {
        if (p.ignore_missing) return;
        missing(p);
      }
      for (const [k, val] of Object.entries(dissect(p.pattern!, String(v)))) setPath(ctx, k, val);
      return;
    }
    case 'date': {
      const v = getPath(ctx, p.field!);
      if (v === undefined) missing(p);
      let ms = NaN;
      for (const f of p.formats ?? ['ISO8601']) {
        if (f === 'UNIX') ms = Number(v) * 1000;
        else if (f === 'UNIX_MS') ms = Number(v);
        else if (f === 'ISO8601') ms = Date.parse(String(v));
        if (!Number.isNaN(ms)) break;
      }
      if (Number.isNaN(ms)) throw new IngestError(`unable to parse date [${String(v)}]`);
      setPath(ctx, p.target_field ?? '@timestamp', new Date(ms).toISOString());
      return;
    }
    case 'script':
      p.source!(ctx);
      return;
    case 'fail':
      throw new IngestError(p.message ?? 'fail processor');
    case 'drop':
      return 'drop';
  }
}

export interface PipelineResult {
  doc: Doc | null; // null: dropped
  error?: string;
}

/**
 * Run processors in order. A failing processor: if ignore_failure, continue; else if it
 * has on_failure, run those (with _ingest.on_failure_message set) and continue; else
 * run the pipeline-level on_failure, or reject the document.
 */
export function runPipeline(
  processors: Processor[],
  input: Doc,
  onFailure?: Processor[],
): PipelineResult {
  const ctx = structuredClone(input);
  for (const p of processors) {
    if (p.if && !p.if(ctx)) continue;
    try {
      if (runOne(p, ctx) === 'drop') return { doc: null };
    } catch (e) {
      if (p.ignore_failure) continue;
      const handlers = p.on_failure ?? onFailure;
      if (!handlers) return { doc: null, error: (e as Error).message };
      setPath(ctx, '_ingest.on_failure_message', (e as Error).message);
      for (const h of handlers) runOne(h, ctx);
      delPath(ctx, '_ingest');
      if (!p.on_failure) return { doc: ctx }; // pipeline-level handler ends the pipeline
    }
  }
  return { doc: ctx };
}

// ---------------------------------------------------------------------------
// _bulk
// ---------------------------------------------------------------------------

export type BulkAction =
  | { index: { _index: string; _id?: string } }
  | { create: { _index: string; _id?: string } }
  | { delete: { _index: string; _id: string } }
  | { update: { _index: string; _id: string } };

/** Serialise to NDJSON: one action line, then (except delete) one source line; trailing newline required. */
export function toNdjson(items: { action: BulkAction; source?: Doc }[]): string {
  return items
    .map(
      ({ action, source }) =>
        JSON.stringify(action) + '\n' + (source !== undefined ? JSON.stringify(source) + '\n' : ''),
    )
    .join('');
}

export function parseNdjson(body: string): { action: BulkAction; source?: Doc }[] {
  if (!body.endsWith('\n'))
    throw new Error(
      'illegal_argument_exception: The bulk request must be terminated by a newline [\\n]',
    );
  const lines = body.split('\n').slice(0, -1);
  const out: { action: BulkAction; source?: Doc }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const action = JSON.parse(lines[i]!) as BulkAction;
    if ('delete' in action) out.push({ action });
    else out.push({ action, source: JSON.parse(lines[++i]!) as Doc });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Aliases
// ---------------------------------------------------------------------------

export type AliasAction =
  | {
      add: { index: string; alias: string; is_write_index?: boolean; filter?: (d: Doc) => boolean };
    }
  | { remove: { index: string; alias: string } }
  | { remove_index: { index: string } };

export interface AliasEntry {
  index: string;
  is_write_index?: boolean;
  filter?: (d: Doc) => boolean;
}

export class AliasRegistry {
  indices = new Set<string>();
  aliases = new Map<string, AliasEntry[]>();

  /** _aliases applies all actions atomically: either all succeed or none is visible. */
  update(actions: AliasAction[]): void {
    const indices = new Set(this.indices);
    const aliases = new Map([...this.aliases].map(([k, v]) => [k, v.map((e) => ({ ...e }))]));
    for (const a of actions) {
      if ('add' in a) {
        if (!indices.has(a.add.index))
          throw new Error(`index_not_found_exception: no such index [${a.add.index}]`);
        const list = (aliases.get(a.add.alias) ?? []).filter((e) => e.index !== a.add.index);
        list.push({
          index: a.add.index,
          ...(a.add.is_write_index !== undefined ? { is_write_index: a.add.is_write_index } : {}),
          ...(a.add.filter ? { filter: a.add.filter } : {}),
        });
        aliases.set(a.add.alias, list);
      } else if ('remove' in a) {
        const list = aliases.get(a.remove.alias) ?? [];
        if (!list.some((e) => e.index === a.remove.index))
          throw new Error(`aliases_not_found_exception: aliases [${a.remove.alias}] missing`);
        aliases.set(
          a.remove.alias,
          list.filter((e) => e.index !== a.remove.index),
        );
      } else {
        indices.delete(a.remove_index.index);
        for (const [k, v] of aliases)
          aliases.set(
            k,
            v.filter((e) => e.index !== a.remove_index.index),
          );
      }
    }
    for (const [k, v] of aliases) {
      if (v.filter((e) => e.is_write_index).length > 1)
        throw new Error(`illegal_state_exception: alias [${k}] has more than one write index`);
      if (v.length === 0) aliases.delete(k);
    }
    this.indices = indices;
    this.aliases = aliases;
  }

  resolveRead(name: string): string[] {
    if (this.indices.has(name)) return [name];
    return (this.aliases.get(name) ?? []).map((e) => e.index);
  }

  /** Writes through an alias need exactly one target: a single index, or the is_write_index. */
  resolveWrite(name: string): string {
    if (this.indices.has(name)) return name;
    const list = this.aliases.get(name) ?? [];
    const w = list.find((e) => e.is_write_index);
    if (w) return w.index;
    if (list.length === 1 && list[0]!.is_write_index !== false) return list[0]!.index;
    throw new Error(
      `illegal_argument_exception: no write index is defined for alias [${name}]. The write index may be explicitly disabled using is_write_index=false or the alias points to multiple indices without one being designated as a write index`,
    );
  }
}

// ---------------------------------------------------------------------------
// Data streams
// ---------------------------------------------------------------------------

export function backingIndexName(stream: string, generation: number, date: Date): string {
  const d = date.toISOString().slice(0, 10).replace(/-/g, '.');
  return `.ds-${stream}-${d}-${String(generation).padStart(6, '0')}`;
}

export class DataStream {
  readonly name: string;
  generation = 1;
  backing: { name: string; docs: Map<string, Doc>; createdAt: number; rolledOverAt?: number }[] =
    [];
  private nextId = 0;

  constructor(name: string, now: number) {
    this.name = name;
    this.backing.push({
      name: backingIndexName(name, 1, new Date(now)),
      docs: new Map(),
      createdAt: now,
    });
  }

  get writeIndex() {
    return this.backing.at(-1)!;
  }

  /** Data streams are append-only: op_type must be create, and @timestamp is required. */
  index(doc: Doc, opType: 'create' | 'index' = 'create', id?: string): string {
    if (opType !== 'create')
      throw new Error(
        'illegal_argument_exception: only write ops with an op_type of create are allowed in data streams',
      );
    if (doc['@timestamp'] === undefined)
      throw new Error(
        'document_parsing_exception: data stream timestamp field [@timestamp] is missing',
      );
    const _id = id ?? `auto-${this.nextId++}`;
    if (this.backing.some((b) => b.docs.has(_id)))
      throw new Error('version_conflict_engine_exception: document already exists');
    this.writeIndex.docs.set(_id, doc);
    return _id;
  }

  rollover(now: number): string {
    this.writeIndex.rolledOverAt = now;
    this.generation++;
    const name = backingIndexName(this.name, this.generation, new Date(now));
    this.backing.push({ name, docs: new Map(), createdAt: now });
    return name;
  }

  search(pred: (d: Doc) => boolean = () => true): Doc[] {
    return this.backing.flatMap((b) => [...b.docs.values()].filter(pred));
  }
}

// ---------------------------------------------------------------------------
// ILM
// ---------------------------------------------------------------------------

export interface RolloverConditions {
  max_age_ms?: number;
  max_docs?: number;
  max_primary_shard_size_bytes?: number;
  max_primary_shard_docs?: number;
  min_docs?: number;
}

export interface IndexStats {
  ageMs: number;
  docs: number;
  maxPrimaryShardBytes: number;
  maxPrimaryShardDocs: number;
}

/** Rollover happens if ANY max_* condition is met AND ALL min_* conditions are met. Empty indices never roll over. */
export function shouldRollover(c: RolloverConditions, s: IndexStats): boolean {
  if (s.docs === 0) return false;
  const anyMax =
    (c.max_age_ms !== undefined && s.ageMs >= c.max_age_ms) ||
    (c.max_docs !== undefined && s.docs >= c.max_docs) ||
    (c.max_primary_shard_size_bytes !== undefined &&
      s.maxPrimaryShardBytes >= c.max_primary_shard_size_bytes) ||
    (c.max_primary_shard_docs !== undefined && s.maxPrimaryShardDocs >= c.max_primary_shard_docs);
  const allMin = c.min_docs === undefined || s.docs >= c.min_docs;
  return anyMax && allMin;
}

export type Phase = 'hot' | 'warm' | 'cold' | 'frozen' | 'delete';
export const PHASE_ORDER: Phase[] = ['hot', 'warm', 'cold', 'frozen', 'delete'];

export interface IlmPolicy {
  phases: Partial<Record<Phase, { min_age_ms: number }>>;
}

/**
 * The phase an index should be in. min_age is measured from rollover if the index was
 * rolled over (index.lifecycle.origination_date otherwise from creation).
 */
export function currentPhase(
  policy: IlmPolicy,
  idx: { createdAt: number; rolledOverAt?: number },
  now: number,
  usesRollover: boolean,
): Phase {
  // An index managed by a rollover policy cannot leave hot until it has rolled over.
  if (usesRollover && idx.rolledOverAt === undefined) return 'hot';
  const origin = idx.rolledOverAt ?? idx.createdAt;
  const age = now - origin;
  let phase: Phase = 'hot';
  for (const p of PHASE_ORDER) {
    const def = policy.phases[p];
    if (def && age >= def.min_age_ms) phase = p;
  }
  return phase;
}

/** min_age values must not decrease along the phase order. */
export function validatePolicy(policy: IlmPolicy): void {
  let last = -1;
  for (const p of PHASE_ORDER) {
    const def = policy.phases[p];
    if (!def) continue;
    if (def.min_age_ms < last)
      throw new Error(
        `illegal_argument_exception: phase [${p}] min_age is lower than a previous phase`,
      );
    last = def.min_age_ms;
  }
}
