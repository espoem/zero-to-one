// Module 03 (hermetic): constants and formulas read from the Redis 8.0 sources, plus the SCAN visit order.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  activeExpireParams,
  evictionTimeLimitMicros,
  expectedHitsToReach,
  freedInBackground,
  lazyFreeEffort,
  lfuCounterAfterHits,
  parseKeysizes,
  scanOrder,
  slowCycleBudgetMicros,
} from './src/keyspace.ts';
import { mulberry32 } from './src/zset.ts';

test('active-expire-effort rescales every constant (expire.c activeExpireCycle)', () => {
  assert.deepEqual(activeExpireParams(1), {
    keysPerLoop: 20,
    acceptableStalePercent: 10,
    slowCpuPercent: 25,
    fastDurationMicros: 1000,
  });
  assert.deepEqual(activeExpireParams(10), {
    keysPerLoop: 65,
    acceptableStalePercent: 1,
    slowCpuPercent: 43,
    fastDurationMicros: 3250,
  });
});

test('negative: effort outside 1..10 is rejected, as CONFIG SET does', () => {
  for (const bad of [0, 11, 1.5, -1]) assert.throws(() => activeExpireParams(bad), RangeError);
});

test('slow cycle budget: 25 % of a 100 ms tick at hz 10, 2.5 ms at hz 100', () => {
  assert.equal(slowCycleBudgetMicros(1, 10), 25_000);
  assert.equal(slowCycleBudgetMicros(1, 100), 2_500);
  assert.equal(slowCycleBudgetMicros(10, 10), 43_000);
});

test('LFU: expected hits to reach a counter value match the redis.conf table', () => {
  // redis.conf (factor 10): 100 hits -> ~10, 1000 -> ~18, 100000 -> ~142, 1M -> 255 (saturated)
  assert.equal(expectedHitsToReach(10, 10), 105);
  assert.ok(Math.abs(expectedHitsToReach(18, 10) - 1000) < 250); // 793: the table rounds
  assert.ok(Math.abs(expectedHitsToReach(142, 10) - 100_000) < 10_000);
  assert.ok(expectedHitsToReach(255, 10) < 1_000_000); // saturates before 1M hits
  // closed form: factor * (c-5)(c-6)/2 + (c-5)
  const c = 40;
  assert.equal(expectedHitsToReach(c, 10), (10 * (c - 5) * (c - 6)) / 2 + (c - 5));
  // factor 0 means every access increments: the counter is 5 + hits, deterministic.
  assert.equal(expectedHitsToReach(25, 0), 20);
});

test('LFU: the simulated counter is monotone in hits and close to the closed form', () => {
  const rng = mulberry32(7);
  const runs = Array.from({ length: 200 }, () => lfuCounterAfterHits(10_000, 10, rng));
  const mean = runs.reduce((a, b) => a + b, 0) / runs.length;
  // inverting the closed form: 10 * (c-5)(c-6)/2 + (c-5) = 10 000  =>  c is about 50
  assert.ok(mean > 45 && mean < 56, `mean ${mean}`);
  assert.equal(lfuCounterAfterHits(1_000_000, 0, rng), 255);
});

test('lazy free: the 64 threshold is strict and counts allocations, not elements', () => {
  const set = (entries: number) => lazyFreeEffort({ type: 'set', encoding: 'hashtable', entries });
  assert.equal(freedInBackground(set(64)), false);
  assert.equal(freedInBackground(set(65)), true);
  assert.equal(freedInBackground(set(65), 2), false); // a shared object cannot be handed over
  assert.equal(freedInBackground(lazyFreeEffort({ type: 'other' })), false); // listpack, string, intset
  // a quicklist counts nodes: 64 nodes of ~8 KB is half a megabyte, still freed inline
  assert.equal(
    freedInBackground(lazyFreeEffort({ type: 'list', encoding: 'quicklist', nodes: 64 })),
    false,
  );
  const stream = lazyFreeEffort({ type: 'stream', radixNodes: 10, groups: 2, firstGroupPel: 50 });
  assert.equal(stream, 10 + 2 * 51);
});

test('INFO keysizes lines parse into power-of-two histogram bins', () => {
  const info =
    '# Keysizes\r\ndb0_distrib_strings_sizes:2=10,1K=3\r\ndb0_distrib_hashes_items:4=1,512=2\r\n' +
    'db3_distrib_lists_items:0=1\r\n';
  const lines = parseKeysizes(info);
  assert.equal(lines.length, 3);
  assert.deepEqual(lines[0], { db: 0, kind: 'strings_sizes', bins: { '2': 10, '1K': 3 } });
  assert.equal(lines[2]?.db, 3);
  assert.throws(() => parseKeysizes('db0_distrib_sets_items:4=x'), /malformed/);
  assert.deepEqual(parseKeysizes('# Keysizes\r\n'), []);
});

test('SCAN visit order is bit-reversed counting, not 0,1,2,3', () => {
  assert.deepEqual(scanOrder(2), [0, 2, 1, 3]);
  assert.deepEqual(scanOrder(3), [0, 4, 2, 6, 1, 5, 3, 7]);
  // each smaller table's order is the larger table's order restricted to the low bits
  const small = scanOrder(2);
  const big = scanOrder(3)
    .filter((_, i) => i % 2 === 0)
    .map((b) => b & 3);
  assert.deepEqual(big, small);
});

test('eviction time budget: linear to 500 us at tenacity 10, geometric after, unlimited at 100', () => {
  assert.equal(evictionTimeLimitMicros(0), 0);
  assert.equal(evictionTimeLimitMicros(10), 500); // the default
  assert.equal(evictionTimeLimitMicros(11), 575);
  const t99 = evictionTimeLimitMicros(99);
  assert.ok(t99 > 100e6 && t99 < 140e6, `about two minutes, got ${t99} us`);
  assert.equal(evictionTimeLimitMicros(100), Number.POSITIVE_INFINITY);
  for (let t = 1; t <= 99; t++)
    assert.ok(evictionTimeLimitMicros(t) > evictionTimeLimitMicros(t - 1));
});

test('negative: tenacity above 100 or non-integer is rejected', () => {
  assert.throws(() => evictionTimeLimitMicros(101), RangeError);
  assert.throws(() => evictionTimeLimitMicros(-1), RangeError);
  assert.throws(() => evictionTimeLimitMicros(2.5), RangeError);
});
