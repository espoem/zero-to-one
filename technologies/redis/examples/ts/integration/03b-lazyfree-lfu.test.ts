// Module 03 (integration): LFU counter determinism, the lazy-free threshold, active-expire-effort
// bounds, INFO keysizes (8.0+) and a per-key memory measurement.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { connect, needDedicated, needVersion, k, shutdown } from './harness.ts';
import { parseKeysizes } from '../src/keyspace.ts';

after(shutdown);

function field(info: unknown, name: string): number {
  const m = new RegExp(`^${name}:(\\d+)`, 'm').exec(String(info));
  assert.ok(m, `${name} missing from INFO`);
  return Number(m[1]);
}

test('LFU with lfu-log-factor 0 is deterministic: 5 at creation, plus one per read', async (t) => {
  const h = await connect(t);
  if (!h || !needDedicated(t, h.server)) return;
  const get = async (name: string) =>
    ((await h.c.sendCommand(['CONFIG', 'GET', name])) as string[])[1]!;
  const policy = await get('maxmemory-policy');
  const factor = await get('lfu-log-factor');
  h.defer(async () => {
    await h.c.sendCommand(['CONFIG', 'SET', 'maxmemory-policy', policy]);
    await h.c.sendCommand(['CONFIG', 'SET', 'lfu-log-factor', factor]);
  });
  await h.c.sendCommand(['CONFIG', 'SET', 'maxmemory-policy', 'allkeys-lfu']);
  await h.c.sendCommand(['CONFIG', 'SET', 'lfu-log-factor', '0']);
  const key = k(t, 'f');
  await h.c.sendCommand(['SET', key, 'v']);
  assert.equal(await h.c.sendCommand(['OBJECT', 'FREQ', key]), 5); // LFU_INIT_VAL
  for (let i = 0; i < 20; i++) await h.c.sendCommand(['GET', key]);
  assert.equal(await h.c.sendCommand(['OBJECT', 'FREQ', key]), 25);
  // OBJECT is a no-touch command: reading the counter does not change it.
  assert.equal(await h.c.sendCommand(['OBJECT', 'FREQ', key]), 25);
});

test('negative: OBJECT FREQ is an error unless an LFU policy is active', async (t) => {
  const h = await connect(t);
  if (!h || !needDedicated(t, h.server)) return;
  const policy = ((await h.c.sendCommand(['CONFIG', 'GET', 'maxmemory-policy'])) as string[])[1]!;
  h.defer(() => h.c.sendCommand(['CONFIG', 'SET', 'maxmemory-policy', policy]));
  await h.c.sendCommand(['CONFIG', 'SET', 'maxmemory-policy', 'allkeys-lru']);
  const key = k(t, 'f');
  await h.c.sendCommand(['SET', key, 'v']);
  await assert.rejects(
    h.c.sendCommand(['OBJECT', 'FREQ', key]),
    /LFU maxmemory policy is not selected/,
  );
});

test('UNLINK frees in the background only above 64 allocations (lazyfreed_objects)', async (t) => {
  const h = await connect(t);
  if (!h) return;
  const mk = async (key: string, n: number) => {
    await h.c.sendCommand(['DEL', key]);
    // 65-byte members force the hashtable encoding in every version (listpack limit is 64 bytes).
    const pad = 'x'.repeat(65);
    for (let i = 0; i < n; i++) await h.c.sendCommand(['SADD', key, pad + i]);
    assert.equal(await h.c.sendCommand(['OBJECT', 'ENCODING', key]), 'hashtable');
  };
  const freed = async () => {
    for (let i = 0; i < 50; i++) {
      const info = await h.c.sendCommand(['INFO', 'memory']);
      if (field(info, 'lazyfree_pending_objects') === 0) return field(info, 'lazyfreed_objects');
      await sleep(20);
    }
    throw new Error('lazy free queue did not drain');
  };
  const a = k(t, 'a');
  const b = k(t, 'b');
  await mk(a, 64);
  await mk(b, 65);
  const before = await freed();
  await h.c.sendCommand(['UNLINK', a]);
  assert.equal(await freed(), before, '64 allocations are freed inline');
  await h.c.sendCommand(['UNLINK', b]);
  assert.equal(await freed(), before + 1, '65 allocations go to the background thread');
});

test('active-expire-effort accepts 1..10 and rejects 0 and 11', async (t) => {
  const h = await connect(t);
  if (!h || !needDedicated(t, h.server)) return;
  const old = ((await h.c.sendCommand(['CONFIG', 'GET', 'active-expire-effort'])) as string[])[1]!;
  h.defer(() => h.c.sendCommand(['CONFIG', 'SET', 'active-expire-effort', old]));
  await h.c.sendCommand(['CONFIG', 'SET', 'active-expire-effort', '10']);
  await assert.rejects(
    h.c.sendCommand(['CONFIG', 'SET', 'active-expire-effort', '11']),
    /argument must be between 1 and 10|must be between/,
  );
  await assert.rejects(
    h.c.sendCommand(['CONFIG', 'SET', 'active-expire-effort', '0']),
    /must be between/,
  );
});

test('maxmemory-eviction-tenacity accepts 0..100 and rejects 101', async (t) => {
  const h = await connect(t);
  if (!h || !needDedicated(t, h.server)) return;
  const old = (
    (await h.c.sendCommand(['CONFIG', 'GET', 'maxmemory-eviction-tenacity'])) as string[]
  )[1]!;
  h.defer(() => h.c.sendCommand(['CONFIG', 'SET', 'maxmemory-eviction-tenacity', old]));
  assert.equal(old, '10'); // the documented default
  await h.c.sendCommand(['CONFIG', 'SET', 'maxmemory-eviction-tenacity', '100']);
  await assert.rejects(
    h.c.sendCommand(['CONFIG', 'SET', 'maxmemory-eviction-tenacity', '101']),
    /must be between/,
  );
});

test('INFO keysizes (8.0+) reports power-of-two histograms of value sizes and item counts', async (t) => {
  const h = await connect(t);
  if (!h || !needVersion(t, h.server, '8.0.0')) return;
  const key = k(t, 'ks');
  await h.c.sendCommand(['DEL', key]);
  await h.c.sendCommand(['RPUSH', key, ...Array.from({ length: 100 }, (_, i) => String(i))]);
  const lines = parseKeysizes(String(await h.c.sendCommand(['INFO', 'keysizes'])));
  const lists = lines.filter((l) => l.kind === 'lists_items');
  assert.ok(lists.length > 0);
  // 100 items falls in the 64..127 bin, labelled by its lower bound
  assert.ok(lists.some((l) => (l.bins['64'] ?? 0) >= 1));
});

test('a tiny string key (10-byte name, 1-byte value) costs about 40 to 160 bytes in total (measured, allocator dependent)', async (t) => {
  const h = await connect(t);
  if (!h || !needDedicated(t, h.server)) return;
  const n = 20_000;
  const prefix = 'zto:m:'; // short on purpose: the key name is part of the per-key cost
  const used = async () => field(await h.c.sendCommand(['INFO', 'memory']), 'used_memory');
  const script = `for i=1,tonumber(ARGV[2]) do redis.call('SET', ARGV[1]..i, 'v') end return 1`;
  const before = await used();
  await h.c.sendCommand(['EVAL', script, '0', prefix, String(n)]);
  const perKey = ((await used()) - before) / n;
  h.defer(() =>
    h.c.sendCommand([
      'EVAL',
      `for i=1,tonumber(ARGV[2]) do redis.call('UNLINK', ARGV[1]..i) end return 1`,
      '0',
      prefix,
      String(n),
    ]),
  );
  t.diagnostic(`bytes per tiny key on ${h.server.version}: ${perKey.toFixed(1)}`);
  assert.ok(perKey >= 40 && perKey <= 160, `per-key ${perKey}`);
});

test('CLIENT PAUSE WRITE pauses expiry: an expired key is hidden but not deleted until the pause ends', async (t) => {
  const h = await connect(t);
  if (!h || !needDedicated(t, h.server)) return;
  const key = k(t, 'p');
  await h.c.sendCommand(['FLUSHALL']);
  await h.c.sendCommand(['SET', key, 'v', 'PX', '50']);
  await h.c.sendCommand(['CLIENT', 'PAUSE', '600', 'WRITE']);
  h.defer(() => h.c.sendCommand(['CLIENT', 'UNPAUSE']));
  await sleep(250); // past the expiry; several serverCron ticks have run
  assert.equal(await h.c.sendCommand(['GET', key]), null); // logically gone
  assert.equal(await h.c.sendCommand(['DBSIZE']), 1); // physically present
  await sleep(700); // the pause ends and the active cycle resumes
  assert.equal(await h.c.sendCommand(['DBSIZE']), 0);
});
