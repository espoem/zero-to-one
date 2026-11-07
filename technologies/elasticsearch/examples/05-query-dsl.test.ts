/**
 * Module 05: Query DSL. Every JSON fixture in fixtures/dsl is (1) validated structurally
 * and (2) executed against the model engine on the products dataset, asserting the hits
 * and their order where the fixture says so. Plus: bool and dis_max scoring algebra,
 * pagination equivalences, track_total_hits, and search-template rendering.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import fc from 'fast-check';
import { Index, type SearchRequest, type Query, type SortSpec } from './lib/search.ts';
import { validateSearchBody, validateQuery, renderTemplate } from './lib/dsl-validate.ts';
import type { Mapping } from './lib/mapping.ts';

const here = import.meta.dirname;
const dataset = JSON.parse(readFileSync(join(here, 'fixtures/products.json'), 'utf8')) as {
  mapping: Mapping;
  docs: Record<string, Record<string, unknown>>;
};

function products(): Index {
  const idx = new Index('products', dataset.mapping);
  for (const [id, doc] of Object.entries(dataset.docs)) idx.index(id, doc);
  idx.refresh();
  return idx;
}

interface Fixture {
  name: string;
  semantics: string;
  execute?: boolean;
  request: Record<string, unknown>;
  expect: { ids?: string[]; ordered?: boolean; error?: string; validationError?: string };
}

const dir = join(here, 'fixtures/dsl');
const fixtures = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => ({ file: f, fx: JSON.parse(readFileSync(join(dir, f), 'utf8')) as Fixture }));

describe('Query DSL fixtures', () => {
  it('there are fixtures and each one documents its semantics', () => {
    assert.ok(fixtures.length >= 15);
    for (const { file, fx } of fixtures) assert.ok(fx.name && fx.semantics.length > 20, file);
  });

  for (const { file, fx } of fixtures) {
    it(`${file}: ${fx.name}`, () => {
      const errors = validateSearchBody(fx.request);
      if (fx.expect.validationError) {
        assert.ok(
          errors.some((e) => new RegExp(fx.expect.validationError!).test(e)),
          `expected a validation error, got ${JSON.stringify(errors)}`,
        );
        return;
      }
      if (fx.expect.error) {
        // the validator and the engine must both reject it
        const idx = products();
        assert.throws(() => idx.search(fx.request as SearchRequest), new RegExp(fx.expect.error));
        return;
      }
      assert.deepEqual(errors, [], 'fixture must be a valid search body');
      if (fx.execute === false) return;
      const res = products().search(fx.request as SearchRequest);
      const ids = res.hits.hits.map((h) => h._id);
      if (fx.expect.ordered) assert.deepEqual(ids, fx.expect.ids);
      else assert.deepEqual(new Set(ids), new Set(fx.expect.ids));
    });
  }
});

describe('scoring algebra', () => {
  const idx = products();
  const score = (q: Query, id: string) =>
    idx.search({ query: q, size: 20 }).hits.hits.find((h) => h._id === id)?._score ?? 0;

  it('bool.must score = sum of its clause scores; a filter adds nothing', () => {
    const a: Query = { match: { description: 'wireless' } };
    const b: Query = { match: { description: 'keyboard' } };
    const both = score({ bool: { must: [a, b] } }, 'p2');
    assert.ok(Math.abs(both - (score(a, 'p2') + score(b, 'p2'))) < 1e-12);
    assert.equal(score({ bool: { must: [a], filter: [b] } }, 'p2'), score(a, 'p2'));
  });

  it('dis_max = max + tie_breaker * (sum of the others)', () => {
    const a: Query = { match: { name: 'keyboard' } };
    const b: Query = { match: { description: 'keyboard' } };
    const [sa, sb] = [score(a, 'p1'), score(b, 'p1')];
    const dm = score({ dis_max: { queries: [a, b], tie_breaker: 0.3 } }, 'p1');
    assert.ok(Math.abs(dm - (Math.max(sa, sb) + 0.3 * Math.min(sa, sb))) < 1e-12);
  });

  it('most_fields sums field scores; best_fields takes the best (tie_breaker 0)', () => {
    const most = score(
      { multi_match: { query: 'keyboard', fields: ['name', 'description'], type: 'most_fields' } },
      'p1',
    );
    const best = score(
      { multi_match: { query: 'keyboard', fields: ['name', 'description'], type: 'best_fields' } },
      'p1',
    );
    assert.ok(most > best);
  });

  it('constant_score gives every match exactly the boost', () => {
    const hits = idx.search({
      query: { constant_score: { filter: { term: { category: 'mice' } }, boost: 1.5 } },
    }).hits.hits;
    assert.deepEqual(
      hits.map((h) => h._score),
      [1.5, 1.5],
    );
  });

  it('must_not alone matches everything else, unscored', () => {
    const hits = idx.search({
      query: { bool: { must_not: [{ term: { category: 'mice' } }] } },
      size: 20,
    }).hits.hits;
    assert.equal(hits.length, 5);
    assert.ok(hits.every((h) => h._score === 0));
  });

  it('terms is constant score: matching more values does not raise the score', () => {
    const hits = idx.search({ query: { terms: { tags: ['usb', 'rgb'] } }, size: 20 }).hits.hits;
    assert.ok(hits.every((h) => h._score === 1));
  });
});

describe('pagination', () => {
  const sort: SortSpec[] = [{ price: 'asc' }, { 'name.keyword': 'asc' }];

  it('from/size pages and search_after pages produce the same sequence', () => {
    const idx = products();
    const all = idx.search({ sort, size: 100 }).hits.hits.map((h) => h._id);
    const viaFrom: string[] = [];
    for (let from = 0; from < all.length; from += 3)
      viaFrom.push(...idx.search({ sort, from, size: 3 }).hits.hits.map((h) => h._id));
    const viaAfter: string[] = [];
    let after: (string | number | boolean)[] | undefined;
    for (;;) {
      const page = idx.search({ sort, size: 3, ...(after ? { search_after: after } : {}) }).hits
        .hits;
      if (page.length === 0) break;
      viaAfter.push(...page.map((h) => h._id));
      after = page.at(-1)!.sort!;
    }
    assert.deepEqual(viaFrom, all);
    assert.deepEqual(viaAfter, all);
  });

  it('negative: search_after without a unique tiebreaker skips documents with equal sort values', () => {
    const idx = new Index('t', { properties: { k: { type: 'long' }, id: { type: 'keyword' } } });
    for (let i = 0; i < 6; i++) idx.index(`d${i}`, { k: i < 3 ? 1 : 2, id: `d${i}` });
    idx.refresh();
    const first = idx.search({ sort: [{ k: 'asc' }], size: 2 }).hits.hits;
    const next = idx.search({ sort: [{ k: 'asc' }], size: 2, search_after: first.at(-1)!.sort! })
      .hits.hits;
    const seen = new Set([...first, ...next].map((h) => h._id));
    assert.ok(!seen.has('d2'), 'd2 shares k=1 with the last hit of page 1 and is skipped forever');
    const fixed = idx.search({
      sort: [{ k: 'asc' }, { id: 'asc' }],
      size: 2,
      search_after: [1, 'd1'],
    }).hits.hits;
    assert.equal(fixed[0]!._id, 'd2');
  });

  it('property: any page size enumerates every document exactly once with search_after', () => {
    const idx = products();
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 8 }), (size) => {
        const ids: string[] = [];
        let after: (string | number | boolean)[] | undefined;
        for (;;) {
          const page = idx.search({ sort, size, ...(after ? { search_after: after } : {}) }).hits
            .hits;
          if (page.length === 0) break;
          ids.push(...page.map((h) => h._id));
          after = page.at(-1)!.sort!;
        }
        return ids.length === 7 && new Set(ids).size === 7;
      }),
    );
  });

  it('track_total_hits caps the count and reports gte', () => {
    const idx = products();
    assert.deepEqual(idx.search({ track_total_hits: 3 }).hits.total, { value: 3, relation: 'gte' });
    assert.deepEqual(idx.search({ track_total_hits: true }).hits.total, {
      value: 7,
      relation: 'eq',
    });
  });

  it('sorting by a field disables scoring unless _score is a sort key', () => {
    const idx = products();
    assert.equal(
      idx.search({ query: { match: { name: 'mouse' } }, sort: [{ price: 'asc' }] }).hits.hits[0]!
        ._score,
      null,
    );
  });
});

describe('search templates', () => {
  const source =
    '{"query":{"bool":{"must":[{"match":{"description":"{{text}}"}}],"filter":[{"terms":{"category":{{#toJson}}cats{{/toJson}}}}]}},"size":{{size}}}';

  it('renders Mustache parameters into a valid search body', () => {
    const body = renderTemplate(source, {
      text: 'wireless',
      cats: ['keyboards', 'mice'],
      size: 5,
    }) as Record<string, unknown>;
    assert.deepEqual(validateSearchBody(body), []);
    const ids = products()
      .search(body as SearchRequest)
      .hits.hits.map((h) => h._id);
    assert.deepEqual(new Set(ids), new Set(['p2', 'p3']));
  });

  it('negative: an unquoted string parameter produces invalid JSON', () => {
    assert.throws(() => renderTemplate('{"size": {{n}} }', { n: 'ten' }), SyntaxError);
  });

  it('validateQuery rejects a misspelled bool clause', () => {
    assert.match(validateQuery({ bool: { musts: [] } }).join(), /does not support \[musts\]/);
  });
});
