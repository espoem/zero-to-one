import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

export interface SubnetInfo {
  network: string;
  mask: string;
  broadcast: string;
  usableHosts: number;
  firstHost: string;
  lastHost: string;
}

export function ipToNumber(ip: string): number {
  const octets = ip.split('.').map(Number);
  if (octets.length !== 4 || octets.some(o => o < 0 || o > 255)) {
    throw new Error(`Invalid IPv4 address: ${ip}`);
  }
  return (((octets[0]! << 24) >>> 0) + (octets[1]! << 16) + (octets[2]! << 8) + octets[3]!) >>> 0;
}

export function numberToIp(num: number): string {
  const n = num >>> 0;
  return `${(n >>> 24) & 255}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`;
}

export function parseCidr(cidr: string): SubnetInfo {
  const [ipStr, prefixStr] = cidr.split('/');
  if (!ipStr || !prefixStr) throw new Error(`Invalid CIDR notation: ${cidr}`);
  const prefix = Number.parseInt(prefixStr, 10);
  if (Number.isNaN(prefix) || prefix < 0 || prefix > 32) {
    throw new Error(`Invalid prefix length: ${prefixStr}`);
  }

  const ipNum = ipToNumber(ipStr);
  const maskNum = prefix === 0 ? 0 : ((~((1 << (32 - prefix)) - 1)) >>> 0);
  const networkNum = (ipNum & maskNum) >>> 0;
  const broadcastNum = (networkNum | (~maskNum)) >>> 0;

  const totalAddresses = Math.pow(2, 32 - prefix);
  const usableHosts = prefix >= 31 ? (prefix === 31 ? 2 : 1) : totalAddresses - 2;

  const firstHostNum = prefix >= 31 ? networkNum : networkNum + 1;
  const lastHostNum = prefix >= 31 ? broadcastNum : broadcastNum - 1;

  return {
    network: numberToIp(networkNum),
    mask: numberToIp(maskNum),
    broadcast: numberToIp(broadcastNum),
    usableHosts,
    firstHost: numberToIp(firstHostNum),
    lastHost: numberToIp(lastHostNum),
  };
}

class TrieNode {
  children: [TrieNode | null, TrieNode | null] = [null, null];
  route: string | null = null;
  prefixLength: number | null = null;
}

/**
 * Binary Radix Trie for Longest Prefix Match (LPM)
 */
export class RoutingTrie {
  private root = new TrieNode();

  addRoute(cidr: string, gateway: string): void {
    const [ipStr, prefixStr] = cidr.split('/');
    const prefix = Number.parseInt(prefixStr ?? '32', 10);
    const ipNum = ipToNumber(ipStr!);

    let curr = this.root;
    for (let i = 0; i < prefix; i++) {
      const bit = (ipNum >>> (31 - i)) & 1;
      if (!curr.children[bit]) {
        curr.children[bit] = new TrieNode();
      }
      curr = curr.children[bit]!;
    }
    curr.route = gateway;
    curr.prefixLength = prefix;
  }

  lookup(ip: string): { gateway: string; prefixLength: number } | null {
    const ipNum = ipToNumber(ip);
    let curr: TrieNode | null = this.root;
    let bestMatch: { gateway: string; prefixLength: number } | null = null;

    if (curr.route !== null && curr.prefixLength !== null) {
      bestMatch = { gateway: curr.route, prefixLength: curr.prefixLength };
    }

    for (let i = 0; i < 32; i++) {
      if (!curr) break;
      const bit = (ipNum >>> (31 - i)) & 1;
      curr = curr.children[bit] ?? null;
      if (curr && curr.route !== null && curr.prefixLength !== null) {
        bestMatch = { gateway: curr.route, prefixLength: curr.prefixLength };
      }
    }

    return bestMatch;
  }
}

describe('Module 03: CIDR Math & Longest Prefix Match Routing Trie', () => {
  it('correctly calculates subnet parameters for 192.168.10.130/26', () => {
    const info = parseCidr('192.168.10.130/26');
    assert.equal(info.network, '192.168.10.128');
    assert.equal(info.mask, '255.255.255.192');
    assert.equal(info.broadcast, '192.168.10.191');
    assert.equal(info.usableHosts, 62);
    assert.equal(info.firstHost, '192.168.10.129');
    assert.equal(info.lastHost, '192.168.10.190');
  });

  it('proves Longest Prefix Match selects the most specific route', () => {
    const trie = new RoutingTrie();
    trie.addRoute('0.0.0.0/0', 'DefaultGateway');
    trie.addRoute('10.0.0.0/8', 'CorporateBackbone');
    trie.addRoute('10.20.0.0/16', 'BranchRouter');
    trie.addRoute('10.20.30.0/24', 'ServerVLAN');

    // Matches DefaultGateway
    assert.equal(trie.lookup('8.8.8.8')?.gateway, 'DefaultGateway');
    // Matches CorporateBackbone (10.0.0.0/8)
    assert.equal(trie.lookup('10.5.1.1')?.gateway, 'CorporateBackbone');
    // Matches BranchRouter (10.20.0.0/16)
    assert.equal(trie.lookup('10.20.1.100')?.gateway, 'BranchRouter');
    // Matches ServerVLAN (10.20.30.0/24) - Most Specific
    const match = trie.lookup('10.20.30.45');
    assert.equal(match?.gateway, 'ServerVLAN');
    assert.equal(match?.prefixLength, 24);
  });

  it('property test: any IP within /24 always selects /24 over /16 and /8', () => {
    const trie = new RoutingTrie();
    trie.addRoute('0.0.0.0/0', 'GW_Default');
    trie.addRoute('172.16.0.0/12', 'GW_Private');
    trie.addRoute('172.20.0.0/16', 'GW_DC');
    trie.addRoute('172.20.5.0/24', 'GW_Cluster');

    fc.assert(
      fc.property(fc.integer({ min: 1, max: 254 }), (host) => {
        const testIp = `172.20.5.${host}`;
        const match = trie.lookup(testIp);
        assert.equal(match?.gateway, 'GW_Cluster');
        assert.equal(match?.prefixLength, 24);
      })
    );
  });
});
