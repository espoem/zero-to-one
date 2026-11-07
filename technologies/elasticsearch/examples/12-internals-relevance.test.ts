/**
 * Module 12: postings compression (delta + bit-packed blocks of 128), skipping
 * conjunctions, and the _rank_eval metrics checked against hand-computed values.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  encodePostings,
  decodePostings,
  encodedBytes,
  intersectWithSkips,
  intersectNaive,
  BLOCK,
  precisionAtK,
  recallAtK,
  reciprocalRank,
  dcg,
  ndcg,
  err,
} from './lib/internals.ts';

const sortedUnique = fc
  .uniqueArray(fc.integer({ min: 0, max: 1_000_000 }), { maxLength: 600 })
  .map((a) => a.sort((x, y) => x - y));

describe('postings compression', () => {
  it('property: decode(encode(docs)) == docs', () => {
    fc.assert(
      fc.property(
        sortedUnique,
        (docs) => JSON.stringify(decodePostings(encodePostings(docs))) === JSON.stringify(docs),
      ),
    );
  });

  it('full blocks of 128 are bit-packed; the remainder is a tail', () => {
    const docs = Array.from({ length: 300 }, (_, i) => i * 3);
    const e = encodePostings(docs);
    assert.equal(e.blocks.length, 2);
    assert.equal(e.tail.length, 300 - 2 * BLOCK);
    assert.equal(e.blocks[1]!.bitsPerValue, 2, 'deltas of 3 need 2 bits');
  });

  it('dense postings compress to a few bits per doc instead of 32', () => {
    const docs = Array.from({ length: 128 * 50 }, (_, i) => i * 2 + (i % 3 === 0 ? 1 : 0));
    const e = encodePostings(docs);
    assert.ok(
      (encodedBytes(e) * 8) / docs.length < 3,
      `${(encodedBytes(e) * 8) / docs.length} bits/doc`,
    );
  });

  it('rare terms (large gaps) cost more bits per doc than common terms', () => {
    const common = Array.from({ length: 1280 }, (_, i) => i * 2);
    const rare = Array.from({ length: 1280 }, (_, i) => i * 5000);
    assert.ok(encodedBytes(encodePostings(rare)) > encodedBytes(encodePostings(common)) * 4);
  });

  it('negative: unsorted doc ids are rejected', () => {
    assert.throws(() => encodePostings([5, 3]), /strictly increasing/);
  });
});

describe('conjunctions', () => {
  it('property: skipping intersection equals the naive merge', () => {
    fc.assert(
      fc.property(
        fc.array(sortedUnique, { minLength: 1, maxLength: 4 }),
        (lists) =>
          JSON.stringify(intersectWithSkips(lists).docs) ===
          JSON.stringify(intersectNaive(lists).docs),
      ),
    );
  });

  it('a rare term AND a common term costs ~ rare x log(common), not rare + common', () => {
    const common = Array.from({ length: 100000 }, (_, i) => i);
    const rare = [17, 50000, 99999];
    const skip = intersectWithSkips([common, rare]);
    const naive = intersectNaive([common, rare]);
    assert.deepEqual(skip.docs, rare);
    assert.ok(skip.comparisons < 200, `${skip.comparisons}`);
    assert.ok(naive.comparisons > 50000);
  });
});

describe('_rank_eval metrics', () => {
  const ratings = new Map([
    ['d1', 3],
    ['d2', 2],
    ['d3', 0],
    ['d4', 1],
    ['d5', 3],
  ]);
  const hits = ['d3', 'd1', 'd6', 'd2', 'd4'];

  it('precision@k counts rated-relevant hits (unrated counts as irrelevant by default)', () => {
    assert.equal(precisionAtK(hits, ratings, 5), 3 / 5);
    assert.equal(precisionAtK(hits, ratings, 5, 1, true), 3 / 4, 'ignore_unlabeled drops d6');
    assert.equal(precisionAtK(hits, ratings, 5, 2), 2 / 5, 'relevant_rating_threshold 2');
  });

  it('recall@k and MRR', () => {
    assert.equal(recallAtK(hits, ratings, 5), 3 / 4);
    assert.equal(reciprocalRank(hits, ratings), 1 / 2);
  });

  it('DCG and nDCG match a hand computation', () => {
    const expected = 7 / Math.log2(3) + 3 / Math.log2(5) + 1 / Math.log2(6);
    assert.ok(Math.abs(dcg(hits, ratings, 5) - expected) < 1e-12);
    const ideal = 7 / Math.log2(2) + 7 / Math.log2(3) + 3 / Math.log2(4) + 1 / Math.log2(5);
    assert.ok(Math.abs(ndcg(hits, ratings, 5) - expected / ideal) < 1e-12);
  });

  it('property: nDCG is in [0, 1] and equals 1 for the ideal ordering', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 1, maxLength: 12 }),
        (grades) => {
          const r = new Map(grades.map((g, i) => [`d${i}`, g]));
          const ideal = [...r.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
          const shuffled = [...r.keys()].reverse();
          const n = ndcg(shuffled, r);
          return (
            n >= 0 &&
            n <= 1 + 1e-12 &&
            (grades.every((g) => g === 0) || Math.abs(ndcg(ideal, r) - 1) < 1e-12)
          );
        },
      ),
    );
  });

  it('ERR rewards a highly relevant first hit far more than the same hit lower down', () => {
    const top = err(['d1', 'd3', 'd3'], ratings, 3);
    const low = err(['d3', 'd3', 'd1'], ratings, 3);
    assert.ok(Math.abs(top - 7 / 8) < 1e-12);
    assert.ok(top > 2.5 * low);
  });
});
