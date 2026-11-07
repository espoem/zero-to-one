// Module 08: query syntax escaping, vector blobs and distances, k-NN ground truth,
// Bloom sizing and scalable-filter error bounds, HLL error.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  escapeTag,
  tagQuery,
  numericRange,
  float32Blob,
  fromFloat32Blob,
  cosineDistance,
  knn,
  recallAtK,
  bloomParams,
  bloomBytes,
  scalableBloom,
  HLL_STD_ERROR,
} from './src/query.ts';
import { mulberry32 } from './src/zset.ts';

test('TAG values with punctuation or spaces are escaped so they stay one tag', () => {
  assert.equal(escapeTag('new-york'), 'new\\-york');
  assert.equal(escapeTag('user@example.com'), 'user\\@example\\.com');
  assert.equal(
    tagQuery('city', ['San Francisco', 'new-york']),
    '@city:{San\\ Francisco | new\\-york}',
  );
});

test('negative: unescaped user input can inject query operators', () => {
  const evil = 'x} | @role:{admin';
  const naive = `@tenant:{${evil}}`;
  assert.ok(naive.includes('@role:{admin')); // a second clause appears
  const safe = tagQuery('tenant', [evil]);
  assert.ok(!/[^\\]\|/.test(safe.slice('@tenant:{'.length, -1)), safe); // every | escaped
  assert.throws(() => tagQuery('ten ant', ['x']), /unsafe field/);
});

test('NUMERIC ranges: inclusive by default, "(" for exclusive, infinities', () => {
  assert.equal(numericRange('price', 10, 20), '@price:[10 20]');
  assert.equal(numericRange('price', 10, 20, { minExclusive: true }), '@price:[(10 20]');
  assert.equal(numericRange('age', -Infinity, 18, { maxExclusive: true }), '@age:[-inf (18]');
  assert.throws(() => numericRange('x', 2, 1));
});

test('vectors travel as little-endian FLOAT32 blobs; float64 precision is lost', () => {
  const v = [0.1, -2.5, 3];
  const b = float32Blob(v);
  assert.equal(b.length, 12);
  const back = fromFloat32Blob(b);
  assert.equal(back[1], -2.5);
  assert.notEqual(back[0], 0.1); // 0.1 is not representable in float32
  assert.ok(Math.abs(back[0]! - 0.1) < 1e-7);
});

test('COSINE distance is 1 - similarity: 0 same direction, 1 orthogonal, 2 opposite; scale-invariant', () => {
  assert.ok(Math.abs(cosineDistance([1, 0], [5, 0])) < 1e-12);
  assert.ok(Math.abs(cosineDistance([1, 0], [0, 3]) - 1) < 1e-12);
  assert.ok(Math.abs(cosineDistance([1, 0], [-1, 0]) - 2) < 1e-12);
});

test('exact k-NN (FLAT) is the ground truth for recall of approximate indexes', () => {
  const rng = mulberry32(1);
  const items = Array.from({ length: 500 }, (_, i) => ({
    id: `doc:${i}`,
    v: Array.from({ length: 8 }, () => rng() - 0.5),
  }));
  const q = items[42]!.v;
  const exact = knn(q, items, 10).map((x) => x.id);
  assert.equal(exact[0], 'doc:42'); // the query point itself, distance 0
  // A "fast" approximate search that only looks at half the data:
  const approx = knn(q, items.slice(0, 250), 10).map((x) => x.id);
  const r = recallAtK(approx, exact);
  assert.ok(r < 1 && r > 0);
});

test('Bloom sizing: 1 % error needs ~9.6 bits and 7 hashes per element', () => {
  const p = bloomParams(0.01);
  assert.ok(Math.abs(p.bitsPerElement - 9.585) < 0.01);
  assert.equal(p.hashes, 7);
  // 10 M elements at 0.1 %: ~17 MB, versus hundreds of MB for a Redis set of the same IDs.
  const mb = bloomBytes(10_000_000, 0.001) / 2 ** 20;
  assert.ok(mb > 16 && mb < 18, `${mb} MB`);
});

test('scalable Bloom: overflowing capacity adds sub-filters; compound error stays below 2p', () => {
  const r = scalableBloom(1_000, 0.01, 2, 15_000);
  assert.equal(r.filters, 4); // 1k + 2k + 4k + 8k >= 15k
  assert.ok(r.compoundErrorBound < 0.02);
  assert.ok(r.compoundErrorBound > 0.01);
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 1e6 }),
      fc.double({ min: 1e-4, max: 0.1, noNaN: true }),
      fc.integer({ min: 2, max: 4 }),
      (n, p, e) => {
        assert.ok(scalableBloom(1_000, p, e, n).compoundErrorBound < 2 * p);
      },
    ),
  );
});

test('negative: an error rate outside (0,1) is rejected (BF.RESERVE rejects it too)', () => {
  assert.throws(() => bloomParams(0), RangeError);
  assert.throws(() => bloomParams(1), RangeError);
});

test('HyperLogLog in Redis: 16384 registers give a standard error of 0.81 %', () => {
  assert.ok(Math.abs(HLL_STD_ERROR - 0.008125) < 1e-6);
});
