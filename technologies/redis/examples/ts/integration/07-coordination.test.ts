// Module 07 (integration): rate limiting, locks and idempotency keys on a real server.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { connect, needVersion, k, shutdown } from './harness.ts';
import { loadScript } from '../src/lua.ts';

after(shutdown);

test('fixed window with INCR + EXPIRE NX in one transaction', async (t) => {
  const h = await connect(t);
  if (!h || !needVersion(t, h.server, '7.0.0', { valkey: '7.2.0' })) return;
  const key = k(t, 'rl');
  await h.c.sendCommand(['DEL', key]);
  const results: number[] = [];
  for (let i = 0; i < 5; i++) {
    const r = (await h.c.multi().incr(key).expire(key, 60, 'NX').exec()) as unknown[];
    results.push(Number(r[0]));
  }
  assert.deepEqual(results, [1, 2, 3, 4, 5]);
  const ttl = (await h.c.sendCommand(['TTL', key])) as number;
  assert.ok(ttl > 0 && ttl <= 60); // set once, not extended by later hits
});

test('sliding-window counter script on a real server', async (t) => {
  const h = await connect(t);
  if (!h) return;
  const src = loadScript('sliding_window.lua');
  const window = 60_000;
  const base = k(t, '{u}');
  const hit = async (now: number) => {
    const w = Math.floor(now / window);
    return (
      (await h.c.sendCommand([
        'EVAL',
        src,
        '2',
        `${base}:${w}`,
        `${base}:${w - 1}`,
        '10',
        String(window),
        String(now),
      ])) as number[]
    )[0]!;
  };
  // Use a fixed synthetic clock far in the future so keys are unique per run.
  const t0 = Math.floor(Date.now() / window) * window + 100 * window;
  let admitted = 0;
  for (let i = 0; i < 10; i++) admitted += await hit(t0 + window - 100);
  for (let i = 0; i < 10; i++) admitted += await hit(t0 + window + 100);
  assert.equal(admitted, 10);
});

test('lock: SET NX PX gives one owner; release only with the right token', async (t) => {
  const h = await connect(t);
  if (!h) return;
  const lock = k(t, 'lock');
  await h.c.sendCommand(['DEL', lock]);
  assert.equal(await h.c.sendCommand(['SET', lock, 'token-A', 'NX', 'PX', '10000']), 'OK');
  assert.equal(await h.c.sendCommand(['SET', lock, 'token-B', 'NX', 'PX', '10000']), null);
  const cad = loadScript('compare_and_delete.lua');
  assert.equal(await h.c.sendCommand(['EVAL', cad, '1', lock, 'token-B']), 0);
  assert.equal(await h.c.sendCommand(['EVAL', cad, '1', lock, 'token-A']), 1);
});

test('lock with fencing token: INCR a counter on acquisition', async (t) => {
  const h = await connect(t);
  if (!h) return;
  const [lock, fence] = [k(t, '{res}:lock'), k(t, '{res}:fence')];
  await h.c.sendCommand(['DEL', lock, fence]);
  const acquire = `if redis.call('SET', KEYS[1], ARGV[1], 'NX', 'PX', ARGV[2]) then
  return redis.call('INCR', KEYS[2]) end return 0`;
  const t1 = (await h.c.sendCommand(['EVAL', acquire, '2', lock, fence, 'c1', '50'])) as number;
  assert.equal(await h.c.sendCommand(['EVAL', acquire, '2', lock, fence, 'c2', '50']), 0);
  await new Promise((r) => setTimeout(r, 80)); // c1's lease expires (think: GC pause)
  const t2 = (await h.c.sendCommand(['EVAL', acquire, '2', lock, fence, 'c2', '50'])) as number;
  assert.ok(t2 > t1); // the storage layer can now reject writes carrying t1
});

test('DELEX IFEQ (8.4+) replaces the compare-and-delete script', async (t) => {
  const h = await connect(t);
  if (!h || !needVersion(t, h.server, '8.4.0')) return;
  const lock = k(t, 'lock');
  await h.c.sendCommand(['SET', lock, 'token-A']);
  assert.equal(await h.c.sendCommand(['DELEX', lock, 'IFEQ', 'token-B']), 0);
  assert.equal(await h.c.sendCommand(['DELEX', lock, 'IFEQ', 'token-A']), 1);
});

test('INCREX (8.8+) window limiter: UBOUND rejects with applied increment 0', async (t) => {
  const h = await connect(t);
  if (!h || !needVersion(t, h.server, '8.8.0')) return;
  const key = k(t, 'rl');
  await h.c.sendCommand(['DEL', key]);
  const applied: number[] = [];
  for (let i = 0; i < 4; i++) {
    const r = (await h.c.sendCommand([
      'INCREX',
      key,
      'BYINT',
      '1',
      'UBOUND',
      '3',
      'EX',
      '60',
      'ENX',
    ])) as number[];
    applied.push(r[1]!);
  }
  assert.deepEqual(applied, [1, 1, 1, 0]);
});

test('idempotency key: SET NX claims, a later GET replays the stored result', async (t) => {
  const h = await connect(t);
  if (!h) return;
  const key = k(t, 'idem:pay-1');
  await h.c.sendCommand(['DEL', key]);
  assert.equal(await h.c.sendCommand(['SET', key, 'processing', 'NX', 'EX', '86400']), 'OK');
  assert.equal(await h.c.sendCommand(['SET', key, 'processing', 'NX', 'EX', '86400']), null); // duplicate
  await h.c.sendCommand(['SET', key, 'done:{"charge":"ch_1"}', 'XX', 'KEEPTTL']);
  assert.equal(await h.c.sendCommand(['GET', key]), 'done:{"charge":"ch_1"}');
});
