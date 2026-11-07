// Module 12 (integration): ACL users and ACL DRYRUN, SLOWLOG, LATENCY monitor, INFO commandstats,
// and HOTKEYS on 8.6+.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from 'redis';
import { connect, needDedicated, needVersion, k, shutdown } from './harness.ts';
import { parseInfo } from '../src/ops.ts';

after(shutdown);

test('ACL: a least-privilege user is limited to its key pattern and categories', async (t) => {
  const h = await connect(t);
  if (!h || !needVersion(t, h.server, '7.0.0', { valkey: '7.2.0' })) return;
  const { c } = h;
  const user = `zto_app_${process.pid}`;
  h.defer(() => c.sendCommand(['ACL', 'DELUSER', user]));
  await c.sendCommand([
    'ACL',
    'SETUSER',
    user,
    'reset',
    'on',
    '>s3cret-pass',
    '~app:*',
    '+@read',
    '+@write',
    '-@dangerous',
  ]);
  assert.equal(await c.sendCommand(['ACL', 'DRYRUN', user, 'GET', 'app:1']), 'OK');
  assert.match(
    String(await c.sendCommand(['ACL', 'DRYRUN', user, 'GET', 'billing:1'])),
    /no permissions to access the 'billing:1' key/,
  );
  assert.match(
    String(await c.sendCommand(['ACL', 'DRYRUN', user, 'FLUSHALL'])),
    /no permissions to run the 'flushall' command/,
  );

  const url = new URL(h.server.url);
  url.username = user;
  url.password = 's3cret-pass';
  const app = createClient({ url: url.toString(), RESP: 2 });
  app.on('error', () => {});
  await app.connect();
  h.defer(() => app.close());
  assert.equal(await app.sendCommand(['SET', 'app:1', 'v']), 'OK');
  await assert.rejects(app.sendCommand(['SET', 'other:1', 'v']), /NOPERM/);
  await assert.rejects(app.sendCommand(['KEYS', '*']), /NOPERM/);
});

test('negative: wrong password fails with WRONGPASS', async (t) => {
  const h = await connect(t);
  if (!h) return;
  await assert.rejects(h.c.sendCommand(['AUTH', 'nobody', 'nope']), /WRONGPASS/);
});

test('SLOWLOG records commands above the threshold, with arguments', async (t) => {
  const h = await connect(t);
  if (!h || !needDedicated(t, h.server)) return;
  const { c } = h;
  const old = ((await c.sendCommand(['CONFIG', 'GET', 'slowlog-log-slower-than'])) as string[])[1]!;
  h.defer(() => c.sendCommand(['CONFIG', 'SET', 'slowlog-log-slower-than', old]));
  await c.sendCommand(['SLOWLOG', 'RESET']);
  await c.sendCommand(['CONFIG', 'SET', 'slowlog-log-slower-than', '0']); // log everything
  await c.sendCommand(['SET', k(t, 'x'), 'v']);
  const entries = (await c.sendCommand(['SLOWLOG', 'GET', '10'])) as Array<
    [number, number, number, string[]]
  >;
  assert.ok(entries.some((e) => e[3][0]?.toUpperCase() === 'SET'));
  const e = entries[0]!;
  assert.ok(e[2] >= 0); // execution time in microseconds (excludes network and queueing)
});

test('LATENCY monitor captures a blocking event (DEBUG SLEEP)', async (t) => {
  const h = await connect(t);
  if (!h || !needDedicated(t, h.server)) return;
  const { c } = h;
  h.defer(() => c.sendCommand(['CONFIG', 'SET', 'latency-monitor-threshold', '0']));
  await c.sendCommand(['LATENCY', 'RESET']);
  await c.sendCommand(['CONFIG', 'SET', 'latency-monitor-threshold', '50']);
  await c.sendCommand(['DEBUG', 'SLEEP', '0.2']);
  const latest = (await c.sendCommand(['LATENCY', 'LATEST'])) as Array<
    [string, number, number, number]
  >;
  const ev = latest.find((e) => e[0] === 'command');
  assert.ok(ev && ev[2] >= 150, JSON.stringify(latest));
  assert.match(String(await c.sendCommand(['LATENCY', 'DOCTOR'])), /latency/i);
});

test('INFO commandstats counts calls per command', async (t) => {
  const h = await connect(t);
  if (!h) return;
  for (let i = 0; i < 5; i++) await h.c.sendCommand(['PING']);
  const info = parseInfo(String(await h.c.sendCommand(['INFO', 'commandstats'])));
  const ping = info.commandstats!.cmdstat_ping!;
  assert.match(ping, /calls=\d+,usec=\d+/);
});

test('HOTKEYS (8.6+) reports the most CPU-expensive keys', async (t) => {
  const h = await connect(t);
  if (!h || !needDedicated(t, h.server) || !needVersion(t, h.server, '8.6.0')) return;
  const { c } = h;
  await c.sendCommand(['HOTKEYS', 'START', 'METRICS', '2', 'CPU', 'NET', 'COUNT', '10']);
  h.defer(() => c.sendCommand(['HOTKEYS', 'RESET']));
  await c.sendCommand(['SET', 'hot', 'v']);
  for (let i = 0; i < 500; i++) await c.sendCommand(['GET', 'hot']);
  await c.sendCommand(['GET', 'cold']);
  const r = JSON.stringify(await c.sendCommand(['HOTKEYS', 'GET']));
  await c.sendCommand(['HOTKEYS', 'STOP']);
  assert.match(r, /"hot"/);
});
