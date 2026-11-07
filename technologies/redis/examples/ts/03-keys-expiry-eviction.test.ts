// Module 03: expiry, eviction approximations, LFU counter, SCAN guarantees.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { mulberry32 } from './src/zset.ts';
import {
  activeExpireCycle,
  LazyExpireStore,
  ApproxLru,
  lfuCounterAfterHits,
  lfuDecay,
  lfuLogIncr,
  LFU_INIT_VAL,
  evictionCandidates,
  writeOutcome,
  ScanTable,
  nextCursor,
  rev,
  type VolatileKey,
} from './src/keyspace.ts';

test('lazy expiry: an expired key is invisible to GET but still counted by DBSIZE until touched', () => {
  const s = new LazyExpireStore();
  s.set('session', 'x', 100, 0);
  assert.equal(s.dbsize(), 1);
  assert.equal(s.get('session', 50), 'x');
  assert.equal(s.dbsize(), 1);
  // Time passes; nobody touches the key: it still occupies memory.
  assert.equal(s.dbsize(), 1);
  assert.equal(s.get('session', 150), null);
  assert.equal(s.dbsize(), 0);
});

test('active expiry is probabilistic: cycles stop once a sample is <= 10 % stale', () => {
  const rng = mulberry32(7);
  let keys: VolatileKey[] = [];
  for (let i = 0; i < 100_000; i++) keys.push({ name: `k${i}`, expiresAt: i < 50_000 ? 0 : 1e12 });
  // One cycle can end early by bad luck (a sample with <= 2 of 20 expired), so run cycles the way
  // serverCron does (hz times per second) and look at the steady state.
  let totalLoops = 0;
  for (let cycle = 0; cycle < 200; cycle++) {
    const r = activeExpireCycle(keys, 1, rng);
    keys = r.remaining;
    totalLoops += r.loops;
  }
  const staleLeft = keys.filter((k) => k.expiresAt <= 1).length;
  const staleFraction = staleLeft / keys.length;
  assert.ok(totalLoops > 1_000, `looped ${totalLoops} times`);
  // It does not reclaim everything: memory still holds logically expired keys...
  assert.ok(staleLeft > 0);
  // ...but the stale fraction is driven from 50 % down towards the target. The 10 % threshold
  // applies to a 20-key *sample*: at a true stale fraction of ~20 % a sample shows <= 2 expired
  // keys often enough (~20 % of the time) to end a cycle, so the population settles above 10 %.
  assert.ok(staleFraction < 0.25, `stale fraction ${staleFraction.toFixed(3)}`);
});

test('active expiry with few expired keys does one cheap loop and leaves them to later cycles', () => {
  const keys: VolatileKey[] = Array.from({ length: 10_000 }, (_, i) => ({
    name: `k${i}`,
    expiresAt: i < 100 ? 0 : 1e12,
  }));
  const r = activeExpireCycle(keys, 1, mulberry32(3));
  assert.equal(r.loops, 1);
});

test('higher active-expire-effort samples more keys per loop and tolerates less staleness', () => {
  const mk = () =>
    Array.from({ length: 50_000 }, (_, i) => ({
      name: `k${i}`,
      expiresAt: i % 4 === 0 ? 0 : 1e12,
    }));
  const low = activeExpireCycle(mk(), 1, mulberry32(11), 1);
  const high = activeExpireCycle(mk(), 1, mulberry32(11), 10);
  const stale = (r: typeof low) =>
    r.remaining.filter((k) => k.expiresAt <= 1).length / r.remaining.length;
  assert.ok(stale(high) <= stale(low));
});

test('LFU counter is logarithmic: matches the redis.conf table for lfu-log-factor 10 (±20 %)', () => {
  // redis.conf: factor 10 -> 100 hits: 10, 1000 hits: 18, 100K hits: 142, 1M hits: 255
  const rng = mulberry32(2024);
  const near = (got: number, want: number) => Math.abs(got - want) <= Math.max(2, want * 0.2);
  const c100 = lfuCounterAfterHits(100, 10, rng);
  const c1k = lfuCounterAfterHits(1_000, 10, rng);
  const c100k = lfuCounterAfterHits(100_000, 10, rng);
  const c1m = lfuCounterAfterHits(1_000_000, 10, rng);
  assert.ok(near(c100, 10), `100 hits -> ${c100}`);
  assert.ok(near(c1k, 18), `1000 hits -> ${c1k}`);
  assert.ok(near(c100k, 142), `100K hits -> ${c100k}`);
  assert.equal(c1m, 255);
});

test('LFU: a new key starts at 5 so it is not evicted immediately, and the counter saturates at 255', () => {
  assert.equal(LFU_INIT_VAL, 5);
  assert.equal(
    lfuLogIncr(255, 10, () => 0),
    255,
  );
  // At or below the initial value every hit increments (p = 1).
  assert.equal(
    lfuLogIncr(3, 10, () => 0.999),
    4,
  );
});

test('LFU decay: one step per lfu-decay-time minutes of inactivity', () => {
  assert.equal(lfuDecay(100, 30, 1), 70);
  assert.equal(lfuDecay(10, 600, 1), 0);
  assert.equal(lfuDecay(100, 30, 0), 100); // 0 disables decay
});

test('approximated LRU: more samples pick older victims; the pool improves on pure sampling', () => {
  const N = 5_000;
  const last = new Map<string, number>();
  for (let i = 0; i < N; i++) last.set(`k${i}`, i); // k0 is the least recently used
  const quality = (samples: number) => {
    const lru = new ApproxLru(samples, mulberry32(99));
    const copy = new Map(last);
    let rankSum = 0;
    for (let round = 0; round < 200; round++) {
      const victim = lru.pickVictim(copy, N)!;
      rankSum += last.get(victim)!; // lower = older = better
      copy.delete(victim);
    }
    return rankSum / 200;
  };
  const q1 = quality(1);
  const q5 = quality(5);
  const q10 = quality(10);
  assert.ok(q5 < q1, `samples=5 (${q5}) should beat samples=1 (${q1})`);
  assert.ok(q10 < q5, `samples=10 (${q10}) should beat samples=5 (${q5})`);
  // True LRU would average rank 99.5 over 200 evictions; approximations are worse but close-ish.
  assert.ok(q10 > 99.5);
});

test('eviction candidates: volatile-* policies only see keys with a TTL', () => {
  const keys = [
    { name: 'a', hasTtl: false },
    { name: 'b', hasTtl: true },
  ];
  assert.deepEqual(
    evictionCandidates('allkeys-lru', keys).map((k) => k.name),
    ['a', 'b'],
  );
  assert.deepEqual(
    evictionCandidates('volatile-lru', keys).map((k) => k.name),
    ['b'],
  );
  assert.deepEqual(
    evictionCandidates('volatile-lrm', keys).map((k) => k.name),
    ['b'],
  );
  assert.deepEqual(evictionCandidates('noeviction', keys), []);
});

test('negative: volatile-* with no TTL keys behaves like noeviction: writes fail with OOM', () => {
  const noTtl = [{ name: 'a', hasTtl: false }];
  assert.equal(writeOutcome('volatile-lru', noTtl), 'OOM');
  assert.equal(writeOutcome('noeviction', noTtl), 'OOM');
  assert.equal(writeOutcome('allkeys-lfu', noTtl), 'evict');
});

test('SCAN cursor: reverse-binary increment visits every bucket of a table exactly once', () => {
  for (const size of [1, 2, 8, 64]) {
    const mask = size - 1;
    const seen: number[] = [];
    let c = 0;
    do {
      seen.push(c & mask);
      c = nextCursor(c, mask);
    } while (c !== 0);
    assert.equal(seen.length, size);
    assert.equal(new Set(seen).size, size);
  }
  assert.equal(rev(1, 32), 0x80000000);
});

test('property: keys present for the whole SCAN are returned even if the table resizes between calls', () => {
  fc.assert(
    fc.property(
      fc.uniqueArray(fc.string({ minLength: 1, maxLength: 6 }), { minLength: 1, maxLength: 200 }),
      fc.array(fc.constantFrom(4, 8, 16, 32, 64, 128), { maxLength: 30 }),
      fc.constantFrom(4, 16, 64),
      (keys, resizes, initial) => {
        const t = new ScanTable(initial, keys);
        const returned = new Set<string>();
        let cursor = 0;
        let calls = 0;
        do {
          const r = t.scan(cursor);
          r.keys.forEach((k) => returned.add(k));
          cursor = r.cursor;
          const next = resizes[calls++];
          if (next !== undefined) t.resize(next);
        } while (cursor !== 0 && calls < 10_000);
        for (const k of keys) assert.ok(returned.has(k), `missed ${k}`);
      },
    ),
    { numRuns: 300 },
  );
});

test('SCAN may return duplicates after a shrink: callers must de-duplicate', () => {
  // Find a case where shrinking mid-scan re-visits keys.
  const keys = Array.from({ length: 64 }, (_, i) => `key:${i}`);
  const t = new ScanTable(64, keys);
  const counts = new Map<string, number>();
  let cursor = 0;
  let calls = 0;
  do {
    const r = t.scan(cursor);
    r.keys.forEach((k) => counts.set(k, (counts.get(k) ?? 0) + 1));
    cursor = r.cursor;
    if (++calls === 43) t.resize(8); // mid-way through a block of buckets that share low bits
  } while (cursor !== 0);
  assert.ok(
    [...counts.values()].some((n) => n > 1),
    'expected at least one duplicate',
  );
  assert.equal(counts.size, 64);
});
