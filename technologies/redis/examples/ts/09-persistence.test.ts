// Module 09: AOF replay semantics, multi-part AOF manifests, data-loss windows, COW cost.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadAof,
  aofOf,
  parseManifest,
  loadOrder,
  worstCaseLossSeconds,
  expectedCowBytes,
} from './src/persistence.ts';
import { RespProtocolError } from './src/resp.ts';

const GB = 2 ** 30;

test('an AOF is just RESP commands; replay reproduces the writes in order', () => {
  const aof = aofOf(
    ['SELECT', '0'],
    ['SET', 'a', '1'],
    ['INCR', 'a'],
    ['PEXPIREAT', 'a', '1893456000000'],
  );
  const r = loadAof(aof);
  assert.deepEqual(
    r.commands.map((c) => c[0]),
    ['SELECT', 'SET', 'INCR', 'PEXPIREAT'],
  );
  assert.equal(r.truncatedBytes, 0);
});

test('TTLs are logged as absolute PEXPIREAT, so a restart does not extend them', () => {
  const r = loadAof(aofOf(['SET', 's', 'x'], ['PEXPIREAT', 's', '1700000000000']));
  assert.equal(r.commands[1]![0], 'PEXPIREAT');
});

test('a truncated last command (crash mid-write) is dropped when aof-load-truncated is yes', () => {
  const full = aofOf(['SET', 'a', '1'], ['SET', 'b', '2']);
  const torn = full.subarray(0, full.length - 5);
  const r = loadAof(torn);
  assert.deepEqual(r.commands, [['SET', 'a', '1']]);
  assert.ok(r.truncatedBytes > 0);
});

test('negative: with aof-load-truncated no, a torn tail stops the server from starting', () => {
  const full = aofOf(['SET', 'a', '1'], ['SET', 'b', '2']);
  assert.throws(
    () => loadAof(full.subarray(0, full.length - 5), { loadTruncated: false }),
    /truncated/,
  );
});

test('a MULTI block without EXEC at the end of the file is not applied (all or nothing on load)', () => {
  const r = loadAof(
    aofOf(['SET', 'a', '1'], ['MULTI'], ['DECRBY', 'acct:a', '30'], ['INCRBY', 'acct:b', '30']),
  );
  assert.deepEqual(r.commands, [['SET', 'a', '1']]);
  const ok = loadAof(
    aofOf(['MULTI'], ['DECRBY', 'acct:a', '30'], ['INCRBY', 'acct:b', '30'], ['EXEC']),
  );
  assert.equal(ok.commands.length, 2);
});

test('negative: corruption in the middle of the AOF is a hard error (redis-check-aof territory)', () => {
  const bad = Buffer.concat([
    aofOf(['SET', 'a', '1']),
    Buffer.from('#garbage\r\n'),
    aofOf(['SET', 'b', '2']),
  ]);
  assert.throws(() => loadAof(bad), RespProtocolError);
});

test('multi-part AOF manifest: one base, incrementals in sequence, history ignored', () => {
  const m = parseManifest(
    [
      'file appendonly.aof.1.base.rdb seq 1 type b',
      'file appendonly.aof.1.incr.aof seq 1 type h',
      'file appendonly.aof.2.incr.aof seq 2 type i',
      'file appendonly.aof.3.incr.aof seq 3 type i',
    ].join('\n'),
  );
  assert.deepEqual(loadOrder(m), [
    'appendonly.aof.1.base.rdb',
    'appendonly.aof.2.incr.aof',
    'appendonly.aof.3.incr.aof',
  ]);
});

test('negative: a manifest without a base file, or with a malformed line, is rejected', () => {
  assert.throws(() => loadOrder(parseManifest('file x.incr.aof seq 1 type i')), /exactly one base/);
  assert.throws(() => parseManifest('file x seq one type b'), /Invalid AOF manifest/);
});

test('data-loss windows: always 0, everysec ~1-2 s, RDB = time since last save', () => {
  assert.equal(worstCaseLossSeconds({ kind: 'aof', fsync: 'always' }), 0);
  assert.equal(worstCaseLossSeconds({ kind: 'aof', fsync: 'everysec' }), 2);
  assert.equal(worstCaseLossSeconds({ kind: 'aof', fsync: 'no' }), 30);
  assert.equal(worstCaseLossSeconds({ kind: 'rdb', saveIntervalSec: 300 }), 300);
  assert.equal(worstCaseLossSeconds({ kind: 'none' }), Infinity);
});

test('copy-on-write: with 2 MB huge pages the same writes copy ~100x more memory than with 4 KB pages', () => {
  const dataset = 20 * GB;
  const writes = 50_000; // writes landing during a BGSAVE
  const small = expectedCowBytes(dataset, writes, 4096);
  const huge = expectedCowBytes(dataset, writes, 2 * 2 ** 20);
  assert.ok(small < 210 * 2 ** 20, `4 KB pages: ${(small / 2 ** 20).toFixed(0)} MB`);
  assert.ok(huge > 10 * GB, `2 MB pages: ${(huge / GB).toFixed(1)} GB`);
  // With enough writes every page is copied: the worst case is a full second copy.
  assert.ok(expectedCowBytes(dataset, 1e9, 4096) > 0.99 * dataset);
});
