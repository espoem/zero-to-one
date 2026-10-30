# Networking Systems Architecture Curriculum & Technical Reference

> **Verified against Node 26.12.1, TypeScript 7.0.2 on 2026-10-30**

Welcome to the **Networking Systems Architecture Complete Learning Track**. This curriculum delivers an exhaustive, zero-to-one systems engineering reference synthesized from seminal computer networking literature (W. Richard Stevens' *TCP/IP Illustrated*, Kurose & Ross' *Computer Networking: A Top-Down Approach*, Douglas Comer's *Internetworking with TCP/IP*), foundational RFC standards (from RFC 768/791/793 up through RFC 9000/9114/9293/9438/9849/10024), IEEE specifications (802.3, 802.1Q, 802.11ax/be), and production internet infrastructure systems (Linux kernel Netfilter/iproute2/epoll, Google Maglev, Cloudflare edge BGP Anycast, and modern CDN architectures).

Every layer of the protocol stack is grounded in formal state machines, exact binary wire layouts, packet capture dissections, and deterministic, runnable test suites in [examples/](./examples/).

---

## 1. Certifications & Academic Standards

This curriculum provides 100% full coverage for both official industry certification and senior technical interview loops:

### Official Certification: CompTIA Network+ (N10-009)
- **Exam Code**: **N10-009**
- **Vendor / Foundation**: CompTIA (Computing Technology Industry Association)
- **Official Exam Guide**: [CompTIA Network+ N10-009 Exam Objectives](https://www.comptia.org/certifications/network)
- **Status**: **Active** (Launched June 20, 2024; officially supersedes retired N10-008).
- **Date Verified**: 2026-10-30 against official CompTIA N10-009 objectives.
- **Target Specifications**: Modern enterprise and internet networking: IPv4/IPv6 dual-stack, TCP (RFC 9293), TLS 1.3 (RFC 8446/9846), HTTP/2 & HTTP/3 (RFC 9113/9114), QUIC (RFC 9000), BGP-4 (RFC 4271), RPKI ROV, IEEE 802.1Q, 802.11ax/be, and Linux container networking (`veth`, `netns`).
- **Format**: Up to 90 questions: Multiple-choice (single and multiple select), drag-and-drop, and Performance-Based Questions (PBQs).
- **Duration**: 90 minutes.
- **Passing Score**: 720 / 900 (scaled score, ~80%).
- **Coverage & Question Banks**:
  - **[exams/README.md](./exams/README.md)**: 100% full coverage matrix across all 5 CompTIA domains (1.0 Networking Concepts, 2.0 Network Implementation, 3.0 Network Operations, 4.0 Network Security, 5.0 Network Troubleshooting) with zero gaps.
  - **[exams/n10-009.md](./exams/n10-009.md)**: 75 original practice questions categorized by domain and difficulty (1–3), plus a full 90-minute 30-question mock examination with scoring rubrics and distractor analysis.

### Staff / Principal Systems Engineering Technical Interview Loop
- **Target Roles**: Staff / Principal Site Reliability Engineer (SRE), Network Infrastructure Engineer, Cloud Systems Architect.
- **Focus**: Deep-dive mechanical trade-offs: BGP Anycast stateful TCP collapse, Maglev consistent hashing, CUBIC vs BBR congestion control models, epoll edge vs level-triggered socket scheduling, Nagle / Delayed ACK deadlocks, HTTP Request Smuggling, and Post-Quantum hybrid TLS 1.3 MTU fragmentation.

---

## 2. Curriculum Syllabus & Topic Breakdown

The curriculum is structured into 14 self-contained, progressive modules:

### [Module 01 — Layers, Packets & The Physical-Link Boundary](./modules/01-layers-and-packets.md)
- **Concepts**: OSI 7-layer vs TCP/IP 4-layer taxonomy, Protocol Data Units (PDUs), encapsulation/decapsulation invariants, propagation vs serialization latency mathematics ($t_{\text{prop}} \gg t_{\text{tx}}$ on WANs), Bandwidth-Delay Product (BDP), and libpcap binary file format parsing.
- **Runnable Proof**: [`examples/01-pcap-and-packet-parser.test.ts`](./examples/01-pcap-and-packet-parser.test.ts)

### [Module 02 — Link Layer, Switching & Address Resolution](./modules/02-link-layer-and-switching.md)
- **Concepts**: IEEE 802.3 / Ethernet II framing, MAC learning and CAM table state aging, CAM overflow attacks and port security, IEEE 802.1Q VLAN tagging (TPID/TCI), ARP protocol mechanics and cache state machine, IPv6 Neighbor Discovery Protocol (NDP), MTU vs MSS, PMTUD (RFC 1191), and the PMTUD Black Hole failure mode.
- **Runnable Proof**: [`examples/02-arp-and-ethernet.test.ts`](./examples/02-arp-and-ethernet.test.ts)

### [Module 03 — IP Addressing, Subnetting & Routing Foundations](./modules/03-ip-addressing-and-routing.md)
- **Concepts**: IPv4 header bitfields, IPv6 fixed 40-byte header, CIDR math and VLSM subnetting, Longest Prefix Match (LPM) binary trie routing, IP fragmentation and IP ID reuse risks, ICMP core message types, traceroute TTL-expiration mechanics, ECMP load balancing, and Happy Eyeballs v2 (RFC 8305).
- **Runnable Proof**: [`examples/03-cidr-and-routing-trie.test.ts`](./examples/03-cidr-and-routing-trie.test.ts)

### [Module 04 — Internet Routing, BGP & Anycast Architecture](./modules/04-internet-routing-bgp-anycast.md)
- **Concepts**: Autonomous Systems (ASNs), Default-Free Zone (DFZ), BGP-4 protocol state machine (Idle $\to$ Established), BGP Best Path Selection hierarchy (Weight, LOCAL_PREF, AS_PATH, MED), BGP prefix hijacking, RPKI Route Origin Authorization (ROA) and Validation (ROV), Anycast BGP routing, and the Anycast TCP connection flap pitfall.
- **Runnable Proof**: [`examples/04-bgp-decision-and-rpki.test.ts`](./examples/04-bgp-decision-and-rpki.test.ts)

### [Module 05 — Sockets API, UDP & Kernel I/O Multiplexing](./modules/05-udp-and-sockets.md)
- **Concepts**: POSIX Berkeley Sockets API, UDP datagram framing and pseudo-header checksum, connected UDP sockets, socket options (`SO_REUSEPORT`, `SO_RCVBUF`), kernel listen backlog and accept queues, and scalable I/O multiplexing: select vs poll vs epoll (Level-Triggered vs Edge-Triggered epoll).
- **Runnable Proof**: [`examples/05-udp-and-socket-lifecycle.test.ts`](./examples/05-udp-and-socket-lifecycle.test.ts)

### [Module 06 — TCP Internals: State Machine, Flow Control & SACK](./modules/06-tcp-internals.md)
- **Concepts**: RFC 9293 consolidated TCP specification, the 11-state FSM, 3-way handshake and 4-way teardown, cryptographic ISN generation (RFC 6528), sliding window flow control, Window Scale (RFC 7323), SACK (RFC 2018), PAWS, RACK-TLP (RFC 8985), Nagle's algorithm vs Delayed ACKs (the 40ms stall), the `TIME_WAIT` state ($2 \times \text{MSL}$), and SYN Cookies (RFC 4987).
- **Runnable Proof**: [`examples/06-tcp-state-machine-and-nagle.test.ts`](./examples/06-tcp-state-machine-and-nagle.test.ts)

### [Module 07 — Congestion Control: AIMD, CUBIC & BBR](./modules/07-congestion-control.md)
- **Concepts**: Chiu-Jain AIMD convergence proof, Slow Start and Congestion Avoidance, CUBIC cubic growth function (RFC 9438), BBR model-based control ($\text{BtlBw} \times \text{RTprop}$), Bufferbloat in intermediate queues, Active Queue Management (AQM, CoDel, RED), Explicit Congestion Notification (ECN, RFC 3168), and L4S (RFC 9330).
- **Runnable Proof**: [`examples/07-congestion-control-sim.test.ts`](./examples/07-congestion-control-sim.test.ts)

### [Module 08 — Domain Name System (DNS) & DNSSEC](./modules/08-dns.md)
- **Concepts**: DNS resolution hierarchy, RFC 1035 wire message layout, domain name compression pointers (`0xC000`), EDNS0 buffer expansion (RFC 6891), standard record types (A, AAAA, CNAME, MX, TXT, SOA), the zone apex CNAME dilemma and RFC 9460 HTTPS/SVCB records, DNSSEC chain of trust (DNSKEY, DS, RRSIG, NSEC3), Encrypted DNS (DoT, DoH, DoQ), and Node.js `uv_getaddrinfo` threadpool starvation.
- **Runnable Proof**: [`examples/08-dns-wire-format.test.ts`](./examples/08-dns-wire-format.test.ts)

### [Module 09 — Transport Layer Security (TLS 1.3) & PKI on the Wire](./modules/09-tls-1-3-and-pki-on-the-wire.md)
- **Concepts**: TLS 1.3 (RFC 8446/9846) 1-RTT handshake, mandatory AEAD ciphers, Ephemeral Diffie-Hellman Perfect Forward Secrecy (ECDHE), HKDF key schedule, 0-RTT Early Data and replay attacks (RFC 8470), Encrypted Client Hello (ECH, RFC 9849), and Post-Quantum hybrid key exchange (X25519MLKEM768, RFC 10024) MTU fragmentation.
- **Runnable Proof**: [`examples/09-tls-wire-dissection.test.ts`](./examples/09-tls-wire-dissection.test.ts)

### [Module 10 — HTTP/1.1 & HTTP/2: Framing, Multiplexing & HPACK](./modules/10-http-1-1-and-http-2.md)
- **Concepts**: RFC 9110/9112/9113 architecture, HTTP/1.1 chunked transfer encoding, HTTP Request Smuggling (CL.TE / TE.CL vulnerabilities), HTTP/2 9-byte binary frame header, stream multiplexing and concurrency states, HPACK header compression (RFC 7541), the HTTP/2 Rapid Reset attack (CVE-2023-44487), and transport-layer Head-of-Line blocking.
- **Runnable Proof**: [`examples/10-http-framing-and-hpack.test.ts`](./examples/10-http-framing-and-hpack.test.ts)

### [Module 11 — QUIC & HTTP/3: Multiplexing Without Head-of-Line Blocking](./modules/11-quic-and-http-3.md)
- **Concepts**: QUIC transport architecture (RFC 9000), UDP encapsulation, QUIC variable-length integer encoding (VarInt), explicit Connection IDs (CIDs) and zero-downtime connection migration, monotonic packet numbers, anti-amplification limit (3x), QPACK header compression (RFC 9204), and HTTP/3 bootstrapping via `Alt-Svc` and HTTPS records.
- **Runnable Proof**: [`examples/11-quic-varint-and-packets.test.ts`](./examples/11-quic-varint-and-packets.test.ts)

### [Module 12 — Real-Time & Streaming: WebSockets, SSE & gRPC](./modules/12-realtime-and-rpc.md)
- **Concepts**: RFC 6455 WebSocket framing, client-to-server 32-bit XOR frame masking, Server-Sent Events (SSE) with `Last-Event-ID` automatic replay, gRPC over HTTP/2, 5-byte Length-Prefixed Message framing, gRPC status trailers, and the gRPC Layer 4 load balancing dilemma.
- **Runnable Proof**: [`examples/12-websocket-framing.test.ts`](./examples/12-websocket-framing.test.ts)

### [Module 13 — Load Balancing, Edge Caching & NAT Traversal](./modules/13-load-balancing-cdn-nat.md)
- **Concepts**: Layer 4 vs Layer 7 load balancing architectures, Direct Server Return (DSR) MAC rewrites, Google Maglev consistent hashing, PROXY protocol v1/v2 vs `X-Forwarded-For` spoofing, RFC 9111 HTTP edge caching (`stale-while-revalidate`, `Vary` poisoning), and NAT traversal (Full Cone, Restricted, Symmetric NAT, STUN, TURN, ICE).
- **Runnable Proof**: [`examples/13-l4-consistent-hashing-maglev.test.ts`](./examples/13-l4-consistent-hashing-maglev.test.ts)

### [Module 14 — Linux Networking Operations, Diagnostics & Packet Filtering](./modules/14-linux-networking-ops.md)
- **Concepts**: `iproute2` administration, `ss` socket diagnostics (`Recv-Q` vs `Send-Q` semantics), `tcpdump` and BPF header offset filtering, `nftables` bytecode sets vs linear `iptables`, Netfilter connection tracking (`conntrack`) table saturation, Linux network namespaces (`netns`) and `veth` container networking, traffic control with `tc netem`, and `curl -w` network timing breakdowns.
- **Runnable Proof**: [`examples/14-curl-timing-breakdown.test.ts`](./examples/14-curl-timing-breakdown.test.ts)

---

## 3. Fast-Lookup Cheatsheet & Bilingual Glossary

- **[CHEATSHEET.md](./CHEATSHEET.md)**: High-density quick-reference sheets covering Ethernet II, IPv4/IPv6, TCP 11-state table, CIDR subnetting, BGP path selection, CUBIC/BBR math, DNS records, TLS 1.3 handshake, HTTP/2 frames, and Linux CLI commands.
- **[GLOSSARY.md](./GLOSSARY.md)**: Authoritative English ↔ Czech bilingual glossary indexing over 70 formal terms across link-layer, routing, transport, congestion control, cryptography, and kernel networking operations.

---

## 4. Runnable Verification & Toolchain

All code examples and test suites run deterministically in modern Node.js and TypeScript via the pinned `mise` toolchain:

```bash
# Enter the track directory
cd architecture/networking

# Run the complete test suite (14 suites, 33 tests)
mise exec -- npm test

# Run the strict TypeScript typecheck
mise exec -- npm run typecheck

# Validate all Mermaid diagrams in documentation
node ../../tools/mermaid-check/check.mjs .
```
