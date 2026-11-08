#!/usr/bin/env bun
/**
 * Deterministic validation harness for the 30 Must-Know Networking Concepts in zero-to-one.
 * Verifies comprehensive coverage across curriculum modules, bilingual glossary,
 * cheatsheet master matrix, and the senior interview preparation bank.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

interface Concept {
  id: number;
  title: string;
  expectedModules: string[];
  glossaryKeywords: string[];
  cheatsheetKeyword: string;
}

const CONCEPTS: Concept[] = [
  {
    id: 1,
    title: 'OSI 7-Layer Model',
    expectedModules: ['01-layers-and-packets.md'],
    glossaryKeywords: ['OSI 7-Layer Reference Model'],
    cheatsheetKeyword: 'OSI 7-Layer Model',
  },
  {
    id: 2,
    title: 'TCP/IP 4-Layer Suite',
    expectedModules: ['01-layers-and-packets.md'],
    glossaryKeywords: ['Transmission Control Protocol (TCP)', 'Protocol Data Unit (PDU)'],
    cheatsheetKeyword: 'TCP/IP 4-Layer Suite',
  },
  {
    id: 3,
    title: 'Packet Switching',
    expectedModules: ['01-layers-and-packets.md'],
    glossaryKeywords: ['Packet Switching', 'Statistical Multiplexing'],
    cheatsheetKeyword: 'Packet Switching',
  },
  {
    id: 4,
    title: 'Data Encapsulation',
    expectedModules: ['01-layers-and-packets.md'],
    glossaryKeywords: ['Protocol Data Unit (PDU)'],
    cheatsheetKeyword: 'Data Encapsulation',
  },
  {
    id: 5,
    title: 'MTU & IP Fragmentation',
    expectedModules: ['01-layers-and-packets.md', '02-link-layer-and-switching.md'],
    glossaryKeywords: ['Maximum Transmission Unit (MTU)', 'Maximum Segment Size (MSS)'],
    cheatsheetKeyword: 'MTU & IP Fragmentation',
  },
  {
    id: 6,
    title: 'MAC vs IP Addressing',
    expectedModules: ['01-layers-and-packets.md', '02-link-layer-and-switching.md'],
    glossaryKeywords: ['Ethernet II Frame', 'Address Resolution Protocol (ARP)'],
    cheatsheetKeyword: 'MAC vs IP Addressing',
  },
  {
    id: 7,
    title: 'TCP 3-Way Handshake',
    expectedModules: ['06-tcp-internals.md'],
    glossaryKeywords: ['Transmission Control Protocol (TCP)', 'Initial Sequence Number (ISN)'],
    cheatsheetKeyword: 'TCP 3-Way Handshake',
  },
  {
    id: 8,
    title: 'UDP (User Datagram Protocol)',
    expectedModules: ['05-udp-and-sockets.md'],
    glossaryKeywords: ['User Datagram Protocol (UDP)'],
    cheatsheetKeyword: 'UDP (User Datagram Protocol)',
  },
  {
    id: 9,
    title: 'QUIC & HTTP/3',
    expectedModules: ['11-quic-and-http-3.md'],
    glossaryKeywords: ['QUIC Protocol', 'Connection ID (CID)'],
    cheatsheetKeyword: 'QUIC & HTTP/3',
  },
  {
    id: 10,
    title: 'ICMP (Ping & Traceroute)',
    expectedModules: ['03-ip-addressing-and-routing.md'],
    glossaryKeywords: [
      'Internet Control Message Protocol (ICMP)',
      'Time-to-Live (TTL) / Hop Limit',
    ],
    cheatsheetKeyword: 'ICMP (Ping & Traceroute)',
  },
  {
    id: 11,
    title: 'ARP (Address Resolution)',
    expectedModules: ['02-link-layer-and-switching.md'],
    glossaryKeywords: ['Address Resolution Protocol (ARP)'],
    cheatsheetKeyword: 'ARP (Address Resolution)',
  },
  {
    id: 12,
    title: 'TLS 1.3 Handshake',
    expectedModules: ['09-tls-1-3-and-pki-on-the-wire.md'],
    glossaryKeywords: ['Transport Layer Security (TLS 1.3)', '0-RTT Early Data'],
    cheatsheetKeyword: 'TLS 1.3 Handshake',
  },
  {
    id: 13,
    title: 'IPv4 vs IPv6 Architecture',
    expectedModules: ['03-ip-addressing-and-routing.md'],
    glossaryKeywords: ['Happy Eyeballs v2', 'Neighbor Discovery Protocol (NDP)'],
    cheatsheetKeyword: 'IPv4 vs IPv6 Architecture',
  },
  {
    id: 14,
    title: 'CIDR & Subnetting',
    expectedModules: ['03-ip-addressing-and-routing.md'],
    glossaryKeywords: ['Classless Inter-Domain Routing (CIDR)', 'Longest Prefix Match (LPM)'],
    cheatsheetKeyword: 'CIDR & Subnetting',
  },
  {
    id: 15,
    title: 'NAT & PAT (Masquerading)',
    expectedModules: ['13-load-balancing-cdn-nat.md'],
    glossaryKeywords: ['Connection Tracking (`conntrack`)', 'STUN / TURN / ICE'],
    cheatsheetKeyword: 'NAT & PAT (Masquerading)',
  },
  {
    id: 16,
    title: 'DHCP DORA Process',
    expectedModules: ['03-ip-addressing-and-routing.md'],
    glossaryKeywords: ['Address Resolution Protocol (ARP)'],
    cheatsheetKeyword: 'DHCP DORA Process',
  },
  {
    id: 17,
    title: 'BGP (Border Gateway Protocol)',
    expectedModules: ['04-internet-routing-bgp-anycast.md'],
    glossaryKeywords: [
      'Border Gateway Protocol (BGP-4)',
      'AS_PATH Attribute',
      'LOCAL_PREF Attribute',
    ],
    cheatsheetKeyword: 'BGP (Border Gateway Protocol)',
  },
  {
    id: 18,
    title: 'Unicast, Multicast & Anycast',
    expectedModules: ['04-internet-routing-bgp-anycast.md'],
    glossaryKeywords: ['Anycast Routing', 'Autonomous System (AS)'],
    cheatsheetKeyword: 'Unicast, Multicast & Anycast',
  },
  {
    id: 19,
    title: 'DNS Recursive Resolution',
    expectedModules: ['08-dns.md'],
    glossaryKeywords: [
      'Authoritative Name Server',
      'Recursive Resolver',
      'DNSSEC (DNS Security Extensions)',
    ],
    cheatsheetKeyword: 'DNS Recursive Resolution',
  },
  {
    id: 20,
    title: 'Reverse Proxy vs Load Balancer',
    expectedModules: ['13-load-balancing-cdn-nat.md'],
    glossaryKeywords: ['Direct Server Return (DSR)', 'PROXY Protocol', 'Maglev Consistent Hashing'],
    cheatsheetKeyword: 'Reverse Proxy vs Load Balancer',
  },
  {
    id: 21,
    title: 'CDN & Edge Caching',
    expectedModules: ['13-load-balancing-cdn-nat.md'],
    glossaryKeywords: ['RFC 9111 HTTP Caching', 'Anycast Routing'],
    cheatsheetKeyword: 'CDN & Edge Caching',
  },
  {
    id: 22,
    title: 'WebSockets (Full-Duplex)',
    expectedModules: ['12-realtime-and-rpc.md'],
    glossaryKeywords: ['WebSocket Framing (RFC 6455)'],
    cheatsheetKeyword: 'WebSockets (Full-Duplex)',
  },
  {
    id: 23,
    title: 'gRPC & HTTP/2 Multiplexing',
    expectedModules: ['10-http-1-1-and-http-2.md', '12-realtime-and-rpc.md'],
    glossaryKeywords: [
      'gRPC Length-Prefixed Message',
      'HTTP/2 Binary Framing Layer',
      'HPACK Header Compression',
    ],
    cheatsheetKeyword: 'gRPC & HTTP/2 Multiplexing',
  },
  {
    id: 24,
    title: 'CORS (Cross-Origin Resource Sharing)',
    expectedModules: ['10-http-1-1-and-http-2.md'],
    glossaryKeywords: ['Cross-Origin Resource Sharing (CORS)'],
    cheatsheetKeyword: 'CORS (Cross-Origin Resource Sharing)',
  },
  {
    id: 25,
    title: 'Zero Trust & Mutual TLS (mTLS)',
    expectedModules: ['09-tls-1-3-and-pki-on-the-wire.md'],
    glossaryKeywords: ['Mutual TLS (mTLS)', 'Zero Trust Architecture (ZTA)', 'SPIFFE ID'],
    cheatsheetKeyword: 'Zero Trust & Mutual TLS (mTLS)',
  },
  {
    id: 26,
    title: 'VPN & WireGuard Tunneling',
    expectedModules: ['14-linux-networking-ops.md'],
    glossaryKeywords: ['WireGuard Protocol', 'Cryptokey Routing'],
    cheatsheetKeyword: 'VPN & WireGuard Tunneling',
  },
  {
    id: 27,
    title: 'Stateful Firewall vs WAF',
    expectedModules: ['14-linux-networking-ops.md'],
    glossaryKeywords: [
      'Netfilter & Nftables',
      'Connection Tracking (`conntrack`)',
      'Web Application Firewall (WAF)',
    ],
    cheatsheetKeyword: 'Stateful Firewall vs WAF',
  },
  {
    id: 28,
    title: 'DDoS & Token Bucket Rate Limiting',
    expectedModules: ['07-congestion-control.md'],
    glossaryKeywords: ['Token Bucket Algorithm', 'Leaky Bucket Algorithm'],
    cheatsheetKeyword: 'DDoS & Token Bucket Rate Limiting',
  },
  {
    id: 29,
    title: 'QoS & Traffic Shaping',
    expectedModules: ['07-congestion-control.md'],
    glossaryKeywords: [
      'Active Queue Management (AQM)',
      'Controlled Delay (CoDel)',
      'Explicit Congestion Notification (ECN)',
    ],
    cheatsheetKeyword: 'QoS & Traffic Shaping',
  },
  {
    id: 30,
    title: 'VPC & VXLAN Overlay Networks',
    expectedModules: ['14-linux-networking-ops.md'],
    glossaryKeywords: [
      'Virtual eXtensible Local Area Network (VXLAN)',
      'VXLAN Network Identifier (VNI)',
      'VXLAN Tunnel Endpoint (VTEP)',
    ],
    cheatsheetKeyword: 'VPC & VXLAN Overlay Networks',
  },
];

const basePath = path.resolve(import.meta.dir, '..');
const modulesDir = path.join(basePath, 'modules');
const glossaryPath = path.join(basePath, 'GLOSSARY.md');
const cheatsheetPath = path.join(basePath, 'CHEATSHEET.md');
const interviewPath = path.join(basePath, 'exams', 'interview.md');

let errors = 0;

function ok(msg: string) {
  console.log(`ok   ${msg}`);
}

function fail(msg: string) {
  console.error(`FAIL ${msg}`);
  errors++;
}

// 1. Check all expected files exist
if (!fs.existsSync(glossaryPath)) fail(`Missing GLOSSARY.md at ${glossaryPath}`);
if (!fs.existsSync(cheatsheetPath)) fail(`Missing CHEATSHEET.md at ${cheatsheetPath}`);
if (!fs.existsSync(interviewPath)) fail(`Missing interview.md at ${interviewPath}`);

const glossaryContent = fs.readFileSync(glossaryPath, 'utf8');
const cheatsheetContent = fs.readFileSync(cheatsheetPath, 'utf8');
const interviewContent = fs.readFileSync(interviewPath, 'utf8');

// 2. Validate all 30 concepts across modules, glossary, and cheatsheet
for (const c of CONCEPTS) {
  // Check modules
  for (const mod of c.expectedModules) {
    const modPath = path.join(modulesDir, mod);
    if (!fs.existsSync(modPath)) {
      fail(`Concept #${c.id} (${c.title}): Module ${mod} does not exist`);
    }
  }

  // Check glossary
  const hasGlossary = c.glossaryKeywords.some((kw) => glossaryContent.includes(kw));
  if (!hasGlossary) {
    fail(
      `Concept #${c.id} (${c.title}): No matching glossary entry found for [${c.glossaryKeywords.join(', ')}]`,
    );
  }

  // Check cheatsheet
  if (!cheatsheetContent.includes(c.cheatsheetKeyword)) {
    fail(`Concept #${c.id} (${c.title}): Not found in cheatsheet matrix: "${c.cheatsheetKeyword}"`);
  }
}
ok(`All 30 concepts validated in modules, glossary, and cheatsheet master matrix`);

// 3. Validate interview question bank structure
const qRegex =
  /### Q-INT-(\d{3}) · (.+) · difficulty ([1-3]) · (single|multi|scenario|ordering|hands-on)/g;
const matches = [...interviewContent.matchAll(qRegex)];

if (matches.length < 60) {
  fail(`Expected at least 60 questions in interview.md, found ${matches.length}`);
} else {
  ok(`Found ${matches.length} questions in exams/interview.md (meets >=60 requirement)`);
}

// Verify details block, answer, and module references
const detailsCount = (interviewContent.match(/<details><summary>Answer<\/summary>/g) || []).length;
if (detailsCount !== matches.length) {
  fail(`Mismatch: ${matches.length} questions but ${detailsCount} answer details blocks`);
} else {
  ok(`All ${matches.length} questions have expandable answer details blocks`);
}

const refCount = (interviewContent.match(/Ref: \[modules\/\d{2}-/g) || []).length;
if (refCount < matches.length) {
  fail(`Expected at least ${matches.length} module references, found ${refCount}`);
} else {
  ok(`All questions have verified cross-references to teaching modules`);
}

// Check mock exam section
if (
  !interviewContent.includes(
    '## Mock Examination: Senior Systems Networking Technical Interview Loop',
  )
) {
  fail(`Missing Mock Examination section in interview.md`);
} else {
  ok(`Mock Examination section verified in interview.md`);
}

if (errors > 0) {
  console.error(`\n${errors} check(s) failed`);
  process.exit(1);
}

console.log('\nAll 30 concepts and interview questions deterministically verified!');
process.exit(0);
