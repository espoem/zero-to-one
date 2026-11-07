/**
 * Module 09: kNN score transformations, recall against brute-force ground truth,
 * scalar and binary quantisation with oversampled rescoring, memory arithmetic,
 * filtered kNN (pre- vs post-filter), and hybrid fusion with RRF and linear retrievers.
 * All data is generated from a fixed seed.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  dataset,
  exactKnn,
  recallAtK,
  esScore,
  fitScalar,
  quantize,
  dequantize,
  binaryKnn,
  bytesPerVector,
  postFilteredKnn,
  rrf,
  linearFusion,
  cosine,
  normalize,
  rng,
  gaussian,
  type Vec,
} from './lib/vector.ts';

const DIMS = 64;
const docs = dataset(2000, DIMS, 42);
const queries = dataset(20, DIMS, 7);
const K = 10;

function meanRecall(search: (q: Vec) => number[]): number {
  return (
    queries.reduce((s, q) => s + recallAtK(search(q), exactKnn(q, docs, K)), 0) / queries.length
  );
}

describe('similarity to _score', () => {
  const vec = fc
    .array(fc.float({ min: -1, max: 1, noNaN: true }), { minLength: 4, maxLength: 4 })
    .filter((a) => a.some((x) => Math.abs(x) > 0.01))
    .map((a) => normalize(Float32Array.from(a)));

  it('every similarity maps to a non-negative score (Lucene requires scores >= 0; float rounding aside)', () => {
    fc.assert(
      fc.property(vec, vec, (a, b) =>
        (['cosine', 'dot_product', 'l2_norm', 'max_inner_product'] as const).every(
          (s) => esScore(s, a, b) >= -1e-6,
        ),
      ),
    );
  });

  it('cosine score = (1 + cos) / 2: identical vectors score 1, opposite score 0', () => {
    const v = normalize(Float32Array.from([1, 2, 3]));
    const neg = Float32Array.from(v, (x) => -x);
    assert.ok(Math.abs(esScore('cosine', v, v) - 1) < 1e-6);
    assert.ok(Math.abs(esScore('cosine', v, neg)) < 1e-6);
  });

  it('for unit vectors cosine and dot_product rank identically (dot_product skips the norm)', () => {
    const q = queries[0]!;
    assert.deepEqual(exactKnn(q, docs, K, 'cosine'), exactKnn(q, docs, K, 'dot_product'));
  });

  it('l2_norm score = 1 / (1 + d^2) is monotone decreasing in distance', () => {
    const o = Float32Array.from([0, 0]);
    assert.ok(
      esScore('l2_norm', o, Float32Array.from([1, 0])) >
        esScore('l2_norm', o, Float32Array.from([2, 0])),
    );
  });
});

describe('quantisation', () => {
  it('int8 scalar quantisation keeps recall@10 very high', () => {
    const sq = fitScalar(docs, 8);
    const deq = docs.map((d) => dequantize(sq, quantize(sq, d)));
    const r = meanRecall((q) =>
      deq
        .map((d, i) => ({ i, s: cosine(q, d) }))
        .sort((a, b) => b.s - a.s)
        .slice(0, K)
        .map((x) => x.i),
    );
    assert.ok(r >= 0.9, `int8 recall ${r}`);
  });

  it('int4 loses more than int8', () => {
    const recallFor = (bits: 4 | 8) => {
      const sq = fitScalar(docs, bits);
      const deq = docs.map((d) => dequantize(sq, quantize(sq, d)));
      return meanRecall((q) =>
        deq
          .map((d, i) => ({ i, s: cosine(q, d) }))
          .sort((a, b) => b.s - a.s)
          .slice(0, K)
          .map((x) => x.i),
      );
    };
    assert.ok(recallFor(4) < recallFor(8));
  });

  it('negative: 1-bit codes alone have poor recall; oversampling + float rescoring recovers it', () => {
    const raw = meanRecall((q) => binaryKnn(q, docs, K, 1));
    const rescored = meanRecall((q) => binaryKnn(q, docs, K, 5));
    assert.ok(raw < 0.8, `raw binary recall ${raw}`);
    assert.ok(rescored > raw + 0.15, `rescored ${rescored} vs raw ${raw}`);
  });

  it('memory: float32 vs int8 vs int4 vs ~1 bit per dimension', () => {
    const d = 1024;
    assert.equal(bytesPerVector(d, 'float'), 4096);
    assert.ok(bytesPerVector(d, 'int8') / bytesPerVector(d, 'float') < 0.26);
    assert.ok(bytesPerVector(d, 'int4') / bytesPerVector(d, 'float') < 0.13);
    assert.ok(bytesPerVector(d, 'float') / bytesPerVector(d, 'bbq') > 28, 'about 32x smaller');
    // 10M vectors of 1024 dims: ~41 GB float vs ~1.4 GB BBQ (vector data only)
    assert.equal(Math.round((1e7 * bytesPerVector(d, 'float')) / 1e9), 41);
  });

  it('scalar quantiser clips to confidence-interval quantiles', () => {
    const r = rng(1);
    const withOutlier = [
      ...docs.slice(0, 200),
      Float32Array.from({ length: DIMS }, () => 50 * gaussian(r)),
    ];
    const sq = fitScalar(withOutlier, 8, 0.99);
    assert.ok(sq.hi < 5, 'a single outlier does not stretch the range');
  });
});

describe('filtered kNN', () => {
  const selective = (i: number) => i % 50 === 0; // 2% of docs pass

  it('negative: post-filtering the top num_candidates returns fewer than k results', () => {
    const q = queries[0]!;
    assert.ok(postFilteredKnn(q, docs, K, 100, selective).length < K);
  });

  it('pre-filtering (what the knn filter option does) always returns k matching docs', () => {
    const q = queries[0]!;
    const res = exactKnn(q, docs, K, 'cosine', selective);
    assert.equal(res.length, K);
    assert.ok(res.every(selective));
  });
});

describe('hybrid search fusion', () => {
  it('RRF: score = sum of 1 / (60 + rank)', () => {
    const fused = rrf([
      ['a', 'b', 'c'],
      ['c', 'a', 'd'],
    ]);
    assert.equal(fused[0]!.id, 'a');
    assert.ok(Math.abs(fused[0]!.score - (1 / 61 + 1 / 62)) < 1e-12);
    assert.deepEqual(
      fused.map((f) => f.id),
      ['a', 'c', 'b', 'd'],
    );
  });

  it("RRF ignores raw score scales: multiplying one retriever's scores changes nothing", () => {
    const lexical = [
      { id: 'x', score: 12.5 },
      { id: 'y', score: 3.1 },
    ];
    const vector = [
      { id: 'y', score: 0.91 },
      { id: 'z', score: 0.88 },
    ];
    const scaled = lexical.map((h) => ({ ...h, score: h.score * 1000 }));
    const ids = (l: typeof lexical) => l.map((h) => h.id);
    assert.deepEqual(rrf([ids(lexical), ids(vector)]), rrf([ids(scaled), ids(vector)]));
  });

  it('documents outside rank_window_size contribute nothing', () => {
    const fused = rrf([['a', 'b', 'c'], ['c']], 60, 2);
    assert.equal(fused.find((f) => f.id === 'c')!.score, 1 / 61);
  });

  it('linear fusion depends on normalisation and weights', () => {
    const lexical = [
      { id: 'x', score: 10 },
      { id: 'y', score: 5 },
      { id: 'w', score: 0 },
    ];
    const vector = [
      { id: 'y', score: 0.9 },
      { id: 'x', score: 0.5 },
    ];
    assert.equal(linearFusion([lexical, vector], [1, 0.2])[0]!.id, 'x');
    assert.equal(linearFusion([lexical, vector], [0.2, 1])[0]!.id, 'y');
  });

  it('property: RRF is symmetric in the order of the input lists', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.constantFrom('a', 'b', 'c', 'd', 'e'), { maxLength: 5 }),
        fc.uniqueArray(fc.constantFrom('a', 'b', 'c', 'd', 'e'), { maxLength: 5 }),
        (l1, l2) => JSON.stringify(rrf([l1, l2])) === JSON.stringify(rrf([l2, l1])),
      ),
    );
  });
});
