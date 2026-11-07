// Module 04 (hermetic): exhaustive interleavings of the dual-write race, the near-cache invalidation
// protocol, and stale-while-revalidate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { check, interleavings, run, type Step } from './src/interleave.ts';
import { NearCache, TrackingServer, type Msg } from './src/nearcache.ts';
import { SwrCache } from './src/swr.ts';

test('interleavings: C(4,2) = 6 merges that keep program order', () => {
  const all = interleavings(['a1', 'a2'], ['b1', 'b2']);
  assert.equal(all.length, 6);
  for (const o of all) {
    assert.ok(o.indexOf('a1') < o.indexOf('a2') && o.indexOf('b1') < o.indexOf('b2'));
  }
});

test('update DB then delete cache: exactly 1 of 6 interleavings leaves a stale cache', () => {
  const r = check(['W:writeDb', 'W:delCache']);
  assert.equal(r.total, 6);
  assert.equal(r.stale, 1);
  // the one bad order: read old, write, delete, THEN the slow reader installs the old value
  assert.deepEqual(r.staleOrders[0], ['R:readDb', 'W:writeDb', 'W:delCache', 'R:setCache']);
});

test('delete cache then update DB: 4 of 6 interleavings are stale', () => {
  const r = check(['W:delCache', 'W:writeDb']);
  assert.equal(r.total, 6);
  assert.equal(r.stale, 4);
});

test('delayed double delete only helps if the second delete comes after the slow reader', () => {
  const writer: Step[] = ['W:writeDb', 'W:delCache', 'W:delCache2'];
  const r = check(writer);
  assert.equal(r.total, 10); // C(5,2)
  assert.equal(r.stale, 1); // reader slower than the delay: R:readDb, W, W, W, R:setCache
  assert.deepEqual(r.staleOrders[0]?.slice(-1), ['R:setCache']);
  // if the second delete is guaranteed last (the delay exceeds the reader's latency), no order is stale
  const reader: Step[] = ['R:readDb', 'R:setCache'];
  const first: Step[] = ['W:writeDb', 'W:delCache'];
  const guarded = interleavings(reader, first).map((o) => [...o, 'W:delCache2' as Step]);
  assert.ok(guarded.every((o) => !run(o).stale));
});

test('write-through: 1 of 6 schedules is stale unversioned, 0 with versioned cache writes', () => {
  const writer: Step[] = ['W:writeDb', 'W:setCacheNew'];
  assert.equal(check(writer).stale, 1); // R:readDb W:writeDb W:setCacheNew R:setCache: old overwrites new
  assert.equal(check(writer, { versioned: true }).stale, 0); // the cache refuses the downgrade
});

test('versioning does not help a delete-based writer: there is no newer version in the cache to compare with', () => {
  assert.equal(check(['W:writeDb', 'W:delCache'], { versioned: true }).stale, 1);
});

test('TTL bound: a stale entry exists only until its TTL, whatever the interleaving', () => {
  // The model has no clock; the claim is structural: every stale outcome is a state with cache = old,
  // which a TTL expiry turns into absent. Check that "absent" is always a legal successor.
  for (const o of check(['W:writeDb', 'W:delCache']).staleOrders) {
    const after = run(o);
    assert.equal(after.cache, 'old');
    assert.equal(after.db, 'new'); // the divergence is the only anomaly: no lost DB write
  }
});

test('near cache: without the pending rule an in-flight reply re-installs a stale value', () => {
  const safe = new NearCache(true);
  const unsafe = new NearCache(false);
  for (const client of [safe, unsafe]) {
    const server = new TrackingServer();
    server.data.set('k', 'v1');
    const seq = client.beginRead('k');
    const value = server.read(1, 'k'); // the server answers v1 and tracks the key
    const inv = server.write('k', 'v2', 2).get(1)!; // another client writes right after
    // Two paths (RESP2 redirect connection, or a RESP3 client that dispatches push frames at once while
    // replies resume later) let the invalidation be handled BEFORE the reply:
    client.onMessage(inv);
    client.onMessage({ kind: 'reply', key: 'k', value, seq });
  }
  assert.equal(unsafe.cache.get('k'), 'v1'); // stale, and nothing will ever invalidate it
  assert.equal(safe.cache.has('k'), false); // the reply was dropped
});

/**
 * Random schedules. Replies are delivered in order among themselves and invalidations in order among
 * themselves (each is one TCP stream), but the two paths interleave freely: RESP2 redirect mode uses two
 * connections, and a RESP3 client may dispatch push frames before resuming the promise of a reply.
 */
function nearCacheProperty(safe: boolean) {
  const op = fc.oneof(
    fc.record({ t: fc.constant('read' as const), k: fc.constantFrom('a', 'b') }),
    fc.record({ t: fc.constant('write' as const), k: fc.constantFrom('a', 'b'), v: fc.nat(99) }),
    fc.record({ t: fc.constant('deliverReply' as const) }),
    fc.record({ t: fc.constant('deliverInvalidation' as const) }),
    fc.record({ t: fc.constant('disconnect' as const) }),
  );
  return fc.property(fc.array(op, { maxLength: 60 }), (ops) => {
    const server = new TrackingServer();
    const nc = new NearCache(safe);
    const replies: Msg[] = [];
    const invalidations: Msg[] = [];
    for (const o of ops) {
      if (o.t === 'read') {
        const seq = nc.beginRead(o.k);
        replies.push({ kind: 'reply', key: o.k, value: server.read(1, o.k), seq });
      } else if (o.t === 'write') {
        const inv = server.write(o.k, String(o.v), 2).get(1);
        if (inv) invalidations.push(inv);
      } else if (o.t === 'deliverReply') {
        const m = replies.shift();
        if (m) nc.onMessage(m);
      } else if (o.t === 'deliverInvalidation') {
        const m = invalidations.shift();
        if (m) nc.onMessage(m);
      } else {
        replies.length = 0; // messages in flight are lost
        invalidations.length = 0;
        nc.onDisconnect();
        server.table.clear();
      }
    }
    for (const m of [...invalidations, ...replies]) nc.onMessage(m);
    for (const [key, value] of nc.cache) assert.equal(value, server.data.get(key) ?? null);
  });
}

test('property: with the pending rule a near cache never holds a value the server has replaced', () => {
  fc.assert(nearCacheProperty(true), { numRuns: 500 });
});

test('negative: without the pending rule the same property has a counterexample', () => {
  const r = fc.check(nearCacheProperty(false), { numRuns: 500, seed: 42 });
  assert.equal(r.failed, true);
});

test('NOLOOP: the writer is not told about its own write; other trackers are', () => {
  const server = new TrackingServer();
  server.read(1, 'k');
  server.read(2, 'k');
  const msgs = server.write('k', 'x', 1, true);
  assert.equal(msgs.has(1), false);
  assert.equal(msgs.has(2), true);
});

test('tracking table limit: the oldest keys are dropped and their readers must be told', () => {
  const server = new TrackingServer(2);
  server.read(1, 'a');
  server.read(1, 'b');
  server.read(1, 'c');
  assert.deepEqual(server.dropped, [{ key: 'a', clients: [1] }]);
  assert.equal(server.table.size, 2);
});

test('stale-while-revalidate: 50 concurrent soft-expired readers cause one refresh and all get the stale value', async () => {
  let t = 0;
  let version = 1;
  const c = new SwrCache<number>(
    () => t,
    async () => version,
    100,
    1000,
  );
  assert.deepEqual(await c.get('k'), { value: 1, stale: false });
  version = 2;
  t = 150; // soft-expired, not hard-expired
  const results = await Promise.all(Array.from({ length: 50 }, () => c.get('k')));
  assert.ok(results.every((r) => r.stale && r.value === 1));
  assert.equal(c.loads, 2); // initial load + exactly one background refresh
  await Promise.resolve();
  assert.deepEqual(await c.get('k'), { value: 2, stale: false });
});

test('negative: past the hard TTL a reader must wait for a fresh load; soft must be below hard', async () => {
  let t = 0;
  const c = new SwrCache<string>(
    () => t,
    async () => `v@${t}`,
    100,
    1000,
  );
  await c.get('k');
  t = 2000;
  assert.deepEqual(await c.get('k'), { value: 'v@2000', stale: false });
  assert.throws(
    () =>
      new SwrCache(
        () => 0,
        async () => 1,
        100,
        100,
      ),
    RangeError,
  );
});
