// Predicts what `OBJECT ENCODING` reports, from the documented thresholds of Redis 7.2+ / 8.x.
// Defaults are those of redis.conf in 8.10.3 (verified 2026-11-04).
// Conversions are one-way while the key lives: shrinking a hashtable-encoded hash back below the
// threshold does NOT convert it back to a listpack (only an RDB reload re-encodes it).

export interface EncodingConfig {
  hashMaxListpackEntries: number;
  hashMaxListpackValue: number;
  setMaxIntsetEntries: number;
  setMaxListpackEntries: number;
  setMaxListpackValue: number;
  zsetMaxListpackEntries: number;
  zsetMaxListpackValue: number;
}

export const DEFAULTS: EncodingConfig = {
  hashMaxListpackEntries: 512,
  hashMaxListpackValue: 64,
  setMaxIntsetEntries: 512,
  setMaxListpackEntries: 128,
  setMaxListpackValue: 64,
  zsetMaxListpackEntries: 128,
  zsetMaxListpackValue: 64,
};

const INT64_MIN = -(2n ** 63n);
const INT64_MAX = 2n ** 63n - 1n;

/**
 * Redis' string2ll(): only the canonical decimal form of a signed 64-bit integer counts.
 * "007", "+1", " 1", "1.0" and "-0" are strings, not integers.
 */
export function isCanonicalInt64(s: string): boolean {
  if (s.length === 0 || s.length > 20) return false;
  if (!/^(0|-?[1-9]\d*)$/.test(s)) return false;
  const v = BigInt(s);
  return v >= INT64_MIN && v <= INT64_MAX;
}

/** OBJECT ENCODING of a string value set with SET. */
export const OBJ_ENCODING_EMBSTR_SIZE_LIMIT = 44;
export function stringEncoding(value: string): 'int' | 'embstr' | 'raw' {
  if (isCanonicalInt64(value)) return 'int';
  return Buffer.byteLength(value) <= OBJ_ENCODING_EMBSTR_SIZE_LIMIT ? 'embstr' : 'raw';
}

const bytes = (s: string) => Buffer.byteLength(s);

/** Tracks a hash's encoding through a sequence of HSET/HDEL calls. */
export class HashModel {
  encoding: 'listpack' | 'hashtable' = 'listpack';
  private readonly fields = new Map<string, string>();
  private readonly cfg: EncodingConfig;
  constructor(cfg: EncodingConfig = DEFAULTS) {
    this.cfg = cfg;
  }
  hset(field: string, value: string): void {
    this.fields.set(field, value);
    if (
      this.encoding === 'listpack' &&
      (this.fields.size > this.cfg.hashMaxListpackEntries ||
        bytes(field) > this.cfg.hashMaxListpackValue ||
        bytes(value) > this.cfg.hashMaxListpackValue)
    ) {
      this.encoding = 'hashtable';
    }
  }
  hdel(field: string): void {
    this.fields.delete(field); // never converts back
  }
  get size(): number {
    return this.fields.size;
  }
}

/** Tracks a set's encoding: intset -> listpack (7.2+) -> hashtable, never backwards. */
export class SetModel {
  encoding: 'intset' | 'listpack' | 'hashtable' = 'intset';
  private readonly members = new Set<string>();
  private readonly cfg: EncodingConfig;
  constructor(cfg: EncodingConfig = DEFAULTS) {
    this.cfg = cfg;
  }
  sadd(m: string): void {
    const isNew = !this.members.has(m);
    this.members.add(m);
    if (!isNew) return;
    const n = this.members.size;
    if (this.encoding === 'intset') {
      if (isCanonicalInt64(m) && n <= this.cfg.setMaxIntsetEntries) return;
      // Leaving intset: listpack if still small enough, else straight to hashtable.
      const allShort = [...this.members].every((x) => bytes(x) <= this.cfg.setMaxListpackValue);
      this.encoding = n <= this.cfg.setMaxListpackEntries && allShort ? 'listpack' : 'hashtable';
      return;
    }
    if (
      this.encoding === 'listpack' &&
      (n > this.cfg.setMaxListpackEntries || bytes(m) > this.cfg.setMaxListpackValue)
    ) {
      this.encoding = 'hashtable';
    }
  }
  get size(): number {
    return this.members.size;
  }
}

/** Sorted set: listpack -> skiplist, never backwards. */
export class ZSetModel {
  encoding: 'listpack' | 'skiplist' = 'listpack';
  private readonly members = new Map<string, number>();
  private readonly cfg: EncodingConfig;
  constructor(cfg: EncodingConfig = DEFAULTS) {
    this.cfg = cfg;
  }
  zadd(m: string, score: number): void {
    this.members.set(m, score);
    if (
      this.encoding === 'listpack' &&
      (this.members.size > this.cfg.zsetMaxListpackEntries ||
        bytes(m) > this.cfg.zsetMaxListpackValue)
    ) {
      this.encoding = 'skiplist';
    }
  }
  zrem(m: string): void {
    this.members.delete(m);
  }
}

// ---------------------------------------------------------------------------------------------
// Complexity reasoning helpers (module 02 § 4)
// ---------------------------------------------------------------------------------------------

/** Expected skiplist search cost: about (1/p) * log_{1/p}(N) comparisons. */
export function expectedSkiplistSteps(n: number, p = 0.25): number {
  if (n <= 1) return 1;
  return (1 / p) * (Math.log(n) / Math.log(1 / p));
}

/**
 * Listpack lookups are linear scans, so their cost is entries * per-entry cost; the thresholds
 * keep N small enough that the scan stays inside a few cache lines' worth of contiguous memory.
 */
export function listpackScanCost(entries: number): number {
  return entries;
}
