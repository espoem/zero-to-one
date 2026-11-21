# System Design Interview Question Bank & Timed Mock Loops

This preparation bank tests Senior, Staff, and Principal distributed system design competency across the seven domains defined in [`exams/README.md`](README.md). Every question is original and grounded in primary engineering literature, official protocol RFCs, and production postmortems.

- **Bank scope**: **100 questions** (`Q-SD-001`–`Q-SD-100`) covering quantitative capacity modeling, edge/API design, caching/partitioning, asynchrony/resilience, specialized indexing/financial correctness, SLO observability/DR, end-to-end canonical architectures, progressive scaling, distributed key-value stores, planetary-scale geospatial navigation, distributed message queue internals, high-contention hotel reservation and overbooking systems, and planetary distributed email services.
- **Difficulty calibration**: Level `1` tests foundational mechanics, Level `2` tests Senior-level trade-off reasoning, and Level `3` tests Staff/Principal failure modes, subtle race conditions, and quantitative traps.
- **Timed practice**: Complete the [50-Question Written Architecture Drill](#timed-mock-exam-written-architecture-drill-50-questions--75-minutes) under a strict 75-minute timer, then run the [two 60-minute Staff/Principal design loops](#timed-mock-design-loops-2--60-minute-staffprincipal-simulations) against the explicit 0–4 grading rubrics.

---

## Domain 1: Requirements, Estimation & Capacity Modeling (`Q-SD-001`–`Q-SD-010`)

### Q-SD-001 · Requirements, Estimation & Capacity Modeling · difficulty 2 · single

An order-processing API averages 5,000 RPS with a 4× diurnal peak (20,000 RPS). Under normal load each request executes one database query in 5 ms, and during brief storage-checkpoint spikes the query p95 rises to 25 ms. Using Little's Law ($L = \lambda W$), how many concurrent in-flight DB queries exist at peak under normal latency versus checkpoint-spike latency, and what happens if the service enforces a fixed 120-connection pool with an unbounded wait queue?

- A) Normal peak concurrency is 25 queries and spike concurrency is 125 queries, so a 120-connection pool absorbs the spike with negligible queueing delay.
- B) Normal peak concurrency is 100 queries and spike concurrency rises to 500 queries; a 120-connection pool saturates during the spike, causing the unbounded wait queue to grow at 15,200 req/s until request timeouts and OOM occur.
- C) Normal peak concurrency is 100 queries and spike concurrency is 500 queries, but opening 2,000 direct PostgreSQL connections guarantees zero queueing because each query executes independently.
- D) Normal peak concurrency is 400 queries and spike concurrency is 1,000 queries; increasing the DB read timeout from 50 ms to 30 s drains the backlog automatically.

<details><summary>Answer</summary>

**B.** By Little's Law ($L = \lambda W$), at peak $\lambda = 20{,}000\text{ req/s}$, normal concurrency is $20{,}000 \times 0.005 = 100$ active connections, whereas a 25 ms query time requires $20{,}000 \times 0.025 = 500$ concurrent executions; with only 120 connections ($120 / 0.025 = 4{,}800\text{ req/s}$ drain capacity), the unbounded queue accumulates $20{,}000 - 4{,}800 = 15{,}200\text{ req/s}$ until memory exhausts or upstream callers time out.

- Why not A: 25 and 125 use the average 5,000 RPS instead of the 20,000 RPS diurnal peak.
- Why not C: Opening 2,000 active PostgreSQL connections thrashes context switches, CPU cache lines, and `ProcArray` lock contention, degrading throughput further rather than preserving 25 ms execution.
- Why not D: Both concurrency numbers are miscalculated (off by 4× and 2×), and extending timeouts keeps dead callers queued longer, worsening memory pressure and retry storms.
- Ref: [modules/02-back-of-the-envelope-estimation.md](../modules/02-back-of-the-envelope-estimation.md), https://sre.google/sre-book/handling-overload/

</details>

### Q-SD-002 · Requirements, Estimation & Capacity Modeling · difficulty 3 · scenario

You are sizing an inference cluster for an 80-layer transformer using Grouped-Query Attention (8 KV heads, `head_dim = 128`, BF16 = 2 bytes per element) serving 64 concurrent user sessions at a 32,768-token context length. How much GPU VRAM does the KV cache alone consume across those 64 sequences, and why does that determine the minimum node topology for a 70B-parameter BF16 model?

- A) Approximately 40 GiB of KV cache, allowing both the 140 GB model weights and all 64 sessions to fit comfortably on two 80 GB H100 GPUs.
- B) Approximately 160 GiB of KV cache, leaving zero headroom for model weights on a single 4× 80 GB node.
- C) Approximately 640 GiB of KV cache (320 KiB per token across 2,097,152 total tokens); combined with ~140 GB of BF16 weights and activation buffers, a single 8× 80 GB H100 node (640 GiB total VRAM) cannot hold both weights and full-context KV cache simultaneously without offloading, quantization, or tensor/pipeline parallelism across nodes.
- D) Approximately 1.28 TiB of KV cache because attention requires storing K, V, Q, and output projections for every historical token.

<details><summary>Answer</summary>

**C.** Each token stores 2 tensors (K and V) across 80 layers, 8 KV heads, and 128 dimensions in 2-byte BF16: $2 \times 80 \times 8 \times 128 \times 2 = 327{,}680\text{ bytes/token} = 320\text{ KiB/token}$; multiplying by $64 \times 32{,}768 = 2{,}097{,}152$ tokens yields $640\text{ GiB}$ of KV cache alone, which exceeds an 8× 80 GB H100 node once ~140 GB of BF16 weights are loaded.

- Why not A: 40 GiB undercounts by 16× (forgetting either the 2 tensors, 2 bytes, or 8 KV heads).
- Why not B: 160 GiB undercounts by 4× (missing the K+V factor of 2 and BF16 2-byte factor).
- Why not D: Q and output projections are transient activations for the current step and are not persisted in the KV cache.
- Ref: [modules/02-back-of-the-envelope-estimation.md](../modules/02-back-of-the-envelope-estimation.md), https://arxiv.org/abs/2309.06180

</details>

### Q-SD-003 · Requirements, Estimation & Capacity Modeling · difficulty 3 · scenario

A photo-sharing platform has 100M DAU, each uploading an average of 2 compressed photos/day at 1.5 MB each, with a 20:1 read-to-write ratio. Which 5-year storage and daily bandwidth calculation exposes the hidden primary cloud cost driver?

- A) Daily raw ingress is 300 TB/day (547.5 PB over 5 years before replication), while daily read egress is 6 PB/day (~69 GB/s sustained), making internet egress charges (often \$0.02–\$0.09/GB without CDN/ISP peering) dramatically exceed raw object storage costs.
- B) Daily raw ingress is 30 TB/day (54.75 PB over 5 years) and read egress is 600 TB/day, so metadata SSD storage is the dominant cost driver.
- C) Daily raw ingress is 300 TB/day, and applying 3× replication reduces 5-year storage to 182.5 PB while eliminating cross-AZ bandwidth charges.
- D) Read-to-write ratio only affects database IOPS, because object stores serve reads directly from client browser caches without incurring egress bandwidth.

<details><summary>Answer</summary>

**A.** $100\text{M} \times 2 \times 1.5\text{ MB} = 300\text{ TB/day}$ raw writes ($\times 365 \times 5 = 547.5\text{ PB}$ raw, or ~821 PB with 1.5× Reed-Solomon erasure coding), whereas a 20:1 read ratio drives $20 \times 300\text{ TB} = 6\text{ PB/day}$ of egress (~$6{,}000{,}000\text{ GB/day}$), where unshielded cloud egress easily costs hundreds of thousands of dollars per day unless absorbed by CDN caching and private peering.

- Why not B: $100\text{M} \times 2 \times 1.5\text{ MB}$ is 300 TB, not 30 TB (off by 10×).
- Why not C: 3× replication multiplies storage by 3 (to 1.64 EB), it does not divide it by 3, and cross-AZ replication increases internal transfer costs.
- Why not D: Browser caches only absorb repeat views by the same user; viral/feed reads across millions of different users still generate origin/CDN egress.
- Ref: [modules/02-back-of-the-envelope-estimation.md](../modules/02-back-of-the-envelope-estimation.md), https://sre.google/sre-book/table-of-contents/

</details>

### Q-SD-004 · Requirements, Estimation & Capacity Modeling · difficulty 2 · single

A read-heavy catalog service serves 50 TB of distinct product records where access follows an 80/20 Zipfian distribution (20% of objects receive 80% of requests). The team provisions 4 TB of distributed Redis RAM instead of 10 TB. Why does this 2.5× RAM under-provisioning trigger a disproportionate database outage rather than a linear 60% miss penalty?

- A) Redis switches from LRU to random eviction once memory crosses 50% capacity.
- B) The active hot working set (10 TB) no longer fits in RAM, causing continuous cache thrashing where popular keys are evicted before reuse; the cache hit ratio drops sharply and database QPS jumps several-fold (e.g., from 20% miss traffic to 60%+ miss traffic, a 3×+ backend load surge).
- C) Zipfian keys exceed Redis's 512 MB value limit whenever memory utilization surpasses 80%.
- D) Under-provisioning RAM forces consistent hashing to route all traffic to a single shard.

<details><summary>Answer</summary>

**B.** In an 80/20 distribution, 20% of 50 TB equals a 10 TB hot working set; once cache RAM falls substantially below the hot working set, eviction churn prevents keys from staying resident long enough to capture repeat hits, turning a manageable 20% backend miss rate into a multi-fold DB QPS surge that saturates disk IOPS.

- Why not A: Redis does not automatically switch eviction policies at 50% memory; eviction policy is explicitly configured (e.g., `allkeys-lru` or `allkeys-lfu`).
- Why not C: Key/value size limits are per-item protocol bounds, unrelated to total cluster memory utilization.
- Why not D: Consistent hashing maps keys based on hash rings, independently of available RAM per shard.
- Ref: [modules/02-back-of-the-envelope-estimation.md](../modules/02-back-of-the-envelope-estimation.md), [modules/05-caching-strategies-and-invalidation.md](../modules/05-caching-strategies-and-invalidation.md), https://github.com/ben-manes/caffeine/wiki/Efficiency

</details>

### Q-SD-005 · Requirements, Estimation & Capacity Modeling · difficulty 3 · multi

During the first five minutes of a Principal-level system design interview for an unfamiliar product, which **two** non-functional clarifications fundamentally alter the core data-plane topology rather than merely tuning hardware counts?

- A) Exact color palette and pagination button labels in the web client.
- B) Consistency and durability invariants (e.g., RPO = 0 linearizable writes for balances vs bounded staleness for feeds) and cross-region write topology (single-writer primary vs active-active multi-region conflict resolution).
- C) Read-to-write ratio, payload size, and peak concurrency multipliers (determining push vs pull fan-out, CDN origin shielding, and storage partitioning strategy).
- D) Whether the implementation language uses camelCase or snake_case JSON field names.

<details><summary>Answer</summary>

**B, C.** Consistency/durability invariants and multi-region write semantics dictate consensus/quorum vs async replication and ledger architecture, while read:write asymmetry and payload size dictate caching, fan-out mode, and bandwidth/storage topology.

- Why not A: Visual UI details have zero impact on backend distributed topology.
- Why not D: Serialization casing is an API style convention, not a topological constraint.
- Ref: [modules/01-framing-requirements-and-delivery.md](../modules/01-framing-requirements-and-delivery.md), https://sre.google/sre-book/table-of-contents/

</details>

### Q-SD-006 · Requirements, Estimation & Capacity Modeling · difficulty 1 · ordering

In a 45-minute Senior/Staff system design interview, which sequence of phases keeps design decisions anchored in verified constraints and avoids premature component choices?

- A) Deep-dive database sharding -> Draw CDN & microservices -> Estimate QPS -> Ask functional requirements.
- B) Clarify functional scope, invariants, and NFRs -> Compute back-of-the-envelope QPS/storage/bandwidth bounds -> Design high-level API, data model, and core flow -> Deep-dive bottlenecks, contention, and failure modes -> Address observability, SLOs, and disaster recovery.
- C) Write SQL `CREATE TABLE` DDL -> Choose Kafka vs RabbitMQ -> Clarify functional requirements -> Compute storage bounds.
- D) Propose Kubernetes cluster sizing -> Explain CAP theorem -> Draw final architecture -> Define SLIs and SLOs.

<details><summary>Answer</summary>

**B.** Anchoring requirements and invariants first ensures capacity bounds and APIs match real constraints; only after establishing the baseline end-to-end flow should you invest deep-dive minutes into bottlenecks, race conditions, and SLO/DR operations.

- Why not A: Selecting sharding and microservices before clarifying requirements and scale leads to over-engineered or misaligned designs.
- Why not C: Locking in schemas and message brokers prior to understanding access patterns and requirements violates access-pattern-driven design.
- Why not D: Starting with infrastructure runtime sizing before defining what the system does wastes time on irrelevant mechanics.
- Ref: [modules/01-framing-requirements-and-delivery.md](../modules/01-framing-requirements-and-delivery.md), https://sre.google/sre-book/table-of-contents/

</details>

### Q-SD-007 · Requirements, Estimation & Capacity Modeling · difficulty 3 · scenario

An API gateway service handles 10,000 RPS. Each request spends 1 ms of CPU time (TLS + JSON routing) and waits 49 ms on an asynchronous downstream gRPC call (total latency $W = 50\text{ ms}$). A candidate estimates the fleet needs $\lceil 10{,}000 \times 0.050 \rceil = 500$ CPU cores. What is the mathematical flaw in this estimate, and how many vCPUs are actually required at 50% target CPU headroom?

- A) The candidate conflated socket concurrency with CPU time; Little's Law yields 500 concurrent in-flight coroutines/connections, whereas CPU work is only $10{,}000 \times 0.001\text{ s} = 10$ core-seconds/sec, requiring ~20 vCPUs at 50% target utilization (with each node holding sufficient file descriptors and memory for its share of the 500 open sockets).
- B) The candidate forgot that asynchronous I/O doubles CPU overhead, so the service actually needs 1,000 CPU cores.
- C) 500 CPU cores is accurate because Linux `epoll` pins one physical core per blocked socket until the downstream gRPC response arrives.
- D) Only 1 CPU core is needed because 1 ms × 10,000 RPS equals 10% utilization on modern multi-GHz CPUs.

<details><summary>Answer</summary>

**A.** Waiting on non-blocking I/O consumes memory and socket/task state (500 concurrent in-flight requests via $L = 10{,}000 \times 0.05$), not CPU cycles; active CPU consumption is $10{,}000 \times 1\text{ ms} = 10\text{ cores}$, so ~20 vCPUs provide 50% headroom for GC, kernel networking, and traffic spikes.

- Why not B: Asynchronous I/O multiplexing avoids thread-per-connection context-switch overhead rather than doubling CPU usage.
- Why not C: `epoll`/`kqueue` multiplexes thousands of idle/waiting sockets onto a handful of event-loop threads without consuming a core per waiting socket.
- Why not D: 10,000 × 1 ms = 10 seconds of CPU work every 1 second, which physically requires at least 10 cores, not 1 core.
- Ref: [modules/02-back-of-the-envelope-estimation.md](../modules/02-back-of-the-envelope-estimation.md), https://sre.google/sre-book/handling-overload/

</details>

### Q-SD-008 · Requirements, Estimation & Capacity Modeling · difficulty 3 · scenario

A search aggregator fans out every incoming user request in parallel to 20 independent leaf index shards and waits for all 20 responses before returning. Each individual leaf shard maintains a strict p99 latency of 80 ms, while the overall service SLA requires p99 $\le 100\text{ ms}$. Assuming independent shard latency distributions, what fraction of user requests exceed 80 ms at the scatter-gather barrier?

- A) Exactly 1.0%, matching each shard's p99 latency.
- B) Approximately 5.0%, because parallel calls share network round-trip overhead.
- C) Approximately $1 - 0.99^{20} \approx 18.2\%$, causing the end-to-end aggregator p99 (and even p85) to miss the 100 ms SLA whenever any single shard hits its tail.
- D) Approximately $0.01^{20}$, making tail violations practically impossible.

<details><summary>Answer</summary>

**C.** When a request must wait for the slowest of $n = 20$ independent leaf calls, the probability that all 20 complete within 80 ms is $0.99^{20} \approx 0.8179$, meaning $1 - 0.99^{20} \approx 18.2\%$ of parent requests wait longer than 80 ms—a classic tail-latency amplification trap described in Dean & Barroso's _The Tail at Scale_.

- Why not A: Parallel fan-out takes the maximum of $n$ draws, not the median or single-draw quantile.
- Why not B: Shared network jitter actually correlates slowdowns upward rather than shrinking the maximum below 18.2%.
- Why not D: $0.01^{20}$ is the probability that _all_ 20 shards are simultaneously slow, whereas the scatter-gather barrier stalls if _any one_ shard is slow.
- Ref: [modules/02-back-of-the-envelope-estimation.md](../modules/02-back-of-the-envelope-estimation.md), [modules/08-rate-limiting-load-shedding-and-resilience.md](../modules/08-rate-limiting-load-shedding-and-resilience.md), https://research.google/pubs/the-tail-at-scale/

</details>

### Q-SD-009 · Requirements, Estimation & Capacity Modeling · difficulty 2 · single

An IoT ingestion cluster receives 10 million tiny UDP telemetry packets per second globally, each carrying a 100-byte payload (roughly 142 bytes on the wire with headers). Why does capacity planning by raw payload Gbps (~11.4 Gbps across the fleet) severely underestimate the required edge NIC and compute footprint?

- A) UDP headers compress poorly in TLS 1.3, inflating wire size to 100 Gbps.
- B) Packet-per-second (PPS) limits—kernel network stack interrupts, `sk_buff` allocations, `conntrack`/NAT table lookups, and NIC ring-buffer processing—saturate per-host CPU long before a 100 GbE link reaches 15% byte throughput unless kernel-bypass (XDP/DPDK) or packet batching is used.
- C) Ethernet frames smaller than 1,500 bytes are dropped by core BGP routers under RFC 9110.
- D) IPv4 packet lengths must be rounded up to 4 KB memory pages on the wire.

<details><summary>Answer</summary>

**B.** Per-packet overhead (interrupts, ring-buffer descriptors, socket buffer allocation, firewall/conntrack hashing) scales with PPS rather than Mbps; 10M small packets/sec consumes vastly more CPU and PPS capacity than 10 Gbps of 1,500-byte jumbo/MTU-sized packets (~833k PPS).

- Why not A: UDP does not use TLS 1.3 (DTLS is used if encrypted), and header sizes are fixed tens of bytes, not 10× inflation.
- Why not C: Minimum Ethernet frame size is 64 bytes (not 1,500 bytes), and RFC 9110 governs HTTP semantics, not L2/L3 BGP routing.
- Why not D: OS memory pages do not pad network frames on the wire.
- Ref: [modules/02-back-of-the-envelope-estimation.md](../modules/02-back-of-the-envelope-estimation.md), [modules/03-networking-edge-and-cdn-composition.md](../modules/03-networking-edge-and-cdn-composition.md), https://sre.google/sre-book/table-of-contents/

</details>

### Q-SD-010 · Requirements, Estimation & Capacity Modeling · difficulty 3 · multi

When negotiating non-functional requirements for a global multi-currency ticketing and wallet platform, which **two** requirements are genuinely irreconcilable under an asynchronous cross-region network partition and must be explicitly surfaced in your assumption log?

- A) Providing a responsive < 100 ms read-only seat-map preview from regional caches while processing actual seat reservations against a strongly consistent inventory shard.
- B) Guaranteeing zero double-spending / zero overselling (strict serializability on balances and seat ownership) **and** accepting local writes in both `us-east` and `eu-west` independently while the transatlantic link is partitioned (AP availability for writes).
- C) Requiring RPO = 0 (zero committed financial ledger loss on single-region failure) **and** sub-5 ms synchronous commit latency across two continents separated by 70 ms RTT.
- D) Supporting idempotent API retries with `Idempotency-Key` headers while persisting double-entry ledger rows in PostgreSQL.

<details><summary>Answer</summary>

**B, C.** By CAP/PACELC, active-active disconnected writes on shared scarce inventory or balances break linearizability (causing oversell/double-spend), and synchronous RPO = 0 replication across continents physically cannot commit faster than the intercontinental speed-of-light RTT (~70 ms+).

- Why not A: Serving slightly stale read-only seat availability previews while enforcing strict transactional locking at checkout is standard and fully achievable.
- Why not D: Idempotency keys and double-entry accounting in PostgreSQL reinforce each other cleanly in the same ACID transaction.
- Ref: [modules/01-framing-requirements-and-delivery.md](../modules/01-framing-requirements-and-delivery.md), [modules/10-contention-inventory-and-financial-correctness.md](../modules/10-contention-inventory-and-financial-correctness.md), https://sre.google/sre-book/table-of-contents/

</details>

---

## Domain 2: Edge, API Design, Data Modeling & ID Generation (`Q-SD-011`–`Q-SD-020`)

### Q-SD-011 · Edge, API Design, Data Modeling & ID Generation · difficulty 3 · scenario

After a team places a reverse-proxy CDN in front of a web application, User B occasionally receives User A's personalized `/api/v1/profile` JSON payload (including User A's email address) when requesting the exact same URL. The origin returns `HTTP/1.1 200 OK` with `Cache-Control: max-age=60` and authenticates via the `Authorization: Bearer <jwt>` header. What caused this cross-user cache leak, and what is the primary fix?

- A) HTTP/1.1 pipelining mixed two TCP responses at the TLS terminator; switching to HTTP/2 fixes it automatically.
- B) Because the cache key defaults to `scheme + host + path + query` and ignores `Authorization` headers unless explicitly told otherwise, the CDN cached User A's response as public; the origin MUST emit `Cache-Control: private, no-store` (or `no-cache, private`) on user-specific responses and never rely on `Vary: Authorization` as a shared-cache multi-tenant store.
- C) The CDN cached the TLS session ticket across both users; disabling TLS 1.3 0-RTT eliminates the leak.
- D) User A's browser leaked its local disk cache to the CDN edge PoP via `ETag` revalidation.

<details><summary>Answer</summary>

**B.** Per RFC 9111 (HTTP Caching), shared caches key primarily on target URI and store responses with `max-age` unless `Cache-Control: private` or `no-store` forbids shared caching (note that `Authorization` suppresses shared caching only when `public`/`s-maxage` aren't forcing it, and custom session headers or misconfigured CDN cache-everything rules override defaults); marking personalized endpoints `Cache-Control: private, no-store` prevents shared edge storage altogether.

- Why not A: HTTP/2 multiplexing over TCP changes framing, not CDN shared-cache keying semantics.
- Why not C: TLS session tickets authenticate/resume encrypted transport sessions and do not share HTTP application payloads across distinct clients.
- Why not D: `ETag` conditional validation sends hashes, not response bodies from a client's private disk cache to other users.
- Ref: [modules/03-networking-edge-and-cdn-composition.md](../modules/03-networking-edge-and-cdn-composition.md), https://www.rfc-editor.org/rfc/rfc9111

</details>

### Q-SD-012 · Edge, API Design, Data Modeling & ID Generation · difficulty 3 · single

A fleet of 16 independent L7 stateless proxy instances load-balances requests across 200 backend workers. Switching from Round Robin to global "Least Connections" (polling worker active connection counts every 1 second) unexpectedly causes severe queue spikes on newly idle workers. Why does **Power of Two Random Choices (P2C)** outperform both Round Robin and stale-metric Least Connections?

- A) P2C hashes the client IP consistently so every user hits the same backend worker forever.
- B) Polling global Least Connections creates herd synchronization—all 16 proxies simultaneously dump bursts onto whichever worker looked quietest at the last 1 s snapshot—whereas P2C samples two random backends per request and picks the less loaded one, eliminating herd behavior while bounding max queue imbalance to $O(\log \log n)$ without global coordination.
- C) P2C broadcasts every request to two workers and returns whichever responds first.
- D) Round Robin requires O(N²) memory in the Linux kernel for 200 backends.

<details><summary>Answer</summary>

**B.** Mitzenmacher's Power of Two Choices theorem shows that picking the lesser-loaded of just $d = 2$ uniformly random candidates exponentially reduces maximum queue depth from $\Theta(\log n / \log \log n)$ (pure random) down to $\Theta(\log \log n)$ while avoiding the thundering-herd oscillation caused by stale global "least-loaded" snapshots across independent proxies.

- Why not A: Consistent hashing pins keys to nodes regardless of instantaneous queue depth, which can overload a worker hit by slow queries.
- Why not C: Sending requests to two workers simultaneously is hedged/speculative execution, not P2C load balancing.
- Why not D: Round Robin uses $O(1)$ cursor state per proxy, not $O(N^2)$ memory.
- Ref: [modules/03-networking-edge-and-cdn-composition.md](../modules/03-networking-edge-and-cdn-composition.md), https://brooker.co.za/blog/2012/01/17/two-random.html

</details>

### Q-SD-013 · Edge, API Design, Data Modeling & ID Generation · difficulty 2 · single

A feed endpoint uses SQL `SELECT id, created_at, title FROM posts ORDER BY created_at DESC, id DESC LIMIT 20 OFFSET 500000`. Users scrolling deep into the feed report multi-second latency and duplicate posts appearing between page 25,000 and page 25,001. What causes both defects, and how does keyset (cursor) pagination eliminate them?

- A) `OFFSET 500000` forces the engine to scan and discard 500,020 index/heap rows ($O(\text{offset} + \text{limit})$), and new inserts shift row positions between requests; keyset pagination (`WHERE (created_at, id) < ($cursor_ts, $cursor_id) ORDER BY created_at DESC, id DESC LIMIT 20`) seeks directly via the composite B-tree index in $O(\log N + \text{limit})$ with stable item boundaries.
- B) `OFFSET` holds an exclusive table lock across HTTP requests, whereas keyset pagination switches PostgreSQL to `READ UNCOMMITTED`.
- C) Composite sorting on `(created_at, id)` prevents index usage; removing `id` from `ORDER BY` makes `OFFSET` $O(1)$.
- D) Keyset pagination caches all 500,000 rows in the client's `Cookie` header so the database is only queried once.

<details><summary>Answer</summary>

**A.** SQL `OFFSET k` cannot jump directly in a B-tree without counting `k` surviving visible tuples, making deep pages linearly slower and vulnerable to index shift whenever new rows are prepended; tuple comparison `(created_at, id) < ($ts, $id)` performs a single B-tree range seek and remains immune to concurrent inserts above the cursor.

- Why not B: SQL queries do not hold table locks across stateless HTTP requests, and PostgreSQL treats `READ UNCOMMITTED` identically to `READ COMMITTED`.
- Why not C: Removing `id` breaks tie-breaking when multiple posts share the exact same `created_at` timestamp, causing dropped rows even with keyset predicates, and `OFFSET` still scans linearly.
- Why not D: Keyset cursors encode only the last seen `(created_at, id)` pair (a few bytes, usually opaque base64), not the entire dataset.
- Ref: [modules/04-api-design-data-modeling-and-id-generation.md](../modules/04-api-design-data-modeling-and-id-generation.md), https://use-the-index-luke.com/no-offset

</details>

### Q-SD-014 · Edge, API Design, Data Modeling & ID Generation · difficulty 3 · scenario

A high-write PostgreSQL cluster switches primary keys from 64-bit Snowflake IDs to random 128-bit UUIDv4 strings, and later suffers two unrelated incidents: first, write IOPS tripled due to B-tree index fragmentation; second, after reverting to custom Snowflake IDs, an NTP daemon stepped a worker's wall clock backwards by 400 ms and emitted duplicate primary keys. Which pair of design choices prevents **both** failure modes?

- A) Use UUIDv4 stored as `VARCHAR(36)` and disable NTP completely on all servers.
- B) Use time-ordered 128-bit **UUIDv7** (RFC 9562) stored as native 16-byte `uuid` (monotonic 48-bit Unix ms timestamp prefix preserves append-mostly B-tree locality while 74 random bits prevent collisions without centralized worker coordination), OR if 64-bit Snowflake IDs are required, guard against `CLOCK_REALTIME` backwards jumps by refusing/waiting out small skews or tracking monotonic `CLOCK_MONOTONIC` offsets and rotating a sequence/epoch on backward step.
- C) Use PostgreSQL `RANDOM()` integers for primary keys and run `VACUUM FULL` every 5 minutes.
- D) Switch Snowflake timestamps from milliseconds to seconds so NTP steps under 1 second cannot alter the timestamp prefix.

<details><summary>Answer</summary>

**B.** Random UUIDv4 scatters inserts uniformly across B-tree leaf pages, causing constant 50%-fill page splits and dirty-page write amplification; RFC 9562 UUIDv7 keeps inserts clustered at the right edge of the index while eliminating worker-ID coordination, and Snowflake generators must treat wall-clock regression as a hard fault (wait, increment an epoch/worker bit, or derive elapsed ms from `CLOCK_MONOTONIC` anchored at boot) to prevent duplicate IDs.

- Why not A: `VARCHAR(36)` UUIDv4 inflates index size by >2× and retains random page splits, while disabling NTP causes clock drift that breaks TLS certificates, logs, and lease expirations.
- Why not C: Random integers still fragment B-tree pages, and `VACUUM FULL` acquires an `ACCESS EXCLUSIVE` lock blocking all reads and writes.
- Why not D: Second-granularity timestamps still regress if NTP steps backwards across a second boundary and shrink per-second sequence capacity dramatically.
- Ref: [modules/04-api-design-data-modeling-and-id-generation.md](../modules/04-api-design-data-modeling-and-id-generation.md), https://www.rfc-editor.org/rfc/rfc9562

</details>

### Q-SD-015 · Edge, API Design, Data Modeling & ID Generation · difficulty 3 · multi

Mobile users on congested 4G/5G networks with 2% packet loss experience stalled asset downloads over HTTP/2 despite multiplexing all requests onto one connection. When evaluating a migration to HTTP/3 (QUIC), which **two** statements accurately capture HTTP/3's transport behavior and security pitfalls?

- A) Because QUIC runs over UDP with independent per-stream loss recovery, a lost packet in Stream 1 no longer stalls decryption or delivery of Stream 2 or Stream 3, eliminating HTTP/2's TCP head-of-line blocking.
- B) Enabling TLS 1.3 / QUIC 0-RTT early data on all endpoints is safe because QUIC sequence numbers prevent network attackers from replaying `POST /v1/payments` packets.
- C) QUIC 0-RTT early data lacks full forward-secret replay protection across edge PoPs, so 0-RTT MUST be restricted strictly to safe, idempotent requests (`GET`, `HEAD`, or explicitly idempotent endpoints with anti-replay tokens) and blocked for non-idempotent mutations.
- D) HTTP/3 eliminates TCP handshakes by running plaintext unencrypted frames for the first 3 round trips.

<details><summary>Answer</summary>

**A, C.** HTTP/2 multiplexes streams inside one ordered TCP byte stream so any single lost TCP segment stalls _all_ HTTP/2 streams until retransmitted, whereas QUIC moves reliability per stream into userspace over UDP; however, RFC 8446 / RFC 9001 0-RTT early data can be replayed by an on-path attacker across Anycast PoPs unless restricted to safe/idempotent methods.

- Why not B: QUIC packet numbers protect against replay within a single established connection state, not across independent stateless 0-RTT handshakes sent to multiple edge servers before anti-replay state syncs.
- Why not D: QUIC integrates TLS 1.3 directly into the 1-RTT initial handshake; payloads are always encrypted.
- Ref: [modules/03-networking-edge-and-cdn-composition.md](../modules/03-networking-edge-and-cdn-composition.md), https://www.rfc-editor.org/rfc/rfc9114

</details>

### Q-SD-016 · Edge, API Design, Data Modeling & ID Generation · difficulty 2 · single

You are designing the edge streaming transport for an LLM chat API where clients send one prompt and receive 500–2,000 incremental tokens over 10–30 seconds, plus rare stop/cancel signals. Why is **Server-Sent Events (SSE)** over HTTP/2 or HTTP/3 typically preferred over WebSockets for this workload?

- A) SSE natively compresses binary protobuf tensors smaller than WebSocket binary frames.
- B) SSE uses standard HTTP semantics (`text/event-stream`), inherits HTTP/2–3 connection multiplexing, corporate firewall/proxy compatibility, standard bearer-token auth, and built-in `Last-Event-ID` reconnection without stateful WebSocket upgrade handshakes—while client cancellation maps cleanly to closing the stream or issuing a separate `POST /cancel`.
- C) WebSockets are limited to 100 messages per connection by RFC 6455.
- D) SSE enables peer-to-peer UDP streaming directly between browsers without passing through the API gateway.

<details><summary>Answer</summary>

**B.** LLM token generation is overwhelmingly unidirectional (server-to-client) per prompt turn; SSE works seamlessly over HTTP/2 and HTTP/3 multiplexed connections, passes transparently through standard L7 load balancers and proxies, and supports `Last-Event-ID` cursor resumption without maintaining sticky bidirectional WebSocket state machines.

- Why not A: SSE is a UTF-8 text framing format (`data: ...\n\n`), not a binary protobuf tensor protocol.
- Why not C: RFC 6455 imposes no message count limit on WebSocket connections.
- Why not D: SSE is client-to-server HTTP, not browser-to-browser WebRTC/UDP.
- Ref: [modules/03-networking-edge-and-cdn-composition.md](../modules/03-networking-edge-and-cdn-composition.md), https://html.spec.whatwg.org/multipage/server-sent-events.html

</details>

### Q-SD-017 · Edge, API Design, Data Modeling & ID Generation · difficulty 3 · scenario

A breaking news site publishes an article with a 60-second CDN TTL across 250 global edge PoPs. Every 60 seconds, cache expiration triggers 250 independent PoPs to simultaneously request the article and its API metadata from the origin cluster, causing periodic 60-second CPU spikes and 502s. How does adding a **CDN Origin Shield** layer resolve this?

- A) Origin Shield disables TLS verification between edge PoPs and the origin to cut CPU usage by 90%.
- B) Origin Shield inserts an intermediate regional caching tier (equipped with request coalescing / collapsed forwarding) directly in front of the origin; when 250 edge PoPs miss simultaneously, they query the shield PoP, which collapses all 250 concurrent misses into a single origin fetch.
- C) Origin Shield permanently pins every object in origin RAM so `Cache-Control` TTLs are ignored forever.
- D) Origin Shield converts HTTP GET requests into Kafka messages so the origin never serves synchronous HTTP traffic.

<details><summary>Answer</summary>

**B.** Without an Origin Shield, each of the 250 edge PoPs maintains an independent cache and forwards simultaneous misses straight to the origin (a 250× cache-miss amplification); placing a centralized shield PoP with request coalescing between edge PoPs and the origin collapses concurrent PoP misses into 1 origin request per shield region.

- Why not A: Disabling TLS verification breaks origin authentication and saves negligible CPU compared to eliminating 249 redundant origin renders.
- Why not C: Origin Shield respects `Cache-Control` / `s-maxage` directives (or stale-while-revalidate), rather than ignoring freshness lifetimes forever.
- Why not D: CDN Origin Shields operate as HTTP caching reverse proxies, not asynchronous Kafka producers.
- Ref: [modules/03-networking-edge-and-cdn-composition.md](../modules/03-networking-edge-and-cdn-composition.md), https://developers.cloudflare.com/cache/how-to/origin-shield/

</details>

### Q-SD-018 · Edge, API Design, Data Modeling & ID Generation · difficulty 3 · single

A global edge network advertises the same Anycast IPv4/IPv6 prefix from 120 PoPs using BGP. During a minor internet routing flap, packets belonging to an established 30-minute WebSocket connection are suddenly routed to a _different_ PoP in another city. What happens if the edge uses naive stateless L4 packet forwarding directly to PoP-local backend pods, and how do production edge architectures survive Anycast route changes?

- A) The second PoP automatically reconstructs the kernel TCP state machine from the incoming encrypted TLS payload.
- B) The new PoP has no TCP control block for that connection and immediately replies with `TCP RST`, tearing down the WebSocket; production edges terminate TLS/TCP at edge proxies backed by consistent-hash L4 balancers (e.g., Maglev/Katran) or route stateful traffic over GeoDNS/Unicast endpoints once bootstrapped, and design clients for seamless reconnect with monotonic sequence cursors.
- C) BGP pins every established TCP 4-tuple for 24 hours across all autonomous systems worldwide, making mid-connection PoP shifts impossible.
- D) Switching to HTTP/1.1 Keep-Alive makes TCP sequence numbers identical across all 120 PoPs.

<details><summary>Answer</summary>

**B.** BGP Anycast routes statelessly per packet based on internet topology; if an active TCP flow shifts to a different PoP whose kernel lacks the 4-tuple socket state, the kernel drops or `RST`s the flow—hence large edge providers combine consistent-hash L4 termination (for intra-PoP ECMP churn), Unicast session pinning after initial discovery, or application-level idempotent reconnects.

- Why not A: TCP sequence numbers, congestion windows, and TLS ephemeral session keys exist only in the terminating host's memory and cannot be inferred from an arbitrary mid-stream packet.
- Why not C: BGP operates on IP prefixes, not per-TCP-4-tuple flows, and route convergence occurs within seconds during link flaps.
- Why not D: HTTP/1.1 Keep-Alive still relies on an underlying stateful kernel TCP connection.
- Ref: [modules/03-networking-edge-and-cdn-composition.md](../modules/03-networking-edge-and-cdn-composition.md), https://www.rfc-editor.org/rfc/rfc9110

</details>

### Q-SD-019 · Edge, API Design, Data Modeling & ID Generation · difficulty 2 · multi

When selecting primary storage engines from explicit access patterns, which **two** pairings match the workload's physical storage and query semantics cleanly?

- A) High-throughput append-heavy device telemetry (`WHERE device_id = ? AND ts BETWEEN ? AND ? ORDER BY ts DESC`) -> Wide-column store (Cassandra/ScyllaDB) with `device_id` as partition key and `ts` as clustering key.
- B) Multi-tenant SaaS invoicing requiring arbitrary ad-hoc `JOIN`s across customers, line items, and tax rules plus ACID serializable balance updates -> Single-key KV store (Redis/Memcached) with client-side full scans.
- C) Immutable financial ledger + double-entry transfers requiring ACID transactions across two accounts and strict uniqueness constraints -> Relational SQL (PostgreSQL / Spanner) partitioned by ledger/tenant boundary.
- D) Serving 50 MB user-uploaded raw video segments by immutable content hash -> Storing raw 50 MB `BYTEA` blobs inside the transactional OLTP PostgreSQL primary table.

<details><summary>Answer</summary>

**A, C.** Wide-column LSM engines excel at time-ordered sequential writes keyed by `(partition_key, clustering_key)` range scans, whereas relational SQL engines provide ACID multi-row transactions, foreign keys, and secondary indexes needed for invoicing and ledgers.

- Why not B: Scanning a KV store client-side to emulate relational joins destroys latency and lacks ACID multi-row isolation.
- Why not D: Storing 50 MB video blobs inside OLTP PostgreSQL bloats WAL logs, buffer pools, replication bandwidth, and backups; object storage (S3/GCS) with metadata URLs in SQL is the right split.
- Ref: [modules/04-api-design-data-modeling-and-id-generation.md](../modules/04-api-design-data-modeling-and-id-generation.md), https://www.postgresql.org/docs/current/explicit-locking.html

</details>

### Q-SD-020 · Edge, API Design, Data Modeling & ID Generation · difficulty 3 · scenario

A payment API accepts an `Idempotency-Key` header and stores `(idempotency_key, cached_status_code, cached_response_body)` in PostgreSQL. A buggy client SDK accidentally reuses the same `Idempotency-Key` from a \$20 USD charge when submitting a completely different \$500 EUR charge. Without payload validation, the server silently returns `200 OK` with the \$20 receipt! How must an idempotency layer be modeled to prevent both silent parameter corruption and concurrent duplicate execution?

- A) Hash the incoming request parameters (`SHA-256` of method, path, and canonical body) and persist `(key, request_hash, state, response)` inside the atomic DB transaction; return `422 Unprocessable Entity` (or `409 Conflict`) if an existing key arrives with a different `request_hash`, and return `409 Conflict` / wait if `state = IN_PROGRESS` for an identical concurrent retry.
- B) Store only the `idempotency_key` in a client-side browser cookie so each request overwrites the previous receipt.
- C) Reject all requests containing an `Idempotency-Key` header with `400 Bad Request` once the first request completes.
- D) Generate a fresh server-side UUID inside the controller and ignore the client's `Idempotency-Key` header whenever the currency differs.

<details><summary>Answer</summary>

**A.** As formalized in Stripe's idempotency architecture, storing the cryptographic digest of request parameters alongside a transactional `IN_PROGRESS`/`COMPLETED` state machine catches accidental key reuse with mismatched payloads (`422`), prevents concurrent retries from double-executing while the first call is in flight, and safely replays the stored response on true network retries.

- Why not B: Client-side cookies do not protect against network timeouts, mobile app retries, or multi-instance server concurrency.
- Why not C: Rejecting legitimate retries of an identical completed request defeats the purpose of idempotency keys.
- Why not D: Ignoring the client's key on currency/amount changes allows duplicate execution if the client actually retries, or fails to detect key reuse bugs.
- Ref: [modules/04-api-design-data-modeling-and-id-generation.md](../modules/04-api-design-data-modeling-and-id-generation.md), [modules/10-contention-inventory-and-financial-correctness.md](../modules/10-contention-inventory-and-financial-correctness.md), https://stripe.com/blog/idempotency

</details>

---

## Domain 3: Caching, Scaling Reads/Writes & Partitioning (`Q-SD-021`–`Q-SD-031`)

### Q-SD-021 · Caching, Scaling Reads/Writes & Partitioning · difficulty 3 · scenario

A team implements cache-aside where writers execute `UPDATE db ...; DEL cache_key` and readers execute `GET cache_key -> on miss, SELECT db ... -> SET cache_key`. Under heavy concurrency, a stale value `V1` occasionally gets stuck in Redis until the 1-hour TTL expires, even though the DB holds `V2`. Trace the exact interleaving that causes this bug, and identify the production fix from Facebook's Memcache paper (_Nishtala et al._).

- A) Reader R1 misses cache and reads `V1` from DB -> stalled before `SET`; Writer W1 updates DB to `V2` and executes `DEL cache_key` (on an empty key); R1 resumes and writes stale `V1` into Redis! Fix: use **Memcache Leases** (cache miss returns a 64-bit lease token; `DEL`/invalidation invalidates the lease token so R1's delayed `SET(k, V1, lease)` is rejected by the cache).
- B) Writer W1 commits `V2`, executes `DEL`, and Redis asynchronously rolls back the `DEL` on replica promotion; fix: use `SETNX` without TTL.
- C) Two writers execute `UPDATE` simultaneously and Redis merges both strings; fix: switch from `DEL` to `GETSET`.
- D) Reader R1 reads `V2` from DB, then Redis runs an LFU eviction before returning the key; fix: set `maxmemory-policy noeviction`.

<details><summary>Answer</summary>

**A.** Even when writers update the DB _before_ deleting the cache, a slow concurrent reader that missed _before_ the write can commit stale `V1` _after_ the writer's `DEL`; Memcache Leases attach a unique per-miss lease token that the writer's invalidation revokes, causing the cache server to reject any late `set` carrying a stale lease token.

- Why not B: While async cache replication can lose recent deletes on failover, the classic single-node concurrency race requires no failover at all and is not solved by `SETNX` without TTL (which would keep `V1` forever!).
- Why not C: Redis `SET`/`DEL` does not concatenate strings from concurrent writers.
- Why not D: Evicting a key leaves a cache miss (safe, forces re-read), not a permanent stale value `V1`.
- Ref: [modules/05-caching-strategies-and-invalidation.md](../modules/05-caching-strategies-and-invalidation.md), https://www.usenix.org/conference/nsdi13/technical-sessions/presentation/nishtala

</details>

### Q-SD-022 · Caching, Scaling Reads/Writes & Partitioning · difficulty 3 · single

An in-memory L1 cache experiences periodic batch analytics jobs that scan millions of cold product IDs once per hour, wiping out the hot working set under pure LRU. Conversely, a pure LFU cache keeps items that were viral six months ago pinned in memory forever. How does **W-TinyLFU** (used in Caffeine) defeat both failure modes in compact memory?

- A) W-TinyLFU replicates every cached entry to ZooKeeper and runs global garbage collection every 10 seconds.
- B) W-TinyLFU places a small **Window LRU** (~1% capacity) in front of a **Segmented LRU** (probation + protected, ~99% capacity) gated by a **4-bit Count-Min Sketch** admission filter with periodic halving (aging): one-hit scan items die in the small window without polluting the main cache, while frequency counters decay over time so stale viral items eventually lose admission/retention priority.
- C) W-TinyLFU hashes keys into two separate FIFO queues and evicts whichever entry has the longest string length.
- D) W-TinyLFU stores an exact 64-bit counter per distinct key ever queried since process startup.

<details><summary>Answer</summary>

**B.** W-TinyLFU combines a tiny admission window (giving bursts a chance to build frequency) with a compact Count-Min Sketch frequency estimator (4 bits/counter, halved periodically to age out historical spikes) that admits a candidate into the Segmented LRU main space only if its estimated frequency exceeds the victim's frequency—defeating both scan pollution and stale-LFU stickiness.

- Why not A: ZooKeeper is not an L1 cache eviction algorithm.
- Why not C: FIFO queues do not track access frequency or protect hot items against scans.
- Why not D: Storing an exact 64-bit counter for every key ever seen causes unbounded memory growth; TinyLFU bounds metadata via a fixed-width Count-Min Sketch.
- Ref: [modules/05-caching-strategies-and-invalidation.md](../modules/05-caching-strategies-and-invalidation.md), https://github.com/ben-manes/caffeine/wiki/Efficiency

</details>

### Q-SD-023 · Caching, Scaling Reads/Writes & Partitioning · difficulty 3 · scenario

A single expensive homepage aggregation query (taking 400 ms on PostgreSQL) is cached in Redis with a 5-minute TTL. When that key expires at peak traffic (10,000 RPS), thousands of application instances miss simultaneously and hammer PostgreSQL before any single instance finishes recomputing. Which pair of techniques eliminates this cache stampede **without** relying solely on fixed TTL jitter?

- A) Increase Redis `maxmemory` and switch from TCP to UDP.
- B) **Single-flight request coalescing** within each gateway/origin tier (collapsing concurrent misses for the same key into 1 in-flight DB query) combined with **Probabilistic Early Expiration (XFetch)**—where a reader probabilistically recomputes shortly before TTL expiry via $-\beta \cdot \Delta \cdot \ln(\text{rand}) \ge \text{ttl-remaining}$—or **Stale-While-Revalidate** serving the expired value asynchronously while one background worker refreshes it.
- C) Set `TTL = 0` on all keys so Redis expires them immediately on every read.
- D) Add 100 more Redis cluster shards so the expired key is stored 100 times.

<details><summary>Answer</summary>

**B.** Fixed TTL jitter only spreads _independent_ keys' expirations; a single hot key still has one expiration instant unless mitigated by request coalescing (single-flight), XFetch probabilistic pre-refresh (only one early reader triggers recomputation proportional to computation cost $\Delta$), or stale-while-revalidate background refresh.

- Why not A: More Redis RAM or UDP transport does not prevent thousands of concurrent callers from hitting the DB when a hot key expires.
- Why not C: `TTL = 0` disables caching and hits the database on every request.
- Why not D: A single key hashes to a single primary shard in Redis Cluster regardless of total shard count.
- Ref: [modules/05-caching-strategies-and-invalidation.md](../modules/05-caching-strategies-and-invalidation.md), https://cseweb.ucsd.edu/~avattani/papers/cache_stampede.pdf

</details>

### Q-SD-024 · Caching, Scaling Reads/Writes & Partitioning · difficulty 3 · single

A production Redis 8 instance serving 80,000 RPS suddenly freezes all client reads and writes for 2.8 seconds every time an admin cleanup script deletes expired session sets or lists matching keys. Which command pair caused the single-threaded event-loop stall, and which non-blocking replacement commands fix it?

- A) `GET` and `SET` stalled the loop; replace them with `MGET` and `MSET`.
- B) Synchronous `KEYS *` (O(N) full keyspace scan) and synchronous `DEL` on a multi-million-element collection (blocking the main thread while freeing millions of heap allocations) caused the freeze; replace them with cursor-based **`SCAN`** (bounded `COUNT` per step) and **`UNLINK`** (which detaches the key in $O(1)$ and reclaims memory asynchronously on a background `bio_lazy_free` thread).
- C) `PING` and `INFO` stalled the loop; replace them with `FLUSHALL`.
- D) `EVALSHA` stalled the loop; replace Lua scripts with `MULTI`/`EXEC` wrapped around `KEYS *`.

<details><summary>Answer</summary>

**B.** Redis executes client commands on a single main event-loop thread; `KEYS` blocks until the entire keyspace dictionary is traversed, and `DEL` on a huge `SET`/`ZSET`/`HASH` deallocates every inner node synchronously on that main thread, whereas `SCAN` yields between small cursor batches and `UNLINK` offloads memory reclamation to background lazy-free threads.

- Why not A: `MGET`/`MSET` of huge batch sizes would actually increase single-command latency compared to single-key `GET`/`SET`.
- Why not C: `FLUSHALL` (without `ASYNC`) wipes the entire database synchronously and causes an even worse outage!
- Why not D: Executing `KEYS *` inside `MULTI`/`EXEC` still blocks the single-threaded command loop for the entire scan.
- Ref: [modules/05-caching-strategies-and-invalidation.md](../modules/05-caching-strategies-and-invalidation.md), https://redis.io/docs/latest/commands/unlink/

</details>

### Q-SD-025 · Caching, Scaling Reads/Writes & Partitioning · difficulty 3 · scenario

A viral celebrity live-stream triggers 600,000 RPS of `GET stream:99123:metadata` against a 32-shard Redis Cluster. Even though average cluster CPU is only 12%, Shard #7 hits 100% CPU saturation and drops connections across unrelated tenants hosted on Shard #7. Adding 32 more Redis shards fails to help. Why, and how do you eliminate the hot-key bottleneck?

- A) Consistent hashing virtual nodes map `stream:99123:metadata` to Shard #7 regardless of cluster size; mitigate by adding an **in-process L1 micro-cache** (e.g., 1–2 s TTL on API nodes) and/or **salted key replication** (`stream:99123:metadata#0..#31` written across all 32 shards and read randomly by clients) or Redis read replicas.
- B) Redis Cluster only routes keys to Shard #7 when the key contains numeric digits; renaming the key to alphabetic characters balances it across all 32 shards.
- C) Increasing virtual nodes from 100 to 10,000 automatically splits a single key across multiple shards.
- D) Enabling Redis `AOF always` fsync moves hot reads onto NVMe disks and frees CPU.

<details><summary>Answer</summary>

**A.** In hash-partitioned stores (Redis Cluster, DynamoDB), a single key maps deterministically to exactly one partition, so adding cluster shards does not split a single key's traffic; fanning reads across salted key copies (`#0..#k`), reading from shard read replicas, or absorbing 99% of reads in a short-TTL API-tier L1 cache immediately breaks the single-shard CPU ceiling.

- Why not B: Hash slot assignment (`CRC16(key) mod 16384` in Redis Cluster) depends on the hash of the key, not whether characters are digits or letters.
- Why not C: Virtual nodes balance _many_ distinct keys evenly across nodes, but any _one_ key still hashes to a single vnode and single primary shard.
- Why not D: `appendfsync always` hurts write latency and does nothing to distribute hot-key read CPU.
- Ref: [modules/06-scaling-reads-writes-and-partitioning.md](../modules/06-scaling-reads-writes-and-partitioning.md), [modules/05-caching-strategies-and-invalidation.md](../modules/05-caching-strategies-and-invalidation.md), https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/

</details>

### Q-SD-026 · Caching, Scaling Reads/Writes & Partitioning · difficulty 2 · single

A distributed cache cluster scales from $N = 10$ nodes to $N = 11$ nodes. Compare naive modular hashing (`hash(key) % N`) against **consistent hashing with 150 virtual nodes per physical server** during that expansion.

- A) Naive `hash(key) % N` moves ~91% (10/11) of keys and triggers a massive origin cache-miss storm, whereas consistent hashing with vnodes moves only ~9% (1/11) of keys (evenly drawn from all 10 existing nodes) while keeping per-node key count variance low (~5–10%).
- B) Consistent hashing without virtual nodes guarantees exact 1.0% variance across 10 nodes, whereas virtual nodes increase key movement to 50%.
- C) Naive `hash(key) % N` only moves keys belonging to Node 10, whereas consistent hashing moves 100% of keys on expansion.
- D) Both schemes move $1/N$ of keys; virtual nodes exist solely to support TLS mutual authentication.

<details><summary>Answer</summary>

**A.** Modulo hashing remaps nearly every key whenever $N$ changes because `(h % 10) != (h % 11)` for most hashes; consistent hashing places nodes on a $2^{32}$/$2^{64}$ ring so adding node 11 steals only $\approx 1/(N+1)$ contiguous arcs, and virtual nodes ensure those stolen arcs come uniformly from all 10 existing servers rather than overloading one neighbor.

- Why not B: Without virtual nodes, a small cluster ($N=10$) suffers severe random arc-length skew (often 3×–5× imbalance), and vnodes do not increase total key movement beyond $1/(N+1)$.
- Why not C: Modulo hashing remaps keys across all buckets simultaneously, not just one node.
- Why not D: Virtual nodes balance ring arc lengths and heterogeneous capacity, unrelated to TLS.
- Ref: [modules/06-scaling-reads-writes-and-partitioning.md](../modules/06-scaling-reads-writes-and-partitioning.md), https://en.wikipedia.org/wiki/Consistent_hashing

</details>

### Q-SD-027 · Caching, Scaling Reads/Writes & Partitioning · difficulty 3 · scenario

A social app routes writes to a PostgreSQL primary and reads to five asynchronous read replicas (typical replication lag 15 ms, occasional spikes to 1.5 s). Users complain that after editing their profile on desktop—or refreshing rapidly across two mobile edge PoPs—their old profile briefly reappears ("read-your-writes" violation). Why do sticky sessions to a single replica still fail, and how does **LSN/GTID watermark pinning** solve this cleanly?

- A) Sticky sessions fail when a user switches devices, fails over across proxies, or hits a replica whose lag hasn't caught up to their write; instead, return the commit **LSN/GTID** (`pg_current_wal_lsn()`) in a signed token/session state and have reads inspect the target replica's replay LSN (`pg_last_wal_replay_lsn()`), either waiting briefly within a lag budget or falling back to the primary whenever `replica_lsn < min_required_lsn`.
- B) Enabling `SELECT ... FOR SHARE` on all read replicas forces synchronous commit across all five replicas in 0 ms.
- C) Sticky sessions guarantee RYW globally as long as DNS TTL is set to 3,600 seconds.
- D) Dropping all read replicas and pointing every read to Redis with `TTL = 60s` guarantees RYW automatically without updating the cache on writes.

<details><summary>Answer</summary>

**A.** Only reads strictly after a user's own recent write (plus monotonic reads for that session) require freshness up to that write's WAL position; carrying the per-session/per-entity `min_lsn` watermark lets read routers safely serve from any caught-up replica and fall back to the primary only during the brief replication lag window for that specific user.

- Why not B: `FOR SHARE` cannot execute writes or acquire cross-node consensus on async read replicas, nor can async replicas become zero-latency synchronous mirrors for free.
- Why not C: DNS TTL affects client IP resolution, not cross-device sessions or backend connection-pool replica selection, and a sticky replica can still lag behind the primary.
- Why not D: A 60s stale Redis cache that isn't synchronously invalidated on write _causes_ stale reads rather than preventing them.
- Ref: [modules/06-scaling-reads-writes-and-partitioning.md](../modules/06-scaling-reads-writes-and-partitioning.md), https://www.postgresql.org/docs/current/functions-admin.html

</details>

### Q-SD-028 · Caching, Scaling Reads/Writes & Partitioning · difficulty 3 · ordering

Which sequence accurately describes the **Memcache Lease** read-miss and concurrent-write protocol that prevents both thundering-herd DB stampedes and stale-write cache poisoning?

- A) Reader calls `set` -> Writer updates DB -> Memcache issues lease -> Reader queries DB.
- B) Reader calls `get(k)` and misses; Memcache returns a 64-bit `lease_token` (and temporarily suppresses new leases for `k` for 10s, returning backoff to concurrent callers) -> Concurrent Writer updates DB and calls `delete(k)` (which invalidates any outstanding lease for `k`) -> Slow Reader queries DB and calls `set(k, stale_val, lease_token)` -> Memcache detects the invalidated lease and rejects `set`, preserving cache cleanliness.
- C) Writer calls `delete(k)` before updating DB -> Reader calls `get(k)` -> Memcache blocks the TCP socket until Writer commits -> Reader writes fresh value.
- D) Reader acquires a distributed ZooKeeper lock -> Memcache flushes all keys -> Writer commits -> Reader populates cache without checking lease validity.

<details><summary>Answer</summary>

**B.** As specified in Nishtala et al. (Facebook Memcache, NSDI '13), a lease token serves dual duty: rate-limiting concurrent miss refills per key (stampede control) and acting as a monotonic version guard invalidated by any intervening `delete` so delayed DB readers cannot overwrite fresher invalidations with stale values.

- Why not A: `set` cannot precede the DB read, and leases are issued on `get` misses, not after DB updates.
- Why not C: Deleting _before_ updating DB widens the stale-read window, and Memcache does not block TCP sockets waiting on external DB transactions.
- Why not D: ZooKeeper locks + flushing all keys would serialize reads globally and destroy hit rates.
- Ref: [modules/05-caching-strategies-and-invalidation.md](../modules/05-caching-strategies-and-invalidation.md), https://www.usenix.org/conference/nsdi13/technical-sessions/presentation/nishtala

</details>

### Q-SD-029 · Caching, Scaling Reads/Writes & Partitioning · difficulty 2 · multi

When evaluating **write-through** versus **write-behind (write-back)** caching for high-throughput stateful services, which **two** trade-offs accurately govern production selection?

- A) Write-behind reduces backend DB write IOPS dramatically by batching and coalescing repeated updates to the same key in memory before flushing asynchronously, making it well-suited for non-critical counters or telemetry where small loss windows on node crash are tolerable.
- B) Write-behind guarantees zero data loss (RPO = 0) on sudden cache-node power failure without replication or WAL persistence.
- C) Write-through increases per-write latency because both the cache and the durable database must acknowledge the write synchronously, and can still suffer cache-DB divergence on partial failure unless wrapped in outbox/retry reconciliation.
- D) Write-through eliminates cache cold-start issues completely even when keys are rarely written and heavily read.

<details><summary>Answer</summary>

**A, C.** Write-behind trades durability for coalesced write throughput (absorbing bursts and flattening DB spikes), whereas write-through enforces synchronous durability into the backing store at the cost of higher tail write latency and requires handling the two-phase partial failure where DB succeeds and cache write fails (or vice versa).

- Why not B: Unflushed dirty entries held solely in volatile cache RAM are lost on abrupt crash/power loss unless replicated synchronously or backed by a durable WAL.
- Why not D: Write-through only populates keys that are written; read-heavy legacy items that haven't been updated recently still start cold.
- Ref: [modules/05-caching-strategies-and-invalidation.md](../modules/05-caching-strategies-and-invalidation.md), https://aws.amazon.com/builders-library/challenges-with-distributed-systems/

</details>

### Q-SD-030 · Caching, Scaling Reads/Writes & Partitioning · difficulty 3 · scenario

A viral video receives 200,000 "like" increments per second. Storing `like_count` in a single PostgreSQL row (`UPDATE videos SET likes = likes + 1 WHERE id = $1`) locks that row exclusively on every write, collapsing throughput around ~2,000 TPS due to lock-wait queues and MVCC dead-tuple bloat. How do you scale exact or near-exact write throughput past 200,000 RPS without losing increments?

- A) Switch PostgreSQL isolation level to `SERIALIZABLE` so concurrent increments execute lock-free.
- B) Use **sharded counters** (partitioning hot video IDs into $K$ independent sub-rows/buckets `(video_id, bucket_id)` written randomly via `bucket_id = rand(0, K-1)`, reducing single-row lock contention by $K\times$ and summing buckets asynchronously or via a cached materialized total) and/or **durable buffered aggregation** in a partitioned stream/Redis before batch-flushing deltas (`likes = likes + delta`) every few hundred milliseconds.
- C) Replace `INTEGER` with `BIGINT` so row locks become shared instead of exclusive.
- D) Use HyperLogLog to count total clicks because HyperLogLog adds exact increments in $O(1)$ space.

<details><summary>Answer</summary>

**B.** Row-level exclusive locks serialize updates to the same tuple; splitting one logical counter across $K$ shard buckets distributes lock contention across $K$ distinct rows/partitions, while durable micro-batching collapses 200,000 `+1` row updates into a handful of `+delta` updates per second.

- Why not A: `SERIALIZABLE` detects write-skew conflicts and aborts concurrent conflicting transactions, making contention _worse_ (high serialization failure retry rates).
- Why not C: Column integer width does not change `UPDATE` row-lock exclusivity.
- Why not D: HyperLogLog estimates _distinct_ cardinality (unique viewers), not total non-unique increments (`+1` likes), and cannot decrement.
- Ref: [modules/06-scaling-reads-writes-and-partitioning.md](../modules/06-scaling-reads-writes-and-partitioning.md), https://www.postgresql.org/docs/current/explicit-locking.html

</details>

### Q-SD-031 · Caching, Scaling Reads/Writes & Partitioning · difficulty 3 · multi

An engineering team adopts CQRS with PostgreSQL as the write model and Elasticsearch as an asynchronous read-projection store fed via CDC events. Which **two** subtle production hazards must the architecture explicitly handle?

- A) Zero-downtime schema/mapping rebuilds: projecting a new Elasticsearch index version requires dual-writing or replaying historical snapshots + streaming CDC offsets into a shadow index before atomically swapping an alias.
- B) Out-of-order or stale CDC updates and read-your-writes gaps: if a user edits an item and immediately reloads the search list before the async consumer indexes the event, they observe stale state unless the UI patches optimistic local state or falls back to the write store/version check.
- C) CQRS automatically provides multi-document ACID transactions across PostgreSQL and Elasticsearch without sagas or reconciliation.
- D) Read projections eliminate the need for any primary database backups because Elasticsearch can reconstruct normalized SQL constraints automatically.

<details><summary>Answer</summary>

**A, B.** Async CQRS projections decouple write schemas from rich search read models, which introduces eventual consistency (requiring RYW/version checks or UI optimistic state) and requires dual-index / shadow-alias rebuild pipelines whenever mapping/projection logic evolves.

- Why not C: Separating write and async read stores explicitly gives _up_ cross-store ACID transactions in favor of eventual consistency.
- Why not D: Denormalized read projections discard relational integrity and are derived artifacts; the write database remains the system of record requiring durable backups.
- Ref: [modules/06-scaling-reads-writes-and-partitioning.md](../modules/06-scaling-reads-writes-and-partitioning.md), [modules/07-asynchrony-queues-streams-and-workflows.md](../modules/07-asynchrony-queues-streams-and-workflows.md), https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html

</details>

---

## Domain 4: Asynchrony, Rate Limiting & Resilience Engineering (`Q-SD-032`–`Q-SD-042`)

### Q-SD-032 · Asynchrony, Rate Limiting & Resilience Engineering · difficulty 3 · single

An API gateway enforces a quota of 100 requests/minute using a **Fixed Window Counter** keyed on `user_id:minute_bucket`. A bursty client sends 100 requests at `12:00:59` and 100 more requests at `12:01:01`—passing 200 requests in 2 seconds! Compare this flaw against **GCRA (Generic Cell Rate Algorithm)** and **Sliding Window Counter**.

- A) Fixed Window permits up to $2\times$ the rate limit across any bucket boundary; **GCRA** eliminates boundary bursts completely while storing only **one 64-bit Theoretical Arrival Time (`TAT`) timestamp per key** (O(1) space and mathematically isomorphic to a Leaky/Token Bucket), whereas Sliding Window Counter blends the previous and current minute counts via weighted overlap to bound bursts smoothly in $O(1)$ space.
- B) Fixed Window fails because Redis integers overflow at 100; switching to Sliding Window Log uses $O(1)$ memory per user regardless of RPS.
- C) GCRA requires storing an array of the last 100 request timestamps in Redis Sorted Sets (`ZSET`), using $O(N)$ memory per user.
- D) Sliding Window Counter prevents 2× bursts by blocking all traffic for 30 seconds at the start of every minute.

<details><summary>Answer</summary>

**A.** Fixed Window resets abruptly on clock edges, allowing double-rate bursts spanning `:59`–`:01`; GCRA tracks a single `TAT` value (`new_tat = max(now, tat) + emission_interval`, allowing if `now >= new_tat - burst_allowance`) for exact leaky/token-bucket pacing in 8 bytes per key, and Sliding Window Counter approximates a rolling window using just two integer counters.

- Why not B: Sliding Window Log stores every timestamp in a `ZSET` ($O(R)$ memory per user, expensive at high limits), not $O(1)$ memory.
- Why not C: Storing an array of timestamps in a `ZSET` describes Sliding Window Log, not GCRA.
- Why not D: Sliding Window Counter weights the prior window proportional to remaining overlap (`prev_count * (1 - elapsed_fraction) + curr_count`) without artificial blackout intervals.
- Ref: [modules/08-rate-limiting-load-shedding-and-resilience.md](../modules/08-rate-limiting-load-shedding-and-resilience.md), https://en.wikipedia.org/wiki/Generic_cell_rate_algorithm

</details>

### Q-SD-033 · Asynchrony, Rate Limiting & Resilience Engineering · difficulty 3 · scenario

A distributed rate limiter runs across 20 API gateway pods sharing a Redis cluster. Initially, each pod runs `count = GET key; if count < limit { INCR key; EXPIRE key 60 }`. At peak load, clients exceed limits by 40%, and thousands of keys eventually stick permanently at the limit without expiring. Identify **both** bugs and the correct distributed implementation.

- A) Separate `GET` -> `INCR` -> `EXPIRE` calls suffer a **TOCTOU race condition** (concurrent pods read `99` simultaneously and all `INCR` past `100`) AND a **partial-failure leak** (if a pod crashes or times out between `INCR` and `EXPIRE`, the key lives forever with `TTL = -1`); execute a single atomic **Redis Lua script (`EVALSHA`)** implementing Token Bucket or GCRA with TTL in one round trip, and define an explicit fail-open/fail-closed fallback if Redis is unreachable.
- B) Redis `GET` returns stale replicas by default; enabling `READONLY` on the Redis primary fixes both bugs.
- C) Switching from `INCR` to `DECR` makes Redis execute all three commands atomically across multiple network calls.
- D) Replacing Redis with independent in-memory counters inside each of the 20 pods enforces the exact global limit without network overhead.

<details><summary>Answer</summary>

**A.** Non-atomic read-check-increment-expire sequences fail both under concurrency (multiple callers passing the `count < limit` check concurrently) and under crash faults (creating permanent TTL-less keys); bundling the state read, limit check, mutation, and `PEXPIRE` inside an `EVALSHA` Lua script guarantees single-threaded atomicity on the Redis shard in one RTT.

- Why not B: `READONLY` applies to cluster replicas, not atomicity across sequential client round trips.
- Why not C: `DECR` is still an independent command; it does not merge separate `GET` and `EXPIRE` round trips into an atomic transaction.
- Why not D: Independent per-node counters without synchronization let a client hitting 20 pods achieve up to $20\times$ the intended global rate limit.
- Ref: [modules/08-rate-limiting-load-shedding-and-resilience.md](../modules/08-rate-limiting-load-shedding-and-resilience.md), https://redis.io/docs/latest/commands/evalsha/

</details>

### Q-SD-034 · Asynchrony, Rate Limiting & Resilience Engineering · difficulty 3 · scenario

After a brief 2-second downstream slowdown, an API cluster enters a **metastable failure state**: even after the downstream dependency completely recovers, the API cluster stays pinned at 100% CPU, 0% goodput, and endless timeouts until engineers manually drop all ingress traffic for 30 seconds. Which combination of architectural defaults created this self-sustaining feedback loop, and how do you break it?

- A) Circuit breakers opened too quickly; removing all timeouts and retries restores full goodput immediately.
- B) Unbounded **FIFO** request queues + aggressive client retries without jitter/budgets: once latency exceeds caller deadlines, the FIFO queue fills with already-timed-out ("zombie") requests, forcing workers to spend 100% of CPU processing abandoned work while fresh retries pile onto the tail; break the loop using **bounded queues**, **LIFO** scheduling under overload (or CoDel/propagated request deadlines to drop expired work before execution), **priority-tiered load shedding**, and strict **retry budgets** (e.g., max 10% retry ratio + exponential backoff with full jitter).
- C) Switching from HTTP/1.1 to gRPC automatically converts FIFO queues to LIFO inside Linux TCP sockets.
- D) Increasing retry attempts from 3 to 20 per caller clears the backlog faster once the dependency recovers.

<details><summary>Answer</summary>

**B.** As documented in the AWS Builders' Library and Google SRE overload guides, FIFO queues under overload serve the oldest (most likely expired) requests first, turning 100% of server capacity into wasted goodput; bounded queues, LIFO/CoDel age-dropping under congestion, deadline propagation, and retry budgets cut off zombie amplification so healthy requests succeed as soon as capacity returns.

- Why not A: Removing timeouts and retries leaves hung threads holding resources indefinitely and drops resilience against transient single-host blips.
- Why not C: Application thread-pool and task queues remain FIFO regardless of whether the wire protocol is HTTP/1.1 or gRPC.
- Why not D: Multiplying retries from 3 to 20 multiplies arrival rate $\lambda$ by up to 20× during recovery, guaranteeing the metastable overload persists forever.
- Ref: [modules/08-rate-limiting-load-shedding-and-resilience.md](../modules/08-rate-limiting-load-shedding-and-resilience.md), https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/

</details>

### Q-SD-035 · Asynchrony, Rate Limiting & Resilience Engineering · difficulty 3 · scenario

An order service writes to PostgreSQL and then calls `kafka.send(orderCreatedEvent)`. During network partitions or process crashes between the two calls, either the DB commits without publishing the Kafka event (missing downstream fulfillment) or Kafka receives an event for a rolled-back DB transaction (ghost fulfillment). How does the **Transactional Outbox + CDC** pattern eliminate dual-write drift without two-phase commit (2PC), and what contract remains mandatory on consumers?

- A) Write the order row and an `outbox_events` row inside the **same local ACID PostgreSQL transaction**, then stream `outbox_events` to Kafka via a polling relay or Debezium WAL CDC; because the relay/CDC delivers **at-least-once** (retries after crashes before checkpointing offsets), downstream consumers MUST still be **idempotent** (deduplicating via `event_id`).
- B) Wrap PostgreSQL and Kafka in an HTTP `POST` webhook and set `acks=0` on the Kafka producer so publishing never fails.
- C) Write to Kafka first inside a `try/catch` block and assume PostgreSQL commits will always succeed afterward.
- D) Store the Kafka broker IP inside a PostgreSQL trigger that executes an external TCP socket call during `COMMIT`.

<details><summary>Answer</summary>

**A.** Co-locating business state and outbox events in one local ACID commit guarantees atomicity without slow distributed 2PC across heterogeneous systems; a CDC/polling relay guarantees eventual at-least-once publication to Kafka, shifting the final exactness guarantee to idempotent consumer deduplication.

- Why not B: `acks=0` silently drops broker-rejected messages and does not prevent ghost events if the DB transaction later rolls back.
- Why not C: Publishing to Kafka before committing the DB creates irreversible ghost events whenever the DB transaction hits a constraint violation, deadlock, or crash.
- Why not D: Performing synchronous network I/O inside a DB trigger holds transaction locks open across external network partitions and does not solve rollback/partial-ack semantics.
- Ref: [modules/07-asynchrony-queues-streams-and-workflows.md](../modules/07-asynchrony-queues-streams-and-workflows.md), https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html

</details>

### Q-SD-036 · Asynchrony, Rate Limiting & Resilience Engineering · difficulty 2 · single

In a social network feed system, a celebrity with 60 million followers publishes a photo. Under pure **fan-out on write** (pushing the post ID into every follower's precomputed Redis timeline list), the fan-out workers saturate for minutes and delay delivery across the entire platform. How does **hybrid fan-out** resolve both celebrity write amplification and fast normal-user reads?

- A) Fan-out on write is pushed to all 60M followers using `KEYS *` and synchronous SQL joins.
- B) Normal users (below a follower threshold, e.g., < 10k–50k followers) use **fan-out on write** into followers' Redis timeline caches for $O(1)$ fast reads, while celebrities skip write push and have their recent posts merged dynamically at **read time** (`fan-out on read`) from a per-celebrity post cache.
- C) Every user—including accounts with 5 followers—is forced onto pure fan-out on read, querying 500 followed users' SQL tables sequentially on every home-feed refresh.
- D) Celebrities are restricted to posting once per 24 hours so their 60M fan-out queue has time to drain.

<details><summary>Answer</summary>

**B.** Hybrid fan-out exploits the heavy-tailed follower distribution: pushing on write for normal accounts keeps 99%+ of timeline items pre-materialized, while pulling the small number of followed celebrities at read time avoids 60M-write amplification spikes.

- Why not A: `KEYS *` freezes Redis and pushes 60M writes anyway.
- Why not C: Pure fan-out on read for someone following 1,000 regular accounts requires 1,000-way scatter-gather merges on every page load, wasting read IOPS and blowing tail latency.
- Why not D: Artificial product posting throttling degrades core UX instead of fixing the underlying fan-out asymmetry.
- Ref: [modules/07-asynchrony-queues-streams-and-workflows.md](../modules/07-asynchrony-queues-streams-and-workflows.md), [modules/12-canonical-designs-read-heavy-and-content.md](../modules/12-canonical-designs-read-heavy-and-content.md), https://sre.google/sre-book/table-of-contents/

</details>

### Q-SD-037 · Asynchrony, Rate Limiting & Resilience Engineering · difficulty 3 · scenario

To reduce p99 tail latency on a stateless read-only storage lookup, an engineer proposes sending two identical requests simultaneously to two replicas (`hedge_delay = 0 ms`) for every incoming call. Why does `hedge_delay = 0 ms` risk collapsing the cluster, and how do **hedged requests** (_The Tail at Scale_) achieve comparable tail reduction at minimal load cost?

- A) `hedge_delay = 0 ms` immediately doubles total cluster QPS (+100% load), leaving zero headroom and triggering collapse during modest traffic surges; delaying the hedge until the primary request exceeds the local **p95 latency threshold** (e.g., `hedge_delay = p95`, ~5% extra requests) combined with **in-flight cancellation** upon first reply and a **per-client hedge budget** cuts p99.9 tail dramatically for ~5% overhead.
- B) `hedge_delay = 0 ms` fails only because HTTP/2 forbids two GET requests to different IP addresses.
- C) Hedged requests require distributed two-phase locking across both storage replicas for read-only lookups.
- D) Hedged requests should only be sent after the primary request returns `HTTP 500`, never while it is still pending.

<details><summary>Answer</summary>

**A.** Deferring the backup request until the first request has already crossed the 95th percentile ensures 95% of requests never issue a second call, capping baseline amplification at ~5%, while cancellation tokens and retry/hedge budgets prevent amplification cascades if the whole backend tier is overloaded.

- Why not B: HTTP/2 has no restriction against issuing requests to distinct backend replicas.
- Why not C: Read-only idempotent hedging uses no distributed locks (and hedging non-idempotent mutations is unsafe without idempotency guards).
- Why not D: Waiting for an explicit `500` error is a standard _retry_, whereas hedging specifically targets _slow stragglers_ that haven't failed yet.
- Ref: [modules/08-rate-limiting-load-shedding-and-resilience.md](../modules/08-rate-limiting-load-shedding-and-resilience.md), https://research.google/pubs/the-tail-at-scale/

</details>

### Q-SD-038 · Asynchrony, Rate Limiting & Resilience Engineering · difficulty 3 · single

A payments team consumes webhook delivery jobs from an Apache Kafka topic partitioned by `merchant_id` (`64 partitions`). One merchant's webhook endpoint hangs for 30 seconds on every delivery attempt, causing all other merchants mapped to that same partition to experience 20-minute webhook delays. Why did this happen in Kafka, and how does consumer architecture mitigate partition head-of-line blocking?

- A) Kafka tracks a single sequential committed offset per partition per consumer group; a blocking synchronous retry on one message stalls every subsequent message on that partition (`head-of-line blocking`). Mitigate by enforcing strict short per-delivery timeouts + offloading failed/slow retries to **tiered retry topics** (`retry-5s`, `retry-1m`, `dlq`) or an independent point-to-point/per-message-ack queue so the main partition consumer advances immediately.
- B) Kafka partitions execute globally sequentially across all 64 partitions; reducing to 1 partition speeds up delivery.
- C) Increasing `auto.commit.interval.ms` to 60 minutes allows Kafka consumers to skip slow messages without losing data.
- D) Switching Kafka `acks` from `all` to `1` lets consumers acknowledge offsets out of order inside a partition.

<details><summary>Answer</summary>

**A.** Because Kafka commits a monotonic partition offset rather than individual message ACKs, holding a partition consumer blocked while retrying a poison/slow merchant stalls the entire partition; publishing failed items to delayed retry topics or a DLQ (or using a per-message-ACK queue like SQS/RabbitMQ when strict ordering isn't required across tenants) unblocks healthy tenants immediately.

- Why not B: Reducing from 64 partitions to 1 merges all merchants onto one offset cursor, maximizing head-of-line blocking.
- Why not C: Longer auto-commit intervals only risk reprocessing larger batches on crash without solving blocked worker threads; worse, async auto-commit on unhandled errors risks _skipping_ uncommitted messages on crash/rebalance.
- Why not D: Producer `acks` governs broker replication durability on write, not consumer offset semantics.
- Ref: [modules/07-asynchrony-queues-streams-and-workflows.md](../modules/07-asynchrony-queues-streams-and-workflows.md), https://aws.amazon.com/builders-library/avoiding-fallback-in-distributed-systems/

</details>

### Q-SD-039 · Asynchrony, Rate Limiting & Resilience Engineering · difficulty 3 · multi

A distributed cron/job scheduler supports 50 million scheduled user jobs. At `00:00:00 UTC`, millions of users configure daily digest jobs to run at midnight, causing a massive top-of-the-hour DB polling and execution storm. Which **two** architectural mechanisms prevent midnight storms and duplicate job execution?

- A) Apply deterministic **hash-based jitter** (`hash(tenant_id, job_id) % jitter_window`) for non-exact-second schedules (e.g., spreading midnight digests smoothly across `00:00`–`00:15`), combined with sharded time-bucket storage (`bucket_minute` partition key) rather than a single global `WHERE next_run_at <= NOW()` table scan.
- B) Require workers to claim jobs using **fenced leases / optimistic CAS** (`UPDATE jobs SET state='RUNNING', lease_until=NOW()+30s, fence_token=fence_token+1 WHERE id=$1 AND state='PENDING'`) with heartbeats, ensuring crashed workers recover without dual execution.
- C) Run `SELECT * FROM jobs ORDER BY next_run_at LIMIT 1000` inside every worker pod simultaneously every 100 ms without locking.
- D) Store all 50 million job payloads inside a single Redis string key and deserialize the full JSON array on every tick.

<details><summary>Answer</summary>

**A, B.** Time-bucket partitioning + deterministic per-job jitter flattens synchronized clock-boundary spikes, while CAS/lease claiming with fencing tokens prevents two workers from executing the same job when a worker pauses or loses connectivity.

- Why not C: Uncoordinated polling of the exact same `ORDER BY next_run_at LIMIT 1000` causes massive duplicate claims and database lock contention across workers.
- Why not D: Serializing 50M jobs into one Redis key creates gigabyte-scale payloads that freeze Redis's single thread on every read/write.
- Ref: [modules/07-asynchrony-queues-streams-and-workflows.md](../modules/07-asynchrony-queues-streams-and-workflows.md), [modules/13-canonical-designs-realtime-geo-and-streams.md](../modules/13-canonical-designs-realtime-geo-and-streams.md), https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/

</details>

### Q-SD-040 · Asynchrony, Rate Limiting & Resilience Engineering · difficulty 2 · single

A downstream recommendation engine crashes from overload, tripping upstream **Circuit Breakers** across 80 API pods into the `OPEN` state. Five minutes later, the downstream engine restarts with cold caches. Why does transitioning directly from `OPEN` to `CLOSED` across all 80 pods re-crash the dependency, and how must the `HALF-OPEN` transition behave?

- A) Returning immediately to `CLOSED` unleashes 100% of full production traffic simultaneously onto a cold-cache service; `HALF-OPEN` must admit only a **strictly bounded probe count** (e.g., 1–5 trial requests per pod or a slow-start ramp over minutes) before restoring `CLOSED`, resetting back to `OPEN` immediately if probes fail.
- B) `HALF-OPEN` must drop 100% of requests permanently until a human restarts all 80 API pods.
- C) Circuit breakers should execute `OPEN -> CLOSED` inside the client's DNS resolver rather than the application proxy.
- D) `HALF-OPEN` only works if every API pod shares a synchronous distributed lock before sending each HTTP request.

<details><summary>Answer</summary>

**A.** Even a healthy recovering service with cold caches and empty connection pools often has 5×–10× lower initial throughput; a gated `HALF-OPEN` state (ideally paired with gradual traffic ramping / slow start) tests liveness with minimal probe volume before reopening the floodgates.

- Why not B: Permanently staying `OPEN` without probing prevents automatic recovery.
- Why not C: DNS resolvers lack per-RPC error-rate and latency telemetry needed for circuit-breaker state transitions.
- Why not D: Per-pod bounded `HALF-OPEN` probes (with jittered cooldown timers) avoid global distributed locking on the hot path.
- Ref: [modules/08-rate-limiting-load-shedding-and-resilience.md](../modules/08-rate-limiting-load-shedding-and-resilience.md), https://martinfowler.com/bliki/CircuitBreaker.html

</details>

### Q-SD-041 · Asynchrony, Rate Limiting & Resilience Engineering · difficulty 3 · ordering

A multi-step travel booking orchestrates Flight Reservation, Hotel Hold, and Card Charge across three external partner APIs using a durable workflow engine (e.g., Temporal). If Card Charge fails permanently after Flight and Hotel succeeded, which execution and compensation sequence preserves consistency across crash-restarts?

- A) Charge Card -> Reserve Flight -> Reserve Hotel -> if Flight fails, issue a second Charge Card call.
- B) Persist durable saga state with per-step idempotency keys -> Reserve Flight -> Reserve Hotel -> Attempt Card Charge -> on permanent Card failure, execute compensating actions in **reverse dependency order** (`Cancel Hotel Hold`, then `Cancel Flight Reservation`) with idempotent retries until acknowledged.
- C) Hold an open XA 2PC database transaction across all three external HTTP partner APIs for up to 30 seconds.
- D) Execute all three APIs in parallel fire-and-forget goroutines and ignore failures if 2 out of 3 succeed.

<details><summary>Answer</summary>

**B.** Durable workflow engines persist an event-sourced execution log so crash recovery replays cleanly without re-executing already-completed side effects (using deterministic per-activity idempotency keys) and runs backward-recovery compensations (`Cancel Hotel` -> `Cancel Flight`) deterministically on terminal failure.

- Why not A: Charging before verifying scarce inventory creates unnecessary refunds/chargeback fees, and re-charging on failure doubles the customer's charge.
- Why not C: External third-party REST APIs do not participate in distributed XA 2PC, and holding locks across 30s external HTTP calls destroys throughput.
- Why not D: Leaving a customer charged for a hotel with no flight—or vice versa—violates core business invariants.
- Ref: [modules/07-asynchrony-queues-streams-and-workflows.md](../modules/07-asynchrony-queues-streams-and-workflows.md), https://docs.temporal.io/workflows

</details>

### Q-SD-042 · Asynchrony, Rate Limiting & Resilience Engineering · difficulty 2 · multi

An asynchronous image-processing pipeline slows down because downstream GPU workers can process only 500 images/sec while API uploads surge to 5,000 images/sec. Which **two** backpressure designs protect end-to-end latency and system stability?

- A) Bound queue depth / max in-flight work at the ingestion boundary and reject excess requests immediately with `429 Too Many Requests` + `Retry-After` (with jitter) or route overflow to degraded low-priority tiers rather than buffering indefinitely in worker RAM.
- B) Propagate end-to-end work-in-progress credits / consumer lag metrics upstream so ingestion throttles or sheds load before workers OOM or accumulate multi-hour backlog latencies.
- C) Configure RabbitMQ/Kafka consumers with `prefetch = infinite` so every worker downloads 1,000,000 messages into local heap RAM as fast as possible.
- D) Remove all `max-length` queue bounds and auto-scale worker heap size until latency hits 12 hours.

<details><summary>Answer</summary>

**A, B.** True backpressure couples admission control at the edge with downstream consumer capacity (bounded queues, `429 Retry-After` with jitter, priority shedding), preventing unbounded memory growth and stale multi-hour queues.

- Why not C: Unbounded consumer prefetch starves sibling workers and causes worker OOM crashes when queues spike.
- Why not D: Unbounded queues convert temporary throughput deficits into catastrophic multi-hour latency spikes and OOM failures.
- Ref: [modules/08-rate-limiting-load-shedding-and-resilience.md](../modules/08-rate-limiting-load-shedding-and-resilience.md), [modules/07-asynchrony-queues-streams-and-workflows.md](../modules/07-asynchrony-queues-streams-and-workflows.md), https://sre.google/sre-book/handling-overload/

</details>

---

## Domain 5: Specialized Indexing, Contention & Financial Correctness (`Q-SD-043`–`Q-SD-052`)

### Q-SD-043 · Specialized Indexing, Contention & Financial Correctness · difficulty 3 · scenario

A ride-hailing proximity query indexes drivers using 6-character **Geohash** strings (`WHERE geohash LIKE :prefix || '%'`). Riders standing 40 meters east of the Prime Meridian (`0° E`) or near the Equator frequently see "0 nearby drivers" even when dozens of available drivers sit 45 meters away on the west side. What causes this spatial indexing bug, and what are the two standard production fixes?

- A) Geohash treats longitude and latitude as signed floats that underflow at `0.0`.
- B) Geohash maps 2D coordinates onto a 1D Z-order curve where adjacent physical points across major cell/meridian boundaries share **zero common prefix characters** (`edge/boundary trap`), and rectangular geohash cells distort horizontally near the poles; fix by **always querying the target cell plus its 8 neighbor cells (9-box lookup)** followed by exact Haversine/distance filtering, OR adopting **Uber H3 hexagonal hierarchical grids** (uniform 6-neighbor ring distances without corner distortion) / Google S2 Hilbert-curve cells.
- C) Switching from 6-character Geohash to 12-character Geohash eliminates boundary discontinuities across the Prime Meridian.
- D) Storing latitude and longitude in separate unindexed JSON columns avoids Z-order boundary artifacts at 100k QPS.

<details><summary>Answer</summary>

**B.** Z-order space-filling curves preserve locality well _within_ a quadtree quadrant, but points millimeters apart across a top-level boundary (such as `0°` longitude/latitude) have completely disjoint bit prefixes (`u00...` vs `gzz...`); querying the 8 surrounding neighbors or using uniform hexagonal H3 `kRing` / S2 coverings guarantees complete spatial recall.

- Why not A: IEEE-754 floating-point numbers do not underflow at `0.0`.
- Why not C: Longer Geohash prefixes produce _smaller_ cells (more boundaries!) and still share zero common prefix across `0°`.
- Why not D: Unindexed JSON columns force full-table scans, collapsing throughput long before 100k QPS.
- Ref: [modules/09-search-geospatial-and-specialized-components.md](../modules/09-search-geospatial-and-specialized-components.md), https://h3geo.org/docs/

</details>

### Q-SD-044 · Specialized Indexing, Contention & Financial Correctness · difficulty 3 · scenario

During a stadium concert flash sale (50,000 seats, 5 million concurrent fans), issuing `SELECT * FROM seats WHERE event_id = $1 AND status = 'AVAILABLE' LIMIT 1 FOR UPDATE` directly against PostgreSQL causes severe lock convoys and DB connection pool exhaustion within 2 seconds. How do you architect seat holds to maximize concurrency without overselling?

- A) Remove `FOR UPDATE` and rely on `READ COMMITTED` client-side checks before `UPDATE`.
- B) Put an **Edge Virtual Waiting Room** (rate-paced token admission) in front of checkout, use **`SELECT ... FOR UPDATE SKIP LOCKED`** for interchangeable general-admission pools (so workers skip already-locked rows instead of queueing behind one hot row) or **sharded/atomic Redis Lua seat holds with short TTLs** paired with an authoritative **conditional DB update** (`UPDATE seats SET status = 'HELD', hold_token = $t, version = version + 1 WHERE seat_id = $s AND status = 'AVAILABLE' AND version = $v`) as the source of truth before payment capture.
- C) Run `LOCK TABLE seats IN ACCESS EXCLUSIVE MODE` during the entire 10-minute user checkout flow.
- D) Cache the seat map in CDN edge PoPs with `max-age=300` and allow overselling up to 20%, canceling extras later.

<details><summary>Answer</summary>

**B.** Plain `FOR UPDATE` on a deterministic `LIMIT 1` query piles thousands of transactions behind the same first row; virtual waiting rooms bound ingress rate to DB capacity, `SKIP LOCKED` eliminates row-queue waiting for fungible inventory, and atomic conditional CAS / TTL-bounded holds ensure zero double-booking across concurrent checkout clicks.

- Why not A: Without `FOR UPDATE` or a conditional `WHERE status = 'AVAILABLE'` predicate, two concurrent readers both see `'AVAILABLE'` and overwrite each other (classic lost update / oversell).
- Why not C: `ACCESS EXCLUSIVE` serializes the entire table across all users for 10 minutes, yielding < 1 checkout every 10 minutes.
- Why not D: Overselling unique assigned stadium seats violates the hard zero-oversell business invariant.
- Ref: [modules/10-contention-inventory-and-financial-correctness.md](../modules/10-contention-inventory-and-financial-correctness.md), https://www.postgresql.org/docs/current/explicit-locking.html

</details>

### Q-SD-045 · Specialized Indexing, Contention & Financial Correctness · difficulty 3 · scenario

Worker A acquires a Redis distributed lease lock (10s TTL) to exclusively mutate an inventory ledger record. Immediately afterward, Worker A suffers a 15-second stop-the-world GC pause. Meanwhile, the lock expires, Worker B acquires the lock and writes version 2, and then Worker A resumes from GC—believing it still holds the lock—and overwrites storage with stale version 1. Why does _any_ client-side TTL check fail to close this window, and what guarantees safety?

- A) Even if Worker A checks its local clock before writing, it can still pause _between_ the check and packet transmission; safety requires the lock service to issue a **monotonically increasing fencing token** on every lock acquisition, and the **storage/database server itself must reject any write whose fencing token is less than the highest token already applied** (`WHERE last_fence_token < $incoming_token`).
- B) Increasing the Redis lock TTL from 10 seconds to 15 seconds eliminates GC pause races mathematically.
- C) Switching from single-node Redis to Redlock across 5 Redis nodes eliminates client GC pause overwrites without storage validation.
- D) Setting TCP `SO_KEEPALIVE` on Worker A forces the Linux kernel to abort in-flight writes during JVM GC pauses.

<details><summary>Answer</summary>

**A.** As Martin Kleppmann demonstrated in his critique of distributed locks, time-based leases alone cannot ensure mutual exclusion across asynchronous process pauses because a zombie client cannot observe its own pause after checking the lease; only a **monotonic fencing token verified by the stateful storage layer** closes the check-then-act race.

- Why not B: Arbitrary OS scheduling stalls, hypervisor migrations, or network queuing can still exceed 15 seconds.
- Why not C: Redlock does not prevent a client that legitimately acquired a quorum lock from pausing in GC past TTL and transmitting a stale storage write afterward.
- Why not D: TCP keepalives operate on idle sockets and do not abort already-buffered writes or provide application-level fencing.
- Ref: [modules/10-contention-inventory-and-financial-correctness.md](../modules/10-contention-inventory-and-financial-correctness.md), https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html

</details>

### Q-SD-046 · Specialized Indexing, Contention & Financial Correctness · difficulty 3 · scenario

During checkout, your payment service sends a charge request to an external Payment Service Provider (PSP) using `Idempotency-Key: pay_89f2`. After 8 seconds, the HTTP connection resets (`ECONNRESET` / gateway `504`), leaving you uncertain whether the PSP committed the card charge or dropped the packet before processing. Which handling policy prevents both silent double-charging and unrecorded revenue?

- A) Immediately mark the order `FAILED` in your DB and prompt the user to click "Pay Again" with a brand-new `Idempotency-Key`.
- B) Immediately mark the order `PAID` optimistically so the user gets their ticket without delay.
- C) Treat a network/504 timeout strictly as an **unknown outcome**: transition the internal payment attempt to **`PENDING_RECONCILIATION`** (holding inventory briefly rather than releasing or double-charging), retry/poll the PSP's status/charge endpoint **using the exact same `Idempotency-Key`** (`pay_89f2`), and reconcile asynchronously via signed PSP webhooks plus daily T+1 settlement reports.
- D) Retry the charge automatically against a _different_ PSP backup provider using a newly generated order ID.

<details><summary>Answer</summary>

**C.** In distributed payments, a timeout means "state unknown"—the PSP may have captured funds right before the socket dropped; generating a new key or switching PSPs guarantees double charges if the first request succeeded, whereas `PENDING_RECONCILIATION` + same-key retries + asynchronous webhook/settlement reconciliation converges safely to ground truth.

- Why not A: Issuing a brand-new idempotency key on retry will charge the customer's card twice if the timed-out request actually succeeded at the PSP.
- Why not B: Marking an unconfirmed timeout as `PAID` grants free goods/tickets whenever the network dropped _before_ the PSP received the request.
- Why not D: Failover to a second PSP on an ambiguous timeout creates unlinked cross-PSP double charges that automated single-PSP idempotency cannot deduplicate.
- Ref: [modules/10-contention-inventory-and-financial-correctness.md](../modules/10-contention-inventory-and-financial-correctness.md), https://docs.stripe.com/api/idempotent_requests

</details>

### Q-SD-047 · Specialized Indexing, Contention & Financial Correctness · difficulty 3 · multi

When engineering an internal digital wallet and settlement ledger capable of 25,000 transfers/sec across millions of users and high-volume platform fee accounts, which **two** patterns preserve strict accounting correctness and avoid hot-account lock serialization?

- A) Model all ledger mutations as an **immutable append-only double-entry journal** using **integer minor units** (e.g., `BIGINT` cents/satoshis + ISO currency code, never IEEE-754 floats) where every transaction's `SUM(credits) - SUM(debits) == 0` is enforced atomically.
- B) Store user balances as IEEE-754 `DOUBLE PRECISION` columns updated in place via `UPDATE accounts SET balance = balance + 19.99` without ledger rows.
- C) Split extreme hot accounts (e.g., the platform settlement/fee escrow account receiving 25k credits/sec) into **sharded sub-accounts** (e.g., 64 sub-ledger accounts selected by `hash(tx_id) % 64`) so concurrent transfers lock distinct sub-account rows without serializing on one global escrow row.
- D) Perform balance checks and updates inside Redis `INCRBYFLOAT` only, syncing asynchronously to SQL once per night.

<details><summary>Answer</summary>

**A, C.** Immutable double-entry integer ledgers prevent binary floating-point rounding drift (`0.1 + 0.2 != 0.3`) and yield full auditability, while sharding hot system escrow/fee accounts across $K$ sub-accounts eliminates single-row lock serialization during high-TPS checkouts.

- Why not B: In-place float updates lose audit trails and accumulate binary floating-point rounding errors across currency operations.
- Why not D: Asynchronous nightly sync from volatile Redis risks losing committed financial transfers on node crashes and still suffers `INCRBYFLOAT` precision drift.
- Ref: [modules/10-contention-inventory-and-financial-correctness.md](../modules/10-contention-inventory-and-financial-correctness.md), [modules/14-canonical-designs-transactional-and-staff.md](../modules/14-canonical-designs-transactional-and-staff.md), https://www.postgresql.org/docs/current/explicit-locking.html

</details>

### Q-SD-048 · Specialized Indexing, Contention & Financial Correctness · difficulty 2 · single

A video platform must ingest 20 GB raw 4K files from mobile and web creators over flaky networks without routing gigabytes of binary streams through application API pods. Which upload architecture meets durability, resumability, and security bounds?

- A) Stream all 20 GB through a single `POST /upload` API pod buffered in memory before writing to PostgreSQL `BYTEA`.
- B) Issue **short-lived, scoped presigned multipart upload URLs** directly to object storage (S3/GCS), allowing clients to upload 10–100 MB chunks in parallel with per-part **MD5/SHA-256 checksums**, resume failed parts via `ETag` state tracking, and commit the object via an API completion endpoint (verified by object storage event notifications).
- C) Base64-encode the 20 GB video inside a JSON WebSocket message to the CDN edge PoP.
- D) Grant every mobile client static root AWS IAM credentials so it can call `PutObject` on any bucket directly.

<details><summary>Answer</summary>

**B.** Direct-to-object-store multipart presigned URLs bypass API server bandwidth/memory bottlenecks, survive mobile network drops by retrying only failed 10–100 MB parts, and enforce content integrity and least-privilege time-bound authorization.

- Why not A: Buffering 20 GB uploads in API pods causes OOM crashes, saturates ingress NICs, and forces full restarts on any network drop.
- Why not C: Base64 adds 33% bandwidth overhead and cannot stream 20 GB stably over a single stateful WebSocket without chunk-level resume.
- Why not D: Embedding static root IAM credentials inside client binaries leaks full bucket ownership to any attacker who decompiles the app.
- Ref: [modules/09-search-geospatial-and-specialized-components.md](../modules/09-search-geospatial-and-specialized-components.md), https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html

</details>

### Q-SD-049 · Specialized Indexing, Contention & Financial Correctness · difficulty 3 · scenario

A search autocomplete (typeahead) service must return the Top-10 ranked query completions in under 30 ms p99 at 120,000 QPS. Querying PostgreSQL `WHERE query LIKE 'sys%' ORDER BY weight DESC LIMIT 10` collapses under read CPU, while a naive single-node in-memory Trie hits memory and hot-prefix (`"a"`, `"t"`, `"how"`) CPU limits. Which combination handles both latency and hot prefixes?

- A) Pre-compute **Top-K cached suggestions directly at every Trie prefix node** via offline/streaming weighted aggregation (with exponential time decay so trending queries rise and stale spikes fade), shard the read-only Trie replicas across **prefix-range partitions** while replicating ultra-hot short prefixes (`len <= 2`) globally in CDN/API L1 caches, and apply client keystroke debouncing.
- B) Run `SELECT ... LIKE '%term%'` on 100 PostgreSQL read replicas using unindexed trigram scans on every keystroke.
- C) Store every possible query inside a single Redis key and filter in client JavaScript on page load.
- D) Rebuild the entire global Trie synchronously on the API request thread whenever a user submits a search query.

<details><summary>Answer</summary>

**A.** Caching the pre-sorted Top-K list on each Trie node makes prefix lookup $O(\text{prefix-len})$ instead of traversing millions of descendant leaf nodes per keystroke; replicating/CDN-caching 1–2 character hot prefixes prevents shard hotspots, while async/time-decayed frequency pipelines keep suggestions fresh off the read hot path.

- Why not B: Leading-wildcard or unindexed SQL prefix scans at 120k QPS saturate DB CPU and exceed 30 ms p99 immediately.
- Why not C: Downloading tens of megabytes of global search vocabulary into every browser violates mobile bandwidth and latency bounds.
- Why not D: Mutating a shared Trie synchronously on every search thread causes lock contention and blocks user reads.
- Ref: [modules/09-search-geospatial-and-specialized-components.md](../modules/09-search-geospatial-and-specialized-components.md), [modules/12-canonical-designs-read-heavy-and-content.md](../modules/12-canonical-designs-read-heavy-and-content.md), https://sre.google/sre-book/table-of-contents/

</details>

### Q-SD-050 · Specialized Indexing, Contention & Financial Correctness · difficulty 2 · single

A mobile game needs a real-time global leaderboard for 80 million active players (`updateScore`, `getTop100`, `getPlayerRank`). Using a single Redis `ZSET` (`ZADD` / `ZREVRANK`) initially works well, but eventually hits single-thread CPU limits at 150,000 score updates/sec and consumes ~8 GB on one shard. How can you scale exact or near-exact rank queries cleanly?

- A) Partition players by `hash(player_id)` across 16 Redis shards, fetching the player's `composite_score` from their owning shard (`ZSCORE`) and summing `ZCOUNT shard_i (composite_score +inf` across all 16 shards ($O(S \log N)$), OR partition by **fixed score ranges / buckets** (maintaining per-bucket `ZCARD` counts in $O(1)$ so `getPlayerRank` only queries the player's own score bucket via `ZREVRANK` plus precomputed counts of higher buckets).
- B) Store all 80 million scores in a single JSON array inside Memcached and sort on every request.
- C) Run `ORDER BY score DESC` on an unsharded PostgreSQL table on every game completion.
- D) Use a Bloom filter to store player scores and query `ZREVRANK` in $O(1)$.

<details><summary>Answer</summary>

**A.** Hash-sharding into $S$ independent `ZSET`s scales write throughput $S\times$ (exact global rank cannot sum `ZREVRANK` across shards because `ZREVRANK` returns `nil` on the $S - 1$ shards lacking `player_id`; instead fetch the player's `composite_score` via `ZSCORE` on their owning shard and sum `ZCOUNT shard_i (composite_score +inf` across all $S$ shards, or sample approximately), whereas score-range bucketing keeps `getTop100` on the highest bucket and computes rank by adding higher bucket totals to one local bucket `ZREVRANK`.

- Why not B: Sorting an 80M-element array on every request takes seconds and gigabytes of network transfer.
- Why not C: Unindexed full-table `ORDER BY` at 150k updates/sec saturates PostgreSQL immediately (and even indexed `COUNT(*)` for rank is $O(N)$ over higher rows).
- Why not D: Bloom filters test set membership only and cannot store numeric scores or compute ordered ranks.
- Ref: [modules/09-search-geospatial-and-specialized-components.md](../modules/09-search-geospatial-and-specialized-components.md), https://redis.io/docs/latest/data-types/sorted-sets/

</details>

### Q-SD-051 · Specialized Indexing, Contention & Financial Correctness · difficulty 3 · single

An ad-tech streaming aggregator must track the **Top-100 heavy-hitter ad IDs** across 5 billion daily events spanning 200 million distinct `ad_id`s, inside a strict 64 MB per-worker RAM budget. Why does pairing a **Count-Min Sketch (CMS)** with a **size-100 Min-Heap** solve this without OOMs, and what exact error property must downstream billing understand?

- A) CMS underestimates frequent keys randomly, so billing must multiply CMS counts by 1.2×.
- B) CMS hashes each `ad_id` across $d$ rows of width $w$ counters in fixed $O(w \cdot d)$ memory (only a few MBs), returning the minimum across the $d$ rows; this guarantees **strictly one-sided error**—CMS **never underestimates** true frequency and only occasionally overestimates due to hash collisions—making it ideal for fast approximate Top-K dashboards, while exact advertiser billing still requires durable lossless aggregation (e.g., partitioned Kafka + batch/streaming RocksDB rollup).
- C) CMS stores every distinct 200 million `ad_id` string inside a balanced binary search tree in 64 MB.
- D) HyperLogLog paired with a Bloom filter tracks exact per-ad click frequencies in 64 MB.

<details><summary>Answer</summary>

**B.** A Count-Min Sketch increments $d$ independent hash buckets per event and estimates $\hat{f}(x) = \min_i C[i, h_i(x)] \ge f(x)$: collisions can only add positive counts, never subtract, giving deterministic fixed memory and bounded overestimation ($\varepsilon N$ with probability $1 - \delta$)—perfect for real-time Top-K approximation, but unsuited as the sole source of truth for invoice billing.

- Why not A: CMS never underestimates non-negative increments (unless counters overflow); its error is strictly upward overestimation.
- Why not C: 200M distinct IDs + tree pointers require many gigabytes of RAM, violating the 64 MB budget.
- Why not D: HyperLogLog estimates _distinct_ cardinality (not per-key frequencies), and Bloom filters store 1-bit membership only.
- Ref: [modules/09-search-geospatial-and-specialized-components.md](../modules/09-search-geospatial-and-specialized-components.md), [modules/13-canonical-designs-realtime-geo-and-streams.md](../modules/13-canonical-designs-realtime-geo-and-streams.md), https://en.wikipedia.org/wiki/Count%E2%80%93min_sketch

</details>

### Q-SD-052 · Specialized Indexing, Contention & Financial Correctness · difficulty 3 · ordering

In a payment platform backed by double-entry accounting and an asynchronous PSP webhook pipeline, which state-transition sequence prevents orphan charges, premature inventory release, and duplicate ledger entries under retries?

- A) Call external PSP -> if HTTP 200, insert user order -> return success without persisting an idempotency record.
- B) Persist idempotency record (`IN_PROGRESS`) + acquire `HELD` inventory + insert `PENDING` double-entry ledger transfer -> invoke PSP with deterministic `Idempotency-Key` -> on `200 OK` (or `RECONCILING` on timeout followed by webhook/status verification), atomically transition payment & inventory to `CONFIRMED` and append final `SETTLED`/reversal entries idempotently.
- C) Mark inventory `SOLD` -> delete double-entry debit rows -> call PSP without idempotency key -> refund via cron if PSP fails.
- D) Publish `OrderConfirmed` to Kafka before calling the PSP, then let consumers charge the customer's card asynchronously without a ledger state machine.

<details><summary>Answer</summary>

**B.** Recording local durable intent (`IN_PROGRESS` idempotency row + `PENDING` ledger hold) _before_ making the irreversible external PSP network call ensures that process crashes or timeouts never lose track of an in-flight payment, while idempotent state transitions prevent duplicate webhooks from double-settling or double-crediting.

- Why not A: Crashing after PSP HTTP 200 but before inserting the local order steals the user's money with no recorded order.
- Why not C: Deleting ledger rows destroys accounting auditability, and omitting idempotency keys causes double charges on network retries.
- Why not D: Emitting `OrderConfirmed` before verifying payment funds ships unpaid goods when cards decline.
- Ref: [modules/10-contention-inventory-and-financial-correctness.md](../modules/10-contention-inventory-and-financial-correctness.md), https://stripe.com/blog/idempotency

</details>

---

## Domain 6: Observability, SLO Math & Disaster Recovery (`Q-SD-053`–`Q-SD-060`)

### Q-SD-053 · Observability, SLO Math & Disaster Recovery · difficulty 3 · scenario

Your checkout service commits to a **99.9% monthly (30-day) availability SLO** (error budget = `0.1%`, i.e., **43.2 minutes** of full outage equivalent). Following the **Google SRE Workbook (Ch. 5, Multi-Window, Multi-Burn-Rate Alerting)**, why do you configure a **14.4× burn-rate** page alert over a **1-hour long window AND a 5-minute short window**, rather than alerting on a single 5-minute error-rate threshold?

- A) A single 5-minute threshold pages endlessly on brief transient 20-second blips and fails to clear promptly after recovery; requiring **both** a 1-hour window (consuming 2% of the 30-day error budget: $14.4 \times 0.1\% \times (1 / 720) = 2\%$) **and** a 5-minute short window ($1/12$ of the long window) at `14.4×` burn rate (`1.44%` error rate) ensures rapid detection of sustained severe outages while clearing within 5 minutes once resolved, paired with slower `6×` (`6h/30m`) and `1×` (`3d/6h`) ticket tiers.
- B) `14.4×` burn rate means 14.4% of requests are failing; it fires only after 100% of the monthly error budget is exhausted.
- C) The 5-minute short window intentionally delays paging by 6 hours to save on-call engineer sleep.
- D) Burn-rate alerting works only when availability SLOs are set to 100.0%.

<details><summary>Answer</summary>

**A.** Google SRE Workbook Ch. 5 derives multi-window burn-rate pairs to balance detection speed, precision, and reset time: $14.4\times$ burn over 1 hour consumes $14.4 / 720 = 2\%$ of a 30-day budget (meaning full exhaustion in $720 / 14.4 = 50\text{ hours}$), while gating on the $1/12$ short window (`5m`) prevents paging long after an incident has already healed.

- Why not B: For a 99.9% SLO ($0.1\%$ error budget), a $14.4\times$ burn rate corresponds to a $1.44\%$ error rate (not $14.4\%$), and catches the issue at 2% budget burn rather than waiting for 100% exhaustion.
- Why not C: The `5m` short window evaluates the most recent 5 minutes to ensure the outage is _still active right now_ (resetting quickly), not to delay detection by 6 hours.
- Why not D: A 100.0% SLO has zero error budget ($0$ allowed errors), making burn-rate ratios mathematically undefined ($\div 0$).
- Ref: [modules/11-reliability-slos-observability-and-dr.md](../modules/11-reliability-slos-observability-and-dr.md), https://sre.google/workbook/alerting-on-slos/

</details>

### Q-SD-054 · Observability, SLO Math & Disaster Recovery · difficulty 3 · single

A fleet of 100 API servers exports per-host `p99_latency_ms` gauges. A dashboard computes `AVG(p99_latency_ms)` across the 100 hosts and shows a healthy 85 ms, even though user monitoring reports fleet-wide p99 latency spiked past 900 ms because 5 hosts (receiving 15% of total traffic) are degraded at 2,500 ms. Why is averaging per-host percentiles mathematically invalid, and how do you compute true fleet-wide percentiles?

- A) Percentiles are **non-linear order statistics** (you cannot average quantiles across unequal or skewed host distributions); instead, emit **raw histogram bucket counts** (Prometheus native/exponential histograms or HDRHistograms), sum the bucket counts across all 100 hosts (`sum by (le) (rate(http_request_duration_seconds_bucket[5m]))`), and compute `histogram_quantile(0.99, ...)` over the merged distribution.
- B) Averaging percentiles fails only because `AVG()` uses `float32` instead of `float64`; replacing `AVG` with `MEDIAN(p99_latency_ms)` yields the exact global p99.
- C) Taking `MAX(p99_latency_ms)` across 100 hosts equals the exact global p99 regardless of traffic distribution.
- D) Summing the `p99` values across 100 hosts and dividing by 99 fixes the skew.

<details><summary>Answer</summary>

**A.** Neither `AVG(p99)` nor `MEDIAN(p99)` nor `MAX(p99)` equals the true population 99th percentile across unevenly loaded or differently distributed shards; only **mergeable summaries** (cumulative histogram bucket counters, DDSketch, or T-Digest) can be summed across instances before evaluating the 0.99 quantile.

- Why not B: The median of per-host p99s completely ignores the slowest 49% of hosts, severely under-reporting tail latency when a subset of nodes degrades.
- Why not C: `MAX(p99)` across 100 hosts can vastly overestimate global p99 if a single canary host handling 0.01% of traffic hits a slow spike.
- Why not D: Dividing the sum of 100 percentiles by 99 has no statistical relation to the global 99th percentile.
- Ref: [modules/11-reliability-slos-observability-and-dr.md](../modules/11-reliability-slos-observability-and-dr.md), https://prometheus.io/docs/practices/histograms/

</details>

### Q-SD-055 · Observability, SLO Math & Disaster Recovery · difficulty 3 · scenario

An engineer configures the Kubernetes readiness probe (`/readyz`) of 200 stateless API pods to execute `SELECT 1` against the primary PostgreSQL database and `PING` Redis. During a brief 4-second primary DB failover blip, all 200 API pods fail `/readyz`, causing the load balancer and Kubernetes Endpoints controller to simultaneously pull **all 200 pods out of service**—leaving the entire platform unreachable for 12 minutes even after PostgreSQL recovers in 4 seconds (due to LB re-registration storms and cold caches). What architectural rule was violated?

- A) `/readyz` should return `500` on liveness failures too so Kubernetes `SIGKILL`s all 200 pods immediately.
- B) **Deep health checks on shared dependencies create correlated cascading fleet ejections**: when a shared DB fails, marking every stateless API pod "unready" cannot route traffic to a "better" pod because all pods share the same dependency! Keep `/livez` strictly local (process event-loop responsiveness), isolate dependency checks from fleet-wide LB ejection (prefer **circuit breakers + graceful/cached degradation** for non-critical paths and **static stability**), so the fleet remains attached and recovers instantly once the DB finishes failing over.
- C) Load balancers require at least a 500 ms SQL join inside `/readyz` to verify database index integrity.
- D) Kubernetes should never run more than 1 pod per service so readiness checks cannot correlate across multiple pods.

<details><summary>Answer</summary>

**B.** As emphasized in the AWS Builders' Library (_Implementing health checks_), readiness checks should verify _local pod health_ (can this instance serve traffic compared to its peers?), not shared downstream databases; deep dependency health checks turn a transient 4-second DB failover into a total fleet blackout and recovery stampede.

- Why not A: Killing all 200 pods via liveness failure triggers a massive container restart, TLS/JVM/V8 cold-start, and DB connection-pool storm on recovery.
- Why not C: Executing expensive SQL joins inside load-balancer health checks wastes DB capacity and amplifies outages.
- Why not D: Running 1 pod creates a single point of failure with zero redundancy or deployment availability.
- Ref: [modules/11-reliability-slos-observability-and-dr.md](../modules/11-reliability-slos-observability-and-dr.md), https://aws.amazon.com/builders-library/implementing-health-checks/

</details>

### Q-SD-056 · Observability, SLO Math & Disaster Recovery · difficulty 2 · single

After deploying a new middleware metric `http_requests_total{method, path, user_id, status}`, the Prometheus monitoring cluster crashes with Out-Of-Memory (OOM) errors within 20 minutes. What caused the TSDB crash, and how do you fix the instrumentation while retaining per-user debugging visibility?

- A) Adding unbounded high-cardinality labels (`user_id` and raw unnormalized `path` like `/orders/981723`) creates millions of distinct active time series (`M × N` combinatorial explosion) inside Prometheus's in-memory head block; restrict metric labels strictly to **low-cardinality bounded dimensions** (`route_template="/orders/:id"`, `status_class="5xx"`), and push `user_id` / `request_id` into **structured logs and distributed trace spans** (or Exemplars).
- B) Prometheus crashes whenever metric names contain underscores (`_`); renaming to camelCase resolves TSDB memory pressure.
- C) Setting `scrape_interval: 1s` compresses label combinations automatically in memory.
- D) Converting the Prometheus `Counter` into a `Gauge` drops all label values and uses zero RAM.

<details><summary>Answer</summary>

**A.** Every unique combination of metric label values instantiates a separate time series index entry and sample chunk buffer in TSDB memory; high-cardinality identifiers (`user_id`, `trace_id`, raw URLs) belong in logs, traces, and metric exemplars, never in Prometheus label sets.

- Why not B: Snake_case metric names are the official Prometheus naming standard; underscores do not cause OOMs.
- Why not C: Faster scrape intervals increase sample ingestion rate without reducing unique label-set cardinality.
- Why not D: Metric type (`Gauge` vs `Counter`) does not eliminate active time-series index overhead caused by high-cardinality labels.
- Ref: [modules/11-reliability-slos-observability-and-dr.md](../modules/11-reliability-slos-observability-and-dr.md), https://prometheus.io/docs/practices/naming/

</details>

### Q-SD-057 · Observability, SLO Math & Disaster Recovery · difficulty 3 · scenario

An active-passive multi-region database runs in `us-east-1` (primary) with an asynchronous streaming replica in `us-west-2` (typical lag 120 ms). An engineer writes a cron script in `us-west-2` that automatically promotes the `us-west-2` replica to primary whenever `us-west-2` fails three `PING` checks to `us-east-1`. During a brief transatlantic/backbone network partition where `us-east-1` is actually **still healthy and serving local traffic**, what catastrophic failure occurs, and how must DR failover avoid it?

- A) Read-only `SELECT` queries fail in both regions until NTP synchronizes.
- B) **Split-brain dual-primary divergence**: both `us-east-1` and the newly promoted `us-west-2` accept divergent writes simultaneously, causing unresolvable primary-key collisions and silent data loss when connectivity returns (non-zero RPO); prevent split-brain via **externally arbitrated quorum / fencing** (e.g., witness in a 3rd region / Raft consensus / control-plane STONITH fencing that demotes/blocks the old primary before promotion) or operator-gated failover with explicit RPO vs RTO policy, plus **static stability** (pre-provisioned regional capacity so failover doesn't depend on control planes).
- C) Automatic promotion guarantees RPO = 0 as long as replication uses TCP instead of UDP.
- D) DNS propagation instantly freezes all in-flight writes in `us-east-1` within 1 millisecond.

<details><summary>Answer</summary>

**B.** An uncoordinated two-region health checker cannot distinguish "primary dead" from "network partition between us"; automatic promotion without quorum/fencing guarantees dual-primary split-brain under partitions, whereas a 3-AZ/3-region consensus quorum (or fenced human/witness approval) + pre-warmed static-stability capacity guarantees safe failover.

- Why not A: Read queries do not fail just because NTP drifts slightly during a partition.
- Why not C: Asynchronous replication always has non-zero data loss (`RPO > 0`) on abrupt primary isolation regardless of TCP vs UDP.
- Why not D: DNS TTL caching keeps clients writing to `us-east-1` for minutes or hours; DNS provides zero transactional fencing.
- Ref: [modules/11-reliability-slos-observability-and-dr.md](../modules/11-reliability-slos-observability-and-dr.md), https://aws.amazon.com/builders-library/availability-with-redundancy/

</details>

### Q-SD-058 · Observability, SLO Math & Disaster Recovery · difficulty 1 · single

Compare the 30-day (43,200-minute) downtime error budgets of a **99.95%** availability SLO versus a **99.99%** ("four nines") availability SLO, and explain why SLO targets should almost never be set to **100%**.

- A) 99.95% allows ~21.6 minutes and 99.99% allows ~4.32 minutes per 30 days; a 100% SLO leaves **zero error budget**, which paralyzes feature releases, blocks necessary infrastructure/security migrations, forces prohibitively expensive multi-region synchronous architectures, and still gets violated by upstream ISP/client failures outside your control.
- B) 99.95% allows 4.32 hours and 99.99% allows 43.2 minutes per 30 days; 100% SLOs are only banned by PCI-DSS.
- C) 99.95% and 99.99% have identical error budgets when measured over rolling 7-day windows.
- D) Setting a 100% SLO automatically forces Kubernetes to achieve zero downtime during node upgrades.

<details><summary>Answer</summary>

**A.** $43{,}200 \times 0.0005 = 21.6\text{ min}$ and $43{,}200 \times 0.0001 = 4.32\text{ min}$; per Google SRE principles, the error budget is the explicit engineering currency balancing reliability against velocity—100% targets leave zero budget for safe experimentation or routine operations and are physically unrealizable.

- Why not B: Both time calculations are off by an order of magnitude (hours vs minutes).
- Why not C: 99.99% is 5× stricter than 99.95% regardless of window length.
- Why not D: An SLO target is a measurement/governance policy, not a runtime feature that eliminates hardware or upgrade faults.
- Ref: [modules/11-reliability-slos-observability-and-dr.md](../modules/11-reliability-slos-observability-and-dr.md), https://sre.google/sre-book/embracing-risk/

</details>

### Q-SD-059 · Observability, SLO Math & Disaster Recovery · difficulty 3 · multi

A team runs automated canary deployments: shifting 1% of production traffic to a new release for 5 minutes and checking `error_rate < 0.5%` before rolling out to 100%. Twice in one month, canaries passed cleanly yet caused severe production outages at 100% rollout—once from a slow memory leak, and once from a rare bug affecting a specific enterprise tenant (`500` errors buried below statistical significance at 1% traffic). Which **two** rollout safeguards close these blind spots?

- A) Decouple **code deployment from feature release** using progressive feature flags (ring/tenant allowlists + dynamic kill switches) and run extended soak windows (e.g., 1–4 hours on a representative slice) to expose monotonic heap/file-descriptor leaks and GC slope degradation before global rollout.
- B) Track **per-cohort / per-tenant SLIs and resource-slope metrics** (RSS memory trend, DB query plan regressions, p99 tail) rather than relying solely on a 5-minute aggregate mean error threshold where 1% traffic lacks statistical power for rare paths.
- C) Shorten the canary window from 5 minutes to 15 seconds so bad builds spend less time in production.
- D) Disable health checks and alerts during rollouts so canaries never trigger false rollbacks.

<details><summary>Answer</summary>

**A, B.** Short 5-minute 1% canaries miss slow resource leaks (which take tens of minutes to hours to cross OOM bounds) and dilute low-volume path regressions below global alert thresholds; combining feature flags, soak duration, resource-trend checks, and cohort-sliced telemetry detects both before 100% blast radius.

- Why not C: Shrinking the canary window to 15 seconds makes memory-leak and low-volume path detection even worse.
- Why not D: Silencing alerts during deployments guarantees silent production outages.
- Ref: [modules/11-reliability-slos-observability-and-dr.md](../modules/11-reliability-slos-observability-and-dr.md), https://sre.google/workbook/canarying-releases/

</details>

### Q-SD-060 · Observability, SLO Math & Disaster Recovery · difficulty 3 · scenario

At 100,000 RPS across 15 microservices, storing 100% of OpenTelemetry distributed traces costs \$80,000/month. When the team turns on **1% head-based uniform random sampling** at the API gateway, SREs discover that 99% of rare `HTTP 500` checkout failures and p99.9 tail outliers are missing from the trace backend during incident triage! How does **tail-based sampling** solve this, and what architectural cost does it introduce?

- A) Head-based sampling freezes `trace_id` hashing inside the client browser, whereas tail-based sampling forces every microservice to write synchronously to S3 before replying.
- B) **Tail-based sampling** routes all spans sharing a `trace_id` (via consistent hashing on `trace_id`) to stateful OpenTelemetry Collector nodes that **buffer completed spans in memory for a short window (e.g., 10–30 s)** and decide _after_ the trace completes—retaining **100% of error traces and high-latency outliers** while sampling healthy fast traces at 1%, at the trade-off of higher collector RAM, consistent-hash routing, and ingestion network bandwidth.
- C) Tail-based sampling deletes all `HTTP 200` logs from local disks automatically with zero collector memory overhead.
- D) Changing 1% head-based sampling to 1% client-IP hash sampling captures 100% of rare `HTTP 500`s.

<details><summary>Answer</summary>

**B.** Head-based sampling must choose `keep/drop` at ingress before knowing whether a downstream service will throw a 500 or stall for 4 seconds; tail-based sampling defers the sampling decision until spans converge at `trace_id`-sharded collectors, preserving every failure and slow outlier at the cost of transient collector buffering and span ingestion bandwidth.

- Why not A: Tail-based sampling uses asynchronous collector memory buffers, not synchronous S3 writes on the request hot path.
- Why not C: Buffering all traces briefly until trace completion requires substantial collector RAM and network ingress compared to early head-drop.
- Why not D: Hashing on client IP still drops 99% of users and misses systemic errors affecting the unsampled 99%.
- Ref: [modules/11-reliability-slos-observability-and-dr.md](../modules/11-reliability-slos-observability-and-dr.md), https://opentelemetry.io/docs/concepts/sampling/

</details>

---

## Domain 7: End-to-End Canonical Architectures & Staff Deep Dives (`Q-SD-061`–`Q-SD-070`)

### Q-SD-061 · End-to-End Canonical Architectures & Staff Deep Dives · difficulty 3 · scenario

You are designing a multi-tenant LLM inference serving tier (like ChatGPT / vLLM). Under high concurrency with mixed prompt lengths (500 to 16,000 tokens), naive static batching wastes 65% of GPU VRAM on pre-allocated contiguous KV-cache buffers and stalls fast requests behind long completions. How do **PagedAttention**, **continuous (iteration-level) batching**, and **prefill-decode disaggregation** transform GPU utilization and latency SLOs (TTFT vs ITL)?

- A) Static batching keeps GPUs idle waiting for the longest sequence in a batch to emit `EOS`, while contiguous KV allocation suffers internal/external fragmentation; **continuous batching** inserts new requests and evicts finished ones at _every_ decode token step, **PagedAttention** splits KV cache into fixed-size non-contiguous virtual blocks (eliminating ~60–80% VRAM waste and enabling copy-on-write system-prompt prefix sharing), and **disaggregating compute-bound Prefill (TTFT)** from **memory-bandwidth-bound Decode (ITL/TPOT)** stops incoming long prompts from spiking decode latency for active streaming users.
- B) PagedAttention swaps model weights to S3 between every generated token so 70B models run inside 4 GB VRAM at 1,000 tokens/sec.
- C) Continuous batching combines multiple users' prompts into one shared attention mask so tokens attend across different tenants' private conversations.
- D) Prefill is strictly memory-bandwidth-bound while single-token Decode is compute-bound, so running both on the same GPU reduces TTFT interference.

<details><summary>Answer</summary>

**A.** As proven in Kwon et al. (vLLM / PagedAttention, SOSP 2023) and modern disaggregated serving (Splitwise/DistServe), paging KV blocks into non-contiguous GPU memory eliminates max-length pre-allocation waste and shares common system-prompt prefixes zero-copy; iteration-level continuous batching eliminates tail waiting, and separating compute-heavy prefill nodes from bandwidth-bound decode nodes protects interactive token-streaming ITL (inter-token latency) from prefill spikes.

- Why not B: Fetching tens of gigabytes of weights from S3 per token would destroy throughput by 6+ orders of magnitude.
- Why not C: Continuous batching batches token projections/GEMMs across independent requests while maintaining strictly isolated per-request attention masks and KV block tables.
- Why not D: It is the exact opposite—prefill processes $N$ prompt tokens in parallel (compute/FLOP-bound), whereas autoregressive decode processes 1 token per sequence per step while streaming huge model weights + KV cache from HBM (memory-bandwidth-bound).
- Ref: [modules/14-canonical-designs-transactional-and-staff.md](../modules/14-canonical-designs-transactional-and-staff.md), https://arxiv.org/abs/2309.06180

</details>

### Q-SD-062 · End-to-End Canonical Architectures & Staff Deep Dives · difficulty 3 · scenario

A financial stock exchange matching engine must process 500,000 limit/market orders per second per symbol with deterministic sub-100 microsecond matching latency and strict price-time priority. Why does a Staff architect reject running cross-datacenter Raft/Paxos _inside_ the matching loop or locking rows in PostgreSQL, and what architecture achieves both sub-100 µs latency and zero lost committed orders?

- A) Use a **totally ordered redundant Sequencer** + **single-threaded deterministic in-memory Matching Engine** (e.g., LMAX Disruptor lock-free ring buffer pinned to isolated CPU cores, avoiding mutexes, GC pauses, and cache-line false sharing) backed by fast quorum replication of the **input command log** (before or in parallel with deterministic execution) and periodic snapshots so a hot standby replays the exact identical order stream deterministically.
- B) Execute `BEGIN ISOLATION LEVEL SERIALIZABLE; UPDATE order_book ...; COMMIT;` in PostgreSQL over cross-region synchronous replication on every incoming FIX message.
- C) Shard the same ticker symbol `AAPL` across 16 concurrent threads using fine-grained mutex locks on each price tick level.
- D) Process orders in arbitrary arrival order across 50 stateless Kubernetes pods and reconcile price-time priority conflicts every evening.

<details><summary>Answer</summary>

**A.** By LMAX Disruptor / deterministic state-machine replication principles, a single pinned thread executing pure deterministic business logic in L1/L2 CPU cache achieves millions of operations/sec without lock contention or context switches; replicating the totally ordered input sequencer log (rather than synchronous multi-round DB locks inside the book engine) preserves deterministic failover and price-time fairness.

- Why not B: Cross-region SQL `SERIALIZABLE` transactions take tens of milliseconds per round trip—1,000× slower than the 100 µs budget.
- Why not C: Lock acquisition, contention, and false cache-line sharing across 16 threads on a hot symbol's top-of-book destroy tail latency and risk lock-order deadlocks.
- Why not D: Exchanges legally enforce strict price-time priority; unsequenced stateless processing violates regulatory fairness and creates crossed/locked books.
- Ref: [modules/14-canonical-designs-transactional-and-staff.md](../modules/14-canonical-designs-transactional-and-staff.md), https://lmax-exchange.github.io/disruptor/

</details>

### Q-SD-063 · End-to-End Canonical Architectures & Staff Deep Dives · difficulty 3 · scenario

When architecting a real-time collaborative editor like Google Docs (supporting 100 concurrent editors on one document and offline mobile edits), compare **Operational Transformation (OT)** against **Conflict-Free Replicated Data Types (CRDTs, e.g., RGA / Yjs)**. Which engineering trade-off determines the right choice?

- A) OT requires zero server coordination and is mathematically proven commutative peer-to-peer without transformation properties, whereas CRDTs require a central master server to transform character offsets.
- B) **OT** uses compact integer index operations (`insert(pos, char)`) with low metadata overhead, **but requires a single authoritative central server** (or total operation order) because decentralized OT transformation functions break convergence (`TP2` diamond puzzles) under arbitrary concurrent forks; **CRDTs** embed globally unique immutable character IDs + causal links to achieve **Strong Eventual Consistency peer-to-peer/offline** without a central sequencer, at the trade-off of **tombstone memory overhead** for deleted characters (mitigated via causal-stability GC / snapshot compaction).
- C) CRDTs require running distributed two-phase commit (`2PC`) over WebSockets on every keystroke.
- D) Both OT and CRDTs corrupt documents permanently if two users type at index `0` while offline unless pessimistic row locks freeze typing.

<details><summary>Answer</summary>

**B.** Classic Google Docs OT relies on a central server to serialize and transform operations deterministically into a canonical linear history, keeping document state minimal; modern local-first/P2P engines (Figma-style property LWW / Yjs / Automerge sequence CRDTs) guarantee convergence without a central lock by carrying causal/fractional IDs and tombstones (compacted periodically once peers advance).

- Why not A: It reverses the two models—OT needs central serialization to avoid TP2 complexity, while CRDTs are designed specifically for decentralized convergence.
- Why not C: CRDTs are specifically _coordination-free_ (no 2PC on keystrokes).
- Why not D: Resolving concurrent edits at identical offsets cleanly without pessimistic locks is the exact problem both OT and CRDTs solve.
- Ref: [modules/14-canonical-designs-transactional-and-staff.md](../modules/14-canonical-designs-transactional-and-staff.md), https://hal.inria.fr/inria-00555588/

</details>

### Q-SD-064 · End-to-End Canonical Architectures & Staff Deep Dives · difficulty 3 · scenario

Synthesize an end-to-end architecture for a global **Ticketmaster-scale flash-sale ticketing platform** (50,000 stadium seats, 10M peak fans arriving at 10:00:00, strict zero-oversell and zero-double-charge invariants). Which end-to-end data flow prevents database collapse while preserving fairness and financial correctness?

- A) Route all 10M fans directly to PostgreSQL `SELECT * FROM seats` via 500 API pods with `pool_size = 500`, retrying PSP charges automatically with fresh UUIDs on 504 timeouts.
- B) Place an **Edge Virtual Waiting Room** (CDN/edge queue issuing signed admission tokens at a controlled rate matching checkout capacity) + **read-only CDN/Redis seat-map snapshots** (refreshed every 1–2s, tolerating slight staleness for browsing) -> admitted buyers execute an **atomic TTL seat hold** (Redis Lua / sharded DB `UPDATE ... WHERE status = 'AVAILABLE' AND version = $v`) -> checkout runs an **idempotent PSP + double-entry ledger saga** (`PENDING_RECONCILIATION` on ambiguous PSP timeouts, never freeing seats until PSP status resolves or hold expires safely).
- C) Shard each seat into Kafka and let eventual-consistency consumers pick winners asynchronously 20 minutes after taking everyone's credit card payment.
- D) Cache `POST /checkout` responses in the CDN Origin Shield for 60 seconds so repeated clicks reuse the first buyer's ticket.

<details><summary>Answer</summary>

**B.** Separating massive read/queue load (Edge Virtual Waiting Room + cached seat-map view) from scarce transactional inventory writes ensures only thousands of admitted checkout flows reach the OLTP database per second, while atomic conditional CAS holds + TTL leases + idempotent `PENDING_RECONCILIATION` payment handling guarantee zero overselling and zero double-charging.

- Why not A: 250,000 DB connections will instantly melt PostgreSQL, and fresh UUIDs on PSP timeouts double-charge fans.
- Why not C: Charging millions of fans upfront before resolving contention forces massive refund fees, chargebacks, and terrible UX.
- Why not D: Caching `POST /checkout` across users leaks private tickets and sells one seat to multiple buyers.
- Ref: [modules/14-canonical-designs-transactional-and-staff.md](../modules/14-canonical-designs-transactional-and-staff.md), [modules/10-contention-inventory-and-financial-correctness.md](../modules/10-contention-inventory-and-financial-correctness.md), https://stripe.com/blog/idempotency

</details>

### Q-SD-065 · End-to-End Canonical Architectures & Staff Deep Dives · difficulty 3 · scenario

In a **WhatsApp-scale global E2EE messaging system** (100B messages/day, 1-on-1 chats + 500-member groups, offline delivery, and per-chat message ordering), which architectural design cleanly handles connection fan-out, offline store-and-forward, causal ordering, and group E2EE overhead?

- A) Stateless HTTP polling every 500 ms + storing all chat histories unencrypted in a single global PostgreSQL instance + pairwise Signal encryptions for every message in 500-member groups (500× client upload fan-out).
- B) Stateful **Connection Gateways** holding persistent WebSocket/TCP connections (`epoll`/`kqueue`, mapped via a lightweight Presence/Session lookup service) + **server-assigned monotonic sequence IDs per chat** (`chat_id` partition key) for consistent conversation ordering + **ephemeral offline inbox store-and-forward** (messages deleted once client ACKs receipt) + **Signal Sender Keys** for large groups (encrypting the payload once with a symmetric chain key distributed pairwise only on membership change, then fanning out ciphertext server-side).
- C) Peer-to-peer UDP hole punching between mobile phones without any server store-and-forward inbox.
- D) Relying on each sender's mobile wall-clock timestamp as the sole global ordering key across all group participants.

<details><summary>Answer</summary>

**B.** Persistent Connection Gateways decouple millions of open sockets from stateless routing/storage workers; per-conversation monotonic sequence numbers resolve concurrent clock skew; ephemeral store-and-forward queues preserve privacy/low storage by deleting delivered messages on ACK; and Signal Sender Keys turn $O(G)$ client-side asymmetric encryption fan-out into $O(1)$ encryption + server fan-out.

- Why not A: 500 ms HTTP polling drains mobile batteries and explodes QPS, while pairwise encryption for 500+ member groups inflates mobile upload bandwidth 500×.
- Why not C: Mobile devices behind carrier-grade NAT frequently sleep or go offline, making pure P2P impossible for reliable async delivery.
- Why not D: Mobile client clocks can drift or be spoofed by hours/days, breaking conversational ordering.
- Ref: [modules/13-canonical-designs-realtime-geo-and-streams.md](../modules/13-canonical-designs-realtime-geo-and-streams.md), https://signal.org/docs/

</details>

### Q-SD-066 · End-to-End Canonical Architectures & Staff Deep Dives · difficulty 3 · scenario

You are designing a **YouTube / Netflix-scale video streaming platform** serving 1 billion hours/day across heterogeneous mobile and 4K TV clients. Which combination of ingestion, encoding, and delivery mechanics minimizes buffering stalls and multi-petabyte egress costs?

- A) Transcode uploaded videos as one monolithic 4K MP4 file synchronously during the HTTP upload request, and serve byte ranges directly from origin object storage without CDN caching.
- B) Split uploaded masters into **GOP-aligned short chunks (e.g., 2–6 s)** processed in parallel via a **DAG transcoding pipeline** into multiple bitrate/codec rungs (AV1/VP9/H.264) -> package manifests for **Adaptive Bitrate streaming (HLS / MPEG-DASH)** so players switch quality seamlessly mid-playback -> deliver via **tiered CDN + ISP-embedded edge caches** (storing top ~5% viral/popular catalog on NVMe edge nodes while serving long-tail videos from origin shields / erasure-coded origin storage).
- C) Stream raw uncompressed YUV video frames over WebSockets from the API tier to each viewer.
- D) Force all mobile clients to download the entire 4 GB movie before playback starts.

<details><summary>Answer</summary>

**B.** Chunked parallel DAG transcoding cuts time-to-publish from hours to minutes; ABR manifests allow players to adapt seamlessly across fluctuating cellular bandwidth; and tiered CDN/ISP-embedded caching keeps ~80–90% of byte traffic off transit links while cold erasure-coded origin stores the long tail economically.

- Why not A: Single-node synchronous 4K transcoding takes hours, hits HTTP timeouts, forces buffering on slower links, and causes ruinous origin egress bills.
- Why not C: Uncompressed 4K YUV requires ~12+ Gbps per viewer, making internet streaming impossible.
- Why not D: Progressive full-file pre-download violates sub-second start-up latency and wastes terabytes when users abandon after 30 seconds.
- Ref: [modules/12-canonical-designs-read-heavy-and-content.md](../modules/12-canonical-designs-read-heavy-and-content.md), https://openconnect.netflix.com/en/

</details>

### Q-SD-067 · End-to-End Canonical Architectures & Staff Deep Dives · difficulty 3 · scenario

In an **Uber-scale real-time dispatch architecture** (1M active drivers emitting GPS pings every 4 seconds = 250,000 location updates/sec, plus concurrent rider match requests), why do architects separate ephemeral driver location state from transactional trip state—and how do they prevent **dual-dispatch** (assigning the same driver simultaneously to two nearby riders)?

- A) Store every 4-second GPS ping as an ACID row update on a single global PostgreSQL `drivers` table with `SERIALIZABLE` isolation, and pick drivers using `ORDER BY SQRT(...)`.
- B) Route high-frequency ephemeral GPS pings into a **region-sharded in-memory geospatial index (H3/S2 cells)** with short TTLs (only persisting downsampled trip breadcrumbs asynchronously to durable storage for billing/safety), and enforce single-driver assignment via an **atomic compare-and-set / conditional lease** (`state: AVAILABLE -> OFFERED` with offer TTL + driver-ID partition lock) inside the Dispatch service so a driver can hold at most one active offer at any instant.
- C) Broadcast every rider's trip request to all 1M drivers globally over WebSockets and accept whichever 5 drivers tap "Accept" first.
- D) Cache nearby driver locations in browser `localStorage` for 10 minutes so the server never tracks driver status transitions.

<details><summary>Answer</summary>

**B.** Treating 250k/sec transient GPS updates as durable OLTP disk writes destroys database IOPS; keeping ephemeral positions in regional H3/S2 RAM shards while enforcing an atomic driver state machine (`AVAILABLE -> OFFERED -> EN_ROUTE`) on the driver's partition prevents race-condition double-dispatch without slowing location ingestion.

- Why not A: 250k/sec ACID row updates + full-table Euclidean distance sorts cannot scale on a single SQL primary.
- Why not C: Broadcasting globally saturates mobile networks and causes furious double-accepts and cancellations.
- Why not D: Drivers move miles in 10 minutes and shift availability every second; stale client-side caches break dispatch completely.
- Ref: [modules/13-canonical-designs-realtime-geo-and-streams.md](../modules/13-canonical-designs-realtime-geo-and-streams.md), [modules/09-search-geospatial-and-specialized-components.md](../modules/09-search-geospatial-and-specialized-components.md), https://www.uber.com/blog/h3/

</details>

### Q-SD-068 · End-to-End Canonical Architectures & Staff Deep Dives · difficulty 2 · single

In a **Dropbox / Google Drive file sync engine**, a user edits a 5-byte typo inside a 2 GB VM disk image or presentation file on their laptop. Why does **content-defined chunking (e.g., FastCDC / Rabin fingerprinting)** drastically outperform fixed-offset 4 MB chunking for delta sync and storage deduplication?

- A) Fixed-offset chunking encrypts files faster on mobile ARM CPUs.
- B) Inserting 5 bytes near the start of a file shifts every subsequent byte offset, invalidating 100% of fixed-size 4 MB chunk hashes after the insertion point (forcing a full 2 GB re-upload!); **content-defined chunking** sets chunk boundaries by hashing a sliding content window, so only the **single edited ~4 MB chunk** changes hash while all trailing chunks retain identical boundaries and content-addressable SHA-256 hashes (achieving ~500× bandwidth & storage savings).
- C) Content-defined chunking eliminates the need for a metadata database because block storage automatically merges concurrent user edits.
- D) Fixed-offset chunking only supports files smaller than 64 MB.

<details><summary>Answer</summary>

**B.** Content-defined chunking (CDC) anchors split boundaries on local byte patterns (`rolling_hash(window) & mask == 0`) rather than absolute file offsets, bounding byte-insertion cascades strictly to the single modified chunk while enabling cross-file and cross-version deduplication in content-addressable block storage.

- Why not A: Fixed-offset slicing has nothing to do with hardware AES encryption speed.
- Why not C: Separating a strongly consistent Metadata DB (file tree, versions, permissions, chunk manifests) from immutable Block Storage is foundational; CDC does not auto-merge arbitrary binary conflicts without metadata versioning.
- Why not D: Fixed-offset chunking works on files of any size; its defect is boundary shift sensitivity on insertions/deletions.
- Ref: [modules/12-canonical-designs-read-heavy-and-content.md](../modules/12-canonical-designs-read-heavy-and-content.md), https://www.usenix.org/conference/atc16/technical-sessions/presentation/xia

</details>

### Q-SD-069 · End-to-End Canonical Architectures & Staff Deep Dives · difficulty 3 · scenario

Contrast two canonical web-scale designs: (1) a **URL Shortener** (`100M new URLs/day`, `10B redirects/day`) tracking click analytics, and (2) a **Distributed Web Crawler** (`10B pages/month`). Which pair of subtle HTTP and distributed-systems pitfalls breaks naive implementations of each?

- A) URL Shortener: returning `HTTP 301` (permanent redirect) causes browsers to cache the destination locally and bypass your servers—breaking real-time click analytics and making destination updates impossible unless you use **`HTTP 302` / `307`**; Web Crawler: naive BFS queues hammer individual domains concurrently and stall on synchronous OS DNS lookups, requiring **per-host politeness queues** (`1` active fetch/domain + `robots.txt` cache) and a **dedicated local caching DNS resolver** + RocksDB/Bloom URL-seen deduplication.
- B) URL Shortener: `HTTP 302` prevents browsers from following redirects; Web Crawler: `robots.txt` is fetched via BGP Anycast instead of HTTP.
- C) URL Shortener: Base62 encoding of an 8-character short code (`62^8`) only holds 10 million unique URLs; Web Crawler: storing 10B URLs in an unsharded Python `set()` fits in 512 MB RAM.
- D) URL Shortener: SHA-256 truncation to 7 chars never collides below 100 billion URLs; Web Crawler: fetching pages randomly from a single global FIFO queue guarantees domain politeness automatically.

<details><summary>Answer</summary>

**A.** `301 Moved Permanently` lets browsers and proxies cache the target URL indefinitely (invisible clicks, hard-to-revoke phishing targets), whereas `302/307` preserves server visibility for analytics; meanwhile, web crawlers live or die on front-queue priority + back-queue per-domain politeness isolation, async local DNS caching (because `getaddrinfo` blocks threads), and disk-backed/Bloom frontier deduplication.

- Why not B: Browsers follow `302`/`307` redirects automatically; `robots.txt` is fetched over standard HTTP/HTTPS.
- Why not C: $62^8 \approx 2.18 \times 10^{14}$ (218 trillion codes, not 10M), and 10B URL strings (~100 bytes each = ~1 TB!) cannot fit inside 512 MB RAM.
- Why not D: By the birthday paradox, 7 Base62 chars ($\approx 3.5 \times 10^{12}$) begin colliding far earlier than $10^{11}$ unless guarded by DB unique constraints/retries, and a single FIFO queue blasts dozens of concurrent threads at a popular domain simultaneously (violating politeness and triggering IP bans).
- Ref: [modules/12-canonical-designs-read-heavy-and-content.md](../modules/12-canonical-designs-read-heavy-and-content.md), https://www.rfc-editor.org/rfc/rfc9110

</details>

### Q-SD-070 · End-to-End Canonical Architectures & Staff Deep Dives · difficulty 3 · multi

When architecting **S3-scale durable object storage** (exabyte capacity, 11 nines of durability) alongside a **high-cardinality Metrics Platform** (10M active time series/sec), which **two** storage-engine techniques reduce raw hardware cost by 2×–10× without sacrificing durability or query speed?

- A) **Object Storage Erasure Coding (e.g., Reed-Solomon 8+4 or 10+4)**: splitting cold/warm immutable object extents into $k$ data shards and $m$ parity shards across independent fault domains achieves 4-node fault tolerance at **1.4×–1.5× storage overhead** instead of 3.0× full replication, decoupled from a Raft/Paxos-backed metadata/placement plane.
- B) **Gorilla Time-Series Compression (Delta-of-Delta timestamps + XOR floating-point values)**: exploiting regular scrape intervals (`dt1 - dt0 == 0` encodes in 1 bit) and slowly changing metric values compresses 16-byte `(timestamp, float64)` samples down to **~1.37 bytes/sample** (>10× RAM/disk reduction) in TSDB memory and block files.
- C) Store every 10 GB object inside a single unsharded SQLite file replicated 11 times synchronously across 11 continents for 11 nines of durability.
- D) Represent all time-series samples as verbose JSON objects inside MongoDB without compression so queries avoid CPU decompression overhead.

<details><summary>Answer</summary>

**A, B.** Reed-Solomon erasure coding cuts exabyte object storage footprint in half relative to 3× replication while tolerating up to $m$ simultaneous rack/disk failures, and Facebook's Gorilla compression (used across Prometheus/VictoriaMetrics/M3) achieves >10× time-series density via delta-of-delta + XOR bit packing.

- Why not C: 11-way cross-continent synchronous SQLite replication collapses write latency and throughput, and "11 nines" (99.999999999%) refers to annual object durability against correlated hardware/bit-rot faults, not 11 literal copies.
- Why not D: Uncompressed JSON time-series samples bloat storage and memory bandwidth >15×, making 10M samples/sec economically unviable.
- Ref: [modules/14-canonical-designs-transactional-and-staff.md](../modules/14-canonical-designs-transactional-and-staff.md), [modules/13-canonical-designs-realtime-geo-and-streams.md](../modules/13-canonical-designs-realtime-geo-and-streams.md), https://www.vldb.org/pvldb/vol8/p1816-teller.pdf

</details>

---

## Domain 8: Progressive Scaling & Case-Study Deep Dives (`Q-SD-071`–`Q-SD-075`)

### Q-SD-071 · Progressive Scaling & Blast-Radius Architecture · difficulty 3 · scenario

A stateless order service is load-tested on $N$ identical nodes. Throughput follows Gunther's Universal Scalability Law, $C(N) = \frac{N}{1 + \alpha(N-1) + \beta N(N-1)}$, with contention $\alpha = 0.05$ and coherency $\beta = 0.005$. Which statement is correct?

- A) Throughput peaks at $N \approx 64$, so adding nodes up to 64 always increases capacity because $\alpha$ and $\beta$ are small.
- B) Throughput peaks near $N_{\max} \approx 13.8$ at about $5.47\times$ single-node throughput; at $N = 64$ the model predicts about $2.63\times$, so scaling out past the peak enters retrograde scaling and lowers total throughput.
- C) Throughput stays linear up to 64 nodes because the USL exhibits retrograde scaling only when $\beta = 0$.
- D) At $N = 64$ throughput is $64\times$ single-node capacity, because $\alpha$ and $\beta$ affect request latency rather than throughput.

<details><summary>Answer</summary>

**B.** The peak occurs at $N_{\max} = \sqrt{(1-\alpha)/\beta} = \sqrt{190} \approx 13.78$, where $C(14) \approx 5.47$; at $N = 64$ the denominator is $1 + 0.05(63) + 0.005(64)(63) = 24.31$, yielding $C(64) \approx 2.63$, less than half the peak throughput.

- Why not A: The peak is near 13.8 nodes, not 64; the quadratic coherency term $\beta N(N-1) = 20.16$ dominates at $N = 64$, driving throughput down.
- Why not C: Retrograde scaling requires $\beta > 0$; setting $\beta = 0$ collapses USL into Amdahl's Law, which approaches an asymptote of $1/\alpha = 20$ without ever regressing.
- Why not D: $C(N) \le N$ always, and $64\times$ requires both $\alpha = 0$ and $\beta = 0$; contention and coherency directly reduce effective throughput.
- Ref: [modules/15-scale-from-zero-to-millions.md](../modules/15-scale-from-zero-to-millions.md#12-gunthers-universal-scalability-law-usl-and-retrograde-scaling), https://www.perfdynamics.com/Manifesto/USLscalability.html

</details>

### Q-SD-072 · Progressive Scaling & Blast-Radius Architecture · difficulty 2 · single

A web tier runs 12 instances across three Availability Zones with sticky sessions that store each authenticated user's session state in local instance memory. One AZ fails abruptly, and autoscaling replaces the lost instances. What is the correct architectural fix?

- A) Keep local sticky sessions because the load balancer reroutes users to surviving instances without dropping session state.
- B) Externalize sessions to a multi-AZ Valkey or Redis cluster keyed by session ID (or short-lived signed tokens), making the web tier strictly stateless so any instance can serve any request.
- C) Keep local sessions and enable Auto Scaling scale-in protection, which preserves in-memory state across an AZ outage.
- D) Keep local sessions and rely on load-balancer cookie affinity so replacement instances automatically replay session state from local disk.

<details><summary>Answer</summary>

**B.** Losing one of three AZs terminates 4 of 12 instances and destroys one-third of locally stored sessions immediately; externalizing session state to a multi-AZ replicated Valkey/Redis cluster decouples session durability from web-node lifecycle and autoscaling.

- Why not A: Load-balancer failover reroutes HTTP traffic to healthy hosts, but those hosts lack the in-memory session data, forcing affected users to log in again.
- Why not C: Scale-in protection only prevents deliberate autoscaler termination of healthy hosts and cannot prevent hardware or AZ failures.
- Why not D: Affinity cookies only identify a backend host; they do not persist or replicate arbitrary server-side session memory across replacement instances.
- Ref: [modules/15-scale-from-zero-to-millions.md](../modules/15-scale-from-zero-to-millions.md#23-stage-45-caching-cdn-edge-offload-and-stateless-web-tier), https://valkey.io/documentation/

</details>

### Q-SD-073 · Progressive Scaling & Blast-Radius Architecture · difficulty 3 · scenario

A user updates their display name on a PostgreSQL primary. The immediate redirect reads from an asynchronous streaming read replica whose WAL replay lag spikes to 300 ms, rendering the old display name. Which fix guarantees read-your-writes for that user at the lowest system-wide latency cost?

- A) Set `synchronous_commit = remote_apply` globally for every write transaction across all replicas.
- B) Capture `pg_current_wal_lsn()` after the user's write, attach that watermark to the user's session/cookie, and route subsequent reads to a replica only when `pg_last_wal_replay_lsn()` meets or exceeds that LSN (otherwise falling back to the primary).
- C) Provision twice as many asynchronous read replicas because adding replicas lowers per-replica WAL replay lag.
- D) Insert a fixed `500 ms` `sleep()` in the client after every write before issuing the redirect.

<details><summary>Answer</summary>

**B.** LSN pinning enforces read-your-writes strictly for sessions that just mutated state without adding synchronous cross-AZ commit latency to unrelated traffic; reads revert to replicas automatically once the replica's replay LSN catches up.

- Why not A: Enforcing `remote_apply` globally pays full replica network + apply round-trip latency on every write in the entire system and blocks writes if a synchronous replica stalls.
- Why not C: Adding more async replicas increases WAL shipping fan-out load on the primary rather than speeding up single-replica replay.
- Why not D: Hardcoded client sleeps add unnecessary latency to every mutation and still return stale reads whenever replica lag spikes past 500 ms.
- Ref: [modules/15-scale-from-zero-to-millions.md](../modules/15-scale-from-zero-to-millions.md#22-stage-23-load-balancers-and-database-read-replication), https://www.postgresql.org/docs/current/functions-admin.html

</details>

### Q-SD-074 · Progressive Scaling & Blast-Radius Architecture · difficulty 3 · scenario

Eight worker nodes serve thousands of SaaS tenants. One malicious tenant sends a poison-pill request that crashes every worker node it touches. Which statement accurately compares fixed sharding versus shuffle sharding when each tenant receives $k = 2$ workers?

- A) Both 4 disjoint pairs and shuffle sharding expose 25% of tenants to total outage because the poison tenant still crashes 2 of 8 nodes.
- B) Shuffle sharding creates $\binom{8}{2} = 28$ distinct 2-node virtual shards, reducing the fraction of other tenants completely sharing the poison tenant's exact pair from $1/4$ (`25%`) down to $1/28$ (`~3.57%`) at identical hardware cost.
- C) Shuffle sharding reduces total fleet capacity lost during the poison-pill attack from 25% down to 3.57%.
- D) Shuffle sharding with $k = 2$ yields $2^8 = 256$ virtual shards, cutting exact-overlap blast radius to `0.39%`.

<details><summary>Answer</summary>

**B.** Under fixed sharding into 4 disjoint pairs, 25% of all tenants share the exact two poisoned workers and go completely down; under shuffle sharding ($N = 8, k = 2$), only $1 / \binom{8}{2} = 1/28 \approx 3.57\%$ of tenants share both poisoned workers, while the remaining tenants keep at least one healthy worker for failover.

- Why not A: Although 2 of 8 physical nodes still crash, shuffle sharding ensures ~96.4% of tenants still have at least one unaffected node to retry against.
- Why not C: Physical fleet capacity impacted is still 2 of 8 nodes (25%); the 7× reduction applies to _tenant total-outage blast radius_, not physical node survival.
- Why not D: $2^8 = 256$ counts all subsets of any size, whereas fixed-size $k = 2$ assignments follow $\binom{8}{2} = 28$.
- Ref: [modules/15-scale-from-zero-to-millions.md](../modules/15-scale-from-zero-to-millions.md#32-shuffle-sharding-combinatorics), https://aws.amazon.com/builders-library/workload-isolation-using-shuffle-sharding/

</details>

### Q-SD-075 · Progressive Scaling & Blast-Radius Architecture · difficulty 2 · multi

A stateless API fleet scales strictly on average CPU utilization with a 15-second evaluation interval and zero scale-down cooldown (`stabilizationWindowSeconds: 0`). New pods require 90 seconds to initialize JIT compilation and warm local metadata caches before serving at full throughput. Which **two** failure modes does this autoscaler configuration trigger during bursty traffic?

- A) **Scale-out overshoot**: during the 90-second warm-up, CPU remains elevated on existing pods across ~6 evaluation cycles, causing naive policies that ignore in-flight booting capacity to launch far more pods than needed.
- B) **Oscillation (flapping/thrashing)**: as soon as the newly warmed fleet drives average CPU briefly below the scale-in threshold, zero cooldown terminates pods immediately, leaving the fleet under-provisioned for the next wave.
- C) **HTTP 500 rejection by load balancers**: L7 load balancers automatically emit 500 errors whenever any pod has an uptime under 90 seconds.
- D) **Permanent deadlock**: Kubernetes refuses to schedule pods whenever `stabilizationWindowSeconds` is set to 0.

<details><summary>Answer</summary>

**A, B.** Cold-start delay longer than the control-loop interval causes repeated scale-out triggers before capacity comes online, and zero scale-down hysteresis causes immediate teardown on transient dips, producing destructive capacity oscillation.

- Why not C: Load balancers gate routing on configured readiness probes (`/readyz`), not arbitrary uptime thresholds.
- Why not D: `stabilizationWindowSeconds: 0` is syntactically valid in Kubernetes HPA; it disables scale-down damping rather than blocking scheduling.
- Ref: [modules/15-scale-from-zero-to-millions.md](../modules/15-scale-from-zero-to-millions.md#25-stage-9-telemetry-automation-and-autoscaling-stability), https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/

</details>

### Q-SD-076 · Distributed Key-Value Stores & Quorum Systems · difficulty 3 · scenario

A key is replicated across three nodes with $N = 3$, $W = 2$, $R = 2$. A client writes `x = new`, but the write persists on only replica A before timing out on B and C, so the coordinator returns an error to the client. Which statement is correct?

- A) Because $W + R = 4 > 3$, every read quorum contains the new value, so the system is linearizable regardless of failed writes.
- B) Because the write returned an error to the client, the value is rolled back on replica A and no later read can observe it.
- C) The failed write remains durable on replica A (phantom persistence); a later read quorum hitting `{A, B}` can observe `new`, while a subsequent read hitting `{B, C}` returns `old` unless synchronous read repair writes back `new` before returning—violating linearizability despite $W + R > N$.
- D) Raising $W$ to $3$ restores linearizability because every write then targets all three replicas, eliminating partial-write phantoms.

<details><summary>Answer</summary>

**C.** Strict quorum overlap ($W + R > N$) guarantees intersecting the latest _acknowledged_ write quorum under sequential operations, not linearizability. Leaderless quorum writes do not roll back replicas that already persisted a failed write (`acks = 1 < W = 2`), and without synchronous write-back (read repair) before returning to callers, Reader 1 on `{A, B}` can observe `new` while a later Reader 2 on `{B, C}` observes `old`.

- Why not A: Quorum overlap does not eliminate partially persisted failed writes or enforce a global real-time read order without synchronous read repair and consensus.
- Why not B: Leaderless KV stores do not execute distributed rollback on timeout; replica A retains `new` until overwritten or reconciled.
- Why not D: Even at $W = 3$, a write that persists on 1 or 2 nodes before failing still leaves durable partial state.
- Ref: [modules/16-distributed-key-value-store.md](../modules/16-distributed-key-value-store.md#3-tunable-quorums-and-why-w--r--n-is-not-linearizability), https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf

</details>

### Q-SD-077 · Distributed Key-Value Stores & Quorum Systems · difficulty 3 · scenario

A consistent-hash ring holds nodes `A` through `E`, with home preference list `{A, B, C}` for key `k`. During a network partition, `B` is down and the writer's coordinator cannot reach `A` or `C`, so it executes a **sloppy quorum** write ($W = 2$) acknowledged by standby nodes `{D, E}` carrying hint envelopes (`D → B`, `E → C`). Shortly afterward, `A` and `C` become reachable again (`B` remains down and hints have not yet drained from `{D, E}`), and another client executes a strict read ($R = 2$) against home replicas `{A, C}`. Why does that read miss the new write?

- A) The client read a stale local HTTP cache; the database itself is strictly consistent.
- B) Sloppy quorums never count stand-in nodes toward $W$, so the write must have reached `{A, C}` already.
- C) The sloppy write set `{D, E}` is disjoint from the strict home read set `{A, C}`, breaking the $W + R > N$ intersection invariant until **hinted handoff** drains from `{D, E}` back to the recovered home replicas.
- D) Lowering $R$ to `1` on `{A, C}` recovers the new value immediately because any single home node serves the latest write.

<details><summary>Answer</summary>

**C.** $W + R > N$ guarantees overlap only when both quorums draw from the same $N$-node home preference list. Sloppy quorums preserve write availability by accepting acknowledgements from non-home standby nodes `{D, E}`, creating zero overlap with `{A, C}` until hinted handoff replays the updates back to home nodes.

- Why not A: Neither `A` nor `C` holds the new value yet; the staleness lives in the cluster replicas, not a client cache.
- Why not B: Counting non-home standby nodes toward $W$ is the exact definition of a sloppy quorum.
- Why not D: Reading fewer home nodes (`R = 1`) still consults only `{A, C}`, neither of which received the sloppy write.
- Ref: [modules/16-distributed-key-value-store.md](../modules/16-distributed-key-value-store.md#43-temporary-failures-sloppy-quorums-and-hinted-handoff), https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf

</details>

### Q-SD-078 · Distributed Key-Value Stores & Quorum Systems · difficulty 2 · single

Two replicas of a key carry vector clocks `D1 = [S1:2, S2:1]` and `D2 = [S1:1, S2:2]`. Contrast how a vector-clock KV store handles these versions versus a Last-Write-Wins (LWW) store experiencing `250 ms` of NTP clock skew.

- A) `D1` causally descends from `D2` because `S1` is higher, so no conflict exists.
- B) `D1` and `D2` are `CONCURRENT` siblings because neither vector dominates the other across every coordinator coordinate (`S1: 2 > 1` while `S2: 1 < 2`); a vector-clock store surfaces both siblings for reconciliation, whereas LWW compares wall-clock timestamps and silently drops a causally newer update when NTP skew orders its timestamp earlier.
- C) `D1` and `D2` are causally equal because both counter sums equal `3`, so dropping either loses no history.
- D) LWW consults the vector clock first and only breaks ties with NTP timestamps, preventing silent write loss.

<details><summary>Answer</summary>

**B.** Causal dominance requires every coordinate of one vector clock to be greater than or equal to the other's (with at least one strictly greater). Because `D1` leads on `S1` while `D2` leads on `S2`, the updates are concurrent siblings; LWW ignores causality and compares unsynchronized wall clocks, silently discarding writes whose host clock lags behind.

- Why not A: Dominance fails on coordinate `S2` (`1 < 2`).
- Why not C: Summing vector coordinates destroys per-node causal history; two incomparable branches can have identical sums.
- Why not D: LWW systems (such as standard Cassandra cell timestamps) do not maintain vector clocks; wall-clock timestamps directly dictate which write survives.
- Ref: [modules/16-distributed-key-value-store.md](../modules/16-distributed-key-value-store.md#41-vector-clocks-dotted-version-vectors-and-the-lww-clock-skew-trap), https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf

</details>

### Q-SD-079 · Distributed Key-Value Stores & Quorum Systems · difficulty 3 · scenario

In an LSM-backed Cassandra cluster, a replica stays offline while key `k` is deleted (writing a tombstone to surviving replicas). The offline node remains down longer than `gc_grace_seconds` (`864,000 s` = 10 days) and rejoins the ring without being replaced or repaired first. Shortly afterward, deleted key `k` reappears for users (**zombie data resurrection**). What caused this?

- A) Hinted handoff replayed an expired hint from the rejoining node, so clearing the hints directory prevents resurrection.
- B) Compaction never removes tombstones, so resurrection can happen only when clients read at consistency level `ONE`.
- C) Once `gc_grace_seconds` elapses, compaction on surviving replicas permanently purges the tombstone; when the long-offline node rejoins holding the old live cell, anti-entropy repair sees a live record with no competing tombstone and streams the deleted value back across the ring.
- D) Reducing `gc_grace_seconds` to `3,600 s` accelerates tombstone propagation and eliminates resurrection.

<details><summary>Answer</summary>

**C.** Tombstones prevent deleted keys from reappearing only while they remain present across replicas. If compaction purges tombstones after `gc_grace_seconds` before an offline replica receives them, the rejoining replica's stale live record becomes the sole surviving version and gets copied back across the cluster during repair; operators must run repair strictly within `gc_grace_seconds` or decommission/re-bootstrap nodes offline longer than that window.

- Why not A: Hints have short retention windows (typically hours) and target down nodes rather than replaying stale values from a rejoining node.
- Why not B: Compaction explicitly purges expired tombstones past `gc_grace_seconds` to reclaim disk space, regardless of client read consistency level.
- Why not D: Shortening `gc_grace_seconds` purges tombstones earlier, widening the resurrection hazard window.
- Ref: [modules/16-distributed-key-value-store.md](../modules/16-distributed-key-value-store.md#6-production-gotchas-and-failure-modes), https://cassandra.apache.org/doc/latest/

</details>

### Q-SD-080 · Distributed Key-Value Stores & Quorum Systems · difficulty 2 · multi

Which **two** statements accurately explain why Amazon DynamoDB (Elhemali et al., USENIX ATC 2022) replaced the leaderless vector-clock architecture of the 2007 Dynamo paper with per-partition Paxos leader election, stateless Request Routers, and Storage Nodes?

- A) A per-partition Paxos leader provides a single serialization point per key range, enabling strongly consistent reads, conditional writes (`ConditionExpression`), and ACID transactions without pushing vector-clock sibling merges onto client applications.
- B) Decoupling stateless Request Routers from Storage Nodes allows automated partition splitting, migration, and Global Admission Control behind the routing layer without exposing ring-rebalance conflicts to callers.
- C) Paxos eliminates the need for data replication, allowing DynamoDB to keep only one copy per item and cut SSD costs by 3×.
- D) DynamoDB dropped leaderless vector clocks because it abandoned multi-AZ fault tolerance and high availability.
- E) Per-partition Paxos leaders automatically make cross-region Global Tables strictly linearizable with zero conflict resolution.

<details><summary>Answer</summary>

**A, B.** Per-partition Paxos groups serialize writes cleanly for conditional updates and strongly consistent reads while eliminating application-side sibling resolution, and stateless Request Routers insulate clients from dynamic partition splits and replica moves.

- Why not C: Each DynamoDB partition still replicates across three storage nodes in distinct Availability Zones via Paxos.
- Why not D: DynamoDB maintains multi-AZ high availability (`99.99%`–`99.999%` SLAs) alongside leader election and fast failover.
- Why not E: Cross-region Global Tables replicate asynchronously and use per-item LWW conflict resolution rather than global cross-region Paxos linearizability.
- Ref: [modules/16-distributed-key-value-store.md](../modules/16-distributed-key-value-store.md#5-niche-and-principal-level-kv-architectures), https://www.usenix.org/conference/atc22/presentation/elhemali

</details>

### Q-SD-081 · Geospatial Mapping, Routing & Real-Time Navigation · difficulty 2 · single

A Web Mercator tile pyramid spanning zoom levels `0` to `21` contains $4^z$ tiles at zoom $z$, so zoom `21` alone holds $4^{21} \approx 4.40 \times 10^{12}$ tiles (`~440 PB` raw at `100 KB` per PNG). Why does serving **Mapbox Vector Tiles (MVT)** with sparse deduplication of empty/uniform tiles (oceans, deserts) slash storage and CDN bandwidth by more than `90%` compared to raster PNGs?

- A) CDNs refuse to cache PNG files above zoom level `15`, forcing vector tiles at high zoom.
- B) MVT encodes quantized geometry and attributes as compact Protobuf streams rendered on client GPUs, while empty/uniform ocean and desert regions collapse onto shared void objects instead of storing 65,536-pixel bitmaps per theme and zoom.
- C) MVT truncates the pyramid at zoom level `4`, removing `4^17` zoom tiers from the map.
- D) MVT ships uncompressed `512 × 512` pixel bitmaps that compress slightly better than `256 × 256` PNGs.

<details><summary>Answer</summary>

**B.** Raster PNGs pay per-pixel storage across every tile and multiply storage across every visual style (day/night/high-DPI), whereas MVT ships compact quantized vector instructions rendered locally and sparse deduplication collapses ~70% ocean/empty tiles onto shared empty objects.

- Why not A: CDNs cache any immutable static payload regardless of zoom level; the limitation is storage/egress economics, not HTTP/CDN protocol rules.
- Why not C: Street-level navigation still requires high-zoom geometry; vector encoding and sparse storage avoid dropping detail.
- Why not D: MVT is a vector geometry format, not a raster bitmap format.
- Ref: [modules/17-google-maps.md](../modules/17-google-maps.md#12-web-mercator-projection-and-zoom-level-tile-pyramid-math), https://github.com/mapbox/vector-tile-spec

</details>

### Q-SD-082 · Geospatial Mapping, Routing & Real-Time Navigation · difficulty 3 · scenario

A continental road graph contains `100M` vertices, and live traffic incidents update edge weights every `30 seconds`. Your routing fleet currently relies on static **Contraction Hierarchies (CH)** precomputed offline on free-flow speeds. Why is **Customizable Route Planning (CRP)** a superior fit for live driving navigation?

- A) CH queries are fast enough that re-running full continental contraction every `30 seconds` fits easily inside a parallel batch job.
- B) CRP separates one-time metric-independent multi-level graph partitioning from a fast metric-dependent customization phase that recomputes overlay weights bottom-up solely for cells containing changed edges (finishing in `< 1 s`), whereas CH bakes weights into contraction order and requires hours-long full rebuilds on metric changes.
- C) Running unindexed bidirectional Dijkstra on `100M` vertices with zero preprocessing consistently answers continental queries in `< 5 ms`.
- D) Precomputing an all-pairs matrix for the top `10,000` cities every `30 seconds` eliminates the need for graph routing.

<details><summary>Answer</summary>

**B.** CH shortcuts depend on the edge-weight metric used during offline contraction, so continuous 30-second traffic updates invalidate the hierarchy faster than it can rebuild. CRP decouples static topology partitioning from metric customization, refreshing affected cell overlays in under a second while retaining single-digit millisecond continental query latency.

- Why not A: Full contraction of a 100M-vertex continental graph takes hours even when parallelized and cannot meet a 30-second live-traffic cadence.
- Why not C: Unindexed Dijkstra expands millions of vertices on a continental road graph, taking hundreds of milliseconds to seconds and blowing interactive `p99 < 200 ms` budgets.
- Why not D: Static city-pair matrices cannot route between arbitrary street addresses or adapt to street-level detours.
- Ref: [modules/17-google-maps.md](../modules/17-google-maps.md#3-hierarchical-routing-tiles-contraction-hierarchies-and-crp), https://arxiv.org/abs/1504.05140

</details>

### Q-SD-083 · Geospatial Mapping, Routing & Real-Time Navigation · difficulty 3 · scenario

Tracking `100M` active navigators by storing a flat list of `K` base routing tiles per route consumes $O(K)$ memory per user and forces costly per-incident scans. Adaptive ETA instead stores a **hierarchical super-tile chain** `[r_1, super(r_1), super(super(r_1)), ...]` up to the smallest common enclosing ancestor of origin and destination. Why does this design cut both memory footprint and incident-to-navigator lookup cost?

- A) Each navigator stores at most $z_{\text{base}} + 1$ super-tile IDs (`6–9` for typical metro trips, `<= 22` even at zoom `21`) up to the shared enclosing root, and indexing active routes by their enclosing super-tile lets an incident on tile `r_k` walk up its ancestor pyramid (`<= z_base + 1` hash lookups) as a coarse prefilter before checking exact route-edge overlap and ETA.
- B) Each level stores all `K` base tiles duplicated at every zoom resolution, trading extra memory for faster rendering.
- C) The super-tile chain eliminates the inverted index so the server scans all `100M` active users linearly on every incident.
- D) Storing full polyline geometry at every super-tile level compresses user memory below storing tile IDs.

<details><summary>Answer</summary>

**A.** Walking up parent quadtree tiles halves spatial span per level, capping per-navigator chain depth at $O(\log L)$ entries. Keying an inverted index by enclosing super-tile lets any incident tile locate candidate impacted navigators via a tiny upward ancestor walk rather than scanning every active session.

- Why not B: Duplicating all `K` base tiles per level increases memory beyond $O(K)$ instead of reducing it to $O(\log L)$.
- Why not C: Avoiding linear scans across `100M` active sessions is the exact reason the inverted super-tile index exists.
- Why not D: Full geometry payloads consume orders of magnitude more RAM than compact integer tile IDs.
- Ref: [modules/17-google-maps.md](../modules/17-google-maps.md#43-adaptive-eta-hierarchical-super-tile-indexing-and-websocket-push), https://developers.google.com/maps/documentation/routes

</details>

### Q-SD-084 · Geospatial Mapping, Routing & Real-Time Navigation · difficulty 2 · single

In dense urban canyons and multi-level highway interchanges, raw smartphone GPS drifts by `5–20 m`, causing naive Euclidean nearest-road snapping to jump an elevated-highway driver onto a perpendicular surface street underneath. How does **Hidden Markov Model (HMM) map matching** eliminate this error?

- A) HMM scores candidate road segments per GPS fix using Gaussian emission probability (distance/accuracy) and connects consecutive fixes via transition probabilities (comparing shortest road-network path distance against straight-line displacement plus heading continuity), using Viterbi decoding to pick the single most coherent road trajectory.
- B) Adding extra artificial Gaussian noise to each GPS sample cancels out multipath reflections statistically.
- C) Discarding the road graph and routing purely from compass headings avoids snapping errors altogether.
- D) Increasing the Euclidean nearest-neighbor search radius from `20 m` to `500 m` guarantees the elevated highway is always chosen.

<details><summary>Answer</summary>

**A.** Naive Euclidean snapping evaluates one noisy point in isolation and ignores vertical separation and direction of travel. HMM Viterbi decoding evaluates an entire trajectory sequence in $O(T \cdot S^2)$ time, penalizing impossible topological jumps and heading discontinuities (`90°` overpass mismatch) so the matched path stays locked onto the true highway.

- Why not B: Injecting random noise degrades accuracy further and never fixes systematic multipath bias or vertical interchange ambiguity.
- Why not C: Compass headings alone cannot identify road segments, turn restrictions, or traffic speeds without matching onto the road graph.
- Why not D: Widening a pure Euclidean search radius still selects the closest 2D segment—the perpendicular underpass remains closer than the drifted highway fix.
- Ref: [modules/17-google-maps.md](../modules/17-google-maps.md#41-client-batching-and-hmm-map-matching), https://www.microsoft.com/en-us/research/publication/hidden-markov-map-matching-noise-sparseness/

</details>

### Q-SD-085 · Geospatial Mapping, Routing & Real-Time Navigation · difficulty 3 · multi

Which **two** operational hazards arise when pushing real-time adaptive reroutes over WebSockets to millions of active navigators?

- A) **Rerouting herd oscillation**: pushing the identical fastest detour from one traffic snapshot to `5,000` drivers simultaneously floods a low-capacity residential side street, collapsing its ETA and flipping cohorts back and forth unless damped with capacity penalties and stochastic cohort splitting.
- B) **Stateful WebSocket reconnect storms**: a rolling gateway deployment that drops `2M` pinned sockets simultaneously triggers a synchronized TLS handshake and session-store spike unless gateways drain gracefully and clients reconnect with exponential backoff plus full jitter.
- C) **Zero TLS handshake cost**: modern TLS 1.3 handshakes consume negligible CPU, so 2M simultaneous reconnects never stress gateways.
- D) **Client GPU shader fill rate**: WebGL tile shading speed is the primary bottleneck limiting server-side WebSocket reroute fan-out.

<details><summary>Answer</summary>

**A, B.** Identical greedy reroutes create a Braess-style feedback oscillation on narrow detours (solved via saturation penalties, cohort splitting, and hysteresis), and dropping `2M` stateful WebSockets without graceful draining and full jitter concentrates `2M` TLS handshakes into `1 second` instead of `~16.7k/s` over `120 s`.

- Why not C: Asymmetric key-exchange CPU across `2M` simultaneous TLS 1.3 handshakes easily saturates L7 gateways and triggers cascading timeouts.
- Why not D: Client GPU rendering affects local frame rate, not server-side routing stability or gateway socket churn.
- Ref: [modules/17-google-maps.md](../modules/17-google-maps.md#5-production-gotchas-and-failure-modes), https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/

</details>

---

### Q-SD-086 · Distributed Message Queues & Event Streaming Internals · difficulty 3 · scenario

A partition has `RF=3` and a producer uses `acks=all`. A rack failure leaves one follower in sync and the other out of sync, and then the leader crashes. Which configuration guarantees that no acknowledged message is lost and that a stale replica is never elected leader?

- A) `acks=all`, `min.insync.replicas=1`, `unclean.leader.election.enable=true`
- B) `acks=all`, `min.insync.replicas=2`, `unclean.leader.election.enable=false`
- C) `acks=1`, `min.insync.replicas=2`, `unclean.leader.election.enable=false`
- D) `acks=all`, `min.insync.replicas=2`, `unclean.leader.election.enable=true`

<details><summary>Answer</summary>

**B.** `acks=all` makes the leader wait for the current ISR. `min.insync.replicas=2` ensures a write is acknowledged only after at least two replicas hold it, rejecting writes with `NotEnoughReplicasException` whenever ISR size falls below two. `unclean.leader.election.enable=false` ensures only an in-sync replica can become leader, so a stale replica never truncates acknowledged data; the partition goes offline instead, trading availability for durability.

- Why not A: With `min.insync.replicas=1`, `acks=all` waits only for the lone leader when the ISR shrinks to one, so acknowledged data can exist on a single broker and unclean election can promote a stale replica that discards it.
- Why not C: `acks=1` acknowledges as soon as the leader appends locally before any follower fetches the batch, so a leader crash can lose acknowledged records regardless of `min.insync.replicas`.
- Why not D: With unclean election enabled, if all in-sync replicas become unavailable, an out-of-sync follower lacking acknowledged writes can be elected leader and permanently truncate committed records.
- Ref: [modules/18-distributed-message-queue.md](../modules/18-distributed-message-queue.md#3-producer-flow-replication-isr-and-kip-101-leader-epoch-safety), https://kafka.apache.org/documentation/#replication

</details>

---

### Q-SD-087 · Distributed Message Queues & Event Streaming Internals · difficulty 3 · single

A three-broker partition fails over from leader A to follower B. Before KIP-101, a returning broker truncated its log to its own High Watermark (HWM) upon rejoining as a follower. Which statement accurately explains how KIP-101 Leader Epoch eliminates the resulting log divergence?

- A) It advances the HWM eagerly on followers before fetches complete so followers never lag behind the leader.
- B) A returning follower queries the new leader with `OffsetsForLeaderEpoch` for the end offset of its last known epoch and truncates to that offset, aligning with the leader's epoch history instead of a potentially stale local HWM.
- C) It replaces the ISR list with a static majority Raft quorum for every data partition.
- D) It removes the need for `min.insync.replicas` because every epoch is durably committed on append.

<details><summary>Answer</summary>

**B.** Each leader term carries a monotonically increasing epoch recorded alongside its start offset. A returning broker sends `OffsetsForLeaderEpoch` to the current leader to find the exact end offset of its last epoch in the leader's history and truncates any diverged tail beyond that point before fetching. Because a broker's local HWM can lag or diverge across rapid failovers, truncating strictly to local HWM can retain records the new leader never committed or drop valid records.

- Why not A: The HWM tracks committed replicated offsets and cannot be advanced before followers fetch; KIP-101 changes truncation semantics rather than HWM advancement rules.
- Why not C: KIP-101 preserves ISR-based partition replication rather than converting data partitions into per-partition Raft groups.
- Why not D: Leader epochs make failover truncation deterministic, whereas `min.insync.replicas` enforces write quorum durability before returning an acknowledgement.
- Ref: [modules/18-distributed-message-queue.md](../modules/18-distributed-message-queue.md#3-producer-flow-replication-isr-and-kip-101-leader-epoch-safety), https://cwiki.apache.org/confluence/display/KAFKA/KIP-101+-+Alter+Replication+Protocol+to+use+Leader+Epoch+rather+than+High+Watermark+for+Truncation

</details>

---

### Q-SD-088 · Distributed Message Queues & Event Streaming Internals · difficulty 3 · scenario

A cluster ingests `1M msg/s` of `1 KB` records (`1 GB/s` raw) with `RF=3`, `3x` `zstd` compression, `14-day` retention, and `3` independent consumer groups across 3 AWS AZs (`$0.02/GB` cross-AZ transfer). Cloud billing shows `~$34,560/mo` in inter-broker cross-AZ replication plus `~$34,560/mo` in cross-AZ consumer fetches (`~$69,120/mo` combined). Which architecture addresses **both** cross-AZ cost drivers and long-term local disk cost?

- A) Enable KIP-392 rack-aware follower fetching alone so consumers read from same-AZ followers.
- B) Enable KIP-405 tiered storage alone on the 14-day topics, eliminating all inter-broker replication traffic by a factor of `RF`.
- C) Enable KIP-392 so consumers read from same-AZ replicas (`$0` consumer cross-AZ tax), use KIP-405 tiered storage for historical segments, and move replayable high-volume streams onto diskless S3-native brokers (such as WarpStream or AutoMQ) that eliminate inter-broker cross-AZ replication.
- D) Lower `RF` to `2` and switch to maximum-level `zstd` compression to cut cross-AZ transfer without changing broker architecture.

<details><summary>Answer</summary>

**C.** Cross-AZ transfer has two separate halves at `3x` compression: `2/3 GB/s` of follower replication (`~$34,560/mo`) and `2/3 GB/s` of cross-AZ consumer reads across three groups (`~$34,560/mo`). KIP-392 eliminates the consumer-fetch half by routing reads to same-AZ followers, while diskless S3-native brokers eliminate inter-broker cross-AZ replication altogether by persisting batches directly to multi-AZ object storage. KIP-405 tiered storage separately decouples 14-day retention from expensive local NVMe/EBS volumes.

- Why not A: KIP-392 removes cross-AZ consumer fetches, but inter-broker leader-to-follower replication (`~$34,560/mo`) still crosses AZ boundaries on every write.
- Why not B: Tiered storage offloads closed historical segments to object storage; active segments are still replicated across AZs by brokers, so steady-state replication transfer remains unchanged.
- Why not D: Dropping to `RF=2` sacrifices fault tolerance under concurrent broker maintenance plus AZ failure, and extreme compression levels spike producer/broker CPU for marginal ratio gains beyond `3x`.
- Ref: [modules/18-distributed-message-queue.md](../modules/18-distributed-message-queue.md#1-requirements-messaging-models-and-quantitative-capacity-sizing), https://cwiki.apache.org/confluence/display/KAFKA/KIP-392%3A+Allow+consumers+to+fetch+from+closest+replica

</details>

---

### Q-SD-089 · Distributed Message Queues & Event Streaming Internals · difficulty 2 · ordering

Order the lifecycle steps of a KIP-98 idempotent, transactional write from producer dispatch until a `read_committed` consumer observes the batch.

- A) Leader appends batch → producer attaches `PID`, epoch, and sequence numbers → LSO advances → `COMMIT` marker written → `read_committed` consumer exposes batch
- B) Producer attaches `PID`, epoch, and sequence numbers → leader appends batch → transaction coordinator writes `COMMIT` control marker → LSO advances past the marker → `read_committed` consumer exposes batch
- C) `COMMIT` control marker written → producer attaches `PID`, epoch, and sequence numbers → leader appends batch → LSO advances → `read_committed` consumer exposes batch
- D) Producer attaches `PID`, epoch, and sequence numbers → leader appends batch → `read_committed` consumer exposes batch → `COMMIT` control marker written → LSO advances

<details><summary>Answer</summary>

**B.** The producer stamps every batch with its `PID`, producer epoch, and per-partition monotonic sequence so the partition leader deduplicates retries and fences zombie epochs. The leader appends the batch while keeping it hidden from `read_committed` consumers until the transaction coordinator commits by writing a `COMMIT` control marker into the partition log, advancing the Last Stable Offset (LSO) and releasing the batch to `read_committed` consumers.

- Why not A: The producer must attach `PID`, epoch, and sequence before sending, and the LSO cannot advance past an open transaction before its `COMMIT` marker is written.
- Why not C: A `COMMIT` marker closes an already-appended transactional batch; writing it first leaves nothing to commit.
- Why not D: Exposing a batch before the `COMMIT` marker and LSO advancement violates `read_committed` isolation by leaking aborted or in-flight writes.
- Ref: [modules/18-distributed-message-queue.md](../modules/18-distributed-message-queue.md#3-producer-flow-replication-isr-and-kip-101-leader-epoch-safety), https://cwiki.apache.org/confluence/display/KAFKA/KIP-98+-+Exactly+Once+Delivery+and+Transactional+Messaging

</details>

---

### Q-SD-090 · Distributed Message Queues & Event Streaming Internals · difficulty 3 · multi

Select **two** genuine architectural benefits of KRaft (Apache Kafka 4.0+), KIP-848, and KIP-932 Share Groups compared with a legacy ZooKeeper-coordinated cluster using eager consumer rebalancing.

- A) KRaft stores cluster metadata in an internal Raft-replicated `@metadata` log, removing the external ZooKeeper ensemble and cutting controller failover latency from minutes to sub-second at high partition counts.
- B) KIP-848 shifts consumer group partition assignment to the broker-side group coordinator with incremental heartbeat reconciliation, eliminating group-wide stop-the-world rebalance pauses.
- C) KIP-932 Share Groups preserve strict total ordering of records within a partition across all competing workers simultaneously.
- D) KRaft eliminates partition ISR replication because the metadata Raft quorum replicates every user topic payload automatically.

<details><summary>Answer</summary>

**A, B.** KRaft removes ZooKeeper and its dual-metadata split-brain hazards while allowing fast event-sourced controller failovers at `1M+` partitions, and KIP-848 eliminates global stop-the-world rebalance barriers by having the broker coordinator reconcile only changed partition assignments incrementally.

- Why not C: Share Groups intentionally trade strict per-partition ordering for point-to-point competing-worker parallelism with per-record acknowledgement, breaking the `consumers <= partitions` ceiling.
- Why not D: KRaft replicates cluster metadata only (`@metadata`); user topic partitions still replicate via leader-follower ISR protocols.
- Ref: [modules/18-distributed-message-queue.md](../modules/18-distributed-message-queue.md#4-consumer-pull-protocol-rebalancing-evolution-coordination-and-advanced-broker-features), https://cwiki.apache.org/confluence/display/KAFKA/KIP-500%3A+Replace+ZooKeeper+with+a+Self-Managed+Metadata+Quorum

</details>

---

### Q-SD-091 · High-Contention Booking, Overbooking & Reservation Systems · difficulty 3 · scenario

A hotel booking service decrements nightly inventory with `UPDATE room_type_inventory SET total_reserved = total_reserved + 1 WHERE hotel_id = ? AND room_type_id = ? AND date BETWEEN ? AND ?`, passing the check-in date (`2026-12-01`) and check-out date (`2026-12-04`) as the bounds. The room type has `total_inventory = 20`, and the hotel permits `10%` controlled overbooking. This 3-night stay modifies `4` inventory rows and causes the checkout date (`2026-12-04`) to report sold out for incoming guests. Which remediation is correct?

- A) Keep `BETWEEN`, subtract one day from the checkout date only in the front-end UI calendar, and ignore `rows_affected` because the overbooking check already prevents overselling.
- B) Replace `BETWEEN` with the half-open interval predicate `date >= checkIn AND date < checkOut` (`[checkIn, checkOut)`), enforce the per-night overbooking floor cap `total_reserved + roomCount <= (total_inventory * 110) / 100` in the same atomic statement, and assert `rows_affected == num_nights` before committing (rolling back otherwise).
- C) Use `date > checkIn AND date <= checkOut` (`(checkIn, checkOut]`), which excludes the check-in night and includes the checkout night.
- D) Keep `BETWEEN` and lower the cap to `total_reserved + roomCount <= total_inventory`, removing the `10%` overbooking allowance so `rows_affected` checks become unnecessary.

<details><summary>Answer</summary>

**B.** SQL `BETWEEN` is inclusive of both endpoints, so passing `[2026-12-01, 2026-12-04]` reserves the checkout morning (`2026-12-04`) as a fourth night even though the guest vacates by 11:00 AM, blocking incoming guests and slashing occupancy. Using the half-open interval `date >= checkIn AND date < checkOut` updates only the `3` actual sleep nights (`Dec 1, 2, 3`), enforces `FLOOR(20 * 1.10) = 22` max reserved rooms per night via exact integer math, and verifies `rows_affected == 3` so partial or unseeded date ranges roll back atomically.

- Why not A: Relying on front-end date manipulation leaves the backend API contract broken for mobile/OTA callers, and ignoring `rows_affected` allows partial-stay updates when a future date row is missing or full.
- Why not C: Excluding `checkIn` and including `checkOut` shifts the off-by-one bug to the arrival night, failing to reserve the first night the guest sleeps at the hotel.
- Why not D: Keeping `BETWEEN` still locks the checkout date erroneously, and removing the `10%` overbooking allowance violates the business requirement without fixing the date-range bug.
- Ref: [modules/19-hotel-reservation-system.md](../modules/19-hotel-reservation-system.md#23-the-off-by-one-checkout-bug-between-vs-half-open-checkin-checkout-and-controlled-overbooking), https://www.postgresql.org/docs/current/functions-comparison.html

</details>

---

### Q-SD-092 · High-Contention Booking, Overbooking & Reservation Systems · difficulty 3 · single

Two concurrent transactions modify overlapping multi-night stays on the same hotel room type using pessimistic locking (`SELECT ... FOR UPDATE`). Transaction T1 locks `2026-12-01` and then requests `2026-12-02`, while Transaction T2 locks `2026-12-02` first and then requests `2026-12-01`. Which statement accurately explains the resulting failure and the trade-offs among the three database concurrency defenses?

- A) The deadlock occurs because `FOR UPDATE` acquires table-level locks; replacing it with `FOR SHARE` eliminates the cycle while preventing double-booking.
- B) Acquiring row locks in opposite date orders creates a Coffman circular wait (`SQLSTATE 40P01`); when all writers acquire pre-populated row-level locks at the same `(hotel_id, room_type_id, date)` granularity, enforcing canonical `ORDER BY hotel_id ASC, room_type_id ASC, date ASC` eliminates row-lock circular-wait deadlocks across multi-night stays, whereas Optimistic Concurrency Control (`version` CAS) avoids lock waits at low contention (`3 TPS`) at the cost of retry rollbacks on hot convention nights, and a database `CHECK` constraint provides the storage-level safety backstop.
- C) The deadlock happens only when the external Payment Service is called inside the transaction; moving the payment call outside fixes deadlocks without sorting dates.
- D) Switching transaction isolation to `READ UNCOMMITTED` prevents readers from blocking writers and eliminates write-write deadlocks on `room_type_inventory`.

<details><summary>Answer</summary>

**B.** By Coffman's theorem, deadlocks require a circular wait in the lock acquisition graph. When transactions lock pre-populated rows at uniform `(hotel_id, room_type_id, date)` primary-key granularity, sorting all multi-night queries and updates by `ORDER BY hotel_id ASC, room_type_id ASC, date ASC` forces every transaction to acquire row locks in a single topological order (a DAG), preventing row-lock circular wait. OCC (`version` CAS) works well at normal `3 TPS` chain loads without holding locks, but suffers retry amplification under flash-sale contention, while `CHECK (total_reserved <= (total_inventory * 110) / 100)` guarantees the invariant at the storage boundary.

- Why not A: `SELECT ... FOR UPDATE` on a primary key range takes row-level locks, not a table lock, and `FOR SHARE` allows concurrent shared reads that still deadlock or fail when upgraded to exclusive `UPDATE` locks.
- Why not C: While external payment RPCs must never run inside a lock-holding DB transaction, two 2-millisecond local transactions locking `(Dec 1, Dec 2)` vs `(Dec 2, Dec 1)` still deadlock without canonical date ordering.
- Why not D: `READ UNCOMMITTED` (treated as `READ COMMITTED` in PostgreSQL) does not remove exclusive row locks required by concurrent `UPDATE` statements and introduces dirty-read anomalies on other engines.
- Ref: [modules/19-hotel-reservation-system.md](../modules/19-hotel-reservation-system.md#3-concurrency-control-idempotency-locking-ordered-dates-and-database-constraints), https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-DEADLOCKS

</details>

---

### Q-SD-093 · High-Contention Booking, Overbooking & Reservation Systems · difficulty 3 · scenario

A hospitality platform scales from a `3 TPS` hotel chain to a `30,000 QPS` OTA by partitioning its relational database across `16` shards by `hotel_id` (`1,875 QPS/shard`) and streaming committed `room_type_inventory` changes via Debezium CDC into a Valkey/Redis inventory cache. During a burst, CDC lags by `150 ms`, and the cache shows `1` room available even though the shard database just reached its `110%` overbooking cap. Why does this CDC lag never cause an oversell?

- A) Debezium coordinates a synchronous Two-Phase Commit (2PC) between the PostgreSQL WAL and Valkey, blocking the database commit until the cache updates.
- B) The Valkey cache serves only the read-heavy browsing and funnel-preview tiers (`99%` of traffic), whereas `POST /v1/reservations` always validates and increments `total_reserved` directly inside the authoritative `hotel_id` relational database shard, which rejects the stale booking attempt with a `409 Sold Out` conflict.
- C) Setting a `1-second` TTL on all Valkey inventory keys guarantees the cache and database never diverge for more than one request.
- D) The API gateway automatically routes stale cache hits to a secondary unsharded NoSQL database that absorbs overflow bookings.

<details><summary>Answer</summary>

**B.** In this architecture, the Valkey CDC cache is an advisory read shield that offloads the `100:1` browse-to-book funnel, while the relational database shard remains the sole transactional authority for writes. When a user clicks "Book" based on a 150 ms-stale cache read, the database transaction checks `total_reserved + k <= (total_inventory * 110) / 100`, sees the cap is full, rolls back, and prompts the UI to refresh — trading a rare checkout rejection for massive read scalability with zero risk of overselling.

- Why not A: Debezium tails the database WAL/binlog asynchronously after transactions commit; coupling cache updates via synchronous 2PC would add cross-network latency and availability coupling to every database write.
- Why not C: A 1-second TTL destroys cache hit ratio across 73M rows and still cannot prevent two concurrent users from reading the same cached count within that 1-second window.
- Why not D: Writing overflow bookings to a separate NoSQL store bypasses the authoritative inventory counter and directly causes unmanaged overselling.
- Ref: [modules/19-hotel-reservation-system.md](../modules/19-hotel-reservation-system.md#4-ota-scale-out-sharding-by-hotel_id-and-cdc-driven-inventory-caching), https://debezium.io/documentation/reference/stable/

</details>

---

### Q-SD-094 · High-Contention Booking, Overbooking & Reservation Systems · difficulty 2 · ordering

Order the execution steps of an idempotent hotel reservation using a co-located Reservation+Inventory relational shard and an external Payment Service orchestrated via a Temporal Saga.

- A) Call external Payment Service with `reservation_id` → client generates `reservation_id` on checkout load → commit local ACID `PENDING_PAYMENT` inventory hold → mark reservation `CONFIRMED`
- B) Client generates `reservation_id` on checkout form load → execute single-shard local ACID transaction inserting `reservation` (`PENDING_PAYMENT` + `payload_hash`) and incrementing `room_type_inventory` over `[checkIn, checkOut)` → invoke external Payment Service idempotently with `reservation_id` after releasing DB row locks → transition reservation to `CONFIRMED` on capture (or run idempotent compensating transaction releasing `total_reserved` on definitive decline)
- C) Execute local ACID transaction incrementing `room_type_inventory` → hold `SELECT ... FOR UPDATE` row locks open while calling external Payment Service → generate `reservation_id` after payment succeeds → commit transaction
- D) Client generates `reservation_id` → mark reservation `CONFIRMED` immediately in Valkey cache → run nightly batch cron to charge payment card and decrement relational inventory

<details><summary>Answer</summary>

**B.** The checkout form first issues a stable client `reservation_id` (UUIDv7) so retries share one key. Next, a fast (`< 5 ms`) single-shard local ACID transaction atomically claims the `reservation_id` (verifying `payload_hash`) and increments `total_reserved` across `[checkIn, checkOut)` in state `PENDING_PAYMENT`, releasing database locks immediately. The Temporal saga then calls the Payment Service idempotently using `reservation_id`, and finally either transitions the booking to `CONFIRMED` or executes an idempotent compensating transaction that decrements `total_reserved` and sets `status = 'CANCELLED'` if payment is definitively declined.

- Why not A: Charging the customer before claiming inventory risks capturing money for a sold-out room, and calling the payment gateway before generating `reservation_id` leaves the charge without an idempotency key.
- Why not C: Holding database `FOR UPDATE` row locks across a `500–2,000 ms` external PSP network call exhausts the database connection pool and stalls all concurrent bookings for that hotel.
- Why not D: Confirming bookings in cache and deferring inventory/payment validation to a nightly batch job allows massive concurrent overselling and unpaid stays.
- Ref: [modules/19-hotel-reservation-system.md](../modules/19-hotel-reservation-system.md#5-microservice-consistency-co-located-acid-boundary-vs-2pc-and-saga-workflows), https://docs.temporal.io/

</details>

---

### Q-SD-095 · High-Contention Booking, Overbooking & Reservation Systems · difficulty 3 · multi

Which **two** statements accurately justify co-locating the `reservation` and `room_type_inventory` tables inside the same `hotel_id`-sharded relational database boundary and setting dynamic overbooking and fare-protection limits via Beckmann/Rothstein newsvendor overbooking, Littlewood's Rule, and Belobaba's $EMSR_b$?

- A) Co-locating `reservation` and `room_type_inventory` under the Reservation Service on the same `hotel_id` shard allows inserting the booking record and incrementing all `[checkIn, checkOut)` night rows in a single local ACID transaction (`< 5 ms`), avoiding fragile cross-service 2PC between separate Reservation and Inventory databases.
- B) Under Beckmann/Rothstein newsvendor overbooking optimization and Littlewood/$EMSR_b$ yield management, the optimal overbooking pad $B^*$ and nested rate protection limits balance expected marginal room revenue $R \cdot P(\text{no-shows} \ge b)$ against the expected walk-guest penalty $C_{\text{walk}} \cdot P(\text{no-shows} < b)$ (relocation hotel, transport, voucher, and brand churn), rather than applying a blind static ratio to non-refundable event nights.
- C) Co-locating the tables eliminates the need for `reservation_id` idempotency keys because a single relational database automatically detects duplicate user mouse clicks without a unique key.
- D) Sharding by `reservation_id` instead of `hotel_id` guarantees that all nights of a hotel's `room_type_inventory` reside on one shard with zero cross-shard queries.

<details><summary>Answer</summary>

**A, B.** Drawing the service boundary around the transactional invariant (`reservation` + `room_type_inventory` co-located per `hotel_id` shard) keeps every booking to a single-shard local ACID commit without distributed 2PC, and Beckmann/Rothstein overbooking with Littlewood/$EMSR_b$ yield management calibrates per-date overbooking pads and fare-class protection limits by weighing marginal revenue against the `$350–$600` walk-guest penalty $C_{\text{walk}}$.

- Why not C: Without a client-supplied `reservation_id` and `UNIQUE` constraint, two network packets from a double-click look like two distinct bookings to the database and double-book the guest.
- Why not D: Sharding by `reservation_id` scatters reservations randomly across shards while inventory queries filter by `hotel_id`, forcing cross-shard distributed transactions on every booking.
- Ref: [modules/19-hotel-reservation-system.md](../modules/19-hotel-reservation-system.md#5-microservice-consistency-co-located-acid-boundary-vs-2pc-and-saga-workflows), https://pubsonline.informs.org/doi/10.1287/opre.37.2.183

</details>

---

### Q-SD-096 · Distributed Email Systems, Deliverability & Mailbox Storage · difficulty 3 · scenario

A planetary email provider serves `1,000,000,000` (`1B`) users. Each user sends `10` messages/day and receives `40` messages/day. Average message metadata plus body is `50 KB`, and `20%` of received messages carry an attachment averaging `500 KB`. Attachments are transmitted over SMTP using RFC 2045 Base64 transfer encoding under a strict `25 MB` encoded MIME message ceiling. Which quantitative analysis and storage architecture is correct?

- A) The `25 MB` MIME ceiling permits `25 MB` of raw binary attachments, so persisting the Base64-encoded string directly in S3 adds zero storage overhead.
- B) Outbound send volume averages `~115.7k` emails/sec (`10^10 / 86,400`), received metadata plus bodies generate `2 PB/day` (`730 PB/year`), and raw attachments generate `4 PB/day` (`1,460 PB/year`, or `2.19 EB/year` combined raw). Because Base64 maps `3` binary bytes into `4` ASCII characters (`+33.3%` wire expansion), a `25 MB` MIME ceiling holds at most `~18.75 MB` of raw binary, making edge Base64 decoding and SHA-256 Content-Addressed Storage (CAS) deduplication in S3/GCS mandatory.
- C) Storage is dominated by `50 KB` text bodies (`1,460 PB/year`) rather than attachments (`365 PB/year`), so attachment deduplication is unnecessary.
- D) Outbound send volume averages `1.16M` emails/sec because `10^9` users sending `10` emails/day equals `10^11` emails/day.

<details><summary>Answer</summary>

**B.** Outbound volume is $10^9 \times 10 / 86{,}400 \approx 115{,}740.74\text{ msg/s}$ (`~100k/s` mental anchor). Inbound volume is $4 \times 10^{10}\text{ msg/day}$: at `50 KB` metadata+body, that produces $2\text{ PB/day} = 730\text{ PB/year}$; with `20%` carrying `500 KB` attachments ($8 \times 10^9 \times 500\text{ KB}$), raw attachments produce $4\text{ PB/day} = 1{,}460\text{ PB/year}$. RFC 2045 Base64 expands `3` binary bytes into `4` ASCII bytes (`4/3` ratio), so a `25 MB` MIME limit carries at most $25 \times \frac{3}{4} = 18.75\text{ MB}$ of raw binary; decoding Base64 at the edge avoids wasting `33.3%` (`+487 PB/yr`) of storage, and keying S3 objects by `SHA-256` with reference counting deduplicates broadcasts and forwards across recipients.

- Why not A: Base64 expands raw binary payloads by `+33.33%` (`4/3` ratio, plus `CRLF` line breaks every 76 chars), meaning `25%` of the encoded `25 MB` wire payload (`6.25 MB`) is encoding overhead; persisting raw Base64 text wastes `+33.3%` (`+487 PB/yr`) over raw binary storage and breaks cross-client hash deduplication.
- Why not C: Attachments (`1,460 PB/yr` raw) are twice as large as metadata and bodies (`730 PB/yr`), making attachment CAS deduplication the single largest storage saver.
- Why not D: $10^9 \times 10 = 10^{10}$ emails/day (`~115.7k/s`), not $10^{11}$ (`1.16M/s`).
- Ref: [modules/20-distributed-email-service.md](../modules/20-distributed-email-service.md#1-requirements-protocol-evolution-and-planetary-storage-sizing), https://www.rfc-editor.org/rfc/rfc2045

</details>

---

### Q-SD-097 · Distributed Email Systems, Deliverability & Mailbox Storage · difficulty 3 · scenario

A mailbox storage engine uses a wide-column store (Cassandra / ScyllaDB / Bigtable) partitioned by `user_id` and clustered by `email_id` (`TimeUUID` / `UUIDv7` sorted `DESC`). To support the UI's "Filter by Unread" view inside a folder, a developer proposes `SELECT * FROM emails_by_folder WHERE user_id = ? AND folder_id = ? AND is_read = false ALLOW FILTERING` under eventual consistency (`AP`). Why does this fail at scale, and what is the production solution?

- A) `ALLOW FILTERING` works in $O(1)$ time on non-clustering columns in Cassandra, so the only required change is switching `email_id` to random `UUIDv4`.
- B) Filtering on a non-clustering boolean column (`is_read`) forces a full partition scan across every historical email in the user's folder; instead, denormalize into `read_emails` and `unread_emails` projection tables keyed by `((user_id, folder_id), email_id DESC)` (or maintain a co-located per-user LSM secondary index over a `label_bitmask`) and enforce **CP strong consistency** so read/delete mutations never resurrect or split-brain across a user's devices.
- C) Partition the primary table by `email_id` instead of `user_id` so each message sits on its own node, and query unread messages via a global scatter-gather scan.
- D) Use an eventually consistent AP ring with wall-clock Last-Write-Wins (LWW) and rebuild unread views once a day via a MapReduce batch job.

<details><summary>Answer</summary>

**B.** Wide-column stores only seek efficiently along the `(partition_key, clustering_key)` prefix. Because `is_read` is a mutable boolean attribute rather than the leading clustering column, `ALLOW FILTERING` scans all historical rows in the partition. Denormalizing into `read_emails` and `unread_emails` keyed by `((user_id, folder_id), email_id DESC)` (moving `email_id` between the two tables atomically when toggled) turns unread listing into a sequential clustering scan, and choosing **CP** consistency prevents deleted or read emails from reappearing as unread across phone and laptop sessions.

- Why not A: `ALLOW FILTERING` performs a linear scan over the partition on disk, and random `UUIDv4` destroys chronological `DESC` sorting.
- Why not C: Partitioning by `email_id` destroys per-user locality, turning every single inbox load into a cluster-wide scatter-gather query.
- Why not D: An unread filter must reflect flag toggles within milliseconds across devices; daily batch rebuilds and AP LWW staleness break core mailbox UX.
- Ref: [modules/20-distributed-email-service.md](../modules/20-distributed-email-service.md#3-mailbox-storage-engine-data-modeling-threading-and-attachment-deduplication), https://cassandra.apache.org/doc/latest/cassandra/developing/data-modeling/index.html

</details>

---

### Q-SD-098 · Distributed Email Systems, Deliverability & Mailbox Storage · difficulty 3 · single

An attacker sends a phishing message with the visible RFC 5322 header `From: "Bank Security" <security@bank.com>`, using an SMTP envelope sender `MAIL FROM:<bounces@evil-phish.org>` from an IP address that is legitimately authorized by `evil-phish.org`'s SPF record (`SPF pass`). Which statement accurately explains how DMARC (RFC 7489) and ARC (RFC 8617) handle this attack versus a legitimate mailing-list forward?

- A) Because SPF passed for `evil-phish.org`, DMARC automatically accepts the message regardless of the visible `From:` domain.
- B) DMARC enforces **Identifier Alignment** between the visible RFC 5322 `From:` domain (`bank.com`) and the authenticated SPF `MAIL FROM` domain (`evil-phish.org`) or DKIM `d=` domain; because `evil-phish.org` does not align with `bank.com` and the message lacks a valid `bank.com` DKIM signature, DMARC fails and rejects the spoofed email, whereas on a legitimate mailing-list forward where the list server's IP breaks SPF and a list footer breaks DKIM, a cryptographically verified **ARC (`RFC 8617`)** seal chain from a trusted forwarder preserves the original `i=1` pass verdict.
- C) ARC replaces DMARC by automatically rewriting the visible `From:` header of every email to match the receiving server's hostname.
- D) DMARC checks alignment solely against the SMTP `RCPT TO` recipient address and ignores `DKIM-Signature` headers completely.

<details><summary>Answer</summary>

**B.** Plain SPF (RFC 7208) only authenticates the invisible RFC 5321 envelope `MAIL FROM` domain, leaving the human-visible RFC 5322 `From:` header unprotected against spoofing. DMARC (RFC 7489) requires that the `From:` domain match (`strict` exact or `relaxed` organizational match) either a passing SPF domain or a passing DKIM `d=` domain. Because `evil-phish.org != bank.com`, DMARC rejects the phishing attempt. Conversely, when a legitimate email passes through a mailing list that alters the sending IP (breaking SPF) and appends a footer (breaking DKIM), **ARC (RFC 8617)** chains signed `ARC-Authentication-Results` and `ARC-Seal` headers (`i=1..N`) so the recipient MTA can verify that the message authenticated cleanly when it entered the forwarder.

- Why not A: Passing SPF on an unaligned attacker domain (`evil-phish.org`) fails DMARC alignment against `From: security@bank.com`.
- Why not C: ARC never rewrites `From:` into the receiver's hostname; it signs a cryptographic chain of custody across intermediaries.
- Why not D: DMARC aligns the sender's `From:` domain against SPF (`MAIL FROM`) and DKIM (`d=`), never against `RCPT TO`.
- Ref: [modules/20-distributed-email-service.md](../modules/20-distributed-email-service.md#4-email-deliverability-authentication-and-bulk-sender-guardrails), https://www.rfc-editor.org/rfc/rfc7489

</details>

---

### Q-SD-099 · Distributed Email Systems, Deliverability & Mailbox Storage · difficulty 2 · ordering

Order the execution steps of the outbound email sending pipeline from client submission (`POST /v1/messages`) through delivery or transient retry deferral.

- A) L7 per-user rate limit → Web server RFC 5322/size validation & raw attachment extraction to S3 SHA-256 CAS → internal same-domain short-circuit evaluation (after running spam/virus scan) or enqueue to Outgoing Kafka Queue → Outgoing SMTP Worker signs DKIM, resolves DNS MX + MTA-STS policy, and transmits over TLS (or routes transient `4xx` deferrals to the jittered exponential-backoff Retry Queue) → persist copy in sender's `Sent` folder
- B) Outgoing Kafka Queue → L7 per-user rate limit → transmit over unencrypted SMTP before DKIM signing → upload Base64 attachments to S3 → run spam scan after delivery
- C) Persist copy in `Sent` folder → bypass spam scan on internal same-domain messages → Web server size check → L7 per-user rate limit → Outgoing Kafka Queue
- D) L7 per-user rate limit → hold synchronous HTTP client request open for `72 hours` across all `4xx` remote MTA greylisting retries → validate message size after remote MTA accepts

<details><summary>Answer</summary>

**A.** The L7 load balancer first enforces per-user send rate limits to block compromised account floods. The web server validates header grammar and the `25 MB` MIME size ceiling, strips attachments into S3 Content-Addressed Storage (`SHA-256`), and routes invalid requests to the error queue. Valid messages run spam/virus checks (short-circuiting external DNS MX/SMTP relay if the recipient is on the same domain, while never bypassing anti-spam!) or enter the Outgoing Kafka Queue. Outgoing SMTP workers sign with DKIM, resolve DNS MX and MTA-STS policies, deliver over TLS (routing transient `4xx` deferrals to an exponential-backoff retry queue up to `72 hours`), and record the sent message in the `Sent` folder.

- Why not B: Enqueuing and transmitting before rate limiting, validation, attachment extraction, DKIM signing, and spam scanning allows abusive or malformed payloads onto the wire.
- Why not C: Skipping anti-spam checks on internal same-domain mail allows phished internal accounts to pivot laterally without inspection.
- Why not D: Remote MTA `4xx` retries span hours (`5m..72h`) and must execute asynchronously via a durable retry queue rather than blocking an HTTP connection.
- Ref: [modules/20-distributed-email-service.md](../modules/20-distributed-email-service.md#2-high-level-architecture-and-end-to-end-send-and-receive-pipelines), https://www.rfc-editor.org/rfc/rfc5321

</details>

---

### Q-SD-100 · Distributed Email Systems, Deliverability & Mailbox Storage · difficulty 3 · multi

Select **two** accurate architectural statements contrasting write-heavy per-user email search and modern client sync against global web search and legacy IMAP.

- A) Email search is **write-heavy** and strictly isolated to a single `user_id` (every delivered email, read toggle, folder move, or deletion triggers an index write while users search infrequently), so an Elasticsearch cluster must set `_routing = user_id` to keep a user's documents on one shard — or be replaced at planetary scale by a co-located per-user **LSM-tree inverted index** (MemTable $\to$ immutable SSTables) that turns random index updates into sequential disk I/O without duplicating storage clusters.
- B) **JMAP (RFC 8620 / RFC 8621)** replaces stateful folder-pinned IMAP4 TCP connections with stateless HTTP/2+ batched JSON method calls and `Email/changes` delta state tokens, cutting mobile battery drain and round-trip chattiness while scaling horizontally behind standard L7 load balancers.
- C) Email search should omit `_routing = user_id` and scatter every user's emails evenly across all `100` Elasticsearch shards so that every single-user search query fans out to all `100` shards.
- D) Web search is more write-heavy than email search because users run fewer search queries on Google than in their personal email inbox.

<details><summary>Answer</summary>

**A, B.** Because every mailbox mutation (`463k/s` inbound + flag/folder updates) triggers an index write while users search rarely, email search is write-heavy and strictly scoped to one `user_id`. Routing by `user_id` in Elasticsearch avoids cluster-wide scatter-gather queries, while a co-located per-user LSM index eliminates dual-cluster petabyte duplication and converts token updates into sequential SSTable flushes. On the client sync tier, JMAP (RFC 8620/8621) replaces stateful IMAP TCP sessions with stateless HTTP/2+ batched JSON requests and delta sync tokens.

- Why not C: Scattering a single user's emails across all `100` shards forces a `100-shard` fan-out on every search query, multiplying tail latency and CPU overhead by `100x`.
- Why not D: Web search is overwhelmingly read-heavy over a shared global corpus, whereas email search is write-heavy over isolated per-user partitions.
- Ref: [modules/20-distributed-email-service.md](../modules/20-distributed-email-service.md#5-write-heavy-per-user-email-search-elasticsearch-vs-custom-lsm-indexes), https://www.rfc-editor.org/rfc/rfc8620

</details>

---

## Timed Mock Exam: Written Architecture Drill (50 Questions · 75 Minutes)

Simulate written Staff/Principal screening conditions using this 50-question subset drawn proportionally from the seven competency domains in [`exams/README.md`](README.md).

- **Time limit**: **75 minutes** (~90 seconds per question). Do not open `<details>` answer blocks until you finish all 50 items.
- **Scoring & Calibration**: Score 1 point per exact question match (partial credit is not awarded on `multi` questions).
  - **Senior readiness**: $\ge 36 / 50$ ($72\%$)
  - **Staff readiness**: $\ge 42 / 50$ ($84\%$)
  - **Principal readiness**: $\ge 46 / 50$ ($92\%$)

### Domain Allocation (50 Questions)

| Competency Domain | Exam Weight | Mock Question Count | Selected Bank IDs |
| --- | :-: | :-: | --- |
| Requirements, Estimation & Capacity Modeling | 15% | 7 | `Q-SD-001`, `Q-SD-002`, `Q-SD-003`, `Q-SD-005`, `Q-SD-007`, `Q-SD-008`, `Q-SD-010` |
| Edge, API Design, Data Modeling & ID Generation | 15% | 7 | `Q-SD-011`, `Q-SD-012`, `Q-SD-014`, `Q-SD-015`, `Q-SD-017`, `Q-SD-018`, `Q-SD-020` |
| Caching, Scaling Reads/Writes & Partitioning | 15% | 8 | `Q-SD-021`, `Q-SD-022`, `Q-SD-023`, `Q-SD-024`, `Q-SD-025`, `Q-SD-027`, `Q-SD-028`, `Q-SD-030` |
| Asynchrony, Rate Limiting & Resilience Engineering | 15% | 8 | `Q-SD-032`, `Q-SD-033`, `Q-SD-034`, `Q-SD-035`, `Q-SD-037`, `Q-SD-038`, `Q-SD-039`, `Q-SD-041` |
| Specialized Indexing, Contention & Financial Correctness | 15% | 7 | `Q-SD-043`, `Q-SD-044`, `Q-SD-045`, `Q-SD-046`, `Q-SD-047`, `Q-SD-049`, `Q-SD-052` |
| Observability, SLO Math & Disaster Recovery | 10% | 5 | `Q-SD-053`, `Q-SD-054`, `Q-SD-055`, `Q-SD-057`, `Q-SD-060` |
| End-to-End Canonical Architectures & Staff Deep Dives | 15% | 8 | `Q-SD-061`, `Q-SD-062`, `Q-SD-063`, `Q-SD-064`, `Q-SD-065`, `Q-SD-066`, `Q-SD-067`, `Q-SD-070` |

### Scoring Key (50 Items)

| Mock # | Bank ID | Domain | Type | Difficulty | Answer |
| :-: | --- | --- | --- | :-: | :-: |
| 1 | `Q-SD-001` | Requirements, Estimation & Capacity Modeling | `single` | 2 | **B** |
| 2 | `Q-SD-002` | Requirements, Estimation & Capacity Modeling | `scenario` | 3 | **C** |
| 3 | `Q-SD-003` | Requirements, Estimation & Capacity Modeling | `scenario` | 3 | **A** |
| 4 | `Q-SD-005` | Requirements, Estimation & Capacity Modeling | `multi` | 3 | **B, C** |
| 5 | `Q-SD-007` | Requirements, Estimation & Capacity Modeling | `scenario` | 3 | **A** |
| 6 | `Q-SD-008` | Requirements, Estimation & Capacity Modeling | `scenario` | 3 | **C** |
| 7 | `Q-SD-010` | Requirements, Estimation & Capacity Modeling | `multi` | 3 | **B, C** |
| 8 | `Q-SD-011` | Edge, API Design, Data Modeling & ID Generation | `scenario` | 3 | **B** |
| 9 | `Q-SD-012` | Edge, API Design, Data Modeling & ID Generation | `single` | 3 | **B** |
| 10 | `Q-SD-014` | Edge, API Design, Data Modeling & ID Generation | `scenario` | 3 | **B** |
| 11 | `Q-SD-015` | Edge, API Design, Data Modeling & ID Generation | `multi` | 3 | **A, C** |
| 12 | `Q-SD-017` | Edge, API Design, Data Modeling & ID Generation | `scenario` | 3 | **B** |
| 13 | `Q-SD-018` | Edge, API Design, Data Modeling & ID Generation | `single` | 3 | **B** |
| 14 | `Q-SD-020` | Edge, API Design, Data Modeling & ID Generation | `scenario` | 3 | **A** |
| 15 | `Q-SD-021` | Caching, Scaling Reads/Writes & Partitioning | `scenario` | 3 | **A** |
| 16 | `Q-SD-022` | Caching, Scaling Reads/Writes & Partitioning | `single` | 3 | **B** |
| 17 | `Q-SD-023` | Caching, Scaling Reads/Writes & Partitioning | `scenario` | 3 | **B** |
| 18 | `Q-SD-024` | Caching, Scaling Reads/Writes & Partitioning | `single` | 3 | **B** |
| 19 | `Q-SD-025` | Caching, Scaling Reads/Writes & Partitioning | `scenario` | 3 | **A** |
| 20 | `Q-SD-027` | Caching, Scaling Reads/Writes & Partitioning | `scenario` | 3 | **A** |
| 21 | `Q-SD-028` | Caching, Scaling Reads/Writes & Partitioning | `ordering` | 3 | **B** |
| 22 | `Q-SD-030` | Caching, Scaling Reads/Writes & Partitioning | `scenario` | 3 | **B** |
| 23 | `Q-SD-032` | Asynchrony, Rate Limiting & Resilience Engineering | `single` | 3 | **A** |
| 24 | `Q-SD-033` | Asynchrony, Rate Limiting & Resilience Engineering | `scenario` | 3 | **A** |
| 25 | `Q-SD-034` | Asynchrony, Rate Limiting & Resilience Engineering | `scenario` | 3 | **B** |
| 26 | `Q-SD-035` | Asynchrony, Rate Limiting & Resilience Engineering | `scenario` | 3 | **A** |
| 27 | `Q-SD-037` | Asynchrony, Rate Limiting & Resilience Engineering | `scenario` | 3 | **A** |
| 28 | `Q-SD-038` | Asynchrony, Rate Limiting & Resilience Engineering | `single` | 3 | **A** |
| 29 | `Q-SD-039` | Asynchrony, Rate Limiting & Resilience Engineering | `multi` | 3 | **A, B** |
| 30 | `Q-SD-041` | Asynchrony, Rate Limiting & Resilience Engineering | `ordering` | 3 | **B** |
| 31 | `Q-SD-043` | Specialized Indexing, Contention & Financial Correctness | `scenario` | 3 | **B** |
| 32 | `Q-SD-044` | Specialized Indexing, Contention & Financial Correctness | `scenario` | 3 | **B** |
| 33 | `Q-SD-045` | Specialized Indexing, Contention & Financial Correctness | `scenario` | 3 | **A** |
| 34 | `Q-SD-046` | Specialized Indexing, Contention & Financial Correctness | `scenario` | 3 | **C** |
| 35 | `Q-SD-047` | Specialized Indexing, Contention & Financial Correctness | `multi` | 3 | **A, C** |
| 36 | `Q-SD-049` | Specialized Indexing, Contention & Financial Correctness | `scenario` | 3 | **A** |
| 37 | `Q-SD-052` | Specialized Indexing, Contention & Financial Correctness | `ordering` | 3 | **B** |
| 38 | `Q-SD-053` | Observability, SLO Math & Disaster Recovery | `scenario` | 3 | **A** |
| 39 | `Q-SD-054` | Observability, SLO Math & Disaster Recovery | `single` | 3 | **A** |
| 40 | `Q-SD-055` | Observability, SLO Math & Disaster Recovery | `scenario` | 3 | **B** |
| 41 | `Q-SD-057` | Observability, SLO Math & Disaster Recovery | `scenario` | 3 | **B** |
| 42 | `Q-SD-060` | Observability, SLO Math & Disaster Recovery | `scenario` | 3 | **B** |
| 43 | `Q-SD-061` | End-to-End Canonical Architectures & Staff Deep Dives | `scenario` | 3 | **A** |
| 44 | `Q-SD-062` | End-to-End Canonical Architectures & Staff Deep Dives | `scenario` | 3 | **A** |
| 45 | `Q-SD-063` | End-to-End Canonical Architectures & Staff Deep Dives | `scenario` | 3 | **B** |
| 46 | `Q-SD-064` | End-to-End Canonical Architectures & Staff Deep Dives | `scenario` | 3 | **B** |
| 47 | `Q-SD-065` | End-to-End Canonical Architectures & Staff Deep Dives | `scenario` | 3 | **B** |
| 48 | `Q-SD-066` | End-to-End Canonical Architectures & Staff Deep Dives | `scenario` | 3 | **B** |
| 49 | `Q-SD-067` | End-to-End Canonical Architectures & Staff Deep Dives | `scenario` | 3 | **B** |
| 50 | `Q-SD-070` | End-to-End Canonical Architectures & Staff Deep Dives | `multi` | 3 | **A, B** |

---

## Timed Mock Design Loops (2 × 60-Minute Staff/Principal Simulations)

Run each loop with a blank whiteboard or Markdown scratchpad under a strict **60-minute timer**. Self-grade strictly against the 0–4 Staff/Principal rubric after stopping the clock.

### Loop A: Global Flash-Sale Ticketing & Multi-Currency Payment Platform

**Prompt**: Design a global flash-sale event ticketing and payment platform capable of handling a stadium tour drop with **50,000 reserved seats** and **10,000,000 concurrent fans** hitting the site at `10:00:00` local time across North America, Europe, and APAC. Guarantees: **zero overselling** (two fans must never hold or confirm the same seat), **zero double-charging**, **10-minute checkout hold TTL**, multi-currency PSP checkout (`USD`, `EUR`, `GBP`, `JPY`), and **99.99% checkout availability** once a fan enters checkout.

#### Loop A · Minute-by-Minute Timeboxing

| Phase | Time Window | Mandatory Deliverables & Checkpoint |
| --- | :-: | --- |
| 1. Framing & Invariants | `00:00–06:00` | Separate browsing/queueing from scarce checkout invariants; distinguish hard invariants (zero oversell, zero double-charge, RPO = 0 ledger) from soft browsing SLAs (1–2s stale seat-map cache). Log multi-region consistency choice (single authoritative shard per event vs active-active). |
| 2. Quantitative Capacity Model | `06:00–13:00` | Compute waiting-room ingress QPS (10M users -> ~1M–3M QPS edge traffic), admitted checkout rate (e.g., 50k seats sold over 10 min = ~83 bookings/sec steady, ~500–2,000 checkout attempts/sec peak), DB connection pool sizing via Little's Law, and Redis/Postgres hold memory footprint. |
| 3. Core Architecture & APIs | `13:00–25:00` | Draw end-to-end flow: Edge CDN + Virtual Waiting Room -> API Gateway (signed admission token + `Idempotency-Key`) -> Seat-Map Cache (CDN/Redis) -> Inventory Service (PostgreSQL/sharded holds) -> Payment & Double-Entry Ledger Service -> PSP Gateway + Reconciliation Workers. Define key API contracts and DB schema (`seats`, `holds`, `ledger_entries`, `idempotency_keys`). |
| 4. Deep Dive: Contention & Financial Correctness | `25:00–45:00` | Walk through exact locking/CAS mechanics (`UPDATE seats ... WHERE status='AVAILABLE' AND version=$v`, `FOR UPDATE SKIP LOCKED` for GA), Redis/DB TTL expiry race (fencing tokens preventing zombie hold capture after expiry), PSP 504 `PENDING_RECONCILIATION` flow, and hot escrow account sharding. |
| 5. Resilience, SLOs & Adversarial Pushback | `45:00–60:00` | Handle PSP region outage, bot/scalper rate limiting (GCRA + device/token challenges), multi-window burn-rate alerts (`14.4×` 1h/5m for 99.99% SLO = 4.32 min/month), and disaster recovery failover without split-brain. |

#### Loop A · Mandatory Quantitative Calculations

- **Edge waiting-room ingress**: 10,000,000 concurrent fans refreshing or polling/SSE at ~0.2–0.5 req/s = **2M–5M RPS** at the edge CDN/waiting-room tier; static wait-room HTML + SSE/long-poll jitter absorbs 99.9% of traffic before origin.
- **Admitted DB write load**: Admission rate capped at e.g. `2,000` users/sec; assuming 3 seat-click attempts per user before hold succeeds = `6,000` atomic hold mutations/sec partitioned across event shards (or `~500`–`1,000` TPS per shard if one mega-stadium is sharded by section/row).
- **Little's Law DB pool sizing**: At `2,000` admitted hold queries/sec and `W = 10 ms` p95 transaction time, active DB concurrency is $L = 2{,}000 \times 0.010 = 20$ connections (spiking to $100$ connections at 50 ms tail). Sizing pools around ~100–150 connections per shard via PgBouncer prevents PostgreSQL context-switch collapse.
- **Seat-map payload & egress**: 50,000 seats encoded as a compact bitset/run-length array = ~6.25 KB raw (~2–4 KB gzipped). Serving 200k browsing refreshes/sec from CDN/Origin Shield at 4 KB = **800 MB/s (6.4 Gbps)** edge egress—trivial for CDN, catastrophic if rendered dynamically from PostgreSQL.
- **99.99% monthly error budget**: $43{,}200 \times 0.0001 = 4.32\text{ minutes}$ per 30 days; a `14.4×` burn rate (`0.144%` error rate) burns 2% ($5.2\text{ seconds}$ equivalent) in 1 hour and triggers an immediate page over `1h/5m`.

#### Loop A · Adversarial Interviewer Pushback Prompts

1. _"Why not just store all 50,000 seats in a single PostgreSQL table and let 10M users click directly with `SELECT ... FOR UPDATE`?"_ (Expected: lock convoys behind hot rows, connection pool exhaustion, metastable retry storms.)
2. _"A fan holds Seat A12 for 9:59, clicks Pay at 9:59.5, and the hold TTL reaper frees Seat A12 at 10:00.1 while the payment worker was paused in GC before charging the card. How do you guarantee Seat A12 isn't sold twice?"_ (Expected: monotonic fencing token / `hold_version` checked inside the atomic DB state transition _before_ capture—or two-step Auth-then-Capture where Auth is voided if the hold token lost the atomic DB transition.)
3. _"Stripe returns HTTP `504` after 8 seconds on a \$450 EUR payment. Your client wants to try Adyen immediately so the fan doesn't lose their seat. Walk me through what breaks if you fail over on a timeout."_ (Expected: `504` = unknown outcome; failing over to Adyen risks silent dual-PSP double-charging; must mark `PENDING_RECONCILIATION`, preserve `Idempotency-Key`, extend hold briefly or query Stripe status API before void/capture.)
4. _"Why do all 50,000 payments hitting your single `platform_escrow_eur` ledger row serialize your checkout TPS at ~2,000 TPS?"_ (Expected: single-row `UPDATE` lock contention on hot escrow account; fix via $K$ sharded escrow sub-accounts or deferred batch settlement aggregation.)

#### Loop A · Red Flags (Automatic Level Downgrade)

- Allowing unthrottled traffic from the 10M-fan landing page directly onto transactional PostgreSQL primaries.
- Storing seat status solely in an eventually consistent cache without an authoritative conditional DB CAS (`WHERE status = 'AVAILABLE'`).
- Treating PSP timeouts as "payment failed" and issuing retries with fresh `Idempotency-Key`s or failing over across PSPs blindly.
- Using floating-point (`DOUBLE` / `FLOAT`) columns for multi-currency financial ledger amounts (`USD` vs zero-decimal `JPY` minor units!).
- Polling the database every 100 ms with `SELECT * FROM seats` for every waiting fan without edge caching or waiting-room admission control.

#### Loop A · Staff/Principal Grading Rubric (0–4 Scale)

| Dimension | 0–1 (Below Senior) | 2 (Solid Senior) | 3 (Staff) | 4 (Principal) |
| --- | --- | --- | --- | --- |
| **Framing & Quantitative Sizing** | Skips capacity math or miscalculates orders of magnitude; conflates 10M fans with 10M DB TPS. | Estimates QPS, storage, and basic bandwidth; separates browsing from checkout writes. | Applies Little's Law to DB pools, models bitset seat-map egress, and explicitly logs single-event consistency vs multi-region latency trade-offs. | Models shard-level write ceilings, waiting-room drain math, currency minor-unit precision (`JPY` 0 decimals vs `USD` 2), and error-budget margins proactively. |
| **Contention & Seat-Hold Correctness** | Relies on `READ COMMITTED` read-then-write or unguarded `FOR UPDATE` causing deadlocks/oversell. | Uses TTL holds + optimistic locking (`version`) or `SKIP LOCKED` for GA seats. | Synthesizes Edge Virtual Waiting Room + sharded atomic holds + monotonic fencing tokens closing the TTL expiry vs GC-pause race. | Proves safety under every interleaving (hold expiry vs late payment, Auth-vs-Capture voiding, sharded seat-section partitioning for single mega-events). |
| **Financial & Payment Correctness** | No idempotency keys, mutable balance floats, or fails over to backup PSP on `504`. | Uses `Idempotency-Key`, integer cents, and double-entry ledger rows. | Models `PENDING_RECONCILIATION` for `504` unknown outcomes, hashes request payloads on idempotency keys, and shards hot escrow rows. | Designs full T+1 automated PSP settlement reconciliation, idempotent chargeback/refund state machines, and zero-downtime currency ledger isolation. |
| **Resilience, SLOs & Operations** | No rate limiting, deep DB `/readyz` checks, or vague "add more servers" scaling. | Adds token-bucket rate limiting, circuit breakers, and basic metrics. | Specifies GCRA / Redis Lua edge limits, shallow `/livez`, multi-window burn-rate alerts (`14.4×` 1h/5m), and LIFO load shedding. | Designs static-stable multi-AZ failover without split-brain, bounded retry budgets against metastable storms, and safe canary/feature-flag rollback. |

---

### Loop B: Multi-Tenant Real-Time LLM Inference & RAG Gateway

**Prompt**: Design a multi-tenant LLM inference and Retrieval-Augmented Generation (RAG) gateway serving **100,000 incoming API RPS** (bursty mixed traffic: 80% lightweight RAG/embedding/cached lookups, 20% streaming LLM completions averaging 2,000 prompt tokens + 500 output tokens) across a 70B BF16 flagship model and smaller 8B routing models. Requirements: **TTFT (Time To First Token) p95 $\le 400\text{ ms}$**, **ITL (Inter-Token Latency) p95 $\le 35\text{ ms}$**, strict **per-tenant RPM and TPM (Tokens Per Minute) fairness**, zero cross-tenant KV/prompt cache leaks, and **99.95% monthly availability SLO**.

#### Loop B · Minute-by-Minute Timeboxing

| Phase | Time Window | Mandatory Deliverables & Checkpoint |
| --- | :-: | --- |
| 1. Framing & Latency Decomposition | `00:00–06:00` | Separate gateway/RAG orchestration from GPU inference planes; split latency SLOs into **TTFT** (routing + RAG vector retrieval + prefill) vs **ITL/TPOT** (autoregressive decode streaming). Surface tenant isolation & strict no-cross-tenant-leak invariants. |
| 2. VRAM, Bandwidth & Token Math | `06:00–15:00` | Calculate 70B BF16 weight footprint (~140 GB), **KV-cache bytes/token** (GQA: e.g., 320 KiB/token), max concurrent sequences per 8× H100 node, SSE connection concurrency via Little's Law, and token-stream bandwidth. |
| 3. Core Architecture & Streaming Transport | `15:00–27:00` | Draw topology: Edge L7 Proxy (HTTP/2–3 SSE, P2C routing) -> Auth & Dual Rate Limiter (RPM + post-prefill/estimated TPM GCRA/Token Bucket in Redis Lua) -> Semantic/RAG Retrieval Tier (hybrid BM25 + HNSW vector shard) -> GPU Inference Scheduler (continuous batching + PagedAttention + prefix caching + prefill/decode disaggregation). |
| 4. Deep Dive: GPU Scheduling, Rate Limiting & Isolation | `27:00–47:00` | Explain how PagedAttention eliminates fragmentation, why prefill-decode disaggregation prevents 16k-token prompts from stalling active decode streams, how two-phase TPM accounting works (reserve estimated `max_tokens`, reconcile actual completion tokens after `EOS`), and why prompt-prefix sharing MUST key on `(tenant_id, model_id, hash)` or strict hash collision safety. |
| 5. Resilience, SLOs & Failure Modes | `47:00–60:00` | Handle noisy-neighbor GPU OOM / KV-cache preemption, adaptive load shedding / model downgrade fallback (70B -> 8B under overload if permitted), `14.4×` / `6×` burn-rate SLOs for 99.95% (21.6 min/mo), and tail-based OTel trace sampling for slow TTFT forensics. |

#### Loop B · Mandatory Quantitative Calculations

- **Streaming LLM concurrency (Little's Law)**: 20% of 100,000 RPS equals `20,000` new streaming completions/sec. Generating 500 output tokens at ~50 tokens/s yields an average stream duration of $W = 10\text{ s}$, giving $L = 20{,}000 \times 10 = 200{,}000$ simultaneously open SSE streams globally; size edge gateway file descriptors, HTTP/2 `MAX_CONCURRENT_STREAMS`, and socket buffers (`~32 KB/conn` $\approx$ 6.4 GB gateway socket RAM across the fleet).
- **70B KV-cache VRAM math**: With 80 layers, 8 GQA KV heads, `head_dim = 128`, BF16 (2 bytes): $2 \times 80 \times 8 \times 128 \times 2 = 327{,}680\text{ B/token} = 320\text{ KiB/token}$. For an average 2,500-token context (`2,000 prompt + 500 output`), each active request needs $2{,}500 \times 320\text{ KiB} \approx 781\text{ MiB}$ KV cache. On an 8× 80 GB H100 node (640 GiB total VRAM; ~140 GB weights + ~60 GB activations/overhead = **~440 GiB KV headroom**), one 8× H100 node holds at most $\approx 440{,}000 / 781 \approx 560$ active sequences concurrently (ignoring prefix sharing).
- **Cluster sizing from concurrency**: Sustaining `200,000` active concurrent sequences at ~560 sequences/node requires $\approx 357$ 8× H100 nodes (~2,856 H100 GPUs) before prefix sharing or FP8 KV-cache quantization (which halves KV footprint to ~160 KiB/token, cutting nodes ~2×!).
- **RAG retrieval budget**: Total TTFT p95 $\le 400\text{ ms}$ minus ~50 ms network/TLS/auth leaves **$\le 120\text{ ms}$** for hybrid vector+BM25 retrieval + reranking and **$\le 230\text{ ms}$** for 2k-token prefill.
- **99.95% monthly error budget**: $43{,}200 \times 0.0005 = 21.6\text{ minutes}$ per 30 days; define separate SLIs for **Gateway Acceptance Availability**, **TTFT Goodput Ratio** ($\le 400\text{ ms}$), and **ITL Goodput Ratio** ($\le 35\text{ ms}$).

#### Loop B · Adversarial Interviewer Pushback Prompts

1. _"Why can't you enforce a strict TPM (Tokens Per Minute) rate limit purely at the API gateway before forwarding the request to the GPU cluster?"_ (Expected: output token count is unknown upfront! Must do two-phase reservation: charge `prompt_tokens + min(max_tokens, default_est)` atomically via Redis Lua before dispatch, then refund/reconcile unused token delta once `EOS` completes—and enforce strict `max_tokens` caps.)
2. _"A single enterprise tenant starts firing 16,000-token prompts simultaneously. Suddenly every *other* tenant's streaming response freezes for 1.5 seconds between words. Why did that happen and how do you eliminate it?"_ (Expected: chunked-prefill / prefill-decode interference on shared GPUs where compute-heavy 16k prefill stalls decode iterations; fix via **prefill-decode disaggregation** + **chunked prefill** + per-tenant fair-queueing/admission caps.)
3. _"Your team enables RadixAttention / automatic KV-cache prefix sharing across requests to save 40% VRAM. Security raises a P0 blocker: could Tenant B infer or leak Tenant A's proprietary system prompt via timing side-channels or block collisions?"_ (Expected: shared cache lookup MUST namespace KV-block hashes by `tenant_id` (zero cross-tenant sharing), or restrict shared prefixes strictly to global public system/tool templates; timing side-channels prove shared cache residency across tenants!)
4. _"One GPU node's InfiniBand link degrades silently, causing its decode ITL to jump from 25 ms to 300 ms, while HTTP `/livez` still returns `200 OK`. How does your router stop sending new streams there without flapping the whole fleet?"_ (Expected: P2C routing weighted by active EWMA TTFT/queue depth + outlier ejection / bounded circuit breaker per GPU worker, keeping shallow `/livez` intact.)

#### Loop B · Red Flags (Automatic Level Downgrade)

- Proposing WebSockets without justifying why HTTP/2–3 SSE isn't simpler, or ignoring `MAX_CONCURRENT_STREAMS` / proxy buffering (`X-Accel-Buffering: no`) on SSE streams.
- Using static batching or pre-allocating max-context KV-cache buffers per request (destroying GPU utilization).
- Ignoring the two-phase TPM accounting problem (only counting requests/RPM while one user sends 100k-token prompts).
- Allowing cross-tenant KV-cache prefix sharing keyed solely on prompt text hash without `tenant_id` isolation.
- Reporting average per-host GPU p99 latencies instead of histogram-aggregated TTFT/ITL distributions.

#### Loop B · Staff/Principal Grading Rubric (0–4 Scale)

| Dimension | 0–1 (Below Senior) | 2 (Solid Senior) | 3 (Staff) | 4 (Principal) |
| --- | --- | --- | --- | --- |
| **Quantitative GPU & Concurrency Math** | Treats GPUs like stateless CPU web workers; ignores KV-cache VRAM or open SSE stream concurrency. | Estimates total QPS and rough GPU count from throughput tokens/sec. | Computes exact KV-cache KiB/token (layers × KV heads × head_dim × 2 × bytes), active concurrency via Little's Law, and TTFT vs ITL latency budgets. | Connects FP8 KV quantization, prefix-share hit ratios, and HBM bandwidth vs FLOP bottlenecks directly to node topology and egress/GPU cost modeling. |
| **Inference & RAG Architecture** | Proposes naive REST polling and static batching on single-GPU Flask servers. | Includes vector DB RAG, SSE streaming, continuous batching, and basic caching. | Designs PagedAttention block allocation, continuous iteration-level batching, prefill-decode disaggregation, and hybrid BM25+vector retrieval under TTFT budget. | Optimizes prefix-aware consistent-hash routing (routing same tenant/session to warm KV cache affinity via P2C/consistent hash) and chunked prefill scheduling. |
| **Multi-Tenancy & Rate Limiting** | Global single-counter rate limit or ignores token-length asymmetry (RPM only). | Implements Redis token-bucket RPM + approximate input token limits. | Designs atomic Redis Lua two-phase TPM reservation + post-stream reconciliation, tenant-namespaced KV prefix isolation, and noisy-neighbor preemption handling. | Addresses KV-cache timing side channels, fair-share deficit round-robin GPU scheduling, and bounded per-tenant max-concurrency queues. |
| **Observability, SLOs & Resilience** | Uses mean latency metrics or deep RAG/GPU checks inside `/readyz` that eject all gateways. | Separates `/livez` and adds basic Prometheus TTFT/error graphs. | Defines distinct TTFT + ITL SLIs, aggregates native histograms across workers, applies 99.95% burn-rate alerts (`14.4×`, `6×`), and uses tail-based tracing. | Designs graceful overload degradation (shedding unauthenticated/low-tier batch traffic, adaptive speculative/smaller-model fallback, queue-age LIFO shedding). |
