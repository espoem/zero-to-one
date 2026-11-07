// Module 02 (hermetic): byte-level listpack and intset layouts, and BITFIELD overflow semantics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  backlenBytes,
  bitfieldIncrBy,
  decodeListpack,
  decodeListpackReverse,
  encodeBacklen,
  encodeEntryBody,
  encodeIntset,
  encodeListpack,
  intsetSearch,
} from './src/listpack.ts';

test('listpack: the worked example from the module is byte-exact', () => {
  // ["a", 5, 300] -> header(6) + [0x81 'a' 02] [05 01] [0xC1 0x2C 02] + EOF
  const lp = encodeListpack(['a', '5', '300']);
  assert.equal(lp.toString('hex'), '0f0000000300' + '816102' + '0501' + 'c12c02' + 'ff');
  assert.equal(lp.readUInt32LE(0), lp.length);
  assert.equal(lp.readUInt16LE(4), 3);
});

test('listpack: integer widths are chosen by value range, strings by byte length', () => {
  const widths = (v: string) => encodeEntryBody(v).length;
  assert.equal(widths('0'), 1);
  assert.equal(widths('127'), 1);
  assert.equal(widths('128'), 2); // 13-bit
  assert.equal(widths('-4096'), 2);
  assert.equal(widths('4096'), 3); // 16-bit
  assert.equal(widths('32768'), 4); // 24-bit
  assert.equal(widths('8388608'), 5); // 32-bit
  assert.equal(widths('2147483648'), 9); // 64-bit
  assert.equal(encodeEntryBody('x'.repeat(63)).length, 64); // 6-bit string header = 1 byte
  assert.equal(encodeEntryBody('x'.repeat(64)).length, 66); // 12-bit string header = 2 bytes
  assert.equal(encodeEntryBody('x'.repeat(4096)).length, 4101); // 32-bit string header = 5 bytes
});

test('listpack: non-canonical integers stay strings', () => {
  for (const s of ['007', '+5', '1.0', '-0', ' 1']) {
    assert.equal(encodeEntryBody(s)[0]! & 0xc0, 0x80, s); // 6-bit string
  }
});

test('listpack: back-length byte counts have the documented thresholds', () => {
  assert.deepEqual(
    [127, 128, 16382, 16383, 2097150, 2097151].map(backlenBytes),
    [1, 2, 2, 3, 3, 4],
  );
  assert.equal(encodeBacklen(300).toString('hex'), '02ac'); // 300 = 2*128 + 44 -> [0x02, 0x2C|0x80]
});

test('property: forward and reverse decoding agree and round-trip', () => {
  const value = fc.oneof(
    fc.bigInt({ min: -(2n ** 63n), max: 2n ** 63n - 1n }),
    fc.string({ maxLength: 200 }).filter((s) => !/^-?\d+$/.test(s)),
  );
  fc.assert(
    fc.property(fc.array(value, { maxLength: 40 }), (vals) => {
      const lp = encodeListpack(vals);
      const fwd = decodeListpack(lp);
      const norm = vals.map((v) => (typeof v === 'bigint' ? v : v));
      assert.deepEqual(fwd, norm);
      assert.deepEqual(decodeListpackReverse(lp), [...norm].reverse());
    }),
    { numRuns: 200 },
  );
});

test('property: an entry whose back-length grows does not change any other entry (no cascade)', () => {
  // The ziplist weakness: growing entry i changed the prevlen field of entry i+1.
  const base = ['a'.repeat(100), 'b', 'c'];
  const grown = ['a'.repeat(300), 'b', 'c'];
  const tail = (v: string[]) => encodeListpack(v).subarray(-7); // 'b' and 'c' entries + EOF
  assert.deepEqual(tail(base), tail(grown));
});

test('negative: a truncated or corrupted listpack is rejected', () => {
  const lp = encodeListpack(['hello', '1']);
  assert.throws(() => decodeListpack(lp.subarray(0, lp.length - 1)));
  const bad = Buffer.from(lp);
  bad[6] = 0xf5; // reserved encoding byte
  assert.throws(() => decodeListpack(bad));
});

test('intset: width is the smallest that fits every member, and the array is sorted', () => {
  const small = encodeIntset([3n, 1n, 2n]);
  assert.equal(small.readUInt32LE(0), 2);
  assert.equal(small.length, 8 + 3 * 2);
  const upgraded = encodeIntset([3n, 1n, 2n, 40000n]); // does not fit int16
  assert.equal(upgraded.readUInt32LE(0), 4);
  assert.equal(upgraded.length, 8 + 4 * 4);
  const wide = encodeIntset([1n, 2n ** 40n]);
  assert.equal(wide.readUInt32LE(0), 8);
  assert.equal(encodeIntset([5n, 5n, 5n]).readUInt32LE(4), 1); // set semantics
});

test('intset: membership is a binary search, at most floor(log2 n) + 1 probes', () => {
  const vals = Array.from({ length: 512 }, (_, i) => BigInt(i * 3));
  let worst = 0;
  for (let i = 0; i < 1536; i++) worst = Math.max(worst, intsetSearch(vals, BigInt(i)).probes);
  assert.ok(worst <= 10, `worst probes ${worst}`);
  assert.equal(intsetSearch(vals, 3n * 511n).found, true);
  assert.equal(intsetSearch(vals, 4n).found, false);
});

test('BITFIELD: WRAP, SAT and FAIL differ exactly at the boundary', () => {
  assert.equal(bitfieldIncrBy(250n, 10n, 8, false, 'WRAP'), 4n);
  assert.equal(bitfieldIncrBy(250n, 10n, 8, false, 'SAT'), 255n);
  assert.equal(bitfieldIncrBy(250n, 10n, 8, false, 'FAIL'), null);
  assert.equal(bitfieldIncrBy(127n, 1n, 8, true, 'WRAP'), -128n);
  assert.equal(bitfieldIncrBy(-128n, -1n, 8, true, 'SAT'), -128n);
  assert.equal(bitfieldIncrBy(5n, -6n, 4, false, 'SAT'), 0n);
  assert.equal(bitfieldIncrBy(5n, 1n, 8, false, 'FAIL'), 6n);
});

test('RDB LZF: a literal run and a back-reference decode as the reference implementation does', async () => {
  const { lzfDecompress } = await import('./src/listpack.ts');
  // literal "abc" (ctrl=2), then back-reference len 3+2=5 distance 3: ctrl = (3<<5)|0, offset byte 2
  const out = lzfDecompress(Buffer.from([0x02, 0x61, 0x62, 0x63, 0x60, 0x02]), 8);
  assert.equal(out.toString(), 'abcabcab');
  assert.throws(() => lzfDecompress(Buffer.from([0x02, 0x61, 0x62, 0x63]), 8), /mismatch/);
});
