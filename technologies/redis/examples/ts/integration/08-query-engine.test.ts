// Module 08 (integration): HyperLogLog accuracy (any version); JSON, Query Engine, vector search,
// Bloom filters and Vector Sets (Redis 8.0+, built in). 8.x tests skip on older servers.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { connect, needVersion, k, shutdown } from './harness.ts';
import { float32Blob, knn, tagQuery, HLL_STD_ERROR } from '../src/query.ts';
import { mulberry32 } from '../src/zset.ts';

after(shutdown);

test('PFCOUNT of 100 000 distinct items is within 3 standard errors', async (t) => {
  const h = await connect(t);
  if (!h) return;
  const key = k(t, 'hll');
  await h.c.sendCommand(['DEL', key]);
  for (let b = 0; b < 100; b++) {
    await h.c.sendCommand([
      'PFADD',
      key,
      ...Array.from({ length: 1000 }, (_, i) => `user:${b * 1000 + i}`),
    ]);
  }
  const est = (await h.c.sendCommand(['PFCOUNT', key])) as number;
  assert.ok(Math.abs(est - 100_000) / 100_000 < 3 * HLL_STD_ERROR, `estimate ${est}`);
  assert.equal(await h.c.sendCommand(['TYPE', key]), 'string'); // an HLL is a string
  const bytes = (await h.c.sendCommand(['STRLEN', key])) as number;
  assert.ok(bytes <= 12 * 1024 + 16); // dense: 12 KB + header
});

test('JSON: set, read and update by path (8.0+)', async (t) => {
  const h = await connect(t);
  if (!h || !needVersion(t, h.server, '8.0.0')) return;
  const key = k(t, 'doc');
  await h.c.sendCommand([
    'JSON.SET',
    key,
    '$',
    JSON.stringify({ name: 'Ada', tags: ['math'], stats: { logins: 1 } }),
  ]);
  await h.c.sendCommand(['JSON.NUMINCRBY', key, '$.stats.logins', '2']);
  await h.c.sendCommand(['JSON.ARRAPPEND', key, '$.tags', '"code"']);
  const doc = JSON.parse(String(await h.c.sendCommand(['JSON.GET', key, '$'])))[0];
  assert.deepEqual(doc, { name: 'Ada', tags: ['math', 'code'], stats: { logins: 3 } });
});

test('Query Engine: index JSON with TAG/NUMERIC/TEXT/VECTOR and query it (8.0+)', async (t) => {
  const h = await connect(t);
  if (!h || !needVersion(t, h.server, '8.0.0')) return;
  const { c } = h;
  const idx = `idx:${k(t, 'p').replace(/:/g, '_')}`;
  const prefix = `${k(t, 'p')}:`;
  await c.sendCommand(['FT.DROPINDEX', idx]).catch(() => {});
  await c.sendCommand([
    'FT.CREATE',
    idx,
    'ON',
    'JSON',
    'PREFIX',
    '1',
    prefix,
    'SCHEMA',
    '$.title',
    'AS',
    'title',
    'TEXT',
    '$.city',
    'AS',
    'city',
    'TAG',
    '$.price',
    'AS',
    'price',
    'NUMERIC',
    'SORTABLE',
    '$.emb',
    'AS',
    'emb',
    'VECTOR',
    'FLAT',
    '6',
    'TYPE',
    'FLOAT32',
    'DIM',
    '4',
    'DISTANCE_METRIC',
    'COSINE',
  ]);
  const rng = mulberry32(3);
  const items = Array.from({ length: 50 }, (_, i) => ({
    id: `${prefix}${i}`,
    v: Array.from({ length: 4 }, () => rng() - 0.5),
  }));
  for (const [i, it] of items.entries()) {
    const doc = {
      title: i % 2 ? 'red bicycle' : 'blue kettle',
      city: i % 3 ? 'new-york' : 'San Francisco',
      price: i,
      emb: it.v,
    };
    await c.sendCommand(['JSON.SET', it.id, '$', JSON.stringify(doc)]);
  }
  for (let i = 0; i < 50; i++) {
    const info = (await c.sendCommand(['FT.INFO', idx])) as unknown[];
    const pct = Number(info[info.indexOf('percent_indexed') + 1]);
    if (pct >= 1) break;
    await sleep(50);
  }
  // TAG with punctuation, escaped; numeric range; full text.
  const q = `${tagQuery('city', ['new-york'])} @price:[10 19] @title:bicycle`;
  const r = (await c.sendCommand([
    'FT.SEARCH',
    idx,
    q,
    'RETURN',
    '0',
    'DIALECT',
    '2',
  ])) as unknown[];
  const expected = items
    .map((_, i) => i)
    .filter((i) => i % 3 !== 0 && i >= 10 && i <= 19 && i % 2 === 1);
  assert.equal(r[0], expected.length);
  // KNN 5 equals brute force on a FLAT index (exact search).
  const query = items[7]!.v;
  const res = (await c.sendCommand([
    'FT.SEARCH',
    idx,
    '*=>[KNN 5 @emb $vec AS dist]',
    'PARAMS',
    '2',
    'vec',
    float32Blob(query),
    'SORTBY',
    'dist',
    'RETURN',
    '1',
    'dist',
    'DIALECT',
    '2',
  ])) as unknown[];
  const got = res.filter((_, i) => i > 0 && i % 2 === 1) as string[];
  assert.deepEqual(
    got,
    knn(query, items, 5).map((x) => x.id),
  );
  await c.sendCommand(['FT.DROPINDEX', idx]);
});

test('Bloom filter: no false negatives, bounded false positives (8.0+)', async (t) => {
  const h = await connect(t);
  if (!h || !needVersion(t, h.server, '8.0.0')) return;
  const key = k(t, 'bf');
  await h.c.sendCommand(['DEL', key]);
  await h.c.sendCommand(['BF.RESERVE', key, '0.01', '10000']);
  const added = Array.from({ length: 5000 }, (_, i) => `seen:${i}`);
  await h.c.sendCommand(['BF.MADD', key, ...added]);
  const present = (await h.c.sendCommand(['BF.MEXISTS', key, ...added.slice(0, 1000)])) as number[];
  assert.ok(present.every((x) => x === 1)); // never a false negative
  const absent = (await h.c.sendCommand([
    'BF.MEXISTS',
    key,
    ...Array.from({ length: 2000 }, (_, i) => `never:${i}`),
  ])) as number[];
  const fp = absent.filter((x) => x === 1).length / absent.length;
  assert.ok(fp < 0.03, `false-positive rate ${fp}`);
});

test('Vector Set: VADD and VSIM return the nearest element first (8.0+)', async (t) => {
  const h = await connect(t);
  if (!h || !needVersion(t, h.server, '8.0.0')) return;
  const key = k(t, 'vs');
  await h.c.sendCommand(['DEL', key]);
  await h.c.sendCommand(['VADD', key, 'VALUES', '3', '1', '0', '0', 'east']);
  await h.c.sendCommand(['VADD', key, 'VALUES', '3', '0', '1', '0', 'north']);
  await h.c.sendCommand(['VADD', key, 'VALUES', '3', '-1', '0', '0', 'west']);
  const r = (await h.c.sendCommand([
    'VSIM',
    key,
    'VALUES',
    '3',
    '0.9',
    '0.1',
    '0',
    'COUNT',
    '2',
  ])) as string[];
  assert.equal(r[0], 'east');
  assert.equal(await h.c.sendCommand(['VCARD', key]), 3);
});
