// A minimal reader for the SQLite database file format (Module 04).
// Reference: https://www.sqlite.org/fileformat2.html
// It decodes the 100-byte header, B-tree page headers, table-leaf cells and records.
// It is deliberately small: enough to prove the format against files written by SQLite.

export interface DbHeader {
  magic: string;
  pageSize: number; // offset 16; the value 1 means 65536
  writeVersion: number; // offset 18: 1 = rollback journal, 2 = WAL
  readVersion: number; // offset 19
  reservedBytes: number; // offset 20
  changeCounter: number; // offset 24
  pageCount: number; // offset 28 ("in-header database size")
  firstFreelistTrunk: number; // offset 32
  freelistCount: number; // offset 36
  schemaCookie: number; // offset 40
  schemaFormat: number; // offset 44
  textEncoding: number; // offset 56: 1 UTF-8, 2 UTF-16le, 3 UTF-16be
  userVersion: number; // offset 60
  incrementalVacuum: number; // offset 64
  applicationId: number; // offset 68
  versionValidFor: number; // offset 92
  sqliteVersionNumber: number; // offset 96
}

export function parseHeader(file: Uint8Array): DbHeader {
  const v = new DataView(file.buffer, file.byteOffset, 100);
  const rawPageSize = v.getUint16(16);
  return {
    magic: new TextDecoder('latin1').decode(file.subarray(0, 16)),
    pageSize: rawPageSize === 1 ? 65536 : rawPageSize,
    writeVersion: v.getUint8(18),
    readVersion: v.getUint8(19),
    reservedBytes: v.getUint8(20),
    changeCounter: v.getUint32(24),
    pageCount: v.getUint32(28),
    firstFreelistTrunk: v.getUint32(32),
    freelistCount: v.getUint32(36),
    schemaCookie: v.getUint32(40),
    schemaFormat: v.getUint32(44),
    textEncoding: v.getUint32(56),
    userVersion: v.getUint32(60),
    incrementalVacuum: v.getUint32(64),
    applicationId: v.getUint32(68),
    versionValidFor: v.getUint32(92),
    sqliteVersionNumber: v.getUint32(96),
  };
}

/**
 * Decode a SQLite varint: 1..9 bytes, big-endian, 7 bits per byte with a continuation
 * high bit, except that a 9th byte contributes all 8 bits.
 * Invariant after i bytes (i < 9): value holds the 7*i payload bits read so far.
 */
export function decodeVarint(buf: Uint8Array, offset: number): { value: bigint; length: number } {
  let value = 0n;
  for (let i = 0; i < 8; i++) {
    const byte = buf[offset + i];
    if (byte === undefined) throw new RangeError('truncated varint');
    value = (value << 7n) | BigInt(byte & 0x7f);
    if ((byte & 0x80) === 0) return { value, length: i + 1 };
  }
  const last = buf[offset + 8];
  if (last === undefined) throw new RangeError('truncated varint');
  value = (value << 8n) | BigInt(last);
  return { value: BigInt.asIntN(64, value), length: 9 };
}

/** Encode a non-negative or negative 64-bit integer as a SQLite varint. */
export function encodeVarint(n: bigint): Uint8Array {
  let v = BigInt.asUintN(64, n);
  if (v > 0x00ffffffffffffffn) {
    // 9-byte form: 8 bytes of 7 bits, then one byte of 8 bits.
    const out = new Uint8Array(9);
    out[8] = Number(v & 0xffn);
    v >>= 8n;
    for (let i = 7; i >= 0; i--) {
      out[i] = Number(v & 0x7fn) | 0x80;
      v >>= 7n;
    }
    return out;
  }
  const bytes: number[] = [];
  do {
    bytes.unshift(Number(v & 0x7fn));
    v >>= 7n;
  } while (v > 0n);
  for (let i = 0; i < bytes.length - 1; i++) bytes[i]! |= 0x80;
  return Uint8Array.from(bytes);
}

export const PAGE_TYPES = {
  0x02: 'interior index',
  0x05: 'interior table',
  0x0a: 'leaf index',
  0x0d: 'leaf table',
} as const;

export interface BtreePage {
  type: number;
  firstFreeblock: number;
  cellCount: number;
  cellContentStart: number;
  fragmentedBytes: number;
  rightMostPointer?: number;
  cellPointers: number[];
}

/** Parse the B-tree page header of page `pgno` (1-based). Page 1 starts after the 100-byte file header. */
export function parseBtreePage(file: Uint8Array, pageSize: number, pgno: number): BtreePage {
  const base = (pgno - 1) * pageSize;
  const hdr = pgno === 1 ? base + 100 : base;
  const v = new DataView(file.buffer, file.byteOffset);
  const type = v.getUint8(hdr);
  if (!(type in PAGE_TYPES)) throw new Error(`page ${pgno} is not a b-tree page (type ${type})`);
  const interior = type === 0x02 || type === 0x05;
  const cellCount = v.getUint16(hdr + 3);
  const headerSize = interior ? 12 : 8;
  const cellPointers: number[] = [];
  for (let i = 0; i < cellCount; i++)
    cellPointers.push(base + v.getUint16(hdr + headerSize + 2 * i));
  const raw = v.getUint16(hdr + 5);
  return {
    type,
    firstFreeblock: v.getUint16(hdr + 1),
    cellCount,
    cellContentStart: raw === 0 ? 65536 : raw,
    fragmentedBytes: v.getUint8(hdr + 7),
    ...(interior ? { rightMostPointer: v.getUint32(hdr + 8) } : {}),
    cellPointers,
  };
}

/** How many payload bytes a table-leaf cell keeps on its own page (fileformat2 § 1.6). */
export function localPayloadSize(payload: number, usable: number): number {
  const X = usable - 35;
  if (payload <= X) return payload;
  const M = Math.floor(((usable - 12) * 32) / 255) - 23;
  const K = M + ((payload - M) % (usable - 4));
  return K <= X ? K : M;
}

export type SqlValue = null | bigint | number | string | Uint8Array;

/** Size in bytes of the value for a serial type. */
export function serialTypeSize(t: number): number {
  if (t >= 12) return t % 2 === 0 ? (t - 12) / 2 : (t - 13) / 2;
  return [0, 1, 2, 3, 4, 6, 8, 8, 0, 0][t] ?? 0;
}

/** Decode a record: header-size varint, serial-type varints, then the values. */
export function parseRecord(
  buf: Uint8Array,
  offset: number,
): { serialTypes: number[]; values: SqlValue[] } {
  const { value: hdrSize, length } = decodeVarint(buf, offset);
  const serialTypes: number[] = [];
  let p = offset + length;
  while (p < offset + Number(hdrSize)) {
    const st = decodeVarint(buf, p);
    serialTypes.push(Number(st.value));
    p += st.length;
  }
  const v = new DataView(buf.buffer, buf.byteOffset);
  const values: SqlValue[] = [];
  for (const t of serialTypes) {
    const size = serialTypeSize(t);
    if (t === 0) values.push(null);
    else if (t >= 1 && t <= 6) {
      let n = 0n;
      for (let i = 0; i < size; i++) n = (n << 8n) | BigInt(buf[p + i]!);
      values.push(BigInt.asIntN(size * 8, n));
    } else if (t === 7) values.push(v.getFloat64(p));
    else if (t === 8) values.push(0n);
    else if (t === 9) values.push(1n);
    else if (t >= 12 && t % 2 === 0) values.push(buf.slice(p, p + size));
    else if (t >= 13) values.push(new TextDecoder().decode(buf.subarray(p, p + size)));
    p += size;
  }
  return { serialTypes, values };
}

/** Decode one table-leaf cell: payload length, rowid, and (if it fits locally) the record. */
export function parseTableLeafCell(file: Uint8Array, cellOffset: number, usable: number) {
  const len = decodeVarint(file, cellOffset);
  const rowid = decodeVarint(file, cellOffset + len.length);
  const payloadStart = cellOffset + len.length + rowid.length;
  const payloadSize = Number(len.value);
  const local = localPayloadSize(payloadSize, usable);
  const overflowPage =
    local < payloadSize
      ? new DataView(file.buffer, file.byteOffset).getUint32(payloadStart + local)
      : undefined;
  return { payloadSize, rowid: rowid.value, payloadStart, local, overflowPage };
}
