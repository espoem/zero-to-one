// Module 04 (integration): cache-aside and SET NX locks on a real server; server-assisted
// client-side caching (CLIENT TRACKING) in RESP2 redirect mode and RESP3 push mode.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { Socket } from 'node:net';
import { connect, getServer, k, shutdown, type Client } from './harness.ts';
import { CacheAside, getWithLock, type KV } from '../src/cache.ts';
import { RespParser, encodeCommand, toJS, type RespValue } from '../src/resp.ts';

after(shutdown);

function redisKV(c: Client): KV {
  return {
    get: async (key) => (await c.sendCommand(['GET', key])) as string | null,
    set: async (key, value, ttlMs, opts = {}) =>
      String(
        await c.sendCommand(['SET', key, value, 'PX', String(ttlMs), ...(opts.nx ? ['NX'] : [])]),
      ) === 'OK',
    del: async (key) => void (await c.sendCommand(['DEL', key])),
    pttl: async (key) => (await c.sendCommand(['PTTL', key])) as number,
  };
}

test('cache-aside against Redis: one load, then hits; TTL is set', async (t) => {
  const h = await connect(t);
  if (!h) return;
  const kv = redisKV(h.c);
  const key = k(t, 'user');
  await kv.del(key);
  const cache = new CacheAside<string>(kv, async () => 'row', { ttlMs: 60_000, now: Date.now });
  await Promise.all(Array.from({ length: 20 }, () => cache.get(key)));
  assert.equal(cache.loads, 1);
  assert.ok((await kv.pttl(key)) > 0);
});

test('SET NX PX lock: ten concurrent connections, one database load', async (t) => {
  const h = await connect(t);
  if (!h) return;
  const key = k(t, 'product');
  await h.c.sendCommand(['DEL', key, `lock:${key}`]);
  const clients = await Promise.all(
    Array.from({ length: 10 }, async () => {
      const d = h.c.duplicate();
      d.on('error', () => {});
      await d.connect();
      return d;
    }),
  );
  h.defer(() => Promise.all(clients.map((d) => d.close())));
  let loads = 0;
  const load = async () => {
    loads++;
    await sleep(50);
    return { id: 1 };
  };
  await Promise.all(
    clients.map((d, i) =>
      getWithLock(redisKV(d), key, load, {
        ttlMs: 60_000,
        lockTtlMs: 5_000,
        sleep,
        token: `w${i}`,
      }),
    ),
  );
  assert.equal(loads, 1);
});

test('CLIENT TRACKING (RESP2, REDIRECT): a write by another client invalidates the cached key', async (t) => {
  const h = await connect(t);
  if (!h) return;
  const sub = h.c.duplicate();
  sub.on('error', () => {});
  await sub.connect();
  h.defer(() => sub.close());
  // The tracking connection redirects invalidations to the subscriber's client id.
  const subId = String(await sub.sendCommand(['CLIENT', 'ID']));
  const invalidated: string[] = [];
  await sub.subscribe('__redis__:invalidate', (msg) => invalidated.push(String(msg)));
  const reader = h.c.duplicate();
  reader.on('error', () => {});
  await reader.connect();
  h.defer(() => reader.close());
  await reader.sendCommand(['CLIENT', 'TRACKING', 'ON', 'REDIRECT', subId]);
  const key = k(t, 'tracked');
  await h.c.sendCommand(['SET', key, 'v1']);
  await reader.sendCommand(['GET', key]); // server remembers: reader may cache `key`
  await h.c.sendCommand(['SET', key, 'v2']); // another client writes
  for (let i = 0; i < 50 && invalidated.length === 0; i++) await sleep(20);
  assert.ok(
    invalidated.some((m) => m.includes(key)),
    `got ${JSON.stringify(invalidated)}`,
  );
});

test('CLIENT TRACKING (RESP3): invalidations arrive as push frames on the same connection', async (t) => {
  const s = await getServer();
  if (typeof s === 'string') return t.skip(s);
  const h = await connect(t);
  if (!h) return;
  const { hostname, port } = new URL(s.url);
  const sock = new Socket();
  await new Promise<void>((res, rej) =>
    sock.connect(Number(port), hostname, res).once('error', rej),
  );
  h.defer(() => sock.destroy());
  const parser = new RespParser();
  const got: RespValue[] = [];
  sock.on('data', (d) => got.push(...parser.push(d)));
  const key = k(t, 'pushkey');
  await h.c.sendCommand(['SET', key, 'v1']);
  sock.write(
    Buffer.concat([
      encodeCommand(['HELLO', '3']),
      encodeCommand(['CLIENT', 'TRACKING', 'ON']),
      encodeCommand(['GET', key]),
    ]),
  );
  for (let i = 0; i < 50 && got.length < 3; i++) await sleep(10);
  await h.c.sendCommand(['SET', key, 'v2']);
  for (let i = 0; i < 50 && !got.some((v) => v.type === 'push'); i++) await sleep(20);
  const push = got.find((v) => v.type === 'push');
  assert.ok(push, 'expected a push frame');
  const js = toJS(push!) as unknown[];
  assert.equal(js[0], 'invalidate');
  assert.deepEqual(js[1], [key]);
});
