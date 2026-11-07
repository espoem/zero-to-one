# Review: sqlite

Branch `track/sqlite`. Primary: Opus (Claude Code, operator session), 2026-11-04/05. All modules, examples and the exams README were written by the primary; no companion output has been integrated yet.

## Hand-off

**State: 🟨 challenge + verify complete → ready for 🟪 final gate.**

### Done, module by module

| Module | Lines | Proof (tests) | Highlights |
| --- | --- | --- | --- |
| 01 What SQLite is, bindings, CLI | 399 | `01-what-sqlite-is.test.ts` (18) + Python suite (7) | bundled-version assertions for 5 bindings; compile-option differences (FK, DQS, WAL sync); header offset 96; version gate with denylist |
| 02 Type system and schema | 402 | `02-…` (25) | all five affinity rules incl. `STRING`/`FLOATING POINT` traps; STRICT; rowid boundary at 2^63−1; FK pragmas; BigInt loss |
| 03 SQL dialect | 403 | `03-…` (35) | recursive CTE, window frames, UPSERT vs OR REPLACE, JSONB, 3.54 date modifiers and `%j` on node:sqlite, 3.53 SET NOT NULL, 12-step rebuild + DROP TABLE cascade trap |
| 04 File format and B-trees | 396 | `04-…` (17) + `file-format.ts` reader | header, page types, varint round-trip (500 samples), record decode from raw bytes, overflow formula, freelist, VACUUM, auto_vacuum, dbstat |
| 05 Transactions and rollback journal | 394 | `05-…` (20) + `retry.ts` | lock states with 3 connections; deadlock BUSY bypasses busy handler; cross-process BEGIN IMMEDIATE wait; SIGKILL hot-journal recovery; MEMORY-journal crash loses atomicity; defensive mode refuses journal_mode=OFF |
| 06 WAL mode | 378 | `06-…` (17) + `checkpointer.ts` | snapshots, BUSY_SNAPSHOT immune to busy_timeout, checkpoint modes, measured starvation, journal_size_limit, WAL frames decoded, exclusive-mode WAL without -shm |
| 07 Planner and VDBE | 315 | `07-…` (19) | bytecode listing, cursors for covering indexes, prefix rule, partial/expression indexes, automatic index, ANALYZE stat1 numbers, skip-scan, stale-stats negative, LIKE/GLOB conditions |
| 08 Extensions | 282 | `08-…` (15) | FTS5 syntax/BM25/weights/tokenizers (Czech diacritics, porter, trigram), external content + ghost-row negative, fts5vocab, R*Tree float32, deterministic functions in indexes, window aggregate, JS table-valued function |
| 09 Application concurrency | 242 | `09-…` (9) + `write-queue.ts` | event-loop lag vs worker thread; deterministic lost update; 8 workers × 200 IMMEDIATE increments = 1600; DEFERRED variant fails with BUSY*; group-commit queue with per-job savepoints |
| 10 Durability, backup, operations | 281 | `10-…` (14) + `migrate.ts` | VACUUM INTO, backup API (restart trap), node:sqlite backup, serialize, injected corruption + REINDEX repair, data_version, migrations, changesets with conflict abort |
| 11 Edge and distributed | 190 | `11-…` (6) | official WASM 3.54.1 build options; WASM→native file portability; WAL shipping replica incl. torn copy |
| 12 libSQL and Turso | 292 | `12-…` (11) + integration (skips) | libSQL version lag, STRICT/JSONB present, vectors + dimension trap, batch/transaction; Turso MVCC disjoint + conflict + retry, CDC, encryption, no FTS5; release history table |

Also: `README.md` (syllabus, bindings table, run instructions, Certifications & Exams with "no certification" statement, Verified line), `exams/README.md` (interview format, domain matrix, target counts, drafter spec), `CHEATSHEET.md` (connection-open checklist stub only).

### Test command output summary (Node 26.12.1, Python 3.15.2 via uv 0.13.6)

```
npm run typecheck      → tsc 7.0.2: 0 errors
npm test               → node --test: 206 tests, 206 pass, 0 fail; pytest: 7 passed
npm run test:integration → 1 skipped (TURSO_DATABASE_URL not set)
mermaid-check 9 diagrams 0 failing · table-check 100 tables 0 failing · link-check 284 links 0 broken (pending: exams/interview.md, GLOSSARY.md)
```

## Drafter spec

The Drafter writes three files from the modules (and only from them). Opus reviews before merge.

### 1. `exams/interview.md`

Follow [`technologies/sqlite/exams/README.md`](../../technologies/sqlite/exams/README.md) § 3 exactly: 75 questions with per-domain counts from the matrix, type and difficulty mix, distractor explanations, module anchors that pass link-check, official doc URLs, hands-on tasks tied to named existing tests, and a 30-question / 60-minute mock with a scoring key.

### 2. `GLOSSARY.md` (EN ↔ CZ, established terms only)

Format like `technologies/postgres/GLOSSARY.md`: term · Czech equivalent · one-line English definition · module link. Reuse the root `GLOSSARY.md` wording verbatim for shared terms (transaction, B-tree, write-ahead log, checkpoint, isolation, MVCC, snapshot isolation, index, inverted index, full-text search, CDC, replication, idempotency). If no established Czech term exists, keep the English term and say so; never invent one. Terms to cover:

- Module 01: embedded database, serverless (SQLite sense), amalgamation, connection, prepared statement, VDBE, VFS, threading mode, compile-time option, result code / extended result code, `SQLITE_BUSY`, `SQLITE_LOCKED`, application file format, URI filename.
- Module 02: storage class, type affinity, manifest typing, STRICT table, rowid, rowid alias (`INTEGER PRIMARY KEY`), `WITHOUT ROWID` table, `AUTOINCREMENT`, conflict resolution algorithm, generated column (virtual/stored), foreign key enforcement, deferred constraint, collating sequence (BINARY/NOCASE/RTRIM), schema table (`sqlite_schema`).
- Module 03: common table expression, recursive CTE, window frame (ROWS/RANGE/GROUPS), UPSERT, `RETURNING`, JSONB, bare column, 12-step table rebuild, date modifier.
- Module 04: page, database header, B+tree (table B-tree), index B-tree, cell, cell pointer array, varint, record, serial type, overflow page, freelist, `VACUUM`, auto-vacuum, pointer-map page, lock-byte page, page cache, `dbstat`.
- Module 05: lock states (SHARED, RESERVED, PENDING, EXCLUSIVE), rollback journal, hot journal, atomic commit, commit point, busy handler / busy timeout, deferred/immediate/exclusive transaction, savepoint, statement journal, super-journal, journal mode.
- Module 06: WAL file, wal-index (`-shm`), frame, commit frame, read mark, snapshot, checkpoint (PASSIVE/FULL/RESTART/TRUNCATE), checkpoint starvation, `synchronous`, `SQLITE_BUSY_SNAPSHOT`, WAL reset.
- Module 07: query planner (NGQP), bytecode / opcode, cursor, `EXPLAIN QUERY PLAN`, covering index, partial index, expression index, automatic index, skip-scan, `ANALYZE` / `sqlite_stat1` / `sqlite_stat4`, Bloom filter, LIKE optimisation, selectivity.
- Module 08: virtual table, shadow table, FTS5, tokenizer, stemming, trigram, BM25, external-content table, R*Tree, application-defined function, deterministic function, loadable extension, `trusted_schema`.
- Module 09: single-writer model, connection per thread, event loop blocking, worker thread, write queue, group commit, lost update, optimistic concurrency, network filesystem.
- Module 10: durability, fsync, `fullfsync`, corruption, integrity check, online backup API, `VACUUM INTO`, point-in-time recovery, `user_version` migration, session extension, changeset, patchset, encryption at rest.
- Modules 11–12: WebAssembly, OPFS, WAL shipping, read replica, consensus (Raft), CRDT, edge database, embedded replica, fork (software), MVCC, `BEGIN CONCURRENT`, write-write conflict, last-write-wins, vector index (ANN, DiskANN).

### 3. `CHEATSHEET.md` (extend the existing file; keep the "Connection-open checklist" heading, which module 01 links to)

Sections, each a compact table or code block with a module link:

1. Connection-open checklist (exists; verify against modules 01, 05, 06, 07).
2. Bindings and bundled versions (copy from README).
3. Affinity rules and STRICT types (module 02 § 1.2, § 2).
4. rowid / `INTEGER PRIMARY KEY` / `AUTOINCREMENT` / `WITHOUT ROWID` decision table.
5. Modern dialect: UPSERT, RETURNING, window frames, JSON operators, date modifiers (incl. 3.54), with version-introduced column.
6. ALTER TABLE abilities and the 12-step procedure (module 03 § 7).
7. File header offsets and page types (module 04 §§ 2–4).
8. Lock states and BEGIN modes, what busy_timeout can and cannot fix (module 05 § 2, § 3, § 7).
9. Journal modes and `synchronous` levels (modules 05 § 6, 06 § 5).
10. Checkpoint modes and WAL troubleshooting (module 06 § 6).
11. EXPLAIN QUERY PLAN vocabulary and index-usability rules (module 07 §§ 3–4, 6).
12. FTS5 query syntax, bm25, tokenizers (module 08 § 2).
13. Backup methods comparison and integrity commands (module 10 §§ 2–3).
14. libSQL vs Turso Database vs SQLite quick comparison (module 12). Every pragma and SQL line in the cheatsheet must already appear in a module.

## Remaining work (ordered)

1. **Drafter:** `exams/interview.md`, `GLOSSARY.md`, extended `CHEATSHEET.md` per the spec above. **Opus:** review and correct them (spot-check at least 15 questions), then run all gates with `LINK_CHECK_PENDING` empty.
2. **Depth top-up (P2):** modules 07–12 are below the 400-line rule of thumb (190–315 lines; long-line prose, so the content density is higher than the count suggests). Candidates: 07 (worked tuning example with before/after plans), 08 (FTS5 ranking functions in JS, Geopoly example), 09 (Python sqlite3 threading / `check_same_thread`, multi-process test with PM2-like workers), 10 (Litestream-style restore drill script), 11 (rqlite/LiteFS deeper with sequence diagrams), 12 (Hrana protocol, sqld self-hosting).
3. **`mise.lock`:** not generated (no mise binary here). Run `mise lock` in `technologies/sqlite` on a machine with mise and commit it. The `sqlite3` CLI is deliberately not pinned (mise registry has a `sqlite` entry but its backend and per-platform availability for 3.54.1 were not verifiable); decide whether to add it after testing `mise use sqlite@3.54.1`.
4. **STATUS.md:** not edited (the author prompt forbids it, the brief asked for 🟦/🟨). Integrator: set the sqlite row.
5. Integration test against a real primary (`TURSO_DATABASE_URL`, or a local `sqld` container pinned by digest) has never run. Add a docker-compose for `sqld` (image tag unverified) and run it on the Mac.
6. Re-verify the "Verified against … on 2026-11-04" line at merge time (SQLite news page, npm versions of better-sqlite3, @libsql/client, @tursodatabase/database, @sqlite.org/sqlite-wasm, Node 26.x).

## Least-certain claims (for the Challenger)

- Module 05 § 2.1: unix VFS lock byte layout (PENDING 0x40000000, RESERVED +1, SHARED 510 bytes from +2) is from memory of `os_unix.c`/lockingv3, not re-fetched.
- Module 05 § 7: busy-handler back-off schedule (1, 2, 5, 10, 15, 20, 25, 25, 25, 50, 50, 100 ms) from memory of `sqliteDefaultBusyCallback`.
- Module 05 § 6: `node:sqlite` accepted `journal_mode=OFF` despite `defensive: true` in this track's probe; better-sqlite3 13 refused it. The root cause (which DBCONFIG flag) was not traced.
- Module 06 § 2.3: wal-index layout (136-byte header with two 48-byte copies, 32 KiB hash blocks, 8192-slot hash) from memory of walformat.html; "small fixed set of read marks" intentionally not numbered.
- Module 06 § 9: wal2 / begin-concurrent "not merged" relies on a 2023 forum statement plus absence from 3.53/3.54 release logs.
- Module 07 § 7.3 / § 3: skip-scan threshold left vague on purpose; `analysis_limit` introduced in 3.32.0 and `PRAGMA optimize` in 3.18.0 from memory.
- Module 08 § 2.4: trigram `remove_diacritics` since 3.45; detail=column/none behaviour summarised from memory.
- Module 10 §§ 2.1, 8: `.recover` 3.29.0, `sqlite3_recover` API 3.40.0, `integrity_check(table)` 3.33.0 from memory; `cksumvfs` description.
- Module 10 § 1: macOS `fullfsync` defaults; "consumer SSDs may acknowledge flushes early" is a general claim.
- Module 11 § 4: LiteFS and cr-sqlite maintenance status marked `(unverified)`; rqlite rewriting of `random()`/time functions from memory; D1 sessions API description.
- Module 11 § 3.2: Litestream holding a long-lived read transaction and performing checkpoints (documented for 0.3.x; assumed unchanged in 0.5.x).
- Module 12: libSQL `readYourWrites` semantics (option exists in 0.18 types; default and exact semantics not verified); whether libSQL backported the WAL-reset fix; Turso Cloud January 2025 deprecations come from the research dossier, not re-fetched; ORM caveat likewise. COMPAT.md says `WITH RECURSIVE` is unsupported, yet a simple recursive CTE ran on 0.8.3.
- Module 01 § 4: Python 3.15.2 cache_size "build-dependent"; README says no third-party SQLite certification exists (checked by search, not exhaustive).
- The brief's claim that libSQL misses STRICT/JSONB was **wrong** (proven present); brief claim "better-sqlite3 12.x" superseded by 13.0.3 (Node-API).

## Proposals for integrator

- **Root GLOSSARY candidates** (cross-cutting): write-ahead log frame / checkpoint starvation (if data-systems wants them), group commit (data-systems already covers it), optimistic concurrency control, last-write-wins, CRDT (distributed-systems), Bloom filter (dsa).
- **OWNERSHIP.md:** register "Embedded/edge SQLite replication tools (Litestream, LiteFS, rqlite, cr-sqlite)" → `technologies/sqlite` (M11), cross-link from data-systems M07 and the planned cloudflare track. Register "SQLite WASM / OPFS" → `technologies/sqlite` (M11).
- **Cross-track handovers:** the planned Cloudflare track should link `modules/11-edge-and-distributed-sqlite.md#5-sqlite-on-edge-platforms` for D1/Durable Objects SQLite semantics. `languages/javascript` could link module 09 § 3 for event-loop blocking by synchronous native add-ons.
- **Conflict log (brief vs AGENTS.md / author prompt):** the brief asks to set STATUS 🟦/🟨, the author prompt forbids editing STATUS.md, so it was left untouched. The author prompt's "Verified … on 2026-10-28" date was replaced by the actual verification date, 2026-11-04.
- **Tooling note:** better-sqlite3 13 makes `node:test` + type-stripping work without any build step; the same harness (`examples/ts/*.test.ts`, `helpers.ts` asserting `sqlite_version()`) could be reused by other database tracks.

## Running log (primary: Opus, Claude Code)

- Scaffolding: package.json (exact pins), tsconfig, .mise.toml, Python uv project, helpers, README, cheatsheet stub.
- Module 01 + `examples/ts/01-what-sqlite-is.test.ts` + `examples/python/test_python_sqlite3.py`.
- Module 02 + examples/ts/02-type-system-and-schema.test.ts (25 tests).
- Module 03 + examples/ts/03-sql-dialect-and-features.test.ts (35 tests).
- Module 04 + examples/ts/file-format.ts (byte-level reader) + 04 test (17 tests).
- Module 05 + examples/ts/05-transactions-and-locking.test.ts (20 tests, incl. SIGKILL hot-journal and MEMORY-journal crash proofs) + examples/ts/retry.ts.
- Module 06 + examples/ts/06-wal-mode.test.ts (17 tests: snapshots, BUSY_SNAPSHOT, checkpoint modes, measured starvation, WAL format) + examples/ts/checkpointer.ts.
- Module 07 + examples/ts/07-query-planner-and-vdbe.test.ts (19 tests).
- Module 08 + examples/ts/08-extensions.test.ts (15 tests).
- Module 09 + examples/ts/09-application-concurrency.test.ts (9 tests, worker_threads) + examples/ts/write-queue.ts.
- Module 10 + examples/ts/10-durability-backup-and-operations.test.ts (14 tests) + examples/ts/migrate.ts.
- Module 11 + examples/ts/11-edge-and-distributed.test.ts (6 tests: official WASM 3.54.1, file portability, WAL shipping incl. torn copy). Added @sqlite.org/sqlite-wasm 3.54.1-build1.
- Module 12 + examples/ts/12-libsql-and-turso.test.ts (11 tests: libSQL version lag, vectors, batch/transaction; Turso MVCC concurrent/conflict, CDC, encryption, no FTS5) + examples/ts/integration/embedded-replica.test.ts (skips without TURSO_DATABASE_URL).

## Drafter output (2026-11-05)

Delivered: `technologies/sqlite/exams/interview.md` (75 questions + 30-question mock with scoring key), `technologies/sqlite/GLOSSARY.md` (141 terms), extended `technologies/sqlite/CHEATSHEET.md` (14 sections, "Connection-open checklist" heading kept). Gates (mermaid-check, table-check, link-check with the four pending tracks) all report 0 failures; the Python suite passes (7 passed via uv). No code or tests were changed. Commits carry no trailers (AGENTS.md rule 7).

### Counts per domain

| Domain | Questions | IDs     |
| ------ | --------- | ------- |
| D1     | 5         | 001-005 |
| D2     | 6         | 006-011 |
| D3     | 6         | 012-017 |
| D4     | 6         | 018-023 |
| D5     | 8         | 024-031 |
| D6     | 8         | 032-039 |
| D7     | 8         | 040-047 |
| D8     | 5         | 048-052 |
| D9     | 7         | 053-059 |
| D10    | 6         | 060-065 |
| D11    | 5         | 066-070 |
| D12    | 5         | 071-075 |

Actual mix: types 30 scenario, 20 single, 11 multi, 9 hands-on, 5 ordering (target 40/25/15/10/10 %: ordering is light, hands-on slightly heavy); difficulty 14 / 40 / 21 for levels 1 / 2 / 3 (target 20/50/30 %: level 1 and 3 slightly under). All 9 hands-on questions name an existing test, so no "Verification: TODO(opus)" stubs were needed. Mock: 30 questions (4 / 16 / 10 by level, 66 points; pass 47, strong hire 57), 3 hands-on (items 2, 10, 16), 2 design scenarios (Q-069 SQLite or PostgreSQL, Q-070 replicate to the edge).

### Uncertain Czech terms (kept as italic English in the glossary, not translated)

serverless, amalgamation, threading mode, storage class, type affinity, manifest typing, STRICT table, rowid, rowid alias, bare column, cell, varint, serial type, pointer-map page, lock-byte page, rollback journal, hot journal, busy handler, statement journal, super-journal, journal mode, wal-index, frame, commit frame, read mark, checkpoint starvation, WAL reset, expression index, automatic index, skip-scan, shadow table, external-content table, online backup API, session extension, changeset / patchset, WAL shipping, edge database, embedded replica, last-write-wins.

Czech terms I used but am only moderately sure are "established": "Bod potvrzení" (commit point), "Seznam volných stránek (freelist)", "Pole ukazatelů na buňky", "Dvanáctikrokové přestavění tabulky", "Zkouška obnovy ze zálohy", "Model jediného zapisovatele", "Algoritmus řešení konfliktů", "Privátní souborový systém původu (OPFS)", "Fork (odštěpený projekt)", "Zachytávání změn dat (CDC)". Terms taken from other glossaries (upsert, CTE, window frame, trigger, Bloom filter, group commit, Raft, CRDT, ANN) and the six root terms (MVCC, WAL, B-tree, PITR, ACID, Idempotence; copied verbatim) are consistent with those files. The root glossary has no entries for transaction, checkpoint, snapshot, isolation, index, inverted index, full-text search, CDC, replication, so the spec's "reuse verbatim" list was only applicable to the six above.

### Questions I am unsure about (please spot-check)

- Q-SQLITE-021: overflow derivation done by hand (M = 489, K = 1816, 2 overflow pages); the module's formula is for table-leaf cells and assumes the 10,000 bytes are the whole record payload.
- Q-SQLITE-052 and Q-SQLITE-064: rest on module claims flagged as less certain (innocuous / trusted_schema wording; macOS `fullfsync` defaults).
- Q-SQLITE-067: the module only says application checkpoints "fight" Litestream; the symptom "replication gaps and errors" is my extrapolation.
- Q-SQLITE-073, Q-SQLITE-070, Q-SQLITE-072: build on module 12 claims that were not re-verified (`readYourWrites`, embedded-replica behaviour, libSQL base 3.45.1). I deliberately avoided asserting that libSQL has or lacks the WAL-reset fix, and I did not use LiteFS or cr-sqlite status.
- Q-SQLITE-038: the "not affected" set (3.51.3, 3.53.4, 3.50.7) follows module 06 § 7; 3.49.0 is "affected" only by inference from the 3.7.0 to 3.51.2 range.
- Q-SQLITE-005: the denylist entry for the withdrawn 3.52.0 comes from module 01's `version-gate` listing.
- Official-doc URLs: where I could not confirm a page anchor I linked the page, not the anchor. `docs.turso.tech` is linked at site level for Q-070/071/072/073 because I did not fetch the specific pages (no WebFetch was done in this pass; URLs outside the modules' own citations are from memory of the sqlite.org doc set).
- README.md line mentioning interview.md "being drafted" and the exams/README.md "(to be drafted)" wording were not edited.

## Integration run (2026-11-06, Claude Code & Antigravity)

- **Service & Environment Versions:**
  - `sqld` / libSQL Server: `v0.24.33` (`ghcr.io/tursodatabase/libsql-server:v0.24.33@sha256:f8ca0134cdded747793888e48591aece07647d9d598d3ac229aabfa93159ca88`)
  - `@libsql/client`: `0.14.0`
  - Node.js: `26.12.1`
- **Findings & Verification:**
  - Docker Compose: added `technologies/sqlite/docker-compose.yml` launching local `sqld` primary with healthcheck on `127.0.0.1:18080`.
  - Integration suite: executed `examples/ts/integration/embedded-replica.test.ts` against local `sqld` (`TURSO_DATABASE_URL=http://127.0.0.1:18080`).
  - Confirmed Module 12 claims: verified that reads are served locally from the embedded replica, writes forward to the primary, and with `readYourWrites: false` writes remain invisible on the local replica until `replica.sync()` pulls WAL frames from the primary. After `replica.sync()`, committed rows are immediately visible.
- **Results:**
  - `npm test`: 206/206 Node tests passed, 7/7 Python tests passed.
  - `npm run test:integration`: passed (1/1 tests passed, 0 skipped, 0 failed).
  - `typecheck`: 0 errors.

## Challenger and Verifier Gate (2026-11-07)

Companion verification and adversarial audit completed on `track/sqlite`.

### 1. Modules, proofs and hermetic test suites

- All 12 lesson modules (01–12) reviewed for technical rigor, formal mechanics, and progressive depth.
- Hermetic test suites executed and verified:
  - TypeScript suite (`node --test` via type-stripping): 206 tests across 12 module suites, all passing (0 failures).
  - Python suite (`uv run --directory examples/python pytest`): 7 tests in `test_python_sqlite3.py`, all passing.
  - Typecheck (`mise exec -- npm run typecheck` with tsc 7.0.2): 0 errors.
- Tooling lockfile: `technologies/sqlite/mise.lock` generated and committed for `linux-x64` and `macos-arm64`.

### 2. Live service integration (`sqld` / libSQL)

- Verified `examples/ts/integration/embedded-replica.test.ts` against local `sqld` container (`ghcr.io/tursodatabase/libsql-server:v0.24.33@sha256:f8ca0134cdded747793888e48591aece07647d9d598d3ac229aabfa93159ca88`).
- Confirmed libSQL embedded-replica mechanics: local reads execute against local SQLite file, writes forward to the primary server over HTTP/libSQL protocol, and with `readYourWrites: false` writes remain invisible locally until `replica.sync()` pulls frames. Suite executed with 1/1 passing (0 skipped, 0 failed).

### 3. Exam bank and mock interview audit

- `technologies/sqlite/exams/interview.md` audited against `technologies/sqlite/exams/README.md` and `AGENTS.md`:
  - 75 original domain questions across D1–D12 matching exact target counts (D1: 5, D2: 6, D3: 6, D4: 6, D5: 8, D6: 8, D7: 8, D8: 5, D9: 7, D10: 6, D11: 5, D12: 5).
  - 30-question, 60-minute mock exam with scoring key (66 points; pass 47, strong hire 57).
  - Hands-on tasks tie to existing deterministic test assertions in `examples/ts/`.
  - Question types and difficulties match distribution requirements.

### 4. Drafter-flagged questions and least-certain claims resolved

- **`Q-SQLITE-005` (Startup version gate):** Verified floor logic and denylist range (`3.7.0` to `3.51.2` with backport exemptions `3.44.6` and `3.50.7`, plus withdrawn `3.52.0`). Matches `examples/ts/version-gate.ts`, tests in `01-what-sqlite-is.test.ts`, and Module 01 § 3.2.
- **`Q-SQLITE-021` (Overflow page arithmetic):** Verified against Module 04 § 6, `examples/ts/file-format.ts`, and `04-file-format-and-b-trees.test.ts`. With $U = 4096$, $X = 4061$, $M = 489$: for $P = 10,000$, $K = 489 + ((10000 - 489) \bmod 4092) = 1816 \le X$, yielding exactly 1816 bytes local payload and $(10000 - 1816) / 4092 = 2$ overflow pages.
- **`Q-SQLITE-038` (WAL-reset bug affected range):** Verified against Module 06 § 7 and upstream CVE advisory. Range `3.7.0`..`3.51.2` is affected; `3.51.3`, $\ge 3.53.0$, and backports `3.44.6` and `3.50.7` are unaffected. Options correctly identify `3.51.3`, `3.53.4`, and `3.50.7` as not affected.
- **`Q-SQLITE-052` (Application-defined schema functions):** Verified against Module 08 § 6.2 and § 7. Expression indexes require deterministic functions, unregistered connections fail on write, and `PRAGMA trusted_schema = OFF` restricts schema-invoked functions to innocuous ones.
- **`Q-SQLITE-064` (Durability chain):** Verified against Module 10 § 1. `kill -9` proves crash atomicity rather than power loss durability; WAL with `synchronous = NORMAL` can lose recent transactions on power failure; macOS requires `PRAGMA fullfsync = ON` for `F_FULLFSYNC`.
- **`Q-SQLITE-067` (Litestream checkpoint interaction):** Clarified explanation in `<details>`. Litestream maintains a long-lived read transaction to prevent WAL reset during frame upload and controls checkpoints; external `TRUNCATE` or `RESTART` checkpoints disrupt this by resetting the WAL out of band.
- **`Q-SQLITE-070`..`073` (libSQL and Turso):** Verified against Module 12 and live `sqld` integration run. Edge replica architecture, libSQL 3.45.1 base lag (`ALTER COLUMN SET NOT NULL` absence), embedded replica asynchronous sync model, and `readYourWrites` connection-local scope confirmed.
- **Least-certain claims audit:** All 14 items audited. Unix lock byte offsets, busy backoff schedule, wal-index 136-byte header, and Turso MVCC semantics verified against engine behavior and authoritative sources.

### 5. Markdown quality and consistency gates

- `wrap-check`: Clean across all track Markdown files.
- `table-check`: Clean (0 failing tables). Escaped pipes verified.
- `mermaid-check`: Clean (0 failing diagrams).
- `link-check`: All internal relative links and anchors resolve cleanly (with external pending list `../cloudflare`, `technologies/cloudflare`, `../observability`, `technologies/observability`, `../containers`, `technologies/containers`, `../system-design`, `architecture/system-design`).
- `oxfmt` and `oxlint`: Clean formatting and 0 lint warnings.
- Leak check: Verified absence of local machine paths (e.g. absolute user home directories), private identifiers, or sensitive credentials.

Ready for Opus final gate.
