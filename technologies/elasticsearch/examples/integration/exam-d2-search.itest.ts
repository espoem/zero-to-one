/**
 * Verification for the Domain 2 (Search) hands-on tasks of exams/elastic-certified-engineer.md:
 * Q-ECE-012, 014, 015, 017, 019, 020, 022.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  setup,
  wipe,
  hitIds,
  sortedIds,
  total,
  eventually,
  loadProducts,
  loadEmployees,
  loadLogsWeb,
  type Rest,
  type J,
} from './exam-helpers.ts';

let r: Rest | null = null;
let skip: string | false = 'not connected yet';
before(async () => ({ r, skip } = await setup()));
after(async () => {
  if (r)
    await wipe(r, {
      indices: ['products', 'employees', 'logs-web-2026.11.03', 'logs-web-2026.11.04'],
      scripts: ['product-search', 'product-search-bad'],
    });
});

describe('Domain 2: Search (hands-on)', () => {
  it('Q-ECE-012: filter context for yes/no constraints, should only adds score', async (t) => {
    if (skip) return t.skip(skip);
    await loadProducts(r!);
    const one = await r!.call('GET', '/products/_search', {
      query: {
        bool: {
          must: [{ match: { description: 'wireless keyboard' } }],
          filter: [{ term: { in_stock: true } }, { range: { price: { lt: 100 } } }],
          must_not: [{ term: { category: 'bundles' } }],
        },
      },
    });
    assert.equal(total(one), 1);
    assert.deepEqual(hitIds(one), ['p2']);

    const two = await r!.call('GET', '/products/_search', {
      query: {
        bool: { filter: [{ term: { category: 'mice' } }], should: [{ term: { tags: 'rgb' } }] },
      },
    });
    assert.deepEqual(hitIds(two), ['p3', 'p4']);
    assert.ok(two.hits.hits[0]._score > 0);
    assert.equal(two.hits.hits[1]._score, 0);
  });

  it('Q-ECE-014: fuzzy match with source filtering and highlighting', async (t) => {
    if (skip) return t.skip(skip);
    await loadProducts(r!);
    const res = await r!.call('GET', '/products/_search', {
      query: { match: { name: { query: 'keybord', fuzziness: 'AUTO' } } },
      _source: { includes: ['name', 'price'] },
      highlight: { pre_tags: ['<em>'], post_tags: ['</em>'], fields: { name: {} } },
    });
    assert.equal(total(res), 4);
    assert.deepEqual(sortedIds(res), ['p1', 'p2', 'p5', 'p7']);
    for (const h of res.hits.hits) {
      assert.deepEqual(Object.keys(h._source).sort(), ['name', 'price']);
      assert.match(h.highlight.name[0], /<em>keyboard<\/em>/i);
    }
  });

  it('Q-ECE-015: search_after paging with a unique tiebreaker returns three stable pages', async (t) => {
    if (skip) return t.skip(skip);
    await loadProducts(r!);
    const sort = [{ price: 'asc' }, { 'name.keyword': 'asc' }];
    const page1 = await r!.call('GET', '/products/_search', { size: 3, sort });
    assert.deepEqual(hitIds(page1), ['p4', 'p7', 'p6']);
    assert.deepEqual(page1.hits.hits[2].sort, [45, 'USB-C hub']);
    const page2 = await r!.call('GET', '/products/_search', {
      size: 3,
      sort,
      search_after: page1.hits.hits[2].sort,
    });
    assert.deepEqual(hitIds(page2), ['p2', 'p3', 'p5']);
    const page3 = await r!.call('GET', '/products/_search', {
      size: 3,
      sort,
      search_after: page2.hits.hits[2].sort,
    });
    assert.deepEqual(hitIds(page3), ['p1']);
  });

  it('Q-ECE-017: a point in time pages over a snapshot, then is closed', async (t) => {
    if (skip) return t.skip(skip);
    await loadProducts(r!);
    const pit = await r!.call('POST', '/products/_pit', undefined, { keep_alive: '1m' });
    let pitId: string = pit.id;
    const body = (after?: unknown[]): J => ({
      size: 3,
      pit: { id: pitId, keep_alive: '1m' },
      sort: [{ released: 'desc' }, { _shard_doc: 'asc' }],
      ...(after ? { search_after: after } : {}),
    });
    const page1 = await r!.call('GET', '/_search', body());
    pitId = page1.pit_id ?? pitId;
    assert.deepEqual(hitIds(page1), ['p5', 'p3', 'p6']);

    // a new document after the PIT was opened must stay invisible to the PIT
    await r!.call(
      'PUT',
      '/products/_doc/p8',
      {
        name: 'Future gadget',
        description: 'x',
        category: 'accessories',
        price: 1,
        in_stock: true,
        released: '2027-01-01',
      },
      { refresh: 'true' },
    );
    const page2 = await r!.call('GET', '/_search', body(page1.hits.hits[2].sort));
    pitId = page2.pit_id ?? pitId;
    assert.deepEqual(hitIds(page2), ['p2', 'p7', 'p1']);
    const page3 = await r!.call('GET', '/_search', body(page2.hits.hits[2].sort));
    pitId = page3.pit_id ?? pitId;
    assert.deepEqual(hitIds(page3), ['p4']);

    const fresh = await r!.call('GET', '/products/_search', {
      size: 1,
      sort: [{ released: 'desc' }],
    });
    assert.deepEqual(hitIds(fresh), ['p8']);

    const closed = await r!.call('DELETE', '/_pit', { id: pitId });
    assert.equal(closed.succeeded, true);
    await r!.fails('GET', '/_search', body(), [400, 404]);
    await r!.call('DELETE', '/products/_doc/p8', undefined, { refresh: 'true' });
  });

  it('Q-ECE-019: a stored Mustache search template is rendered and executed', async (t) => {
    if (skip) return t.skip(skip);
    await loadProducts(r!);
    await wipe(r!, { scripts: ['product-search', 'product-search-bad'] });
    await r!.call('PUT', '/_scripts/product-search', {
      script: {
        lang: 'mustache',
        source:
          '{"query":{"bool":{"must":[{"match":{"description":"{{text}}"}}],"filter":[{"terms":{"category":{{#toJson}}cats{{/toJson}}}}]}},"size":{{size}}}',
      },
    });
    const params = { text: 'wireless', cats: ['keyboards', 'mice'], size: 5 };
    const rendered = await r!.call('POST', '/_render/template', { id: 'product-search', params });
    const out = rendered.template_output;
    assert.deepEqual(out.query.bool.filter[0].terms.category, ['keyboards', 'mice']);
    assert.equal(out.size, 5);
    const res = await r!.call('GET', '/products/_search/template', {
      id: 'product-search',
      params,
    });
    assert.deepEqual(sortedIds(res), ['p2', 'p3']);

    // negative: an unquoted {{text}} renders invalid JSON
    let stored = true;
    try {
      await r!.call('PUT', '/_scripts/product-search-bad', {
        script: { lang: 'mustache', source: '{"query":{"match":{"description":{{text}}}}}' },
      });
    } catch {
      stored = false; // rejected already when stored: also acceptable
    }
    if (stored)
      await r!.fails('POST', '/_render/template', { id: 'product-search-bad', params }, 400);
  });

  it('Q-ECE-020: an asynchronous search is kept, polled, read and deleted', async (t) => {
    if (skip) return t.skip(skip);
    await loadLogsWeb(r!);
    const submit = await r!.call(
      'POST',
      '/logs-web-*/_async_search',
      { size: 0, aggs: { by_host: { terms: { field: 'host' } } } },
      { wait_for_completion_timeout: '1ms', keep_on_completion: true, keep_alive: '1d' },
    );
    const id: string = submit.id;
    assert.ok(id, 'keep_on_completion=true must return an id');
    const done = await eventually(async () => {
      const st = await r!.call('GET', `/_async_search/status/${id}`);
      return st.is_running === false ? st : false;
    }, 'async search to finish');
    assert.equal(done.is_running, false);
    const result = await r!.call('GET', `/_async_search/${id}`);
    assert.equal(result.is_running, false);
    assert.equal(result.is_partial, false);
    const buckets = Object.fromEntries(
      (result.response.aggregations.by_host.buckets as J[]).map((b) => [b.key, b.doc_count]),
    );
    assert.deepEqual(buckets, { 'web-1': 3, 'web-2': 1 });
    await r!.call('DELETE', `/_async_search/${id}`);
    await r!.fails('GET', `/_async_search/${id}`, undefined, 404);
  });

  it('Q-ECE-022: ES|QL STATS ... WHERE (HAVING) and three-valued logic with IS NULL', async (t) => {
    if (skip) return t.skip(skip);
    await loadEmployees(r!);
    const q1 = await r!.call(
      'POST',
      '/_query',
      {
        query:
          'FROM employees | STATS avg_salary = AVG(salary), headcount = COUNT(*) BY dept | WHERE avg_salary >= 6000 | SORT avg_salary DESC',
      },
      { format: 'json' },
    );
    assert.deepEqual(
      q1.columns.map((c: J) => c.name),
      ['avg_salary', 'headcount', 'dept'],
    );
    assert.deepEqual(q1.values, [
      [8000, 1, 'ml'],
      [6750, 2, 'search'],
    ]);
    const q2 = await r!.call(
      'POST',
      '/_query',
      {
        query:
          'FROM employees | WHERE languages < 3 OR languages IS NULL | KEEP first_name | SORT first_name',
      },
      { format: 'json' },
    );
    assert.deepEqual(q2.values.flat(), ['Eva', 'Jana', 'Lucie', 'Tomas']);
    // without IS NULL, Tomas (NULL languages) is dropped by three-valued logic
    const q3 = await r!.call(
      'POST',
      '/_query',
      { query: 'FROM employees | WHERE languages < 3 | KEEP first_name | SORT first_name' },
      { format: 'json' },
    );
    assert.deepEqual(q3.values.flat(), ['Eva', 'Jana', 'Lucie']);
  });
});
