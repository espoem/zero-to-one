# Networking Systems Architecture Bilingual Terminology Glossary

This glossary provides authoritative English ↔ Czech definitions of core computer networking concepts, internet protocols, wire formats, congestion control algorithms, transport layer state machines, and Linux kernel networking primitives. All definitions and explanations are written in English, pairing canonical English networking nomenclature with established Czech technical equivalents.

---

## 1. Link Layer, Physical Medium & Packet Framing

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Protocol Data Unit (PDU)** | **Protokolová datová jednotka (PDU)** | The discrete structural unit of data specified in an architectural protocol layer, comprising protocol-control information (headers/trailers) and user payload (e.g., Frame at L2, Packet at L3, Segment/Datagram at L4). | ISO/IEC 7498-1 |
| **Ethernet II Frame** | **Rámec Ethernet II** | The ubiquitous IEEE 802.3 / DIX link-layer framing format consisting of a 14-byte header (6-byte Dst MAC, 6-byte Src MAC, 2-byte EtherType), 46–1500 byte payload, and 4-byte Frame Check Sequence (FCS/CRC-32). | IEEE 802.3 |
| **Content-Addressable Memory (CAM) Table** | **CAM tabulka (tabulka MAC adres přepínače)** | High-speed hardware associative memory in Layer 2 switches mapping physical switch ports and VLANs to learned source MAC addresses with dynamic aging timers. | IEEE 802.1D |
| **IEEE 802.1Q (VLAN Tagging)** | **IEEE 802.1Q (tagování virtuálních sítí VLAN)** | Networking standard that inserts a 4-byte tag into an Ethernet frame (TPID `0x8100` and TCI containing 3-bit Priority Code Point, 1-bit Drop Eligible Indicator, and 12-bit VLAN Identifier) to multiplex logical networks over physical trunk links. | IEEE 802.1Q |
| **Address Resolution Protocol (ARP)** | **Protokol ARP (překlad adres)** | A stateless broadcast protocol used in IPv4 to dynamically map a known 32-bit internet layer IP address to a 48-bit physical link-layer MAC address on a local broadcast domain. | RFC 826 |
| **Neighbor Discovery Protocol (NDP)** | **Protokol zjišťování sousedů (NDP)** | The IPv6 suite running over ICMPv6 that replaces IPv4 ARP, broadcast, and ICMP router discovery using Neighbor Solicitation (Type 135) and Neighbor Advertisement (Type 136) over Solicited-Node Multicast. | RFC 4861 |
| **Maximum Transmission Unit (MTU)** | **Maximální přenosová jednotka (MTU)** | The largest physical packet or frame size (in bytes) that can be traversed across a specific data link without requiring fragmentation (standard Ethernet MTU is 1500 bytes). | RFC 894, RFC 791 |
| **Maximum Segment Size (MSS)** | **Maximální velikost segmentu (MSS)** | The largest amount of TCP application data (in bytes) that a host can receive in a single unfragmented IP packet ($\text{MSS} = \text{MTU} - 20\text{ (IP header)} - 20\text{ (TCP header)}$; typically 1460 bytes for standard IPv4 Ethernet). | RFC 9293 |
| **Path MTU Discovery (PMTUD)** | **Zjišťování MTU přenosové cesty (PMTUD)** | A protocol technique where a host transmits IP packets with the Don't Fragment (DF) bit set and relies on intermediate routers returning ICMP Fragmentation Needed (Type 3, Code 4) messages to iteratively detect the smallest MTU across the entire path. | RFC 1191, RFC 8201 |
| **PMTUD Black Hole** | **Černá díra PMTUD** | A catastrophic network failure mode occurring when intermediate firewalls or middleboxes drop ICMP Type 3 Code 4 error packets; the sender never learns of MTU restrictions and repeatedly retransmits oversized packets that are silently dropped. | RFC 2923 |
| **Bandwidth-Delay Product (BDP)** | **Součin šířky pásma a zpoždění (BDP)** | The product of link transmission capacity and round-trip delay ($\text{BDP} = \text{Bandwidth} \times \text{RTT}$), representing the maximum volume of in-flight unacknowledged data required to completely saturate the link. | Network Architecture Theory |
| **Spanning Tree Protocol (STP)** | **Protokol kostry sítě (STP)** | A link-layer loop prevention protocol (IEEE 802.1D / 802.1w RSTP) that builds a loop-free logical topology by systematically blocking redundant physical switch ports. | IEEE 802.1D, IEEE 802.1w |

---

## 2. Network Layer, Addressing & IP Routing

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Classless Inter-Domain Routing (CIDR)** | **Beztřídní směrování mezi doménami (CIDR)** | An IP addressing scheme allocating variable-length prefix masks (`/n`) to replace legacy Class A, B, and C networks, preventing IP address depletion and enabling hierarchical route aggregation. | RFC 1519, RFC 4632 |
| **Variable Length Subnet Masking (VLSM)** | **Maska podsítě s proměnnou délkou (VLSM)** | The design practice of subdividing an assigned IP address block into hierarchically sized subnets of varying prefix lengths to match host density and minimize wasted IP space. | RFC 1878 |
| **Longest Prefix Match (LPM)** | **Pravidlo nejdelší shody prefixu (LPM)** | The fundamental IP forwarding algorithm where a router inspects multiple matching route prefixes in its forwarding table and forwards the packet via the route entry with the highest number of matching leading prefix bits. | RFC 1812 |
| **Forwarding Information Base (FIB)** | **Báze přeposílacích informací (FIB)** | The compiled, hardware-optimized data structure (often instantiated in TCAM memory on ASICs) programmed by the control plane routing engine for wire-rate packet forwarding. | Router Architecture Theory |
| **Routing Information Base (RIB)** | **Báze směrovacích informací (RIB)** | The control-plane database maintaining all candidate routes learned from static configurations and dynamic routing protocols (BGP, OSPF, IS-IS) before the best routes are selected and installed into the FIB. | RFC 4271 |
| **Equal-Cost Multi-Path (ECMP)** | **Rovnocenné vícecestné směrování (ECMP)** | A routing forwarding strategy that balances traffic across multiple next-hop paths of identical administrative metric by hashing packet headers (Layer 3/4 5-tuple). | RFC 2991 |
| **Time-to-Live (TTL) / Hop Limit** | **Doba života paketu (TTL / Hop Limit)** | An 8-bit counter in the IPv4 header (Hop Limit in IPv6) decremented by 1 at every router hop; when the value reaches 0, the packet is discarded and an ICMP Time Exceeded packet is returned, preventing indefinite routing loops. | RFC 791, RFC 8200 |
| **Internet Control Message Protocol (ICMP)** | **Protokol internetových řídicích zpráv (ICMP)** | Supporting protocol used by network devices to send diagnostic messages, operational notifications, and error conditions (such as Echo Request/Reply, Destination Unreachable, and Time Exceeded). | RFC 792, RFC 4443 |
| **Happy Eyeballs v2** | **Algoritmus Happy Eyeballs v2** | An algorithmic connection algorithm (RFC 8305) implemented in dual-stack client applications that initiates an IPv6 connection attempt first, followed by an IPv4 attempt after a 250–300 ms head-start, selecting whichever completes first to avoid user stalls on broken IPv6 paths. | RFC 8305 |

---

## 3. Internet Peering, Autonomous Systems & BGP

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Autonomous System (AS)** | **Autonomní systém (AS)** | A connected group of IP networks and routers managed under a common technical administrative domain with a coherent internal routing policy, identified globally by an Autonomous System Number (ASN). | RFC 1930 |
| **Default-Free Zone (DFZ)** | **Zóna bez výchozího směrování (DFZ)** | The core collection of internet backbone routers that maintain an explicit, full global BGP routing table (~950,000+ prefixes) without relying on any default gateway route (`0.0.0.0/0`). | Internet Architecture |
| **Border Gateway Protocol (BGP-4)** | **Směrovací protokol BGP-4** | The standard de-facto exterior path-vector routing protocol operating over TCP port 179 that exchanges reachability information, prefix policies, and AS paths across Autonomous Systems. | RFC 4271 |
| **AS_PATH Attribute** | **Atribut AS_PATH** | A mandatory well-known BGP attribute recording the sequential list of Autonomous System numbers traversed by a route advertisement, utilized for loop prevention and distance vector evaluation. | RFC 4271 |
| **LOCAL_PREF Attribute** | **Atribut LOCAL_PREF (místní preference)** | A well-known discretionary BGP attribute passed only within an autonomous system (iBGP) to designate route preference; higher numerical values take precedence over all downstream BGP metrics including `AS_PATH`. | RFC 4271 |
| **Multi-Exit Discriminator (MED)** | **Rozlišovač vícenásobného výstupu (MED)** | An optional non-transitive BGP attribute conveyed to external peers indicating the preferred ingress link into the advertising autonomous system when multiple peering connections exist; lower values win. | RFC 4271 |
| **Resource Public Key Infrastructure (RPKI)** | **Infrastruktura veřejných klíčů pro internetové zdroje (RPKI)** | A specialized X.509 PKI framework managed by Regional Internet Registries (RIRs) allowing resource holders to cryptographically bind IP address blocks to authorized originating ASNs. | RFC 6480 |
| **Route Origin Authorization (ROA)** | **Oprávnění původu cesty (ROA)** | A cryptographically signed digital object within RPKI certifying that a designated ASN is officially authorized to advertise a specific IP prefix up to a defined maximum length. | RFC 6482 |
| **Route Origin Validation (ROV)** | **Ověření původu cesty (ROV)** | The validation mechanism where BGP border routers evaluate received route announcements against cryptographically verified ROA caches, classifying routes as Valid, Invalid, or NotFound, and dropping Invalid announcements. | RFC 6811 |
| **BGP Prefix Hijack** | **Únos BGP prefixu (BGP hijack)** | A network attack where a malicious or misconfigured autonomous system illicitly advertises IP prefixes it does not own (or advertises a more-specific sub-prefix), rerouting victim traffic to the attacker. | RFC 7454 |
| **Anycast Routing** | **Anycastové směrování** | A network addressing and routing practice where the identical unicast IP address is simultaneously assigned to and advertised from multiple geographically distributed server locations via BGP, routing clients to the topologically nearest node. | RFC 4786 |

---

## 4. Transport Layer & Socket Programming

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **User Datagram Protocol (UDP)** | **Protokol uživatelských datagramů (UDP)** | A minimal, connectionless, stateless Layer 4 transport protocol (RFC 768) providing best-effort unacknowledged packet delivery with an 8-byte header and optional (IPv4) or mandatory (IPv6) checksum integrity. | RFC 768 |
| **Transmission Control Protocol (TCP)** | **Protokol řízení přenosu (TCP)** | A connection-oriented, reliable, bidirectional byte-stream transport protocol (RFC 9293) providing in-order delivery, flow control, retransmission, and congestion control over an unreliable internetwork. | RFC 9293 |
| **Berkeley Sockets API** | **Rozhraní soketů Berkeley (POSIX sockets)** | The canonical operating system C programming interface (`socket`, `bind`, `listen`, `accept`, `connect`, `send`, `recv`) for network inter-process communication. | POSIX.1-2017 |
| **Epoll (Event Poll)** | **Systémové volání epoll** | The Linux scalable I/O event notification facility ($O(1)$ complexity via kernel red-black tree and ready list) monitoring multiple file descriptors for readiness in level-triggered or edge-triggered modes. | Linux Kernel Documentation |
| **SO_REUSEPORT** | **Příznak SO_REUSEPORT** | A socket option allowing multiple independent server processes or worker threads to bind to the identical IP and port, with the kernel automatically load-balancing incoming connection handshakes across sockets. | Linux Kernel Documentation |
| **Listen Backlog & Accept Queue** | **Fronta naslouchání a fronta spojení (Accept Queue)** | Operating system kernel queues managing connection establishment: the incomplete connection queue (half-open SYN state) and the completed connection queue (ESTABLISHED state awaiting `accept()`). | RFC 9293 |
| **Initial Sequence Number (ISN)** | **Počáteční sekvenční číslo (ISN)** | A 32-bit pseudorandom number chosen by a TCP endpoint during the 3-way handshake, generated via cryptographic hashing (RFC 6528) to prevent sequence number prediction and connection hijacking attacks. | RFC 6528, RFC 9293 |
| **TCP Window Scale Option** | **Volba škálování TCP okna (Window Scale)** | An option negotiated during the TCP handshake (RFC 7323) defining a scale factor (up to 14 bits), allowing the effective receive window to expand from 64 KB up to 1 GB for high BDP networks. | RFC 7323 |
| **Selective Acknowledgment (SACK)** | **Selektivní potvrzování (SACK)** | A TCP option (RFC 2018) allowing a receiver to inform the sender of non-contiguous blocks of successfully arrived data, avoiding inefficient Go-Back-N retransmissions of data already received. | RFC 2018 |
| **RACK-TLP (Recent ACK & Tail Loss Probe)** | **Algoritmus RACK-TLP (detekce ztrát)** | Modern TCP loss detection algorithm (RFC 8985) that replaces duplicate ACK thresholds with time-based reordering tracking and transmits speculative tail-loss probes to prevent costly RTO timeouts on stream ends. | RFC 8985 |
| **Nagle's Algorithm** | **Nagleův algoritmus** | A sender-side TCP optimization (RFC 896) that inhibits transmission of small data packets ($< \text{MSS}$) if previously transmitted segments remain unacknowledged, coalescing small writes to prevent packet header bloat. | RFC 896 |
| **Delayed Acknowledgment** | **Opožděné potvrzování (Delayed ACK)** | A receiver-side TCP optimization (RFC 1122) delaying ACK transmission by up to 40–200 ms to piggyback the ACK on outgoing application responses or acknowledge multiple packets in a single frame. | RFC 1122 |
| **TIME_WAIT State** | **Stav TIME_WAIT** | The final terminal state of the active TCP closer maintained for $2 \times \text{MSL}$ (typically 60s) to guarantee the final ACK was delivered and ensure lingering duplicate packets expire before the 4-tuple is reused. | RFC 9293 |
| **TCP SYN Cookie** | **Technika TCP SYN cookies** | A cryptographic defense against SYN flood attacks (RFC 4987) where connection state is encoded into the Initial Sequence Number of the SYN-ACK, eliminating the need to allocate kernel memory for half-open sockets. | RFC 4987 |

---

## 5. Congestion Control & Queue Management

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Additive Increase / Multiplicative Decrease (AIMD)** | **Lineární nárůst / multiplikativní pokles (AIMD)** | A feedback control algorithm where transmission window increases linearly ($W \leftarrow W + 1$) during absence of congestion and decreases multiplicatively ($W \leftarrow W \times \beta$) upon packet loss, guaranteeing convergence to efficiency and fairness. | Chiu & Jain (1989) |
| **Slow Start** | **Fáze pomalého startu (Slow Start)** | The initial TCP congestion control phase where the congestion window (`cwnd`) doubles every round-trip time ($W \leftarrow W \times 2$) to rapidly probe link capacity until reaching `ssthresh`. | RFC 5681 |
| **CUBIC Congestion Control** | **Algoritmus řízení zahlcení CUBIC** | The default Linux loss-based congestion control algorithm (RFC 9438) that sizes the congestion window as a cubic function of time elapsed since the last packet drop, decoupling window growth from RTT. | RFC 9438 |
| **BBR (Bottleneck Bandwidth and RTT)** | **Algoritmus řízení zahlcení BBR** | A model-based congestion control algorithm that continuously measures bottleneck delivery rate ($\text{BtlBw}$) and minimum propagation delay ($\text{RTprop}$), maintaining queue occupancy near zero without requiring buffer loss. | Cardwell et al. (ACM Queue 2016) |
| **Bufferbloat** | **Přebufrování sítě (Bufferbloat)** | High latency and packet jitter caused by excessively large, unmanaged FIFO packet buffers in intermediate routers and network switches that delay packets rather than dropping them when links saturate. | Gettys & Nichols (ACM Queue 2011) |
| **Active Queue Management (AQM)** | **Aktivní správa front (AQM)** | Algorithmic router buffer management (e.g. CoDel, RED, PIE) that proactively drops or marks packets before physical queues overflow to signal endpoints to throttle congestion windows. | RFC 7567 |
| **Controlled Delay (CoDel)** | **Algoritmus CoDel (řízené zpoždění)** | A parameterless AQM algorithm that tracks packet queue residence delay rather than queue length, dropping packets only when delay persists above a target threshold (typically 5 ms) for an interval. | Nichols & Jacobson (RFC 8289) |
| **Explicit Congestion Notification (ECN)** | **Explicitní notifikace zahlcení (ECN)** | An extension to IP and TCP (RFC 3168) allowing intermediate routers to mark IP header bits (`CE = 0b11`) to notify endpoints of incipient congestion without dropping packets. | RFC 3168 |
| **Low Latency, Low Loss, and Scalable Throughput (L4S)** | **Architektura L4S (nízká latence a škálovatelná propustnost)** | An internet architecture (RFC 9330) using the `ECT(1)` ECN codepoint and DualQ Coupled AQM to achieve sub-millisecond queueing delay and zero packet loss for scalable congestion controls (Prague). | RFC 9330 |

---

## 6. Domain Name System (DNS) & Wire Formats

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Authoritative Name Server** | **Autoritativní jmenný server** | A DNS server holding the definitive, authentic master records for a specific domain zone (e.g. `example.com`), answering queries without recursion. | RFC 1034, RFC 1035 |
| **Recursive Resolver** | **Rekurzivní resolver (překladač)** | A DNS caching server that accepts client queries and performs iterative lookups across root, TLD, and authoritative servers to assemble the final answer. | RFC 1034 |
| **DNS Compression Pointer** | **DNS kompresní ukazatel** | A 2-byte wire format mechanism where domain labels can be replaced by a pointer (`0b11` in highest 2 bits followed by 14-bit byte offset) referencing earlier identical domain names in the DNS message. | RFC 1035 §4.1.4 |
| **Extension Mechanisms for DNS (EDNS0)** | **Rozšiřující mechanismy pro DNS (EDNS0)** | An extension framework (RFC 6891) transmitting an `OPT` pseudo-resource record in the Additional section to advertise client buffer sizes ($> 512$ bytes), DNSSEC flags (`DO`), and client subnets. | RFC 6891 |
| **HTTPS Resource Record (SVCB / HTTPS)** | **Záznam HTTPS (RFC 9460)** | A standardized DNS record format allowing zone apex aliasing and advertising service parameters (supported ALPN protocols like `h2,h3`, port numbers, and ECH keys) in a single query. | RFC 9460 |
| **DNSSEC (DNS Security Extensions)** | **Bezpečnostní rozšíření DNS (DNSSEC)** | A suite of specifications (RFC 4033–4035) providing cryptographic origin authentication and data integrity to DNS records using public-key digital signatures. | RFC 4033, RFC 4034, RFC 4035 |
| **Key Signing Key (KSK)** | **Klíč pro podepisování klíčů (KSK)** | An asymmetric public-private key pair in DNSSEC used exclusively to sign the Zone Signing Keys (ZSKs) within a zone; the public KSK hash is published in the parent zone's DS record. | RFC 4034 |
| **Delegation Signer (DS) Record** | **Záznam delegovaného podpisovatele (DS)** | A DNSSEC record residing in a parent zone containing the cryptographic SHA-256 hash of a child zone's public KSK, establishing the chain of trust. | RFC 4034 |
| **Resource Record Signature (RRSIG)** | **Digitální podpis sady záznamů (RRSIG)** | The DNSSEC record containing the cryptographic digital signature covering an entire Resource Record Set (RRset) validated via the zone's DNSKEY. | RFC 4034 |
| **NSEC / NSEC3** | **Autentizované popření existence (NSEC / NSEC3)** | DNSSEC records providing authenticated denial of existence for queries returning `NXDOMAIN`, using hashed domain order (NSEC3) to prevent zone-walking attacks. | RFC 4034, RFC 5155 |
| **DNS over TLS (DoT)** | **DNS přes TLS (DoT)** | Encapsulating standard DNS queries and answers inside dedicated TLS tunnels over TCP port 853 to protect user privacy against network eavesdropping. | RFC 7858 |
| **DNS over HTTPS (DoH)** | **DNS přes HTTPS (DoH)** | Encapsulating DNS wireformat messages within HTTP/2 or HTTP/3 HTTPS requests over TCP port 443, disguising DNS traffic as standard encrypted web traffic. | RFC 8484 |

---

## 7. Transport Layer Security & Cryptography on the Wire

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Transport Layer Security (TLS 1.3)** | **Zabezpečení transportní vrstvy (TLS 1.3)** | Modern cryptographic transport protocol (RFC 8446) providing confidentiality, authenticity, and integrity with a 1-RTT handshake and mandatory forward-secret AEAD ciphers. | RFC 8446 |
| **Authenticated Encryption with Associated Data (AEAD)** | **Autentizované šifrování s přidruženými daty (AEAD)** | A symmetric cryptographic scheme (e.g. AES-128-GCM, ChaCha20-Poly1305) that simultaneously guarantees both confidentiality and ciphertext integrity in a single pass. | RFC 5116 |
| **Perfect Forward Secrecy (PFS)** | **Dopředná bezpečnost (PFS)** | A cryptographic property ensuring that compromise of a long-term server private key does not compromise the confidentiality of historical recorded session traffic, guaranteed by ephemeral DH keys. | Cryptographic Architecture |
| **HKDF (HMAC-based Key Derivation Function)** | **Funkce odvozování klíčů založená na HMAC (HKDF)** | A two-step cryptographic key derivation algorithm (HKDF-Extract and HKDF-Expand, RFC 5869) underlying the TLS 1.3 key schedule to generate independent handshake and application traffic keys. | RFC 5869, RFC 8446 |
| **0-RTT Early Data** | **Přenos dat v nultém okruhu (0-RTT Early Data)** | A TLS 1.3 optimization allowing clients to transmit application data alongside the initial `ClientHello` using pre-shared keys (PSK), vulnerable to network replay attacks if not idempotently constrained. | RFC 8446, RFC 8470 |
| **Encrypted Client Hello (ECH)** | **Šifrované uvítání klienta (ECH)** | An extension to TLS 1.3 (RFC 9849) encrypting the inner ClientHello (including SNI and sensitive extensions) using the server's public key published in DNS HTTPS records, concealing the visited hostname from middleboxes. | RFC 9849 |
| **Post-Quantum Hybrid Key Exchange** | **Postkvantová hybridní výměna klíčů** | A cryptographic mechanism combining a classical algorithm (X25519) with a post-quantum lattice-based key encapsulation mechanism (e.g. ML-KEM-768 / Kyber, RFC 10024) to secure traffic against future quantum decryption. | RFC 10024 |

---

## 8. Modern Web Application Protocols & Streaming

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Chunked Transfer Encoding** | **Počástečkované kódování přenosu (Chunked Encoding)** | An HTTP/1.1 streaming mechanism (`Transfer-Encoding: chunked`) where a message payload is serialized as a series of size-prefixed chunks, terminated by a zero-sized chunk (`0\r\n\r\n`). | RFC 9112 |
| **HTTP Request Smuggling** | **Podstrčení HTTP požadavku (Request Smuggling)** | A critical web vulnerability where desynchronization between a front-end proxy and backend server parsing `Content-Length` vs `Transfer-Encoding` (CL.TE / TE.CL) allows an attacker to inject invisible request prefixes. | PortSwigger / RFC 9112 |
| **HTTP/2 Binary Framing Layer** | **Binární rámcová vrstva HTTP/2** | The framing specification (RFC 9113) that partitions HTTP messages into discrete binary frames (HEADERS, DATA, SETTINGS, RST_STREAM) with a fixed 9-byte header, multiplexing multiple concurrent streams over a single TCP connection. | RFC 9113 |
| **HPACK Header Compression** | **Komprese hlaviček HPACK** | A header compression format (RFC 7541) utilizing static tables, sliding dynamic tables, and static Huffman coding to minimize repetitive HTTP header overhead in HTTP/2. | RFC 7541 |
| **HTTP/2 Rapid Reset Attack** | **Útok rychlým resetem streamů (Rapid Reset, CVE-2023-44487)** | A distributed denial of service attack where an attacker pipelines millions of `HEADERS` frames followed immediately by `RST_STREAM` frames, exhausting server CPU without exceeding concurrency limits. | CVE-2023-44487 |
| **QUIC Protocol** | **Protokol QUIC** | A multiplexed, encrypted, connection-oriented transport protocol (RFC 9000) running over UDP that integrates TLS 1.3, independent stream flow control, and Connection ID mobility. | RFC 9000 |
| **Connection ID (CID)** | **Identifikátor spojení (CID)** | An explicit identifier in QUIC headers decoupling the connection identity from the IP/Port 4-tuple, enabling seamless connection migration when networks switch (e.g. Wi-Fi to LTE). | RFC 9000 |
| **QPACK Header Compression** | **Komprese hlaviček QPACK** | The header compression mechanism (RFC 9204) designed for HTTP/3 over QUIC that avoids head-of-line blocking by decoupling dynamic table references across independent byte streams. | RFC 9204 |
| **WebSocket Framing (RFC 6455)** | **Rámcová struktura WebSocket (RFC 6455)** | A persistent, full-duplex framing protocol initiated via an HTTP 101 Switching Protocols upgrade, requiring client-to-server payloads to be masked with a 32-bit XOR key to protect intermediate caches. | RFC 6455 |
| **Server-Sent Events (SSE)** | **Události odesílané serverem (SSE)** | A unidirectional streaming web standard (`text/event-stream`) allowing servers to push text event lines to clients with automatic reconnection and `Last-Event-ID` tracking. | W3C Recommendation |
| **gRPC Length-Prefixed Message** | **Zpráva s délkou předpony v gRPC** | The binary framing standard in gRPC where each serialized Protocol Buffer payload is preceded by a 5-byte header (1 byte compression flag + 4 bytes Big-Endian message length) within HTTP/2 DATA frames. | gRPC Specification |

---

## 9. Load Balancing, Edge Caching & Linux Kernel Operations

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Direct Server Return (DSR)** | **Přímá odpověď serveru (DSR)** | A Layer 4 load balancing technique where incoming packets have only their destination MAC address rewritten to the backend server; backend servers transmit responses directly to clients via their default gateway, bypassing the load balancer. | L4 Load Balancing Architecture |
| **Maglev Consistent Hashing** | **Konzistentní hašování Maglev** | A lookup-table consistent hashing algorithm developed by Google using prime-sized permutation tables to distribute packet 5-tuples across backends with minimal churn upon node membership changes. | Eisenbud et al. (NSDI 2016) |
| **PROXY Protocol** | **Protokol PROXY** | A protocol created by HAProxy (v1 text, v2 binary) that prepends client connection metadata (source IP, destination IP, ports) to a newly opened TCP stream to pass client identity through Layer 4 proxies. | HAProxy Specification |
| **RFC 9111 HTTP Caching** | **Standard HTTP mezipamětí (RFC 9111)** | The authoritative specification governing web and CDN caching directives, including `Cache-Control`, `max-age`, `stale-while-revalidate`, `no-store`, and cache validation via ETags / `If-None-Match`. | RFC 9111 |
| **STUN / TURN / ICE** | **Technologie překonávání NAT (STUN / TURN / ICE)** | The suite of IETF protocols (Session Traversal Utilities for NAT, Traversal Using Relays around NAT, and Interactive Connectivity Establishment) used by WebRTC and VoIP to discover public IP mappings and establish peer connections across NATs. | RFC 8489, RFC 8656, RFC 8445 |
| **Network Namespace (`netns`)** | **Síťový jmenný prostor (netns)** | A Linux kernel isolation feature providing a virtualized instance of the network subsystem, containing private network devices, IP routing tables, ARP caches, socket lists, and firewall rule chains. | Linux Kernel Documentation |
| **Virtual Ethernet (`veth`)** | **Virtuální ethernetový pár (veth)** | A pair of interconnected virtual Ethernet network interfaces in Linux acting like a bidirectional virtual patch cable, connecting network namespaces to host bridges. | Linux Kernel Documentation |
| **Netfilter & Nftables** | **Subsystém Netfilter a nástroj nftables** | The Linux kernel packet-filtering subsystem providing packet interception hooks (PREROUTING, INPUT, FORWARD, OUTPUT, POSTROUTING) and an efficient in-kernel bytecode virtual machine with $O(1)$ set lookups. | Linux Netfilter Project |
| **Connection Tracking (`conntrack`)** | **Sledování stavu spojení (conntrack)** | The Netfilter module tracking active 5-tuple network conversations in a kernel hash table, enabling stateful firewall inspection and Network Address Translation (NAT). | Linux Kernel Documentation |
| **Traffic Control (`tc netem`)** | **Řízení provozu a emulace sítě (tc netem)** | The Linux kernel queueing discipline framework used to emulate wide-area network impairments including packet delay, jitter, loss, duplication, and bandwidth throttling. | Linux iproute2 / tc |
