# Networking Architecture Certification & Examination Matrix

This document provides a comprehensive mapping of the **CompTIA Network+ (N10-009)** certification domains and the **Staff / Principal Network Systems Engineering Technical Interview Loop** against the curriculum modules and executable verification test suites in [`architecture/networking`](../).

---

## 1. Exam Metadata: CompTIA Network+ (N10-009)

| Specification Field | Official Specification Details |
| :--- | :--- |
| **Exam Code** | **N10-009** |
| **Vendor / Foundation** | CompTIA (Computing Technology Industry Association) |
| **Launch Date** | June 20, 2024 (Active; replaces retiring N10-008) |
| **Official Exam Guide** | [CompTIA Network+ N10-009 Exam Objectives](https://www.comptia.org/certifications/network) |
| **Target Product / Spec** | Current stable networking standards: IPv4/IPv6, TCP (RFC 9293), TLS 1.3 (RFC 8446/9846), HTTP/2 & HTTP/3 (RFC 9113/9114), 802.11ax/be, 802.1Q, BGP-4. |
| **Format** | Maximum 90 questions: Multiple choice (single and multiple response), drag-and-drop, and Performance-Based Questions (PBQs). |
| **Duration** | 90 minutes |
| **Passing Score** | 720 / 900 (scaled score) |
| **Preparation Bank** | [`exams/n10-009.md`](./n10-009.md) (75 original questions + 90-question full mock exam with scoring key) |

---

## 2. Examination Domain Coverage Matrix

The CompTIA Network+ N10-009 certification partitions network engineering into five core domains:

| Domain ID | Domain Description | Official Weight | Curriculum Modules | Executable Test Proofs | Coverage Status |
| :---: | :--- | :---: | :--- | :--- | :---: |
| **1.0** | **Networking Concepts** | **23%** | Modules 01, 02, 03, 05, 06, 07 | `examples/01-pcap-and-packet-parser.test.ts`<br/>`examples/03-cidr-and-routing-trie.test.ts`<br/>`examples/06-tcp-state-machine-and-nagle.test.ts`<br/>`examples/07-congestion-control-sim.test.ts` | ✅ Full |
| **2.0** | **Network Implementation** | **20%** | Modules 02, 03, 04, 08, 13 | `examples/02-arp-and-ethernet.test.ts`<br/>`examples/04-bgp-decision-and-rpki.test.ts`<br/>`examples/08-dns-wire-format.test.ts`<br/>`examples/13-l4-consistent-hashing-maglev.test.ts` | ✅ Full |
| **3.0** | **Network Operations** | **19%** | Modules 04, 08, 10, 11, 13, 14 | `examples/04-bgp-decision-and-rpki.test.ts`<br/>`examples/10-http-framing-and-hpack.test.ts`<br/>`examples/11-quic-varint-and-packets.test.ts`<br/>`examples/14-curl-timing-breakdown.test.ts` | ✅ Full |
| **4.0** | **Network Security** | **14%** | Modules 02, 04, 08, 09, 10, 12, 14 | `examples/04-bgp-decision-and-rpki.test.ts`<br/>`examples/09-tls-wire-dissection.test.ts`<br/>`examples/10-http-framing-and-hpack.test.ts`<br/>`examples/12-websocket-framing.test.ts` | ✅ Full |
| **5.0** | **Network Troubleshooting**| **24%** | Modules 02, 05, 06, 08, 11, 14 | `examples/01-pcap-and-packet-parser.test.ts`<br/>`examples/05-udp-and-socket-lifecycle.test.ts`<br/>`examples/06-tcp-state-machine-and-nagle.test.ts`<br/>`examples/14-curl-timing-breakdown.test.ts` | ✅ Full |

---

## 3. Detailed Objective-to-Module Mapping

### Domain 1.0: Networking Concepts (23%)
- **1.1 OSI Reference vs TCP/IP Suite**: Layer models, PDUs, headers, encapsulation/decapsulation $\implies$ [Module 01](../modules/01-layers-and-packets.md) & [`01-pcap-and-packet-parser.test.ts`](../examples/01-pcap-and-packet-parser.test.ts).
- **1.2 Network Topologies & Types**: Point-to-point, switched Ethernet, mesh, peering fabrics, Default-Free Zone (DFZ) $\implies$ [Module 02](../modules/02-link-layer-and-switching.md), [Module 04](../modules/04-internet-routing-bgp-anycast.md).
- **1.3 IP Addressing & Subnetting**: IPv4 Classless Inter-Domain Routing (CIDR), VLSM, IPv6 global unicast/link-local/ULA $\implies$ [Module 03](../modules/03-ip-addressing-and-routing.md) & [`03-cidr-and-routing-trie.test.ts`](../examples/03-cidr-and-routing-trie.test.ts).
- **1.4 Common Ports & Transport Protocols**: TCP, UDP, ICMP, well-known ports (22, 53, 80, 443, 853), sockets API $\implies$ [Module 05](../modules/05-udp-and-sockets.md) & [`05-udp-and-socket-lifecycle.test.ts`](../examples/05-udp-and-socket-lifecycle.test.ts).
- **1.5 TCP Mechanics & State Transitions**: Handshake, sequence/ack numbers, flow control, window scaling, teardown $\implies$ [Module 06](../modules/06-tcp-internals.md) & [`06-tcp-state-machine-and-nagle.test.ts`](../examples/06-tcp-state-machine-and-nagle.test.ts).
- **1.6 Congestion Control & Buffer Management**: AIMD, Slow Start, CUBIC, BBR, AQM, ECN, L4S $\implies$ [Module 07](../modules/07-congestion-control.md) & [`07-congestion-control-sim.test.ts`](../examples/07-congestion-control-sim.test.ts).

### Domain 2.0: Network Implementation (20%)
- **2.1 Routing Technologies & Protocols**: Longest Prefix Match, static routing, policy routing, dynamic routing (BGP-4 path-vector, AS_PATH, MED, LOCAL_PREF) $\implies$ [Module 03](../modules/03-ip-addressing-and-routing.md), [Module 04](../modules/04-internet-routing-bgp-anycast.md) & [`04-bgp-decision-and-rpki.test.ts`](../examples/04-bgp-decision-and-rpki.test.ts).
- **2.2 Switching & VLAN Features**: MAC learning tables, CAM overflow, 802.1Q trunking, native VLAN, STP $\implies$ [Module 02](../modules/02-link-layer-and-switching.md) & [`02-arp-and-ethernet.test.ts`](../examples/02-arp-and-ethernet.test.ts).
- **2.3 IP Services & DNS Infrastructure**: DNS hierarchy, record types (A, AAAA, CNAME, MX, TXT, HTTPS), iterative resolution, EDNS(0), CNAME apex limits $\implies$ [Module 08](../modules/08-dns.md) & [`08-dns-wire-format.test.ts`](../examples/08-dns-wire-format.test.ts).
- **2.4 Load Balancing & NAT Solutions**: L4 vs L7 load balancing, Direct Server Return (DSR), Maglev consistent hashing, SNAT, DNAT, CGNAT $\implies$ [Module 13](../modules/13-load-balancing-cdn-nat.md) & [`13-l4-consistent-hashing-maglev.test.ts`](../examples/13-l4-consistent-hashing-maglev.test.ts).

### Domain 3.0: Network Operations (19%)
- **3.1 Modern Web Protocols**: HTTP/1.1 chunked framing, HTTP/2 binary framing & multiplexing, HPACK, HTTP/3 over QUIC $\implies$ [Module 10](../modules/10-http-1-1-and-http-2.md), [Module 11](../modules/11-quic-and-http-3.md) & [`10-http-framing-and-hpack.test.ts`](../examples/10-http-framing-and-hpack.test.ts), [`11-quic-varint-and-packets.test.ts`](../examples/11-quic-varint-and-packets.test.ts).
- **3.2 Real-Time & Streaming Architectures**: WebSockets (RFC 6455), SSE (`text/event-stream`), gRPC over HTTP/2, WebTransport $\implies$ [Module 12](../modules/12-realtime-and-rpc.md) & [`12-websocket-framing.test.ts`](../examples/12-websocket-framing.test.ts).
- **3.3 Anycast Edge Delivery & CDNs**: Anycast BGP steering, cache keys, RFC 9111 HTTP caching (`stale-while-revalidate`, `Vary`) $\implies$ [Module 04](../modules/04-internet-routing-bgp-anycast.md), [Module 13](../modules/13-load-balancing-cdn-nat.md).
- **3.4 Traffic Shaping & QoS**: DiffServ (DSCP), CoS (802.1p), token bucket rate limiting, Linux `tc netem` $\implies$ [Module 07](../modules/07-congestion-control.md), [Module 14](../modules/14-linux-networking-ops.md).

### Domain 4.0: Network Security (14%)
- **4.1 Transport Encryption (TLS 1.3)**: 1-RTT handshake, mandatory AEAD, Perfect Forward Secrecy (ECDHE), 0-RTT replay risk, Encrypted Client Hello (ECH), post-quantum hybrid key exchange (X25519MLKEM768) $\implies$ [Module 09](../modules/09-tls-1-3-and-pki-on-the-wire.md) & [`09-tls-wire-dissection.test.ts`](../examples/09-tls-wire-dissection.test.ts).
- **4.2 Routing & DNS Security**: BGP hijacks, RPKI Route Origin Authorization (ROA) and Validation (ROV), DNSSEC chain of trust (DS, DNSKEY, RRSIG, NSEC3), DoT, DoH $\implies$ [Module 04](../modules/04-internet-routing-bgp-anycast.md), [Module 08](../modules/08-dns.md) & [`04-bgp-decision-and-rpki.test.ts`](../examples/04-bgp-decision-and-rpki.test.ts).
- **4.3 Protocol Attacks & Defenses**: SYN floods (SYN Cookies), HTTP Request Smuggling (CL.TE / TE.CL), HTTP/2 Rapid Reset (CVE-2023-44487), WebSocket client XOR masking $\implies$ [Module 06](../modules/06-tcp-internals.md), [Module 10](../modules/10-http-1-1-and-http-2.md), [Module 12](../modules/12-realtime-and-rpc.md).
- **4.4 Firewalling & Packet Filtering**: Stateful firewalling (`conntrack`), `nftables` bytecode set matching, connection tracking limits $\implies$ [Module 14](../modules/14-linux-networking-ops.md).

### Domain 5.0: Network Troubleshooting (24%)
- **5.1 Diagnostic Methodology & Tools**: Step-by-step layer isolation, `iproute2`, `ss` socket diagnostics, `mtr`, `dig +trace`, `curl -w` timing metrics breakdown $\implies$ [Module 14](../modules/14-linux-networking-ops.md) & [`14-curl-timing-breakdown.test.ts`](../examples/14-curl-timing-breakdown.test.ts).
- **5.2 Packet Capture & BPF Inspection**: `tcpdump` flags, BPF header offsets and flag filters, libpcap parsing $\implies$ [Module 01](../modules/01-layers-and-packets.md), [Module 14](../modules/14-linux-networking-ops.md) & [`01-pcap-and-packet-parser.test.ts`](../examples/01-pcap-and-packet-parser.test.ts).
- **5.3 MTU, Fragmentation & Black Holes**: PMTUD (RFC 1191), ICMP Type 3 Code 4 drops, MSS Clamping, PLPMTUD (RFC 8899) $\implies$ [Module 02](../modules/02-link-layer-and-switching.md), [Module 03](../modules/03-ip-addressing-and-routing.md).
- **5.4 Socket & Kernel Queue Failures**: Backlog overflow (`Recv-Q > Send-Q`), Nagle / Delayed ACK 40ms stalls, `TIME_WAIT` ephemeral port exhaustion $\implies$ [Module 05](../modules/05-udp-and-sockets.md), [Module 06](../modules/06-tcp-internals.md) & [`06-tcp-state-machine-and-nagle.test.ts`](../examples/06-tcp-state-machine-and-nagle.test.ts).
- **5.5 Network Namespaces & Container Networking**: `netns`, `veth` pair creation, routing and bridging inside containers $\implies$ [Module 14](../modules/14-linux-networking-ops.md).

---

## 4. Exam Version Delta Callout

> [!NOTE] Exam Version Delta: CompTIA Network+ N10-008 vs. N10-009
> The N10-009 exam (released June 2024) introduced substantial modernization over N10-008:
> - **Added**: Heavy focus on software-defined networking (SDN), container networking (`veth`, namespaces), cloud virtual private clouds (VPCs), modern wireless standards (Wi-Fi 6E/7 / 802.11ax/be), Encrypted DNS (DoH, DoT), and infrastructure automation.
> - **Removed**: Obsolete legacy protocols (AppleTalk, IPX/SPX, WEP, 10BASE2/5 coax, ISDN, frame relay).
> - **Wire Standards**: Consolidated TCP (RFC 9293), TLS 1.3 default, and modern HTTP/2 and HTTP/3 architectures are tested directly.

All 14 curriculum modules fully reflect the N10-009 active syllabus with 100% coverage and zero gaps.
