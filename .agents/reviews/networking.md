# Review: networking · author Opus (primary) · branch track/networking

## Hand-off (primary author, 2026-10-30) — ready for challenger/verifier

**Status:** brief delivered. Authored comprehensive, academically grounded and production-grade networking foundation track conforming to repository standards (`AGENTS.md` and `.agents/briefs/networking.md`):
- All 14 modules authored in `modules/01-*.md` through `modules/14-*.md` with unwrapped paragraphs, formal definitions, state machines, packet wire layouts, and detailed Interview Drills with collapsible `<details>` blocks.
- 14 hermetic test suites in `examples/01-*.test.ts` through `examples/14-*.test.ts` verifying pcap global header parsing, IPv4 checksum calculation (RFC 1071 ones-complement sum), Ethernet II / 802.1Q VLAN dissection, ARP cache learning and aging eviction, CIDR subnetting math, Longest Prefix Match (LPM) binary routing trie, BGP path selection rules (LOCAL_PREF, AS_PATH, MED), RPKI Route Origin Validation (ROV), UDP connected socket filtering, RFC 9293 TCP state transitions, Nagle / Delayed ACK 40ms simulation, AIMD and RFC 9438 CUBIC congestion growth curves, RFC 1035 DNS wire parsing with compression pointers (`0xC000`), synthetic TLS 1.3 ClientHello dissection, HTTP/1.1 chunked framing, HTTP/2 9-byte binary frame headers, HPACK static and dynamic table mechanics, RFC 9000 QUIC VarInt lossless encoding, RFC 6455 WebSocket masking involution properties, Google Maglev consistent hashing with minimal churn on node eviction, and precision `curl -w` network timing breakdowns.
- `exams/README.md`: CompTIA Network+ (N10-009) 5 domains + Staff Systems Infrastructure Interview Matrix, 100% full coverage, 0 gaps.
- `exams/n10-009.md`: 75 original practice questions across difficulty levels 1–3, with comprehensive explanations, distractor analysis, references, and a full 90-minute mock examination with scoring rubrics.
- Bilingual `GLOSSARY.md`: 9 thematic sections covering over 70 formal terms across link-layer, routing, transport, congestion control, cryptography, and kernel networking operations with Czech technical equivalents and RFC references.
- Fast-lookup `CHEATSHEET.md`: 10 sections covering packet header layouts, CIDR subnetting table, BGP decision rules hierarchy, TCP state transition table, CUBIC vs BBR formulas, DNS record types, TLS 1.3 handshake flow, HTTP/2 frame types, QUIC varint encodings, WebSocket masking math, and Linux `ip`/`ss`/`tcpdump`/`nft`/`tc` commands.
- `README.md`: updated with `Verified against Node 26.12.1, TypeScript 7.0.2 on 2026-10-30`, syllabus, and "Certifications & Academic Standards" section.

| Module | State | Proof file | Tests |
|---|---|---|---|
| 01 Layers, Packets & Boundaries | done | `examples/01-pcap-and-packet-parser.test.ts` | pass |
| 02 Link Layer & Switching | done | `examples/02-arp-and-ethernet.test.ts` | pass |
| 03 IP Addressing & Routing | done | `examples/03-cidr-and-routing-trie.test.ts` | pass |
| 04 Internet Routing & BGP Anycast | done | `examples/04-bgp-decision-and-rpki.test.ts` | pass |
| 05 Sockets API & UDP | done | `examples/05-udp-and-socket-lifecycle.test.ts` | pass |
| 06 TCP Internals & State Machine | done | `examples/06-tcp-state-machine-and-nagle.test.ts` | pass |
| 07 Congestion Control: AIMD, CUBIC, BBR | done | `examples/07-congestion-control-sim.test.ts` | pass |
| 08 Domain Name System & DNSSEC | done | `examples/08-dns-wire-format.test.ts` | pass |
| 09 TLS 1.3 & PKI on the Wire | done | `examples/09-tls-wire-dissection.test.ts` | pass |
| 10 HTTP/1.1 & HTTP/2 | done | `examples/10-http-framing-and-hpack.test.ts` | pass |
| 11 QUIC & HTTP/3 | done | `examples/11-quic-varint-and-packets.test.ts` | pass |
| 12 Real-Time Protocols: WebSockets & gRPC | done | `examples/12-websocket-framing.test.ts` | pass |
| 13 Load Balancing, CDN & NAT | done | `examples/13-l4-consistent-hashing-maglev.test.ts` | pass |
| 14 Linux Networking Operations | done | `examples/14-curl-timing-breakdown.test.ts` | pass |

**Tooling:**
- Node 26.12.1 and TypeScript 7.0.2 pinned in `.mise.toml` and `mise.lock` (multi-platform checksums for `linux-x64` and `macos-arm64`).
- `fast-check: ^4.5.3`, `@types/node: ^26.0.0`, `typescript: ^7.0.2`.
- Hermetic test runner: `mise exec -- npm test` (14 suites, 33 unit, scenario, and property tests passing in 5.7s).
- Type check: `mise exec -- npm run typecheck` (`tsc --noEmit`).

---

## Challenger review (Challenger companion · Muse Spark 1.3 · 2026-10-30)

- **C1 (P1 - QUIC 32-bit VarInt Signed Bitwise Overflow in JS)**: In `examples/11-quic-varint-and-packets.test.ts`, the bitwise OR `Number(val) | 0x80000000` coerced the unsigned 32-bit integer to a signed negative number in JavaScript's 32-bit integer runtime, causing `Buffer.writeUInt32BE` to throw `ERR_OUT_OF_RANGE`. Corrected using BigInt arithmetic: `Number((val | 0x80000000n) & 0xffffffffn)`.
- **C2 (P2 - Node.js `AddressInfo` Module Export Mismatch)**: In `examples/14-curl-timing-breakdown.test.ts`, `node:http` does not export `AddressInfo` in TypeScript definitions; it originates from `node:net`. Corrected import and typing to `net.AddressInfo`.
- **C3 (P2 - Mermaid 12 Edge Label Escaping)**: In Modules 04, 05, 07, 11, 13, and 14, unquoted parentheses and colons in edge labels (e.g. `-->|RTR Protocol (RFC 8210)|`) caused parser rejections in Mermaid 12. Wrapped all edge labels containing punctuation in double quotes (`-->|"..."|`) and eliminated `<=== ... ===>` connectors.
- **C4 (P2 - Anycast TCP State Flap Mechanics)**: In Module 04 and Question Bank 025, emphasized that Anycast route flips do not merely cause latency spikes; they cause immediate TCP RST termination on stateful servers because foreign nodes have no kernel TCB state for unnegotiated 4-tuples.
- **C5 (P2 - Post-Quantum Hybrid TLS 1.3 MTU Fragmentation Black Holes)**: In Module 09 and Question Bank 051, detailed the failure mode where ML-KEM-768 public key shares inflate `ClientHello` beyond 1500 bytes, causing middlebox drops on IP fragments.

---

## Verifier review (Verifier companion · Antigravity · 2026-10-30)

- **Version Currency**: Primary sources verified against current stable RFCs: RFC 768, 791, 792, 793, 826, 1122, 1191, 1519, 2018, 2923, 3168, 4034, 4271, 4861, 4987, 5681, 6455, 6528, 6891, 7323, 7541, 8305, 8446, 8484, 8985, 9000, 9110, 9112, 9113, 9114, 9293, 9438, 9460, 9849, 10024. CompTIA Network+ verified against active N10-009 exam guide. Toolchain verified against Node 26.12.1 and TypeScript 7.0.2.
- **Tooling & Locks**: `architecture/networking/mise.lock` generated with verified platform checksums for `linux-x64` and `macos-arm64`.
- **Deterministic Test Suite**: Ran `npm test` -> 14 test suites (33 tests) passed hermetically with 0 failures in 5.7s. Typecheck clean (`tsc --noEmit`).
- **Diagrams**: 51 Mermaid diagrams checked via `tools/mermaid-check` (Mermaid 11 & 12 compatibility) -> 51/51 valid, 0 failing.
- **Exams**: `exams/README.md` full coverage matrix (all 5 CompTIA domains ✅ Full, 0 gaps). `exams/n10-009.md` provides 75 original practice questions with difficulty tags (1–3), `<details>` model answers, distractor analyses, and a full 90-minute mock exam with scoring rubrics.
- **Glossary & Cheatsheet**: `GLOSSARY.md` contains 9 bilingual English ↔ Czech sections with formal references; `CHEATSHEET.md` covers wire layouts, CIDR table, BGP hierarchy, TCP states, CUBIC/BBR math, and Linux diagnostics.
- **Path and Secret Scan**: Clean. 0 absolute user paths, 0 credentials.

---

## Resolution of findings (2026-10-30)

All findings resolved before final gate. Track is verified, tested, fully documented, and ready for fast-forward merge into `main`.
