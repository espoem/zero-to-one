/**
 * Verification for the Domain 6 (Data Management) hands-on tasks of exams/elastic-certified-engineer.md:
 * Q-ECE-052, 054, 055.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  setup,
  wipe,
  eventually,
  loadProducts,
  productsFile,
  type Rest,
  type J,
} from './exam-helpers.ts';

let r: Rest | null = null;
let skip: string | false = 'not connected yet';
before(async () => ({ r, skip } = await setup()));
after(async () => {
  if (r) {
    await wipe(r, {
      streams: ['logs-web-default', 'logs-ilm-default'],
      indices: ['products-v1', 'products-v2'],
      templates: ['logs-web', 'logs-ilm'],
      policies: ['quick'],
    });
    await r.call('PUT', '/_cluster/settings', {
      persistent: { 'indices.lifecycle.poll_interval': null },
    });
  }
});

describe('Domain 6: Data Management (hands-on)', () => {
  it('Q-ECE-052: atomic alias swap, rollback of a failing request, write index of a two-index alias', async (t) => {
    if (skip) return t.skip(skip);
    await wipe(r!, { indices: ['products-v1', 'products-v2'] });
    await loadProducts(r!, 'products-v1');
    await r!.call('PUT', '/products-v2', {
      settings: { number_of_shards: 1, number_of_replicas: 0 },
      mappings: productsFile.mapping,
    });
    await r!.call('POST', '/_aliases', {
      actions: [{ add: { index: 'products-v1', alias: 'products-live' } }],
    });
    const targets = async (): Promise<string[]> =>
      Object.keys(await r!.call('GET', '/_alias/products-live')).sort();

    await r!.call('POST', '/_aliases', {
      actions: [
        { remove: { index: 'products-v1', alias: 'products-live' } },
        { add: { index: 'products-v2', alias: 'products-live' } },
      ],
    });
    assert.deepEqual(await targets(), ['products-v2']);

    await r!.fails(
      'POST',
      '/_aliases',
      {
        actions: [
          { add: { index: 'products-v1', alias: 'products-live' } },
          { add: { index: 'does-not-exist', alias: 'products-live' } },
        ],
      },
      404,
      /index_not_found_exception/,
    );
    assert.deepEqual(await targets(), ['products-v2'], 'the failing request must change nothing');

    await r!.call('POST', '/_aliases', {
      actions: [{ add: { index: 'products-v1', alias: 'products-live' } }],
    });
    assert.deepEqual(await targets(), ['products-v1', 'products-v2']);
    await r!.fails('PUT', '/products-live/_doc/x', { name: 't' }, 400);
    await r!.call('POST', '/_aliases', {
      actions: [{ add: { index: 'products-v2', alias: 'products-live', is_write_index: true } }],
    });
    await r!.call('PUT', '/products-live/_doc/x', { name: 't' }, { refresh: 'true' });
    assert.equal((await r!.call('GET', '/products-v2/_doc/x')).found, true);
  });

  it('Q-ECE-054: a data stream is append-only and rolls over to a second backing index', async (t) => {
    if (skip) return t.skip(skip);
    await wipe(r!, { streams: ['logs-web-default'], templates: ['logs-web'] });
    await r!.call('PUT', '/_index_template/logs-web', {
      index_patterns: ['logs-web-*'],
      data_stream: {},
      priority: 200,
      template: {
        settings: { number_of_replicas: 0 },
        mappings: { properties: { message: { type: 'text' } } },
      },
    });
    const first = await r!.call('POST', '/logs-web-default/_doc', {
      '@timestamp': '2026-11-04T10:00:00Z',
      message: 'GET /a 200',
    });
    assert.equal(first.result, 'created');
    const one = (await r!.call('GET', '/_data_stream/logs-web-default')).data_streams[0];
    assert.equal(one.indices.length, 1);
    assert.match(one.indices[0].index_name, /^\.ds-logs-web-default-\d{4}\.\d{2}\.\d{2}-000001$/);

    const ro = await r!.call('POST', '/logs-web-default/_rollover');
    assert.equal(ro.rolled_over, true);
    const two = (await r!.call('GET', '/_data_stream/logs-web-default')).data_streams[0];
    assert.equal(two.indices.length, 2);
    assert.match(two.indices[1].index_name, /-000002$/);
    assert.equal(ro.new_index, two.indices[1].index_name);

    await r!.fails('POST', '/logs-web-default/_doc', { message: 'no ts' }, 400);
    await r!.fails(
      'PUT',
      '/logs-web-default/_doc/1',
      { '@timestamp': '2026-11-04T10:00:00Z', message: 'x' },
      400,
    );
    const created = await r!.call('PUT', '/logs-web-default/_create/1', {
      '@timestamp': '2026-11-04T10:00:00Z',
      message: 'x',
    });
    assert.equal(created.result, 'created');
    await wipe(r!, { streams: ['logs-web-default'], templates: ['logs-web'] });
  });

  it('Q-ECE-055: an ILM policy rolls a data stream over and moves the old index to warm', async (t) => {
    if (skip) return t.skip(skip);
    await wipe(r!, { streams: ['logs-ilm-default'], templates: ['logs-ilm'], policies: ['quick'] });
    await r!.call('PUT', '/_cluster/settings', {
      persistent: { 'indices.lifecycle.poll_interval': '1s' },
    });
    await r!.call('PUT', '/_ilm/policy/quick', {
      policy: {
        phases: {
          hot: { actions: { rollover: { max_docs: 3 } } },
          warm: { min_age: '0ms', actions: { set_priority: { priority: 50 } } },
        },
      },
    });
    await r!.call('PUT', '/_index_template/logs-ilm', {
      index_patterns: ['logs-ilm-*'],
      data_stream: {},
      priority: 200,
      template: {
        settings: { number_of_shards: 1, number_of_replicas: 0, 'index.lifecycle.name': 'quick' },
      },
    });
    const lines = Array.from({ length: 4 }, (_, i) => [
      { create: { _index: 'logs-ilm-default' } },
      { '@timestamp': `2026-11-04T10:0${i}:00Z`, msg: `m${i}` },
    ]).flat();
    const bulk = await r!.bulk('/_bulk', lines, { refresh: 'true' });
    assert.equal(bulk.errors, false);

    await eventually(async () => {
      const ds = (await r!.call('GET', '/_data_stream/logs-ilm-default')).data_streams[0];
      return ds.indices.length >= 2 ? ds : false;
    }, 'the stream to get a second backing index');
    const first = (await r!.call('GET', '/_data_stream/logs-ilm-default')).data_streams[0]
      .indices[0].index_name as string;
    const explained = await eventually(async () => {
      const e = Object.values(
        (await r!.call('GET', `/${first}/_ilm/explain`)).indices as Record<string, J>,
      )[0];
      return e?.phase === 'warm' ? e : false;
    }, 'the first backing index to reach the warm phase');
    assert.equal(explained.managed, true);
    const prio = await eventually(async () => {
      const s = Object.values(
        (await r!.call('GET', `/${first}/_settings`)) as Record<string, J>,
      )[0];
      return s.settings.index.priority === '50' ? '50' : false;
    }, 'index.priority 50');
    assert.equal(prio, '50');
  });
});
