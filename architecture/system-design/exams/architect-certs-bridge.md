# Architect Certification Bridge Bank (AWS SAP-C02 · GCP PCA · Azure AZ-305 · CNCF/SRE)

No single vendor-neutral certification tests general distributed system design, so vendor-specific IAM, CLI, and control-plane trivia stay in [`technologies/aws`](../../../technologies/aws/), [`technologies/gcp`](../../../technologies/gcp/), and [`technologies/azure`](../../../technologies/azure/). This bridge bank maps the architectural patterns, quantitative trade-offs, and failure modes taught across `architecture/system-design` directly onto Senior/Architect certification scenario domains (**AWS Solutions Architect – Professional `SAP-C02`**, **Google Cloud Professional Cloud Architect `PCA`**, **Microsoft Azure Solutions Architect Expert `AZ-305`**, and **CNCF / SRE Resilience**).

- **Sequential Growth Plan**: Built sequentially alongside Wave A & Wave B topic completions (target: **60+ original scenario questions** plus a full timed certification bridge mock exam upon completion of the 28-topic expansion).
- **Current Coverage**: **48 questions** (`Q-CERT-001`–`Q-CERT-048`) covering Topic 01 (`Scale From Zero to Millions` — Module 15), Topic 02 (`Distributed Key-Value Store` — Module 16), Topic 03 (`Google Maps` — Module 17), Topic 04 (`Distributed Message Queue` — Module 18), Topic 05 (`Hotel Reservation System` — Module 19), Topic 06 (`Distributed Email Service` — Module 20), Topic 07 (`Real-time Gaming Leaderboard` — Module 21), and Topic 08 (`Proximity Service` — Module 22).

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

---

### Q-CERT-019 · AWS SAP-C02: Amazon MSK, Kinesis & SQS Selection · difficulty 3 · scenario

An e-commerce platform must ingest `1M msg/s` of `1 KB` order events with strict per-order-key ordering, `14-day` multi-consumer replay, and strict controls on cross-AZ data-transfer costs. Which AWS messaging architecture is the best fit?

- A) Amazon SQS FIFO queues sharded across thousands of queues with messages deleted upon consumption.
- B) Amazon Kinesis Data Streams on-demand relying on default 24-hour retention for replay.
- C) Amazon MSK (Apache Kafka) with KIP-405 Tiered Storage for 14-day retention and KIP-392 rack-aware follower fetching for same-AZ consumer reads.
- D) A single Amazon SQS Standard queue configured with a 14-day message retention period and a dead-letter queue.

<details><summary>Answer</summary>

**C.** Amazon MSK provides a partitioned append-only log with per-key ordering, independent consumer-group offsets, and multi-consumer replay. Tiered Storage offloads 14-day historical segments off broker EBS volumes into S3-backed storage, and KIP-392 lets consumers fetch from same-AZ replicas to cut cross-AZ consumer transfer fees.

- Why not A: SQS FIFO is a destructive queue (messages are deleted upon acknowledgement), so it cannot support multi-consumer replay, and managing `1M msg/s` across sharded FIFO queues adds severe operational overhead.
- Why not B: Kinesis Data Streams defaults to 24-hour retention (requiring extended retention billing for 14 days), needs `~1,000` shards at `1M msg/s` / `1 GB/s`, and lacks KIP-392 rack-aware follower fetching to curb cross-AZ consumer reads.
- Why not D: SQS Standard does not guarantee strict ordering, and its 14-day retention controls unread expiry rather than post-acknowledgement replay.
- Ref: [modules/18-distributed-message-queue.md](../modules/18-distributed-message-queue.md#6-technology-comparison-then-vs-now-2021-vs-2026), https://docs.aws.amazon.com/msk/latest/developerguide/what-is-msk.html

</details>

---

### Q-CERT-020 · AWS SAP-C02: Zero-Copy, TLS & Broker I/O Sizing · difficulty 3 · single

A high-throughput Kafka cluster on AWS enables TLS encryption between clients and brokers while multiple downstream analytics consumers perform cold catch-up replays from 7 days ago. Which statement accurately explains the resulting I/O and CPU bottleneck?

- A) NIC hardware automatically encrypts `sendfile()` DMA buffers without JVM configuration, and cold replays are served entirely from RAM.
- B) Standard JVM user-space TLS runs transparently inside the kernel page cache, so `sendfile()` remains active and disk throughput is irrelevant.
- C) User-space TLS forces brokers to copy log bytes from the kernel page cache into user-space/JVM memory for encryption before writing to the socket—disabling zero-copy `sendfile()`—while cold catch-up reads miss the hot page cache and hit sequential NVMe/EBS disk bandwidth.
- D) TLS encrypts only KRaft metadata RPCs, leaving consumer fetch payloads on the plaintext `sendfile()` zero-copy path.

<details><summary>Answer</summary>

**C.** Standard broker TLS executes in user space (JVM), requiring bytes to leave the kernel page cache, get encrypted in user buffers, and copy back into kernel socket buffers, which disables `sendfile()` zero-copy and increases CPU and GC pressure (unless kernel TLS `kTLS` is enabled). Meanwhile, 7-day-old segments are no longer hot in RAM, so cold replays compete for sequential disk bandwidth and can evict hot tail segments from the page cache.

- Why not A: Standard Linux/JVM brokers do not offload TLS into NIC hardware automatically, and 7-day historical segments exceed hot page-cache RAM.
- Why not B: User-space TLS does not execute inside the kernel page cache; `sendfile()` works directly only when the kernel owns the full data path (plaintext or `kTLS`).
- Why not D: Kafka TLS encrypts the entire TCP transport including produce and fetch record batches, not only metadata RPCs.
- Ref: [modules/18-distributed-message-queue.md](../modules/18-distributed-message-queue.md#2-high-level-architecture-segmented-commit-log-and-zero-copy-io), https://kafka.apache.org/documentation/#design_filesystem

</details>

---

### Q-CERT-021 · GCP PCA: Cloud Pub/Sub & Managed Kafka Architecture · difficulty 2 · scenario

A payments engineering team migrating to Google Cloud operates existing Apache Kafka producers, Kafka Connect pipelines, and consumer groups that rely on partition-level offset replay, and cannot rewrite client applications during migration. Which Google Cloud service fits best?

- A) Cloud Pub/Sub pull subscriptions with ordering keys and dead-letter topics.
- B) Google Cloud Managed Service for Apache Kafka, preserving Kafka wire protocol, partition semantics, Kafka Connect compatibility, and consumer-group offset replay.
- C) Cloud Pub/Sub with dead-letter topics and default unordered delivery.
- D) Cloud Tasks queues dispatching HTTP webhooks with exponential backoff.

<details><summary>Answer</summary>

**B.** Managed Service for Apache Kafka speaks the native Kafka protocol and preserves partitioned commit-log semantics, consumer-group offsets, and Kafka Connect integrations without requiring client rewrites.

- Why not A: Cloud Pub/Sub provides serverless pull subscriptions, per-key ordering, and seek/replay, but it does not speak the native Kafka wire protocol or support Kafka consumer-group partition mechanics directly without client migration.
- Why not C: Unordered Pub/Sub drops both protocol compatibility and ordering guarantees.
- Why not D: Cloud Tasks is an HTTP task dispatcher, not a durable replayable partitioned event log.
- Ref: [modules/18-distributed-message-queue.md](../modules/18-distributed-message-queue.md#6-technology-comparison-then-vs-now-2021-vs-2026), https://cloud.google.com/managed-service-for-apache-kafka/docs/overview

</details>

---

### Q-CERT-022 · Azure AZ-305: Azure Event Hubs vs. Service Bus · difficulty 2 · scenario

An enterprise fulfillment backend dispatches individual order commands to a pool of competing workers. Requirements include per-message lock and acknowledgement, automatic isolation of poison messages into a dead-letter queue after 5 failed attempts, and FIFO ordering per customer session. Which Azure messaging service is the right choice?

- A) Azure Event Hubs with Capture to ADLS Gen2, because Capture retains historical Parquet/Avro files.
- B) Azure Service Bus Premium queues configured with message sessions and built-in dead-letter queues.
- C) Azure Event Hubs configured with one independent consumer group per worker process.
- D) Azure Event Hubs with workers polling Capture files directly from ADLS Gen2 as a task queue.

<details><summary>Answer</summary>

**B.** Azure Service Bus is an enterprise point-to-point message broker offering competing-consumer delivery, per-message peek-lock settlement, built-in dead-letter queues after `MaxDeliveryCount`, and session-scoped FIFO ordering.

- Why not A: Event Hubs is a partitioned append-only log using partition-level offset checkpointing rather than per-message locks or native dead-letter queues; Capture is an archival feature for analytics.
- Why not C: Giving each worker its own Event Hubs consumer group broadcasts every event to every worker (duplicate command execution) rather than load-balancing competing consumers.
- Why not D: Polling batch Capture files in object storage provides neither low-latency command dispatch nor per-message locking/DLQ semantics.
- Ref: [modules/18-distributed-message-queue.md](../modules/18-distributed-message-queue.md#6-technology-comparison-then-vs-now-2021-vs-2026), https://learn.microsoft.com/en-us/azure/service-bus-messaging/message-sessions

</details>

---

### Q-CERT-023 · CNCF / SRE: Message Queue Observability & Rebalance Stability · difficulty 3 · single

Which alerting configuration best reflects symptom-based SRE SLIs for a mission-critical distributed message queue cluster?

- A) Page immediately whenever average broker CPU exceeds `80%` or whenever a rolling broker restart changes cluster node count temporarily.
- B) Page immediately on `OfflinePartitionsCount > 0`; alert on sustained `UnderReplicatedPartitions > 0`, rising consumer-group lag slope, and elevated rebalance rate.
- C) Page on every single consumer rebalance log entry while omitting consumer lag because lag belongs exclusively to downstream application teams.
- D) Monitor only median (`p50`) producer acknowledgement latency, assuming healthy `p50` guarantees durability and consumer progress.

<details><summary>Answer</summary>

**B.** `OfflinePartitionsCount > 0` signals active leaderless partitions (hard unavailability) requiring an immediate page; sustained `UnderReplicatedPartitions > 0` signals shrinking durability headroom; rising lag slope detects consumers falling behind ingest; and elevated rebalance rate catches poison-pill or `max.poll.interval.ms` death spirals early.

- Why not A: Broker CPU and planned rolling restarts are cause-level signals that trigger noisy false pages while missing silent durability loss or consumer stalls.
- Why not C: Individual planned rebalances during deployments are normal, whereas ignoring consumer lag blinds SREs to broken downstream processing.
- Why not D: Median produce latency can stay `< 5 ms` even while half the consumers are stalled in a rebalance loop or a follower has dropped out of ISR.
- Ref: [modules/18-distributed-message-queue.md](../modules/18-distributed-message-queue.md#5-production-gotchas-failure-modes-and-sre-guardrails), https://sre.google/sre-book/monitoring-distributed-systems/

</details>

---

### Q-CERT-024 · Multi-Cloud Architecture: 2021 vs. 2026 Messaging Modernization · difficulty 2 · multi

Which **two** concrete architectural improvements result from modernizing a 2021 Kafka cluster (external ZooKeeper, eager consumer rebalancing, local-disk-only storage) to a 2026 architecture using KRaft, KIP-848, and KIP-405 Tiered Storage or diskless S3-native brokers?

- A) KRaft removes the external ZooKeeper cluster, eliminating dual-metadata failure modes and enabling sub-second controller failovers at `1M+` partitions.
- B) KIP-848 replaces eager stop-the-world client-leader rebalancing with broker-driven incremental reconciliation, eliminating whole-group processing pauses during deployments and autoscaling.
- C) Legacy ZooKeeper eager rebalancing guarantees stronger per-partition message ordering than KIP-848.
- D) Enabling KIP-405 Tiered Storage removes the need for active-segment replication, allowing `min.insync.replicas=1` with zero data-loss risk.

<details><summary>Answer</summary>

**A, B.** KRaft consolidates metadata into an internal Raft quorum for faster failover and simpler operations, and KIP-848 eliminates global stop-the-world rebalance stalls by reconciling partition deltas incrementally on the broker coordinator.

- Why not C: Partition ordering is governed by the append-only partition log and single-owner assignment; eager rebalancing does not strengthen ordering, it merely halts the entire consumer group during transitions.
- Why not D: KIP-405 offloads closed immutable segments to object storage; active open segments still rely on broker ISR replication (`RF=3`, `min.insync.replicas=2`) for write durability.
- Ref: [modules/18-distributed-message-queue.md](../modules/18-distributed-message-queue.md#6-technology-comparison-then-vs-now-2021-vs-2026), https://cwiki.apache.org/confluence/display/KAFKA/KIP-848%3A+The+Next+Generation+of+the+Consumer+Rebalance+Protocol

</details>

---

## Module 19: Hotel Reservation System, Overbooking & OTA Scale-Out (`Q-CERT-025`–`Q-CERT-030`)

### Q-CERT-025 · AWS SAP-C02: High-Concurrency Reservation & CDC Caching Architecture · difficulty 3 · scenario

An Online Travel Agency (OTA) on AWS handles `30,000 QPS` of availability and checkout traffic (`300,000 QPS` browsing, `1,000x` a single 5,000-hotel chain) across `~5,000,000` properties. Each booking spans multiple consecutive nights and must enforce `total_reserved + roomCount <= (total_inventory * 110) / 100` atomically without overselling, keep the read cache fresh without application dual-write races, and charge an external payment gateway without exhausting database connections. Which AWS architecture satisfies these requirements?

- A) Store room-night items in Amazon DynamoDB and execute a `TransactWriteItems` call that synchronously invokes the external payment gateway inside the transaction lock before committing.
- B) Partition Amazon Aurora PostgreSQL clusters across shards by `hotel_id` (co-locating `reservation` and `room_type_inventory`), stream committed WAL changes via Debezium / AWS DMS into Amazon ElastiCache for Valkey for the read tier, and orchestrate external payment capture via an AWS Step Functions / Temporal Saga after the `< 5 ms` local database hold commits.
- C) Use a single unsharded Aurora PostgreSQL writer with read replicas, invalidate ElastiCache every `15 minutes` via an EventBridge cron job, and capture the credit card charge before checking room inventory.
- D) Use eventually consistent DynamoDB counters with no per-night capacity condition and run an AWS Glue nightly job to refund overbooked guests.

<details><summary>Answer</summary>

**B.** Sharding Aurora PostgreSQL by `hotel_id` keeps every multi-night booking for a property inside a single-shard local ACID transaction (`30,000 / 16 = 1,875 QPS/shard`), WAL-based CDC updates ElastiCache for Valkey asynchronously in commit order without dual-write drift, and running payment capture in a Step Functions / Temporal Saga after committing the `PENDING_PAYMENT` hold ensures zero database row locks are held across external PSP network calls.

- Why not A: Invoking an external payment gateway inside an open database transaction stretches lock duration from milliseconds to seconds, throttling concurrent bookings on the same hotel.
- Why not C: A single writer saturates under global OTA write bursts, 15-minute cron cache invalidation serves heavily stale availability, and charging cards before reserving inventory creates paid orders with no rooms.
- Why not D: Allowing unconstrained writes and refunding guests hours later in a nightly batch violates the strict overbooking cap and causes severe customer and walk-penalty losses.
- Ref: [modules/19-hotel-reservation-system.md](../modules/19-hotel-reservation-system.md#4-ota-scale-out-sharding-by-hotel_id-and-cdc-driven-inventory-caching), https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/CHAP_AuroraOverview.html

</details>

### Q-CERT-026 · AWS SAP-C02: Idempotency, Deadlock Prevention & Overbooking Guards · difficulty 3 · single

A reservation microservice running on AWS Lambda behind API Gateway processes `POST /v1/reservations` against an Aurora PostgreSQL shard. Both mobile clients and API Gateway retries can deliver duplicate requests, and concurrent buyers frequently book overlapping date ranges. Which database contract eliminates duplicate bookings, parameter tampering, multi-night deadlocks, and checkout-day off-by-one errors?

- A) Enforce `UNIQUE (reservation_id)` with SHA-256 `payload_hash` comparison on conflict (`409` on mismatch), lock/update nights in canonical `ORDER BY hotel_id ASC, room_type_id ASC, date ASC` over the half-open interval `date >= checkIn AND date < checkOut`, assert `rows_affected == num_nights`, and enforce `CHECK (total_reserved <= (total_inventory * 110) / 100)`.
- B) Generate a fresh `UUIDv4` inside the Lambda handler on every invocation, lock rows using `ORDER BY date DESC`, and rely on application-side floating-point math (`1.1 * total_inventory`) without database constraints.
- C) Query inventory using `WHERE date BETWEEN checkIn AND checkOut`, ignore payload changes when `reservation_id` matches, and set `CHECK (total_reserved <= total_inventory)`.
- D) Deduplicate requests using a 1-second ElastiCache TTL lock only and allow PostgreSQL to lock multi-night rows in arbitrary heap-scan order.

<details><summary>Answer</summary>

**A.** A client-supplied `reservation_id` (`UNIQUE` PK) paired with `payload_hash` verification guarantees idempotent retries while rejecting mutated parameters (`409 Conflict`). Half-open `[checkIn, checkOut)` intervals leave the checkout morning free for the next guest, canonical ascending date order prevents Coffman circular-wait deadlocks (`SQLSTATE 40P01`), and the integer `CHECK` constraint enforces the `10%` overbooking cap at the storage boundary.

- Why not B: Generating a new UUID inside the retry handler defeats idempotency (every retry creates a new booking), and floating-point multiplication without a database `CHECK` constraint risks boundary rounding bugs.
- Why not C: Inclusive `BETWEEN` reserves the checkout night (stealing up to `33%` of capacity), ignoring payload drift silently replays stale confirmations for altered dates, and dropping the `110%` factor breaks the controlled overbooking policy.
- Why not D: Ephemeral cache locks expire before slow mobile retries arrive, and arbitrary heap-scan lock ordering causes `SQLSTATE 40P01` deadlocks under concurrent overlapping stays.
- Ref: [modules/19-hotel-reservation-system.md](../modules/19-hotel-reservation-system.md#3-concurrency-control-idempotency-locking-ordered-dates-and-database-constraints), https://www.postgresql.org/docs/current/ddl-constraints.html

</details>

### Q-CERT-027 · GCP PCA: Global Hospitality Inventory on Cloud Spanner vs. Cloud SQL · difficulty 3 · scenario

A hospitality company currently operates a regional hotel chain (`5,000` hotels, `73M` inventory rows over a 2-year horizon, `~3 TPS` bookings) on Google Cloud and plans to expand into a multi-region global OTA (`30,000 QPS`) requiring strong external consistency across continents without manual shard management. Which architectural evolution aligns with Google Cloud best practices?

- A) Deploy a 50-node multi-region Cloud Spanner instance for the `3 TPS` regional chain today, and replicate data directly from Spanner into Memorystore using Cloud DNS.
- B) Run Cloud SQL for PostgreSQL (with HA synchronous standby and Memorystore for Valkey/Redis) for the `3 TPS` regional chain (`~9–12 GB` working set fits entirely in RAM), and migrate at global OTA scale to Cloud Spanner using `INTERLEAVE IN PARENT Hotels ON DELETE CASCADE` by `hotel_id` with Spanner Change Streams feeding regional Memorystore caches.
- C) Use Cloud Bigtable as the transactional system of record for multi-night hotel bookings because Bigtable supports multi-row SQL `CHECK` constraints across dates.
- D) Keep a single single-zone Cloud SQL instance for the global `30,000 QPS` OTA and perform application-side dual writes to Memorystore.

<details><summary>Answer</summary>

**B.** For a `3 TPS` / `73M-row` (`~9–12 GB`) chain, Cloud SQL for PostgreSQL holds the entire working set in buffer-pool RAM at minimal operational cost. When scaling to a global multi-region OTA (`30,000 QPS`), Cloud Spanner provides TrueTime external consistency and automatic sharding; interleaving `RoomTypeInventory` and `Reservations` under `Hotels` by `hotel_id` physically co-locates all nights for a hotel inside the same Spanner split, while Spanner Change Streams replace Debezium to keep regional Memorystore caches warm.

- Why not A: Provisioning multi-region Cloud Spanner for a `3 TPS` regional workload wastes budget on unused distributed consensus capacity, and Cloud DNS does not replicate database changes to Memorystore.
- Why not C: Cloud Bigtable provides single-row atomicity only and lacks multi-row ACID transactions or relational `CHECK` constraints across multi-night date ranges.
- Why not D: A single-zone Cloud SQL instance lacks high availability, cannot absorb `30,000 QPS` globally without sharding/read offloading, and dual writes corrupt cache consistency.
- Ref: [modules/19-hotel-reservation-system.md](../modules/19-hotel-reservation-system.md#4-ota-scale-out-sharding-by-hotel_id-and-cdc-driven-inventory-caching), https://cloud.google.com/spanner/docs/schema-and-data-model#creating-interleaved-tables

</details>

### Q-CERT-028 · Azure AZ-305: Multi-Shard Reservation Data & Durable Workflows · difficulty 2 · scenario

An enterprise hospitality platform on Azure needs to scale its relational reservation and room-type inventory tables horizontally across `16` shards while preserving single-node ACID semantics per hotel, caching availability in memory, and coordinating external payment capture with automatic compensating rollback on decline. Which Azure architecture should you recommend?

- A) Distribute `room_type_inventory` and `reservation` across `hotel_id` shards using Azure Cosmos DB for PostgreSQL (Citus) or `hotel_id`-sharded Azure Database for PostgreSQL – Flexible Server, stream WAL changes into Azure Managed Redis, and orchestrate the payment and compensating inventory release via Azure Durable Functions (or Temporal on AKS).
- B) Store `reservation` and `room_type_inventory` in two separate Azure SQL databases and coordinate every booking plus the external Stripe HTTP webhook inside a single blocking MSDTC Two-Phase Commit (2PC) transaction.
- C) Use Azure Blob Storage CSV files updated by an hourly Azure Data Factory pipeline as the primary inventory database.
- D) Use Azure Cache for Redis with volatile LRU eviction as the sole primary database without relational persistence.

<details><summary>Answer</summary>

**A.** Co-locating `reservation` and `room_type_inventory` by the `hotel_id` distribution column in Cosmos DB for PostgreSQL (Citus) or sharded Flexible Server executes every multi-night stay as a fast single-shard ACID transaction. WAL CDC keeps Azure Managed Redis synchronized for the read funnel, and Durable Functions / Temporal orchestrates the asynchronous payment saga with durable state and idempotent compensating releases.

- Why not B: Splitting closely coupled tables across separate databases and wrapping external third-party payment calls in blocking 2PC creates a coordinator SPOF and exhausts database connection pools.
- Why not C: Hourly batch CSV pipelines cannot enforce real-time ACID booking constraints or prevent concurrent double-bookings.
- Why not D: Volatile LRU caches evict keys under memory pressure and lack relational multi-night ACID transaction guarantees.
- Ref: [modules/19-hotel-reservation-system.md](../modules/19-hotel-reservation-system.md#5-microservice-consistency-co-located-acid-boundary-vs-2pc-and-saga-workflows), https://learn.microsoft.com/en-us/azure/cosmos-db/postgresql/introduction

</details>

### Q-CERT-029 · CNCF / SRE: Reservation Funnel SLIs, Horizon Guardrails & CDC Lag · difficulty 3 · single

An SRE team is defining production alerting and SLIs for a `hotel_id`-sharded reservation system backed by a 730-day rolling CRON inventory horizon and a Debezium-to-Valkey CDC cache. Which SLI and guardrail combination directly detects silent correctness and availability failures before revenue is lost?

- A) Page only when average Valkey CPU exceeds `85%` or total daily bookings drop to zero across the entire fleet.
- B) Page immediately if `OversellInvariantBreachCount` (`total_reserved > (total_inventory * 110) / 100`) exceeds `0`; alert when rolling horizon coverage (`MAX(date) - CURRENT_DATE`) falls below `720 days`; track Debezium CDC replication lag (`p99 < 100 ms`, page `> 2 s`) alongside the stale-cache checkout `409` rejection rate; and monitor multi-night `SQLSTATE 40P01` deadlock rate and payment saga compensation backlog.
- C) Alert whenever any single user receives an HTTP `409 Conflict` on checkout, and automatically disable the `chk_overbooking_cap` database constraint when `409` responses occur.
- D) Monitor only the mean HTTP response time across `GET /v1/hotels` and `POST /v1/reservations` combined.

<details><summary>Answer</summary>

**B.** Each metric guards a specific failure mode of the reservation architecture: `OversellInvariantBreachCount > 0` catches storage invariant violations immediately; `MAX(date) - CURRENT_DATE < 720` detects a broken horizon-seeding CRON job 10 days before 2-year-ahead bookings hit `0 rows matched`; CDC lag plus stale-cache `409` rate measures read-to-write cache divergence; `40P01` deadlock rate catches unsorted multi-night queries; and saga compensation backlog detects stuck payment rollbacks.

- Why not A: Waiting for fleet-wide bookings to hit zero misses single-shard deadlocks, horizon starvation on 24-month bookings, and silent overbooking breaches.
- Why not C: Occasional `409 Sold Out` conflicts are expected when concurrent users race for the last room, and disabling `chk_overbooking_cap` destroys the primary safeguard against overselling.
- Why not D: Combining read-heavy `GET` (99% of traffic) and write `POST` (1% of traffic) into a single mean latency hides `POST` tail spikes, deadlocks, and inventory invariant breaches.
- Ref: [modules/19-hotel-reservation-system.md](../modules/19-hotel-reservation-system.md#6-production-gotchas-sre-guardrails-and-2021-vs-2026-comparison), https://sre.google/workbook/alerting-on-slos/

</details>

### Q-CERT-030 · Multi-Cloud Architecture: 2021 vs. 2026 Reservation Platform Modernization · difficulty 2 · multi

Select **two** genuine architectural improvements achieved when modernizing a 2021 hotel reservation stack (inclusive `BETWEEN` SQL queries, application dual-write cache invalidation, random `UUIDv4` keys, and blocking 2PC across split Reservation/Inventory/Payment databases) to the 2026 standard.

- A) Replacing application dual-write cache updates with log-based Debezium WAL/binlog CDC into Valkey ensures cache updates follow exact database commit order without dual-write race conditions, while the relational database remains the final authority on `POST /v1/reservations`.
- B) Co-locating `reservation` and `room_type_inventory` on `hotel_id`-sharded SQL using half-open `[checkIn, checkOut)` intervals and UUIDv7 idempotency keys executes multi-night holds in `< 5 ms` local ACID transactions while Temporal durable sagas coordinate external payments without holding DB row locks.
- C) Switching from `date >= checkIn AND date < checkOut` back to `date BETWEEN checkIn AND checkOut` increases occupancy by reserving the checkout morning for every guest.
- D) Replacing relational `CHECK` constraints with unvalidated client-side JavaScript button disabling removes all server-side concurrency overhead.

<details><summary>Answer</summary>

**A, B.** Log-based Debezium CDC eliminates dual-write cache drift while keeping the database authoritative for writes, and co-locating `reservation` + `room_type_inventory` by `hotel_id` with half-open `[checkIn, checkOut)` intervals, time-ordered UUIDv7 keys, and Temporal payment sagas delivers sub-5 ms local ACID holds without blocking database connections on external PSP calls.

- Why not C: SQL `BETWEEN` is inclusive of both endpoints and locks the checkout day as an extra night, _reducing_ occupancy by blocking same-day check-ins.
- Why not D: Client-side UI button disabling is trivially bypassed by network retries, multiple users, or non-browser clients and cannot prevent double-booking or overselling.
- Ref: [modules/19-hotel-reservation-system.md](../modules/19-hotel-reservation-system.md#6-production-gotchas-sre-guardrails-and-2021-vs-2026-comparison), https://www.rfc-editor.org/rfc/rfc9562

</details>

---

## Module 20: Distributed Email Service, Deliverability & Per-User Search (`Q-CERT-031`–`Q-CERT-036`)

### Q-CERT-031 · AWS SAP-C02: Dedicated IP Pools, SES Deliverability & Content-Addressed S3 Attachments · difficulty 3 · scenario

A SaaS platform on AWS dispatches both time-critical 2FA login codes and high-volume promotional newsletters through Amazon Simple Email Service (SES), while storing user email attachments in Amazon S3. Last week, a promotional campaign triggered a `0.45%` user spam complaint rate at Gmail and Yahoo, causing outbound 2FA codes to be throttled and routed to Spam, while S3 attachment costs spiked due to identical PDF brochures attached across millions of messages. Which AWS architecture resolves both failures?

- A) Keep all traffic on a single shared SES IP pool, disable complaint feedback notifications, and store attachments inline as Base64 strings inside Amazon DynamoDB.
- B) Isolate transactional 2FA mail and promotional mail onto separate Amazon SES Dedicated IP Pools (and distinct subdomains) with managed IP warm-up enabled; route SES bounce and complaint Feedback Loop (FBL) events via Amazon SNS to an automated circuit breaker that pauses the marketing pool before complaints reach the `0.3%` bulk-sender limit; and decode MIME Base64 attachments at the edge into an S3 Content-Addressed Store keyed by `SHA-256` digest with reference-counted lifecycle reclamation.
- C) Provision 50 brand-new un-warmed dedicated IPs and blast 5 million promotional emails on Day 1 while storing duplicate raw Base64 files per recipient in S3 Standard.
- D) Disable DKIM and DMARC so recipient MTAs cannot attribute spam complaints to the sender domain.

<details><summary>Answer</summary>

**B.** Separating transactional and marketing streams onto distinct SES Dedicated IP Pools and subdomains prevents a promotional complaint spike from poisoning 2FA IP reputation. Managed IP warm-up ramps new IP volume gradually over 2–6 weeks, SNS FBL notifications trip an automated circuit breaker before the `0.3%` (`0.003`) Gmail/Yahoo bulk-sender complaint ceiling is breached, and decoding Base64 attachments into a `SHA-256` content-addressed S3 bucket eliminates both the `33.3%` Base64 bloat and duplicate broadcast copies.

- Why not A: A shared IP pool couples transactional and marketing reputation, and storing large Base64 blobs in DynamoDB violates the `400 KB` item limit while paying a `33.3%` encoding penalty.
- Why not C: Blasting millions of messages through un-warmed IPs triggers immediate ISP throttling/blocking, and per-recipient Base64 copies waste petabytes of storage.
- Why not D: Gmail and Yahoo mandate SPF, DKIM, and DMARC authentication for bulk senders; removing them causes immediate edge rejection (`550`).
- Ref: [modules/20-distributed-email-service.md](../modules/20-distributed-email-service.md#4-email-deliverability-authentication-and-bulk-sender-guardrails), https://docs.aws.amazon.com/ses/latest/dg/dedicated-ip-management.html

</details>

### Q-CERT-032 · AWS SAP-C02: Multi-Tenant Per-User Email Search on Amazon OpenSearch · difficulty 3 · single

A multi-tenant email service uses Amazon OpenSearch Service with `128` primary shards to index incoming emails and flag changes. Currently, every single-user mailbox search query fans out across all `128` shards, causing high `p99` latency and CPU saturation during peak hours. Which architectural change eliminates cluster-wide scatter-gather queries while keeping ingestion decoupled from the mail delivery path?

- A) Stream mailbox mutation events through an Amazon MSK (Kafka) topic partitioned by `user_id` and index every document into OpenSearch with `_routing = user_id` (and query with `_routing = user_id`), ensuring each user's entire mailbox resides on a single shard.
- B) Route documents randomly by `message_id` across all `128` shards and increase the OpenSearch HTTP client timeout to `60 seconds`.
- C) Execute synchronous blocking OpenSearch index writes inside the SMTP `DATA` transaction before returning `250 OK` to the remote MTA, with no routing key.
- D) Create a separate OpenSearch cluster for every individual user account (`1 billion` clusters).

<details><summary>Answer</summary>

**A.** Email search is strictly isolated to a single `user_id` and is write-heavy. Decoupling index mutations through Amazon MSK (keyed by `user_id` to preserve per-user causal order) keeps the mail delivery path fast, and setting `_routing = user_id` in OpenSearch hashes all documents for a user onto **1 shard** (`hash(user_id) % 128`), turning a 128-shard scatter-gather query into a single-shard read.

- Why not B: Routing by `message_id` scatters one user's emails across every shard in the cluster, preserving the 128-shard fan-out bottleneck.
- Why not C: Synchronous index writes on the SMTP hot path couple mail acceptance availability to search cluster health and still fail to solve the 128-shard query fan-out.
- Why not D: Provisioning a dedicated cluster per user is impossible at millions or billions of users; logical shard routing (`_routing = user_id`) or a co-located per-user LSM index achieves isolation within shared infrastructure.
- Ref: [modules/20-distributed-email-service.md](../modules/20-distributed-email-service.md#5-write-heavy-per-user-email-search-elasticsearch-vs-custom-lsm-indexes), https://docs.aws.amazon.com/opensearch-service/latest/developerguide/sizing-domains.html

</details>

### Q-CERT-033 · GCP PCA: Planetary Mailbox Storage on Cloud Bigtable / Spanner & Pub/Sub · difficulty 3 · scenario

You are architecting a global consumer email platform on Google Cloud. Mailbox metadata (folders, read/unread state, labels, and RFC 5322 threading headers) must support high-throughput sequential writes partitioned by `user_id` with **CP strong consistency** so deleted or read emails never resurrect across devices, attachments (`1.46 EB/yr` raw) must be deduplicated, and ML phishing/BEC classification must not block edge SMTP acceptance. Which Google Cloud architecture best fits?

- A) Store mailbox metadata in multi-region Cloud Spanner (or single-cluster-routed Cloud Bigtable with strong per-tablet consistency) keyed by `(user_id, email_id DESC)` with denormalized unread/label indexes; decode Base64 attachments at the edge into Cloud Storage keyed by `SHA-256` hash with reference counting; and stream accepted envelopes through Cloud Pub/Sub to asynchronous Vertex AI / Dataflow spam-classification and search-indexing workers.
- B) Store each email as a separate POSIX file on a single Compute Engine Persistent Disk shared via NFS across regions.
- C) Store `25 MB` Base64 attachments directly inside Cloud Pub/Sub attributes and rely on eventually consistent cross-region Bigtable multi-cluster routing without conflict resolution for read flags.
- D) Use BigQuery as the primary OLTP mailbox database for per-message `is_read` flag toggles at `500,000 QPS`.

<details><summary>Answer</summary>

**A.** Keying Cloud Spanner (or single-routed Bigtable tablets) by `user_id` with descending `TimeUUID`/`UUIDv7` `email_id` clustering co-locates a user's entire mailbox for fast sequential newest-first scans while providing strong CP consistency across devices. Decoding Base64 attachments into Cloud Storage by `SHA-256` digest eliminates duplicate blobs, and Cloud Pub/Sub decouples edge SMTP acceptance from heavy ML phishing/BEC classification and search indexing.

- Why not B: File-per-email on an NFS persistent disk suffers inode exhaustion, random 4 KB IOPS saturation, and single-point-of-failure storage bottlenecks.
- Why not C: Cloud Pub/Sub has a `10 MB` message size limit (attachments belong in Cloud Storage, not message buses), and uncoordinated eventual consistency causes read/delete flag resurrection across devices.
- Why not D: BigQuery is a columnar analytical data warehouse (`OLAP`), not a low-latency high-QPS row-mutation OLTP mailbox store.
- Ref: [modules/20-distributed-email-service.md](../modules/20-distributed-email-service.md#3-mailbox-storage-engine-data-modeling-threading-and-attachment-deduplication), https://cloud.google.com/bigtable/docs/overview

</details>

### Q-CERT-034 · Azure AZ-305: Enterprise Email Pipeline with Azure Communication Services, Cosmos DB & AI Search · difficulty 2 · scenario

An enterprise collaboration suite on Azure needs to store user mailbox metadata with per-user partition locality, strong consistency for read/unread and draft mutations, deduplicated binary attachment storage, and asynchronous full-text search indexing. Which Azure architecture should you select?

- A) Partition Azure Cosmos DB by `user_id` using Strong or Bounded-Staleness consistency (with denormalized unread projections or composite indexes on `(folder_id, email_id DESC)`), store decoded binary attachments in Azure Blob Storage keyed by `SHA-256` content hash with reference counts, and stream Cosmos DB Change Feed events through Azure Event Hubs to index documents in Azure AI Search.
- B) Partition Azure Cosmos DB by random `attachment_id` with Eventual consistency and store `20 MB` attachments inline inside the `2 MB`-capped Cosmos DB JSON item.
- C) Store all mailbox metadata in unindexed Azure Queue Storage and rebuild the search index once a week via an Azure Automation script.
- D) Use a single Azure Cache for Redis instance with no persistent backing store for 10-year enterprise email archival.

<details><summary>Answer</summary>

**A.** Partitioning Cosmos DB by `user_id` scopes every folder list, thread reconstruction, and flag toggle to a single logical partition (`100%` single-partition queries), while Strong / Bounded-Staleness consistency prevents multi-device read-state split-brain. Offloading decoded binary attachments to Azure Blob Storage by `SHA-256` hash avoids Cosmos DB's `2 MB` item limit and deduplicates shared files, and the Cosmos DB Change Feed -> Event Hubs pipeline keeps Azure AI Search updated within seconds asynchronously.

- Why not B: Partitioning by `attachment_id` breaks per-user queries, Eventual consistency permits deleted/read flag regression, and `20 MB` attachments fail Cosmos DB's `2 MB` document size limit.
- Why not C: Queue Storage is an ephemeral work queue (64 KB message cap), not an indexed mailbox store, and weekly search indexing violates real-time search SLAs.
- Why not D: In-memory Redis cannot cost-effectively or durably store multi-petabyte 10-year compliance archives.
- Ref: [modules/20-distributed-email-service.md](../modules/20-distributed-email-service.md#3-mailbox-storage-engine-data-modeling-threading-and-attachment-deduplication), https://learn.microsoft.com/en-us/azure/cosmos-db/partitioning-overview

</details>

### Q-CERT-035 · CNCF / SRE: SMTP Queue Depth, IP Reputation & DMARC/Complaint Guardrails · difficulty 3 · single

An SRE on-call engineer observes that the Outbound SMTP Retry Queue depth is growing steadily, while outbound SMTP worker CPU sits at `25%`. Per-domain telemetry reveals that `92%` of queued messages target a single external ISP returning `421 4.7.0 Try again later (greylisted / rate-limited)`, while one marketing tenant's ISP Feedback Loop (FBL) complaint rate just hit `0.34%`. What is the correct automated and operational remediation?

- A) Immediately scale the outbound SMTP worker fleet by `10x` so all queued messages retry against the external ISP simultaneously every second.
- B) Trip the marketing IP pool / tenant circuit breaker immediately because its `0.34%` complaint rate breached the `0.30%` (`0.003`) bulk-sender threshold, isolate its messages from healthy senders, and keep the `421`-deferred messages in the hierarchical timing-wheel retry queue with **full-jitter exponential backoff** (`5m -> 15m -> 1h -> 4h` up to `72h`) rather than scaling workers into a retry storm against the rate-limiting ISP.
- C) Delete all messages in the retry queue immediately without notifying senders so queue depth returns to zero.
- D) Re-route the offending marketing campaign onto the transactional 2FA dedicated IP pool so it bypasses the marketing pool throttle.

<details><summary>Answer</summary>

**B.** As ByteByteGo Chapter 23 notes, a growing outbound retry queue has two distinct root causes: (1) insufficient worker capacity (high worker CPU across all domains), or (2) a remote recipient MTA returning `4xx` transient deferrals/throttling. Because worker CPU is `25%` and `92%` of deferrals come from one ISP's `421` rate limit triggered by a `0.34% >= 0.30%` spam-complaint spike, scaling workers would create a retry storm that gets the IPs permanently blocklisted! The correct action is to trip the FBL complaint circuit breaker on the offending marketing tenant/pool and drain the `421` backlog via jittered exponential backoff up to `72 hours`.

- Why not A: Multiplying worker retries against a remote MTA returning `421 rate-limited` is a classic retry storm that converts a temporary deferral into a permanent IP blocklist (`550`).
- Why not C: Silently dropping queued email violates the zero-data-loss contract; deferred mail must retry for up to `72 hours` and emit an explicit Non-Delivery Report (NDR bounce) if still undeliverable.
- Why not D: Moving high-complaint marketing traffic onto the transactional 2FA IP pool poisons the transactional IPs and blocks user login/password-reset codes.
- Ref: [modules/20-distributed-email-service.md](../modules/20-distributed-email-service.md#6-production-gotchas-sre-guardrails-and-2021-vs-2026-comparison), https://www.rfc-editor.org/rfc/rfc5321

</details>

### Q-CERT-036 · Multi-Cloud Architecture: 2021 vs. 2026 Email Platform Modernization · difficulty 2 · multi

Select **two** genuine architectural improvements when modernizing a 2021 email platform (stateful IMAP4 connections, opportunistic `STARTTLS`, `DMARC p=none`, unrouted Elasticsearch, and per-recipient Base64 attachment files) to the 2026 standard.

- A) Adopting **JMAP (RFC 8620 / 8621)** over stateless HTTP/2+ with `Email/changes` delta sync and **MTA-STS (RFC 8461)** eliminates sticky IMAP TCP connection bottlenecks and closes the active MITM downgrade vulnerability of opportunistic `STARTTLS`.
- B) Enforcing strict **DMARC (`p=quarantine/reject`)** with **ARC (RFC 8617)** and **RFC 8058 One-Click `List-Unsubscribe-Post`** alongside **edge Base64 decoding into a SHA-256 Content-Addressed Store (CAS)** blocks domain spoofing, satisfies 2024–2026 bulk-sender rules (`< 0.3%` complaints), and cuts physical attachment storage by `50%+`.
- C) Replacing `user_id` partitioning with random `email_id` partitioning in the metadata store and search index eliminates single-shard locality so every inbox view queries every node in the datacenter.
- D) Storing raw MIME Base64 strings without decoding reduces object-storage capacity requirements by `33.3%`.

<details><summary>Answer</summary>

**A, B.** JMAP (RFC 8620/8621) brings stateless HTTP/2+ batched delta sync to web and mobile clients while MTA-STS (RFC 8461) prevents SMTP `STARTTLS` downgrade attacks. Simultaneously, strict DMARC + ARC + RFC 8058 one-click unsubscribe + `< 0.3%` FBL circuit breakers meet modern ISP deliverability mandates, and decoding Base64 into a SHA-256 Content-Addressed Store eliminates both the `+33.3%` Base64 wire tax and duplicate attachment storage.

- Why not C: Random `email_id` partitioning destroys per-user data locality, forcing expensive cross-shard scatter-gather scans on every folder load and search query.
- Why not D: Base64 _increases_ byte size by `33.33%` (`4` ASCII bytes per `3` binary bytes); decoding Base64 to raw binary is what saves storage.
- Ref: [modules/20-distributed-email-service.md](../modules/20-distributed-email-service.md#6-production-gotchas-sre-guardrails-and-2021-vs-2026-comparison), https://www.rfc-editor.org/rfc/rfc8620, https://www.rfc-editor.org/rfc/rfc8461

</details>

---

## Module 21: Real-Time Gaming Leaderboard, Sharded Sorted Sets & Cloud Rankings (`Q-CERT-037`–`Q-CERT-042`)

### Q-CERT-037 · AWS SAP-C02: Serverless Gaming Leaderboard with ElastiCache for Valkey & Write-Sharded DynamoDB · difficulty 3 · scenario

A gaming studio deploys a serverless seasonal leaderboard on AWS (`5M` DAU, `2,894 QPS` peak match completions, `2,500 QPS` peak leaderboard reads). Authoritative game servers submit signed match outcomes through Amazon API Gateway and AWS Lambda. Live global rank and `±4` relative neighbor queries must return in `< 10 ms` from Amazon ElastiCache for Valkey, while every match outcome and durable seasonal score is persisted in Amazon DynamoDB. Which architecture prevents client score spoofing, duplicate retry inflation, and DynamoDB Global Secondary Index (GSI) hot-partition throttling?

- A) Require game servers (never game clients) to submit mTLS/HMAC-signed payloads with a deterministic `match_id` to API Gateway; have Lambda execute a conditional DynamoDB write (`attribute_not_exists(match_id)`) into `match_results` before running an atomic Valkey Lua script updating the 53-bit composite score in the ElastiCache ZSET; and partition the DynamoDB seasonal leaderboard GSI using **Write Sharding** (`gsi_pk = "season#2026-11#" + (hash(user_id) % 32)`, `gsi_sk = composite_score`) so writes distribute across 32 physical partitions rather than throttling a single `1,000 WCU/s` partition key.
- B) Embed long-lived IAM credentials inside the mobile game client so clients call `ZINCRBY` on ElastiCache directly and write to an unsharded DynamoDB GSI keyed on `gsi_pk = "season#2026-11"`.
- C) Write match results only to DynamoDB and run an hourly AWS Glue job that scans the entire table and overwrites ElastiCache once per hour.
- D) Create one ElastiCache ZSET key per player (`leaderboard:<user_id>`) and compute global rank by running `KEYS leaderboard:*` inside Lambda on every read request.

<details><summary>Answer</summary>

**A.** Terminating authoritative game-server requests at API Gateway + Lambda enforces the anti-cheat trust boundary, while a DynamoDB conditional write on `match_id` guarantees idempotent retry deduplication before mutating the ElastiCache for Valkey ZSET via an atomic Lua script. Because a naive DynamoDB GSI keyed solely on `"season#2026-11"` funnels 100% of current-season writes onto a single physical partition (`1,000 WCU/s` ceiling), write-sharding the GSI partition key across 32 suffixes (`0..31`) scales write capacity to `32,000 WCU/s` while ElastiCache serves sub-millisecond $O(\log N)$ `ZREVRANK` and `ZREVRANGE` reads.

- Why not B: Client-embedded IAM credentials allow players to forge arbitrary scores, and an unsharded season GSI partition key hits DynamoDB's `1,000 WCU/s` per-partition hot-key limit at `2,894 QPS` peak writes.
- Why not C: Hourly batch scans violate the real-time leaderboard requirement and consume massive DynamoDB RCU capacity.
- Why not D: A per-player ZSET cannot rank players against one another, and running `KEYS *` blocks the Valkey event loop in $O(N)$ time.
- Ref: [modules/21-realtime-gaming-leaderboard.md](../modules/21-realtime-gaming-leaderboard.md#2-high-level-architecture-api-contracts-and-anti-cheat-trust-boundaries), https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-sharding.html

</details>

### Q-CERT-038 · AWS SAP-C02: Valkey Memory Sizing, Copy-on-Write Headroom & Sharded Rank Queries · difficulty 3 · single

An ElastiCache for Valkey leaderboard stores `25,000,000` (`25M`) monthly active players in a sorted set (`OBJ_ENCODING_SKIPLIST`, `~128 B/member` = `~3.20 GB` active RAM) and takes periodic background RDB snapshots (`BGSAVE` via `fork()`) during peak evening tournaments. As the game expands toward `500M` DAU across a 16-shard cluster, which memory provisioning and global rank query design is required?

- A) Provision exactly `3.20 GB` of node RAM with `reserved-memory-percent = 0` because `fork()` shares memory pages with zero overhead during heavy writes.
- B) Provision **`~6.40 GB`** per `25M`-member shard (`2x` active ZSET footprint, enforcing ElastiCache `reserved-memory-percent >= 25–50%` headroom) so Copy-on-Write (`CoW`) page duplication during `fork()` RDB snapshots cannot trigger OOM or swap thrashing, and compute exact global rank across shards using `ZREVRANK` + $\sum \text{ZCARD}$ on higher score-range shards (or `ZSCORE` + parallel `ZCOUNT` across hash shards).
- C) Size the cluster using `26 B/member` (`650 MB`) and compute global rank by calling `INFO keyspace` on each shard and summing the `keys=` counts.
- D) Compute global rank on a 16-shard hash-partitioned cluster by calling `ZREVRANK` on all 16 shards and summing the 16 returned integers.

<details><summary>Answer</summary>

**B.** A `25M`-member ZSET in `OBJ_ENCODING_SKIPLIST` consumes `~128 B/member` (`~3.20 GB`) across `dictEntry`, `zskiplistNode`, `sds`, and `jemalloc` metadata. When `BGSAVE` calls `fork()`, the Linux kernel shares memory pages Copy-on-Write (`CoW`); under heavy score-update traffic (`2,894 QPS`), parent mutations dirty pages across the skip list and hash table, duplicating up to `100%` of the working set (`~6.40 GB` peak). Across a sharded cluster, exact global rank uses `ZREVRANK` + $\sum \text{ZCARD}$ of higher score-range shards, or 1 `ZSCORE` + $M$ parallel `ZCOUNT(shard_i, "(" + composite, "+inf")` calls across hash shards.

- Why not A: With zero CoW headroom, heavy write traffic during an active `fork()` snapshot duplicates dirtied pages until the node hits `maxmemory` or OOM.
- Why not C: `26 B/member` ignores 64-bit pointer overhead (`~5x` underestimate), and `INFO keyspace` reports top-level database key counts (`1`), not ZSET member cardinality (`ZCARD`).
- Why not D: On a hash-partitioned cluster, `ZREVRANK` returns `nil` on the 15 shards that do not hold the user; summing local ranks across independent shards is invalid (`ZCOUNT` by score is required).
- Ref: [modules/21-realtime-gaming-leaderboard.md](../modules/21-realtime-gaming-leaderboard.md#1-requirements-capacity-estimation-and-realistic-zset-memory-sizing), https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/redis-memory-management.html

</details>

### Q-CERT-039 · GCP PCA: Global Tournament Leaderboard on Memorystore for Valkey, Cloud Run & Cloud SQL/Spanner · difficulty 3 · scenario

A global esports platform runs authoritative match servers on GKE (Agones) and ingests match results through Cloud Run into Google Cloud Memorystore for Valkey and a durable relational database (Cloud Spanner or Cloud SQL). Ties must break deterministically in favor of the player who achieved the score earliest, and the platform must support deterministic disaster recovery if the Memorystore instance is recreated. Which design satisfies all requirements?

- A) Cloud Run verifies the Agones server's mTLS/HMAC signature, performs an idempotent insert of `(match_id, user_id, points, match_ts_ms)` into Cloud Spanner / Cloud SQL (`ON CONFLICT (match_id) DO NOTHING`), and invokes an atomic Lua script on Memorystore for Valkey that packs the 21-bit integer score and 32-bit inverted relative timestamp (`2^32 - 1 - elapsedMs`) into a 53-bit IEEE-754 safe integer; on disaster recovery, a batch replay of `match_results` ordered by `match_ts_ms` deterministically reconstructs the exact ZSET rankings.
- B) Game clients POST scores directly to Cloud Run, which packs a 32-bit score and 32-bit epoch timestamp into a 64-bit integer and passes it to `ZADD` without a backing database.
- C) Cloud Run streams match events to BigQuery only, and client apps run `SELECT RANK() OVER (ORDER BY score DESC) FROM leaderboard` directly against BigQuery at `2,500 QPS`.
- D) Cloud Run updates the composite score using raw `ZINCRBY` (`ZINCRBY leaderboard 1 user_id`) so the lower 32 timestamp bits increment by 1 on every win.

<details><summary>Answer</summary>

**A.** Cloud Run enforces server-only ingestion and deduplicates `match_id` in Cloud Spanner / Cloud SQL before executing the atomic Valkey Lua update. Packing `score * 2^32 + (2^32 - 1 - elapsedMs)` with `score < 2^21` stays within IEEE-754 binary64's 53-bit exact integer ceiling ($2^{53} - 1$), preserving earliest-achiever tie-breaking, and storing immutable `match_ts_ms` in the relational ledger enables bit-for-bit deterministic ZSET reconstruction during disaster recovery.

- Why not B: Client-submitted scores break anti-cheat security, and packing 64 bits into an IEEE-754 binary64 float rounds off the lower 11 timestamp bits.
- Why not C: BigQuery is an analytical OLAP warehouse with multi-hundred-millisecond query latency and slot limits, unsuitable for `2,500 QPS` real-time $O(\log N)$ player rank lookups.
- Why not D: Calling raw `ZINCRBY 1` on a bit-packed composite score increments the low timestamp bits instead of shifting the points delta by $2^{32}$ and refreshing the achievement timestamp.
- Ref: [modules/21-realtime-gaming-leaderboard.md](../modules/21-realtime-gaming-leaderboard.md#3-storage-engine-evolution-relational-sql-vs-valkey-sorted-sets-and-53-bit-tie-breaking), https://cloud.google.com/memorystore/docs/valkey/overview

</details>

### Q-CERT-040 · Azure AZ-305: Real-Time Gaming Backend with Azure Managed Redis & Cosmos DB · difficulty 2 · scenario

An Azure gaming backend uses Azure Functions to ingest match completions, Azure Managed Redis (Enterprise tier) to serve real-time ZSET leaderboards, and Azure Cosmos DB for NoSQL to store durable match history and player profiles. A developer proposes partitioning the Cosmos DB `match_history` container by `/season_month` (e.g., `"2026-11"`). How should you revise this design?

- A) Partition the Cosmos DB `match_history` container by `/user_id` (or synthetic `/match_id` with a write-sharded GSI/change-feed view for seasonal rollups) so current-month writes distribute across thousands of logical and physical partitions instead of hitting Cosmos DB's `10,000 RU/s` single-partition ceiling and `20 GB` logical partition cap, while serving live $O(\log N)$ rank and `±4` neighbor queries from Azure Managed Redis Sorted Sets.
- B) Keep `/season_month` as the Cosmos DB partition key because enabling Cosmos DB Autoscale automatically removes the `20 GB` storage limit and `10,000 RU/s` throughput limit of a single logical partition.
- C) Remove Azure Managed Redis and run `SELECT COUNT(1) FROM c WHERE c.score > @userScore` cross-partition queries in Cosmos DB on every leaderboard view at `2,500 QPS`.
- D) Store all `25M` player scores inside a single JSON document in Cosmos DB and update it with optimistic concurrency (`_etag`) on every match completion.

<details><summary>Answer</summary>

**A.** In Azure Cosmos DB, a single logical partition key value cannot exceed `20 GB` of storage or `10,000 RU/s` of physical partition throughput. Partitioning by `/season_month` funnels 100% of current-month match writes (`~50M matches/day`) into one logical partition (`"2026-11"`), causing immediate `429 TooManyRequests` throttling and storage overflow. Partitioning by high-cardinality `/user_id` spreads writes evenly while co-locating each player's personal match history, and Azure Managed Redis handles the $O(\log N)$ ZSET ranking path.

- Why not B: Cosmos DB Autoscale scales total container RU/s across many partitions, not the physical ceiling of a single hot logical partition key.
- Why not C: Cross-partition `COUNT` queries over `25M` items consume massive RU/s and scan latency ($O(N)$), whereas a Redis ZSET computes `ZREVRANK` in $O(\log N)$ sub-millisecond time.
- Why not D: Cosmos DB items are capped at `2 MB`, and updating one document at `2,894 QPS` collapses under OCC `_etag` contention.
- Ref: [modules/21-realtime-gaming-leaderboard.md](../modules/21-realtime-gaming-leaderboard.md#5-season-rollover-disaster-recovery-and-serverless-vs-self-managed-topologies), https://learn.microsoft.com/en-us/azure/cosmos-db/partitioning-overview

</details>

### Q-CERT-041 · CNCF / SRE: Leaderboard Memory Fragmentation, Async UNLINK Rollover & Anti-Cheat Guardrails · difficulty 3 · single

At `00:00:00 UTC` on the first of the month, a seasonal rotation job deletes the old `25M`-member leaderboard (`DEL leaderboard:2026-10`) on the Valkey primary. Immediately, leaderboard API `p99` latency spikes above `3,200 ms`, health checks flap, and during the subsequent score-range resharding a player appears simultaneously in two range shards. Which operational fixes and SRE guardrails resolve both incidents?

- A) Replace synchronous `DEL` with asynchronous **`UNLINK`** after atomically flipping the active season alias pointer so the `25M`-node skip list is deallocated on a background lazy-free thread (`p99 < 15 ms`), enforce an alert on **`leaderboard_ghost_duplicate_users == 0`** with idempotent cross-shard `ZREM` + `ZADD` migration verification, and maintain `>= 50%` Copy-on-Write (`CoW`) memory headroom (`mem_fragmentation_ratio < 1.4`).
- B) Keep `DEL` on the main thread, increase Kubernetes `livenessProbe` timeouts to `60 seconds`, and ignore duplicate shard entries because `ZREVRANK` automatically deduplicates across keys.
- C) Configure `maxmemory-policy allkeys-random` so Valkey randomly evicts active players whenever a season ends.
- D) Restart the Valkey cluster every month at midnight with `FLUSHALL SYNC` on the command thread.

<details><summary>Answer</summary>

**A.** Synchronous `DEL` on a `25M`-member sorted set frees `50M+` `zskiplistNode`, `dictEntry`, and `sds` allocations on the single-threaded Valkey command loop, blocking all clients for `1.5–4.0 seconds`. Creating the new season ZSET, flipping the active season alias, and calling **`UNLINK`** detaches the key in $O(1)$ time and reclaims memory asynchronously on a background bio thread. Simultaneously, tracking `leaderboard_ghost_duplicate_users == 0` detects and repairs any partial cross-shard range migration (`ZREM` old shard + `ZADD` new shard).

- Why not B: Raising probe timeouts hides a multi-second stop-the-world outage without fixing it, and each range shard is an independent ZSET key that cannot auto-deduplicate members present in another key.
- Why not C: Random eviction silently drops legitimate ranked players from the active tournament season.
- Why not D: `FLUSHALL SYNC` blocks the command thread and wipes cached user profiles, idempotency locks, and active state.
- Ref: [modules/21-realtime-gaming-leaderboard.md](../modules/21-realtime-gaming-leaderboard.md#6-production-gotchas-sre-guardrails-and-2021-vs-2026-comparison), https://valkey.io/commands/unlink/

</details>

### Q-CERT-042 · Multi-Cloud Architecture: 2021 vs. 2026 Leaderboard Modernization · difficulty 2 · multi

Select **two** genuine architectural advancements when modernizing a 2021 gaming leaderboard (Redis 6 single-threaded I/O, naive float decimal tie-breaking `score + 1/ts`, synchronous `DEL` rollover, and client-trusted score endpoints) to a 2026 production architecture.

- A) Replacing lossy float-decimal tie-breaking with an **atomic Lua 53-bit IEEE-754 safe integer composite** ($S \cdot 2^{32} + (2^{32} - 1 - \Delta t_{\text{ms}})$ for $S < 2^{21}$) on **Valkey 9** (multi-threaded network I/O) eliminates floating-point rounding drift and scales single-node throughput cleanly.
- B) Enforcing **server-authoritative signed `match_id` ingestion** alongside a **hybrid Exact ZSET Top-1,000 + mergeable DDSketch percentile engine** and **zero-downtime `UNLINK` season rollover** closes client MITM score spoofing, answers tail-percentile queries in $O(1)$ memory, and eliminates monthly rollover freezes.
- C) Moving score authority back to unauthenticated mobile client HTTP calls reduces backend game-server CPU usage by `100%` with zero security trade-offs.
- D) Packing a full 64-bit integer score and a 64-bit nanosecond timestamp into a single 128-bit Valkey ZSET double eliminates the 53-bit significand limit without changing data types.

<details><summary>Answer</summary>

**A, B.** Modern 2026 leaderboards run on Valkey 9 with multi-threaded I/O and atomic Lua 53-bit safe-integer composite scores (`21-bit` points + `32-bit` inverted season-relative milliseconds $\le 2^{53} - 1$), accept score updates exclusively from mTLS/HMAC-signed authoritative game servers with `match_id` deduplication, combine exact ZSET Top-1,000 boards with mergeable DDSketch quantile approximation for `500M`-DAU tail percentiles, and rotate seasons via non-blocking `UNLINK`.

- Why not C: Allowing unauthenticated clients to submit scores trivially enables Man-in-the-Middle (MITM) leaderboard forgery.
- Why not D: Valkey ZSET scores are 64-bit IEEE-754 binary64 doubles (with a 53-bit significand), not 128-bit floats.
- Ref: [modules/21-realtime-gaming-leaderboard.md](../modules/21-realtime-gaming-leaderboard.md#6-production-gotchas-sre-guardrails-and-2021-vs-2026-comparison), https://valkey.io/commands/eval/

</details>

---

## Module 22: Proximity Service, Spatial Indexing & Multi-Region Location Discovery (`Q-CERT-043`–`Q-CERT-048`)

### Q-CERT-043 · AWS SAP-C02: Global Proximity Service with Aurora PostgreSQL PostGIS, ElastiCache for Valkey & Route 53 Latency Routing · difficulty 3 · scenario

A global restaurant discovery platform (`100M` DAU, `28,935 QPS` peak nearby searches, `200M` businesses) must serve nearby queries in `< 50 ms` (`p99`) across North America, Europe, and Asia-Pacific while merchant CRUD updates (`~115 QPS` peak) originate in a primary region and propagate globally within seconds. Which AWS architecture satisfies these requirements?

- A) Deploy a single-region Amazon Aurora PostgreSQL cluster in `us-east-1` with two B-tree indexes on `latitude` and `longitude`, and cache responses in Amazon CloudFront keyed on the full query string `?lat=37.776720&lon=-122.416730`.
- B) Deploy **Amazon Route 53 Latency-Based Routing** with health checks across three regions (`us-east-1`, `eu-central-1`, `ap-northeast-1`), each running a stateless **Location-Based Service (LBS)** fleet backed by regional **Amazon ElastiCache for Valkey** clusters (Two-Tier `geohash:{p}:{cell} -> business_id[]` + `business:{id} -> details` cache) and **Amazon Aurora PostgreSQL Global Database** secondary read clusters with **PostGIS `GiST`** spatial indexes (`ST_DWithin` on `geography(Point, 4326)`), while routing merchant CRUD writes to the primary Aurora region and streaming WAL updates via CDC.
- C) Use Amazon DynamoDB with a partition key of `geohash_2` (2-character geohash prefix) and no caching tier so all `28,935 QPS` hit DynamoDB directly.
- D) Use Aurora MySQL cross-region replicas and rely on PostGIS `ST_DWithin` inside MySQL without caching.

<details><summary>Answer</summary>

**B.** Route 53 Latency-Based Routing directs users to the lowest-latency healthy AWS region, where the stateless LBS tier queries the regional Two-Tier ElastiCache for Valkey cluster (`9` pipelined `geohash:{p}:{cell}` lookups + `MGET business:{id}` hydration + exact Haversine post-filter) with zero cross-region WAN hops. Aurora PostgreSQL Global Database replicates storage changes to secondary regions in `< 1 second` and provides native PostGIS `GiST` R-tree (`ST_DWithin`) fallback on cache misses, while CDC updates regional Valkey caches and the urgent closure override set within seconds.

- Why not A: Single-region `us-east-1` adds `150–250 ms` WAN RTT for Europe/Asia users, 1D B-trees fail on 2D spatial bounding boxes, and CloudFront caching on 6-decimal GPS coordinates yields `~0%` hit ratio due to `±10 m` GPS drift.
- Why not C: Partitioning DynamoDB by a 2-character geohash funnels dense metro traffic (Manhattan, Tokyo) onto single hot partitions (`1,000 WCU / 3,000 RCU` per-partition ceiling).
- Why not D: PostGIS is a PostgreSQL extension (not available on Aurora MySQL), and hitting the relational database directly at `28,935 QPS` without a two-tier cache saturates database CPU.
- Ref: [modules/22-proximity-service.md](../modules/22-proximity-service.md#5-end-to-end-request-lifecycle-multi-region-deployment-and-async-update--privacy-workflows), https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-global-database.html

</details>

### Q-CERT-044 · AWS SAP-C02: Hybrid Lexical, Geospatial & Vector POI Discovery with Amazon OpenSearch Service & DynamoDB · difficulty 3 · single

A travel discovery platform stores authoritative merchant listings in Amazon DynamoDB (partitioned by `business_id`) and wants to support natural-language proximity queries such as _"quiet dog-friendly patio coffee within 1.5 km"_ combining a strict geospatial radius filter, BM25 keyword boost, and dense vector embedding similarity in `< 80 ms`. Which architecture should you select?

- A) Execute a full DynamoDB `Scan` with a `FilterExpression` on `latitude` and `longitude`, then compute cosine vector similarity and Haversine distance inside an AWS Lambda function over all `200M` items.
- B) Enable **Amazon DynamoDB Streams** (with zero-ETL or Lambda enrichment generating embeddings via Amazon Bedrock) to index listings into **Amazon OpenSearch Service** using a compound document schema with a **`geo_point`** field (BKD-tree spatial index for `geo_distance` filtering), **`text`** fields (BM25 lexical search), and a **`knn_vector`** field (HNSW semantic similarity), keeping DynamoDB as the authoritative system of record for `business_id` CRUD.
- C) Create two DynamoDB Global Secondary Indexes — one with partition key `latitude` and one with partition key `longitude` — and intersect them in memory.
- D) Store all `200M` embeddings and coordinates in a single S3 CSV file and query it synchronously with Amazon Athena on every mobile user search.

<details><summary>Answer</summary>

**B.** DynamoDB partitioned by `business_id` provides uniform write scaling and point-lookup durability, while DynamoDB Streams feeds Amazon OpenSearch Service asynchronously. OpenSearch natively combines a BKD-tree **`geo_distance`** filter on `geo_point` (pruning candidates to the `1.5 km` circle), BM25 keyword scoring, and HNSW **`knn_vector`** semantic retrieval in a single hybrid query execution plan.

- Why not A: A DynamoDB `Scan` over `200M` rows consumes the entire table's RCU budget on a single request and takes minutes rather than `< 80 ms`.
- Why not C: Exact float `latitude` / `longitude` GSI partition keys cannot execute 2D spatial range queries or vector similarity.
- Why not D: Amazon Athena is an interactive analytical query engine with multi-second cold scan latency, not a `< 80 ms` `28,935 QPS` operational search engine.
- Ref: [modules/22-proximity-service.md](../modules/22-proximity-service.md#6-production-gotchas-sre-guardrails-and-2021-vs-2026-comparison), https://docs.opensearch.org/latest/field-types/supported-field-types/geo-point/

</details>

### Q-CERT-045 · GCP PCA: Multi-Region Location-Based Service on Cloud Run, Memorystore for Valkey & Cloud SQL / Spanner S2 Indexing · difficulty 3 · scenario

A hospitality and delivery platform on Google Cloud needs to index `200M` global Points of Interest and evaluate both circular radius queries (`500 m` to `20 km`) and irregular polygon delivery-zone geofences at `28,935 QPS` peak across three continents, with strong multi-region transactional consistency for merchant status changes. Which GCP architecture fits best?

- A) Deploy stateless LBS containers on multi-region **Cloud Run** behind a Global External Application Load Balancer; store authoritative business records and **64-bit Google S2 `S2CellId` (`INT64`)** spatial index rows in multi-region **Cloud Spanner** (using `S2RegionCoverer` min/max level `INT64` range scans for arbitrary delivery polygons); and front regional reads with **Google Cloud Memorystore for Valkey** caching `geohash/s2cell -> business_id[]` lists and `business:{id}` details.
- B) Store `200M` businesses in a single-region Cloud SQL for MySQL instance without read replicas or Memorystore and query `WHERE lat BETWEEN :lat - :r AND :lat + :r` across continents.
- C) Use BigQuery `ST_DWithin` directly from the mobile app for all `28,935 QPS` of user queries.
- D) Store each business as an individual object in a regional Cloud Storage bucket and list bucket prefixes on every radius search.

<details><summary>Answer</summary>

**A.** Cloud Spanner's multi-region TrueTime synchronous replication provides external consistency for merchant writes while indexing 64-bit **`S2CellId` (`INT64`)** values along a continuous Hilbert space-filling curve. `S2RegionCoverer` decomposes any circular radius or irregular delivery polygon into a small set (`8–32`) of contiguous `INT64` ranges, and regional **Memorystore for Valkey** instances alongside **Cloud Run** serve hot spatial cell lists and business payloads in `< 20 ms` locally.

- Why not B: A single-region Cloud SQL instance adds cross-continental RTT, lacks multi-region strong consistency, and collapses under `28,935 QPS` of unindexed 1D `BETWEEN` scans.
- Why not C: BigQuery is an OLAP data warehouse designed for analytical batch/BI queries, not `28,935 QPS` of `< 50 ms` user-facing OLTP traffic.
- Why not D: Object storage `LIST` operations have high latency (`50–200 ms`) and rate limits, and cannot perform 2D spherical radius or polygon filtering.
- Ref: [modules/22-proximity-service.md](../modules/22-proximity-service.md#3-spatial-indexing-deep-dive-naive-2d-sql-even-grid-geohash-quadtree-and-google-s2--uber-h3), https://cloud.google.com/spanner/docs, https://s2geometry.io/

</details>

### Q-CERT-046 · Azure AZ-305: Proximity Search with Azure Managed Redis Geospatial, Cosmos DB GeoJSON Spatial Indexing & Traffic Manager · difficulty 2 · scenario

An enterprise retail locator on Azure serves global mobile users across East US, West Europe, and Japan East. Store locations are stored as RFC 7946 GeoJSON `Point` documents (`{"type": "Point", "coordinates": [lon, lat]}`). Which Azure architecture delivers lowest-latency regional routing, sub-20 ms hot proximity lookups, and indexed spatial database fallback without full container scans?

- A) Route clients via **Azure Traffic Manager (Performance routing)** to regional **Azure Kubernetes Service (AKS) / Container Apps** LBS instances; front hot spatial queries with **Azure Managed Redis** (`GEOSEARCH` / Two-Tier Geohash cache); and persist store records in **Azure Cosmos DB for NoSQL** partitioned by `/business_id` with a **Spatial Index (`"type": "Point"`)** enabled in the indexing policy for `ST_DISTANCE` / `ST_WITHIN` queries.
- B) Use Azure Traffic Manager in Priority (active-passive) mode routing 100% of global users to East US, disable Cosmos DB spatial indexing, and cache responses by 6-decimal `lat:lon` keys.
- C) Store GeoJSON points in Azure Blob Storage archive tier and rehydrate blobs on every nearby search.
- D) Partition Azure Cosmos DB by `/country_code` (so 150M US businesses land in a single `"US"` logical partition) and query without Redis caching.

<details><summary>Answer</summary>

**A.** Azure Traffic Manager Performance routing steers clients to the closest regional LBS deployment, where Azure Managed Redis serves cached 9-cell Geohash / `GEOSEARCH` lookups in sub-millisecond time. On the durable storage tier, Azure Cosmos DB natively indexes GeoJSON `Point`, `Polygon`, and `MultiPolygon` geometries when a spatial path (`"path": "/location/?"`) is configured in the indexing policy, enabling indexed `ST_DISTANCE` and `ST_WITHIN` evaluation while partitioning `/business_id` avoids hot logical partitions.

- Why not B: Priority routing forces European and Asian users across trans-oceanic links to East US, disabling spatial indexing forces full scans, and raw coordinate cache keys yield `~0%` cache hits.
- Why not C: Archive Blob Storage requires hours to rehydrate offline blobs.
- Why not D: Cosmos DB enforces a hard `20 GB` storage limit and `10,000 RU/s` throughput ceiling per logical partition key value; putting 150M US businesses under `/country_code = "US"` overflows the logical partition immediately.
- Ref: [modules/22-proximity-service.md](../modules/22-proximity-service.md#5-end-to-end-request-lifecycle-multi-region-deployment-and-async-update--privacy-workflows), https://learn.microsoft.com/en-us/azure/cosmos-db/nosql/query/geospatial-index

</details>

### Q-CERT-047 · CNCF / SRE: Quadtree Cold-Start Readiness Gating, Geohash Cache-Hit SLIs & GDPR Ephemeral Location Guardrails · difficulty 3 · single

An LBS engineering team deploys an in-memory Point Quadtree (`200M` POIs, `~3.8 GB` RAM, `3-minute` startup build time) on Kubernetes. During a rolling deployment, pods enter an endless `CrashLoopBackOff`, `5xx` errors spike to `40%`, and a security audit discovers raw user 6-decimal `(latitude, longitude)` coordinates inside Envoy L7 access logs and Prometheus metric labels. Which set of SRE fixes resolves all three failures?

- A) Configure a Kubernetes **`startupProbe`** (`failureThreshold: 36, periodSeconds: 10` = `360 s` budget) and **`readinessProbe` (`/readyz`)** that pass only after the Quadtree root pointer is initialized (or `mmap` a pre-built snapshot from object storage), while keeping **`livenessProbe` (`/livez`)** process-local and enforcing a **`PodDisruptionBudget` (`maxUnavailable: 10%`)**; strip `latitude`/`longitude` from Envoy access logs and Prometheus labels (tracking SLIs by bounded `precision_level` enum only); and snap demand analytics to $k$-anonymous Geohash-4/5 cells.
- B) Gate `livenessProbe` (`/livez`) on Quadtree build completion with a `10-second` timeout, set `maxUnavailable: 100%` so all pods restart simultaneously, and attach `user_lat_lon` as a Prometheus label on every HTTP request counter.
- C) Delete all health probes (`startupProbe`, `readinessProbe`, `livenessProbe`) so Kubernetes routes live search traffic to pods while the Quadtree is still empty (`0` nodes loaded), and retain raw GPS access logs for 365 days.
- D) Move the `3.8 GB` Quadtree build into every individual HTTP request handler so each search request rebuilds a fresh `200M`-node Quadtree from PostgreSQL in `3 minutes`.

<details><summary>Answer</summary>

**A.** Pods were crash-looping because `livenessProbe` failed before the `3-minute` Quadtree build completed, causing the kubelet to `SIGKILL` pods mid-build while unready pods received traffic. Separating `startupProbe` (protecting the `3-minute` cold-boot window) and `readinessProbe` (`/readyz` gated on atomic Quadtree pointer readiness + `PodDisruptionBudget` `maxUnavailable: 10%`) from a shallow `/livez` probe eliminates deployment errors. Simultaneously, removing raw coordinates from Envoy access logs and Prometheus labels prevents both GDPR/CCPA geolocation leaks and Prometheus TSDB label-cardinality OOM crashes.

- Why not B: Gating `/livez` with a 10s timeout on a 180s build guarantees a permanent `CrashLoopBackOff`, `maxUnavailable: 100%` causes a total fleet outage, and putting `user_lat_lon` in a Prometheus label explodes TSDB series cardinality into millions of series.
- Why not C: Routing traffic to pods before the Quadtree finishes loading returns empty/broken search results, and 365-day raw GPS logs violate GDPR Article 5 data minimization.
- Why not D: An $O(N \log N)$ `3-minute` build is an amortization step executed at startup / snapshot load so queries run in `< 5 ms`; rebuilding per request is impossible at `28,935 QPS`.
- Ref: [modules/22-proximity-service.md](../modules/22-proximity-service.md#6-production-gotchas-sre-guardrails-and-2021-vs-2026-comparison), https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/

</details>

### Q-CERT-048 · Multi-Cloud Architecture: 2021 vs. 2026 Proximity Service Modernization · difficulty 2 · multi

Select **two** genuine architectural improvements when modernizing a 2021 proximity service (nightly batch cron updates, cold-booting custom Quadtrees, pure straight-line coordinate filtering, and raw GPS access logging) to the 2026 production standard.

- A) Replacing the 24-hour nightly batch cron with **Debezium WAL Change Data Capture (`< 5 s` cache update)** plus a **`< 1 s` globally replicated Hot-Override Closure Overlay** and **`mmap`'d immutable Quadtree / S2 / H3 snapshots** eliminates day-long stale venue data and multi-minute cold-boot rebuilds.
- B) Upgrading pure coordinate radius lookups to **Hybrid Geo + Lexical BM25 + Dense Vector Search** (OpenSearch / Elasticsearch BKD-tree + HNSW) seeded with standardized **Overture Maps Foundation `Places` (GERS IDs)** and enforcing **zero-persistence ephemeral search coordinates + $k$-anonymous Geohash-4/5 analytics** delivers semantic local discovery and GDPR/CCPA privacy compliance.
- C) Switching Tier 1 Valkey cache keys from quantized Geohash cells (`geohash:6:9q8yyk`) back to raw 6-decimal `(latitude, longitude)` strings increases the cache hit ratio from `98%` to `100%`.
- D) Replacing 2D spatial indexes with two separate 1D B-tree indexes (`latitude`, `longitude`) and omitting $\cos(\phi)$ from longitude degree calculations improves East-West recall at `60°N` (Oslo) to `100%`.

<details><summary>Answer</summary>

**A, B.** Modern 2026 proximity platforms stream committed DB edits via Debezium CDC (`< 5 s` propagation) paired with a `< 1 s` Hot-Override Closure Overlay for emergency shutdowns and `mmap`'d spatial snapshots for instant pod startup. On the discovery and compliance tiers, they combine BKD-tree geospatial filtering with BM25 lexical and HNSW vector search over Overture Maps GERS entities while scrubbing raw GPS coordinates at the L7 edge for GDPR/CCPA compliance.

- Why not C: Raw 6-decimal GPS coordinates drift every second (`±5–15 m` jitter), collapsing cache hit rates to `~0%`.
- Why not D: Two 1D B-trees degrade to global band intersections, and omitting $\cos(\phi)$ shrinks East-West coverage at `60°N` by `50%`.
- Ref: [modules/22-proximity-service.md](../modules/22-proximity-service.md#6-production-gotchas-sre-guardrails-and-2021-vs-2026-comparison), https://overturemaps.org/

</details>
