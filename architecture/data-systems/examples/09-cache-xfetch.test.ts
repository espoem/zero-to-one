import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

export interface CacheEntry<T> {
  value: T;
  delta: number; // Time in ms taken to compute this value
  expiryTime: number; // Timestamp in ms
}

export class XFetchCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  dbQueryCount = 0;

  get(key: string, now: number): CacheEntry<T> | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    return entry;
  }

  set(key: string, value: T, ttlMs: number, deltaMs: number, now: number): void {
    this.store.set(key, {
      value,
      delta: deltaMs,
      expiryTime: now + ttlMs,
    });
  }

  /**
   * Evaluates XFetch probabilistic early expiration:
   * Returns true if entry should be recomputed early.
   * Delta - beta * deltaComputation * ln(rand()) > TTL
   * (Equivalent to: now - (expiry - beta * delta * ln(rand())) > 0)
   */
  shouldRecompute(entry: CacheEntry<T>, beta: number, now: number, randomVal?: number): boolean {
    const ttlRemaining = entry.expiryTime - now;
    if (ttlRemaining <= 0) return true; // Hard expired

    const rand = randomVal ?? Math.random();
    // rand in (0, 1]
    const safeRand = Math.max(rand, 0.0001);
    const earlyWindow = -beta * entry.delta * Math.log(safeRand);

    return earlyWindow > ttlRemaining;
  }

  // Simulated database fetch
  computeValue(key: string): string {
    this.dbQueryCount++;
    return `computed_value_for_${key}`;
  }
}

describe('Cache Stampede Mitigation & The XFetch Algorithm', () => {
  it('demonstrates how naive TTL triggers a catastrophic cache stampede', async () => {
    let dbQueries = 0;
    const naiveCache = new Map<string, { val: string; expiresAt: number }>();

    // Simulated expensive compute function with async I/O delay
    async function readNaive(key: string, now: number): Promise<string> {
      const entry = naiveCache.get(key);
      if (!entry || entry.expiresAt <= now) {
        dbQueries++; // Database hit!
        // Simulate async I/O latency before cache entry is populated
        await new Promise((resolve) => setImmediate(resolve));
        const computed = `value_for_${key}`;
        naiveCache.set(key, { val: computed, expiresAt: now + 5000 });
        return computed;
      }
      return entry.val;
    }

    // Populate initial value
    await readNaive('hot_key', 1000);
    assert.equal(dbQueries, 1);

    // 100 concurrent requests arrive at time 6001 (1ms after expiration)
    const concurrentRequests = 100;
    await Promise.all(
      Array.from({ length: concurrentRequests }, () => readNaive('hot_key', 6001))
    );

    // Stampede failure: all 100 concurrent requests missed simultaneously and hit the database!
    assert.equal(dbQueries, 101);
  });

  it('demonstrates XFetch probabilistic early expiration preventing stampede', () => {
    const cache = new XFetchCache<string>();
    const now = 10000;
    const ttl = 5000; // 5 seconds TTL (expires at 15000)
    const delta = 100; // Computing took 100ms

    cache.set('product_42', 'iPhone 18', ttl, delta, now);

    // 1. Far from expiration (at t = 11000, 4s remaining):
    // rand() = 0.5 -> -1.0 * 100 * ln(0.5) = 69.3ms << 4000ms -> False
    const entry = cache.get('product_42', 11000)!;
    assert.equal(cache.shouldRecompute(entry, 1.0, 11000, 0.5), false);

    // 2. Imminent expiration (at t = 14950, only 50ms remaining):
    // rand() = 0.5 -> 69.3ms > 50ms -> True! Triggers background refresh!
    assert.equal(cache.shouldRecompute(entry, 1.0, 14950, 0.5), true);
  });
});
