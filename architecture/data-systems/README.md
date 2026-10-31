# Data Systems Architecture Complete Curriculum & Reference

> **Verified against Node 26.12.1, TypeScript 7.0.2 on 2026-10-30**

Welcome to the **Data Systems Architecture Complete Learning Track**. This curriculum delivers an end-to-end, zero-to-one systems engineering reference synthesized from seminal computer science literature (Codd, Gray, Mohan, Haerder & Reuter, Lehman & Yao, O'Neil), foundational university curricula (CMU 15-445/645 *Database Systems*, MIT 6.5840 *Distributed Systems*, UC Berkeley CS 286), Martin Kleppmann's *Designing Data-Intensive Applications* (DDIA), and production storage engine architectures (PostgreSQL, RocksDB, Cassandra, Kafka, ClickHouse, Google Spanner, Snowflake).

Every concept is backed by a numerically ordered module in [modules/](./modules/) with formal definitions, state machines, Mermaid architecture blueprints, and fully runnable, deterministic verification test suites in [examples/](./examples/).

---

## 1. Curriculum Syllabus & Topic Breakdown

The curriculum is structured into 12 self-contained, progressive modules:

### [Module 01 — Data Models, Relational Algebra & Formal Query Languages](./modules/01-data-models-and-query-languages.md)
- **Concepts**: Relational algebra formal algebraic primitives ($\sigma, \pi, \times, \cup, -, \bowtie_\theta$), functional dependencies and Armstrong's Axioms, normal forms ($\text{5NF} \subset \text{4NF} \subset \text{BCNF} \subset \text{3NF} \subset \text{2NF} \subset \text{1NF}$), multivalued dependencies (4NF), join dependencies (5NF / PJNF), Schema-on-Write vs. Schema-on-Read, and Datalog recursive query evaluation (Knaster-Tarski least fixed point, seminaive evaluation, stratified negation).
- **Executable Verification**: Theoretical foundational proofs; storage mechanics verified in Module 02.

### [Module 02 — Storage Engines: Slotted Pages, B-Trees & LSM-Trees](./modules/02-storage-engines-b-trees-and-lsm.md)
- **Concepts**: Slotted page binary architecture and compaction, Lehman-Yao B-link tree concurrent algorithm (high keys and right links), Log-Structured Merge-Trees (LSM), MemTable flushes, immutable SSTables, Size-Tiered vs. Leveled compaction, the RUM conjecture (Read, Update, Memory trade-off triangle), and columnar storage with vectorized execution.
- **Runnable Examples**: [`examples/01-slotted-page.test.ts`](./examples/01-slotted-page.test.ts), [`examples/02-bplus-tree.test.ts`](./examples/02-bplus-tree.test.ts), [`examples/03-mini-lsm.test.ts`](./examples/03-mini-lsm.test.ts)

### [Module 03 — Indexing Theory, Inverted Indexes & Vector ANN](./modules/03-indexing-theory-and-vector-search.md)
- **Concepts**: Clustered vs. secondary indexes, inverted index postings lists, Okapi BM25 probabilistic term scoring ($k_1, b$), spatial indexes (R-Trees and BKD trees), and high-dimensional Vector Approximate Nearest Neighbor search (IVF, HNSW multi-layer graphs, DiskANN, SQ8 and Product Quantization).
- **Runnable Example**: [`examples/12-vector-ann-hnsw.test.ts`](./examples/12-vector-ann-hnsw.test.ts)

### [Module 04 — Buffer Management, Operating System I/O & Page Replacement](./modules/04-buffer-management-and-operating-system-io.md)
- **Concepts**: User-space Buffer Pool Manager architecture, frame tracking and pin count latches, the `mmap` critique (CIDR 2022), page replacement policies (LRU, CLOCK second-chance sweep, 2Q scan resistance, LIRS), Direct I/O (`O_DIRECT`), the PostgreSQL "fsyncgate" bug, and Linux `io_uring` asynchronous ring buffers.
- **Runnable Example**: [`examples/04-buffer-pool.test.ts`](./examples/04-buffer-pool.test.ts)

### [Module 05 — Transactions, ACID & Isolation Anomaly Hierarchy](./modules/05-transactions-acid-and-isolation-levels.md)
- **Concepts**: Formal ACID definitions, Berenson et al. (1995) and Adya (1999) anomaly taxonomy ($G0, A1, P4, A2, A3, G\text{-skew}, G\text{-read}$), Strict Two-Phase Locking (SS2PL), Multi-Version Concurrency Control (MVCC) snapshot visibility formulas, Write Skew counterexamples, and Serializable Snapshot Isolation (SSI) anti-dependency ($rw$) tracking.
- **Runnable Example**: [`examples/05-mvcc-transaction-manager.test.ts`](./examples/05-mvcc-transaction-manager.test.ts)

### [Module 06 — Durability, Write-Ahead Logging & ARIES Crash Recovery](./modules/06-durability-wal-and-crash-recovery.md)
- **Concepts**: Steal/No-Force buffer management classification, the Write-Ahead Log (WAL) flush invariant ($\text{PageLSN} \le \text{FlushedLSN}$), Group Commit I/O amortisation, fuzzy checkpoints, torn page prevention (Full Page Images / doublewrite buffers), and the complete 3-pass ARIES crash recovery algorithm (Analysis, Repeating History Redo, and Undo with idempotent Compensation Log Records).
- **Runnable Example**: [`examples/06-aries-wal-recovery.test.ts`](./examples/06-aries-wal-recovery.test.ts)

### [Module 07 — Replication Mechanics, Consistency & Distributed Quorums](./modules/07-replication-mechanics-and-consensus.md)
- **Concepts**: Single-leader, multi-leader, and leaderless replication, replication lag anomalies (Read-Your-Writes, Monotonic Reads), statement-based vs. physical vs. logical WAL replication, Dynamo-style quorum consensus ($W + R > N$), opportunistic Read Repair, Raft consensus protocol mechanics, and Martin Kleppmann's critique of the Redlock algorithm.
- **Runnable Example**: [`examples/07-replication-quorum.test.ts`](./examples/07-replication-quorum.test.ts)

### [Module 08 — Partitioning, Consistent Hashing & Routing](./modules/08-partitioning-sharding-and-routing.md)
- **Concepts**: Range partitioning vs. hash partitioning vs. directory routing, consistent hashing with virtual nodes (vnodes), minimal key migration fraction ($1 / (N+1)$), document-partitioned (local) vs. term-partitioned (global) secondary indexes, and the "Tail at Scale" scatter-gather latency problem.
- **Runnable Example**: [`examples/08-consistent-hashing.test.ts`](./examples/08-consistent-hashing.test.ts)

### [Module 09 — Caching Theory, Cache Stampedes & Invalidation](./modules/09-caching-theory-and-consistency.md)
- **Concepts**: Cache topologies (Cache-Aside, Read-Through, Write-Through, Write-Back), cache invalidation dual-write race conditions, the Cache Stampede (Thundering Herd) failure mode, probabilistic early expiration via the XFetch algorithm, and Window TinyLFU (W-TinyLFU) frequency admission filtering.
- **Runnable Example**: [`examples/09-cache-xfetch.test.ts`](./examples/09-cache-xfetch.test.ts)

### [Module 10 — Encoding, Binary Serialization & Schema Evolution](./modules/10-encoding-serialization-and-schema-evolution.md)
- **Concepts**: Text vs. binary encoding formats, Variable-Length Quantity (Varint) 7-bit continuation masks, ZigZag signed integer bitwise mapping, Protocol Buffers wire types and field tags, Apache Avro tagless binary encoding and schema resolution, schema evolution compatibility rules (Backward, Forward, Full), and Schema Registries in distributed event streaming.
- **Runnable Example**: [`examples/10-schema-evolution.test.ts`](./examples/10-schema-evolution.test.ts)

### [Module 11 — Stream Processing, Event Logs & Compaction](./modules/11-stream-processing-and-event-logs.md)
- **Concepts**: The append-only commit log abstraction, consumer groups and partition assignment rebalancing (Eager vs. Incremental Cooperative), the Stream-Table Duality ($\text{Table} = \int \text{Stream} \, dt$), log compaction and tombstone retention windows, processing-time vs. event-time, Watermark progress tracking, and Exactly-Once Semantics (EOS).
- **Runnable Example**: [`examples/11-stream-table-duality.test.ts`](./examples/11-stream-table-duality.test.ts)

### [Module 12 — Architectural Decision Matrix, CAP/PACELC & Polyglot Persistence](./modules/12-architectural-decision-matrix-and-polyglot-persistence.md)
- **Concepts**: Workload taxonomy (OLTP vs. OLAP vs. HTAP), Brewer's CAP Theorem formal bounds, Abadi's PACELC classification (Spanner PC/EC vs. Cassandra/Dynamo PA/EL), the comprehensive architectural decision matrix, and polyglot persistence design patterns.
- **Runnable Examples**: All test suites (01–12)

---

## 2. Certifications & Exams

Data systems architecture is a foundational, vendor-neutral computer systems discipline. Evaluation in this field is anchored in two industry standards:

- **Academic Examination Rigor (CMU 15-445/645 & MIT 6.5840)**:
  - **Focus**: Algorithmic and mathematical mechanics of data models, relational algebra, B+Tree splits, mini-LSM compaction, buffer pool eviction (2Q/CLOCK), ARIES 3-pass crash recovery, MVCC snapshot isolation, and quorum consensus ($W + R > N$).
- **Staff / Principal Storage & Distributed Systems Technical Interview Loop**:
  - **Focus**: Real-world architectural trade-offs (RUM conjecture, CAP/PACELC), anomaly hierarchies (Berenson/Adya), cache stampede mitigation (XFetch), binary wire serialization (Varints, ZigZag, Avro/Protobuf schema evolution), and stream-table duality.

### Prerequisites
- Proficiency in systems programming or modern TypeScript/Node.js.
- Basic understanding of memory hierarchy (L1/L2/L3 caches, RAM, SSD NVMe, sequential vs random I/O).
- Familiarity with basic discrete mathematics (sets, relations, propositional logic, asymptotic analysis $O, \Omega, \Theta$).

### Out of Scope
- Specific cloud provider managed database console operations (AWS RDS/DynamoDB UI, Azure Cosmos DB portal).
- Language-specific Object-Relational Mapping (ORM) frameworks (Prisma, TypeORM, Hibernate) except where contrasting N+1 query patterns.

Full certification domain mappings and question banks:
- **[exams/README.md](./exams/README.md)**: Examination coverage matrix mapping all 12 domains to modules and executable tests with 100% full coverage (zero gaps).
- **[exams/interview.md](./exams/interview.md)**: 65 original technical interview questions across difficulty levels 1–3, with comprehensive explanations, distractor analysis, and a 60-minute full mock examination with scoring rubrics.

### [Module 09 — Caching Theory, Cache Stampedes & Invalidation](./modules/09-caching-theory-and-consistency.md)
- **Concepts**: Cache topologies (Cache-Aside, Read-Through, Write-Through, Write-Back), cache invalidation dual-write race conditions, the Cache Stampede (Thundering Herd) failure mode, probabilistic early expiration via the XFetch algorithm, and Window TinyLFU (W-TinyLFU) frequency admission filtering.
- **Runnable Example**: [`examples/09-cache-xfetch.test.ts`](./examples/09-cache-xfetch.test.ts)

### [Module 10 — Encoding, Binary Serialization & Schema Evolution](./modules/10-encoding-serialization-and-schema-evolution.md)
- **Concepts**: Text vs. binary encoding formats, Variable-Length Quantity (Varint) 7-bit continuation masks, ZigZag signed integer bitwise mapping, Protocol Buffers wire types and field tags, Apache Avro tagless binary encoding and schema resolution, schema evolution compatibility rules (Backward, Forward, Full), and Schema Registries in distributed event streaming.
- **Runnable Example**: [`examples/10-schema-evolution.test.ts`](./examples/10-schema-evolution.test.ts)

### [Module 11 — Stream Processing, Event Logs & Compaction](./modules/11-stream-processing-and-event-logs.md)
- **Concepts**: The append-only commit log abstraction, consumer groups and partition assignment rebalancing (Eager vs. Incremental Cooperative), the Stream-Table Duality ($\text{Table} = \int \text{Stream} \, dt$), log compaction and tombstone retention windows, processing-time vs. event-time, Watermark progress tracking, and Exactly-Once Semantics (EOS).
- **Runnable Example**: [`examples/11-stream-table-duality.test.ts`](./examples/11-stream-table-duality.test.ts)

### [Module 12 — Architectural Decision Matrix, CAP/PACELC & Polyglot Persistence](./modules/12-architectural-decision-matrix-and-polyglot-persistence.md)
- **Concepts**: Workload taxonomy (OLTP vs. OLAP vs. HTAP), Brewer's CAP Theorem formal bounds, Abadi's PACELC classification (Spanner PC/EC vs. Cassandra/Dynamo PA/EL), the comprehensive architectural decision matrix, and polyglot persistence design patterns.
- **Runnable Examples**: All test suites (01–12)

---

## 3. Fast-Lookup References & Glossaries

- **[GLOSSARY.md](./GLOSSARY.md)**: Authoritative English ↔ Czech bilingual glossary indexing core data systems concepts, formal definitions, and primary literature citations across all 12 domains.
- **[CHEATSHEET.md](./CHEATSHEET.md)**: High-density quick-reference sheet containing mathematical formulas, normal form checklists, ARIES recovery flowcharts, quorum inequalities, XFetch equations, and PACELC trade-off tables.

---

## 4. Running Verification Test Suites

All concepts in this track are accompanied by deterministic TypeScript verification test suites located in `examples/`. The test suites run hermetically without external database daemons or network dependencies.

```bash
# Pin and enter the hermetic toolchain via mise
cd architecture/data-systems
mise install

# Run all 12 test suites (31 unit, scenario, and property tests)
mise exec -- npm test

# Run static type verification
mise exec -- npm run typecheck
```
