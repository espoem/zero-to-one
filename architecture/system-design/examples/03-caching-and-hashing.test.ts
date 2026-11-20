import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ConsistentHashRing,
  hash32,
  LeaseCache,
  LruCache,
  mulberry32,
  simulateHotKeyShards,
  SingleFlightCache,
  WTinyLfuCache,
  xfetchShouldRecompute,
} from './lib/system-design-models.ts';

function stdDev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

test('ConsistentHashRing with 150 vnodes slashes load skew and moves ~K/N keys vs naive mod N', () => {
  const nodeCount = 10;
  const numKeys = 10_000;
  const nodes = Array.from({ length: nodeCount }, (_, i) => `cache-node-${i}`);
  const keys = Array.from({ length: numKeys }, (_, i) => `session:${i}:profile`);

  const ring1 = new ConsistentHashRing(1, nodes);
  const ring150 = new ConsistentHashRing(150, nodes);

  const countLoad = (ring: ConsistentHashRing): number[] => {
    const counts = new Map<string, number>();
    for (const n of nodes) counts.set(n, 0);
    for (const k of keys) {
      const n = ring.getNode(k);
      counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    return [...counts.values()];
  };

  const skew1 = stdDev(countLoad(ring1));
  const skew150 = stdDev(countLoad(ring150));

  // Virtual nodes dramatically lower load standard deviation
  assert.ok(skew150 < skew1 * 0.25, `Expected skew150 (${skew150}) << skew1 (${skew1})`);
  assert.ok(skew150 < 150, `Expected std-dev < 15% of mean (1000), got ${skew150}`);

  // Measure key movement on adding an 11th node
  const beforeRing = keys.map((k) => ring150.getNode(k));
  ring150.addNode('cache-node-10');
  let movedRing = 0;
  for (let i = 0; i < numKeys; i += 1) {
    if (ring150.getNode(keys[i] ?? '') !== beforeRing[i]) {
      movedRing += 1;
    }
  }
  const movedRingFraction = movedRing / numKeys;
  // Expected ~ 1/11 ≈ 0.0909
  assert.ok(
    movedRingFraction > 0.05 && movedRingFraction < 0.15,
    `Expected ~K/N (~9%) keys moved, got ${(movedRingFraction * 100).toFixed(2)}%`,
  );

  // Negative test: naive hash(key) % N remaps > 75% of keys when N goes 10 -> 11
  let movedNaive = 0;
  for (const k of keys) {
    const h = hash32(k);
    if (h % nodeCount !== h % (nodeCount + 1)) {
      movedNaive += 1;
    }
  }
  const movedNaiveFraction = movedNaive / numKeys;
  assert.ok(
    movedNaiveFraction > 0.75,
    `Expected naive hash % N to remap > 75% of keys, got ${(movedNaiveFraction * 100).toFixed(2)}%`,
  );
});

test('SingleFlightCache coalesces 1,000 concurrent cache misses into exactly 1 DB load', async () => {
  const cache = new SingleFlightCache<string>();
  let dbCalls = 0;

  const loader = async (): Promise<string> => {
    dbCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return 'hot-payload-v1';
  };

  const results = await Promise.all(
    Array.from({ length: 1_000 }, () => cache.getOrLoad('hot-key', loader)),
  );

  assert.equal(dbCalls, 1);
  assert.equal(results.length, 1_000);
  assert.ok(results.every((v) => v === 'hot-payload-v1'));
});

test('Negative test: Cache-aside stale-write race vs Memcache Lease rejection', () => {
  // 1. Naive cache-aside race: R1 overwrites cache with stale V1 after W1 updated DB to V2
  const db = new Map<string, string>([['item:42', 'V1']]);
  const naiveCache = new Map<string, string>();

  // R1 misses cache and reads V1 from DB
  const r1CacheHit = naiveCache.get('item:42');
  assert.equal(r1CacheHit, undefined);
  const r1DbValue = db.get('item:42') ?? '';

  // W1 updates DB to V2 and deletes cache
  db.set('item:42', 'V2');
  naiveCache.delete('item:42');

  // R1 resumes and sets stale V1 into naive cache
  naiveCache.set('item:42', r1DbValue);
  assert.equal(naiveCache.get('item:42'), 'V1', 'Naive cache is poisoned with stale V1!');
  assert.equal(db.get('item:42'), 'V2');

  // 2. Memcache Lease defense: W1 invalidation revokes R1's lease token
  const leaseDb = new Map<string, string>([['item:42', 'V1']]);
  const leaseCache = new LeaseCache<string>();

  const r1Lookup = leaseCache.get('item:42');
  assert.equal(r1Lookup.hit, false);
  const r1LeaseToken = r1Lookup.leaseToken;
  const r1LeaseDbVal = leaseDb.get('item:42') ?? '';

  // W1 updates DB to V2 and invalidates cache (revoking R1's lease)
  leaseDb.set('item:42', 'V2');
  leaseCache.invalidate('item:42');

  // R1 wakes up and tries to populate stale V1 with its revoked lease -> rejected!
  const setAccepted = leaseCache.setWithLease('item:42', r1LeaseDbVal, r1LeaseToken);
  assert.equal(setAccepted, false);
  assert.equal(leaseCache.peek('item:42'), undefined);

  // Subsequent reader R2 gets fresh lease and populates V2
  const r2Lookup = leaseCache.get('item:42');
  assert.equal(r2Lookup.hit, false);
  assert.equal(
    leaseCache.setWithLease('item:42', leaseDb.get('item:42') ?? '', r2Lookup.leaseToken),
    true,
  );
  assert.equal(leaseCache.peek('item:42'), 'V2');
});

test('XFetch probabilistic early expiration avoids stampede far from TTL and triggers near expiry', () => {
  const expiry = 60_000;
  const delta = 500;
  const beta = 1;
  const rng = mulberry32(101);

  let earlyFar = 0;
  let earlyNear = 0;
  const trials = 1_000;

  for (let i = 0; i < trials; i += 1) {
    const r = rng();
    if (xfetchShouldRecompute(30_000, expiry, delta, beta, r)) earlyFar += 1;
    if (xfetchShouldRecompute(59_700, expiry, delta, beta, r)) earlyNear += 1;
  }

  assert.equal(earlyFar, 0);
  assert.ok(
    earlyNear > 400 && earlyNear < 700,
    `Expected ~55% recompute near expiry, got ${earlyNear}`,
  );
  assert.equal(xfetchShouldRecompute(60_000, expiry, delta, beta, 0.99), true);
});

test('W-TinyLFU resists sequential scan thrashing where pure LRU collapses on Zipf workload', () => {
  const rng = mulberry32(4242);
  const capacity = 100;
  const lru = new LruCache<string, number>(capacity);
  const tinyLfu = new WTinyLfuCache<number>(capacity);

  // Build Zipf-like CDF over 200 keys (top ~30 keys dominate requests)
  const numItems = 200;
  const weights: number[] = [];
  let totalWeight = 0;
  for (let i = 1; i <= numItems; i += 1) {
    const w = 1 / Math.pow(i, 1.25);
    totalWeight += w;
    weights.push(totalWeight);
  }

  const pickZipfKey = (): string => {
    const target = rng() * totalWeight;
    for (let i = 0; i < weights.length; i += 1) {
      if ((weights[i] ?? 0) >= target) return `hot-${i}`;
    }
    return 'hot-0';
  };

  // Phase 1: Warm up frequency sketch and working set
  for (let i = 0; i < 4_000; i += 1) {
    const k = pickZipfKey();
    if (lru.get(k) === undefined) lru.set(k, 1);
    if (tinyLfu.get(k) === undefined) tinyLfu.set(k, 1);
  }

  // Phase 2: Sequential scan bursts (150 cold keys > capacity=100) interleaved with Zipf traffic
  let lruHotHits = 0;
  let tinyHotHits = 0;
  let hotLookups = 0;
  let scanSeq = 0;

  for (let round = 0; round < 10; round += 1) {
    // Sequential table scan larger than cache capacity
    for (let s = 0; s < 150; s += 1) {
      const scanKey = `scan-${scanSeq}`;
      scanSeq += 1;
      if (lru.get(scanKey) === undefined) lru.set(scanKey, 1);
      if (tinyLfu.get(scanKey) === undefined) tinyLfu.set(scanKey, 1);
    }

    // Normal Zipf traffic following the scan
    for (let q = 0; q < 200; q += 1) {
      hotLookups += 1;
      const k = pickZipfKey();
      if (lru.get(k) !== undefined) lruHotHits += 1;
      else lru.set(k, 1);

      if (tinyLfu.get(k) !== undefined) tinyHotHits += 1;
      else tinyLfu.set(k, 1);
    }
  }

  const lruHitRate = lruHotHits / hotLookups;
  const tinyHitRate = tinyHotHits / hotLookups;
  assert.ok(
    tinyHitRate > lruHitRate + 0.15,
    `Expected W-TinyLFU (${tinyHitRate.toFixed(3)}) to beat thrashing LRU (${lruHitRate.toFixed(3)}) by >15%`,
  );
});

test('Negative test (Hot Key): single celebrity key saturates 1 shard above ceiling; key-salting and L1 micro-cache relieve it', () => {
  const shards = Array.from({ length: 8 }, (_, i) => `redis-shard-${i}`);
  const baseConfig = {
    shards,
    shardOpsCeiling: 50_000,
    backgroundOpsPerSec: 80_000,
    backgroundKeyCount: 8_000,
    celebrityKey: 'profile:celebrity:taylor',
    celebrityOpsPerSec: 120_000,
  };

  // Unmitigated: 120k ops/s all land on 1 shard, breaching its 50k ops/s ceiling even though cluster capacity is 400k ops/s
  const unmitigated = simulateHotKeyShards(baseConfig);
  assert.equal(unmitigated.overloadedShards.length, 1);
  assert.ok(
    unmitigated.maxShardOps > baseConfig.shardOpsCeiling * 2,
    `Expected single shard > 100k ops/s, got ${unmitigated.maxShardOps}`,
  );

  // Mitigation 1: Key-salting across S=32 replicas (`key#0..31`) spreads celebrity traffic across shards below ceiling
  const salted = simulateHotKeyShards({
    ...baseConfig,
    saltCount: 32,
  });
  assert.equal(salted.overloadedShards.length, 0);
  assert.ok(
    salted.maxShardOps < baseConfig.shardOpsCeiling,
    `Expected salted maxShardOps < 50k, got ${salted.maxShardOps}`,
  );

  // Mitigation 2: L1 in-process micro-cache (500ms TTL on 40 app servers) collapses L2 celebrity load to 80 ops/s
  const microCached = simulateHotKeyShards({
    ...baseConfig,
    l1TtlMs: 500,
    appInstanceCount: 40,
  });
  assert.equal(microCached.effectiveCelebrityL2OpsPerSec, 80);
  assert.equal(microCached.overloadedShards.length, 0);
  assert.ok(
    microCached.maxShardOps < 20_000,
    `Expected L1 micro-cache to drop maxShardOps to background levels, got ${microCached.maxShardOps}`,
  );
});
