/**
 * Module 07: aggregation math. terms accuracy across shards (a counterexample with
 * shard_size 1, error-bound properties), HyperLogLog cardinality error and mergeability,
 * correct distributed avg, histogram/date_histogram keys, composite pagination and
 * the bucket limit, plus aggregations run through the model index (doc values).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  termsAgg,
  exactTerms,
  defaultShardSize,
  Hll,
  avgPartial,
  reduceAvg,
  avgOfAvgs,
  histogramKey,
  calendarKey,
  fixedIntervalKey,
  composite,
  checkMaxBuckets,
} from './lib/aggs.ts';

const rep = (k: string, n: number) => Array.from({ length: n }, () => k);

describe('terms aggregation accuracy', () => {
  // y is the true top term (27 docs) but never in any single shard's top 1.
  const shards = [
    [...rep('x', 10), ...rep('y', 9)],
    [...rep('z', 10), ...rep('y', 9)],
    [...rep('w', 10), ...rep('y', 9)],
  ];

  it('negative: with shard_size 1 the coordinator returns a wrong top term', () => {
    const r = termsAgg(shards, 1, 1);
    assert.deepEqual(exactTerms(shards, 1), [{ key: 'y', doc_count: 27 }]);
    assert.equal(r.buckets[0]!.key, 'w');
    assert.equal(r.buckets[0]!.doc_count, 10);
    // bound = sum over shards of the count of the last term each shard returned (10 + 10 + 10)
    assert.equal(r.doc_count_error_upper_bound, 30);
    assert.equal(
      r.buckets[0]!.doc_count_error_upper_bound,
      20,
      'w could have up to 10 hidden docs on each of the two other shards',
    );
    assert.equal(r.sum_other_doc_count, 57 - 10);
  });

  it('raising shard_size fixes it (the default shard_size for size 1 is 11)', () => {
    assert.equal(defaultShardSize(1), 11);
    const r = termsAgg(shards, 1);
    assert.deepEqual(
      r.buckets.map((b) => [b.key, b.doc_count]),
      [['y', 27]],
    );
    assert.equal(r.doc_count_error_upper_bound, 0, 'every shard returned all its terms');
  });

  const shardsArb = fc.array(
    fc.array(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g'), { maxLength: 40 }),
    { minLength: 1, maxLength: 5 },
  );

  it('property: reported counts never exceed the truth, and the per-bucket error bounds the gap', () => {
    fc.assert(
      fc.property(
        shardsArb,
        fc.integer({ min: 1, max: 4 }),
        fc.integer({ min: 1, max: 5 }),
        (shards, size, shardSize) => {
          const truth = new Map(exactTerms(shards, 100).map((b) => [b.key, b.doc_count]));
          const r = termsAgg(shards, size, shardSize);
          return r.buckets.every(
            (b) =>
              b.doc_count <= truth.get(b.key)! &&
              truth.get(b.key)! - b.doc_count <= b.doc_count_error_upper_bound!,
          );
        },
      ),
    );
  });

  it('property: if shard_size covers every distinct term, the result is exact with zero error', () => {
    fc.assert(
      fc.property(shardsArb, fc.integer({ min: 1, max: 7 }), (shards, size) => {
        const r = termsAgg(shards, size, 7);
        return (
          r.doc_count_error_upper_bound === 0 &&
          JSON.stringify(r.buckets.map(({ key, doc_count }) => ({ key, doc_count }))) ===
            JSON.stringify(exactTerms(shards, size))
        );
      }),
    );
  });

  it('a single shard is always exact', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('a', 'b', 'c', 'd'), { maxLength: 50 }),
        fc.integer({ min: 1, max: 3 }),
        (vals, size) => {
          const r = termsAgg([vals], size, size);
          return (
            JSON.stringify(r.buckets.map(({ key, doc_count }) => ({ key, doc_count }))) ===
            JSON.stringify(exactTerms([vals], size))
          );
        },
      ),
    );
  });
});

describe('cardinality (HyperLogLog)', () => {
  it('is exact below precision_threshold', () => {
    const h = new Hll(14, 3000);
    for (let i = 0; i < 2000; i++) h.add(`user-${i % 1500}`);
    assert.equal(h.estimate(), 1500);
  });

  it('stays within 3 standard errors above the threshold (p = 14, ~0.8% error)', () => {
    const h = new Hll(14, 100);
    const n = 50000;
    for (let i = 0; i < n; i++) h.add(`id-${i}`);
    const rel = Math.abs(h.estimate() - n) / n;
    assert.ok(rel < 3 * h.standardError, `relative error ${rel}`);
  });

  it('is mergeable: merging shard sketches equals the sketch of the union', () => {
    const a = new Hll(12, 0);
    const b = new Hll(12, 0);
    const u = new Hll(12, 0);
    for (let i = 0; i < 5000; i++) {
      a.add(`k${i}`);
      u.add(`k${i}`);
    }
    for (let i = 2500; i < 9000; i++) {
      b.add(`k${i}`);
      u.add(`k${i}`);
    }
    a.merge(b);
    assert.deepEqual(a.registers, u.registers);
    assert.equal(a.estimate(), u.estimate());
  });

  it('negative: summing per-shard distinct counts double-counts shared values', () => {
    const shard1 = ['u1', 'u2', 'u3'];
    const shard2 = ['u2', 'u3', 'u4'];
    assert.equal(new Set(shard1).size + new Set(shard2).size, 6);
    const a = new Hll();
    shard1.forEach((v) => a.add(v));
    const b = new Hll();
    shard2.forEach((v) => b.add(v));
    a.merge(b);
    assert.equal(a.estimate(), 4);
  });
});

describe('metric reduction', () => {
  const shards = [[10, 10, 10, 10], [100]];

  it('negative: the average of shard averages is wrong for unequal shard sizes', () => {
    assert.equal(avgOfAvgs(shards), 55);
  });

  it('avg must be reduced from (sum, count) partials', () => {
    assert.equal(reduceAvg(shards.map(avgPartial)), 28);
  });

  it('property: (sum, count) reduction is independent of how docs are split into shards', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -1000, max: 1000 }), { minLength: 1, maxLength: 50 }),
        fc.integer({ min: 1, max: 6 }),
        (xs, k) => {
          const parts: number[][] = Array.from({ length: k }, () => []);
          xs.forEach((x, i) => parts[i % k]!.push(x));
          const nonEmpty = parts.filter((p) => p.length > 0);
          return (
            Math.abs(
              reduceAvg(nonEmpty.map(avgPartial)) - xs.reduce((a, b) => a + b, 0) / xs.length,
            ) < 1e-9
          );
        },
      ),
    );
  });
});

describe('histograms', () => {
  it('histogram key = floor((v - offset) / interval) * interval + offset', () => {
    assert.equal(histogramKey(42, 10), 40);
    assert.equal(histogramKey(-1, 10), -10, 'floor, not truncation');
    assert.equal(histogramKey(42, 10, 5), 35);
    assert.throws(() => histogramKey(1, 0), /must be >0/);
  });

  it('fixed_interval 1h buckets in UTC', () => {
    const t = Date.UTC(2026, 10, 4, 13, 47);
    assert.equal(fixedIntervalKey(t, 3600000), Date.UTC(2026, 10, 4, 13));
  });

  it('calendar_interval 1d depends on time_zone: 23:30 UTC is already the next day in Prague (+01:00)', () => {
    const t = Date.UTC(2026, 10, 4, 23, 30);
    assert.equal(new Date(calendarKey(t, 'day', 0)).toISOString(), '2026-11-04T00:00:00.000Z');
    assert.equal(
      new Date(calendarKey(t, 'day', 60)).toISOString(),
      '2026-11-04T23:00:00.000Z',
      'key is local midnight 2026-11-05 expressed in UTC',
    );
  });

  it('calendar months have different lengths; fixed 30d intervals drift', () => {
    const feb = calendarKey(Date.UTC(2026, 1, 20), 'month');
    const mar = calendarKey(Date.UTC(2026, 2, 20), 'month');
    assert.equal((mar - feb) / 86400000, 28);
  });
});

describe('composite aggregation', () => {
  const docs = [
    { country: 'CZ', city: 'Brno' },
    { country: 'CZ', city: 'Brno' },
    { country: 'CZ', city: 'Praha' },
    { country: 'SK', city: 'Bratislava' },
    { country: 'CZ', city: 'Ostrava' },
    { country: 'AT', city: 'Wien' },
  ];

  it('pages through every bucket exactly once using after_key', () => {
    const seen: string[] = [];
    let after: Record<string, string | number> | undefined;
    for (;;) {
      const page = composite(docs, ['country', 'city'], 2, after);
      if (page.buckets.length === 0) break;
      seen.push(...page.buckets.map((b) => `${b.key['country']}/${b.key['city']}:${b.doc_count}`));
      after = page.after_key;
    }
    assert.deepEqual(seen, [
      'AT/Wien:1',
      'CZ/Brno:2',
      'CZ/Ostrava:1',
      'CZ/Praha:1',
      'SK/Bratislava:1',
    ]);
  });

  it('search.max_buckets rejects responses with too many buckets', () => {
    assert.throws(() => checkMaxBuckets(70000), /too_many_buckets_exception/);
    assert.doesNotThrow(() => checkMaxBuckets(65536));
  });
});
