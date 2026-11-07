// Module 04: cache-aside, stampede protection, negative caching, XFetch, the dual-write race.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { FakeKV, CacheAside, getWithLock, jitteredTtl, type Envelope } from './src/cache.ts';
import { mulberry32 } from './src/zset.ts';

test('stampede: 100 concurrent misses cause 100 loads without coalescing, 1 with it', async () => {
  for (const coalesce of [false, true]) {
    const kv = new FakeKV();
    const c = new CacheAside(
      kv,
      async () => {
        await sleep(5);
        return 'row';
      },
      { ttlMs: 60_000, now: () => kv.now },
    );
    const results = await Promise.all(Array.from({ length: 100 }, () => c.get('user:1', coalesce)));
    assert.ok(results.every((r) => r === 'row'));
    assert.equal(c.loads, coalesce ? 1 : 100);
  }
});

test('cross-process lock (SET NX PX): ten independent workers, one database load', async () => {
  const kv = new FakeKV(); // shared "Redis"
  let dbLoads = 0;
  const load = async () => {
    dbLoads++;
    await sleep(20);
    return { id: 1 };
  };
  const workers = Array.from({ length: 10 }, (_, i) =>
    getWithLock(kv, 'product:1', load, {
      ttlMs: 60_000,
      lockTtlMs: 5_000,
      sleep,
      token: `worker-${i}`,
    }),
  );
  const out = await Promise.all(workers);
  assert.equal(dbLoads, 1);
  assert.equal(out.filter((o) => o.loaded).length, 1);
  assert.equal(await kv.get('lock:product:1'), null); // released
});

test('negative: a lock holder that dies leaves waiters stuck until the lock TTL expires', async () => {
  const kv = new FakeKV();
  await kv.set('lock:k', 'dead-worker', 5_000, { nx: true }); // crashed holder
  let loads = 0;
  const r = await getWithLock(kv, 'k', async () => (loads++, 'v'), {
    ttlMs: 1_000,
    lockTtlMs: 5_000,
    sleep: async () => {},
    maxWaits: 3,
    token: 'me',
  });
  // Bounded waiting falls back to loading: availability over strict single-flight.
  assert.equal(r.loaded, true);
  assert.equal(loads, 1);
});

test('negative caching: a missing row is cached briefly, so repeated misses do not hit the DB', async () => {
  const kv = new FakeKV();
  let dbHits = 0;
  const c = new CacheAside<string>(kv, async () => (dbHits++, null), {
    ttlMs: 60_000,
    negativeTtlMs: 5_000,
    now: () => kv.now,
  });
  for (let i = 0; i < 50; i++) assert.equal(await c.get('user:404'), null);
  assert.equal(dbHits, 1);
  kv.now += 5_001; // negative entry expires
  await c.get('user:404');
  assert.equal(dbHits, 2);
});

test('without negative caching, every lookup of a non-existent key reaches the database (penetration)', async () => {
  const kv = new FakeKV();
  let dbHits = 0;
  const c = new CacheAside<string>(kv, async () => (dbHits++, null), {
    ttlMs: 60_000,
    now: () => kv.now,
  });
  for (let i = 0; i < 50; i++) await c.get(`user:${i}`);
  assert.equal(dbHits, 50);
});

test('XFetch: early recomputation is rare far from expiry and likely close to it', () => {
  const kv = new FakeKV();
  const c = new CacheAside<string>(kv, async () => 'v', {
    ttlMs: 60_000,
    beta: 1,
    now: () => kv.now,
    rng: mulberry32(5),
  });
  const env: Envelope<string> = { v: 'v', delta: 100, expiry: 60_000 };
  const rate = (now: number) => {
    kv.now = now;
    let n = 0;
    for (let i = 0; i < 10_000; i++) if (c.shouldRecomputeEarly(env)) n++;
    return n / 10_000;
  };
  assert.ok(rate(0) < 0.001);
  assert.ok(rate(59_900) > 0.3); // 100 ms before expiry with a 100 ms recompute cost
  assert.equal(rate(60_000), 1);
});

test('dual-write race: "delete cache, then update DB" lets a concurrent reader re-cache the old value', async () => {
  const kv = new FakeKV();
  let db = 'v1';
  // Interleaving, step by step:
  await kv.del('k'); //                          writer: invalidate
  const readerSaw = db; //                       reader: miss -> reads v1 from DB
  db = 'v2'; //                                  writer: updates DB
  await kv.set('k', readerSaw, 60_000); //       reader: populates cache with v1
  assert.equal(await kv.get('k'), 'v1'); //       stale until TTL...
  assert.equal(db, 'v2');
  kv.now += 60_001;
  assert.equal(await kv.get('k'), null); //       ...which is the only bound on staleness
});

test('dual-write race also exists for "update DB, then delete cache" (narrower window)', async () => {
  const kv = new FakeKV();
  let db = 'v1';
  const readerSaw = db; //                       reader: miss, reads v1 (slow query starts)
  db = 'v2'; //                                  writer: update DB
  await kv.del('k'); //                          writer: delete cache (nothing there yet)
  await kv.set('k', readerSaw, 60_000); //       reader: finally writes v1
  assert.equal(await kv.get('k'), 'v1');
  assert.equal(db, 'v2');
});

test('TTL jitter spreads expiry of keys written together', () => {
  const rng = mulberry32(9);
  const ttls = Array.from({ length: 1_000 }, () => jitteredTtl(3_600_000, 0.1, rng));
  assert.ok(ttls.every((t) => t >= 3_240_000 && t <= 3_960_000));
  assert.ok(new Set(ttls).size > 900);
});

test('negative: GET-then-SET "locking" across two round trips lets several workers win', async () => {
  const kv = new FakeKV();
  let winners = 0;
  const naive = async () => {
    if ((await kv.get('lock:x')) === null) {
      // Another worker can run its GET right here, before our SET lands.
      await kv.set('lock:x', 'me', 5_000);
      winners++;
    }
  };
  await Promise.all(Array.from({ length: 5 }, naive));
  assert.ok(winners > 1, `winners=${winners}`);
  // The atomic form has exactly one winner.
  const kv2 = new FakeKV();
  const atomic = await Promise.all(
    Array.from({ length: 5 }, (_, i) => kv2.set('lock:x', `w${i}`, 5_000, { nx: true })),
  );
  assert.equal(atomic.filter(Boolean).length, 1);
});
