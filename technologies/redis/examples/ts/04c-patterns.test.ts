// Module 04 (hermetic): circuit breaker, write-behind, namespace versioning.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CircuitBreaker, NamespacedCache, WriteBehind } from './src/cachepatterns.ts';

test('breaker: opens after N consecutive failures, a success in between resets the count', () => {
  let t = 0;
  const b = new CircuitBreaker(3, 1000, () => t);
  b.failure();
  b.failure();
  b.success();
  b.failure();
  b.failure();
  assert.equal(b.state, 'closed');
  b.failure();
  assert.equal(b.state, 'open');
  assert.equal(b.allow(), false); // callers fall through to the source of truth
});

test('breaker: after the cool-down exactly one probe is admitted; failure re-opens, success closes', () => {
  let t = 0;
  const b = new CircuitBreaker(1, 1000, () => t);
  b.failure();
  t = 999;
  assert.equal(b.allow(), false);
  t = 1000;
  assert.equal(b.allow(), true); // the probe
  assert.equal(b.state, 'half-open');
  assert.equal(b.allow(), false); // everyone else keeps failing fast
  b.failure();
  assert.equal(b.state, 'open');
  t = 2500;
  assert.equal(b.allow(), true);
  b.success();
  assert.equal(b.state, 'closed');
  assert.equal(b.allow(), true);
});

test('negative: a breaker needs a positive threshold', () => {
  assert.throws(() => new CircuitBreaker(0, 1, () => 0), RangeError);
});

test('write-behind coalesces: 1000 updates to 10 keys become 10 database writes', () => {
  const w = new WriteBehind<number>(100);
  for (let i = 0; i < 1000; i++) w.write(`k${i % 10}`, i);
  assert.equal(w.flush(), 10);
  assert.equal(w.acknowledged, 1000);
  assert.deepEqual(
    w.flushed.find(([k]) => k === 'k3'),
    ['k3', 993],
  ); // only the latest value survives
});

test('write-behind loses acknowledged writes on a crash: the loss window is the unflushed buffer', () => {
  const w = new WriteBehind<string>(100);
  w.write('a', '1');
  w.flush();
  w.write('a', '2');
  w.write('b', '1');
  assert.deepEqual(w.crash().sort(), ['a', 'b']);
  assert.deepEqual(w.flushed, [['a', '1']]); // the database never saw a=2
  assert.equal(w.acknowledged, 3); // yet three writes were acknowledged to clients
});

test('negative: a full write-behind buffer applies backpressure instead of growing', () => {
  const w = new WriteBehind<number>(2);
  w.write('a', 1);
  w.write('b', 1);
  w.write('a', 2); // an existing key coalesces without growing the buffer
  assert.throws(() => w.write('c', 1), /backpressure/);
});

test('namespace versioning: bump invalidates every key at O(1) but leaves memory until TTL', () => {
  const c = new NamespacedCache();
  for (let i = 0; i < 100; i++) c.set('product', String(i), `p${i}`);
  c.set('user', '1', 'u');
  assert.equal(c.get('product', '7'), 'p7');
  assert.equal(c.bump('product'), 2);
  assert.equal(c.get('product', '7'), undefined);
  assert.equal(c.orphaned('product'), 100);
  assert.equal(c.get('user', '1'), 'u'); // other namespaces untouched
  assert.equal(c.key('product', '7'), 'cache:product:v2:7');
});

test('negative: a generation counter that starts absent must be initialised to the builder default', () => {
  // The Redis pitfall in miniature: builder defaults to v1, but the first INCR of a missing key yields 1.
  let counter: number | undefined;
  const version = () => counter ?? 1;
  const incr = () => (counter = (counter ?? 0) + 1);
  const before = version();
  incr();
  assert.equal(version(), before); // no change: old keys are still live
  incr();
  assert.notEqual(version(), before);
});

import { groupBySlot } from './src/cachepatterns.ts';

test('cluster caches: untagged keys scatter over many slots, a hash tag keeps them in one group', () => {
  const scattered = Array.from({ length: 100 }, (_, i) => `product:${i}`);
  const tagged = Array.from({ length: 100 }, (_, i) => `product:{catalog}:${i}`);
  assert.ok(groupBySlot(scattered).size > 50); // about one MGET per key
  assert.equal(groupBySlot(tagged).size, 1);
  const total = [...groupBySlot(scattered).values()].reduce((n, g) => n + g.length, 0);
  assert.equal(total, 100); // nothing lost by grouping
});

test('hash-tagged cache keys concentrate load: the price of a single-slot MGET is a single-node hot spot', () => {
  const tagged = Array.from({ length: 1000 }, (_, i) => `session:{tenant42}:${i}`);
  const slots = new Set(tagged.map((k) => groupBySlot([k]).keys().next().value));
  assert.equal(slots.size, 1); // all 1000 keys, one slot, one node
});

import { CacheAside, FakeKV } from './src/cache.ts';

test('a loader error is not cached: the next caller retries, and the failed single-flight entry is cleared', async () => {
  const kv = new FakeKV();
  let calls = 0;
  const c = new CacheAside<string>(
    kv,
    async () => {
      calls++;
      if (calls === 1) throw new Error('db timeout');
      return 'ok';
    },
    { ttlMs: 1000, negativeTtlMs: 100, now: () => kv.now },
  );
  await assert.rejects(c.get('k'), /db timeout/);
  assert.equal(await c.get('k'), 'ok'); // an error was not turned into a cached "not found"
  assert.equal(calls, 2);
});

test('negative: caching "not found" for a key that is created a moment later serves a miss until the negative TTL ends', async () => {
  const kv = new FakeKV();
  const db = new Map<string, string>();
  const c = new CacheAside<string>(kv, async (k) => db.get(k) ?? null, {
    ttlMs: 1000,
    negativeTtlMs: 100,
    now: () => kv.now,
  });
  assert.equal(await c.get('u1'), null);
  db.set('u1', 'Ada'); // created right after the miss
  assert.equal(await c.get('u1'), null); // still the cached absence
  kv.now = 101;
  assert.equal(await c.get('u1'), 'Ada'); // bounded by the negative TTL, which is why it must be short
});
