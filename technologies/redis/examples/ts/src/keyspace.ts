// Models of Redis keyspace maintenance: active expiry, approximated LRU with an eviction pool,
// the LFU logarithmic counter, eviction-candidate rules, and the SCAN reverse-binary cursor.
// Constants follow expire.c / evict.c (Redis 7.x/8.x) and redis.conf 8.10.3.

export type Rng = () => number;

// ---------------------------------------------------------------------------------------------
// Active expiry (expire.c: activeExpireCycle)
// ---------------------------------------------------------------------------------------------

export const ACTIVE_EXPIRE_CYCLE_KEYS_PER_LOOP = 20;
export const ACTIVE_EXPIRE_CYCLE_ACCEPTABLE_STALE = 10; // percent

export interface VolatileKey {
  name: string;
  expiresAt: number;
}

/**
 * One slow active-expiry pass over a set of keys with a TTL. Repeats sampling while more than
 * the acceptable stale percentage of a sample was expired, up to `maxLoops` (stands in for the
 * CPU time budget). Returns the keys still present.
 */
export function activeExpireCycle(
  keys: VolatileKey[],
  now: number,
  rng: Rng,
  effort = 1,
  maxLoops = 10_000,
): { remaining: VolatileKey[]; loops: number; expired: number } {
  const perLoop =
    ACTIVE_EXPIRE_CYCLE_KEYS_PER_LOOP + (ACTIVE_EXPIRE_CYCLE_KEYS_PER_LOOP / 4) * (effort - 1);
  const acceptable = ACTIVE_EXPIRE_CYCLE_ACCEPTABLE_STALE - (effort - 1);
  const live = [...keys];
  let loops = 0;
  let expired = 0;
  for (;;) {
    if (live.length === 0 || loops >= maxLoops) break;
    loops++;
    let sampled = 0;
    let expiredNow = 0;
    for (let i = 0; i < perLoop && live.length > 0; i++) {
      const idx = Math.floor(rng() * live.length);
      sampled++;
      if (live[idx]!.expiresAt <= now) {
        live[idx] = live[live.length - 1]!;
        live.pop();
        expiredNow++;
      }
    }
    expired += expiredNow;
    if (sampled === 0 || (expiredNow * 100) / sampled <= acceptable) break;
  }
  return { remaining: live, loops, expired };
}

/** Lazy expiry: every key access first checks the TTL and deletes an expired key. */
export class LazyExpireStore {
  private readonly data = new Map<string, { v: string; exp?: number }>();
  set(k: string, v: string, ttlMs?: number, now = 0): void {
    this.data.set(k, ttlMs === undefined ? { v } : { v, exp: now + ttlMs });
  }
  get(k: string, now: number): string | null {
    const e = this.data.get(k);
    if (!e) return null;
    if (e.exp !== undefined && e.exp <= now) {
      this.data.delete(k);
      return null;
    }
    return e.v;
  }
  /** DBSIZE counts keys that are logically expired but not yet reclaimed. */
  dbsize(): number {
    return this.data.size;
  }
}

// ---------------------------------------------------------------------------------------------
// Approximated LRU with an eviction pool (evict.c)
// ---------------------------------------------------------------------------------------------

export const EVPOOL_SIZE = 16;

/**
 * Picks the key to evict: sample `samples` keys, merge them into a pool of the best
 * (most idle) candidates kept across calls, evict the most idle key of the pool.
 */
export class ApproxLru {
  private readonly pool: { key: string; idle: number }[] = [];
  private readonly samples: number;
  private readonly rng: Rng;
  constructor(samples: number, rng: Rng) {
    this.samples = samples;
    this.rng = rng;
  }
  pickVictim(lastAccess: Map<string, number>, now: number): string | undefined {
    const keys = [...lastAccess.keys()];
    if (keys.length === 0) return undefined;
    for (let i = 0; i < this.samples; i++) {
      const key = keys[Math.floor(this.rng() * keys.length)]!;
      const idle = now - lastAccess.get(key)!;
      if (this.pool.some((p) => p.key === key)) continue;
      this.pool.push({ key, idle });
    }
    this.pool.sort((a, b) => a.idle - b.idle); // ascending; best victim at the end
    while (this.pool.length > EVPOOL_SIZE) this.pool.shift();
    while (this.pool.length > 0) {
      const cand = this.pool.pop()!;
      if (lastAccess.has(cand.key)) return cand.key; // pool entries can be stale (key deleted)
    }
    return undefined;
  }
}

// ---------------------------------------------------------------------------------------------
// LFU: Morris-style logarithmic counter in 8 bits, with time decay (evict.c)
// ---------------------------------------------------------------------------------------------

export const LFU_INIT_VAL = 5;

export function lfuLogIncr(counter: number, logFactor: number, rng: Rng): number {
  if (counter === 255) return 255;
  const r = rng();
  const baseval = Math.max(0, counter - LFU_INIT_VAL);
  const p = 1 / (baseval * logFactor + 1);
  return r < p ? counter + 1 : counter;
}

/** Decrement by one per `decayMinutes` elapsed since the last access (lfu-decay-time). */
export function lfuDecay(
  counter: number,
  minutesSinceAccess: number,
  decayMinutes: number,
): number {
  if (decayMinutes === 0) return counter;
  const periods = Math.floor(minutesSinceAccess / decayMinutes);
  return Math.max(0, counter - periods);
}

export function lfuCounterAfterHits(hits: number, logFactor: number, rng: Rng): number {
  let c = LFU_INIT_VAL;
  for (let i = 0; i < hits; i++) {
    c = lfuLogIncr(c, logFactor, rng);
    if (c === 255) break;
  }
  return c;
}

// ---------------------------------------------------------------------------------------------
// Which keys can be evicted under each maxmemory-policy
// ---------------------------------------------------------------------------------------------

export type Policy =
  | 'noeviction'
  | 'allkeys-lru'
  | 'volatile-lru'
  | 'allkeys-lfu'
  | 'volatile-lfu'
  | 'allkeys-lrm'
  | 'volatile-lrm'
  | 'allkeys-random'
  | 'volatile-random'
  | 'volatile-ttl';

export interface KeyMeta {
  name: string;
  hasTtl: boolean;
}

export function evictionCandidates(policy: Policy, keys: KeyMeta[]): KeyMeta[] {
  if (policy === 'noeviction') return [];
  if (policy.startsWith('allkeys-')) return keys;
  return keys.filter((k) => k.hasTtl);
}

/** What a write that needs memory gets when the server is over maxmemory. */
export function writeOutcome(policy: Policy, keys: KeyMeta[]): 'evict' | 'OOM' {
  return evictionCandidates(policy, keys).length > 0 ? 'evict' : 'OOM';
}

// ---------------------------------------------------------------------------------------------
// SCAN: reverse-binary cursor over a power-of-two hash table (dict.c: dictScan)
// ---------------------------------------------------------------------------------------------

export function rev(v: number, bits: number): number {
  let r = 0;
  for (let i = 0; i < bits; i++) {
    r = (r << 1) | ((v >>> i) & 1);
  }
  return r >>> 0;
}

/**
 * Next cursor: set the bits above the mask, reverse, add one, reverse back.
 * Cursors are reported with 32 significant bits here (Redis uses unsigned long).
 */
export function nextCursor(cursor: number, mask: number): number {
  const BITS = 32;
  let v = (cursor | ~mask) >>> 0;
  v = rev(v, BITS);
  v = (v + 1) >>> 0;
  return rev(v, BITS);
}

export class ScanTable {
  buckets: string[][];
  constructor(size: number, keys: string[] = []) {
    this.buckets = Array.from({ length: size }, () => []);
    for (const k of keys) this.insert(k);
  }
  get mask(): number {
    return this.buckets.length - 1;
  }
  static hash(k: string): number {
    // FNV-1a: deterministic, good enough to spread test keys.
    let h = 0x811c9dc5;
    for (let i = 0; i < k.length; i++) {
      h ^= k.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }
  insert(k: string): void {
    this.buckets[ScanTable.hash(k) & this.mask]!.push(k);
  }
  remove(k: string): void {
    const b = this.buckets[ScanTable.hash(k) & this.mask]!;
    const i = b.indexOf(k);
    if (i >= 0) b.splice(i, 1);
  }
  keys(): string[] {
    return this.buckets.flat();
  }
  /** Rebuild at a new power-of-two size (atomic here; Redis does it incrementally). */
  resize(size: number): void {
    const all = this.keys();
    this.buckets = Array.from({ length: size }, () => []);
    for (const k of all) this.insert(k);
  }
  /** One SCAN call visiting one bucket; returns its keys and the next cursor (0 = done). */
  scan(cursor: number): { keys: string[]; cursor: number } {
    const keys = [...this.buckets[cursor & this.mask]!];
    return { keys, cursor: nextCursor(cursor, this.mask) };
  }
}

// ---- Constants and formulas read from src/expire.c, src/lazyfree.c and src/evict.c (8.0 branch) ----

export interface ActiveExpireParams {
  keysPerLoop: number;
  acceptableStalePercent: number;
  slowCpuPercent: number;
  fastDurationMicros: number;
}

/** `activeExpireCycle` rescales its constants from the configured effort (1..10, default 1). */
export function activeExpireParams(configuredEffort: number): ActiveExpireParams {
  if (!Number.isInteger(configuredEffort) || configuredEffort < 1 || configuredEffort > 10) {
    throw new RangeError('active-expire-effort must be an integer in 1..10');
  }
  const effort = configuredEffort - 1; // "Rescale from 0 to 9."
  return {
    keysPerLoop: 20 + Math.trunc(20 / 4) * effort,
    acceptableStalePercent: 10 - effort,
    slowCpuPercent: 25 + 2 * effort,
    fastDurationMicros: 1000 + Math.trunc(1000 / 4) * effort,
  };
}

/** Per-tick time budget of the slow cycle in microseconds: `cpu% * 1_000_000 / hz / 100`. */
export function slowCycleBudgetMicros(effort: number, hz: number): number {
  return Math.max(
    1,
    Math.trunc((activeExpireParams(effort).slowCpuPercent * 1_000_000) / hz / 100),
  );
}

/**
 * Expected number of hits for the LFU counter to climb from `LFU_INIT_VAL` to `target`:
 * each step c -> c+1 is geometric with success probability 1 / ((c - 5) * factor + 1), mean (c - 5) * factor + 1.
 */
export function expectedHitsToReach(target: number, logFactor: number): number {
  let hits = 0;
  for (let c = LFU_INIT_VAL; c < Math.min(target, 255); c++)
    hits += (c - LFU_INIT_VAL) * logFactor + 1;
  return hits;
}

export const LAZYFREE_THRESHOLD = 64;

export type FreeShape =
  | { type: 'list'; encoding: 'quicklist'; nodes: number }
  | { type: 'set' | 'hash'; encoding: 'hashtable'; entries: number }
  | { type: 'zset'; encoding: 'skiplist'; length: number }
  | { type: 'stream'; radixNodes: number; groups: number; firstGroupPel: number }
  | { type: 'other' }; // strings, listpack, intset, ...: one allocation

/** `lazyfreeGetFreeEffort`: the number of allocations a delete would free. */
export function lazyFreeEffort(s: FreeShape): number {
  switch (s.type) {
    case 'list':
      return s.nodes;
    case 'set':
    case 'hash':
      return s.entries;
    case 'zset':
      return s.length;
    case 'stream':
      return s.radixNodes + (s.groups > 0 ? s.groups * (1 + s.firstGroupPel) : 0);
    default:
      return 1;
  }
}

/** `UNLINK` frees in the background thread only above the threshold and when nobody else holds the object. */
export function freedInBackground(effort: number, refcount = 1): boolean {
  return effort > LAZYFREE_THRESHOLD && refcount === 1;
}

export interface KeysizesLine {
  db: number;
  kind: string; // strings_sizes | lists_items | sets_items | zsets_items | hashes_items (+ *_sizes with memory histograms)
  bins: Record<string, number>;
}

/** Parse the `# Keysizes` section of INFO (8.0+): `db0_distrib_strings_sizes:1=3,8=2,1K=1`. */
export function parseKeysizes(info: string): KeysizesLine[] {
  const out: KeysizesLine[] = [];
  for (const line of info.split(/\r?\n/)) {
    const m = /^db(\d+)_distrib_(\w+):(.*)$/.exec(line);
    if (!m) continue;
    const bins: Record<string, number> = {};
    for (const part of m[3]!.split(',')) {
      const [label, count] = part.split('=');
      if (label === undefined || count === undefined || !/^\d+$/.test(count)) {
        throw new Error(`malformed keysizes bin: ${part}`);
      }
      bins[label] = Number(count);
    }
    out.push({ db: Number(m[1]), kind: m[2]!, bins });
  }
  return out;
}

/** Visit order of a SCAN over a table of 2^bits buckets with no resize. */
export function scanOrder(bits: number): number[] {
  const mask = (1 << bits) - 1;
  const seen: number[] = [];
  let c = 0;
  do {
    seen.push(c);
    c = nextCursor(c, mask);
  } while (c !== 0);
  return seen;
}

/** `evictionTimeLimitUs`: how long one `performEvictions` call may spend, from `maxmemory-eviction-tenacity` (0..100). */
export function evictionTimeLimitMicros(tenacity: number): number {
  if (!Number.isInteger(tenacity) || tenacity < 0 || tenacity > 100) {
    throw new RangeError('maxmemory-eviction-tenacity must be an integer in 0..100');
  }
  if (tenacity <= 10) return 50 * tenacity; // linear 0..500 us
  if (tenacity < 100) return Math.trunc(500 * 1.15 ** (tenacity - 10)); // 15 % geometric growth
  return Number.POSITIVE_INFINITY; // no limit
}
