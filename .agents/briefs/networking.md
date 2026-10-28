# Brief: Networking (`architecture/networking`)

| | |
|---|---|
| Phase | 1 |
| Kind | NEW track: create from scratch |
| Primary (author) | **Opus · Claude Code** |
| Drafter (on request) | pi · DeepSeek |
| Challenger | pi · Muse Spark 1.3 |
| Verifier | Antigravity |
| Final gate | Opus (claude.ai session) |
| Branch / worktree | `track/networking` · `../zto-networking` |
| Depends on | none (can start now) |
| Research dossier | `.agents/research/G-foundations.md` |

## 0. Read before starting (binding)
1. `AGENTS.md`: the contract. If it conflicts with this brief, AGENTS.md wins; log the conflict in your review file.
2. `.agents/OWNERSHIP.md`: what you own vs only cross-link.
3. `.agents/REVIEW.md`: the checklist your work is judged against.
4. Your global/agent instructions still apply where they do not conflict.

## 1. Owner decisions and track-specific instructions
- Foundation track. TLS 1.3 is now RFC 9846; ECH is RFC 9849; hybrid PQ is RFC 10024 (re-verify).
- macOS ships LibreSSL as `openssl`. Pin OpenSSL with mise and add a preflight test that rejects LibreSSL.
- Linux-only tooling (`ss`, `nft`, `tc`, netns) runs in a pinned Docker Linux container under `test:integration`.
- Teach the **latest stable** versions. Add **Then vs now** comparisons wherever practice changed (AGENTS.md § Version Currency).
- Pin **all** tooling via mise (`.mise.toml` + `mise.lock`): node 26 for JS/TS, plus every CLI and runtime the examples need.

## 2. Ownership
**You own (full treatment):**
- TCP/IP, UDP, routing/BGP/anycast, NAT, DNS, congestion control
- TLS on the wire (handshake, RTTs, SNI/ALPN/ECH, PQ size impact), QUIC
- HTTP/1.1, HTTP/2, HTTP/3, WebSockets, gRPC, HTTP caching (RFC 9111), CDNs, L4/L7 load balancing
- Linux network tooling (ss, tcpdump, iproute2, nftables, netns)

**Cross-link only (do not re-explain):**
- libuv phases, `process.nextTick`, threadpool, streams & backpressure, CJS loader, `require(esm)`, GC tuning flags → owned by `technologies/nodejs`
- PKI/X.509 validation, mTLS identity, cert lifecycle → owned by `architecture/security-identity`
- Cache poisoning/deception attacks → owned by `architecture/security-identity` (attack)
- Edge isolates, Workers runtime, Durable Objects, KV/R2/D1/Queues, Zero Trust → owned by `technologies/cloudflare`

## 3. Research dossier (verified 2026-10-27/28; re-verify before use)

#### Networking — `architecture/networking`

- **Current stable version(s)**
  - **Node.js 26.x** (26.0.0 released 2026-05-05; latest 26.12.1 on 2026-10-21). It is the upcoming LTS: Node 24's active support ended 2026-10-20, Node 26 active support runs to 2027-10-27, and EOL is 2029-04-30. https://endoflife.date/nodejs , https://nodejs.org/en/blog/release/v26.0.0
    - Bundles Undici 8.0.2 (fetch) and V8 14.6.
    - Bundles OpenSSL 3.5.x LTS (3.5.8 as of Node 26.8.2): https://www.warp2search.net/story/nodejs-releases-v2682-and-v24210-lts-with-openssl-358-and-crypto-upgrades/
  - **`node:quic`**: experimental, needs `--experimental-quic`, `node:`-scheme only. https://nodejs.org/api/quic.html
    - 26.x added hostname verification, rate limiting, `reusePort`, `recvmmsg` batching and proper error codes (26.3.0, 2026-06-01): https://nodejs.org/en/blog/release/v26.3.0/
    - Node has no stable HTTP/3 client or server yet. HTTP/3 implementation details are in progress (unverified as a usable API). Treat it as a lab-only, preview feature.
  - **OpenSSL 4.0.0** (2026-04-14) adds ECH (RFC 9849), removes ENGINEs, SSLv3 and the SSLv2 ClientHello, and replaces `c_rehash` with `openssl rehash`. It is supported only to 2027-05-14; 4.1 is planned for Oct 2026. https://openssl-library.org/post/2026-04-14-openssl-40-final-release/ . OpenSSL 3.5 is the LTS line, and its default TLS group list prefers X25519MLKEM768 (unverified for the exact default string; prove it in a lab with `openssl s_client -groups` and a pcap).
  - **Core RFCs (current)**
    - IP: IPv4 791; IPv6 8200; ND 4861; SLAAC 4862; temporary addresses 8981; ULA 4193; RFC 1918; CGNAT 6598.
    - UDP 768; TCP **9293** (consolidated 2022); CUBIC **9438**; RACK-TLP 8985; TFO 7413; L4S 9330–9332; ECN 3168.
    - BGP-4 4271; RPKI 6480/6811; anycast 4786.
    - NAT behaviour 4787/5382; STUN 8489; ICE 8445.
    - DNS:
      - Core: 1034/1035; terminology 9499; EDNS(0) 6891.
      - DNSSEC: 4033–4035, with algorithm guidance in 8624.
      - Encrypted transports: DoT 7858; DoH 8484; DoQ 9250.
      - Records and caching: SVCB/HTTPS RR 9460; serve-stale 8767; ECS 7871; negative caching of resolution failures 9520.
    - TLS:
      - Protocol and extensions: **9846** (TLS 1.3); **9849** (ECH); **10024** (hybrid PQ); cert compression 8879.
      - Usage guidance: BCP 195 / RFC 9325; 0-RTT in HTTP 8470; service identity 9525.
    - HTTP: semantics 9110; caching 9111; HTTP/1.1 9112; HTTP/2 9113; HTTP/3 9114; QPACK 9204; HPACK 7541; Priorities 9218.
    - QUIC: 9000/9001/9002; QUIC v2 9369; DATAGRAM 9221; MASQUE 9298.
    - WebSocket 6455, over h2 8441, over h3 9220.
  - **BBR**: draft-ietf-ccwg-bbr is at -06 (-05 dated March 2026), Experimental-track draft. https://datatracker.ietf.org/doc/html/draft-ietf-ccwg-bbr
    - Linux mainline still ships BBRv1 as `tcp_bbr`; BBRv3 lives in the google/bbr `v3` branch (unverified for 2026 mainline status).
    - Linux 6.17 added DualPI2 (L4S AQM) per LWN https://lwn.net/Articles/1032095
  - **CA/B Forum SC-081** (max public TLS cert lifetime) https://support.dnsimple.com/articles/announcement-ssl-certificate-validity-changes/
    - 398 days, then **200 days from 2026-03-15**, 100 days from 2027-03-15, 47 days from 2029-03-15.
  - **Let's Encrypt** https://letsencrypt.org/2026/01/15/6day-and-ip-general-availability.html
    - The ~6-day `shortlived` profile and IP-address certificates have been GA since 2026-01-15.
    - The default lifetime goes 90 → 64 days (2027-02-10) → 45 days (2028-02-16).
- **Authoritative syllabi used**
  - **Kurose & Ross**, *Computer Networking: A Top-Down Approach*, **9th ed.** (Pearson, ISBN 9780135429334). https://www.schweitzer-online.de/en/buch/Kurose/Computer-Networking-Top-Down-Approach/9780135429334/A75251515/ . The book's ToC (application → transport → network data/control plane → link → wireless → security) is the spine.
  - **Stevens / Fall**, *TCP/IP Illustrated Vol. 1*, 2nd ed., for packet-level depth. Stevens, *UNIX Network Programming Vol. 1*, for the sockets API (backlog, SO_REUSEADDR/PORT, non-blocking I/O).
  - **Ilya Grigorik**, *High Performance Browser Networking* (free, https://hpbn.co). Some of it is dated (pre-h3); use it for latency and TLS cost intuition.
  - **CompTIA Network+ N10-009** (launched 2024-06-20) https://destcert.com/resources/n10-009-objectives/ . Use it only as a coverage checklist:
    - Troubleshooting 24%
    - Concepts 23%
    - Implementation 20%
    - Operations 19%
    - Security 14%
  - Cloudflare Learning Center and the Cloudflare blog (QUIC, ECH, PQ rollout) as secondary reading.
  - Brendan Gregg, *Systems Performance* 2nd ed., networking chapter, for the Linux tooling methodology.
- **Proposed modules**
  1. **01-layers-and-packets**
     - OSI vs TCP/IP model and why OSI is a vocabulary, not an implementation.
     - Encapsulation, headers and MTU.
     - Byte order and framing.
     - Reading a pcap: the libpcap file format and the Ethernet/IPv4/TCP header layouts.
     - Latency budget: propagation, serialization, queuing and processing.
     - Bandwidth-delay product.
  2. **02-link-layer**
     - Ethernet II frames and MAC addresses.
     - Switching, MAC learning and VLAN 802.1Q tags.
     - ARP (RFC 826), gratuitous ARP and ARP cache states.
     - IPv6 ND/NDP instead of ARP.
     - MTU 1500 vs jumbo frames; PMTUD (RFC 1191/8201) and PLPMTUD (RFC 8899).
     - Wi-Fi basics only as a contrast.
  3. **03-ip-addressing-and-routing**
     - IPv4/IPv6 headers, CIDR math, and longest-prefix match.
     - Special ranges: 1918, 6598 and the IPv6 ULA/link-local scopes.
     - Fragmentation, TTL/hop limit and ICMP/ICMPv6 (traceroute mechanics).
     - Routing tables and policy routing with `ip rule`.
     - ECMP hashing.
     - Dual-stack and Happy Eyeballs v2 (RFC 8305).
  4. **04-internet-routing-bgp-anycast**
     - AS numbers, eBGP/iBGP and path selection.
     - Route leaks vs hijacks; RPKI ROV.
     - Anycast for DNS and CDNs, and why anycast plus TCP mostly works.
     - IXPs and peering vs transit.
     - Case studies: Facebook 2021, Cloudflare 1.1.1.1 2024 and the Pakistan/YouTube hijack.
  5. **05-udp-and-sockets**
     - UDP semantics and checksum.
     - The sockets API: bind, connect on UDP, and `SO_REUSEPORT` load spreading.
     - Ephemeral ports.
     - Backlog: SYN queue vs accept queue.
     - Non-blocking I/O, epoll/kqueue and libuv.
     - `node:dgram`/`node:net` internals.
     - GSO/GRO and `recvmmsg`.
  6. **06-tcp-internals**
     - TCP basics:
       - RFC 9293 state machine; 3-way handshake; ISN.
       - Sequence/ACK numbers and window scaling.
       - SACK and timestamps.
       - Retransmission: RTO (RFC 6298), fast retransmit and RACK-TLP.
     - Nagle vs delayed ACK, the 40 ms stall, and `TCP_NODELAY` (Node `socket.setNoDelay` defaults).
     - Connection teardown:
       - FIN vs RST and half-close (`allowHalfOpen`).
       - TIME_WAIT (2·MSL) and `tcp_tw_reuse` semantics.
       - Why `tcp_tw_recycle` was removed.
     - SYN cookies and TFO.
  7. **07-congestion-control**
     - AIMD, slow start and cwnd/ssthresh.
     - Reno → CUBIC (RFC 9438).
     - BBRv1 → v3 (model-based, pacing, fairness issues with CUBIC).
     - ECN, AQM (fq_codel, DualPI2) and L4S.
     - Bufferbloat.
     - `sysctl net.ipv4.tcp_congestion_control` and `ss -ti` fields (cwnd, rtt, pacing_rate, retrans).
  8. **08-dns**
     - Resolution: stub → recursive → authoritative; iterative resolution from the root.
     - Wire format; message compression pointers; EDNS0; truncation and TCP fallback.
     - Caching: TTLs, negative caching (RFC 2308) and serve-stale.
     - CNAME at the apex and ALIAS; SVCB/HTTPS RR (ECH config, ALPN hints).
     - DNSSEC chain of trust: DS/DNSKEY/RRSIG, NSEC/NSEC3, and the validation failure (SERVFAIL) mode.
     - DoT/DoH/DoQ.
     - Node `dns.lookup` (getaddrinfo, threadpool) vs `dns.resolve` (c-ares).
  9. **09-tls-1-3-and-pki-on-the-wire**
     - RFC 9846 handshake (1-RTT), key schedule (HKDF) and HelloRetryRequest.
     - Resumption: PSK tickets; 0-RTT replay risk and RFC 8470.
     - Certificates in the handshake: cert chain/SNI/ALPN, OCSP stapling (and its decline) and CT.
     - Privacy: ECH (RFC 9849) and its dependency on HTTPS RR.
     - Hybrid PQ X25519MLKEM768 (RFC 10024), including the larger ClientHello and middlebox breakage.
     - TLS 1.2 deprecation status after RFC 9846.
     - `SSLKEYLOGFILE` for decrypting captures.
     - Deep crypto lives in security-identity; cross-link there.
  10. **10-http-1-1-and-http-2**
      - HTTP/1.1:
        - RFC 9110 semantics vs 9112 framing.
        - Keep-alive and pipelining (dead).
        - Request smuggling: CL.TE/TE.CL.
      - HTTP/2 mechanics:
        - Binary framing, streams and flow-control windows.
        - HPACK static/dynamic table.
        - Priorities (RFC 9218).
        - TCP-level head-of-line blocking.
      - HTTP/2 attacks: Rapid Reset (CVE-2023-44487) and MadeYouReset (CVE-2025-8671, Aug 2025) https://thehackernews.com/2025/08/new-http2-madeyoureset-vulnerability.html
      - `node:http2` and Undici pools.
  11. **11-quic-and-http-3**
      - Transport design:
        - QUIC over UDP: connection IDs and migration.
        - Packet number spaces.
        - Stream-level flow control and no transport HOL.
      - Security:
        - TLS integrated (RFC 9001).
        - Amplification limit (3×) and Retry tokens.
      - Loss recovery (RFC 9002).
      - HTTP/3 and QPACK.
      - Discovery: Alt-Svc vs HTTPS RR.
      - UDP blocking and fallback.
      - QUIC v2 (RFC 9369).
      - Node `--experimental-quic` lab.
  12. **12-realtime-and-rpc**
      - WebSockets (RFC 6455): upgrade, masking, ping/pong, backpressure, and proxies or idle timeouts killing them.
      - WS over h2/h3.
      - SSE.
      - gRPC over h2: length-prefixed messages, trailers, deadlines, status codes, keepalive/GOAWAY and LB issues.
      - gRPC-Web and Connect.
      - WebTransport (status (unverified)).
  13. **13-load-balancing-cdn-nat**
      - L4 load balancing: NAT vs DSR, IPVS, Maglev/consistent hashing.
      - L7 load balancing: host/path routing, retries and idempotency.
      - Connection draining and health checks.
      - PROXY protocol v2 and X-Forwarded-For trust.
      - CDN mechanics: anycast PoPs, cache keys, `Vary`, `stale-while-revalidate` (RFC 5861) and tiered caching.
      - NAT/CGNAT: conntrack exhaustion, port exhaustion and NAT traversal (STUN/ICE).
  14. **14-linux-networking-ops**
      - iproute2: `ip addr/route/rule/neigh`.
      - `ss -tanpi` and `tcpdump` BPF filters.
      - Firewalling: nftables tables/chains/sets and conntrack (`conntrack -L`).
      - Network namespaces and veth for labs.
      - Diagnostics: `tc netem` for latency/loss injection, `mtr`, `dig +trace`, `curl -w` timing breakdown, and `openssl s_client`.
      - eBPF and XDP orientation (bpftrace one-liners).
      - Troubleshooting runbook: "is it DNS, TCP, TLS, or app?"
- **Gotchas & production failure modes**
  1. **Nagle + delayed ACK** gives about 40 ms (Linux) or 200 ms stalls on small write-write-read patterns. Fix it with `TCP_NODELAY` or coalesced writes. Node's `net` sockets now default `noDelay: true` for http (verify in a lab).
  2. **TIME_WAIT exhaustion** on the *client* side when connections are not pooled: every outbound connection to the same (dst ip, port) burns an ephemeral port for 60 s. The fix is keep-alive pools, not sysctl hacks. `tcp_tw_recycle` broke NATed clients and was removed in Linux 4.12.
  3. **Accept-queue overflow**: `listen()` backlog is capped by `net.core.somaxconn`. Overflow silently drops SYN/ACKs (`ss -lnt` Recv-Q, `nstat ListenOverflows`). This shows up as random 1 s/3 s connect latency (SYN retransmits).
  4. **Keep-alive race**: the LB idle timeout is shorter than the backend's keepAliveTimeout, and the backend closes the socket just as the LB reuses it, causing 502s. Rule: backend timeout > LB timeout (Node `server.keepAliveTimeout` vs ALB 60 s).
  5. **PMTUD black holes**: ICMP "frag needed" is filtered (or there is VPN/GRE overhead), so the TLS handshake hangs after ClientHello once it grows. Hybrid PQ (about 1.2 KB extra key share) makes the ClientHello span packets and breaks buggy middleboxes.
  6. **conntrack table full** (`nf_conntrack: table full, dropping packet`) on NAT gateways and Kubernetes nodes under UDP DNS load.
  7. **DNS caching pitfalls**:
     - Node `dns.lookup` uses the libuv threadpool (default 4 threads), so slow DNS starves `fs`/`crypto`.
     - Node does no DNS caching itself.
     - Long-lived pools never re-resolve and miss failovers.
     - The JVM caches DNS forever with a security manager.
  8. **Negative caching**: an NXDOMAIN during a deploy is cached for the SOA minimum TTL, causing "DNS fixed but still broken."
  9. **DNSSEC misconfiguration** (expired RRSIG, DS mismatch after a key rollover) gives SERVFAIL only on validating resolvers, so it fails for some users only.
  10. **HTTP/2 connection coalescing**: browsers reuse one h2 connection for hosts covered by the cert SAN that resolve to the same IP. That yields 421 Misdirected Request and routing to the wrong backend when SNI-based routing differs.
  11. **HTTP/2 HOL**: one lossy TCP connection stalls all multiplexed streams. h2 can be *worse* than 6×h1 on lossy mobile links, which motivates QUIC.
  12. **gRPC behind an L4 LB**: a single long-lived h2 connection pins all RPCs to one backend. You need L7/xDS or client-side LB, plus `MAX_CONNECTION_AGE`.
  13. **Request smuggling** between a front proxy and Node: differing CL/TE parsing. Node's `llhttp` is strict, and the `--insecure-http-parser` flag reopens it.
  14. **Ephemeral port exhaustion** through a NAT/egress gateway (65k per destination 4-tuple), common with serverless and CGNAT.
  15. **QUIC is blocked or rate-limited on UDP 443** by enterprise firewalls, so you need fallback to TCP. UDP receive buffers are too small by default (`net.core.rmem_max`), so QUIC servers drop packets under load.
  16. **TLS 0-RTT replay**: a non-idempotent request in early data can be replayed. Servers must reject it or answer 425 Too Early (RFC 8470).
  17. **Anycast + stateful TCP**: a BGP route flap mid-connection moves the flow to another PoP, which RSTs. Long-lived WebSockets on anycast see periodic drops.
  18. **X-Forwarded-For spoofing**: trusting the left-most XFF without a trusted-proxy count breaks rate limiting and IP allowlists.
  19. **IPv6 Happy Eyeballs disabled or broken** (the AAAA record exists but IPv6 isn't routed) adds multi-second connect delays. Node ≥20 has `autoSelectFamily` (verify the default in 26).
- **Interview hot topics**
  - "What happens when you type a URL": DNS → TCP/QUIC → TLS 1.3 → HTTP → render, with RTT counting (1-RTT, 0-RTT, h3).
  - TCP handshake/teardown and the TIME_WAIT purpose; why it sits on the active closer.
  - Congestion vs flow control; CUBIC vs BBR trade-offs.
  - HTTP/1.1 vs 2 vs 3: HOL blocking at each layer, HPACK vs QPACK.
  - TLS 1.3 handshake, forward secrecy, 0-RTT risks, mTLS.
  - DNS resolution path, TTL strategy for failover, DNSSEC vs DoH (integrity vs privacy).
  - L4 vs L7 load balancing; sticky sessions; consistent hashing; health checks and draining.
  - CDN caching semantics (Cache-Control, `Vary`, `s-maxage`, stale-while-revalidate) and cache-key design.
  - WebSockets vs SSE vs long polling vs gRPC streaming; scaling WebSockets (sticky sessions, Redis pub/sub fan-out).
  - NAT types and why P2P needs STUN/TURN.
  - Debugging a "slow request" with `curl -w`, `ss`, tcpdump and `dig`.
  - BGP/anycast basics and famous outages.
- **Executable-proof strategy** (Mac + mise; `.mise.toml`: `node = "26"`, `pnpm`, plus `vitest` via npm)
  - **Deterministic in-process labs** (Vitest on Node 26, all on 127.0.0.1 or `::1`, ephemeral ports):
    - `node:net`: prove the Nagle/delayed-ACK effect by timing a write-write-read with `setNoDelay(false/true)`. Assert relative ordering, not absolute ms; tag the test `@flaky-timing` and allow a generous threshold.
    - `node:net`: half-close (`allowHalfOpen`), RST vs FIN (`socket.resetAndDestroy()`), and backlog behaviour.
    - `node:dgram`: a **toy iterative DNS resolver**. It encodes and decodes the RFC 1035 wire format, including compression pointers, and resolves against **in-process fake root/TLD/auth servers** on loopback ports, so the network is never touched. Negative tests cover a compression-pointer loop, truncated (TC bit) → TCP fallback, an NXDOMAIN negative TTL, and CNAME chains.
    - `node:http2`: multiplexing and flow-control windows (a stalled consumer blocks only its own stream). HPACK dynamic-table size is visible via `session.state`.
    - Rapid-Reset-style `RST_STREAM` flood against a local server, asserting the server's `maxSessionRejectedStreams`/GOAWAY handling.
    - `node:tls`: a TLS 1.3 handshake with a self-signed CA generated by a fixture script. Assert `getProtocol()`, ALPN, session resumption (`session` event, `isSessionReused()`) and SNI callback routing. Write `SSLKEYLOGFILE` via `tlsSocket.on('keylog')`.
    - Check the negotiated group via `getEphemeralKeyInfo()` / `getSharedSigalgs` to detect X25519MLKEM768 when supported by the bundled OpenSSL 3.5. Mark the test conditional on `process.versions.openssl`.
    - `node:quic` under `--experimental-quic`: a minimal echo stream. Gate it behind `describe.skipIf(!flagAvailable)`, because the API is experimental and churns.
    - WebSockets: a hand-rolled RFC 6455 handshake (`Sec-WebSocket-Accept` = base64(SHA-1(key+GUID))) and masking checks, plus the `ws` library as the reference implementation.
    - gRPC: `@grpc/grpc-js` with deadlines, status codes, metadata/trailers and keepalive.
  - **Pcap fixtures**: commit small `.pcap` files (captured once with `tcpdump`/`tshark` and documented). Each is parsed by a **hand-written TypeScript libpcap + Ethernet/IP/TCP/UDP/DNS parser** under test. Tests assert:
    - The handshake flags sequence.
    - Window-scale options.
    - The TIME_WAIT side.
    - A QUIC long-header Initial (version, DCID).
    - A TLS ClientHello's SNI, ALPN and key_share groups (hybrid PQ codepoint 0x11EC for X25519MLKEM768; verify the codepoint against RFC 10024).
    - Plus an ECH-GREASE extension.
    - Fully offline and deterministic.
  - **CLI proofs**:
    - `openssl` 3.5+/4.0: `s_client -groups X25519MLKEM768 -brief`, `-sess_out/-sess_in`, `-early_data`.
    - macOS ships **LibreSSL** as `/usr/bin/openssl`, which is a gotcha. Pin via mise (`aqua`/`ubi` backend if available) or `brew install openssl@3`; the mise availability of an OpenSSL backend is (unverified). The test asserts that `openssl version` reports "OpenSSL 3.5" or higher.
    - `dig` (bind tools via brew) for `+trace`/`+dnssec` and `curl --http3` (needs a curl built with ngtcp2 or quiche (unverified for Homebrew's default build)). These go in an optional "network-required" suite, excluded from CI by default.
  - **Linux-only tooling** (`ss`, `ip`, `nft`, `tc netem`, `conntrack`, network namespaces) runs in a **Linux container** via Docker Desktop, OrbStack or colima (`docker run --cap-add NET_ADMIN`, a Debian/Alpine image pinned by digest). A test harness script runs:
    - Scripted scenarios: netns + veth pairs, `tc qdisc add ... netem delay 100ms loss 1%`, then measure a transfer and compare CUBIC vs BBR (`sysctl`). The result asserts only coarse properties.
    - An nftables ruleset that is validated by `nft -c -f` (check mode) and behaviour-tested by connecting through it.
    - Note: the container shares the Docker VM kernel, so BBRv3 can't be tested (only the BBRv1 `tcp_bbr` module, if the VM kernel has it, unverified).
  - **Cannot prove locally**: real BGP/anycast and RPKI (fallback: run a BIRD 2/FRR container pair for an eBGP session lab, and offline RPKI validation with `rpki-client` snapshots (unverified feasibility)), CDN PoP behaviour, and real middlebox breakage.
  - **Fallbacks**: annotated pcaps, RIPEstat/bgp.tools URL references, and Cloudflare Radar data cited (not tested).
- **Overlaps / dedupe**
  - Cryptographic primitives, X.509/PKI validation, mTLS identity and cert lifecycle are owned by **architecture/security-identity**. The networking track owns the *wire* view of TLS: handshake, RTTs, SNI/ALPN/ECH and PQ size impact.
  - Kubernetes Services, kube-proxy/IPVS/eBPF, CNI and NetworkPolicy belong to **technologies/kubernetes** (cross-link from module 13/14).
  - VPC, subnets, security groups, cloud LBs and PrivateLink belong to **architecture/cloud-foundations**.
  - Edge, Workers, the CDN product, Zero Trust tunnels and the Cloudflare ECH/PQ rollout belong to **technologies/cloudflare**.
  - Docker bridge networking and netns isolation belong to **technologies/containers**.
  - Node's event loop and libuv threadpool (DNS starvation) belong to the **Node.js track**, with a cross-link.
  - Redis/DB connection pooling semantics belong to their own tracks.
  - Distributed-systems timeouts, retries and backoff can be cross-linked to a system-design track if one exists.

---

## 4. Re-verify list
These claims were marked unverified during research. Confirm or correct each one against a primary source before teaching it:
- Node has no stable HTTP/3 client or server yet. HTTP/3 implementation details are in progress (unverified as a usable API). Treat it as a lab-only, preview feature.
- **OpenSSL 4.0.0** (2026-04-14) adds ECH (RFC 9849), removes ENGINEs, SSLv3 and the SSLv2 ClientHello, and replaces `c_rehash` with `openssl rehash`. It is supported only to 2027-05-14; 4.1 is planned for Oct 2026. https://openssl-library.org/post/2026-04-14-openssl-40-final-release/ . OpenSSL 3.5 is the LTS line, and its default TLS group list prefers X25519MLKEM768 (unverified for the exact default string; prove it in a lab with `openssl s_client -groups` and a pcap).
- Linux mainline still ships BBRv1 as `tcp_bbr`; BBRv3 lives in the google/bbr `v3` branch (unverified for 2026 mainline status).
- WebTransport (status (unverified)).
- macOS ships **LibreSSL** as `/usr/bin/openssl`, which is a gotcha. Pin via mise (`aqua`/`ubi` backend if available) or `brew install openssl@3`; the mise availability of an OpenSSL backend is (unverified). The test asserts that `openssl version` reports "OpenSSL 3.5" or higher.
- `dig` (bind tools via brew) for `+trace`/`+dnssec` and `curl --http3` (needs a curl built with ngtcp2 or quiche (unverified for Homebrew's default build)). These go in an optional "network-required" suite, excluded from CI by default.
- Note: the container shares the Docker VM kernel, so BBRv3 can't be tested (only the BBRv1 `tcp_bbr` module, if the VM kernel has it, unverified).
- **Cannot prove locally**: real BGP/anycast and RPKI (fallback: run a BIRD 2/FRR container pair for an eBGP session lab, and offline RPKI validation with `rpki-client` snapshots (unverified feasibility)), CDN PoP behaviour, and real middlebox breakage.

## 5. Certifications & exams
Follow AGENTS.md § Certification and Exam Coverage exactly. Minimum deliverables:
1. **README "Certifications & Exams" section.** Start from the exams named in the dossier above ("Authoritative syllabi used"). Re-verify each exam's code, status, guide version/date, targeted product version and domain weights on the official page. Where no certification exists, say so and use the recognised interview format.
2. **`exams/README.md` coverage matrix.** Rows are domain/objective, weight, modules, examples, status. No ❌ at hand-off.
3. **`exams/<exam-code>.md` question banks.**
   - At least 5 questions per domain and at least 60 per certification, weighted like the official domains.
   - The real exam's question types, plus hands-on tasks with verification scripts for performance-based exams.
   - Difficulty tags. Answers with explanations, why each distractor is wrong, and module + official-doc refs.
   - One full mock exam with a scoring key.
4. **Exam-delta callouts** where the exam's product version differs from the track's.
5. **Original questions only.** No braindump content.

## 6. Code languages
Per AGENTS.md § Code Example Languages:
- **Primary:** pseudocode (where algorithms or protocols are described) + TypeScript (or the track's own language, for language tracks).
- **Secondary:** Python, Rust or Nim only where it teaches something. Each language lives in `examples/<lang>/` with its own mise-pinned toolchain and native test runner, and `test` runs them all.

## 7. Workflow and definition of done
1. **Primary (Opus)** works on branch `track/networking` and sets this track's row in `.agents/STATUS.md` to 🟦.
2. **Verify versions first.** Check every version in the dossier against its primary source today. Record the results in the README's `Verified against …` line. Resolve every item in the re-verify list below.
3. Build in stages: README syllabus + exam matrix → modules one by one, each with its examples/tests → glossary → cheatsheet → question banks → mock exam. Delegate bulk drafting (question-bank drafts, glossary candidates, cheatsheet tables) to the **Drafter**, then correct and integrate it yourself.
4. Before each commit: run `mise exec -- npm test` and `npm run typecheck` (or the equivalents), and `test:integration` if present. Commit with Conventional Commits scoped `(networking)`.
5. Self-check against `.agents/REVIEW.md`. Then set STATUS to 🟨 and write the hand-off at the top of `.agents/reviews/networking.md`:
   - what was done;
   - what was not done, and why;
   - every claim you are least sure of.
6. The **Challenger** attacks it and the **Verifier** checks it independently. Both record findings in `.agents/reviews/networking.md` (prompts in `.agents/KICKOFF.md`). The primary resolves the findings (🟧), Opus runs the final gate (🟪), and the owner merges (✅).
