# Networking Systems Architecture Fast-Lookup Cheatsheet

A high-density technical reference sheet for packet wire formats, CIDR subnetting math, TCP state transitions, BGP path selection, congestion control mechanics, and Linux kernel networking diagnostics.

---

## 1. Physical & Link Layer: Ethernet II & 802.1Q Framing

### Ethernet II Header Layout

```
+-------------------+-------------------+-------------------+-------------------+
|  Destination MAC  |    Source MAC     | EtherType (2 B)   | Payload           |
|     (6 Bytes)     |     (6 Bytes)     | 0x0800: IPv4      | (46 - 1500 Bytes) |
|                   |                   | 0x86DD: IPv6      |                   |
+-------------------+-------------------+-------------------+-------------------+
| FCS / CRC-32 (4 Bytes)                                                        |
+-------------------------------------------------------------------------------+
Total Frame Size on Wire: 64 to 1518 Bytes (excl. 7B preamble + 1B SFD + 12B IPG)
```

### 802.1Q VLAN Tagged Frame (4-Byte Insertion)

```
+-------------------+-------------------+-------------------+-------------------+
|  Destination MAC  |    Source MAC     | TPID: 0x8100 (2B) | TCI (2 Bytes)     |
+-------------------+-------------------+-------------------+-------------------+
TCI Breakdown:
  - Priority Code Point (PCP): 3 bits (QoS / 802.1p class of service 0-7)
  - Drop Eligible Indicator (DEI): 1 bit (0 = ineligible, 1 = drop eligible)
  - VLAN Identifier (VID): 12 bits (VLAN ID 0 to 4095; 0 and 4095 reserved)
Followed by: Original EtherType (2B) + Payload (46-1500B) + FCS (4B)
```

---

## 2. Network Layer: IPv4, IPv6 & CIDR Subnetting

### IPv4 Header Layout (20–60 Bytes)

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|Version|  IHL  |    DSCP   |ECN|          Total Length         |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|         Identification        |Flags|     Fragment Offset     |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|  Time to Live |    Protocol   |        Header Checksum        |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                       Source IP Address                       |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                    Destination IP Address                     |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                    Options (0 - 40 Bytes)                     |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
Protocol Numbers: 1 = ICMP, 6 = TCP, 17 = UDP
ECN Bits: 00 = Non-ECT, 10 = ECT(0), 01 = ECT(1), 11 = CE (Congestion Experienced)
```

### IPv6 Fixed Base Header (Strictly 40 Bytes)

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|Version| Traffic Class |           Flow Label (20 bits)        |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|         Payload Length        |  Next Header  |   Hop Limit   |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                                                               |
+                                                               +
|                   Source IPv6 Address (128 bits)              |
+                                                               +
|                                                               |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                                                               |
+                                                               +
|                 Destination IPv6 Address (128 bits)           |
+                                                               +
|                                                               |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

### CIDR Subnetting Matrix (IPv4)

| Prefix | Subnet Mask | Total Addresses | Usable Hosts | Use Case |
| :-: | :-- | :-: | :-: | :-- |
| **/32** | `255.255.255.255` | 1 | 1 | Single host route / Loopback VIP |
| **/31** | `255.255.255.254` | 2 | 2 (RFC 3021) | Point-to-point router link |
| **/30** | `255.255.255.252` | 4 | 2 | Legacy point-to-point link |
| **/29** | `255.255.255.248` | 8 | 6 | Small server DMZ |
| **/28** | `255.255.255.240` | 16 | 14 | Small office / Kubernetes node pod CIDR |
| **/27** | `255.255.255.224` | 32 | 30 | Departmental subnet |
| **/26** | `255.255.255.192` | 64 | 62 | Medium subnet |
| **/25** | `255.255.255.128` | 128 | 126 | Large subnet |
| **/24** | `255.255.255.0` | 256 | 254 | Standard LAN / Class C block |
| **/20** | `255.255.240.0` | 4,096 | 4,094 | Corporate office site |
| **/16** | `255.255.0.0` | 65,536 | 65,534 | Cloud VPC address space |
| **/8** | `255.0.0.0` | 16,777,216 | 16,777,214 | RFC 1918 private `10.0.0.0/8` |

---

## 3. Autonomous Systems & BGP Best Path Selection

### BGP-4 Best Path Selection Hierarchy (RFC 4271)

When multiple candidate routes exist for the identical prefix, the BGP engine selects the best route by evaluating attributes in this **strict immutable order**:

```
 1. Highest WEIGHT (Cisco-specific, local to router, default 0, 32768 for local)
 2. Highest LOCAL_PREF (Standard attribute across iBGP, default 100)
 3. Locally Originated Routes (network / aggregate > redistribute)
 4. Shortest AS_PATH (Count of autonomous system hops; AS_SET counts as 1)
 5. Lowest Origin Code (IGP [i] < EGP [e] < Incomplete [?])
 6. Lowest MED (Multi-Exit Discriminator sent between peering ASNs)
 7. eBGP over iBGP (External peering path preferred over internal)
 8. Lowest IGP Metric to Next-Hop Router (Shortest internal path to exit)
 9. Lowest BGP Router ID (Tie-breaker using 32-bit loopback IP)
10. Lowest Peering IP Address
```

---

## 4. Transport Layer: UDP & TCP Internals

### UDP Header Layout (Fixed 8 Bytes, RFC 768)

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|          Source Port          |       Destination Port        |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|            Length             |           Checksum            |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

### TCP Header Layout (20–60 Bytes, RFC 9293)

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|          Source Port          |       Destination Port        |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                        Sequence Number                        |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                    Acknowledgment Number                      |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
| Data |       |C|E|U|A|P|R|S|F|                                |
|Offset| Rsrvd |W|C|R|C|S|S|Y|I|            Window Size         |
|      |       |R|E|G|K|H|T|N|N|                                |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|           Checksum            |        Urgent Pointer         |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                    Options (0 - 40 Bytes)                     |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
Flags: CWR (0x80), ECE (0x40), URG (0x20), ACK (0x10), PSH (0x08), RST (0x04), SYN (0x02), FIN (0x01)
Common Options: MSS (Kind 2, Len 4), Window Scale (Kind 3, Len 3), SACK Permitted (Kind 4, Len 2), Timestamps (Kind 8, Len 10)
```

### RFC 9293 TCP 11-State Transition Summary

| State | Trigger / Event | Action Taken | Next State |
| :-- | :-- | :-- | :-- |
| **CLOSED** | Passive Open (`listen()`) | Allocate TCB | **LISTEN** |
| **CLOSED** | Active Open (`connect()`) | Send `SYN(seq=x)` | **SYN_SENT** |
| **LISTEN** | Receive `SYN(seq=x)` | Send `SYN(seq=y), ACK(ack=x+1)` | **SYN_RECEIVED** |
| **SYN_SENT** | Receive `SYN, ACK` | Send `ACK(ack=y+1)` | **ESTABLISHED** |
| **SYN_RECEIVED** | Receive `ACK(ack=y+1)` | None | **ESTABLISHED** |
| **ESTABLISHED** | Close (`close()`, active) | Send `FIN(seq=u)` | **FIN_WAIT_1** |
| **ESTABLISHED** | Receive `FIN(seq=v)` (passive) | Send `ACK(ack=v+1)` | **CLOSE_WAIT** |
| **FIN_WAIT_1** | Receive `ACK` of FIN | None | **FIN_WAIT_2** |
| **FIN_WAIT_1** | Receive `FIN` | Send `ACK` (simultaneous close) | **CLOSING** |
| **FIN_WAIT_2** | Receive `FIN` | Send `ACK` | **TIME_WAIT** |
| **CLOSE_WAIT** | Application `close()` | Send `FIN` | **LAST_ACK** |
| **CLOSING** | Receive `ACK` of FIN | None | **TIME_WAIT** |
| **LAST_ACK** | Receive `ACK` of FIN | Delete TCB | **CLOSED** |
| **TIME_WAIT** | Timer expires ($2 \times \text{MSL}$) | Delete TCB | **CLOSED** |

---

## 5. Congestion Control & Buffer Management

### Core Formulas

- **Bandwidth-Delay Product (BDP)**: $$\text{BDP} = \text{Bottleneck Bandwidth} \times \text{RTT}$$
- **AIMD Steady-State Window**:
  - Congestion Avoidance: $W_{t+1} = W_t + 1\text{ MSS}$ per RTT
  - Loss Recovery (3 DupACKs): $W_{\text{new}} = W_{\text{curr}} \times 0.5$
- **CUBIC Window Growth Function (RFC 9438)**: $$W_{\text{cubic}}(t) = C \cdot (t - K)^3 + W_{\max}, \quad \text{where } K = \sqrt[3]{\frac{W_{\max} \cdot (1 - \beta)}{C}}$$
  - $C = 0.4$ (scaling factor), $\beta = 0.7$ (multiplicative decrease factor on loss)
- **BBR Control Targets (Kleinrock Point)**:
  - In-Flight Target: $\text{BDP} = \text{BtlBw} \times \text{RTprop}$
  - Pacing Rate: $\text{Rate} = \text{pacing-gain} \times \text{BtlBw}$

---

## 6. Domain Name System (DNS) & DNSSEC

### Standard DNS Record Types

| Record | Type Code | Payload Contents | Description |
| :-- | :-: | :-- | :-- |
| **A** | `1` | 32-bit IPv4 Address (`192.0.2.1`) | Host IPv4 mapping |
| **AAAA** | `28` | 128-bit IPv6 Address (`2001:db8::1`) | Host IPv6 mapping |
| **CNAME** | `5` | Canonical Domain Name string | Canonical alias (forbidden at zone apex) |
| **MX** | `15` | Preference (16b) + Exchange Hostname | Mail exchange server |
| **TXT** | `16` | Text character strings | Arbitrary metadata (SPF, DKIM, site verification) |
| **SOA** | `6` | Primary NS, Admin, Serial, Refresh, Retry, Expire, Min TTL | Start of Authority zone parameters |
| **NS** | `2` | Authoritative Name Server Hostname | Zone delegation pointer |
| **HTTPS** | `65` | SvcPriority (16b) + TargetName + SvcParams (`alpn`, `port`, `ipv4hint`, `ech`) | RFC 9460 apex alias & HTTP/3 ALPN advertisement |
| **OPT** | `41` | Pseudo-RR in Additional section | EDNS0 buffer sizing and extension flags |

### DNSSEC Authentication Chain

```
Root Zone (.)
  └── DNSKEY: Root KSK & ZSK
  └── DS: Hash of Child (.com) KSK
       └── .com TLD Zone
            └── DNSKEY: .com KSK & ZSK
            └── DS: Hash of example.com KSK
                 └── example.com Zone
                      └── DNSKEY: example.com KSK & ZSK
                      └── RRSIG: Digital signature over A/AAAA RRset
                      └── A: 93.184.216.34 (Validated Authenticated Data - AD bit set)
```

---

## 7. TLS 1.3 & Post-Quantum Wire Mechanics

### TLS 1.3 1-RTT Handshake Sequence

```
Client                                                   Server
ClientHello
  + supported_versions (0x0304)
  + key_share (X25519, ML-KEM-768)
  + cipher_suites (AES_128_GCM, CHACHA20)
  + server_name / ECH (encrypted)   -------->
                                                    ServerHello
                                                      + supported_versions (0x0304)
                                                      + key_share (Server Key)
                                                    {EncryptedExtensions}
                                                    {CertificateRequest*}
                                                    {Certificate}
                                                    {CertificateVerify}
                                    <--------       {Finished}
{Finished}
[Application Data]                  -------->
                                    <--------       [Application Data]
Key: {Message} encrypted with Handshake Key; [Message] encrypted with Application Key.
```

---

## 8. HTTP/2, HTTP/3 & QUIC Framing

### HTTP/2 Frame Types (RFC 9113)

| Type Code | Opcode Name | Primary Flags | Function |
| :-: | :-- | :-- | :-- |
| `0x0` | **DATA** | `END_STREAM (0x1)`, `PADDED (0x8)` | Carries arbitrary application response payload |
| `0x1` | **HEADERS** | `END_STREAM (0x1)`, `END_HEADERS (0x4)`, `PRIORITY (0x20)` | Initiates stream; carries compressed HPACK headers |
| `0x2` | **PRIORITY** | None | Stream dependency and weight |
| `0x3` | **RST_STREAM** | None | Unilaterally aborts/cancels an active stream |
| `0x4` | **SETTINGS** | `ACK (0x1)` | Negotiates connection parameters (`MAX_CONCURRENT_STREAMS`, etc.) |
| `0x5` | **PUSH_PROMISE** | `END_HEADERS (0x4)` | Server push announcement (rarely used/deprecated) |
| `0x6` | **PING** | `ACK (0x1)` | Measures RTT; heartbeats on stream 0 |
| `0x7` | **GOAWAY** | None | Gracefully shuts down connection; states last processed stream |
| `0x8` | **WINDOW_UPDATE** | None | Per-stream or connection-level flow control credit |

### QUIC Variable-Length Integer Encoding (VarInt, RFC 9000)

| 2-Bit Prefix | Total Byte Length | Usable Integer Bits | Maximum Numeric Value |
| :-: | :-: | :-: | :-- |
| `0b00` | 1 Byte | 6 bits | $2^6 - 1 = 63$ |
| `0b01` | 2 Bytes | 14 bits | $2^{14} - 1 = 16,383$ |
| `0b10` | 4 Bytes | 30 bits | $2^{30} - 1 = 1,073,741,823$ |
| `0b11` | 8 Bytes | 62 bits | $2^{62} - 1 = 4,611,686,018,427,387,903$ |

---

## 9. Real-Time Protocols: WebSockets & gRPC

### WebSocket Frame Header Layout (RFC 6455)

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-------+-+-------------+-------------------------------+
|F|R|R|R| opcode|M| Payload len |    Extended payload length    |
|I|S|S|S|  (4)  |A|     (7)     |             (16/64)           |
|N|V|V|V|       |S|             |   (if payload len == 126/127) |
| |1|2|3|       |K|             |                               |
+-+-+-+-+-------+-+-------------+ - - - - - - - - - - - - - - - +
|     Extended payload length continued, if payload len == 127  |
+ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - +
|                     Masking-key (0 or 4 bytes)                |
+-------------------------------+-------------------------------+
|                     Payload Data (masked/unmasked)            |
+---------------------------------------------------------------+
Opcodes: 0x1 = Text, 0x2 = Binary, 0x8 = Close, 0x9 = Ping, 0xA = Pong
Client Masking Formula: unmasked[i] = masked[i] ^ mask_key[i % 4]
```

---

## 10. Linux Kernel Networking Operations Cheat Sheet

### Common Diagnostic Commands

```bash
# Link & Address Management (iproute2)
ip link show                           # Display interfaces, MACs, MTUs, and link state
ip -br addr show                       # Brief IP address summary across all devices
ip route show                          # Display kernel IP routing table
ip neighbor show                       # Display ARP (IPv4) and NDP (IPv6) cache

# Socket Statistics (ss)
ss -lntp                               # List listening TCP sockets with process names
ss -t -i 'sport = :443'                 # Display TCP internal metrics (RTT, cwnd, pacing)
ss -u -a                               # List all UDP sockets (connected & unconnected)

# Packet Capture & BPF Filtering (tcpdump)
tcpdump -nn -i eth0 'tcp[tcpflags] & (tcp-syn|tcp-ack) == tcp-syn' # Capture only TCP SYN packets
tcpdump -nn -i eth0 'port 53 and udp'                              # Capture DNS UDP queries
tcpdump -w trace.pcap -i any -s 0                                  # Full packet capture to file

# Performance & Timing Breakdown (curl)
curl -w "\nDNS: %{time_namelookup}s\nConnect: %{time_connect}s\nTLS: %{time_appconnect}s\nTTFB: %{time_starttransfer}s\nTotal: %{time_total}s\n" \
     -o /dev/null -s https://example.com

# Traffic Control & Netem Latency Injection
tc qdisc add dev eth0 root netem delay 50ms 5ms loss 1%          # Emulate WAN: 50ms +- 5ms delay, 1% loss
tc qdisc del dev eth0 root                                        # Remove netem qdisc rules

# Container Networking & Namespaces
ip netns add blue                                                 # Create isolated network namespace
ip link add veth-host type veth peer name veth-blue              # Create virtual ethernet pair
ip link set veth-blue netns blue                                 # Move peer into blue namespace
ip netns exec blue ip addr add 10.200.1.2/24 dev veth-blue        # Configure IP in namespace
ip netns exec blue ip link set veth-blue up                       # Bring interface up in namespace
```

---

## 11. 30 Must-Know Networking Concepts Master Matrix

| # | Concept Name | OSI / TCP Layer | Primary RFC / Spec | Key Ports & Headers | Primary CLI Diagnostic | Critical Failure Mode / Pitfall |
| :-: | :-- | :-- | :-- | :-- | :-- | :-- |
| **01** | **OSI 7-Layer Model** | L1–L7 (Conceptual) | ISO/IEC 7498-1 | L7 Data, L4 Segment, L3 Packet, L2 Frame, L1 Bits | `curl -Iv https://example.com --trace-time` | Conflating descriptive taxonomy with OS kernel implementation boundaries. |
| **02** | **TCP/IP 4-Layer Suite** | Link, Internet, Transport, App | RFC 1122 | L4 (TCP/UDP), L3 (IPv4/v6), L2/L1 (Link) | `ss -tulnp && ip -s link` | Assuming L2 link delivery guarantees end-to-end reliability without L4 acknowledgments. |
| **03** | **Packet Switching** | L3 Network | Network Theory | Store-and-forward, Statistical multiplexing | `mtr -rwc 20 1.1.1.1` | Packet reordering across asymmetric ECMP links triggering false TCP fast retransmits. |
| **04** | **Data Encapsulation** | L2–L7 Multi | IEEE 802.3 / RFC 791 / RFC 9293 | Eth (14B) + IP (20B) + TCP (20B) + Payload + FCS (4B) | `tcpdump -enni any -XX -c 5 port 443` | Nested encapsulation (IPsec + VXLAN + WireGuard) ballooning header overhead and shrinking effective MSS. |
| **05** | **MTU & IP Fragmentation** | L2 / L3 | RFC 791, RFC 1191 | Ethernet MTU: 1500B, Flags: DF/MF, Offset | `ping -M do -s 1472 8.8.8.8` | Firewalls blocking ICMP Type 3 Code 4 creating PMTUD black holes on large packets. |
| **06** | **MAC vs IP Addressing** | L2 vs L3 | IEEE 802.3 / RFC 791 | MAC: 48-bit EUI-48, IPv4: 32-bit, IPv6: 128-bit | `ip neigh show && ip addr show` | Expecting client MAC address to survive routing across L3 boundaries. |
| **07** | **TCP 3-Way Handshake** | L4 Transport | RFC 9293 | Flags: SYN, SYN-ACK, ACK; ISN; Window Scale | `tcpdump -ni any "tcp[tcpflags] & (tcp-syn\|tcp-ack) != 0"` | 1-RTT connection setup penalty on transoceanic links without connection keep-alives. |
| **08** | **UDP (User Datagram Protocol)** | L4 Transport | RFC 768 | 8-byte header: SrcPort, DstPort, Length, Checksum | `nc -uvz 1.1.1.1 53` | Unbounded senders without application-level pacing saturating router queues. |
| **09** | **QUIC & HTTP/3** | L4 Transport / L7 App | RFC 9000, RFC 9114 | UDP port 443, Connection ID (CID), 0-RTT TLS 1.3 | `curl --http3 -I https://cloudflare-quic.com` | Enterprise firewalls and middleboxes blocking UDP/443 forcing fallback to TCP. |
| **10** | **ICMP (Ping & Traceroute)** | L3 Network | RFC 792, RFC 4443 | Type 8 (Echo), Type 0 (Reply), Type 11 (TTL Exceeded), Type 3 (Unreachable) | `traceroute -I -n 8.8.8.8` | Core router Control Plane Policing (CoPP) rate-limiting ICMP responses, producing artificial packet loss. |
| **11** | **ARP (Address Resolution)** | L2 / L3 Glue | RFC 826 | EtherType `0x0806`, Opcode: 1 (Request), 2 (Reply) | `arping -I eth0 -c 3 192.168.1.1` | ARP poisoning / spoofing on flat L2 networks lacking Dynamic ARP Inspection (DAI). |
| **12** | **TLS 1.3 Handshake** | L6 / L7 Security | RFC 8446 | 1-RTT: ClientHello + KeyShare, ServerHello + KeyShare + AEAD | `openssl s_client -connect example.com:443 -tls1_3` | Non-idempotent HTTP state-mutating requests exposed to replay attacks over 0-RTT early data. |
| **13** | **IPv4 vs IPv6 Architecture** | L3 Network | RFC 791 / RFC 8200 | IPv4: 20–60B var, IPv6: 40B fixed, no checksum, NDP multicast | `ip -6 route show && ping6 -c 3 2606:4700:4700::1111` | Forgetting `ip6tables` / IPv6 security groups on dual-stack hosts, exposing unprotected endpoints. |
| **14** | **CIDR & Subnetting** | L3 Network | RFC 4632 | Prefix length `/n`, Longest Prefix Match (LPM) | `ip route get 10.240.0.42` | Provisioning `/28` subnets in Kubernetes clusters and exhausting pod IPs during rolling updates. |
| **15** | **NAT & PAT (Masquerading)** | L3 / L4 Translation | RFC 3022, RFC 1918 | Conntrack 5-tuple table, ephemeral source ports | `conntrack -L -p tcp --dport 443 \| head -n 10` | Source port exhaustion (65,535 tuple limit per destination IP) on high-concurrency egress gateways. |
| **16** | **DHCP DORA Process** | L2 / L7 Config | RFC 2131 | UDP 67 (Srv) / 68 (Cli), Discover, Offer, Request, ACK | `tcpdump -ni any port 67 or port 68 -vv` | Rogue DHCP servers on unmanaged switch ports assigning invalid gateways (DHCP snooping needed). |
| **17** | **BGP (Border Gateway Protocol)** | L3 / L4 Path-Vector | RFC 4271 | TCP port 179, `AS_PATH`, `LOCAL_PREF`, `MED` | `whois -h whois.radb.net -- "-i origin AS13335"` | Route leaks and missing RPKI ROV prefix validation allowing unauthorized prefix hijacks. |
| **18** | **Unicast, Multicast & Anycast** | L3 Topologies | RFC 1112 (IGMP), RFC 4786 (Anycast) | Multicast `224.0.0.0/4`, BGP Anycast shared VIP | `ip maddr show && dig +short CHAOS TXT id.server @1.1.1.1` | BGP route flapping during Anycast TCP flows shifting packets mid-stream to a different PoP. |
| **19** | **DNS Recursive Resolution** | L7 Application | RFC 1034, RFC 1035 | UDP/TCP port 53, A/AAAA/CNAME/TXT/HTTPS, DNSSEC | `dig +trace +nodnssec example.com A` | Kubernetes CoreDNS `ndots:5` multiplying query volume 5x on external lookups. |
| **20** | **Reverse Proxy vs Load Balancer** | L4 / L7 Traffic | Architecture Theory | L4: 5-tuple hash; L7: TLS termination, path routing, `X-Forwarded-For` | `curl -I -H "X-Forwarded-Proto: https" https://example.com` | Losing client source IP in backend logs due to missing `X-Forwarded-For` or PROXY protocol config. |
| **21** | **CDN & Edge Caching** | L7 Caching | RFC 9111 | `Cache-Control`, `max-age`, `stale-while-revalidate`, ETag | `curl -sI https://www.cloudflare.com \| grep -iE "cache\|age\|etag"` | Accidentally caching `Set-Cookie` or personalized user data due to missing `Vary: Authorization`. |
| **22** | **WebSockets (Full-Duplex)** | L7 Application | RFC 6455 | HTTP 101 Switching Protocols, 2–14B frame header, masking | `curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" https://echo.websocket.org` | Intermediate load balancers dropping idle WebSocket connections after 60s without ping/pong heartbeats. |
| **23** | **gRPC & HTTP/2 Multiplexing** | L7 Application | gRPC Spec / RFC 9113 | `Content-Type: application/grpc`, 9-byte HTTP/2 frames, Protobuf | `grpcurl -plaintext localhost:9090 list` | Using naive Layer 4 TCP load balancer with gRPC, pinning all multiplexed streams to a single backend pod. |
| **24** | **CORS (Cross-Origin Resource Sharing)** | L7 Browser Security | W3C Fetch / RFC 9110 | `Origin`, `OPTIONS` preflight, `Access-Control-Allow-Origin` | `curl -i -X OPTIONS https://api.example.com -H "Origin: https://app.dev" -H "Access-Control-Request-Method: POST"` | Returning `Access-Control-Allow-Origin: *` with `Access-Control-Allow-Credentials: true` (browser rejects). |
| **25** | **Zero Trust & Mutual TLS (mTLS)** | L4–L7 Security | RFC 8446 §4.4.2, NIST SP 800-207 | Client/Server X.509 certs, `CertificateRequest`, SPIFFE URI | `openssl s_client -connect internal.svc:8443 -cert client.crt -key client.key` | Silent service-mesh certificate expiration triggering cascading 503 connection errors. |
| **26** | **VPN & WireGuard Tunneling** | L3 over L4 UDP | RFC 8439, Noise IK | UDP port 51820, ChaCha20-Poly1305, Cryptokey Routing | `wg show && ip -d link show wg0` | Overlapping local and remote subnets (`192.168.1.0/24`) causing split-tunnel routing ambiguity. |
| **27** | **Stateful Firewall vs WAF** | L3/L4 vs L7 Security | Netfilter / OWASP CRS | L4: 5-tuple conntrack (`NEW`, `ESTABLISHED`); L7: HTTP DPI | `nft list ruleset && ss -s` | Overly aggressive WAF regex rules triggering false positive 403 blocks on legitimate markdown/code uploads. |
| **28** | **DDoS & Token Bucket Rate Limiting** | L3–L7 Protection | RFC 6598, Traffic Control | HTTP 429 `Retry-After`, bucket capacity $B$, refill rate $r$ | `curl -sI https://api.github.com/users/octocat \| grep -i ratelimit` | Rate-limiting purely by source IP, blocking thousands of legitimate mobile subscribers behind Carrier-Grade NAT. |
| **29** | **QoS & Traffic Shaping** | L2 / L3 Traffic | RFC 2474 (DSCP), RFC 8289 | 6-bit DSCP (EF = 46), FQ-CoDel, CAKE, ECN | `tc -s qdisc show dev eth0` | DSCP markings routinely bleached (zeroed) by transit ISPs across public Internet boundaries. |
| **30** | **VPC & VXLAN Overlay Networks** | L2 over L3/L4 UDP | RFC 7348 | UDP port 4789, 24-bit VNI (16.7M segments), VTEP encap | `ip -d link show vxlan0 && bridge fdb show` | Failing to account for 50 bytes of VXLAN outer header overhead, causing MTU underlay fragmentation drops. |
