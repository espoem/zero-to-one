// Module 01 (integration): speak RESP to a real server with our own parser, no client library.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Socket } from 'node:net';
import { RespParser, encodeCommand, toJS, type RespValue } from '../src/resp.ts';
import { getServer, shutdown } from './harness.ts';

after(shutdown);

/** Minimal raw connection: write bytes, collect `n` replies. */
async function raw(url: string) {
  const { hostname, port } = new URL(url);
  const sock = new Socket();
  await new Promise<void>((res, rej) =>
    sock.connect(Number(port), hostname, res).once('error', rej),
  );
  const parser = new RespParser();
  const queue: RespValue[] = [];
  let wake: (() => void) | undefined;
  sock.on('data', (d) => {
    queue.push(...parser.push(d));
    wake?.();
  });
  return {
    async send(bytes: Buffer | string, n: number): Promise<RespValue[]> {
      sock.write(bytes);
      while (queue.length < n) await new Promise<void>((r) => (wake = r));
      return queue.splice(0, n);
    },
    close: () => sock.destroy(),
  };
}

test('pipelined commands written in one write() come back in order', async (t) => {
  const s = await getServer();
  if (typeof s === 'string') return t.skip(s);
  const conn = await raw(s.url);
  t.after(conn.close);
  const key = 'zto:01:pipe';
  const batch = Buffer.concat([
    encodeCommand(['DEL', key]),
    encodeCommand(['INCR', key]),
    encodeCommand(['INCR', key]),
    encodeCommand(['GET', key]),
    encodeCommand(['GET', 'zto:01:missing']),
  ]);
  const replies = await conn.send(batch, 5);
  assert.deepEqual(replies.slice(1).map(toJS), [1n, 2n, '2', null]);
});

test('inline protocol: the server accepts telnet-style commands', async (t) => {
  const s = await getServer();
  if (typeof s === 'string') return t.skip(s);
  const conn = await raw(s.url);
  t.after(conn.close);
  const [r] = await conn.send('PING\r\n', 1);
  assert.deepEqual(r, { type: 'simple', value: 'PONG' });
});

test('HELLO 3 switches the connection to RESP3: HGETALL becomes a map, not a flat array', async (t) => {
  const s = await getServer();
  if (typeof s === 'string') return t.skip(s);
  const conn = await raw(s.url);
  t.after(conn.close);
  const key = 'zto:01:h';
  await conn.send(
    Buffer.concat([encodeCommand(['DEL', key]), encodeCommand(['HSET', key, 'f', 'v'])]),
    2,
  );
  const [v2] = await conn.send(encodeCommand(['HGETALL', key]), 1);
  assert.equal(v2!.type, 'array');
  const [hello] = await conn.send(encodeCommand(['HELLO', '3']), 1);
  assert.equal(hello!.type, 'map');
  const [v3] = await conn.send(encodeCommand(['HGETALL', key]), 1);
  assert.equal(v3!.type, 'map');
  // RESP3 null for a missing key, instead of RESP2's $-1.
  const [nil] = await conn.send(encodeCommand(['GET', 'zto:01:missing']), 1);
  assert.equal(nil!.type, 'null');
});

test('negative: a wrong-arity command is an error reply, and the connection keeps working', async (t) => {
  const s = await getServer();
  if (typeof s === 'string') return t.skip(s);
  const conn = await raw(s.url);
  t.after(conn.close);
  const [err, pong] = await conn.send(
    Buffer.concat([encodeCommand(['GET']), encodeCommand(['PING'])]),
    2,
  );
  assert.equal(err!.type, 'error');
  assert.match((err as { value: string }).value, /wrong number of arguments/i);
  assert.deepEqual(toJS(pong!), 'PONG');
});
