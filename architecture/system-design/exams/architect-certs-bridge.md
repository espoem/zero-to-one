# Architect Certification Bridge Bank (AWS SAP-C02 · GCP PCA · Azure AZ-305 · CNCF/SRE)

No single vendor-neutral certification tests general distributed system design, so vendor-specific IAM, CLI, and control-plane trivia stay in [`technologies/aws`](../../../technologies/aws/), [`technologies/gcp`](../../../technologies/gcp/), and [`technologies/azure`](../../../technologies/azure/). This bridge bank maps the architectural patterns, quantitative trade-offs, and failure modes taught across `architecture/system-design` directly onto Senior/Architect certification scenario domains (**AWS Solutions Architect – Professional `SAP-C02`**, **Google Cloud Professional Cloud Architect `PCA`**, **Microsoft Azure Solutions Architect Expert `AZ-305`**, and **CNCF / SRE Resilience**).

- **Sequential Growth Plan**: Built sequentially alongside Wave A & Wave B topic completions (target: **60+ original scenario questions** plus a full timed certification bridge mock exam upon completion of the 28-topic expansion).
- **Current Coverage**: **6 questions** (`Q-CERT-001`–`Q-CERT-006`) covering Topic 01 (`Scale From Zero to Millions` — Module 15).

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
