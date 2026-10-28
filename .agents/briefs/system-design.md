# Brief: System design (`architecture/system-design`)

| | |
|---|---|
| Phase | 4 |
| Kind | NEW track: create from scratch |
| Primary (author) | **Opus · claude.ai** |
| Drafter (on request) | pi · DeepSeek |
| Challenger | pi · Muse Spark 1.3 |
| Verifier | Antigravity |
| Final gate | Opus (claude.ai session) |
| Branch / worktree | `track/system-design` · `../zto-system-design` |
| Depends on | all other tracks (built last) |
| Research dossier | `.agents/research/D-cs.md` |

## 0. Read before starting (binding)
1. `AGENTS.md`: the contract. If it conflicts with this brief, AGENTS.md wins; log the conflict in your review file.
2. `.agents/OWNERSHIP.md`: what you own vs only cross-link.
3. `.agents/REVIEW.md`: the checklist your work is judged against.
4. Your global/agent instructions still apply where they do not conflict.

## 1. Owner decisions and track-specific instructions
- Built **last**. Every component is a cross-link to its owning track. This track owns composition, estimation and SLO math.
- Teach the **latest stable** versions. Add **Then vs now** comparisons wherever practice changed (AGENTS.md § Version Currency).
- Pin **all** tooling via mise (`.mise.toml` + `mise.lock`): node 26 for JS/TS, plus every CLI and runtime the examples need.

## 2. Ownership
**You own (full treatment):**
- Requirements → HLD → deep dives, estimation, LB/CDN/rate-limiter/queue as components, SLO math

**Cross-link only (do not re-explain):**
- Heaps, tries, LRU/LFU implementations, B-tree *as a data structure* → owned by `algorithms/dsa`
- Bloom / HyperLogLog / Count-Min math → owned by `algorithms/dsa`
- Consistent hashing algorithms (ring, jump, rendezvous) → owned by `algorithms/dsa`
- Caching theory (consistency, dual writes, invalidation, stampede) → owned by `architecture/data-systems`
- Encoding & schema evolution (Avro, Protobuf) → owned by `architecture/data-systems`
- System models, FLP, CAP/PACELC as formal results → owned by `architecture/distributed-systems`
- Consensus (Paxos/Raft/ZAB), replicated state machines, leases & fencing, distributed locks → owned by `architecture/distributed-systems`
- 2PC/3PC, Percolator/Spanner/Calvin, sagas as a correctness problem, CRDTs → owned by `architecture/distributed-systems`
- Delivery semantics (at-most / at-least / effectively-once), idempotency theory → owned by `architecture/distributed-systems`
- Retry amplification, metastable failures (theory) → owned by `architecture/distributed-systems`
- HTTP/1.1, HTTP/2, HTTP/3, WebSockets, gRPC, HTTP caching (RFC 9111), CDNs, L4/L7 load balancing → owned by `architecture/networking`
- OpenTelemetry, metrics/logs/traces, Prometheus/PromQL, LGTM, Kibana/Elastic Observability, alerting, SLO burn rates → owned by `technologies/observability`

## 3. Research dossier (verified 2026-10-27/28; re-verify before use)

#### System design interviews — `architecture/system-design`

- **Current stable version(s)**
  - Books/courses (content, not software): Alex Xu, *System Design Interview Vol. 1* (2020) & *Vol. 2* (with Sahn Lam, 2022) — ByteByteGo course ToC verified (https://bytebytego.com/courses/system-design-interview/foreword): scale 0→millions, back-of-envelope, framework, rate limiter, consistent hashing, KV store, unique ID generator, URL shortener, web crawler, notification system, news feed, chat, search autocomplete, YouTube, Google Drive, proximity service, nearby friends, Google Maps, distributed message queue, metrics monitoring & alerting, ad click aggregation, hotel reservation, distributed email, S3-like object storage, gaming leaderboard, payment system, digital wallet, stock exchange. (Publication years from memory, unverified.)
  - **Hello Interview** "System Design in a Hurry" (https://hellointerview.com/learn/system-design/in-a-hurry/delivery): delivery framework — Requirements (~5 min, top 3 functional + 3–5 non-functional; skip estimation unless it changes the design) → Core entities (~2) → API (~5, default REST) → [optional] Data flow (~5) → High-level design (~10–15) → Deep dives (~10). Core concepts: networking, API design, data modeling, caching, sharding, consistent hashing, CAP, indexing, numbers to know. Key technologies: Redis, Elasticsearch, Kafka, Temporal, API gateway, Cassandra, DynamoDB, PostgreSQL, Flink, ZooKeeper. Patterns: real-time updates, contention, multi-step processes, scaling reads, scaling writes, large blobs, long-running tasks. 32 problem breakdowns (Bitly, Dropbox, Ticketmaster, WhatsApp, Uber, Top-K, ad click aggregator, Google Docs, payment system, ChatGPT, flash sale, …).
  - SRE canon: Google *SRE Book* & *SRE Workbook* (https://sre.google/books/) — SLIs/SLOs/error budgets, multiwindow multi-burn-rate alerting.
  - Tooling versions for labs: see executable proofs (Node 24/26, testcontainers 12.2.1; Redis/Valkey and Prometheus image tags unverified — pick at implementation time).
- **Authoritative syllabi used**
  - Alex Xu Vol 1/2 ToC (above); Hello Interview delivery framework + core concepts/patterns/key technologies (above); DDIA 2e ch. 1 "Trade-offs in data systems architecture" & ch. 2 "Defining nonfunctional requirements"; Google SRE Book/Workbook; AWS Builders' Library (timeouts/retries/backoff with jitter, load shedding, avoiding fallback) (https://aws.amazon.com/builders-library/); "Latency numbers every programmer should know" (Jeff Dean; values dated — use updated table, e.g. Colin Scott's interactive version, values approximate).
  - No certification covers this; AWS SA-Pro / GCP PCA are cloud-specific — cross-link to cloud tracks if they exist.
- **Proposed modules**
  1. **Framing & requirements** — functional vs non-functional (latency/availability/durability/consistency/cost), DDIA 2e reliability/scalability/maintainability, percentiles & tail latency, delivery framework timing, what interviewers grade by level (mid vs senior vs staff).
  2. **Back-of-the-envelope estimation** — powers of two, latency numbers, QPS (avg vs peak ×2–10), storage/bandwidth/egress, cache sizing (80/20), Little's law L = λW, server count from per-core throughput, cost estimates; sanity-checking orders of magnitude.
  3. **Networking & the edge** — DNS (TTL, GeoDNS), L4 vs L7 load balancing, algorithms (RR, least-conn, P2C, consistent hash), TLS termination, HTTP/1.1 vs 2 vs 3, WebSockets/SSE/long-poll, CDN (push vs pull, cache keys, `Vary`, purge/invalidation, origin shield), API gateway.
  4. **API & data modeling** — REST vs gRPC vs GraphQL, pagination (offset vs cursor), idempotency keys, versioning; choosing SQL vs document vs wide-column vs KV vs search vs blob; schema for access patterns; IDs (UUIDv7, Snowflake, ULID).
  5. **Caching** — cache-aside/read-through/write-through/write-behind, eviction (LRU/LFU/TinyLFU), TTL & jitter, stampede protection (single-flight, probabilistic early expiration, leases), hot keys, invalidation & consistency (Memcache@FB leases/delete-after-write), Redis data structures as building blocks.
  6. **Scaling reads & writes** — replicas & read-your-writes routing, sharding keys & hot partitions, denormalization/materialized views, CQRS, write batching/buffering, counters at scale (sharded counters, approximate counters).
  7. **Asynchrony: queues, streams, workflows** — queue vs log, fan-out (push vs pull/hybrid for news feed), backpressure, DLQs, poison messages, retries & idempotent consumers, outbox, workflow engines (Temporal) for multi-step processes, scheduled jobs & job schedulers.
  8. **Rate limiting & traffic management** — token bucket, leaky bucket, fixed/sliding window log/counter, GCRA; distributed limiting with Redis + Lua atomicity; load shedding, admission control, circuit breakers, bulkheads, timeouts & retry budgets.
  9. **Search, geo & specialized systems** — inverted index & Elasticsearch basics, typeahead/trie + top-K, geohash/quadtree/S2/H3 for proximity, top-K heavy hitters (Count-Min), real-time leaderboards (Redis sorted sets), blob storage & multipart/resumable upload with presigned URLs.
  10. **Contention & correctness under concurrency** — ticketing/flash sale/hotel booking: pessimistic locks, optimistic concurrency (version columns), reservation with TTL holds, distributed locks (link to distributed-systems), payments: idempotency, double-entry ledger, reconciliation, exactly-once illusions.
  11. **Reliability, observability & SLOs** — SLIs/SLOs/error budgets, burn-rate alerts, RED/USE methods, metrics vs logs vs traces (OpenTelemetry), cardinality, health checks, graceful degradation, multi-AZ/multi-region (active-passive vs active-active), RPO/RTO, backups & DR drills, deployments (canary, blue-green, feature flags).
  12. **Canonical problems I (read-heavy & content)** — URL shortener, pastebin, news feed, Instagram, YouTube/Netflix (transcoding, ABR, CDN), Dropbox/Google Drive (chunking, dedupe, sync), web crawler, search autocomplete.
  13. **Canonical problems II (real-time, geo, write-heavy)** — chat/WhatsApp, notifications, live comments, Uber/proximity/nearby friends, Google Maps, ad click aggregator, metrics monitoring, Top-K, distributed message queue, job scheduler.
  14. **Canonical problems III (transactional & staff-level)** — Ticketmaster/flash sale, hotel reservation, payment system/digital wallet, stock exchange (matching engine, sequencer), Google Docs (OT vs CRDT), rate limiter as a service, distributed cache, S3-like object storage, LLM serving (ChatGPT breakdown: streaming, GPU batching, KV cache) — plus how to run a deep dive and handle pushback.
- **Gotchas & production failure modes**
  - Cache stampede: a popular key expires and 10k concurrent misses hit the DB; fix with single-flight/request coalescing, TTL jitter, stale-while-revalidate.
  - Cache-aside race: reader misses, reads old value from DB, writer updates DB + deletes cache, reader then sets stale value → stale until TTL (Memcache@FB leases solve it).
  - CDN serving one user's personalized/authenticated page to others because `Cache-Control: private`/`Vary` missing or `Set-Cookie` responses cached.
  - Hot key / celebrity problem: one shard or Redis node saturated by a single key (viral post, flash-sale SKU); needs key splitting, local caching, or request coalescing.
  - Redis is single-threaded per command execution: `KEYS *`, big `DEL` of a 1M-element set, or long Lua scripts block all clients (use `SCAN`, `UNLINK`).
  - Per-node rate limiters behind a round-robin LB allow N× the intended limit; fixed-window limiters allow 2× bursts at window boundaries.
  - Fan-out tail latency: with 100 parallel backend calls each at 1% p99 >1 s, ~63% of requests (1 − 0.99¹⁰⁰) hit the slow path; hedged requests/timeouts needed.
  - Averaging p99s across hosts is mathematically meaningless — aggregate histograms (Prometheus buckets) instead.
  - Unbounded queues hide overload: latency grows without bound while throughput stays flat (Little's law); bound queues and shed load (LIFO under overload).
  - Retry storms across layers turn a brief blip into a metastable outage; use retry budgets, jittered backoff, and circuit breakers.
  - Deep health checks that query the DB cause the LB to eject every instance when the DB blips → full outage; separate liveness from readiness and fail open.
  - Metrics label cardinality explosion (user_id / request_id as label) OOMs Prometheus.
  - Offset pagination (`OFFSET 1000000`) scans and discards rows → use keyset/cursor pagination; also unstable under inserts.
  - Snowflake/time-based IDs break on clock moving backwards (NTP step) → duplicate IDs unless generator refuses/waits.
  - Synchronized cron/TTL expiry (everything on the hour) → thundering herd; add jitter.
  - Consistent hashing without virtual nodes gives badly skewed load; adding a node with a naive `hash % N` remaps ~all keys.
  - Geohash boundary problem: nearby points across a cell edge have different prefixes → always query neighbouring cells.
  - Payment retries without idempotency keys double-charge; timeouts from the PSP are *unknown outcome*, not failure → reconcile.
- **Interview hot topics**
  - Delivery framework and time management; driving the conversation and stating trade-offs.
  - Capacity estimation done quickly with explicit assumptions.
  - Rate limiter (algorithms + distributed implementation).
  - URL shortener / ID generation (base62, Snowflake, collisions).
  - News feed fan-out on write vs read (celebrity hybrid).
  - Chat (WebSockets, presence, delivery receipts, ordering per conversation).
  - Ticketmaster/flash sale contention (holds with TTL, queues, OCC).
  - Top-K / ad click aggregation (stream processing, windowing, Count-Min, Lambda vs Kappa).
  - Proximity/Uber (geohash/quadtree, location update write load).
  - Caching strategy & invalidation; CDN.
  - Payment system idempotency & ledger.
  - SLOs/observability: how you'd know it's broken; multi-region failover.
- **Executable-proof strategy**
  - **Capacity calculators as code**: small TS module (`estimate.ts`) with unit tests reproducing each canonical problem's numbers (QPS, storage over 5 years, bandwidth, cache size); tests assert order-of-magnitude bands, documenting assumptions in test names. Deterministic, `node --test`.
  - **Building-block micro-implementations with fake clocks** (`node:test` mock timers or injected `Clock`): token bucket, sliding-window counter, GCRA — property test (fast-check, fixed seed) that no window of length W admits > limit (and a *negative test* showing fixed-window admits 2× at the boundary); consistent hash ring with/without vnodes — assert load std-dev bound and ~K/N keys moved on node add vs `hash % N` moving ~all; single-flight cache — assert DB called once under 1 000 concurrent misses; LRU/TinyLFU hit-rate on a Zipf trace; Snowflake generator — clock-backwards test; Bloom filter FP rate within bound.
  - **Discrete-event queueing simulator** (seeded): M/M/1 and M/M/c to verify Little's law, show latency knee at ρ→1, retry amplification and metastable failure, hedged requests reducing p99, LIFO vs FIFO under overload, fan-out tail math (1 − 0.99ⁿ).
  - **Redis-backed labs** via `testcontainers` 12.2.1 with a Redis or Valkey container (tag unverified): atomic distributed rate limiter in Lua (`EVALSHA`), sorted-set leaderboard, `SET NX PX` lock *plus* negative test showing lock loss under a simulated pause without fencing. Mark as integration tests (Docker/Colima required).
  - **SLO math**: tests for error-budget and multiwindow multi-burn-rate thresholds (SRE Workbook: 14.4× over 1 h/5 min, 6× over 6 h/30 min, 1× over 3 d) (numbers from memory, unverified — confirm against https://sre.google/workbook/alerting-on-slos/). Optional: Prometheus alert rules unit-tested with `promtool test rules` in a container (version unverified).
  - **Design artifacts**: each canonical problem gets a written answer key (requirements → entities → API → HLD → deep dives) + Mermaid diagrams validated by `@mermaid-js/mermaid-cli` render in CI (version unverified) + a rubric checklist test (markdown lint that each answer contains required sections).
  - **Cannot prove locally**: real CDN behaviour, multi-region latency/failover, true scale (10⁶ QPS), managed-service limits → fallback: simulation, napkin math with cited sources, and config/plan validation in cloud tracks.
- **Overlaps / dedupe**
  - Data structures inside components (LRU, Bloom, Count-Min, trie, consistent hashing, heaps for Top-K) → `algorithms/dsa` owns implementation & proofs; here they are used and sized.
  - Database choice internals (LSM vs B-tree, replication modes, sharding schemes, isolation levels) → `architecture/data-systems`; here only the decision table.
  - Consensus, clocks, distributed locks correctness, exactly-once theory, CRDT/OT theory → `architecture/distributed-systems`.
  - Kafka/Redis/Postgres/Elasticsearch operations → their technology tracks; observability tooling internals → SRE/observability track if present; cloud-specific HA (AWS/GCP/Azure) → cloud tracks.

---

#### Context from `D-cs.md`

##### 0. Boundary contract: data-systems vs distributed-systems vs system-design (vs DSA)

Rule of thumb: **DSA = in-memory algorithms on one machine; data-systems = how one database/log works and how it is replicated/partitioned; distributed-systems = theory of correctness under partial failure (time, consensus, consistency, distributed transactions); system-design = composing off-the-shelf building blocks under requirements, numbers and SLOs.**

| Concept | Owner (full treatment) | Others only cross-link |
|---|---|---|
| Hash tables, heaps, trees, tries, graphs, Bloom filter / HyperLogLog / Count-Min math, consistent-hashing *algorithm* (ring, jump hash, rendezvous) | `algorithms/dsa` | system-design uses them as building blocks |
| B-tree vs LSM, WAL, compaction, indexes, MVCC implementation, isolation levels as implemented by Postgres/MySQL, encoding & schema evolution (Avro/Protobuf), leader/follower + multi-leader + leaderless (quorums, read repair, hinted handoff), sharding/rebalancing, CDC, batch & stream processing internals (DDIA 2e ch. 3–8, 11–12) | `architecture/data-systems` | distributed-systems links for replication lag anomalies; system-design links for "pick a DB" |
| System model (crash/omission/Byzantine, sync/partial-sync/async), FLP, CAP/PACELC as formal results, clocks (physical, Lamport, vector, HLC, TrueTime), consistency-model hierarchy (Jepsen), linearizability checking, consensus (Paxos/Raft/ZAB/VR), replicated state machines, leases & fencing, failure detectors/membership/gossip, 2PC/3PC/Percolator/Spanner/Calvin, sagas as a *correctness* problem, CRDTs, delivery semantics (at-most/at-least/effectively-once), BFT (DDIA 2e ch. 9–10; MIT 6.5840) | `architecture/distributed-systems` | data-systems links "transactions → distributed txns"; system-design links "why Raft/ZK behind your lock service" |
| Requirements → API → data model → HLD → deep dives; capacity estimation; LB/CDN/cache/rate-limiter/queue/search/blob as black boxes with knobs; canonical problems; observability, SLOs, error budgets, load shedding, backpressure (DDIA 2e ch. 1–2) | `architecture/system-design` | — |
| Kafka **operations** (broker config, KRaft, tiered storage, sizing) | a messaging/streaming track or data-systems (whoever owns Kafka) | distributed-systems teaches log abstraction + delivery semantics only; system-design treats Kafka as a black box |
| Observability tooling (OTel, Prometheus internals) | an SRE/observability track if proposed by another agent | system-design keeps SLO math + "what to measure" |

DDIA 2nd ed. chapter split (ToC from O'Reilly, https://www.oreilly.com/library/view/-/9781098119058): ch. 1–2 → system-design M1; ch. 3–8, 11–13 → data-systems; ch. 9–10 → distributed-systems; ch. 8 isolation → data-systems, ch. 8 "distributed transactions" section → distributed-systems; ch. 14 (ethics) → optional reading in system-design.

---

## 4. Re-verify list
These claims were marked unverified during research. Confirm or correct each one against a primary source before teaching it:
- Books/courses (content, not software): Alex Xu, *System Design Interview Vol. 1* (2020) & *Vol. 2* (with Sahn Lam, 2022) — ByteByteGo course ToC verified (https://bytebytego.com/courses/system-design-interview/foreword): scale 0→millions, back-of-envelope, framework, rate limiter, consistent hashing, KV store, unique ID generator, URL shortener, web crawler, notification system, news feed, chat, search autocomplete, YouTube, Google Drive, proximity service, nearby friends, Google Maps, distributed message queue, metrics monitoring & alerting, ad click aggregation, hotel reservation, distributed email, S3-like object storage, gaming leaderboard, payment system, digital wallet, stock exchange. (Publication years from memory, unverified.)
- Tooling versions for labs: see executable proofs (Node 24/26, testcontainers 12.2.1; Redis/Valkey and Prometheus image tags unverified — pick at implementation time).
- **Redis-backed labs** via `testcontainers` 12.2.1 with a Redis or Valkey container (tag unverified): atomic distributed rate limiter in Lua (`EVALSHA`), sorted-set leaderboard, `SET NX PX` lock *plus* negative test showing lock loss under a simulated pause without fencing. Mark as integration tests (Docker/Colima required).
- **SLO math**: tests for error-budget and multiwindow multi-burn-rate thresholds (SRE Workbook: 14.4× over 1 h/5 min, 6× over 6 h/30 min, 1× over 3 d) (numbers from memory, unverified — confirm against https://sre.google/workbook/alerting-on-slos/). Optional: Prometheus alert rules unit-tested with `promtool test rules` in a container (version unverified).
- **Design artifacts**: each canonical problem gets a written answer key (requirements → entities → API → HLD → deep dives) + Mermaid diagrams validated by `@mermaid-js/mermaid-cli` render in CI (version unverified) + a rubric checklist test (markdown lint that each answer contains required sections).

## 5. Certifications & exams
Follow AGENTS.md § Certification and Exam Coverage exactly. Minimum deliverables:
1. **README "Certifications & Exams" section.** Start from the exams named in the dossier above ("Authoritative syllabi used"). Re-verify each exam's code, status, guide version/date, targeted product version and domain weights on the official page. Where no certification exists, say so and use the recognised interview format.
2. **`exams/README.md` coverage matrix.** Rows are domain/objective, weight, modules, examples, status. No ❌ at hand-off.
3. **`exams/<exam-code>.md` question banks.**
   - At least 5 questions per domain and at least 60 per certification, weighted like the official domains.
   - The real exam's question types, plus hands-on tasks with verification scripts for performance-based exams.
   - Difficulty tags. Answers with explanations, why each distractor is wrong, and module + official-doc refs.
   - One full mock exam with a scoring key.
4. **Exam-delta callouts** where the exam's product version differs from the track's.
5. **Original questions only.** No braindump content.

## 6. Code languages
Per AGENTS.md § Code Example Languages:
- **Primary:** pseudocode (where algorithms or protocols are described) + TypeScript (or the track's own language, for language tracks).
- **Secondary:** Python, Rust or Nim only where it teaches something. Each language lives in `examples/<lang>/` with its own mise-pinned toolchain and native test runner, and `test` runs them all.

## 7. Workflow and definition of done
1. **Primary (Opus)** works on branch `track/system-design` and sets this track's row in `.agents/STATUS.md` to 🟦.
2. **Verify versions first.** Check every version in the dossier against its primary source today. Record the results in the README's `Verified against …` line. Resolve every item in the re-verify list below.
3. Build in stages: README syllabus + exam matrix → modules one by one, each with its examples/tests → glossary → cheatsheet → question banks → mock exam. Delegate bulk drafting (question-bank drafts, glossary candidates, cheatsheet tables) to the **Drafter**, then correct and integrate it yourself.
4. Before each commit: run `mise exec -- npm test` and `npm run typecheck` (or the equivalents), and `test:integration` if present. Commit with Conventional Commits scoped `(system-design)`.
5. Self-check against `.agents/REVIEW.md`. Then set STATUS to 🟨 and write the hand-off at the top of `.agents/reviews/system-design.md`:
   - what was done;
   - what was not done, and why;
   - every claim you are least sure of.
6. The **Challenger** attacks it and the **Verifier** checks it independently. Both record findings in `.agents/reviews/system-design.md` (prompts in `.agents/KICKOFF.md`). The primary resolves the findings (🟧), Opus runs the final gate (🟪), and the owner merges (✅).
