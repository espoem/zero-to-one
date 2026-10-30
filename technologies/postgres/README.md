# PostgreSQL 18 Complete Curriculum & Systems Reference

> **Verified against PostgreSQL 18.6, PGlite 0.5.12, Node 26.12.1 on 2026-10-30**

Welcome to the **PostgreSQL 18 Complete Learning Track** (`PostgreSQL 18.6`, client tools, `pgvector`, Patroni, and automated test suite). This comprehensive curriculum delivers an end-to-end, zero-to-one engineering guide synthesized from official PostgreSQL documentation, developer curricula, EnterpriseDB (EDB) certification objectives, and staff-level database reliability engineering practices.

Every concept is backed by a numerically ordered module in [modules/](./modules/) with extensive SQL code examples, architecture blueprints, Mermaid flowcharts, and runnable verification suites in [examples/](./examples/).

---

## 1. Certifications & Exams

This track directly aligns with and prepares candidates for the official EnterpriseDB (EDB) PostgreSQL certification programs and recognized senior database engineering interview loops:

- **EnterpriseDB Certified Associate (EDB-CA-PG18)**:
  - **Vendor**: EnterpriseDB (EDB)
  - **Exam Guide**: [EnterpriseDB Training & Certification](https://www.enterprisedb.com/training)
  - **Target Version**: PostgreSQL 18.x
  - **Format**: 65 multiple-choice questions; 90 minutes; passing score 70%.
- **EnterpriseDB Certified Professional (EDB-CP-PG18)**:
  - **Vendor**: EnterpriseDB (EDB)
  - **Exam Guide**: [EnterpriseDB Training & Certification](https://www.enterprisedb.com/training)
  - **Target Version**: PostgreSQL 18.x
  - **Format**: Scenario-based, architectural, and operational troubleshooting examination; 90 minutes; passing score 70%.
- **Senior Database Reliability Engineer / DBA Technical Interview Loop**:
  - Anchored in CMU 15-445/645 (Database Systems), Kleppmann's *Designing Data-Intensive Applications* (DDIA), and production post-mortems from high-throughput OLTP clusters.

Full certification domain mappings and question banks:
- **[exams/README.md](./exams/README.md)**: Official exam coverage matrix mapping all 13 domains to modules and executable tests with 100% full coverage (zero gaps).
- **[exams/edb-postgres-associate-professional.md](./exams/edb-postgres-associate-professional.md)**: 65 original preparation questions across difficulty levels 1–3, with comprehensive explanations, distractor analysis, and a 90-minute full mock examination.

---

## 2. Curriculum Syllabus & Topic Breakdown

The curriculum is structured into 13 self-contained, progressive modules:

### [Module 01 — Architecture, Process Model, Memory & Storage Anatomy](./modules/01-architecture-process-memory-and-storage.md)
- **Concepts**: Client-server process model (`postmaster`, backends, auxiliary workers), shared memory (`shared_buffers`, `wal_buffers`, CLOG `pg_xact`), double buffering and OS page cache interactions, `$PGDATA` filesystem layout and relation forks (`main`, `_fsm`, `_vm`, `_init`), 8KB page binary anatomy (`PageHeaderData`, `ItemIdData`, `HeapTupleHeaderData`), inspection via `pageinspect`, default data checksums in PostgreSQL 18 `initdb`, Asynchronous I/O (AIO) subsystem (`io_method = worker / io_uring`), and psql command-line mastery.
- **Runnable Example**: [`examples/01-architecture-and-storage.ts`](./examples/01-architecture-and-storage.ts) (`npm run test:01`)

### [Module 02 — Relational Modeling, Data Types & Integrity Constraints](./modules/02-relational-modeling-types-and-constraints.md)
- **Concepts**: Financial arithmetic precision (`numeric` vs `float8`), timezone mechanics (`timestamptz` UTC normalization), native RFC 9562 `uuidv7()` in PostgreSQL 18, TOAST storage strategies (`PLAIN`, `EXTENDED`, `EXTERNAL`, `MAIN`) and compression algorithms (`pglz` vs `lz4`), PostgreSQL 18 Virtual Generated Columns (`VIRTUAL` vs `STORED`), the unindexed foreign key hazard, zero-downtime constraint validation (`NOT VALID` / `VALIDATE`), deferrable constraints, temporal constraints with SQL:2011 `WITHOUT OVERLAPS`, and modern identity columns.
- **Runnable Example**: [`examples/02-relational-modeling-and-constraints.ts`](./examples/02-relational-modeling-and-constraints.ts) (`npm run test:02`)

### [Module 03 — SQL Querying, Filtering, Joins & Mutations](./modules/03-sql-querying-filtering-and-joins.md)
- **Concepts**: Three-Valued Logic (3VL) and the `NOT IN (subquery)` NULL trap, null-safe equality (`IS DISTINCT FROM`), `DISTINCT ON (...)`, physical join execution algorithms (Nested Loop, Hash Join, Merge Join), correlated `LATERAL` joins, Keyset Pagination ($O(1)$ seek method) vs `OFFSET` degradation, atomic upserts (`ON CONFLICT` vs standard `MERGE`), and PostgreSQL 18 `RETURNING OLD / NEW` mutation auditing with JavaScript driver alias deduplication.
- **Runnable Example**: [`examples/03-sql-querying-and-joins.ts`](./examples/03-sql-querying-and-joins.ts) (`npm run test:03`)

### [Module 04 — Advanced SQL, CTEs, Window Functions & Analytics](./modules/04-advanced-sql-ctes-and-window-functions.md)
- **Concepts**: Common Table Expressions (CTEs), optimizer inlining vs the `AS MATERIALIZED` optimization fence, atomic multi-table pipelines via writable CTEs, recursive graph evaluation and SQL:2016 declarative `CYCLE` loop detection, sliding window frame mechanics (`ROWS`, `RANGE`, `GROUPS`), peer group evaluation hazards, frame exclusion clauses, analytical navigation (`LAG`, `LEAD`, `FIRST_VALUE`), PostgreSQL 19 `IGNORE NULLS`, multi-dimensional aggregation (`GROUPING SETS`, `ROLLUP`, `CUBE`), and aggregate `FILTER (WHERE ...)`.
- **Runnable Example**: [`examples/04-advanced-sql-ctes-and-window-functions.ts`](./examples/04-advanced-sql-ctes-and-window-functions.ts) (`npm run test:04`)

### [Module 05 — Semi-Structured Data, JSONB & Full-Text Search](./modules/05-json-jsonb-and-full-text-search.md)
- **Concepts**: `json` vs `jsonb` binary storage decomposition, JSONPath filtering expressions, standard `JSON_TABLE` projection, GIN indexing operator classes (`jsonb_ops` vs path-optimized `jsonb_path_ops`), Full-Text Search (FTS) linguistic pipeline (`to_tsvector`, `to_tsquery`, dictionaries, Snowball stemmers), relevance ranking (`ts_rank`, `ts_rank_cd`), phrase searching (`<->`), fuzzy substring matching with `pg_trgm`, and the architectural boundary for graduating to Elasticsearch.
- **Runnable Example**: [`examples/05-jsonb-and-full-text-search.ts`](./examples/05-jsonb-and-full-text-search.ts) (`npm run test:05`)

### [Module 06 — Indexing Strategies, Access Methods & Physical Storage](./modules/06-indexing-in-depth.md)
- **Concepts**: Lehman-Yao B-link tree high-concurrency algorithm (high keys and right links), B-tree deduplication, PostgreSQL 18 **B-Tree Skip Scans** for multi-column composite indexes, specialized access methods (GiST, SP-GiST, BRIN, Hash, Bloom), partial indexes, expression indexes with `IMMUTABLE` contracts, covering indexes (`INCLUDE`), Index-Only Scans and Visibility Map (`_vm`) dependencies, `CREATE INDEX CONCURRENTLY` failure modes (`INVALID` index traps), and index verification via `amcheck`.
- **Runnable Example**: [`examples/06-indexing-in-depth.ts`](./examples/06-indexing-in-depth.ts) (`npm run test:06`)

### [Module 07 — Query Optimization, Cost Model, EXPLAIN & Tuning](./modules/07-query-planning-cost-model-and-tuning.md)
- **Concepts**: Cost-based optimizer internals, Selinger Cost Model mathematical formulas (`seq_page_cost`, `random_page_cost`, `cpu_tuple_cost`), NVMe SSD parameter calibration (`random_page_cost = 1.1`), catalog statistics (`pg_stats`, MCVs, equi-depth histograms, correlation $r$), multivariate extended statistics (`CREATE STATISTICS`) solving correlated column traps, interpreting `EXPLAIN (ANALYZE, BUFFERS)` execution plans, prepared statement generic plan flips and parameter sniffing latency cliffs, JIT compilation thresholds and OLTP risks (default `off` in PG19), and PostgreSQL 19 `pg_plan_advice` plan pinning.
- **Runnable Example**: [`examples/07-query-planning-and-tuning.ts`](./examples/07-query-planning-and-tuning.ts) (`npm run test:07`)

### [Module 08 — Concurrency Control, MVCC Internals, Isolation & Locking](./modules/08-concurrency-mvcc-and-isolation.md)
- **Concepts**: MVCC version chains and tuple headers (`t_xmin`, `t_xmax`, `t_ctid`, `t_infomask`), Hint Bit mechanics (why `SELECT` writes dirty pages), transaction snapshots and ANSI isolation levels (Read Committed, Repeatable Read, Serializable Snapshot Isolation / SSI), Cahill-Rohm-Fekete theorem for anti-dependency cycles, the 8-level table lock hierarchy and the exhaustive 8x8 conflict matrix, catastrophic lock-queue pileups behind DDL and `lock_timeout` defenses, row-level locks (`FOR UPDATE`, `FOR NO KEY UPDATE`), non-blocking work queues with `FOR UPDATE SKIP LOCKED`, and advisory locks.
- **Runnable Example**: [`examples/08-concurrency-mvcc-and-locking.ts`](./examples/08-concurrency-mvcc-and-locking.ts) (`npm run test:08`)

### [Module 09 — Vacuum Internals, Freezing, Bloat Mitigation & Storage Reclamation](./modules/09-vacuum-freezing-and-bloat.md)
- **Concepts**: MVCC bloat mechanics, dead tuple accumulation, Free Space Map (`_fsm`) and Visibility Map (`_vm`), Heap-Only Tuples (HOT) intra-page updates and `fillfactor` tuning, autovacuum daemon activation mathematics and per-table aggressive configuration, 32-bit Transaction ID (XID) and MultiXact wraparound mathematical boundaries, emergency freeze scans, the three critical vacuum horizon blockers (long transactions, inactive replication slots, orphaned 2PC prepared transactions), PostgreSQL 18 partitioned maintenance semantics (`VACUUM (ONLY)`), and PostgreSQL 19 native `REPACK CONCURRENTLY`.
- **Runnable Example**: [`examples/09-vacuum-freezing-and-bloat.ts`](./examples/09-vacuum-freezing-and-bloat.ts) (`npm run test:09`)

### [Module 10 — Server Programming, Functions, Procedures & Security Architecture](./modules/10-server-programming-and-security.md)
- **Concepts**: PL/pgSQL procedural engine and structured exception handling, functions vs procedures (`CALL` with transaction `COMMIT`/`ROLLBACK`), function volatility contracts (`IMMUTABLE`, `STABLE`, `VOLATILE`), statement triggers with transition tables (`REFERENCING NEW TABLE`), role-based access control (RBAC) and default privileges (`ALTER DEFAULT PRIVILEGES`), neutralizing `SECURITY DEFINER` search-path hijacking vulnerabilities, multi-tenant Row-Level Security (RLS) policies with session contexts, `pg_hba.conf` rules, MD5 deprecation, and PostgreSQL 18 native OAuth 2.0 / OIDC JWT authentication.
- **Runnable Example**: [`examples/10-server-programming-and-security.ts`](./examples/10-server-programming-and-security.ts) (`npm run test:10`)

### [Module 11 — Partitioning, Connection Architecture, Drivers & Zero-Downtime Migrations](./modules/11-partitioning-connections-and-application-integration.md)
- **Concepts**: Declarative partitioning (Range, List, Hash), plan-time vs run-time partition pruning, zero-downtime `DETACH PARTITION CONCURRENTLY`, global uniqueness impossibility, time-series retention via partition drop vs `DELETE`, memory overhead of the process-per-connection model, PgBouncer pooling modes (Session vs Transaction pooling) and transaction-mode session leaks, connection protection timeouts (`idle_in_transaction_session_timeout`, `lock_timeout`), Extended Query Protocol (Parse, Bind, Execute), Node.js and Python driver pitfalls ($N+1$ queries, duplicate returning column collapse), and the Expand-Contract zero-downtime schema evolution pattern.
- **Runnable Example**: [`examples/11-partitioning-and-connections.ts`](./examples/11-partitioning-and-connections.ts) (`npm run test:11`)

### [Module 12 — Durability, Write-Ahead Logging, Backup & Point-In-Time Recovery](./modules/12-durability-backup-and-pitr.md)
- **Concepts**: Write-Ahead Logging (WAL) binary anatomy, Log Sequence Number (LSN) progression, torn-page protection and `full_page_writes` mechanics, checkpoint algorithm calibration (`max_wal_size`, `checkpoint_timeout`, `checkpoint_completion_target = 0.9`), logical backups (`pg_dump` directory format with `-j`), physical base backups (`pg_basebackup`), PostgreSQL 17+ native physical incremental backups (`pg_basebackup --incremental` / `pg_combinebackup`), continuous WAL archiving, Point-In-Time Recovery (PITR) step-by-step recovery drills, timeline branching ($TLI$), enterprise tooling (`pgBackRest`), and instant zero-downtime major version upgrades via `pg_upgrade --link` with PostgreSQL 18 retained optimizer statistics.
- **Runnable Example**: [`examples/12-durability-backup-and-pitr.ts`](./examples/12-durability-backup-and-pitr.ts) (`npm run test:12`)

### [Module 13 — High Availability, Replication, CDC, Extensions & Observability](./modules/13-high-availability-replication-and-extensions.md)
- **Concepts**: Physical streaming replication (`walsender`, `walreceiver`, startup process), synchronous commit modes (`off`, `local`, `remote_write`, `on`, `remote_apply`), quorum replication, the inactive replication slot disk-exhaustion hazard and `max_slot_wal_keep_size` defenses, logical replication (publish-subscribe) and Change Data Capture (CDC), PostgreSQL 17/18 **synchronized failover slots** (`sync_replication_slots`), PostgreSQL 19 sequence replication, automated split-brain-free clustering with Patroni and Raft consensus (`etcd`), client multi-host connection failover (`target_session_attrs=read-write`), read-your-writes consistency with PostgreSQL 19 `WAIT FOR LSN`, AI vector similarity search using `pgvector` (HNSW vs IVFFlat), and production telemetry with `pg_stat_statements`, `pg_stat_io`, wait events, and lock blocking diagnostics.
- **Runnable Example**: [`examples/13-replication-ha-and-extensions.ts`](./examples/13-replication-ha-and-extensions.ts) (`npm run test:13`)

---

## 3. Fast Lookup Reference & Terminology

- **[CHEATSHEET.md](./CHEATSHEET.md)**: Syntax snippets, operators, DDL templates, DML patterns, JSONB operations, and EXPLAIN configurations.
- **[GLOSSARY.md](./GLOSSARY.md)**: Comprehensive bilingual English ↔ Czech terminology index adhering to repository standards.

---

## 4. Quick Start & Runnable Environment

### Option A: Running the Hermetic In-Process Test Suite (PGlite / Node 26)
```bash
# Pin and install dependencies
mise install
npm install

# Run type check
npm run typecheck

# Run all 13 verified test suites
npm test

# Run a specific module test suite
npm run test:01
npm run test:02
# ... up to
npm run test:13
```

### Option B: Running with Docker Compose (PostgreSQL 18)
```bash
# Start PostgreSQL 18 cluster with health check
docker compose up -d

# Connect via psql
psql "postgresql://postgres:postgrespassword@localhost:5432/training_db"

# Run integration tests against the live container
npm run test:integration
```
