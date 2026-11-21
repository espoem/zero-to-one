# Architect Certification Bridge Bank (AWS SAP-C02 · GCP PCA · Azure AZ-305 · CNCF/SRE)

No single vendor-neutral certification tests general distributed system design, so vendor-specific IAM, CLI, and control-plane trivia stay in [`technologies/aws`](../../../technologies/aws/), [`technologies/gcp`](../../../technologies/gcp/), and [`technologies/azure`](../../../technologies/azure/). This bridge bank maps the architectural patterns, quantitative trade-offs, and failure modes taught across `architecture/system-design` directly onto Senior/Architect certification scenario domains (**AWS Solutions Architect – Professional `SAP-C02`**, **Google Cloud Professional Cloud Architect `PCA`**, **Microsoft Azure Solutions Architect Expert `AZ-305`**, and **CNCF / SRE Resilience**).

- **Sequential Growth Plan**: Built sequentially alongside Wave A & Wave B topic completions (target: **60+ original scenario questions** plus a full timed certification bridge mock exam upon completion of the 28-topic expansion).
- **Current Coverage**: **30 questions** (`Q-CERT-001`–`Q-CERT-030`) covering Topic 01 (`Scale From Zero to Millions` — Module 15), Topic 02 (`Distributed Key-Value Store` — Module 16), Topic 03 (`Google Maps` — Module 17), Topic 04 (`Distributed Message Queue` — Module 18), and Topic 05 (`Hotel Reservation System` — Module 19).

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
