# Concept Ownership Registry

**Rule (AGENTS.md § Knowledge Ownership):**
- The **owner** gives the full treatment: formal definition, mechanics, proofs, exam coverage.
- Every other track **cross-links** to the owner's module and adds only its own delta: the technology-specific realisation, limits, defaults and pitfalls.
- An unregistered concept gets registered here in the same change that introduces it.
- On a disagreement, record both positions in `reviews/<track>.md`. The final gate decides.

The `M` numbers refer to the proposed module lists in `research/*.md`. Authors update them when the final module numbering lands.

## Languages and runtimes

| Concept | Owner | Cross-link only |
|---|---|---|
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
| Node-specific security (permission model, prototype pollution, `vm` is not a sandbox, ReDoS) | `technologies/nodejs` | security-identity |
| The type system, inference, variance, declaration emit, tsconfig | `languages/typescript` | all TS-based tracks |
| Typing JSX, components, hooks, generic/polymorphic components | `languages/typescript` (M12) | react, solidjs, panda-css |
| Standard Schema, Zod typing of runtime boundaries | `languages/typescript` (M11) | nodejs, react, solidjs |
| Python data model, typing, asyncio, CPython internals, packaging (uv) | `languages/python` | dsa (Python idioms), all Python examples |
| Python-specific security (pickle, framework security) | `languages/python` | security-identity |

## Web UI

| Concept | Owner | Cross-link only |
|---|---|---|
| Cascade, `@layer`, `@scope`, specificity, inheritance, value processing | `languages/css` | panda-css |
| Layout (flow, flex, grid, subgrid, anchor positioning), stacking contexts | `languages/css` | panda-css (patterns) |
| Custom properties, `@property`, container queries, color spaces | `languages/css` | panda-css |
| View transitions, scroll-driven animations, top layer | `languages/css` | react (`<ViewTransition>`), solidjs |
| Design-token theory (W3C DTCG format) | `languages/css` | panda-css |
| CSS architecture comparison (BEM/ITCSS, utility-first, runtime vs zero-runtime CSS-in-JS) | `languages/css` | panda-css |
| Rendering pipeline internals (style → layout → paint → composite, reflow triggers) | `languages/css` | react, solidjs |
| Panda extraction, recipes, slot recipes, codegen, v2 compiler | `technologies/panda-css` | — |
| Fiber, lanes, Suspense, RSC/Flight, Actions, React Compiler | `technologies/react` | typescript |
| Signals graph, push-pull, stores/projections, colorless async, start mode | `technologies/solidjs` | typescript |
| React vs Solid mental-model comparison (written once) | `technologies/solidjs` (M10) | react |

## Algorithms and data

| Concept | Owner | Cross-link only |
|---|---|---|
| Asymptotic analysis, linear/tree/graph structures, sorting, DP, greedy, amortisation | `algorithms/dsa` | everything |
| Heaps, tries, LRU/LFU implementations, B-tree *as a data structure* | `algorithms/dsa` | data-systems, redis, system-design |
| Bloom / HyperLogLog / Count-Min math | `algorithms/dsa` | data-systems, redis, system-design |
| Consistent hashing algorithms (ring, jump, rendezvous) | `algorithms/dsa` | data-systems (use in sharding), system-design |
| Concurrency models, locks, data races, lock-free structures (language-neutral) | `algorithms/dsa` (proposed extra module, TBD) | javascript (Atomics), nodejs, python (GIL / free-threading), distributed-systems |
| Data models, relational algebra, normal forms | `architecture/data-systems` | postgres, sqlite |
| Storage engines: B-tree vs LSM, WAL/ARIES, compaction, buffer pools | `architecture/data-systems` | postgres, sqlite, redis, elasticsearch |
| Isolation levels & anomaly taxonomy (Adya/Berenson), MVCC theory, SSI | `architecture/data-systems` | postgres, sqlite, distributed-systems |
| Indexing theory: inverted index, BM25, vector ANN (HNSW, IVF, quantisation) | `architecture/data-systems` | postgres (FTS, pgvector), sqlite (FTS5), redis (Query Engine), elasticsearch (Lucene realisation) |
| Replication mechanics (leader/follower, multi-leader, leaderless), sharding/rebalancing, CDC | `architecture/data-systems` | postgres, redis, elasticsearch, distributed-systems |
| Caching theory (consistency, dual writes, invalidation, stampede) | `architecture/data-systems` | redis, system-design, cloudflare |
| Encoding & schema evolution (Avro, Protobuf) | `architecture/data-systems` | system-design |
| Stream processing, logs, Kafka operations | `architecture/data-systems` | distributed-systems (log abstraction and delivery semantics only) |
| PostgreSQL / SQLite / Redis / Elasticsearch realisations, ops, drivers, pooling | each technology track | data-systems |
| SQL injection mechanics, row-level security | `technologies/postgres` | security-identity |
| Libsql/Turso | `technologies/sqlite` (M12) | cloudflare (D1 comparison) |

## Distributed systems and design

| Concept | Owner | Cross-link only |
|---|---|---|
| System models, FLP, CAP/PACELC as formal results | `architecture/distributed-systems` | system-design, data-systems |
| Clocks (Lamport, vector, HLC, TrueTime), consistency hierarchy, linearizability checking | `architecture/distributed-systems` | data-systems, cloudflare (Durable Objects) |
| Consensus (Paxos/Raft/ZAB), replicated state machines, leases & fencing, distributed locks | `architecture/distributed-systems` | kubernetes (etcd), redis (Redlock critique), system-design |
| 2PC/3PC, Percolator/Spanner/Calvin, sagas as a correctness problem, CRDTs | `architecture/distributed-systems` | data-systems, system-design |
| Delivery semantics (at-most / at-least / effectively-once), idempotency theory | `architecture/distributed-systems` | system-design, gitlab-ci (retries) |
| Retry amplification, metastable failures (theory) | `architecture/distributed-systems` | system-design (patterns as components) |
| Requirements → HLD → deep dives, estimation, LB/CDN/rate-limiter/queue as components, SLO math | `architecture/system-design` | everything |

## Networking and security

| Concept | Owner | Cross-link only |
|---|---|---|
| TCP/IP, UDP, routing/BGP/anycast, NAT, DNS, congestion control | `architecture/networking` | cloud-foundations, kubernetes, containers |
| TLS on the wire (handshake, RTTs, SNI/ALPN/ECH, PQ size impact), QUIC | `architecture/networking` | security-identity, cloudflare |
| HTTP/1.1, HTTP/2, HTTP/3, WebSockets, gRPC, HTTP caching (RFC 9111), CDNs, L4/L7 load balancing | `architecture/networking` | system-design, cloudflare, react/solidjs (streaming) |
| Linux network tooling (ss, tcpdump, iproute2, nftables, netns) | `architecture/networking` | containers |
| Crypto primitives, password hashing, KDFs, AEAD, signatures | `architecture/security-identity` | nodejs, python |
| PKI/X.509 validation, mTLS identity, cert lifecycle | `architecture/security-identity` | networking, kubernetes, cloudflare |
| OAuth 2.1, OIDC, PKCE, DPoP, JWT pitfalls, sessions/cookies, WebAuthn/passkeys | `architecture/security-identity` | cloud-foundations, azure (Entra), cloudflare (Access) |
| Authorization models (RBAC/ABAC/ReBAC, Zanzibar, Cedar, OpenFGA) | `architecture/security-identity` | cloud-foundations, kubernetes (RBAC realisation) |
| OWASP Top 10:2025, ASVS 5.0, API Top 10, threat modelling (STRIDE), secrets management | `architecture/security-identity` | all |
| Cache poisoning/deception attacks | `architecture/security-identity` (attack) | networking (mechanism) |

## Platform and cloud

| Concept | Owner | Cross-link only |
|---|---|---|
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

## Open ownership questions
- Language-neutral concurrency theory: proposed as a new module in `algorithms/dsa`. Confirm before Phase 2.
- Testing theory (test pyramid, property-based testing, mutation testing): no owner yet. Proposal: one module in `languages/javascript`, with `languages/python` owning pytest/Hypothesis mechanics.
