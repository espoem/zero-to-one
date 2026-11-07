// Module 04 (integration): CLIENT TRACKING details beyond the basic invalidation: NOLOOP, BCAST prefixes,
// OPTIN, flush on FLUSHALL, and the option conflicts the server rejects.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { connect, k, rawConn, shutdown } from './harness.ts';
import { toJS } from '../src/resp.ts';

after(shutdown);

async function pushes(r: Awaited<ReturnType<typeof rawConn>>, ms = 150) {
  await sleep(ms);
  return r
    .drain()
    .filter((v) => v.type === 'push')
    .map((v) => toJS(v) as unknown[]);
}

test('NOLOOP: a tracking client is not told about its own write, but is told about another client write', async (t) => {
  const h = await connect(t);
  if (!h) return;
  const r = await rawConn(h.server.url);
  h.defer(() => r.close());
  const key = k(t, 'n');
  await h.c.sendCommand(['SET', key, '0']);
  await r.cmd('HELLO', '3');
  await r.cmd('CLIENT', 'TRACKING', 'ON', 'NOLOOP');
  await r.cmd('GET', key);
  await r.cmd('SET', key, '1'); // own write
  assert.deepEqual(await pushes(r), []);
  await r.cmd('GET', key); // track again (invalidation forgets the key)
  await h.c.sendCommand(['SET', key, '2']); // someone else
  assert.deepEqual(await pushes(r), [['invalidate', [key]]]);
});

test('without NOLOOP the own write does produce an invalidation', async (t) => {
  const h = await connect(t);
  if (!h) return;
  const r = await rawConn(h.server.url);
  h.defer(() => r.close());
  const key = k(t, 'l');
  await r.cmd('HELLO', '3');
  await r.cmd('CLIENT', 'TRACKING', 'ON');
  await r.cmd('GET', key);
  await r.cmd('SET', key, '1');
  assert.deepEqual(await pushes(r), [['invalidate', [key]]]);
});

test('BCAST: invalidations arrive for every matching key without any prior read', async (t) => {
  const h = await connect(t);
  if (!h) return;
  const r = await rawConn(h.server.url);
  h.defer(() => r.close());
  const prefix = `${k(t, 'b')}:`;
  await r.cmd('HELLO', '3');
  await r.cmd('CLIENT', 'TRACKING', 'ON', 'BCAST', 'PREFIX', prefix);
  await h.c.sendCommand(['SET', `${prefix}one`, '1']);
  await h.c.sendCommand(['SET', `${prefix}two`, '2']);
  await h.c.sendCommand(['SET', `other:${prefix}`, '3']); // does not match the prefix
  const got = (await pushes(r, 300)).flatMap((p) => p[1] as string[]);
  assert.deepEqual(got.sort(), [`${prefix}one`, `${prefix}two`]);
});

test('OPTIN: only reads preceded by CLIENT CACHING yes are tracked', async (t) => {
  const h = await connect(t);
  if (!h) return;
  const r = await rawConn(h.server.url);
  h.defer(() => r.close());
  const a = k(t, 'a');
  const b = k(t, 'b');
  await r.cmd('HELLO', '3');
  await r.cmd('CLIENT', 'TRACKING', 'ON', 'OPTIN');
  await r.cmd('GET', a); // not opted in
  await r.cmd('CLIENT', 'CACHING', 'yes');
  await r.cmd('GET', b); // opted in, for this one command only
  await h.c.sendCommand(['SET', a, '1']);
  await h.c.sendCommand(['SET', b, '1']);
  assert.deepEqual(await pushes(r), [['invalidate', [b]]]);
});

test('negative: the server rejects BCAST with OPTIN and overlapping prefixes', async (t) => {
  const h = await connect(t);
  if (!h) return;
  await assert.rejects(
    h.c.sendCommand(['CLIENT', 'TRACKING', 'ON', 'BCAST', 'OPTIN']),
    /OPTIN and OPTOUT are not compatible with BCAST/,
  );
  await assert.rejects(
    h.c.sendCommand(['CLIENT', 'TRACKING', 'ON', 'BCAST', 'PREFIX', 'a:', 'PREFIX', 'a:b:']),
    /overlaps with another provided prefix/,
  );
});

test('negative: CLIENT CACHING is an error unless OPTIN or OPTOUT tracking is on', async (t) => {
  const h = await connect(t);
  if (!h) return;
  await assert.rejects(
    h.c.sendCommand(['CLIENT', 'CACHING', 'yes']),
    /CLIENT CACHING can be called only when the client is in tracking mode with OPTIN or OPTOUT/,
  );
});

test('FLUSHALL sends a null-key invalidation to every tracking client', async (t) => {
  const h = await connect(t);
  if (!h || !h.server.dedicated) return t.skip('FLUSHALL needs a dedicated server');
  const r = await rawConn(h.server.url);
  h.defer(() => r.close());
  const key = k(t, 'f');
  await r.cmd('HELLO', '3');
  await r.cmd('CLIENT', 'TRACKING', 'ON');
  await r.cmd('GET', key);
  await h.c.sendCommand(['FLUSHALL']);
  const p = await pushes(r);
  assert.ok(
    p.some((x) => x[0] === 'invalidate' && x[1] === null),
    JSON.stringify(p),
  );
});

test('tracking-table-max-keys defaults to one million and CLIENT TRACKINGINFO reports the mode', async (t) => {
  const h = await connect(t);
  if (!h) return;
  const cfg = (await h.c.sendCommand(['CONFIG', 'GET', 'tracking-table-max-keys'])) as string[];
  assert.equal(cfg[1], '1000000');
  const r = await rawConn(h.server.url);
  h.defer(() => r.close());
  await r.cmd('HELLO', '3');
  await r.cmd('CLIENT', 'TRACKING', 'ON', 'OPTIN', 'NOLOOP');
  const info = toJS(await r.cmd('CLIENT', 'TRACKINGINFO')) as Map<string, unknown>;
  assert.deepEqual([...(info.get('flags') as string[])].sort(), ['noloop', 'on', 'optin']);
});

test('default tracking forgets a key after the first invalidation until it is read again', async (t) => {
  const h = await connect(t);
  if (!h) return;
  const r = await rawConn(h.server.url);
  h.defer(() => r.close());
  const key = k(t, 'once');
  await r.cmd('HELLO', '3');
  await r.cmd('CLIENT', 'TRACKING', 'ON');
  await r.cmd('GET', key);
  await h.c.sendCommand(['SET', key, '1']);
  assert.deepEqual(await pushes(r), [['invalidate', [key]]]);
  await h.c.sendCommand(['SET', key, '2']); // no read in between
  assert.deepEqual(await pushes(r), []);
  await r.cmd('GET', key); // read again: tracked again
  await h.c.sendCommand(['SET', key, '3']);
  assert.deepEqual(await pushes(r), [['invalidate', [key]]]);
});

test('namespace versioning on a real server: INCR orphans the old keys, which survive until their TTL', async (t) => {
  const h = await connect(t);
  if (!h) return;
  const ns = k(t, 'ns');
  const ver = `${ns}:ver`;
  await h.c.sendCommand(['DEL', ver]);
  const key = async (id: string) => `${ns}:v${(await h.c.sendCommand(['GET', ver])) ?? 1}:${id}`;
  for (let i = 0; i < 20; i++)
    await h.c.sendCommand(['SET', await key(String(i)), 'x', 'EX', '60']);
  assert.equal(await h.c.sendCommand(['GET', await key('3')]), 'x');
  assert.equal(await h.c.sendCommand(['INCR', ver]), 1); // the first INCR of a missing key returns 1, not 2
  // Pitfall shown by the test: an absent counter reads as v1 in the key builder but INCR creates it at 1,
  // so the generation did NOT change. Initialise the counter to 1 explicitly.
  assert.equal(await h.c.sendCommand(['GET', await key('3')]), 'x');
  assert.equal(await h.c.sendCommand(['INCR', ver]), 2);
  assert.equal(await h.c.sendCommand(['GET', await key('3')]), null); // every old key unreachable at once
  assert.ok(((await h.c.sendCommand(['TTL', `${ns}:v1:3`])) as number) > 0); // but still in memory, with a TTL
});
