// Module 09 (integration): BGSAVE and fork metrics, multi-part AOF on disk, crash recovery with
// AOF vs data loss with RDB only. Restart tests need REDIS_SERVER_BIN (they kill -9 and restart
// a server on the same data directory); in Docker mode use docker compose kill/start instead.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { createClient } from 'redis';
import {
  connect,
  getServer,
  needDedicated,
  needVersion,
  k,
  shutdown,
  type Server,
} from './harness.ts';
import { parseManifest, loadOrder } from '../src/persistence.ts';

after(shutdown);

async function waitFor(fn: () => Promise<boolean>, ms = 10_000): Promise<void> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return;
    await sleep(50);
  }
  throw new Error('timeout');
}

test('BGSAVE forks a child; INFO persistence reports success and the fork time', async (t) => {
  const h = await connect(t);
  if (!h || !needDedicated(t, h.server)) return;
  const { c } = h;
  await c.sendCommand(['SET', k(t, 'x'), 'v']);
  const before = (await c.sendCommand(['LASTSAVE'])) as number;
  await sleep(1100); // LASTSAVE has 1 s resolution
  await c.sendCommand(['BGSAVE']);
  await waitFor(async () => ((await c.sendCommand(['LASTSAVE'])) as number) > before);
  const info = String(await c.sendCommand(['INFO', 'persistence']));
  assert.match(info, /rdb_last_bgsave_status:ok/);
  assert.ok(
    Number(/latest_fork_usec:(\d+)/.exec(String(await c.sendCommand(['INFO', 'stats'])))?.[1]) > 0,
  );
});

test('enabling AOF at runtime writes a multi-part AOF directory with a manifest (7.0+)', async (t) => {
  const h = await connect(t);
  if (!h || !needDedicated(t, h.server) || !needVersion(t, h.server, '7.0.0', { valkey: '7.2.0' }))
    return;
  if (!h.server.dir) return t.skip('needs a spawned server (REDIS_SERVER_BIN) to inspect files');
  const { c } = h;
  h.defer(() => c.sendCommand(['CONFIG', 'SET', 'appendonly', 'no']));
  await c.sendCommand(['CONFIG', 'SET', 'appendonly', 'yes']);
  await waitFor(
    async () =>
      /aof_rewrite_in_progress:0/.test(String(await c.sendCommand(['INFO', 'persistence']))) &&
      /aof_enabled:1/.test(String(await c.sendCommand(['INFO', 'persistence']))),
  );
  await c.sendCommand(['SET', k(t, 'after'), 'v']);
  const dir = join(h.server.dir, 'appendonlydir');
  await waitFor(
    async () => existsSync(dir) && readdirSync(dir).some((f) => f.endsWith('.manifest')),
  );
  const manifest = readdirSync(dir).find((f) => f.endsWith('.manifest'))!;
  const order = loadOrder(parseManifest(readFileSync(join(dir, manifest), 'utf8')));
  assert.match(order[0]!, /base\.(rdb|aof)$/);
  assert.ok(order.slice(1).every((f) => f.endsWith('incr.aof')));
});

async function restartCycle(
  t: import('node:test').TestContext,
  server: Server,
  args: string[],
  write: (c: { sendCommand(args: string[]): Promise<unknown> }) => Promise<void>,
) {
  const first = await server.spawnExtra!(args);
  const c1 = createClient({ url: first.url, RESP: 2 });
  c1.on('error', () => {});
  await c1.connect();
  await write(c1);
  await c1.close();
  await first.stop(); // SIGKILL: no shutdown save, no AOF flush beyond what was already written
  const second = await server.spawnExtra!([...args, '--dir', first.dir!]);
  t.after(() => second.stop());
  const c2 = createClient({ url: second.url, RESP: 2 });
  c2.on('error', () => {});
  await c2.connect();
  t.after(() => c2.close());
  return c2;
}

test('kill -9 with appendfsync always: every acknowledged write survives the restart', async (t) => {
  const s = await getServer();
  if (typeof s === 'string') return t.skip(s);
  if (!s.spawnExtra)
    return t.skip('needs REDIS_SERVER_BIN to kill and restart a server on the same directory');
  const c = await restartCycle(
    t,
    s,
    ['--appendonly', 'yes', '--appendfsync', 'always'],
    async (c1) => {
      for (let i = 0; i < 100; i++) await c1.sendCommand(['INCR', 'counter']);
    },
  );
  assert.equal(await c.sendCommand(['GET', 'counter']), '100');
});

test('negative: kill -9 with RDB only loses every write since the last snapshot', async (t) => {
  const s = await getServer();
  if (typeof s === 'string') return t.skip(s);
  if (!s.spawnExtra)
    return t.skip('needs REDIS_SERVER_BIN to kill and restart a server on the same directory');
  const c = await restartCycle(t, s, ['--appendonly', 'no', '--save', '3600 1'], async (c1) => {
    await c1.sendCommand(['SET', 'snap', 'in-snapshot']);
    await c1.sendCommand(['SAVE']);
    await c1.sendCommand(['SET', 'later', 'not-in-snapshot']);
  });
  assert.equal(await c.sendCommand(['GET', 'snap']), 'in-snapshot');
  assert.equal(await c.sendCommand(['GET', 'later']), null);
});

test('WAITAOF (7.2+) confirms local fsync of the write', async (t) => {
  const h = await connect(t);
  if (!h || !needDedicated(t, h.server) || !needVersion(t, h.server, '7.2.0', { valkey: '8.0.0' }))
    return;
  const { c } = h;
  h.defer(async () => {
    await c.sendCommand(['CONFIG', 'SET', 'appendfsync', 'everysec']);
    await c.sendCommand(['CONFIG', 'SET', 'appendonly', 'no']);
  });
  await c.sendCommand(['CONFIG', 'SET', 'appendonly', 'yes']);
  await c.sendCommand(['CONFIG', 'SET', 'appendfsync', 'always']);
  await waitFor(async () =>
    /aof_rewrite_in_progress:0/.test(String(await c.sendCommand(['INFO', 'persistence']))),
  );
  await c.sendCommand(['SET', k(t, 'w'), 'v']);
  const r = (await c.sendCommand(['WAITAOF', '1', '0', '2000'])) as number[];
  assert.equal(r[0], 1); // fsynced locally
});
