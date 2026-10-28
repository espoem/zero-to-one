# B — Data tracks: PostgreSQL, SQLite (+Turso/libSQL), Redis, Elasticsearch, and the shared `architecture/data-systems` foundation

Research date: 2026-10-28. Claims marked "(verified locally)" were checked in this sandbox by running real code (Node 22.23, npm registry as of today). Claims marked "(unverified)" could not be confirmed against a primary source.

**Main findings:**
1. **PGlite 0.5.12 runs PostgreSQL 18.6** (verified locally with `select version()`: `PostgreSQL 18.6 (PGlite 0.5.12) on wasm32-unknown-emscripten … 32-bit`). The existing track's PG18 claim and its PGlite use are consistent. However, `io_method` reports `sync`, so **AIO cannot be demonstrated in PGlite**.
2. **PostgreSQL 19 RC1 came out on 2026-10-15.** GA is likely within weeks, so the PG track needs a "PG19 delta" plan now: `REPACK`, `WAIT`, `pg_plan_advice`, JIT off by default, lz4 TOAST by default.
3. **libSQL is now labelled "Legacy" by Turso.** Its embedded engine reports **SQLite 3.45.1** (verified locally), while upstream SQLite is at **3.54.x**. The Rust "Turso Database" is at **v0.8.3**, still 0.x.
4. **Redis is at 8.10.x**, under the RSALv2/SSPLv1/AGPLv3 tri-license since 8.0. Valkey is at 9.1.x, with 9.2.0-rc1 out.
5. **Elasticsearch is at 9.5.x.** The Elastic Certified Engineer exam is still pinned to **8.1** (third-party source).

---

### PostgreSQL — `technologies/postgres` (EXISTING)

- **Current stable version(s)**
  - **18.6** (with 17.11, 16.15, 15.19 and 14.24), all released **2026-08-13**: https://www.postgresql.org/ (release notes: https://www.postgresql.org/docs/18/release-18-6.html).
  - 18.0 GA was 2025-09-25 (unverified exact day; it was Sept 2025).
  - Earlier 2026 minors: 18.2 in Feb (https://aws.amazon.com/about-aws/whats-new/2026/02/rds-minor-version-18-2-17-8-16-12-15-16-14-21), 18.3 out-of-cycle in Feb/Mar (https://www.postgresql.org/about/news/postgresql-183-179-1613-1517-and-1422-released-3246), and 18.4.
  - **PostgreSQL 14 reaches EOL on 2026-11-12.**
  - **PostgreSQL 19 RC1 released 2026-10-15**; GA date TBD (https://www.postgresql.org/docs/19/release-19.html). PG19 headliners:
    - `REPACK` (and `REPACK CONCURRENTLY`), which replaces `VACUUM FULL`/`CLUSTER`
    - `WAIT` for an LSN on standbys (read-your-writes)
    - `pg_plan_advice` and `pg_stash_advice` (plan pinning)
    - logical replication of sequences; logical replication enabled without restart (`effective_wal_level`)
    - parallel index vacuuming in autovacuum, plus autovacuum scoring (`pg_stat_autovacuum_scores`)
    - auto-scaling I/O workers (`io_min_workers`/`io_max_workers`)
    - `NOT IN` turned into an anti-join
    - `IGNORE NULLS` for window functions
    - `INSERT … ON CONFLICT DO SELECT … RETURNING`
    - `COPY TO` JSON output
    - **Default changes:** JIT off, default TOAST compression `lz4`, `log_lock_waits` on, `max_locks_per_transaction` = 128, RADIUS auth removed.
  - Tooling (verified locally against the npm registry today): `@electric-sql/pglite` **0.5.12** (PG 18.6); `testcontainers` / `@testcontainers/postgresql` **12.2.1**. Docker image `postgres:18.6` (tag assumed per Docker Hub convention; unverified).

- **Authoritative syllabi used**
  - Official docs ToC (Parts I–VIII: Tutorial, SQL Language, Server Administration, Client Interfaces, Server Programming, Internals): https://www.postgresql.org/docs/18/
  - PG18 release notes and PG19 release notes (above).
  - CMU 15-445/645 *Intro to Database Systems* (Pavlo): https://15445.courses.cs.cmu.edu/ — for storage, buffer pool, indexing, concurrency control and recovery theory.
  - *The Internals of PostgreSQL* (Suzuki): https://www.interdb.jp/pg/
  - EDB PostgreSQL certification (EDB Certified Associate / Professional): https://www.enterprisedb.com/training (domain weights not published; unverified).
  - pgvector README: https://github.com/pgvector/pgvector
  - No vendor-neutral certification exists for PostgreSQL. Interview prep comes from the docs, CMU 15-445 and DDIA.

- **Gap analysis vs existing** (based on the 10 module headings at lines 840–1072 of `existing-syllabi.txt`; modules are 229–503 lines each)
  - **Verified correct (no change needed):** `uuidv7()`, `VIRTUAL` generated columns, `WITHOUT OVERLAPS`, `RETURNING OLD/NEW`, and B-tree skip scan are PG18 features. The first four were executed successfully in PGlite 0.5.12 (verified locally). OAuth auth and `pg_upgrade` statistics retention are also PG18.
  - **Outdated or suspicious claims to fix:**
    - **M10 "PostgreSQL 18 Synchronized Logical Replication Failover Slots":** failover slots and `sync_replication_slots` arrived in **PG17**, not 18. Re-label it as "PG17+", then add what PG18 actually changed (unverified specifics; check the PG18 release notes, "Logical replication" section).
    - **M08 "PostgreSQL 18 Cascading Maintenance for Partitioned Tables":** what PG18 added is `VACUUM/ANALYZE ONLY` on a partitioned parent. "Cascading" may misdescribe this. Rewrite it against the PG18 release notes (unverified wording in module).
    - **M01/M07 AIO:** PG18's default is `io_method=worker`, and `io_uring` is Linux-only. The examples cannot prove AIO in PGlite (`io_method` = `sync`, verified locally) or on macOS (no io_uring). Mark that section as "docker compose on a Linux VM only", and add the PG19 worker auto-scaling delta.
    - **M07 EXPLAIN:** PG18 `EXPLAIN ANALYZE` includes `BUFFERS` by default (unverified; it is in the PG18 release notes as I recall). Check the module's guidance.
    - **M01 security:** PG18 deprecates MD5 password auth (it warns), and `initdb` enables **data checksums by default** (unverified, from PG18 notes as I recall). Both are relevant to M01/M08.
    - **M09 "Oracle to PostgreSQL":** off-target for the user's stack. Move it to an appendix and replace it with MySQL/SQLite→PG and ORM-migration tooling.
    - **PG19 forward-compat callouts are needed:** M08 (`VACUUM FULL` → `REPACK`), M10 (`WAIT` for read-your-writes), M07 (`pg_plan_advice`, JIT default off), M02 (TOAST lz4 default).
  - **Missing topics** (the 10 modules skip these entirely):
    1. **Index types beyond B-tree/GIN:** GiST, SP-GiST, BRIN, hash, bloom; partial, expression and covering (`INCLUDE`) indexes; `CREATE INDEX CONCURRENTLY` failure leaving INVALID indexes; index-only scans and the visibility map.
    2. **Declarative partitioning as a full topic:** range/list/hash, partition pruning (plan time vs run time), detach `CONCURRENTLY`, default partition pitfalls, global uniqueness impossibility, time-series retention by drop.
    3. **Server programming:** PL/pgSQL, functions vs procedures, volatility categories (`IMMUTABLE` lies break indexes), triggers (row/statement/transition tables), event triggers, `SECURITY DEFINER` + `search_path` hijack.
    4. **Roles, privileges and default privileges:** `GRANT`, `pg_read_all_data`, schema `public` CREATE revoked since PG15, `ALTER DEFAULT PRIVILEGES`. Only RLS is currently covered.
    5. **Connection pooling as practice:** PgBouncer modes and prepared statements support (PgBouncer ≥1.21), `max_connections` math, `idle_in_transaction_session_timeout`, statement and lock timeouts.
    6. **Client side, from the user's stack:** node-postgres/postgres.js, extended protocol, prepared statement caching, pipelining, `LISTEN` in pools, Python psycopg 3, ORMs (Drizzle/Prisma) and the N+1 problem.
    7. **Observability depth:** `pg_stat_io` (PG16+), wait events, `pg_locks` + `pg_blocking_pids()`, `auto_explain`, log_line_prefix, bloat estimation, `pg_stat_progress_*`.
    8. **Logical decoding/CDC:** `pgoutput`, `wal2json`, Debezium, the outbox pattern; replication slot WAL retention (`max_slot_wal_keep_size`).
    9. **Sequences/identity columns:** gaps, `CACHE`, identity vs serial.
    10. **Constraints:** `NOT VALID` + `VALIDATE`, deferrable constraints, exclusion constraints in general (not only temporal).
    11. **Backup tooling:** pgBackRest/Barman/WAL-G, PG17 incremental `pg_basebackup` + `pg_combinebackup`, checksums.
    12. **FDW and extensions ecosystem:** postgres_fdw, pg_partman, pg_cron, PostGIS, TimescaleDB/Citus pointers.
    13. **Testing patterns:** transactional test isolation, template databases, PGlite vs testcontainers trade-offs.
  - **Restructure:**
    - **M06 MVCC (311 lines) is too thin.** It must carry the visibility rules, snapshot (`xmin/xmax/xip`) and hint bits, plus the vacuum interplay now split into M08. Split it: "MVCC & isolation" / "Locking".
    - **M10 is a grab bag** (HA + RLS + LISTEN/NOTIFY + pgvector). Split it into "Replication & HA", "Security (roles, RLS, auth)" and "Extensions: pgvector, PostGIS, FTS vs Elasticsearch".
    - Move normalization theory, isolation anomalies theory, B-link tree theory, ARIES and consensus to `architecture/data-systems`. Keep the PG-specific mechanics here and cross-link the theory.
    - Target 13 modules (below), each around 600–900 lines with an examples suite.

- **Proposed modules** (13; restructure of the existing 10)
  1. **Architecture & setup:** postmaster/backends, background workers, shared memory and `shared_buffers` vs OS cache, `$PGDATA`, 8KB page anatomy (proved with `pageinspect`), psql fluency, mise + compose lab.
  2. **Relational modeling, types & constraints:** numeric/float, timestamptz, `uuidv7()`, TOAST (lz4 in PG19), generated columns (virtual vs stored), FKs + unindexed-FK hazard, `NOT VALID`, deferrable constraints, exclusion/temporal constraints, identity/sequences.
  3. **SQL querying:** 3VL/NULL, `DISTINCT ON`, `LATERAL`, set/bag semantics, keyset pagination, upsert, `MERGE`, `RETURNING OLD/NEW`, PG19 `ON CONFLICT DO SELECT`.
  4. **Advanced SQL:** CTE inlining/`MATERIALIZED`, writable CTEs, recursive CTE + `CYCLE`, window frames (`ROWS/RANGE/GROUPS`, PG19 `IGNORE NULLS`), `GROUPING SETS`.
  5. **Semi-structured data & search:** jsonb internals, SQL/JSON (`JSON_TABLE`, `JSON_QUERY`), jsonpath, GIN opclasses, FTS (`tsvector`, ranking), `pg_trgm`. Includes "when to graduate to Elasticsearch".
  6. **Indexing in depth:** B-tree (dedup, skip scan, B-link), GiST/SP-GiST/BRIN/hash/bloom, partial/expression/covering, index-only scans + visibility map, `CREATE INDEX CONCURRENTLY` failure modes, `amcheck`.
  7. **Query planning & EXPLAIN:** cost model, statistics/extended stats, join algorithms, `EXPLAIN (ANALYZE, BUFFERS)` reading, plan instability, generic vs custom plans for prepared statements, JIT, PG19 `pg_plan_advice`.
  8. **MVCC, isolation & locking:** tuple header (`xmin/xmax/ctid` via `pageinspect`), snapshots, Read Committed vs Repeatable Read vs SSI, write skew, lock matrix, row locks/MultiXacts, `SKIP LOCKED` queues, deadlocks, advisory locks, lock-queue pileups behind DDL.
  9. **Vacuum, freezing & bloat:** autovacuum math, XID/MultiXact wraparound, HOT + fillfactor, bloat measurement, `VACUUM FULL` → PG19 `REPACK`, long-transaction/slot/prepared-xact horizon blockers.
  10. **Server programming & security:** PL/pgSQL, functions/procedures, volatility, triggers, roles and default privileges, RLS, `SECURITY DEFINER`/`search_path`, `pg_hba`/SCRAM/OAuth (PG18), TLS.
  11. **Partitioning, connections & application integration:** declarative partitioning and pruning, PgBouncer/transaction pooling caveats, Node/Python drivers, timeouts, ORMs, zero-downtime migrations (expand/contract, lock_timeout + retries).
  12. **Durability, backup & PITR:** WAL, checkpoints, `full_page_writes`, fsync semantics, pgBackRest/WAL-G, PG17 incremental backup, timelines, PITR drill, `pg_upgrade`, logical dump/restore.
  13. **Replication, HA & CDC:** streaming replication, sync commit levels, slots and WAL retention, logical replication (PG19 sequences), Patroni/etcd, failover/split brain, read-your-writes (PG19 `WAIT`), logical decoding to Debezium/outbox. Appendix covers extensions (pgvector HNSW/IVFFlat, PostGIS, pg_cron, Citus/Timescale) and observability (`pg_stat_statements`, `pg_stat_io`, wait events).

- **Gotchas & production failure modes**
  1. `ALTER TABLE` waiting on `ACCESS EXCLUSIVE` behind one long `SELECT` blocks **all** later queries (lock queue). Fix: `SET lock_timeout` + retry.
  2. `CREATE INDEX CONCURRENTLY` failure leaves an `INVALID` index that still costs writes. Detect it with `pg_index.indisvalid`.
  3. Idle-in-transaction sessions, abandoned replication slots or orphaned prepared transactions pin `xmin`. The result is unbounded bloat and wraparound risk.
  4. An inactive logical slot retains WAL until the disk fills. Set `max_slot_wal_keep_size`.
  5. An unindexed FK on the child table means `DELETE` on the parent causes seq scans and lock amplification.
  6. Transaction-mode PgBouncer breaks session state: `SET`, advisory locks, `LISTEN`, temp tables, and (pre-1.21 PgBouncer or with disabled support) named prepared statements.
  7. Generic plan flip after 5 executions of a prepared statement, giving a sudden latency cliff on skewed data. `plan_cache_mode`.
  8. Correlated columns cause row misestimates and nested-loop disasters. `CREATE STATISTICS`.
  9. `OFFSET` pagination is O(n) and returns duplicates or skips under concurrent writes.
  10. `NOT IN (subquery)` with a NULL returns zero rows (PG19 only rewrites it to anti-join when NULLs are provably absent).
  11. Mislabelled `IMMUTABLE` function in an expression index gives a silently stale or corrupt index.
  12. Serializable transactions without a retry loop: 40001 errors surface to users.
  13. `max_connections` too high: per-backend memory × `work_mem` × sort nodes leads to the OOM killer, then a crash restart of every backend.
  14. MultiXact wraparound from heavy `FOR SHARE`/FK checks; this is separate from XID wraparound.
  15. `pg_upgrade --link` with no rollback path once the new cluster has started.
  16. Sequence values are not transactional, so gaps are normal. Do not rely on them for invoice numbers.
  17. Node driver gotcha (verified locally): `RETURNING old.v, new.v` returns a single `{v: …}` key in JS because duplicate column names collapse. Always alias the columns.

- **Interview hot topics**
  - MVCC vs locking; why vacuum exists; wraparound
  - Isolation levels and anomalies; SSI write skew
  - Reading EXPLAIN ANALYZE; why the planner chose a seq scan
  - Index selection (composite order, partial, covering); B-tree vs GIN vs BRIN
  - Connection pooling and why Postgres needs it (process per connection)
  - Zero-downtime migrations
  - Replication: sync vs async; logical vs physical; failover and split brain
  - Partitioning trade-offs
  - Job queues with `SKIP LOCKED` vs Redis
  - JSONB vs normalized columns
  - pgvector HNSW vs IVFFlat

- **Executable-proof strategy**
  - **Tier 1, PGlite (default, fast, no Docker):** `@electric-sql/pglite@0.5.12` (PG 18.6) with Vitest under Node 22/24 pinned via mise. Each test file gets a fresh in-memory instance, so tests are deterministic. Verified locally to work:
    - `uuidv7()`, `VIRTUAL` generated columns, `WITHOUT OVERLAPS` (with `btree_gist`), `RETURNING old/new`
    - `pageinspect` (`heap_page_items` shows `xmin/xmax/ctid` changing on UPDATE, which is ideal for M01/M08), `pg_stat_statements`, `pg_buffercache`
    - `pg_current_wal_lsn()`
    - The contrib list in 0.5.12: amcheck, auto_explain, bloom, btree_gin, btree_gist, citext, cube, hstore, ltree, pageinspect, pg_buffercache, pg_stat_statements, pg_trgm, pg_visibility, pg_walinspect, pgcrypto, tablefunc, unaccent, uuid_ossp, and others.
    - pgvector is a **separate npm package**: `@electric-sql/pglite-pgvector` 0.0.13 was found on npm (unverified that it is the official package name). PostGIS is `@electric-sql/pglite-postgis` 0.2.12.
  - **PGlite limits** (single-user mode, single exclusive connection: https://github.com/electric-sql/pglite, https://pglite.dev/docs/; `pg_stat_activity` shows 1 row, verified locally):
    - **Cannot prove:**
      - Multi-session MVCC: concurrent transactions, snapshot visibility between sessions, lock waits and blocking, deadlock detection, `SKIP LOCKED` contention, SSI serialization failures between two clients, advisory-lock contention. It is one backend; "two connections" would be serialized.
      - Replication of any kind (no walsender/receiver, no standby, no slots streaming).
      - Background processes: autovacuum timing, checkpointer, bgwriter, `pg_stat_bgwriter`/`pg_stat_io` realism.
      - AIO (`io_method` = sync).
      - `pg_hba`/auth/TLS.
      - PgBouncer.
      - Memory/OS tuning; crash recovery and PITR; `pg_upgrade`; 64-bit-specific behaviour (it is a 32-bit WASM build).
    - `pg_stat_*` views exist but reflect a single-user, in-process engine. Treat counts as illustrative only.
  - **Tier 2, `docker compose` / testcontainers 12.2.1** (`@testcontainers/postgresql`, image `postgres:18.6`; run under mise `node`, Docker Desktop/OrbStack/colima on Mac):
    - **Concurrency:** two-client tests with node-postgres on separate connections, coordinated with explicit barriers. Use `pg_blocking_pids()` polling instead of sleeps for determinism.
    - **Replication:** primary + streaming standby compose file; logical pub/sub between two containers; PG19 RC image for `WAIT` (`postgres:19rc1` tag, unverified).
    - **PgBouncer:** container (`edoburu/pgbouncer` or `bitnami/pgbouncer`, image choice unverified) to prove the transaction-pooling breakages.
    - **Backup/PITR:** pgBackRest or `pg_basebackup` + WAL archive into a volume, then restore to a target time.
    - **AIO:** `io_method=io_uring` only on a Linux host or VM (the Docker Desktop VM kernel may lack io_uring; unverified). Fallback: assert `SHOW io_method`/`pg_aios` view existence plus a qualitative benchmark marked "non-deterministic, not asserted".
  - **Cannot prove deterministically anywhere locally:** Patroni failover timing, real fsync/torn-page behaviour, OS HugePages. Fallback: config validation tests (parse `postgresql.conf`, assert invariants) and documented manual drills.

- **Overlaps / dedupe**
  - Move to `architecture/data-systems`: normal forms, relational algebra, B-tree/B-link theory, isolation anomaly taxonomy (Adya/Berenson), ARIES/WAL theory, replication and consensus theory, partitioning theory, vector ANN theory (HNSW/IVF).
  - Keep here: the PG-specific realisation of each, with a cross-link.
  - FTS: PG keeps `tsvector` mechanics and links to the Elasticsearch track for inverted-index and BM25 depth.
  - Queues/pubsub: `SKIP LOCKED` and `LISTEN/NOTIFY` stay here, with a comparison table that links to the Redis Streams module.

---

### SQLite — `technologies/sqlite` (NEW)

- **Current stable version(s)**
  - **3.54.1, released 2026-10-16.** It patches a heap overflow on some 32-bit builds (https://www.sqlite.org/draft/news.html; draft page).
  - **3.54.0, released 2026-10-09** (https://www.sqlite.org/releaselog/3_54_0.html). Changes:
    - `.diskused` replaces the deprecated `sqlite3_analyzer`
    - planner: expression indexes skipped on no-op UPDATE
    - `%j`/`%J` JSON printf conversions
    - date modifiers `weekday -N` and `end of`
    - `SQLITE_LIMIT_SCHEMA`
    - about 4% faster than 3.53
  - History: 3.52.0 was **withdrawn** (backward-incompatibility). 3.51.3 (2026-03-13) fixed a **WAL-reset corruption bug**. 3.53.0 (2026-04-09) re-released 3.52's features (https://www.sqlite.org/draft/news.html).
  - Runtime-bundled versions (verified locally): Node 22.23 `node:sqlite` → 3.53.4 (still emits an ExperimentalWarning on Node 22); `better-sqlite3` 12.x (npm latest 12.x; local install bundles **3.53.4**); system Python 3 → 3.53.1. **Lesson: the SQLite version depends on the binding, so tests must assert `sqlite_version()`.**

- **Authoritative syllabi used**
  - Official docs index: https://www.sqlite.org/docs.html. Key pages:
    - Database file format: https://www.sqlite.org/fileformat2.html
    - Atomic commit: https://www.sqlite.org/atomiccommit.html
    - WAL: https://www.sqlite.org/wal.html
    - Isolation: https://www.sqlite.org/isolation.html
    - File locking: https://www.sqlite.org/lockingv3.html
    - Query planner / NGQP: https://www.sqlite.org/queryplanner.html, https://www.sqlite.org/queryplanner-ng.html
    - VDBE opcodes: https://www.sqlite.org/opcode.html
    - Type affinity: https://www.sqlite.org/datatype3.html
    - STRICT tables: https://www.sqlite.org/stricttables.html
    - JSON/JSONB: https://www.sqlite.org/json1.html
    - FTS5: https://www.sqlite.org/fts5.html
    - R*Tree: https://www.sqlite.org/rtree.html
    - "How to corrupt": https://www.sqlite.org/howtocorrupt.html
    - Backup API / `VACUUM INTO`
    - Session extension: https://www.sqlite.org/sessionintro.html
    - Testing methodology: https://www.sqlite.org/testing.html
  - CMU 15-445 for storage/B-tree theory.
  - No certification exists.

- **Proposed modules** (11)
  1. **What SQLite is:** embedded, serverless, single-file, "competes with fopen()", appropriate uses (https://www.sqlite.org/whentouse.html), CLI fluency, bindings (node:sqlite, better-sqlite3, Python sqlite3), version detection.
  2. **Type system & schema:** dynamic typing and affinity, `STRICT` tables, `rowid`/`INTEGER PRIMARY KEY` aliasing, `WITHOUT ROWID`, `AUTOINCREMENT` semantics, generated columns, `CHECK`, `PRAGMA foreign_keys` off by default.
  3. **SQL dialect & features:** CTEs/recursive, window functions, `UPSERT`, `RETURNING`, `JSON`/`JSONB` (binary since 3.45), date/time functions (3.54 modifiers), `ALTER TABLE` limits and the 12-step table rebuild procedure.
  4. **File format & B-trees:** pages, header, table B+trees vs index B-trees, overflow pages, freelist, `page_size`, `auto_vacuum`, `VACUUM`, `dbstat` / `.diskused`.
  5. **Transactions & locking (rollback journal):** lock states (SHARED/RESERVED/PENDING/EXCLUSIVE), `BEGIN DEFERRED/IMMEDIATE/EXCLUSIVE`, `SQLITE_BUSY`, `busy_timeout`, serializable isolation, atomic commit via rollback journal.
  6. **WAL mode:** WAL file + wal-index (`-shm`), readers don't block writer, checkpoints (PASSIVE/FULL/RESTART/TRUNCATE), checkpoint starvation, `wal_autocheckpoint`, `synchronous=NORMAL` vs `FULL` durability trade-off, WAL2/`BEGIN CONCURRENT` branches (not in mainline; unverified status).
  7. **Query planner & VDBE:** `EXPLAIN QUERY PLAN` vs `EXPLAIN` bytecode, NGQP, covering/partial/expression indexes, `ANALYZE` + `sqlite_stat1/4`, `PRAGMA optimize`, the `LIKE` optimization conditions.
  8. **Extensions & virtual tables:** FTS5 (BM25, tokenizers, external content tables), R*Tree, generate_series, loadable extensions, `sqlite-vec` (pointer to vector search), application-defined functions from JS/Python.
  9. **Concurrency in applications:** one-writer rule, connection-per-thread, write serialization queues, `IMMEDIATE` to avoid upgrade deadlocks, Node event-loop blocking with sync APIs, multi-process access, network filesystems.
  10. **Durability, backup & operations:** fsync semantics, `howtocorrupt`, Online Backup API, `VACUUM INTO`, Litestream-style WAL shipping (pointer), `integrity_check`/`quick_check`, schema migrations (`user_version`), session/changeset extension.
  11. **SQLite at the edge & distributed SQLite:** browser SQLite (official WASM + OPFS), Cloudflare D1/Durable Objects (cross-link), **libSQL and Turso** (below), rqlite/LiteFS/cr-sqlite as alternatives, "when to graduate to Postgres".

- **Gotchas & production failure modes**
  1. `PRAGMA foreign_keys` is OFF by default per connection, so FKs are silently not enforced.
  2. Type affinity accepts `'abc'` into an `INTEGER` column unless the table is `STRICT`.
  3. A deferred transaction that reads then writes can get `SQLITE_BUSY` immediately on lock upgrade, and **`busy_timeout` does not help** in WAL mode when the snapshot is stale. Use `BEGIN IMMEDIATE` for write transactions.
  4. Checkpoint starvation: a continuously open reader prevents a WAL reset, so the `-wal` file grows unbounded.
  5. WAL does not work over network filesystems (needs shared memory). `-shm`/`-wal` must stay with the db file. Copying only `.db` while live yields a stale or corrupt backup.
  6. 3.52.0 withdrawn; WAL-reset corruption bug fixed in 3.51.3 and 3.53.0+. Pin the version and know your binding's bundled SQLite.
  7. `synchronous=NORMAL` in WAL can lose the last transactions on power loss (but not corrupt the file).
  8. `AUTOINCREMENT` is usually unnecessary and costs extra writes to `sqlite_sequence`.
  9. `ALTER TABLE` cannot drop constraints or change types, which forces the 12-step rebuild. Running it with `foreign_keys=ON` can cascade-delete.
  10. `DELETE` doesn't shrink the file. `VACUUM` rewrites the whole db and needs about 2× space, plus an exclusive lock.
  11. Sync drivers (better-sqlite3, node:sqlite) block the Node event loop on long queries.
  12. `LIKE` is case-insensitive for ASCII only, and index use requires specific collation conditions.
  13. Fork with open connections in the child corrupts state.
  14. The default `SQLITE_MAX_VARIABLE_NUMBER` limits batch-insert sizes. The default has varied by version (32766 since 3.32; unverified current).

- **Interview hot topics**
  - When SQLite is the right choice for production
  - WAL vs rollback journal
  - Single-writer concurrency model; `SQLITE_BUSY` handling
  - Dynamic typing vs STRICT
  - How SQLite achieves atomic commit
  - Durability knobs
  - Backups of a live db
  - SQLite at the edge (D1, Turso, Litestream)
  - B-tree file layout
  - Testing culture (100% MC/DC branch coverage)

- **Executable-proof strategy**
  - Fully local and deterministic. Use mise-pinned Node 22/24 + Vitest with **better-sqlite3 12.x** (bundled SQLite 3.53.4 in the current build; verified locally) as the primary binding. Assert `sqlite_version()` in a setup test. Run `node:sqlite` comparisons only on Node ≥22.13 (experimental warning on 22).
  - Python `pytest` with stdlib `sqlite3` for the Python angle. Check `sqlite3.sqlite_version`, because the system build may differ.
  - Concurrency is **provable**, unlike PGlite: it is multi-process/multi-connection on files.
    - Use temp-dir db files and two connections to show `SQLITE_BUSY`, `BEGIN IMMEDIATE`, and checkpoint starvation (assert `-wal` size grows while a reader holds a snapshot).
    - Use `worker_threads` or child processes for multi-process lock tests.
  - Inspect file format with `dbstat`, raw page bytes read from the file in tests, and `PRAGMA page_count/freelist_count`.
  - **Cannot prove locally:** power-loss durability (`synchronous` levels) and network FS corruption. Fallback: documented reasoning plus fault injection via a custom VFS (advanced; optional) or simulated `kill -9` mid-transaction plus `integrity_check`, which *is* provable.
  - CLI: `sqlite3` via mise (`aqua:sqlite/sqlite`? backend availability unverified). Fallback: Homebrew `sqlite` on Mac, or rely on bindings only.

- **Overlaps / dedupe**
  - `architecture/data-systems` owns B-tree theory, journaling vs WAL theory, and isolation levels.
  - FTS5 vs Elasticsearch BM25: theory lives in the ES track; FTS5 cross-links.
  - Turso/libSQL is a module here (see next section).
  - Cloudflare D1 and Durable Objects belong to the edge/Cloudflare track; cross-link only.

---

### Turso / libSQL — recommend a **module within SQLite** (`technologies/sqlite/modules/12-libsql-and-turso.md`), not a standalone track

- **Current stable version(s) and the state of the product**
  - **Two distinct things share the Turso name** (https://turso.tech/llms-full.txt):
    1. **libSQL:** the open-source C *fork* of SQLite (2022–). Turso now labels it "**Legacy (libSQL) — battle-tested, ORM support**", "still supported". Its embedded engine reports **SQLite 3.45.1** (verified locally via `@libsql/client` **0.18.0**), roughly nine minor versions behind upstream 3.54. libSQL-only features:
       - native vector type `F32_BLOB(n)` + `libsql_vector_idx` (DiskANN-based ANN index; creation verified locally)
       - `ALTER TABLE` extensions
       - the sqld server / Hrana protocol
       - **embedded replicas**: local file replica, reads local, **writes go to the remote primary**, with `sync()` pulling frames
    2. **Turso Database** (formerly "Limbo"): a **ground-up Rust rewrite** of SQLite, announced Dec 2024 and renamed Turso on Jan 21, 2025 (https://turso.tech/blog/upcoming-changes-to-the-turso-platform-and-roadmap, https://turso.tech/blog/we-will-rewrite-sqlite-and-we-are-going-all-in). Status:
       - **Latest v0.8.3 (2026-10-12)**, v0.9.0-pre.1 (2026-10-15) (https://github.com/tursodatabase/turso/releases). Still 0.x.
       - npm `@tursodatabase/database` 0.8.3 reports `sqlite_version()` = **3.50.4** (verified locally; a compatibility target).
       - Features (verified locally where noted):
         - **MVCC concurrent writes:** `PRAGMA journal_mode='mvcc'` + `BEGIN CONCURRENT`, row-level conflict means retry (https://docs.turso.tech/tursodb/concurrent-writes). v0.8.0 release notes "stop calling MVCC experimental". The pragma was accepted locally.
         - **Async I/O** (io_uring on Linux)
         - **Built-in CDC:** `PRAGMA capture_data_changes_conn('full')` → `turso_cdc` table. Accepted locally.
         - **Vector types:** `vector32/64/8/1bit` + `vector_distance_cos`. Worked locally; the docs example is brute-force; ANN index status unverified.
         - **Turso Sync:** `@tursodatabase/sync`, local-first push/pull, where *writes are also local*, unlike libSQL embedded replicas.
         - Encryption at rest (cloud: AES-256; local page-codec interface in 0.8.0; details unverified).
  - **Turso Cloud** (the platform):
    - Jan 2025 changes: moved to AWS; deprecated edge replicas, multi-DB schemas and `ATTACH` for new users. The new cloud server is closed-source and a new implementation, while client code stays open.
    - Now offers branching, PITR and multi-region (https://turso.tech/llms-full.txt).
  - **ORM caveat:** Drizzle/Prisma integration still needs `@libsql/client` or `@tursodatabase/serverless/compat` (https://turso.tech/llms-full.txt).

- **Why a module, not a track:**
  - 90% of the concepts are SQLite's (file format, SQL dialect, B-trees, WAL).
  - The distinctive parts fit in 1–2 modules: MVCC `BEGIN CONCURRENT` vs SQLite's single writer, sync models, vector, CDC, and the libSQL→Turso migration story.
  - The product is 0.x and moving fast, so a standalone track would rot.
  - **Revisit when Turso Database reaches 1.0.**

- **Module subtopics** (SQLite M12: "libSQL & Turso: distributed and concurrent SQLite")
  - **History and lineage:** SQLite (no outside contributions) → libSQL fork → Rust rewrite; licensing (libSQL MIT; Turso DB MIT; cloud server closed).
  - **libSQL:** embedded replicas (read-local/write-remote, `syncInterval`, read-your-writes caveat), Hrana over HTTP/WebSocket, `F32_BLOB` + DiskANN `libsql_vector_idx`, `vector_top_k`.
  - **Turso DB MVCC:** `BEGIN CONCURRENT`, optimistic conflict detection, retry loops; contrasted with SQLite's WAL single writer and Postgres MVCC.
  - **Turso Sync:** offline-first push/pull, conflict semantics (details unverified; read the docs before writing), vs CRDT approaches (cr-sqlite).
  - **CDC table and vector functions.**
  - **Compatibility matrix:** what SQLite features Turso DB lacks (check its `COMPAT.md`; unverified contents); version-lag hazards of libSQL (3.45 base: misses `STRICT`-era and JSONB-era fixes and 3.46–3.54 features).
  - **Decision guide:** plain SQLite + Litestream vs libSQL embedded replica vs Turso Sync vs D1 vs Postgres.

- **Gotchas**
  - libSQL embedded replica: a write returns success from the remote, but local reads are stale until `sync()` (read-your-writes violation).
  - libSQL's SQLite base lags upstream; features and bugfixes from 3.46+ are absent.
  - Turso MVCC: apps must handle conflict/busy errors with retry. Hot-row contention collapses throughput.
  - Deprecated cloud features (edge replicas, `ATTACH`, multi-DB schemas) still appear in old tutorials.
  - The 0.x API changes between minors; pin exact versions.

- **Executable-proof strategy**
  - Fully local:
    - `@tursodatabase/database` 0.8.3 and `@libsql/client` 0.18.0 in Vitest with `:memory:`/file dbs (both verified to load locally).
    - Prove `BEGIN CONCURRENT` conflicts with two connections on one file (unverified that multi-connection on the same file is supported in the JS binding; test early).
    - Prove `libsql_vector_idx` + `vector_top_k`; prove CDC rows.
  - Embedded replica / sync against a local sqld: `ghcr.io/tursodatabase/libsql-server` image (tag unverified) via docker compose. The Turso Cloud sync path cannot be proven offline; mark it as "requires account" with a skipped test.

- **Overlaps:** MVCC theory → `architecture/data-systems`; vector ANN theory → data-systems (or an AI/vector track); edge deployment → Cloudflare/edge track.

---

### Redis — `technologies/redis` (NEW)

- **Current stable version(s)**
  - **Redis Open Source 8.10.2** (Latest; 2026-09-17 security release, alongside 8.8.3, 8.6.7, 8.4.7, 8.2.10) (https://github.com/redis/redis/releases).
  - What's new (https://redis.io/docs/latest/develop/whats-new/):
    - **8.10** (Q3 2026): compact hashes, incremental backup/restore, JSONPath extensions, `LMOVEM/BLMOVEM`, `SUNIONCARD/SDIFFCARD`, `FT.AGGREGATE COLLECT`
    - **8.8** (Q2 2026): new **Array** data type, `INCREX` rate limiter
    - **8.6** (Q1 2026): stream idempotency, LRM ("least recently modified") eviction policies, hot-key detection, TLS cert auth
    - **8.0** (GA May 2025): Search/Query Engine, JSON, TimeSeries and probabilistic structures merged into core; new **Vector Set** type (https://redis.io/blog/redis-8-ga/)
  - **Licensing:**
    - ≥8.0.0: **RSALv2 or SSPLv1 or AGPLv3** (pick one)
    - 7.4.x–7.8.x: RSALv2/SSPLv1 only
    - ≤7.2: BSD-3 (https://redis.io/legal/licenses/)
  - **Valkey** (Linux Foundation fork of 7.2.4, BSD-3):
    - **9.1.2 latest** (2026-08-31); 9.0.6; **9.2.0-rc1** (2026-09-16), which adds forkless RDB snapshots, a Path Hash type, ACL roles, server-side hot-key detection and B+tree large sorted sets (https://github.com/valkey-io/valkey/releases)
    - **9.0 GA Oct 2025:** atomic slot migration, numbered databases in cluster mode, hash field expiration (https://valkey.io/blog/introducing-valkey-9/)
    - Modules ecosystem: valkey-search, valkey-json, valkey-bloom (bundle naming unverified)
  - Other clones: Dragonfly and KeyDB as context only.
  - Clients (npm, verified today): `redis` (node-redis) **6.0.0**, `ioredis` **6.3.0**.
  - Local `redis-server` in this sandbox is 7.0.15, which shows why pinning matters.

- **Authoritative syllabi used**
  - Redis docs: https://redis.io/docs/latest/ (data types, Redis Query Engine, persistence, replication, Sentinel, Cluster spec https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/, latency/memory optimization, keyspace notifications, client-side caching, Lua/Functions, ACL).
  - **Redis Certified Developer:** domains are data structures, data modeling, performance, debugging and clustered code. Admin is excluded. **The exam was taken down in January 2026, with a relaunch planned for 2026** (https://redis.io/blog/redis-developer-certification-is-here/). Redis University "Develop with Redis" path as the substitute (https://redis.io/tutorials/university/).
  - Valkey docs: https://valkey.io/topics/
  - Kleppmann's "How to do distributed locking" (Redlock critique): https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html

- **Proposed modules** (12)
  1. **Model & architecture:** single-threaded command execution + I/O threads, event loop, RESP2/RESP3, pipelining, latency mental model, Redis vs Valkey vs managed offerings, licensing timeline.
  2. **Core data types & complexity:** strings/bitmaps/bitfields, lists, hashes (+ field expiration `HEXPIRE`), sets, sorted sets (skiplist + listpack), HyperLogLog, geo; Big-O per command; encodings (listpack/intset/quicklist) and `OBJECT ENCODING`.
  3. **Keys, expiry & memory:** TTL semantics (lazy + active expiry), `maxmemory` policies (LRU/LFU approximations, 8.6 LRM), memory overhead/fragmentation, `MEMORY USAGE`, big keys, `SCAN` vs `KEYS`, `UNLINK` vs `DEL`.
  4. **Caching patterns:** cache-aside/read-through/write-through/write-behind, stampede protection (locks, probabilistic early expiration, request coalescing), negative caching, invalidation, client-side caching (`CLIENT TRACKING`), consistency with the DB (dual-write problem).
  5. **Atomicity & scripting:** `MULTI/EXEC` (no rollback), `WATCH` optimistic locking, Lua `EVAL` vs Functions (`FUNCTION LOAD`), script determinism, blocking risk.
  6. **Messaging:** Pub/Sub (fire-and-forget, sharded pub/sub), Streams (`XADD`, consumer groups, PEL, `XAUTOCLAIM`, trimming, 8.6 idempotency), lists as queues (`BLMOVE` reliable queue), vs Kafka/SKIP LOCKED.
  7. **Coordination patterns:** rate limiters (fixed/sliding window, token bucket, 8.8 `INCREX`), distributed locks (`SET NX PX` + fencing; Redlock debate), leaderboards, sessions, idempotency keys.
  8. **Redis Query Engine & JSON:** JSON type + JSONPath, `FT.CREATE` on hash/JSON, TEXT/TAG/NUMERIC/GEO/VECTOR fields, `FT.SEARCH`/`FT.AGGREGATE`, vector search (FLAT/HNSW/SVS quantization), Vector Sets (`VADD/VSIM`), TimeSeries and probabilistic types (Bloom, Cuckoo, CMS, Top-K, t-digest). Valkey equivalents differ.
  9. **Persistence:** RDB (fork + COW), AOF (`appendfsync`, rewrite, multi-part AOF), hybrid, 8.10 incremental backup, durability guarantees and data-loss windows.
  10. **Replication & Sentinel:** async replication, PSYNC/backlog, `WAIT`/`WAITAOF`, replica-of-replica, Sentinel quorum/failover, split-brain and `min-replicas-to-write`.
  11. **Redis Cluster:** 16384 hash slots (CRC16), hash tags, MOVED/ASK, resharding, cross-slot errors, failover, client topology handling, Valkey 9 atomic slot migration and multi-DB cluster.
  12. **Operations & security:** ACLs, TLS, `protected-mode`, `rename-command`, `SLOWLOG`, `LATENCY DOCTOR`, `INFO`, hot/big key detection (8.6 / `--hotkeys`), kernel THP and overcommit, observability metrics.

- **Gotchas & production failure modes**
  1. `KEYS *` (and `SMEMBERS`/`HGETALL`/`LRANGE 0 -1` on huge collections) block the single command thread, causing a latency spike for all clients. Use `SCAN` family.
  2. `DEL` of a multi-million-element key blocks. Use `UNLINK`/`lazyfree-lazy-*`.
  3. `BGSAVE`/AOF rewrite `fork()` with a large dataset: COW memory doubling under write load, then OOM kill. Linux THP makes fork latency and COW worse; `vm.overcommit_memory=1` is required.
  4. `maxmemory` unset with `noeviction` gives write errors (OOM command not allowed). With `allkeys-*` on a store you treat as durable, data is silently evicted.
  5. Cache stampede on hot key expiry thunders the DB.
  6. `MULTI/EXEC` does not roll back on runtime errors; partial application surprises.
  7. Lua scripts that run long block everything. `SCRIPT KILL` only works if the script hasn't written.
  8. Async replication: acknowledged writes are lost on failover. `WAIT` reduces this but isn't strong consistency.
  9. Sentinel split brain: an old master keeps accepting writes in a minority partition (mitigate with `min-replicas-to-write`).
  10. Cluster `CROSSSLOT` errors for multi-key commands/Lua. Overusing hash tags creates hot slots.
  11. Pub/Sub messages are lost if the subscriber is disconnected. Slow subscribers blow the output buffer (`client-output-buffer-limit pubsub`) and get disconnected.
  12. Streams without `MAXLEN`/`MINID` trimming grow unbounded. A PEL left unclaimed leaves messages stuck forever.
  13. Distributed lock without fencing tokens: a GC pause or expiry means two holders.
  14. `SELECT` db numbers don't work in Cluster before Valkey 9 / not in Redis Cluster (unverified for Redis 8.x).
  15. Node clients: default offline queue + reconnect can replay commands; pipelining without backpressure leads to memory blowup.
  16. Licensing: AGPLv3 network-use clause if you modify and offer Redis as a service. Some orgs mandate Valkey instead.

- **Interview hot topics**
  - Why Redis is fast (in-memory, single-threaded command path, epoll)
  - Choosing a data structure for X (leaderboard, rate limit, dedupe)
  - Caching strategies, invalidation and stampede
  - Persistence RDB vs AOF trade-offs
  - Eviction policies
  - Replication consistency; Sentinel vs Cluster
  - Hash slots / resharding
  - Distributed locks and Redlock critique
  - Streams vs Pub/Sub vs Kafka
  - Hot keys / big keys diagnosis
  - Redis vs Valkey licensing story

- **Executable-proof strategy**
  - **Tier 1 (fast):** a `redis-server` binary pinned via mise (`redis` via asdf/aqua plugin; availability of 8.10 in the mise registry is unverified). Fallback: Docker `redis:8.10.2` and `valkey/valkey:9.1.2` (tags per Docker Hub convention; unverified). Use testcontainers 12.2.1 `GenericContainer` (or `@testcontainers/redis`, unverified version) and Vitest + node-redis 6.0.0.
  - **Deterministic patterns:**
    - Assert `OBJECT ENCODING` transitions (listpack→hashtable at thresholds).
    - Prove `MULTI` no-rollback and `WATCH` aborts.
    - Prove Lua atomicity; Streams consumer group + `XAUTOCLAIM` (use `DEBUG SLEEP`-free logic with explicit idle times via `XCLAIM … IDLE`).
    - Prove TTL behaviour with `DEBUG SET-ACTIVE-EXPIRE 0` to control expiry.
    - Prove eviction with a tiny `maxmemory`.
    - Prove `KEYS` blocking by measuring a concurrent `PING` latency distribution. Assert relative ordering only; mark timing as non-deterministic.
  - **Tier 2, docker compose:** primary + 2 replicas + 3 Sentinels (failover via `SENTINEL FAILOVER`, assert new master); 6-node Cluster (`redis-cli --cluster create`, assert MOVED/ASK, CROSSSLOT, reshard); Valkey side-by-side compat tests running the same suite against both images.
  - **Cannot prove locally:** real network partitions (approximate with `docker network disconnect` or `toxiproxy`; deterministic enough to assert lost-write scenarios), fork COW memory at scale, THP effects. Fallback: `INFO persistence`/`latest_fork_usec` assertions and config-validation tests.

- **Overlaps / dedupe**
  - `architecture/data-systems` owns replication theory (async vs sync, failover, split brain), partitioning/consistent-hashing theory, caching theory (consistency, dual writes, invalidation), distributed locking and fencing, and probabilistic data structures theory (HLL, Bloom).
  - The Redis track covers Redis's realisation.
  - Vector search theory goes in data-systems (shared with PG/ES/Turso).
  - Messaging/queues are compared with Kafka in a messaging track if one exists.

---

### Elasticsearch — `technologies/elasticsearch` (NEW)

- **Current stable version(s)**
  - **9.5.5** (Oct 2026; with 9.4.8 as the maintained previous minor) (https://releasebot.io/updates/elastic/elasticsearch; secondary aggregator. Confirm on https://www.elastic.co/docs/release-notes/elasticsearch).
  - **9.5.0** (Aug 2026):
    - batched query phase by default
    - DSL `frozen_after`
    - ES|QL `flattened` support (tech preview)
    - experimental ES|QL data federation to S3
    - columnar / `logsdb_columnar` index modes (tech preview)
  - **9.4.0** (May 2026): ES|QL **Views**, PromQL in ES|QL (tech preview), Prometheus-compatible endpoints.
  - **9.0 GA April 2025** (with 8.18): **Lucene 10**, BBQ (Better Binary Quantization) GA, ES|QL `LOOKUP JOIN` (tech preview at the time) (https://www.elastic.co/blog/whats-new-elastic-search-9-0-0, https://www.elastic.co/blog/whats-new-elastic-9-0-0).
  - **Licensing:** since Aug 2024, the source is under **AGPLv3** as an option alongside SSPL and ELv2 (https://www.businesswire.com/news/home/20240829537786/en). The default distribution is under the Elastic License; some features (e.g. `frozen_after`, searchable snapshots) need paid tiers.
  - Client: `@elastic/elasticsearch` **9.5.1** on npm (verified).
  - **OpenSearch:** Apache-2.0 fork of ES 7.10.2, governed by the OpenSearch Software Foundation (Linux Foundation, Sept 2024). **3.8.0 latest (2026-08-05)**, based on Lucene 10 since 3.0 (https://en.wikipedia.org/wiki/OpenSearch_(software)). An LTS program was announced (https://www.pulse.bot/devops/news/opensearch-foundation-launches-lts-versions-to-bolster-devops-stability-9822b925-1a61-48f3-981a-f991d9925baf/; details unverified).

- **Authoritative syllabi used**
  - **Elastic Certified Engineer** (hands-on, performance-based). Third-party source says it is **still on version 8.1** (https://nextbrick.com/elastic-search-engineer; official page https://www.elastic.co/training/elastic-certified-engineer-exam does not show objectives). Weights unpublished. Domains:
    1. **Data Management:** index definition, index/dynamic templates, ILM for time series, data-stream templates.
    2. **Searching Data:** term/phrase, bool, async search, metric/bucket/sub-aggs, cross-cluster search, runtime fields.
    3. **Developing Search Apps:** highlight, sort, pagination, aliases, search templates.
    4. **Data Processing:** mappings, custom analyzers, multi-fields, reindex/update-by-query, ingest pipelines + Painless, runtime fields.
    5. **Cluster Management:** shard diagnosis/health, snapshot/restore, searchable snapshots, CCS, CCR.
  - Official docs: https://www.elastic.co/docs (Elasticsearch reference: mapping, text analysis, Query DSL, ES|QL https://www.elastic.co/docs/reference/query-languages/esql, aggregations, data streams, ILM, vector search/kNN, cluster/shard allocation).
  - *Elasticsearch: The Definitive Guide* (concepts, dated); Lucene docs (https://lucene.apache.org/core/); *Introduction to Information Retrieval* (Manning et al., free at https://nlp.stanford.edu/IR-book/) for inverted index, TF-IDF/BM25 and evaluation.

- **Proposed modules** (12)
  1. **Search fundamentals & IR theory:** inverted index, postings, term dictionary (FST), BM25 scoring, precision/recall, relevance vs filter context. Cross-links data-systems for indexing theory.
  2. **Architecture:** cluster/node roles, index → shards → Lucene segments, primary/replica, coordinating node scatter-gather, query-then-fetch (9.5 batched query phase), near-real-time refresh, translog, flush, merges; stateless/serverless architecture overview.
  3. **Mappings:** dynamic vs explicit, field types (`text`/`keyword`/numeric/date/`flattened`/`nested`/`object`/`join`), multi-fields, `doc_values` vs `fielddata`, `_source`/synthetic source, `index: false`, runtime fields, mapping explosion limits, index & dynamic templates. Exam domains 1 and 4.
  4. **Text analysis:** char filters/tokenizers/token filters, standard vs language analyzers, custom analyzers, synonyms (search-time, synonyms API), n-grams/edge n-grams, normalizers, `_analyze` API, index vs search analyzers.
  5. **Query DSL:** query vs filter context, `match`/`multi_match`/`match_phrase`/`term`/`terms`/`range`/`exists`, `bool` scoring semantics, `nested`, `function_score`, highlighting, sorting, pagination (`from/size` vs `search_after` + PIT; scroll legacy), search templates, async search.
  6. **ES|QL:** pipe syntax, `FROM/WHERE/EVAL/STATS/SORT/KEEP`, `LOOKUP JOIN`, `ENRICH`, Views (9.4), limits vs DSL, when to use which.
  7. **Aggregations:** bucket/metric/pipeline, `terms` accuracy (shard_size, doc count error), `composite` for pagination, `cardinality` (HLL++), percentiles (TDigest), date histograms, memory/circuit breakers.
  8. **Ingest & data lifecycle:** ingest pipelines + Painless, `_bulk` sizing, reindex/update-by-query, aliases for zero-downtime reindex, data streams, ILM vs Data Stream Lifecycle (DSL), hot/warm/cold/frozen tiers, rollover, searchable snapshots, TSDS/logsdb index modes.
  9. **Vector & hybrid search:** `dense_vector`, HNSW, quantization (int8, int4, **BBQ**), kNN query vs `knn` section, filtering in kNN, `semantic_text` and inference endpoints, ELSER sparse vectors, hybrid via RRF/retrievers, re-ranking.
  10. **Scaling & sharding:** shard sizing (10–50 GB rule of thumb), oversharding, routing, allocation awareness, replicas for read scale, split/shrink, CCS/CCR, `index.max_result_window`.
  11. **Operations:** cluster health red/yellow (`_cluster/allocation/explain`), snapshot/restore and SLM, rolling upgrades 8→9 (deprecation API), security (TLS, API keys, RBAC on by default), JVM heap (≤~31GB compressed oops), circuit breakers, slow logs, hot threads.
  12. **Expert & ecosystem:** Lucene internals (segments, merge policy, deletes as tombstones, doc values columnar format, skip lists, BKD trees for numerics/geo), relevance tuning and evaluation (`_rank_eval`), OpenSearch divergence (API compatibility, k-NN plugin engines FAISS/Lucene, licensing), PG FTS vs ES decision guide.

- **Gotchas & production failure modes**
  1. Dynamic mapping makes every string `text` + `keyword` subfield (doubling index cost). Mapping explosion from user-controlled keys leads to cluster-state bloat; `index.mapping.total_fields.limit` errors.
  2. A mapping type can't be changed in place. It requires reindex + alias swap; forgetting aliases means downtime.
  3. `term` query on a `text` field matches nothing because of analysis (casing).
  4. Deep pagination `from+size > 10000` is rejected. Use `search_after` + PIT.
  5. `terms` aggregation counts are approximate across shards (`doc_count_error_upper_bound`).
  6. Oversharding (thousands of tiny shards) brings heap pressure, a slow master and long recoveries.
  7. Heap > ~31GB loses compressed OOPs. Leave about 50% RAM for the OS page cache (Lucene relies on mmap).
  8. `nested` docs multiply the Lucene doc count; `nested` queries/aggs are slow; the `index.mapping.nested_objects.limit` is hit.
  9. Refresh interval 1s on heavy bulk ingest causes segment churn. Set `refresh_interval: -1`/`30s` during backfills, and set `number_of_replicas: 0` during initial load.
  10. Read-after-write: a doc isn't searchable until refresh (GET by id is realtime; search is not). `refresh=wait_for` vs `true` costs.
  11. Disk watermarks (85/90/95%): the index becomes read-only (`index.blocks.read_only_allow_delete`) at flood stage.
  12. Fielddata on `text` fields blows heap and trips the circuit breaker.
  13. `update_by_query`/`delete_by_query` version conflicts without `conflicts=proceed`. Deletes leave tombstones until merges.
  14. Split brain is no longer possible in 7+ (Zen2/voting config), but losing a majority of master-eligible nodes leaves the cluster unavailable. Always run 3 master-eligible nodes.
  15. kNN with restrictive filters gives poor recall or slow brute-force fallback. HNSW graphs must fit in RAM (off-heap) for latency.
  16. Painless scripts in hot query paths and script compilation limits (`script.max_compilations_rate`).

- **Interview hot topics**
  - Inverted index and BM25
  - text vs keyword; analyzers
  - Shard sizing and replica strategy
  - Near-real-time search (refresh/translog/flush)
  - Query vs filter context and caching
  - Zero-downtime reindex with aliases
  - Deep pagination
  - Aggregation accuracy
  - Hot-warm-cold / ILM
  - Vector/hybrid search (HNSW, quantization, RRF)
  - ES vs OpenSearch vs Postgres FTS
  - Cluster health red/yellow troubleshooting

- **Executable-proof strategy**
  - **Tier 2 only** (no embedded ES).
    - testcontainers 12.2.1 with `@testcontainers/elasticsearch` (version unverified), or docker compose using `docker.elastic.co/elasticsearch/elasticsearch:9.5.5` single-node (`discovery.type=single-node`, `xpack.security.enabled=false` for tests, `ES_JAVA_OPTS=-Xms1g -Xmx1g`), or Elastic's `start-local` script (`curl -fsSL https://elastic.co/start-local | sh`; unverified current). Mac: about 2–4 GB RAM to Docker.
    - Vitest + `@elastic/elasticsearch` 9.5.1.
  - **Determinism:**
    - Always `refresh: true` (or `_refresh`) before asserting search results.
    - Single shard (`number_of_shards: 1`) for scoring assertions, since BM25 stats are per shard. A *negative test* shows a multi-shard score skew and `dfs_query_then_fetch` fixing it.
    - `_analyze` API assertions for analyzers.
    - `_validate/query?explain` and `explain: true` for scoring.
    - Aggregation accuracy demo with 3 shards and `shard_size: 1`.
    - kNN recall tests against brute-force `script_score` ground truth with a fixed seeded dataset.
    - ILM: set `indices.lifecycle.poll_interval: 1s` and tiny `max_docs` rollover conditions. Assert the phase via `_ilm/explain` with polling (bounded wait).
  - **Multi-node:** 3-node compose (lower heap) for shard allocation, `allocation/explain`, replica promotion, and stopping a node for a yellow state. The OpenSearch 3.8 image (`opensearchproject/opensearch:3.8.0`) runs the same API-compat subset in a parallel suite.
  - **Cannot prove locally:** paid-tier features (searchable snapshots/frozen tier, `frozen_after`, CCR need an Enterprise/trial license). A **30-day trial license** via `_license/start_trial` can enable these locally (unverified for 9.5), so mark the tests `trial-only`. ELSER/inference endpoints need ML nodes and model downloads (heavy; mark optional). Performance/capacity claims are documented, not asserted.
  - Kibana is **not** part of this track: use Dev Tools-equivalent HTTP files (`.http`) or `curl` scripts. Kibana, dashboards, Beats/Elastic Agent, EDOT/OTel, APM and Logstash pipelines-for-observability belong to the **observability track**. Elasticsearch only covers ingest pipelines, data streams/ILM and the logsdb/TSDS index modes as storage features, with a cross-link.

- **Overlaps / dedupe**
  - `architecture/data-systems` owns inverted-index fundamentals (shared with PG FTS, SQLite FTS5 and Redis Query Engine), LSM-style segment/merge theory, sharding/replication theory, and vector ANN theory (HNSW, IVF, quantization).
  - The observability track owns Kibana and the Elastic stack ingest agents.
  - The ES track owns Lucene/ES specifics.

---

### Proposed shared foundation — `architecture/data-systems` (DDIA-style)

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

### Cross-track summary (for the orchestrator)

| Track | Path | Status | Pinned versions | Local proof |
|---|---|---|---|---|
| PostgreSQL | `technologies/postgres` | Existing, restructure 10 → 13 modules, add PG19 deltas | PG 18.6 (19 RC1); PGlite 0.5.12 = PG 18.6 | PGlite (single session) + testcontainers/compose for concurrency, replication, pooling, AIO (Linux) |
| SQLite | `technologies/sqlite` | New, 11 modules + M12 Turso | 3.54.1; better-sqlite3 bundles 3.53.4 | Fully local, multi-connection on files |
| Turso/libSQL | `technologies/sqlite` module 12 | Module, not track (revisit at Turso 1.0) | Turso DB 0.8.3; @libsql/client 0.18.0 (SQLite 3.45.1 base) | Local npm packages; sqld via compose; cloud sync not provable offline |
| Redis | `technologies/redis` | New, 12 modules | Redis 8.10.2; Valkey 9.1.2 (9.2-rc1) | Docker/testcontainers; compose for Sentinel/Cluster |
| Elasticsearch | `technologies/elasticsearch` | New, 12 modules; Kibana belongs to observability | ES 9.5.5; OpenSearch 3.8.0; client 9.5.1 | Docker single-node + 3-node compose; paid features need a trial license |
| Data systems | `architecture/data-systems` | New foundation, 12 modules | n/a | Toy implementations + property tests |
