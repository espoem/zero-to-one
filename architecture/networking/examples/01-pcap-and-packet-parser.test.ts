import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

/**
 * Libpcap Global Header (24 bytes)
 */
export interface PcapGlobalHeader {
  magicNumber: number;
  versionMajor: number;
  versionMinor: number;
  thisZone: number;
  sigFigs: number;
  snapLen: number;
  network: number;
}

/**
 * Libpcap Packet Record Header (16 bytes)
 */
export interface PcapPacketHeader {
  tsSec: number;
  tsUsec: number;
  inclLen: number;
  origLen: number;
}

/**
 * Parsed Ethernet II Frame Header (14 bytes)
 */
export interface EthernetHeader {
  destMac: string;
  srcMac: string;
  etherType: number;
}

/**
 * Parsed IPv4 Header (20 bytes min)
 */
export interface IPv4Header {
  version: number;
  ihl: number;
  dscp: number;
  ecn: number;
  totalLength: number;
  identification: number;
  flags: { df: boolean; mf: boolean };
  fragmentOffset: number;
  ttl: number;
  protocol: number;
  headerChecksum: number;
  srcIp: string;
  destIp: string;
  isValidChecksum: boolean;
}

/**
 * Parsed TCP Header (20 bytes min)
 */
export interface TCPHeader {
  srcPort: number;
  destPort: number;
  seqNumber: number;
  ackNumber: number;
  dataOffset: number;
  flags: {
    syn: boolean;
    ack: boolean;
    fin: boolean;
    rst: boolean;
    psh: boolean;
    urg: boolean;
  };
  windowSize: number;
  checksum: number;
}

function formatMac(buf: Buffer, offset: number): string {
  return Array.from(buf.subarray(offset, offset + 6))
    .map(b => b.toString(16).padStart(2, '0'))
    .join(':');
}

function formatIp(buf: Buffer, offset: number): string {
  return `${buf[offset]}.${buf[offset + 1]}.${buf[offset + 2]}.${buf[offset + 3]}`;
}

export function computeIPv4Checksum(headerBuf: Buffer, ihlBytes: number): number {
  let sum = 0;
  for (let i = 0; i < ihlBytes; i += 2) {
    if (i === 10) continue; // Skip existing checksum field at bytes 10-11
    sum += headerBuf.readUInt16BE(i);
  }
  while (sum >> 16) {
    sum = (sum & 0xffff) + (sum >> 16);
  }
  return (~sum) & 0xffff;
}

export function parsePcapGlobalHeader(buf: Buffer): PcapGlobalHeader {
  if (buf.length < 24) throw new Error('Buffer too small for pcap global header');
  const magic = buf.readUInt32BE(0);
  const isLittleEndian = magic === 0xd4c3b2a1;
  const isBigEndian = magic === 0xa1b2c3d4;
  if (!isLittleEndian && !isBigEndian) {
    throw new Error(`Invalid pcap magic number: 0x${magic.toString(16)}`);
  }

  const readU16 = isLittleEndian ? (o: number) => buf.readUInt16LE(o) : (o: number) => buf.readUInt16BE(o);
  const readU32 = isLittleEndian ? (o: number) => buf.readUInt32LE(o) : (o: number) => buf.readUInt32BE(o);
  const readI32 = isLittleEndian ? (o: number) => buf.readInt32LE(o) : (o: number) => buf.readInt32BE(o);

  return {
    magicNumber: magic,
    versionMajor: readU16(4),
    versionMinor: readU16(6),
    thisZone: readI32(8),
    sigFigs: readU32(12),
    snapLen: readU32(16),
    network: readU32(20),
  };
}

export function parsePcapPacketRecord(buf: Buffer, offset: number): { header: PcapPacketHeader; frame: Buffer; nextOffset: number } {
  if (buf.length - offset < 16) throw new Error('Buffer too small for pcap packet header');
  const tsSec = buf.readUInt32BE(offset);
  const tsUsec = buf.readUInt32BE(offset + 4);
  const inclLen = buf.readUInt32BE(offset + 8);
  const origLen = buf.readUInt32BE(offset + 12);

  const frameStart = offset + 16;
  const frameEnd = frameStart + inclLen;
  if (buf.length < frameEnd) throw new Error('Pcap packet record truncated');

  const frame = buf.subarray(frameStart, frameEnd);
  return {
    header: { tsSec, tsUsec, inclLen, origLen },
    frame,
    nextOffset: frameEnd,
  };
}

export function parseEthernetHeader(buf: Buffer): { header: EthernetHeader; payload: Buffer } {
  if (buf.length < 14) throw new Error('Buffer too small for Ethernet II frame');
  const destMac = formatMac(buf, 0);
  const srcMac = formatMac(buf, 6);
  const etherType = buf.readUInt16BE(12);
  return {
    header: { destMac, srcMac, etherType },
    payload: buf.subarray(14),
  };
}

export function parseIPv4Header(buf: Buffer): { header: IPv4Header; payload: Buffer } {
  if (buf.length < 20) throw new Error('Buffer too small for IPv4 header');
  const verIhl = buf[0]!;
  const version = (verIhl >> 4) & 0x0f;
  const ihlWords = verIhl & 0x0f;
  const ihlBytes = ihlWords * 4;
  if (version !== 4 || ihlBytes < 20 || buf.length < ihlBytes) {
    throw new Error(`Invalid IPv4 header: ver=${version}, ihl=${ihlBytes}`);
  }

  const tos = buf[1]!;
  const dscp = (tos >> 2) & 0x3f;
  const ecn = tos & 0x03;
  const totalLength = buf.readUInt16BE(2);
  const identification = buf.readUInt16BE(4);
  const flagsOffset = buf.readUInt16BE(6);
  const df = (flagsOffset & 0x4000) !== 0;
  const mf = (flagsOffset & 0x2000) !== 0;
  const fragmentOffset = flagsOffset & 0x1fff;
  const ttl = buf[8]!;
  const protocol = buf[9]!;
  const headerChecksum = buf.readUInt16BE(10);
  const srcIp = formatIp(buf, 12);
  const destIp = formatIp(buf, 16);

  const computedChecksum = computeIPv4Checksum(buf, ihlBytes);
  const isValidChecksum = computedChecksum === headerChecksum;

  return {
    header: {
      version,
      ihl: ihlBytes,
      dscp,
      ecn,
      totalLength,
      identification,
      flags: { df, mf },
      fragmentOffset,
      ttl,
      protocol,
      headerChecksum,
      srcIp,
      destIp,
      isValidChecksum,
    },
    payload: buf.subarray(ihlBytes, totalLength > 0 ? totalLength : undefined),
  };
}

export function parseTCPHeader(buf: Buffer): { header: TCPHeader; payload: Buffer } {
  if (buf.length < 20) throw new Error('Buffer too small for TCP header');
  const srcPort = buf.readUInt16BE(0);
  const destPort = buf.readUInt16BE(2);
  const seqNumber = buf.readUInt32BE(4);
  const ackNumber = buf.readUInt32BE(8);
  const offsetFlags = buf.readUInt16BE(12);
  const dataOffsetWords = (offsetFlags >> 12) & 0x0f;
  const dataOffsetBytes = dataOffsetWords * 4;
  if (dataOffsetBytes < 20 || buf.length < dataOffsetBytes) {
    throw new Error(`Invalid TCP data offset: ${dataOffsetBytes}`);
  }

  const flags = {
    urg: (offsetFlags & 0x0020) !== 0,
    ack: (offsetFlags & 0x0010) !== 0,
    psh: (offsetFlags & 0x0008) !== 0,
    rst: (offsetFlags & 0x0004) !== 0,
    syn: (offsetFlags & 0x0002) !== 0,
    fin: (offsetFlags & 0x0001) !== 0,
  };
  const windowSize = buf.readUInt16BE(14);
  const checksum = buf.readUInt16BE(16);

  return {
    header: {
      srcPort,
      destPort,
      seqNumber,
      ackNumber,
      dataOffset: dataOffsetBytes,
      flags,
      windowSize,
      checksum,
    },
    payload: buf.subarray(dataOffsetBytes),
  };
}

describe('Module 01: Pcap Binary Parsing & Packet Dissection', () => {
  it('parses a valid libpcap global header', () => {
    const pcapHeader = Buffer.alloc(24);
    pcapHeader.writeUInt32BE(0xa1b2c3d4, 0); // Magic (Big-endian)
    pcapHeader.writeUInt16BE(2, 4);          // Major
    pcapHeader.writeUInt16BE(4, 6);          // Minor
    pcapHeader.writeInt32BE(0, 8);           // ThisZone
    pcapHeader.writeUInt32BE(0, 12);         // SigFigs
    pcapHeader.writeUInt32BE(65535, 16);     // SnapLen
    pcapHeader.writeUInt32BE(1, 20);         // LinkType (Ethernet)

    const parsed = parsePcapGlobalHeader(pcapHeader);
    assert.equal(parsed.magicNumber, 0xa1b2c3d4);
    assert.equal(parsed.versionMajor, 2);
    assert.equal(parsed.versionMinor, 4);
    assert.equal(parsed.snapLen, 65535);
    assert.equal(parsed.network, 1);
  });

  it('correctly constructs and verifies an IPv4 packet with checksum', () => {
    const ipBuf = Buffer.alloc(20);
    ipBuf[0] = 0x45; // Version 4, IHL 5 (20 bytes)
    ipBuf[1] = 0x00; // DSCP 0, ECN 0
    ipBuf.writeUInt16BE(40, 2); // Total length (20 IP + 20 TCP)
    ipBuf.writeUInt16BE(0x1234, 4); // ID
    ipBuf.writeUInt16BE(0x4000, 6); // Flags: DF=1, Offset=0
    ipBuf[8] = 64; // TTL = 64
    ipBuf[9] = 6;  // Protocol = TCP
    ipBuf.write('192.168.1.100'.split('.').map(Number).map(b => String.fromCharCode(b)).join(''), 12, 'binary');
    ipBuf.write('203.0.113.5'.split('.').map(Number).map(b => String.fromCharCode(b)).join(''), 16, 'binary');

    const expectedChecksum = computeIPv4Checksum(ipBuf, 20);
    ipBuf.writeUInt16BE(expectedChecksum, 10);

    const { header } = parseIPv4Header(ipBuf);
    assert.equal(header.version, 4);
    assert.equal(header.ihl, 20);
    assert.equal(header.ttl, 64);
    assert.equal(header.protocol, 6);
    assert.equal(header.flags.df, true);
    assert.equal(header.srcIp, '192.168.1.100');
    assert.equal(header.destIp, '203.0.113.5');
    assert.equal(header.isValidChecksum, true);
  });

  it('property test: IPv4 checksum calculation satisfies one-complement property', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 254 }),
        fc.integer({ min: 1, max: 254 }),
        fc.integer({ min: 1, max: 255 }),
        (srcByte, dstByte, id) => {
          const buf = Buffer.alloc(20);
          buf[0] = 0x45;
          buf.writeUInt16BE(20, 2);
          buf.writeUInt16BE(id, 4);
          buf[8] = 64;
          buf[9] = 17; // UDP
          buf[12] = 10;
          buf[13] = 0;
          buf[14] = 0;
          buf[15] = srcByte;
          buf[16] = 10;
          buf[17] = 0;
          buf[18] = 1;
          buf[19] = dstByte;

          const checksum = computeIPv4Checksum(buf, 20);
          buf.writeUInt16BE(checksum, 10);

          const { header } = parseIPv4Header(buf);
          assert.equal(header.isValidChecksum, true);
        }
      )
    );
  });
});
