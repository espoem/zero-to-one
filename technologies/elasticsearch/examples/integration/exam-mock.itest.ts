/**
 * Verification for the twelve hands-on tasks of the mock exam in exams/elastic-certified-engineer.md:
 * Q-ECE-101 to Q-ECE-112. Each test asserts the numbered checks of its task.
 * Q-ECE-111 needs the secured lab (compose.secure.yml, ES_PASSWORD); Q-ECE-112 the single-node lab.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  setup,
  setupSecure,
  clientAs,
  rest,
  wipe,
  eventually,
  hitIds,
  sortedIds,
  total,
  loadProducts,
  loadEmployees,
  loadLogsWeb,
  productsFile,
  esqlDataset,
  type Rest,
  type J,
} from './exam-helpers.ts';
import { ES_NODES } from './cluster.ts';

let r: Rest | null = null;
let skip: string | false = 'not connected yet';
let sr: Rest | null = null;
let secureSkip: string | false = 'not connected yet';
before(async () => {
  ({ r, skip } = await setup());
  ({ r: sr, skip: secureSkip } = await setupSecure());
});
after(async () => {
  if (r) {
    await wipe(r, {
      streams: ['logs-shop-prod'],
      indices: [
        'library',
        'app-metrics-2026.11',
        'products',
        'products-v3',
        'products-copy',
        'employees',
        'languages_lookup',
        'logs-web-2026.11.03',
        'logs-web-2026.11.04',
        'events',
        'stuck',
      ],
      templates: ['app-metrics', 'logs-shop'],
      components: ['app-settings'],
      pipelines: ['to-v3'],
      policies: ['shop-policy'],
    });
  }
  if (sr) await wipe(sr, { streams: ['logs-app-default'], templates: ['logs-app'] });
});

describe('Mock exam: hands-on tasks', () => {
  it('Q-ECE-101: library mapping with nested authors', async (t) => {
    if (skip) return t.skip(skip);
    await wipe(r!, { indices: ['library'] });
    await r!.call('PUT', '/library', {
      settings: { number_of_shards: 1, number_of_replicas: 0 },
      mappings: {
        dynamic: 'strict',
        properties: {
          title: { type: 'text', analyzer: 'english', fields: { raw: { type: 'keyword' } } },
          isbn: { type: 'keyword' },
          pages: { type: 'short' },
          published: { type: 'date' },
          authors: {
            type: 'nested',
            properties: { name: { type: 'keyword' }, born: { type: 'integer' } },
          },
        },
      },
    });
    const m = (await r!.call('GET', '/library/_mapping')).library.mappings;
    assert.equal(m.dynamic, 'strict');
    assert.equal(m.properties.title.analyzer, 'english');
    assert.equal(m.properties.title.fields.raw.type, 'keyword');
    assert.equal(m.properties.pages.type, 'short');
    assert.equal(m.properties.published.type, 'date');
    assert.equal(m.properties.authors.type, 'nested');
    assert.equal(m.properties.authors.properties.born.type, 'integer');
    await r!.call(
      'PUT',
      '/library/_doc/1',
      {
        title: 'Notes',
        isbn: '9',
        authors: [
          { name: 'Ada', born: 1815 },
          { name: 'Alan', born: 1912 },
        ],
      },
      { refresh: 'true' },
    );
    const by = (name: string, born: number): J => ({
      query: {
        nested: {
          path: 'authors',
          query: {
            bool: {
              filter: [{ term: { 'authors.name': name } }, { term: { 'authors.born': born } }],
            },
          },
        },
      },
    });
    assert.equal(total(await r!.call('GET', '/library/_search', by('Ada', 1912))), 0);
    assert.equal(total(await r!.call('GET', '/library/_search', by('Ada', 1815))), 1);
    await r!.fails(
      'PUT',
      '/library/_doc/2',
      { isbn: '1', colour: 'red' },
      400,
      /strict_dynamic_mapping_exception/,
    );
  });

  it('Q-ECE-102: dynamic templates by name suffix and by path', async (t) => {
    if (skip) return t.skip(skip);
    await wipe(r!, {
      indices: ['app-metrics-2026.11'],
      templates: ['app-metrics'],
      components: ['app-settings'],
    });
    assert.equal(
      (
        await r!.call('PUT', '/_component_template/app-settings', {
          template: { settings: { number_of_shards: 1, number_of_replicas: 0 } },
        })
      ).acknowledged,
      true,
    );
    const put = await r!.call('PUT', '/_index_template/app-metrics', {
      index_patterns: ['app-metrics-*'],
      composed_of: ['app-settings'],
      priority: 300,
      template: {
        mappings: {
          dynamic_templates: [
            {
              codes: {
                match_mapping_type: 'string',
                match: '*_code',
                mapping: { type: 'keyword' },
              },
            },
            {
              labels: { path_match: 'labels.*', mapping: { type: 'keyword', ignore_above: 1024 } },
            },
          ],
        },
      },
    });
    assert.equal(put.acknowledged, true);
    assert.equal((await r!.call('GET', '/_index_template/app-metrics')).index_templates.length, 1);
    const sim = await r!.call('POST', '/_index_template/_simulate_index/app-metrics-test');
    assert.equal(String(sim.template.settings.index.number_of_shards), '1');
    assert.equal(String(sim.template.settings.index.number_of_replicas), '0');
    const dts = JSON.stringify(sim.template.mappings.dynamic_templates);
    assert.ok(dts.includes('codes') && dts.includes('labels'));
    await r!.call(
      'POST',
      '/app-metrics-2026.11/_doc',
      { country_code: 'CZ', labels: { env: 'prod' }, note: 'x' },
      { refresh: 'true' },
    );
    const p = (await r!.call('GET', '/app-metrics-2026.11/_mapping'))['app-metrics-2026.11']
      .mappings.properties;
    assert.equal(p.country_code.type, 'keyword');
    assert.equal(p.labels.properties.env.type, 'keyword');
    assert.equal(p.labels.properties.env.ignore_above, 1024);
    assert.equal(p.note.type, 'text');
    assert.ok(p.note.fields.keyword);
  });

  it('Q-ECE-103: multi_match ranking, range plus exists, phrase with slop', async (t) => {
    if (skip) return t.skip(skip);
    await loadProducts(r!);
    const rank = await r!.call('GET', '/products/_search', {
      query: {
        multi_match: {
          query: 'office',
          fields: ['name^3', 'description'],
          type: 'best_fields',
          tie_breaker: 0.3,
        },
      },
    });
    assert.deepEqual(hitIds(rank), ['p4', 'p2', 'p5']);
    const filt = await r!.call('GET', '/products/_search', {
      query: {
        bool: {
          filter: [
            { range: { released: { gte: '2026-01-01', lt: '2027-01-01' } } },
            { exists: { field: 'tags' } },
          ],
        },
      },
    });
    assert.deepEqual(sortedIds(filt), ['p2', 'p3', 'p5']);
    const phrase = await r!.call('GET', '/products/_search', {
      query: { match_phrase: { name: { query: 'keyboard mouse', slop: 1 } } },
    });
    assert.deepEqual(hitIds(phrase), ['p5']);
  });

  it('Q-ECE-104: ES|QL LOOKUP JOIN on a lookup index and MV_EXPAND', async (t) => {
    if (skip) return t.skip(skip);
    await loadEmployees(r!);
    await wipe(r!, { indices: ['languages_lookup'] });
    await r!.call('PUT', '/languages_lookup', {
      settings: { 'index.mode': 'lookup' },
      mappings: {
        properties: { languages: { type: 'integer' }, language_name: { type: 'keyword' } },
      },
    });
    await r!.bulk(
      '/_bulk',
      esqlDataset.lookup['languages_lookup']!.flatMap((d) => [
        { index: { _index: 'languages_lookup' } },
        d,
      ]),
      { refresh: 'true' },
    );
    await r!.fails(
      'POST',
      '/_query',
      { query: 'FROM employees | LOOKUP JOIN employees ON emp_no' },
      400,
      undefined,
      { format: 'json' },
    );
    const join = await r!.call(
      'POST',
      '/_query',
      {
        query:
          'FROM employees | KEEP emp_no, languages | LOOKUP JOIN languages_lookup ON languages | SORT emp_no, language_name',
      },
      { format: 'json' },
    );
    assert.deepEqual(
      join.columns.map((c: J) => c.name),
      ['emp_no', 'languages', 'language_name'],
    );
    assert.deepEqual(join.values, [
      [1, 2, 'Czech'],
      [1, 2, 'Slovak'],
      [2, 3, 'German'],
      [3, 1, 'English'],
      [4, null, null],
      [5, 2, 'Czech'],
      [5, 2, 'Slovak'],
    ]);
    const skills = await r!.call(
      'POST',
      '/_query',
      {
        query:
          'FROM employees | MV_EXPAND skills | STATS n = COUNT(*) BY skills | SORT n DESC, skills | LIMIT 2',
      },
      { format: 'json' },
    );
    assert.deepEqual(skills.values, [
      [3, 'java'],
      [1, 'k8s'],
    ]);
  });

  it('Q-ECE-105: terms with avg sub-aggregation and cardinality, no hits', async (t) => {
    if (skip) return t.skip(skip);
    await loadProducts(r!);
    const res = await r!.call('GET', '/products/_search', {
      size: 0,
      aggs: {
        cats: { terms: { field: 'category' }, aggs: { avg_price: { avg: { field: 'price' } } } },
        tag_count: { cardinality: { field: 'tags' } },
      },
    });
    const avg = Object.fromEntries(
      (res.aggregations.cats.buckets as J[]).map((b) => [b.key, [b.doc_count, b.avg_price.value]]),
    );
    assert.deepEqual(avg, {
      accessories: [2, 35],
      bundles: [1, 90],
      keyboards: [2, 90],
      mice: [2, 47.5],
    });
    assert.equal(res.aggregations.tag_count.value, 4);
    assert.deepEqual(res.hits.hits, []);
  });

  it('Q-ECE-106: filter and sum per host plus a sum_bucket pipeline', async (t) => {
    if (skip) return t.skip(skip);
    await loadLogsWeb(r!);
    const res = await r!.call('GET', '/logs-web-*/_search', {
      size: 0,
      aggs: {
        by_host: {
          terms: { field: 'host' },
          aggs: {
            errors: { filter: { range: { status: { gte: 500 } } } },
            bytes: { sum: { field: 'bytes' } },
          },
        },
        total_bytes: { sum_bucket: { buckets_path: 'by_host>bytes' } },
      },
    });
    const hosts = Object.fromEntries(
      (res.aggregations.by_host.buckets as J[]).map((b) => [
        b.key,
        [b.doc_count, b.errors.doc_count, b.bytes.value],
      ]),
    );
    assert.deepEqual(hosts, { 'web-1': [3, 1, 2000], 'web-2': [1, 1, 0] });
    assert.equal(res.aggregations.total_bytes.value, 2000);
  });

  it('Q-ECE-107: ingest pipeline with a Painless script, simulated and used by _reindex', async (t) => {
    if (skip) return t.skip(skip);
    await loadProducts(r!);
    await wipe(r!, { indices: ['products-v3'], pipelines: ['to-v3'] });
    await r!.call('PUT', '/_ingest/pipeline/to-v3', {
      processors: [
        { set: { field: 'schema', value: 'v3' } },
        { script: { source: 'ctx.price_czk = ctx.price * 25' } },
      ],
    });
    const sim = await r!.call('POST', '/_ingest/pipeline/to-v3/_simulate', {
      docs: [{ _source: { price: 120 } }],
    });
    assert.equal(sim.docs[0].doc._source.price_czk, 3000);
    assert.equal(sim.docs[0].doc._source.schema, 'v3');
    await r!.call('PUT', '/products-v3', {
      settings: { number_of_shards: 1, number_of_replicas: 0 },
      mappings: productsFile.mapping,
    });
    const re = await r!.call(
      'POST',
      '/_reindex',
      { source: { index: 'products' }, dest: { index: 'products-v3', pipeline: 'to-v3' } },
      { refresh: 'true' },
    );
    assert.equal(re.total, 7);
    assert.equal(re.created, 7);
    assert.deepEqual(re.failures, []);
    const all = await r!.call('GET', '/products-v3/_search', { size: 10 });
    const byId = Object.fromEntries((all.hits.hits as J[]).map((h) => [h._id, h._source]));
    assert.equal(byId['p4'].price_czk, 375);
    assert.equal(byId['p6'].price_czk, 1125);
    assert.ok(Object.values(byId).every((s: J) => s.schema === 'v3'));
  });

  it('Q-ECE-108: update_by_query with params, then delete_by_query', async (t) => {
    if (skip) return t.skip(skip);
    await loadProducts(r!);
    await loadProducts(r!, 'products-copy');
    const upd = await r!.call(
      'POST',
      '/products-copy/_update_by_query',
      {
        query: { term: { category: 'mice' } },
        script: { source: 'ctx._source.price += params.delta', params: { delta: 10 } },
      },
      { conflicts: 'proceed', refresh: 'true' },
    );
    assert.equal(upd.updated, 2);
    assert.equal(upd.version_conflicts, 0);
    assert.equal((await r!.call('GET', '/products-copy/_doc/p3'))._source.price, 90);
    assert.equal((await r!.call('GET', '/products-copy/_doc/p4'))._source.price, 25);
    assert.equal((await r!.call('GET', '/products-copy/_doc/p1'))._source.price, 120);
    const del = await r!.call(
      'POST',
      '/products-copy/_delete_by_query',
      { query: { term: { in_stock: false } } },
      { conflicts: 'proceed', refresh: 'true' },
    );
    assert.equal(del.deleted, 2);
    assert.equal((await r!.call('GET', '/products-copy/_count')).count, 5);
  });

  it('Q-ECE-109: bulk load with routing, refresh disabled, then production settings', async (t) => {
    if (skip) return t.skip(skip);
    await wipe(r!, { indices: ['events'] });
    await r!.call('PUT', '/events', {
      settings: {
        number_of_shards: 3,
        number_of_replicas: 0,
        refresh_interval: '-1',
        'index.translog.durability': 'request',
      },
    });
    const s = (await r!.call('GET', '/events/_settings')).events.settings.index;
    assert.equal(s.number_of_shards, '3');
    assert.equal(s.number_of_replicas, '0');
    assert.equal(s.refresh_interval, '-1');
    assert.equal(s.translog.durability, 'request');
    const lines = ['a', 'a', 'a', 'b', 'b', 'b'].flatMap((k) => [
      { index: { routing: k } },
      { r: k },
    ]);
    const bulk = await r!.bulk('/events/_bulk', lines);
    assert.equal(bulk.errors, false);
    assert.equal((bulk.items as J[]).filter((i) => i.index.result === 'created').length, 6);
    assert.equal(total(await r!.call('GET', '/events/_search')), 0);
    await r!.call('POST', '/events/_refresh');
    const routed = await r!.call(
      'GET',
      '/events/_search',
      { query: { term: { r: 'a' } } },
      { routing: 'a' },
    );
    assert.equal(total(routed), 3);
    assert.equal(routed._shards.total, 1);
    await r!.call('PUT', '/events/_settings', { refresh_interval: null, number_of_replicas: 1 });
    const after = (await r!.call('GET', '/events/_settings')).events.settings.index;
    assert.equal(after.refresh_interval, undefined);
    assert.equal(after.number_of_replicas, '1');
  });

  it('Q-ECE-110: ILM policy, data stream template, manual rollover and lifecycle state', async (t) => {
    if (skip) return t.skip(skip);
    await wipe(r!, {
      streams: ['logs-shop-prod'],
      templates: ['logs-shop'],
      policies: ['shop-policy'],
    });
    await r!.call('PUT', '/_cluster/settings', {
      persistent: { 'indices.lifecycle.poll_interval': '1s' },
    });
    try {
      await r!.call('PUT', '/_ilm/policy/shop-policy', {
        policy: {
          phases: {
            hot: { actions: { rollover: { max_age: '7d', max_primary_shard_size: '50gb' } } },
            delete: { min_age: '30d', actions: { delete: {} } },
          },
        },
      });
      const pol = (await r!.call('GET', '/_ilm/policy/shop-policy'))['shop-policy'].policy.phases;
      assert.equal(pol.hot.actions.rollover.max_age, '7d');
      assert.equal(pol.hot.actions.rollover.max_primary_shard_size, '50gb');
      assert.equal(pol.delete.min_age, '30d');
      assert.ok(pol.delete.actions.delete);

      await r!.call('PUT', '/_index_template/logs-shop', {
        index_patterns: ['logs-shop-*'],
        data_stream: {},
        priority: 200,
        template: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
            'index.lifecycle.name': 'shop-policy',
          },
        },
      });
      const tpl = (await r!.call('GET', '/_index_template/logs-shop')).index_templates[0]
        .index_template;
      assert.ok(tpl.data_stream);
      const sim = await r!.call('POST', '/_index_template/_simulate_index/logs-shop-test');
      assert.equal(sim.template.settings.index.lifecycle.name, 'shop-policy');

      await r!.call('POST', '/logs-shop-prod/_doc', {
        '@timestamp': '2026-11-04T10:00:00Z',
        msg: 'one',
      });
      await r!.call('POST', '/logs-shop-prod/_doc', {
        '@timestamp': '2026-11-04T10:01:00Z',
        msg: 'two',
      });
      const one = (await r!.call('GET', '/_data_stream/logs-shop-prod')).data_streams[0];
      assert.equal(one.indices.length, 1);
      assert.match(one.indices[0].index_name, /^\.ds-logs-shop-prod-\d{4}\.\d{2}\.\d{2}-000001$/);

      const ro = await r!.call('POST', '/logs-shop-prod/_rollover');
      assert.equal(ro.rolled_over, true);
      assert.match(ro.new_index, /-000002$/);
      assert.equal(
        (await r!.call('GET', '/_data_stream/logs-shop-prod')).data_streams[0].indices.length,
        2,
      );

      const e = await eventually(async () => {
        const x = Object.values(
          (await r!.call('GET', `/${ro.new_index}/_ilm/explain`)).indices as Record<string, J>,
        )[0];
        return x?.phase === 'hot' ? x : false;
      }, 'the new write index to be in the hot phase');
      assert.equal(e.managed, true);
      assert.equal(e.policy, 'shop-policy');
    } finally {
      await r!.tryCall('PUT', '/_cluster/settings', {
        persistent: { 'indices.lifecycle.poll_interval': null },
      });
    }
  });

  it('Q-ECE-111: an API key limited to create_doc on logs-app-*', async (t) => {
    if (secureSkip) return t.skip(secureSkip);
    await wipe(sr!, { streams: ['logs-app-default'], templates: ['logs-app'] });
    await sr!.call('PUT', '/_index_template/logs-app', {
      index_patterns: ['logs-app-*'],
      data_stream: {},
      priority: 200,
      template: { settings: { number_of_replicas: 0 } },
    });
    const key = await sr!.call('POST', '/_security/api_key', {
      name: 'ingest-service',
      expiration: '30d',
      role_descriptors: {
        log_writer: {
          indices: [{ names: ['logs-app-*'], privileges: ['create_doc', 'auto_configure'] }],
        },
      },
    });
    try {
      assert.ok(key.id && key.api_key && key.encoded);
      assert.ok(key.expiration > Date.now());
      const svc = rest(clientAs({ apiKey: key.encoded }));
      const created = await svc.call('POST', '/logs-app-default/_doc', {
        '@timestamp': '2026-11-04T10:00:00Z',
        m: 'x',
      });
      assert.equal(created.result, 'created');
      await svc.fails('GET', '/logs-app-default/_search', undefined, 403, /security_exception/);
      await svc.fails(
        'DELETE',
        `/logs-app-default/_doc/${created._id}`,
        undefined,
        403,
        /security_exception/,
      );
      await sr!.call('DELETE', '/_security/api_key', { name: 'ingest-service' });
      await svc.fails(
        'POST',
        '/logs-app-default/_doc',
        { '@timestamp': '2026-11-04T10:00:00Z', m: 'y' },
        401,
      );
    } finally {
      await sr!.tryCall('DELETE', '/_security/api_key', { name: 'ingest-service' });
    }
  });

  it('Q-ECE-112: an unsatisfiable allocation filter leaves the primary unassigned', async (t) => {
    if (skip) return t.skip(skip);
    if (ES_NODES !== 1) return t.skip('needs the single-node lab (ES_NODES=1)');
    await wipe(r!, { indices: ['stuck'] });
    await r!.call('PUT', '/stuck', {
      settings: { number_of_replicas: 0, 'index.routing.allocation.require.box_type': 'warm' },
    });
    const red = await eventually(async () => {
      const h = await r!.call('GET', '/_cluster/health/stuck');
      return h.status === 'red' ? h : false;
    }, 'the index to be red');
    assert.equal(red.status, 'red');
    const ex = await r!.call('GET', '/_cluster/allocation/explain', {
      index: 'stuck',
      shard: 0,
      primary: true,
    });
    const deciders = (ex.node_allocation_decisions as J[]).flatMap((n) => n.deciders ?? []) as J[];
    assert.ok(
      deciders.some((d) => d.decider === 'filter' && d.decision === 'NO'),
      JSON.stringify(deciders),
    );
    await r!.call('PUT', '/stuck/_settings', { 'index.routing.allocation.require.box_type': null });
    assert.equal(
      (
        await r!.call('GET', '/_cluster/health/stuck', undefined, {
          wait_for_status: 'green',
          timeout: '30s',
        })
      ).status,
      'green',
    );
  });
});
