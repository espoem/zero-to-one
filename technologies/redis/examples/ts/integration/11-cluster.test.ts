// Module 11 (integration): a 3-primary Redis Cluster built from spawned processes (needs
// REDIS_SERVER_BIN; in Docker mode use the "cluster" profile of docker-compose.yml).
// Proves: CLUSTER KEYSLOT agrees with our CRC16 implementation, MOVED, CROSSSLOT, hash tags,
// SELECT refused, ASK during a manual slot migration, and transparent routing by node-redis.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { createClient, createCluster } from 'redis';
import { getServer, shutdown, type Server } from './harness.ts';
import { keySlot } from '../src/cluster.ts';

after(shutdown);

function make(url: string) {
  return createClient({ url, RESP: 2 });
}
type C = ReturnType<typeof make>;

let nodes: Server[] = [];
let clients: C[] = [];
let skipReason: string | undefined;
const port = (s: Server) => Number(new URL(s.url).port);

before(async () => {
  const s = await getServer();
  if (typeof s === 'string') return void (skipReason = s);
  if (!s.spawnExtra)
    return void (skipReason = 'needs REDIS_SERVER_BIN to spawn three cluster nodes');
  nodes = await Promise.all(
    [0, 1, 2].map(() =>
      s.spawnExtra!(['--cluster-enabled', 'yes', '--cluster-node-timeout', '2000']),
    ),
  );
  clients = await Promise.all(
    nodes.map(async (n) => {
      const c = make(n.url);
      c.on('error', () => {});
      await c.connect();
      return c;
    }),
  );
  // Assign 3 contiguous slot ranges (CLUSTER ADDSLOTSRANGE needs 7.0+; use ADDSLOTS for 6.x).
  const ranges = [
    [0, 5460],
    [5461, 10922],
    [10923, 16383],
  ] as const;
  await Promise.all(
    clients.map((c, i) =>
      c.sendCommand(['CLUSTER', 'ADDSLOTSRANGE', String(ranges[i]![0]), String(ranges[i]![1])]),
    ),
  );
  for (const n of nodes.slice(1))
    await clients[0]!.sendCommand(['CLUSTER', 'MEET', '127.0.0.1', String(port(n))]);
  for (let i = 0; i < 200; i++) {
    const states = await Promise.all(
      clients.map(async (c) => String(await c.sendCommand(['CLUSTER', 'INFO']))),
    );
    if (states.every((s) => /cluster_state:ok/.test(s) && /cluster_known_nodes:3/.test(s))) return;
    await sleep(100);
  }
  skipReason = 'cluster did not converge';
});

after(async () => {
  await Promise.all(clients.map((c) => c.destroy()));
  await Promise.all(nodes.map((n) => n.stop()));
});

/** Which spawned node owns a slot. */
function ownerIndex(slot: number): number {
  return slot <= 5460 ? 0 : slot <= 10922 ? 1 : 2;
}

test("CLUSTER KEYSLOT agrees with the track's CRC16 implementation", async (t) => {
  if (skipReason) return t.skip(skipReason);
  for (const key of [
    'foo',
    'bar',
    '{user1000}.following',
    'foo{}{bar}',
    'foo{{bar}}zap',
    'π',
    'user:12345',
  ]) {
    assert.equal(await clients[0]!.sendCommand(['CLUSTER', 'KEYSLOT', key]), keySlot(key), key);
  }
});

test('negative: a key sent to the wrong node gets MOVED <slot> <host:port>', async (t) => {
  if (skipReason) return t.skip(skipReason);
  const key = 'user:1';
  const owner = ownerIndex(keySlot(key));
  const wrong = clients[(owner + 1) % 3]!;
  await assert.rejects(
    wrong.sendCommand(['GET', key]),
    new RegExp(`MOVED ${keySlot(key)} 127\\.0\\.0\\.1:${port(nodes[owner]!)}`),
  );
});

test('negative: CROSSSLOT for multi-key commands; a shared hash tag works', async (t) => {
  if (skipReason) return t.skip(skipReason);
  const tagged = ['cart:{42}', 'cart:{42}:items'];
  const c = clients[ownerIndex(keySlot(tagged[0]!))]!;
  assert.equal(await c.sendCommand(['MSET', tagged[0]!, 'a', tagged[1]!, 'b']), 'OK');
  // Two keys that hash to different slots, both on this node's range or not: CROSSSLOT either way.
  let other = 0;
  while (keySlot(`x${other}`) === keySlot(tagged[0]!)) other++;
  await assert.rejects(
    c.sendCommand(['MSET', tagged[0]!, 'a', `x${other}`, 'b']),
    /CROSSSLOT|MOVED/,
  );
});

test('negative: SELECT is refused in cluster mode (database 0 only)', async (t) => {
  if (skipReason) return t.skip(skipReason);
  if (nodes[0]!.flavour === 'valkey')
    return t.skip('Valkey 9.0+ supports numbered databases in cluster mode');
  await assert.rejects(
    clients[0]!.sendCommand(['SELECT', '1']),
    /SELECT is not allowed in cluster mode/,
  );
});

test('ASK during a manual slot migration, then MOVED after the slot is reassigned', async (t) => {
  if (skipReason) return t.skip(skipReason);
  const key = 'mig:{ask-demo}';
  const slot = keySlot(key);
  const srcI = ownerIndex(slot);
  const dstI = (srcI + 1) % 3;
  const [src, dst] = [clients[srcI]!, clients[dstI]!];
  const [srcId, dstId] = [
    String(await src.sendCommand(['CLUSTER', 'MYID'])),
    String(await dst.sendCommand(['CLUSTER', 'MYID'])),
  ];
  await src.sendCommand(['SET', key, 'v']);
  await dst.sendCommand(['CLUSTER', 'SETSLOT', String(slot), 'IMPORTING', srcId]);
  await src.sendCommand(['CLUSTER', 'SETSLOT', String(slot), 'MIGRATING', dstId]);
  await src.sendCommand(['MIGRATE', '127.0.0.1', String(port(nodes[dstI]!)), key, '0', '5000']);
  await assert.rejects(src.sendCommand(['GET', key]), new RegExp(`ASK ${slot}`));
  await assert.rejects(dst.sendCommand(['GET', key]), /MOVED/); // without ASKING
  // ASKING + GET must be on one connection, back to back: use a dedicated client.
  const once = make(nodes[dstI]!.url);
  once.on('error', () => {});
  await once.connect();
  t.after(() => once.destroy());
  await once.sendCommand(['ASKING']);
  assert.equal(await once.sendCommand(['GET', key]), 'v');
  for (const c of clients) await c.sendCommand(['CLUSTER', 'SETSLOT', String(slot), 'NODE', dstId]);
  await assert.rejects(src.sendCommand(['GET', key]), /MOVED/);
  assert.equal(await dst.sendCommand(['GET', key]), 'v');
});

test('a cluster client follows redirections transparently', async (t) => {
  if (skipReason) return t.skip(skipReason);
  const cluster = createCluster({ rootNodes: [{ url: nodes[0]!.url }], RESP: 2 });
  cluster.on('error', () => {});
  await cluster.connect();
  t.after(() => cluster.destroy());
  for (let i = 0; i < 50; i++) await cluster.set(`routed:${i}`, String(i));
  for (let i = 0; i < 50; i++) assert.equal(await cluster.get(`routed:${i}`), String(i));
});
