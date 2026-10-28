# Brief: SQLite (`technologies/sqlite`)

| | |
|---|---|
| Phase | 2 |
| Kind | NEW track: create from scratch |
| Primary (author) | **Opus · claude.ai** |
| Drafter (on request) | pi · DeepSeek |
| Challenger | pi · Muse Spark 1.3 |
| Verifier | Antigravity |
| Final gate | Opus (claude.ai session) |
| Branch / worktree | `track/sqlite` · `../zto-sqlite` |
| Depends on | phase 1 foundations |
| Research dossier | `.agents/research/B-data.md` |

## 0. Read before starting (binding)
1. `AGENTS.md`: the contract. If it conflicts with this brief, AGENTS.md wins; log the conflict in your review file.
2. `.agents/OWNERSHIP.md`: what you own vs only cross-link.
3. `.agents/REVIEW.md`: the checklist your work is judged against.
4. Your global/agent instructions still apply where they do not conflict.

## 1. Owner decisions and track-specific instructions
- Turso/libSQL is **module 12 of this track**, not its own track (revisit at Turso Database 1.0).
- Bindings bundle different SQLite versions. Every test suite asserts `sqlite_version()`, and the README documents which binding ships which version.
- Teach the **latest stable** versions. Add **Then vs now** comparisons wherever practice changed (AGENTS.md § Version Currency).
- Pin **all** tooling via mise (`.mise.toml` + `mise.lock`): node 26 for JS/TS, plus every CLI and runtime the examples need.

## 2. Ownership
**You own (full treatment):**
- Libsql/Turso

**Cross-link only (do not re-explain):**
- Data models, relational algebra, normal forms → owned by `architecture/data-systems`
- Storage engines: B-tree vs LSM, WAL/ARIES, compaction, buffer pools → owned by `architecture/data-systems`
- Isolation levels & anomaly taxonomy (Adya/Berenson), MVCC theory, SSI → owned by `architecture/data-systems`
- Indexing theory: inverted index, BM25, vector ANN (HNSW, IVF, quantisation) → owned by `architecture/data-systems`

## 3. Research dossier (verified 2026-10-27/28; re-verify before use)

#### SQLite — `technologies/sqlite` (NEW)

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

#### Context from `B-data.md`

##### Turso / libSQL — recommend a **module within SQLite** (`technologies/sqlite/modules/12-libsql-and-turso.md`), not a standalone track

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

## 4. Re-verify list
These claims were marked unverified during research. Confirm or correct each one against a primary source before teaching it:
- 6. **WAL mode:** WAL file + wal-index (`-shm`), readers don't block writer, checkpoints (PASSIVE/FULL/RESTART/TRUNCATE), checkpoint starvation, `wal_autocheckpoint`, `synchronous=NORMAL` vs `FULL` durability trade-off, WAL2/`BEGIN CONCURRENT` branches (not in mainline; unverified status).
- 14. The default `SQLITE_MAX_VARIABLE_NUMBER` limits batch-insert sizes. The default has varied by version (32766 since 3.32; unverified current).
- CLI: `sqlite3` via mise (`aqua:sqlite/sqlite`? backend availability unverified). Fallback: Homebrew `sqlite` on Mac, or rely on bindings only.
- **Vector types:** `vector32/64/8/1bit` + `vector_distance_cos`. Worked locally; the docs example is brute-force; ANN index status unverified.
- Encryption at rest (cloud: AES-256; local page-codec interface in 0.8.0; details unverified).
- **Turso Sync:** offline-first push/pull, conflict semantics (details unverified; read the docs before writing), vs CRDT approaches (cr-sqlite).
- **Compatibility matrix:** what SQLite features Turso DB lacks (check its `COMPAT.md`; unverified contents); version-lag hazards of libSQL (3.45 base: misses `STRICT`-era and JSONB-era fixes and 3.46–3.54 features).
- Prove `BEGIN CONCURRENT` conflicts with two connections on one file (unverified that multi-connection on the same file is supported in the JS binding; test early).
- Embedded replica / sync against a local sqld: `ghcr.io/tursodatabase/libsql-server` image (tag unverified) via docker compose. The Turso Cloud sync path cannot be proven offline; mark it as "requires account" with a skipped test.

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
1. **Primary (Opus)** works on branch `track/sqlite` and sets this track's row in `.agents/STATUS.md` to 🟦.
2. **Verify versions first.** Check every version in the dossier against its primary source today. Record the results in the README's `Verified against …` line. Resolve every item in the re-verify list below.
3. Build in stages: README syllabus + exam matrix → modules one by one, each with its examples/tests → glossary → cheatsheet → question banks → mock exam. Delegate bulk drafting (question-bank drafts, glossary candidates, cheatsheet tables) to the **Drafter**, then correct and integrate it yourself.
4. Before each commit: run `mise exec -- npm test` and `npm run typecheck` (or the equivalents), and `test:integration` if present. Commit with Conventional Commits scoped `(sqlite)`.
5. Self-check against `.agents/REVIEW.md`. Then set STATUS to 🟨 and write the hand-off at the top of `.agents/reviews/sqlite.md`:
   - what was done;
   - what was not done, and why;
   - every claim you are least sure of.
6. The **Challenger** attacks it and the **Verifier** checks it independently. Both record findings in `.agents/reviews/sqlite.md` (prompts in `.agents/KICKOFF.md`). The primary resolves the findings (🟧), Opus runs the final gate (🟪), and the owner merges (✅).
