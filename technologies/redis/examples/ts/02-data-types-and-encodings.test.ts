// Module 02: sorted-set internals (span-augmented skiplist) and encoding transitions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { SortedSet, mulberry32, zcmp } from './src/zset.ts';
import {
  HashModel,
  SetModel,
  ZSetModel,
  isCanonicalInt64,
  stringEncoding,
  expectedSkiplistSteps,
  DEFAULTS,
} from './src/encoding.ts';

/** Reference model: sort by (score, member bytes), the order Redis defines. */
function naive(entries: Map<string, number>): string[] {
  return [...entries].sort(([am, as], [bm, bs]) => zcmp(as, am, bs, bm)).map(([m]) => m);
}

test('ties on score are ordered by member bytes, not insertion order', () => {
  const z = new SortedSet(mulberry32(1));
  z.add('b', 1);
  z.add('a', 1);
  z.add('c', 0);
  assert.deepEqual(z.range(0, -1), ['c', 'a', 'b']);
  assert.equal(z.rank('a'), 1);
  // Byte order, not locale order: uppercase sorts before lowercase.
  z.add('B', 1);
  assert.deepEqual(z.range(0, -1), ['c', 'B', 'a', 'b']);
});

test('ZADD on an existing member updates the score and re-positions it', () => {
  const z = new SortedSet(mulberry32(2));
  z.add('alice', 10);
  z.add('bob', 20);
  assert.equal(z.add('alice', 30), false);
  assert.deepEqual(z.range(0, -1), ['bob', 'alice']);
  assert.equal(z.size, 2);
});

test('negative indexes in ZRANGE count from the end, like Redis', () => {
  const z = new SortedSet(mulberry32(3));
  for (let i = 0; i < 10; i++) z.add(`m${i}`, i);
  assert.deepEqual(z.range(-3, -1), ['m7', 'm8', 'm9']);
  assert.deepEqual(z.range(5, 100), ['m5', 'm6', 'm7', 'm8', 'm9']);
  assert.deepEqual(z.range(8, 2), []);
});

test('property: rank, byRank, range and rangeByScore agree with a sorted-array model', () => {
  fc.assert(
    fc.property(
      fc.array(
        fc.tuple(
          fc.constantFrom('add', 'add', 'add', 'rem'),
          fc.string({ maxLength: 3 }),
          fc.integer({ min: -5, max: 5 }),
        ),
        { maxLength: 120 },
      ),
      fc.integer(),
      (ops, seed) => {
        const z = new SortedSet(mulberry32(seed));
        const ref = new Map<string, number>();
        for (const [op, m, s] of ops) {
          if (op === 'add') {
            z.add(m, s);
            ref.set(m, s);
          } else {
            assert.equal(z.remove(m), ref.delete(m));
          }
        }
        const order = naive(ref);
        assert.deepEqual(z.range(0, -1), order);
        assert.deepEqual(z.reverse(), [...order].reverse());
        order.forEach((m, i) => {
          assert.equal(z.rank(m), i);
          assert.equal(z.byRank(i)?.member, m);
        });
        assert.deepEqual(
          z.rangeByScore(-1, 2),
          order.filter((m) => ref.get(m)! >= -1 && ref.get(m)! <= 2),
        );
        z.checkInvariants();
      },
    ),
    { numRuns: 300 },
  );
});

test('ZRANK is O(log N): counting rank via spans visits far fewer nodes than N', () => {
  const z = new SortedSet(mulberry32(42));
  const n = 100_000;
  for (let i = 0; i < n; i++) z.add(`u${i}`, i);
  assert.equal(z.rank('u99999'), 99_999);
  const hopsForLast = z.lastRankHops;
  assert.equal(z.byRank(54_321)?.member, 'u54321');
  // Measured: the search path for the last element is a few dozen hops, not 100 000.
  assert.ok(hopsForLast < 200, `took ${hopsForLast} hops`);
  // Expected path length ~ (1/p) log_{1/p} N = 4 * log_4(1e5) ≈ 33 comparisons, not 1e5.
  assert.ok(expectedSkiplistSteps(n) < 40);
});

test('negative: NaN scores are rejected (Redis: "resulting score is not a number")', () => {
  const z = new SortedSet();
  assert.throws(() => z.add('x', Number.NaN), /not a number/);
});

test('string encodings: int for canonical int64, embstr up to 44 bytes, raw beyond', () => {
  assert.equal(stringEncoding('12345'), 'int');
  assert.equal(stringEncoding('-9223372036854775808'), 'int');
  assert.equal(stringEncoding('9223372036854775808'), 'embstr'); // overflows int64
  assert.equal(stringEncoding('007'), 'embstr'); // not canonical
  assert.equal(stringEncoding('x'.repeat(44)), 'embstr');
  assert.equal(stringEncoding('x'.repeat(45)), 'raw');
  // Bytes, not characters: 15 three-byte characters = 45 bytes.
  assert.equal(stringEncoding('€'.repeat(15)), 'raw');
});

test('canonical integer check rejects the near-misses that trip people up', () => {
  for (const s of ['+1', ' 1', '1 ', '1.0', '-0', '0x10', '1e3', ''])
    assert.equal(isCanonicalInt64(s), false, s);
  for (const s of ['0', '-1', '42']) assert.equal(isCanonicalInt64(s), true, s);
});

test('hash: listpack until 512 fields or a 65-byte field/value, then hashtable for good', () => {
  const h = new HashModel();
  for (let i = 0; i < DEFAULTS.hashMaxListpackEntries; i++) h.hset(`f${i}`, 'v');
  assert.equal(h.encoding, 'listpack');
  h.hset('one-more', 'v');
  assert.equal(h.encoding, 'hashtable');
  // Deleting back below the threshold does not convert back.
  for (let i = 0; i < 400; i++) h.hdel(`f${i}`);
  assert.equal(h.encoding, 'hashtable');

  const h2 = new HashModel();
  h2.hset('f', 'x'.repeat(65));
  assert.equal(h2.encoding, 'hashtable');
});

test('set: intset -> listpack on the first non-integer (7.2+), -> hashtable past 128 members', () => {
  const s = new SetModel();
  for (let i = 0; i < 10; i++) s.sadd(String(i));
  assert.equal(s.encoding, 'intset');
  s.sadd('apple');
  assert.equal(s.encoding, 'listpack');
  for (let i = 0; i < 200; i++) s.sadd(`m${i}`);
  assert.equal(s.encoding, 'hashtable');

  const big = new SetModel();
  for (let i = 0; i < 513; i++) big.sadd(String(i));
  assert.equal(big.encoding, 'hashtable'); // 513 integers: past both intset and listpack limits
});

test('zset: listpack -> skiplist at 129 members or a 65-byte member', () => {
  const z = new ZSetModel();
  for (let i = 0; i < 128; i++) z.zadd(`m${i}`, i);
  assert.equal(z.encoding, 'listpack');
  z.zadd('m128', 128);
  assert.equal(z.encoding, 'skiplist');
  const z2 = new ZSetModel();
  z2.zadd('x'.repeat(65), 1);
  assert.equal(z2.encoding, 'skiplist');
});
