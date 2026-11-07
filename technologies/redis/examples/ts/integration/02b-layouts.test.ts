// Module 02 (integration): the byte-level listpack and intset models must equal the blobs a real
// server puts into DUMP, and BITFIELD overflow behaves as the model says.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { connect, k, rawConn, shutdown } from './harness.ts';
import {
  bitfieldIncrBy,
  decodeListpack,
  encodeIntset,
  encodeListpack,
  parseDump,
  type Overflow,
} from '../src/listpack.ts';

after(shutdown);

async function dump(url: string, key: string) {
  const r = await rawConn(url);
  try {
    const reply = await r.cmd('DUMP', key);
    assert.equal(reply.type, 'bulk');
    return parseDump((reply as { value: Buffer }).value);
  } finally {
    r.close();
  }
}

test('hash listpack: DUMP carries exactly the bytes encodeListpack produces', async (t) => {
  const h = await connect(t);
  if (!h) return;
  const key = k(t, 'h');
  await h.c.sendCommand(['DEL', key]);
  const pairs: Array<[string, string]> = [
    ['name', 'Ada'],
    ['plan', 'pro'],
    ['age', '42'],
    ['big', '100000'],
    ['neg', '-5'],
    ['huge', '9007199254740993'],
    ['pad', '007'],
  ];
  await h.c.sendCommand(['HSET', key, ...pairs.flat()]);
  assert.equal(await h.c.sendCommand(['OBJECT', 'ENCODING', key]), 'listpack');
  const d = await dump(h.server.url, key);
  assert.equal(d.type, 16); // RDB_TYPE_HASH_LISTPACK
  assert.equal(d.blob.toString('hex'), encodeListpack(pairs.flat()).toString('hex'));
});

test('zset listpack: members and scores alternate; integral scores are stored as integers', async (t) => {
  const h = await connect(t);
  if (!h) return;
  const key = k(t, 'z');
  await h.c.sendCommand(['DEL', key]);
  await h.c.sendCommand(['ZADD', key, '2.5', 'b', '1', 'a']);
  const d = await dump(h.server.url, key);
  assert.equal(d.type, 17); // RDB_TYPE_ZSET_LISTPACK
  assert.deepEqual(decodeListpack(d.blob), ['a', 1n, 'b', '2.5']);
  assert.equal(d.blob.toString('hex'), encodeListpack(['a', '1', 'b', '2.5']).toString('hex'));
});

test('intset: width upgrades 2 -> 4 -> 8 bytes while OBJECT ENCODING stays intset', async (t) => {
  const h = await connect(t);
  if (!h) return;
  const key = k(t, 's');
  await h.c.sendCommand(['DEL', key]);
  const members: bigint[] = [3n, 1n, 2n];
  await h.c.sendCommand(['SADD', key, ...members.map(String)]);
  for (const [add, width] of [
    [undefined, 2],
    [40000n, 4],
    [2n ** 40n, 8],
  ] as const) {
    if (add !== undefined) {
      members.push(add);
      await h.c.sendCommand(['SADD', key, String(add)]);
    }
    assert.equal(await h.c.sendCommand(['OBJECT', 'ENCODING', key]), 'intset');
    const d = await dump(h.server.url, key);
    assert.equal(d.type, 11); // RDB_TYPE_SET_INTSET
    assert.equal(d.blob.readUInt32LE(0), width);
    assert.equal(d.blob.toString('hex'), encodeIntset(members).toString('hex'));
  }
});

test('BITFIELD OVERFLOW matches the model for WRAP, SAT and FAIL', async (t) => {
  const h = await connect(t);
  if (!h) return;
  const key = k(t, 'bf');
  const cases: Array<[number, boolean, bigint, bigint]> = [
    [8, false, 250n, 10n],
    [8, true, 127n, 1n],
    [8, true, -128n, -1n],
    [4, false, 5n, -6n],
    [63, false, 5n, 1n],
  ];
  for (const [bits, signed, start, incr] of cases) {
    const type = `${signed ? 'i' : 'u'}${bits}`;
    for (const ov of ['WRAP', 'SAT', 'FAIL'] as Overflow[]) {
      await h.c.sendCommand(['DEL', key]);
      await h.c.sendCommand(['BITFIELD', key, 'SET', type, '0', String(start)]);
      const got: unknown = await h.c.sendCommand([
        'BITFIELD',
        key,
        'OVERFLOW',
        ov,
        'INCRBY',
        type,
        '0',
        String(incr),
      ]);
      const want = bitfieldIncrBy(start, incr, bits, signed, ov);
      assert.deepEqual(
        got,
        [want === null ? null : Number(want)],
        `${type} ${start}+${incr} ${ov}`,
      );
    }
  }
});

test('negative: BITFIELD rejects unsigned 64-bit fields and a bad overflow mode', async (t) => {
  const h = await connect(t);
  if (!h) return;
  await assert.rejects(
    h.c.sendCommand(['BITFIELD', k(t, 'x'), 'GET', 'u64', '0']),
    /Invalid bitfield type/,
  );
  await assert.rejects(
    h.c.sendCommand(['BITFIELD', k(t, 'x'), 'OVERFLOW', 'CLAMP']),
    /Invalid OVERFLOW type/,
  );
});
