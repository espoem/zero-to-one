import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

/**
 * Encodes a JavaScript BigInt or number into a QUIC Variable-Length Integer (RFC 9000 §16)
 */
export function encodeQuicVarInt(value: bigint | number): Buffer {
  const val = typeof value === 'number' ? BigInt(value) : value;

  if (val < 0n) throw new Error('QUIC VarInt must be non-negative');

  if (val <= 63n) {
    // 1-byte encoding: prefix 00 (0x00)
    return Buffer.from([Number(val)]);
  }
  if (val <= 16383n) {
    // 2-byte encoding: prefix 01 (0x40)
    const buf = Buffer.alloc(2);
    buf.writeUInt16BE(Number(val) | 0x4000, 0);
    return buf;
  }
  if (val <= 1073741823n) {
    // 4-byte encoding: prefix 10 (0x80)
    const buf = Buffer.alloc(4);
    buf.writeUInt32BE(Number((val | 0x80000000n) & 0xffffffffn), 0);
    return buf;
  }
  if (val <= 4611686018427387903n) {
    // 8-byte encoding: prefix 11 (0xc0)
    const buf = Buffer.alloc(8);
    const prefix = 0xc0n << 56n;
    buf.writeBigUInt64BE(val | prefix, 0);
    return buf;
  }

  throw new Error(`Value exceeds maximum QUIC VarInt (2^62 - 1): ${val}`);
}

/**
 * Decodes a QUIC Variable-Length Integer from a buffer at a given offset
 */
export function decodeQuicVarInt(buf: Buffer, offset: number): { value: bigint; bytesRead: number } {
  if (offset >= buf.length) throw new Error('Buffer exhausted before reading QUIC VarInt');
  const firstByte = buf[offset]!;
  const prefix = (firstByte >> 6) & 0x03;

  switch (prefix) {
    case 0: { // 1 byte
      return { value: BigInt(firstByte & 0x3f), bytesRead: 1 };
    }
    case 1: { // 2 bytes
      if (buf.length - offset < 2) throw new Error('Buffer truncated for 2-byte QUIC VarInt');
      const val = buf.readUInt16BE(offset) & 0x3fff;
      return { value: BigInt(val), bytesRead: 2 };
    }
    case 2: { // 4 bytes
      if (buf.length - offset < 4) throw new Error('Buffer truncated for 4-byte QUIC VarInt');
      const val = buf.readUInt32BE(offset) & 0x3fffffff;
      return { value: BigInt(val), bytesRead: 4 };
    }
    case 3: { // 8 bytes
      if (buf.length - offset < 8) throw new Error('Buffer truncated for 8-byte QUIC VarInt');
      const mask = (1n << 62n) - 1n;
      const val = buf.readBigUInt64BE(offset) & mask;
      return { value: val, bytesRead: 8 };
    }
    default:
      throw new Error('Unreachable prefix state');
  }
}

describe('Module 11: QUIC Transport Variable-Length Integers (RFC 9000)', () => {
  it('correctly encodes boundary values across all 4 prefix tiers', () => {
    // Tier 1: 1 byte (0 to 63)
    const b1 = encodeQuicVarInt(25);
    assert.equal(b1.length, 1);
    assert.equal(decodeQuicVarInt(b1, 0).value, 25n);

    // Tier 2: 2 bytes (64 to 16,383)
    const b2 = encodeQuicVarInt(494);
    assert.equal(b2.length, 2);
    assert.equal(decodeQuicVarInt(b2, 0).value, 494n);

    // Tier 3: 4 bytes (16,384 to 1,073,741,823)
    const b3 = encodeQuicVarInt(15293);
    assert.equal(b3.length, 2); // 15293 fits in 2 bytes
    const b4 = encodeQuicVarInt(200_000);
    assert.equal(b4.length, 4);
    assert.equal(decodeQuicVarInt(b4, 0).value, 200_000n);

    // Tier 4: 8 bytes
    const b5 = encodeQuicVarInt(5_000_000_000n);
    assert.equal(b5.length, 8);
    assert.equal(decodeQuicVarInt(b5, 0).value, 5_000_000_000n);
  });

  it('property test: lossless round-trip encoding/decoding for arbitrary integers', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: 1_000_000_000_000n }),
        (val) => {
          const encoded = encodeQuicVarInt(val);
          const { value: decoded, bytesRead } = decodeQuicVarInt(encoded, 0);
          assert.equal(decoded, val);
          assert.equal(bytesRead, encoded.length);
        }
      )
    );
  });
});
