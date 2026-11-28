import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Bounded LRU cache supporting Write-Through (write-allocate) and Write-Around (no-write-allocate).
 */
class BoundedPolicyCache<V> {
  private readonly entries = new Map<string, V>();
  private readonly capacity: number;
  private readonly db: Map<string, V>;
  readonly policy: 'write-through' | 'write-around';
  dbReads = 0;
  dbWrites = 0;
  cacheHits = 0;
  cacheMisses = 0;

  constructor(capacity: number, db: Map<string, V>, policy: 'write-through' | 'write-around') {
    this.capacity = capacity;
    this.db = db;
    this.policy = policy;
  }

  private touch(key: string, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, value);
    if (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
  }

  read(key: string): V | undefined {
    const cached = this.entries.get(key);
    if (cached !== undefined) {
      this.cacheHits++;
      this.touch(key, cached);
      return cached;
    }
    this.cacheMisses++;
    this.dbReads++;
    const fromDb = this.db.get(key);
    if (fromDb !== undefined) this.touch(key, fromDb);
    return fromDb;
  }

  write(key: string, value: V): void {
    this.dbWrites++;
    this.db.set(key, value);
    if (this.policy === 'write-through') {
      this.touch(key, value);
    } else {
      // Write-around bypasses cache on write (no-write-allocate) and invalidates any stale copy.
      this.entries.delete(key);
    }
  }
}

/**
 * Single-flight request coalescer collapsing N concurrent misses on the same key into 1 load.
 */
class SingleFlightCache<V> {
  private readonly store = new Map<string, V>();
  private readonly inflight = new Map<string, Promise<V>>();
  dbLoads = 0;

  async get(key: string, loader: (k: string) => Promise<V>): Promise<V> {
    const hit = this.store.get(key);
    if (hit !== undefined) return hit;

    let pending = this.inflight.get(key);
    if (!pending) {
      pending = (async () => {
        this.dbLoads++;
        const value = await loader(key);
        this.store.set(key, value);
        return value;
      })().finally(() => {
        this.inflight.delete(key);
      });
      this.inflight.set(key, pending);
    }
    return pending;
  }
}

/**
 * Exclusive lock manager maintaining a directed Wait-For Graph (waiter -> holder) for cycle detection.
 */
class WaitForLockManager {
  private readonly holders = new Map<string, string>();
  private readonly waitingFor = new Map<string, Set<string>>();

  /**
   * Attempts to acquire exclusive lock on `resource` for `txn`.
   * Returns true if acquired, or false if blocked (recording Wait-For Graph edge txn -> holder).
   */
  acquire(txn: string, resource: string): boolean {
    const owner = this.holders.get(resource);
    if (owner === undefined || owner === txn) {
      this.holders.set(resource, txn);
      return true;
    }
    let edges = this.waitingFor.get(txn);
    if (!edges) {
      edges = new Set<string>();
      this.waitingFor.set(txn, edges);
    }
    edges.add(owner);
    return false;
  }

  /** Releases all locks held by `txn` and clears its outgoing/incoming Wait-For Graph edges. */
  abort(txn: string): void {
    for (const [resource, owner] of this.holders) {
      if (owner === txn) this.holders.delete(resource);
    }
    this.waitingFor.delete(txn);
    for (const edges of this.waitingFor.values()) {
      edges.delete(txn);
    }
  }

  /** Returns the first directed cycle found in the Wait-For Graph, or null if deadlock-free. */
  detectCycle(): string[] | null {
    const state = new Map<string, 'visiting' | 'visited'>();
    const stack: string[] = [];

    const dfs = (node: string): string[] | null => {
      state.set(node, 'visiting');
      stack.push(node);

      for (const next of this.waitingFor.get(node) ?? []) {
        const nextState = state.get(next);
        if (nextState === 'visiting') {
          const cycleStart = stack.indexOf(next);
          return [...stack.slice(cycleStart), next];
        }
        if (nextState === undefined) {
          const cycle = dfs(next);
          if (cycle) return cycle;
        }
      }

      stack.pop();
      state.set(node, 'visited');
      return null;
    };

    for (const node of this.waitingFor.keys()) {
      if (state.get(node) === undefined) {
        const cycle = dfs(node);
        if (cycle) return cycle;
      }
    }
    return null;
  }
}

describe('Write-Around Caching, Request Coalescing, and Wait-For Graph Deadlocks', () => {
  it('Write-Around avoids cold-write cache pollution while incurring first-read misses', () => {
    const wtDb = new Map<string, string>();
    const waDb = new Map<string, string>();
    const hotKeys = ['hot:0', 'hot:1', 'hot:2', 'hot:3'];
    for (const k of hotKeys) {
      wtDb.set(k, `v:${k}`);
      waDb.set(k, `v:${k}`);
    }

    const wt = new BoundedPolicyCache(4, wtDb, 'write-through');
    const wa = new BoundedPolicyCache(4, waDb, 'write-around');

    // Warm the hot working set in both caches.
    for (const k of hotKeys) {
      assert.equal(wt.read(k), `v:${k}`);
      assert.equal(wa.read(k), `v:${k}`);
    }
    wt.cacheHits = 0;
    wt.cacheMisses = 0;
    wa.cacheHits = 0;
    wa.cacheMisses = 0;

    // Stream 50 cold writes that are never re-read.
    for (let i = 0; i < 50; i++) {
      wt.write(`cold:${i}`, `payload:${i}`);
      wa.write(`cold:${i}`, `payload:${i}`);
    }

    // Re-read the hot working set: Write-Through evicted all hot keys; Write-Around kept all 4.
    for (const k of hotKeys) {
      assert.equal(wt.read(k), `v:${k}`);
      assert.equal(wa.read(k), `v:${k}`);
    }
    assert.equal(wt.cacheMisses, 4);
    assert.equal(wa.cacheMisses, 0);
    assert.equal(wa.cacheHits, 4);

    // Write-then-read on a new key misses once (no-write-allocate), then hits on repeat read.
    wa.write('item:99', 'fresh');
    assert.equal(wa.read('item:99'), 'fresh');
    assert.equal(wa.cacheMisses, 1);
    assert.equal(wa.read('item:99'), 'fresh');
    assert.equal(wa.cacheHits, 5);

    // Updating an already-cached key invalidates the stale entry so the next read sees the new DB value.
    wa.write('item:99', 'updated');
    assert.equal(wa.read('item:99'), 'updated');
    assert.equal(wa.cacheMisses, 2);
  });

  it('Request Coalescing (Single-Flight) collapses N concurrent misses into 1 DB load and clears on error', async () => {
    const cache = new SingleFlightCache<string>();
    const concurrency = 50;

    const results = await Promise.all(
      Array.from({ length: concurrency }, () =>
        cache.get('product:42', async (k) => {
          await new Promise((resolve) => setImmediate(resolve));
          return `loaded:${k}`;
        }),
      ),
    );

    assert.equal(cache.dbLoads, 1);
    assert.equal(results.length, concurrency);
    assert.ok(results.every((r) => r === 'loaded:product:42'));

    // Distinct keys load independently without coalescing across keys.
    const [a, b] = await Promise.all([
      cache.get('k1', async (k) => k),
      cache.get('k2', async (k) => k),
    ]);
    assert.equal(a, 'k1');
    assert.equal(b, 'k2');
    assert.equal(cache.dbLoads, 3);

    // Failed load propagates to concurrent waiters and clears inflight so the next caller retries.
    let attempt = 0;
    const failingRuns = Array.from({ length: 10 }, () =>
      cache.get('flaky:1', async () => {
        attempt++;
        await new Promise((resolve) => setImmediate(resolve));
        if (attempt === 1) throw new Error('transient_db_timeout');
        return 'recovered';
      }),
    );
    const settled = await Promise.allSettled(failingRuns);
    assert.ok(settled.every((s) => s.status === 'rejected'));
    assert.equal(cache.dbLoads, 4);

    const retried = await cache.get('flaky:1', async () => 'recovered');
    assert.equal(retried, 'recovered');
    assert.equal(cache.dbLoads, 5);
  });

  it('Wait-For Graph detects 2-node and 3-node deadlock cycles and canonical lock ordering eliminates them', () => {
    // 1. Two-transaction deadlock cycle (T1 -> T2 -> T1)
    const lm2 = new WaitForLockManager();
    assert.equal(lm2.acquire('T1', 'row:A'), true);
    assert.equal(lm2.acquire('T2', 'row:B'), true);
    assert.equal(lm2.acquire('T1', 'row:B'), false); // T1 -> T2
    assert.equal(lm2.detectCycle(), null);
    assert.equal(lm2.acquire('T2', 'row:A'), false); // T2 -> T1

    const cycle2 = lm2.detectCycle();
    assert.ok(cycle2 !== null);
    assert.equal(cycle2[0], cycle2[cycle2.length - 1]);
    assert.ok(cycle2.includes('T1') && cycle2.includes('T2'));

    // Abort victim T2: releases row:B and breaks the cycle so T1 can proceed.
    lm2.abort('T2');
    assert.equal(lm2.detectCycle(), null);
    assert.equal(lm2.acquire('T1', 'row:B'), true);

    // 2. Three-transaction deadlock cycle (T1 -> T2 -> T3 -> T1)
    const lm3 = new WaitForLockManager();
    assert.equal(lm3.acquire('T1', 'r1'), true);
    assert.equal(lm3.acquire('T2', 'r2'), true);
    assert.equal(lm3.acquire('T3', 'r3'), true);
    assert.equal(lm3.acquire('T1', 'r2'), false);
    assert.equal(lm3.acquire('T2', 'r3'), false);
    assert.equal(lm3.acquire('T3', 'r1'), false);

    const cycle3 = lm3.detectCycle();
    assert.deepEqual(cycle3, ['T1', 'T2', 'T3', 'T1']);

    // 3. Canonical lock ordering prevents circular wait across interleaved multi-key requests.
    const lmOrdered = new WaitForLockManager();
    const workloads: Array<{ txn: string; keys: string[] }> = [
      { txn: 'T1', keys: ['row:B', 'row:A'] },
      { txn: 'T2', keys: ['row:A', 'row:B'] },
      { txn: 'T3', keys: ['row:C', 'row:B'] },
    ];
    const sortedQueues = workloads.map((w) => ({
      txn: w.txn,
      keys: [...w.keys].sort(),
      idx: 0,
      done: false,
    }));

    // Step-by-step round-robin interleaving: every txn acquires locks in canonical sorted order.
    let rounds = 0;
    while (sortedQueues.some((q) => !q.done)) {
      rounds++;
      assert.ok(rounds <= 20, 'canonical lock ordering must make progress without deadlock');
      for (const q of sortedQueues) {
        if (q.done) continue;
        const nextKey = q.keys[q.idx];
        if (nextKey === undefined) continue;
        const acquired = lmOrdered.acquire(q.txn, nextKey);
        assert.equal(lmOrdered.detectCycle(), null);
        if (acquired) {
          q.idx++;
          if (q.idx === q.keys.length) {
            lmOrdered.abort(q.txn); // commit & release locks
            q.done = true;
          }
        }
      }
    }
    assert.ok(sortedQueues.every((q) => q.done));
    assert.equal(lmOrdered.detectCycle(), null);
  });
});
