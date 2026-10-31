# Exam & Interview Coverage Matrix: Distributed Systems

This directory contains the certification, university examination, and industry interview mapping for the `architecture/distributed-systems` curriculum, covering **MIT 6.5840 (formerly 6.824)**, **University of Cambridge CST Part II Distributed Systems**, and **Principal / Staff Distributed Systems Technical Interview Loops** (FAANG, Cloud Infrastructure, Database & Streaming Systems).

---

## 1. Primary Reference Curricula & Exam Standards

| Curricula / Examination | Authority / Institution | Verified Baseline | Exam / Guide Reference |
|---|---|---|---|
| **MIT 6.5840 (formerly 6.824)** | MIT EECS / CSAIL (Morris, Kaashoek) | Spring 2024 / Current | [MIT 6.5840 Distributed Systems](https://pdos.csail.mit.edu/6.824/) |
| **Cambridge CST Part II Distributed Systems** | University of Cambridge Computer Laboratory (Kleppmann) | 2023–2024 / Current | [Cambridge CST Part II Distributed Systems](https://www.cl.cam.ac.uk/teaching/current/DistSys/) |
| **Principal/Staff Distributed Systems Loop** | Industry Standard (Google Cloud, AWS, Confluent, Cloudflare, Meta) | 2026 Baseline | Comprehensive Distributed Architecture, Protocol Correctness, Formal Verification & Failure Modes |

---

## 2. Comprehensive Domain Coverage Matrix

| Domain & Topic | Weight | Curriculum Modules | Executable Proofs | Status |
|---|---|---|---|---|
| **1. System Models, Impossibility & CAP**<br>Deutsch fallacies, Failure hierarchy (Crash-Stop to Byzantine), Synchronous/Asynchronous/Partially Synchronous timing, Two Generals proof, FLP bivalence impossibility proof, Gilbert-Lynch CAP, Abadi PACELC, Safety vs Liveness | 8% | [Module 01](../modules/01-system-models-and-impossibility.md) | `01-system-models-and-bounds.test.ts` | ✅ Full |
| **2. Networks, RPC & Failure Detection**<br>RPC 5 failure points, At-most-once deduplication tables, Full Jitter vs Decorrelated Jitter, Metastable failures & retry amplification, $\Phi$-accrual failure detector math, Gray failures, SWIM gossip protocol | 7% | [Module 02](../modules/02-networks-rpc-and-failure-detection.md) | `02-networks-rpc-and-detectors.test.ts` | ✅ Full |
| **3. Time, Physical Clocks & Ordering**<br>Physical clock skew & drift, LWW silent overwrite anomaly, Lamport happens-before $\to$, Vector Clocks causal comparison, Hybrid Logical Clocks (HLC), Spanner TrueTime commit-wait $2\epsilon$, GC pause trap & fencing tokens | 7% | [Module 03](../modules/03-time-clocks-and-ordering.md) | `03-clocks-ordering-and-fencing.test.ts` | ✅ Full |
| **4. Consistency Models & Linearizability**<br>Herlihy-Wing real-time precedence, Jepsen consistency hierarchy, Session guarantees (RYW, MR, MW, WFR), Serializability vs Linearizability, Wing-Gong (WGL) linearizability checking algorithm, P-compositionality | 8% | [Module 04](../modules/04-consistency-models-and-linearizability.md) | `04-linearizability-checker.test.ts` | ✅ Full |
| **5. Replication Protocols & Quorums**<br>Primary-backup sync vs async, Chain Replication & CRAQ, Naive $R+W>N$ linearizability violation, ABD register read-repair protocol, State Machine Replication (SMR) principle, ReadIndex, Lease reads, Follower reads | 7% | [Module 05](../modules/05-replication-protocols-and-quorums.md) | `05-replication-quorums-and-abd.test.ts` | ✅ Full |
| **6. Consensus Foundations, Paxos & ZAB**<br>Agreement/Validity/Integrity/Termination, Single-Decree Paxos Phase 1a/1b & 2a/2b, Dueling proposers livelock, Multi-Paxos steady state, Flexible Paxos $Q_1 \cap Q_2 \neq \emptyset$ asymmetric quorums, EPaxos, ZAB epoch + counter | 8% | [Module 06](../modules/06-consensus-foundations-and-paxos.md) | `06-paxos-and-zab.test.ts` | ✅ Full |
| **7. Raft Consensus Deep Dive**<br>Raft state machine transitions, RequestVote & AppendEntries RPCs, 5 safety properties, Figure 8 commit rule for previous terms, fsync durability of `currentTerm`/`votedFor`/`log[]`, Pre-Vote phase, Check-Quorum mechanism | 8% | [Module 07](../modules/07-raft-consensus-deep-dive.md) | `07-raft-deterministic-simulator.test.ts` | ✅ Full |
| **8. Distributed Coordination & Locks**<br>Distributed locks vs leases, Kleppmann's Redlock critique, Storage-enforced fencing tokens, etcd revisions & micro-transactions, ZooKeeper ephemeral sequential nodes & fair lock queues avoiding thundering herds, barriers | 6% | [Module 08](../modules/08-distributed-coordination-and-locks.md) | `08-distributed-locks-and-coordination.test.ts` | ✅ Full |
| **9. Distributed Transactions & Atomic Commit**<br>Atomic commit, 2PC prepare/commit and blocking coordinator failure, 3PC network partition failure, Google Percolator primary/secondary locks, Spanner Paxos + 2PC, Calvin deterministic scheduling, Sagas orchestration/choreography, Transactional Outbox, Adya anomalies | 8% | [Module 09](../modules/09-distributed-transactions-and-atomic-commit.md) | `09-distributed-transactions-2pc.test.ts` | ✅ Full |
| **10. Messaging, Distributed Logs & Partitioning**<br>Log as source of truth, Kafka partitions, ISR, High Watermark vs LEO, `acks=all` + `min.insync.replicas >= 2`, Idempotent Producer PID + seqNum, Transactional EOS, KIP-848 cooperative rebalances, Kafka 4.2 Share Groups KIP-932, partition count resize trap | 7% | [Module 10](../modules/10-messaging-logs-and-delivery-semantics.md) | `10-messaging-and-logs.test.ts` | ✅ Full |
| **11. CRDTs & Strong Eventual Consistency**<br>Strong Eventual Consistency (SEC), Join-semilattice commutativity/associativity/idempotence, G-Counter, PN-Counter, OR-Set add-wins, Sequence CRDTs (RGA, LSEQ), Tombstone causal stability GC, Local-First 7 ideals | 7% | [Module 11](../modules/11-conflict-free-replicated-data-types-crdts.md) | `11-crdt-convergence.test.ts` | ✅ Full |
| **12. Verification, DST & Fault Injection**<br>Deterministic Simulation Testing (DST FoundationDB/TigerBeetle VOPR), Jepsen generators/nemeses/checkers, TLA+ formal specifications & TLC model checking, AWS formal methods, Chaos Engineering | 7% | [Module 12](../modules/12-verification-testing-and-fault-injection.md) | `12-deterministic-simulation-testing.test.ts` | ✅ Full |
| **13. Byzantine Fault Tolerance & Open Systems**<br>Byzantine failure model, $3f + 1$ mathematical proof, PBFT 3-phase pre-prepare/prepare/commit, Sybil attack defenses, Nakamoto Proof-of-Work & longest-chain rule, SUNDR fork consistency, CFT vs BFT trade-off matrix | 6% | [Module 13](../modules/13-byzantine-fault-tolerance-and-open-systems.md) | `13-byzantine-pbft-and-bounds.test.ts` | ✅ Full |
| **14. Real-World Systems, Sharding & Capstone**<br>GFS 64MB chunks & record appends, MapReduce fault tolerance, Dynamo vector clocks & sloppy quorums, Spanner architecture, AWS Aurora 6-way quorum log streaming, Memcached leases, Capstone Multi-Raft Sharded KV Store | 6% | [Module 14](../modules/14-distributed-systems-in-practice-and-capstone.md) | `14-sharded-kv-multi-raft.test.ts` | ✅ Full |

---

## 3. Question Bank Inventory

The question bank lives in [`interview.md`](./interview.md):
- **Total Questions**: 75 comprehensive questions covering academic theory, protocol mechanics, edge cases, and architectural trade-offs.
- **Difficulty Distribution**:
  - Difficulty 1 (Core Foundations / Conceptual Mechanics): 25 questions.
  - Difficulty 2 (Protocol Invariants / Operational Edge Cases): 35 questions.
  - Difficulty 3 (Staff-Level Architecture / Mathematical Proofs / Failure Bounds): 15 questions.
- **Timed Mock Examination**:
  - 1 full 90-minute mock examination simulating a Staff-level Distributed Systems interview loop (4 progressive scenario-based architectural and correctness problems) with complete rubrics, invariant proofs, and scoring key.
