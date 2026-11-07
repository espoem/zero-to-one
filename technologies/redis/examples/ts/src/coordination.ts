// Coordination patterns on Redis: rate limiters, INCREX semantics, Redlock arithmetic,
// lock-safety timelines with and without fencing, idempotency keys.

// ---------------------------------------------------------------------------------------------
// Rate limiters (pure models; the Redis command sequence is noted on each)
// ---------------------------------------------------------------------------------------------

/** Fixed window: INCR rl:<id>:<floor(now/window)>, EXPIRE on first hit. */
export class FixedWindow {
  private readonly counts = new Map<number, number>();
  private readonly limit: number;
  private readonly window: number;
  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.window = windowMs;
  }
  allow(now: number): boolean {
    const w = Math.floor(now / this.window);
    const n = (this.counts.get(w) ?? 0) + 1;
    if (n > this.limit) return false;
    this.counts.set(w, n);
    return true;
  }
}

/** Sliding log: ZREMRANGEBYSCORE key -inf now-window; ZCARD; ZADD now uid. Exact, O(limit) memory. */
export class SlidingLog {
  private log: number[] = [];
  private readonly limit: number;
  private readonly window: number;
  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.window = windowMs;
  }
  allow(now: number): boolean {
    this.log = this.log.filter((t) => t > now - this.window);
    if (this.log.length >= this.limit) return false;
    this.log.push(now);
    return true;
  }
}

/**
 * GCRA (generic cell rate algorithm): one key storing the theoretical arrival time (TAT).
 * Equivalent to a token bucket, stored as a single number.
 */
export class Gcra {
  private tat = 0;
  private readonly interval: number; // ms between requests at the sustained rate
  private readonly tolerance: number; // burst allowance in ms
  constructor(ratePerSec: number, burst: number) {
    this.interval = 1000 / ratePerSec;
    this.tolerance = this.interval * (burst - 1);
  }
  allow(now: number): boolean {
    const tat = Math.max(this.tat, now);
    if (tat - now > this.tolerance) return false;
    this.tat = tat + this.interval;
    return true;
  }
}

// ---------------------------------------------------------------------------------------------
// INCREX (Redis 8.8) semantics, from the command reference
// ---------------------------------------------------------------------------------------------

export interface IncrexOpts {
  by?: number;
  lbound?: number;
  ubound?: number;
  saturate?: boolean;
  exMs?: number;
  enx?: boolean;
  persist?: boolean;
}

export interface Counter {
  value: number;
  expiresAt?: number;
}

/** Returns [newValue, appliedIncrement]; mutates `store`. Integer mode only. */
export function increx(
  store: Map<string, Counter>,
  key: string,
  now: number,
  o: IncrexOpts = {},
): [number, number] {
  if (o.enx && o.exMs === undefined) throw new Error('ERR ENX requires an expiration option');
  if (o.enx && o.persist) throw new Error('ERR ENX is incompatible with PERSIST');
  let cur = store.get(key);
  if (cur && cur.expiresAt !== undefined && cur.expiresAt <= now) {
    store.delete(key);
    cur = undefined;
  }
  const value = cur?.value ?? 0;
  const by = o.by ?? 1;
  const lo = o.lbound ?? Number.MIN_SAFE_INTEGER;
  const hi = o.ubound ?? Number.MAX_SAFE_INTEGER;
  if (lo > hi) throw new Error('ERR LBOUND must be <= UBOUND');
  let next = value + by;
  if (next > hi || next < lo) {
    if (!o.saturate) return [value, 0]; // skipped: key and TTL untouched
    next = Math.min(hi, Math.max(lo, next));
  }
  let expiresAt = cur?.expiresAt;
  if (o.persist) expiresAt = undefined;
  else if (o.exMs !== undefined && !(o.enx && expiresAt !== undefined)) expiresAt = now + o.exMs;
  store.set(key, { value: next, expiresAt });
  return [next, next - value];
}

// ---------------------------------------------------------------------------------------------
// Redlock arithmetic (redis.io "Distributed Locks with Redis")
// ---------------------------------------------------------------------------------------------

export const quorum = (n: number): number => Math.floor(n / 2) + 1;

/** Remaining validity after acquisition: TTL - elapsed - drift, drift = TTL * factor + 2 ms. */
export function redlockValidity(ttlMs: number, elapsedMs: number, driftFactor = 0.01): number {
  const drift = Math.round(ttlMs * driftFactor) + 2;
  return ttlMs - elapsedMs - drift;
}

export function redlockAcquired(
  n: number,
  successes: number,
  ttlMs: number,
  elapsedMs: number,
): boolean {
  return successes >= quorum(n) && redlockValidity(ttlMs, elapsedMs) > 0;
}

// ---------------------------------------------------------------------------------------------
// Lock safety timeline: SET lock NX PX + optional fencing at the storage layer
// ---------------------------------------------------------------------------------------------

export class LockService {
  private holder: { owner: string; token: number; expiresAt: number } | null = null;
  private counter = 0; // INCR lock:fence on acquisition
  acquire(owner: string, now: number, ttlMs: number): number | null {
    if (this.holder && this.holder.expiresAt > now) return null;
    this.holder = { owner, token: ++this.counter, expiresAt: now + ttlMs };
    return this.holder.token;
  }
}

export class Storage {
  writes: Array<{ owner: string; value: string }> = [];
  private maxToken = 0;
  readonly fencing: boolean;
  constructor(fencing: boolean) {
    this.fencing = fencing;
  }
  write(owner: string, token: number, value: string): boolean {
    if (this.fencing && token < this.maxToken) return false; // stale token: reject
    this.maxToken = Math.max(this.maxToken, token);
    this.writes.push({ owner, value });
    return true;
  }
}

/**
 * Kleppmann's scenario: client 1 acquires, pauses (GC) past the TTL, client 2 acquires and
 * writes, client 1 wakes up believing it still holds the lock and writes too.
 */
export function gcPauseScenario(fencing: boolean): Storage {
  const locks = new LockService();
  const storage = new Storage(fencing);
  const t1 = locks.acquire('client-1', 0, 10_000)!;
  // client-1 stops the world for 15 s; the lock expires at t = 10 s
  const t2 = locks.acquire('client-2', 12_000, 10_000)!;
  storage.write('client-2', t2, 'B');
  storage.write('client-1', t1, 'A'); // at t = 15 s, after the pause
  return storage;
}

// ---------------------------------------------------------------------------------------------
// Idempotency keys: SET idem:<key> "processing" NX EX ttl, then store the result
// ---------------------------------------------------------------------------------------------

export type IdemState =
  | { status: 'processing' }
  | { status: 'done'; result: string; fingerprint: string };

export class IdempotencyStore {
  readonly m = new Map<string, IdemState & { fp?: string }>();
  /** Returns 'proceed', 'in-progress', a stored result, or a conflict for a reused key with a different body. */
  begin(
    key: string,
    fingerprint: string,
  ): 'proceed' | 'in-progress' | 'conflict' | { replay: string } {
    const cur = this.m.get(key);
    if (!cur) {
      this.m.set(key, { status: 'processing', fp: fingerprint }); // SET … NX
      return 'proceed';
    }
    if (cur.fp !== undefined && cur.fp !== fingerprint) return 'conflict';
    if (cur.status === 'processing') return 'in-progress';
    return { replay: cur.result };
  }
  complete(key: string, fingerprint: string, result: string): void {
    this.m.set(key, { status: 'done', result, fingerprint, fp: fingerprint });
  }
  /** On failure, release the claim so a retry can proceed (DEL, owner-checked in real code). */
  abort(key: string): void {
    this.m.delete(key);
  }
}
