// Module 05 (integration): MULTI/EXEC/WATCH on a real server, the same Lua files via EVAL/EVALSHA,
// Functions (7.0+), and the BUSY / SCRIPT KILL / UNKILLABLE behaviour of long scripts.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { createHash } from 'node:crypto';
import { connect, needDedicated, needVersion, k, shutdown, rawConn } from './harness.ts';
import { toJS } from '../src/resp.ts';
import { loadScript } from '../src/lua.ts';

after(shutdown);

test('MULTI/EXEC on a real server: runtime error inside, the rest still applied', async (t) => {
  const h = await connect(t);
  if (!h) return;
  const [a, b, s] = [k(t, 'a'), k(t, 'b'), k(t, 's')];
  await h.c.sendCommand(['SET', s, 'text']);
  await h.c.sendCommand(['DEL', a, b]);
  const raw = await rawConn(h.server.url);
  h.defer(raw.close);
  await raw.cmd('MULTI');
  await raw.cmd('SET', a, '1');
  await raw.cmd('INCR', s);
  await raw.cmd('SET', b, '2');
  const exec = toJS(await raw.cmd('EXEC')) as unknown[];
  assert.equal(exec[0], 'OK');
  assert.ok(exec[1] instanceof Error && /not an integer/.test(exec[1].message));
  assert.equal(exec[2], 'OK');
  assert.equal(await h.c.sendCommand(['GET', b]), '2');
});

test('negative: unknown command inside MULTI makes EXEC fail with EXECABORT', async (t) => {
  const h = await connect(t);
  if (!h) return;
  const key = k(t, 'x');
  await h.c.sendCommand(['DEL', key]);
  const d = h.c.duplicate();
  d.on('error', () => {});
  await d.connect();
  h.defer(() => d.close());
  assert.equal(await d.sendCommand(['MULTI']), 'OK');
  assert.equal(await d.sendCommand(['SET', key, '1']), 'QUEUED');
  await assert.rejects(d.sendCommand(['NOSUCHCOMMAND']), /unknown command/i);
  await assert.rejects(d.sendCommand(['EXEC']), /EXECABORT/);
  assert.equal(await h.c.sendCommand(['GET', key]), null);
});

test('WATCH: a concurrent write makes EXEC return nil', async (t) => {
  const h = await connect(t);
  if (!h) return;
  const key = k(t, 'bal');
  await h.c.sendCommand(['SET', key, '100']);
  const alice = h.c.duplicate();
  alice.on('error', () => {});
  await alice.connect();
  h.defer(() => alice.close());
  await alice.sendCommand(['WATCH', key]);
  await h.c.sendCommand(['INCRBY', key, '50']); // someone else
  await alice.sendCommand(['MULTI']);
  await alice.sendCommand(['SET', key, '70']);
  assert.equal(await alice.sendCommand(['EXEC']), null);
  assert.equal(await h.c.sendCommand(['GET', key]), '150');
});

test('EVAL runs the same Lua files as the hermetic tests', async (t) => {
  const h = await connect(t);
  if (!h) return;
  const lock = k(t, 'lock');
  await h.c.sendCommand(['SET', lock, 'A']);
  const cad = loadScript('compare_and_delete.lua');
  assert.equal(await h.c.sendCommand(['EVAL', cad, '1', lock, 'B']), 0);
  assert.equal(await h.c.sendCommand(['EVAL', cad, '1', lock, 'A']), 1);

  const tb = loadScript('token_bucket.lua');
  const bucket = k(t, 'tb');
  await h.c.sendCommand(['DEL', bucket]);
  const res: number[] = [];
  for (let i = 0; i < 6; i++)
    res.push(
      ((await h.c.sendCommand(['EVAL', tb, '1', bucket, '5', '1', '1000', '1'])) as number[])[0]!,
    );
  assert.deepEqual(res, [1, 1, 1, 1, 1, 0]);

  const [from, to] = [k(t, '{acct}:a'), k(t, '{acct}:b')];
  await h.c.sendCommand(['SET', from, '100']);
  await h.c.sendCommand(['DEL', to]);
  assert.deepEqual(
    await h.c.sendCommand(['EVAL', loadScript('transfer.lua'), '2', from, to, '30']),
    [70, 30],
  );
  await assert.rejects(
    h.c.sendCommand(['EVAL', loadScript('transfer.lua'), '2', from, to, '1000']),
    /insufficient funds/,
  );
});

test('negative: a script that fails after a write keeps the write', async (t) => {
  const h = await connect(t);
  if (!h) return;
  const [counter, text] = [k(t, 'c'), k(t, 't')];
  await h.c.sendCommand(['DEL', counter]);
  await h.c.sendCommand(['SET', text, 'hello']);
  await assert.rejects(
    h.c.sendCommand(['EVAL', loadScript('partial_write.lua'), '2', counter, text]),
    /not an integer/,
  );
  assert.equal(await h.c.sendCommand(['GET', counter]), '1');
});

test('EVALSHA: NOSCRIPT until the script is loaded; the SHA is SHA-1 of the source', async (t) => {
  const h = await connect(t);
  if (!h) return;
  const src = `return 'zto-${Date.now()}'`;
  const sha = createHash('sha1').update(src).digest('hex');
  await assert.rejects(h.c.sendCommand(['EVALSHA', sha, '0']), /NOSCRIPT/);
  assert.equal(await h.c.sendCommand(['SCRIPT', 'LOAD', src]), sha);
  assert.match(String(await h.c.sendCommand(['EVALSHA', sha, '0'])), /^zto-/);
});

test('scripts are atomic: 20 concurrent read-modify-write scripts lose no update', async (t) => {
  const h = await connect(t);
  if (!h) return;
  const key = k(t, 'n');
  await h.c.sendCommand(['SET', key, '0']);
  const src =
    "local v = tonumber(redis.call('GET', KEYS[1])); redis.call('SET', KEYS[1], v + 1); return v + 1";
  const clients = await Promise.all(
    Array.from({ length: 20 }, async () => {
      const d = h.c.duplicate();
      d.on('error', () => {});
      await d.connect();
      return d;
    }),
  );
  h.defer(() => Promise.all(clients.map((d) => d.close())));
  await Promise.all(
    clients.map(async (d) => {
      for (let i = 0; i < 25; i++) await d.sendCommand(['EVAL', src, '1', key]);
    }),
  );
  assert.equal(await h.c.sendCommand(['GET', key]), '500');
});

test('Functions (7.0+): FUNCTION LOAD a library and FCALL it', async (t) => {
  const h = await connect(t);
  if (!h || !needVersion(t, h.server, '7.0.0', { valkey: '7.2.0' })) return;
  const lib = `#!lua name=zto_lib
redis.register_function('zto_cad', function(keys, args)
  if redis.call('GET', keys[1]) == args[1] then return redis.call('DEL', keys[1]) end
  return 0
end)`;
  assert.equal(await h.c.sendCommand(['FUNCTION', 'LOAD', 'REPLACE', lib]), 'zto_lib');
  const key = k(t, 'l');
  await h.c.sendCommand(['SET', key, 'tok']);
  assert.equal(await h.c.sendCommand(['FCALL', 'zto_cad', '1', key, 'tok']), 1);
  await h.c.sendCommand(['FUNCTION', 'DELETE', 'zto_lib']);
});

const BUSY_LOOP = `
local s = redis.call('TIME')
repeat
  local n = redis.call('TIME')
until (n[1] - s[1]) * 1000000 + (n[2] - s[2]) > tonumber(ARGV[1])
return 'done'`;

test('long scripts block everyone: BUSY replies, SCRIPT KILL works only before the first write', async (t) => {
  const h = await connect(t);
  if (!h || !needDedicated(t, h.server)) return;
  const { c } = h;
  const old = ((await c.sendCommand(['CONFIG', 'GET', 'busy-reply-threshold'])) as string[])[1]!;
  h.defer(() => c.sendCommand(['CONFIG', 'SET', 'busy-reply-threshold', old]));
  await c.sendCommand(['CONFIG', 'SET', 'busy-reply-threshold', '100']);
  const runner = c.duplicate();
  runner.on('error', () => {});
  await runner.connect();
  h.defer(() => runner.close());

  // 1. Read-only long script: other clients get BUSY, SCRIPT KILL stops it.
  const ro = runner.sendCommand(['EVAL', BUSY_LOOP, '0', '5000000']).catch((e: Error) => e);
  await sleep(300);
  await assert.rejects(c.sendCommand(['PING']), /BUSY/);
  assert.equal(await c.sendCommand(['SCRIPT', 'KILL']), 'OK');
  assert.match(String(await ro), /killed|interrupted/i);

  // 2. A script that wrote first cannot be killed (it would leave a half-applied script).
  const w = runner.sendCommand([
    'EVAL',
    `redis.call('SET', KEYS[1], 'x')` + BUSY_LOOP,
    '1',
    k(t, 'w'),
    '1000000',
  ]);
  await sleep(300);
  await assert.rejects(c.sendCommand(['SCRIPT', 'KILL']), /UNKILLABLE/);
  assert.equal(await w, 'done');
  assert.equal(await c.sendCommand(['PING']), 'PONG');
});
