// Stale-while-revalidate on top of a Redis-style TTL: the envelope carries a LOGICAL expiry (soft),
// the key has a longer PHYSICAL TTL (hard). Between the two, readers get the stale value at once and
// exactly one of them refreshes it.

export interface Envelope<V> {
  value: V;
  softExpiry: number;
}

export class SwrCache<V> {
  private store = new Map<string, { env: Envelope<V>; hardExpiry: number }>();
  private lock = new Set<string>();
  loads = 0;
  private readonly now: () => number;
  private readonly load: (key: string) => Promise<V>;
  private readonly softTtl: number;
  private readonly hardTtl: number;
  constructor(
    now: () => number,
    load: (key: string) => Promise<V>,
    softTtl: number,
    hardTtl: number,
  ) {
    if (hardTtl <= softTtl) throw new RangeError('hard TTL must exceed soft TTL');
    this.now = now;
    this.load = load;
    this.softTtl = softTtl;
    this.hardTtl = hardTtl;
  }

  private put(key: string, value: V): void {
    const t = this.now();
    this.store.set(key, {
      env: { value, softExpiry: t + this.softTtl },
      hardExpiry: t + this.hardTtl,
    });
  }

  async get(key: string): Promise<{ value: V; stale: boolean }> {
    const e = this.store.get(key);
    const t = this.now();
    if (e && t < e.hardExpiry) {
      if (t < e.env.softExpiry) return { value: e.env.value, stale: false };
      // soft-expired: serve stale, refresh in the background if nobody else is doing so (SET NX PX)
      if (!this.lock.has(key)) {
        this.lock.add(key);
        this.loads++;
        void this.load(key)
          .then((v) => this.put(key, v))
          .finally(() => this.lock.delete(key));
      }
      return { value: e.env.value, stale: true };
    }
    // hard-expired or absent: the caller must wait for a load
    this.loads++;
    const v = await this.load(key);
    this.put(key, v);
    return { value: v, stale: false };
  }
}
