/**
 * Module 08: ingest pipelines (processor order, conditions, failure handling), _bulk
 * NDJSON, zero-downtime reindex with atomic alias swaps and write indices, data streams
 * (append-only, backing indices, rollover), and ILM rollover/phase rules.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  runPipeline,
  dissect,
  toNdjson,
  parseNdjson,
  AliasRegistry,
  DataStream,
  backingIndexName,
  shouldRollover,
  currentPhase,
  validatePolicy,
  type Processor,
  type IlmPolicy,
} from './lib/lifecycle.ts';
import { Index } from './lib/search.ts';

const DAY = 86400000;
const GB = 1024 ** 3;

describe('ingest pipelines', () => {
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
      if: (c) => (c['status'] as number) >= 500,
    },
    { type: 'lowercase', field: 'verb' },
  ];

  it('parses an access-log line into typed fields', () => {
    const r = runPipeline(pipeline, {
      message: '10.0.0.1 [2026-11-04T10:00:00Z] "GET /a" 503 512',
    });
    assert.deepEqual(r.doc, {
      message: '10.0.0.1 [2026-11-04T10:00:00Z] "GET /a" 503 512',
      client: '10.0.0.1',
      verb: 'get',
      path: '/a',
      status: 503,
      bytes: 512,
      '@timestamp': '2026-11-04T10:00:00.000Z',
      event: { outcome: 'failure' },
    });
  });

  it('ignore_failure keeps going: a bad bytes value stays a string', () => {
    const r = runPipeline(pipeline, { message: '10.0.0.1 [2026-11-04T10:00:00Z] "GET /a" 200 -' });
    assert.equal(r.doc!['bytes'], '-');
    assert.equal(r.doc!['status'], 200);
    assert.equal(
      r.doc!['event'] as object | undefined,
      undefined,
      'condition false: processor skipped',
    );
  });

  it('negative: without a failure handler the document is rejected', () => {
    const r = runPipeline(pipeline, { message: 'garbage' });
    assert.equal(r.doc, null);
    assert.match(r.error!, /Unable to find match for dissect pattern/);
  });

  it('a pipeline-level on_failure handler can route bad documents instead of rejecting them', () => {
    const r = runPipeline(pipeline, { message: 'garbage' }, [
      { type: 'set', field: 'error.message', value: 'parse failure' },
      { type: 'set', field: '_index_override', value: 'failed-logs' },
    ]);
    assert.equal((r.doc!['error'] as { message: string }).message, 'parse failure');
    assert.equal(r.doc!['_index_override'], 'failed-logs');
  });

  it('processor order matters: lowercase before convert is fine, remove before use is not', () => {
    const bad: Processor[] = [
      { type: 'remove', field: 'ts' },
      { type: 'date', field: 'ts', formats: ['ISO8601'] },
    ];
    assert.equal(runPipeline(bad, { ts: '2026-11-04T00:00:00Z' }).doc, null);
  });

  it('a script processor can compute fields (Painless ctx modelled as a JS function)', () => {
    const r = runPipeline(
      [
        {
          type: 'script',
          source: (ctx) => {
            ctx['total'] = (ctx['price'] as number) * (ctx['qty'] as number);
          },
        },
      ],
      { price: 2.5, qty: 4 },
    );
    assert.equal(r.doc!['total'], 10);
  });

  it('drop removes the document entirely (e.g. health-check noise)', () => {
    assert.equal(
      runPipeline([{ type: 'drop', if: (c) => c['path'] === '/health' }], { path: '/health' }).doc,
      null,
    );
  });

  it('dissect skips %{?name} and empty keys', () => {
    assert.deepEqual(dissect('%{a} %{?skip} %{b}', 'x y z'), { a: 'x', b: 'z' });
  });
});

describe('_bulk NDJSON', () => {
  it('round-trips action/source pairs; delete has no source line', () => {
    const items = [
      { action: { index: { _index: 'p', _id: '1' } }, source: { a: 1 } },
      { action: { delete: { _index: 'p', _id: '2' } } },
      { action: { create: { _index: 'p' } }, source: { a: 3 } },
    ];
    const body = toNdjson(items);
    assert.equal(body.split('\n').length - 1, 5);
    assert.deepEqual(parseNdjson(body), items);
  });

  it('negative: the body must end with a newline', () => {
    assert.throws(
      () => parseNdjson('{"delete":{"_index":"p","_id":"1"}}'),
      /terminated by a newline/,
    );
  });

  it('per-item failures do not fail the batch: check errors:true and every item', () => {
    const idx = new Index('p', { properties: { n: { type: 'long' } } });
    const results = [{ n: 1 }, { n: 'not a number' }, { n: 3 }].map((src, i) => {
      try {
        idx.index(String(i), src);
        idx.refresh();
        return { status: 201 };
      } catch (e) {
        return { status: 400, error: (e as Error).message };
      }
    });
    assert.deepEqual(
      results.map((r) => r.status),
      [201, 400, 201],
    );
    assert.equal(idx.search({ size: 10 }).hits.hits.length, 2);
  });
});

describe('aliases and zero-downtime reindex', () => {
  it('swaps an alias atomically from v1 to v2', () => {
    const r = new AliasRegistry();
    r.indices = new Set(['products-v1', 'products-v2']);
    r.update([{ add: { index: 'products-v1', alias: 'products' } }]);
    assert.deepEqual(r.resolveRead('products'), ['products-v1']);
    r.update([
      { remove: { index: 'products-v1', alias: 'products' } },
      { add: { index: 'products-v2', alias: 'products' } },
    ]);
    assert.deepEqual(r.resolveRead('products'), ['products-v2']);
  });

  it('a failing action rolls back the whole _aliases request', () => {
    const r = new AliasRegistry();
    r.indices = new Set(['a']);
    r.update([{ add: { index: 'a', alias: 'x' } }]);
    assert.throws(
      () =>
        r.update([
          { remove: { index: 'a', alias: 'x' } },
          { add: { index: 'missing', alias: 'x' } },
        ]),
      /index_not_found/,
    );
    assert.deepEqual(r.resolveRead('x'), ['a'], 'the remove was not applied either');
  });

  it('negative: writing through an alias with several indices and no write index fails', () => {
    const r = new AliasRegistry();
    r.indices = new Set(['logs-1', 'logs-2']);
    r.update([
      { add: { index: 'logs-1', alias: 'logs' } },
      { add: { index: 'logs-2', alias: 'logs' } },
    ]);
    assert.throws(() => r.resolveWrite('logs'), /no write index is defined/);
    r.update([{ add: { index: 'logs-2', alias: 'logs', is_write_index: true } }]);
    assert.equal(r.resolveWrite('logs'), 'logs-2');
    assert.deepEqual(r.resolveRead('logs').sort(), ['logs-1', 'logs-2']);
  });

  it('negative: two write indices for one alias are rejected', () => {
    const r = new AliasRegistry();
    r.indices = new Set(['a', 'b']);
    assert.throws(
      () =>
        r.update([
          { add: { index: 'a', alias: 'w', is_write_index: true } },
          { add: { index: 'b', alias: 'w', is_write_index: true } },
        ]),
      /more than one write index/,
    );
  });

  it('reindex into a new mapping and swap: the application never sees a missing index', () => {
    const v1 = new Index('products-v1', { properties: { status: { type: 'text' } } });
    v1.index('1', { status: 'Open' });
    v1.refresh();
    const v2 = new Index('products-v2', { properties: { status: { type: 'keyword' } } });
    for (const h of v1.search({ size: 10000 }).hits.hits) v2.index(h._id, h._source); // _reindex
    v2.refresh();
    assert.equal(
      v1.search({ query: { term: { status: 'Open' } } }).hits.hits.length,
      0,
      'text field: term on original value misses',
    );
    assert.equal(
      v2.search({ query: { term: { status: 'Open' } } }).hits.hits.length,
      1,
      'keyword field: exact match works',
    );
  });
});

describe('data streams', () => {
  const t0 = Date.UTC(2026, 10, 4);

  it('names backing indices .ds-<stream>-<yyyy.MM.dd>-<generation>', () => {
    assert.equal(
      backingIndexName('logs-web-default', 1, new Date(t0)),
      '.ds-logs-web-default-2026.11.04-000001',
    );
  });

  it('is append-only: op_type index is rejected, @timestamp is required', () => {
    const ds = new DataStream('logs-web-default', t0);
    assert.throws(() => ds.index({ '@timestamp': 't' }, 'index'), /op_type of create/);
    assert.throws(() => ds.index({ msg: 'x' }), /@timestamp\] is missing/);
    ds.index({ '@timestamp': '2026-11-04T00:00:00Z' }, 'create', 'a');
    assert.throws(
      () => ds.index({ '@timestamp': '2026-11-04T00:00:00Z' }, 'create', 'a'),
      /already exists/,
    );
  });

  it('rollover creates a new write index; searches span all backing indices', () => {
    const ds = new DataStream('logs-web-default', t0);
    ds.index({ '@timestamp': 'a' });
    const next = ds.rollover(t0 + DAY);
    ds.index({ '@timestamp': 'b' });
    assert.equal(next, '.ds-logs-web-default-2026.11.05-000002');
    assert.equal(ds.writeIndex.name, next);
    assert.equal(ds.backing[0]!.docs.size, 1);
    assert.equal(ds.search().length, 2);
  });
});

describe('ILM', () => {
  const conds = { max_age_ms: 30 * DAY, max_primary_shard_size_bytes: 50 * GB };

  it('rolls over when ANY max condition is met', () => {
    assert.equal(
      shouldRollover(conds, {
        ageMs: DAY,
        docs: 10,
        maxPrimaryShardBytes: 51 * GB,
        maxPrimaryShardDocs: 10,
      }),
      true,
    );
    assert.equal(
      shouldRollover(conds, {
        ageMs: 31 * DAY,
        docs: 10,
        maxPrimaryShardBytes: GB,
        maxPrimaryShardDocs: 10,
      }),
      true,
    );
    assert.equal(
      shouldRollover(conds, {
        ageMs: DAY,
        docs: 10,
        maxPrimaryShardBytes: GB,
        maxPrimaryShardDocs: 10,
      }),
      false,
    );
  });

  it('never rolls over an empty index, and min_* conditions must ALL hold', () => {
    assert.equal(
      shouldRollover(conds, {
        ageMs: 100 * DAY,
        docs: 0,
        maxPrimaryShardBytes: 0,
        maxPrimaryShardDocs: 0,
      }),
      false,
    );
    assert.equal(
      shouldRollover(
        { ...conds, min_docs: 1000 },
        { ageMs: 100 * DAY, docs: 5, maxPrimaryShardBytes: 0, maxPrimaryShardDocs: 5 },
      ),
      false,
    );
  });

  const policy: IlmPolicy = {
    phases: {
      hot: { min_age_ms: 0 },
      warm: { min_age_ms: 7 * DAY },
      cold: { min_age_ms: 30 * DAY },
      delete: { min_age_ms: 90 * DAY },
    },
  };

  it('min_age is measured from rollover, not from index creation', () => {
    const idx = { createdAt: 0, rolledOverAt: 20 * DAY };
    assert.equal(currentPhase(policy, idx, 26 * DAY, true), 'hot', '6 days since rollover');
    assert.equal(currentPhase(policy, idx, 28 * DAY, true), 'warm');
    assert.equal(currentPhase(policy, idx, 111 * DAY, true), 'delete');
  });

  it('negative: an index that never rolls over stays in hot forever', () => {
    assert.equal(currentPhase(policy, { createdAt: 0 }, 365 * DAY, true), 'hot');
  });

  it('negative: decreasing min_age across phases is rejected', () => {
    assert.throws(
      () =>
        validatePolicy({
          phases: { warm: { min_age_ms: 30 * DAY }, cold: { min_age_ms: 7 * DAY } },
        }),
      /min_age is lower/,
    );
    assert.doesNotThrow(() => validatePolicy(policy));
  });
});
