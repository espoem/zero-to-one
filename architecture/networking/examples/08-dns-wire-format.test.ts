import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

export interface DNSHeader {
  id: number;
  qr: boolean;      // 0 = Query, 1 = Response
  opcode: number;
  aa: boolean;      // Authoritative Answer
  tc: boolean;      // Truncation
  rd: boolean;      // Recursion Desired
  ra: boolean;      // Recursion Available
  rcode: number;    // 0=NOERROR, 3=NXDOMAIN, etc.
  qdCount: number;
  anCount: number;
  nsCount: number;
  arCount: number;
}

export function parseDNSHeader(buf: Buffer): DNSHeader {
  if (buf.length < 12) throw new Error('Buffer too small for DNS header');
  const id = buf.readUInt16BE(0);
  const flags = buf.readUInt16BE(2);
  const qdCount = buf.readUInt16BE(4);
  const anCount = buf.readUInt16BE(6);
  const nsCount = buf.readUInt16BE(8);
  const arCount = buf.readUInt16BE(10);

  const qr = (flags & 0x8000) !== 0;
  const opcode = (flags >> 11) & 0x0f;
  const aa = (flags & 0x0400) !== 0;
  const tc = (flags & 0x0200) !== 0;
  const rd = (flags & 0x0100) !== 0;
  const ra = (flags & 0x0080) !== 0;
  const rcode = flags & 0x000f;

  return { id, qr, opcode, aa, tc, rd, ra, rcode, qdCount, anCount, nsCount, arCount };
}

export function encodeQName(domain: string): Buffer {
  const parts = domain.split('.');
  const buffers: Buffer[] = [];
  for (const part of parts) {
    if (part.length === 0) continue;
    const lenBuf = Buffer.from([part.length]);
    const strBuf = Buffer.from(part, 'ascii');
    buffers.push(lenBuf, strBuf);
  }
  buffers.push(Buffer.from([0x00])); // Terminal zero
  return Buffer.concat(buffers);
}

export function decodeQName(buf: Buffer, offset: number): { name: string; nextOffset: number } {
  const labels: string[] = [];
  let curr = offset;
  let jumped = false;
  let nextOffset = 0;

  while (curr < buf.length) {
    const len = buf[curr]!;
    if (len === 0) {
      if (!jumped) nextOffset = curr + 1;
      break;
    }

    // Check pointer compression (0xC0 = 11000000)
    if ((len & 0xc0) === 0xc0) {
      const pointerOffset = buf.readUInt16BE(curr) & 0x3fff;
      if (!jumped) nextOffset = curr + 2;
      jumped = true;
      curr = pointerOffset;
      continue;
    }

    curr++;
    labels.push(buf.subarray(curr, curr + len).toString('ascii'));
    curr += len;
  }

  return {
    name: labels.join('.'),
    nextOffset: jumped ? nextOffset : curr + 1,
  };
}

describe('Module 08: DNS Wire Framing & Name Compression (RFC 1035)', () => {
  it('correctly encodes and decodes length-prefixed QNAME strings', () => {
    const domain = 'api.zero-to-one.internal';
    const encoded = encodeQName(domain);

    const { name, nextOffset } = decodeQName(encoded, 0);
    assert.equal(name, domain);
    assert.equal(nextOffset, encoded.length);
  });

  it('correctly resolves RFC 1035 DNS compression offset pointers (0xC000)', () => {
    // Construct packet where second domain points to first domain suffix
    // Offset 0: [3] 'a' 'p' 'i' [7] 'e' 'x' 'a' 'm' 'p' 'l' 'e' [3] 'c' 'o' 'm' [0] -> "api.example.com"
    // Offset 19: [3] 'c' 'd' 'n' [0xC0] [0x04] -> points to offset 4 ("example.com") -> "cdn.example.com"
    const part1 = encodeQName('api.example.com');
    const part2 = Buffer.concat([
      Buffer.from([3]),
      Buffer.from('cdn', 'ascii'),
      Buffer.from([0xc0, 0x04]), // Points to index 4 in part1 ("example.com")
    ]);

    const combined = Buffer.concat([part1, part2]);

    const res1 = decodeQName(combined, 0);
    assert.equal(res1.name, 'api.example.com');

    const res2 = decodeQName(combined, part1.length);
    assert.equal(res2.name, 'cdn.example.com');
  });

  it('correctly parses DNS response header flags', () => {
    const headerBuf = Buffer.alloc(12);
    headerBuf.writeUInt16BE(0x1234, 0); // ID
    // Flags: QR=1 (response), AA=1, RD=1, RA=1, RCODE=0 -> 0x8580
    headerBuf.writeUInt16BE(0x8580, 2);
    headerBuf.writeUInt16BE(1, 4); // QDCount = 1
    headerBuf.writeUInt16BE(2, 6); // ANCount = 2
    headerBuf.writeUInt16BE(0, 8);
    headerBuf.writeUInt16BE(1, 10); // ARCount = 1 (e.g. EDNS0 OPT)

    const header = parseDNSHeader(headerBuf);
    assert.equal(header.id, 0x1234);
    assert.equal(header.qr, true);
    assert.equal(header.aa, true);
    assert.equal(header.rd, true);
    assert.equal(header.ra, true);
    assert.equal(header.rcode, 0);
    assert.equal(header.qdCount, 1);
    assert.equal(header.anCount, 2);
    assert.equal(header.arCount, 1);
  });
});
