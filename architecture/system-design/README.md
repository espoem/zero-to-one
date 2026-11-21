# System Design: Composing Scalable, Resilient Distributed Systems

A capstone engineering curriculum synthesizing networking, storage engines, distributed consensus, caching, asynchronous messaging, cloud foundations, and observability into production system architectures, quantitative back-of-the-envelope capacity modeling, SLO engineering, and Staff/Principal design mastery.

Verified against locally pinned tooling (Node.js 26.13.0, TypeScript 7.0.2, `fast-check` 4.10.3, `oxfmt` 0.76.0, `oxlint` 1.91.0, Mermaid 11.17.2 / 12.2.0) and referenced upstream systems & primary literature (Redis 8.10.3 / Valkey 9.2.0, Prometheus 3.16.0 [LTS 3.13.5], Google SRE Workbook Ch. 5 Alerting on SLOs, DDIA 2e, Alex Xu _System Design Interview_ Vol. 1 [2020] & Vol. 2 [2022], and AWS Builders' Library) on 2026-11-20.

---

## Curriculum Overview & Syllabus

1. [Module 01: Framing, Requirements, and Delivery Execution](modules/01-framing-requirements-and-delivery.md) — Functional vs non-functional requirements (latency percentiles, availability nines, durability, consistency, cost), DDIA 2e reliability/scalability/maintainability trade-offs, structured delivery timeboxing, level calibration across mid/senior/staff/principal expectations, explicit assumption logs, and handling adversarial pushback.
2. [Module 02: Back-of-the-Envelope Estimation and Capacity Modeling](modules/02-back-of-the-envelope-estimation.md) — Powers of two, modern 2026 hardware/network/LLM latency numbers, QPS average vs diurnal peak multipliers (2×–10×), 5-year storage sizing with replication and index overhead, egress bandwidth and cloud cost traps, 80/20 cache sizing, Little's Law ($L = \lambda W$) for queue and connection pool sizing, per-core server counts, and order-of-magnitude sanity checks.
3. [Module 03: Networking, Edge Architecture, and CDN Composition](modules/03-networking-edge-and-cdn-composition.md) — DNS TTL and GeoDNS/Anycast routing, L4 vs L7 load balancing (Round Robin, Least Connections, Power of Two Random Choices [P2C], consistent hashing), TLS termination, HTTP/1.1 vs HTTP/2 vs HTTP/3, WebSockets vs SSE vs Long-Polling at scale, CDN architecture (push vs pull, cache keys, `Vary`, cross-user `Cache-Control: private`/`Set-Cookie` leaks, origin shield, invalidation), and API gateways.
4. [Module 04: API Design, Data Modeling, and Distributed ID Generation](modules/04-api-design-data-modeling-and-id-generation.md) — REST vs gRPC vs GraphQL selection, offset pagination (`OFFSET 1000000`) drift and scan failure vs keyset/cursor pagination, idempotency keys and versioning, access-pattern-driven storage selection (SQL, document, wide-column, KV, search, blob), and distributed ID generators (UUIDv4 vs UUIDv7 vs ULID vs Snowflake IDs and the NTP clock-step-backwards duplicate ID hazard).
5. [Module 05: Caching Strategies, Stampede Defense, and Invalidation](modules/05-caching-strategies-and-invalidation.md) — Cache-aside, read-through, write-through, and write-behind patterns; eviction policies (LRU, LFU, W-TinyLFU scan resistance); TTL jitter; cache stampede defenses (single-flight request coalescing, Probabilistic Early Expiration [XFetch], stale-while-revalidate); the cache-aside stale-write race and Facebook Memcache Leases; hot-key / celebrity mitigation; and Redis single-threaded command pitfalls (`KEYS *`, giant `DEL` vs `SCAN`/`UNLINK`).
6. [Module 06: Scaling Reads, Scaling Writes, and Partitioning](modules/06-scaling-reads-writes-and-partitioning.md) — Read replicas and read-your-writes routing (sticky sessions, LSN pinning, lag budgets), sharding key selection and hot-partition avoidance, consistent hashing with virtual nodes vs naive `hash % N` remapping storms, denormalization and materialized views, CQRS trade-offs, write batching and buffering, and high-throughput counters (sharded counters, buffered flushes, approximate sketches).
7. [Module 07: Asynchrony — Queues, Streams, and Durable Workflows](modules/07-asynchrony-queues-streams-and-workflows.md) — Point-to-point queues vs partitioned append-only logs, fan-out on write vs fan-out on read vs hybrid celebrity fan-out, backpressure and unbounded queue latency blowups, Dead-Letter Queues and poison-pill isolation, transactional outbox and CDC relays, idempotent consumers, durable workflow engines (Temporal) for multi-step sagas, and distributed job schedulers avoiding synchronized top-of-the-hour storms.
8. [Module 08: Rate Limiting, Load Shedding, and Resilience Engineering](modules/08-rate-limiting-load-shedding-and-resilience.md) — Token bucket, leaky bucket, fixed-window 2× boundary burst flaw, sliding-window log/counter, and GCRA; distributed rate limiting via Redis + atomic Lua (`EVALSHA`) vs per-node `N×` drift; load shedding and admission control (bounded queues, LIFO under overload, priority tiers); fan-out tail latency amplification ($1 - 0.99^n$) and hedged requests; retry budgets, jittered exponential backoff, circuit breakers, bulkheads, and metastable failure prevention.
9. [Module 09: Search, Geospatial Indexing, and Specialized Components](modules/09-search-geospatial-and-specialized-components.md) — Composing inverted indexes and hybrid retrieval, search autocomplete (Trie + Top-K caching + prefix sharding), geospatial indexing (Geohash and the cell-boundary neighbor trap, Quadtree, S2, H3 hexagons), Top-K heavy hitters (Count-Min Sketch, Lambda vs Kappa), real-time leaderboards (Redis Sorted Sets + sharding), and large blob multipart/resumable direct uploads via presigned URLs.
10. [Module 10: Contention, Inventory Reservations, and Financial Correctness](modules/10-contention-inventory-and-financial-correctness.md) — High-contention booking and flash sales (Ticketmaster, hotel reservations): pessimistic locking (`FOR UPDATE SKIP LOCKED`), optimistic concurrency control (version CAS), TTL reservation holds, virtual waiting rooms, distributed lock fencing tokens, and payment systems (idempotency keys, double-entry accounting ledgers, treating PSP timeouts as unknown outcome, automated reconciliation, and exactly-once illusions).
11. [Module 11: Reliability, Observability, SLO Math, and Disaster Recovery](modules/11-reliability-slos-observability-and-dr.md) — SLIs, SLOs, and error budgets; Google SRE Workbook multi-window multi-burn-rate alerting (`14.4×` over `1h/5m`, `6×` over `6h/30m`, `1×` over `3d/6h`, `1/12` short-window ratio); why averaging per-host p99s is mathematically invalid (histogram aggregation); metrics label cardinality explosions; deep health-check cascading fleet outages (liveness vs readiness vs fail-open); graceful degradation and static stability; multi-AZ/multi-region DR, RPO/RTO, and progressive rollouts.
12. [Module 12: Canonical Designs I — Read-Heavy, Feed, and Content Systems](modules/12-canonical-designs-read-heavy-and-content.md) — End-to-end Staff-level worked designs with quantitative sizing and failure analysis: URL shortener, News Feed / Instagram, YouTube / Netflix (transcoding, ABR, CDN), Dropbox / Google Drive (chunking, dedupe, sync), Web Crawler, and Search Autocomplete.
13. [Module 13: Canonical Designs II — Real-Time, Geospatial, and Write-Heavy Systems](modules/13-canonical-designs-realtime-geo-and-streams.md) — End-to-end Staff-level worked designs: Chat / WhatsApp (WebSockets, presence, ordering, receipts), Notification System, Uber / Proximity / Nearby Friends, Ad Click Aggregator & Top-K streaming, Metrics Monitoring Platform, and Distributed Job Scheduler.
14. [Module 14: Canonical Designs III — Transactional, Infrastructure, and LLM Serving Systems](modules/14-canonical-designs-transactional-and-staff.md) — End-to-end Staff/Principal worked designs: Ticketmaster / Flash Sale, Payment System & Digital Wallet, Stock Exchange Matching Engine (sequencer / LMAX), Google Docs (OT vs CRDT), Rate Limiter as a Service, S3-like Object Storage, and LLM Serving / ChatGPT (prefill vs decode, KV-cache VRAM math, PagedAttention, continuous batching, SSE streaming), plus Then vs Now architectural evolution history.
15. [Module 15: Scale From Zero to Millions of Users — Progressive Architectural Evolution](modules/15-scale-from-zero-to-millions.md) — Formal scaling laws (Amdahl, Gustafson, Gunther's Universal Scalability Law and retrograde scaling), 9-stage progressive evolution from single server to 10M+ DAU, LSN-pinned read-your-writes, stateless session externalization, cell-based architecture, shuffle sharding combinatorics, static stability, autoscaler hysteresis, bespoke SVG blueprints, and a comprehensive 2021-vs-2026 infrastructure comparison.
16. [Module 16: Distributed Key-Value Store — Dynamo, Cassandra, and Modern Cloud KV Systems](modules/16-distributed-key-value-store.md) — End-to-end distributed KV architecture composing consistent hash rings with 3-AZ preference lists, LSM-tree write/read paths with Bloom filters, tunable quorums ($W + R > N$) and why strict quorums still break linearizability, vector clocks vs Dotted Version Vectors vs LWW clock-skew data loss, gossip with Phi Accrual failure detection, sloppy quorums and hinted handoff, Merkle tree anti-entropy, tombstone resurrection traps, Amazon Dynamo (2007) → DynamoDB (2022–2026) Paxos evolution, ScyllaDB shard-per-core, bespoke SVGs, and 2021-vs-2026 comparison.

---

## ByteByteGo / _System Design Interview_ (Vol. 1 & 2) 28-Chapter Coverage Matrix

Every chapter from Alex Xu & Sahn Lam's _System Design Interview_ Vol. 1 & 2 (plus the primary papers and engineering blogs cited inside `liquidslr/system-design-notes`) maps onto either a dedicated deep-dive module or a deepened canonical section. Wave A delivers dedicated standalone modules for previously missing or compressed case studies; Wave B deepens the remaining 18 topics with bespoke SVGs, 2021-vs-2026 technology surveys, and primary-source verification.

| # | Source Chapter | Target Module / Section | Wave | Status |
| :-: | --- | --- | :-: | :-: |
| 01 | Scale From Zero to Millions | [Module 15](modules/15-scale-from-zero-to-millions.md) (`15-scale-evolution-blueprint.svg`, `15-scaling-2021-vs-2026.svg`, `examples/09`) | A | ✅ Complete |
| 02 | Back-of-the-Envelope Estimation | [Module 02](modules/02-back-of-the-envelope-estimation.md) | B | 🟡 Core complete · Wave B SVG/2021-vs-2026 queued |
| 03 | System Design Framework | [Module 01](modules/01-framing-requirements-and-delivery.md) | B | 🟡 Core complete · Wave B SVG/2021-vs-2026 queued |
| 04 | Rate Limiter | [Module 08](modules/08-rate-limiting-load-shedding-and-resilience.md), [Module 14](modules/14-canonical-designs-transactional-and-staff.md) | B | 🟡 Core complete · Wave B SVG/primary refs queued |
| 05 | Consistent Hashing | [Module 06](modules/06-scaling-reads-writes-and-partitioning.md) | B | 🟡 Core complete · Wave B SVG/primary refs queued |
| 06 | Key-Value Store (Dynamo) | [Module 16](modules/16-distributed-key-value-store.md) (`16-kv-store-architecture.svg`, `16-kv-2021-vs-2026.svg`, `examples/10`) | A | ✅ Complete |
| 07 | Unique-ID Generator | [Module 04](modules/04-api-design-data-modeling-and-id-generation.md) | B | 🟡 Core complete · Wave B SVG/primary refs queued |
| 08 | URL Shortener | [Module 12 §1](modules/12-canonical-designs-read-heavy-and-content.md#1-url-shortener-bitly) | B | 🟡 Core complete · Wave B SVG/2021-vs-2026 queued |
| 09 | Web Crawler | [Module 12 §5](modules/12-canonical-designs-read-heavy-and-content.md#5-web-crawler) | B | 🟡 Core complete · Wave B SVG/primary refs queued |
| 10 | Notification System | [Module 13 §2](modules/13-canonical-designs-realtime-geo-and-streams.md#2-multi-channel-notification-system) | B | 🟡 Core complete · Wave B SVG/2021-vs-2026 queued |
| 11 | News Feed System | [Module 12 §2](modules/12-canonical-designs-read-heavy-and-content.md#2-news-feed-and-instagram) | B | 🟡 Core complete · Wave B SVG/2021-vs-2026 queued |
| 12 | Chat System | [Module 13 §1](modules/13-canonical-designs-realtime-geo-and-streams.md#1-real-time-messaging-chat--whatsapp) | B | 🟡 Core complete · Wave B SVG/primary refs queued |
| 13 | Search Autocomplete | [Module 12 §6](modules/12-canonical-designs-read-heavy-and-content.md#6-search-autocomplete--typeahead) | B | 🟡 Core complete · Wave B SVG/primary refs queued |
| 14 | YouTube | [Module 12 §3](modules/12-canonical-designs-read-heavy-and-content.md#3-youtube--netflix-video-streaming) | B | 🟡 Core complete · Wave B SVG/primary refs queued |
| 15 | Google Drive | [Module 12 §4](modules/12-canonical-designs-read-heavy-and-content.md#4-dropbox--google-drive-file-sync) | B | 🟡 Core complete · Wave B SVG/2021-vs-2026 queued |
| 16 | Proximity Service | Dedicated Module 22 (expanding [Module 13 §3](modules/13-canonical-designs-realtime-geo-and-streams.md#3-geospatial-dispatch-uber-proximity-service--nearby-friends)) | A | ⬜ Queued |
| 17 | Nearby Friends | Dedicated Module 23 (expanding [Module 13 §3](modules/13-canonical-designs-realtime-geo-and-streams.md#3-geospatial-dispatch-uber-proximity-service--nearby-friends)) | A | ⬜ Queued |
| 18 | Google Maps | Dedicated Module 17 (Wave A) | A | ⬜ Queued |
| 19 | Distributed Message Queue | Dedicated Module 18 (Wave A) | A | ⬜ Queued |
| 20 | Metrics Monitoring & Alerting | [Module 13 §5](modules/13-canonical-designs-realtime-geo-and-streams.md#5-metrics-monitoring-platform), [Module 11](modules/11-reliability-slos-observability-and-dr.md) | B | 🟡 Core complete · Wave B SVG/2021-vs-2026 queued |
| 21 | Ad Click Event Aggregation | [Module 13 §4](modules/13-canonical-designs-realtime-geo-and-streams.md#4-ad-click-aggregator--real-time-top-k) | B | 🟡 Core complete · Wave B SVG/2021-vs-2026 queued |
| 22 | Hotel Reservation System | Dedicated Module 19 (Wave A) | A | ⬜ Queued |
| 23 | Distributed Email Service | Dedicated Module 20 (Wave A) | A | ⬜ Queued |
| 24 | S3-Like Object Storage | [Module 14 §5](modules/14-canonical-designs-transactional-and-staff.md#5-core-infrastructure-rate-limiter-as-a-service--s3-like-object-storage) | B | 🟡 Core complete · Wave B SVG/2021-vs-2026 queued |
| 25 | Real-Time Gaming Leaderboard | Dedicated Module 21 (expanding [Module 09](modules/09-search-geospatial-and-specialized-components.md)) | A | ⬜ Queued |
| 26 | Payment System | [Module 14 §2](modules/14-canonical-designs-transactional-and-staff.md#2-payment-system--digital-wallet) | B | 🟡 Core complete · Wave B SVG/2021-vs-2026 queued |
| 27 | Digital Wallet | Dedicated Module 24 (Raft event-sourced CQRS ledger, expanding [Module 14 §2](modules/14-canonical-designs-transactional-and-staff.md#2-payment-system--digital-wallet)) | A | ⬜ Queued |
| 28 | Stock Exchange | [Module 14 §3](modules/14-canonical-designs-transactional-and-staff.md#3-ultra-low-latency-stock-exchange-matching-engine) | B | 🟡 Core complete · Wave B SVG/2021-vs-2026 queued |

---

## Prerequisites

This capstone track composes primitives owned by earlier tracks rather than re-teaching their internals:

- Data structures and probabilistic sketches from [`algorithms/dsa`](../../algorithms/dsa/) (heaps, tries, LRU/LFU, Bloom/HLL/Count-Min, consistent hashing algorithms).
- Storage engines, indexing, isolation, replication, and caching theory from [`architecture/data-systems`](../data-systems/).
- Consensus, clocks, consistency hierarchies, distributed locks/fencing, transactions, CRDTs, and metastable failure theory from [`architecture/distributed-systems`](../distributed-systems/).
- Protocols, DNS, TLS, HTTP/1.1–3, CDNs, and L4/L7 load balancing from [`architecture/networking`](../networking/).
- Security, identity, OAuth/OIDC, PKI/mTLS, and OWASP threat modeling from [`architecture/security-identity`](../security-identity/).
- Cloud primitives and provider deltas from [`architecture/cloud-foundations`](../cloud-foundations/), [`technologies/aws`](../../technologies/aws/), [`technologies/gcp`](../../technologies/gcp/), [`technologies/azure`](../../technologies/azure/), and [`technologies/cloudflare`](../../technologies/cloudflare/).
- Observability tooling and database operations from [`technologies/observability`](../../technologies/observability/), [`technologies/postgres`](../../technologies/postgres/), [`technologies/redis`](../../technologies/redis/), and [`technologies/elasticsearch`](../../technologies/elasticsearch/).

---

## Runnable Verification Instructions

```bash
# Install pinned toolchain via mise
cd architecture/system-design
mise install
mise exec -- npm ci

# Run deterministic calculators, fake-clock building blocks, queueing simulator, and SLO math proofs
mise exec -- npm test

# Run optional live Redis/Valkey integration suite (skips cleanly if Redis/Valkey unavailable)
mise exec -- npm run test:integration

# Run static analysis, type checking, and formatting checks
mise exec -- npm run typecheck
mise exec -- npm run lint
mise exec -- npm run fmt:check
```

---

## Certifications & Exams

**No vendor-neutral official certification exists for general distributed system design.** Cloud-specific architecture certifications (AWS Solutions Architect – Professional, Google Cloud Professional Cloud Architect, and Microsoft AZ-305) are covered in [`technologies/aws`](../../technologies/aws/), [`technologies/gcp`](../../technologies/gcp/), and [`technologies/azure`](../../technologies/azure/).

The universally recognized evaluation format for this track is the **Senior / Staff / Principal System Design Technical Interview Loop** (45–60 minute open-ended architecture sessions plus quantitative trade-off questioning):

- **Format**: Structured scenario drills, trade-off and failure-mode questions (single choice, multiple select, ordering, quantitative estimation), and full 60-minute timed design loops graded against an explicit Staff/Principal rubric.
- **Coverage Matrix & Rubric**: [`exams/README.md`](exams/README.md) maps every competency domain and canonical interview archetype to its teaching modules and executable proofs.
- **Question Bank & Mock Loops**: [`exams/interview.md`](exams/interview.md) contains **80 original questions** (`Q-SD-001`–`Q-SD-080`) with distractor rationales plus **two complete 60-minute timed mock design loops** with Staff/Principal grading rubrics and scoring keys.
- **Architect Certification Bridge Bank**: [`exams/architect-certs-bridge.md`](exams/architect-certs-bridge.md) maps system-design architectures onto **AWS SAP-C02**, **GCP PCA**, **Azure AZ-305**, and **CNCF/SRE** scenario domains (growing sequentially with every Wave A & B topic toward 60+ questions and a full bridge mock exam).
