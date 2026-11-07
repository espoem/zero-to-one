// Module 02 (integration): OBJECT ENCODING transitions, one-way conversions, type errors,
// hash field expiration (7.4+) and HGETEX (8.0+).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { connect, needVersion, k, shutdown } from './harness.ts';
import { HashModel, SetModel, ZSetModel } from '../src/encoding.ts';

after(shutdown);

test('string encodings match the model: int, embstr, raw', async (t) => {
  const h = await connect(t);
  if (!h) return;
  // In Redis 8+, string embedding in the dictionary entry (kvobj) couples key and value length:
  // key_len + val_len <= 41. A long key name (such as the harness prefix) forces even short strings
  // into raw. We use a 1-byte key name 's' to test the embedding mechanics.
  const shortKey = 's';
  await h.c.sendCommand(['SET', shortKey, '12345']);
  assert.equal(await h.c.sendCommand(['OBJECT', 'ENCODING', shortKey]), 'int');

  await h.c.sendCommand(['SET', shortKey, '007']);
  assert.equal(await h.c.sendCommand(['OBJECT', 'ENCODING', shortKey]), 'embstr');

  // Length boundary: Redis 8 kvobj embeds when key_len + val_len <= 41 (val <= 40 for 1-byte key).
  // Valkey 9 embeds up to 128 bytes (2 cache lines); Redis 7 embedded up to 44 bytes regardless of key.
  if (h.server.flavour === 'redis' && h.server.version.startsWith('8.')) {
    await h.c.sendCommand(['SET', shortKey, 'x'.repeat(40)]);
    assert.equal(await h.c.sendCommand(['OBJECT', 'ENCODING', shortKey]), 'embstr');
    await h.c.sendCommand(['SET', shortKey, 'x'.repeat(41)]);
    assert.equal(await h.c.sendCommand(['OBJECT', 'ENCODING', shortKey]), 'raw');

    // Long key (>40 bytes) forces raw encoding even for short strings in Redis 8
    const longKey = k(t, 'longkey_exceeding_kvobj_embedding_limit');
    await h.c.sendCommand(['SET', longKey, '007']);
    assert.equal(await h.c.sendCommand(['OBJECT', 'ENCODING', longKey]), 'raw');
  } else if (h.server.flavour === 'valkey') {
    await h.c.sendCommand(['SET', shortKey, 'x'.repeat(44)]);
    assert.equal(await h.c.sendCommand(['OBJECT', 'ENCODING', shortKey]), 'embstr');
  } else {
    await h.c.sendCommand(['SET', shortKey, 'x'.repeat(44)]);
    assert.equal(await h.c.sendCommand(['OBJECT', 'ENCODING', shortKey]), 'embstr');
    await h.c.sendCommand(['SET', shortKey, 'x'.repeat(45)]);
    assert.equal(await h.c.sendCommand(['OBJECT', 'ENCODING', shortKey]), 'raw');
  }

  // APPEND always produces a raw (modifiable) string, even when short.
  await h.c.sendCommand(['SET', shortKey, 'ab']);
  await h.c.sendCommand(['APPEND', shortKey, 'c']);
  assert.equal(await h.c.sendCommand(['OBJECT', 'ENCODING', shortKey]), 'raw');
});

test('hash: listpack -> hashtable at 513 fields, and no conversion back after HDEL', async (t) => {
  const h = await connect(t);
  if (!h) return;
  const key = k(t, 'h');
  await h.c.sendCommand(['DEL', key]);
  const model = new HashModel();
  const args: string[] = [];
  for (let i = 0; i < 512; i++) {
    args.push(`f${i}`, 'v');
    model.hset(`f${i}`, 'v');
  }
  await h.c.sendCommand(['HSET', key, ...args]);
  assert.equal(await h.c.sendCommand(['OBJECT', 'ENCODING', key]), model.encoding);
  assert.equal(model.encoding, 'listpack');
  await h.c.sendCommand(['HSET', key, 'extra', 'v']);
  model.hset('extra', 'v');
  assert.equal(await h.c.sendCommand(['OBJECT', 'ENCODING', key]), 'hashtable');
  const del: string[] = [];
  for (let i = 0; i < 500; i++) del.push(`f${i}`);
  await h.c.sendCommand(['HDEL', key, ...del]);
  assert.equal(await h.c.sendCommand(['OBJECT', 'ENCODING', key]), 'hashtable');
});

test('set: intset -> listpack (7.2+) -> hashtable', async (t) => {
  const h = await connect(t);
  if (!h || !needVersion(t, h.server, '7.2.0', { valkey: '8.0.0' })) return;
  const key = k(t, 's');
  await h.c.sendCommand(['DEL', key]);
  const m = new SetModel();
  await h.c.sendCommand(['SADD', key, '1', '2', '3']);
  ['1', '2', '3'].forEach((x) => m.sadd(x));
  assert.equal(await h.c.sendCommand(['OBJECT', 'ENCODING', key]), 'intset');
  await h.c.sendCommand(['SADD', key, 'apple']);
  m.sadd('apple');
  assert.equal(await h.c.sendCommand(['OBJECT', 'ENCODING', key]), m.encoding);
  const many = Array.from({ length: 200 }, (_, i) => `m${i}`);
  await h.c.sendCommand(['SADD', key, ...many]);
  assert.equal(await h.c.sendCommand(['OBJECT', 'ENCODING', key]), 'hashtable');
});

test('zset: listpack -> skiplist at 129 members', async (t) => {
  const h = await connect(t);
  if (!h) return;
  const key = k(t, 'z');
  await h.c.sendCommand(['DEL', key]);
  const m = new ZSetModel();
  const args: string[] = [];
  for (let i = 0; i < 128; i++) {
    args.push(String(i), `m${i}`);
    m.zadd(`m${i}`, i);
  }
  await h.c.sendCommand(['ZADD', key, ...args]);
  assert.equal(await h.c.sendCommand(['OBJECT', 'ENCODING', key]), 'listpack');
  await h.c.sendCommand(['ZADD', key, '999', 'm128']);
  assert.equal(await h.c.sendCommand(['OBJECT', 'ENCODING', key]), 'skiplist');
  // Ties order by member bytes.
  await h.c.sendCommand(['ZADD', key, '5000', 'b', '5000', 'a']);
  assert.deepEqual(await h.c.sendCommand(['ZRANGE', key, '-2', '-1']), ['a', 'b']);
});

test('list: small lists are listpack (7.2+), large ones quicklist', async (t) => {
  const h = await connect(t);
  if (!h || !needVersion(t, h.server, '7.2.0', { valkey: '8.0.0' })) return;
  const key = k(t, 'l');
  await h.c.sendCommand(['DEL', key]);
  await h.c.sendCommand(['RPUSH', key, 'a', 'b']);
  assert.equal(await h.c.sendCommand(['OBJECT', 'ENCODING', key]), 'listpack');
  await h.c.sendCommand(['RPUSH', key, ...Array.from({ length: 200 }, () => 'x'.repeat(100))]);
  assert.equal(await h.c.sendCommand(['OBJECT', 'ENCODING', key]), 'quicklist');
});

test('negative: WRONGTYPE when a command meets a key of another type', async (t) => {
  const h = await connect(t);
  if (!h) return;
  await h.c.sendCommand(['SET', k(t, 'str'), 'v']);
  await assert.rejects(h.c.sendCommand(['LPUSH', k(t, 'str'), 'x']), /WRONGTYPE/);
  await assert.rejects(h.c.sendCommand(['INCR', k(t, 'str')]), /not an integer/);
});

test('negative: an empty collection does not exist: the key disappears with its last element', async (t) => {
  const h = await connect(t);
  if (!h) return;
  const key = k(t, 'set');
  await h.c.sendCommand(['SADD', key, 'only']);
  await h.c.sendCommand(['SREM', key, 'only']);
  assert.equal(await h.c.sendCommand(['EXISTS', key]), 0);
});

test('hash field expiration: HEXPIRE (7.4+) removes one field, not the key', async (t) => {
  const h = await connect(t);
  if (!h || !needVersion(t, h.server, '7.4.0', { valkey: '9.0.0' })) return;
  const key = k(t, 'hfe');
  await h.c.sendCommand(['DEL', key]);
  await h.c.sendCommand(['HSET', key, 'session', 's1', 'profile', 'p1']);
  assert.deepEqual(await h.c.sendCommand(['HPEXPIRE', key, '50', 'FIELDS', '1', 'session']), [1]);
  await new Promise((r) => setTimeout(r, 120));
  assert.deepEqual(await h.c.sendCommand(['HGETALL', key]), ['profile', 'p1']);
});

test('HGETEX (8.0+) reads a field and sets its TTL atomically', async (t) => {
  const h = await connect(t);
  if (!h || !needVersion(t, h.server, '8.0.0', { valkey: '9.0.0' })) return;
  const key = k(t, 'hgetex');
  await h.c.sendCommand(['DEL', key]);
  await h.c.sendCommand(['HSET', key, 'f', 'v']);
  assert.deepEqual(await h.c.sendCommand(['HGETEX', key, 'EX', '100', 'FIELDS', '1', 'f']), ['v']);
  const ttl = (await h.c.sendCommand(['HTTL', key, 'FIELDS', '1', 'f'])) as number[];
  assert.ok(ttl[0]! > 0 && ttl[0]! <= 100);
});
