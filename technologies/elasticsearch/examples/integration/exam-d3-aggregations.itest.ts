/**
 * Verification for the Domain 3 (Aggregations) hands-on tasks of exams/elastic-certified-engineer.md:
 * Q-ECE-025, 026, 027, 030, 031.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  setup,
  wipe,
  hitIds,
  total,
  loadProducts,
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
      indices: [
        'products',
        'logs-web-2026.11.03',
        'logs-web-2026.11.04',
        'ev',
        'agg-s0',
        'agg-s1',
        'agg-s2',
      ],
    });
});

const keyed = (agg: J): Record<string, number> =>
  Object.fromEntries((agg.buckets as J[]).map((b) => [b.key, b.doc_count]));

describe('Domain 3: Aggregations (hands-on)', () => {
  it('Q-ECE-025: daily sums and a sibling max_bucket pipeline aggregation', async (t) => {
    if (skip) return t.skip(skip);
    await loadLogsWeb(r!);
    const res = await r!.call('GET', '/logs-web-*/_search', {
      size: 0,
      aggs: {
        per_day: {
          date_histogram: { field: '@timestamp', calendar_interval: '1d' },
          aggs: { daily: { sum: { field: 'bytes' } } },
        },
        best_day: { max_bucket: { buckets_path: 'per_day>daily' } },
      },
    });
    const b = res.aggregations.per_day.buckets as J[];
    assert.deepEqual(
      b.map((x) => [x.key_as_string, x.daily.value]),
      [
        ['2026-11-03T00:00:00.000Z', 1200],
        ['2026-11-04T00:00:00.000Z', 800],
      ],
    );
    assert.equal(res.aggregations.best_day.value, 1200);
    assert.deepEqual(res.aggregations.best_day.keys, ['2026-11-03T00:00:00.000Z']);
  });

  it('Q-ECE-026: calendar_interval 1d in UTC versus Europe/Prague', async (t) => {
    if (skip) return t.skip(skip);
    await wipe(r!, { indices: ['ev'] });
    await r!.call('PUT', '/ev', {
      settings: { number_of_shards: 1, number_of_replicas: 0 },
      mappings: { properties: { '@timestamp': { type: 'date' } } },
    });
    await r!.call(
      'PUT',
      '/ev/_doc/1',
      { '@timestamp': '2026-11-04T23:30:00Z' },
      { refresh: 'true' },
    );
    const res = await r!.call('GET', '/ev/_search', {
      size: 0,
      aggs: {
        utc: { date_histogram: { field: '@timestamp', calendar_interval: '1d' } },
        prague: {
          date_histogram: {
            field: '@timestamp',
            calendar_interval: '1d',
            time_zone: 'Europe/Prague',
          },
        },
      },
    });
    assert.equal(res.aggregations.utc.buckets[0].key, Date.parse('2026-11-04T00:00:00Z'));
    assert.equal(res.aggregations.utc.buckets[0].doc_count, 1);
    assert.equal(res.aggregations.prague.buckets[0].key, 1793833200000);
    assert.equal(res.aggregations.prague.buckets[0].key, Date.parse('2026-11-04T23:00:00Z'));
    assert.equal(res.aggregations.prague.buckets[0].doc_count, 1);
  });

  it('Q-ECE-027: shard_size 1 returns a wrong top term and reports the error bound', async (t) => {
    if (skip) return t.skip(skip);
    const plan: Record<string, [string, number][]> = {
      'agg-s0': [
        ['x', 10],
        ['y', 9],
      ],
      'agg-s1': [
        ['z', 10],
        ['y', 9],
      ],
      'agg-s2': [
        ['w', 10],
        ['y', 9],
      ],
    };
    for (const [index, terms] of Object.entries(plan)) {
      await wipe(r!, { indices: [index] });
      await r!.call('PUT', `/${index}`, {
        settings: { number_of_shards: 1, number_of_replicas: 0 },
        mappings: { properties: { k: { type: 'keyword' } } },
      });
      await r!.bulk(
        '/_bulk',
        terms.flatMap(([k, n]) =>
          Array.from({ length: n }, () => [{ index: { _index: index } }, { k }]).flat(),
        ),
        { refresh: 'true' },
      );
    }
    const bad = await r!.call('GET', '/agg-s*/_search', {
      size: 0,
      aggs: {
        top: { terms: { field: 'k', size: 1, shard_size: 1, show_term_doc_count_error: true } },
      },
    });
    assert.equal(bad.aggregations.top.buckets[0].key, 'w');
    assert.equal(bad.aggregations.top.buckets[0].doc_count, 10);
    assert.equal(bad.aggregations.top.doc_count_error_upper_bound, 30);
    assert.equal(bad.aggregations.top.buckets[0].doc_count_error_upper_bound, 20);
    const good = await r!.call('GET', '/agg-s*/_search', {
      size: 0,
      aggs: { top: { terms: { field: 'k', size: 1 } } },
    });
    assert.equal(good.aggregations.top.buckets[0].key, 'y');
    assert.equal(good.aggregations.top.buckets[0].doc_count, 27);
    assert.equal(good.aggregations.top.doc_count_error_upper_bound, 0);
  });

  it('Q-ECE-030: composite aggregation pages through all categories', async (t) => {
    if (skip) return t.skip(skip);
    await loadProducts(r!);
    const page = (after?: J): J => ({
      size: 0,
      aggs: {
        cats: {
          composite: {
            size: 2,
            sources: [{ cat: { terms: { field: 'category' } } }],
            ...(after ? { after } : {}),
          },
        },
      },
    });
    const p1 = (await r!.call('GET', '/products/_search', page())).aggregations.cats;
    assert.deepEqual(
      p1.buckets.map((b: J) => [b.key.cat, b.doc_count]),
      [
        ['accessories', 2],
        ['bundles', 1],
      ],
    );
    assert.deepEqual(p1.after_key, { cat: 'bundles' });
    const p2 = (await r!.call('GET', '/products/_search', page(p1.after_key))).aggregations.cats;
    assert.deepEqual(
      p2.buckets.map((b: J) => [b.key.cat, b.doc_count]),
      [
        ['keyboards', 2],
        ['mice', 2],
      ],
    );
    assert.deepEqual(p2.after_key, { cat: 'mice' });
    const p3 = (await r!.call('GET', '/products/_search', page(p2.after_key))).aggregations.cats;
    assert.deepEqual(p3.buckets, []);
  });

  it('Q-ECE-031: post_filter narrows the hits but not the facet counts', async (t) => {
    if (skip) return t.skip(skip);
    await loadProducts(r!);
    const res = await r!.call('GET', '/products/_search', {
      query: { match: { description: 'keyboard' } },
      aggs: { cats: { terms: { field: 'category' } } },
      post_filter: { term: { category: 'keyboards' } },
    });
    assert.equal(total(res), 2);
    assert.deepEqual(hitIds(res).sort(), ['p1', 'p2']);
    assert.deepEqual(keyed(res.aggregations.cats), { keyboards: 2, bundles: 1, accessories: 1 });
    const inQuery = await r!.call('GET', '/products/_search', {
      query: {
        bool: {
          must: [{ match: { description: 'keyboard' } }],
          filter: [{ term: { category: 'keyboards' } }],
        },
      },
      aggs: { cats: { terms: { field: 'category' } } },
    });
    assert.deepEqual(keyed(inQuery.aggregations.cats), { keyboards: 2 });
  });
});
