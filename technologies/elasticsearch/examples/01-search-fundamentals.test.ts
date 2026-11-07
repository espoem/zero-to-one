/**
 * Module 01: inverted index, postings, term dictionary order, BM25 (checked against the
 * formula by hand), Lucene's one-byte length norms, query vs filter context, and IR metrics.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { Shard, intToByte4, byte4ToInt, NUM_FREE_VALUES, compareBytes } from './lib/lucene.ts';
import { idf, tfNorm, bm25, searchShard, DEFAULT_BM25 } from './lib/search.ts';
import type { Mapping } from './lib/mapping.ts';

const mapping: Mapping = {
  properties: {
    title: { type: 'text', fields: { keyword: { type: 'keyword', ignore_above: 256 } } },
    tag: { type: 'keyword' },
  },
};

function corpus(): Shard {
  const s = new Shard({ mapping });
  s.index('1', { title: 'The quick brown fox', tag: 'animal' });
  s.index('2', {
    title: 'Quick quick quick fox jumps over the lazy dog again and again',
    tag: 'animal',
  });
  s.index('3', { title: 'Brown sugar', tag: 'food' });
  s.index('4', { title: 'Lazy Sunday', tag: 'day' });
  s.refresh();
  return s;
}

/** Precision/recall/F1 and precision@k, the evaluation measures of Manning et al., ch. 8. */
function prf(retrieved: string[], relevant: Set<string>) {
  const tp = retrieved.filter((d) => relevant.has(d)).length;
  const precision = retrieved.length === 0 ? 1 : tp / retrieved.length;
  const recall = relevant.size === 0 ? 1 : tp / relevant.size;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { precision, recall, f1 };
}

describe('inverted index structure', () => {
  it('builds postings with doc ids, term frequencies and positions', () => {
    const s = corpus();
    const seg = s.segments[0]!;
    const quick = seg.fields.get('title')!.postings.get('quick')!;
    assert.deepEqual(
      quick.map((p) => [seg.ids[p.doc], p.freq, p.positions]),
      [
        ['1', 1, [1]],
        ['2', 3, [0, 1, 2]],
      ],
    );
  });

  it('keeps the term dictionary sorted by UTF-8 bytes, not UTF-16 code units', () => {
    // U+FF21 (fullwidth A, 3 UTF-8 bytes EF BC A1) vs U+1F600 (emoji, 4 bytes F0 9F 98 80):
    // UTF-16 code units order the emoji's high surrogate (D83D) BEFORE FF21; UTF-8 bytes put it AFTER.
    const a = 'Ａ';
    const b = '\u{1F600}';
    assert.ok(a > b, 'JS string comparison (UTF-16) says emoji < fullwidth A');
    assert.ok(compareBytes(a, b) < 0, 'Lucene byte order says fullwidth A < emoji');
    const seg = corpus().segments[0]!;
    const dict = seg.termDictionary('title');
    assert.deepEqual(dict, [...dict].sort(compareBytes));
  });

  it('indexes keyword values as single un-analysed terms (no norms)', () => {
    const seg = corpus().segments[0]!;
    assert.deepEqual(seg.termDictionary('title.keyword'), [
      'Brown sugar',
      'Lazy Sunday',
      'Quick quick quick fox jumps over the lazy dog again and again',
      'The quick brown fox',
    ]);
    assert.equal(seg.fields.get('title.keyword')!.norms.size, 0);
  });
});

describe('BM25 matches the formula', () => {
  it('scores a single-term match exactly as idf * tf computed by hand', () => {
    const s = corpus();
    const [top] = searchShard(s, { match: { title: 'sugar' } });
    // N = 4 docs with a title, n = 1 contains "sugar"
    const N = 4;
    const n = 1;
    const sumTtf = 4 + 12 + 2 + 2; // tokens per title
    const avgdl = sumTtf / N;
    const expected =
      Math.log(1 + (N - n + 0.5) / (n + 0.5)) * (1 / (1 + 1.2 * (1 - 0.75 + (0.75 * 2) / avgdl)));
    assert.equal(top!.id, '3');
    assert.ok(Math.abs(top!.score - expected) < 1e-12, `${top!.score} vs ${expected}`);
  });

  it('sums term contributions for a multi-term match (Lucene 7+: no coord factor)', () => {
    const s = corpus();
    const both = searchShard(s, { match: { title: 'brown fox' } }).find((h) => h.id === '1')!;
    const brown = searchShard(s, { match: { title: 'brown' } }).find((h) => h.id === '1')!;
    const fox = searchShard(s, { match: { title: 'fox' } }).find((h) => h.id === '1')!;
    assert.ok(Math.abs(both.score - (brown.score + fox.score)) < 1e-12);
  });

  it('idf is always positive (Lucene adds 1 inside the log), even for a term in every doc', () => {
    assert.ok(idf(10, 10) > 0);
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1e6 }),
        fc.integer({ min: 0, max: 1e6 }),
        (N, n0) => idf(Math.min(n0, N), N) > 0,
      ),
    );
  });

  it('term frequency saturates: tf -> 1 as freq -> infinity, and is monotone', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1, max: 200 }),
        (freq, dl) => {
          const a = tfNorm(freq, dl, 10);
          const b = tfNorm(freq + 1, dl, 10);
          return a < b && b < 1;
        },
      ),
    );
  });

  it('b = 0 disables length normalisation; b = 1 normalises fully', () => {
    const p0 = { ...DEFAULT_BM25, b: 0 };
    assert.equal(tfNorm(1, 5, 10, p0), tfNorm(1, 500, 10, p0));
    assert.ok(tfNorm(1, 5, 10, { k1: 1.2, b: 1 }) > tfNorm(1, 500, 10, { k1: 1.2, b: 1 }));
  });

  it('a longer field with the same tf scores lower (length normalisation)', () => {
    const s = corpus();
    const hits = searchShard(s, { match: { title: 'lazy' } });
    assert.deepEqual(
      hits.map((h) => h.id),
      ['4', '2'],
    ); // "Lazy Sunday" (2 tokens) beats the 12-token title
  });
});

describe('Lucene stores length norms in one byte (SmallFloat.intToByte4)', () => {
  it('encodes lengths below 24 exactly', () => {
    assert.equal(NUM_FREE_VALUES, 24);
    for (let i = 0; i < NUM_FREE_VALUES; i++) assert.equal(byte4ToInt(intToByte4(i)), i);
  });

  it('is lossy above 24: decode(encode(x)) <= x, monotone, and fits in a byte', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 ** 31 - 1 }),
        fc.integer({ min: 0, max: 2 ** 31 - 1 }),
        (x, y) => {
          const ex = intToByte4(x);
          const ok = ex >= 0 && ex <= 255 && byte4ToInt(ex) <= x;
          return ok && (x <= y ? ex <= intToByte4(y) : ex >= intToByte4(y));
        },
      ),
    );
  });

  it('counterexample: two different field lengths can produce the same norm and hence the same score', () => {
    assert.equal(intToByte4(1000), intToByte4(1010));
    const stats = { docFreq: 1, docCount: 10, sumTotalTermFreq: 5000 };
    assert.equal(bm25(1, intToByte4(1000), stats), bm25(1, intToByte4(1010), stats));
  });
});

describe('query context vs filter context', () => {
  it('a filter clause contributes 0 to the score; the same clause in must contributes BM25', () => {
    const s = corpus();
    const asFilter = searchShard(s, { bool: { filter: [{ match: { title: 'fox' } }] } });
    const asMust = searchShard(s, { bool: { must: [{ match: { title: 'fox' } }] } });
    assert.deepEqual(
      asFilter.map((h) => h.score),
      [0, 0],
    );
    assert.ok(asMust.every((h) => h.score > 0));
    assert.deepEqual(new Set(asFilter.map((h) => h.id)), new Set(asMust.map((h) => h.id)));
  });

  it('negative: term on an analysed text field misses because the index holds lowercase tokens', () => {
    const s = corpus();
    assert.equal(searchShard(s, { term: { title: 'Quick' } }).length, 0);
    assert.equal(searchShard(s, { term: { title: 'quick' } }).length, 2);
    assert.equal(searchShard(s, { match: { title: 'Quick' } }).length, 2);
    assert.equal(searchShard(s, { term: { 'title.keyword': 'Brown sugar' } }).length, 1);
  });
});

describe('IR evaluation', () => {
  it('computes precision, recall and F1 for a result list', () => {
    const r = prf(['1', '2', '3'], new Set(['1', '3', '4', '5']));
    assert.equal(r.precision, 2 / 3);
    assert.equal(r.recall, 0.5);
    assert.ok(Math.abs(r.f1 - 4 / 7) < 1e-12);
  });

  it('shows the precision/recall trade-off: operator and raises precision and lowers recall', () => {
    const s = corpus();
    const relevant = new Set(['1']); // the user wanted "quick brown fox"
    const or = searchShard(s, {
      match: { title: { query: 'quick brown fox', operator: 'or' } },
    }).map((h) => h.id);
    const and = searchShard(s, {
      match: { title: { query: 'quick brown fox', operator: 'and' } },
    }).map((h) => h.id);
    assert.ok(prf(and, relevant).precision > prf(or, relevant).precision);
    assert.ok(prf(and, relevant).recall >= prf(or, relevant).recall);
  });
});
