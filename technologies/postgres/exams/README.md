# PostgreSQL 18 Certification & Exam Coverage Matrix

This directory contains the certification preparation question bank, exam domain mapping, and full mock examination for PostgreSQL 18.

---

## 1. Targeted Certifications & Industry Standards

PostgreSQL is an open-source project without a single vendor-neutral foundation certification. Professional certification and hiring evaluation are anchored in:

1. **EnterpriseDB (EDB) PostgreSQL Associate & Professional Certification**:
   - **Vendor**: EnterpriseDB (EDB)
   - **Exam Codes**: EDB-CA-PG18 (Certified Associate), EDB-CP-PG18 (Certified Professional)
   - **Official Exam Guide**: [EnterpriseDB Training & Certification](https://www.enterprisedb.com/training)
   - **Target Version**: PostgreSQL 18.x (with historical coverage of PG15–17)
   - **Format**: 65 multiple-choice, scenario-based, and architectural questions; 90 minutes; passing score 70%.
2. **Senior Database Reliability Engineer / PostgreSQL DBA Technical Interview Loop**:
   - Anchored in CMU 15-445/645 (Database Systems), Kleppmann's *Designing Data-Intensive Applications* (DDIA), and production post-mortems from high-throughput deployments.

---

## 2. Exam Domain Coverage Matrix

| Domain # | Domain / Objective | Weight | Primary Module | Executable Proof | Status |
| :-: | :--- | :-: | :--- | :--- | :-: |
| **01** | Architecture, Process Engine & Shared Memory | 8% | [01-architecture-process-memory-and-storage.md](../modules/01-architecture-process-memory-and-storage.md) | [01-architecture-and-storage.ts](../examples/01-architecture-and-storage.ts) | ✅ Full |
| **02** | Relational Modeling, Types, TOAST & Constraints | 9% | [02-relational-modeling-types-and-constraints.md](../modules/02-relational-modeling-types-and-constraints.md) | [02-relational-modeling-and-constraints.ts](../examples/02-relational-modeling-and-constraints.ts) | ✅ Full |
| **03** | SQL Querying, Joins, 3VL & Mutations | 8% | [03-sql-querying-filtering-and-joins.md](../modules/03-sql-querying-filtering-and-joins.md) | [03-sql-querying-and-joins.ts](../examples/03-sql-querying-and-joins.ts) | ✅ Full |
| **04** | Advanced SQL, CTEs, Window Functions & Analytics | 7% | [04-advanced-sql-ctes-and-window-functions.md](../modules/04-advanced-sql-ctes-and-window-functions.md) | [04-advanced-sql-ctes-and-window-functions.ts](../examples/04-advanced-sql-ctes-and-window-functions.ts) | ✅ Full |
| **05** | Semi-Structured Data, JSONB & Full-Text Search | 7% | [05-json-jsonb-and-full-text-search.md](../modules/05-json-jsonb-and-full-text-search.md) | [05-jsonb-and-full-text-search.ts](../examples/05-jsonb-and-full-text-search.ts) | ✅ Full |
| **06** | Indexing Strategies, Access Methods & Storage | 9% | [06-indexing-in-depth.md](../modules/06-indexing-in-depth.md) | [06-indexing-in-depth.ts](../examples/06-indexing-in-depth.ts) | ✅ Full |
| **07** | Query Optimization, Cost Model, EXPLAIN & Tuning | 9% | [07-query-planning-cost-model-and-tuning.md](../modules/07-query-planning-cost-model-and-tuning.md) | [07-query-planning-and-tuning.ts](../examples/07-query-planning-and-tuning.ts) | ✅ Full |
| **08** | Concurrency Control, MVCC Internals & Locking | 9% | [08-concurrency-mvcc-and-isolation.md](../modules/08-concurrency-mvcc-and-isolation.md) | [08-concurrency-mvcc-and-locking.ts](../examples/08-concurrency-mvcc-and-locking.ts) | ✅ Full |
| **09** | Vacuum Internals, Freezing & Bloat Mitigation | 8% | [09-vacuum-freezing-and-bloat.md](../modules/09-vacuum-freezing-and-bloat.md) | [09-vacuum-freezing-and-bloat.ts](../examples/09-vacuum-freezing-and-bloat.ts) | ✅ Full |
| **10** | Server Programming, RBAC & Security Architecture | 8% | [10-server-programming-and-security.md](../modules/10-server-programming-and-security.md) | [10-server-programming-and-security.ts](../examples/10-server-programming-and-security.ts) | ✅ Full |
| **11** | Partitioning, Connection Architecture & Pooling | 9% | [11-partitioning-connections-and-application-integration.md](../modules/11-partitioning-connections-and-application-integration.md) | [11-partitioning-and-connections.ts](../examples/11-partitioning-and-connections.ts) | ✅ Full |
| **12** | Durability, WAL, Backup & PITR | 9% | [12-durability-backup-and-pitr.md](../modules/12-durability-backup-and-pitr.md) | [12-durability-backup-and-pitr.ts](../examples/12-durability-backup-and-pitr.ts) | ✅ Full |
| **13** | High Availability, Replication, Extensions & Telemetry | 10% | [13-high-availability-replication-and-extensions.md](../modules/13-high-availability-replication-and-extensions.md) | [13-replication-ha-and-extensions.ts](../examples/13-replication-ha-and-extensions.ts) | ✅ Full |

---

## 3. Exam Deltas & Version Callouts

### PostgreSQL 17 vs. PostgreSQL 18 Exam Deltas
- **Synchronized Failover Slots**: Older study guides often mislabel synchronized failover slots as a PostgreSQL 18 feature. **Failover slots and `sync_replication_slots` arrived in PostgreSQL 17**. PostgreSQL 18 enhanced slot synchronization with dedicated monitoring catalog views and tuning parameters.
- **UUID Generation**: In PostgreSQL $\le$ 17, `uuidv4()` was supported natively, but UUIDv7 required extensions. PostgreSQL 18 introduces native RFC 9562 `uuidv7()`.
- **Generated Columns**: PostgreSQL $\le$ 17 supported only `STORED` generated columns. PostgreSQL 18 adds `VIRTUAL` generated columns.
- **Data Checksums**: PostgreSQL 18 enables cluster data block checksums by default in `initdb`.
- **Authentication**: PostgreSQL 18 officially deprecates MD5 password hashing with server warnings, requiring `scram-sha-256`, and adds native OAuth 2.0 / OIDC JWT authentication.
- **Upgrades**: PostgreSQL 18 preserves optimizer statistics (`pg_statistic`) during `pg_upgrade --link`.

### PostgreSQL 18 vs. PostgreSQL 19 Forward Deltas
- **`VACUUM FULL` vs `REPACK`**: PostgreSQL 19 introduces native `REPACK` / `REPACK CONCURRENTLY`, replacing the table-locking `VACUUM FULL`.
- **Standby Consistency**: PostgreSQL 19 introduces `WAIT FOR LSN` to guarantee read-your-writes on read replicas.
- **Plan Stability**: PostgreSQL 19 introduces `pg_plan_advice` for native plan pinning.
- **JIT Default**: PostgreSQL 19 changes the default setting of `jit` to `off`.
- **TOAST Compression**: PostgreSQL 19 changes the default TOAST compression algorithm cluster-wide to `lz4`.

---

## 4. Question Bank Navigation

The complete preparation question bank, categorized by domain and difficulty (1–3), is available in:
- [edb-postgres-associate-professional.md](./edb-postgres-associate-professional.md) — 65 rigorous examination questions with detailed explanations, distractor analysis, and a full mock exam.
