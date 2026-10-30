# Data Systems Architecture: Academic & Technical Interview Coverage Matrix

This directory contains the examination and technical interview preparation question bank, curriculum domain mapping, and a full mock examination for foundational data systems architecture and storage engine engineering.

---

## 1. Targeted Examinations & Industry Standards

Data systems architecture is a vendor-neutral computer systems discipline. There is no single proprietary certification that encapsulates foundational storage engine internals, formal transaction theory, and distributed consistency. Evaluation in this field is anchored in two industry standards:

1. **Academic Computer Science Rigor (CMU 15-445/645 & MIT 6.5840)**:
   - **Institutions**: Carnegie Mellon University (*Database Systems* & *Advanced Database Systems*) and MIT (*Distributed Systems*).
   - **Foundational Texts**: Kleppmann's *Designing Data-Intensive Applications* (DDIA), Hellerstein, Stonebraker & Hamilton's *Readings in Database Systems* (Red Book 5th ed.), and Ramakrishnan & Gehrke's *Database Management Systems*.
   - **Target Competency**: Deep operational and mathematical mechanics of data models, access methods, buffer pools, ARIES recovery, concurrency control anomaly hierarchies (Berenson / Adya), and distributed consensus.
2. **Staff / Principal Storage & Distributed Systems Technical Interview Loop**:
   - **Format**: Senior/Staff/Principal engineering loops across tier-1 infrastructure providers (AWS DynamoDB/Aurora, Google Cloud Spanner/Bigtable, Meta, Databricks, Snowflake, CockroachDB).
   - **Structure**: Rigorous architectural deep-dives, anomaly counterexamples, quantitative storage sizing, concurrency analysis, and live hands-on algorithmic implementations (e.g. B+Tree splits, mini-LSM compaction, MVCC snapshot visibility, consistent hashing).

---

## 2. Exam & Interview Domain Coverage Matrix

| Domain # | Domain / Objective | Weight | Primary Module | Executable Proof | Status |
| :-: | :--- | :-: | :--- | :--- | :-: |
| **01** | Data Models, Relational Algebra & Schema Design | 8% | [01-data-models-and-query-languages.md](../modules/01-data-models-and-query-languages.md) | [01-slotted-page.test.ts](../examples/01-slotted-page.test.ts) | ✅ Full |
| **02** | Storage Engines: Slotted Pages, B-Trees & LSM-Trees | 10% | [02-storage-engines-b-trees-and-lsm.md](../modules/02-storage-engines-b-trees-and-lsm.md) | [02-bplus-tree.test.ts](../examples/02-bplus-tree.test.ts), [03-mini-lsm.test.ts](../examples/03-mini-lsm.test.ts) | ✅ Full |
| **03** | Indexing Theory, Inverted Indexes & Vector ANN | 9% | [03-indexing-theory-and-vector-search.md](../modules/03-indexing-theory-and-vector-search.md) | [12-vector-ann-hnsw.test.ts](../examples/12-vector-ann-hnsw.test.ts) | ✅ Full |
| **04** | Buffer Management, OS Paging & Direct I/O | 8% | [04-buffer-management-and-operating-system-io.md](../modules/04-buffer-management-and-operating-system-io.md) | [04-buffer-pool.test.ts](../examples/04-buffer-pool.test.ts) | ✅ Full |
| **05** | Transactions, ACID & Isolation Anomaly Hierarchy | 10% | [05-transactions-acid-and-isolation-levels.md](../modules/05-transactions-acid-and-isolation-levels.md) | [05-mvcc-transaction-manager.test.ts](../examples/05-mvcc-transaction-manager.test.ts) | ✅ Full |
| **06** | Durability, Write-Ahead Logging & ARIES Crash Recovery | 9% | [06-durability-wal-and-crash-recovery.md](../modules/06-durability-wal-and-crash-recovery.md) | [06-aries-wal-recovery.test.ts](../examples/06-aries-wal-recovery.test.ts) | ✅ Full |
| **07** | Replication Mechanics, Consistency & Quorums | 9% | [07-replication-mechanics-and-consensus.md](../modules/07-replication-mechanics-and-consensus.md) | [07-replication-quorum.test.ts](../examples/07-replication-quorum.test.ts) | ✅ Full |
| **08** | Partitioning, Consistent Hashing & Routing | 8% | [08-partitioning-sharding-and-routing.md](../modules/08-partitioning-sharding-and-routing.md) | [08-consistent-hashing.test.ts](../examples/08-consistent-hashing.test.ts) | ✅ Full |
| **09** | Caching Theory, Cache Stampedes & Invalidation | 8% | [09-caching-theory-and-consistency.md](../modules/09-caching-theory-and-consistency.md) | [09-cache-xfetch.test.ts](../examples/09-cache-xfetch.test.ts) | ✅ Full |
| **10** | Encoding, Binary Serialization & Schema Evolution | 7% | [10-encoding-serialization-and-schema-evolution.md](../modules/10-encoding-serialization-and-schema-evolution.md) | [10-schema-evolution.test.ts](../examples/10-schema-evolution.test.ts) | ✅ Full |
| **11** | Stream Processing, Event Logs & Compaction | 7% | [11-stream-processing-and-event-logs.md](../modules/11-stream-processing-and-event-logs.md) | [11-stream-table-duality.test.ts](../examples/11-stream-table-duality.test.ts) | ✅ Full |
| **12** | Architectural Decision Matrix, CAP/PACELC & Polyglot | 7% | [12-architectural-decision-matrix-and-polyglot-persistence.md](../modules/12-architectural-decision-matrix-and-polyglot-persistence.md) | All Examples (01–12) | ✅ Full |

---

## 3. Question Bank Navigation

The complete preparation question bank, categorized by domain and difficulty (1–3), is available in:
- [interview.md](./interview.md) — 60+ rigorous questions spanning single-choice, multiple-select, scenario analysis, ordering, and hands-on algorithmic tasks, complete with comprehensive explanations, distractor analysis, cross-module citations, and a 60-minute mock examination with scoring key.
