// Module 06 (integration): streams with consumer groups, XAUTOCLAIM, pub/sub delivery semantics,
// slow-subscriber disconnects, BLMOVE reliable queues and keyspace notifications.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { connect, needDedicated, needVersion, k, shutdown, rawConn } from './harness.ts';
import { encodeCommand } from '../src/resp.ts';

after(shutdown);

type XEntries = Array<[string, string[]]>;

test('consumer group: deliver once per group, ack, inspect the PEL', async (t) => {
  const h = await connect(t);
  if (!h) return;
  const { c } = h;
  const s = k(t, 'orders');
  await c.sendCommand(['DEL', s]);
  for (let i = 0; i < 4; i++) await c.sendCommand(['XADD', s, '*', 'n', String(i)]);
  await c.sendCommand(['XGROUP', 'CREATE', s, 'billing', '0']);
  const r1 = (await c.sendCommand([
    'XREADGROUP',
    'GROUP',
    'billing',
    'alice',
    'COUNT',
    '2',
    'STREAMS',
    s,
    '>',
  ])) as Array<[string, XEntries]>;
  const r2 = (await c.sendCommand([
    'XREADGROUP',
    'GROUP',
    'billing',
    'bob',
    'COUNT',
    '5',
    'STREAMS',
    s,
    '>',
  ])) as Array<[string, XEntries]>;
  assert.equal(r1[0]![1].length, 2);
  assert.equal(r2[0]![1].length, 2);
  const firstId = r1[0]![1][0]![0];
  assert.equal(await c.sendCommand(['XACK', s, 'billing', firstId]), 1);
  const summary = (await c.sendCommand(['XPENDING', s, 'billing'])) as [
    number,
    string,
    string,
    Array<[string, string]>,
  ];
  assert.equal(summary[0], 3);
  // A second group gets its own copy of every entry (fan-out).
  await c.sendCommand(['XGROUP', 'CREATE', s, 'analytics', '0']);
  const r3 = (await c.sendCommand([
    'XREADGROUP',
    'GROUP',
    'analytics',
    'x',
    'COUNT',
    '10',
    'STREAMS',
    s,
    '>',
  ])) as Array<[string, XEntries]>;
  assert.equal(r3[0]![1].length, 4);
});

test("XAUTOCLAIM transfers a dead consumer's entries and bumps the delivery count", async (t) => {
  const h = await connect(t);
  if (!h) return;
  const { c } = h;
  const s = k(t, 'jobs');
  await c.sendCommand(['DEL', s]);
  const id = String(await c.sendCommand(['XADD', s, '*', 'job', 'resize']));
  await c.sendCommand(['XGROUP', 'CREATE', s, 'g', '0']);
  await c.sendCommand(['XREADGROUP', 'GROUP', 'g', 'dead-worker', 'STREAMS', s, '>']);
  await sleep(20);
  const r = (await c.sendCommand(['XAUTOCLAIM', s, 'g', 'rescuer', '10', '0'])) as [
    string,
    XEntries,
    string[]?,
  ];
  assert.equal(r[1][0]![0], id);
  const detail = (await c.sendCommand(['XPENDING', s, 'g', '-', '+', '10'])) as Array<
    [string, string, number, number]
  >;
  assert.equal(detail[0]![1], 'rescuer');
  assert.equal(detail[0]![3], 2); // delivered twice
});

test('negative: XADD with an ID not greater than the top is rejected', async (t) => {
  const h = await connect(t);
  if (!h) return;
  const s = k(t, 'ids');
  await h.c.sendCommand(['DEL', s]);
  await h.c.sendCommand(['XADD', s, '5-0', 'a', '1']);
  await assert.rejects(h.c.sendCommand(['XADD', s, '5-0', 'a', '2']), /equal or smaller/);
});

test('MAXLEN ~ trims approximately (whole nodes), MAXLEN = exactly', async (t) => {
  const h = await connect(t);
  if (!h) return;
  const s = k(t, 'trim');
  await h.c.sendCommand(['DEL', s]);
  for (let i = 0; i < 1000; i++)
    await h.c.sendCommand(['XADD', s, 'MAXLEN', '~', '100', '*', 'i', String(i)]);
  const approx = (await h.c.sendCommand(['XLEN', s])) as number;
  assert.ok(approx >= 100 && approx < 300, `XLEN=${approx}`);
  await h.c.sendCommand(['XTRIM', s, 'MAXLEN', '=', '100']);
  assert.equal(await h.c.sendCommand(['XLEN', s]), 100);
});

test('pub/sub is fire-and-forget: no subscriber means the message is gone', async (t) => {
  const h = await connect(t);
  if (!h) return;
  const ch = k(t, 'ch');
  assert.equal(await h.c.sendCommand(['PUBLISH', ch, 'lost']), 0); // 0 receivers
  const sub = h.c.duplicate();
  sub.on('error', () => {});
  await sub.connect();
  h.defer(() => sub.close());
  const got: string[] = [];
  await sub.subscribe(ch, (m) => got.push(m));
  assert.equal(await h.c.sendCommand(['PUBLISH', ch, 'seen']), 1);
  for (let i = 0; i < 50 && got.length === 0; i++) await sleep(10);
  assert.deepEqual(got, ['seen']); // the earlier message was never stored
});

test('a slow subscriber is disconnected by client-output-buffer-limit pubsub', async (t) => {
  const h = await connect(t);
  if (!h || !needDedicated(t, h.server)) return;
  const { c } = h;
  const old = (
    (await c.sendCommand(['CONFIG', 'GET', 'client-output-buffer-limit'])) as string[]
  )[1]!;
  h.defer(() => c.sendCommand(['CONFIG', 'SET', 'client-output-buffer-limit', old]));
  await c.sendCommand(['CONFIG', 'SET', 'client-output-buffer-limit', 'pubsub 64kb 32kb 1']);
  const raw = await rawConn(h.server.url);
  h.defer(raw.close);
  const ch = k(t, 'firehose');
  await raw.send(encodeCommand(['SUBSCRIBE', ch]), 1);
  const before = String(await c.sendCommand(['CLIENT', 'LIST', 'TYPE', 'pubsub']));
  assert.match(before, /sub=1/);
  // Publish far more than the socket buffers + 64 kB hard limit while the subscriber is paused.
  raw.pause();
  const payload = 'x'.repeat(16 * 1024);
  for (let i = 0; i < 2000; i++) await c.sendCommand(['PUBLISH', ch, payload]);
  let after = before;
  for (let i = 0; i < 50 && /sub=1/.test(after); i++) {
    await sleep(20);
    after = String(await c.sendCommand(['CLIENT', 'LIST', 'TYPE', 'pubsub']));
  }
  assert.doesNotMatch(after, new RegExp(`sub=1`), 'subscriber should have been disconnected');
});

test('BLMOVE reliable queue: the job survives in the processing list until acknowledged', async (t) => {
  const h = await connect(t);
  if (!h || !needVersion(t, h.server, '6.2.0', { valkey: '7.2.0' })) return;
  const { c } = h;
  const [q, proc] = [k(t, '{q}:jobs'), k(t, '{q}:processing:w1')];
  await c.sendCommand(['DEL', q, proc]);
  await c.sendCommand(['LPUSH', q, 'job-1']);
  const job = await c.sendCommand(['BLMOVE', q, proc, 'RIGHT', 'LEFT', '1']);
  assert.equal(job, 'job-1');
  // Worker "crashes" here. A reaper returns abandoned jobs to the queue.
  assert.equal(await c.sendCommand(['LMOVE', proc, q, 'RIGHT', 'LEFT']), 'job-1');
  assert.equal(await c.sendCommand(['LLEN', q]), 1);
  // Successful processing: move, work, LREM from the processing list.
  await c.sendCommand(['BLMOVE', q, proc, 'RIGHT', 'LEFT', '1']);
  assert.equal(await c.sendCommand(['LREM', proc, '1', 'job-1']), 1);
});

test('keyspace notifications publish key events when enabled', async (t) => {
  const h = await connect(t);
  if (!h || !needDedicated(t, h.server)) return;
  const { c } = h;
  const old = ((await c.sendCommand(['CONFIG', 'GET', 'notify-keyspace-events'])) as string[])[1]!;
  h.defer(() => c.sendCommand(['CONFIG', 'SET', 'notify-keyspace-events', old]));
  await c.sendCommand(['CONFIG', 'SET', 'notify-keyspace-events', 'E$x']); // keyevent, string cmds, expired
  const sub = c.duplicate();
  sub.on('error', () => {});
  await sub.connect();
  h.defer(() => sub.close());
  const events: string[] = [];
  await sub.pSubscribe('__keyevent@0__:*', (msg, channel) => events.push(`${channel}|${msg}`));
  const key = k(t, 'n');
  await c.sendCommand(['SET', key, 'v', 'PX', '30']);
  for (let i = 0; i < 100 && !events.some((e) => e.includes(':expired')); i++) {
    await sleep(20);
    await c.sendCommand(['EXISTS', key]); // touching it triggers lazy expiry
  }
  assert.ok(events.some((e) => e.endsWith(`:set|${key}`)));
  assert.ok(events.some((e) => e.endsWith(`:expired|${key}`)));
});
