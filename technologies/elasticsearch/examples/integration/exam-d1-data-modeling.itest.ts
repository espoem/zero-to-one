/**
 * Verification for the Domain 1 (Data Modeling) hands-on tasks of
 * exams/elastic-certified-engineer.md: Q-ECE-001, 003, 005, 006, 009.
 * Each test performs the task's reference answer and asserts its success criteria.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, wipe, hitIds, total, type Rest, type J } from './exam-helpers.ts';

let r: Rest | null = null;
let skip: string | false = 'not connected yet';
before(async () => ({ r, skip } = await setup()));
after(async () => {
  if (r)
    await wipe(r, {
      indices: ['catalog', 'groups', 'groups-obj', 'places', 'events-2026.11', 'telemetry'],
      templates: ['events'],
      components: ['base-settings'],
    });
});

describe('Domain 1: Data Modeling (hands-on)', () => {
  it('Q-ECE-001: strict catalog index with a keyword multi-field for sorting', async (t) => {
    if (skip) return t.skip(skip);
    await wipe(r!, { indices: ['catalog'] });
    await r!.call('PUT', '/catalog', {
      settings: { number_of_shards: 1, number_of_replicas: 0 },
      mappings: {
        dynamic: 'strict',
        properties: {
          sku: { type: 'keyword' },
          name: { type: 'text', fields: { raw: { type: 'keyword', ignore_above: 128 } } },
          price: { type: 'scaled_float', scaling_factor: 100 },
          in_stock: { type: 'boolean' },
          added: { type: 'date' },
        },
      },
    });
    const m = (await r!.call('GET', '/catalog/_mapping')).catalog.mappings;
    assert.equal(m.dynamic, 'strict');
    assert.equal(m.properties.price.scaling_factor, 100);
    assert.equal(m.properties.name.fields.raw.ignore_above, 128);
    assert.equal(m.properties.sku.type, 'keyword');
    assert.equal(m.properties.in_stock.type, 'boolean');
    assert.equal(m.properties.added.type, 'date');

    await r!.fails(
      'PUT',
      '/catalog/_doc/1',
      { sku: 'a1', colour: 'red' },
      400,
      /strict_dynamic_mapping_exception/,
    );
    const created = await r!.call(
      'PUT',
      '/catalog/_doc/1',
      { sku: 'a1', name: 'Desk lamp', price: 19.99, in_stock: true, added: '2026-11-01' },
      { refresh: 'true' },
    );
    assert.equal(created.result, 'created');

    const ok = await r!.call('GET', '/catalog/_search', { sort: ['name.raw'] });
    assert.equal(total(ok), 1);
    // a text field has no doc values, so sorting on it fails
    await r!.fails('GET', '/catalog/_search', { sort: ['name'] }, [400, 500]);
  });

  it('Q-ECE-003: nested keeps both conditions on one array element, object does not', async (t) => {
    if (skip) return t.skip(skip);
    await wipe(r!, { indices: ['groups', 'groups-obj'] });
    const doc = {
      group: 'fans',
      user: [
        { first: 'John', last: 'Smith' },
        { first: 'Alice', last: 'White' },
      ],
    };
    await r!.call('PUT', '/groups', {
      settings: { number_of_shards: 1, number_of_replicas: 0 },
      mappings: {
        properties: {
          group: { type: 'keyword' },
          user: {
            type: 'nested',
            properties: { first: { type: 'keyword' }, last: { type: 'keyword' } },
          },
        },
      },
    });
    await r!.call('PUT', '/groups/_doc/1', doc, { refresh: 'true' });
    const q = (first: string, last: string): J => ({
      query: {
        nested: {
          path: 'user',
          query: {
            bool: { filter: [{ term: { 'user.first': first } }, { term: { 'user.last': last } }] },
          },
          inner_hits: {},
        },
      },
    });
    assert.equal(total(await r!.call('GET', '/groups/_search', q('John', 'White'))), 0);
    const hit = await r!.call('GET', '/groups/_search', q('Alice', 'White'));
    assert.equal(total(hit), 1);
    assert.equal(hit.hits.hits[0].inner_hits.user.hits.total.value, 1);
    assert.equal(hit.hits.hits[0].inner_hits.user.hits.hits[0]._nested.offset, 1);

    // with `object` the array is flattened into parallel multi-valued fields: the false positive
    await r!.call('PUT', '/groups-obj', {
      settings: { number_of_shards: 1, number_of_replicas: 0 },
      mappings: {
        properties: {
          group: { type: 'keyword' },
          user: {
            type: 'object',
            properties: { first: { type: 'keyword' }, last: { type: 'keyword' } },
          },
        },
      },
    });
    await r!.call('PUT', '/groups-obj/_doc/1', doc, { refresh: 'true' });
    const cross = await r!.call('GET', '/groups-obj/_search', {
      query: {
        bool: { filter: [{ term: { 'user.first': 'John' } }, { term: { 'user.last': 'White' } }] },
      },
    });
    assert.equal(total(cross), 1);
  });

  it('Q-ECE-005: custom analyzer and normalizer fold diacritics', async (t) => {
    if (skip) return t.skip(skip);
    await wipe(r!, { indices: ['places'] });
    await r!.call('PUT', '/places', {
      settings: {
        number_of_shards: 1,
        number_of_replicas: 0,
        analysis: {
          analyzer: {
            fold: { type: 'custom', tokenizer: 'standard', filter: ['lowercase', 'asciifolding'] },
          },
          normalizer: { fold_kw: { type: 'custom', filter: ['lowercase', 'asciifolding'] } },
        },
      },
      mappings: {
        properties: {
          name: {
            type: 'text',
            analyzer: 'fold',
            fields: { exact: { type: 'keyword', normalizer: 'fold_kw' } },
          },
        },
      },
    });
    await r!.call('PUT', '/places/_doc/1', { name: 'Kopřivnice' });
    await r!.call('PUT', '/places/_doc/2', { name: 'Příbor' }, { refresh: 'true' });
    const an = await r!.call('GET', '/places/_analyze', { field: 'name', text: 'Kopřivnice' });
    assert.deepEqual(
      an.tokens.map((x: J) => x.token),
      ['koprivnice'],
    );
    assert.deepEqual(
      hitIds(await r!.call('GET', '/places/_search', { query: { match: { name: 'koprivnice' } } })),
      ['1'],
    );
    assert.deepEqual(
      hitIds(
        await r!.call('GET', '/places/_search', { query: { term: { 'name.exact': 'PRIBOR' } } }),
      ),
      ['2'],
    );
  });

  it('Q-ECE-006: component template + index template + dynamic template, proven with simulate', async (t) => {
    if (skip) return t.skip(skip);
    await wipe(r!, {
      indices: ['events-2026.11'],
      templates: ['events'],
      components: ['base-settings'],
    });
    await r!.call('PUT', '/_component_template/base-settings', {
      template: { settings: { number_of_shards: 1, number_of_replicas: 0 } },
    });
    await r!.call('PUT', '/_index_template/events', {
      index_patterns: ['events-*'],
      composed_of: ['base-settings'],
      priority: 200,
      template: {
        mappings: {
          dynamic_templates: [
            {
              ids_as_keywords: {
                match_mapping_type: 'string',
                match: '*_id',
                mapping: { type: 'keyword' },
              },
            },
          ],
        },
      },
    });
    // the task forbids creating an index before the simulation
    const sim = await r!.call('POST', '/_index_template/_simulate_index/events-test');
    assert.equal(String(sim.template.settings.index.number_of_shards), '1');
    assert.ok(JSON.stringify(sim.template.mappings.dynamic_templates).includes('ids_as_keywords'));

    await r!.call(
      'POST',
      '/events-2026.11/_doc',
      { user_id: '42', note: 'hello' },
      { refresh: 'true' },
    );
    const props = (await r!.call('GET', '/events-2026.11/_mapping'))['events-2026.11'].mappings
      .properties;
    assert.equal(props.user_id.type, 'keyword');
    assert.equal(props.note.type, 'text');
    assert.equal(props.note.fields.keyword.ignore_above, 256);
  });

  it('Q-ECE-009: flattened labels keep the mapping closed while strict rejects unknown fields', async (t) => {
    if (skip) return t.skip(skip);
    await wipe(r!, { indices: ['telemetry'] });
    await r!.call('PUT', '/telemetry', {
      settings: { number_of_shards: 1, number_of_replicas: 0 },
      mappings: {
        dynamic: 'strict',
        properties: {
          '@timestamp': { type: 'date' },
          host: { type: 'keyword' },
          labels: { type: 'flattened' },
        },
      },
    });
    const labels: Record<string, string> = { region: 'eu' };
    for (let i = 1; i <= 29; i++) labels[`k${i}`] = 'v';
    assert.equal(Object.keys(labels).length, 30);
    const created = await r!.call(
      'PUT',
      '/telemetry/_doc/1',
      { '@timestamp': '2026-11-04T10:00:00Z', host: 'h1', labels },
      { refresh: 'true' },
    );
    assert.equal(created.result, 'created');
    const props = (await r!.call('GET', '/telemetry/_mapping')).telemetry.mappings.properties;
    assert.deepEqual(Object.keys(props).sort(), ['@timestamp', 'host', 'labels']);
    assert.equal(props.labels.type, 'flattened');
    assert.deepEqual(
      hitIds(
        await r!.call('GET', '/telemetry/_search', { query: { term: { 'labels.region': 'eu' } } }),
      ),
      ['1'],
    );
    await r!.fails(
      'PUT',
      '/telemetry/_doc/2',
      { '@timestamp': '2026-11-04T10:00:00Z', foo: 1 },
      400,
      /strict_dynamic_mapping_exception/,
    );
  });
});
