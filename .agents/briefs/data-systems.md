# Brief: Data systems (`architecture/data-systems`)

| | |
|---|---|
| Phase | 1 |
| Kind | NEW track: create from scratch |
| Primary (author) | **Opus · claude.ai** |
| Drafter (on request) | pi · DeepSeek |
| Challenger | pi · Muse Spark 1.3 |
| Verifier | Antigravity |
| Final gate | Opus (claude.ai session) |
| Branch / worktree | `track/data-systems` · `../zto-data-systems` |
| Depends on | none (can start now) |
| Research dossier | `.agents/research/B-data.md` |

## 0. Read before starting (binding)
1. `AGENTS.md`: the contract. If it conflicts with this brief, AGENTS.md wins; log the conflict in your review file.
2. `.agents/OWNERSHIP.md`: what you own vs only cross-link.
3. `.agents/REVIEW.md`: the checklist your work is judged against.
4. Your global/agent instructions still apply where they do not conflict.

## 1. Owner decisions and track-specific instructions
- None beyond the dossier and AGENTS.md.
- Teach the **latest stable** versions. Add **Then vs now** comparisons wherever practice changed (AGENTS.md § Version Currency).
- Pin **all** tooling via mise (`.mise.toml` + `mise.lock`): node 26 for JS/TS, plus every CLI and runtime the examples need.

## 2. Ownership
**You own (full treatment):**
- Data models, relational algebra, normal forms
- Storage engines: B-tree vs LSM, WAL/ARIES, compaction, buffer pools
- Isolation levels & anomaly taxonomy (Adya/Berenson), MVCC theory, SSI
- Indexing theory: inverted index, BM25, vector ANN (HNSW, IVF, quantisation)
- Replication mechanics (leader/follower, multi-leader, leaderless), sharding/rebalancing, CDC
- Caching theory (consistency, dual writes, invalidation, stampede)
- Encoding & schema evolution (Avro, Protobuf)
- Stream processing, logs, Kafka operations

**Cross-link only (do not re-explain):**
- Heaps, tries, LRU/LFU implementations, B-tree *as a data structure* → owned by `algorithms/dsa`
- Bloom / HyperLogLog / Count-Min math → owned by `algorithms/dsa`
- Consistent hashing algorithms (ring, jump, rendezvous) → owned by `algorithms/dsa`
- PostgreSQL / SQLite / Redis / Elasticsearch realisations, ops, drivers, pooling → owned by each technology track
- System models, FLP, CAP/PACELC as formal results → owned by `architecture/distributed-systems`
- Clocks (Lamport, vector, HLC, TrueTime), consistency hierarchy, linearizability checking → owned by `architecture/distributed-systems`
- 2PC/3PC, Percolator/Spanner/Calvin, sagas as a correctness problem, CRDTs → owned by `architecture/distributed-systems`

## 3. Research dossier (verified 2026-10-27/28; re-verify before use)

#### Proposed shared foundation — `architecture/data-systems` (DDIA-style)

Purpose: every concept that appears in two or more data tracks is defined *once* here, formally and with primary sources. The technology tracks then show "how PostgreSQL/SQLite/Redis/ES implements X" and link back.

Primary syllabi:
- Kleppmann, *Designing Data-Intensive Applications*, 2nd ed. (O'Reilly, 2025/2026; Kleppmann & Riccomini; exact publication date unverified)
- CMU 15-445/645 (https://15445.courses.cs.cmu.edu/) and 15-721 (advanced)
- MIT 6.5840 Distributed Systems (https://pdos.csail.mit.edu/6.824/)
- Jepsen analyses (https://jepsen.io/analyses)
- Adya's thesis / Berenson et al. "A Critique of ANSI SQL Isolation Levels" (1995)
- Bailis "Highly Available Transactions"

Proposed modules:
1. **Data models & query languages:** relational algebra/calculus, normalization (1NF–BCNF), document vs relational vs graph vs key-value vs search/columnar, schema-on-read vs schema-on-write.
2. **Storage engines:** heap files and slotted pages; **B-tree/B+tree/B-link** (Lehman–Yao); **LSM trees** (memtable, SSTables, compaction strategies: leveled/tiered, read/write/space amplification, Bloom filters); log-structured hash (Bitcask); in-memory engines (Redis); column stores. Mapping: PG heap+B-tree, SQLite B-tree, Lucene segment/merge (LSM-like), Redis in-memory structures.
3. **Indexing:** primary/secondary/clustered/covering, composite key order, hash vs tree, inverted indexes (postings, BM25), spatial (R-tree, BKD), bitmap/BRIN-style summaries, **vector ANN** (flat, IVF, HNSW, DiskANN, quantization: PQ/int8/binary/BBQ; recall vs latency).
4. **Buffer management & I/O:** page cache vs own buffer pool (double buffering), mmap pitfalls (Crotty et al., CIDR 2022), fsync semantics and "fsyncgate", direct/async I/O (io_uring).
5. **Transactions & isolation:** ACID defined precisely, anomaly taxonomy (dirty read/write, read skew, lost update, write skew, phantoms), isolation levels (ANSI vs real), 2PL, MVCC/snapshot isolation, SSI, OCC (Turso `BEGIN CONCURRENT`, Redis `WATCH`), deadlock handling.
6. **Durability & recovery:** WAL, ARIES (analysis/redo/undo), checkpoints, rollback journal vs WAL (SQLite), AOF/snapshot (Redis), translog (ES), torn pages, group commit, backup/PITR concepts.
7. **Replication:** leader/follower, sync/async/semi-sync/quorum, replication lag anomalies (read-your-writes, monotonic reads, consistent prefix), multi-leader and leaderless, CRDTs/local-first sync (Turso Sync, cr-sqlite), logical vs physical replication, CDC/outbox.
8. **Partitioning/sharding:** key-range vs hash vs consistent hashing vs hash slots (Redis 16384), secondary index partitioning (local/document vs global/term; ES is document-partitioned, giving scatter-gather), rebalancing, hot spots, request routing.
9. **Consistency & consensus:** linearizability vs serializability, CAP/PACELC (with critiques), Raft/Paxos (etcd for Patroni, ES Zen2 voting), split brain, fencing tokens, leases, the distributed locks critique (Redlock).
10. **Caching:** cache placement, cache-aside/read/write-through/behind, invalidation, stampede, TTL design, consistency with source of truth, dual-write problem.
11. **Probabilistic & approximate structures:** Bloom/cuckoo filters, HyperLogLog, count-min sketch, t-digest, skip lists. Used by Redis, ES `cardinality`/percentiles and LSM Bloom filters.
12. **Choosing a data system:** OLTP vs OLAP vs search vs cache vs embedded; workload characterisation; a decision matrix across PG, SQLite/Turso, Redis/Valkey, ES/OpenSearch; polyglot persistence and keeping derived data in sync.

Executable proofs for the foundation: small, deterministic Python/TypeScript toy implementations, each with property tests (Hypothesis / fast-check) and negative tests:
- slotted page
- B+tree
- mini-LSM with compaction
- inverted index + BM25
- HNSW on 1k vectors vs brute force
- MVCC visibility function
- consistent-hash ring
- Raft log via an existing small library, simulated

Anomalies are then demonstrated against real engines in each track.

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

#### Context from `B-data.md`

##### Cross-track summary (for the orchestrator)

| Track | Path | Status | Pinned versions | Local proof |
|---|---|---|---|---|
| PostgreSQL | `technologies/postgres` | Existing, restructure 10 → 13 modules, add PG19 deltas | PG 18.6 (19 RC1); PGlite 0.5.12 = PG 18.6 | PGlite (single session) + testcontainers/compose for concurrency, replication, pooling, AIO (Linux) |
| SQLite | `technologies/sqlite` | New, 11 modules + M12 Turso | 3.54.1; better-sqlite3 bundles 3.53.4 | Fully local, multi-connection on files |
| Turso/libSQL | `technologies/sqlite` module 12 | Module, not track (revisit at Turso 1.0) | Turso DB 0.8.3; @libsql/client 0.18.0 (SQLite 3.45.1 base) | Local npm packages; sqld via compose; cloud sync not provable offline |
| Redis | `technologies/redis` | New, 12 modules | Redis 8.10.2; Valkey 9.1.2 (9.2-rc1) | Docker/testcontainers; compose for Sentinel/Cluster |
| Elasticsearch | `technologies/elasticsearch` | New, 12 modules; Kibana belongs to observability | ES 9.5.5; OpenSearch 3.8.0; client 9.5.1 | Docker single-node + 3-node compose; paid features need a trial license |
| Data systems | `architecture/data-systems` | New foundation, 12 modules | n/a | Toy implementations + property tests |

## 4. Re-verify list
These claims were marked unverified during research. Confirm or correct each one against a primary source before teaching it:
- Kleppmann, *Designing Data-Intensive Applications*, 2nd ed. (O'Reilly, 2025/2026; Kleppmann & Riccomini; exact publication date unverified)

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
1. **Primary (Opus)** works on branch `track/data-systems` and sets this track's row in `.agents/STATUS.md` to 🟦.
2. **Verify versions first.** Check every version in the dossier against its primary source today. Record the results in the README's `Verified against …` line. Resolve every item in the re-verify list below.
3. Build in stages: README syllabus + exam matrix → modules one by one, each with its examples/tests → glossary → cheatsheet → question banks → mock exam. Delegate bulk drafting (question-bank drafts, glossary candidates, cheatsheet tables) to the **Drafter**, then correct and integrate it yourself.
4. Before each commit: run `mise exec -- npm test` and `npm run typecheck` (or the equivalents), and `test:integration` if present. Commit with Conventional Commits scoped `(data-systems)`.
5. Self-check against `.agents/REVIEW.md`. Then set STATUS to 🟨 and write the hand-off at the top of `.agents/reviews/data-systems.md`:
   - what was done;
   - what was not done, and why;
   - every claim you are least sure of.
6. The **Challenger** attacks it and the **Verifier** checks it independently. Both record findings in `.agents/reviews/data-systems.md` (prompts in `.agents/KICKOFF.md`). The primary resolves the findings (🟧), Opus runs the final gate (🟪), and the owner merges (✅).
