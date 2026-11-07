# Zero to One: Engineering & Computer Science Curriculum

A comprehensive, rigorous curriculum and reference repository covering programming languages, runtimes, data systems, platform engineering, cloud, algorithms, and distributed architectures.

Every topic in this repository is built around deep theoretical principles, verified code implementations, executable test suites, certification and interview preparation, and standardized bilingual terminology.

---

## 1. Repository Architecture & Taxonomy

The curriculum is structured into four core technical domains:

```text
zero-to-one/
├── AGENTS.md          # Binding conventions for every agent (structure, rigor, exams, tooling, workflow)
├── GLOSSARY.md        # Central bilingual (EN ↔ CZ) computer science & systems glossary
├── README.md          # This roadmap
├── .agents/           # Multi-agent coordination: PLAN, OWNERSHIP, STATUS, briefs, reviews, research
├── languages/         # typescript · javascript · python · css
├── technologies/      # react · solidjs · panda-css · postgres · nodejs · sqlite · redis · elasticsearch ·
│                      # containers · kubernetes · argocd · terraform · gitlab-ci · observability ·
│                      # aws · gcp · azure · cloudflare
├── algorithms/        # dsa
└── architecture/      # data-systems · distributed-systems · networking · security-identity ·
                       # cloud-foundations · system-design
```

### Track Standard

Every track adheres to the uniform structure defined in [AGENTS.md](./AGENTS.md):

1. `README.md` — Curriculum roadmap, prerequisites, learning outcomes, **Certifications & Exams**, and verification guide.
2. `GLOSSARY.md` — Bilingual (English ↔ Czech) dictionary of established terms.
3. `modules/` — Progressive chapter-by-chapter lessons, each ending with an Interview Drill.
4. `examples/` — Runnable, verified implementations and test suites (pseudocode + TypeScript primary; Python, Rust, Nim where applicable).
5. `exams/` — Exam-domain coverage matrix, original preparation question banks with answers, and mock exams.
6. `CHEATSHEET.md` — Rapid desk reference.

All tooling is pinned per track with [mise](https://mise.jdx.dev/) (`.mise.toml` + `mise.lock`).

---

## 2. Curriculum Roadmap & Status

29 tracks: 17 complete, 0 in progress, 12 planned. Work is phased by dependency; see [.agents/PLAN.md](./.agents/PLAN.md) for the plan and [.agents/STATUS.md](./.agents/STATUS.md) for live status.

| Domain | Track | Scope | Status | Path |
| :-- | :-- | :-- | :-: | :-- |
| `languages/` | **CSS & web platform** | Cascade, layout engines, the rendering pipeline, color science, motion and design-token architecture, tested in headless Chromium | 🟢 Complete | [languages/css/](./languages/css/) |
| `languages/` | **JavaScript** | ECMAScript 2026 from the specification up: types and coercion, execution model, async semantics, modules, metaprogramming, memory model and V8 behaviour | 🟢 Complete | [languages/javascript/](./languages/javascript/) |
| `languages/` | **TypeScript** | The TypeScript 7 type system and toolchain: erasure, narrowing, generics, type-level programming, runtime boundaries, typing UI frameworks, shipping typed libraries | 🟢 Complete | [languages/typescript/](./languages/typescript/) |
| `languages/` | **Python** | Python 3.15 from CPython internals and bytecode to PEP 695 typing, structured concurrency and free-threading | 🟢 Complete | [languages/python/](./languages/python/) |
| `technologies/` | **Panda CSS** | Panda CSS 2.x: build-time style extraction, tokens, recipes, the Oxc-based compiler, design-system distribution and migration from 0.x/1.x | 🟢 Complete | [technologies/panda-css/](./technologies/panda-css/) |
| `technologies/` | **PostgreSQL** | PostgreSQL 18: process model, SQL and JSONB, indexing, planner, MVCC, vacuum, WAL and PITR, replication, extensions | 🟢 Complete | [technologies/postgres/](./technologies/postgres/) |
| `technologies/` | **React** | React 19.3 runtime: Fiber, hooks, concurrent scheduling, Suspense, Server Components and Flight, Actions, React Compiler | 🟢 Complete | [technologies/react/](./technologies/react/) |
| `technologies/` | **SolidJS** | Solid 2.0 RC: fine-grained reactivity, async and transactions, start-mode full stack, migration from 1.x and the React vs Solid comparison | 🟢 Complete | [technologies/solidjs/](./technologies/solidjs/) |
| `technologies/` | **Elasticsearch** | Elasticsearch 9.5 & Lucene 10: inverted index & BM25, Zen2 & NRT lifecycle, mappings, text analysis, Query DSL, ES\|QL, aggregations, ILM/DSL, HNSW/BBQ vector & hybrid RRF search, routing, operations & codecs | 🟢 Complete | [technologies/elasticsearch/](./technologies/elasticsearch/) |
| `technologies/` | **Node.js** | Node.js 26 LTS: V8 & libuv event loop, CJS/ESM/type-stripping loaders, streams & backpressure, child processes, HTTP/undici & Fastify services, worker threads, V8 GC & diagnostics, `node:test`, security & containers | 🟢 Complete | [technologies/nodejs/](./technologies/nodejs/) |
| `technologies/` | **Redis** | Redis 8.10 & Valkey 9.1: reactor & RESP3, listpack/intset/skiplist encodings, TTL & LFU/LRM eviction, caching & stampede defense, Lua/Functions, Streams & PEL, GCRA & locks, Query Engine & Vector Sets, RDB/MP-AOF, Sentinel & Cluster | 🟢 Complete | [technologies/redis/](./technologies/redis/) |
| `technologies/` | **SQLite** | SQLite 3.54, libSQL & Turso: bindings & CLI, type affinity & `STRICT` tables, 4 KB page format & B-trees, rollback journal vs WAL & `wal-index`, NGQP & VDBE bytecode, FTS5/R-Tree/JSONB, concurrency, backups, OPFS/Litestream & Turso MVCC | 🟢 Complete | [technologies/sqlite/](./technologies/sqlite/) |
| `technologies/` | **Argo CD** | CGOA fits better than CAPA (48% Workflows/Events) | 🟡 Planned (Phase 3) | `technologies/argocd/` |
| `technologies/` | **Containers** | cgroup v1 gone in Podman 6; containerd store default in Docker 29 | 🟡 Planned (Phase 3) | `technologies/containers/` |
| `technologies/` | **GitLab CI** | Owns SBOM/cosign/SLSA | 🟡 Planned (Phase 3) | `technologies/gitlab-ci/` |
| `technologies/` | **Kubernetes** | CKA/CKAD on 1.37, CKS still 1.34; Ingress-NGINX retired Mar 2026 | 🟡 Planned (Phase 3) | `technologies/kubernetes/` |
| `technologies/` | **Observability** | Promtail EOL Mar 2026 → Alloy | 🟡 Planned (Phase 3) | `technologies/observability/` |
| `technologies/` | **Terraform** | Associate 004 tests 1.12; 1.17 is one week old | 🟡 Planned (Phase 3) | `technologies/terraform/` |
| `technologies/` | **AWS** | LocalStack now needs auth token → moto baseline | 🟡 Planned (Phase 4) | `technologies/aws/` |
| `technologies/` | **Azure** | AZ-204 retired; no default outbound for new VNets (verify date) | 🟡 Planned (Phase 4) | `technologies/azure/` |
| `technologies/` | **Cloudflare** | vitest-pool-workers → @cloudflare/vitest-plugin | 🟡 Planned (Phase 4) | `technologies/cloudflare/` |
| `technologies/` | **GCP** | PCA renewal centred on gen-AI case study | 🟡 Planned (Phase 4) | `technologies/gcp/` |
| `algorithms/` | **DSA** | Algorithm design, complexity analysis and data structures with proofs, invariants and TypeScript test suites | 🟢 Complete | [algorithms/dsa/](./algorithms/dsa/) |
| `architecture/` | **Data systems** | Storage engines, indexing, transactions and isolation, WAL and recovery, replication, sharding, caching, encoding and stream processing | 🟢 Complete | [architecture/data-systems/](./architecture/data-systems/) |
| `architecture/` | **Networking** | The protocol stack from Ethernet, IP and BGP through TCP, DNS, TLS 1.3, HTTP/1.1 to HTTP/3 and QUIC, load balancing and Linux network operations | 🟢 Complete | [architecture/networking/](./architecture/networking/) |
| `architecture/` | **Security & identity** | Threat modeling, applied cryptography, PKI and mTLS, sessions, OAuth 2.1/OIDC, WebAuthn, authorization models, vulnerability classes and supply chain | 🟢 Complete | [architecture/security-identity/](./architecture/security-identity/) |
| `architecture/` | **Distributed systems** | System models and impossibility results, clocks, consistency, replication, Paxos/Raft consensus, distributed transactions, CRDTs, deterministic simulation | 🟢 Complete | [architecture/distributed-systems/](./architecture/distributed-systems/) |
| `architecture/` | **Cloud Foundations** | Concept → AWS/GCP/Azure mapping table (~35 rows) | 🟡 Planned (Phase 4) | `architecture/cloud-foundations/` |
| `architecture/` | **System design** | Built last: composes all tracks | 🟡 Planned (Phase 4) | `architecture/system-design/` |

---

## 3. Bilingual Terminology & Glossaries (EN ↔ CZ)

To bridge technical English documentation with accurate, established Czech academic and professional terminology:

- **[Central Systems & CS Glossary](./GLOSSARY.md)** covers universal concepts (e.g., _Referential Transparency_, _Idempotency_, _Time Complexity_, _CAP Theorem_).
- **[JavaScript (ECMAScript) Glossary](./languages/javascript/GLOSSARY.md)** covers specification terms, coercion, execution contexts and closures, prototypes, iteration and the event loop, modules, metaprogramming, the memory model, and engine behaviour.
- **[TypeScript & Type-System Glossary](./languages/typescript/GLOSSARY.md)** covers type theory, compiler analysis, and language features.
- **[CSS Platform Glossary](./languages/css/GLOSSARY.md)** covers the cascade and cascade layers, value processing, layout engines, stacking contexts, container queries, color spaces, view transitions, the rendering pipeline, and design tokens.
- **[Python Glossary](./languages/python/GLOSSARY.md)** covers CPython execution and bytecode, the object model and dunder protocols, descriptors and metaclasses, generators and concurrency, typing, and packaging.
- **[React Glossary](./technologies/react/GLOSSARY.md)** covers Fiber reconciliation, concurrent priority lanes, selective hydration, the Flight protocol, Server Actions, and React Compiler lowering.
- **[SolidJS 2.x Glossary](./technologies/solidjs/GLOSSARY.md)** covers fine-grained push-pull reactivity, glitch freedom, draft stores and projections, colorless async, optimistic transactions, and server functions.
- **[Panda CSS Glossary](./technologies/panda-css/GLOSSARY.md)** covers static extraction, design tokens, recipes, slot recipes, and conditions.
- **[PostgreSQL Glossary](./technologies/postgres/GLOSSARY.md)** covers the process model, shared buffers, asynchronous I/O, MVCC internals, indexing, PITR, and pgvector.
- **[Elasticsearch Glossary](./technologies/elasticsearch/GLOSSARY.md)** covers inverted indices, BM25 and norms, NRT refresh/flush/translog, mappings, analyzers, Query DSL, ES|QL, aggregations, ILM, HNSW/BBQ vector search, routing, and Lucene codecs.
- **[Node.js Glossary](./technologies/nodejs/GLOSSARY.md)** covers V8 isolates, libuv handles and event-loop phases, CJS/ESM loaders and type stripping, Buffers and stream backpressure, child processes, HTTP/Fastify lifecycle, worker pools, V8 GC, and the permission model.
- **[Redis & Valkey Glossary](./technologies/redis/GLOSSARY.md)** covers RESP2/RESP3 framing, internal encodings (`listpack`, `intset`, `quicklist`, span skiplist), active/lazy expiry and LFU/LRM eviction, stampede mitigation, Lua scripts, Streams and consumer groups, GCRA rate limiting, RDB/MP-AOF persistence, Sentinel, and Redis Cluster hash slots.
- **[SQLite, libSQL & Turso Glossary](./technologies/sqlite/GLOSSARY.md)** covers storage classes and type affinity, B-tree page and cell layouts, rollback journals, WAL frames and `wal-index`, NGQP and VDBE opcodes, FTS5 and R-Tree virtual tables, Online Backup API, OPFS, WAL shipping, and embedded replicas.
- **[Data Structures & Algorithms Glossary](./algorithms/dsa/GLOSSARY.md)** covers complexity analysis, data structures, sorting and searching, graph algorithms, dynamic programming, greedy methods, string algorithms, and probabilistic structures.
- **[Data Systems Glossary](./architecture/data-systems/GLOSSARY.md)** covers storage engines, indexing and vector search, isolation levels, write-ahead logging and recovery, replication, sharding, caching, serialization, and stream processing.
- **[Distributed Systems Glossary](./architecture/distributed-systems/GLOSSARY.md)** covers system models, clocks and ordering, consistency models, replication and quorums, consensus, distributed transactions, CRDTs, and Byzantine fault tolerance.
- **[Networking Glossary](./architecture/networking/GLOSSARY.md)** covers link layer and IP routing, BGP, TCP and congestion control, DNS, TLS on the wire, HTTP/1.1 through HTTP/3 and QUIC, load balancing, and Linux kernel networking.
- **[Security & Identity Glossary](./architecture/security-identity/GLOSSARY.md)** covers threat modeling, cryptographic primitives, PKI and mTLS, OAuth 2.1 and OIDC, JOSE tokens, WebAuthn, authorization models, web vulnerability classes, and post-quantum security.

New tracks add their glossary here when they land. All glossaries follow the discipline recorded in [AGENTS.md](./AGENTS.md): shared terms reuse the root definition and Czech translation verbatim; no fabricated neologisms.

---

## 4. Getting Started & Verification

Install the repository-wide tooling and run the full gate from the repository root (Node 26):

```bash
npm ci
npm run check
```

`npm run check` runs, in order: `oxfmt --check` (formatting), `oxlint` (0 errors), then the Markdown gates `tools/wrap-check` (no hard-wrapped prose), `tools/table-check`, `tools/link-check` (links to planned tracks are allowed) and `tools/mermaid-check` (install its dependencies once with `cd tools/mermaid-check && npm ci`). Run it before every commit.

Each Node track also exposes `npm run lint`, `npm run fmt` and `npm run fmt:check` next to `npm test` and `npm run typecheck`; the Python track uses `ruff check` and `ruff format --check`. See the "Running" section of each track's README.
