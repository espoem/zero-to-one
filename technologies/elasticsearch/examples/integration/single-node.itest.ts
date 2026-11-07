/**
 * Integration tests against a real Elasticsearch 9.5 node (docker-compose.yml). They check
 * that the hermetic models in examples/lib agree with the server on the claims that only
 * a real cluster can prove. Every test skips cleanly when no cluster is reachable.
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Client } from '@elastic/elasticsearch';
import { connect, fresh } from './cluster.ts';
import { analyze, standardAnalyzer } from '../lib/analysis.ts';
import { idf, tfNorm } from '../lib/search.ts';
import { shardId } from '../lib/routing.ts';
import { termsAgg } from '../lib/aggs.ts';

let client: Client | null = null;
let skip: string | false = 'not connected yet';
before(async () => ({ client, skip } = await connect()));

const fx = join(import.meta.dirname, '..', 'fixtures');

describe('module 01/02: analysis, BM25 and NRT on a real node', () => {
  it('standard analyzer output matches the model for UAX #29 cases', async (t) => {
    if (skip) return t.skip(skip);
    for (const text of ['The 2 QUICK Brown-Foxes', "don't stop v3.14 at example.com"]) {
      const r = await client!.indices.analyze({ analyzer: 'standard', text });
      const model = analyze(standardAnalyzer, text);
      assert.deepEqual(
        r.tokens!.map((t) => [t.token, t.position, t.start_offset, t.end_offset]),
        model.map((t) => [t.token, t.position, t.start_offset, t.end_offset]),
      );
    }
  });

  it('a single-shard BM25 score equals idf * tf (up to the constant boost ES may report)', async (t) => {
    if (skip) return t.skip(skip);
    await fresh(client!, 'zto-bm25', {
      settings: { number_of_shards: 1, number_of_replicas: 0 },
      mappings: { properties: { title: { type: 'text' } } },
    });
    const titles = [
      'The quick brown fox',
      'Quick quick quick fox jumps over the lazy dog again and again',
      'Brown sugar',
      'Lazy Sunday',
    ];
    for (const [i, title] of titles.entries())
      await client!.index({ index: 'zto-bm25', id: String(i + 1), document: { title } });
    await client!.indices.refresh({ index: 'zto-bm25' });
    const r = await client!.search({ index: 'zto-bm25', query: { match: { title: 'sugar' } } });
    const expected = idf(1, 4) * tfNorm(1, 2, 5);
    const ratio = (r.hits.hits[0]!._score as number) / expected;
    assert.ok(Math.abs(ratio - 1) < 1e-4 || Math.abs(ratio - 2.2) < 1e-3, `ratio ${ratio}`);
  });

  it('search is near-real-time but GET is realtime', async (t) => {
    if (skip) return t.skip(skip);
    await fresh(client!, 'zto-nrt', {
      settings: { number_of_shards: 1, number_of_replicas: 0, refresh_interval: -1 },
    });
    await client!.index({ index: 'zto-nrt', id: 'a', document: { body: 'hello' } });
    assert.equal((await client!.get({ index: 'zto-nrt', id: 'a' })).found, true);
    assert.equal(
      (await client!.search({ index: 'zto-nrt', query: { match: { body: 'hello' } } })).hits.hits
        .length,
      0,
    );
    await client!.indices.refresh({ index: 'zto-nrt' });
    assert.equal(
      (await client!.search({ index: 'zto-nrt', query: { match: { body: 'hello' } } })).hits.hits
        .length,
      1,
    );
  });

  it('term on an analysed text field misses; a stale if_seq_no is a 409', async (t) => {
    if (skip) return t.skip(skip);
    await fresh(client!, 'zto-term', {
      settings: { number_of_replicas: 0 },
      mappings: { properties: { title: { type: 'text' } } },
    });
    const v1 = await client!.index({
      index: 'zto-term',
      id: '1',
      document: { title: 'Quick' },
      refresh: true,
    });
    assert.equal(
      (await client!.search({ index: 'zto-term', query: { term: { title: 'Quick' } } })).hits.hits
        .length,
      0,
    );
    await client!.index({
      index: 'zto-term',
      id: '1',
      document: { title: 'Quick 2' },
      if_seq_no: v1._seq_no,
      if_primary_term: v1._primary_term,
    });
    await assert.rejects(
      client!.index({
        index: 'zto-term',
        id: '1',
        document: { title: 'x' },
        if_seq_no: v1._seq_no,
        if_primary_term: v1._primary_term,
      }),
      /version_conflict_engine_exception/,
    );
  });
});

describe('module 05: Query DSL fixtures and limits', () => {
  it('fixtures with expected ids return the same hits on a real node', async (t) => {
    if (skip) return t.skip(skip);
    const data = JSON.parse(readFileSync(join(fx, 'products.json'), 'utf8')) as {
      mapping: Record<string, unknown>;
      docs: Record<string, Record<string, unknown>>;
    };
    // the model's `english` analyzer is simplified; use the real english analyzer here
    await fresh(client!, 'products', {
      settings: { number_of_shards: 1, number_of_replicas: 0 },
      mappings: data.mapping,
    });
    for (const [id, doc] of Object.entries(data.docs))
      await client!.index({ index: 'products', id, document: doc });
    await client!.indices.refresh({ index: 'products' });
    for (const f of [
      '01-bool-query-and-filter',
      '02-should-minimum-should-match',
      '06-term-on-text-negative',
      '07-term-on-keyword',
      '09-range-dates-and-exists',
      '11-sort-and-search-after',
    ]) {
      const fixture = JSON.parse(readFileSync(join(fx, 'dsl', `${f}.json`), 'utf8')) as {
        request: Record<string, unknown>;
        expect: { ids: string[]; ordered: boolean };
      };
      const r = await client!.search({ index: 'products', ...fixture.request });
      const ids = r.hits.hits.map((h) => h._id);
      if (fixture.expect.ordered) assert.deepEqual(ids, fixture.expect.ids, f);
      else assert.deepEqual(new Set(ids), new Set(fixture.expect.ids), f);
    }
  });

  it('from + size > 10000 is rejected', async (t) => {
    if (skip) return t.skip(skip);
    await assert.rejects(
      client!.search({ index: 'products', from: 9995, size: 10 }),
      /Result window is too large/,
    );
  });
});

describe('module 07 and 10: distributed behaviour', () => {
  it('_id 654321 in a 6-shard index routes to shard 2, as the model computes', async (t) => {
    if (skip) return t.skip(skip);
    await fresh(client!, 'zto-routing', {
      settings: { number_of_shards: 6, number_of_replicas: 0 },
    });
    const r = await client!.searchShards({ index: 'zto-routing', routing: '654321' });
    assert.equal(r.shards[0]![0]!.shard, shardId('654321', 6));
    assert.equal(shardId('654321', 6), 2);
  });

  it('terms aggregation with shard_size 1 over 3 shards matches the model, including the error bound', async (t) => {
    if (skip) return t.skip(skip);
    await fresh(client!, 'zto-terms', {
      settings: { number_of_shards: 3, number_of_replicas: 0 },
      mappings: { properties: { k: { type: 'keyword' } } },
    });
    const shards: string[][] = [[], [], []];
    const plan: [string, number, number][] = [
      ['x', 10, 0],
      ['z', 10, 1],
      ['w', 10, 2],
      ['y', 9, 0],
      ['y', 9, 1],
      ['y', 9, 2],
    ];
    let n = 0;
    const ops: object[] = [];
    for (const [k, count, shard] of plan) {
      for (let i = 0; i < count; i++) {
        ops.push({ index: { _index: 'zto-terms', routing: `r${shard}` } }, { k });
        shards[shard]!.push(k);
        n++;
      }
    }
    // pick routing values that land on shards 0, 1, 2
    const routes = [0, 1, 2].map((s) => {
      for (let i = 0; ; i++) if (shardId(`p${i}`, 3) === s) return `p${i}`;
    });
    const fixed = ops.map((o) =>
      'index' in o
        ? {
            index: {
              _index: 'zto-terms',
              routing: routes[Number((o as { index: { routing: string } }).index.routing.slice(1))],
            },
          }
        : o,
    );
    await client!.bulk({ operations: fixed, refresh: true });
    const r = await client!.search({
      index: 'zto-terms',
      size: 0,
      aggs: { t: { terms: { field: 'k', size: 1, shard_size: 1 } } },
    });
    const agg = r.aggregations!['t'] as {
      doc_count_error_upper_bound: number;
      buckets: { key: string; doc_count: number }[];
    };
    const model = termsAgg(shards, 1, 1);
    assert.equal(n, 57);
    assert.equal(agg.buckets[0]!.doc_count, model.buckets[0]!.doc_count);
    assert.equal(agg.doc_count_error_upper_bound, model.doc_count_error_upper_bound);
  });

  it('a single node with number_of_replicas 1 is yellow', async (t) => {
    if (skip) return t.skip(skip);
    await fresh(client!, 'zto-yellow', {
      settings: { number_of_shards: 1, number_of_replicas: 1 },
    });
    const h = await client!.cluster.health({
      index: 'zto-yellow',
      wait_for_status: 'yellow',
      timeout: '10s',
    });
    assert.equal(h.status, process.env['ES_NODES'] === '3' ? 'green' : 'yellow');
  });
});

describe('module 06: ES|QL against the fixture dataset', () => {
  it('runs fixtures 02 and 06 with the same result tables as the interpreter', async (t) => {
    if (skip) return t.skip(skip);
    const data = JSON.parse(readFileSync(join(fx, 'esql', 'dataset.json'), 'utf8')) as {
      indices: Record<string, object[]>;
      lookup: Record<string, object[]>;
    };
    await fresh(client!, 'employees', {
      mappings: {
        properties: {
          emp_no: { type: 'integer' },
          first_name: { type: 'keyword' },
          dept: { type: 'keyword' },
          languages: { type: 'integer' },
          salary: { type: 'integer' },
          height: { type: 'double' },
          skills: { type: 'keyword' },
        },
      },
    });
    await fresh(client!, 'languages_lookup', {
      settings: { 'index.mode': 'lookup' },
      mappings: {
        properties: { languages: { type: 'integer' }, language_name: { type: 'keyword' } },
      },
    });
    await client!.bulk({
      refresh: true,
      operations: [
        ...data.indices['employees']!.flatMap((d) => [{ index: { _index: 'employees' } }, d]),
        ...data.lookup['languages_lookup']!.flatMap((d) => [
          { index: { _index: 'languages_lookup' } },
          d,
        ]),
      ],
    });
    for (const f of ['02-stats-by', '06-lookup-join']) {
      const fixture = JSON.parse(readFileSync(join(fx, 'esql', `${f}.json`), 'utf8')) as {
        query: string;
        expect: { columns: string[]; rows: unknown[][] };
      };
      const r = (await client!.esql.query({ query: fixture.query })) as unknown as {
        columns: { name: string }[];
        values: unknown[][];
      };
      assert.deepEqual(
        r.columns.map((c) => c.name),
        fixture.expect.columns,
        f,
      );
      assert.deepEqual(r.values, fixture.expect.rows, f);
    }
  });
});
