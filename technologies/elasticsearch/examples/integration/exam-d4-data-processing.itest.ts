/**
 * Verification for the Domain 4 (Data Processing) hands-on tasks of exams/elastic-certified-engineer.md:
 * Q-ECE-034, 035, 037, 040, 041, 043, 044.
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
  productsFile,
  type Rest,
  type J,
} from './exam-helpers.ts';

let r: Rest | null = null;
let skip: string | false = 'not connected yet';
before(async () => ({ r, skip } = await setup()));
after(async () => {
  if (r)
    await wipe(r, {
      indices: ['inventory', 'products', 'products-v2', 'notes', 'catalog-syn', 'ac', 'ac-bad'],
      pipelines: ['access-logs', 'tag-v2'],
      synonyms: ['product-synonyms'],
    });
});

describe('Domain 4: Data Processing (hands-on)', () => {
  it('Q-ECE-034: ingest pipeline parses, converts and tolerates a bad bytes value', async (t) => {
    if (skip) return t.skip(skip);
    await wipe(r!, { pipelines: ['access-logs'] });
    await r!.call('PUT', '/_ingest/pipeline/access-logs', {
      processors: [
        {
          dissect: {
            field: 'message',
            pattern: '%{client} [%{ts}] "%{verb} %{path}" %{status} %{bytes}',
          },
        },
        { convert: { field: 'status', type: 'integer' } },
        { convert: { field: 'bytes', type: 'long', ignore_failure: true } },
        { date: { field: 'ts', formats: ['ISO8601'], target_field: '@timestamp' } },
        { remove: { field: 'ts' } },
        { set: { field: 'event.outcome', value: 'failure', if: 'ctx.status >= 500' } },
        { lowercase: { field: 'verb' } },
      ],
    });
    const msg = (bytes: string) => `10.0.0.5 [2026-11-04T10:00:00Z] "GET /index" 500 ${bytes}`;
    const sim = await r!.call('POST', '/_ingest/pipeline/access-logs/_simulate', {
      docs: [{ _source: { message: msg('1200') } }, { _source: { message: msg('abc') } }],
    });
    const d1 = sim.docs[0].doc._source;
    assert.equal(d1.client, '10.0.0.5');
    assert.equal(d1.verb, 'get');
    assert.equal(d1.path, '/index');
    assert.equal(d1.status, 500);
    assert.equal(d1.bytes, 1200);
    assert.equal(d1['@timestamp'], '2026-11-04T10:00:00.000Z');
    assert.equal(d1.event.outcome, 'failure');
    assert.equal('ts' in d1, false);
    const d2 = sim.docs[1];
    assert.equal(d2.error, undefined, 'the document must not be rejected');
    assert.equal(d2.doc._source.bytes, 'abc');
    assert.equal(d2.doc._source.verb, 'get', 'later processors still ran');
    assert.equal(d2.doc._source.event.outcome, 'failure');
  });

  it('Q-ECE-035: a parameterised scripted update', async (t) => {
    if (skip) return t.skip(skip);
    await wipe(r!, { indices: ['inventory'] });
    await r!.call('PUT', '/inventory/_doc/1', { stock: 5, in_stock: true });
    const res = await r!.call('POST', '/inventory/_update/1', {
      script: {
        source:
          'ctx._source.stock -= params.qty; if (ctx._source.stock <= 0) { ctx._source.in_stock = false }',
        params: { qty: 5 },
      },
    });
    assert.equal(res.result, 'updated');
    const doc = await r!.call('GET', '/inventory/_doc/1');
    assert.deepEqual(doc._source, { stock: 0, in_stock: false });
    assert.equal(doc._version, 2);
  });

  it('Q-ECE-037: an idempotent reindex through a pipeline with op_type create', async (t) => {
    if (skip) return t.skip(skip);
    await loadProducts(r!);
    await wipe(r!, { indices: ['products-v2'], pipelines: ['tag-v2'] });
    await r!.call('PUT', '/_ingest/pipeline/tag-v2', {
      processors: [{ set: { field: 'schema', value: 'v2' } }],
    });
    await r!.call('PUT', '/products-v2', {
      settings: { number_of_shards: 1, number_of_replicas: 0 },
      mappings: productsFile.mapping,
    });
    const body = {
      source: { index: 'products' },
      dest: { index: 'products-v2', pipeline: 'tag-v2', op_type: 'create' },
      conflicts: 'proceed',
    };
    const run1 = await r!.call('POST', '/_reindex', body, { slices: 'auto', refresh: 'true' });
    assert.equal(run1.total, 7);
    assert.equal(run1.created, 7);
    assert.deepEqual(run1.failures, []);
    const run2 = await r!.call('POST', '/_reindex', body, { slices: 'auto', refresh: 'true' });
    assert.equal(run2.created, 0);
    assert.equal(run2.version_conflicts, 7);
    assert.deepEqual(run2.failures, []);
    assert.equal((await r!.call('GET', '/products-v2/_count')).count, 7);
    const all = await r!.call('GET', '/products-v2/_search', {
      size: 10,
      query: { term: { 'schema.keyword': 'v2' } },
    });
    assert.equal(total(all), 7);
  });

  it('Q-ECE-040: optimistic concurrency control with if_seq_no and if_primary_term', async (t) => {
    if (skip) return t.skip(skip);
    await wipe(r!, { indices: ['notes'] });
    const first = await r!.call('PUT', '/notes/_doc/1', { text: 'v1' });
    const cond = { if_seq_no: first._seq_no, if_primary_term: first._primary_term };
    const second = await r!.call('PUT', '/notes/_doc/1', { text: 'v2' }, cond);
    assert.equal(second.result, 'updated');
    assert.equal(second._seq_no, first._seq_no + 1);
    await r!.fails(
      'PUT',
      '/notes/_doc/1',
      { text: 'v3' },
      409,
      /version_conflict_engine_exception/,
      cond,
    );
  });

  it('Q-ECE-041: updateable synonym_graph search analyzer fed by the Synonyms API', async (t) => {
    if (skip) return t.skip(skip);
    await wipe(r!, { indices: ['catalog-syn'], synonyms: ['product-synonyms'] });
    const rules = [
      { id: 'laptop', synonyms: 'laptop, notebook' },
      { id: 'tv', synonyms: 'tv, television' },
    ];
    await r!.call('PUT', '/_synonyms/product-synonyms', { synonyms_set: rules });
    await r!.call('PUT', '/catalog-syn', {
      settings: {
        number_of_shards: 1,
        number_of_replicas: 0,
        analysis: {
          filter: {
            prod_syn: { type: 'synonym_graph', synonyms_set: 'product-synonyms', updateable: true },
          },
          analyzer: { prod_search: { tokenizer: 'standard', filter: ['lowercase', 'prod_syn'] } },
        },
      },
      mappings: {
        properties: {
          name: { type: 'text', analyzer: 'standard', search_analyzer: 'prod_search' },
        },
      },
    });
    await r!.call('PUT', '/catalog-syn/_doc/1', { name: 'Gaming notebook' });
    await r!.call('PUT', '/catalog-syn/_doc/2', { name: 'Samsung television' });
    await r!.call('PUT', '/catalog-syn/_doc/4', { name: 'smartphone case' }, { refresh: 'true' });
    const find = async (q: string): Promise<string[]> =>
      hitIds(await r!.call('GET', '/catalog-syn/_search', { query: { match: { name: q } } }));
    assert.deepEqual(await find('laptop'), ['1']);
    assert.deepEqual(await find('tv'), ['2']);
    assert.deepEqual(await find('phone'), []);
    await r!.call('PUT', '/_synonyms/product-synonyms', {
      synonyms_set: [...rules, { id: 'phone', synonyms: 'phone, smartphone' }],
    });
    const ids = await eventually(async () => {
      const found = await find('phone');
      return found.length > 0 ? found : false;
    }, 'the updated synonym set to reach the search analyzer');
    assert.deepEqual(ids, ['4']);
  });

  it('Q-ECE-043: edge n-grams at index time, a normal analyzer at search time', async (t) => {
    if (skip) return t.skip(skip);
    await wipe(r!, { indices: ['ac', 'ac-bad'] });
    const analysis = {
      tokenizer: {
        autocomplete_tok: {
          type: 'edge_ngram',
          min_gram: 2,
          max_gram: 10,
          token_chars: ['letter', 'digit'],
        },
      },
      analyzer: { autocomplete: { tokenizer: 'autocomplete_tok', filter: ['lowercase'] } },
    };
    const make = async (index: string, searchAnalyzer: string): Promise<void> => {
      await r!.call('PUT', `/${index}`, {
        settings: { number_of_shards: 1, number_of_replicas: 0, analysis },
        mappings: {
          properties: {
            name: { type: 'text', analyzer: 'autocomplete', search_analyzer: searchAnalyzer },
          },
        },
      });
      await r!.call('PUT', `/${index}/_doc/1`, { name: 'Quick fox' });
      await r!.call('PUT', `/${index}/_doc/2`, { name: 'Quiet room' });
      await r!.call('PUT', `/${index}/_doc/3`, { name: 'Laptop' }, { refresh: 'true' });
    };
    const find = async (index: string, q: string): Promise<string[]> =>
      sortedIds(await r!.call('GET', `/${index}/_search`, { query: { match: { name: q } } }));
    await make('ac', 'standard');
    assert.deepEqual(await find('ac', 'quic'), ['1']);
    assert.deepEqual(await find('ac', 'qu'), ['1', '2']);
    await make('ac-bad', 'autocomplete');
    assert.deepEqual(await find('ac-bad', 'quic'), ['1', '2']);
  });

  it('Q-ECE-044: a runtime field per request and then in the mapping', async (t) => {
    if (skip) return t.skip(skip);
    await loadProducts(r!);
    const script = "emit(doc['price'].value * 25)";
    const res = await r!.call('GET', '/products/_search', {
      runtime_mappings: { price_czk: { type: 'double', script } },
      query: { range: { price_czk: { gte: 2000 } } },
      fields: ['price_czk'],
    });
    assert.deepEqual(sortedIds(res), ['p1', 'p3', 'p5']);
    const p1 = (res.hits.hits as J[]).find((h) => h._id === 'p1');
    assert.deepEqual(p1.fields.price_czk, [3000]);
    await r!.call('PUT', '/products/_mapping', {
      runtime: { price_czk: { type: 'double', script: { source: script } } },
    });
    const again = await r!.call('GET', '/products/_search', {
      query: { range: { price_czk: { gte: 2000 } } },
    });
    assert.deepEqual(sortedIds(again), ['p1', 'p3', 'p5']);
    const m = (await r!.call('GET', '/products/_mapping')).products.mappings;
    assert.ok(m.runtime.price_czk);
    assert.equal(m.properties.price_czk, undefined);
  });
});
