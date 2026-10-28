# Brief: PostgreSQL (`technologies/postgres`)

| | |
|---|---|
| Phase | 1 |
| Kind | EXISTING track: restructure and update in place, keeping tests green throughout |
| Primary (author) | **Opus · claude.ai** |
| Drafter (on request) | pi · DeepSeek |
| Challenger | pi · Muse Spark 1.3 |
| Verifier | Antigravity |
| Final gate | Opus (claude.ai session) |
| Branch / worktree | `track/postgres` · `../zto-postgres` |
| Depends on | none (can start now) |
| Research dossier | `.agents/research/B-data.md` |

## 0. Read before starting (binding)
1. `AGENTS.md`: the contract. If it conflicts with this brief, AGENTS.md wins; log the conflict in your review file.
2. `.agents/OWNERSHIP.md`: what you own vs only cross-link.
3. `.agents/REVIEW.md`: the checklist your work is judged against.
4. Your global/agent instructions still apply where they do not conflict.

## 1. Owner decisions and track-specific instructions
- Restructure 10 → 13 modules as in the dossier. Fix the mislabels (failover slots are PG17, and the module 08 "cascading maintenance" claim).
- Add PG19 deltas (RC at research time) as clearly labelled "PostgreSQL 19" sections. Teach 18.x as current until 19.0 GA.
- Keep PGlite for hermetic tests. Add `test:integration` with docker compose (pinned image tags) for multi-session MVCC/locking, replication, PgBouncer, PITR and AIO.
- Move the theory owned by `architecture/data-systems` out (isolation-anomaly taxonomy, B-tree theory, ARIES); keep the PG realisation and cross-link.
- Teach the **latest stable** versions. Add **Then vs now** comparisons wherever practice changed (AGENTS.md § Version Currency).
- Pin **all** tooling via mise (`.mise.toml` + `mise.lock`): node 26 for JS/TS, plus every CLI and runtime the examples need.

## 2. Ownership
**You own (full treatment):**
- SQL injection mechanics, row-level security

**Cross-link only (do not re-explain):**
- Data models, relational algebra, normal forms → owned by `architecture/data-systems`
- Storage engines: B-tree vs LSM, WAL/ARIES, compaction, buffer pools → owned by `architecture/data-systems`
- Isolation levels & anomaly taxonomy (Adya/Berenson), MVCC theory, SSI → owned by `architecture/data-systems`
- Indexing theory: inverted index, BM25, vector ANN (HNSW, IVF, quantisation) → owned by `architecture/data-systems`
- Replication mechanics (leader/follower, multi-leader, leaderless), sharding/rebalancing, CDC → owned by `architecture/data-systems`

## 3. Research dossier (verified 2026-10-27/28; re-verify before use)

#### PostgreSQL — `technologies/postgres` (EXISTING)

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

## 4. Re-verify list
These claims were marked unverified during research. Confirm or correct each one against a primary source before teaching it:
- 18.0 GA was 2025-09-25 (unverified exact day; it was Sept 2025).
- Tooling (verified locally against the npm registry today): `@electric-sql/pglite` **0.5.12** (PG 18.6); `testcontainers` / `@testcontainers/postgresql` **12.2.1**. Docker image `postgres:18.6` (tag assumed per Docker Hub convention; unverified).
- EDB PostgreSQL certification (EDB Certified Associate / Professional): https://www.enterprisedb.com/training (domain weights not published; unverified).
- **M10 "PostgreSQL 18 Synchronized Logical Replication Failover Slots":** failover slots and `sync_replication_slots` arrived in **PG17**, not 18. Re-label it as "PG17+", then add what PG18 actually changed (unverified specifics; check the PG18 release notes, "Logical replication" section).
- **M08 "PostgreSQL 18 Cascading Maintenance for Partitioned Tables":** what PG18 added is `VACUUM/ANALYZE ONLY` on a partitioned parent. "Cascading" may misdescribe this. Rewrite it against the PG18 release notes (unverified wording in module).
- **M07 EXPLAIN:** PG18 `EXPLAIN ANALYZE` includes `BUFFERS` by default (unverified; it is in the PG18 release notes as I recall). Check the module's guidance.
- **M01 security:** PG18 deprecates MD5 password auth (it warns), and `initdb` enables **data checksums by default** (unverified, from PG18 notes as I recall). Both are relevant to M01/M08.
- pgvector is a **separate npm package**: `@electric-sql/pglite-pgvector` 0.0.13 was found on npm (unverified that it is the official package name). PostGIS is `@electric-sql/pglite-postgis` 0.2.12.
- **Replication:** primary + streaming standby compose file; logical pub/sub between two containers; PG19 RC image for `WAIT` (`postgres:19rc1` tag, unverified).
- **PgBouncer:** container (`edoburu/pgbouncer` or `bitnami/pgbouncer`, image choice unverified) to prove the transaction-pooling breakages.
- **AIO:** `io_method=io_uring` only on a Linux host or VM (the Docker Desktop VM kernel may lack io_uring; unverified). Fallback: assert `SHOW io_method`/`pg_aios` view existence plus a qualitative benchmark marked "non-deterministic, not asserted".

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
1. **Primary (Opus)** works on branch `track/postgres` and sets this track's row in `.agents/STATUS.md` to 🟦.
2. **Verify versions first.** Check every version in the dossier against its primary source today. Record the results in the README's `Verified against …` line. Resolve every item in the re-verify list below.
3. Build in stages: README syllabus + exam matrix → modules one by one, each with its examples/tests → glossary → cheatsheet → question banks → mock exam. Delegate bulk drafting (question-bank drafts, glossary candidates, cheatsheet tables) to the **Drafter**, then correct and integrate it yourself.
4. Before each commit: run `mise exec -- npm test` and `npm run typecheck` (or the equivalents), and `test:integration` if present. Commit with Conventional Commits scoped `(postgres)`.
5. Self-check against `.agents/REVIEW.md`. Then set STATUS to 🟨 and write the hand-off at the top of `.agents/reviews/postgres.md`:
   - what was done;
   - what was not done, and why;
   - every claim you are least sure of.
6. The **Challenger** attacks it and the **Verifier** checks it independently. Both record findings in `.agents/reviews/postgres.md` (prompts in `.agents/KICKOFF.md`). The primary resolves the findings (🟧), Opus runs the final gate (🟪), and the owner merges (✅).
