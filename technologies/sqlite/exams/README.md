# SQLite: Certifications, Interview Format and Coverage Matrix

## 1. Is there a certification?

**No official SQLite certification exists.** The SQLite developers (Hwaci) sell support, licences for SEE and TH3, and consulting, but no exam. No recognised third-party certification targets SQLite specifically (checked 2026-11-04). Following AGENTS.md § Certification and Exam Coverage, priority 3, this track prepares for the recognised substitute:

| Format | Vendor | Status | Shape | Product version |
| --- | --- | --- | --- | --- |
| Senior backend / database engineering interview, SQLite deep-dive | none (industry practice) | active | Several 45–60 minute rounds: (1) internals Q&A (file format, B-trees, journal and WAL, locking, planner); (2) concurrency and failure-mode scenarios; (3) hands-on SQL or code with a real database; (4) system design, where "should this be SQLite, libSQL/Turso or PostgreSQL?" is a typical sub-question | SQLite 3.54.x; libSQL 3.45.1 base; Turso Database 0.8.x |

The academic anchor for the storage and transaction theory (CMU 15-445/645) is taught in [architecture/data-systems](../../../architecture/data-systems/README.md); this bank tests the SQLite realisation.

**Exam delta:** none. With no certification, there is no exam product version to diverge from. Questions must state version-dependent behaviour explicitly (for example "in SQLite 3.54" or "in better-sqlite3 13.0.3, which bundles 3.53.4").

## 2. Domain → module coverage matrix

Weights reflect how often each area appears in senior interview loops for SQLite-heavy backend roles (the track's own allocation; no official weights exist). Target counts are for [interview.md](./interview.md), totalling **75 questions**, with at least 5 per domain.

| # | Domain / objectives | Weight | Target Qs | Modules | Executable proofs | Status |
| --- | --- | --- | --- | --- | --- | --- |
| D1 | What SQLite is: appropriate uses, architecture layers, threading modes, bindings and bundled versions, compile-time defaults, result codes, CLI, limits | 6 % | 5 | [01](../modules/01-what-sqlite-is-bindings-and-cli.md) | [01](../examples/ts/01-what-sqlite-is.test.ts), [py](../examples/python/test_python_sqlite3.py) | ✅ |
| D2 | Type system and schema: affinity rules, comparison, STRICT, rowid / `INTEGER PRIMARY KEY`, `WITHOUT ROWID`, `AUTOINCREMENT`, constraints and conflict clauses, generated columns, foreign keys | 9 % | 6 | [02](../modules/02-type-system-and-schema.md) | [02](../examples/ts/02-type-system-and-schema.test.ts) | ✅ |
| D3 | SQL dialect: recursive CTEs, window frames, UPSERT vs `OR REPLACE`, `RETURNING`, JSON/JSONB, date/time incl. 3.54 modifiers, `ALTER TABLE` and the 12-step rebuild, SQLite-specific semantics | 8 % | 6 | [03](../modules/03-sql-dialect-and-features.md) | [03](../examples/ts/03-sql-dialect-and-features.test.ts) | ✅ |
| D4 | File format and storage: header fields, page types, table B+tree vs index B-tree, record format and varints, overflow, freelist, `VACUUM`, `auto_vacuum`, page cache, `dbstat` | 9 % | 6 | [04](../modules/04-file-format-and-b-trees.md) | [04](../examples/ts/04-file-format-and-b-trees.test.ts), [file-format.ts](../examples/ts/file-format.ts) | ✅ |
| D5 | Transactions and locking: lock states, DEFERRED/IMMEDIATE/EXCLUSIVE, deadlock and busy handling, atomic commit, hot journals, journal modes, savepoints, isolation | 11 % | 8 | [05](../modules/05-transactions-locking-and-rollback-journal.md) | [05](../examples/ts/05-transactions-and-locking.test.ts), [retry.ts](../examples/ts/retry.ts) | ✅ |
| D6 | WAL mode: WAL and wal-index, snapshots, `BUSY_SNAPSHOT`, commit path, checkpoint modes, starvation, `synchronous`, WAL-reset bug, wal2/`BEGIN CONCURRENT` branches | 11 % | 8 | [06](../modules/06-wal-mode.md) | [06](../examples/ts/06-wal-mode.test.ts), [checkpointer.ts](../examples/ts/checkpointer.ts) | ✅ |
| D7 | Query planner and VDBE: bytecode, `EXPLAIN QUERY PLAN`, index usability rules, covering/partial/expression indexes, LIKE optimisation, automatic indexes, statistics, `PRAGMA optimize`, skip-scan | 11 % | 8 | [07](../modules/07-query-planner-and-vdbe.md) | [07](../examples/ts/07-query-planner-and-vdbe.test.ts) | ✅ |
| D8 | Extensions: FTS5 (syntax, BM25, tokenizers, external content), R*Tree, virtual tables, user functions and aggregates, loadable extensions | 7 % | 5 | [08](../modules/08-extensions-fts5-rtree-and-virtual-tables.md) | [08](../examples/ts/08-extensions.test.ts) | ✅ |
| D9 | Application concurrency: capacity model, connection-per-thread, event-loop blocking, write queues and group commit, lost updates, network filesystems and containers, `fork()` | 10 % | 7 | [09](../modules/09-application-concurrency.md) | [09](../examples/ts/09-application-concurrency.test.ts), [write-queue.ts](../examples/ts/write-queue.ts) | ✅ |
| D10 | Durability and operations: durability chain, corruption causes and repair, live backups (backup API, `VACUUM INTO`), monitoring, migrations with `user_version`, sessions and changesets | 9 % | 6 | [10](../modules/10-durability-backup-and-operations.md) | [10](../examples/ts/10-durability-backup-and-operations.test.ts), [migrate.ts](../examples/ts/migrate.ts) | ✅ |
| D11 | Edge and distributed SQLite, system design: WASM + OPFS, WAL shipping / Litestream, LiteFS, rqlite, cr-sqlite, D1 / Durable Objects, when to graduate to PostgreSQL | 5 % | 5 | [11](../modules/11-edge-and-distributed-sqlite.md) | [11](../examples/ts/11-edge-and-distributed.test.ts) | ✅ |
| D12 | libSQL and Turso: lineage, version lag, vectors, embedded replicas, MVCC `BEGIN CONCURRENT`, CDC, encryption, sync, compatibility, decision guide | 4 % | 5 | [12](../modules/12-libsql-and-turso.md) | [12](../examples/ts/12-libsql-and-turso.test.ts), [integration](../examples/ts/integration/embedded-replica.test.ts) | ✅ |
|  | **Total** | **100 %** | **75** |  |  |  |

No row is ❌ or 🟡. Every domain is taught in full and backed by executable proofs.

## 3. Question bank structure and standards

The bank lives in [interview.md](./interview.md) and follows AGENTS.md § Certification and Exam Coverage exactly:

- **ID and header format:** `### Q-SQLITE-<NNN> · <Domain> · difficulty <1-3> · <single|multi|scenario|ordering|hands-on>`.
- **Counts:** the "Target Qs" column above (75 total, at least 5 per domain).
- **Type mix** (interview-realistic): about 40 % scenario (a production symptom, "what happened and what do you do"), 25 % single choice, 15 % multiple select, 10 % ordering (for example, the steps of a rollback-journal commit, the 12-step rebuild, a backup restore drill), 10 % hands-on.
- **Difficulty:** roughly 20 % level 1, 50 % level 2, 30 % level 3. Level-3 questions must be harder than a typical interview (for example: reasoning about which crash points are safe, predicting a plan change after `ANALYZE`, deriving the overflow local size).
- **Answers** in `<details>`: the correct answer, a concise explanation, **why each distractor is wrong**, a link to the teaching module **with a real anchor** (run `tools/link-check`), and an official doc URL on sqlite.org, nodejs.org or docs.turso.tech.
- **Hands-on tasks** must name the existing test that verifies them, for example "reproduce `SQLITE_BUSY_SNAPSHOT` with two connections: verified by `examples/ts/06-wal-mode.test.ts`, test 'a read transaction that becomes stale can never write'". Only reference tests that exist; add a new test in `examples/ts/` if a task needs one.
- **Every factual claim must come from the modules.** Where a module marks a claim as unverified (LiteFS and cr-sqlite status, for example), do not build a question on it.
- **Original questions only**; there is no exam to leak, but do not copy interview questions from public question sites either.
- **Mock interview** at the end: 30 questions, 60 minutes, domain mix proportional to the weights, at least 2 hands-on tasks and 2 design scenarios (one "SQLite or PostgreSQL?", one "replicate this to the edge"), with a scoring key (1 point per level-1, 2 per level-2, 3 per level-3 question; pass mark 70 %, "strong hire" bar 85 %).
