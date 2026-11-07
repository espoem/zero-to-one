// Module 07: rate limiters, INCREX semantics, locks, Redlock arithmetic, fencing, idempotency.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FixedWindow,
  SlidingLog,
  Gcra,
  increx,
  quorum,
  redlockValidity,
  redlockAcquired,
  gcPauseScenario,
  IdempotencyStore,
  type Counter,
} from './src/coordination.ts';
import { MiniRedis, evalScript, loadScript } from './src/lua.ts';

test('negative: a fixed window admits 2x the limit across a window boundary', () => {
  const fw = new FixedWindow(10, 60_000);
  let admitted = 0;
  for (let i = 0; i < 10; i++) if (fw.allow(59_900)) admitted++; // end of window 0
  for (let i = 0; i < 10; i++) if (fw.allow(60_100)) admitted++; // start of window 1
  assert.equal(admitted, 20); // 20 requests within 200 ms against a "10 per minute" limit
});

test('sliding log is exact: never more than the limit in any window', () => {
  const sl = new SlidingLog(10, 60_000);
  let admitted = 0;
  for (let i = 0; i < 10; i++) if (sl.allow(59_900)) admitted++;
  for (let i = 0; i < 10; i++) if (sl.allow(60_100)) admitted++;
  assert.equal(admitted, 10);
  assert.equal(sl.allow(119_901), true); // the first ten have aged out
});

test('sliding-window counter (Lua) smooths the boundary burst', () => {
  const db = new MiniRedis();
  const src = loadScript('sliding_window.lua');
  const window = 60_000;
  const hit = (now: number) => {
    const w = Math.floor(now / window);
    return (
      evalScript(db, src, [`rl:{u}:${w}`, `rl:{u}:${w - 1}`], [10, window, now]) as number[]
    )[0];
  };
  let admitted = 0;
  for (let i = 0; i < 10; i++) admitted += hit(59_900)!;
  for (let i = 0; i < 10; i++) admitted += hit(60_100)!;
  // At 60.1 s the previous window still weighs ~99.8 %: almost nothing more is admitted.
  assert.equal(admitted, 10);
  // Half-way through the next window the previous one counts for half: 5 slots free up.
  let later = 0;
  for (let i = 0; i < 10; i++) later += hit(90_000)!;
  assert.equal(later, 5);
});

test('GCRA allows a burst, then exactly the sustained rate', () => {
  const g = new Gcra(10, 5); // 10 req/s, burst 5
  const burst = Array.from({ length: 7 }, () => g.allow(0)).filter(Boolean).length;
  assert.equal(burst, 5);
  assert.equal(g.allow(50), false);
  assert.equal(g.allow(100), true); // one interval later
});

test('INCREX: default skip at the bound vs SATURATE, as documented', () => {
  const s = new Map<string, Counter>([['k', { value: 99 }]]);
  assert.deepEqual(increx(s, 'k', 0, { by: 5, ubound: 100 }), [99, 0]);
  assert.deepEqual(increx(s, 'k', 0, { by: 5, ubound: 100, saturate: true }), [100, 1]);
});

test('INCREX as a window rate limiter: EX + ENX sets the TTL only on the first hit', () => {
  const s = new Map<string, Counter>();
  const opts = { by: 1, ubound: 3, exMs: 60_000, enx: true };
  const results = [0, 10_000, 20_000, 30_000].map((t) => increx(s, 'rl', t, opts)[1]);
  assert.deepEqual(results, [1, 1, 1, 0]); // 4th request rejected: applied increment 0
  assert.equal(s.get('rl')!.expiresAt, 60_000); // window anchored at the first request
  assert.deepEqual(increx(s, 'rl', 60_000, opts), [1, 1]); // window expired: counting restarts
});

test('negative: INCREX option validation', () => {
  const s = new Map<string, Counter>();
  assert.throws(() => increx(s, 'k', 0, { enx: true }), /ENX/);
  assert.throws(() => increx(s, 'k', 0, { enx: true, exMs: 1, persist: true }), /PERSIST/);
  assert.throws(() => increx(s, 'k', 0, { lbound: 5, ubound: 1 }), /LBOUND/);
});

test('Redlock arithmetic: quorum and validity time', () => {
  assert.equal(quorum(5), 3);
  assert.equal(quorum(4), 3);
  assert.equal(redlockValidity(10_000, 120), 10_000 - 120 - 102);
  assert.equal(redlockAcquired(5, 3, 10_000, 120), true);
  assert.equal(redlockAcquired(5, 2, 10_000, 120), false); // no majority
  assert.equal(redlockAcquired(5, 5, 10_000, 9_950), false); // acquisition ate the TTL
});

test('negative: without fencing, a paused client and the next holder both write', () => {
  const s = gcPauseScenario(false);
  assert.deepEqual(
    s.writes.map((w) => w.owner),
    ['client-2', 'client-1'],
  ); // client-1 clobbers B
});

test("fencing tokens: the storage rejects the paused client's stale token", () => {
  const s = gcPauseScenario(true);
  assert.deepEqual(
    s.writes.map((w) => w.owner),
    ['client-2'],
  );
});

test('idempotency keys: first request proceeds, concurrent duplicate waits, retry replays', () => {
  const st = new IdempotencyStore();
  assert.equal(st.begin('idem:pay-1', 'body-A'), 'proceed');
  assert.equal(st.begin('idem:pay-1', 'body-A'), 'in-progress');
  st.complete('idem:pay-1', 'body-A', '{"charge":"ch_1"}');
  assert.deepEqual(st.begin('idem:pay-1', 'body-A'), { replay: '{"charge":"ch_1"}' });
});

test('negative: reusing an idempotency key with a different request body is a conflict', () => {
  const st = new IdempotencyStore();
  st.begin('idem:k', 'body-A');
  assert.equal(st.begin('idem:k', 'body-B'), 'conflict');
});

test('idempotency: a failed attempt releases the key so the client can retry', () => {
  const st = new IdempotencyStore();
  st.begin('idem:k', 'b');
  st.abort('idem:k');
  assert.equal(st.begin('idem:k', 'b'), 'proceed');
});
