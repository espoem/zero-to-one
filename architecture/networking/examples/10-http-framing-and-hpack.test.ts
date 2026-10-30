import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

export interface HTTP2FrameHeader {
  length: number;    // 24 bits
  type: number;      // 8 bits (0=DATA, 1=HEADERS, etc.)
  flags: number;     // 8 bits
  streamId: number;  // 31 bits
}

export function encodeHTTP2FrameHeader(length: number, type: number, flags: number, streamId: number): Buffer {
  const buf = Buffer.alloc(9);
  // Length (24 bits)
  buf[0] = (length >> 16) & 0xff;
  buf[1] = (length >> 8) & 0xff;
  buf[2] = length & 0xff;
  // Type & Flags
  buf[3] = type & 0xff;
  buf[4] = flags & 0xff;
  // Stream ID (31 bits, highest bit reserved)
  buf.writeUInt32BE(streamId & 0x7fffffff, 5);
  return buf;
}

export function parseHTTP2FrameHeader(buf: Buffer): HTTP2FrameHeader {
  if (buf.length < 9) throw new Error('Buffer too small for HTTP/2 frame header');
  const length = (buf[0]! << 16) | (buf[1]! << 8) | buf[2]!;
  const type = buf[3]!;
  const flags = buf[4]!;
  const streamId = buf.readUInt32BE(5) & 0x7fffffff;
  return { length, type, flags, streamId };
}

/**
 * Standard RFC 7541 HPACK Static Table (first 10 common entries for demo)
 */
export const HPACK_STATIC_TABLE: ReadonlyArray<[string, string]> = [
  ['', ''], // 1-based index placeholder
  [':authority', ''],
  [':method', 'GET'],
  [':method', 'POST'],
  [':path', '/'],
  [':path', '/index.html'],
  [':scheme', 'http'],
  [':scheme', 'https'],
  [':status', '200'],
  [':status', '204'],
  [':status', '206'],
];

export class HpackDynamicTable {
  private table: Array<[string, string]> = [];
  private maxSizeBytes: number;
  private currentSizeBytes = 0;

  constructor(maxSizeBytes = 4096) {
    this.maxSizeBytes = maxSizeBytes;
  }

  insert(name: string, value: string): void {
    // RFC 7541 §4.1: size is name length + value length + 32 bytes overhead
    const entrySize = Buffer.byteLength(name) + Buffer.byteLength(value) + 32;

    while (this.currentSizeBytes + entrySize > this.maxSizeBytes && this.table.length > 0) {
      const evicted = this.table.pop(); // Evict from tail (FIFO)
      if (evicted) {
        this.currentSizeBytes -= Buffer.byteLength(evicted[0]) + Buffer.byteLength(evicted[1]) + 32;
      }
    }

    this.table.unshift([name, value]);
    this.currentSizeBytes += entrySize;
  }

  get(index: number): [string, string] | null {
    // Indices 1..61 are static table
    if (index >= 1 && index < HPACK_STATIC_TABLE.length) {
      return HPACK_STATIC_TABLE[index]!;
    }
    // Indices >= 62 are dynamic table
    const dynamicIndex = index - 62;
    if (dynamicIndex >= 0 && dynamicIndex < this.table.length) {
      return this.table[dynamicIndex]!;
    }
    return null;
  }

  size(): number {
    return this.table.length;
  }
}

export function parseChunkedBody(buf: Buffer): Buffer {
  let offset = 0;
  const chunks: Buffer[] = [];

  while (offset < buf.length) {
    // Find next CRLF for chunk size
    const crlfIndex = buf.indexOf('\r\n', offset);
    if (crlfIndex === -1) break;

    const sizeStr = buf.subarray(offset, crlfIndex).toString('ascii').trim();
    const chunkSize = Number.parseInt(sizeStr, 16);
    if (Number.isNaN(chunkSize)) throw new Error(`Invalid chunk size: ${sizeStr}`);

    offset = crlfIndex + 2;
    if (chunkSize === 0) {
      // Terminal chunk
      break;
    }

    const chunkData = buf.subarray(offset, offset + chunkSize);
    chunks.push(chunkData);
    offset += chunkSize + 2; // Data + trailing CRLF
  }

  return Buffer.concat(chunks);
}

describe('Module 10: HTTP/1.1 Chunked Framing & HTTP/2 Binary Frames / HPACK', () => {
  it('correctly parses an HTTP/1.1 Chunked Transfer Encoding payload', () => {
    const rawChunks = Buffer.from(
      '7\r\n' +
      'Mozilla\r\n' +
      '9\r\n' +
      'Developer\r\n' +
      '0\r\n\r\n'
    );

    const assembled = parseChunkedBody(rawChunks);
    assert.equal(assembled.toString('ascii'), 'MozillaDeveloper');
  });

  it('encodes and decodes an HTTP/2 9-byte frame header', () => {
    // Type 0x01 (HEADERS), Flags 0x05 (END_STREAM | END_HEADERS), Stream ID 3
    const encoded = encodeHTTP2FrameHeader(256, 0x01, 0x05, 3);
    assert.equal(encoded.length, 9);

    const parsed = parseHTTP2FrameHeader(encoded);
    assert.equal(parsed.length, 256);
    assert.equal(parsed.type, 0x01);
    assert.equal(parsed.flags, 0x05);
    assert.equal(parsed.streamId, 3);
  });

  it('manages HPACK static lookups and dynamic table FIFO sliding-window insertion', () => {
    const dynamicTable = new HpackDynamicTable(256); // 256 bytes buffer

    // Static lookup
    const methodGet = dynamicTable.get(2);
    assert.deepEqual(methodGet, [':method', 'GET']);

    const status200 = dynamicTable.get(8);
    assert.deepEqual(status200, [':status', '200']);

    // Dynamic insert
    dynamicTable.insert('x-custom-tenant', 'tenant-12345');
    // First dynamic entry is accessed at index 62
    assert.deepEqual(dynamicTable.get(62), ['x-custom-tenant', 'tenant-12345']);
  });
});
