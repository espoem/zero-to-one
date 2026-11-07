// Module 05: MULTI/EXEC semantics (no rollback, EXECABORT, WATCH) and Lua script logic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MiniRedis, evalScript, loadScript, CommandError } from './src/lua.ts';
import { VersionedRedis, Connection } from './src/multi.ts';

test('MULTI/EXEC: a runtime error does not roll back the other commands', () => {
  const db = new VersionedRedis();
  db.exec(['SET', 'name', 'ada']);
  const c = new Connection(db);
  c.call('MULTI');
  assert.equal(c.call('SET', 'a', '1'), 'QUEUED');
  assert.equal(c.call('INCR', 'name'), 'QUEUED'); // will fail at runtime: not an integer
  assert.equal(c.call('SET', 'b', '2'), 'QUEUED');
  const r = c.call('EXEC') as unknown[];
  assert.deepEqual(r[0], { ok: 'OK' });
  assert.match((r[1] as { err: string }).err, /not an integer/);
  assert.deepEqual(r[2], { ok: 'OK' });
  assert.equal(db.exec(['GET', 'a']), '1');
  assert.equal(db.exec(['GET', 'b']), '2'); // applied despite the error before it
});

test('negative: an error at queue time (unknown command / arity) aborts the whole EXEC', () => {
  const db = new VersionedRedis();
  const c = new Connection(db);
  c.call('MULTI');
  c.call('SET', 'a', '1');
  assert.throws(() => c.call('INCRR', 'a'), /unknown command/);
  assert.throws(() => c.call('EXEC'), /EXECABORT/);
  assert.equal(db.exec(['GET', 'a']), null);
});

test('WATCH: EXEC returns nil if another client modified the watched key', () => {
  const db = new VersionedRedis();
  db.exec(['SET', 'balance', '100']);
  const alice = new Connection(db);
  const bob = new Connection(db);
  alice.call('WATCH', 'balance');
  const seen = Number(alice.call('GET', 'balance'));
  bob.call('INCRBY', 'balance', '50'); // concurrent write
  alice.call('MULTI');
  alice.call('SET', 'balance', String(seen - 30));
  assert.equal(alice.call('EXEC'), null);
  assert.equal(db.exec(['GET', 'balance']), '150'); // Bob's write survives, Alice must retry
});

test('WATCH: without interference EXEC succeeds, and EXEC always unwatches', () => {
  const db = new VersionedRedis();
  db.exec(['SET', 'k', '1']);
  const c = new Connection(db);
  c.call('WATCH', 'k');
  c.call('MULTI');
  c.call('INCR', 'k');
  assert.deepEqual(c.call('EXEC'), [2]);
  // A later write does not affect the next transaction: the watch was cleared.
  db.exec(['SET', 'k', '9']);
  c.call('MULTI');
  c.call('INCR', 'k');
  assert.deepEqual(c.call('EXEC'), [10]);
});

test('negative: nested MULTI and WATCH inside MULTI are errors', () => {
  const c = new Connection(new VersionedRedis());
  c.call('MULTI');
  assert.throws(() => c.call('MULTI'), /nested/);
  assert.throws(() => c.call('WATCH', 'x'), /inside MULTI/);
});

test("compare-and-delete releases only the owner's lock", () => {
  const db = new MiniRedis();
  const src = loadScript('compare_and_delete.lua');
  db.exec(['SET', 'lock', 'token-A']);
  assert.equal(evalScript(db, src, ['lock'], ['token-B']), 0);
  assert.equal(db.exec(['GET', 'lock']), 'token-A');
  assert.equal(evalScript(db, src, ['lock'], ['token-A']), 1);
  assert.equal(db.exec(['GET', 'lock']), null);
  assert.equal(evalScript(db, src, ['lock'], ['token-A']), 0); // missing: GET -> false ~= token
});

test('transfer script validates before writing; error_reply surfaces as an error', () => {
  const db = new MiniRedis();
  const src = loadScript('transfer.lua');
  db.exec(['SET', 'acct:a', '100']);
  assert.deepEqual(evalScript(db, src, ['acct:a', 'acct:b'], [30]), [70, 30]);
  assert.throws(() => evalScript(db, src, ['acct:a', 'acct:b'], [1000]), /insufficient funds/);
  assert.throws(() => evalScript(db, src, ['acct:a', 'acct:b'], [-5]), /positive/);
  assert.equal(db.exec(['GET', 'acct:a']), '70'); // failed calls changed nothing
});

test('negative: a script that writes and then fails keeps its first write (no rollback)', () => {
  const db = new MiniRedis();
  db.exec(['SET', 'text', 'hello']);
  assert.throws(
    () => evalScript(db, loadScript('partial_write.lua'), ['counter', 'text'], []),
    /not an integer/,
  );
  assert.equal(db.exec(['GET', 'counter']), '1');
});

test('token bucket: burst up to capacity, then refill at the configured rate', () => {
  const db = new MiniRedis();
  const src = loadScript('token_bucket.lua');
  const take = (now: number) => evalScript(db, src, ['tb:user1'], [5, 1, now, 1]) as number[];
  const burst = [0, 0, 0, 0, 0, 0].map(() => take(0)[0]);
  assert.deepEqual(burst, [1, 1, 1, 1, 1, 0]); // capacity 5
  assert.deepEqual(take(0), [0, 0, 1000]); // retry after 1 s at 1 token/s
  assert.equal(take(1000)[0], 1); // one token refilled
  assert.equal(take(1000)[0], 0);
  assert.equal(take(60_000)[1], 4); // refill caps at capacity (5), minus this request
});

test('negative: a clock that moves backwards does not mint tokens', () => {
  const db = new MiniRedis();
  const src = loadScript('token_bucket.lua');
  for (let i = 0; i < 5; i++) evalScript(db, src, ['tb'], [5, 1, 10_000, 1]);
  assert.equal((evalScript(db, src, ['tb'], [5, 1, 5_000, 1]) as number[])[0], 0);
});

test('Lua -> Redis conversions: false is nil, true is 1, numbers truncate, tables stop at nil', () => {
  const db = new MiniRedis();
  assert.equal(evalScript(db, 'return false', [], []), null);
  assert.equal(evalScript(db, 'return true', [], []), 1);
  assert.equal(evalScript(db, 'return 3.99', [], []), 3);
  assert.deepEqual(evalScript(db, 'return {1, 2, nil, 4}', [], []), [1, 2]);
  assert.deepEqual(evalScript(db, "return redis.status_reply('PONG')", [], []), { ok: 'PONG' });
});

test('redis.call raises on error replies; redis.pcall returns them as a table', () => {
  const db = new MiniRedis();
  db.exec(['SET', 's', 'x']);
  assert.throws(
    () => evalScript(db, "return redis.call('INCR', KEYS[1])", ['s'], []),
    CommandError,
  );
  const r = evalScript(
    db,
    "local r = redis.pcall('INCR', KEYS[1]); return r.err ~= nil and 'caught' or 'no'",
    ['s'],
    [],
  );
  assert.equal(r, 'caught');
});
