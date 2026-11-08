# Senior Systems Engineering Networking Technical Interview Preparation Bank

This question bank provides an exhaustive, interview-grade preparation reference for Senior Site Reliability Engineers (SRE), Network Infrastructure Engineers, and Cloud Systems Architects. Every question is grounded in production failure modes, low-level packet mechanics, RFC specifications, and operating system kernel realities.

---

## Domain Breakdown & Matrix

| Domain | Focus Concepts | Question Count | Difficulty Spread (1–3) |
| :-- | :-- | :-: | :-: |
| **Domain 1: Architecture & Models** | OSI 7-Layer, TCP/IP Suite, Packet Switching, Encapsulation, MTU/Fragmentation, MAC vs. IP | 12 | 3 / 6 / 3 |
| **Domain 2: Protocols & Transport** | TCP Handshake, UDP, QUIC & HTTP/3, ICMP, ARP, TLS 1.3 | 12 | 2 / 6 / 4 |
| **Domain 3: Addressing & Routing** | IPv4/IPv6, CIDR/LPM, NAT/PAT, DHCP DORA, BGP-4, Anycast & Multicast | 12 | 2 / 7 / 3 |
| **Domain 4: Resolution & Web Protocols** | DNS Hierarchy, Reverse Proxy vs. LB, CDNs, WebSockets, gRPC/HTTP-2, CORS | 12 | 3 / 6 / 3 |
| **Domain 5: Security & Infrastructure** | Zero Trust & mTLS, WireGuard, Firewall vs. WAF, Token Bucket, QoS/Shaping, VXLAN | 12 | 2 / 6 / 4 |
| **Total Practice Bank** | **All 30 Must-Know Networking Concepts** | **60** | **12 / 31 / 17** |

---

## Domain 1: Architecture & Structural Models

### Q-INT-001 · Architecture & Models · difficulty 1 · single

In modern production systems, why is the OSI 7-layer model considered a descriptive taxonomy rather than an exact software implementation architecture?

- A) OSI protocols were computationally too intensive for early 32-bit CPU architectures.
- B) The Presentation and Session layers were merged into application-space libraries, while kernel networking implemented the pragmatic 4-layer TCP/IP suite.
- C) Modern network interface cards (NICs) bypass Layer 3 and Layer 4 entirely via RDMA.
- D) The IEEE 802 committee formally superseded the OSI framework with IEEE 802.3.

<details><summary>Answer</summary>

**B.** The OSI model defines theoretical separation of concerns, but operating system kernels (UNIX, Linux, Windows) evolved on the pragmatic 4-layer TCP/IP suite (RFC 1122). Layers 5 (Session) and 6 (Presentation) were never realized as kernel abstractions; instead, session management, compression, and encryption (TLS) run in user-space runtimes. Furthermore, performance optimizations deliberately blur layer boundaries: NICs perform L4 TCP Segmentation Offload (TSO) and L3 checksumming in hardware.

- Why not A: OSI software suites (CLNP, FTAM) ran on early systems but lost commercial adoption to simpler IP implementations.
- Why not C: RDMA bypasses kernel socket layers for memory transfers, but internet traffic predominantly traverses IP/TCP stacks.
- Why not D: IEEE 802 defines link-layer standards (802.3 Ethernet, 802.11 Wi-Fi), which map directly to OSI Layer 2.
- Ref: [modules/01-layers-and-packets.md](../modules/01-layers-and-packets.md#1-architectural-models-osi-reference-vs-tcpip-implementation), Kurose & Ross 9th ed., Section 1.5.

</details>

### Q-INT-002 · Architecture & Models · difficulty 2 · scenario

An engineer notices that a high-throughput video streaming service experiences severe jitter and packet drops on a shared 10 Gbps backbone link during prime-time hours, even though the average utilization measured over 5-minute intervals is only 45%. What packet-switching phenomenon explains this behavior?

- A) Circuit-switched time slot reservation deadlocks.
- B) Statistical multiplexing micro-bursts overflowing shallow switch FIFO packet buffers.
- C) Asymmetric BGP routing causing packet inversion.
- D) IPv4 Header Checksum recalculation latency on backbone routers.

<details><summary>Answer</summary>

**B.** In packet-switched networks, statistical multiplexing dynamically allocates link capacity across bursty, uncoordinated flows. While 5-minute averages report modest 45% utilization, aggregate millisecond-scale micro-bursts can momentarily exceed 100% of link speed (10 Gbps). When switch packet buffers (FIFO queues) saturate during these bursts, tail-drop occurs, inducing transient packet loss and jitter.

- Why not A: Modern packet-switched internet backbones do not use circuit-switched reservation.
- Why not C: Asymmetric routing alters paths between forward and reverse flows, but does not cause transient buffer drops by itself.
- Why not D: Router ASICs verify and recompute IPv4 checksums in hardware at wire rate with sub-microsecond latency.
- Ref: [modules/01-layers-and-packets.md](../modules/01-layers-and-packets.md#packet-switching-vs-circuit-switching--statistical-multiplexing), Stevens TCP/IP Illustrated Vol. 1.

</details>

### Q-INT-003 · Architecture & Models · difficulty 2 · single

When an application transmits an HTTP/1.1 payload across an Ethernet local area network, what is the exact chronological order of protocol encapsulation as data traverses down the operating system stack?

- A) Application Payload → IPv4 Packet → TCP Segment → Ethernet Frame
- B) Application Payload → TCP Segment → IPv4 Packet → Ethernet Frame
- C) Application Payload → Ethernet Frame → IPv4 Packet → TCP Segment
- D) Application Payload → UDP Datagram → IPv4 Packet → Ethernet Frame

<details><summary>Answer</summary>

**B.** Data encapsulation descends the stack: the Layer 7 Application payload is encapsulated in a Layer 4 TCP Segment (prepending the 20-byte TCP header), which is encapsulated in a Layer 3 IPv4 Packet (prepending the 20-byte IP header), which is finally encapsulated in a Layer 2 Ethernet Frame (prepending the 14-byte MAC header and appending the 4-byte CRC-32 Frame Check Sequence trailer).

- Why not A: The TCP segment must be encapsulated within the IPv4 packet, not vice versa.
- Why not C: Ethernet framing happens at the lowest data link layer immediately before physical bit transmission.
- Why not D: HTTP/1.1 operates over TCP, not UDP.
- Ref: [modules/01-layers-and-packets.md](../modules/01-layers-and-packets.md#protocol-data-units-pdus-and-encapsulation), RFC 1122.

</details>

### Q-INT-004 · Architecture & Models · difficulty 3 · scenario

A client host on an enterprise network attempts to perform a TLS 1.3 handshake with an external SaaS endpoint. Small HTTP API requests succeed reliably, but during the TLS handshake when the server transmits a 3,500-byte certificate chain, the connection hangs indefinitely and eventually times out. A packet capture reveals the client repeatedly retransmitting `ClientHello`. What is the root cause?

- A) The client DNS resolver failed to resolve the AAAA record.
- B) A Path MTU Discovery (PMTUD) black hole caused by an intermediate firewall dropping ICMP Type 3, Code 4 messages.
- C) TCP Window Scale option negotiation was rejected by the server.
- D) The server sent an invalid Server Name Indication (SNI) extension.

<details><summary>Answer</summary>

**B.** Standard Ethernet enforces a 1,500-byte MTU. When the server attempts to transmit a 3,500-byte TLS certificate segment, it sends 1,500-byte IP packets with the Don't Fragment (DF=1) bit set. If an intermediate tunnel (e.g., VPN, GRE, or PPPoE) has a smaller MTU (e.g., 1,420 bytes), the intermediate router drops the oversized packet and generates an ICMP "Fragmentation Needed" (Type 3, Code 4) error. If an upstream firewall blocks all ICMP traffic, this packet never reaches the server, creating a PMTUD black hole where large packets are silently dropped forever.

- Why not A: Small HTTP API requests succeed, proving DNS resolution completed.
- Why not C: Window scale failure would restrict throughput to 64 KB, but would not stall connection establishment.
- Why not D: The client sends SNI in `ClientHello`, not the server.
- Ref: [modules/01-layers-and-packets.md](../modules/01-layers-and-packets.md#protocol-data-units-pdus-and-encapsulation), RFC 1191, RFC 2923.

</details>

### Q-INT-005 · Architecture & Models · difficulty 2 · single

As an IPv4 packet traverses three Layer 3 router hops from source host `10.0.1.5` to destination host `192.168.10.20`, which header fields are modified at each router hop?

- A) Both the Source IP address and the Destination IP address are rewritten.
- B) The Source and Destination IP addresses remain constant, while the Layer 2 Source and Destination MAC addresses are stripped and rewritten, and the IP TTL is decremented.
- C) The Layer 2 MAC addresses remain unchanged, while the IP TTL and TCP sequence numbers are incremented.
- D) Only the IP Total Length field is modified.

<details><summary>Answer</summary>

**B.** In standard routed networks (without NAT), Layer 3 IP addressing provides end-to-end logical identification and remains unchanged throughout transit. At each router hop, the router strips the incoming Layer 2 Ethernet frame, decrements the IPv4 TTL (and updates the IPv4 Header Checksum), consults its routing table to determine the next-hop IP, performs an ARP/NDP lookup to discover the next-hop MAC, and encapsulates the packet in a new Layer 2 frame with its own egress MAC as the source and the next hop as destination.

- Why not A: Without NAT, IP source and destination addresses remain immutable across router hops.
- Why not C: Layer 2 MAC headers have local link scope and are discarded at every L3 hop.
- Why not D: Total Length remains identical unless fragmentation occurs.
- Ref: [modules/02-link-layer-and-switching.md](../modules/02-link-layer-and-switching.md#1-the-ethernet-ii-dix-frame-architecture), Stevens TCP/IP Illustrated Vol. 1.

</details>

### Q-INT-006 · Architecture & Models · difficulty 2 · ordering

Order the following protocol data unit stages from the highest OSI layer down to physical wire transmission for an outgoing HTTPS request:

1. Generation of Application Payload bytes
2. Prepending of 20-byte TCP segment header with port numbers and sequence numbers
3. Appending of 4-byte Frame Check Sequence (CRC-32) trailer and prepending of 14-byte Ethernet header
4. Prepending of 20-byte IPv4 packet header with TTL and IP addresses

- A) 1 → 2 → 4 → 3
- B) 1 → 4 → 2 → 3
- C) 2 → 1 → 4 → 3
- D) 1 → 2 → 3 → 4

<details><summary>Answer</summary>

**A.** The correct sequence of encapsulation down the stack is: (1) Application payload generation (Layer 7) → (2) TCP segment header prepending (Layer 4) → (4) IPv4 packet header prepending (Layer 3) → (3) Ethernet frame header prepending and FCS trailer appending (Layer 2).

- Why not B: Layer 4 TCP encapsulation must precede Layer 3 IPv4 encapsulation.
- Why not C: Application payload must exist before the transport layer can segment it.
- Why not D: Ethernet header and trailer are applied at the final data link layer.
- Ref: [modules/01-layers-and-packets.md](../modules/01-layers-and-packets.md#protocol-data-units-pdus-and-encapsulation).

</details>

### Q-INT-007 · Architecture & Models · difficulty 1 · single

What is the standard Maximum Transmission Unit (MTU) of an Ethernet II frame, and what is the corresponding maximum TCP Maximum Segment Size (MSS) over standard IPv4?

- A) MTU: 9000 bytes; MSS: 8960 bytes
- B) MTU: 1500 bytes; MSS: 1460 bytes
- C) MTU: 1518 bytes; MSS: 1500 bytes
- D) MTU: 1460 bytes; MSS: 1420 bytes

<details><summary>Answer</summary>

**B.** Standard Ethernet II specifies an MTU of 1,500 bytes (the maximum size of the IP packet excluding the 14-byte Ethernet header and 4-byte FCS). The TCP Maximum Segment Size (MSS) represents the maximum application payload per unfragmented segment: $\text{MSS} = \text{MTU} - 20\text{ bytes (IPv4 base header)} - 20\text{ bytes (TCP base header)} = 1460\text{ bytes}$.

- Why not A: 9000 bytes corresponds to Jumbo frames used in internal storage and datacenter networks.
- Why not C: 1518 bytes is the maximum frame size on the wire ($1500\text{ MTU} + 14\text{ Header} + 4\text{ FCS}$).
- Why not D: 1460 bytes is the MSS, not the link MTU.
- Ref: [modules/01-layers-and-packets.md](../modules/01-layers-and-packets.md#protocol-data-units-pdus-and-encapsulation), RFC 894.

</details>

### Q-INT-008 · Architecture & Models · difficulty 3 · scenario

A network engineer deploys an ECMP (Equal-Cost Multi-Path) hashing configuration across four parallel 25 Gbps spine switches. Soon after deployment, TCP connections carrying bulk backup data report frequent out-of-order delivery warnings and high retransmission rates, while single HTTP requests experience normal latency. What is causing the TCP performance degradation?

- A) The switches are using Layer 2 MAC addresses only for the ECMP hash, causing all flows to serialize onto a single link.
- B) Packet-level per-packet round-robin load balancing was configured instead of per-flow 5-tuple hashing, causing sequential packets within a single TCP connection to take divergent paths with variable propagation delay.
- C) The spine switches have exhausted their ARP neighbor cache.
- D) The backup server is disabling TCP Selective Acknowledgment (SACK).

<details><summary>Answer</summary>

**B.** In high-speed datacenter fabrics, ECMP must use symmetric Layer 3/4 5-tuple hashing (Source IP, Destination IP, Protocol, Source Port, Destination Port) to guarantee that all packets belonging to a specific TCP flow follow the exact same physical path. If the fabric is misconfigured for per-packet load balancing, consecutive packets take different physical paths with slight propagation latency differences. When packets arrive out of order, the receiver generates Duplicate ACKs, causing the sender's TCP stack to falsely assume packet loss and trigger Fast Retransmit and congestion window collapse.

- Why not A: Layer 2 hashing causes polarization (uneven link utilization), but does not cause packet reordering within a single flow.
- Why not C: ARP cache exhaustion drops packets entirely rather than reordering them across links.
- Why not D: SACK helps TCP recover from loss, but does not cause packet reordering across the physical fabric.
- Ref: [modules/01-layers-and-packets.md](../modules/01-layers-and-packets.md#packet-switching-vs-circuit-switching--statistical-multiplexing), RFC 2991.

</details>

### Q-INT-009 · Architecture & Models · difficulty 2 · single

Why does the physical wire layout of an Ethernet II frame require a minimum payload size of 46 bytes?

- A) To satisfy the 32-bit alignment requirements of x86 memory controllers.
- B) To ensure that on half-duplex CSMA/CD networks, a transmitting station is still sending when a collision occurs at the furthest network boundary.
- C) To provide sufficient buffer space for IP header extension options.
- D) To accommodate the 48-bit MAC address length of both source and destination.

<details><summary>Answer</summary>

**B.** Historically, Ethernet used Carrier Sense Multiple Access with Collision Detection (CSMA/CD) over shared coaxial cable. To guarantee that a sender could detect a collision before it finished transmitting a frame, the frame transmission duration had to exceed the maximum round-trip propagation time across the maximum allowable cable distance (slot time = 512 bit times = 64 bytes at 10 Mbps). With a 14-byte header and 4-byte FCS ($18\text{ bytes}$), the minimum payload required was $64 - 18 = 46\text{ bytes}$. Short frames are padded with trailing zeros to reach 64 bytes.

- Why not A: Alignment optimizations are managed by operating system drivers and compilers, not IEEE standards.
- Why not C: IP headers require a minimum of 20 bytes, which easily fits within 46 bytes.
- Why not D: MAC addresses occupy 12 bytes of the frame header, not the payload.
- Ref: [modules/02-link-layer-and-switching.md](../modules/02-link-layer-and-switching.md#1-the-ethernet-ii-dix-frame-architecture), IEEE 802.3.

</details>

### Q-INT-010 · Architecture & Models · difficulty 2 · multi

Which of the following statements regarding the Bandwidth-Delay Product (BDP) and network buffering are TRUE? (Select TWO)

- A) $\text{BDP} = \text{Bandwidth} \times \text{RTT}$, representing the volume of in-flight unacknowledged data required to completely saturate a link.
- B) On high-BDP transoceanic links, legacy unscaled 16-bit TCP receive windows (max 64 KB) prevent senders from achieving full link utilization.
- C) Increasing intermediate router buffer sizes infinitely eliminates packet drops without affecting latency.
- D) Propagation delay decreases linearly as link transmission bandwidth increases.

<details><summary>Answer</summary>

**A and B.**

- **A is true**: BDP defines the capacity of the network pipe in flight.
- **B is true**: Without RFC 7323 Window Scaling, the maximum unscaled receive window is $2^{16} - 1 = 65,535\text{ bytes}$. On a 10 Gbps link with 70 ms RTT ($\text{BDP} \approx 87.5\text{ MB}$), an unscaled 64 KB window limits maximum achievable throughput to $\frac{64\text{ KB}}{0.070\text{ s}} \approx 7.48\text{ Mbps}$, utilizing less than 0.1% of available bandwidth.
- **C is false**: Unchecked router buffering causes Bufferbloat, inflating queueing latency by hundreds of milliseconds without improving throughput.
- **D is false**: Propagation delay is governed by the speed of light in silica fiber ($s \approx 200,000\text{ km/s}$) and physical distance; bandwidth increases transmission (serialization) speed only.
- Ref: [modules/01-layers-and-packets.md](../modules/01-layers-and-packets.md#5-the-bandwidth-delay-product-bdp), RFC 7323.

</details>

### Q-INT-011 · Architecture & Models · difficulty 3 · scenario

During an audit of a containerized Kubernetes cluster running on bare-metal servers, an engineer observes that container-to-container traffic across physical hosts experiences periodic packet drops whenever packet size approaches 1,500 bytes. The physical switch ports have an MTU of 1,500 bytes, and the cluster uses VXLAN overlay networking (Cilium/Flannel). What is the architectural defect?

- A) The containers are attempting to negotiate HTTP/3 over TCP.
- B) The overlay encapsulation adds 50 bytes of UDP/IP/VXLAN outer headers, causing 1,500-byte guest packets to exceed the 1,500-byte physical underlay MTU.
- C) The physical switches are blocking UDP port 4789.
- D) The Linux kernel `veth` pair driver does not support MTU values above 1,400 bytes.

<details><summary>Answer</summary>

**B.** VXLAN encapsulates inner Layer 2 Ethernet frames inside an outer Layer 4 UDP packet on port 4789. The outer headers consume exactly 50 bytes ($14\text{B Outer Ethernet} + 20\text{B Outer IPv4} + 8\text{B Outer UDP} + 8\text{B VXLAN Header}$). If a container sends a 1,500-byte packet and the physical network MTU is 1,500 bytes, the total frame size becomes 1,550 bytes, causing the physical NIC to drop the packet or trigger IP fragmentation. The fix is to configure the physical network for Jumbo frames ($\text{MTU} \ge 1600$) or clamp the container virtual interfaces to $\text{MTU} = 1450$.

- Why not A: HTTP/3 operates over UDP, not TCP.
- Why not C: If port 4789 were blocked, all cross-host traffic would fail, not merely large packets.
- Why not D: `veth` interfaces support arbitrary MTUs up to 65,535 bytes.
- Ref: [modules/14-linux-networking-ops.md](../modules/14-linux-networking-ops.md#7-cloud-virtualization--overlay-networks-vxlan-rfc-7348), RFC 7348.

</details>

### Q-INT-012 · Architecture & Models · difficulty 2 · single

Why do IP packet captures recorded at high-throughput 100 Gbps network interfaces often display IP total length values of 65,535 bytes, far exceeding the physical link MTU of 1,500 bytes?

- A) The network interface is operating in half-duplex token ring mode.
- B) TCP Segmentation Offload (TSO) and Generic Receive Offload (GRO) coalesce packets in hardware before handing them to the kernel.
- C) The packets are using IPsec tunnel encapsulation with jumbo padding.
- D) The capture utility was run with snapshot length `snaplen` set to 0.

<details><summary>Answer</summary>

**B.** To minimize CPU overhead at high bandwidths, modern NICs implement TCP Segmentation Offload (TSO) on transmission and Large Receive Offload (LRO) / Generic Receive Offload (GRO) on reception. When GRO is active, the NIC hardware coalesces sequential incoming packets belonging to the same TCP stream into a single massive buffer (up to 64 KB) before generating a single hardware interrupt to the Linux kernel. A packet capture tap running on the host intercepts the buffer after GRO coalescence, reporting a pseudo-packet of up to 64 KB.

- Why not A: Token ring is obsolete and does not explain 64 KB packets on modern interfaces.
- Why not C: IPsec encapsulation increases packet size by 50–70 bytes, not 64,000 bytes.
- Why not D: Setting `snaplen` to 0 (or 65,535 in legacy tcpdump) instructs the capture tool to record the entire packet, but does not alter packet size on the wire.
- Ref: [modules/01-layers-and-packets.md](../modules/01-layers-and-packets.md#3-dissecting-the-wire-the-libpcap-binary-architecture), Linux Kernel Networking Documentation.

</details>

---

## Domain 2: Core Protocols & Transport Layer Internals

### Q-INT-013 · Protocols & Transport · difficulty 2 · single

During the TCP 3-way handshake (RFC 9293), what is the primary security reason for generating a pseudorandom Initial Sequence Number (ISN) rather than starting every connection at sequence number 0?

- A) To prevent TCP sequence number prediction attacks and unauthorized connection hijacking.
- B) To negotiate the maximum socket buffer memory allocation between endpoints.
- C) To calculate the Round-Trip Time (RTT) before transmitting data.
- D) To determine whether the client supports TLS 1.3 encryption.

<details><summary>Answer</summary>

**A.** If TCP sequence numbers were predictable (e.g. starting at 0 or incrementing by a fixed constant per connection), an off-path attacker capable of spoofing a trusted client's IP address could guess the sequence numbers and inject forged data or reset flags into established TCP sessions (TCP sequence prediction attack / Kevin Mitnick attack). RFC 6528 mandates computing ISNs using a cryptographic hash of the 4-tuple, a boot-time secret key, and a monotonic high-resolution timer.

- Why not B: Socket buffer space is communicated via the 16-bit Window Size field and Window Scale option.
- Why not C: RTT is measured dynamically after the handshake using timestamps or segment acknowledgment timing.
- Why not D: TLS 1.3 support is negotiated during the TLS `ClientHello` handshake, not the L4 TCP handshake.
- Ref: [modules/06-tcp-internals.md](../modules/06-tcp-internals.md#2-the-11-state-tcp-finite-state-machine-fsm), RFC 6528, RFC 9293.

</details>

### Q-INT-014 · Protocols & Transport · difficulty 2 · scenario

An edge API gateway is subjected to a distributed SYN flood attack where hundreds of thousands of spoofed IP addresses transmit TCP SYN packets without ever completing the handshake. What kernel defense mechanism allows the gateway to continue accepting legitimate TCP connections without allocating memory in the incomplete connection queue?

- A) Selective Acknowledgment (SACK)
- B) TCP SYN Cookies (`net.ipv4.tcp_syncookies = 1`)
- C) Explicit Congestion Notification (ECN)
- D) Nagle's Algorithm

<details><summary>Answer</summary>

**B.** Under standard operation, when a server receives a SYN packet, it allocates an entry in its SYN backlog queue (`sk_buff`) and replies with SYN-ACK. In a SYN flood, this queue overflows, causing legitimate connections to be dropped. When TCP SYN Cookies (RFC 4987) are enabled, once the backlog queue fills, the kernel stops allocating state for half-open sockets. Instead, it encodes the connection parameters (MSS index, timestamp, and a cryptographic hash of the 4-tuple) directly into the 32-bit Initial Sequence Number of the outgoing SYN-ACK. When the client replies with ACK, the server validates the sequence number and reconstructs the connection state on the fly.

- Why not A: SACK enables efficient retransmission of non-contiguous dropped blocks, but does not prevent SYN queue exhaustion.
- Why not C: ECN signals congestion without drops, but requires established connection state.
- Why not D: Nagle's algorithm coalesces small outbound data writes, having no impact on handshake state.
- Ref: [modules/06-tcp-internals.md](../modules/06-tcp-internals.md#2-the-11-state-tcp-finite-state-machine-fsm), RFC 4987.

</details>

### Q-INT-015 · Protocols & Transport · difficulty 1 · single

What are the four fields contained in the standard, fixed 8-byte UDP header (RFC 768)?

- A) Source IP, Destination IP, Length, Checksum
- B) Source Port, Destination Port, Length, Checksum
- C) Source Port, Destination Port, Sequence Number, Acknowledgment Number
- D) Source Port, Destination Port, Window Size, Flags

<details><summary>Answer</summary>

**B.** The UDP header is fixed at exactly 8 bytes (64 bits), consisting of four 16-bit fields: (1) Source Port (16 bits), (2) Destination Port (16 bits), (3) Length (16 bits, representing total byte length of UDP header plus payload, minimum 8), and (4) Checksum (16 bits, covering a pseudo-header, UDP header, and payload).

- Why not A: IP addresses reside in the Layer 3 IP header, not the Layer 4 UDP header.
- Why not C: Sequence and Acknowledgment numbers are TCP header fields.
- Why not D: Window Size and control flags belong to the TCP header.
- Ref: [modules/05-udp-and-sockets.md](../modules/05-udp-and-sockets.md#1-the-user-datagram-protocol-udp-architecture), RFC 768.

</details>

### Q-INT-016 · Protocols & Transport · difficulty 3 · scenario

A real-time multiplayer gaming backend transmits player coordinate updates every 16 ms using UDP. However, the engineering team notices that when a single game packet is dropped on mobile Wi-Fi, other game state updates continue rendering smoothly without stalling. If the team had used TCP, what transport-layer bottleneck would have halted the delivery of all subsequent updates?

- A) TCP Window Scaling exhaustion
- B) Head-of-Line (HoL) blocking enforced by TCP's in-order byte stream delivery guarantee
- C) Path MTU Discovery failure
- D) Epoll edge-triggered starvation

<details><summary>Answer</summary>

**B.** TCP guarantees reliable, strictly in-order byte stream delivery. If packet #2 is dropped in transit, the receiving kernel socket buffer refuses to deliver packets #3, #4, and #5 to the application until packet #2 has been retransmitted and successfully acknowledged. This is Head-of-Line (HoL) blocking. For real-time applications (gaming, WebRTC voice), stale coordinate data is useless; UDP delivers datagrams immediately to application space as they arrive without waiting for missing packets.

- Why not A: Window scaling dictates buffer capacity, not in-order delivery stalls.
- Why not C: PMTUD affects oversized packets, not packet drop recovery.
- Why not D: Epoll is a Linux event polling mechanism, not a transport protocol property.
- Ref: [modules/05-udp-and-sockets.md](../modules/05-udp-and-sockets.md#1-the-user-datagram-protocol-udp-architecture), RFC 9293.

</details>

### Q-INT-017 · Protocols & Transport · difficulty 2 · single

How does the QUIC protocol (RFC 9000) eliminate transport-layer Head-of-Line (HoL) blocking across multiplexed web streams?

- A) By eliminating all packet retransmissions and operating as an unreliable protocol.
- B) By running over UDP and maintaining independent stream-level state and sequence offsets within each stream.
- C) By forcing all streams to use separate physical network interfaces.
- D) By disabling TLS encryption on stream frames.

<details><summary>Answer</summary>

**B.** In HTTP/2 over TCP, all multiplexed HTTP streams share a single underlying TCP byte stream; a single dropped TCP segment stalls all streams on that connection. QUIC runs over UDP and implements its own framing and encryption. While QUIC guarantees in-order delivery within an individual stream, each stream maintains its own independent offset counter. If a packet carrying data for Stream 2 is lost, only Stream 2 waits for recovery; Streams 1 and 3 continue delivering data immediately to the application without interruption.

- Why not A: QUIC is a fully reliable transport protocol providing cryptographic integrity and retransmission.
- Why not C: QUIC multiplexes hundreds of streams over a single UDP socket.
- Why not D: TLS 1.3 is mandatorily integrated into QUIC headers and payload encryption.
- Ref: [modules/11-quic-and-http-3.md](../modules/11-quic-and-http-3.md#5-independent-streams-complete-elimination-of-transport-head-of-line-blocking), RFC 9000.

</details>

### Q-INT-018 · Protocols & Transport · difficulty 2 · single

How does the standard UNIX `traceroute` utility identify intermediate router hops along an IP transmission path?

- A) By inspecting the IP Route Record option embedded in the TCP header.
- B) By sending probe packets with sequentially incrementing IP TTL values (1, 2, 3...) and harvesting ICMP Time Exceeded (Type 11) messages from routers.
- C) By querying the BGP Looking Glass API on each intermediate autonomous system.
- D) By transmitting ARP requests to the default gateway with the promiscuous bit set.

<details><summary>Answer</summary>

**B.** `traceroute` transmits UDP or ICMP probes towards the destination starting with an IP Time-to-Live (TTL) of 1. The first router decrements the TTL to 0, discards the packet, and returns an ICMP Time Exceeded (Type 11, Code 0) packet with its own IP as the source. `traceroute` records this IP, increments the TTL to 2, 3, 4..., mapping each router along the path until reaching the destination.

- Why not A: The IP Record Route option exists in IPv4, but is restricted to 9 hops due to 40-byte option size limits.
- Why not C: BGP Looking Glass servers are diagnostic web portals, not wire protocols used by client traceroute.
- Why not D: ARP operates only within a local Layer 2 broadcast domain and cannot traverse routers.
- Ref: [modules/03-ip-addressing-and-routing.md](../modules/03-ip-addressing-and-routing.md#6-icmp-mechanics--traceroute-operation), RFC 792.

</details>

### Q-INT-019 · Protocols & Transport · difficulty 2 · scenario

An engineer runs `traceroute` across a corporate WAN and notices that while hops 1, 2, 3, and 5 report consistent 15 ms latency with 0% packet loss, hop 4 reports 80% packet loss and 120 ms latency. However, end-to-end traffic to the destination (hop 12) is perfectly healthy. What explains the apparent packet loss at hop 4?

- A) Hop 4 is experiencing fiber degradation and dropping forwarded customer traffic.
- B) Control Plane Policing (CoPP) on hop 4 deprioritizes or rate-limits CPU generation of ICMP Time Exceeded messages while continuing to forward transit traffic at wire speed in ASIC hardware.
- C) Hop 4 has an incorrect default gateway.
- D) The client MTU is misconfigured.

<details><summary>Answer</summary>

**B.** Enterprise and carrier-grade routers use hardware ASICs to forward transit data plane traffic at line rate. However, generating an ICMP Time Exceeded packet requires punting the packet to the router's general-purpose control plane CPU. To protect the CPU from denial-of-service exhaustion, network operators configure **Control Plane Policing (CoPP)** to strictly rate-limit ICMP generation. When traceroute probes exceed the rate limit, the router drops the probes, producing phantom packet loss in traceroute output even though forwarded traffic is completely unaffected.

- Why not A: If physical fiber were degraded, all downstream hops (5 through 12) would also report high packet loss.
- Why not C: An invalid default gateway would prevent packets from reaching hop 5.
- Why not D: Traceroute probes are tiny packets (typically under 100 bytes) unaffected by MTU limits.
- Ref: [modules/03-ip-addressing-and-routing.md](../modules/03-ip-addressing-and-routing.md#6-icmp-mechanics--traceroute-operation), RFC 1812.

</details>

### Q-INT-020 · Protocols & Transport · difficulty 2 · single

What is a Gratuitous ARP (GARP) message, and what operational role does it play in high-availability server clustering (e.g., Keepalived / VRRP)?

- A) An ARP request sent by a host to discover the MAC address of its default gateway.
- B) An ARP broadcast where a host announces its own IP-to-MAC mapping to immediately update the ARP caches of adjacent hosts and switch CAM tables during failover.
- C) An encrypted ARP reply used to establish secure IPSec tunnels.
- D) An ARP query transmitted across an L3 router to update remote routing tables.

<details><summary>Answer</summary>

**B.** A Gratuitous ARP (GARP) is an ARP Request or Reply where the sender IP and target IP are identical. It serves two critical operational functions: (1) it detects IP address conflicts on local subnets, and (2) during high-availability failover (e.g. Keepalived, CARP, VRRP), when a backup node claims a Virtual IP (VIP), it broadcasts a GARP. This immediately forces all adjacent network devices to update their ARP tables and switches to update their MAC CAM tables to point to the backup node's physical port, achieving sub-second traffic cutover.

- Why not A: Standard ARP requests specify the gateway IP as target, not the sender's own IP.
- Why not C: ARP is an unencrypted, plaintext Layer 2 protocol.
- Why not D: ARP is a broadcast protocol bounded by Layer 2 domains; routers do not forward ARP broadcasts.
- Ref: [modules/02-link-layer-and-switching.md](../modules/02-link-layer-and-switching.md#5-ipv4-arp-vs-ipv6-neighbor-discovery-protocol-ndp), RFC 826.

</details>

### Q-INT-021 · Protocols & Transport · difficulty 2 · single

Why does the TLS 1.3 handshake (RFC 8446) achieve complete session establishment and key exchange in a single round-trip (1-RTT), compared to the 2-RTT requirement in TLS 1.2?

- A) TLS 1.3 uses static pre-shared RSA keys for all internet connections.
- B) The client speculatively guesses the key exchange algorithm and transmits an ephemeral Diffie-Hellman public key (`key_share`) directly inside the initial `ClientHello`.
- C) TLS 1.3 delegates encryption to the physical optical layer.
- D) The server sends certificate records over unencrypted UDP before the handshake starts.

<details><summary>Answer</summary>

**B.** In TLS 1.2, Flight 1 negotiated cryptographic algorithms, and Flight 2 exchanged Diffie-Hellman parameters (2-RTT total). TLS 1.3 eliminates obsolete cipher suites and mandates ephemeral Diffie-Hellman (ECDHE). The client speculatively predicts the server's preferred cryptographic group (typically Curve25519) and transmits its public key share directly inside the `key_share` extension of the initial `ClientHello` (Flight 1). The server responds with its own key share, derives symmetric keys, and transmits its encrypted certificate and Finished HMAC in Flight 2, allowing application data to flow after exactly 1-RTT.

- Why not A: Static RSA key exchange is completely prohibited in TLS 1.3 due to lack of forward secrecy.
- Why not C: TLS operates at Layers 4–7 in software, completely independent of optical hardware.
- Why not D: TLS 1.3 encrypts all certificates over the established transport stream.
- Ref: [modules/09-tls-1-3-and-pki-on-the-wire.md](../modules/09-tls-1-3-and-pki-on-the-wire.md#2-handshake-wire-dissection-the-1-rtt-state-machine), RFC 8446.

</details>

### Q-INT-022 · Protocols & Transport · difficulty 3 · scenario

A mobile banking application enables TLS 1.3 0-RTT Early Data to accelerate API requests. A security researcher discovers that when a user submits an HTTP `POST /api/transfer` request over public Wi-Fi, an active network attacker can capture the 0-RTT packet and replay it to the banking API server multiple times, causing duplicate funds transfers. What architectural principle was violated?

- A) 0-RTT data was sent without a valid TLS certificate.
- B) 0-RTT Early Data must be strictly restricted to idempotent requests (e.g. `GET`, `HEAD`) and must never be permitted on state-mutating requests (`POST`, `PUT`) without application-level anti-replay tokens.
- C) The client negotiated ChaCha20-Poly1305 instead of AES-GCM.
- D) The mobile application failed to implement DNSSEC.

<details><summary>Answer</summary>

**B.** RFC 8446 and RFC 8470 explicitly mandate that TLS 1.3 0-RTT Early Data provides **no protection against network replay attacks**. Because 0-RTT data is encrypted under keys derived from a cached Pre-Shared Key (PSK) before the server completes its fresh ephemeral handshake, an attacker who intercepts the initial flight can replay it to the server. If the server accepts 0-RTT data for non-idempotent operations like funds transfers or database writes, the action will be executed repeatedly. Production systems must either reject 0-RTT for `POST` requests or enforce single-use cryptographic nonces at the application layer.

- Why not A: 0-RTT data requires a valid resumed session ticket, but is still vulnerable to wire replay.
- Why not C: Cipher suite selection has no bearing on replay attack vulnerability.
- Why not D: DNSSEC validates DNS records and does not protect against TLS wire replays.
- Ref: [modules/09-tls-1-3-and-pki-on-the-wire.md](../modules/09-tls-1-3-and-pki-on-the-wire.md#the-replay-vulnerability--mitigation-rules-rfc-8470), RFC 8470.

</details>

### Q-INT-023 · Protocols & Transport · difficulty 3 · single

In IPv6, what protocol completely replaces the IPv4 Address Resolution Protocol (ARP), and what transport mechanism does it utilize?

- A) IGMP over IPv6 Unicast
- B) Neighbor Discovery Protocol (NDP) running over ICMPv6 using Solicited-Node Multicast
- C) DHCPv6 broadcast over UDP port 546
- D) Gratuitous BGP over TCP port 179

<details><summary>Answer</summary>

**B.** IPv6 eliminates broadcast entirely. To map known IPv6 addresses to 48-bit MAC addresses, IPv6 uses the **Neighbor Discovery Protocol (NDP / RFC 4861)**. NDP runs over ICMPv6 using **Neighbor Solicitation (Type 135)** and **Neighbor Advertisement (Type 136)** messages. Instead of broadcasting to all hosts on the local network (`FF:FF:FF:FF:FF:FF`), NDP queries are transmitted to the destination's **Solicited-Node Multicast address** (`FF02::1:FFxx:xxxx`), ensuring that only nodes matching the low-order 24 bits of the target IP wake up their NICs to process the frame.

- Why not A: IGMP is an IPv4 multicast group management protocol, replaced by MLD in IPv6.
- Why not C: DHCPv6 assigns network configuration parameters, but is not used for link-layer address resolution.
- Why not D: BGP is an inter-autonomous system routing protocol, not a link-layer address resolution mechanism.
- Ref: [modules/02-link-layer-and-switching.md](../modules/02-link-layer-and-switching.md#5-ipv4-arp-vs-ipv6-neighbor-discovery-protocol-ndp), RFC 4861.

</details>

### Q-INT-024 · Protocols & Transport · difficulty 2 · multi

Which of the following headers or flags are checked or manipulated during the TCP 4-way connection termination sequence? (Select TWO)

- A) FIN (Finish) flag indicating the sender has no more application data to transmit
- B) ACK flag acknowledging receipt of the FIN segment
- C) SYN flag initiating a graceful teardown
- D) ECN-Echo flag indicating socket buffer termination

<details><summary>Answer</summary>

**A and B.** TCP connection termination uses the FIN handshake: (1) Host A sends `FIN` (seq=u), entering `FIN_WAIT_1`; (2) Host B replies with `ACK` (ack=u+1), entering `CLOSE_WAIT` while Host A enters `FIN_WAIT_2`; (3) Host B finishes sending data and transmits `FIN` (seq=v), entering `LAST_ACK`; (4) Host A replies with `ACK` (ack=v+1), entering `TIME_WAIT` for $2 \times \text{MSL}$ before closing.

- Why not C: SYN is used exclusively during connection establishment, never during termination.
- Why not D: ECN-Echo signals network congestion, not socket termination.
- Ref: [modules/06-tcp-internals.md](../modules/06-tcp-internals.md#2-the-11-state-tcp-finite-state-machine-fsm), RFC 9293.

</details>

---

## Domain 3: Addressing, Routing & Peering Infrastructure

### Q-INT-025 · Addressing & Routing · difficulty 2 · single

A cloud infrastructure engineer allocates the CIDR block `10.240.0.0/22` to a VPC subnet. How many total IPv4 addresses exist in this block, and how many are usable by host workloads in a standard cloud environment?

- A) Total: 1024 addresses; Usable: 1022 addresses
- B) Total: 1024 addresses; Usable: 1019 addresses (AWS/GCP reserve 5 addresses per subnet)
- C) Total: 512 addresses; Usable: 510 addresses
- D) Total: 2048 addresses; Usable: 2046 addresses

<details><summary>Answer</summary>

**B.** A `/22` network mask leaves $32 - 22 = 10$ host bits. Total IP addresses = $2^{10} = 1024$. In standard RFC networking, 2 addresses are reserved (Network address `.0` and Broadcast address `.255`), leaving 1022 usable. However, major cloud providers (AWS, GCP) reserve 5 addresses in every subnet: Network (`.0`), VPC Router (`.1`), DNS Server (`.2`), Future Use (`.3`), and Network Broadcast (`.255`), leaving exactly $1024 - 5 = 1019$ usable addresses for host workloads.

- Why not A: In standard on-premises RFC networking, 1022 are usable, but cloud platforms reserve 5.
- Why not C: 512 corresponds to a `/23` subnet ($2^9$).
- Why not D: 2048 corresponds to a `/21` subnet ($2^{11}$).
- Ref: [modules/03-ip-addressing-and-routing.md](../modules/03-ip-addressing-and-routing.md#1-the-ipv4-vs-ipv6-wire-format-dissection), RFC 4632.

</details>

### Q-INT-026 · Addressing & Routing · difficulty 2 · single

When an IP router evaluates multiple routes in its Forwarding Information Base (FIB) matching a packet's destination IP `198.51.100.42`, which route entry takes precedence?

- A) The route with the lowest administrative distance.
- B) The route entry with the longest prefix match (highest number of matching network prefix bits).
- C) The route entry that was installed most recently into the routing table.
- D) The route advertised by the BGP peer with the highest IP address.

<details><summary>Answer</summary>

**B.** The foundational rule of IP packet forwarding is **Longest Prefix Match (LPM)**: a router must forward packets using the route entry that matches the greatest number of leading bits of the destination IP address. For example, if a routing table holds `0.0.0.0/0`, `198.51.0.0/16`, and `198.51.100.0/24`, the packet matching `198.51.100.42` is strictly forwarded via the `/24` route because it is the most specific. Administrative distance is only evaluated when choosing between competing routes of identical prefix length learned from different routing protocols.

- Why not A: Administrative distance resolves conflicts between identical prefix lengths across protocols; it never overrides a longer prefix match.
- Why not C: Route installation age has no bearing on LPM forwarding.
- Why not D: BGP tie-breaking attributes are only evaluated within the BGP control plane before installing routes into the FIB.
- Ref: [modules/03-ip-addressing-and-routing.md](../modules/03-ip-addressing-and-routing.md#2-cidr-mathematics--subnetting-mechanics), RFC 1812.

</details>

### Q-INT-027 · Addressing & Routing · difficulty 2 · scenario

An egress Managed NAT Gateway serving 10,000 private worker nodes in a Kubernetes cluster experiences widespread TCP connection timeouts when pods initiate outbound HTTPS API calls to third-party endpoints. Cluster monitoring reveals CPU and network bandwidth on the NAT gateway are below 25%, but `conntrack_count` is pinned at its maximum limit. What is the root cause?

- A) BGP route flapping on the ISP peering link.
- B) Source Port (SNAT) exhaustion: the NAT gateway has depleted its ephemeral source port pool (65,535 tuples) for the destination IP.
- C) ARP cache poisoning on the Kubernetes worker nodes.
- D) DNS queries exceeding the UDP 512-byte payload limit.

<details><summary>Answer</summary>

**B.** A NAT/PAT gateway maps multiple private IP addresses to a shared public IP by allocating unique Layer 4 ephemeral source ports. For a specific destination IP and port (e.g. `api.stripe.com:443`), a single public IPv4 address can support at most $65,535 - 1024 \approx 64,000$ concurrent active 5-tuple connections. If thousands of pods simultaneously establish connections to the same endpoint without connection reuse (HTTP keep-alives), the ephemeral source port pool exhausts. New connection attempts are dropped, resulting in SNAT port exhaustion timeouts.

- Why not A: BGP route flapping causes routing instability, not conntrack port pool exhaustion.
- Why not C: ARP cache poisoning is an internal Layer 2 attack that does not explain NAT gateway port exhaustion.
- Why not D: Modern DNS resolvers use EDNS0 to support UDP payloads up to 4,096 bytes without truncation.
- Ref: [modules/13-load-balancing-cdn-nat.md](../modules/13-load-balancing-cdn-nat.md#6-network-address-translation-nat--traversal-stun--turn--ice), RFC 3022.

</details>

### Q-INT-028 · Addressing & Routing · difficulty 1 · ordering

Order the four sequential phases of the DHCP lease negotiation process (DHCP DORA):

1. DHCP Request (Client requests offered IP)
2. DHCP Acknowledge (Server commits lease parameters)
3. DHCP Discover (Client broadcasts to discover servers)
4. DHCP Offer (Server proposes IP address and lease terms)

- A) 3 → 4 → 1 → 2
- B) 3 → 1 → 4 → 2
- C) 4 → 3 → 1 → 2
- D) 1 → 3 → 4 → 2

<details><summary>Answer</summary>

**A.** The DHCP negotiation sequence is D-O-R-A: (3) **Discover** (client broadcasts UDP packet to `255.255.255.255` on port 67) → (4) **Offer** (server replies with unicast/broadcast offering an IP) → (1) **Request** (client broadcasts acceptance of the specific offer) → (2) **Acknowledge** (server confirms lease, netmask, default gateway, and DNS servers).

- Why not B: The client cannot request an IP address before receiving an offer.
- Why not C: The server cannot offer an address until the client discovers it.
- Why not D: Request is step 3, not step 1.
- Ref: [modules/03-ip-addressing-and-routing.md](../modules/03-ip-addressing-and-routing.md#1-the-ipv4-vs-ipv6-wire-format-dissection), RFC 2131.

</details>

### Q-INT-029 · Addressing & Routing · difficulty 2 · single

When an autonomous system border router evaluates competing BGP paths for the same prefix, which BGP path attribute is evaluated first to determine the best path?

- A) `AS_PATH` (shortest autonomous system hop count)
- B) `LOCAL_PREF` (highest local preference value)
- C) `MED` (Multi-Exit Discriminator)
- D) Router ID of the advertising peer

<details><summary>Answer</summary>

**B.** In standard BGP route selection (RFC 4271), `LOCAL_PREF` is the highest-priority standardized attribute evaluated: routes with the highest `LOCAL_PREF` win over all other metrics. Only when `LOCAL_PREF` values are identical does BGP proceed to evaluate whether the route was locally originated, followed by `AS_PATH` length, Origin type (`IGP < EGP < INCOMPLETE`), and `MED`. (Note: Cisco proprietary configurations evaluate Cisco `WEIGHT` first, but `LOCAL_PREF` is the standard BGP specification rule).

- Why not A: `AS_PATH` is evaluated only after `LOCAL_PREF` and local origination checks.
- Why not C: `MED` is evaluated downstream to distinguish between multiple links from the same neighbor AS.
- Why not D: Router ID is the final tie-breaker when all upstream metrics are identical.
- Ref: [modules/04-internet-routing-bgp-anycast.md](../modules/04-internet-routing-bgp-anycast.md#3-path-vector-mechanics--the-bgp-decision-algorithm), RFC 4271.

</details>

### Q-INT-030 · Addressing & Routing · difficulty 3 · scenario

A global content delivery network announces an IP address (`198.51.100.1`) using BGP Anycast from 40 edge datacenters worldwide. During an upstream fiber cut, BGP route convergence causes a user's TCP connection to mid-stream shift from the Frankfurt datacenter to the Amsterdam datacenter. What catastrophic failure mode occurs on the client's established TCP connection?

- A) The connection seamlessly resumes because Anycast preserves TCP sequence numbers.
- B) The Amsterdam datacenter has no local kernel state for the client's TCP 4-tuple and immediately responds with a TCP RST, tearing down the active connection.
- C) The client's browser switches to UDP without interrupting the download.
- D) The client IP address is automatically changed by the Amsterdam router.

<details><summary>Answer</summary>

**B.** BGP Anycast routes packets to the topologically closest datacenter at Layer 3. However, TCP is a stateful Layer 4 protocol whose connection state (sequence numbers, window scaling, socket buffers) resides exclusively in the local kernel memory of the specific server that terminated the handshake. If an Anycast route flaps mid-stream, subsequent TCP packets are delivered to a different datacenter whose servers have no memory of the connection. The new server responds with a TCP RST (`Reset`), forcibly terminating the user's connection. This is why Anycast is ideally suited for stateless UDP services (DNS) and requires state-sharing overlays or consistent hashing for long-lived TCP flows.

- Why not A: BGP is a routing protocol that does not synchronize Layer 4 TCP connection state across physical datacenters.
- Why not C: Standard TCP connections cannot transparently convert to UDP mid-stream.
- Why not D: BGP routing changes do not modify client IP addresses.
- Ref: [modules/04-internet-routing-bgp-anycast.md](../modules/04-internet-routing-bgp-anycast.md#6-anycast-routing-architecture--tcp-dynamics), RFC 4786.

</details>

### Q-INT-031 · Addressing & Routing · difficulty 2 · single

What security mechanism protects global BGP routing tables from prefix hijacking and accidental route leaks by cryptographically validating that an advertising ASN is authorized to originate an IP prefix?

- A) DNSSEC (Domain Name System Security Extensions)
- B) RPKI Route Origin Validation (ROV)
- C) OSPF Cryptographic Authentication
- D) IPSec AH Header Validation

<details><summary>Answer</summary>

**B.** **Resource Public Key Infrastructure (RPKI) Route Origin Validation (ROV / RFC 6811)** uses public-key cryptography to secure internet routing. Regional Internet Registries (RIRs) issue cryptographically signed **Route Origin Authorizations (ROAs)** that state which specific Autonomous System Number (ASN) is legally authorized to advertise a given IP prefix up to a designated maximum length (`max-length`). Border routers consult local RPKI validation caches; if an announcement is evaluated as `Invalid` (e.g. an attacker announcing a victim's prefix from an unauthorized ASN), the router drops the route.

- Why not A: DNSSEC secures DNS domain-to-IP record mappings, not BGP IP prefix routing announcements.
- Why not C: OSPF authenticates interior routing within a single enterprise network, having no role in internet BGP peering.
- Why not D: IPsec encrypts point-to-point IP traffic, but does not validate BGP route announcements.
- Ref: [modules/04-internet-routing-bgp-anycast.md](../modules/04-internet-routing-bgp-anycast.md#5-rpki--route-origin-validation-rov), RFC 6480, RFC 6811.

</details>

### Q-INT-032 · Addressing & Routing · difficulty 1 · single

Which IPv4 address range is formally reserved by RFC 1918 for private local area networks and is guaranteed never to be routed across the public Internet?

- A) `10.0.0.0/8`, `172.16.0.0/12`, and `192.168.0.0/16`
- B) `100.64.0.0/10` and `169.254.0.0/16`
- C) `127.0.0.0/8` and `224.0.0.0/4`
- D) `198.51.100.0/24` and `203.0.113.0/24`

<details><summary>Answer</summary>

**A.** RFC 1918 establishes three private IPv4 address blocks:

1. `10.0.0.0/8` (`10.0.0.0` – `10.255.255.255`, 16.7 million hosts)
2. `172.16.0.0/12` (`172.16.0.0` – `172.31.255.255`, 1 million hosts)
3. `192.168.0.0/16` (`192.168.0.0` – `192.168.255.255`, 65,536 hosts) Internet service providers strictly filter and drop these prefixes from public BGP route tables.

- Why not B: `100.64.0.0/10` is reserved for Carrier-Grade NAT (RFC 6598); `169.254.0.0/16` is Link-Local (APIPA / RFC 3927).
- Why not C: `127.0.0.0/8` is Loopback; `224.0.0.0/4` is Multicast.
- Why not D: These blocks are reserved by RFC 5737 for documentation and test examples.
- Ref: [modules/03-ip-addressing-and-routing.md](../modules/03-ip-addressing-and-routing.md#1-the-ipv4-vs-ipv6-wire-format-dissection), RFC 1918.

</details>

### Q-INT-033 · Addressing & Routing · difficulty 2 · single

What is the fundamental architectural difference between Multicast delivery and Anycast delivery?

- A) Multicast delivers packets from 1 source to multiple subscribed group members via router replication; Anycast delivers packets from 1 client to the single topologically nearest server among multiple nodes advertising the identical IP.
- B) Multicast operates over TCP; Anycast operates exclusively over physical cables.
- C) Multicast uses public IP addresses; Anycast uses RFC 1918 private addresses only.
- D) Multicast encrypts packets with TLS; Anycast sends plaintext datagrams.

<details><summary>Answer</summary>

**A.** Multicast (Class D `224.0.0.0/4` in IPv4) delivers packets from one sender to a group of interested receivers. Routers maintain multicast distribution trees (via IGMP and PIM) and physically replicate packets at branch points. Anycast assigns the identical unicast IP address to multiple distributed nodes and advertises it via BGP. Routers forward packets along standard shortest-path paths, delivering the packet to exactly **one** topologically nearest server node.

- Why not B: Multicast runs over UDP (cannot use TCP due to multi-receiver ACK explosion); Anycast runs over standard IP routing.
- Why not C: Both Multicast and Anycast utilize standard public and private IP ranges.
- Why not D: Encryption is handled at higher protocol layers, independent of Multicast or Anycast delivery topologies.
- Ref: [modules/04-internet-routing-bgp-anycast.md](../modules/04-internet-routing-bgp-anycast.md#6-anycast-routing-architecture--tcp-dynamics), RFC 4786.

</details>

### Q-INT-034 · Addressing & Routing · difficulty 3 · scenario

A distributed systems engineer configures dual-stack IPv4/IPv6 networking on a public cloud server. The engineer carefully configures `iptables` to restrict access to port 22 (SSH) to a trusted management IP. However, security logs reveal that an external attacker connected to SSH and attempted brute-force password guessing. How did the attacker bypass the firewall?

- A) The attacker spoofed the client MAC address.
- B) The engineer configured firewall rules using `iptables` (which controls IPv4 traffic only) and neglected to configure matching rules in `ip6tables` (or use dual-stack `nftables inet`), leaving SSH fully exposed over public IPv6.
- C) The SSH daemon automatically downgraded to UDP.
- D) The attacker used a DNS CNAME alias to evade IP inspection.

<details><summary>Answer</summary>

**B.** In Linux legacy networking, `iptables` manages the IPv4 Netfilter firewall tables only. IPv6 traffic is governed by a completely independent binary tool and table set: `ip6tables`. Enabling dual-stack on an interface allocates a globally routable public IPv6 address. If an operator configures rules in `iptables` but forgets `ip6tables`, the server's IPv6 interface remains wide open with default `ACCEPT` policies, allowing external attackers to bypass the IPv4 firewall entirely. Modern infrastructure mandates using **`nftables` with the unified `inet` table family**, which evaluates rules atomically across both IPv4 and IPv6.

- Why not A: MAC addresses have local link scope and cannot traverse internet router hops.
- Why not C: SSH is strictly a TCP protocol and cannot operate over UDP.
- Why not D: Firewalls filter based on underlying IP addresses in the packet header, regardless of DNS CNAME chains.
- Ref: [modules/14-linux-networking-ops.md](../modules/14-linux-networking-ops.md#4-modern-firewalling-nftables--conntrack-mechanics), Netfilter Documentation.

</details>

### Q-INT-035 · Addressing & Routing · difficulty 2 · single

Why does the IPv6 fixed base header (40 bytes) eliminate the Header Checksum field that was present in the IPv4 header?

- A) IPv6 packets are guaranteed never to experience physical bit errors on fiber links.
- B) To accelerate router packet forwarding by eliminating the requirement for every router hop to recalculate checksums as the Hop Limit is decremented, relying instead on Layer 2 (Ethernet CRC) and Layer 4 (TCP/UDP) checksums.
- C) Because IPv6 packets are mandatorily encrypted with IPsec.
- D) To reduce header size below 32 bytes.

<details><summary>Answer</summary>

**B.** In IPv4, because the TTL is decremented at every router hop, intermediate routers were forced to recompute the 16-bit IPv4 Header Checksum on every packet in software or ASIC pipelines. The designers of IPv6 (RFC 8200) observed that physical link layers already enforce rigorous bit error detection via CRC-32 (Ethernet FCS), and transport protocols (TCP and UDP) mandatorily compute checksums over the payload and pseudo-header. Eliminating the L3 checksum from IPv6 significantly reduced forwarding latency and router CPU overhead.

- Why not A: Optical fiber and wireless links still experience bit flips, which are caught by Ethernet CRC and TCP checksums.
- Why not C: IPsec was originally designed for IPv6, but is an optional extension header, not mandatory for all packets.
- Why not D: The IPv6 fixed header is 40 bytes, which is larger than the IPv4 20-byte base header.
- Ref: [modules/03-ip-addressing-and-routing.md](../modules/03-ip-addressing-and-routing.md#1-the-ipv4-vs-ipv6-wire-format-dissection), RFC 8200.

</details>

### Q-INT-036 · Addressing & Routing · difficulty 2 · multi

Which of the following attributes are categorized as **well-known mandatory** attributes in the BGP-4 routing protocol (RFC 4271)? (Select TWO)

- A) `ORIGIN`
- B) `AS_PATH`
- C) `MED` (Multi-Exit Discriminator)
- D) `COMMUNITY`

<details><summary>Answer</summary>

**A and B.** In BGP-4, well-known mandatory attributes must be recognized by all BGP implementations and must be included in every BGP `UPDATE` route announcement:

1. `ORIGIN` (indicates how the route was learned: IGP, EGP, or INCOMPLETE)
2. `AS_PATH` (the sequence of AS numbers traversed by the route)
3. `NEXT_HOP` (the IP address of the next-hop router) `MED` is an optional non-transitive attribute, and `COMMUNITY` is an optional transitive attribute.

- Why not C: `MED` is optional and non-transitive.
- Why not D: `COMMUNITY` is optional and transitive.
- Ref: [modules/04-internet-routing-bgp-anycast.md](../modules/04-internet-routing-bgp-anycast.md#2-bgp-4-protocol-architecture--state-machine), RFC 4271.

</details>

---

## Domain 4: Resolution, Web Applications & Traffic Engineering

### Q-INT-037 · Resolution & Web Protocols · difficulty 2 · single

When a client application initiates a DNS lookup for `api.example.com`, what is the exact chronological sequence of iterative resolution queries performed by a recursive resolver starting from a cold cache?

- A) Authoritative NS → TLD Server (`.com`) → Root Server (`.`)
- B) Root Server (`.`) → TLD Server (`.com`) → Authoritative NS (`example.com`)
- C) TLD Server (`.com`) → Root Server (`.`) → Authoritative NS (`example.com`)
- D) Local `/etc/hosts` → Authoritative NS (`example.com`) → TLD Server (`.com`)

<details><summary>Answer</summary>

**B.** A recursive resolver resolving an uncached domain queries down the DNS hierarchy: (1) It queries a Root Name Server (`.`) from its pre-configured root hints, which returns a referral (NS records) to the generic Top-Level Domain (TLD) servers for `.com`; (2) It queries the `.com` TLD server, which returns a referral to the authoritative name servers for `example.com` (e.g. `ns1.example.com`); (3) It queries the authoritative server, which returns the final authoritative `A` or `AAAA` IP record.

- Why not A: Inverted order; resolution proceeds top-down from the root.
- Why not C: The resolver cannot discover the `.com` TLD servers without consulting the root zone.
- Why not D: `/etc/hosts` is checked by the client stub resolver on the local OS before querying the recursive resolver.
- Ref: [modules/08-dns.md](../modules/08-dns.md#1-the-global-dns-resolution-hierarchy), RFC 1034, RFC 1035.

</details>

### Q-INT-038 · Resolution & Web Protocols · difficulty 3 · scenario

A microservice running in a Kubernetes pod initiates outbound HTTP calls to an external service `api.vendor.com`. An engineer notices that for every single outbound HTTP request, the CoreDNS cluster experiences 5 distinct DNS queries:

1. `api.vendor.com.default.svc.cluster.local`
2. `api.vendor.com.svc.cluster.local`
3. `api.vendor.com.cluster.local`
4. `api.vendor.com.internal.net`
5. `api.vendor.com.` What is causing this 5x query multiplication, and how is it resolved?

- A) The Kubernetes CoreDNS service is suffering from cache corruption.
- B) The default Kubernetes `ndots:5` setting in `/etc/resolv.conf` forces the resolver to append search domains to any domain name with fewer than 5 dots before attempting an absolute query; resolved by appending a trailing dot (`api.vendor.com.`) in application configs or setting `ndots:2`.
- C) The external API vendor has configured circular CNAME records.
- D) CoreDNS is attempting DNSSEC validation over UDP.

<details><summary>Answer</summary>

**B.** By default, Kubernetes configures container `/etc/resolv.conf` with `options ndots:5` and a search list (`<ns>.svc.cluster.local svc.cluster.local cluster.local`). The `ndots:5` parameter instructs the client resolver that if a query string contains fewer than 5 dots (e.g. `api.vendor.com` has only 2 dots), the resolver must sequentially append every search path in the search list before querying the domain as an absolute FQDN. This generates 4 consecutive `NXDOMAIN` queries before the 5th query succeeds, multiplying DNS query volume by 5x and introducing 20–80 ms of artificial latency. Solutions include appending a trailing dot (`api.vendor.com.`) in client configurations or overriding `dnsConfig.options.ndots` to 2.

- Why not A: CoreDNS is behaving exactly as instructed by the client's resolver configuration.
- Why not C: Circular CNAMEs cause resolution loops at the authoritative level, not sequential cluster search expansions.
- Why not D: DNSSEC validation does not inject local Kubernetes search domain prefixes.
- Ref: [modules/08-dns.md](../modules/08-dns.md#1-the-global-dns-resolution-hierarchy), Kubernetes DNS Specification.

</details>

### Q-INT-039 · Resolution & Web Protocols · difficulty 2 · single

What is the fundamental architectural difference between a Layer 4 Load Balancer (e.g., AWS NLB, Linux IPVS) and a Layer 7 Reverse Proxy (e.g., AWS ALB, Envoy, NGINX)?

- A) L4 load balancers terminate TLS; L7 reverse proxies do not.
- B) L4 load balancers forward TCP/UDP packets based on 5-tuple hashing without inspecting application payloads; L7 reverse proxies terminate TCP and TLS, parsing HTTP headers, cookies, and URLs to perform path-based routing.
- C) L4 load balancers can modify HTTP request headers; L7 reverse proxies cannot.
- D) L4 load balancers operate only on physical switches; L7 reverse proxies run exclusively in client browsers.

<details><summary>Answer</summary>

**B.** A Layer 4 load balancer operates at the transport layer: it evaluates incoming packets based on the 5-tuple (Source IP, Source Port, Dest IP, Dest Port, Protocol), maintains a translation table, and forwards packets at wire rate without terminating the TCP connection or inspecting application payloads. A Layer 7 reverse proxy terminates the client TCP connection, terminates the TLS session, and parses the application protocol (HTTP/1.1, HTTP/2, gRPC). This allows L7 proxies to perform URL path routing (`/api` vs `/static`), header rewrites, cookie session affinity, and TLS offloading, at the expense of higher CPU memory and latency overhead.

- Why not A: Inverted; Layer 7 proxies terminate TLS, while Layer 4 pass-through proxies forward raw encrypted ciphertext.
- Why not C: Layer 4 load balancers have no visibility into HTTP headers and cannot modify them.
- Why not D: Both Layer 4 and Layer 7 balancers are server-side infrastructure components.
- Ref: [modules/13-load-balancing-cdn-nat.md](../modules/13-load-balancing-cdn-nat.md#1-layer-4-vs-layer-7-load-balancing-architecture), Stevens TCP/IP Illustrated Vol. 1.

</details>

### Q-INT-040 · Resolution & Web Protocols · difficulty 2 · scenario

An engineer deploys an internal microservice behind an Envoy reverse proxy. When backend servers inspect access logs, all incoming client requests appear to originate from the proxy's internal IP address (`10.0.1.254`) rather than the real client IP. What protocol header or mechanism must be enabled to pass the real client IP to the backend?

- A) `X-Forwarded-For` header or HAProxy `PROXY protocol` (v1/v2)
- B) The IP Time-to-Live (TTL) header
- C) TCP SACK Permitted option
- D) TLS Server Name Indication (SNI)

<details><summary>Answer</summary>

**A.** When a Layer 7 reverse proxy terminates a client connection and opens a new connection to a backend server, the Layer 3 source IP of the backend packet is rewritten to the proxy's own egress IP. To preserve client visibility, the proxy must append the client's original IP to the **`X-Forwarded-For` (XFF)** HTTP header (or `Forwarded` / RFC 7239). For non-HTTP or Layer 4 TCP proxying, the proxy must prepend the **PROXY protocol** header (v1 text or v2 binary), which explicitly communicates the original client IP and port before application data starts.

- Why not B: TTL controls hop limit loop prevention, carrying no client IP metadata.
- Why not C: SACK indicates support for selective TCP acknowledgments.
- Why not D: SNI indicates the hostname the client requested in the TLS handshake.
- Ref: [modules/13-load-balancing-cdn-nat.md](../modules/13-load-balancing-cdn-nat.md#1-layer-4-vs-layer-7-load-balancing-architecture), HAProxy PROXY Protocol Spec.

</details>

### Q-INT-041 · Resolution & Web Protocols · difficulty 2 · single

In HTTP caching (RFC 9111), what is the difference between the `Cache-Control` directives `no-cache` and `no-store`?

- A) `no-cache` forbids caching anywhere; `no-store` allows browser caching but forbids CDN caching.
- B) `no-cache` allows caches to store the response but mandates validating it with the origin server (e.g. via `ETag` / `If-None-Match`) before serving; `no-store` strictly forbids any cache (client or proxy) from storing the response in non-volatile memory.
- C) `no-cache` applies to HTTP/1.1; `no-store` applies to HTTP/2 only.
- D) `no-cache` enables gzip compression; `no-store` disables compression.

<details><summary>Answer</summary>

**B.** A universal web engineering misconception is assuming `no-cache` prevents caching. In RFC 9111:

- **`no-cache`**: The response **may be stored** by browser and CDN caches. However, the cache **must not** serve the stored response to satisfy a request without first revalidating freshness with the origin server (using conditional headers `If-None-Match` or `If-Modified-Since`).
- **`no-store`**: The response contains highly confidential or sensitive data (e.g. banking records, passwords). Caches **must not store** any part of the request or response in non-volatile storage and must purge it immediately after streaming.

- Why not A: Inverted; `no-store` is the strict prohibition, while `no-cache` allows storage with revalidation.
- Why not C: Both directives apply identically across HTTP/1.1, HTTP/2, and HTTP/3.
- Why not D: Caching directives have no relation to HTTP compression algorithms.
- Ref: [modules/13-load-balancing-cdn-nat.md](../modules/13-load-balancing-cdn-nat.md#5-content-delivery-networks-cdns--rfc-9111-caching), RFC 9111 Section 5.2.

</details>

### Q-INT-042 · Resolution & Web Protocols · difficulty 3 · scenario

A high-traffic e-commerce platform uses an edge CDN to cache product catalog pages. An engineer observes that whenever a flash sale starts, hundreds of backend origin servers crash simultaneously with database CPU saturation, even though the cached product page has an active `max-age=60` header. What caching failure mode is occurring, and how is it mitigated?

- A) DNS poisoning; mitigated by disabling DNSSEC.
- B) Cache stampede (thundering herd) upon TTL expiration; mitigated by configuring **Origin Shielding** and the **`stale-while-revalidate`** (RFC 5861) caching directive.
- C) Slowloris denial of service; mitigated by reducing keepalive timeouts.
- D) Cross-Site Scripting (XSS); mitigated by setting Content-Security-Policy.

<details><summary>Answer</summary>

**B.** When a heavily requested asset expires in an edge CDN cache, a **cache stampede** (thundering herd) occurs: hundreds of concurrent requests arriving at the exact millisecond of TTL expiry discover a `CACHE MISS` simultaneously and all bypass the cache to query the backend database at once. Mitigation requires:

1. **`stale-while-revalidate` (RFC 5861)**: Instructs the CDN to serve the stale cached version instantly to arriving clients while asynchronously dispatching a single background request to revalidate with the origin.
2. **Origin Shielding / Request Collapsing**: The CDN edge coalesces concurrent requests for the same URL, sending exactly one request to the origin and fanning out the response to all waiting clients.

- Why not A: DNS poisoning routes traffic to rogue servers, not origin crash under flash sales.
- Why not C: Slowloris slowly transmits HTTP headers to exhaust web server sockets.
- Why not D: XSS is a browser code execution vulnerability, having no relation to backend cache stampedes.
- Ref: [modules/13-load-balancing-cdn-nat.md](../modules/13-load-balancing-cdn-nat.md#5-content-delivery-networks-cdns--rfc-9111-caching), RFC 5861, RFC 9111.

</details>

### Q-INT-043 · Resolution & Web Protocols · difficulty 2 · single

How is a WebSocket connection established on the wire (RFC 6455)?

- A) By opening a direct raw UDP socket on port 8080.
- B) By initiating an HTTP/1.1 `GET` request containing `Upgrade: websocket` and `Connection: Upgrade` headers, which the server accepts with `HTTP/1.1 101 Switching Protocols`.
- C) By transmitting a BGP route advertisement containing an encapsulated framing opcode.
- D) By opening a raw TCP socket and sending an SSL 3.0 ClientHello.

<details><summary>Answer</summary>

**B.** WebSockets establish bidirectional communication over standard web infrastructure by performing an in-band protocol upgrade:

1. Client sends an HTTP/1.1 `GET` request:
   ```http
   GET /chat HTTP/1.1
   Host: server.example.com
   Upgrade: websocket
   Connection: Upgrade
   Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
   Sec-WebSocket-Version: 13
   ```
2. Server responds with `HTTP/1.1 101 Switching Protocols`:
   ```http
   HTTP/1.1 101 Switching Protocols
   Upgrade: websocket
   Connection: Upgrade
   Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
   ```
3. The underlying TCP socket remains open, transitioning immediately into the binary WebSocket framing protocol.

- Why not A: WebSockets operate over TCP on ports 80/443, not UDP.
- Why not C: BGP is an exterior gateway routing protocol.
- Why not D: SSL 3.0 is an insecure obsolete encryption protocol; WebSockets use TLS 1.2 or 1.3.
- Ref: [modules/12-realtime-and-rpc.md](../modules/12-realtime-and-rpc.md#2-websockets-on-the-wire-the-rfc-6455-upgrade--framing), RFC 6455.

</details>

### Q-INT-044 · Resolution & Web Protocols · difficulty 2 · scenario

An engineering team deploys a live stock market ticker using WebSockets behind an AWS Network Load Balancer (NLB). Active clients report that every 60 seconds of market inactivity, their WebSocket connection drops abruptly without error headers. What is causing the disconnection, and what is the protocol remedy?

- A) The client browser memory cache is full.
- B) The load balancer or stateful firewall is silently dropping the idle TCP connection tracking entry due to lack of traffic; remedied by transmitting application-level WebSocket Ping/Pong heartbeat frames (Opcode `0x9` / `0xA`) every 30 seconds.
- C) The server certificate is expiring every minute.
- D) The client is negotiating HTTP/3.

<details><summary>Answer</summary>

**B.** Intermediate network infrastructure—stateful firewalls, NAT gateways, and load balancers—maintains an idle connection timeout (typically 60 to 350 seconds) in their connection tracking tables. If an established WebSocket stream carries zero bytes for longer than this idle timeout, the middlebox silently purges the state entry from its table. Subsequent packets are dropped or rejected with TCP RST. The standard remedy mandated by RFC 6455 is transmitting periodic WebSocket **Ping frames (`Opcode 0x9`)**, to which the peer automatically responds with a **Pong frame (`Opcode 0xA`)**, keeping intermediate conntrack tables active.

- Why not A: Browser cache has no role in active persistent WebSocket framing.
- Why not C: TLS certificates have lifetimes of days or months, never 60 seconds.
- Why not D: WebSockets operate over TCP; negotiation of HTTP/3 does not cause silent 60-second timeouts.
- Ref: [modules/12-realtime-and-rpc.md](../modules/12-realtime-and-rpc.md#2-websockets-on-the-wire-the-rfc-6455-upgrade--framing), RFC 6455 Section 5.5.

</details>

### Q-INT-045 · Resolution & Web Protocols · difficulty 2 · single

Why does gRPC achieve substantially higher serialization performance and lower wire overhead compared to traditional REST APIs using JSON over HTTP/1.1?

- A) gRPC compiles all endpoints into C++ assembly language.
- B) gRPC combines compact binary Protocol Buffers serialization (varint encoding, tag-based fields) with HTTP/2 binary framing and persistent multiplexing over a single TCP socket.
- C) gRPC runs unencrypted over UDP.
- D) gRPC bypasses the operating system kernel network stack using DPDK.

<details><summary>Answer</summary>

**B.** gRPC derives its high performance from two architectural layers:

1. **Protocol Buffers (Protobuf)**: A strongly typed binary serialization format. Fields are identified by small integer field tags rather than human-readable text strings (`"first_name": "Alice"`), integers use compact variable-length varint encoding, and numeric values require zero textual parsing.
2. **HTTP/2 Transport**: Multiplexes thousands of concurrent bidirectional RPCs over a single persistent TCP connection using binary framing (`HEADERS` and `DATA` frames) with HPACK header compression, eliminating HTTP/1.1 connection setup latency and head-of-line blocking.

- Why not A: gRPC provides polyglot libraries across Go, Java, Python, Rust, and Node.js without requiring assembly.
- Why not C: Production gRPC runs over HTTP/2 with mandatory TLS encryption.
- Why not D: Standard gRPC uses standard POSIX socket APIs.
- Ref: [modules/12-realtime-and-rpc.md](../modules/12-realtime-and-rpc.md#6-grpc-over-http2-architecture--wire-framing), gRPC Wire Specification.

</details>

### Q-INT-046 · Resolution & Web Protocols · difficulty 3 · scenario

An infrastructure team migrates an internal microservice architecture to gRPC. They place an existing Layer 4 TCP load balancer in front of 10 backend gRPC service pods. Under peak traffic, one backend pod crashes due to 100% CPU utilization, while the other 9 pods remain completely idle at 2% CPU. What architectural mismatch caused this failure?

- A) The backend pods are failing memory allocation due to Go garbage collection.
- B) Because gRPC multiplexes all RPC requests over a single long-lived HTTP/2 TCP connection, a Layer 4 load balancer balances the initial TCP connection only, pinning all subsequent RPC requests from a client to the single backend pod that accepted the connection.
- C) The Layer 4 load balancer is dropping Protocol Buffer messages larger than 1,500 bytes.
- D) The client is failing TLS certificate validation.

<details><summary>Answer</summary>

**B.** Layer 4 load balancers operate at the transport layer (TCP), distributing incoming traffic on connection establishment. In traditional REST/HTTP 1.1, clients open and close multiple TCP connections, spreading load naturally across backends. In gRPC, a client opens a **single persistent HTTP/2 TCP connection** and multiplexes thousands of concurrent RPC streams across it for hours. A Layer 4 load balancer assigns the TCP connection to Pod A on startup; all subsequent gRPC calls across that connection are forwarded exclusively to Pod A. To distribute load across individual RPC calls, infrastructure must deploy a **Layer 7 proxy (e.g. Envoy, gRPC lookaside load balancing)** that inspects individual HTTP/2 `DATA` frames.

- Why not A: The single-pod crash was caused by uneven traffic concentration, not an intrinsic runtime bug.
- Why not C: L4 load balancers stream arbitrary byte streams regardless of protobuf size.
- Why not D: If TLS validation failed, no requests would be processed at all.
- Ref: [modules/12-realtime-and-rpc.md](../modules/12-realtime-and-rpc.md#6-grpc-over-http2-architecture--wire-framing), Envoy gRPC Architecture.

</details>

### Q-INT-047 · Resolution & Web Protocols · difficulty 2 · single

Under what conditions does a web browser trigger an HTTP `OPTIONS` preflight request before executing a Cross-Origin Resource Sharing (CORS) fetch?

- A) Whenever the request uses HTTP/2.
- B) Whenever the request is non-simple: uses verbs other than `GET`, `HEAD`, or `POST`, carries custom headers (e.g. `Authorization`), or specifies a `Content-Type` other than plain text, form-urlencoded, or multipart.
- C) Whenever the target domain does not have a valid TLS certificate.
- D) Whenever the response payload exceeds 1 MB.

<details><summary>Answer</summary>

**B.** The browser Same-Origin Policy (SOP) protects user sessions from cross-origin exploitation. For "simple requests" (`GET`/`HEAD`/`POST` with basic headers like `Accept` and standard content types), the browser sends the request immediately. If a request is "non-simple"—carrying custom application headers (`Authorization`, `X-Api-Key`), payload types like `application/json`, or state-mutating verbs (`PUT`, `DELETE`, `PATCH`)—the browser first sends an `OPTIONS` request to verify that the server explicitly permits the origin, method, and headers via `Access-Control-Allow-*` response headers.

- Why not A: CORS rules are enforced by browser security engines regardless of underlying HTTP version.
- Why not C: Missing TLS certificates trigger browser security warning pages before CORS evaluation occurs.
- Why not D: Payload size does not determine preflight requirements.
- Ref: [modules/10-http-1-1-and-http-2.md](../modules/10-http-1-1-and-http-2.md#cross-origin-resource-sharing-cors-on-the-wire--preflight-handshake), W3C Fetch Specification.

</details>

### Q-INT-048 · Resolution & Web Protocols · difficulty 2 · single

A frontend developer configures an authenticated Single Page Application communicating with an API gateway across domains. The API server returns:

```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true
```

Why does the client browser reject the response and throw a CORS security error in the JavaScript console?

- A) The API server must be hosted on port 80.
- B) The W3C Fetch specification strictly prohibits using the wildcard `*` for `Access-Control-Allow-Origin` when `Access-Control-Allow-Credentials` is set to `true`.
- C) The browser requires HTTP/3 for credentialed cross-origin requests.
- D) The client request lacked an ETag validation header.

<details><summary>Answer</summary>

**B.** The W3C Fetch standard explicitly forbids pairing `Access-Control-Allow-Origin: *` with `Access-Control-Allow-Credentials: true`. Allowing arbitrary third-party origins to execute credentialed requests (carrying user session cookies, basic auth, or client TLS certs) against an API would enable malicious websites to read private user data (Cross-Site Script Inclusion / CSRF data theft). To allow credentials, the server must validate the incoming `Origin` against a strict allowlist and echo back the exact origin string (e.g. `Access-Control-Allow-Origin: https://app.example.com`), pairing it with `Vary: Origin`.

- Why not A: Port 80 is plaintext HTTP; CORS applies across all ports and schemes.
- Why not C: Credentialed requests operate identically across HTTP/1.1, HTTP/2, and HTTP/3.
- Why not D: ETags are used for cache validation, having no role in CORS authorization.
- Ref: [modules/10-http-1-1-and-http-2.md](../modules/10-http-1-1-and-http-2.md#cross-origin-resource-sharing-cors-on-the-wire--preflight-handshake), W3C Fetch Specification Section 3.2.

</details>

---

## Domain 5: Security, Observability & Cloud Network Virtualization

### Q-INT-049 · Security & Infrastructure · difficulty 2 · single

In a Zero Trust Architecture utilizing Mutual TLS (mTLS) for microservice communication, how does a server cryptographically verify the identity of an incoming client during the TLS 1.3 handshake?

- A) By inspecting the client's source IP address in the IP header.
- B) The server transmits a `CertificateRequest` handshake message; the client returns its X.509 certificate and a `CertificateVerify` digital signature computed over the handshake transcript.
- C) By checking the client's API key in an unencrypted HTTP header.
- D) By querying the local DNS server for the client's reverse PTR record.

<details><summary>Answer</summary>

**B.** In TLS 1.3 mTLS (RFC 8446 Section 4.4.2), the server demands client proof by sending a **`CertificateRequest`** frame. The client responds with:

1. `Certificate`: The client's X.509 certificate chain (often carrying a SPIFFE workload identity in the Subject Alternative Name).
2. `CertificateVerify`: A digital signature created with the client's private key over the SHA-256/384 cryptographic transcript of all preceding handshake messages. The server verifies the signature using the client's public certificate and validates the certificate against its internal trusted Root CA, proving workload identity cryptographically without trusting the network perimeter.

- Why not A: In Zero Trust, network locality and IP addresses are untrusted and easily spoofed.
- Why not C: API keys sent in HTTP headers do not provide cryptographic mutual transport authentication.
- Why not D: Reverse DNS lookups are unauthenticated, slow, and easily manipulated.
- Ref: [modules/09-tls-1-3-and-pki-on-the-wire.md](../modules/09-tls-1-3-and-pki-on-the-wire.md#mutual-tls-mtls--zero-trust-identity-on-the-wire), NIST SP 800-207.

</details>

### Q-INT-050 · Security & Infrastructure · difficulty 3 · scenario

A high-traffic e-commerce cluster uses Istio service mesh with automated mTLS certificate rotation (24-hour validity certificates issued by HashiCorp Vault). At midnight, automated rotation stalls on worker node 4 due to a transient API rate limit. What immediate operational failure will occur across the cluster?

- A) Node 4 will automatically downgrade to plaintext HTTP without interruption.
- B) Once the existing 24-hour certificates expire, all inter-service mTLS handshakes involving pods on Node 4 will immediately fail with `certificate verify failed` (Alert 48 / 45), cascading into HTTP 503 Service Unavailable errors across dependent workloads.
- C) The Linux kernel on Node 4 will trigger a kernel panic.
- D) The switch will disable Node 4's physical Ethernet port.

<details><summary>Answer</summary>

**B.** In strict mTLS Zero Trust architectures, certificate validation is mandatory. X.509 certificates contain explicit `notBefore` and `notAfter` validity timestamps. When certificates expire, the OpenSSL/BoringSSL TLS engine enforces strict cryptographic rejection, returning a fatal `certificate_expired` alert and terminating the TCP connection immediately. Workloads attempting to communicate with pods on Node 4 will receive connection resets, resulting in cascading HTTP 503 errors across the microservice graph.

- Why not A: In strict mTLS mode, plaintext fallbacks are explicitly prohibited.
- Why not C: Certificate validation occurs in user space (Envoy proxy) and does not crash the Linux kernel.
- Why not D: Physical link state is completely decoupled from application-layer TLS certificate validity.
- Ref: [modules/09-tls-1-3-and-pki-on-the-wire.md](../modules/09-tls-1-3-and-pki-on-the-wire.md#mutual-tls-mtls--zero-trust-identity-on-the-wire), RFC 8446.

</details>

### Q-INT-051 · Security & Infrastructure · difficulty 2 · single

How does WireGuard's Cryptokey Routing architecture enforce network layer security on its virtual interface (`wg0`)?

- A) By dynamically negotiating complex IPsec Phase 2 Security Associations (SAs) using IKEv2.
- B) By binding each peer's static public key directly to an `AllowedIPs` list; outgoing packets are encrypted with the key matching the destination IP, and incoming packets are accepted only if their decrypted source IP matches the sending key's allowed prefix.
- C) By blocking all UDP traffic except on port 80.
- D) By requiring every packet to carry a Kerberos ticket.

<details><summary>Answer</summary>

**B.** WireGuard (RFC 8439) discards the complex Security Policy Database (SPD) and dynamic SA negotiation of IPsec. Instead, it implements **Cryptokey Routing**:

1. The `wg0` interface behaves like an ordinary Layer 3 interface in the routing table.
2. The WireGuard configuration explicitly associates each peer's public key with a list of `AllowedIPs` (e.g. `AllowedIPs = 10.8.0.2/32`).
3. Transmission: The kernel checks destination IP `10.8.0.2`, looks up the associated public key, encrypts the payload via ChaCha20-Poly1305, and sends the outer UDP packet.
4. Reception: When an incoming packet decrypts successfully with a peer's key, the kernel verifies that the inner packet's source IP is in that peer's `AllowedIPs`. If not, it is dropped immediately, eliminating IP spoofing.

- Why not A: WireGuard deliberately eliminates IKEv2 and complex SA state machines.
- Why not C: WireGuard operates over UDP port 51820, not port 80.
- Why not D: WireGuard uses asymmetric public key cryptography, not Kerberos tickets.
- Ref: [modules/14-linux-networking-ops.md](../modules/14-linux-networking-ops.md#6-vpns--modern-tunneling-wireguard-mechanics), Donenfeld (NDSS 2017).

</details>

### Q-INT-052 · Security & Infrastructure · difficulty 3 · scenario

An engineer configures a WireGuard VPN tunnel to connect an employee's laptop (`10.8.0.2`) to an office internal network (`192.168.1.0/24`). The employee works from a home broadband connection where the local Wi-Fi router also assigns addresses in `192.168.1.0/24`. When the VPN connects, the employee can reach the internet, but all attempts to access internal office servers (`192.168.1.50`) time out. What is the root cause?

- A) WireGuard does not support split-tunneling.
- B) Route table collision: the laptop's local routing table contains two overlapping routes for `192.168.1.0/24`; the local physical Wi-Fi interface metric takes precedence over the virtual `wg0` interface, routing traffic to the home LAN instead of through the tunnel.
- C) The home router is blocking UDP port 51820.
- D) The WireGuard interface requires Jumbo frames.

<details><summary>Answer</summary>

**B.** This is the classic **overlapping RFC 1918 subnet collision** in VPN split-tunneling. When the employee's laptop connects to its local home Wi-Fi, the DHCP client configures a direct link route: `192.168.1.0/24 dev wlan0 proto kernel scope link metric 100`. When WireGuard attempts to add a route for the office network `192.168.1.0/24 dev wg0`, the operating system routing table encounters identical prefix lengths. Packets destined for `192.168.1.50` match the local LAN route, transmitting an ARP request onto the employee's home living-room network rather than encrypting and tunneling to the office. Enterprise networks mitigate this by numbering internal subnets in unique, non-standard ranges (e.g. `10.240.0.0/16`).

- Why not A: WireGuard fully supports split-tunneling via granular `AllowedIPs` configuration.
- Why not C: If UDP port 51820 were blocked, the handshake would fail completely, whereas internet traffic works.
- Why not D: WireGuard defaults to MTU 1420 bytes, which operates cleanly over standard 1500-byte links.
- Ref: [modules/14-linux-networking-ops.md](../modules/14-linux-networking-ops.md#6-vpns--modern-tunneling-wireguard-mechanics), RFC 1918.

</details>

### Q-INT-053 · Security & Infrastructure · difficulty 2 · single

Why is an `nftables` stateful firewall capable of processing millions of packets per second with sub-microsecond latency, whereas a Web Application Firewall (WAF) introduces several milliseconds of latency per request?

- A) `nftables` runs in user space; WAF runs in kernel space.
- B) `nftables` inspects fixed Layer 3/4 header 5-tuples in kernel memory at wire speed; a WAF must terminate TLS, decrypt ciphertext, reassemble TCP byte streams, and parse complex Layer 7 HTTP payloads and JSON bodies against regular expression rule sets.
- C) `nftables` disables TCP checksum verification.
- D) A WAF requires physical hardware tokens for each HTTP request.

<details><summary>Answer</summary>

**B.** The performance difference stems from the layer of operation:

- **`nftables`** operates in the Linux kernel network stack at Layer 3/4. It inspects fixed-offset packet headers (IP addresses, ports, TCP flags) and evaluates sets in $O(1)$ constant time using kernel hash tables and stateful conntrack entries without touching or decrypting the payload.
- **WAF** operates at Layer 7. It terminates the TLS connection, decrypts the ciphertext, reassembles out-of-order TCP packets into an HTTP stream, parses multipart bodies and JSON strings, and evaluates hundreds of complex regular expression rules (e.g. OWASP Core Rule Set) looking for SQL injection or XSS patterns, consuming significant CPU cycles and memory buffering.

- Why not A: Inverted; `nftables` is in-kernel bytecode, while WAFs typically run in user-space reverse proxies.
- Why not C: Checksum verification is offloaded to NIC hardware, having no bearing on firewall speed.
- Why not D: WAFs do not require hardware tokens to inspect traffic.
- Ref: [modules/14-linux-networking-ops.md](../modules/14-linux-networking-ops.md#stateful-packet-filtering-vs-web-application-firewalls-waf), OWASP CRS Documentation.

</details>

### Q-INT-054 · Security & Infrastructure · difficulty 3 · scenario

A security engineer deploys an aggressive Web Application Firewall (WAF) rule set on a developer documentation portal (`docs.example.com`). Shortly after deployment, developers report that attempting to save technical markdown articles containing SQL examples (e.g. `SELECT * FROM users WHERE id = 1;`) fails with an `HTTP 403 Forbidden` error. What operational failure occurred?

- A) A DNS rebinding attack on the documentation portal.
- B) A WAF false positive: the inspection engine matched benign documentation markdown against generic SQL injection (SQLi) signature patterns.
- C) The client exhausted its ephemeral source port pool.
- D) The database server crashed due to a deadlock.

<details><summary>Answer</summary>

**B.** WAF inspection engines rely heavily on pattern-matching regular expressions (e.g. detecting SQL keywords `SELECT`, `UNION`, `WHERE`, `--`). In developer-facing applications, technical blogs, or CMS platforms where users intentionally upload source code snippets or markdown, generic WAF rules frequently trigger **false positives**, mistaking legitimate code examples for active SQL injection exploits. Mitigations include tuning WAF rule sensitivity, scoping rules to exclude specific input parameters (e.g. `article_body`), or enforcing strict syntactic JSON schemas rather than broad heuristic regex scans.

- Why not A: DNS rebinding circumvents Same-Origin Policy in browsers, not triggering 403s on form saves.
- Why not C: Source port exhaustion triggers connection timeouts, not immediate HTTP 403 Forbidden responses.
- Why not D: An HTTP 403 Forbidden is generated by the WAF proxy before the request reaches the database.
- Ref: [modules/14-linux-networking-ops.md](../modules/14-linux-networking-ops.md#stateful-packet-filtering-vs-web-application-firewalls-waf), OWASP WAF Tuning Guide.

</details>

### Q-INT-055 · Security & Infrastructure · difficulty 2 · single

In a Token Bucket rate-limiting algorithm with bucket capacity $B = 100\text{ tokens}$ and token refill rate $r = 10\text{ tokens/sec}$ (where each request consumes 1 token), what is the maximum number of requests that can be processed in a sudden instantaneous burst at time $T = 0$, and what is the maximum sustainable request throughput over 10 seconds?

- A) Burst: 10 requests; 10-second total: 100 requests
- B) Burst: 100 requests; 10-second total: 200 requests
- C) Burst: 1000 requests; 10-second total: 100 requests
- D) Burst: 50 requests; 10-second total: 500 requests

<details><summary>Answer</summary>

**B.** In the Token Bucket algorithm:

1. **Instantaneous Burst Capacity**: If the bucket has accumulated tokens up to its maximum capacity $B$, the system can immediately process a burst equal to $B = 100\text{ requests}$ at wire rate until the bucket is exhausted.
2. **Maximum Throughput over Interval $T$**: The total requests processed in time $T$ is bounded by the formula: $$M(T) = B + r \cdot T$$ For $T = 10\text{ seconds}$, $M(10) = 100 + (10 \times 10) = 100 + 100 = 200\text{ requests}$.

- Why not A: The burst is limited by bucket depth $B$ (100), not the refill rate $r$ (10).
- Why not C: The burst cannot exceed the bucket capacity of 100 tokens.
- Why not D: Miscalculates the burst and sustained rate parameters.
- Ref: [modules/07-congestion-control.md](../modules/07-congestion-control.md#7-traffic-shaping-token-bucket-algorithms--rate-limiting), Network Queueing Theory.

</details>

### Q-INT-056 · Security & Infrastructure · difficulty 2 · scenario

An engineering team rate-limits an unauthenticated public search API to 100 requests per minute per IP address (`req.ip`). During a major conference, hundreds of attendees connected to the conference Wi-Fi report that opening the mobile app immediately returns `HTTP 429 Too Many Requests`, even though individual attendees made only 1 request. What caused this outage?

- A) The conference Wi-Fi experienced an ARP poisoning attack.
- B) All conference attendees shared a single public IPv4 NAT address; the aggregate traffic of hundreds of users instantly exhausted the 100-request bucket assigned to that single IP.
- C) The search API database deadlocked.
- D) The mobile app failed to validate the server's TLS certificate.

<details><summary>Answer</summary>

**B.** Internet service providers, cellular mobile carriers (Carrier-Grade NAT / RFC 6598), and conference venues route thousands of independent client devices through a shared egress NAT gateway presenting a single public IPv4 address. When an API gateway implements rate limiting based purely on Layer 3 source IP (`req.ip`), all conference attendees share a single rate-limiting bucket. A handful of active users will deplete the 100-request quota, triggering HTTP 429 blocks for all other attendees on that network. Robust rate limiters key on cryptographically authenticated session tokens, API keys, or device identifiers rather than raw source IP addresses.

- Why not A: ARP poisoning disrupts local Layer 2 frame forwarding, not application HTTP 429 rate limits.
- Why not C: A database deadlock returns HTTP 500 Internal Server Error, not HTTP 429 Too Many Requests.
- Why not D: TLS validation failure produces network handshake errors, not valid HTTP 429 status codes.
- Ref: [modules/07-congestion-control.md](../modules/07-congestion-control.md#7-traffic-shaping-token-bucket-algorithms--rate-limiting), RFC 6598.

</details>

### Q-INT-057 · Security & Infrastructure · difficulty 2 · single

In Differentiated Services (DiffServ / RFC 2474) quality of service (QoS) architectures, what is the purpose of the 6-bit Differentiated Services Code Point (DSCP) in the IP header?

- A) To specify the destination MAC address on a local switch.
- B) To classify packets into priority queues (e.g., Expedited Forwarding `EF 46` for voice traffic, Assured Forwarding `AF` for video, Best Effort `CS0`) so routers can schedule traffic and eliminate bufferbloat for real-time streams.
- C) To encrypt the payload with AES-GCM.
- D) To count the number of router hops traversed.

<details><summary>Answer</summary>

**B.** The 6-bit DSCP field (residing in the IPv4 Type of Service byte or IPv6 Traffic Class byte) allows network endpoints and border routers to classify traffic into distinct quality-of-service classes. Routers evaluate DSCP bits to place packets into separate hardware queueing disciplines (e.g., Priority Queueing, Fair Queueing with FQ-CoDel). Time-sensitive, low-jitter voice traffic is marked with **Expedited Forwarding (EF / codepoint 46)** to bypass bulk queues, while standard web traffic is marked **Best Effort (BE / CS0)**.

- Why not A: MAC addressing is a Layer 2 Ethernet function.
- Why not C: DSCP is a plaintext classification header, having no encryption capability.
- Why not D: Router hops are tracked by the TTL / Hop Limit field.
- Ref: [modules/07-congestion-control.md](../modules/07-congestion-control.md#7-traffic-shaping-token-bucket-algorithms--rate-limiting), RFC 2474.

</details>

### Q-INT-058 · Security & Infrastructure · difficulty 2 · single

Why are DSCP quality-of-service markings often ineffective when packets traverse the public commercial Internet?

- A) IPv6 routers do not support DSCP headers.
- B) Transit Internet Service Providers (ISPs) routinely "bleach" (overwrite to zero / `CS0`) all incoming DSCP bits at their border peering routers to prevent unauthorized prioritization of untrusted customer traffic.
- C) TCP checksum verification fails if DSCP bits are non-zero.
- D) Ethernet switches reject frames carrying DSCP tags.

<details><summary>Answer</summary>

**B.** While DSCP is universally supported within private corporate networks, campus backbones, and managed SD-WAN links, public transit ISPs do not honor customer QoS tags. To prevent customer traffic from starving paid transit traffic, ISP edge routers enforce "DSCP bleaching" policies: they overwrite the 6-bit DSCP field to `000000` (Best Effort / `CS0`) upon ingress. Consequently, QoS guarantees require dedicated MPLS circuits, SD-WAN tunnels, or private peering interconnects.

- Why not A: IPv6 natively supports DSCP in its 8-bit Traffic Class header.
- Why not C: The IPv4 header checksum includes the TOS byte and is recalculated whenever DSCP is modified; TCP checksum covers an IP pseudo-header that excludes the TOS byte entirely.
- Why not D: Ethernet switches forward IP packets regardless of DSCP markings.
- Ref: [modules/07-congestion-control.md](../modules/07-congestion-control.md#7-traffic-shaping-token-bucket-algorithms--rate-limiting), RFC 2474.

</details>

### Q-INT-059 · Security & Infrastructure · difficulty 3 · single

In a VXLAN overlay network (RFC 7348), how many distinct isolated virtual Layer 2 broadcast domains can be represented by the 24-bit VXLAN Network Identifier (VNI), and how does this compare to IEEE 802.1Q VLANs?

- A) VXLAN supports 4,096 segments; 802.1Q supports 65,536 segments.
- B) VXLAN supports $2^{24} = 16,777,216$ virtual network segments; 802.1Q supports only $2^{12} = 4,096$ VLANs.
- C) VXLAN supports 256 segments; 802.1Q supports 16 million segments.
- D) Both protocols support exactly 1,024 segments.

<details><summary>Answer</summary>

**B.** IEEE 802.1Q allocates a 12-bit VLAN Identifier (VID), which strictly caps the maximum number of isolated Layer 2 segments at $2^{12} = 4,096$ (with 0 and 4095 reserved, leaving 4,094 usable). In modern cloud environments and Kubernetes datacenters hosting tens of thousands of tenants, 4,096 is grossly insufficient. VXLAN (RFC 7348) introduces an 8-byte header containing a 24-bit **VXLAN Network Identifier (VNI)**, expanding the segment namespace to $2^{24} = 16,777,216$ isolated virtual networks.

- Why not A: Inverted; 802.1Q is the 12-bit protocol capped at 4,096.
- Why not C: 256 is an 8-bit limit.
- Why not D: Neither standard is limited to 1,024.
- Ref: [modules/14-linux-networking-ops.md](../modules/14-linux-networking-ops.md#7-cloud-virtualization--overlay-networks-vxlan-rfc-7348), RFC 7348.

</details>

### Q-INT-060 · Security & Infrastructure · difficulty 3 · scenario

An infrastructure engineer configures a VXLAN overlay across multiple Linux Kubernetes worker nodes using `ip link add vxlan0 type vxlan id 100 dstport 4789 dev eth0`. Pods on different nodes communicate smoothly with small `ping` packets (64 bytes), but `scp` file transfers and TLS handshakes freeze and fail completely. The physical network has an MTU of 1,500 bytes. What configuration change resolves the problem?

- A) Change the VXLAN port from 4789 to 80.
- B) Clamp the MTU of the virtual `vxlan0` overlay interface to 1,450 bytes (or increase the physical underlay MTU to at least 1,550 bytes) to accommodate the 50 bytes of VXLAN outer UDP/IP encapsulation overhead.
- C) Disable TCP checksum offload on the physical NIC.
- D) Reconfigure the nodes to use IPv6 link-local addresses.

<details><summary>Answer</summary>

**B.** A standard Ethernet packet has an MTU of 1,500 bytes. When a pod transmits a 1,500-byte packet over a VXLAN overlay, the VTEP wraps it inside an outer Ethernet header (14B), outer IPv4 header (20B), outer UDP header (8B), and VXLAN header (8B), adding exactly **50 bytes of wire overhead**. The resulting outer packet is 1,550 bytes. Because the physical switch has an MTU of 1,500 bytes and the packet has DF=1 (Don't Fragment), the switch silently drops it. Small 64-byte ping packets pass easily ($64 + 50 = 114\text{ bytes} < 1500$). The resolution is either configuring the physical network switches for **Jumbo frames** ($\text{MTU} \ge 1600$), or clamping the overlay interface MTU down to $1500 - 50 = 1450\text{ bytes}$.

- Why not A: Port 4789 is the IANA-assigned standard port for VXLAN; changing ports does not alter MTU framing.
- Why not C: Checksum offload does not cause MTU-exceeded packet drops.
- Why not D: Switching to IPv6 would increase outer header overhead by another 20 bytes (IPv6 base header is 40B vs IPv4 20B), exacerbating the issue.
- Ref: [modules/14-linux-networking-ops.md](../modules/14-linux-networking-ops.md#vxlan-encapsulation--the-50-byte-mtu-overhead-trap), RFC 7348 Section 5.

</details>

---

## Mock Examination: Senior Systems Networking Technical Interview Loop

- **Format**: 30 questions, timed at 90 minutes.
- **Passing Standard**: $\ge 80\%$ (at least 24 / 30 correct).
- **Domain Mix**: Balanced representation across all 5 networking domains.

```
+-------------------------------------------------------------------------------+
| Mock Exam Question Distribution:                                              |
|   - Questions 1–6:   Domain 1 (Architecture & Models)                         |
|   - Questions 7–12:  Domain 2 (Core Protocols & Transport)                    |
|   - Questions 13–18: Domain 3 (Addressing, Routing & Peering)                 |
|   - Questions 19–24: Domain 4 (Resolution, Web & Traffic Engineering)         |
|   - Questions 25–30: Domain 5 (Security, Observability & Cloud Virtualization)|
+-------------------------------------------------------------------------------+
```

### Mock Exam Questions

1. **[Q-INT-001]** Why is the OSI model descriptive rather than operational?
2. **[Q-INT-002]** What causes packet drops on a 45% utilized backbone link?
3. **[Q-INT-004]** Why do large TLS certificates hang when small API requests work?
4. **[Q-INT-005]** Which header fields are rewritten at Layer 3 router hops?
5. **[Q-INT-008]** Why does per-packet ECMP hashing degrade TCP throughput?
6. **[Q-INT-010]** What is the operational impact of high BDP on unscaled TCP?
7. **[Q-INT-013]** Why are TCP Initial Sequence Numbers (ISNs) pseudorandomized?
8. **[Q-INT-014]** How do TCP SYN Cookies protect against SYN flood attacks?
9. **[Q-INT-016]** Why does packet drop cause Head-of-Line blocking in TCP but not UDP?
10. **[Q-INT-017]** How does QUIC eliminate stream-level Head-of-Line blocking?
11. **[Q-INT-019]** Why does traceroute show high loss at hop 4 while traffic is healthy?
12. **[Q-INT-021]** How does TLS 1.3 achieve a 1-RTT connection handshake?
13. **[Q-INT-025]** How many usable host IPs exist in a `/22` subnet on AWS/GCP?
14. **[Q-INT-026]** What rule dictates IP route selection among overlapping CIDR prefixes?
15. **[Q-INT-027]** What causes connection timeouts on a NAT gateway with low CPU?
16. **[Q-INT-029]** What BGP attribute is evaluated first in standard path selection?
17. **[Q-INT-030]** Why does mid-stream BGP Anycast route shifting break TCP connections?
18. **[Q-INT-031]** What cryptographic mechanism prevents BGP prefix hijacking?
19. **[Q-INT-037]** What is the sequence of queries in uncached recursive DNS resolution?
20. **[Q-INT-038]** Why does Kubernetes `ndots:5` cause 5x DNS query multiplication?
21. **[Q-INT-039]** What is the architectural difference between Layer 4 and Layer 7 proxies?
22. **[Q-INT-040]** How is the client source IP passed through a reverse proxy?
23. **[Q-INT-041]** What is the difference between `Cache-Control: no-cache` and `no-store`?
24. **[Q-INT-042]** What causes a cache stampede during a flash sale, and how is it mitigated?
25. **[Q-INT-049]** How does a server cryptographically verify client identity in mTLS?
26. **[Q-INT-051]** How does WireGuard enforce security via Cryptokey Routing?
27. **[Q-INT-052]** Why does split-tunnel VPN traffic fail with identical RFC 1918 subnets?
28. **[Q-INT-054]** Why do technical blog uploads trigger false-positive WAF 403 blocks?
29. **[Q-INT-056]** Why does IP-based rate limiting fail for users behind Carrier-Grade NAT?
30. **[Q-INT-060]** Why do large packets fail over VXLAN when physical MTU is 1500 bytes?

---

### Scoring Key & Evaluation Matrix

| Score | Rating | Recommendation |
| :-: | :-- | :-- |
| **28–30 (93–100%)** | **Staff / Principal Systems Engineer** | Exceptional deep-systems intuition; ready to architect internet-scale platforms. |
| **24–27 (80–90%)** | **Senior Systems / SRE Engineer** | Solid operational mechanics; passes senior technical interview loop. |
| **20–23 (67–77%)** | **Mid-Level Systems Engineer** | Good foundation; review failure modes in BGP Anycast, PMTUD, and VXLAN MTU traps. |
| **< 20 (< 67%)** | **Apprentice / Gap Identified** | Study [modules/01-14](../modules/) thoroughly before sitting for senior technical interviews. |
