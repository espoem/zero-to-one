/**
 * Offline proofs for the success criteria of the hands-on tasks in exams/elastic-certified-engineer.md that
 * the hermetic models can decide: routing arithmetic, terms-aggregation error bounds, date_histogram keys,
 * composite paging, search_after paging, ES|QL results, ingest processors, aliases, data streams, allocation
 * deciders and optimistic concurrency. The matching cluster-side tests live in integration/exam-*.itest.ts.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  esRoutingHash,
  defaultRoutingShards,
  floorMod,
  shardId,
  legacyShardId,
} from './lib/routing.ts';
import { termsAgg, defaultShardSize, calendarKey, composite } from './lib/aggs.ts';
import { Index, type SearchRequest, type SortSpec } from './lib/search.ts';
import { run, type Catalog } from './lib/esql.ts';
import { runPipeline, AliasRegistry, DataStream, type Processor } from './lib/lifecycle.ts';
import { explain, indexHealth, type NodeInfo } from './lib/ops.ts';
import { Shard, VersionConflictError } from './lib/lucene.ts';
import type { Mapping } from './lib/mapping.ts';

const here = import.meta.dirname;
const products = JSON.parse(readFileSync(join(here, 'fixtures/products.json'), 'utf8')) as {
  mapping: Mapping;
  docs: Record<string, Record<string, unknown>>;
};
const catalog = JSON.parse(
  readFileSync(join(here, 'fixtures/esql/dataset.json'), 'utf8'),
) as Catalog;

function productIndex(): Index {
  const idx = new Index('products', products.mapping);
  for (const [id, doc] of Object.entries(products.docs)) idx.index(id, doc);
  idx.refresh();
  return idx;
}
const ids = (idx: Index, req: SearchRequest): string[] =>
  idx.search(req).hits.hits.map((h) => h._id);

describe('exam reference answers, offline', () => {
  it('Q-ECE-047, Q-ECE-109: _id 654321 in a 6-shard index routes to shard 2 in ES 9+ (shard 4 in legacy ES 7/8)', () => {
    assert.equal(esRoutingHash('654321'), 1424940152);
    // ES 9+ modulo routing: floorMod(1424940152, 6) = 2
    assert.equal(shardId('654321', 6), 2);
    // Legacy ES 7/8 routing shards formula: 632 / 128 = 4
    assert.equal(defaultRoutingShards(6), 768);
    assert.equal(floorMod(1424940152, 768), 632);
    assert.equal(Math.floor(632 / (768 / 6)), 4);
    assert.equal(legacyShardId('654321', 6), 4);
    // the custom routing values of the task land on different shards, so a GET without routing misses
    assert.notEqual(shardId('o-1001', 6), shardId('tenant-42', 6));
  });

  it('Q-ECE-027: shard_size 1 picks w with error bound 30; the default shard_size 11 finds y', () => {
    const shards = [
      [...Array(10).fill('x'), ...Array(9).fill('y')],
      [...Array(10).fill('z'), ...Array(9).fill('y')],
      [...Array(10).fill('w'), ...Array(9).fill('y')],
    ];
    const bad = termsAgg(shards, 1, 1);
    assert.equal(bad.buckets[0]?.key, 'w');
    assert.equal(bad.buckets[0]?.doc_count, 10);
    assert.equal(bad.doc_count_error_upper_bound, 30);
    assert.equal(defaultShardSize(1), 11);
    const good = termsAgg(shards, 1);
    assert.equal(good.buckets[0]?.key, 'y');
    assert.equal(good.buckets[0]?.doc_count, 27);
    assert.equal(good.doc_count_error_upper_bound, 0);
  });

  it('Q-ECE-026: the same instant falls into different daily buckets in UTC and Europe/Prague', () => {
    const at = Date.parse('2026-11-04T23:30:00Z');
    assert.equal(calendarKey(at, 'day', 0), Date.parse('2026-11-04T00:00:00Z'));
    assert.equal(calendarKey(at, 'day', 60), 1793833200000);
    assert.equal(1793833200000, Date.parse('2026-11-04T23:00:00Z'));
  });

  it('Q-ECE-030: composite paging visits accessories, bundles | keyboards, mice | nothing', () => {
    const docs = Object.values(products.docs).map((d) => ({ cat: d['category'] as string }));
    const p1 = composite(docs, ['cat'], 2);
    assert.deepEqual(
      p1.buckets.map((b) => [b.key['cat'], b.doc_count]),
      [
        ['accessories', 2],
        ['bundles', 1],
      ],
    );
    const p2 = composite(docs, ['cat'], 2, p1.after_key);
    assert.deepEqual(
      p2.buckets.map((b) => [b.key['cat'], b.doc_count]),
      [
        ['keyboards', 2],
        ['mice', 2],
      ],
    );
    assert.deepEqual(composite(docs, ['cat'], 2, p2.after_key).buckets, []);
  });

  it('Q-ECE-012: filter context decides membership, should only ranks (minimum_should_match 0 beside a filter)', () => {
    const idx = productIndex();
    const one = {
      query: {
        bool: {
          must: [{ match: { description: 'wireless keyboard' } }],
          filter: [{ term: { in_stock: true } }, { range: { price: { lt: 100 } } }],
          must_not: [{ term: { category: 'bundles' } }],
        },
      },
    };
    assert.deepEqual(ids(idx, one), ['p2']);
    const two = idx.search({
      query: {
        bool: { filter: [{ term: { category: 'mice' } }], should: [{ term: { tags: 'rgb' } }] },
      },
    });
    assert.deepEqual(
      two.hits.hits.map((h) => h._id),
      ['p3', 'p4'],
    );
    assert.ok(two.hits.hits[0]!._score! > 0);
    assert.equal(two.hits.hits[1]!._score, 0);
  });

  it('Q-ECE-015: search_after with a unique tiebreaker yields p4 p7 p6 | p2 p3 p5 | p1', () => {
    const idx = productIndex();
    const sort: SortSpec[] = [{ price: 'asc' }, { 'name.keyword': 'asc' }];
    const p1 = idx.search({ size: 3, sort });
    assert.deepEqual(
      p1.hits.hits.map((h) => h._id),
      ['p4', 'p7', 'p6'],
    );
    const p2 = idx.search({ size: 3, sort, search_after: p1.hits.hits[2]!.sort! });
    assert.deepEqual(
      p2.hits.hits.map((h) => h._id),
      ['p2', 'p3', 'p5'],
    );
    const p3 = idx.search({ size: 3, sort, search_after: p2.hits.hits[2]!.sort! });
    assert.deepEqual(
      p3.hits.hits.map((h) => h._id),
      ['p1'],
    );
  });

  it('Q-ECE-103: range plus exists returns p2 p3 p5', () => {
    const idx = productIndex();
    const res = ids(idx, {
      query: {
        bool: {
          filter: [
            { range: { released: { gte: '2026-01-01', lt: '2027-01-01' } } },
            { exists: { field: 'tags' } },
          ],
        },
      },
    });
    assert.deepEqual(res.sort(), ['p2', 'p3', 'p5']);
  });

  it('Q-ECE-022: ES|QL STATS then WHERE acts as HAVING; IS NULL rescues the NULL row', () => {
    const q1 = run(
      'FROM employees | STATS avg_salary = AVG(salary), headcount = COUNT(*) BY dept | WHERE avg_salary >= 6000 | SORT avg_salary DESC',
      catalog,
    );
    assert.deepEqual(q1.columns, ['avg_salary', 'headcount', 'dept']);
    assert.deepEqual(
      q1.rows.map((r) => q1.columns.map((c) => r[c])),
      [
        [8000, 1, 'ml'],
        [6750, 2, 'search'],
      ],
    );
    const names = (q: string): unknown[] => run(q, catalog).rows.map((r) => r['first_name']);
    assert.deepEqual(
      names(
        'FROM employees | WHERE languages < 3 OR languages IS NULL | KEEP first_name | SORT first_name',
      ),
      ['Eva', 'Jana', 'Lucie', 'Tomas'],
    );
    assert.deepEqual(
      names('FROM employees | WHERE languages < 3 | KEEP first_name | SORT first_name'),
      ['Eva', 'Jana', 'Lucie'],
    );
  });

  it('Q-ECE-104: LOOKUP JOIN is a left join with one row per match; MV_EXPAND counts skills', () => {
    const j = run(
      'FROM employees | KEEP emp_no, languages | LOOKUP JOIN languages_lookup ON languages | SORT emp_no, language_name',
      catalog,
    );
    assert.deepEqual(
      j.rows.map((r) => j.columns.map((c) => r[c] ?? null)),
      [
        [1, 2, 'Czech'],
        [1, 2, 'Slovak'],
        [2, 3, 'German'],
        [3, 1, 'English'],
        [4, null, null],
        [5, 2, 'Czech'],
        [5, 2, 'Slovak'],
      ],
    );
    const s = run(
      'FROM employees | MV_EXPAND skills | STATS n = COUNT(*) BY skills | SORT n DESC, skills | LIMIT 2',
      catalog,
    );
    assert.deepEqual(
      s.rows.map((r) => [r['n'], r['skills']]),
      [
        [3, 'java'],
        [1, 'k8s'],
      ],
    );
  });

  it('Q-ECE-034: the access-log pipeline parses a good line and keeps a bad bytes value', () => {
    const pipeline: Processor[] = [
      {
        type: 'dissect',
        field: 'message',
        pattern: '%{client} [%{ts}] "%{verb} %{path}" %{status} %{bytes}',
      },
      { type: 'convert', field: 'status', to: 'integer' },
      { type: 'convert', field: 'bytes', to: 'long', ignore_failure: true },
      { type: 'date', field: 'ts', formats: ['ISO8601'], target_field: '@timestamp' },
      { type: 'remove', field: 'ts' },
      {
        type: 'set',
        field: 'event.outcome',
        value: 'failure',
        if: (ctx) => Number(ctx['status']) >= 500,
      },
      { type: 'lowercase', field: 'verb' },
    ];
    const msg = (bytes: string): string =>
      `10.0.0.5 [2026-11-04T10:00:00Z] "GET /index" 500 ${bytes}`;
    const good = runPipeline(pipeline, { message: msg('1200') }).doc!;
    assert.equal(good['client'], '10.0.0.5');
    assert.equal(good['verb'], 'get');
    assert.equal(good['status'], 500);
    assert.equal(good['bytes'], 1200);
    assert.equal('ts' in good, false);
    assert.deepEqual(good['event'], { outcome: 'failure' });
    const bad = runPipeline(pipeline, { message: msg('abc') });
    assert.equal(bad.error, undefined);
    assert.equal(bad.doc!['bytes'], 'abc');
    assert.equal(bad.doc!['verb'], 'get');
  });

  it('Q-ECE-052: an alias swap is atomic; a failing action changes nothing; writes need a write index', () => {
    const reg = new AliasRegistry();
    reg.indices = new Set(['products-v1', 'products-v2']);
    reg.update([{ add: { index: 'products-v1', alias: 'products-live' } }]);
    reg.update([
      { remove: { index: 'products-v1', alias: 'products-live' } },
      { add: { index: 'products-v2', alias: 'products-live' } },
    ]);
    assert.deepEqual(reg.resolveRead('products-live'), ['products-v2']);
    assert.throws(
      () =>
        reg.update([
          { add: { index: 'products-v1', alias: 'products-live' } },
          { add: { index: 'does-not-exist', alias: 'products-live' } },
        ]),
      /index_not_found_exception/,
    );
    assert.deepEqual(reg.resolveRead('products-live'), ['products-v2']);
    reg.update([{ add: { index: 'products-v1', alias: 'products-live' } }]);
    assert.throws(() => reg.resolveWrite('products-live'), /no write index/);
    reg.update([{ add: { index: 'products-v2', alias: 'products-live', is_write_index: true } }]);
    assert.equal(reg.resolveWrite('products-live'), 'products-v2');
  });

  it('Q-ECE-054: a data stream is append-only, needs @timestamp and rolls over to generation 2', () => {
    const now = Date.parse('2026-11-04T10:00:00Z');
    const ds = new DataStream('logs-web-default', now);
    assert.match(ds.writeIndex.name, /^\.ds-logs-web-default-2026\.11\.04-000001$/);
    ds.index({ '@timestamp': '2026-11-04T10:00:00Z', message: 'GET /a 200' });
    assert.match(ds.rollover(now), /-000002$/);
    assert.equal(ds.backing.length, 2);
    assert.throws(() => ds.index({ message: 'no ts' }), /@timestamp/);
    assert.throws(() => ds.index({ '@timestamp': 'x' }, 'index', '1'), /op_type of create/);
    assert.equal(ds.index({ '@timestamp': 'x', message: 'x' }, 'create', '1'), '1');
  });

  it('Q-ECE-065, Q-ECE-112: same_shard explains the yellow replica; a require filter explains the red primary', () => {
    const node: NodeInfo = { name: 'n1', diskUsedPct: 10, attrs: {}, roles: ['data'] };
    const replica = explain({ index: 'y', shard: 0, primary: false, holders: ['n1'] }, [node]);
    assert.equal(replica[0]!.decision, 'NO');
    assert.match(replica[0]!.reasons.join(), /same_shard/);
    assert.equal(
      indexHealth([
        { index: 'y', shard: 0, primary: true, state: 'STARTED' },
        { index: 'y', shard: 0, primary: false, state: 'UNASSIGNED' },
      ]),
      'yellow',
    );
    const stuck = explain(
      { index: 'stuck', shard: 0, primary: true, holders: [], require: { box_type: 'warm' } },
      [node],
    );
    assert.match(stuck[0]!.reasons.join(), /filter/);
    assert.equal(
      indexHealth([{ index: 'stuck', shard: 0, primary: true, state: 'UNASSIGNED' }]),
      'red',
    );
  });

  it('Q-ECE-066: forced awareness refuses a second copy in the surviving zone', () => {
    const nodes: NodeInfo[] = [
      { name: 'es1', diskUsedPct: 10, attrs: { zone: 'zone-a' }, roles: ['data'] },
      { name: 'es3', diskUsedPct: 10, attrs: { zone: 'zone-a' }, roles: ['data'] },
    ];
    const d = explain(
      {
        index: 'ha',
        shard: 0,
        primary: false,
        holders: ['es1'],
        awareness: 'zone',
        forcedValues: ['zone-a', 'zone-b'],
      },
      nodes,
    );
    const es3 = d.find((x) => x.node === 'es3')!;
    assert.equal(es3.decision, 'NO');
    assert.match(es3.reasons.join(), /awareness/);
  });

  it('Q-ECE-040, Q-ECE-045: a stale if_seq_no conflicts; search misses an unrefreshed document while GET finds it', () => {
    const mapping: Mapping = { properties: { text: { type: 'text' } } };
    const shard = new Shard({ mapping });
    const first = shard.index('1', { text: 'v1' });
    shard.index(
      '1',
      { text: 'v2' },
      { ifSeqNo: first._seq_no, ifPrimaryTerm: first._primary_term },
    );
    assert.throws(
      () =>
        shard.index(
          '1',
          { text: 'v3' },
          { ifSeqNo: first._seq_no, ifPrimaryTerm: first._primary_term },
        ),
      VersionConflictError,
    );
    const idx = new Index('nrt', mapping);
    idx.index('1', { text: 'a' });
    assert.equal(idx.get('1').found, true);
    assert.equal(idx.search({ query: { match_all: {} } }).hits.hits.length, 0);
    idx.refresh();
    assert.equal(idx.search({ query: { match_all: {} } }).hits.hits.length, 1);
  });
});
