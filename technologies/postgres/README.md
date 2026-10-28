# PostgreSQL 18 Complete Curriculum & Systems Reference

Welcome to the **PostgreSQL 18 Complete Learning Track** (`PostgreSQL 18.6`, client tools, `pgvector`, Patroni, and automated test suite). This comprehensive curriculum delivers an end-to-end, zero-to-one engineering guide synthesized from official PostgreSQL documentation, developer curricula (Dometrain, IT Genius), DBA training standards (Ambient IT, Koenig Solutions, Mindmajix), and hands-on production workshops (Snowflake-Labs).

Every concept is backed by a numerically ordered module in [modules/](./modules/) with extensive SQL code examples, architecture blueprints, Mermaid flowcharts, and runnable verification suites in [examples/](./examples/).

---

## 1. Curriculum Syllabus & Topic Breakdown

The curriculum is structured into 10 self-contained, progressive modules:

### [Module 01 — Architecture, Process, Memory & Setup](./modules/01-architecture-process-memory-and-setup.md)
- **Concepts**: Client-server process model (`postmaster`, backends, workers), memory architecture (`shared_buffers`, `work_mem`, `maintenance_work_mem`), PostgreSQL 18 Asynchronous I/O (AIO) subsystem (`io_uring`/POSIX AIO), disk storage layout (8KB pages, FSM, VM), `initdb` with checksums enabled by default, `pg_hba.conf`, SCRAM-SHA-256, PostgreSQL 18 OAuth 2.0 / OpenID Connect authentication, Docker Compose setup, and `psql` command-line mastery.
- **Runnable Example**: [`examples/01-architecture-and-connection.ts`](./examples/01-architecture-and-connection.ts) / `.sql` (`npm run test:01`)

### [Module 02 — Relational Modeling, Types & Constraints](./modules/02-relational-modeling-types-and-constraints.md)
- **Concepts**: PostgreSQL type system, IEEE 754 vs `numeric`, text types, timestamps with time zone, native `uuidv7()` in PostgreSQL 18 (timestamp-ordered, index-friendly), array and composite types, PostgreSQL 18 Virtual Generated Columns (`GENERATED ALWAYS AS (...) VIRTUAL`) vs Stored columns, Primary & Foreign Keys with referential cascade rules, Check and Domain constraints, Identity columns, and PostgreSQL 18 Temporal Constraints with `PERIOD FOR ... WITHOUT OVERLAPS`.
- **Runnable Example**: [`examples/02-relational-modeling-and-constraints.ts`](./examples/02-relational-modeling-and-constraints.ts) / `.sql` (`npm run test:02`)

### [Module 03 — Modern SQL Querying, Filtering & Joins](./modules/03-sql-querying-filtering-and-joins.md)
- **Concepts**: Projections, aliases, `DISTINCT` vs `DISTINCT ON (...)`, predicate filtering, pattern matching (`LIKE`, `ILIKE`, POSIX regex), pagination with `NULLS FIRST/LAST` and ANSI `FETCH FIRST`, set operators (`UNION ALL`, `INTERSECT`, `EXCEPT`), relational join algebra (Inner, Left, Right, Full Outer, Cross, Natural, Self joins), join execution algorithms (Nested Loop, Hash Join, Merge Join), multi-dimensional aggregations (`GROUPING SETS`, `ROLLUP`, `CUBE`), conditional logic (`CASE`, `COALESCE`, `NULLIF`), subqueries (scalar, correlated, `EXISTS`, `ANY/ALL`), and DML with PostgreSQL 18 `RETURNING OLD.col, NEW.col`.
- **Runnable Example**: [`examples/03-sql-querying-and-joins.ts`](./examples/03-sql-querying-and-joins.ts) / `.sql` (`npm run test:03`)

### [Module 04 — Advanced SQL: CTEs & Window Functions](./modules/04-advanced-sql-ctes-and-window-functions.md)
- **Concepts**: Common Table Expressions (`WITH`), materialized vs non-materialized CTEs, data-modifying writable CTEs chaining DML operations atomically, recursive CTEs (anchor, recursive member, termination), cycle detection with `CYCLE`, series generation (`generate_series`), window functions (`OVER`, `PARTITION BY`, `ORDER BY`), ranking (`ROW_NUMBER`, `RANK`, `DENSE_RANK`), offset and value functions (`LAG`, `LEAD`, `FIRST_VALUE`, `NTH_VALUE`), and sliding window frame specifications (`ROWS`, `RANGE`, `GROUPS`, running totals, moving averages).
- **Runnable Example**: [`examples/04-advanced-sql-ctes-and-window-functions.ts`](./examples/04-advanced-sql-ctes-and-window-functions.ts) / `.sql` (`npm run test:04`)

### [Module 05 — Semi-Structured Data: JSON/JSONB & Full-Text Search](./modules/05-json-jsonb-and-full-text-search.md)
- **Concepts**: `json` vs `jsonb` binary storage, extraction operators (`->`, `->>`, `#>`, `#>>`), containment and existence operators (`@>`, `?`, `?|`, `?&`), JSON mutation functions (`jsonb_set`, `jsonb_insert`), SQL/JSON path queries (`jsonb_path_query`), GIN indexing with `jsonb_ops` and `jsonb_path_ops`, Full-Text Search (FTS) engine, text normalization (`to_tsvector`), query lexing (`to_tsquery`), stemming, ranking (`ts_rank`, `ts_rank_cd`), and phrase searching.
- **Runnable Example**: [`examples/05-jsonb-and-full-text-search.ts`](./examples/05-jsonb-and-full-text-search.ts) / `.sql` (`npm run test:05`)

### [Module 06 — Concurrency, Transactions & MVCC Internals](./modules/06-concurrency-transactions-and-mvcc.md)
- **Concepts**: ACID guarantees, Multi-Version Concurrency Control (MVCC) mechanics, tuple headers (`t_xmin`, `t_xmax`, `t_ctid`, `t_infomask`), transaction snapshots, transaction isolation levels (Read Committed, Repeatable Read, Serializable Snapshot Isolation / SSI), concurrency anomalies (Dirty Read, Non-Repeatable Read, Phantom Read, Write Skew), explicit table and row locks (`FOR UPDATE`, `FOR SHARE`), non-blocking queues with `SKIP LOCKED`, deadlock resolution, and application advisory locks (`pg_advisory_lock`).
- **Runnable Example**: [`examples/06-concurrency-and-mvcc.ts`](./examples/06-concurrency-and-mvcc.ts) / `.sql` (`npm run test:06`)

### [Module 07 — Query Planning, Indexing Strategies & Tuning](./modules/07-query-planning-indexing-and-tuning.md)
- **Concepts**: Cost-based optimizer internals, parsing and rewrite lifecycle, reading `EXPLAIN (ANALYZE, BUFFERS, SETTINGS)`, scan types (Seq Scan, Index Scan, Index Only Scan, Bitmap Scan), index access methods (B-tree, Hash, GIN, GiST, BRIN), PostgreSQL 18 B-tree Skip Scan for multi-column indexes, partial indexes, expression indexes, covering indexes (`INCLUDE`), PostgreSQL 18 Asynchronous I/O acceleration, and memory sizing parameters (`shared_buffers`, `work_mem`, `effective_cache_size`).
- **Runnable Example**: [`examples/07-query-planning-and-indexing.ts`](./examples/07-query-planning-and-indexing.ts) / `.sql` (`npm run test:07`)

### [Module 08 — Administration, Maintenance & Upgrades](./modules/08-administration-maintenance-and-upgrades.md)
- **Concepts**: MVCC bloat lifecycle, dead tuple accumulation, Autovacuum daemon tuning, PostgreSQL 18 cascading VACUUM and ANALYZE across partitioned tables, extended multi-column statistics (`CREATE STATISTICS`), activity and query monitoring (`pg_stat_activity`, `pg_stat_statements`), connection pooling architectures (PgBouncer transaction/session pooling vs Pgpool-II), `pg_upgrade` mechanics with PostgreSQL 18 optimizer statistics preservation, and high-throughput bulk ingestion via `COPY`.
- **Runnable Example**: [`examples/08-maintenance-and-statistics.ts`](./examples/08-maintenance-and-statistics.ts) / `.sql` (`npm run test:08`)

### [Module 09 — Backup, Point-In-Time Recovery & Migration](./modules/09-backup-pitr-and-migration.md)
- **Concepts**: Logical backups (`pg_dump`, `pg_dumpall`, directory format, parallel restore `pg_restore -j`), physical backups (`pg_basebackup`), Write-Ahead Log (WAL) mechanics, LSN progression, WAL archiving (`archive_command`, `archive_library`), Point-In-Time Recovery (PITR) configuration (`recovery.signal`, `restore_command`, `recovery_target_time`), timeline history branching, and heterogeneous Oracle-to-PostgreSQL migration strategies (data type translations, triggers, sequences, ora2pg).
- **Runnable Example**: [`examples/09-backup-pitr-and-migration.ts`](./examples/09-backup-pitr-and-migration.ts) / `.sql` (`npm run test:09`)

### [Module 10 — High Availability, Replication & Modern Extensions](./modules/10-high-availability-replication-and-extensions.md)
- **Concepts**: Physical streaming replication (Primary-Standby, synchronous commit levels `remote_apply`), physical replication slots, logical replication (publish-subscribe, logical failover slots in PostgreSQL 18), enterprise automated clustering with Patroni and etcd, Row-Level Security (RLS) policies for multi-tenancy, asynchronous event messaging (`LISTEN`/`NOTIFY`), extension ecosystem (`CREATE EXTENSION`), and `pgvector` for AI embeddings (vector distances `<=>`, `<->`, `<#>`, HNSW and IVFFlat index tuning).
- **Runnable Example**: [`examples/10-ha-replication-and-pgvector.ts`](./examples/10-ha-replication-and-pgvector.ts) / `.sql` (`npm run test:10`)

---

## 2. Fast Lookup Reference & Terminology

- **[CHEATSHEET.md](./CHEATSHEET.md)**: Syntax snippets, operators, DDL templates, DML patterns, JSONB operations, and EXPLAIN configurations.
- **[GLOSSARY.md](./GLOSSARY.md)**: Comprehensive bilingual English ↔ Czech terminology index adhering to repository standards.

---

## 3. Quick Start & Runnable Environment

### Option A: Running with Docker Compose (PostgreSQL 18)
```bash
# Start PostgreSQL 18 cluster with health check
docker compose up -d

# Connect via psql
psql "postgresql://postgres:postgrespassword@localhost:5432/training_db"
```

### Option B: Running the Native Test Suite (In-Process WASM / Node.js)
```bash
# Install dependencies
npm install

# Run type check
npm run typecheck

# Run all verification test suites
npm test

# Run a specific module test suite
npm run test:01
npm run test:02
```
