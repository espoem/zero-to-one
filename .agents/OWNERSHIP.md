# Concept Ownership Registry

**Rule (AGENTS.md § Knowledge Ownership):**

- The **owner** gives the full treatment: formal definition, mechanics, proofs, exam coverage.
- Every other track **cross-links** to the owner's module and adds only its own delta: the technology-specific realisation, limits, defaults and pitfalls.
- An unregistered concept gets registered here in the same change that introduces it.
- On a disagreement, record both positions in `reviews/<track>.md`. The final gate decides.

The `M` numbers refer to the proposed module lists in `research/*.md`. Authors update them when the final module numbering lands.

## Languages and runtimes

| Concept | Owner | Cross-link only |
| --- | --- | --- |
| Types & coercion, scope/closures/`this`, prototypes/classes | `languages/javascript` | typescript, react (stale closures), solidjs |
| Iterators, generators, async iteration, Promise/job-queue semantics (spec level) | `languages/javascript` | nodejs, react (`use`), solidjs (`action(function*)`) |
| ESM semantics (Module Records, live bindings, TLA), `exports` conditions at runtime | `languages/javascript` | nodejs (loader internals), typescript (resolution typing), solidjs/react (condition builds) |
| Proxy/Reflect, WeakRef/FinalizationRegistry | `languages/javascript` | solidjs (stores), panda-css |
| Shared memory, Atomics, JS memory model | `languages/javascript` | nodejs (worker_threads) |
| Temporal, explicit resource management (`using`, `DisposableStack`) runtime semantics | `languages/javascript` | typescript (typing only) |
| Decorators runtime semantics (TC39) | `languages/javascript` | typescript (legacy vs TC39 typing) |
| HTML event loop & rendering steps (task → microtasks → rAF → style/layout/paint) | `languages/javascript` | languages/css (pipeline internals), react, solidjs |
| `structuredClone`, serialisation limits | `languages/javascript` | react (Flight), solidjs (seroval) |
| V8 shapes/ICs at the "why is my code slow" level | `languages/javascript` | nodejs (GC tuning flags), dsa |
| libuv phases, `process.nextTick`, threadpool, streams & backpressure, CJS loader, `require(esm)`, GC tuning flags | `technologies/nodejs` | javascript, cloudflare, networking (DNS threadpool starvation) |
| Node runtime type stripping | `technologies/nodejs` | typescript (`erasableSyntaxOnly`) |
| Node-specific security hardening (permission model, `--disable-proto`, `vm` is not a sandbox) | `technologies/nodejs` | security-identity, javascript |
| Fastify/Node service patterns (graceful shutdown, health probes for single-threaded runtimes, load shedding on loop delay) | `technologies/nodejs` (M08) | system-design, observability |
| Node diagnostics tooling (loop delay/ELU, reports, heap-snapshot workflow, AsyncLocalStorage) | `technologies/nodejs` (M11) | observability |
| Node single executable applications (SEA) and Node container specifics (PID 1 for Node, heap vs cgroup budgets) | `technologies/nodejs` (M14) | containers, kubernetes |
| AbortController/AbortSignal cancellation patterns, retry/backoff with jitter, bounded concurrency pools (M07) | `languages/javascript` | nodejs, react, solidjs |
| Prototype pollution and ReDoS mechanics at the language level (M13) | `languages/javascript` | nodejs (Node-specific hardening), security-identity |
| Testing theory (test pyramid, property-based testing, mutation testing) | `languages/javascript` | nodejs (`node:test`), python (pytest/Hypothesis mechanics), all tracks |
| The type system, inference, variance, declaration emit, tsconfig | `languages/typescript` | all TS-based tracks |
| Typing JSX, components, hooks, generic/polymorphic components | `languages/typescript` (M12) | react, solidjs, panda-css |
| Standard Schema, Zod typing of runtime boundaries | `languages/typescript` (M11) | nodejs, react, solidjs |
| Type tests, declaration emit checks, attw/publint packaging checks (M13) | `languages/typescript` | all TS-based tracks |
| Strict FP type-system patterns in TypeScript (Option/Result ADTs, `DotPath<T>`, `Evolver<T>`, typed `Lens`/`Transducer`, explicit FSMs, internal `#` subpath imports, ES2024-vs-ES6 compiler profile parity) (M14) | `languages/typescript` | `architecture/functional-programming` (language-neutral FP theory), `languages/javascript` (runtime semantics), `algorithms/dsa` (LRU, Fisher–Yates), `technologies/solidjs` (Solid 2.x UI) |
| Python data model, typing, asyncio, CPython internals, packaging (uv) | `languages/python` | dsa (Python idioms), all Python examples |
| Python-specific security (pickle, framework security) | `languages/python` | security-identity |
| Referential transparency, substitution model, λ-calculus, parametricity & free theorems, persistent data structures & structural sharing (cons-lists, trees, catamorphisms, amortised queues), algebraic error handling (`Option`, `Either`, `Validated`), strictness vs laziness & corecursion (`unfold`, deforestation) | `architecture/functional-programming` (M01–M04) | `languages/scala`, `languages/typescript`, `algorithms/dsa` |
| Purely functional state (`State`), purely functional parallelism (`Par`, non-blocking actors), algebraic property-based testing (`Gen`/`SGen`/`Prop`, shrinking), algebraic parser combinators (context sensitivity, backtracking/commit) | `architecture/functional-programming` (M05–M08) | `languages/scala`, `languages/javascript` (general test pyramid), `languages/typescript` |
| Algebraic type classes & laws (`Semigroup`, `Monoid`, `Foldable`, `Functor`, `Monad`, Kleisli, `Applicative`, `Traverse`, traversal fusion), external effects & stack-safe trampolining (`IO`, `TailRec`, `Free`), scoped local mutation (`ST`, rank-2 polymorphism, contextual purity), pull-based stream transducers & resource-safe streaming | `architecture/functional-programming` (M09–M12) | `languages/scala`, `languages/typescript` |
| Scala 3 language mechanics, TASTy binary format, JVM lowering/erasure, `enum` ADTs & GADTs, declaration-site variance & type inference, `given`/`using` contextual abstractions & `derives`, `opaque type`, union/intersection/match types, native type lambdas, `inline`/mirrors/macros | `languages/scala` (M01–M06) | `architecture/functional-programming` |
| Scala concurrency & ecosystem realisations: JVM virtual threads/Loom, `Future` pitfalls, Scala 3 Capture Checking & Ox, Cats 2.13, Cats Effect 3 `IO`/`Resource`/fibers, FS2 `Stream`, ZIO 2 `ZIO`/`ZLayer`/STM, MUnit/ScalaCheck/Discipline, Scala 2 → 3 migration | `languages/scala` (M07–M10) | `architecture/functional-programming`, `algorithms/dsa` (language-neutral concurrency theory) |

## Web UI

| Concept | Owner | Cross-link only |
| --- | --- | --- |
| Cascade, `@layer`, `@scope`, specificity, inheritance, value processing | `languages/css` | panda-css |
| Layout (flow, flex, grid, subgrid, anchor positioning), stacking contexts | `languages/css` | panda-css (patterns) |
| Custom properties, `@property`, container queries, color spaces | `languages/css` | panda-css |
| View transitions, scroll-driven animations, top layer | `languages/css` | react (`<ViewTransition>`), solidjs |
| Design-token theory (W3C DTCG format) | `languages/css` | panda-css |
| CSS architecture comparison (BEM/ITCSS, utility-first, runtime vs zero-runtime CSS-in-JS) | `languages/css` | panda-css |
| CSS migration coexistence via cascade layers (`@import … layer()`) | `languages/css` | panda-css (M12 migration) |
| Rendering pipeline internals (style → layout → paint → composite, reflow triggers) | `languages/css` | react, solidjs |
| Panda extraction, recipes, slot recipes, codegen, v2 compiler | `technologies/panda-css` | — |
| Static style extraction / source transforms (build-time CSS-in-JS compilers) | `technologies/panda-css` | languages/css (architecture comparison) |
| Design-system distribution via build info (`panda lib` / `designSystem`) | `technologies/panda-css` (M11) | languages/css (token theory) |
| Fiber, lanes, Suspense, RSC/Flight, Actions, React Compiler | `technologies/react` | typescript |
| React Server Function security model, RSC advisory history (M07) | `technologies/react` | security-identity |
| List virtualisation algorithm (M12) | `technologies/react` | dsa, languages/css (`content-visibility`) |
| Testing React (RTL, `act`) (M12) | `technologies/react` | typescript |
| Signals graph, push-pull, stores/projections, colorless async, start mode | `technologies/solidjs` | typescript |
| Solid build variants and export-condition test postures (M09) | `technologies/solidjs` | nodejs (condition resolution), javascript (ESM `exports`) |
| Optimistic UI realisations (React `useOptimistic`; Solid optimistic overlays) | each framework track (react M08, solidjs M07) | typescript |
| React vs Solid mental-model comparison (written once) | `technologies/solidjs` (M10) | react |

## Algorithms and data

| Concept | Owner | Cross-link only |
| --- | --- | --- |
| Asymptotic analysis, linear/tree/graph structures, sorting, DP, greedy, amortisation | `algorithms/dsa` | everything |
| Heaps, tries, LRU/LFU implementations, B-tree _as a data structure_ | `algorithms/dsa` | data-systems, redis, system-design |
| Bloom / HyperLogLog / Count-Min math | `algorithms/dsa` | data-systems, redis, system-design |
| Consistent hashing algorithms (ring, jump, rendezvous) | `algorithms/dsa` | data-systems (use in sharding), system-design |
| Concurrency models, locks, data races, lock-free structures (language-neutral) | `algorithms/dsa` (M13) | javascript (Atomics), nodejs, python (GIL / free-threading), distributed-systems |
| Data models, relational algebra, normal forms, SQL vs NoSQL matrix | `architecture/data-systems` | postgres, sqlite, system-design |
| Storage engines: B-tree vs LSM, WAL/ARIES, compaction, buffer pools | `architecture/data-systems` | postgres, sqlite, redis, elasticsearch |
| Isolation levels & anomaly taxonomy (Adya/Berenson), MVCC theory, SSI, deadlocks (wait-for graph, wound-wait/wait-die) | `architecture/data-systems` | postgres, sqlite, distributed-systems |
| Indexing theory: inverted index, BM25, vector ANN (HNSW, IVF, quantisation) | `architecture/data-systems` | postgres (FTS, pgvector), sqlite (FTS5), redis (Query Engine), elasticsearch (Lucene realisation) |
| Relevance evaluation metrics (nDCG, MRR, ERR) | `architecture/data-systems` | elasticsearch (`_rank_eval`) |
| Replication mechanics (leader/follower, multi-leader, leaderless), sharding/rebalancing, CDC | `architecture/data-systems` | postgres, redis, elasticsearch, distributed-systems |
| Caching theory (cache-aside, read/write-through, write-behind, write-around, refresh-ahead, LRU/LFU/W-TinyLFU, TTL expiry, event-driven CDC invalidation, request coalescing/single-flight, stampede) | `architecture/data-systems` | redis, system-design, cloudflare |
| Encoding & schema evolution (Avro, Protobuf) | `architecture/data-systems` | system-design |
| Stream processing, logs, Kafka operations | `architecture/data-systems` | distributed-systems (log abstraction and delivery semantics only) |
| PostgreSQL / SQLite / Redis / Elasticsearch realisations, ops, drivers, pooling | each technology track | data-systems |
| SQL injection mechanics, row-level security | `technologies/postgres` | security-identity |
| Embedded/edge SQLite replication tools (Litestream, LiteFS, rqlite, cr-sqlite) and SQLite WASM / OPFS | `technologies/sqlite` (M11) | data-systems (M07), cloudflare (D1/DO) |
| Libsql/Turso | `technologies/sqlite` (M12) | cloudflare (D1 comparison) |
| RESP protocol, Redis data-structure encodings (listpack, intset, quicklist, span skiplist realisation), Redis expiry/eviction approximations, `SCAN` reverse-binary cursor | `technologies/redis` (M01–M03) | dsa (M13 skip list), data-systems |
| Redis Streams consumer groups (realisation), Redis Cluster slot/redirect protocol, Sentinel, Redis↔Valkey compatibility matrix | `technologies/redis` (M06, M10–M12) | distributed-systems (M10 log theory), data-systems |
| Lucene segment/codec internals, BM25 as implemented by Lucene, murmur3 document routing, ES\|QL semantics, retrievers/RRF in Elasticsearch | `technologies/elasticsearch` (M01, M06, M09, M10, M12) | data-systems, observability |

## Distributed systems and design

| Concept | Owner | Cross-link only |
| --- | --- | --- |
| System models, FLP, CAP/PACELC as formal results | `architecture/distributed-systems` | system-design, data-systems |
| Clocks (Lamport, vector, HLC, TrueTime), consistency hierarchy, linearizability checking | `architecture/distributed-systems` | data-systems, cloudflare (Durable Objects) |
| Consensus (Paxos/Raft/ZAB), replicated state machines, leases & fencing, distributed locks | `architecture/distributed-systems` | kubernetes (etcd), redis (Redlock critique), system-design |
| 2PC/3PC, Percolator/Spanner/Calvin, sagas as a correctness problem, CRDTs | `architecture/distributed-systems` | data-systems, system-design |
| Delivery semantics (at-most / at-least / effectively-once), idempotency theory | `architecture/distributed-systems` | system-design, gitlab-ci (retries) |
| Retry amplification, metastable failures, circuit breakers and retry budgets (theory) | `architecture/distributed-systems` | system-design (patterns as components), nodejs (runtime realisation) |
| Byzantine Fault Tolerance ($3f+1$ bound, PBFT, Nakamoto consensus) | `architecture/distributed-systems` | security-identity, system-design |
| Deterministic Simulation Testing (DST, FoundationDB/TigerBeetle model) | `architecture/distributed-systems` | data-systems, system-design |
| Requirements → HLD → deep dives, estimation, LB/CDN/rate-limiter/queue as components, SLO math | `architecture/system-design` | everything |
| Rate-limiting algorithm composition (Token Bucket, Leaky Bucket, Fixed Window Counter, Sliding Window Log, Sliding Window Counter, GCRA), overload shedding (LIFO/CoDel), adaptive concurrency (Gradient2), and hedged-request resilience composition | `architecture/system-design` (M08) | `technologies/redis` (atomic Lua realisations M07), `architecture/distributed-systems` (retry amplification & metastable theory), `architecture/networking` (traffic-shaping theory) |
| LLM inference serving architecture (prefill vs decode, KV-cache VRAM math, PagedAttention, continuous batching, TTFT/ITL) | `architecture/system-design` (M02, M14) | cloud tracks (AI-200 / Bedrock / Vertex wiring only) |
| Virtual Waiting Room admission control, Content-Defined Chunking (FastCDC/Rabin), double-entry payment reconciliation | `architecture/system-design` (M09, M10, M12, M14) | data-systems, distributed-systems |
| Progressive 0→10M scaling blueprints (vertical vs. horizontal scaling, single-server setup, web/DB separation, L4/L7 LB, primary–replica replication, cache/CDN, stateful vs. stateless architecture, multi-DC/GeoDNS, message queues, telemetry/automation), Gunther's USL capacity composition, cell-based architecture, shuffle sharding combinatorics, static stability composition | `architecture/system-design` (M15) | `algorithms/dsa` (Amdahl/Gustafson M14), `architecture/networking`, `architecture/data-systems`, `architecture/distributed-systems`, `technologies/observability`, cloud tracks |
| Distributed KV store system-design composition (Dynamo/Cassandra/DynamoDB coordinator rings, sloppy quorum + hinted handoff composition, Merkle anti-entropy ops, Phi Accrual operational tuning) | `architecture/system-design` (M16) | data-systems (LSM/WAL/replication internals), distributed-systems (CAP/clocks/Paxos/Raft theory), algorithms/dsa (consistent hashing/Bloom math) |
| Planetary mapping & navigation composition (Web Mercator tile pyramid sizing, MVT/PMTiles delivery, hierarchical routing tiles, CH vs CRP trade-offs, HMM map matching, GNN Supersegment ETA, super-tile adaptive rerouting) | `architecture/system-design` (M17) | algorithms/dsa (Dijkstra/A* proofs), networking (CDN/WebSockets) |
| Distributed message queue broker architecture from first principles (segmented commit log + sparse index sizing, zero-copy `sendfile`/TLS trade-offs, ISR + KIP-101 leader epoch composition, KIP-848/932/405/392 broker evolution, hierarchical timing wheels, cross-AZ replication economics) | `architecture/system-design` (M18) | data-systems (stream processing & page-cache theory M04/M11), distributed-systems (log abstraction, Raft & delivery semantics theory M07/M10) |
| Hospitality room-type inventory & reservation composition (room-type vs room-instance data modeling, half-open `[checkIn, checkOut)` stay intervals vs `BETWEEN` checkout off-by-one bug, controlled overbooking & Littlewood/$EMSR_b$ walk-penalty yield management, canonical `ORDER BY date ASC` multi-night deadlock elimination, `hotel_id`-sharded OTA scale-out with Debezium CDC Valkey inventory caching, co-located Reservation+Inventory ACID boundary + Temporal payment saga) | `architecture/system-design` (M19) | system-design (generic OCC/pessimistic/TTL hold/payment ledger primitives M10), data-systems (MVCC & Write Skew theory M05), distributed-systems (2PC blocking proof & formal Saga theory M09) |
| Planetary distributed email service composition (SMTP/POP3/IMAP4rev2/JMAP RFC 8620/8621 & MTA-STS RFC 8461 pipeline design, MIME Base64 `4/3` wire math, `user_id`-partitioned wide-column CP mailbox schemas with `read_emails`/`unread_emails` denormalization, RFC 5322 / JWZ conversation threading, SHA-256 content-addressed attachment deduplication with ref-counted GC, SPF/DKIM/DMARC alignment + ARC forwarding, dedicated IP pool warm-up & `< 0.3%` FBL complaint circuit breakers, write-heavy `_routing = user_id` vs co-located per-user LSM search) | `architecture/system-design` (M20) | data-systems (LSM-tree & inverted-index theory M02/M03), networking (DNS, TLS 1.3, HTTP/2–3, WebSockets), security-identity (PKI, RSA/Ed25519, SHA-256), system-design (commit-log queues & timing wheels M18) |
| Real-time gaming leaderboard composition (authoritative game-server anti-cheat ingestion with `match_id` idempotency, 64-bit Valkey/Redis `OBJ_ENCODING_SKIPLIST` `128 B/member` + `2×` `fork()` CoW memory sizing, 53-bit IEEE-754 safe integer composite tie-breaking via atomic Lua, `500M DAU` Score-Range Partitioning with `ZREVRANK` + $\sum \text{ZCARD}$ and cross-shard migration sagas vs Hash Partitioning with `ZSCORE` + parallel `ZCOUNT`, 32-way Write-Sharded DynamoDB GSIs, async `UNLINK` season rollover, and hybrid Exact Top-K + DDSketch percentile estimation) | `architecture/system-design` (M21) | algorithms/dsa (skip list data-structure theory M13), technologies/redis (Redis/Valkey `zskiplist`/`listpack` realisation & cluster slots M02/M10), data-systems (partitioning & replication theory M06/M07) |
| Read-heavy POI proximity service composition (decoupled stateless LBS read fleet vs Business CRUD service, `200M`-POI unsharded spatial index sizing vs `business_id`-sharded metadata table, spherical longitude $\cos(\phi)$ bounding-box scaling vs naive 1D B-tree band intersection bug, 5-way spatial index architecture comparing Geohash `L=4..6` 9-cell lookup + sparse rural precision step-down + Haversine corner post-filter vs in-memory adaptive Point Quadtree `leaf <= 100` with branch-and-bound $k$-NN & Kubernetes `/readyz` cold-boot gating vs Google S2 `S2RegionCoverer` polygon geofencing vs Uber H3 hexagons vs PostGIS 3.5+ `GiST` / Valkey `GEOSEARCH`, Two-Tier Geohash Cache vs raw GPS jitter misses, Debezium CDC + urgent closure override overlay, and GDPR/CCPA ephemeral location privacy + $k$-anonymous Geohash analytics) | `architecture/system-design` (M22) | system-design (geospatial index primitives M09, caching & stampede defenses M05, map tiles & routing M17), technologies/postgres (PostGIS GiST operations), technologies/redis (Valkey/Redis GEO commands) |
| High-fanout moving-target ephemeral location sharing composition (Nearby Friends `333.3k` writes/s $\to$ `13.33M` pushes/s fan-out math, stateful WebSocket gateway local viewer coordinate caching & `LEFT_RADIUS` boundary-exit notifications, `SETEX 600` 10-min TTL presence cache + Cassandra/ScyllaDB `TWCS` location history, CPU-bound `134–140` node Pub/Sub sizing vs `2` RAM nodes, legacy Redis Cluster `PUBLISH` $O(N)$ cluster-bus broadcast trap vs Valkey / Redis 7+ Sharded Pub/Sub `SPUBLISH`/`SSUBSCRIBE` and `etcd` Consistent-Hash Rings, 9-cell Geohash / 7-cell H3 "Nearby Random Person" Pub/Sub channel pools, Erlang/Elixir BEAM actor alternatives, and 3-circle trilateration stalking defense via `0.5-mile` distance bucketing + planar Laplace geo-indistinguishability noise) | `architecture/system-design` (M23) | system-design (static POI proximity M22, consistent hashing vnodes M06, WebSocket drain jitter M17), technologies/redis (Redis/Valkey Pub/Sub & cluster slot protocol), data-systems (LSM compaction theory) |
| High-throughput digital wallet & distributed event-sourced ledger composition (`1M` transfer TPS = `2M` account-leg operations/sec sizing across `2,000` RDBMS vs `200` `mmap`+RocksDB vs `20` TigerBeetle `io_uring` VSR nodes, fixed-point string-to-`BigInt` minor-unit wire contract vs IEEE-754 float drift, TC/C debit-first/`NOP` Phase 1 invariant + durable Phase Status Table + `out_of_order_flag` Hanging-Try tombstone vs X/A 2PC & Linear Saga, deterministic Event Sourcing `Command`/`Event`/`State`/`Snapshot` split where only immutable Events replicate over Raft consensus, local `mmap` event logs + RocksDB LSM derived state + HDFS/S3 Object Lock snapshots, and Push-Based Reverse Proxy CQRS vs pull polling) | `architecture/system-design` (M24) | system-design (generic double-entry ledger & PSP payment reconciliation M10/M14, CQRS read/write scaling M06, Temporal workflow sagas M07), distributed-systems (2PC/Saga formal theory M09, Raft consensus & deterministic simulation M05/M08), data-systems (LSM-tree & RocksDB compaction internals M02) |
| Reliable AI application & agent systems architecture (Validator Sandwich Pattern across all egress paths, CFG/FSM constrained decoding + `finish_reason` gating, OpenTelemetry GenAI semantic telemetry, ECE/Brier-calibrated uncertainty & capacity-bounded HITL routing, atomic `RPM + TPM + USD` admission control, tenant-isolated guarded semantic caching with slot/negation/provenance predicates, multi-provider bulkhead circuit breakers, bounded agent loops with SHA-256 cycle detection, and OWASP LLM Top 10:2025 tool-boundary authorization) | `architecture/system-design` (M25) | system-design (LLM inference serving & KV-cache VRAM M02/M14, general rate limiting & resilience M08, SLO burn-rate math M11), security-identity (general AuthN/AuthZ & OWASP web security), cloud tracks (Bedrock/Vertex/AI Foundry wiring only) |
| Secure-by-Design system architecture & 7-layer API defense composition (shift-left HLD threat-boundary integration, DDD Domain Primitives preventing BOLA/mass assignment structurally, AuthN vs AuthZ vs SSO vs JWT vs OAuth 2.1 vs OIDC vs SAML 2.0 architectural taxonomy & BFF/RTR custody, edge-to-data 7-layer API protection placement, RFC 9457 Problem Details, framework-level recursive PII/secret log redaction, fail-closed CI/CD release gates, and compliance-by-architecture) | `architecture/system-design` (M26) | security-identity (cryptography, PKI/mTLS, OAuth 2.1/OIDC/JWT/WebAuthn, RBAC/ABAC/ReBAC/Zanzibar/Cedar, OWASP internals), networking (L4/L7 proxy, TLS, DNS, WAF transport mechanics), gitlab-ci (CI/CD SBOM/cosign/SLSA mechanics), terraform (policy-as-code engines) |
| Backend architecture patterns composition (Modular Monolith, Microservices, Event-Driven, Serverless, Layered/N-Tier, Hexagonal/Ports & Adapters, CQRS), System Design in 12 Lines, Master Design Template, and Engineering Spec Documents (PRD, TRD, App Flow, Design Brief, Background Schema, Implementation Plan) | `architecture/system-design` (M01, M27, CHEATSHEET) | data-systems, distributed-systems, networking |

## Machine Learning and AI Engineering

| Concept | Owner | Cross-link only |
| --- | --- | --- |
| Python for AI & data engineering (NumPy strides/vectorization, dataset splits & leakage prevention, DVC/LakeFS data versioning) | `algorithms/ml-foundations` (M01) | `languages/python`, `algorithms/dsa` |
| Classical ML & evaluation metrics (bias-variance, $L_1/L_2$, `scikit-learn` Pipelines, Precision/Recall/$F_1$, PR-AUC vs ROC-AUC, Brier/log-loss, RMSE/MAE/$R^2$) | `algorithms/ml-foundations` (M02) | `architecture/system-design` (M25 calibration) |
| Neural network architectures (MLP, CNN, LSTM, Transformer/RoPE, Autoencoder/VAE ELBO, GAN minimax, DDPM Diffusion, GNN GCN/GAT) | `algorithms/ml-foundations` (M03–M04) | `architecture/ai-engineering` |
| KV-cache compression math & 8 mechanisms (MQA, GQA, Multi-Head Latent Attention [MLA], Sliding Window, Attention Sinks, PagedAttention, Prefix Caching/RadixAttention, KV Cache Quantization) | `algorithms/ml-foundations` (M05) | `architecture/system-design` (M14/M25 inference serving), `architecture/ai-engineering` (M06) |
| Weight/activation quantization (PTQ, QAT, GPTQ, AWQ, FP8/INT4) & production ML drift monitoring (covariate/label/concept drift, PSI, KS test) | `algorithms/ml-foundations` (M06) | `architecture/ai-engineering` (M06) |
| LLM fundamentals, prompt & context engineering, function calling & structured outputs (`CFG`/`FSM`/Zod-Pydantic), application frameworks | `architecture/ai-engineering` (M01) | `architecture/system-design` (M25 Validator Sandwich) |
| End-to-end RAG pipeline (`ingest→chunk→embed→store→retrieve→generate→evaluate`) & advanced RAG patterns (chunking, MRL embeddings, reranking, small-to-big, GraphRAG, metadata filtering, context compression, query rewriting/decomposition, HyDE, hybrid search + RRF, agentic RAG) | `architecture/ai-engineering` (M02–M03) | `architecture/data-systems` (M03 ANN/BM25), `technologies/elasticsearch` |
| Agent & Harness Engineering (Harness, Loop, Context, Tool Design, Memory Architecture, MCP JSON-RPC 2.0, Orchestration Patterns, LangGraph, Multi-Agent Systems, HITL Design) | `architecture/ai-engineering` (M04) | `architecture/system-design` (M25 bounded agent loops) |
| AI Agent metrics & evaluations (task success, tool accuracy, steps/task, escalation rate, guardrail hits, override rate, cost/task, time to resolve; trajectory/outcome evals, RAGAS faithfulness/context precision/recall, LLM-as-a-judge biases, benchmarking) | `architecture/ai-engineering` (M05) | `architecture/system-design` (M25) |
| LLMOps (serving OSS models via vLLM/SGLang/TensorRT-LLM, LLM app deployment, OTel GenAI tracing/observability, CI/CD eval gates) | `architecture/ai-engineering` (M06) | `technologies/observability`, `technologies/gitlab-ci`, `algorithms/ml-foundations` (M05) |
| AI Security Stack & Responsible AI (red teaming, guardrails+permissions, direct/indirect injection detection, ModelScan/safetensors, secrets+ML-BOM, policy+access, monitoring, OWASP LLM Top 10:2025/Agentic/NIST AI RMF/MITRE ATLAS, data ethics & bias) | `architecture/ai-engineering` (M07) | `architecture/security-identity`, `architecture/system-design` (M25) |

## Networking and security

| Concept | Owner | Cross-link only |
| --- | --- | --- |
| TCP/IP, UDP, routing/BGP/anycast, NAT, DNS, congestion control | `architecture/networking` | cloud-foundations, kubernetes, containers |
| TLS on the wire (handshake, RTTs, SNI/ALPN/ECH, PQ size impact), QUIC | `architecture/networking` | security-identity, cloudflare |
| HTTP/1.1, HTTP/2, HTTP/3, WebSockets, gRPC, HTTP caching (RFC 9111), CDNs, L4/L7 load balancing & distribution algorithms (RR, Weighted RR, Least Connections, Least Response Time, IP Hash, Consistent Hashing/Maglev) | `architecture/networking` | system-design, cloudflare, react/solidjs (streaming), algorithms/dsa (consistent hashing theory) |
| Linux network tooling (ss, tcpdump, iproute2, nftables, netns) | `architecture/networking` | containers |
| Crypto primitives, password hashing, KDFs, AEAD, signatures | `architecture/security-identity` | nodejs, python |
| PKI/X.509 validation, mTLS identity, cert lifecycle | `architecture/security-identity` | networking, kubernetes, cloudflare |
| OAuth 2.1, OIDC, PKCE, DPoP, JWT pitfalls, sessions/cookies, WebAuthn/passkeys | `architecture/security-identity` | cloud-foundations, azure (Entra), cloudflare (Access) |
| Authorization models (RBAC/ABAC/ReBAC, Zanzibar, Cedar, OpenFGA) | `architecture/security-identity` | cloud-foundations, kubernetes (RBAC realisation) |
| OWASP Top 10:2025, ASVS 5.0, API Top 10, threat modelling (STRIDE), secrets management | `architecture/security-identity` | all |
| Cache poisoning/deception attacks | `architecture/security-identity` (attack) | networking (mechanism) |
| CSP, Trusted Types (M05) | `architecture/security-identity` | react (DOM platform), networking (headers on the wire) |

## Platform and cloud

| Concept | Owner | Cross-link only |
| --- | --- | --- |
| Linux processes, signals, filesystems, namespaces, cgroups v2, overlayfs, seccomp | `technologies/containers` | kubernetes, nodejs (signals in containers) |
| OCI image/runtime/distribution specs, BuildKit, rootless, Docker vs Podman | `technologies/containers` | kubernetes, gitlab-ci |
| Shared compose-stack conventions (`examples/_compose`) | `technologies/containers` | every track with Docker labs |
| Kubernetes control plane, workloads, Services/CNI/NetworkPolicy, RBAC, CRDs/operators, Helm/Kustomize authoring | `technologies/kubernetes` | argocd, observability, cloud tracks (EKS/GKE/AKS) |
| GitOps principles (OpenGitOps), Argo CD internals, Rollouts / progressive delivery | `technologies/argocd` | kubernetes, gitlab-ci |
| IaC model, HCL, state & locking, modules, `terraform test`, OpenTofu | `technologies/terraform` | cloud tracks |
| Policy-as-code (OPA/Rego, CEL, Kyverno, Terraform Policy): one shared module | `technologies/terraform` | kubernetes (admission), argocd (projects) |
| CI/CD pipelines, SBOM, signing (cosign), SLSA provenance, OIDC-to-cloud from CI | `technologies/gitlab-ci` | containers, kubernetes (CKS admission), security-identity |
| OpenTelemetry, metrics/logs/traces, Prometheus/PromQL, LGTM, Kibana/Elastic Observability, alerting, SLO burn rates | `technologies/observability` | system-design (SLO math stays there), elasticsearch, kubernetes |
| ES storage, mappings, query DSL, ES\|QL, ILM | `technologies/elasticsearch` | observability |
| Cloud model, shared responsibility, IAM model, VPC/CIDR, storage classes, managed DBs, serverless, Well-Architected, FinOps | `architecture/cloud-foundations` | aws, gcp, azure |
| Concept → AWS/GCP/Azure service mapping table | `architecture/cloud-foundations` (`MAPPING.md`) | aws, gcp, azure |
| AWS-, GCP- and Azure-only semantics (IAM evaluation order, SCP/RCP, DynamoDB modelling, GCP hierarchy, Entra/ARM/Bicep) | each provider track | cloud-foundations |
| Edge isolates, Workers runtime, Durable Objects, KV/R2/D1/Queues, Zero Trust | `technologies/cloudflare` | networking, distributed-systems |

## Resolved ownership decisions (Phase 2)

- Language-neutral concurrency theory (Amdahl/Gustafson, linearizability vs sequential consistency, CAS/ABA, lock-free Treiber stack and Michael-Scott queue, work-stealing Chase-Lev deque): owned by `algorithms/dsa` (M13).
- Testing theory (test pyramid, property-based testing, mutation testing): owned by `languages/javascript`, with `languages/python` owning pytest/Hypothesis mechanics and `technologies/nodejs` owning `node:test` (M12).
