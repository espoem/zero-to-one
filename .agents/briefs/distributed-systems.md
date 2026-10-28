# Brief: Distributed systems (`architecture/distributed-systems`)

| | |
|---|---|
| Phase | 2 |
| Kind | NEW track: create from scratch |
| Primary (author) | **Opus · claude.ai** |
| Drafter (on request) | pi · DeepSeek |
| Challenger | pi · Muse Spark 1.3 |
| Verifier | Antigravity |
| Final gate | Opus (claude.ai session) |
| Branch / worktree | `track/distributed-systems` · `../zto-distributed-systems` |
| Depends on | architecture/data-systems |
| Research dossier | `.agents/research/D-cs.md` |

## 0. Read before starting (binding)
1. `AGENTS.md`: the contract. If it conflicts with this brief, AGENTS.md wins; log the conflict in your review file.
2. `.agents/OWNERSHIP.md`: what you own vs only cross-link.
3. `.agents/REVIEW.md`: the checklist your work is judged against.
4. Your global/agent instructions still apply where they do not conflict.

## 1. Owner decisions and track-specific instructions
- Primary proof: Raft in TypeScript on a deterministic simulator (seeded RNG, virtual clock and network), with the safety invariants checked every step and injected bugs that must be caught. Cross-check linearizability with Porcupine (Go via mise).
- TLA+ specs use tla2tools pinned via mise (java). The Toolbox is unmaintained; use the CLI or the VS Code extension.
- Teach the **latest stable** versions. Add **Then vs now** comparisons wherever practice changed (AGENTS.md § Version Currency).
- Pin **all** tooling via mise (`.mise.toml` + `mise.lock`): node 26 for JS/TS, plus every CLI and runtime the examples need.

## 2. Ownership
**You own (full treatment):**
- System models, FLP, CAP/PACELC as formal results
- Clocks (Lamport, vector, HLC, TrueTime), consistency hierarchy, linearizability checking
- Consensus (Paxos/Raft/ZAB), replicated state machines, leases & fencing, distributed locks
- 2PC/3PC, Percolator/Spanner/Calvin, sagas as a correctness problem, CRDTs
- Delivery semantics (at-most / at-least / effectively-once), idempotency theory
- Retry amplification, metastable failures (theory)

**Cross-link only (do not re-explain):**
- Concurrency models, locks, data races, lock-free structures (language-neutral) → owned by `algorithms/dsa` (proposed extra module, TBD)
- Isolation levels & anomaly taxonomy (Adya/Berenson), MVCC theory, SSI → owned by `architecture/data-systems`
- Replication mechanics (leader/follower, multi-leader, leaderless), sharding/rebalancing, CDC → owned by `architecture/data-systems`
- Stream processing, logs, Kafka operations → owned by `architecture/data-systems`
- Edge isolates, Workers runtime, Durable Objects, KV/R2/D1/Queues, Zero Trust → owned by `technologies/cloudflare`

## 3. Research dossier (verified 2026-10-27/28; re-verify before use)

#### Distributed systems — `architecture/distributed-systems`

- **Current stable version(s)**
  - **DDIA 2nd edition is published**: Kleppmann & Riccomini, O'Reilly; O'Reilly lists release Feb 2026 (digital) (https://www.oreilly.com/library/view/-/9781098119058), print 31 Mar 2026, ~600 pp, ISBN 9781098119065 (https://www.readings.com.au/product/9781098119065/). New structure: 14 chapters, "Sharding" replaces "Partitioning", new ch. 1 trade-offs / ch. 2 nonfunctional requirements, ch. 13 "A Philosophy of Streaming Systems".
  - MIT **6.5840** (formerly 6.824) Spring 2026 (https://pdos.csail.mit.edu/6.824/schedule.html): labs in Go — 1 MapReduce, 2 KV server (linearizable, at-most-once over lossy net), 3A–D Raft (election, log, persistence, snapshots), 4A–C KV on Raft, 5A–D sharded KV. Lectures: MapReduce, RPC/threads, GFS, Paxos, Go patterns, Raft ×2, linearizability, ZooKeeper, distributed transactions, Spanner, chain replication, FaRM/OCC, IronFleet verification, Memcache@FB, AWS Lambda, Ray, SUNDR, Bitcoin, PBFT.
  - Tooling verified: Go 1.27.3 (1.27.0 released 2026-08-19; https://go.dev/doc/devel/release); Porcupine v1.3.1 (2026-09-21; https://pkg.go.dev/github.com/anishathalye/porcupine?tab=versions); Maelstrom 0.2.4 (bundles Jepsen 0.3.7, fixes a Knossos bug; https://github.com/jepsen-io/maelstrom/releases — year not shown, unverified); TLA+ tools: latest stable **v1.7.4** "Xenophanes", **v1.8.0 "Clarke" is still a pre-release** (dated 20 Oct, year not shown) and the **TLA+ Toolbox is no longer actively maintained** — use VS Code extension or CLI (https://github.com/tlaplus/tlaplus/releases/tag/v1.8.0). Apache Kafka latest **4.4.0 (2026-10-22)**, supported 4.3.1, 4.2.2 (https://kafka.apache.org/community/downloads/); Kafka 4.2 (2026-03-26) made **Queues for Kafka / share groups (KIP-932) GA** and KIP-1071 Streams rebalance GA (https://developer.confluent.io/newsletter/apache-kafka-42-released/). Node clients: `@confluentinc/kafka-javascript` 1.11.0; **kafkajs 2.2.4 last published 2023-02 — effectively unmaintained**. CRDT libs: yjs 13.6.33, @automerge/automerge 3.5.0 (npm). P language (p-org/P) version not verifiable (NuGet blocked by proxy) (unverified).
- **Authoritative syllabi used**
  - MIT 6.5840 Spring 2026 (above); Raft extended paper (https://raft.github.io/raft.pdf) + Ongaro thesis; Paxos Made Simple; Viewstamped Replication Revisited.
  - DDIA 2e ch. 9 "The Trouble with Distributed Systems", ch. 10 "Consistency and Consensus".
  - Jepsen consistency model map (https://jepsen.io/consistency/models): multi-object chain strict-serializable → serializable → RR / SI → MAV → cursor stability → RC → RU; single-object chain linearizable → sequential → causal → PRAM/WFR → MR/MW/RYW; availability classes: totally available (RU, RC, MAV, MR, MW, WFR), sticky available (RYW, PRAM, causal), not totally available (CS, SI, sequential and stronger).
  - Kleppmann's Cambridge "Concurrent and Distributed Systems" lecture notes (https://www.cl.cam.ac.uk/teaching/2122/ConcDisSys/) (year of current edition unverified); Fly.io Gossip Glomers (https://fly.io/dist-sys/) on Maelstrom; Herlihy & Wing linearizability; Shapiro et al. CRDTs; Adya's isolation thesis + Elle paper.
- **Proposed modules**
  1. **System models & impossibility** — fallacies of distributed computing; crash-stop/crash-recovery/omission/Byzantine; synchronous/partially synchronous/asynchronous; FLP; two generals; CAP stated precisely (Gilbert–Lynch) and PACELC; safety vs liveness.
  2. **Networks, RPC & failure detection** — RPC semantics (at-most-once, at-least-once, dedupe tables — 6.5840 Lab 2), timeouts, retries with jittered exponential backoff, idempotency keys, phi-accrual/heartbeat failure detectors, gray failures, SWIM gossip & membership.
  3. **Time & order** — physical clocks, NTP/PTP, skew/drift, monotonic vs wall clock; happens-before, Lamport clocks, vector clocks/version vectors, dotted version vectors, HLC; TrueTime & commit-wait; leases and fencing tokens.
  4. **Consistency models** — linearizability (formal: real-time order + legal sequential history), sequential, causal, session guarantees (RYW, MR, MW, WFR), eventual; transactional side (serializable, SI, strict serializable); Jepsen map & availability classes; how to *check* linearizability (WGL algorithm, Porcupine/Knossos, NP-completeness, P-compositionality).
  5. **Replication protocols** — primary-backup, chain replication (CRAQ), quorum systems (R+W>N and why it is *not* linearizable without read repair/ABD), state-machine replication; reads: leader reads, ReadIndex, lease reads, follower reads.
  6. **Consensus I: Paxos family** — single-decree Paxos proof sketch, Multi-Paxos, Flexible Paxos quorums, EPaxos (overview), ZAB/ZooKeeper (linearizable writes, FIFO client order, sync() reads).
  7. **Consensus II: Raft deep dive** — leader election (randomized timeouts, pre-vote, check-quorum), log replication, the 5 safety properties, Figure 8 commit rule, persistence requirements, snapshots/InstallSnapshot, membership changes (joint consensus vs single-server), log compaction, client interaction (sessions for exactly-once); implementation pitfalls (6.5840 students' guide).
  8. **Coordination services & primitives** — distributed locks (why Redlock is controversial), leader election via etcd/ZK leases, fencing, service discovery, barriers; etcd/ZooKeeper failure modes.
  9. **Distributed transactions** — atomic commit, 2PC (blocking, recovery, presumed abort), 3PC & why unused, Percolator (snapshot isolation over Bigtable), Spanner (Paxos groups + 2PC + TrueTime), Calvin/deterministic DBs, FaRM/OCC; sagas (orchestration vs choreography, compensations, semantic locks), transactional outbox/inbox; anomaly taxonomy G0/G1a-c/G2 (Adya) and Elle.
  10. **Logs, messaging & delivery semantics** — log as source of truth; Kafka model (partitions, ISR, high watermark, acks, idempotent producer, transactions & `read_committed`, consumer groups, KIP-848 protocol, share groups/queues GA in 4.2); at-most/at-least/effectively-once; ordering guarantees; exactly-once limits with external side effects.
  11. **Convergence without coordination: CRDTs** — strong eventual consistency; state-based (join semilattice: commutative, associative, idempotent merge) vs op-based (causal delivery) vs delta-state; G/PN-counter, LWW/MV-register, OR-set, RGA/sequence CRDTs (Yjs, Automerge); tombstones & GC; local-first.
  12. **Testing & verifying distributed systems** — deterministic simulation testing (FoundationDB, TigerBeetle VOPR https://docs.tigerbeetle.com/about/vopr), fault injection, Jepsen methodology (generators, nemeses, checkers), TLA+/PlusCal model checking (invariants vs temporal properties), P language, lightweight formal methods at AWS, IronFleet (6.5840 L15).
  13. **Byzantine & open systems** — PBFT (3f+1), Bitcoin/Nakamoto consensus, SUNDR fork consistency; when BFT is worth it.
  14. **Case studies & capstone** — GFS, MapReduce, Dynamo, Spanner, Memcache@FB, Aurora (quorum on storage), Kafka KRaft; capstone: sharded linearizable KV on own Raft (6.5840 Labs 4–5 in TS).
- **Gotchas & production failure modes**
  - Raft: replying to RequestVote/AppendEntries before fsyncing `currentTerm`, `votedFor`, `log[]` → two leaders in one term after crash-restart.
  - Raft Figure 8: leader marks an entry from a previous term committed because it is on a majority → committed entry later overwritten; only commit current-term entries by counting.
  - Serving reads from the leader's local state without ReadIndex/lease → stale reads from a deposed leader during a partition (etcd had this as a `serializable` vs `linearizable` read option; Jepsen etcd 3.4.3 findings).
  - Lease-based leadership/locks assume bounded clock drift and no process pauses; a 30 s GC/VM pause lets a "lock holder" write after expiry → need fencing tokens checked by the storage (Kleppmann on Redlock).
  - LWW conflict resolution with skewed wall clocks silently drops acknowledged writes (Cassandra/DynamoDB-style LWW); same-millisecond timestamps tie-break arbitrarily.
  - Quorum R+W>N is not linearizable: sloppy quorums/hinted handoff and concurrent read-during-write return new-then-old values.
  - "Exactly-once" in Kafka covers only Kafka→Kafka read-process-write with transactions; a consumer that writes to Postgres/HTTP then commits offsets is at-least-once → needs idempotent sink/outbox.
  - Kafka `acks=1` or `unclean.leader.election.enable=true` loses acknowledged writes on leader failover; `min.insync.replicas=1` with RF=3 does too.
  - Changing a topic's partition count remaps keys → per-key ordering broken and stateful consumers see keys move.
  - Consumer exceeding `max.poll.interval.ms` (slow handler) is evicted → rebalance storm + duplicate processing loop.
  - 2PC coordinator crash after PREPARE leaves participants holding locks indefinitely; Postgres prepared transactions also pin `xmin` → vacuum cannot clean, table bloat, eventual wraparound risk.
  - Dual write (DB commit then publish event) without outbox → lost or phantom events on crash between the two.
  - Saga compensations that are not idempotent/commutative fail on retry or arrive before the forward step (out-of-order delivery).
  - Retries without jitter/budgets at every layer → retry amplification (3 layers × 3 retries = 27×) and metastable failure that persists after the trigger is gone.
  - ZooKeeper/etcd session expiry while the client still believes it is leader (GC pause) → split brain unless fenced.
  - Vector-clock/version-vector sibling explosion with many writers (client IDs as actors) → use dotted version vectors / server actors.
  - CRDT tombstone growth (OR-set, sequence CRDTs) unbounded without causal-stability GC.
  - Snapshot isolation sold as "serializable" (Oracle SERIALIZABLE, Postgres pre-9.1) permits write skew; distributed SI (Percolator) likewise.
- **Interview hot topics**
  - CAP vs PACELC, explained with a concrete partition scenario (and why "CA" is not a choice).
  - Linearizability vs serializability vs strict serializability; session guarantees.
  - Raft: election, log matching, commit rule, why randomized timeouts, how reads are made linearizable.
  - Paxos vs Raft differences; why consensus needs 2f+1 nodes.
  - Logical clocks: Lamport vs vector vs HLC; how Spanner gets external consistency.
  - Distributed locks & fencing tokens; Redlock critique.
  - 2PC vs sagas vs outbox; idempotency keys.
  - Exactly-once delivery myth vs effectively-once processing; Kafka ordering & consumer groups.
  - Leaderless replication, quorums, read repair, anti-entropy (Merkle trees).
  - CRDTs for collaborative editing (Google Docs-style questions).
  - Failure detection & split brain; gray failure.
  - How would you test this? (Jepsen, DST, TLA+).
- **Executable-proof strategy**
  - **Primary: Raft in TypeScript inside a deterministic simulator** (`node:test`, Node 24/26, fast-check 4.10.2). Simulator = seeded PRNG (e.g. xoshiro128**), virtual clock + event queue (no `setTimeout`/`Date.now` in node code — inject `Clock` and `Network` interfaces), simulated network with drop/delay/duplicate/reorder/partition, crash-restart that discards volatile state and keeps a fake `Storage` (with optional "lost unfsynced write" fault). After every event, assert Raft invariants: Election Safety, Leader Append-Only, Log Matching, Leader Completeness, State Machine Safety. Tests sweep e.g. 500 seeds × 2 000 steps; failing seed is printed and replayable byte-for-byte. Port the 6.5840 lab test scenarios (3A–3D, 4A) as TS tests.
  - **Negative tests (bug-injection)**: flags that (a) skip persistence of `votedFor`, (b) commit previous-term entries by count (Figure 8), (c) serve leader reads without ReadIndex — each must be *caught* by the invariant checker / linearizability checker within N seeds. This proves the checkers have teeth.
  - **Linearizability checker**: implement Wing–Gong/Lowe (WGL) with memoization in TS for a KV model, plus P-compositionality per key; cross-validate on exported JSON histories with **Porcupine v1.3.1** (Go 1.27 via mise `go = "1.27"`; optional) which also renders HTML visualizations. Include known non-linearizable hand-written histories as negative fixtures.
  - **Maelstrom 0.2.4** (needs a JDK — `java = "temurin-21"` in mise; JDK version requirement unverified) for Gossip Glomers-style workloads (echo, unique-ids, broadcast, g-counter, kafka-style log, txn-rw-register) with nodes written in Node/TS over stdin/stdout JSON. Deterministic enough for CI with fixed `--time-limit` and `--rate`, though not seed-reproducible (Maelstrom uses real threads) → mark as "integration proof", not unit.
  - **TLA+**: PlusCal specs for 2PC (Lamport's TwoPhase/TCommit), a simple Raft election, and a lock-with-lease spec showing the fencing bug (TLC finds counterexample; fixed spec passes). Pin `tla2tools.jar` **v1.7.4** (latest stable) by SHA-256 in a mise task; run `java -cp tla2tools.jar tlc2.TLC -deadlock -workers 1` (single worker for deterministic output). 1.8.0 is pre-release — do not pin. P language as optional alternative (version unverified).
  - **Transactions / isolation**: Postgres via `testcontainers` 12.2.1 (Node) or PGlite (if the data-systems agent pins it) — reproduce write skew under REPEATABLE READ, show SERIALIZABLE aborts with `40001`; 2PC with `PREPARE TRANSACTION` (requires `max_prepared_transactions > 0`) and a coordinator-crash test showing a lingering prepared txn in `pg_prepared_xacts`. Small Adya-style dependency-graph cycle detector in TS (G0/G1c/G2) applied to recorded histories (Elle-lite); Elle itself is Clojure — optional.
  - **Messaging**: docker compose single-node KRaft `apache/kafka:4.4.0` (image tag unverified) + `@confluentinc/kafka-javascript` 1.11.0: tests for idempotent producer dedupe, transactional read-process-write with `isolation.level=read_committed`, rebalance-induced duplicates, partition-count change breaking key affinity; Toxiproxy (version unverified) for partitions/latency. Requires Docker/Colima on Mac; mark these as `test:integration` separate from deterministic unit tests.
  - **CRDTs**: own G-Counter/PN-Counter/OR-Set/LWW-Map implementations with fast-check properties: merge commutative, associative, idempotent; convergence after random delivery orders/duplication; compare with yjs 13.6.33 / automerge 3.5.0 behaviour on concurrent inserts.
  - **Cannot prove locally**: real clock skew/TrueTime, real WAN partitions, fsync durability on actual disks, BFT at scale → fallback: simulated faults in DST, TLA+ counterexamples, and paper-reading notes with "what would break" questions.
- **Overlaps / dedupe**
  - Belongs to `architecture/data-systems`: storage engines, single-node isolation implementation (MVCC, SSI internals), leader/follower & leaderless replication *mechanics*, sharding/rebalancing, CDC, stream-processing operators/windows. This track links those and only adds the correctness theory (anomaly definitions, linearizability, consensus).
  - Kafka operational depth → messaging/streaming track (or data-systems); here only log + delivery semantics.
  - Consistent hashing algorithm → `algorithms/dsa`; its use in sharding → data-systems.
  - Retry/backoff/circuit-breaker *patterns as components* → system-design; here the theory (amplification, metastability).
  - Go is used only as an optional runner for Porcupine/6.5840 originals; no Go teaching here.

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
- Tooling verified: Go 1.27.3 (1.27.0 released 2026-08-19; https://go.dev/doc/devel/release); Porcupine v1.3.1 (2026-09-21; https://pkg.go.dev/github.com/anishathalye/porcupine?tab=versions); Maelstrom 0.2.4 (bundles Jepsen 0.3.7, fixes a Knossos bug; https://github.com/jepsen-io/maelstrom/releases — year not shown, unverified); TLA+ tools: latest stable **v1.7.4** "Xenophanes", **v1.8.0 "Clarke" is still a pre-release** (dated 20 Oct, year not shown) and the **TLA+ Toolbox is no longer actively maintained** — use VS Code extension or CLI (https://github.com/tlaplus/tlaplus/releases/tag/v1.8.0). Apache Kafka latest **4.4.0 (2026-10-22)**, supported 4.3.1, 4.2.2 (https://kafka.apache.org/community/downloads/); Kafka 4.2 (2026-03-26) made **Queues for Kafka / share groups (KIP-932) GA** and KIP-1071 Streams rebalance GA (https://developer.confluent.io/newsletter/apache-kafka-42-released/). Node clients: `@confluentinc/kafka-javascript` 1.11.0; **kafkajs 2.2.4 last published 2023-02 — effectively unmaintained**. CRDT libs: yjs 13.6.33, @automerge/automerge 3.5.0 (npm). P language (p-org/P) version not verifiable (NuGet blocked by proxy) (unverified).
- Kleppmann's Cambridge "Concurrent and Distributed Systems" lecture notes (https://www.cl.cam.ac.uk/teaching/2122/ConcDisSys/) (year of current edition unverified); Fly.io Gossip Glomers (https://fly.io/dist-sys/) on Maelstrom; Herlihy & Wing linearizability; Shapiro et al. CRDTs; Adya's isolation thesis + Elle paper.
- **Maelstrom 0.2.4** (needs a JDK — `java = "temurin-21"` in mise; JDK version requirement unverified) for Gossip Glomers-style workloads (echo, unique-ids, broadcast, g-counter, kafka-style log, txn-rw-register) with nodes written in Node/TS over stdin/stdout JSON. Deterministic enough for CI with fixed `--time-limit` and `--rate`, though not seed-reproducible (Maelstrom uses real threads) → mark as "integration proof", not unit.
- **TLA+**: PlusCal specs for 2PC (Lamport's TwoPhase/TCommit), a simple Raft election, and a lock-with-lease spec showing the fencing bug (TLC finds counterexample; fixed spec passes). Pin `tla2tools.jar` **v1.7.4** (latest stable) by SHA-256 in a mise task; run `java -cp tla2tools.jar tlc2.TLC -deadlock -workers 1` (single worker for deterministic output). 1.8.0 is pre-release — do not pin. P language as optional alternative (version unverified).
- **Messaging**: docker compose single-node KRaft `apache/kafka:4.4.0` (image tag unverified) + `@confluentinc/kafka-javascript` 1.11.0: tests for idempotent producer dedupe, transactional read-process-write with `isolation.level=read_committed`, rebalance-induced duplicates, partition-count change breaking key affinity; Toxiproxy (version unverified) for partitions/latency. Requires Docker/Colima on Mac; mark these as `test:integration` separate from deterministic unit tests.

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
1. **Primary (Opus)** works on branch `track/distributed-systems` and sets this track's row in `.agents/STATUS.md` to 🟦.
2. **Verify versions first.** Check every version in the dossier against its primary source today. Record the results in the README's `Verified against …` line. Resolve every item in the re-verify list below.
3. Build in stages: README syllabus + exam matrix → modules one by one, each with its examples/tests → glossary → cheatsheet → question banks → mock exam. Delegate bulk drafting (question-bank drafts, glossary candidates, cheatsheet tables) to the **Drafter**, then correct and integrate it yourself.
4. Before each commit: run `mise exec -- npm test` and `npm run typecheck` (or the equivalents), and `test:integration` if present. Commit with Conventional Commits scoped `(distributed-systems)`.
5. Self-check against `.agents/REVIEW.md`. Then set STATUS to 🟨 and write the hand-off at the top of `.agents/reviews/distributed-systems.md`:
   - what was done;
   - what was not done, and why;
   - every claim you are least sure of.
6. The **Challenger** attacks it and the **Verifier** checks it independently. Both record findings in `.agents/reviews/distributed-systems.md` (prompts in `.agents/KICKOFF.md`). The primary resolves the findings (🟧), Opus runs the final gate (🟪), and the owner merges (✅).
