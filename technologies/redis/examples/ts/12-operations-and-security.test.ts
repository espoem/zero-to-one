// Module 12: INFO parsing, production lint rules, and ACL reasoning.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInfo, parseNested, lint, setUser, check } from './src/ops.ts';

const GB = 2 ** 30;

test('INFO parsing: sections, key:value pairs and nested db lines', () => {
  const info = parseInfo(
    '# Server\r\nredis_version:8.10.3\r\n\r\n# Keyspace\r\ndb0:keys=10,expires=2,avg_ttl=0\r\n',
  );
  assert.equal(info.server!.redis_version, '8.10.3');
  assert.deepEqual(parseNested(info.keyspace!.db0!), { keys: '10', expires: '2', avg_ttl: '0' });
});

test('lint: an open server on all interfaces without password is critical', () => {
  const f = lint(
    {
      bind: '0.0.0.0',
      'protected-mode': 'no',
      __default_user_nopass: 'yes',
      maxmemory: String(4 * GB),
      'maxmemory-policy': 'allkeys-lru',
    },
    { thp: 'never', overcommitMemory: 1, ramBytes: 8 * GB },
    'cache',
  );
  assert.ok(f.some((x) => x.severity === 'critical' && /no password/.test(x.rule)));
});

test('lint: THP, overcommit and maxmemory headroom', () => {
  const f = lint(
    { bind: '127.0.0.1', maxmemory: String(7.5 * GB), 'maxmemory-policy': 'allkeys-lfu' },
    { thp: 'always', overcommitMemory: 0, ramBytes: 8 * GB },
    'cache',
  );
  const rules = f.map((x) => x.rule).join('\n');
  assert.match(rules, /transparent huge pages/);
  assert.match(rules, /overcommit/);
  assert.match(rules, /80%/);
});

test('negative: a durable store with allkeys-* eviction and no persistence is flagged twice', () => {
  const f = lint(
    {
      bind: '127.0.0.1',
      maxmemory: String(2 * GB),
      'maxmemory-policy': 'allkeys-lru',
      appendonly: 'no',
      save: '',
    },
    { thp: 'never', overcommitMemory: 1, ramBytes: 8 * GB },
    'store',
  );
  assert.equal(f.filter((x) => x.severity === 'critical').length, 2);
});

test('lint: a well-configured cache produces no findings', () => {
  const f = lint(
    {
      bind: '10.0.0.5',
      'protected-mode': 'yes',
      maxmemory: String(5 * GB),
      'maxmemory-policy': 'allkeys-lfu',
    },
    { thp: 'never', overcommitMemory: 1, ramBytes: 8 * GB },
    'cache',
  );
  assert.deepEqual(f, []);
});

test('ACL: least-privilege application user', () => {
  const app = setUser('on >s3cret ~app:* +@read +@write -@dangerous');
  assert.equal(check(app, 'GET', ['app:user:1']), 'OK');
  assert.equal(check(app, 'SET', ['app:user:1']), 'OK');
  assert.equal(check(app, 'GET', ['billing:1']), 'NOPERM-key');
  assert.equal(check(app, 'FLUSHALL', []), 'NOPERM-command'); // removed by -@dangerous
  assert.equal(check(app, 'KEYS', ['*']), 'NOPERM-command');
});

test('ACL: rules apply left to right; a later + re-allows what an earlier - removed', () => {
  assert.equal(check(setUser('on allkeys +@all -@dangerous +keys'), 'KEYS', ['x']), 'OK');
  assert.equal(check(setUser('on allkeys +keys -@dangerous'), 'KEYS', ['x']), 'NOPERM-command');
});

test('ACL: %R~ grants read-only access to a key pattern (7.0+ selectors)', () => {
  const u = setUser('on +@read +@write %R~config:* ~cache:*');
  assert.equal(check(u, 'GET', ['config:flags']), 'OK');
  assert.equal(check(u, 'SET', ['config:flags']), 'NOPERM-key');
  assert.equal(check(u, 'SET', ['cache:x']), 'OK');
});

test('negative: a disabled user cannot run anything, and bad modifiers are syntax errors', () => {
  assert.equal(check(setUser('off allkeys +@all'), 'GET', ['x']), 'disabled');
  assert.throws(() => setUser('on +@read banana'), /Syntax error/);
});
