// Module 03 (integration): lazy vs active expiry, eviction under maxmemory, SCAN, UNLINK, LFU.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { connect, needDedicated, needVersion, k, shutdown, type Client } from './harness.ts';

after(shutdown);

async function cfg(c: Client, name: string): Promise<string> {
  const r = (await c.sendCommand(['CONFIG', 'GET', name])) as string[];
  return r[1]!;
}

test('with active expiry off, an expired key still occupies the keyspace until it is accessed', async (t) => {
  const h = await connect(t);
  if (!h || !needDedicated(t, h.server)) return;
  const { c } = h;
  await c.sendCommand(['FLUSHALL']);
  await c.sendCommand(['DEBUG', 'SET-ACTIVE-EXPIRE', '0']);
  h.defer(() => c.sendCommand(['DEBUG', 'SET-ACTIVE-EXPIRE', '1']).catch(() => {}));
  await c.sendCommand(['SET', 'gone', 'x', 'PX', '20']);
  await sleep(100);
  assert.equal(await c.sendCommand(['DBSIZE']), 1); // logically expired, physically present
  assert.equal(await c.sendCommand(['GET', 'gone']), null); // lazy expiry on access
  assert.equal(await c.sendCommand(['DBSIZE']), 0);
});

test('with active expiry on, untouched expired keys are reclaimed by the background cycle', async (t) => {
  const h = await connect(t);
  if (!h || !needDedicated(t, h.server)) return;
  const { c } = h;
  await c.sendCommand(['FLUSHALL']);
  const args: string[] = [];
  for (let i = 0; i < 200; i++) args.push(`exp:${i}`, 'v');
  await c.sendCommand(['MSET', ...args]);
  for (let i = 0; i < 200; i++) await c.sendCommand(['PEXPIRE', `exp:${i}`, '10']);
  await sleep(1_500); // serverCron runs active expiry hz (10) times per second
  assert.equal(await c.sendCommand(['DBSIZE']), 0);
  const info = String(await c.sendCommand(['INFO', 'stats']));
  assert.ok(Number(/expired_keys:(\d+)/.exec(info)?.[1]) >= 200);
});

test('TTL semantics: -1 no TTL, -2 missing key, SET without KEEPTTL clears the TTL', async (t) => {
  const h = await connect(t);
  if (!h) return;
  const { c } = h;
  const key = k(t, 'ttl');
  await c.sendCommand(['SET', key, 'v', 'EX', '100']);
  assert.ok(((await c.sendCommand(['TTL', key])) as number) > 0);
  await c.sendCommand(['SET', key, 'v2']);
  assert.equal(await c.sendCommand(['TTL', key]), -1);
  await c.sendCommand(['SET', key, 'v3', 'EX', '100']);
  await c.sendCommand(['SET', key, 'v4', 'KEEPTTL']);
  assert.ok(((await c.sendCommand(['TTL', key])) as number) > 0);
  assert.equal(await c.sendCommand(['TTL', k(t, 'missing')]), -2);
  // INCR keeps the TTL (it modifies the value in place), unlike SET.
  await c.sendCommand(['SET', key, '1', 'EX', '100']);
  await c.sendCommand(['INCR', key]);
  assert.ok(((await c.sendCommand(['TTL', key])) as number) > 0);
});

test('negative: noeviction over maxmemory rejects writes with OOM but serves reads', async (t) => {
  const h = await connect(t);
  if (!h || !needDedicated(t, h.server)) return;
  const { c } = h;
  const [oldMax, oldPol] = [await cfg(c, 'maxmemory'), await cfg(c, 'maxmemory-policy')];
  h.defer(async () => {
    await c.sendCommand(['CONFIG', 'SET', 'maxmemory', oldMax]);
    await c.sendCommand(['CONFIG', 'SET', 'maxmemory-policy', oldPol]);
  });
  await c.sendCommand(['FLUSHALL']);
  await c.sendCommand(['SET', 'readable', 'yes']);
  await c.sendCommand(['CONFIG', 'SET', 'maxmemory-policy', 'noeviction']);
  await c.sendCommand(['CONFIG', 'SET', 'maxmemory', '1']); // below current usage
  await assert.rejects(c.sendCommand(['SET', 'k', 'v']), /OOM/);
  assert.equal(await c.sendCommand(['GET', 'readable']), 'yes');
  // DEL is allowed under OOM: it frees memory.
  assert.equal(await c.sendCommand(['DEL', 'readable']), 1);
});

test('negative: volatile-lru with no TTL keys cannot evict, so writes still fail with OOM', async (t) => {
  const h = await connect(t);
  if (!h || !needDedicated(t, h.server)) return;
  const { c } = h;
  const [oldMax, oldPol] = [await cfg(c, 'maxmemory'), await cfg(c, 'maxmemory-policy')];
  h.defer(async () => {
    await c.sendCommand(['CONFIG', 'SET', 'maxmemory', oldMax]);
    await c.sendCommand(['CONFIG', 'SET', 'maxmemory-policy', oldPol]);
  });
  await c.sendCommand(['FLUSHALL']);
  const big = 'x'.repeat(1000);
  for (let i = 0; i < 300; i++) await c.sendCommand(['SET', `persistent:${i}`, big]);
  await c.sendCommand(['CONFIG', 'SET', 'maxmemory-policy', 'volatile-lru']);
  await c.sendCommand(['CONFIG', 'SET', 'maxmemory', '1']);
  await assert.rejects(c.sendCommand(['SET', 'another', big]), /OOM/);
  assert.equal(await c.sendCommand(['DBSIZE']), 300);
});

test('allkeys-lru under a small maxmemory evicts keys instead of failing', async (t) => {
  const h = await connect(t);
  if (!h || !needDedicated(t, h.server)) return;
  const { c } = h;
  const [oldMax, oldPol] = [await cfg(c, 'maxmemory'), await cfg(c, 'maxmemory-policy')];
  h.defer(async () => {
    await c.sendCommand(['CONFIG', 'SET', 'maxmemory', oldMax]);
    await c.sendCommand(['CONFIG', 'SET', 'maxmemory-policy', oldPol]);
  });
  await c.sendCommand(['FLUSHALL']);
  await c.sendCommand(['CONFIG', 'RESETSTAT']);
  const used = Number(
    /used_memory:(\d+)/.exec(String(await c.sendCommand(['INFO', 'memory'])))?.[1],
  );
  await c.sendCommand(['CONFIG', 'SET', 'maxmemory-policy', 'allkeys-lru']);
  await c.sendCommand(['CONFIG', 'SET', 'maxmemory', String(used + 2 * 1024 * 1024)]);
  const val = 'x'.repeat(10_000);
  for (let i = 0; i < 1_000; i++) await c.sendCommand(['SET', `cache:${i}`, val]); // ~10 MB into ~2 MB headroom
  const stats = String(await c.sendCommand(['INFO', 'stats']));
  assert.ok(Number(/evicted_keys:(\d+)/.exec(stats)?.[1]) > 0);
  assert.ok(((await c.sendCommand(['DBSIZE'])) as number) < 1_000);
});

test('SCAN returns every key that exists for the whole iteration, even while keys are added', async (t) => {
  const h = await connect(t);
  if (!h) return;
  const { c } = h;
  const prefix = k(t, 'scan');
  const args: string[] = [];
  for (let i = 0; i < 1_000; i++) args.push(`${prefix}:${i}`, 'v');
  await c.sendCommand(['MSET', ...args]);
  const seen = new Set<string>();
  let cursor = '0';
  let round = 0;
  do {
    const [next, keys] = (await c.sendCommand([
      'SCAN',
      cursor,
      'MATCH',
      `${prefix}:*`,
      'COUNT',
      '50',
    ])) as [string, string[]];
    keys.forEach((x) => seen.add(x));
    cursor = next;
    // Grow the keyspace mid-scan to force a rehash of the main dictionary.
    if (round++ === 3) {
      const more: string[] = [];
      for (let i = 0; i < 5_000; i++) more.push(`${prefix}:extra:${i}`, 'v');
      await c.sendCommand(['MSET', ...more]);
    }
  } while (cursor !== '0');
  for (let i = 0; i < 1_000; i++) assert.ok(seen.has(`${prefix}:${i}`));
});

test('UNLINK returns immediately for a big set; the memory is freed in the background', async (t) => {
  const h = await connect(t);
  if (!h) return;
  const { c } = h;
  const key = k(t, 'big');
  for (let b = 0; b < 20; b++) {
    const batch = Array.from({ length: 10_000 }, (_, i) => `m${b * 10_000 + i}`);
    await c.sendCommand(['SADD', key, ...batch]);
  }
  assert.equal(await c.sendCommand(['SCARD', key]), 200_000);
  assert.equal(await c.sendCommand(['UNLINK', key]), 1);
  assert.equal(await c.sendCommand(['EXISTS', key]), 0); // gone from the keyspace at once
});

test('LFU policy exposes the logarithmic counter through OBJECT FREQ', async (t) => {
  const h = await connect(t);
  if (!h || !needDedicated(t, h.server)) return;
  const { c } = h;
  const old = await cfg(c, 'maxmemory-policy');
  h.defer(() => c.sendCommand(['CONFIG', 'SET', 'maxmemory-policy', old]));
  await c.sendCommand(['CONFIG', 'SET', 'maxmemory-policy', 'allkeys-lfu']);
  const key = k(t, 'hot');
  await c.sendCommand(['SET', key, 'v']);
  for (let i = 0; i < 1_000; i++) await c.sendCommand(['GET', key]);
  const freq = (await c.sendCommand(['OBJECT', 'FREQ', key])) as number;
  // ~18 per the redis.conf table for 1 000 hits at lfu-log-factor 10; allow wide slack.
  assert.ok(freq > 8 && freq < 30, `freq=${freq}`);
  await c.sendCommand(['CONFIG', 'SET', 'maxmemory-policy', 'allkeys-lru']);
  await assert.rejects(c.sendCommand(['OBJECT', 'FREQ', key]), /LFU/);
});

test('LRM eviction policies exist on Redis 8.6+', async (t) => {
  const h = await connect(t);
  if (!h || !needDedicated(t, h.server) || !needVersion(t, h.server, '8.6.0')) return;
  const { c } = h;
  const old = await cfg(h.c, 'maxmemory-policy');
  h.defer(() => c.sendCommand(['CONFIG', 'SET', 'maxmemory-policy', old]));
  for (const p of ['allkeys-lrm', 'volatile-lrm']) {
    await c.sendCommand(['CONFIG', 'SET', 'maxmemory-policy', p]);
    assert.equal(await cfg(c, 'maxmemory-policy'), p);
  }
});
