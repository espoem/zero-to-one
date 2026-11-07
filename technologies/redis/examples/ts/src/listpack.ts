// Byte-level models of Redis's listpack (src/listpack.c, spec: listpack.md in redis/redis) and
// intset (src/intset.c), plus the RDB DUMP envelope that carries them verbatim.
// The integration tests compare these encoders with the bytes of a real `DUMP` reply.
import { isCanonicalInt64 } from './encoding.ts';

export type LpValue = string | bigint;

/** Number of bytes needed for a listpack back-length field (src/listpack.c `lpEncodeBacklenBytes`). */
export function backlenBytes(l: number): number {
  if (l <= 127) return 1;
  if (l < 16383) return 2;
  if (l < 2097151) return 3;
  if (l < 268435455) return 4;
  return 5;
}

/** Back-length is stored base-128, most significant group first, continuation bit on all but the first byte. */
export function encodeBacklen(l: number): Buffer {
  const n = backlenBytes(l);
  const out = Buffer.alloc(n);
  if (n === 1) {
    out[0] = l;
    return out;
  }
  // buf[0] = l >> (7 * (n - 1)); the others carry (bits & 127) | 128.
  out[0] = Math.floor(l / 2 ** (7 * (n - 1)));
  for (let i = 1; i < n; i++) out[i] = (Math.floor(l / 2 ** (7 * (n - 1 - i))) & 127) | 128;
  return out;
}

/** Decode a back-length that ENDS at `end` (exclusive), walking backwards. Returns [value, bytes]. */
export function decodeBacklenBackwards(buf: Buffer, end: number): [number, number] {
  let val = 0;
  let shift = 0;
  let p = end - 1;
  for (let i = 0; i < 5; i++) {
    const b = buf[p]!;
    val += (b & 127) * 2 ** shift;
    if (!(b & 128)) {
      // the first byte (the one without the continuation bit) is the most significant group
      return [val, i + 1];
    }
    shift += 7;
    p--;
  }
  throw new Error('invalid backlen');
}

function intRange(v: bigint): 'u7' | 'i13' | 'i16' | 'i24' | 'i32' | 'i64' {
  if (v >= 0n && v <= 127n) return 'u7';
  if (v >= -4096n && v <= 4095n) return 'i13';
  if (v >= -32768n && v <= 32767n) return 'i16';
  if (v >= -8388608n && v <= 8388607n) return 'i24';
  if (v >= -2147483648n && v <= 2147483647n) return 'i32';
  return 'i64';
}

/** Encode the encoding+data part of one entry (without the back-length). */
export function encodeEntryBody(value: LpValue): Buffer {
  let v: bigint | undefined;
  if (typeof value === 'bigint') v = value;
  else if (isCanonicalInt64(value)) v = BigInt(value);
  if (v !== undefined) {
    switch (intRange(v)) {
      case 'u7':
        return Buffer.from([Number(v)]);
      case 'i13': {
        const u = Number(v < 0n ? v + 8192n : v);
        return Buffer.from([0xc0 | (u >> 8), u & 0xff]);
      }
      case 'i16': {
        const b = Buffer.alloc(3);
        b[0] = 0xf1;
        b.writeInt16LE(Number(v), 1);
        return b;
      }
      case 'i24': {
        const b = Buffer.alloc(4);
        b[0] = 0xf2;
        b.writeIntLE(Number(v), 1, 3);
        return b;
      }
      case 'i32': {
        const b = Buffer.alloc(5);
        b[0] = 0xf3;
        b.writeInt32LE(Number(v), 1);
        return b;
      }
      case 'i64': {
        const b = Buffer.alloc(9);
        b[0] = 0xf4;
        b.writeBigInt64LE(v, 1);
        return b;
      }
    }
  }
  const data = Buffer.from(value as string, 'utf8');
  if (data.length < 64) return Buffer.concat([Buffer.from([0x80 | data.length]), data]);
  if (data.length < 4096) {
    return Buffer.concat([Buffer.from([0xe0 | (data.length >> 8), data.length & 0xff]), data]);
  }
  const h = Buffer.alloc(5);
  h[0] = 0xf0;
  h.writeUInt32LE(data.length, 1);
  return Buffer.concat([h, data]);
}

export function encodeListpack(values: LpValue[]): Buffer {
  const entries = values.map((v) => {
    const body = encodeEntryBody(v);
    return Buffer.concat([body, encodeBacklen(body.length)]);
  });
  const total = 6 + entries.reduce((n, e) => n + e.length, 0) + 1;
  const head = Buffer.alloc(6);
  head.writeUInt32LE(total, 0);
  head.writeUInt16LE(Math.min(values.length, 0xffff), 4);
  return Buffer.concat([head, ...entries, Buffer.from([0xff])]);
}

function decodeBody(buf: Buffer, p: number): { value: LpValue; len: number } {
  const b = buf[p]!;
  if ((b & 0x80) === 0) return { value: BigInt(b), len: 1 };
  if ((b & 0xc0) === 0x80) {
    const n = b & 0x3f;
    return { value: buf.toString('utf8', p + 1, p + 1 + n), len: 1 + n };
  }
  if ((b & 0xe0) === 0xc0) {
    let u = ((b & 0x1f) << 8) | buf[p + 1]!;
    if (u >= 4096) u -= 8192;
    return { value: BigInt(u), len: 2 };
  }
  if ((b & 0xf0) === 0xe0) {
    const n = ((b & 0x0f) << 8) | buf[p + 1]!;
    return { value: buf.toString('utf8', p + 2, p + 2 + n), len: 2 + n };
  }
  switch (b) {
    case 0xf1:
      return { value: BigInt(buf.readInt16LE(p + 1)), len: 3 };
    case 0xf2:
      return { value: BigInt(buf.readIntLE(p + 1, 3)), len: 4 };
    case 0xf3:
      return { value: BigInt(buf.readInt32LE(p + 1)), len: 5 };
    case 0xf4:
      return { value: buf.readBigInt64LE(p + 1), len: 9 };
    case 0xf0: {
      const n = buf.readUInt32LE(p + 1);
      return { value: buf.toString('utf8', p + 5, p + 5 + n), len: 5 + n };
    }
  }
  throw new Error(`invalid listpack encoding byte 0x${b.toString(16)}`);
}

/** Forward iteration: a decoded integer comes back as bigint, a string as string. */
export function decodeListpack(buf: Buffer): LpValue[] {
  if (buf.readUInt32LE(0) !== buf.length) throw new Error('total-bytes mismatch');
  const out: LpValue[] = [];
  let p = 6;
  while (buf[p] !== 0xff) {
    const { value, len } = decodeBody(buf, p);
    out.push(value);
    p += len + backlenBytes(len);
  }
  if (p + 1 !== buf.length) throw new Error('missing EOF');
  return out;
}

/** Backward iteration using only the back-length fields: the reason the format exists. */
export function decodeListpackReverse(buf: Buffer): LpValue[] {
  const out: LpValue[] = [];
  let end = buf.length - 1; // exclusive end of the last entry's backlen
  while (end > 6) {
    const [bodyLen, bl] = decodeBacklenBackwards(buf, end);
    const start = end - bl - bodyLen;
    out.push(decodeBody(buf, start).value);
    end = start;
  }
  return out;
}

/** RDB length encoding: 2-bit tag, then 6 / 14 / 32 bits. Returns [length, bytesRead, isSpecial]. */
function readRdbLength(b: Buffer, p: number): [number, number, boolean] {
  const first = b[p]!;
  switch (first >> 6) {
    case 0:
      return [first & 0x3f, 1, false];
    case 1:
      return [((first & 0x3f) << 8) | b[p + 1]!, 2, false];
    case 2:
      return [b.readUInt32BE(p + 1), 5, false];
    default:
      return [first & 0x3f, 1, true];
  }
}

/** Decompress LZF as used by RDB (src/lzf_d.c): literal runs and back-references. */
export function lzfDecompress(input: Buffer, outLen: number): Buffer {
  const out = Buffer.alloc(outLen);
  let i = 0;
  let o = 0;
  while (i < input.length) {
    const ctrl = input[i++]!;
    if (ctrl < 32) {
      input.copy(out, o, i, i + ctrl + 1);
      i += ctrl + 1;
      o += ctrl + 1;
    } else {
      let len = ctrl >> 5;
      if (len === 7) len += input[i++]!;
      let ref = o - ((ctrl & 0x1f) << 8) - 1 - input[i++]!;
      for (let n = 0; n < len + 2; n++) out[o++] = out[ref++]!;
    }
  }
  if (o !== outLen) throw new Error('LZF length mismatch');
  return out;
}

/**
 * `DUMP` payload = `RDB_TYPE_*` byte, one RDB string, 2 bytes RDB version, 8 bytes CRC64.
 * The string is plain (length-prefixed) or LZF-compressed (`0xC3 clen ulen data`) when it is longer
 * than 20 bytes and compression pays off; both forms are returned decoded.
 */
export function parseDump(dump: Buffer): { type: number; blob: Buffer; rdbVersion: number } {
  const type = dump[0]!;
  const [len, n, special] = readRdbLength(dump, 1);
  let blob: Buffer;
  let end: number;
  if (!special) {
    blob = dump.subarray(1 + n, 1 + n + len);
    end = 1 + n + len;
  } else if (len === 3) {
    const [clen, n1] = readRdbLength(dump, 1 + n);
    const [ulen, n2] = readRdbLength(dump, 1 + n + n1);
    const start = 1 + n + n1 + n2;
    blob = lzfDecompress(dump.subarray(start, start + clen), ulen);
    end = start + clen;
  } else {
    throw new Error('integer-encoded RDB string is not a blob');
  }
  return { type, blob, rdbVersion: dump.readUInt16LE(end) };
}

/** intset: u32 encoding width (2|4|8), u32 length, then sorted little-endian integers of that width. */
export function encodeIntset(members: bigint[]): Buffer {
  const sorted = [...new Set(members)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const width = sorted.every((v) => v >= -32768n && v <= 32767n)
    ? 2
    : sorted.every((v) => v >= -2147483648n && v <= 2147483647n)
      ? 4
      : 8;
  const out = Buffer.alloc(8 + width * sorted.length);
  out.writeUInt32LE(width, 0);
  out.writeUInt32LE(sorted.length, 4);
  sorted.forEach((v, i) => {
    const o = 8 + i * width;
    if (width === 2) out.writeInt16LE(Number(v), o);
    else if (width === 4) out.writeInt32LE(Number(v), o);
    else out.writeBigInt64LE(v, o);
  });
  return out;
}

/** Binary search as SISMEMBER performs it on an intset; returns the number of probes. */
export function intsetSearch(
  sortedValues: bigint[],
  target: bigint,
): { found: boolean; probes: number } {
  let lo = 0;
  let hi = sortedValues.length - 1;
  let probes = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    probes++;
    const v = sortedValues[mid]!;
    if (v === target) return { found: true, probes };
    if (v < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return { found: false, probes };
}

// ---- BITFIELD semantics -------------------------------------------------------------------

export type Overflow = 'WRAP' | 'SAT' | 'FAIL';

/** Interpret `bits` (1..64 signed, 1..63 unsigned) of a value held as an unsigned bit pattern. */
function wrap(v: bigint, bits: number, signed: boolean): bigint {
  const mod = 1n << BigInt(bits);
  let r = ((v % mod) + mod) % mod;
  if (signed && r >= mod >> 1n) r -= mod;
  return r;
}

export function bitfieldIncrBy(
  current: bigint,
  incr: bigint,
  bits: number,
  signed: boolean,
  overflow: Overflow,
): bigint | null {
  const min = signed ? -(1n << BigInt(bits - 1)) : 0n;
  const max = signed ? (1n << BigInt(bits - 1)) - 1n : (1n << BigInt(bits)) - 1n;
  const raw = current + incr;
  if (raw >= min && raw <= max) return raw;
  if (overflow === 'WRAP') return wrap(raw, bits, signed);
  if (overflow === 'SAT') return raw > max ? max : min;
  return null; // FAIL: the sub-command replies nil and leaves the field unchanged
}
