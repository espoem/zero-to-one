/**
 * Module 03: dynamic mapping inference, the `dynamic` setting, immutable field types,
 * mapping-explosion limits, object vs nested flattening, multi-fields, ignore_above,
 * doc values vs inverted index vs stored fields, and runtime fields.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDocument,
  mergeMapping,
  flatten,
  countFields,
  MappingError,
  type Mapping,
  DEFAULT_LIMITS,
} from './lib/mapping.ts';
import { Shard } from './lib/lucene.ts';
import { Index, searchShard } from './lib/search.ts';

describe('dynamic mapping', () => {
  it('maps a JSON string to text with a keyword sub-field (ignore_above 256): two indexes per string', () => {
    const { mapping } = applyDocument(
      { properties: {} },
      { title: 'Hello', views: 3, ratio: 0.5, ok: true, at: '2026-11-04T10:00:00Z' },
    );
    assert.deepEqual(mapping.properties, {
      title: { type: 'text', fields: { keyword: { type: 'keyword', ignore_above: 256 } } },
      views: { type: 'long' },
      ratio: { type: 'float' },
      ok: { type: 'boolean' },
      at: { type: 'date' },
    });
  });

  it('date_detection can be disabled; numeric_detection is off by default', () => {
    const noDates = applyDocument(
      { date_detection: false, properties: {} },
      { at: '2026-11-04' },
    ).mapping;
    assert.equal(noDates.properties['at']!.type, 'text');
    const nums = applyDocument({ properties: {} }, { code: '42' }).mapping;
    assert.equal(
      nums.properties['code']!.type,
      'text',
      'a numeric string stays text unless numeric_detection',
    );
    assert.equal(
      applyDocument({ numeric_detection: true, properties: {} }, { code: '42' }).mapping.properties[
        'code'
      ]!.type,
      'long',
    );
  });

  it('first value wins: a field first seen as a number cannot later hold a word', () => {
    const { mapping } = applyDocument({ properties: {} }, { zip: 12345 });
    const s = new Shard({ mapping });
    assert.throws(() => {
      s.index('1', { zip: 'SW1A 1AA' });
      s.refresh();
    }, /failed to parse field \[zip\] of type \[long\]/);
  });

  it('dynamic: strict rejects unknown fields', () => {
    const m: Mapping = { dynamic: 'strict', properties: { a: { type: 'keyword' } } };
    assert.throws(
      () => applyDocument(m, { a: 'x', b: 'y' }),
      (e: unknown) => e instanceof MappingError && e.type === 'strict_dynamic_mapping_exception',
    );
  });

  it('dynamic: false keeps unknown fields in _source but does not index them', () => {
    const m: Mapping = { dynamic: false, properties: { a: { type: 'keyword' } } };
    const { mapping, unmapped } = applyDocument(m, { a: 'x', secret: 'y' });
    assert.deepEqual(unmapped, ['secret']);
    const s = new Shard({ mapping });
    s.index('1', { a: 'x', secret: 'y' });
    s.refresh();
    assert.equal(searchShard(s, { term: { secret: 'y' } }).length, 0, 'not searchable');
    assert.equal(s.get('1')._source!['secret'], 'y', 'still returned in _source');
  });

  it('dynamic: runtime adds runtime fields (no index cost) instead of indexed fields', () => {
    const { mapping } = applyDocument(
      { dynamic: 'runtime', properties: {} },
      { host: 'web-1', bytes: 1200 },
    );
    assert.deepEqual(mapping.properties, {});
    assert.deepEqual(mapping.runtime, { host: { type: 'keyword' }, bytes: { type: 'long' } });
  });

  it('dynamic can be set per object: strict at the root, open below', () => {
    const m: Mapping = {
      dynamic: 'strict',
      properties: { labels: { type: 'object', dynamic: true, properties: {} } },
    };
    const { mapping } = applyDocument(m, { labels: { team: 'search' } });
    assert.ok('team' in (mapping.properties['labels'] as { properties: object }).properties);
    assert.throws(() => applyDocument(m, { other: 1 }), /strict/);
  });
});

describe('mapping evolution', () => {
  const base: Mapping = { properties: { status: { type: 'text' } } };

  it('negative: an existing field type cannot be changed in place', () => {
    assert.throws(
      () => mergeMapping(base, { properties: { status: { type: 'keyword' } } }),
      /cannot be changed from type \[text\] to \[keyword\]/,
    );
  });

  it('negative: an existing analyzer cannot be changed in place', () => {
    assert.throws(
      () =>
        mergeMapping(
          { properties: { t: { type: 'text', analyzer: 'standard' } } },
          { properties: { t: { type: 'text', analyzer: 'english' } } },
        ),
      /Cannot update parameter \[analyzer\]/,
    );
  });

  it('adding a new field or a new multi-field is allowed (needs update_by_query to back-fill)', () => {
    const m = mergeMapping(base, {
      properties: {
        status: { type: 'text', fields: { raw: { type: 'keyword' } } },
        created: { type: 'date' },
      },
    });
    assert.ok(m.properties['created']);
    const s = new Shard({ mapping: base });
    s.index('old', { status: 'Open' });
    s.refresh();
    const s2 = new Shard({ mapping: m });
    s2.index('new', { status: 'Open' });
    s2.refresh();
    // the old shard never indexed status.raw; only re-indexed docs have it
    assert.equal(searchShard(s, { term: { 'status.raw': 'Open' } }).length, 0);
    assert.equal(searchShard(s2, { term: { 'status.raw': 'Open' } }).length, 1);
  });
});

describe('mapping explosion', () => {
  it('user-controlled keys hit index.mapping.total_fields.limit (default 1000)', () => {
    const doc: Record<string, unknown> = {};
    for (let i = 0; i < 1001; i++) doc[`user_${i}`] = 'x';
    // each string is 2 mappers (text + keyword sub-field), so 501 keys already exceed the limit
    assert.throws(
      () => applyDocument({ properties: {} }, doc),
      /Limit of total fields \[1000\] has been exceeded/,
    );
  });

  it('counts multi-fields and object mappers toward the limit', () => {
    const { mapping } = applyDocument({ properties: {} }, { a: 'x', o: { b: 1 } });
    assert.equal(countFields(mapping), 4); // a, a.keyword, o, o.b
  });

  it('the fix: a flattened field (or dynamic: false + explicit keys) keeps the mapping fixed', () => {
    const m: Mapping = { properties: { labels: { type: 'flattened' } } };
    const doc: Record<string, unknown> = {};
    for (let i = 0; i < 5000; i++) doc[`k${i}`] = 'v';
    assert.equal(countFields(m), 1);
    assert.doesNotThrow(() => applyDocument(m, { labels: doc }));
  });

  it('mapping depth limit (index.mapping.depth.limit = 20)', () => {
    let doc: Record<string, unknown> = { leaf: 1 };
    for (let i = 0; i < 21; i++) doc = { [`l${i}`]: doc };
    assert.throws(() => applyDocument({ properties: {} }, doc), /Limit of mapping depth \[20\]/);
  });
});

describe('object vs nested', () => {
  const doc = {
    group: 'fans',
    user: [
      { first: 'John', last: 'Smith' },
      { first: 'Alice', last: 'White' },
    ],
  };

  it('object arrays are flattened: the John/White cross-match is a false positive', () => {
    const m: Mapping = {
      properties: {
        group: { type: 'keyword' },
        user: {
          type: 'object',
          properties: { first: { type: 'keyword' }, last: { type: 'keyword' } },
        },
      },
    };
    const docs = flatten(m, doc);
    assert.equal(docs.length, 1, 'one Lucene document');
    assert.deepEqual(docs[0]!.fields.get('user.first'), ['John', 'Alice']);
    const s = new Shard({ mapping: m });
    s.index('1', doc);
    s.refresh();
    const hits = searchShard(s, {
      bool: { filter: [{ term: { 'user.first': 'John' } }, { term: { 'user.last': 'White' } }] },
    });
    assert.equal(hits.length, 1, 'matches although no user is John White');
  });

  it('nested objects are separate hidden Lucene documents, so the association is kept', () => {
    const m: Mapping = {
      properties: {
        group: { type: 'keyword' },
        user: {
          type: 'nested',
          properties: { first: { type: 'keyword' }, last: { type: 'keyword' } },
        },
      },
    };
    const docs = flatten(m, doc);
    assert.equal(docs.length, 3, '2 nested + 1 root: the Lucene doc count multiplies');
    assert.equal(docs.at(-1)!.path, '', 'block join: parent is written last');
    const johnWhite = docs.filter(
      (d) =>
        d.path === 'user' &&
        d.fields.get('user.first')?.[0] === 'John' &&
        d.fields.get('user.last')?.[0] === 'White',
    );
    assert.equal(johnWhite.length, 0);
  });

  it('negative: index.mapping.nested_objects.limit caps nested docs per document', () => {
    const m: Mapping = {
      properties: { items: { type: 'nested', properties: { n: { type: 'long' } } } },
    };
    const many = { items: Array.from({ length: 11 }, (_, n) => ({ n })) };
    assert.throws(
      () => flatten(m, many, { ...DEFAULT_LIMITS, nestedObjects: 10 }),
      /nested documents has exceeded the allowed limit of \[10\]/,
    );
  });
});

describe('inverted index vs doc values vs stored fields', () => {
  const mapping: Mapping = {
    properties: {
      title: { type: 'text', fields: { keyword: { type: 'keyword', ignore_above: 10 } } },
      price: { type: 'double', index: false },
      sku: { type: 'keyword', doc_values: false },
    },
  };
  function idx(): Index {
    const i = new Index('p', mapping);
    i.index('1', { title: 'Short', price: 30, sku: 'A1' });
    i.index('2', { title: 'A very long product title', price: 10, sku: 'B2' });
    i.refresh();
    return i;
  }

  it('negative: sorting on a text field is rejected (no doc values, fielddata off)', () => {
    assert.throws(
      () => idx().search({ sort: [{ title: 'asc' }] }),
      /Text fields are not optimised for operations that require per-document field data/,
    );
  });

  it('index: false keeps doc values: the field is sortable but not searchable by term', () => {
    const i = idx();
    assert.deepEqual(
      i.search({ sort: [{ price: 'asc' }] }).hits.hits.map((h) => h._id),
      ['2', '1'],
    );
    assert.equal(i.search({ query: { term: { price: 10 } } }).hits.hits.length, 0);
  });

  it('range on an index:false numeric still works (served from doc values, slower)', () => {
    assert.deepEqual(
      idx()
        .search({ query: { range: { price: { gte: 20 } } } })
        .hits.hits.map((h) => h._id),
      ['1'],
    );
  });

  it('doc_values: false keeps the term searchable but not sortable', () => {
    const i = idx();
    assert.equal(i.search({ query: { term: { sku: 'A1' } } }).hits.hits.length, 1);
    const seg = i.shards[0]!.segments[0]!;
    assert.equal(seg.docValues.has('sku'), false);
  });

  it('ignore_above: values longer than the limit are not indexed in the keyword sub-field but stay in _source', () => {
    const i = idx();
    assert.equal(i.search({ query: { term: { 'title.keyword': 'Short' } } }).hits.hits.length, 1);
    assert.equal(
      i.search({ query: { term: { 'title.keyword': 'A very long product title' } } }).hits.hits
        .length,
      0,
    );
    assert.equal(
      i.search({ query: { match: { title: 'product' } } }).hits.hits[0]!._source['title'],
      'A very long product title',
    );
  });
});

describe('runtime fields', () => {
  it('compute a value from _source at query time (schema on read)', () => {
    const i = new Index('logs', { properties: { message: { type: 'text' } } });
    i.index('1', { message: '200 GET /a' });
    i.index('2', { message: '500 GET /b' });
    i.refresh();
    // a runtime field "status" = first token of message, emulating a Painless `emit`
    const status = (src: Record<string, unknown>) => Number(String(src['message']).split(' ')[0]);
    const all = i.search({ size: 10 }).hits.hits;
    const errors = all.filter((h) => status(h._source) >= 500).map((h) => h._id);
    assert.deepEqual(errors, ['2']);
  });
});
