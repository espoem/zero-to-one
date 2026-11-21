# System Design Staff Desk Reference & Cheatsheet

An operational quick-reference covering 2026 latency and availability constants, capacity estimation formulas, architectural decision matrices, Google SRE burn-rate alerting, a 60-minute design delivery playbook, and production failure modes.

---

## 1. 2026 Numbers Every Systems Engineer Should Know

### Powers of Two & Storage Units

| Power | Exact Value | Decimal Approx | Binary Unit | Typical Mental Anchor |
| :-- | :-- | :-- | :-- | :-- |
| $2^{10}$ | $1{,}024$ | $10^{3}$ (1 thousand) | `1 KiB` | Typical HTTP header / small JSON payload |
| $2^{20}$ | $1{,}048{,}576$ | $10^{6}$ (1 million) | `1 MiB` | Medium image / compressed batch chunk |
| $2^{30}$ | $1{,}073{,}741{,}824$ | $10^{9}$ (1 billion) | `1 GiB` | 1 billion 1-byte flags; small service container RAM |
| $2^{40}$ | $1{,}099{,}511{,}627{,}776$ | $10^{12}$ (1 trillion) | `1 TiB` | Single-node NVMe SSD volume / medium OLTP DB |
| $2^{50}$ | $\approx 1.126 \times 10^{15}$ | $10^{15}$ (1 quadrillion) | `1 PiB` | Fleet-wide analytical lake / object-store tier |

### Time Constants & QPS Conversion Shortcuts

| Constant | Exact Seconds | Mental Math Approx | QPS Equivalent at 1M Events | QPS Equivalent at 100M Events |
| :-- | :-- | :-- | :-- | :-- |
| **1 Hour** | `3,600` | `3.6 × 10^3` | `~278 QPS` | `~27.8k QPS` |
| **1 Day** | `86,400` | `~10^5` (`8.64 × 10^4`) | `~11.6 QPS` ($\approx 12$) | `~1,157 QPS` ($\approx 1.2\text{k}$) |
| **1 Month (30d)** | `2,592,000` | `2.6 × 10^6` | `~0.39 QPS` | `~38.6 QPS` |
| **1 Year (365d)** | `31,536,000` | `3.15 × 10^7` | `~0.032 QPS` | `~3.17 QPS` |

### 2026 Hardware, Network, Database & LLM Serving Latencies

| Operation / Layer | 2026 Typical Latency | Throughput / Notes |
| :-- | :-- | :-- |
| **L1 / L2 / L3 CPU cache ref** | `1 ns` / `4 ns` / `15–25 ns` | Register-to-LLC boundary; false sharing triggers coherence stalls |
| **Main memory (DDR5 DRAM) access** | `60–100 ns` | `~50–100 GB/s` per socket; NUMA remote hop adds `+40–60 ns` |
| **Mutex / atomic CAS (uncontended)** | `15–25 ns` | Contended futex syscall jumps to `1–10 µs` |
| **NVMe Gen4/Gen5 SSD 4 KiB random read** | `50–100 µs` | Sequential read `7–14 GB/s`; `fsync` commit `0.2–1.0 ms` |
| **Same-AZ datacenter TCP RTT** | `0.15–0.4 ms` | 100 Gbps NIC (`12.5 GB/s` theoretical, `~10 GB/s` usable) |
| **Cross-AZ RTT (same region)** | `0.5–1.5 ms` | Synchronous Raft/Quorum commits pay 1–2 cross-AZ RTTs |
| **Redis / Valkey in-AZ command** | `0.2–0.8 ms` | Single-threaded core handles `~80k–150k ops/s` (pipelined `>1M`) |
| **PostgreSQL indexed PK lookup (in-AZ)** | `0.5–2.0 ms` | In buffer pool; disk-miss cold read adds `0.1–1 ms` on NVMe |
| **S3 / Cloud Object Store PUT or GET** | `10–50 ms` | High first-byte latency, scales horizontally to multi-TB/s |
| **TLS 1.3 handshake** | `1 RTT` (`0-RTT` resumption) | Terminated at edge PoP / L7 proxy close to user |
| **Intra-continental RTT (e.g., US-E ↔ US-W)** | `60–75 ms` (`~10–35 ms` regional) | Speed of light in fiber $\approx 200{,}000\text{ km/s}$ (`~5 µs/km` one-way) |
| **Inter-continental RTT (US-E ↔ EU / US-W ↔ APAC)** | `75–90 ms` / `140–180 ms` | Dominates non-CDN round trips; drives regional pinning |
| **LLM Serving (70B–class, H100/B200)** | **TTFT:** `100–500 ms` \| **ITL:** `10–30 ms/tok` | Prefill is compute-bound; decode is HBM-bandwidth-bound |

### Availability Nines & Exact Downtime Budgets

| Availability SLO | Downtime / Year (365d) | Downtime / 30 Days | Downtime / 7 Days | Error Budget per 1M Req |
| :-- | :-- | :-- | :-- | :-- |
| **99%** (Two 9s) | `3.65 days` (`87.6 h`) | `7.20 hours` | `1.68 hours` (`100.8 m`) | `10,000` |
| **99.9%** (Three 9s) | `8.76 hours` | `43.20 minutes` | `10.08 minutes` | `1,000` |
| **99.95%** (Three-and-a-half 9s) | `4.38 hours` | `21.60 minutes` | `5.04 minutes` | `500` |
| **99.99%** (Four 9s) | `52.56 minutes` | `4.32 minutes` | `60.48 seconds` | `100` |
| **99.995%** (Four-and-a-half 9s) | `26.28 minutes` | `2.16 minutes` | `30.24 seconds` | `50` |
| **99.999%** (Five 9s) | `5.26 minutes` (`315.4 s`) | `25.92 seconds` | `6.05 seconds` | `10` |

---

## 2. Core Capacity & Reliability Formulas

### Throughput (Average vs Peak QPS)

$$\text{QPS}_{\text{avg}} = \frac{\text{DAU} \times \text{Actions per user per day}}{86{,}400}, \qquad \text{QPS}_{\text{peak}} = \text{QPS}_{\text{avg}} \times M_{\text{diurnal}}$$

- **Diurnal multiplier** ($M_{\text{diurnal}}$): Use `2×–3×` for global consumer products, `4×–6×` for single-timezone B2B apps, and `10×+` for flash sales, live sports, or breaking-news spikes.
- **Bandwidth**: $\text{Egress (bits/s)} = \text{QPS} \times \text{Payload bytes} \times 8$. Remember `1 MiB/s ≈ 8.4 Mbps` and `10k QPS × 10 KiB = 100 MiB/s ≈ 800 Mbps`.

### 5-Year Storage with Replication & Index Overhead

$$S_{\text{5yr}} = \text{Writes/day} \times 365 \times 5 \times B_{\text{row}} \times R \times (1 + \alpha_{\text{index}}) \times (1 + \beta_{\text{headroom}})$$

- **Typical factors**: Replication factor $R = 3$, B-tree/secondary index overhead $\alpha_{\text{index}} = 0.25\text{--}0.50$, filesystem/compaction headroom $\beta_{\text{headroom}} = 0.25$.
- **Rule of thumb**: Raw payload $\times 4.5\text{--}5.5$ captures replication, indexes, WAL retention, and compaction slack.

### 80/20 Cache Working-Set Sizing

$$M_{\text{cache}} = 0.20 \times \text{Daily read working-set bytes} \times R_{\text{cache}}$$

- Size cache RAM for the **hot 20% of daily accessed items** (often `< 5%` of total 5-year cold storage), plus `1.25×` overhead for Redis/Valkey key/value metadata and fragmentation.

### Little's Law (Concurrency, Thread Pools & Queues)

$$L = \lambda W$$

- **$L$**: Average concurrent in-flight requests / occupied pool slots.
- **$\lambda$**: Arrival throughput (requests/sec).
- **$W$**: Mean service + queue dwell time (seconds).
- **Example**: `10,000 QPS` with `50 ms` (`0.05 s`) average DB latency requires at least $10{,}000 \times 0.05 = 500$ active DB connections/slots across the tier (ignoring tail spikes).

### Fan-Out Tail Latency Amplification

$$P(\text{at least 1 slow call among } n) = 1 - (1 - p)^n$$

- Where $p$ is the per-backend probability of exceeding the latency threshold (for p99, $p = 0.01$).
- At $n = 10$: $1 - 0.99^{10} = 9.56\%$. At $n = 100$: $1 - 0.99^{100} = 63.4\%$ of user requests experience p99+ tail latency!

### Composite Availability SLA

$$A_{\text{serial}} = \prod_{i=1}^{n} A_i \approx 1 - \sum_{i=1}^{n} (1 - A_i), \qquad A_{\text{parallel}} = 1 - \prod_{i=1}^{k} (1 - A_i)$$

- **Serial trap**: Three `99.9%` services on the critical synchronous path yield $0.999^3 \approx 99.7\%$ (`26.3 h/yr` downtime), not `99.9%`.
- **Parallel boost**: Two independent `99.9%` active-active paths yield $1 - (0.001)^2 = 99.9999\%$ (limited in practice by correlated failures such as shared DNS, bad config pushes, or control planes).

### LLM KV-Cache VRAM Sizing

$$B_{\text{kv-token}} = 2 \times L \times n_{\text{kv-heads}} \times d_{\text{head}} \times b_{\text{dtype}}, \qquad M_{\text{kv-total}} = B_{\text{kv-token}} \times C_{\text{active}} \times S_{\text{avg-context}}$$

- **Variables**: Factor `2` for Key + Value tensors, $L$ transformer layers, $n_{\text{kv-heads}}$ GQA/MQA KV heads, $d_{\text{head}}$ head dimension, $b_{\text{dtype}}$ bytes per element (`2` for FP16/BF16, `1` for FP8), $C_{\text{active}}$ concurrent sequences, $S_{\text{avg-context}}$ tokens per sequence.
- **Sanity check (70B GQA FP16)**: $L=80, n_{\text{kv-heads}}=8, d_{\text{head}}=128, b=2 \implies 2 \times 80 \times 8 \times 128 \times 2 = 327{,}680\text{ B} = 320\text{ KiB/token}$. At $4{,}096$ tokens, one request uses `1.25 GiB` of KV cache; a single 80 GB H100 cannot hold 70B FP16 weights (`~140 GB`), requiring TP=2–4 or FP8 quantization before leaving headroom for PagedAttention blocks.

### Worked Sanity-Check Example (100M DAU Feed / API)

- **Assumptions**: `100M` DAU, `20` reads/day + `2` writes/day per user, `1 KiB` row payload, diurnal peak $M = 5$.
- **Throughput**: $\text{Read QPS}_{\text{avg}} = \frac{2 \times 10^9}{86{,}400} \approx 23.1\text{k}$, $\text{Read QPS}_{\text{peak}} \approx 115.7\text{k}$; $\text{Write QPS}_{\text{avg}} \approx 2.3\text{k}$, $\text{Write QPS}_{\text{peak}} \approx 11.6\text{k}$.
- **5-Year Storage**: $2 \times 10^8\text{ writes/day} \times 1{,}825\text{ days} \times 1\text{ KiB} \times 5\text{ (rep + idx + slack)} \approx 1.825 \times 10^{15}\text{ B} \approx 1.66\text{ PiB}$ (or `~332 TiB` raw single-copy).
- **80/20 Cache RAM**: Hot 20% of daily reads (assuming `200M` distinct read keys/day × 20% = `40M` hot keys $\times 1\text{ KiB} \times 1.25$) $\approx 50\text{ GiB}$ — fits comfortably in a 3-shard `64 GiB` Redis/Valkey cluster.
- **Concurrency (Little's Law)**: At `115.7k` peak read QPS and `10 ms` average service time, $L = 115{,}700 \times 0.01 = 1{,}157$ concurrent in-flight slots across the API tier.

---

## 3. Architectural Decision Matrices

### Transport & Real-Time Delivery

#### API Protocol Selection

| Protocol | Wire Format & Transport | Primary Strength | Avoid When |
| :-- | :-- | :-- | :-- |
| **REST + JSON** | Text over HTTP/1.1–3 | Public APIs, browser/CDN caching, universal tooling | High-QPS internal RPC meshes, strict binary schemas |
| **gRPC + Protobuf** | Binary over HTTP/2 | Internal microservices, streaming, low CPU/payload, strict contracts | Direct browser callers without gRPC-Web / Envoy proxy |
| **GraphQL** | JSON query DSL over HTTP | BFF aggregating heterogeneous mobile/web views, eliminating over-fetching | Unbounded nested queries (DoS risk), simple high-throughput CRUD |

#### Server-to-Client Update Mechanisms

| Mechanism | Direction & Protocol | Connection Overhead | Best Use Case |
| :-- | :-- | :-- | :-- |
| **Short Polling** | Client pulls on fixed timer (HTTP) | High wasted QPS & empty responses | Infrequent background status checks (`>= 30s` interval) |
| **Long Polling** | Client holds HTTP request until event/timeout | Re-establishes headers/TLS on every message | Legacy fallback when persistent proxies strip SSE/WS |
| **Server-Sent Events (SSE)** | Unidirectional server → client (`text/event-stream`) | Native HTTP/2 multiplexing, auto-reconnect (`Last-Event-ID`) | LLM token streaming, live dashboards, feeds, notifications |
| **WebSockets** | Full-duplex bidirectional frames over TCP | Stateful connection pinning, custom heartbeats & L4/L7 sticky drain | Chat, multiplayer state, collaborative editing, trading |

### Storage Selection Matrix

| Store Class | Canonical Examples | Data Model & Query Strength | Consistency & Scale Sweet Spot | Avoid When |
| :-- | :-- | :-- | :-- | :-- |
| **Relational (SQL)** | PostgreSQL, Aurora, Spanner | Normalized tables, joins, secondary indexes, ACID transactions | Up to `~10k–50k` writes/s single primary; multi-TB with partitioning | Unbounded write fan-out without sharding; petabyte time-series |
| **Document** | MongoDB, DynamoDB (JSON) | Nested aggregates fetched by primary key or narrow secondary index | High-throughput catalog/profile records, schema flexibility | Multi-table joins, ad-hoc cross-document ACID transactions |
| **Wide-Column** | Cassandra, ScyllaDB, Bigtable | Partition key + clustering columns; sequential LSM write ingestion | Massive write-heavy time-series, IoT, messaging history (tunable quorum) | Arbitrary secondary lookups, frequent cross-partition updates |
| **In-Memory KV** | Redis, Valkey, Memcached | Sub-ms structures (hashes, sorted sets, bitmaps, Lua atomics) | Hot caches, rate limiters, leaderboards, ephemeral sessions | System-of-record durability without RDBMS backing; cold data > RAM |
| **Search Engine** | Elasticsearch, OpenSearch | Inverted index + BM25 + HNSW vector ANN + faceted aggregations | Full-text search, log analytics, hybrid lexical+semantic retrieval | Primary source of truth (eventual refresh latency, split-brain risk) |
| **Object / Blob** | AWS S3, GCS, R2 | Immutable binary objects addressed by key, multipart + presigned URLs | Media, backups, parquet lakes, `11 nines` durability at low cost | Sub-10ms random byte mutations, high-frequency small-row updates |

### Caching Patterns & Stampede / Race Defenses

#### Read/Write Caching Topologies

| Pattern | Read Path | Write Path | Durability & Consistency |
| :-- | :-- | :-- | :-- |
| **Cache-Aside** | App checks cache; on miss reads DB and populates cache | App writes DB then invalidates (`DEL`) cache | High DB durability; vulnerable to read/write stale race without leases |
| **Read-Through** | Cache library/proxy fetches DB transparently on miss | Paired with Write-Through or Write-Behind | Centralizes miss logic; still needs stampede coalescing |
| **Write-Through** | Reads hit cache | App writes cache + DB synchronously | Cache always fresh; adds DB write latency to every mutation |
| **Write-Behind** | Reads hit cache | App writes cache only; async worker flushes batch to DB | Lowest write latency & coalesced writes; **data loss risk** on cache crash |

#### Stampede & Stale-Race Defenses

| Defense | Mechanism | Prevents Stampede? | Prevents Cache-Aside Stale Race? | Key Trade-off |
| :-- | :-- | :-- | :-- | :-- |
| **Single-Flight** | Coalesces concurrent misses per key in-process/shard | Yes (per node/shard) | No (only coalesces misses) | One slow DB call stalls all coalesced callers; use per-caller timeouts |
| **XFetch** | Recomputes early when $t - \delta \beta \ln(\text{rand}) \ge t_{\text{exp}}$ | Yes (lock-free) | No | Requires tracking recomputation cost $\delta$; ineffective for cold misses |
| **Stale-While-Revalidate** | Serves expired value while async background refresh runs | Yes | Partially (single background writer) | Clients briefly observe stale values up to grace window |
| **Memcache Lease** | Server issues 64-bit lease token on miss; invalidates token on `DELETE` | Yes (1 filler per key) | **Yes** (stale `SET` rejected) | Requires cache-server protocol support (Memcache leases / Lua CAS) |
| **TTL Jitter** | Adds random spread `TTL + rand(0, jitter)` | Prevents synchronized batch expiry | No | Does not protect a single hot celebrity key expiring |

### Rate-Limiting Algorithms

| Algorithm | State per Key | Burst Handling | Boundary Accuracy | Distributed Redis Suitability |
| :-- | :-- | :-- | :-- | :-- |
| **Token Bucket** | `2 fields` (`tokens`, `last_refill_ts`) | Allows burst up to capacity $b$ | Exact continuous refill | High (atomic Lua `EVALSHA`) |
| **Leaky Bucket (Queue)** | Bounded FIFO queue + drain rate | Smooths bursts into fixed egress rate | Exact egress pacing | Poor for edge API reject; better for traffic shaping |
| **Fixed Window Counter** | `1 integer` counter per window bucket | **Flaw:** allows `2×` burst across boundary | Low at window edges | High (`INCR` + `EXPIRE`), use only when `2×` spike is safe |
| **Sliding Window Log** | Sorted set of all request timestamps | Exact rolling window | Exact | Poor memory (`O(R)` timestamps per key) |
| **Sliding Window Counter** | `2 integers` (prev + curr window counts) | Smooth approximation | High (assumes uniform prev rate) | High (`O(1)` memory, fast Redis) |
| **GCRA (Virtual Scheduling)** | `1 timestamp` (`TAT` = theoretical arrival time) | Exact burst tolerance $\tau$ + emission interval $T$ | Exact continuous | **Optimal:** `1` key value in Redis via atomic Lua |

### Messaging & Workflow Engines

| Primitive | Delivery Model | Ordering & Replay | State & Retries | Choose When |
| :-- | :-- | :-- | :-- | :-- |
| **Point-to-Point Queue** (SQS, RabbitMQ) | Competing consumers; ack deletes message | Best-effort (FIFO queues cap throughput) | Visibility timeout + DLQ after max receives | Independent background jobs, work distribution, email/webhooks |
| **Partitioned Log** (Kafka, Pulsar) | Consumer groups read immutable offset log | Strict per-partition key ordering; replayable | Offset commits; poison pills block partition without DLQ | High-throughput event streaming, CDC, multi-consumer fan-out, audit |
| **Durable Workflow Engine** (Temporal) | Deterministic event-sourced state replay | Per-workflow single-writer execution history | Built-in timers, exponential retries, compensating sagas | Multi-step business processes spanning minutes to months (payments, provisioning) |

### Geospatial Indexing

| Index | Geometry & Curve | Boundary / Distance Behavior | Dynamic Skew Handling | Best Fit |
| :-- | :-- | :-- | :-- | :-- |
| **Geohash** | Rectangular grid, Z-order curve, base-32 prefix | Requires 8-neighbor lookup; diagonal distortion at poles/equator | Static precision levels | Simple DB prefix range queries (`LIKE '9q8yy%'`) |
| **Quadtree** | Recursive 4-way 2D bounding-box split | Needs neighbor traversal across quadrant splits | **Adaptive** (splits dense cities deeper than oceans) | In-memory spatial POI indexes with highly skewed density |
| **Google S2** | Cube-projected sphere + Hilbert curve (`uint64`) | Superior spatial locality; exact spherical polygon containment | Multi-level cell coverings | Complex geofencing, containment, region coverings |
| **Uber H3** | Icosahedron projection + **Hexagons** | **Equidistant to all 6 neighbors** (no corner-diagonal skew) | Fixed hierarchical resolutions (0–15) | Ride-hailing supply/demand pricing grids, k-ring proximity |

### Contention, Inventory Reservations & Payment Patterns

| Mechanism | Lock / Validation Point | Throughput Under Hot Contention | User Experience & Safety | Best Use Case |
| :-- | :-- | :-- | :-- | :-- |
| **Pessimistic Locking** (`FOR UPDATE SKIP LOCKED`) | Row lock acquired before read/claim | Moderate (serializes same row; `SKIP LOCKED` scales pool claims) | Immediate success or skip; zero wasted retry work | Picking next available ticket/seat or worker task from pool |
| **Optimistic Concurrency (OCC)** | `UPDATE ... WHERE version = :v` at commit | **Degrades sharply** under high contention (retry storms) | Low-overhead reads when conflicts are rare (`< 5%`) | Profile edits, low-contention inventory, document updates |
| **TTL Hold + State Machine** | `AVAILABLE → HELD (expires_at) → SOLD` | High (short atomic claim transaction, slow checkout decoupled) | Gives users 5–10 min to pay without holding DB row locks | Ticketmaster seats, hotel rooms, flash-sale carts |
| **Virtual Waiting Room** | Edge token queue before origin checkout | Protects origin at constant admission rate | Predictable queue position; prevents origin collapse | 100k+ concurrent users hitting limited drop at `T=0` |
| **Double-Entry + Idempotency Key** | Immutable debit/credit rows + unique key | Bounded by ledger partition throughput | Never loses/duplicates money; PSP timeouts stay `PENDING` until reconciled | Payment gateways, digital wallets, settlement ledgers |

### Distributed ID Generators

| Format | Bit Width | Time-Ordered / B-Tree Friendly? | Coordination / Clock Dependency | Choose When |
| :-- | :-- | :-- | :-- | :-- |
| **UUIDv4** | `128-bit` | **No** (random writes cause B-tree page splits) | Zero coordination, zero clock dependency | Ephemeral correlation IDs, non-indexed tokens |
| **UUIDv7** (RFC 9562) | `128-bit` (`48b ts + 74b rand`) | **Yes** (monotonic ms prefix preserves B-tree locality) | Zero worker registration; sub-ms monotonic counter optional | Default modern primary key for distributed SQL/APIs |
| **ULID** | `128-bit` (Base32 `26 chars`) | **Yes** (lexicographically sortable string) | Zero worker registration | Human-readable URLs/logs needing lexicographic sort |
| **Snowflake ID** | `64-bit` (`1b sign + 41b ts + 10b node + 12b seq`) | **Yes** (fits `BIGINT`, compact indexes) | Requires unique worker IDs + **breaks on NTP clock rollback** | Ultra-high-throughput feeds/messages where `64-bit` index size matters |

---

## 4. Google SRE Multi-Window Multi-Burn-Rate Alerting

For a 30-day (`720 h`) SLO window with error budget $B = 1 - \text{SLO}$, burn rate $r$ is the rate at which the budget is consumed relative to steady-state (`1×` exhausts 100% in 30 days). Alert **only** when **both** the long window and the short sub-window (`1/12` of the long window) exceed the burn-rate threshold:

$$\text{Burn Rate} = \frac{\text{Observed Error Ratio}}{1 - \text{SLO}}, \qquad \text{Alert Fires} \iff (\text{Burn}_{\text{long}} > R) \land (\text{Burn}_{\text{short}} > R)$$

| Severity & Action | Burn Rate ($R$) | Long Window | Short Window (`1/12` Ratio) | Budget Consumed | Time to Exhaustion |
| :-- | :-- | :-- | :-- | :-- | :-- |
| **Page (Critical)** | **`14.4×`** | `1 hour` | `5 minutes` | **`2%`** | `50 hours` (`~2.1 days`) |
| **Page (High)** | **`6×`** | `6 hours` | `30 minutes` | **`5%`** | `120 hours` (`5 days`) |
| **Ticket / Warning (Slow Burn)** | **`1×`** | `3 days` (`72h`) | `6 hours` | **`10%`** | `30 days` (`720 hours`) |

- **Why the dual window matters**: The `1/12` short window clears pages within minutes once an incident mitigates (avoiding 1–6h sticky pages), while the long window prevents transient 1-minute blips from waking on-call engineers.

### Defense-in-Depth Request Admission & Resilience Pipeline

```mermaid
flowchart LR
  Client["Client Request"] --> Edge["Edge CDN + Origin Shield"]
  Edge --> Wait["Virtual Waiting Room"]
  Wait --> LB["L7 LB (P2C)"]
  LB --> RL["Rate Limiter (GCRA Lua)"]
  RL --> Shed["Load Shedding (LIFO + Deadline)"]
  Shed --> App["Service Bulkhead + Circuit Breaker"]
  App --> Cache["Single-Flight / Memcache Lease"]
  Cache --> Store["Primary DB / Partitioned Log"]
```

---

## 5. 60-Minute System Design Delivery Playbook

| Time Window | Phase | Concrete Execution Checklist |
| :-- | :-- | :-- |
| **`0–5 min`** | **Clarify Scope & Constraints** | Confirm core user journeys (pick top 2–3), read/write ratio, strictness of consistency vs availability, latency SLOs (p95/p99), scale (DAU, peak multiplier), and explicit non-goals. |
| **`5–13 min`** | **Back-of-the-Envelope Math** | Compute average + peak QPS, 5-year storage (with `~5×` replication/index factor), egress bandwidth, and 80/20 cache RAM. **Pivot immediately** if numbers expose a single-node bottleneck. |
| **`13–22 min`** | **API & Data Model Contract** | Define 3–5 concrete endpoints/RPCs (including `Idempotency-Key` and cursor pagination), core entities, primary/partition keys, and storage engine choices justified by access patterns. |
| **`22–42 min`** | **High-Level Architecture & Critical Flows** | Draw end-to-end read and write paths cleanly (Client → Edge/CDN → L7 LB → Services → Cache/DB/Queue). Trace both happy paths step by step before optimizing. |
| **`42–55 min`** | **Deep Dives & Bottlenecks** | Proactively attack the 2–3 hardest constraints: hot keys, cache stampede, fan-out tail latency, sharding rebalance, contention/fencing, or backpressure/DLQs. |
| **`55–60 min`** | **Failure Modes, Observability & Wrap** | Walk through AZ/region failover, SLIs/SLOs, burn-rate alerts, graceful degradation, and open trade-offs you intentionally deferred. |

### Staff / Principal Differentiating Signals

- **Assumption Log**: State unconfirmed numbers explicitly (`"Assuming 10% DAU writes 2×/day..."`) and invite interviewer adjustment before locking the architecture.
- **Quantitative Pivots**: Let math drive topology (e.g., `"1.2 Gbps egress exceeds one origin NIC → presigned S3 URLs + CDN"` or `"320 KiB/tok KV cache → PagedAttention + prefix caching"`).
- **Blast-Radius & Cost Ownership**: Name cross-AZ data transfer costs, control-plane vs data-plane coupling (static stability), and worst-case retry amplification without waiting to be asked.
- **Defending Trade-offs**: Under pushback, name what breaks if you switch options (e.g., `"Switching to OCC saves locks but fails under 1,000 req/s on one seat row"`).

---

## 6. Top 59 Production Failure Modes & One-Line Fixes

| # | Failure Mode | How It Breaks Production | One-Line Fix |
| :-- | :-- | :-- | :-- |
| **1** | **Cache Stampede** | Hot key expires and thousands of concurrent misses hammer the DB simultaneously. | Coalesce misses with `singleflight`, XFetch early refresh, or Memcache leases. |
| **2** | **Cache-Aside Stale Race** | Concurrent read-miss populates old DB value into cache after a newer write invalidated it. | Use Memcache leases (abort stale `SET` on `DEL`), or serialize per-key cache fills. |
| **3** | **CDN Private Response Leak** | CDN caches a personalized or `Set-Cookie` response and serves User A's data to User B. | Set `Cache-Control: private, no-store` on user responses and exclude `Cookie` from public cache keys. |
| **4** | **Hot Key / Celebrity Partition** | One viral key saturates a single Redis or DB shard while the rest of the cluster sits idle. | Add local L1 in-process cache (short TTL) or salt/replicate key across `K` read shards. |
| **5** | **Redis `KEYS *` / Giant `DEL`** | Single-threaded Redis blocks all clients for seconds scanning keys or freeing huge collections. | Use cursor-based `SCAN` and asynchronous `UNLINK` instead of `KEYS *` and `DEL`. |
| **6** | **Fixed-Window `2×` Boundary Burst** | Client sends `N` requests at `00:59` and `N` at `01:01`, doubling the allowed rate in 2 seconds. | Replace fixed windows with GCRA or Sliding Window Counter via atomic Redis Lua. |
| **7** | **Per-Node Rate Limiter `N×` Drift** | Local in-memory limiters allow `N × limit` across `N` API nodes, or uneven LB skews quotas. | Centralize shared quota checks in Redis/Valkey Lua (with local batch lease optimization). |
| **8** | **Fan-Out Tail Latency Amplification** | Calling `n = 100` backends at `p99 = 100 ms` pushes end-to-end slow probability to `63.4%`. | Use hedged requests (after `p95`), bounded fan-out, and graceful partial degradation. |
| **9** | **Averaging Per-Host `p99`s** | Averaging `p99` across hosts mathematically misweights skewed traffic and hides hot-shard outliers. | Aggregate HDR histograms or Prometheus `histogram_quantile` buckets across the fleet, never raw `p99`s. |
| **10** | **Unbounded Queue Latency Blowup** | Unbounded buffers accept work faster than workers drain, turning milliseconds into minutes of stale timeouts. | Bound queue capacity, shed excess load early (`503`), and switch overloaded queues to LIFO + deadline checks. |
| **11** | **Retry Storm / Metastable Failure** | Blind client retries multiply brownout traffic by `3×–5×`, locking the cluster in collapse after load subsides. | Enforce jittered exponential backoff, per-client retry budgets (`<= 10%`), and circuit breakers. |
| **12** | **Deep Health-Check Cascading Outage** | `/healthz` probes downstream DB/cache; transient DB blip makes LBs terminate the entire healthy API fleet. | Keep `/livez` process-local; separate `/readyz` and fail open/degraded rather than killing pods. |
| **13** | **Metric Label Cardinality Explosion** | Putting `user_id`, `request_id`, or raw URLs in metric labels OOMs Prometheus/TSDB index memory. | Restrict metric labels to bounded enums (`status_class`, `route_template`) and put IDs in logs/traces. |
| **14** | **Offset Pagination Drift & Scan Collapse** | `OFFSET 1000000` scans a million rows per page and duplicates/skips items as new rows arrive. | Switch to indexed keyset/cursor pagination (`WHERE (ts, id) < (:ts, :id) LIMIT N`). |
| **15** | **Snowflake NTP Clock Rollback** | NTP step-backwards causes Snowflake workers to emit duplicate or out-of-order 64-bit IDs. | Refuse/stall ID generation on backward clock skew, or use UUIDv7 / monotonic sequence fallback. |
| **16** | **Synchronized Top-of-Hour Cron Storm** | Millions of tenants firing schedules at `:00:00` create massive `100×` spikes every hour. | Apply deterministic per-tenant jitter offsets (`hash(tenant_id) % window`) to spread schedules smoothly. |
| **17** | **Consistent Hashing Without Vnodes** | Assigning 1 ring point per server causes severe key imbalance and cascading neighbor overload on node failure. | Assign `100–200` virtual nodes per physical host proportional to node capacity. |
| **18** | **Geohash Boundary Edge Blindness** | Nearby points across a geohash grid line share no common prefix and vanish from naive prefix queries. | Query the center cell plus all 8 surrounding neighbor geohash prefixes (or use S2/H3 rings). |
| **19** | **PSP Timeout Double-Charge** | Client treats a payment gateway network timeout as failure and submits a fresh charge, double-billing the user. | Treat timeouts as `UNKNOWN`, attach stable `Idempotency-Key`s, and resolve via async PSP polling/reconciliation. |
| **20** | **USL Retrograde Scaling Collapse** | Adding nodes beyond $N_{\max} = \sqrt{(1-\alpha)/\beta}$ increases cross-node coherency chatter and _reduces_ aggregate RPS. | Partition shared state into cells/shards to eliminate coherency ($\beta \to 0$) before scaling node count further. |
| **21** | **Sticky-Session AZ Evacuation Storm** | In-memory web-tier sessions drop `1/3` of logged-in users during a single-AZ failure or rolling deploy. | Externalize sessions to multi-AZ Valkey/Redis or short-lived signed tokens so the web tier is strictly stateless. |
| **22** | **Async Replica Promotion Data Loss** | Promoting a lagging async replica after primary crash drops uncommitted/unreplicated WAL transactions and risks split-brain. | Fence the old primary (STONITH/lease), audit WAL LSN lag before promotion, or use semi-sync quorum for `RPO = 0`. |
| **23** | **Autoscaler Cold-Start Thrashing** | Tight CPU thresholds without cooldown hysteresis launch redundant nodes during boot lag and terminate them on brief dips. | Account for in-flight booting pods, widen scale-in hysteresis, enforce cooldown windows, and scale on queue depth (KEDA). |
| **24** | **Quorum $W + R > N$ Linearizability Illusion** | Failed partial writes (`acks < W`) leave durable phantom data on 1 replica; concurrent readers see `new` then `old`. | Run synchronous read repair before returning, or use per-partition Paxos/Raft consensus (DynamoDB/TiKV). |
| **25** | **Sloppy Quorum Silent Staleness** | Writes acknowledged on standby nodes bypass home replicas, so strict home reads miss recent writes until handoff drains. | Disable sloppy quorums when read-your-writes matters, or route through consensus leaders instead of AP rings. |
| **26** | **LWW NTP Clock-Skew Silent Data Loss** | Wall-clock Last-Write-Wins silently drops a causally newer update whose writer node trails by milliseconds of NTP skew. | Use per-partition leader ordering, Hybrid Logical Clocks (HLC), Dotted Version Vectors (DVVs), or typed CRDTs. |
| **27** | **Zombie Data Resurrection Past `gc_grace_seconds`** | A replica offline longer than `gc_grace_seconds` rejoins after tombstones were compacted away, restoring deleted rows. | Run anti-entropy repair strictly inside `gc_grace_seconds`, and decommission/re-bootstrap nodes offline longer. |
| **28** | **Euclidean GPS Overpass Snap Jump** | Nearest-edge 2D GPS snap jumps an elevated highway driver onto a perpendicular underpass during urban-canyon multipath drift. | Use HMM Viterbi map matching with heading continuity, topological reachability, and z-level/bridge tags. |
| **29** | **Static CH Stale Highway Closure** | Contraction Hierarchies shortcuts bake static weights offline and keep routing drivers into live closures until nightly rebuilds. | Switch live driving to Customizable Route Planning (CRP) with `< 1 s` cell-overlay metric customization. |
| **30** | **Rerouting Herd Oscillation (Braess Effect)** | Pushing the identical fastest detour to 5,000 drivers floods a residential side street and oscillates cohorts back and forth. | Apply corridor saturation penalties, stochastic cohort splitting across alternates, and `>= 3–5 min` ETA hysteresis. |
| **31** | **WebSocket Gateway Reconnect Storm** | Rolling gateway deploy drops 2M pinned sockets simultaneously, triggering a 1-second TLS handshake and session-store collapse. | Drain gateways over `60–120 s`, apply client full-jitter exponential backoff, and keep resumable tokens in shared Valkey. |
| **32** | **`acks=all` + `min.insync.replicas=1` Durability Mirage** | ISR shrinks to 1 broker during a network partition; `acks=all` still succeeds on the lone leader, and a crash loses committed data. | Set `RF=3`, `acks=all`, `min.insync.replicas=2`, and `unclean.leader.election.enable=false` for durable topics. |
| **33** | **Cross-AZ Broker Replication & Fetch Egress Shock** | Multi-AZ `RF=3` replication (`2×` ingest) plus `2/3` cross-AZ consumer fetches generate `$34k–$104k/mo` cloud transfer fees at `1 GB/s`. | Enable end-to-end `zstd` compression, KIP-392 rack-aware follower fetching, and KIP-405 tiered storage or diskless S3 brokers. |
| **34** | **User-Space TLS Breaking Zero-Copy `sendfile()`** | Enabling JVM/user-space TLS forces broker bytes out of kernel page cache into heap buffers for encryption, spiking CPU and GC pauses. | Size broker CPU for TLS encryption overhead, offload TLS or use `kTLS` / C++ thread-per-core brokers, and isolate cold-consumer catch-up. |
| **35** | **Partition-Count Increase Breaking Key Ordering** | Expanding a topic from `N` to `N+k` partitions changes `hash(key) % N`, routing new events for an active key ahead of unconsumed backlog. | Pre-size partitions for peak parallelism upfront, or migrate consumers via a new topic with coordinated cutover. |
| **36** | **SQL `BETWEEN` Checkout-Night Off-By-One Bug** | `date BETWEEN checkIn AND checkOut` is inclusive, reserving the checkout morning and blocking same-day guest turnarounds (`-33%` occupancy). | Always query and update hotel stays as half-open intervals `[checkIn, checkOut)` (`date >= checkIn AND date < checkOut`) and assert `rows_affected == num_nights`. |
| **37** | **Unsorted Multi-Night Row Lock Deadlock (`40P01`)** | Concurrent transactions locking overlapping stay dates in different orders form a Coffman circular wait and abort with `SQLSTATE 40P01`. | Sort all multi-night `SELECT ... FOR UPDATE` and batch `UPDATE` queries by canonical `ORDER BY hotel_id ASC, room_type_id ASC, date ASC`. |
| **38** | **Holding DB Row Locks Across Payment Gateway RPCs** | Calling Stripe/Adyen (`500–2,000 ms`) inside an open `FOR UPDATE` inventory transaction exhausts the DB connection pool at `< 50 RPS`. | Commit the local reservation hold (`PENDING_PAYMENT`) in `< 5 ms` and orchestrate payment asynchronously via a Temporal Saga with compensating release. |
| **39** | **Rolling 730-Day CRON Horizon Starvation / Reset** | A stalled horizon cron breaks bookings 24 months ahead (`0 rows`), while a non-idempotent rerun (`DO UPDATE SET reserved = 0`) wipes sold rooms. | Seed rolling inventory horizons daily with `ON CONFLICT (hotel_id, room_type_id, date) DO NOTHING` and alert if `MAX(date) - TODAY < 720`. |
| **40** | **Shared Outbound IP Pool Poisoning (Marketing vs 2FA)** | A promotional email blast hits `>= 0.3%` spam complaints and gets the shared outbound IP throttled by Gmail/Yahoo, blocking user 2FA login codes. | Isolate transactional 2FA and marketing mail onto separate dedicated IP pools/subdomains with an automated `< 0.3%` FBL complaint circuit breaker. |
| **41** | **Undecoded Base64 Attachment Storage Bloat** | Persisting raw MIME Base64 text in S3 wastes `+33.3%` (`4/3` expansion) of petabyte storage and breaks hash deduplication across different line wraps. | Decode Base64 to canonical raw binary at the SMTP/API edge before computing `SHA-256` and writing to Content-Addressed Storage (CAS). |
| **42** | **SPF 10-Lookup `permerror` & Unaligned DMARC Spoof** | Nested SaaS `include:` records exceed RFC 7208's 10-DNS-lookup cap (`permerror`), or passing SPF without DMARC `From:` alignment admits phishing spoofs. | Delegate subdomains per sender to keep SPF `<= 10` lookups, enforce DMARC `From:` alignment (`p=quarantine/reject`), and validate RFC 8617 ARC on forwards. |
| **43** | **Unrouted Per-User Search Scatter-Gather Collapse** | Indexing emails by `email_id` without `_routing = user_id` fans every single-user search out across all `100+` Elasticsearch shards. | Set `_routing = user_id` on every index/query request so 1 user's mailbox lives on 1 shard, or embed a co-located per-user LSM inverted index. |
| **44** | **Client-Direct Score MITM Spoofing** | Game client submits its own `POST /v1/scores` payload; players intercept TLS with a proxy and forge arbitrary leaderboard ranks. | Reject client score writes completely; accept score updates only from authoritative Game Servers signed via mTLS/HMAC with an idempotent `match_id`. |
| **45** | **Valkey `fork()` CoW OOM from `26 B` Undersizing** | Sizing a `25M`-member ZSET at `26 B/member` (`650 MB`) ignores `~128 B` 64-bit skiplist+dict overhead (`3.20 GB`) and OOM-kills during `fork()` RDB snapshots. | Size 64-bit ZSETs at `~128 B/member` and provision `2×` physical RAM (`~6.40 GB` for `25M` members) for Copy-on-Write snapshot page duplication. |
| **46** | **`> 53-Bit` Float Tie-Break Rounding & Raw `ZINCRBY` Corruption** | Packing `> 53` bits into an IEEE-754 double rounds off low timestamp bits, and calling raw `ZINCRBY` adds points into the low timestamp bits. | Pack a 53-bit integer composite (`21-bit` score $\cdot 2^{32} + (2^{32}-1-\Delta t_{\text{ms}}) \le 2^{53}-1$) and mutate it exclusively via an atomic Valkey Lua script. |
| **47** | **Score-Range Ghost Duplicates & `INFO keyspace` / `ZREVRANK` Sum Bugs** | Partial cross-shard score move leaves a user in 2 range shards; reading `INFO keyspace` returns `1` key instead of member count, and summing `ZREVRANK` across hash shards yields nonsense. | Execute idempotent `ZREM` + `ZADD` range migrations (`ghost_duplicates == 0`), use `ZCARD` on upper range shards, and use `ZSCORE` + parallel `ZCOUNT` on hash shards. |
| **48** | **Naive SQL Longitude Degree Bug (`50%` Miss at `60°N`)** | `lon BETWEEN :lon - R/111320 AND :lon + R/111320` ignores meridian convergence ($\cos\phi$), cutting East-West coverage in half at Oslo (`60°N`). | Scale longitude degree deltas by $\Delta\lambda = R / (111{,}320 \times \cos\phi)$ and use a 2D spatial index (`Geohash`, `Quadtree`, `S2/H3`, `PostGIS GiST`). |
| **49** | **Unfiltered 9-Cell Geohash Diagonal Corner Leak** | Returning all POIs from the 9-cell (`3×3`) Geohash neighborhood includes diagonal cell corners up to `~2 km` away on a `500 m` query. | Always run an exact Haversine great-circle post-filter ($d \le R$) in LBS memory before sorting and returning candidates. |
| **50** | **Raw `(lat, lon)` Cache Keys (`~0%` Hit Ratio)** | Caching nearby results under 6-decimal `lat:lon` strings misses on every request due to `±5–15 m` mobile GPS jitter and pedestrian steps. | Use a Two-Tier Valkey Cache: quantized `geohash:{p}:{cell} -> business_id[]` (9-key pipeline) plus `business:{id} -> JSON details` (`MGET`). |
| **51** | **Quadtree Cold-Start Liveness Crash-Loop & Sharded Geohash Hotspots** | Gating `/livez` on a `3-min` `200M`-POI Quadtree build causes infinite pod restarts, while sharding a `4.8 GB` geohash index by prefix melts the Manhattan shard. | Protect Quadtree boot with Kubernetes `startupProbe` + `/readyz` (`mmap` snapshots, shallow `/livez`) and replicate the compact `4.8 GB` spatial index instead of sharding it. |
| **52** | **Legacy Redis Cluster `PUBLISH` $O(N)$ Broadcast Meltdown** | Calling global `PUBLISH` on a 140-node Redis Cluster broadcasts `333.3k` writes/s to all 140 nodes (`46.7M` cluster-bus msgs/s), pegging all CPUs at 100%. | Use Valkey / Redis 7.0+ Sharded Pub/Sub (`SPUBLISH` / `SSUBSCRIBE`) or standalone shards routed via an `etcd` Consistent Hash Ring. |
| **53** | **Sizing High-Fanout Pub/Sub by RAM (`2` Nodes) Instead of CPU (`140` Nodes)** | Provisioning 2 servers because `200 GB` of channel state fits in RAM collapses under `333.3k × 40 = 13.33M` (`~14M`) subscriber pushes/sec. | Size Pub/Sub clusters by per-core subscriber push throughput (`~100,000 pushes/s/node` $\to$ `134–140` CPU-bound servers). |
| **54** | **Frozen Zombie Friend Pins on Radius Exit & `hash % N` Resubscribe Storms** | Silently dropping updates when a friend crosses `> 5 miles` leaves their pin frozen at `4.9 mi`, while `hash % N` scaling remaps `~99%` of channels. | Track `currentlyVisibleFriends` to emit an explicit `LEFT_RADIUS` unpin frame, and use Consistent Hashing (`~1/(N+1)` moved) during 03:00 AM off-peak windows. |
| **55** | **3-Circle Trilateration Exact-Distance Stalking** | Returning exact float distances lets a malicious friend spoof 3 GPS points and intersect 3 distance circles to pinpoint a user's exact home address. | Quantize friend distances into `0.5-mile` buckets (`<= 0.5 mi` floor), add planar Laplace geo-indistinguishability noise, and reject `> 300 m/s` GPS teleports. |
| **56** | **IEEE-754 Float Monetary Balance Drift** | Representing money as `number` / `FLOAT` (`0.1 + 0.2 = 0.30000000000000004`) causes cumulative sub-cent rounding drift that breaks double-entry conservation ($\sum \Delta = 0$). | Transmit wire amounts as decimal strings (`"1.00"`), parse into exact `BigInt` minor units (`100n` cents), and enforce `(transaction_id, payload_hash)` idempotency. |
| **57** | **TC/C Phase 1 Credit-First Unbacked Double-Spend** | Crediting receiver $C$ (`+$1`) during Phase 1 `Try` before sender $A$'s debit is committed lets $C$ withdraw unbacked phantom funds if Phase 1 aborts. | Always make TC/C Phase 1 `Try` **debit-first (`-$1` on sender $A$) and `NOP` on receiver $C$**, crediting $C$ only in Phase 2 `Confirm`. |
| **58** | **TC/C Out-of-Order Cancel Without Tombstone (`Hanging Try`)** | Network-delayed `Try` arrives after `Cancel` already ran as a no-op, deducting `-$1` from sender $A$ forever with no subsequent `Cancel` to release it. | Persist an `out_of_order_flag = true` (`CANCEL_TOMBSTONE`) in the Phase Status Table on early `Cancel` so any late-arriving `Try` is rejected immediately. |
| **59** | **Non-Deterministic Event-Sourcing State Machine & Pull-CQRS Polling** | Calling `Date.now()`, `Math.random()`, or external I/O inside event replay causes Raft followers to diverge, while client polling (`GET /balance`) floods read nodes. | Replicate only immutable validated **Events** via Raft (zero external I/O inside state transitions) and use **Push-Based Reverse Proxy CQRS** completion notifications. |
