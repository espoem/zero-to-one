// Module 04 (integration): node-redis 6 client-side caching (RESP3) against a real server.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { createClient } from 'redis';
import { connect, k, shutdown } from './harness.ts';

after(shutdown);

test('node-redis clientSideCache (RESP3): the second GET is served locally and a remote write invalidates it', async (t) => {
  const h = await connect(t);
  if (!h) return;
  const near = createClient({
    url: h.server.url,
    RESP: 3,
    clientSideCache: { ttl: 0, maxEntries: 100, evictPolicy: 'LRU' },
  });
  near.on('error', () => {});
  await near.connect();
  h.defer(() => near.close());
  const key = k(t, 'csc');
  await h.c.sendCommand(['SET', key, 'v1']);
  assert.equal(await near.get(key), 'v1'); // miss: goes to the server and is tracked
  const before = Number(
    /total_commands_processed:(\d+)/.exec(String(await h.c.sendCommand(['INFO', 'stats'])))![1],
  );
  for (let i = 0; i < 5; i++) assert.equal(await near.get(key), 'v1'); // hits
  const after5 = Number(
    /total_commands_processed:(\d+)/.exec(String(await h.c.sendCommand(['INFO', 'stats'])))![1],
  );
  // The only commands processed in between are the two INFO calls themselves: no GET reached the server.
  assert.equal(after5 - before, 1);
  await h.c.sendCommand(['SET', key, 'v2']);
  let seen = 'v1';
  for (let i = 0; i < 50 && seen === 'v1'; i++) {
    await sleep(20);
    seen = String(await near.get(key));
  }
  assert.equal(seen, 'v2');
});
