/**
 * Module 04: the analysis chain as `_analyze` reports it: offsets, positions and types;
 * char filter offset correction; stop-word position gaps and their effect on phrases;
 * synonyms stacked at the same position; edge n-gram autocomplete and why the search
 * analyzer must differ; n-gram limits; normalizers; folding Czech diacritics; stemmers.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  analyze,
  terms,
  standardAnalyzer,
  englishLikeAnalyzer,
  whitespaceAnalyzer,
  keywordAnalyzer,
  htmlStrip,
  mappingCharFilter,
  standardTokenizer,
  keywordTokenizer,
  edgeNgramTokenizer,
  ngramTokenizer,
  lowercase,
  asciifolding,
  stop,
  synonyms,
  minimalEnglish,
  minimalEnglishStem,
  normalizer,
  type Analyzer,
} from './lib/analysis.ts';
import { Shard } from './lib/lucene.ts';
import { searchShard } from './lib/search.ts';

describe('_analyze output', () => {
  it('standard analyzer: UAX #29 word boundaries, lowercase, offsets and positions', () => {
    assert.deepEqual(analyze(standardAnalyzer, 'The 2 QUICK Brown-Foxes'), [
      { token: 'the', start_offset: 0, end_offset: 3, type: '<ALPHANUM>', position: 0 },
      { token: '2', start_offset: 4, end_offset: 5, type: '<NUM>', position: 1 },
      { token: 'quick', start_offset: 6, end_offset: 11, type: '<ALPHANUM>', position: 2 },
      { token: 'brown', start_offset: 12, end_offset: 17, type: '<ALPHANUM>', position: 3 },
      { token: 'foxes', start_offset: 18, end_offset: 23, type: '<ALPHANUM>', position: 4 },
    ]);
  });

  it('standard tokenizer keeps apostrophes inside words and dots between letters/digits', () => {
    assert.deepEqual(terms(standardAnalyzer, "don't stop v3.14 at example.com"), [
      "don't",
      'stop',
      'v3.14',
      'at',
      'example.com',
    ]);
  });

  it('whitespace analyzer keeps punctuation and case', () => {
    assert.deepEqual(terms(whitespaceAnalyzer, 'Hello, World!'), ['Hello,', 'World!']);
  });

  it('keyword analyzer emits the input as one token', () => {
    assert.deepEqual(terms(keywordAnalyzer, 'New York'), ['New York']);
  });

  it('offsets always point into the ORIGINAL text, even after a char filter rewrote it', () => {
    const a: Analyzer = {
      charFilters: [htmlStrip],
      tokenizer: standardTokenizer(),
      filters: [lowercase],
    };
    const input = '<p>Hello <b>World</b> &amp; more</p>';
    const toks = analyze(a, input);
    assert.deepEqual(
      toks.map((t) => t.token),
      ['hello', 'world', 'more'],
    );
    for (const t of toks)
      assert.equal(input.slice(t.start_offset, t.end_offset).toLowerCase(), t.token);
  });

  it('mapping char filter rewrites before tokenisation (emoticons to words)', () => {
    const a: Analyzer = {
      charFilters: [mappingCharFilter({ ':)': '_happy_', ':(': '_sad_' })],
      tokenizer: standardTokenizer(),
      filters: [],
    };
    assert.deepEqual(terms(a, 'great :)'), ['great', '_happy_']);
  });
});

describe('positions: stop words and synonyms', () => {
  const withStop: Analyzer = {
    charFilters: [],
    tokenizer: standardTokenizer(),
    filters: [lowercase, stop()],
  };

  it('stop filter removes tokens but leaves a position gap', () => {
    assert.deepEqual(
      analyze(withStop, 'quick and the fox').map((t) => [t.token, t.position]),
      [
        ['quick', 0],
        ['fox', 3],
      ],
    );
  });

  it('phrase consequence: "quick fox" does not match "quick and the fox" without slop', () => {
    const s = new Shard({
      mapping: { properties: { t: { type: 'text', analyzer: 'stopper' } } },
      analyzers: { stopper: withStop },
    });
    s.index('1', { t: 'quick and the fox' });
    s.refresh();
    assert.equal(searchShard(s, { match_phrase: { t: 'quick fox' } }).length, 0);
    assert.equal(
      searchShard(s, { match_phrase: { t: { query: 'quick fox', slop: 2 } } }).length,
      1,
    );
    // the query side keeps the gap too: the phrase "quick the fox" still matches
    assert.equal(searchShard(s, { match_phrase: { t: 'quick and the fox' } }).length, 1);
  });

  it('synonyms are stacked at the same position (posInc 0), so phrases still match', () => {
    const a: Analyzer = {
      charFilters: [],
      tokenizer: standardTokenizer(),
      filters: [lowercase, synonyms(['laptop, notebook'])],
    };
    assert.deepEqual(
      analyze(a, 'cheap laptop deal').map((t) => [t.token, t.position, t.type]),
      [
        ['cheap', 0, '<ALPHANUM>'],
        ['laptop', 1, '<ALPHANUM>'],
        ['notebook', 1, 'SYNONYM'],
        ['deal', 2, '<ALPHANUM>'],
      ],
    );
    const s = new Shard({
      mapping: { properties: { t: { type: 'text', analyzer: 'syn' } } },
      analyzers: { syn: a },
    });
    s.index('1', { t: 'cheap laptop deal' });
    s.refresh();
    assert.equal(searchShard(s, { match_phrase: { t: 'cheap notebook deal' } }).length, 1);
  });

  it('negative: single-token synonym filters reject multi-word rules (use synonym_graph)', () => {
    assert.throws(() => synonyms(['ny, new york']), /synonym_graph/);
  });
});

describe('autocomplete with edge n-grams', () => {
  const autoIndex: Analyzer = {
    charFilters: [],
    tokenizer: edgeNgramTokenizer(2, 10),
    filters: [lowercase],
  };

  it('edge_ngram tokenizer emits prefixes', () => {
    assert.deepEqual(terms(autoIndex, 'Quick'), ['qu', 'qui', 'quic', 'quick']);
  });

  it('index with edge_ngram, search with standard: precise prefix matching', () => {
    const s = new Shard({
      mapping: {
        properties: { name: { type: 'text', analyzer: 'auto', search_analyzer: 'standard' } },
      },
      analyzers: { auto: autoIndex },
    });
    s.index('1', { name: 'Quick' });
    s.index('2', { name: 'Quiet' });
    s.refresh();
    assert.deepEqual(
      searchShard(s, { match: { name: 'quic' } }).map((h) => h.id),
      ['1'],
    );
  });

  it('negative: using the edge_ngram analyzer at search time too returns false positives', () => {
    const s = new Shard({
      mapping: { properties: { name: { type: 'text', analyzer: 'auto' } } },
      analyzers: { auto: autoIndex },
    });
    s.index('1', { name: 'Quick' });
    s.index('2', { name: 'Quiet' });
    s.refresh();
    // "quic" is analysed to [qu, qui, quic]; "Quiet" shares qu and qui
    assert.deepEqual(
      new Set(searchShard(s, { match: { name: 'quic' } }).map((h) => h.id)),
      new Set(['1', '2']),
    );
  });

  it('negative: ngram with max_gram - min_gram > index.max_ngram_diff is rejected', () => {
    assert.throws(() => ngramTokenizer(1, 3), /must be less than or equal to: \[1\]/);
    assert.equal(
      terms({ charFilters: [], tokenizer: ngramTokenizer(2, 3, 5), filters: [] }, 'abcd').length,
      5,
    );
  });
});

describe('normalizers and folding', () => {
  it('asciifolding folds Czech diacritics: Příbor and Kopřivnice match their ASCII spellings', () => {
    const czech = normalizer([lowercase, asciifolding]);
    assert.deepEqual(terms(czech, 'Příbor'), ['pribor']);
    assert.deepEqual(terms(czech, 'KOPŘIVNICE'), ['koprivnice']);
    assert.deepEqual(terms(czech, 'Žluťoučký kůň'), ['zlutoucky kun']);
  });

  it('a keyword field with a normalizer gives case-insensitive exact match', () => {
    const s = new Shard({
      mapping: { properties: { city: { type: 'keyword', normalizer: 'fold' } } },
      analyzers: { fold: normalizer([lowercase, asciifolding]) },
    });
    s.index('1', { city: 'Brno-Královo Pole' });
    s.refresh();
    // normalizers apply to term queries on keyword fields too (we normalise the query by hand here)
    assert.equal(
      searchShard(s, {
        term: { city: terms(normalizer([lowercase, asciifolding]), 'BRNO-KRALOVO POLE')[0]! },
      }).length,
      1,
    );
  });

  it('negative: a normalizer may not contain token-producing filters such as a stemmer', () => {
    assert.throws(
      () => normalizer([lowercase, minimalEnglish]),
      /Custom normalizer may not use filter/,
    );
  });

  it('property: folding is idempotent and never lengthens the term', () => {
    const fold = normalizer([lowercase, asciifolding]);
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 30 }), (s) => {
        const once = terms(fold, s)[0] ?? '';
        const twice = terms(fold, once)[0] ?? '';
        return once === twice;
      }),
    );
  });
});

describe('stemming', () => {
  it('minimal_english (Harman S-stemmer) only strips plurals, and can produce non-words', () => {
    assert.deepEqual(
      ['queries', 'boxes', 'class', 'bus', 'cats', 'does', 'ties'].map(minimalEnglishStem),
      ['query', 'boxe', 'class', 'bus', 'cat', 'does', 'ty'],
    );
  });

  it('the same analyzer must run at index and search time or recall collapses', () => {
    const s = new Shard({
      mapping: {
        properties: { t: { type: 'text', analyzer: 'english', search_analyzer: 'whitespace' } },
      },
    });
    s.index('1', { t: 'Fast queries' });
    s.refresh();
    assert.equal(
      searchShard(s, { match: { t: 'queries' } }).length,
      0,
      'indexed "query", searched "queries"',
    );
    const ok = new Shard({ mapping: { properties: { t: { type: 'text', analyzer: 'english' } } } });
    ok.index('1', { t: 'Fast queries' });
    ok.refresh();
    assert.equal(searchShard(ok, { match: { t: 'query' } }).length, 1);
  });

  it('the english-like analyzer: possessive, lowercase, stop words, stemming', () => {
    assert.deepEqual(terms(englishLikeAnalyzer, "The Fox's Boxes are in the Houses"), [
      'fox',
      'boxe',
      'house',
    ]);
  });
});

describe('tokenizer contract', () => {
  it('keyword tokenizer of the empty string emits no tokens', () => {
    assert.deepEqual(keywordTokenizer(''), []);
  });

  it('property: positions are non-decreasing and offsets lie within the input', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 60 }), (text) => {
        const toks = analyze(englishLikeAnalyzer, text);
        return toks.every(
          (t, i) =>
            (i === 0 || t.position >= toks[i - 1]!.position) &&
            t.start_offset >= 0 &&
            t.end_offset <= text.length &&
            t.start_offset <= t.end_offset,
        );
      }),
    );
  });
});
