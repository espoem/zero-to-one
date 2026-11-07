// Cache-aside building blocks with the Redis commands they map to.
// The KV interface is the subset of Redis used here; tests run it against an in-memory fake with
// a manual clock (hermetic), and integration tests run the same code against a real server.

export interface KV {
  get(key: string): Promise<string | null>;
  /** SET key value PX ttl [NX]; resolves true if the value was written. */
  set(key: string, value: string, ttlMs: number, opts?: { nx?: boolean }): Promise<boolean>;
  del(key: string): Promise<void>;
  pttl(key: string): Promise<number>;
}

export class FakeKV implements KV {
  private readonly m = new Map<string, { v: string; exp: number }>();
  now = 0;
  ops = 0;
  async get(key: string): Promise<string | null> {
    this.ops++;
    const e = this.m.get(key);
    if (!e) return null;
    if (e.exp <= this.now) {
      this.m.delete(key);
      return null;
    }
    return e.v;
  }
  async set(
    key: string,
    value: string,
    ttlMs: number,
    opts: { nx?: boolean } = {},
  ): Promise<boolean> {
    this.ops++;
    // Check and write with no await in between: SET NX is one atomic command on the server.
    const cur = this.m.get(key);
    if (opts.nx && cur && cur.exp > this.now) return false;
    this.m.set(key, { v: value, exp: this.now + ttlMs });
    return true;
  }
  async del(key: string): Promise<void> {
    this.ops++;
    this.m.delete(key);
  }
  async pttl(key: string): Promise<number> {
    const e = this.m.get(key);
    if (!e || e.exp <= this.now) return -2;
    return e.exp - this.now;
  }
}

/** Stored envelope: value plus the metadata XFetch needs. */
export interface Envelope<T> {
  v: T | null; // null = negative cache entry ("known not to exist")
  delta: number; // how long the last recomputation took (ms)
  expiry: number; // absolute logical expiry (ms)
}

export interface CacheOptions {
  ttlMs: number;
  negativeTtlMs?: number;
  /** XFetch beta; 0 disables probabilistic early recomputation. */
  beta?: number;
  now: () => number;
  rng?: () => number;
}

/**
 * Cache-aside with:
 *  - request coalescing (single flight) inside one process,
 *  - negative caching of misses in the source of truth,
 *  - optional XFetch early recomputation (Vattani et al. 2015).
 */
export class CacheAside<T> {
  private readonly inflight = new Map<string, Promise<T | null>>();
  loads = 0;
  private readonly kv: KV;
  private readonly load: (key: string) => Promise<T | null>;
  private readonly opts: CacheOptions;
  constructor(kv: KV, load: (key: string) => Promise<T | null>, opts: CacheOptions) {
    this.kv = kv;
    this.load = load;
    this.opts = opts;
  }

  async get(key: string, coalesce = true): Promise<T | null> {
    const raw = await this.kv.get(key);
    if (raw !== null) {
      const env = JSON.parse(raw) as Envelope<T>;
      if (!this.shouldRecomputeEarly(env)) return env.v;
    }
    if (!coalesce) return this.refresh(key);
    let p = this.inflight.get(key);
    if (!p) {
      p = this.refresh(key).finally(() => this.inflight.delete(key));
      this.inflight.set(key, p);
    }
    return p;
  }

  /** XFetch: recompute early with probability rising as expiry approaches. */
  shouldRecomputeEarly(env: Envelope<T>): boolean {
    const beta = this.opts.beta ?? 0;
    if (beta === 0) return false;
    const r = (this.opts.rng ?? Math.random)();
    const now = this.opts.now();
    return now - env.delta * beta * Math.log(r) >= env.expiry;
  }

  private async refresh(key: string): Promise<T | null> {
    const start = this.opts.now();
    this.loads++;
    const v = await this.load(key);
    const delta = this.opts.now() - start;
    const ttl = v === null ? (this.opts.negativeTtlMs ?? 0) : this.opts.ttlMs;
    if (ttl > 0) {
      const env: Envelope<T> = { v, delta, expiry: this.opts.now() + ttl };
      await this.kv.set(key, JSON.stringify(env), ttl);
    }
    return v;
  }
}

/**
 * Cross-process stampede protection: only the holder of `lock:<key>` (SET NX PX) recomputes;
 * the others wait briefly and re-read, then fall back to loading themselves after `maxWaits`.
 */
export async function getWithLock<T>(
  kv: KV,
  key: string,
  load: () => Promise<T>,
  opts: {
    ttlMs: number;
    lockTtlMs: number;
    sleep: (ms: number) => Promise<void>;
    maxWaits?: number;
    token: string;
  },
): Promise<{ value: T; loaded: boolean }> {
  for (let attempt = 0; ; attempt++) {
    const hit = await kv.get(key);
    if (hit !== null) return { value: JSON.parse(hit) as T, loaded: false };
    if (await kv.set(`lock:${key}`, opts.token, opts.lockTtlMs, { nx: true })) {
      try {
        const value = await load();
        await kv.set(key, JSON.stringify(value), opts.ttlMs);
        return { value, loaded: true };
      } finally {
        // Release only if still ours (a real implementation uses DELEX IFEQ on 8.4+, or a script).
        if ((await kv.get(`lock:${key}`)) === opts.token) await kv.del(`lock:${key}`);
      }
    }
    if (attempt >= (opts.maxWaits ?? 20)) return { value: await load(), loaded: true };
    await opts.sleep(25);
  }
}

/** Jittered TTL: spreads the expiry of keys written together so they do not all expire at once. */
export function jitteredTtl(baseMs: number, jitterFraction: number, rng: () => number): number {
  return Math.round(baseMs * (1 + jitterFraction * (rng() * 2 - 1)));
}
