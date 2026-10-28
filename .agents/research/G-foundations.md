# G — Foundation tracks: Networking, Security & Identity

Research date: 2026-10-28. Everything below was checked against primary sources (IETF datatracker, RFC Editor, nodejs.org, OWASP, OpenSSL, W3C/FIDO, npm registry, GitHub releases) unless marked "(unverified)".

**Surprises since most training data**
- **TLS 1.3 is now RFC 9846** (July 2026, rfc8446bis). It obsoletes RFC 8446 **and RFC 5246 (TLS 1.2)** plus 5077/6961/7627/8422. https://www.rfc-editor.org/info/rfc9846
- **ECH is RFC 9849** (March 2026). https://www.rfc-editor.org/rfc/rfc9849.html
- **Hybrid PQ key exchange (X25519MLKEM768 etc.) is RFC 10024** (Proposed Standard, 2026-08-10; from draft-ietf-tls-ecdhe-mlkem-05). https://www.rfc-editor.org/info/rfc10024
- **OAuth 2.1 is still an Internet-Draft**: draft-ietf-oauth-v2-1-**16** (2026-09-03). WG state is "WG Document", IESG state "I-D Exists", so it has not reached IESG review. https://datatracker.ietf.org/doc/draft-ietf-oauth-v2-1/
- **OAuth for Browser-Based Apps is RFC 10017 / BCP 212** (Aug 2026). https://mailarchive.ietf.org/arch/msg/oauth/VxtwQa4eBrl1Xt9AngohL3BYAFo/
- **JWT BCP update (rfc8725bis-10)** is in the RFC Editor queue, blocked on a reference. It will obsolete RFC 8725. https://datatracker.ietf.org/doc/draft-ietf-oauth-rfc8725bis/
- **OWASP Top 10:2025** is out: SSRF folded into A01, plus new A03 Supply Chain and A10 Exceptional Conditions. The RC came on 2025-11-06. The site doesn't state a final-release date.
- **WebAuthn Level 3** became a W3C Recommendation on 2026-08-25.
- **Node 26** ships `node:quic` behind `--experimental-quic` (heavy work in 26.x), `crypto.argon2`, and ML-KEM/ML-DSA in `node:crypto`.
- **OpenSSL 4.0** (2026-04-14) ships ECH and removes ENGINEs and SSLv3. It is not LTS; 3.5 is the LTS that Node bundles.

---

### Networking — `architecture/networking`

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

### Security & identity — `architecture/security-identity`

- **Current stable version(s)**
  - **OWASP Top 10:2025** https://top10.owasp.org/2025/ . The RC was announced 2025-11-06 at Global AppSec; the site doesn't state a final-release date (exact final date unverified). Categories:
    - A01 Broken Access Control (now includes SSRF)
    - A02 Security Misconfiguration
    - A03 Software Supply Chain Failures (new)
    - A04 Cryptographic Failures
    - A05 Injection
    - A06 Insecure Design
    - A07 Authentication Failures
    - A08 Software or Data Integrity Failures
    - A09 Security Logging & Alerting Failures
    - A10 Mishandling of Exceptional Conditions (new)
    - Changes vs 2021: https://www.fastly.com/blog/new-2025-owasp-top-10-list-what-changed-what-you-need-to-know
  - **OWASP ASVS 5.0.0** (published 2025-05-30), with 17 chapters starting at V1 Encoding & Sanitization. https://asvs.owasp.org/ (the full chapter list is in the downloads; not enumerated here).
  - **OWASP API Security Top 10 2023** is still the current edition; no 2025/2026 edition was found. https://owasp.org/API-Security/ (no newer edition: verified only by absence in search).
  - **OAuth**:
    - **OAuth 2.1**: draft-ietf-oauth-v2-1-16 (2026-09-03), WG Document and not yet at the IESG.
    - **RFC 9700** OAuth 2.0 Security BCP (Jan 2025, BCP 240) https://www.rfc-editor.org/rfc/rfc9700.html
    - **RFC 10017 / BCP 212** OAuth for Browser-Based Apps (Aug 2026).
    - **RFC 9728** Protected Resource Metadata (Apr 2025).
    - **RFC 9901** SD-JWT (Nov 2025).
    - **rfc8725bis** JWT BCP in the RFC Editor queue.
    - Established RFCs:
      - Core OAuth: 6749/6750, PKCE 7636, device grant 8628, token exchange 8693.
      - Server and client metadata: AS metadata 8414, DCR 7591, introspection 7662, revocation 7009.
      - JWT access tokens: profile 9068.
      - Advanced request features: PAR 9126, JAR 9101, RAR 9396, Resource Indicators 8707, `iss` parameter 9207.
      - Sender-constrained tokens: DPoP **9449**, mTLS-bound tokens 8705.
      - JOSE: JWS 7515, JWE 7516, JWK 7517, JWA 7518, JWT 7519.
  - **FAPI 2.0** Security Profile and Attacker Model are Final (2025). Final conformance tests are available. https://openid.net/fapi2-0-final-conformance-tests-available/ (exact approval date unverified; recalled as Feb 2025).
  - **OpenID Connect Core 1.0** (errata set 2; also ISO/IEC 26131:2024 (unverified)).
  - **WebAuthn Level 3**: W3C Recommendation, 2026-08-25. It adds Related Origin Requests (`/.well-known/webauthn`), JSON serialization, conditional create, BE/BS backup flags, the Signals API, `getClientCapabilities()` and PRF. https://fidoalliance.org/webauthn-level-3-is-now-a-w3c-recommendation/
  - **TLS/PKI**: RFC 9846 (TLS 1.3), RFC 5280 (X.509), RFC 9525 (service identity), RFC 6962/9162 (CT). SC-081 lifetimes and LE 6-day/IP certs are as in the networking section.
  - **Password hashing**: RFC 9106 (Argon2). Node has `crypto.argon2()`/`argon2Sync()` built in (version added unverified; present in Node 26 docs https://nodejs.org/api/crypto.html). Node `node:crypto` supports **ML-KEM-512/768/1024** (`crypto.encapsulate/decapsulate`) and **ML-DSA-44/65/87**, backed by OpenSSL 3.5.
  - **Libraries** (npm registry, 2026-10-28):
    - `jose` **6.2.13**
    - `oauth4webapi` **3.8.8**
    - `oidc-provider` **9.13.1**
    - `@cedar-policy/cedar-wasm` **4.14.0**
  - **Servers**:
    - **Keycloak 26.8.1** (2026-10-13) https://github.com/keycloak/keycloak/releases
    - **Dex v2.46.1** (2026-10-21) https://github.com/dexidp/dex/releases
    - **OpenFGA v1.22.0** (2026-10-06) https://github.com/openfga/openfga/releases
  - **Browser cookies**: Google ended Privacy Sandbox and kept third-party cookies in Chrome (Oct 2025, per press: https://www.cookieyes.com/knowledge-base/cookies-101/is-google-ending-privacy-sandbox.md ; exact details unverified). CHIPS (`Partitioned` attribute) is still relevant for embedded/iframe contexts, and Safari/Firefox partition by default. Per-browser support matrix (unverified); check caniuse when writing.
- **Authoritative syllabi used**
  - OWASP:
    - Top 10:2025, ASVS 5.0 (map each module to ASVS chapters), API Security Top 10 2023.
    - Cheat Sheet Series (Password Storage, Session Management, OAuth2, JWT for Java/Node, CSRF, SSRF).
    - SAMM for program context.
  - IETF OAuth WG documents list (https://datatracker.ietf.org/wg/oauth/documents/) and https://oauth.net/2.1/
  - OpenID specs (Core, Discovery, Back-Channel Logout, FAPI 2.0).
  - Crypto texts:
    - Dan Boneh & Victor Shoup, *A Graduate Course in Applied Cryptography* (free).
    - Jean-Philippe Aumasson, *Serious Cryptography* 2nd ed. (2024).
    - David Wong, *Real-World Cryptography*.
  - Threat modeling:
    - Adam Shostack, *Threat Modeling: Designing for Security* and *Threats: What Every Engineer Should Learn from Star Wars*.
    - Threat Modeling Manifesto.
    - Microsoft STRIDE docs.
  - Zanzibar paper (Pang et al., USENIX ATC 2019), the OpenFGA docs and the Cedar paper/docs (https://docs.cedarpolicy.com).
  - Certifications, used only as coverage checklists:
    - **CompTIA Security+ SY0-701** is current. SY0-801 is announced, but its launch date and objectives were not verifiable from CompTIA (https://www.diontraining.com/blogs/news/comptia-security-sy0-801-what-we-know-about-the-new-exam), so its domain weightings are (unverified).
    - ISC2 CSSLP/CISSP domains are optional extra reading. Neither is needed for this track.
- **Proposed modules**
  1. **01-threat-modeling-and-security-principles**
     - CIA plus authenticity/non-repudiation.
     - Trust boundaries and data-flow diagrams.
     - STRIDE per element.
     - Attack trees; DREAD's flaws.
     - Least privilege, defense in depth, secure defaults.
     - Security requirements via ASVS 5.0 levels.
     - Mapping OWASP Top 10:2025 to design decisions.
  2. **02-crypto-primitives-for-engineers**
     - Randomness: CSPRNG vs `Math.random`.
     - Hashing: SHA-2/SHA-3/BLAKE2/3; length extension (why HMAC, not `H(key||msg)`).
     - MACs and constant-time comparison (`crypto.timingSafeEqual`).
     - Symmetric encryption:
       - AEAD: AES-GCM and ChaCha20-Poly1305.
       - Nonce-reuse catastrophe; AES-GCM-SIV.
       - Encrypt-then-MAC history.
     - Asymmetric primitives:
       - Signatures: Ed25519 vs ECDSA nonce issues vs RSA-PSS.
       - Key exchange: X25519.
     - KDFs: HKDF.
     - Envelope encryption.
  3. **03-passwords-and-secrets-at-rest**
     - Password hashing: argon2id (RFC 9106; OWASP params m=19 MiB, t=2, p=1 as the minimum (verify against the current cheat sheet)), scrypt, bcrypt's 72-byte limit, pepper vs salt.
     - Credential stuffing and breached-password checks (k-anonymity HIBP).
     - Secrets management:
       - Vault/OpenBao, cloud KMS and SOPS.
       - Rotation and dynamic secrets.
       - `.env` leakage and secret scanning.
     - Key hierarchy (KEK/DEK).
  4. **04-pki-x509-and-mtls**
     - X.509 structure: SAN, EKU, basicConstraints and name constraints.
     - Path building and validation (RFC 5280).
     - Revocation: CRL, OCSP decline and CRLite. CT logs.
     - ACME (RFC 8555), SC-081 lifetimes and LE 6-day certs.
     - Private CAs (step-ca); mTLS for service identity; SPIFFE/SPIRE IDs.
     - Cert pinning (why not).
     - PQ certificates/ML-DSA (status).
  5. **05-sessions-cookies-and-browser-security**
     - Server sessions vs tokens; session fixation and rotation on login.
     - Cookie attributes: `Secure`, `HttpOnly`, `SameSite` Lax/Strict/None, `__Host-` prefix, CHIPS `Partitioned`.
     - CSRF tokens vs SameSite; CORS (what it is NOT).
     - CSP (nonces/strict-dynamic) and Trusted Types.
     - Clickjacking; Fetch Metadata headers.
     - Storing tokens in the browser and the BFF pattern (RFC 10017).
  6. **06-oauth-2-1-core**
     - Roles and grant types (code+PKCE, client credentials, device, refresh).
     - What 2.1 removes (implicit, ROPC) and exact redirect-URI matching.
     - `state`/`nonce`/PKCE: what each defends.
     - Refresh token rotation and reuse detection.
     - Scopes vs audience (RFC 8707).
     - RFC 9700 attacker model: mix-up (the `iss` param, RFC 9207), code injection and open redirectors.
  7. **07-oidc-and-federation**
     - ID token vs access token.
     - Discovery/JWKS; `aud`/`azp`/`nonce`/`at_hash` validation.
     - UserInfo.
     - Logout: front- vs back-channel (and why it's hard).
     - SAML as a contrast.
     - Account linking pitfalls (email_verified); multi-tenant `iss` validation (the Entra "nOAuth" class of bug).
     - Token exchange (RFC 8693) for delegation.
  8. **08-tokens-jose-and-sender-constraining**
     - JWS/JWE/JWK structure; `alg:none` and RS/HS confusion; `kid`/`jku`/`x5u` injection.
     - Algorithm allowlists; JWT BCP (rfc8725bis) and explicit `typ` (`at+jwt`, RFC 9068).
     - Clock skew and token lifetimes.
     - Opaque tokens + introspection vs JWT, and the revocation trade-off.
     - DPoP (RFC 9449) proofs, nonces and `ath`; mTLS-bound tokens (RFC 8705).
     - Hardening flows: PAR/JAR, FAPI 2.0 baseline.
     - SD-JWT (RFC 9901) orientation.
  9. **09-passkeys-webauthn-and-mfa**
     - Ceremonies: registration and authentication.
     - RP ID and origin binding (phishing resistance); challenge/replay; sign counter (and why synced passkeys use 0).
     - Attestation (usually `none`) and AAGUID; BE/BS flags.
     - Level 3 features: conditional UI/create, related origins and the Signals API.
     - Recovery flows as the weakest link.
     - Other factors: TOTP (RFC 6238) and push-fatigue attacks.
  10. **10-authorization-models**
      - Models: ACL → RBAC → ABAC → ReBAC.
      - Zanzibar: tuples, userset rewrites, the new-enemy problem and zookies/consistency tokens.
      - OpenFGA modeling.
      - Cedar: policy language, forbid-overrides-permit, schema validation and formal analysis.
      - Policy enforcement points: PEP/PDP/PIP placement.
      - BOLA/IDOR prevention (API1:2023) and multi-tenant isolation (row-level security cross-link to SQL).
  11. **11-web-and-api-vulnerability-classes**
      - Injection families (SQL, NoSQL, command, template, LDAP) and parameterization.
      - XSS types.
      - SSRF (now A01): cloud metadata, DNS rebinding and allowlist pitfalls.
      - Deserialization; path traversal.
      - Mass assignment (API3 BOPLA); rate limiting and resource consumption (API4).
      - Business-logic flaws.
      - A10:2025 exceptional conditions: fail-open error handling.
  12. **12-supply-chain-and-dependency-security**
      - Dependency confusion and typosquatting.
      - Lockfiles and `npm ci`; install scripts.
      - Provenance and trusted publishing (npm); SBOM, signing and SLSA levels (summary only, owned by gitlab-ci).
      - Malicious-package incident case studies (Shai-Hulud npm worm, Sept 2025 (unverified naming/date); xz-utils 2024).
      - Renovate/Dependabot policy; SCA vs SAST vs DAST.
  13. **13-security-operations-and-detection**
      - Security logging (A09): what to log, and never logging tokens or secrets.
      - Audit trails and tamper evidence.
      - Anomaly signals: impossible travel and refresh-token reuse.
      - Incident response basics; key/secret rotation drills.
      - Vulnerability disclosure, CVSS 4.0 vs EPSS and SSVC triage.
      - Pentest/ASVS acceptance.
  14. **14-expert-topics**
      - Post-quantum migration: hybrid KEX (RFC 10024), ML-DSA certs and harvest-now-decrypt-later.
      - Formal verification of protocols (Tamarin/ProVerif orientation).
      - Workload identity federation (OIDC tokens from CI to cloud, cross-link).
      - Zero-trust architecture (NIST SP 800-207).
      - Privacy engineering (data minimization, GDPR as an EU engineer).
      - Designing an auth system end-to-end (interview capstone).
- **Gotchas & production failure modes**
  1. **JWT validation flaws**:
     - `alg` taken from the header: `none`, or HS256 with the RSA public key as HMAC secret.
     - `aud` not checked, so a token minted for service A is accepted by service B.
     - The ID token is accepted as an access token.
  2. **`kid`/`jku` injection**: the library fetches a JWKS URL from the token header (SSRF plus key substitution). Pin the JWKS URI from AS metadata only.
  3. **JWKS caching**: no cache means you DoS the IdP. An infinite cache means key rotation breaks. You need a cooldown refetch on unknown `kid` (as in `jose` `createRemoteJWKSet`).
  4. **Redirect URI**: prefix or wildcard matching enables code theft via open redirectors. OAuth 2.1 mandates exact string matching (except the loopback port).
  5. **Missing `state`/PKCE/`iss` check**: login CSRF and mix-up attacks in multi-AS clients (RFC 9700 §4.4, RFC 9207).
  6. **Refresh tokens in localStorage**: XSS gives persistent account takeover. Use the BFF or token-mediating backend, or sender-constrain with DPoP. Rotation plus reuse detection revokes the whole family.
  7. **Multi-tenant IdP `iss`**: accepting any tenant's tokens (the `common` endpoint) or trusting unverified `email` claims leads to account takeover ("nOAuth"-class).
  8. **AES-GCM nonce reuse** with a random 96-bit nonce past about 2^32 messages per key, or a counter reset after restart, enables forgery and plaintext XOR leak. Rotate keys or use XChaCha/GCM-SIV.
  9. **Non-constant-time comparison** of HMAC signatures or API keys (`===`) enables a timing oracle. Use `timingSafeEqual` (the lengths must match first).
  10. **bcrypt truncates at 72 bytes**, so pre-hashing with an unpadded hex/base64 of a fast hash changes the semantics. Argon2id params too low (default libs), or too high, which DoSes login under credential stuffing.
  11. **SameSite=Lax default isn't CSRF-complete**: GET with side effects, same-site subdomain takeover and the 2-minute Lax+POST Chrome exception (verify it is still present). Cookie tossing from sibling subdomains is defeated by the `__Host-` prefix.
  12. **CORS misconfiguration**: reflecting `Origin` with `Access-Control-Allow-Credentials: true`; a `null` origin allowed.
  13. **Session fixation**: session ID not rotated on login or privilege change. Logout doesn't revoke server state (stateless JWT, so logout is impossible without a denylist).
  14. **mTLS cert expiry outages**: internal CAs with 1-year certs and no automated rotation. Long-lived trust stores missing a new intermediate. SC-081 makes automation mandatory by 2027–2029.
  15. **Clock skew** between nodes breaks `nbf`/`exp`, DPoP `iat` and TOTP. NTP drift on VMs.
  16. **IDOR/BOLA**: authZ checked at the route level but not object ownership. The #1 API risk (API1:2023) and part of A01:2025.
  17. **SSRF to cloud metadata** (169.254.169.254) via URL fetchers, webhooks and PDF renderers. A DNS-rebinding bypass of allowlists (validate-then-resolve TOCTOU).
  18. **Secrets in logs and errors**: Authorization headers in access logs, stack traces with connection strings (A09/A10). Error paths that fail open (catch → `return true`).
  19. **Zanzibar new-enemy problem**: an ACL removal is propagated after content is added, so the removed user sees new content. You need consistency tokens or `HIGHER_CONSISTENCY` reads in OpenFGA.
  20. **Passkey RP ID mismatch** across subdomains/apps leads to registration on the wrong RP ID, which is unrecoverable. Use a stable registrable domain and the related-origins file for multi-brand setups.
- **Interview hot topics**
  - Design login for an SPA + API + mobile app: code+PKCE, BFF vs public client, refresh rotation, logout.
  - OAuth vs OIDC; access vs ID vs refresh tokens; what PKCE actually prevents.
  - JWT vs opaque tokens and the revocation trade-off; validation checklist (alg allowlist, iss, aud, exp, typ).
  - Sessions and cookies: SameSite, CSRF defenses, XSS impact; where to store tokens in browsers.
  - Hashing vs encryption vs MAC vs signature; why argon2id; salting vs peppering.
  - TLS/mTLS and PKI chain validation; cert rotation at scale.
  - RBAC vs ABAC vs ReBAC; model Google-Docs sharing in Zanzibar/OpenFGA.
  - OWASP Top 10:2025 walk-through with real examples (BOLA, SSRF, injection, supply chain).
  - Passkeys: why they are phishing-resistant; synced vs device-bound; recovery.
  - Threat-model a feature live with STRIDE (e.g., file upload, webhook receiver).
  - Secrets management and key rotation; envelope encryption with KMS.
  - DPoP/mTLS sender-constrained tokens and when bearer tokens are fine.
- **Executable-proof strategy** (`.mise.toml`: `node = "26"`, pnpm; Docker via OrbStack/colima for servers; Vitest)
  - **Crypto** (pure `node:crypto`/WebCrypto, fully deterministic with fixed keys and RFC test vectors):
    - AEAD round-trip, plus tamper → auth-tag failure (negative test).
    - Deterministic **GCM nonce-reuse demo**: recover XOR of plaintexts.
    - HMAC vs naive `sha256(key||msg)` with a length-extension demo (a small TS SHA-256 state-continuation helper).
    - `timingSafeEqual` length behaviour.
    - HKDF vectors from RFC 5869; Ed25519 vectors from RFC 8032; Argon2id vectors from RFC 9106 §5 via `crypto.argon2Sync`.
    - ML-KEM-768 encapsulate/decapsulate round-trip; ML-DSA sign/verify.
  - **PKI**: a fixture script generates a root → intermediate → leaf chain with `openssl` (OpenSSL 3.5+/4.0 pinned; macOS LibreSSL must be rejected by a preflight test) or with `@peculiar/x509` (version to pin at authoring time).
    - Tests validate with `node:tls`/`X509Certificate.verify` and `checkHost`.
    - Negative cases: expired, wrong EKU, missing intermediate, name-constraint violation, SAN mismatch.
    - mTLS server with `requestCert`/`rejectUnauthorized` and client-cert identity extraction.
  - **JOSE** (`jose` 6.2.13):
    - Sign/verify/encrypt.
    - Negative tests: `alg:none`, HS/RS confusion, wrong `aud`/`iss`, expired with clock tolerance, `typ` mismatch, unknown `kid` → JWKS refetch cooldown (local JWKS HTTP server).
  - **OAuth/OIDC**:
    - Primary: **`oidc-provider` 9.13.1** in-process (no Docker; deterministic clock via `@sinonjs/fake-timers` or Vitest fake timers) with the **`oauth4webapi` 3.8.8** client.
    - Tests cover:
      - Code+PKCE happy path and exact redirect-URI rejection.
      - `state` mismatch; PKCE verifier mismatch; mix-up via the `iss` param.
      - Refresh rotation and reuse detection.
      - DPoP-bound tokens (proof with wrong `htu`/`htm`/`ath` → rejected).
      - PAR; client credentials; introspection/revocation.
      - Back-channel logout token validation.
  - **Real-IdP parity**: an optional **Keycloak 26.8.1** container (`quay.io/keycloak/keycloak:26.8.1`, realm imported from JSON) or **Dex v2.46.1** via testcontainers-node. Mark this suite `@docker` and skip it if Docker is absent.
  - **Cookies/CSRF/CORS**: `node:http` app tests with `fetch` asserting `Set-Cookie` attributes, `__Host-` rules, CORS preflight responses and the credentialed-wildcard rejection. Browser-enforced behaviour (SameSite, CHIPS) needs **Playwright** with Chromium/Firefox/WebKit (version to pin at authoring time) on `localhost` vs `127.0.0.1` vs custom `/etc/hosts`-free hostnames (`*.localhost`), and is kept in an opt-in e2e suite.
  - **WebAuthn**:
    - Library: `@simplewebauthn/server` (version to pin at authoring time).
    - Recorded attestation/assertion fixtures.
    - Negative tests: wrong origin, wrong RP ID hash, replayed challenge, UV flag missing when required.
    - Live ceremonies: Playwright + Chromium **virtual authenticator** (CDP `WebAuthn.addVirtualAuthenticator`). Safari/iCloud Keychain sync cannot be automated, so document it manually.
  - **AuthZ**:
    - OpenFGA v1.22.0 container (or in-memory datastore) plus `@openfga/sdk`. Model tests via the `fga model test` CLI YAML (CLI version to pin at authoring time).
    - Cedar via `@cedar-policy/cedar-wasm` 4.14.0: policy evaluation and schema-validation negatives.
    - A hand-rolled RBAC/ABAC evaluator for contrast.
  - **Vulnerability labs**: deliberately vulnerable mini-Express/`node:http` apps (SQLi via PGlite or better-sqlite3, SSRF with a fake metadata server on loopback, IDOR, mass assignment, XXE-free JSON). Each has a **failing exploit test** that passes against the fixed version (red/green pairs).
  - **Supply chain**: a local registry (Verdaccio container, version to pin at authoring time) demonstrating dependency confusion and `npm ci --ignore-scripts`. Provenance verification (`npm audit signatures`) needs the network, so make it opt-in.
  - **Cannot prove locally**: real passkey sync, CT log inclusion, public ACME issuance (fallback: **Pebble**, the Let's Encrypt test ACME server, in Docker), cloud KMS (fallback: a local Vault/OpenBao dev server, or SOPS with age keys), and FAPI conformance (fallback: link the OIDF conformance suite and run it manually).
- **Overlaps / dedupe**
  - Cloud IAM (AWS IAM policies, GCP/Azure RBAC, workload identity federation configuration) is owned by **architecture/cloud-foundations**. This track teaches the generic models and OIDC token exchange and only cross-links.
  - SBOM, artifact signing (Sigstore/cosign), SLSA provenance, CI secret handling and OIDC-to-cloud from pipelines are owned by **technologies/gitlab-ci**. Module 12 gives the concept map plus cross-link only.
  - Kubernetes RBAC, ServiceAccount tokens and NetworkPolicy belong to **technologies/kubernetes**.
  - Container isolation (namespaces, seccomp, rootless, image scanning) belongs to **technologies/containers**.
  - Cloudflare Access/Zero Trust, WAF and edge mTLS belong to **technologies/cloudflare**.
  - Node-specific security (permission model `--permission`, prototype pollution, `vm` is not a sandbox, ReDoS) goes to the **Node.js track**. Python (pickle, Django/FastAPI security) goes to the **Python track**.
  - SQL injection mechanics plus row-level security go to the **SQL track** (this track keeps the vulnerability-class overview).
  - Redis ACL/AUTH and TLS go to the **Redis track**.
  - TLS-on-the-wire (handshake RTTs, ECH, QUIC TLS) is owned by **architecture/networking**. This track owns crypto primitives, X.509 validation, mTLS identity and cert lifecycle.
  - HTTP caching/CDN security (cache poisoning, cache deception) is split: the mechanism lives in networking module 13, and the attack lives here in module 11 with a cross-link.
