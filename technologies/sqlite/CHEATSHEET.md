# SQLite 3.54 Cheatsheet

Fast lookup for the [SQLite track](./README.md). Every entry is taught, with its failure modes, in the linked module, and the behaviours that can be proven locally are proven by the tests in [examples/](./examples/). Versions: SQLite 3.54.1 upstream; see section 2 for what each binding bundles.

## Contents

1. [Connection-open checklist](#connection-open-checklist)
2. [Bindings and bundled versions](#2-bindings-and-bundled-versions)
3. [Affinity rules and STRICT types](#3-affinity-rules-and-strict-types)
4. [rowid decision table](#4-rowid-decision-table)
5. [Modern dialect with introduction versions](#5-modern-dialect-with-introduction-versions)
6. [ALTER TABLE abilities and the 12-step rebuild](#6-alter-table-abilities-and-the-12-step-rebuild)
7. [File header offsets and page types](#7-file-header-offsets-and-page-types)
8. [Lock states, BEGIN modes and the busy timeout](#8-lock-states-begin-modes-and-the-busy-timeout)
9. [Journal modes and synchronous levels](#9-journal-modes-and-synchronous-levels)
10. [Checkpoints and WAL troubleshooting](#10-checkpoints-and-wal-troubleshooting)
11. [EXPLAIN QUERY PLAN vocabulary and index rules](#11-explain-query-plan-vocabulary-and-index-rules)
12. [FTS5](#12-fts5)
13. [Backups and integrity](#13-backups-and-integrity)
14. [libSQL vs Turso Database vs SQLite](#14-libsql-vs-turso-database-vs-sqlite)

## Connection-open checklist

Set every behaviour-defining pragma explicitly. Bindings ship different defaults ([Module 01](./modules/01-what-sqlite-is-bindings-and-cli.md#4-compile-time-defaults-the-hidden-configuration)).

```sql
PRAGMA journal_mode = WAL;          -- persistent; readers stop blocking the writer (Module 06)
PRAGMA synchronous = NORMAL;        -- WAL: durable except the last commits on power loss; FULL to fsync every commit
PRAGMA foreign_keys = ON;           -- per connection; OFF in the library default; no-op inside a transaction (Module 02)
PRAGMA busy_timeout = 5000;         -- ms to retry on SQLITE_BUSY (does not fix BUSY_SNAPSHOT or deadlock BUSY) (Module 05)
PRAGMA cache_size = -16000;         -- negative = KiB, positive = pages; per connection (better-sqlite3 default)
PRAGMA temp_store = MEMORY;         -- temp B-trees in RAM
PRAGMA optimize = 0x10002;          -- once at open on long-lived connections; plain `PRAGMA optimize` before close (Module 07)
SELECT sqlite_version();            -- assert it (Module 01)
```

| Also remember | Why | Module |
| --- | --- | --- |
| Write transactions start with `BEGIN IMMEDIATE` | avoids the deferred-upgrade deadlock and `SQLITE_BUSY_SNAPSHOT` | [05 § 3.1](./modules/05-transactions-locking-and-rollback-journal.md#31-the-deferred-upgrade-deadlock) |
| One connection per thread; never across `fork()` | threading modes and lock state | [09](./modules/09-application-concurrency.md#2-connections-threads-and-processes) |
| Exhaust or `return()` every iterator | an un-reset statement pins a read transaction | [05 § 2.0](./modules/05-transactions-locking-and-rollback-journal.md#20-statements-hold-locks-too) |
| `node:sqlite` defaults `timeout` to 0 | fails fast on the first contention | [05](./modules/05-transactions-locking-and-rollback-journal.md#7-sqlite_busy-and-the-busy-handler) |

## 2. Bindings and bundled versions

Source: [Module 01 § 3](./modules/01-what-sqlite-is-bindings-and-cli.md#3-bindings-and-the-version-you-actually-run), [README](./README.md#bindings-and-bundled-sqlite-versions).

| Binding (pin) | `sqlite_version()` | Notable defaults |
| --- | --- | --- |
| SQLite CLI / amalgamation 3.54.1 | 3.54.1 | foreign keys off, DQS on; CLI adds `generate_series`, `.diskused`, `.recover` |
| `@sqlite.org/sqlite-wasm` 3.54.1-build1 | 3.54.1 | `THREADSAFE=0`, no loadable extensions, 8 KiB pages |
| `node:sqlite`, Node 26.12.1 | 3.54.0 | release candidate; foreign keys and `defensive` on; session extension built in |
| `better-sqlite3` 13.0.3 | 3.53.4 | foreign keys on, `DQS=0`, WAL `synchronous=NORMAL`, `cache_size` -16000, no `generate_series` |
| Python 3.15.2 `sqlite3` | 3.53.1 | stock defaults (foreign keys off, DQS on) |
| `@libsql/client` 0.18.0 | 3.45.1 | libSQL fork; lacks everything after 3.45 |
| `@tursodatabase/database` 0.8.3 | reports 3.50.4 | Rust rewrite; MVCC, CDC; no FTS5 |

## 3. Affinity rules and STRICT types

Source: [Module 02 § 1.2](./modules/02-type-system-and-schema.md#12-type-affinity-the-five-rules) and [§ 2](./modules/02-type-system-and-schema.md#2-strict-tables).

First match wins, case-insensitive substring tests:

| # | Declared type contains | Affinity | Trap |
| --- | --- | --- | --- |
| 1 | `INT` | INTEGER | `FLOATING POINT` and `CHARINT` land here |
| 2 | `CHAR`, `CLOB`, `TEXT` | TEXT | `VARCHAR(3)` length ignored |
| 3 | `BLOB`, or empty | BLOB | stored exactly as given |
| 4 | `REAL`, `FLOA`, `DOUB` | REAL |  |
| 5 | anything else | NUMERIC | `STRING` turns `'0123'` into 123; `DECIMAL`, `BOOLEAN`, `DATE` are NUMERIC |

Storage-class order with no affinity: NULL < INTEGER and REAL < TEXT < BLOB. A column compared with a literal converts the literal (NUMERIC affinity if the column is numeric, TEXT if the column is TEXT); two literals are not converted.

| STRICT rule | Detail |
| --- | --- |
| Allowed types | `INT`, `INTEGER`, `REAL`, `TEXT`, `BLOB`, `ANY` (since 3.37.0); other names fail at `CREATE` |
| Coercion | only lossless (`'42'` to 42); otherwise `SQLITE_CONSTRAINT_DATATYPE` |
| `ANY` | keeps the value as given (NUMERIC affinity in ordinary tables) |
| Primary key | implicitly `NOT NULL` |
| Combine | `CREATE TABLE t(...) STRICT, WITHOUT ROWID` |
| Old readers | versions before 3.37.0 cannot open the file |

Arithmetic: `5 / 2` is 2; integer overflow becomes REAL; `1 / 0` is NULL; money in integer minor units; integers above 2^53 need BigInt mode in JavaScript.

## 4. rowid decision table

Source: [Module 02 § 3](./modules/02-type-system-and-schema.md#3-rowid-tables-integer-primary-key-and-autoincrement).

| Declaration | Rowid alias? | Notes |
| --- | --- | --- |
| `id INTEGER PRIMARY KEY` | yes | fastest; key of the B+tree; stored as NULL in the record |
| `id INTEGER PRIMARY KEY DESC` | no | historical quirk; separate unique index |
| `id INT PRIMARY KEY`, `BIGINT PRIMARY KEY` | no | extra `sqlite_autoindex_*`; two B-trees per insert |
| `... AUTOINCREMENT` | yes | never reuses; extra `sqlite_sequence` write per insert; `SQLITE_FULL` at 2^63 − 1 |
| `WITHOUT ROWID` | n/a | clustered by primary key; use for composite or text keys with small rows; no `last_insert_rowid()` |
| non-integer `PRIMARY KEY` in an ordinary table | n/a | accepts NULLs; add `NOT NULL`, or use STRICT or `WITHOUT ROWID` |

Without `AUTOINCREMENT`, the next rowid is max + 1 (so the top id can be reused after delete), or a random unused one at 2^63 − 1.

Conflict algorithms ([§ 4.1](./modules/02-type-system-and-schema.md#41-the-on-conflict-algorithms)):

| Algorithm | Effect |
| --- | --- |
| `ABORT` (default) | undo the statement, keep the transaction |
| `ROLLBACK` | roll back the whole transaction |
| `FAIL` | stop, keep rows already changed by the statement |
| `IGNORE` | skip the violating row |
| `REPLACE` | delete the conflicting rows, then insert (cascades fire; unmentioned columns reset) |

## 5. Modern dialect with introduction versions

Source: [Module 03](./modules/03-sql-dialect-and-features.md), version table in [§ 9](./modules/03-sql-dialect-and-features.md#9-then-vs-now-a-version-table-for-the-dialect).

| Feature | Syntax | Since |
| --- | --- | --- |
| UPSERT | `INSERT ... ON CONFLICT(k) DO UPDATE SET n = n + excluded.n` | 3.24.0 |
| Window functions | `OVER (PARTITION BY ... ORDER BY ... ROWS BETWEEN ...)` | 3.25.0 |
| `RENAME COLUMN` | `ALTER TABLE t RENAME COLUMN a TO b` | 3.25.0 |
| Generated columns | `GENERATED ALWAYS AS (...) STORED` or `VIRTUAL` | 3.31.0 |
| `UPDATE ... FROM` | join in `UPDATE` | 3.33.0 |
| `RETURNING`, `DROP COLUMN`, `MATERIALIZED` | see syntax below | 3.35.0 |
| `STRICT` | `CREATE TABLE ... STRICT` | 3.37.0 |
| JSON built in, `->` and `->>` | `doc ->> '$.kind'` | 3.38.0 |
| `RIGHT` and `FULL OUTER JOIN`, `IS DISTINCT FROM` |  | 3.39.0 |
| JSON5 input, `subsec` |  | 3.42.0 |
| JSONB | `jsonb(x)`, `jsonb_*` | 3.45.0 |
| `floor` / `ceiling` month modifiers, `json_pretty` | `date(x, '+1 month', 'floor')` | 3.46.0 |
| Two-argument `iif()` |  | 3.48.0 |
| `unistr()` |  | 3.50.0 |
| `jsonb_each`, `jsonb_tree`, `wal_checkpoint(NOOP)` |  | 3.51.0 |
| `SET NOT NULL` / `DROP NOT NULL`, `json_array_insert`, `REINDEX EXPRESSIONS` |  | 3.53.0 |
| `end of month/year/day`, `weekday -N`, `%j` and `%J` |  | 3.54.0 |

```sql
INSERT INTO counter(k, n) VALUES (?, 1) ON CONFLICT(k) DO UPDATE SET n = n + excluded.n RETURNING k, n, note;
SELECT json_array_insert('[1,3]', '$[1]', 2);        -- 3.53+: '[1,2,3]'
SELECT date('2026-02-10', 'end of month');            -- 3.54+: '2026-02-28'; NULL on older engines
SELECT date('now', 'start of month', '+1 month', '-1 day');   -- portable last day of month
```

| Operator                 | Returns                         | Example |
| ------------------------ | ------------------------------- | ------- |
| `doc -> '$.a.b[2].c'`    | JSON text (strings keep quotes) | `'"x"'` |
| `doc ->> '$.a.b[2].c'`   | SQL value                       | `'x'`   |
| `doc ->> '$.a.b[#-1].c'` | index from the end              | `'x'`   |

| Window frame            | Meaning                                                             |
| ----------------------- | ------------------------------------------------------------------- |
| default with `ORDER BY` | `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`, includes peers |
| `ROWS`                  | physical rows                                                       |
| `RANGE`                 | sort-key values within the distance                                 |
| `GROUPS`                | peer groups                                                         |

Silent traps: unknown date modifiers return NULL; `'+1 month'` from the 31st overflows; `||` propagates NULL (use `concat_ws`); `DELETE ... RETURNING` does all its work on the first step.

## 6. ALTER TABLE abilities and the 12-step rebuild

Source: [Module 03 § 7](./modules/03-sql-dialect-and-features.md#7-alter-table-and-the-12-step-rebuild).

| Form | Since | Rewrites table? | Restrictions |
| --- | --- | --- | --- |
| `RENAME TO` | always | no | references in triggers and views rewritten (3.26+) |
| `RENAME COLUMN` | 3.25.0 | no | rewrites indexes, triggers, views |
| `ADD COLUMN` | always | no | no `PRIMARY KEY` or `UNIQUE`, no `STORED` generated column; `NOT NULL` needs a non-NULL default |
| `DROP COLUMN` | 3.35.0 | yes | fails for primary key, `UNIQUE`, indexed, FK, generated, trigger or view dependencies |
| `ALTER COLUMN c SET NOT NULL` / `DROP NOT NULL` | 3.53.0 | no | `SET` fails on existing NULLs |

Everything else (change a type, add `UNIQUE` or a foreign key, make a table STRICT) needs the rebuild:

```text
1  PRAGMA foreign_keys = OFF      -- before BEGIN; a no-op inside a transaction
2  BEGIN
3  save the SQL of dependent indexes, triggers, views from sqlite_schema
4  CREATE TABLE new_X (...)
5  INSERT INTO new_X SELECT ... FROM X
6  DROP TABLE X                   -- with foreign keys on this would cascade into children
7  ALTER TABLE new_X RENAME TO X  -- create new, then rename; never rename the old table first
8  re-create indexes, triggers, views
9  PRAGMA foreign_key_check       -- must return no rows
10 COMMIT
11 PRAGMA foreign_keys = ON
```

## 7. File header offsets and page types

Source: [Module 04 §§ 2 to 4](./modules/04-file-format-and-b-trees.md#2-the-100-byte-header). All integers are big-endian.

| Offset | Size | Field | Pragma |
| --- | --- | --- | --- |
| 0 | 16 | `"SQLite format 3\0"` |  |
| 16 | 2 | page size (1 means 65,536) | `page_size` |
| 18 / 19 | 1 / 1 | write / read version (1 legacy, 2 WAL) | `journal_mode` |
| 20 | 1 | reserved bytes per page |  |
| 24 | 4 | file change counter |  |
| 28 | 4 | database size in pages (valid if offset 92 equals offset 24) | `page_count` |
| 32 / 36 | 4 / 4 | first freelist trunk / freelist page count | `freelist_count` |
| 40 | 4 | schema cookie | `schema_version` |
| 44 | 4 | schema format (4 current) |  |
| 52 / 64 | 4 / 4 | largest root page / incremental-vacuum flag | `auto_vacuum` |
| 56 | 4 | text encoding (1 UTF-8, 2 UTF-16le, 3 UTF-16be) |  |
| 60 | 4 | `user_version` | `user_version` |
| 68 | 4 | `application_id` | `application_id` |
| 92 / 96 | 4 / 4 | version-valid-for / `SQLITE_VERSION_NUMBER` of last writer |  |

| Page type byte | Meaning        | Header size |
| -------------- | -------------- | ----------- |
| `0x02`         | interior index | 12          |
| `0x05`         | interior table | 12          |
| `0x0A`         | leaf index     | 8           |
| `0x0D`         | leaf table     | 8           |

Record serial types: 0 NULL; 1 to 6 integers of 1, 2, 3, 4, 6, 8 bytes; 7 double; 8 and 9 the constants 0 and 1 (no body bytes); even N ≥ 12 BLOB of (N − 12) / 2 bytes; odd N ≥ 13 TEXT of (N − 13) / 2 bytes. Varints: 1 to 9 bytes, 7 bits each, the ninth byte contributes 8 bits.

Overflow (usable size U, payload P, table-leaf cell): X = U − 35; if P ≤ X all local; else M = ⌊(U − 12) · 32 / 255⌋ − 23, K = M + ((P − M) mod (U − 4)); local = K if K ≤ X, else M. Each overflow page holds U − 4 payload bytes.

Space: `VACUUM` needs up to 2x free space and a write lock; `VACUUM INTO 'f'` leaves the original untouched; `auto_vacuum` is chosen before the first table or applied by a full `VACUUM`; `page_size` changes via `VACUUM` outside WAL mode. Measure with `dbstat` or `.diskused` ([§ 9](./modules/04-file-format-and-b-trees.md#9-measuring-space-dbstat-and-diskused)).

## 8. Lock states, BEGIN modes and the busy timeout

Source: [Module 05 §§ 2, 3, 7](./modules/05-transactions-locking-and-rollback-journal.md#2-the-five-lock-states).

| State | Meaning | Acquired by |
| --- | --- | --- |
| `UNLOCKED` | nothing | initial |
| `SHARED` | reading; many allowed | first read |
| `RESERVED` | one writer plans to write; readers still allowed | first write or `BEGIN IMMEDIATE` |
| `PENDING` | writer waits for readers; new `SHARED` refused | writer needing `EXCLUSIVE` |
| `EXCLUSIVE` | writing the file; nobody else | commit, cache spill, `BEGIN EXCLUSIVE` |

| `BEGIN` mode | Locks at `BEGIN` | Use |
| --- | --- | --- |
| `DEFERRED` (default) | none | read-only transactions |
| `IMMEDIATE` | `RESERVED` | every transaction that may write |
| `EXCLUSIVE` | `EXCLUSIVE` (same as `IMMEDIATE` in WAL) | bulk loads |

What `busy_timeout` can and cannot fix:

| Situation | Helps? |
| --- | --- |
| `BEGIN IMMEDIATE` while another connection holds `RESERVED` | yes |
| `COMMIT` while readers hold `SHARED` (rollback mode) | yes, if they finish in time |
| Deferred transaction upgrading while another holds `RESERVED` (deadlock) | no, `SQLITE_BUSY` at once; roll back |
| WAL upgrade on a stale snapshot (`SQLITE_BUSY_SNAPSHOT`) | no; roll back and re-run |

After `SQLITE_BUSY`: on `COMMIT`, retry (the transaction is still open); inside a transaction that already read, `ROLLBACK` and re-run it from `BEGIN IMMEDIATE`; otherwise retry the statement. A constraint error aborts only the statement. Hot journal: never delete `-journal`; never move the database without it. `PRAGMA locking_mode = EXCLUSIVE` keeps locks and, in WAL mode set before first access, skips `-shm`.

## 9. Journal modes and synchronous levels

Source: [Module 05 § 6](./modules/05-transactions-locking-and-rollback-journal.md#6-journal-modes), [Module 06 § 5](./modules/06-wal-mode.md#5-durability-synchronousnormal-versus-full).

| `journal_mode` | Commit point | Note |
| --- | --- | --- |
| `DELETE` (default) | journal `unlink()` |  |
| `TRUNCATE` | journal truncated to 0 bytes | often faster than unlink |
| `PERSIST` | journal header zeroed |  |
| `MEMORY` | n/a | crash mid-transaction can corrupt (not atomic) |
| `WAL` | commit frame in the WAL | persistent; same host only |
| `OFF` | n/a | no atomicity; refused by defensive connections (check the returned value) |

| `synchronous` | Rollback mode | WAL mode |
| --- | --- | --- |
| `OFF` | no syncs; OS crash can corrupt | same |
| `NORMAL` | fewer syncs; small risk on old filesystems | WAL synced at checkpoint only; last commits may be lost, never corrupt |
| `FULL` (default) | safe | WAL synced on every commit |
| `EXTRA` | also syncs the directory | like `FULL` |

Durability levels by data: rebuildable, WAL + `NORMAL`; typical application state, WAL + `NORMAL`; ledgers and acknowledged messages, WAL + `FULL` (macOS also `fullfsync = ON`). A process crash alone loses no committed transaction. See [Module 10 § 1](./modules/10-durability-backup-and-operations.md#1-the-durability-chain).

## 10. Checkpoints and WAL troubleshooting

Source: [Module 06 §§ 6 to 8](./modules/06-wal-mode.md#6-checkpoints).

| Mode | Waits for writers? | Waits for readers? | Result |
| --- | --- | --- | --- |
| `PASSIVE` | no | no, copies only older frames | automatic checkpoints use it |
| `FULL` | yes | until readers use the latest snapshot | all frames copied |
| `RESTART` | yes | until no reader uses the WAL | next writer restarts the WAL |
| `TRUNCATE` | yes | like `RESTART` | WAL file truncated to 0 bytes |
| `NOOP` (3.51+) | n/a | n/a | reports state only |

`PRAGMA wal_checkpoint(...)` returns `busy`, `log`, `checkpointed`. Default `wal_autocheckpoint` is 1000 pages (PASSIVE, WAL reused but not truncated); `journal_size_limit` truncates at reset.

| Symptom | Likely cause | Action |
| --- | --- | --- |
| `-wal` grows without bound, reads slow | checkpoint starvation: a reader is always open | find the long reader (abandoned iterator, long report); schedule `RESTART` / `TRUNCATE` checkpoints; alert on WAL size |
| `SQLITE_BUSY_SNAPSHOT` that retries never fix | deferred transaction became stale | `ROLLBACK`, re-run with `BEGIN IMMEDIATE` |
| backup misses recent data | `cp` of the `.db` file only | `VACUUM INTO` or the backup API |
| latency spikes every few seconds | automatic checkpoint in the request path | `wal_autocheckpoint = 0` plus a background checkpointer |
| corruption on NFS or SMB | no coherent shared memory or locks | local filesystem on one host |
| possible skipped transaction with several writers | WAL-reset race in 3.7.0 to 3.51.2 | upgrade (fixed 3.51.3, 3.53.0+; backports 3.44.6, 3.50.7) |

Rollback vs WAL: WAL appends each changed page once with at most one fsync, readers and the writer never block each other, but there is still one writer; WAL needs the same host, and multi-file atomicity is per file only.

## 11. EXPLAIN QUERY PLAN vocabulary and index rules

Source: [Module 07 §§ 3, 4, 6](./modules/07-query-planner-and-vdbe.md#3-reading-explain-query-plan).

| Plan text                                       | Meaning                              |
| ----------------------------------------------- | ------------------------------------ |
| `SCAN t`                                        | full scan                            |
| `SCAN t USING COVERING INDEX i`                 | scan in index order, table not read  |
| `SEARCH t USING INDEX i (a=? AND b>?)`          | seek: equality prefix plus one range |
| `SEARCH t USING INTEGER PRIMARY KEY (rowid=?)`  | rowid lookup                         |
| `SEARCH t USING INDEX i (ANY(a) AND b=?)`       | skip-scan (needs statistics)         |
| `SEARCH t USING AUTOMATIC COVERING INDEX (c=?)` | transient index for this statement   |
| `USE TEMP B-TREE FOR ORDER BY`                  | explicit sort                        |
| `MULTI-INDEX OR`                                | each `OR` branch uses its own index  |
| `MATERIALIZE x` / `CO-ROUTINE x`                | subquery or CTE strategy             |
| `BLOOM FILTER ON t (c=?)`                       | skips impossible inner seeks         |

Index usability rules:

| Rule | Detail |
| --- | --- |
| Indexable terms | `col = expr`, `IS`, `IN`, `>`, `>=`, `<`, `<=`, `BETWEEN`, `IS NULL`, prefix `LIKE` / `GLOB` |
| Prefix rule | equality on a leftmost prefix, then at most one range; later columns are only checked |
| Function on the column | defeats a plain index; create an expression index on the same expression |
| `+col` and `NOT INDEXED` | disqualify an index on purpose; `INDEXED BY` forces one |
| Partial index | usable only when the query states the predicate literally (not as a bound parameter) |
| Covering index | add the extra columns to the key; there is no `INCLUDE` |
| `LIKE 'ab%'` | needs TEXT affinity, a non-wildcard start, and a `NOCASE` index (or `GLOB` with a `BINARY` index) |
| `LIKE '%x%'` | never uses a B-tree index; use the FTS5 trigram tokenizer |
| Joins | nested loops only; `CROSS JOIN` fixes the order |

Statistics: `ANALYZE` writes `sqlite_stat1` (rows in index, then average rows per prefix); `PRAGMA optimize = 0x10002` at open and `PRAGMA optimize` periodically; `analysis_limit` samples; skip-scan appears only after `ANALYZE`. Do not assert exact plan strings in tests ([Module 07 § 9](./modules/07-query-planner-and-vdbe.md#9-then-vs-now)).

## 12. FTS5

Source: [Module 08 § 2](./modules/08-extensions-fts5-rtree-and-virtual-tables.md#2-fts5-full-text-search).

```sql
CREATE VIRTUAL TABLE doc USING fts5(title, body);
SELECT rowid FROM doc WHERE doc MATCH ? ORDER BY bm25(doc, 10.0, 1.0);   -- smaller (more negative) is better
INSERT INTO doc(doc) VALUES ('optimize');                                -- merge all segments after a bulk load
```

| Query                             | Meaning                   |
| --------------------------------- | ------------------------- |
| `wal`                             | token                     |
| `"write ahead logging"`           | phrase                    |
| `check*`                          | prefix                    |
| `title:journal`, `{title body}:x` | column filter             |
| `a AND b`, `a OR b`, `a NOT b`    | boolean; `NOT` is binary  |
| `NEAR(a b, N)`                    | within N tokens           |
| `^first`                          | first token in the column |

| Tokenizer             | Use                                                         |
| --------------------- | ----------------------------------------------------------- |
| `unicode61` (default) | general text; `remove_diacritics 2` folds accents           |
| `ascii`               | identifiers                                                 |
| `porter`              | English stemming wrapper                                    |
| `trigram` (3.34+)     | substring `LIKE` / `GLOB` with 3 or more literal characters |

| Content option | Text stored in FTS? | Note |
| --- | --- | --- |
| default | yes | automatic |
| `content='note', content_rowid='id'` | no | triggers must use the `'delete'` command with old values; repair with `'rebuild'` |
| `content=''` | no | contentless |
| `content='', contentless_delete=1` (3.43+) | no | delete by rowid works |

Quote user input before `MATCH`: `'"' + s.replaceAll('"', '""') + '"'`. R*Tree stores 32-bit floats, answers bounding-box queries only; deterministic functions only in indexes; extension loading is off by default (`node:sqlite` needs `allowExtension: true` at open).

## 13. Backups and integrity

Source: [Module 10 §§ 2, 3](./modules/10-durability-backup-and-operations.md#2-how-sqlite-databases-get-corrupted).

| Method | Consistent? | WAL-only commits? | Notes |
| --- | --- | --- | --- |
| `cp app.db` while in use | no | no | unsafe |
| volume snapshot | crash-consistent if `db`, `-wal`, `-journal` are captured atomically | yes | like a power cut |
| `.dump` / `iterdump()` | yes | yes | logical text; slow restore |
| `VACUUM INTO 'file'` (3.27+) | yes | yes | target must not exist and be non-empty |
| online backup API | yes | yes | restarts if another connection writes between steps; use large steps or `-1` |
| `serialize()` | yes | yes | in memory; small databases |
| Litestream-style WAL shipping | continuous | yes | asynchronous; point-in-time recovery |

| Check | Verifies |
| --- | --- |
| `PRAGMA quick_check` | page structure, cell order, `NOT NULL`, `CHECK` |
| `PRAGMA integrity_check` | the above plus every index against its table |
| `PRAGMA integrity_check(table)` (3.33+) | one table and its indexes |
| `PRAGMA foreign_key_check` | referential integrity (returns table, rowid, parent, fkid) |

Repair order: `REINDEX` for index-only damage; `.recover` (CLI, 3.29+) to salvage rows; restore from backup. Find the cause first. Restore drill: copy, open, `integrity_check`, `foreign_key_check`, row counts, `user_version`. Detect other writers with `PRAGMA data_version`. Migrations: `user_version` plus `BEGIN IMMEDIATE`, re-check under the lock, refuse downgrades ([§ 5](./modules/10-durability-backup-and-operations.md#5-schema-migrations-with-user_version)). Session changesets only track tables with a primary key.

## 14. libSQL vs Turso Database vs SQLite

Source: [Module 12](./modules/12-libsql-and-turso.md#1-lineage).

|  | Upstream SQLite | libSQL | Turso Database |
| --- | --- | --- | --- |
| Code base | C, public domain | C fork, MIT | Rust rewrite, MIT |
| Version | 3.54.1 | base 3.45.1 | reports 3.50.4; 0.8.3 stable (0.x) |
| Writers | one | one | many via `BEGIN CONCURRENT` with `journal_mode = 'mvcc'` |
| Extras | all upstream features | server (`sqld`), Hrana, embedded replicas, vectors (`F32_BLOB`, `libsql_vector_idx`) | CDC (`turso_cdc`), local encryption, Turso Sync |
| FTS5 | yes | inherited from the 3.45 base (not tested in this track) | no |
| Missing | none | everything after 3.45.1 (date modifiers return NULL; `SET NOT NULL` fails) | FTS5, SQLite C extensions, backup API, some window functions, many pragmas |
| Has | all | `STRICT`, JSONB | `STRICT`, views, triggers, savepoints |

| Need | Choose |
| --- | --- |
| One server, backups with point-in-time recovery | SQLite + Litestream |
| Read-heavy edge, writes to one primary | libSQL embedded replicas |
| Offline-first clients, last-write-wins acceptable | Turso Sync |
| Many writers on different rows, one host | Turso Database MVCC (0.x maturity) |
| Strong consistency across hosts, long write transactions, roles | PostgreSQL |
| Newest features, FTS5, extensions | upstream SQLite |

Embedded replicas: reads local and stale until `sync()` or the sync interval; writes forwarded to the primary. MVCC conflict: the loser's transaction has already ended; retry the whole transaction; hot rows can be slower than SQLite. Sync conflicts: last push wins.
