import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

export interface VlanTag {
  tpid: number;
  pcp: number;
  dei: number;
  vid: number;
}

export interface ArpPacket {
  hardwareType: number;
  protocolType: number;
  hardwareSize: number;
  protocolSize: number;
  opcode: number; // 1 = Request, 2 = Reply
  senderMac: string;
  senderIp: string;
  targetMac: string;
  targetIp: string;
}

function macToString(buf: Buffer, offset: number): string {
  return Array.from(buf.subarray(offset, offset + 6))
    .map(b => b.toString(16).padStart(2, '0'))
    .join(':');
}

function ipToString(buf: Buffer, offset: number): string {
  return `${buf[offset]}.${buf[offset + 1]}.${buf[offset + 2]}.${buf[offset + 3]}`;
}

export function parseVlanTag(buf: Buffer, offset: number): { vlan: VlanTag; nextEtherType: number } {
  const tpid = buf.readUInt16BE(offset);
  if (tpid !== 0x8100) {
    throw new Error(`Invalid 802.1Q TPID: 0x${tpid.toString(16)}`);
  }
  const tci = buf.readUInt16BE(offset + 2);
  const pcp = (tci >> 13) & 0x07;
  const dei = (tci >> 12) & 0x01;
  const vid = tci & 0x0fff;
  const nextEtherType = buf.readUInt16BE(offset + 4);
  return {
    vlan: { tpid, pcp, dei, vid },
    nextEtherType,
  };
}

export function parseArpPacket(buf: Buffer): ArpPacket {
  if (buf.length < 28) throw new Error('Buffer too small for ARP packet');
  const hardwareType = buf.readUInt16BE(0);
  const protocolType = buf.readUInt16BE(2);
  const hardwareSize = buf[4]!;
  const protocolSize = buf[5]!;
  const opcode = buf.readUInt16BE(6);
  const senderMac = macToString(buf, 8);
  const senderIp = ipToString(buf, 14);
  const targetMac = macToString(buf, 18);
  const targetIp = ipToString(buf, 24);

  return {
    hardwareType,
    protocolType,
    hardwareSize,
    protocolSize,
    opcode,
    senderMac,
    senderIp,
    targetMac,
    targetIp,
  };
}

export class ArpCache {
  private cache = new Map<string, { mac: string; timestamp: number }>();
  private ttlMs: number;

  constructor(ttlMs = 300_000) {
    this.ttlMs = ttlMs;
  }

  processArpPacket(packet: ArpPacket, now = Date.now()): void {
    // ARP snooping / learning: learn sender MAC for sender IP
    this.cache.set(packet.senderIp, {
      mac: packet.senderMac,
      timestamp: now,
    });
  }

  lookup(ip: string, now = Date.now()): string | null {
    const entry = this.cache.get(ip);
    if (!entry) return null;
    if (now - entry.timestamp > this.ttlMs) {
      this.cache.delete(ip);
      return null;
    }
    return entry.mac;
  }

  size(): number {
    return this.cache.size;
  }
}

describe('Module 02: Link Layer, 802.1Q VLAN & ARP Cache Mechanics', () => {
  it('correctly parses an 802.1Q VLAN tagged frame', () => {
    const frame = Buffer.alloc(18);
    frame.write('001122334455', 0, 'hex'); // Dest MAC
    frame.write('66778899aabb', 6, 'hex'); // Src MAC
    frame.writeUInt16BE(0x8100, 12);       // TPID
    // TCI: PCP = 5 (Voice), DEI = 0, VID = 100 -> (5 << 13) | 100 = 0xA064
    frame.writeUInt16BE((5 << 13) | 100, 14);
    frame.writeUInt16BE(0x0800, 16);       // EtherType = IPv4

    const { vlan, nextEtherType } = parseVlanTag(frame, 12);
    assert.equal(vlan.tpid, 0x8100);
    assert.equal(vlan.pcp, 5);
    assert.equal(vlan.dei, 0);
    assert.equal(vlan.vid, 100);
    assert.equal(nextEtherType, 0x0800);
  });

  it('correctly parses an ARP Request packet', () => {
    const arp = Buffer.alloc(28);
    arp.writeUInt16BE(1, 0);      // Hardware: Ethernet
    arp.writeUInt16BE(0x0800, 2); // Protocol: IPv4
    arp[4] = 6;                   // HW Size
    arp[5] = 4;                   // Proto Size
    arp.writeUInt16BE(1, 6);      // Opcode: 1 = Request
    arp.write('001a2b3c4d5e', 8, 'hex');
    arp[14] = 192; arp[15] = 168; arp[16] = 1; arp[17] = 10;
    arp.write('000000000000', 18, 'hex');
    arp[24] = 192; arp[25] = 168; arp[26] = 1; arp[27] = 50;

    const parsed = parseArpPacket(arp);
    assert.equal(parsed.opcode, 1);
    assert.equal(parsed.senderMac, '00:1a:2b:3c:4d:5e');
    assert.equal(parsed.senderIp, '192.168.1.10');
    assert.equal(parsed.targetIp, '192.168.1.50');
  });

  it('simulates ARP Cache learning and TTL timeout eviction', () => {
    const arpCache = new ArpCache(1000); // 1s TTL
    const packet: ArpPacket = {
      hardwareType: 1,
      protocolType: 0x0800,
      hardwareSize: 6,
      protocolSize: 4,
      opcode: 2, // Reply
      senderMac: '00:11:22:33:44:55',
      senderIp: '10.0.0.1',
      targetMac: 'aa:bb:cc:dd:ee:ff',
      targetIp: '10.0.0.2',
    };

    const t0 = 10_000;
    arpCache.processArpPacket(packet, t0);
    assert.equal(arpCache.lookup('10.0.0.1', t0 + 500), '00:11:22:33:44:55');
    assert.equal(arpCache.lookup('10.0.0.1', t0 + 1500), null); // Expired
  });
});
