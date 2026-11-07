# SQLite 3.54: Internals, Operations and Distributed SQLite

> **Verified against SQLite 3.54.1 (upstream), node:sqlite in Node 26.12.1 (bundles 3.54.0), better-sqlite3 13.0.3 (3.53.4), @sqlite.org/sqlite-wasm 3.54.1-build1 (3.54.1), Python 3.15.2 `sqlite3` (3.53.1), @libsql/client 0.18.0 (3.45.1), @tursodatabase/database 0.8.3 (reports 3.50.4), TypeScript 7.0.2 on 2026-11-04.**

This track teaches SQLite from the file on disk upwards: the type system and dialect, the B-tree file format, the pager's locking and atomic-commit protocol, WAL mode, the query planner and VDBE bytecode, the bundled extensions, application-level concurrency, operations, and the edge and distributed descendants (browser WASM, libSQL and Turso). Each module ends with an Interview Drill. Every claim that can be proven on a laptop is proven by a deterministic test in [examples/](./examples/), including the multi-connection and multi-process behaviour (locks, `SQLITE_BUSY`, checkpoint starvation), which uses real files in temporary directories.

Theory owned by [architecture/data-systems](../../architecture/data-systems/README.md) (B-trees vs LSM, WAL/ARIES, isolation anomalies, MVCC, inverted indexes, vector ANN) is linked, not repeated. This track teaches how SQLite _realises_ it.

## Prerequisites

- SQL fluency (joins, aggregates, transactions) and the relational model from [data-systems Module 01](../../architecture/data-systems/modules/01-data-models-and-query-languages.md).
- Storage and transaction theory from data-systems [Module 02](../../architecture/data-systems/modules/02-storage-engines-b-trees-and-lsm.md), [Module 05](../../architecture/data-systems/modules/05-transactions-acid-and-isolation-levels.md) and [Module 06](../../architecture/data-systems/modules/06-durability-wal-and-crash-recovery.md). Each module here links to the exact section it builds on.
- TypeScript and Node.js basics. Python is used only where it teaches something specific (its `sqlite3` transaction semantics).

## Syllabus

| # | Module | Key topics | Proof |
| --- | --- | --- | --- |
| 01 | [What SQLite is, its architecture, bindings and the CLI](./modules/01-what-sqlite-is-bindings-and-cli.md) | appropriate uses, layered architecture, threading modes, bundled versions, compile-time defaults, result codes, CLI 3.54 changes, limits, testing culture | [01](./examples/ts/01-what-sqlite-is.test.ts), [py](./examples/python/test_python_sqlite3.py) |
| 02 | [Type system and schema](./modules/02-type-system-and-schema.md) | storage classes, affinity rules, comparison semantics, STRICT, rowid and `INTEGER PRIMARY KEY`, `WITHOUT ROWID`, `AUTOINCREMENT`, generated columns, constraints, foreign keys | [02](./examples/ts/02-type-system-and-schema.test.ts) |
| 03 | [SQL dialect and features](./modules/03-sql-dialect-and-features.md) | CTEs, window functions, UPSERT, RETURNING, JSON and JSONB, date/time (3.54 modifiers), `printf` `%j`, ALTER TABLE (3.53 NOT NULL) and the 12-step rebuild, triggers, NULL quirks | [03](./examples/ts/03-sql-dialect-and-features.test.ts) |
| 04 | [File format and B-trees](./modules/04-file-format-and-b-trees.md) | header, page types, cell format, varints, record format, overflow pages, freelist, `page_size`, `auto_vacuum`, `VACUUM`, `dbstat` | [04](./examples/ts/04-file-format-and-b-trees.test.ts) |
| 05 | [Transactions, locking and the rollback journal](./modules/05-transactions-locking-and-rollback-journal.md) | lock states, DEFERRED/IMMEDIATE/EXCLUSIVE, atomic commit, hot journals, savepoints, `SQLITE_BUSY`, busy timeout, isolation | [05](./examples/ts/05-transactions-and-locking.test.ts) |
| 06 | [WAL mode](./modules/06-wal-mode.md) | WAL file and wal-index, snapshots, checkpoints, starvation, `synchronous`, `BUSY_SNAPSHOT`, the WAL-reset bug, wal2 and `BEGIN CONCURRENT` branches | [06](./examples/ts/06-wal-mode.test.ts) |
| 07 | [Query planner and VDBE](./modules/07-query-planner-and-vdbe.md) | `EXPLAIN` bytecode, `EXPLAIN QUERY PLAN`, NGQP, covering/partial/expression indexes, `ANALYZE`, `PRAGMA optimize`, LIKE optimisation, automatic indexes | [07](./examples/ts/07-query-planner-and-vdbe.test.ts) |
| 08 | [Extensions and virtual tables](./modules/08-extensions-fts5-rtree-and-virtual-tables.md) | FTS5 (BM25, tokenizers, external content), R*Tree, `dbstat`, user functions and aggregates, loadable extensions, sqlite-vec | [08](./examples/ts/08-extensions.test.ts) |
| 09 | [Concurrency in applications](./modules/09-application-concurrency.md) | one-writer rule, connection per thread, write queues, `BEGIN IMMEDIATE`, event-loop blocking, multi-process access, network filesystems | [09](./examples/ts/09-application-concurrency.test.ts) |
| 10 | [Durability, backup and operations](./modules/10-durability-backup-and-operations.md) | fsync and `synchronous`, how to corrupt, online backup, `VACUUM INTO`, integrity checks, migrations with `user_version`, sessions and changesets | [10](./examples/ts/10-durability-backup-and-operations.test.ts) |
| 11 | [SQLite at the edge and distributed SQLite](./modules/11-edge-and-distributed-sqlite.md) | WASM + OPFS, Litestream, LiteFS, rqlite, cr-sqlite, D1 and Durable Objects, when to graduate to Postgres | [11](./examples/ts/11-edge-and-distributed.test.ts) |
| 12 | [libSQL and Turso](./modules/12-libsql-and-turso.md) | lineage, libSQL vectors and embedded replicas, Turso Database MVCC `BEGIN CONCURRENT`, CDC, sync, compatibility matrix, decision guide, version history | [12](./examples/ts/12-libsql-and-turso.test.ts) |

### Out of scope

| Topic | Reason |
| --- | --- |
| B-tree, LSM, ARIES and isolation theory | Owned by [architecture/data-systems](../../architecture/data-systems/README.md). Linked from each module. |
| Writing C extensions and custom VFSes | Requires a C toolchain; the module explains the interfaces and uses JavaScript user functions instead. |
| SEE (SQLite Encryption Extension) and SQLCipher internals | Proprietary or third-party; mentioned in Module 10 for orientation only. |
| Cloudflare D1 and Durable Objects internals | Owned by the planned Cloudflare/edge track; Module 11 compares them only. |
| Vector ANN theory (HNSW, DiskANN) | Owned by [data-systems Module 03](../../architecture/data-systems/modules/03-indexing-theory-and-vector-search.md). |

## Bindings and bundled SQLite versions

Every binding compiles its own copy of SQLite. The engine you run is the one your binding bundles, with the compile-time options its maintainers picked. **Every test suite in this track asserts `sqlite_version()` first.**

| Binding (exact pin) | `sqlite_version()` | Notable build defaults |
| --- | --- | --- |
| SQLite CLI / amalgamation 3.54.1 (2026-10-16) | 3.54.1 | Upstream defaults: foreign keys off, DQS on; CLI adds `generate_series`, `.diskused`, `.recover`. |
| `@sqlite.org/sqlite-wasm` 3.54.1-build1 (official WASM build) | 3.54.1 | `THREADSAFE=0`, no loadable extensions, 8 KiB default pages, `bytecode()` vtab, session extension; OPFS VFSes only in browser workers. |
| `node:sqlite`, Node 26.12.1 | 3.54.0 | Release candidate (Stability 1.2). `enableForeignKeyConstraints` and `defensive` default to `true`. Session extension built in. |
| `better-sqlite3` 13.0.3 | 3.53.4 | `DEFAULT_FOREIGN_KEYS`, `DQS=0`, `DEFAULT_WAL_SYNCHRONOUS=1`, FTS5, R*Tree, `dbstat`, STAT4, math and percentile functions. |
| Python 3.15.2 `sqlite3` | 3.53.1 | Stock defaults (foreign keys off, DQS on). The legacy `isolation_level` behaviour stays the default. |
| `@libsql/client` 0.18.0 | 3.45.1 | libSQL fork: vectors (`F32_BLOB`, `libsql_vector_idx`), remote and embedded-replica URLs. Lacks every upstream change since 3.45. |
| `@tursodatabase/database` 0.8.3 | 3.50.4 (reported) | Rust rewrite: MVCC `BEGIN CONCURRENT`, CDC, vector functions. No FTS5, no SQLite C extensions. |

## Run the proofs

```bash
mise install                 # node 26.12.1, python 3.15.2, uv 0.13.6, typescript 7.0.2
npm ci
npm run typecheck            # tsc 7 over examples/ts
npm test                     # node --test (TypeScript, type-stripped) + pytest via uv
npm run test:ts              # TypeScript suites only
npm run test:py              # Python suite only
node --test examples/ts/06-wal-mode.test.ts   # one module
```

- All tests are hermetic: they create database files in a fresh temporary directory and delete it afterwards. Multi-process tests spawn `node` child processes against the same file.
- Nothing needs Docker. `test:integration` runs [examples/ts/integration/](./examples/ts/integration/), which needs a Turso Cloud account or a local `sqld` and **skips with a message** when the environment variables are absent.
- **The `sqlite3` CLI is not pinned by mise.** The mise registry has a `sqlite` entry, but its backend and prebuilt availability for 3.54.1 could not be verified for every platform. Use your OS package (`brew install sqlite`, or the official precompiled binaries from sqlite.org) and check `sqlite3 --version`. Without it, `uv run python -m sqlite3 file.db` gives a minimal shell over Python's bundled 3.53.1.
- `mise.lock` is committed, pinning exact tool versions for `linux-x64` and `macos-arm64`.

## Certifications & Exams

**No official SQLite certification exists.** The SQLite project (Hwaci) offers paid support and licences but no exam, and no recognised third-party certification targets SQLite specifically (checked 2026-11-04). This track therefore prepares for the **senior backend / database engineering interview format**: a technical deep-dive on storage internals and transactions, a concurrency and failure-mode round, a system-design round in which "should this be SQLite?" is a common question, and hands-on SQL.

| Exam / format | Vendor | Status | Format | Track coverage |
| --- | --- | --- | --- | --- |
| Senior backend / database interview (SQLite deep-dive) | none (industry format) | active practice | 45–60 min rounds: internals Q&A, scenario and failure-mode questions, live SQL or code, design trade-offs | [exams/README.md](./exams/README.md) matrix; [exams/interview.md](./exams/interview.md): 75 original questions and a 30-question, 60-minute mock interview with a scoring key |

The interview domains, their weights and the module mapping are in [exams/README.md](./exams/README.md). The CMU 15-445 storage and concurrency material is the academic anchor; it is taught in [architecture/data-systems](../../architecture/data-systems/README.md).

## Reference

- [CHEATSHEET.md](./CHEATSHEET.md): pragmas, connection-open checklist, lock states, checkpoint modes, planner output, JSON and date functions.
- [GLOSSARY.md](./GLOSSARY.md): English ↔ Czech terms specific to SQLite.
- Primary sources: [sqlite.org/docs.html](https://www.sqlite.org/docs.html), [file format](https://www.sqlite.org/fileformat2.html), [atomic commit](https://www.sqlite.org/atomiccommit.html), [WAL](https://www.sqlite.org/wal.html), [locking](https://www.sqlite.org/lockingv3.html), [query planner](https://www.sqlite.org/queryplanner-ng.html), [VDBE opcodes](https://www.sqlite.org/opcode.html), [release history](https://www.sqlite.org/changes.html).
