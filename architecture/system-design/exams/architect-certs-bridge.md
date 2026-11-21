# Architect Certification Bridge Bank (AWS SAP-C02 · GCP PCA · Azure AZ-305 · CNCF/SRE)

No single vendor-neutral certification tests general distributed system design, so vendor-specific IAM, CLI, and control-plane trivia stay in [`technologies/aws`](../../../technologies/aws/), [`technologies/gcp`](../../../technologies/gcp/), and [`technologies/azure`](../../../technologies/azure/). This bridge bank maps the architectural patterns, quantitative trade-offs, and failure modes taught across `architecture/system-design` directly onto Senior/Architect certification scenario domains (**AWS Solutions Architect – Professional `SAP-C02`**, **Google Cloud Professional Cloud Architect `PCA`**, **Microsoft Azure Solutions Architect Expert `AZ-305`**, and **CNCF / SRE Resilience**).

- **Sequential Growth Plan**: Built sequentially alongside Wave A & Wave B topic completions (target: **60+ original scenario questions** plus a full timed certification bridge mock exam upon completion of the 28-topic expansion).
- **Current Coverage**: **18 questions** (`Q-CERT-001`–`Q-CERT-018`) covering Topic 01 (`Scale From Zero to Millions` — Module 15), Topic 02 (`Distributed Key-Value Store` — Module 16), and Topic 03 (`Google Maps` — Module 17).

---

## Module 15: Progressive Scaling, Blast Radius & Cloud Modernization (`Q-CERT-001`–`Q-CERT-006`)

### Q-CERT-001 · AWS SAP-C02: Design Solutions for Organizational Complexity · difficulty 3 · scenario

A multi-tenant SaaS platform runs across three Availability Zones in a single AWS Region using independent cells, with tenants assigned via the shuffle-sharding worker-subset model across 8 worker pools ($k = 2$ pools per tenant). One AZ experiences a gray failure while a single tenant simultaneously sends poison-pill traffic crashing both of its assigned pools. Which operational architecture minimizes both tenant blast radius and AZ recovery time?

- A) Consolidate into one large multi-AZ cell with 50% extra compute headroom and apply Route 53 zonal shift only at the load balancer tier.
- B) Keep cells fully independent (dedicated app, cache, and database per cell), shuffle-assign each tenant to $k = 2$ of 8 worker pools so only $1/28$ (`~3.57%`) of tenants share the poison tenant's exact pair, and trigger Route 53 Application Recovery Controller (ARC) zonal shift to evacuate the impaired AZ within seconds without waiting on DNS TTL expiry.
- C) Deploy one cell per AZ sharing a single central Aurora cluster so zonal shift moves stateless traffic while the shared database absorbs state failover.
- D) Use standard Route 53 weighted failover records with a 60-second TTL to evacuate both the impaired AZ and the poison tenant.

<details><summary>Answer</summary>

**B.** Independent cells prevent a fault from crossing cell boundaries, shuffle sharding ($N = 8, k = 2$) reduces exact-pair tenant fate-sharing from 25% to $1/\binom{8}{2} \approx 3.57\%$, and Route 53 ARC zonal shift drains traffic out of an impaired AZ at the load-balancer/AWS-edge plane in seconds rather than waiting on recursive DNS caches.

- Why not A: Consolidating into one large cell maximizes blast radius so the poison tenant degrades 100% of customers regardless of extra compute headroom.
- Why not C: A shared database breaks cell independence, turning any database lock storm or overload from the poison tenant into a region-wide outage.
- Why not D: DNS failover is bounded by ISP/OS resolver TTL caching and cannot isolate a single poison tenant from co-located tenants.
- Ref: [modules/15-scale-from-zero-to-millions.md](../modules/15-scale-from-zero-to-millions.md#32-shuffle-sharding-combinatorics), https://docs.aws.amazon.com/r53recovery/latest/dg/arc-zonal-shift.html

</details>

### Q-CERT-002 · AWS SAP-C02: Continuous Improvement for Existing Solutions · difficulty 2 · single

A microservice architecture makes chatty RPC calls across Availability Zones and routes `10,000 GB/month` of S3 and DynamoDB traffic through a regional NAT Gateway. Monthly network transfer charges spike unexpectedly. Which change directly eliminates the avoidable network charges while preserving multi-AZ high availability?

- A) Deploy a second NAT Gateway in the same AZ to distribute the per-GB processing fee.
- B) Provision VPC Gateway Endpoints for S3 and DynamoDB (bypassing NAT data-processing fees at zero hourly/per-GB endpoint cost) and enable AZ-local / topology-aware routing so normal RPCs and read-replica queries stay inside the caller's AZ, crossing AZ boundaries only during failover.
- C) Collapse all application and database instances into a single AZ to eliminate cross-AZ data transfer charges.
- D) Enable gzip payload compression on all RPCs, which removes the need for NAT Gateways and VPC endpoints.

<details><summary>Answer</summary>

**B.** VPC Gateway Endpoints for S3 and DynamoDB carry no hourly or per-GB charge, immediately removing NAT Gateway data-processing charges (roughly `\$450/month` for `10,000 GB` at us-east-1 list pricing of `\$0.045/GB`), and AZ-local routing avoids bilateral cross-AZ data-transfer charges (`\$0.01/GB` per direction) during steady-state traffic while retaining multi-AZ failover.

- Why not A: NAT Gateway data-processing charges apply per GB regardless of how many gateways exist, and adding a second NAT Gateway doubles the hourly gateway charge.
- Why not C: Collapsing into a single AZ sacrifices multi-AZ fault tolerance to save transfer fees.
- Why not D: Compression lowers byte volume but leaves traffic traversing paid NAT Gateways and cross-AZ links.
- Ref: [modules/15-scale-from-zero-to-millions.md](../modules/15-scale-from-zero-to-millions.md#4-production-gotchas-and-failure-modes), https://aws.amazon.com/vpc/pricing/

</details>

### Q-CERT-003 · GCP PCA: Designing and Planning a Cloud Solution Architecture · difficulty 3 · scenario

A globally distributed web platform serves users from `us-central1` and `europe-west1`. When `us-central1` suffers a regional outage, which routing architecture achieves the fastest, most predictable traffic shift for global clients?

- A) A Google Cloud Global External Application Load Balancer fronted by a single Anycast VIP with health-checked backend failover, draining traffic away from the failed region inside Google's edge without waiting for client DNS cache expiration.
- B) GeoDNS with a 60-second TTL, because all ISP and OS recursive resolvers strictly honor 60-second TTLs and shift 100% of traffic within one minute.
- C) An Anycast load balancer paired with automated DNS updates that rewrite the frontend VIP during every regional failover.
- D) GeoDNS configured with `TTL = 0`, preventing every resolver from caching answers so regional failover completes instantaneously.

<details><summary>Answer</summary>

**A.** Anycast terminates clients at Google's global edge on a single unchanging IP address; backend health checks detect the failed region and transparently reroute requests over Google's backbone to `europe-west1` in seconds without depending on downstream DNS caches.

- Why not B: Many ISP recursive resolvers and client runtimes clamp or ignore short TTLs and keep long-lived HTTP/2 connections open, leaving a tail of users pinned to the dead region past 60 seconds.
- Why not C: An Anycast Global External ALB retains the exact same VIP across failovers; changing DNS VIPs would reintroduce DNS propagation lag.
- Why not D: Setting `TTL = 0` hammers authoritative DNS servers with lookup storms while recursive resolvers routinely enforce minimum cache floors (e.g., 30–300 s).
- Ref: [modules/15-scale-from-zero-to-millions.md](../modules/15-scale-from-zero-to-millions.md#24-stage-68-multi-region-topologies-message-queues-and-database-sharding), https://cloud.google.com/load-balancing/docs/application-load-balancer

</details>

### Q-CERT-004 · Azure AZ-305: Design Business Continuity Solutions · difficulty 2 · single

An Azure SQL Database primary uses asynchronous geo-replication to a secondary region with a steady `2-second` replication lag under `500 writes/s`. The primary region suffers an abrupt outage and operators execute an unplanned forced failover. What is the exact durability consequence and mandatory safeguard?

- A) `RPO = 0` because Azure automatically pauses promotion until the dead primary finishes flushing its remaining WAL records.
- B) Up to `~2 seconds` of committed transactions (`~1,000` writes) that had not reached the secondary can be lost (`RPO > 0`), and the old primary must be fenced (blocked from accepting writes) before or during promotion to prevent split-brain divergence.
- C) Zone-redundant deployment within a single region exhibits the same `RPO > 0` data loss because intra-region quorum commits are also asynchronous.
- D) Enabling zone redundancy in the primary region eliminates the need for fencing during cross-region asynchronous failovers.

<details><summary>Answer</summary>

**B.** Forced promotion of an asynchronous geo-secondary sacrifices transactions still in flight across the replication lag window (`2 s * 500 writes/s = ~1,000` transactions, `RPO > 0`), and fencing the former primary ensures it cannot accept conflicting writes if connectivity returns before demotion.

- Why not A: In an abrupt primary-region outage, unreplicated log records on the unreachable primary cannot be fetched before forced promotion.
- Why not C: Zone-redundant Azure SQL uses synchronous quorum replication across Availability Zones within the region to provide `RPO = 0` for single-AZ failures.
- Why not D: Intra-region synchronous quorum does not make cross-region geo-replication synchronous or eliminate split-brain risk upon forced cross-region failover.
- Ref: [modules/15-scale-from-zero-to-millions.md](../modules/15-scale-from-zero-to-millions.md#22-stage-23-load-balancers-and-database-read-replication), https://learn.microsoft.com/en-us/azure/azure-sql/database/failover-group-overview

</details>

### Q-CERT-005 · CNCF / SRE: Static Stability & Queue-Driven Autoscaling · difficulty 3 · scenario

A Kubernetes worker fleet processes background orders and scales via KEDA based on Kafka consumer lag. During a peak traffic burst, the cluster control plane becomes unreachable for 20 minutes while queue depth fluctuates sharply. Which architecture preserves steady data-plane throughput and prevents scale-down flapping once the control plane recovers?

- A) Maintain **static stability** by keeping existing worker pods serving from last-known-good local configuration without runtime control-plane calls, pre-provisioning baseline headroom, and setting HPA `behavior.scaleDown.stabilizationWindowSeconds` (e.g., `300 s`) so capacity drops only after lower demand persists across the full window.
- B) Have every worker poll the Kubernetes API server for its concurrency limit on every message and set `stabilizationWindowSeconds: 0` for rapid cost savings.
- C) Set `stabilizationWindowSeconds: 0` so pods scale down instantly between micro-bursts, and rely on GeoDNS to give the worker fleet static stability.
- D) Replace KEDA queue-depth scaling with CPU-only HPA because KEDA breaks static stability whenever the control plane fails.

<details><summary>Answer</summary>

**A.** Static stability ensures the running data plane continues draining messages independently of control-plane availability, while a 300-second scale-down stabilization window prevents the autoscaler from tearing down warmed workers during brief dips between burst waves.

- Why not B: Polling the control plane in the request/message hot path turns every control-plane blip into an immediate data-plane outage.
- Why not C: Zero stabilization causes severe flapping on bursty queues, and GeoDNS does not protect internal queue-consuming workers from control-plane coupling.
- Why not D: Existing pods managed by KEDA/HPA continue running normally during control-plane outages just like CPU-based HPA deployments.
- Ref: [modules/15-scale-from-zero-to-millions.md](../modules/15-scale-from-zero-to-millions.md#33-static-stability), https://aws.amazon.com/builders-library/static-stability-using-availability-zones/

</details>

### Q-CERT-006 · Multi-Cloud Architecture: 2021 vs. 2026 Infrastructure Modernization · difficulty 2 · multi

An infrastructure team modernizes a 2021-era platform by migrating Apache Kafka from ZooKeeper mode to **KRaft** mode and replacing `iptables`-based Kubernetes `kube-proxy` with **Cilium eBPF + Maglev** L4 load balancing. Which **two** operational scaling improvements result directly from these upgrades?

- A) KRaft consolidates cluster metadata into an internal Raft quorum inside Kafka itself, eliminating a separate ZooKeeper ensemble, cutting controller failover time, and raising single-cluster partition ceilings.
- B) Replacing sequential $O(N)$ `iptables` rule traversal with $O(1)$ eBPF hash-map lookups and Maglev consistent hashing eliminates per-packet latency growth at thousands of Services and minimizes connection disruption when backends scale.
- C) Maglev moves HTTP path-based L7 routing and JWT validation directly into the Linux kernel TCP stack.
- D) KRaft removes the need for partition replication factor $\ge 3$ because metadata consensus guarantees topic data durability on a single broker.

<details><summary>Answer</summary>

**A, B.** KRaft removes ZooKeeper operational coupling and accelerates metadata recovery, while Cilium eBPF with Maglev replaces linear `iptables` chain scanning with constant-time kernel lookups and minimal flow remapping across backend changes.

- Why not C: Maglev is an L4 consistent-hashing load balancer operating on 5-tuples; L7 HTTP routing and JWT validation remain in L7 proxies (e.g., Envoy / Gateway API).
- Why not D: KRaft governs cluster metadata consensus only; topic data durability still requires multi-broker partition replication (`RF >= 3`, `min.insync.replicas >= 2`).
- Ref: [modules/15-scale-from-zero-to-millions.md](../modules/15-scale-from-zero-to-millions.md#5-technology-comparison-then-vs-now-2021-vs-2026), https://kafka.apache.org/documentation/#kraft

</details>

---

## Module 16: Distributed Key-Value Stores, Cloud NoSQL & Quorum Trade-Offs (`Q-CERT-007`–`Q-CERT-012`)

### Q-CERT-007 · AWS SAP-C02: Design for New Solutions (DynamoDB Partitioning & Global Tables) · difficulty 3 · scenario

An IoT ingestion pipeline writes to an Amazon DynamoDB table partitioned by `device_id`. One high-volume gateway device sustains `2,500 WCU` on a single key, and the team proposes relying on DynamoDB adaptive capacity while also deploying active-active Global Tables across two regions. Which architectural decision is correct?

- A) Adaptive capacity raises any single partition key's throughput ceiling indefinitely, and Global Tables reconcile concurrent regional updates with vector clocks, so no schema change is required.
- B) A single partition key is bounded at `1,000 WCU` (and `3,000 RCU`), and adaptive capacity/Global Admission Control cannot remove a single hot key's per-partition write limit; shard the hot key using write suffixes (`device_id#0`–`device_id#N`) to spread writes across partitions, and account for Global Tables' per-item last-writer-wins (LWW) conflict resolution by keeping writes region-affine or commutative.
- C) Replace `PutItem` with `Scan` paired with a random sort key to spread write load across partitions without changing the partition key.
- D) Place DynamoDB Accelerator (DAX) in front of the table because DAX buffers sustained write hotspots asynchronously before flushing to DynamoDB partitions.

<details><summary>Answer</summary>

**B.** `2,500 WCU` on one partition key exceeds DynamoDB's `1,000 WCU` per-partition ceiling by `2.5×`; write sharding with bounded suffixes distributes writes across multiple partitions (at the cost of scatter-gather reads), and Global Tables use asynchronous cross-region replication with per-item LWW, where simultaneous multi-region updates to the same item silently overwrite one another.

- Why not A: Adaptive capacity redistributes unused table throughput across partitions but cannot surpass the `1,000 WCU` hard ceiling of a single partition key, and Global Tables do not expose vector-clock siblings.
- Why not C: `Scan` is a full-table read operation, not a write-sharding mechanism, and changing only the sort key keeps every item on the exact same partition key.
- Why not D: DAX is a write-through read cache; every write still synchronously hits the underlying DynamoDB partition immediately.
- Ref: [modules/16-distributed-key-value-store.md](../modules/16-distributed-key-value-store.md#2-coordinator-partitioning-and-storage-writeread-path), https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-design.html

</details>

### Q-CERT-008 · AWS SAP-C02: Reliability & Strongly Consistent Reads (DynamoDB) · difficulty 2 · single

An order-status service reads `4 KB` items from an Amazon DynamoDB table backed by per-partition Paxos groups. Which statement accurately describes the cost and consistency trade-off?

- A) Eventually consistent reads consume `1 RCU` per `4 KB`, while strongly consistent reads consume zero additional RCUs because they bypass storage nodes.
- B) Strongly consistent reads consume twice the read capacity of eventually consistent reads (`1 RCU` vs. `0.5 RCU` per `4 KB`) and route strictly to the partition's Paxos leader so every prior acknowledged write is visible, whereas eventually consistent reads may hit a slightly lagging follower replica.
- C) Strongly consistent reads consume fewer RCUs than eventually consistent reads because the leader answers from RAM without contacting storage.
- D) Eventually consistent reads are strictly linearizable within a single AWS Region and should be used whenever post-write consistency is mandatory.

<details><summary>Answer</summary>

**B.** In DynamoDB, one `4 KB` strongly consistent read costs `1 RCU` (routed to the partition leader), while one `4 KB` eventually consistent read costs `0.5 RCU` (`2×` cheaper) and may return slightly stale data if served by a lagging storage replica or during leader failover.

- Why not A: Eventually consistent reads cost `0.5 RCU` per `4 KB`, and strongly consistent reads cost double (`1 RCU`).
- Why not C: Routing to the Paxos leader consumes double the RCUs and offers lower read-availability resilience during brief leader elections.
- Why not D: Eventually consistent reads explicitly relax linearizability and can return stale data immediately after a write.
- Ref: [modules/16-distributed-key-value-store.md](../modules/16-distributed-key-value-store.md#51-amazon-dynamo-2007-vs-amazon-dynamodb-20222026), https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.ReadConsistency.html

</details>

### Q-CERT-009 · GCP PCA: Designing Data Storage (Cloud Bigtable Row-Key Hotspotting) · difficulty 3 · scenario

A telemetry workload ingests high-velocity events into Google Cloud Bigtable using row key `<sequential_user_id>#<unix_timestamp_ms>`. Write throughput plateaus far below cluster capacity while one Bigtable node pins at `100%` CPU and the remaining nodes sit idle. What causes this hotspot and how do you fix it?

- A) Cloud Bigtable hashes row keys uniformly across nodes, so the bottleneck is insufficient column families rather than row-key layout.
- B) Bigtable stores rows lexicographically in sorted tablets; monotonically increasing prefixes concentrate all new writes onto the rightmost tablet served by one node. Redesign the key using a high-cardinality non-sequential prefix (e.g., hashed/salted prefix or `reverse_timestamp` per entity) while balancing against required range-scan order.
- C) Switch from millisecond to microsecond timestamps so the higher key granularity spreads writes evenly across all cluster nodes.
- D) Add two additional Bigtable replication clusters because replication splits writes for the hottest key evenly across clusters.

<details><summary>Answer</summary>

**B.** Unlike hash-partitioned KV rings, Cloud Bigtable range-partitions lexicographically sorted row keys into tablets. Monotonic prefixes funnel 100% of concurrent inserts into the single tail tablet; salting or reversing timestamps distributes writes across tablets across all nodes, trading off contiguous global time-range scans.

- Why not A: Bigtable does not hash row keys internally; lexicographic sort order is its core indexing property.
- Why not C: Microsecond timestamps still increase monotonically and still land in the exact same tail tablet.
- Why not D: Bigtable multi-cluster replication copies every write to every cluster for availability/read isolation; it does not shard one hot key across nodes within a cluster.
- Ref: [modules/16-distributed-key-value-store.md](../modules/16-distributed-key-value-store.md#6-production-gotchas-and-failure-modes), https://cloud.google.com/bigtable/docs/schema-design

</details>

### Q-CERT-010 · Azure AZ-305: Design Data Storage Solutions (Cosmos DB Consistency Levels) · difficulty 3 · scenario

A globally distributed web application on Azure Cosmos DB requires **read-your-writes** and monotonic reads for each individual user session without paying the cross-region synchronous commit latency of Strong consistency or the global lag-window write throttling of Bounded Staleness. Which consistency level matches these constraints?

- A) **Strong**, because it is the only Cosmos DB level that supports read-your-writes.
- B) **Session**, which guarantees read-your-writes, monotonic reads, and monotonic writes for each client via an opaque session token propagated across requests at local-region latency and half the RU cost of Strong reads.
- C) **Eventual**, because passing the Cosmos DB session token automatically upgrades Eventual reads to read-your-writes at minimal latency.
- D) **Consistent Prefix**, because prefix ordering guarantees a user immediately reads their own latest write from any replica.

<details><summary>Answer</summary>

**B.** Cosmos DB's default **Session** consistency tracks per-client progress via a lightweight session token (`x-ms-session-token`), guaranteeing read-your-writes and monotonic reads/writes for that session at local-region latency without global cross-region commit RTTs or bounded-staleness write stalls.

- Why not A: Strong enforces linearizable cross-region synchronous commits, paying full inter-region RTT on every write and disallowing multi-region writes.
- Why not C: Eventual consistency provides zero ordering or read-your-writes guarantees even if a client passes session tokens.
- Why not D: Consistent Prefix ensures readers never see out-of-order writes, but a lagging replica can still omit a user's most recent write.
- Ref: [modules/16-distributed-key-value-store.md](../modules/16-distributed-key-value-store.md#3-tunable-quorums-and-why-w--r--n-is-not-linearizability), https://learn.microsoft.com/en-us/azure/cosmos-db/consistency-levels

</details>

### Q-CERT-011 · CNCF / SRE: Distributed State & Failure Detection · difficulty 2 · single

Why does Cassandra's **Phi Accrual Failure Detector** ($\phi(t) = -\log_{10}(P_{\text{later}}(t))$) reduce false-positive node ejections during transient GC pauses and network jitter compared to a fixed binary heartbeat timeout, and how does `etcd`'s Raft membership model differ from a Dynamo/Cassandra gossip ring?

- A) Phi Accrual models the live distribution of observed heartbeat inter-arrival intervals and emits a continuous suspicion score (convicting at $\phi \ge 8$, i.e., $P_{\text{later}} \le 10^{-8}$), adapting naturally to network variance; `etcd` uses CP Raft majority quorums for linearizable metadata consensus, whereas gossip rings maintain eventually converging AP membership tables.
- B) A fixed `5 s` binary timeout outperforms Phi Accrual because production jitter never exceeds `5 s`.
- C) Phi Accrual immediately evicts a node whenever $\phi > 0$, while `etcd` relies on AP gossip to elect its leader.
- D) `etcd` Raft operates as an AP gossip ring that stays writable on both sides of a network partition.

<details><summary>Answer</summary>

**A.** Fixed timeouts force an brittle trade-off between slow crash detection and frequent false positives during jitter or GC pauses; Phi Accrual continuously scales suspicion from live heartbeat statistics ($\phi = 8 \implies 10^{-8}$ late-arrival probability). Architecturally, `etcd` runs CP Raft consensus (minority partition stops accepting writes to preserve linearizability), whereas Dynamo/Cassandra gossip rings remain AP and converge membership eventually.

- Why not B: Production GC pauses and NIC micro-bursts routinely exceed fixed timeouts, causing cascading false ejections and unnecessary hint/streaming storms.
- Why not C: $\phi > 0$ merely means a heartbeat is slightly past average latency (`\phi = 1` is still a 10% chance of normal arrival); `etcd` uses Raft heartbeats, not gossip, for leader election.
- Why not D: Raft is CP under partitions—allowing writes on both sides would violate linearizability and cause split-brain.
- Ref: [modules/16-distributed-key-value-store.md](../modules/16-distributed-key-value-store.md#42-gossip-membership-and-phi-accrual-failure-detection), https://etcd.io/docs/

</details>

### Q-CERT-012 · Multi-Cloud Architecture: 2021 vs. 2026 KV Store Modernization · difficulty 2 · multi

Which **two** measurable architectural advantages motivate migrating a latency-sensitive workload from a 2021 JVM Cassandra 3 cluster (manual `nodetool repair`, G1GC tuning) to a 2026 shard-per-core C++/Rust engine (ScyllaDB Seastar / `io_uring`) or consensus-backed KV store (TiKV / DynamoDB)?

- A) Shard-per-core C++/Rust engines eliminate JVM stop-the-world garbage collection pauses and cross-core lock contention, dramatically tightening p99/p99.9 tail latency on high-core-count NVMe Gen5 nodes.
- B) Per-range Raft/Paxos consensus engines continuously replicate an ordered log per partition/tablet, enabling linearizable reads/writes and reducing reliance on periodic full-range Merkle tree anti-entropy as the primary convergence mechanism.
- C) Migrating from Cassandra to ScyllaDB requires rewriting every CQL schema and query because ScyllaDB uses a SQL-only wire protocol.
- D) Enabling `io_uring` eliminates the need for multi-AZ replication (`RF = 3`) because kernel asynchronous I/O prevents disk and AZ failures.
- E) Consensus-backed stores always achieve lower single-key write latency than `CL=ONE` leaderless writes because Raft eliminates network round trips.

<details><summary>Answer</summary>

**A, B.** Shard-per-core designs isolate memory, CPU, and NVMe I/O queues per core without JVM GC pauses to slash tail-latency spikes, while per-range Raft/Paxos consensus maintains continuous ordered log replication for linearizable semantics instead of relying on periodic Merkle repairs to catch divergence.

- Why not C: ScyllaDB is wire- and CQL-compatible with Apache Cassandra (and also offers a DynamoDB-compatible Alternator API).
- Why not D: `io_uring` optimizes local Linux kernel I/O submission/completion and provides zero redundancy against host or AZ hardware failure.
- Why not E: Raft/Paxos requires majority-quorum network round trips before acknowledging writes, so its write latency is higher than fire-and-forget `CL=ONE` local writes.
- Ref: [modules/16-distributed-key-value-store.md](../modules/16-distributed-key-value-store.md#7-technology-comparison-then-vs-now-2021-vs-2026), https://docs.scylladb.com/

</details>

---

## Module 17: Geospatial Mapping, Tile CDNs, Telemetry Streams & WebSockets (`Q-CERT-013`–`Q-CERT-018`)

### Q-CERT-013 · AWS SAP-C02: Design for New Solutions (Immutable Vector Tiles & PMTiles on S3/CloudFront) · difficulty 2 · single

Your platform serves immutable global vector tiles—either MVT files or a single Hilbert-indexed **PMTiles** archive—from a private Amazon S3 bucket behind Amazon CloudFront. Which design maximizes edge cache efficiency, enforces private bucket security, and avoids expensive CDN invalidation storms on map releases?

- A) Keep the S3 bucket private with CloudFront **Origin Access Control (OAC)**, serve PMTiles through CloudFront forwarding HTTP `Range` requests to S3, and publish each map release under a new immutable versioned object key (e.g., `/releases/2026-11-20/planet.pmtiles`) with a long `Cache-Control: public, max-age=31536000, immutable`.
- B) Render every map tile dynamically inside an AWS Lambda origin on each client request with a `60 s` TTL.
- C) Make the S3 bucket publicly readable via `s3:GetObject` and point mobile clients directly at S3 to skip CloudFront.
- D) Overwrite the same `/planet.pmtiles` key on every release and issue wildcard `/*` CloudFront invalidations.

<details><summary>Answer</summary>

**A.** Immutable versioned keys let CloudFront edges and client caches retain byte-range chunks for up to a year with zero invalidation cost, PMTiles `Range` requests fetch only the exact tile bytes required from one archive, and OAC restricts S3 access strictly to CloudFront.

- Why not B: Per-request Lambda rendering wastes compute on identical static geometry and eliminates global edge caching.
- Why not C: Exposing S3 publicly bypasses CDN edge caching, increases origin latency and egress bills, and violates least-privilege origin access.
- Why not D: Overwriting a mutable key causes torn byte-range reads across mismatched archive headers and incurs billed CloudFront invalidations.
- Ref: [modules/17-google-maps.md](../modules/17-google-maps.md#2-high-level-architecture-tile-serving-location-telemetry-and-navigation), https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html

</details>

### Q-CERT-014 · AWS SAP-C02: High-Throughput Telemetry Ingestion (Kinesis / MSK Partitioning) · difficulty 3 · scenario

A navigation telemetry pipeline ingests `1,000,000` batched GPS requests per second. Downstream **HMM map matching** requires each user's GPS batches in strict chronological order, while **live traffic aggregation** requires speed probes grouped by road tile (`geohash_tile_id`). Which streaming partitioning topology satisfies both constraints without hot-shard throttling?

- A) Partition the ingest stream by `hash(user_id)` so every user's trajectory arrives ordered on one shard (provisioning at least `1,000` Kinesis shards for `~1M` batched records/s—or `~1,160` shards for a `1.16M/s` peak—bounded by both `1,000 records/s` and `1 MB/s` per shard), then emit matched `(road_edge_id, speed)` probes into a second stream repartitioned by `geohash_tile_id` for windowed traffic aggregation.
- B) Partition the ingest stream directly by `geohash_tile_id` so traffic aggregation runs in one stage without repartitioning.
- C) Partition the ingest stream by a random UUID per request to maximize spread while relying on HMM consumers to reorder points globally.
- D) Use a single Kinesis shard per continent to preserve global ordering with minimal shard overhead.

<details><summary>Answer</summary>

**A.** Partitioning Stage 1 by `user_id` spreads `1B` users uniformly across shards while preserving strict per-user ordering for HMM Viterbi decoding, and repartitioning matched speed probes by `geohash_tile_id` in Stage 2 isolates traffic aggregation without hot-spotting raw ingest. Sizing Kinesis shards directly from the `1,000 records/s` per-shard write limit requires at least `1,000` shards for `1M` batched records/s.

- Why not B: Keying raw ingest by `geohash_tile_id` concentrates downtown rush-hour drivers onto a few hot shards and splits each moving driver's trajectory across different partitions as they cross tile boundaries, breaking HMM order.
- Why not C: Random UUID keys scatter a single user's consecutive GPS batches across different shards, breaking stateful Viterbi sequence decoding.
- Why not D: A single shard caps write throughput at `1,000 records/s` (`1 MB/s`), missing the `1M/s` target by `1,000×`.
- Ref: [modules/17-google-maps.md](../modules/17-google-maps.md#13-back-of-the-envelope-capacity-sizing), https://docs.aws.amazon.com/streams/latest/dev/service-sizes-and-limits.html

</details>

### Q-CERT-015 · GCP PCA: Designing Scalable Edge & Streaming Architectures (Pub/Sub + Dataflow + Cloud CDN) · difficulty 2 · single

You are architecting a Google Cloud navigation backend that computes live per-segment traffic speeds from batched mobile location traces while serving static global vector tiles at `< 50 ms` p95 latency. Which GCP service composition matches each access pattern?

- A) Ingest batched GPS traces into **Cloud Pub/Sub**, compute windowed per-segment speed averages in **Cloud Dataflow** (Apache Beam) writing to a low-latency serving store, and serve immutable vector tiles from **Cloud Storage** behind **Cloud CDN**.
- B) Invoke a synchronous Cloud Function per GPS sample to `UPDATE` a central Cloud SQL table, and query Cloud SQL directly for map tiles.
- C) Run Dataflow streaming jobs to render PNG map tiles dynamically per HTTP client request with no object cache.
- D) Publish map tile payloads to mobile clients through Pub/Sub push subscriptions instead of using Cloud CDN.

<details><summary>Answer</summary>

**A.** Pub/Sub decouples bursty mobile ingest, Dataflow provides event-time windowing and late-data handling for per-segment speed aggregation, and Cloud Storage fronted by Cloud CDN offloads `> 95%` of static tile reads to global edge PoPs.

- Why not B: Synchronous per-point Cloud SQL writes collapse under million-QPS telemetry and cannot serve global tile traffic at `< 50 ms`.
- Why not C: Dataflow is a stream/batch data processor, not a low-latency HTTP tile server, and re-rendering static tiles wastes massive compute.
- Why not D: Pub/Sub is a messaging broker, not a static asset CDN; pushing map tiles wastes bandwidth and loses edge caching.
- Ref: [modules/17-google-maps.md](../modules/17-google-maps.md#2-high-level-architecture-tile-serving-location-telemetry-and-navigation), https://beam.apache.org/documentation/programming-guide/#windowing

</details>

### Q-CERT-016 · Azure AZ-305: Design Infrastructure & Real-Time Messaging (WebSocket Scaling & Graceful Drain) · difficulty 3 · scenario

Two million active navigators hold persistent WebSocket connections behind regional L7 gateways (such as Azure Application Gateway / Azure Web PubSub) to receive live traffic reroutes. During a regional deployment or failover, which design prevents reconnect storms while keeping live guidance uninterrupted?

- A) Drain gateways gracefully over `60–120 s` (stop accepting new sockets and signal clients to migrate), implement client exponential backoff with **full jitter** (spreading `2M` reconnects to `~16.7k/s` over `120 s`), and store resumable navigation session tokens in a replicated external cache so reconnects resume without rebuilding routes from scratch.
- B) Switch all `2M` clients to `1 Hz` HTTP short-polling so stateful WebSocket drops never occur.
- C) Disable automatic reconnect so users manually reopen the navigation app after every gateway deploy.
- D) Keep sticky gateway-local route state with zero graceful drain so failover finishes instantaneously without client reconnects.

<details><summary>Answer</summary>

**A.** Graceful draining plus client-side full jitter converts a `2M`-connection `1-second` TLS handshake storm into a bounded `~16.7k/s` stream over `120 s`, while externalized resumable session tokens keep reconnects stateless and cheap.

- Why not B: `2M` clients short-polling every second generates a permanent `2M RPS` baseline load and destroys mobile battery life.
- Why not C: Disabling automatic reconnect breaks live turn-by-turn rerouting during routine deployments and network handoffs.
- Why not D: Terminating instances without drain still drops every pinned TCP/WebSocket connection immediately and loses all gateway-local state.
- Ref: [modules/17-google-maps.md](../modules/17-google-maps.md#43-adaptive-eta-hierarchical-super-tile-indexing-and-websocket-push), https://learn.microsoft.com/en-us/azure/azure-web-pubsub/overview

</details>

### Q-CERT-017 · CNCF / SRE: Geospatial Observability & Rerouting Stability · difficulty 2 · single

Which set of user-facing Service Level Indicators (SLIs) directly detects silent navigation degradation before customers abandon the app?

- A) **Traffic-pipeline freshness lag** (age of live edge speeds), **ETA Mean Absolute Error (MAE)** against observed arrival times, and **CDN tile cache-hit / origin-offload ratio**, paired with explicit SLO error budgets.
- B) Tile-server fleet CPU utilization exceeding `80%` and host memory utilization.
- C) Raw count of HTTP `200 OK` responses returned by the routing API per minute.
- D) Mean distance in kilometers of all requested routes.

<details><summary>Answer</summary>

**A.** Freshness lag catches stalled Kafka/HMM consumers before routing goes stale, ETA MAE catches GNN/traffic model drift against ground-truth arrivals, and CDN offload ratio catches cache-key bugs before origin storage melts down.

- Why not B: Host CPU/RAM are cause-level signals—traffic feeds can be `15 minutes` stale while CPU sits quietly at `20%`.
- Why not C: Returning `200 OK` with stale traffic speeds or mis-snapped routes hides severe functional degradation.
- Why not D: Average trip distance reflects user travel behavior, not system reliability.
- Ref: [modules/17-google-maps.md](../modules/17-google-maps.md#5-production-gotchas-and-failure-modes), https://sre.google/sre-book/service-level-objectives/

</details>

### Q-CERT-018 · Multi-Cloud Architecture: 2021 vs. 2026 Mapping Modernization · difficulty 2 · multi

Which **two** concrete architectural improvements result from modernizing a 2021 navigation stack (pre-rendered raster PNG tiles, nightly static Contraction Hierarchies, independent per-segment ETA sums) to a 2026 stack (**MVT / PMTiles** vector tiles, **CRP** dynamic metric customization, and **GNN Supersegment** ETA)?

- A) Vector tiles rendered on client GPUs let one tile set serve dynamic themes, smooth rotation, and high-DPI displays while packing into a single range-addressable **PMTiles** archive eliminates billions of tiny S3 objects.
- B) **CRP** decouples one-time topology partitioning from `< 1 s` overlay metric customization, allowing live highway closures and probe speeds to reshape continental routes within seconds rather than waiting for hours-long CH rebuilds.
- C) Vector tiles eliminate the need for a CDN because every mobile device downloads the entire zoom-21 planet locally on install.
- D) GNN Supersegment models eliminate live GPS telemetry feeds because offline training predicts unexpected accidents without live probes.

<details><summary>Answer</summary>

**A, B.** MVT/PMTiles cut storage/object overhead dramatically while unlocking client-side styling, and CRP's fast metric customization lets live traffic incidents update routing overlays in seconds without re-contracting the entire road graph.

- Why not C: Even compressed global vector archives are tens to hundreds of gigabytes—too large for mobile devices, so CDN edge caching remains essential.
- Why not D: GNN ETA models fuse live HMM-matched GPS probes with historical patterns; offline weights alone cannot detect an unexpected crash that happened two minutes ago.
- Ref: [modules/17-google-maps.md](../modules/17-google-maps.md#6-technology-comparison-then-vs-now-2021-vs-2026), https://github.com/protomaps/PMTiles

</details>
