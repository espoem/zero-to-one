// Module 10 (integration): a primary and a replica, WAIT, read-only replicas, partial resync after
// a replica restart, min-replicas-to-write, and a real Sentinel failover (3 sentinels).
// Needs REDIS_SERVER_BIN (spawns several processes). In Docker mode use docker-compose.yml
// (profile "sentinel") and the commands in the module text.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';
import { createClient } from 'redis';
import { getServer, shutdown, type Server } from './harness.ts';

after(shutdown);

function make(url: string) {
  return createClient({ url, RESP: 2 });
}
type C = ReturnType<typeof make>;
async function client(url: string, t: import('node:test').TestContext): Promise<C> {
  const c = make(url);
  c.on('error', () => {});
  await c.connect();
  t.after(() => c.destroy());
  return c;
}
async function waitFor(fn: () => Promise<boolean>, ms = 20_000): Promise<void> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if (await fn()) return;
    } catch {
      /* not ready */
    }
    await sleep(100);
  }
  throw new Error('timeout');
}
const port = (url: string) => new URL(url).port;
const info = async (c: C, section: string) => String(await c.sendCommand(['INFO', section]));

async function pair(
  t: import('node:test').TestContext,
): Promise<{ s: Server; primary: Server; replica: Server; p: C; r: C } | undefined> {
  const s = await getServer();
  if (typeof s === 'string') {
    t.skip(s);
    return undefined;
  }
  if (!s.spawnExtra) {
    t.skip('needs REDIS_SERVER_BIN to spawn a primary and a replica');
    return undefined;
  }
  const primary = await s.spawnExtra(['--repl-diskless-sync-delay', '0']);
  t.after(() => primary.stop());
  const replica = await s.spawnExtra(['--replicaof', '127.0.0.1', port(primary.url)]);
  t.after(() => replica.stop());
  const p = await client(primary.url, t);
  const r = await client(replica.url, t);
  await waitFor(async () => /master_link_status:up/.test(await info(r, 'replication')));
  return { s, primary, replica, p, r };
}

test('replication: WAIT reports acknowledging replicas; replicas are read-only', async (t) => {
  const x = await pair(t);
  if (!x) return;
  await x.p.sendCommand(['SET', 'k', 'v']);
  assert.equal(await x.p.sendCommand(['WAIT', '1', '2000']), 1);
  assert.equal(await x.r.sendCommand(['GET', 'k']), 'v');
  await assert.rejects(x.r.sendCommand(['SET', 'k', 'x']), /READONLY/);
  const pi = await info(x.p, 'replication');
  assert.match(pi, /connected_slaves:1/);
});

test('a restarted replica resumes with a partial resync from the backlog', async (t) => {
  const x = await pair(t);
  if (!x) return;
  for (let i = 0; i < 100; i++) await x.p.sendCommand(['SET', `k${i}`, 'v']);
  await x.p.sendCommand(['WAIT', '1', '2000']);
  const fullBefore = Number(/sync_full:(\d+)/.exec(await info(x.p, 'stats'))?.[1]);
  // Disconnect the replica's link without losing its state: CLIENT KILL TYPE replica on the primary.
  await x.p.sendCommand(['CLIENT', 'KILL', 'TYPE', 'replica']);
  for (let i = 0; i < 100; i++) await x.p.sendCommand(['SET', `later${i}`, 'v']);
  await waitFor(async () => /master_link_status:up/.test(await info(x.r, 'replication')));
  await x.p.sendCommand(['WAIT', '1', '2000']);
  const stats = await info(x.p, 'stats');
  assert.equal(Number(/sync_full:(\d+)/.exec(stats)?.[1]), fullBefore); // no new full sync
  assert.ok(Number(/sync_partial_ok:(\d+)/.exec(stats)?.[1]) >= 1);
  assert.equal(await x.r.sendCommand(['GET', 'later99']), 'v');
});

test('negative: min-replicas-to-write refuses writes when no replica is fresh enough', async (t) => {
  const s = await getServer();
  if (typeof s === 'string') return t.skip(s);
  if (!s.spawnExtra) return t.skip('needs REDIS_SERVER_BIN');
  const lone = await s.spawnExtra(['--min-replicas-to-write', '1', '--min-replicas-max-lag', '10']);
  t.after(() => lone.stop());
  const c = await client(lone.url, t);
  await assert.rejects(c.sendCommand(['SET', 'k', 'v']), /NOREPLICAS/);
  assert.equal(await c.sendCommand(['GET', 'k']), null); // reads still work
});

async function freePort(): Promise<number> {
  return new Promise((res) => {
    const srv = createServer();
    srv.listen(0, '127.0.0.1', () => {
      const a = srv.address() as { port: number };
      srv.close(() => res(a.port));
    });
  });
}

test('Sentinel: killing the primary promotes the replica (3 sentinels, quorum 2)', async (t) => {
  const x = await pair(t);
  if (!x) return;
  const bin = process.env.REDIS_SERVER_BIN!;
  const sentinels: string[] = [];
  for (let i = 0; i < 3; i++) {
    const dir = mkdtempSync(join(tmpdir(), 'zto-sentinel-'));
    const sp = await freePort();
    const conf = join(dir, 'sentinel.conf');
    writeFileSync(
      conf,
      [
        `port ${sp}`,
        'bind 127.0.0.1',
        `dir ${dir}`,
        `logfile ${join(dir, 'sentinel.log')}`,
        `sentinel monitor mymaster 127.0.0.1 ${port(x.primary.url)} 2`,
        'sentinel down-after-milliseconds mymaster 1000',
        'sentinel failover-timeout mymaster 10000',
        'sentinel parallel-syncs mymaster 1',
      ].join('\n') + '\n',
    );
    const child = spawn(bin, [conf, '--sentinel'], { stdio: 'ignore' });
    t.after(() => child.kill('SIGKILL'));
    sentinels.push(`redis://127.0.0.1:${sp}`);
  }
  const s0 = await client(sentinels[0]!, t);
  await waitFor(async () => {
    const m = (await s0.sendCommand(['SENTINEL', 'MASTER', 'mymaster'])) as string[];
    const get = (f: string) => m[m.indexOf(f) + 1];
    return Number(get('num-slaves')) === 1 && Number(get('num-other-sentinels')) === 2;
  });
  await x.primary.stop(); // SIGKILL the primary
  await waitFor(async () => {
    const addr = (await s0.sendCommand([
      'SENTINEL',
      'GET-MASTER-ADDR-BY-NAME',
      'mymaster',
    ])) as string[];
    return addr[1] === port(x.replica.url);
  }, 30_000);
  await waitFor(async () => /role:master/.test(await info(x.r, 'replication')));
  await x.r.sendCommand(['SET', 'after-failover', 'ok']); // the promoted replica accepts writes
  assert.equal(await x.r.sendCommand(['GET', 'after-failover']), 'ok');
});
