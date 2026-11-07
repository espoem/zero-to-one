# Senior Backend / Database Interview, SQLite Deep-Dive: Question Bank (`interview`)

Original questions for the interview format described in [README.md](README.md). No SQLite certification exists, so nothing here reproduces any real exam; every fact comes from this track's modules and the official SQLite, Node.js and Turso documentation. Unless a question says otherwise, assume SQLite 3.54 in WAL mode where relevant, and the bindings pinned in the [track README](../README.md#bindings-and-bundled-sqlite-versions).

- **Question types:** `single` (one answer), `multi` (select all that apply), `scenario` (a production symptom: what happened and what do you do), `ordering` (put steps in order), `hands-on` (a task with an observable result, verified by an existing test in `examples/ts/`).
- **Difficulty:** 1 = solid mid-level, 2 = senior, 3 = harder than a typical interview (derivations, crash-point reasoning, predicting plan or lock behaviour).
- **Answers** are collapsed. Each lists why the distractors are wrong and references the teaching module and an official page.

## Domains

The interview format has no official weights. These are the track's own allocation (see [README.md](README.md#2-domain--module-coverage-matrix)).

| #   | Domain                             | Weight | Questions |
| --- | ---------------------------------- | ------ | --------- |
| D1  | What SQLite is, bindings, defaults | 6 %    | 5         |
| D2  | Type system and schema             | 9 %    | 6         |
| D3  | SQL dialect                        | 8 %    | 6         |
| D4  | File format and storage            | 9 %    | 6         |
| D5  | Transactions and locking           | 11 %   | 8         |
| D6  | WAL mode                           | 11 %   | 8         |
| D7  | Query planner and VDBE             | 11 %   | 8         |
| D8  | Extensions                         | 7 %    | 5         |
| D9  | Application concurrency            | 10 %   | 7         |
| D10 | Durability and operations          | 9 %    | 6         |
| D11 | Edge and distributed SQLite        | 5 %    | 5         |
| D12 | libSQL and Turso                   | 4 %    | 5         |
|     | **Total**                          | 100 %  | **75**    |

The [mock interview](#mock-interview-30-questions-60-minutes) at the end selects 30 of these questions.

---

## D1 · What SQLite is, bindings, defaults

### Q-SQLITE-001 · What SQLite is · difficulty 1 · single

A web API handles 500 requests per second on one application server. About 20 of them write, and each write transaction commits in roughly 200 µs. The data is a few gigabytes on local NVMe. Which statement is correct?

- A) SQLite cannot be used because it admits only one writer at a time.
- B) SQLite fits: the writer lock is held for about 0.4 % of the time, so the writers simply take turns.
- C) SQLite fits only if the application sets `journal_mode = OFF`, otherwise readers block the writers.
- D) SQLite fits only if the database file is placed on a network share, so that several servers can use it.

<details><summary>Answer</summary>

**B.** The official guidance is that SQLite does not compete with client/server databases, it competes with `fopen()`. The test is whether writers can take turns: 20 writes per second at 200 µs is 4 ms of lock time per second.

- Why not A: one writer at a time is only a problem when many writers cannot take turns, for example long write transactions.
- Why not C: `OFF` removes atomicity and is not needed; WAL mode stops readers and the writer from blocking each other.
- Why not D: a network share is the one placement SQLite explicitly cannot handle safely.
- Ref: [modules/01-what-sqlite-is-bindings-and-cli.md](../modules/01-what-sqlite-is-bindings-and-cli.md#11-sqlite-competes-with-fopen), https://www.sqlite.org/whentouse.html

</details>

### Q-SQLITE-002 · Compile-time defaults · difficulty 2 · scenario

A developer writes `SELECT "user_nmae" FROM users` (a typo). In the Python REPL it returns one row per user, each containing the text `user_nmae`. The same statement in the team's better-sqlite3 service raises an error. Explain both behaviours and what you change.

- A) Python's SQLite is older and has a bug; upgrade it.
- B) A stock build accepts an unknown double-quoted identifier as a string literal (DQS); better-sqlite3 is built with `DQS=0`. Use single quotes for strings and disable DQS where you control the build or connection.
- C) better-sqlite3 enables `STRICT` mode for every table, which rejects the query.
- D) Python's `sqlite3` module rewrites double quotes into single quotes before sending the SQL.

<details><summary>Answer</summary>

**B.** Double-quoted string literals are a compatibility misfeature that stock builds keep. better-sqlite3 compiles with `SQLITE_DQS=0`, and `node:sqlite` rejects it too. Where you can, disable it (`sqlite3_db_config` DQS flags or the build option), and always use single quotes for string values.

- Why not A: it is documented behaviour of default builds, not a bug.
- Why not C: `STRICT` is a per-table type-checking feature and is unrelated to identifier resolution.
- Why not D: the module sends the SQL unchanged.
- Ref: [modules/01-what-sqlite-is-bindings-and-cli.md](../modules/01-what-sqlite-is-bindings-and-cli.md#4-compile-time-defaults-the-hidden-configuration), https://www.sqlite.org/quirks.html#dblquote

</details>

### Q-SQLITE-003 · Bindings and defaults · difficulty 2 · multi

Which statements about the bindings pinned in this track are true? (Select all that apply.)

- A) better-sqlite3 13.0.3 opens WAL databases with `synchronous = NORMAL`.
- B) `node:sqlite` in Node 26.12.1 enforces foreign keys by default.
- C) Stock Python 3.15.2 `sqlite3` rejects double-quoted string literals.
- D) better-sqlite3 13.0.3 includes the CLI-only `generate_series` table-valued function.
- E) `node:sqlite` in Node 26.12.1 bundles SQLite 3.54.0.

<details><summary>Answer</summary>

**A, B, E.**

- Why not C: stock Python builds accept DQS (and leave foreign keys off).
- Why not D: `generate_series` exists only in the CLI build; library builds fail with "no such table". Use a counter CTE or `db.table()`.
- Ref: [modules/01-what-sqlite-is-bindings-and-cli.md](../modules/01-what-sqlite-is-bindings-and-cli.md#3-bindings-and-the-version-you-actually-run), https://www.sqlite.org/compile.html

</details>

### Q-SQLITE-004 · Result codes · difficulty 1 · scenario

A service runs `DROP TABLE tmp_report` and gets an error although `busy_timeout` is 10 seconds and no other connection exists. A `SELECT` on `tmp_report` earlier in the same connection was never reset. Which is it, and does a longer timeout help?

- A) `SQLITE_BUSY`; a longer timeout helps.
- B) `SQLITE_LOCKED`; waiting never helps, reset or finalize the active statement.
- C) `SQLITE_CORRUPT`; run `REINDEX`.
- D) `SQLITE_READONLY`; reopen the connection read-write.

<details><summary>Answer</summary>

**B.** `SQLITE_LOCKED` is a conflict inside the same connection (or shared cache). No other connection can release anything, so no timeout helps.

- Why not A: `SQLITE_BUSY` means a different connection holds a conflicting file lock.
- Why not C and D: nothing indicates damage or a read-only handle.
- Ref: [modules/01-what-sqlite-is-bindings-and-cli.md](../modules/01-what-sqlite-is-bindings-and-cli.md#8-result-codes-the-error-vocabulary), https://www.sqlite.org/rescode.html

</details>

### Q-SQLITE-005 · Version gate · difficulty 3 · hands-on

Write a startup check that refuses to run on SQLite versions older than a configured floor and on the range 3.7.0 to 3.51.2, except the backport releases 3.44.6 and 3.50.7. Compare versions as integers, not strings. Observable result: with better-sqlite3 13.0.3 (3.53.4) the check passes for a floor of 3.51.3 and throws for a floor of 3.54.0.

Verification: `examples/ts/01-what-sqlite-is.test.ts`, tests "the pinned binding passes a 3.51.3 floor", "negative: a 3.54.0 floor rejects better-sqlite3 13.0.3" and "negative: denylisted versions are refused even above the floor".

<details><summary>Answer</summary>

Convert `major.minor.patch` to `major × 1,000,000 + minor × 1,000 + patch` (the `SQLITE_VERSION_NUMBER` encoding), reject if below the floor, then loop over a denylist of `{from, to}` ranges, skipping the two backport versions. A floor alone cannot express "everything from 3.7.0 to 3.51.2 except two releases", which is why the denylist is separate. Integer comparison avoids the string bug where `'3.9.0' > '3.10.0'`.

- Why a floor of 3.51.3 is not enough on its own: 3.52.0 was withdrawn and must be avoided too, which is a separate denylist entry.
- Ref: [modules/01-what-sqlite-is-bindings-and-cli.md](../modules/01-what-sqlite-is-bindings-and-cli.md#32-a-startup-version-gate), https://www.sqlite.org/wal.html#walresetbug

</details>

---

## D2 · Type system and schema

### Q-SQLITE-006 · Type affinity · difficulty 1 · single

A table has `zip STRING`. A row is inserted with `zip = '01234'`. What does `SELECT zip, typeof(zip)` return?

- A) `'01234'`, `text`
- B) `1234`, `integer`
- C) `'01234'`, `integer`
- D) An error: `STRING` is not a valid type.

<details><summary>Answer</summary>

**B.** `STRING` matches none of the INT, CHAR/CLOB/TEXT, BLOB or REAL/FLOA/DOUB rules, so it gets NUMERIC affinity, which converts the well-formed numeric text to the integer 1234. Leading zeros vanish.

- Why not A: that would be TEXT affinity (`VARCHAR`, `TEXT`).
- Why not C: the stored value and its class cannot disagree.
- Why not D: ordinary tables accept any type name; only `STRICT` tables reject unknown names.
- Ref: [modules/02-type-system-and-schema.md](../modules/02-type-system-and-schema.md#12-type-affinity-the-five-rules), https://www.sqlite.org/datatype3.html

</details>

### Q-SQLITE-007 · Type affinity · difficulty 2 · multi

Which declared column types give a column INTEGER affinity? (Select all that apply.)

- A) `BIGINT`
- B) `FLOATING POINT`
- C) `CHARINT`
- D) `VARCHAR(20)`
- E) `DECIMAL(10,2)`

<details><summary>Answer</summary>

**A, B, C.** Rule 1 (contains `INT`) is tested first: `BIGINT` obviously, `FLOATING POINT` because `POINT` contains `INT`, and `CHARINT` because rule 1 beats the `CHAR` rule.

- Why not D: contains `CHAR`, so TEXT affinity (the length is ignored).
- Why not E: matches no rule, so NUMERIC affinity.
- Ref: [modules/02-type-system-and-schema.md](../modules/02-type-system-and-schema.md#12-type-affinity-the-five-rules), https://www.sqlite.org/datatype3.html#determination_of_column_affinity

</details>

### Q-SQLITE-008 · rowid alias · difficulty 2 · scenario

A table `event(id INT PRIMARY KEY, payload TEXT)` is write-heavy. A profile shows each insert touches two B-trees and `sqlite_schema` lists `sqlite_autoindex_event_1`. What is wrong and what is the fix?

- A) `INT PRIMARY KEY` is not a rowid alias: SQLite keeps a hidden rowid plus a separate unique index. Declare `id INTEGER PRIMARY KEY`.
- B) The table needs `WITHOUT ROWID` for every integer key.
- C) `PRAGMA synchronous = FULL` adds the second tree.
- D) The autoindex is created by `VACUUM` and disappears after the next one.

<details><summary>Answer</summary>

**A.** Only the exact spelling `INTEGER PRIMARY KEY` aliases the rowid, making the column the B+tree key. `INT`, `BIGINT` or `INTEGER PRIMARY KEY DESC` create an extra index and double the write and lookup cost.

- Why not B: `WITHOUT ROWID` suits non-integer or composite keys with small rows; an integer key should simply be the rowid alias.
- Why not C: `synchronous` changes fsync behaviour, not the number of trees.
- Why not D: the autoindex is part of the schema, not a temporary artefact.
- Ref: [modules/02-type-system-and-schema.md](../modules/02-type-system-and-schema.md#31-the-rowid), https://www.sqlite.org/lang_createtable.html#rowid

</details>

### Q-SQLITE-009 · Conflict clauses · difficulty 2 · scenario

A nightly job loads partner rows with `INSERT OR REPLACE INTO account(id, email, plan) VALUES (?, ?, ?)`. Support reports that `account.notes` was reset to its default for updated accounts and that child `invoice` rows disappeared. Why, and what do you use instead?

- A) `OR REPLACE` deletes the conflicting row and inserts a new one: unmentioned columns revert to defaults and, with foreign keys on, `ON DELETE CASCADE` removes children. Use `INSERT ... ON CONFLICT(id) DO UPDATE SET ...`.
- B) `OR REPLACE` updates only the listed columns but wrongly fires triggers; add `PRAGMA recursive_triggers = OFF`.
- C) The job should use `OR IGNORE`, which updates the row in place.
- D) The job should use `OR FAIL`, which keeps the child rows but rolls back the statement.

<details><summary>Answer</summary>

**A.** `REPLACE` is delete plus insert. UPSERT updates in place: unmentioned columns survive, the rowid is unchanged and no delete cascades fire.

- Why not B: `OR REPLACE` does not update in place, and the cascade is a foreign-key action rather than a trigger flag.
- Why not C: `IGNORE` skips the conflicting row and updates nothing.
- Why not D: `FAIL` stops the statement and does not perform the update at all.
- Ref: [modules/02-type-system-and-schema.md](../modules/02-type-system-and-schema.md#41-the-on-conflict-algorithms), https://www.sqlite.org/lang_upsert.html

</details>

### Q-SQLITE-010 · Comparison semantics · difficulty 3 · single

Table `t(n INTEGER, s TEXT)` holds one row `(10, '10')`. How many of these four expressions are true for that row? (1) `n = '10'` (2) `s = 10` (3) `'10' = 10` (two literals) (4) `'10' > 9` (two literals)

- A) 1
- B) 2
- C) 3
- D) 4

<details><summary>Answer</summary>

**C.** (1) is true: the column has INTEGER affinity, so NUMERIC affinity is applied to the literal. (2) is true: the column has TEXT affinity, so the number is converted to `'10'`. (3) is false: two literals have no affinity, and TEXT never equals INTEGER. (4) is true: with no affinity, any TEXT value sorts above any number.

- Why not A, B, D: they miscount; only expression (3) is false.
- Ref: [modules/02-type-system-and-schema.md](../modules/02-type-system-and-schema.md#14-comparison-semantics), https://www.sqlite.org/datatype3.html#type_conversions_prior_to_comparison

</details>

### Q-SQLITE-011 · rowid selection · difficulty 3 · single

A rowid table has a row with rowid 9223372036854775807 (2⁶³ − 1) and no `AUTOINCREMENT`. A second, identical table was declared with `AUTOINCREMENT` and also holds that rowid. What does the next automatic insert do in each?

- A) Both fail with `SQLITE_FULL`.
- B) The plain table picks a random unused rowid; the `AUTOINCREMENT` table fails with `SQLITE_FULL`.
- C) The plain table wraps to 1; the `AUTOINCREMENT` table wraps to 1 as well.
- D) The plain table fails with `SQLITE_FULL`; the `AUTOINCREMENT` table picks a random rowid.

<details><summary>Answer</summary>

**B.** Without `AUTOINCREMENT`, if the largest rowid is the maximum, SQLite tries random unused positive rowids (and fails with `SQLITE_FULL` only if it cannot find one). With `AUTOINCREMENT` the high-water mark in `sqlite_sequence` is never lowered and never randomised, so the insert fails.

- Why not A, C, D: neither table wraps to 1, and the random fallback belongs to the plain table.
- Ref: [modules/02-type-system-and-schema.md](../modules/02-type-system-and-schema.md#32-rowid-selection), https://www.sqlite.org/autoinc.html

</details>

---

## D3 · SQL dialect

### Q-SQLITE-012 · Window frames · difficulty 2 · scenario

A running-total query `SUM(amount) OVER (ORDER BY day)` returns identical totals for two rows that share the same `day`. A colleague calls it a SQLite bug. What is the cause and fix?

- A) The default frame is `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`, which includes peers (rows tied on `day`). Use `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` or a unique tiebreaker in `ORDER BY`.
- B) Window functions are evaluated before `ORDER BY`; add `PARTITION BY day`.
- C) `SUM` as a window function ignores `ORDER BY`; use `total()`.
- D) The `GROUPS` frame must be added to avoid double counting.

<details><summary>Answer</summary>

**A.** With an `ORDER BY` and no explicit frame, tied rows are peers and all see each other in the frame.

- Why not B: `PARTITION BY day` would make each day its own window and break the running total.
- Why not C: `ORDER BY` is honoured; `total()` only differs for empty sets and overflow.
- Why not D: `GROUPS` frames count peer groups and would also treat ties together.
- Ref: [modules/03-sql-dialect-and-features.md](../modules/03-sql-dialect-and-features.md#61-frames), https://www.sqlite.org/windowfunctions.html

</details>

### Q-SQLITE-013 · RETURNING · difficulty 2 · scenario

A cleanup endpoint runs `DELETE FROM job WHERE done = 1 RETURNING id` and reads only the first row with `.get()` "to be safe". The table had a million finished jobs; after the call they are all gone and the request took seconds. Why?

- A) `RETURNING` converts the statement to `DELETE` without `WHERE` when read with `.get()`.
- B) SQLite performs all modifications on the first `sqlite3_step()` and buffers the returned rows, so reading one row does not limit the delete. Add a key range or `LIMIT` (where enabled).
- C) `.get()` forces `PRAGMA synchronous = OFF`.
- D) `RETURNING` deletes lazily, so the remaining rows were deleted by the next autocommit.

<details><summary>Answer</summary>

**B.** All changes happen during the first step; later steps only hand out buffered rows.

- Why not A, C, D: none of those mechanisms exist; the behaviour is the documented `RETURNING` implementation.
- Ref: [modules/03-sql-dialect-and-features.md](../modules/03-sql-dialect-and-features.md#32-returning), https://www.sqlite.org/lang_returning.html

</details>

### Q-SQLITE-014 · 12-step rebuild · difficulty 3 · ordering

You must change `parent.code` from an untyped column to `INTEGER` in a `STRICT` table that child tables reference with `ON DELETE CASCADE`, with foreign keys enabled. Ignoring the step that saves the SQL of dependent indexes, triggers and views, put these steps in the safe order:

1. `DROP TABLE parent`
2. `PRAGMA foreign_keys = OFF`
3. `COMMIT`
4. `CREATE TABLE new_parent (...) STRICT`
5. `PRAGMA foreign_key_check`
6. `BEGIN`
7. `INSERT INTO new_parent SELECT ... FROM parent`
8. `PRAGMA foreign_keys = ON`
9. `ALTER TABLE new_parent RENAME TO parent`
10. Re-create the dependent indexes, triggers and views

<details><summary>Answer</summary>

**2, 6, 4, 7, 1, 9, 10, 5, 3, 8.**

- The pragma must come first and outside the transaction because `PRAGMA foreign_keys` is a silent no-op inside one; with it on, `DROP TABLE parent` would run an implicit `DELETE` and cascade into the children.
- Create the new table and copy before dropping; rename the new table afterwards. Renaming the old table first would rewrite references in other tables to the name you are about to drop.
- `foreign_key_check` must return no rows before `COMMIT`; foreign keys are re-enabled last.
- Ref: [modules/03-sql-dialect-and-features.md](../modules/03-sql-dialect-and-features.md#7-alter-table-and-the-12-step-rebuild), https://www.sqlite.org/lang_altertable.html#otheralter

</details>

### Q-SQLITE-015 · Date arithmetic · difficulty 1 · single

What does `SELECT date('2026-01-31', '+1 month')` return in SQLite 3.54 with no further modifiers?

- A) `2026-02-28`
- B) `2026-03-03`
- C) `NULL`
- D) `2026-02-31`

<details><summary>Answer</summary>

**B.** February 31st is normalised forward, so the result overflows into March (the `ceiling` behaviour). Adding the `floor` modifier (3.46+) gives `2026-02-28`.

- Why not A: that needs `'floor'`.
- Why not C: `+1 month` is a valid modifier; unknown modifiers are what return `NULL`.
- Why not D: SQLite normalises invalid dates rather than returning them.
- Ref: [modules/03-sql-dialect-and-features.md](../modules/03-sql-dialect-and-features.md#5-date-and-time), https://www.sqlite.org/lang_datefunc.html

</details>

### Q-SQLITE-016 · Version drift · difficulty 2 · scenario

A report uses `date(x, 'end of month')`. It works in a script run with `node:sqlite` on Node 26.12.1 but returns `NULL` in the production service that uses better-sqlite3 13.0.3, with no error. What do you check and what do you do?

- A) The SQLite version of each binding: `end of month` arrived in 3.54.0, the service bundles 3.53.4, and unknown modifiers yield `NULL`. Upgrade, or use `date(x, 'start of month', '+1 month', '-1 day')`.
- B) The server's time zone: `end of month` needs `'localtime'`.
- C) The column's affinity: it must be NUMERIC for date modifiers to work.
- D) Whether `PRAGMA strict = ON` is set.

<details><summary>Answer</summary>

**A.** Date functions return `NULL` for unknown modifiers instead of raising an error, so a modifier newer than the binding fails silently.

- Why not B: time zones change the result value, not whether the modifier is recognised.
- Why not C: date functions accept text, numbers and Julian days regardless of affinity.
- Why not D: there is no such pragma.
- Ref: [modules/03-sql-dialect-and-features.md](../modules/03-sql-dialect-and-features.md#51-new-in-3540), https://www.sqlite.org/lang_datefunc.html

</details>

### Q-SQLITE-017 · JSON operators · difficulty 1 · single

For `doc = '{"a":{"b":[1,2,{"c":"x"}]}}'`, what do `doc -> '$.a.b[2].c'` and `doc ->> '$.a.b[2].c'` return?

- A) `'x'` and `'x'`
- B) `'"x"'` (JSON text, quotes kept) and `'x'` (an SQL text value)
- C) `'x'` and `'"x"'`
- D) `NULL` for both, because the path indexes into an array

<details><summary>Answer</summary>

**B.** `->` returns the JSON representation of the sub-element, so strings keep their quotes; `->>` returns an SQL value (TEXT, INTEGER, REAL or NULL).

- Why not A and C: they swap or collapse the two forms.
- Why not D: array indexes are valid in paths (`#-1` even counts from the end).
- Ref: [modules/03-sql-dialect-and-features.md](../modules/03-sql-dialect-and-features.md#41-text-json-jsonb-and-the-operators), https://www.sqlite.org/json1.html

</details>

---

## D4 · File format and storage

### Q-SQLITE-018 · Database header · difficulty 1 · single

A customer sends you a corrupted database file. Where in the file do you find which SQLite library last wrote to it?

- A) Bytes 40–43, the schema cookie.
- B) Bytes 60–63, `user_version`.
- C) Bytes 96–99, `SQLITE_VERSION_NUMBER` of the last writer (valid together with offsets 24 and 92).
- D) Bytes 68–71, `application_id`.

<details><summary>Answer</summary>

**C.** The 100-byte header stores the library version number of the last modifier at offset 96. Offset 92 holds the change-counter value for which it is valid.

- Why not A: the schema cookie counts DDL changes.
- Why not B and D: those two fields belong to the application (migration counter and file-type identifier).
- Ref: [modules/04-file-format-and-b-trees.md](../modules/04-file-format-and-b-trees.md#2-the-100-byte-header), https://www.sqlite.org/fileformat2.html#the_database_header

</details>

### Q-SQLITE-019 · Freelist and VACUUM · difficulty 2 · scenario

After deleting half the rows of a large table the file size is unchanged and the disk is still nearly full. `PRAGMA freelist_count` is large. A colleague proposes running `VACUUM` at noon. What should you check or say?

- A) Nothing: `VACUUM` is instant and non-blocking.
- B) Freed pages stay on the freelist and the file never shrinks by itself. `VACUUM` rebuilds the file but needs up to twice the database size in free space and holds the write lock for the whole run, so use a maintenance window or `VACUUM INTO` onto another volume. For the future consider `auto_vacuum = INCREMENTAL`, set before the first table.
- C) `VACUUM` only works in WAL mode.
- D) Run `PRAGMA auto_vacuum = FULL` now; it takes effect immediately on existing tables.

<details><summary>Answer</summary>

**B.**

- Why not A: it rewrites every page, needs temporary space and blocks writers.
- Why not C: `VACUUM` works in either journal mode.
- Why not D: changing `auto_vacuum` after tables exist needs a full `VACUUM` to take effect.
- Ref: [modules/04-file-format-and-b-trees.md](../modules/04-file-format-and-b-trees.md#72-vacuum), https://www.sqlite.org/lang_vacuum.html

</details>

### Q-SQLITE-020 · Overflow pages · difficulty 2 · scenario

A `doc` table has columns `(id, title, body_blob, status, updated_at)` where `body_blob` holds 2 MB values. Queries that read only `status` and `updated_at` are much slower than expected. Why, and what do you change?

- A) The blob sits before the columns being read, so SQLite must walk its overflow chain to reach later columns. Move the blob to the last column or into a side table keyed by the same id, or store large files outside the database.
- B) `status` should be `STRICT`.
- C) Overflow pages are never read unless the blob column is selected, so the cause is elsewhere.
- D) Each blob is stored in a separate file, which defeats the page cache.

<details><summary>Answer</summary>

**A.** In a record, columns are located by walking the header and body in order; a later column sits after the overflowing payload.

- Why not B: type enforcement does not affect storage layout.
- Why not C: the module's point is precisely that a column after a large value is reached through the chain.
- Why not D: SQLite stores everything in one file; overflow pages are pages of that file.
- Ref: [modules/04-file-format-and-b-trees.md](../modules/04-file-format-and-b-trees.md#6-overflow-pages), https://www.sqlite.org/fileformat2.html#cell_payload_overflow_pages

</details>

### Q-SQLITE-021 · Overflow formula · difficulty 3 · single

A rowid-table leaf cell has a 10,000-byte payload on a database with a 4096-byte page and no reserved bytes (usable size U = 4096). Using X = U − 35, M = ⌊(U − 12) · 32 / 255⌋ − 23 and K = M + ((P − M) mod (U − 4)), how many payload bytes stay on the leaf page and how many overflow pages are chained?

- A) 489 bytes local, 3 overflow pages
- B) 1816 bytes local, 2 overflow pages
- C) 4061 bytes local, 2 overflow pages
- D) 4092 bytes local, 1 overflow page

<details><summary>Answer</summary>

**B.** P = 10,000 > X = 4061, so overflow is needed. M = ⌊4084 · 32 / 255⌋ − 23 = 512 − 23 = 489. K = 489 + ((10,000 − 489) mod 4092) = 489 + (9511 mod 4092) = 489 + 1327 = 1816. Since K ≤ X, the local size is K = 1816, which fills the last overflow page exactly. The remaining 8184 bytes need 8184 / 4092 = 2 overflow pages.

- Why not A: 489 is M, used only when K exceeds X.
- Why not C: 4061 is the threshold X, not the local size once overflow starts.
- Why not D: 4092 is the payload capacity of one overflow page.
- Ref: [modules/04-file-format-and-b-trees.md](../modules/04-file-format-and-b-trees.md#6-overflow-pages), https://www.sqlite.org/fileformat2.html#cell_payload_overflow_pages

</details>

### Q-SQLITE-022 · VACUUM · difficulty 2 · multi

Which statements about `VACUUM` are true? (Select all that apply.)

- A) It can need up to twice the database size in free disk space.
- B) It holds an exclusive write lock for the whole run.
- C) It can change implicit rowids of tables without an `INTEGER PRIMARY KEY`.
- D) It can change `page_size` of a database that is in WAL mode.
- E) `VACUUM INTO 'copy.db'` compacts the original file in place and writes a log to `copy.db`.

<details><summary>Answer</summary>

**A, B, C.**

- Why not D: a `page_size` request is ignored in WAL mode; leave WAL first.
- Why not E: `VACUUM INTO` leaves the original untouched and writes the compacted copy to the new file.
- Ref: [modules/04-file-format-and-b-trees.md](../modules/04-file-format-and-b-trees.md#72-vacuum), https://www.sqlite.org/lang_vacuum.html

</details>

### Q-SQLITE-023 · Record format · difficulty 3 · hands-on

Create `t(id INTEGER PRIMARY KEY, a INTEGER, b TEXT, c REAL, d BLOB, e)`, insert `(42, 300, 'ahoj', 2.5, x'cafe', NULL)`, then read the database file and decode the single leaf cell without SQLite. Observable result: the page type byte is `0x0D`, the cell key (rowid) is 42, and the record's serial types are `[0, 2, 21, 7, 16, 0]`.

Verification: `examples/ts/04-file-format-and-b-trees.test.ts`, test "decode a row straight from the table B+tree leaf page".

<details><summary>Answer</summary>

Find the root page in `sqlite_schema.rootpage`, read that page, check the type byte, follow the cell pointer array to the cell, then decode: payload-size varint, rowid varint, then the record header (a varint header size plus one serial type per column). The rowid alias is stored as NULL (type 0) because its value lives in the cell key; 300 needs 2 bytes (type 2); 4-byte text is 13 + 2·4 = 21; a double is 7; a 2-byte blob is 12 + 2·2 = 16; `e` is NULL (0).

- Pitfall: on page 1 the B-tree header starts at byte 100, after the file header.
- Ref: [modules/04-file-format-and-b-trees.md](../modules/04-file-format-and-b-trees.md#52-records), https://www.sqlite.org/fileformat2.html#record_format

</details>

---

## D5 · Transactions and locking

### Q-SQLITE-024 · Lock states · difficulty 1 · single

In rollback-journal mode, what is the purpose of the `PENDING` lock state?

- A) It lets a second writer queue behind the first one.
- B) It stops new readers from acquiring `SHARED` while a writer waits for the existing readers to finish, which prevents writer starvation.
- C) It marks a transaction that has not yet read anything.
- D) It lets the writer modify the database file while readers continue.

<details><summary>Answer</summary>

**B.** A writer that needs `EXCLUSIVE` takes `PENDING`; existing `SHARED` holders finish, newcomers are turned away with `SQLITE_BUSY`, and the writer proceeds.

- Why not A: only one connection can hold `RESERVED`; a second `BEGIN IMMEDIATE` fails at once.
- Why not C: a deferred transaction holds no lock until its first statement.
- Why not D: writing the database file requires `EXCLUSIVE`, which excludes readers.
- Ref: [modules/05-transactions-locking-and-rollback-journal.md](../modules/05-transactions-locking-and-rollback-journal.md#2-the-five-lock-states), https://www.sqlite.org/lockingv3.html

</details>

### Q-SQLITE-025 · Deferred upgrade deadlock · difficulty 2 · scenario

Two requests each run `BEGIN; SELECT balance ...; UPDATE ...; COMMIT` on separate connections with `busy_timeout = 5000`. Under load one of them fails almost instantly with `SQLITE_BUSY`, long before five seconds. Why, and what fixes it?

- A) The timeout is per statement and was exhausted by the `SELECT`; raise it to 30 s.
- B) Both hold `SHARED`; the first `UPDATE` takes `RESERVED`, and the second needs `RESERVED` while holding `SHARED`, which would block the first one's commit. SQLite sees the deadlock and returns `SQLITE_BUSY` without calling the busy handler. The loser must roll back; use `BEGIN IMMEDIATE` for transactions that may write.
- C) `SELECT` takes `EXCLUSIVE` in deferred transactions; use `PRAGMA read_uncommitted = 1`.
- D) Switch to `journal_mode = MEMORY` so no locks are needed.

<details><summary>Answer</summary>

**B.** With `BEGIN IMMEDIATE` the second writer waits at `BEGIN` holding nothing, so the busy timeout works.

- Why not A: waiting cannot resolve a lock-upgrade deadlock, so the handler is bypassed.
- Why not C: `SELECT` takes `SHARED`, and the pragma does not apply here.
- Why not D: `MEMORY` loses atomicity on a crash and does not remove locking.
- Ref: [modules/05-transactions-locking-and-rollback-journal.md](../modules/05-transactions-locking-and-rollback-journal.md#31-the-deferred-upgrade-deadlock), https://www.sqlite.org/lockingv3.html

</details>

### Q-SQLITE-026 · Atomic commit · difficulty 2 · ordering

Put the steps of a rollback-journal commit in order (default `synchronous = FULL`):

1. Write the modified pages into the database file
2. Delete (or truncate, or zero the header of) the journal
3. Acquire `RESERVED`
4. `fsync` the database file
5. Copy the original images of the pages to be changed into the journal
6. Release the locks
7. `fsync` the journal
8. Acquire `PENDING`, then `EXCLUSIVE`

<details><summary>Answer</summary>

**3, 5, 7, 8, 1, 4, 2, 6.** Step 2 (removing the journal) is the commit point: before it a crash rolls back from the journal, after it the database already holds the whole new state.

- Common mistake: syncing the journal after writing database pages. The journal must be durable first, otherwise a crash during the database writes cannot be undone.
- Ref: [modules/05-transactions-locking-and-rollback-journal.md](../modules/05-transactions-locking-and-rollback-journal.md#4-atomic-commit-with-a-rollback-journal), https://www.sqlite.org/atomiccommit.html

</details>

### Q-SQLITE-027 · SQLITE_BUSY on COMMIT · difficulty 1 · scenario

In rollback-journal mode, `COMMIT` returns `SQLITE_BUSY` because a report connection is still reading. What state is the transaction in and what do you do?

- A) It was rolled back automatically; start again.
- B) It is still open with its changes intact; retry the `COMMIT` after the reader finishes (or let the busy timeout wait), or `ROLLBACK` if you give up.
- C) It is corrupt; delete the `-journal` file.
- D) It committed partially; run `PRAGMA integrity_check`.

<details><summary>Answer</summary>

**B.** The commit could not get `EXCLUSIVE` because readers held `SHARED`; the connection holds `PENDING` and the transaction is intact.

- Why not A: only a failed statement is rolled back, not the transaction.
- Why not C: deleting a journal is a way to corrupt a database.
- Why not D: nothing was written to the database file yet.
- Ref: [modules/05-transactions-locking-and-rollback-journal.md](../modules/05-transactions-locking-and-rollback-journal.md#2-the-five-lock-states), https://www.sqlite.org/lockingv3.html

</details>

### Q-SQLITE-028 · Crash safety · difficulty 3 · single

In rollback-journal mode with `synchronous = FULL`, power fails while the writer is overwriting database pages, after the journal and its directory entry were synced but before the journal is deleted. What does the next connection that opens the database observe, and why is it safe?

- A) A mix of old and new pages, which `integrity_check` then repairs.
- B) The new state, because some new pages were already written.
- C) The old state: the journal is hot and contains the original image of every page that could have changed, so recovery copies them back; recovery is idempotent even if repeated.
- D) The database is locked forever until an administrator deletes the journal.

<details><summary>Answer</summary>

**C.** The journal was synced before any database page was written (the protocol's invariant), so rollback restores exactly the pre-transaction state.

- Why not A: that is what the ordering of syncs exists to prevent.
- Why not B: the commit point is the removal of the journal, which did not happen.
- Why not D: deleting a hot journal corrupts the database; the next connection performs recovery by itself.
- Ref: [modules/05-transactions-locking-and-rollback-journal.md](../modules/05-transactions-locking-and-rollback-journal.md#40-why-every-crash-point-is-safe), https://www.sqlite.org/atomiccommit.html

</details>

### Q-SQLITE-029 · Hot journals · difficulty 2 · multi

Which statements about hot journals are true? (Select all that apply.)

- A) The next connection that wants to read takes `EXCLUSIVE`, restores the original pages from the journal, syncs, and deletes it.
- B) If the database looks fine, deleting `-journal` to unblock it is safe.
- C) A journal is matched to its database by file name, so moving the database without its journal orphans it.
- D) A read-only connection can always roll a hot journal back.
- E) Deleting a hot journal leaves half-written pages in the database.

<details><summary>Answer</summary>

**A, C, E.**

- Why not B: the database may contain partially written pages that only the journal can undo.
- Why not D: recovery needs write access; a read-only connection can get `SQLITE_READONLY_ROLLBACK`.
- Ref: [modules/05-transactions-locking-and-rollback-journal.md](../modules/05-transactions-locking-and-rollback-journal.md#5-hot-journals-and-recovery), https://www.sqlite.org/howtocorrupt.html

</details>

### Q-SQLITE-030 · Hot journal proof · difficulty 3 · hands-on

Prove hot-journal recovery. In a child process, open a rollback-mode database with a tiny `cache_size`, start a transaction that updates many rows so dirty pages spill into the database file, and have the process `SIGKILL` itself. In the parent, show that the journal file survived and the database bytes changed, then open the database. Observable result: zero updated rows are visible, `PRAGMA integrity_check` returns `ok`, and the journal is gone.

Verification: `examples/ts/05-transactions-and-locking.test.ts`, test "a hot journal left by a killed process is rolled back by the next connection".

<details><summary>Answer</summary>

A small cache forces a spill before commit, so the database file really is modified while the journal still holds the originals. `SIGKILL` skips every cleanup path. The next `open()` sees the hot journal, takes `EXCLUSIVE`, restores the pages and deletes the journal.

- Caveat: this proves crash atomicity for a process crash, not durability against power loss; a killed process leaves its writes in the OS page cache.
- Ref: [modules/05-transactions-locking-and-rollback-journal.md](../modules/05-transactions-locking-and-rollback-journal.md#5-hot-journals-and-recovery), https://www.sqlite.org/atomiccommit.html

</details>

### Q-SQLITE-031 · Abandoned iterator · difficulty 2 · scenario

An API handler uses `for (const row of stmt.iterate())` and, in a later refactor, drives the iterator by hand with `it.next()`, returning early without calling `it.return()`. Afterwards, in rollback mode, writers time out on `COMMIT`; in WAL mode the `-wal` file keeps growing. Why?

- A) The statement was never reset, so its read transaction stays open: `SHARED` blocks commits in rollback mode, and a pinned snapshot blocks checkpoints in WAL mode. Exhaust the iterator, call `return()`, or use `.all()` / `.get()`.
- B) `iterate()` takes `EXCLUSIVE`; use `.all()` only with `PRAGMA locking_mode = NORMAL`.
- C) Iterators retain the page cache, which fills the disk.
- D) The writer lost its `RESERVED` lock because iterators are not thread-safe.

<details><summary>Answer</summary>

**A.** A `break` or `return` directly inside `for...of` calls `return()` and is safe; a manually driven iterator must do it explicitly.

- Why not B: a plain `SELECT` takes `SHARED` or a snapshot, not `EXCLUSIVE`.
- Why not C: the cache is memory, and the symptom is lock and checkpoint related.
- Why not D: thread-safety is not involved.
- Ref: [modules/05-transactions-locking-and-rollback-journal.md](../modules/05-transactions-locking-and-rollback-journal.md#20-statements-hold-locks-too), https://www.sqlite.org/lockingv3.html

</details>

---

## D6 · WAL mode

### Q-SQLITE-032 · wal-index · difficulty 1 · single

Which file holds the WAL's hash index from page number to latest frame, plus read marks and lock bytes, and what does that imply?

- A) `-journal`; it can be copied anywhere.
- B) `-shm`, a memory-mapped file shared by every process on the same host; it is why WAL does not work over network filesystems.
- C) `-wal`; it is never read by readers.
- D) `-lock`; it is created once per host.

<details><summary>Answer</summary>

**B.** The wal-index is a rebuildable cache that all processes map; it needs coherent shared memory.

- Why not A: `-journal` is the rollback journal, not used in WAL mode.
- Why not C: `-wal` holds the frames themselves.
- Why not D: there is no such file.
- Ref: [modules/06-wal-mode.md](../modules/06-wal-mode.md#22-the--shm-file-wal-index), https://www.sqlite.org/wal.html

</details>

### Q-SQLITE-033 · WAL backups · difficulty 2 · scenario

An hourly cron job runs `cp app.db /backups/app-$(date +%H).db` on a live WAL-mode database. In a restore drill, a table created two hours ago is missing. Explain and fix.

- A) Recent commits live only in `app.db-wal` until a checkpoint, so the copy misses them (and can be torn while a checkpoint writes). Use `VACUUM INTO`, the online backup API, or WAL shipping such as Litestream.
- B) `cp` truncates files over 2 GiB.
- C) `PRAGMA synchronous = NORMAL` prevents the table from reaching the main file; use `FULL`.
- D) Copy `app.db-shm` along with `app.db`; it contains the missing table.

<details><summary>Answer</summary>

**A.**

- Why not B: unrelated to the symptom.
- Why not C: `NORMAL` affects when the WAL is synced, not whether committed data is in the main file.
- Why not D: `-shm` is a rebuildable index, not data. Copying `-wal` too is still not atomic.
- Ref: [modules/06-wal-mode.md](../modules/06-wal-mode.md#8-limits-and-caveats-of-wal-mode), https://www.sqlite.org/backup.html

</details>

### Q-SQLITE-034 · Checkpoint starvation · difficulty 2 · scenario

The `-wal` file of a busy service has grown to several gigabytes although `wal_autocheckpoint` is at its default. Reads are also getting slower. What is the most likely cause, how do you confirm it, and what do you change?

- A) A read transaction is always open (an abandoned iterator, a long report), so checkpoints cannot pass the oldest snapshot and the WAL cannot be reset. Confirm with `wal_checkpoint(NOOP)` or PASSIVE results (`checkpointed` far below `log`) and the `-wal` size; fix the long-lived reader and schedule `RESTART` or `TRUNCATE` checkpoints.
- B) `journal_size_limit` is too small; raise it.
- C) The WAL grows because `synchronous = FULL`; set `OFF`.
- D) `wal_autocheckpoint` truncates the file every 1000 pages, so something else is deleting the truncation.

<details><summary>Answer</summary>

**A.** Without a moment of zero readers the log can never restart, so it grows without bound and the wal-index hash grows too.

- Why not B: that setting truncates the file when a reset happens, which is exactly what cannot happen.
- Why not C: `synchronous` does not change checkpoint eligibility, and `OFF` risks corruption.
- Why not D: automatic checkpoints are PASSIVE and reuse the WAL without truncating it.
- Ref: [modules/06-wal-mode.md](../modules/06-wal-mode.md#63-checkpoint-starvation), https://www.sqlite.org/wal.html#avoiding_excessively_large_wal_files

</details>

### Q-SQLITE-035 · synchronous in WAL · difficulty 2 · single

A WAL-mode service uses `synchronous = NORMAL`. The host loses power. What can happen?

- A) The database can be corrupted, because the WAL is never synced.
- B) The most recent committed transactions may be lost (rolled back), but the database stays consistent; a mere process crash loses nothing.
- C) Every transaction since the last restart is lost.
- D) Nothing can be lost; `NORMAL` and `FULL` are identical in WAL mode.

<details><summary>Answer</summary>

**B.** In WAL mode `NORMAL` syncs the WAL only at checkpoints. Frames carry salts and cumulative checksums, so recovery stops at the last valid commit frame.

- Why not A: atomicity and consistency are preserved; durability is what is relaxed.
- Why not C: only the unsynced tail is at risk.
- Why not D: `FULL` syncs the WAL on every commit.
- Ref: [modules/06-wal-mode.md](../modules/06-wal-mode.md#5-durability-synchronousnormal-versus-full), https://www.sqlite.org/pragma.html#pragma_synchronous

</details>

### Q-SQLITE-036 · WAL commit path · difficulty 3 · ordering

Order the steps of a WAL commit (default `synchronous = FULL`):

1. Mark the last appended frame as the commit frame, carrying the database size in pages
2. Take the WAL write lock
3. Append a frame for each page the transaction changed
4. Update the wal-index so new snapshots see the commit
5. Check that the transaction's snapshot is still the latest, otherwise fail with `SQLITE_BUSY_SNAPSHOT`
6. Run a PASSIVE checkpoint if the WAL has reached `wal_autocheckpoint` pages
7. `fsync` the WAL

<details><summary>Answer</summary>

**2, 5, 3, 1, 7, 4, 6.** The commit becomes visible only after the frames (and, with `FULL`, the sync) are in place, and the checkpoint check happens last.

- Ref: [modules/06-wal-mode.md](../modules/06-wal-mode.md#41-the-commit-path), https://www.sqlite.org/wal.html

</details>

### Q-SQLITE-037 · Checkpoint modes · difficulty 2 · multi

Which statements about checkpoints are true? (Select all that apply.)

- A) `wal_checkpoint(TRUNCATE)` reports `busy = 1` while a read transaction is active.
- B) After the reader ends, `wal_checkpoint(TRUNCATE)` can report `busy = 0, log = 0` and leave a zero-byte `-wal` file.
- C) `PASSIVE` waits for readers to reach the latest snapshot.
- D) An automatic checkpoint truncates the WAL file to zero bytes.
- E) `RESTART` never waits for anyone.

<details><summary>Answer</summary>

**A, B.**

- Why not C: `PASSIVE` never waits; it copies only what is older than every reader.
- Why not D: after a successful automatic checkpoint the WAL is reused from the start but keeps its size, unless `journal_size_limit` is set.
- Why not E: `RESTART` waits for writers and until no reader uses the WAL.
- Ref: [modules/06-wal-mode.md](../modules/06-wal-mode.md#61-modes), https://www.sqlite.org/wal.html#ckpt

</details>

### Q-SQLITE-038 · WAL-reset bug · difficulty 3 · multi

The WAL-reset race (present since 3.7.0) was fixed in 3.51.3 and every release from 3.53.0, with backports to older lines. Which of these versions are **not** affected? (Select all that apply.)

- A) 3.49.0
- B) 3.51.3
- C) 3.53.4
- D) 3.50.7
- E) 3.51.2

<details><summary>Answer</summary>

**B, C, D.** 3.50.7 (and 3.44.6) carry the backported fix.

- Why not A: 3.49.0 lies inside the affected range and is not a backport release.
- Why not E: 3.51.2 is the last affected release.
- Note: the race needs two or more connections in different threads or processes writing or checkpointing at nearly the same instant, and is rated very rare; a startup version gate makes the exposure visible.
- Ref: [modules/06-wal-mode.md](../modules/06-wal-mode.md#7-the-wal-reset-bug-20102026), https://www.sqlite.org/wal.html#walresetbug

</details>

### Q-SQLITE-039 · BUSY_SNAPSHOT · difficulty 2 · hands-on

With two connections to one WAL database and `busy_timeout = 3000`, reproduce `SQLITE_BUSY_SNAPSHOT`: connection A starts a deferred transaction and reads, connection B commits a write, then A tries to write. Observable result: A's write fails immediately (well under the timeout) with `SQLITE_BUSY_SNAPSHOT`, fails again if retried inside the same transaction, and succeeds only after `ROLLBACK` and a re-run (best with `BEGIN IMMEDIATE`).

Verification: `examples/ts/06-wal-mode.test.ts`, tests "a read transaction that becomes stale can never write; busy_timeout does not help" and "BEGIN IMMEDIATE takes the write lock before reading, so its snapshot is always current".

<details><summary>Answer</summary>

A writer must work from the latest snapshot, otherwise a lost update would be possible. A's snapshot cannot advance while its transaction lives, so waiting is pointless and the busy handler is not used.

- Fix in code: start write transactions with `BEGIN IMMEDIATE`, and on this error roll back and re-run the whole transaction.
- Ref: [modules/06-wal-mode.md](../modules/06-wal-mode.md#4-writing-one-writer-latest-snapshot-only), https://www.sqlite.org/rescode.html#busy_snapshot

</details>

---

## D7 · Query planner and VDBE

### Q-SQLITE-040 · EXPLAIN QUERY PLAN · difficulty 1 · single

In `EXPLAIN QUERY PLAN` output, what is the difference between `SCAN t` and `SEARCH t USING INDEX i (a=?)`?

- A) `SCAN` visits every row of the table (or index) in order; `SEARCH` seeks directly using an index or the rowid with the shown constraint.
- B) `SCAN` uses an index; `SEARCH` does not.
- C) `SCAN` is for reads, `SEARCH` is for writes.
- D) They are synonyms; only the formatting changed in 3.54.

<details><summary>Answer</summary>

**A.** A `SCAN` of a large table is the first thing to question in a tuning pass.

- Why not B, C, D: they invert or deny the distinction.
- Ref: [modules/07-query-planner-and-vdbe.md](../modules/07-query-planner-and-vdbe.md#3-reading-explain-query-plan), https://www.sqlite.org/eqp.html

</details>

### Q-SQLITE-041 · Composite index prefix · difficulty 3 · multi

There is one index on `t(a, b, c)`. Which predicates can use it to **seek on column `b`** and not only on `a`? (Select all that apply.)

- A) `a = 1 AND b > 2 AND c = 3`
- B) `a IN (1, 2) AND b = 3`
- C) `b = 2`
- D) `a = 1 AND c = 3`

<details><summary>Answer</summary>

**A, B.** The index can seek with equality on a leftmost prefix and then at most one range column. In A the range is on `b`, and `c` is only checked from the index entries; in B each `IN` value gives an equality prefix.

- Why not C: no constraint on `a`, so a scan (a skip-scan needs statistics showing few distinct values of `a`).
- Why not D: `c` cannot narrow the seek past the gap at `b`; it is only checked.
- Ref: [modules/07-query-planner-and-vdbe.md](../modules/07-query-planner-and-vdbe.md#42-the-prefix-rule-for-composite-indexes), https://www.sqlite.org/optoverview.html

</details>

### Q-SQLITE-042 · LIKE optimisation · difficulty 2 · scenario

`CREATE INDEX user_name ON user(name)` exists, yet `WHERE name LIKE 'ab%'` shows `SCAN user`. Which fix keeps case-insensitive matching?

- A) Create the index (or declare the column) `COLLATE NOCASE`; use `GLOB 'ab*'` with the BINARY index only if case-sensitive matching is acceptable.
- B) Add `PRAGMA automatic_index = ON`.
- C) Put a leading `%` in the pattern.
- D) Bind the pattern as a parameter, which forces the range rewrite.

<details><summary>Answer</summary>

**A.** `LIKE` is case-insensitive by default, so the range rewrite is valid only on a NOCASE index.

- Why not B: automatic indexes serve joins.
- Why not C: a leading wildcard can never use a B-tree index.
- Why not D: a bound parameter does not make the rewrite more reliable.
- Ref: [modules/07-query-planner-and-vdbe.md](../modules/07-query-planner-and-vdbe.md#6-the-like-and-glob-optimisation), https://www.sqlite.org/optoverview.html#the_like_optimization

</details>

### Q-SQLITE-043 · Expression index · difficulty 2 · scenario

`CREATE INDEX u_email ON u(email)` exists, but `WHERE lower(email) = ?` scans the table. What is the fix and the rule behind it?

- A) Create `CREATE INDEX u_email_lower ON u(lower(email))`; a function applied to the column disqualifies a plain index, so the indexed expression must match the query's expression.
- B) Rewrite as `WHERE +email = ?`, which forces index use.
- C) Use `NOT INDEXED` to give the planner a hint.
- D) Run `ANALYZE`; statistics make functions indexable.

<details><summary>Answer</summary>

**A.**

- Why not B: unary `+` is the documented way to disqualify an index term.
- Why not C: `NOT INDEXED` forbids indexes.
- Why not D: statistics inform costs but do not change what is indexable.
- Ref: [modules/07-query-planner-and-vdbe.md](../modules/07-query-planner-and-vdbe.md#43-conditions-that-silently-disable-an-index), https://www.sqlite.org/expridx.html

</details>

### Q-SQLITE-044 · sqlite_stat1 · difficulty 3 · single

After `ANALYZE`, `sqlite_stat1` has the row `orders | orders_status_customer | 5000 2500 10` for an index on `(status, customer)`. How do you read it?

- A) 5000 rows in the index; on average 2500 rows share the same `status`; on average 10 rows share the same `(status, customer)`.
- B) 5000 distinct statuses, 2500 distinct customers, 10 pages.
- C) The first number is the page count, the others are timings.
- D) The index is 5000 bytes, with 2500-byte and 10-byte levels.

<details><summary>Answer</summary>

**A.** With `SQLITE_ENABLE_STAT4`, `sqlite_stat4` adds sampled keys so that selectivity can be estimated for a specific literal instead of an average.

- Why not B, C, D: they misread the columns.
- Ref: [modules/07-query-planner-and-vdbe.md](../modules/07-query-planner-and-vdbe.md#71-analyze-and-sqlite_stat1), https://www.sqlite.org/lang_analyze.html

</details>

### Q-SQLITE-045 · Skip-scan · difficulty 3 · hands-on

On an `orders` table with an index on `(status, customer)` where `status` has two distinct values, run `EXPLAIN QUERY PLAN SELECT ... WHERE customer = 7` before and after `ANALYZE`. Observable result: before, the plan is a `SCAN`; after, it is a `SEARCH` using the index with `ANY(status) AND customer=?` (a skip-scan).

Verification: `examples/ts/07-query-planner-and-vdbe.test.ts`, test "with statistics showing a low-cardinality first column, the planner uses a skip-scan".

<details><summary>Answer</summary>

Skip-scan iterates the distinct values of the leading column and seeks the second column inside each. The planner only considers it when statistics show few distinct leading values, so it is never used without `ANALYZE` (or `PRAGMA optimize`).

- Pitfall: assert the stable parts of the plan (`SCAN` vs `SEARCH`, the index name) rather than exact strings, which change between versions.
- Ref: [modules/07-query-planner-and-vdbe.md](../modules/07-query-planner-and-vdbe.md#73-skip-scan), https://www.sqlite.org/optoverview.html

</details>

### Q-SQLITE-046 · Partial index · difficulty 2 · scenario

A partial index `ON ticket(created) WHERE status = 'open'` is tiny, but the hot query `WHERE status = ? AND created > ?` (with `status` bound as a parameter) never uses it. Why, and what do you change?

- A) The planner proves the query implies the index predicate with simple syntactic rules and does not rely on a bound parameter. Write the constant into the query (`status = 'open'`).
- B) Partial indexes work only with `WITHOUT ROWID` tables.
- C) Partial indexes require `PRAGMA optimize = 0x10002`.
- D) The index must also include `status` as a key column.

<details><summary>Answer</summary>

**A.**

- Why not B and C: neither restriction exists.
- Why not D: the `WHERE` predicate is what the planner must match, not an extra key column.
- Ref: [modules/07-query-planner-and-vdbe.md](../modules/07-query-planner-and-vdbe.md#43-conditions-that-silently-disable-an-index), https://www.sqlite.org/partialindex.html

</details>

### Q-SQLITE-047 · Tuning procedure · difficulty 2 · ordering

Put a sensible tuning pass for one slow query in order:

1. Re-run `EXPLAIN QUERY PLAN` and measure
2. Run `EXPLAIN QUERY PLAN` and note every `SCAN`, temp B-tree and automatic index
3. Check the write cost of the new index
4. Design an index: equality columns, then the one range column, then `ORDER BY` columns
5. Run `PRAGMA optimize` (or `ANALYZE`) so the planner knows the new index
6. For each large `SCAN`, find out why no indexable term applies

<details><summary>Answer</summary>

**2, 6, 4, 5, 1, 3.** Every index adds a B-tree write per `INSERT` and per update of its columns, and enlarges the WAL, so cost is checked at the end.

- Ref: [modules/07-query-planner-and-vdbe.md](../modules/07-query-planner-and-vdbe.md#10-a-tuning-procedure), https://www.sqlite.org/queryplanner.html

</details>

---

## D8 · Extensions

### Q-SQLITE-048 · FTS5 query input · difficulty 2 · scenario

A search box passes the raw user string to `WHERE doc MATCH ?`. Typing `wal AND` produces an SQL error, and typing `title:secret` searches a column the user should not target. What do you do?

- A) Quote the input as one phrase, doubling embedded double quotes (`'"' + s.replaceAll('"','""') + '"'`), or quote each word for an all-words search.
- B) Wrap the query in `try/catch` and ignore errors.
- C) Switch to `LIKE`, which has no syntax.
- D) Disable FTS5 `bm25()`.

<details><summary>Answer</summary>

**A.** FTS5 query syntax errors are SQL errors, and operators in user input change the query's meaning.

- Why not B: swallowing errors leaves the injection of operators and column filters.
- Why not C: `LIKE '%x%'` cannot use a B-tree index (use the trigram tokenizer for that).
- Why not D: ranking is unrelated.
- Ref: [modules/08-extensions-fts5-rtree-and-virtual-tables.md](../modules/08-extensions-fts5-rtree-and-virtual-tables.md#22-query-syntax), https://www.sqlite.org/fts5.html#full_text_query_syntax

</details>

### Q-SQLITE-049 · BM25 · difficulty 1 · single

How do you get the best FTS5 matches first?

- A) `ORDER BY bm25(doc) DESC`
- B) `ORDER BY bm25(doc)` (or `ORDER BY rank`), because scores are negative and smaller is better
- C) `ORDER BY length(doc)`
- D) FTS5 returns matches best-first without an `ORDER BY`

<details><summary>Answer</summary>

**B.** FTS5 multiplies BM25 by −1 so that the natural ascending order is best-first. Column weights are extra arguments, in column order: `bm25(doc, 10.0, 1.0)`.

- Why not A: descending order gives the worst matches first.
- Why not C: it has nothing to do with relevance.
- Why not D: without `ORDER BY` the order is unspecified.
- Ref: [modules/08-extensions-fts5-rtree-and-virtual-tables.md](../modules/08-extensions-fts5-rtree-and-virtual-tables.md#23-ranking-with-bm25), https://www.sqlite.org/fts5.html#the_bm25_function

</details>

### Q-SQLITE-050 · External content · difficulty 2 · scenario

An FTS5 table is declared with `content='note', content_rowid='id'` and kept in sync with an `AFTER INSERT` trigger only. Users report deleted notes still appear in search results, and sometimes the wrong note appears. Why, and how do you repair it?

- A) Without delete and update triggers the index keeps ghost rowids, which can point at unrelated newer rows that reused the rowid. Add `AFTER DELETE` and `AFTER UPDATE` triggers that use the `'delete'` command with the **old** values, then run `INSERT INTO note_fts(note_fts) VALUES ('rebuild')`.
- B) Run `VACUUM`; it removes ghost entries.
- C) External content tables are read-only, so deleted notes cannot be removed.
- D) Use `PRAGMA foreign_keys = ON`.

<details><summary>Answer</summary>

**A.**

- Why not B: `VACUUM` rebuilds the file layout, not the FTS index contents.
- Why not C: the content table is an ordinary table; FTS5 just does not observe it.
- Why not D: foreign keys do not maintain virtual-table indexes.
- Ref: [modules/08-extensions-fts5-rtree-and-virtual-tables.md](../modules/08-extensions-fts5-rtree-and-virtual-tables.md#25-content-options), https://www.sqlite.org/fts5.html#external_content_tables

</details>

### Q-SQLITE-051 · Substring search · difficulty 1 · single

How do you make `WHERE title LIKE '%term%'` fast in SQLite?

- A) Add a normal B-tree index on `title`.
- B) Use an FTS5 table with the `trigram` tokenizer; it serves `LIKE` and `GLOB` substring patterns that contain at least three literal characters.
- C) Set `PRAGMA case_sensitive_like = ON`.
- D) Use the `porter` tokenizer.

<details><summary>Answer</summary>

**B.** The cost is index size, roughly three times the text.

- Why not A: a leading wildcard defeats a B-tree index.
- Why not C: that pragma only changes case handling.
- Why not D: Porter is an English stemmer and does not index substrings.
- Ref: [modules/08-extensions-fts5-rtree-and-virtual-tables.md](../modules/08-extensions-fts5-rtree-and-virtual-tables.md#24-tokenizers), https://www.sqlite.org/fts5.html#the_trigram_tokenizer

</details>

### Q-SQLITE-052 · Application-defined functions · difficulty 3 · multi

Which statements about application-defined functions used in the schema are true? (Select all that apply.)

- A) A function used in an expression index must be registered as deterministic.
- B) After you create such an index, any connection that has not registered the function, for example the CLI or a migration tool, fails with "no such function" when writing to that table.
- C) With `PRAGMA trusted_schema = OFF`, only functions marked innocuous can run from triggers, views and schema expressions.
- D) The SQL function `load_extension()` is enabled by default in every binding.
- E) `node:sqlite` loads extensions when `loadExtension()` is called, even if `allowExtension` was not set at construction.

<details><summary>Answer</summary>

**A, B, C.**

- Why not D: extension loading is off by default at every layer.
- Why not E: `node:sqlite` throws unless `allowExtension: true` was passed at open.
- Ref: [modules/08-extensions-fts5-rtree-and-virtual-tables.md](../modules/08-extensions-fts5-rtree-and-virtual-tables.md#62-security-flags-and-trusted_schema), https://www.sqlite.org/c3ref/create_function.html

</details>

---

## D9 · Application concurrency

### Q-SQLITE-053 · Write capacity · difficulty 2 · scenario

An SQLite-backed API tops out at about 10 writes per second although the disk is idle. The code opens `BEGIN IMMEDIATE`, calls a payment provider over HTTP (about 100 ms), then writes and commits. What is happening and what is the fix?

- A) The write lock is held for the whole HTTP call, so throughput is about 1 / 0.1 s = 10 per second. Do slow I/O first, then open a short `BEGIN IMMEDIATE` that re-validates and writes.
- B) SQLite limits writers to 10 per second by default; raise `SQLITE_MAX_WRITERS`.
- C) `synchronous = NORMAL` caps writes at 10 per second.
- D) Switch to `journal_mode = DELETE`, which allows concurrent writers.

<details><summary>Answer</summary>

**A.** Write throughput is about 1 / (time the write lock is held). Never hold a write transaction across non-SQLite I/O.

- Why not B: no such option exists.
- Why not C: `NORMAL` removes per-commit fsyncs and raises the ceiling.
- Why not D: no upstream journal mode allows concurrent writers.
- Ref: [modules/09-application-concurrency.md](../modules/09-application-concurrency.md#1-a-capacity-model-for-one-writer), https://www.sqlite.org/lockingv3.html

</details>

### Q-SQLITE-054 · Lost updates · difficulty 2 · multi

Two requests increment a counter with `SELECT n` then `UPDATE ... SET n = ?` in separate autocommit statements, and one increment is lost. Which changes fix it? (Select all that apply.)

- A) `UPDATE c SET n = n + 1 WHERE id = 1`
- B) Wrap the read and write in `BEGIN IMMEDIATE ... COMMIT`
- C) Add a version column: `UPDATE ... SET n = ?, v = v + 1 WHERE id = ? AND v = ?` and check that one row changed
- D) Raise `busy_timeout` to 30 seconds
- E) Set `synchronous = FULL`

<details><summary>Answer</summary>

**A, B, C.**

- Why not D: the lost update does not involve `SQLITE_BUSY`; two separate autocommit transactions both succeed.
- Why not E: durability settings do not change interleaving.
- Ref: [modules/09-application-concurrency.md](../modules/09-application-concurrency.md#5-lost-updates-and-how-to-avoid-them), https://www.sqlite.org/isolation.html

</details>

### Q-SQLITE-055 · Event loop · difficulty 2 · scenario

After a new "monthly report" endpoint ships (a 400 ms aggregate query with better-sqlite3 on the main thread), health checks and unrelated requests stall for 400 ms whenever a report runs. What is the cause and the fix?

- A) Synchronous drivers run on the calling thread, so the event loop is blocked for the query's duration. Run slow queries in a worker thread (or separate process) with its own connection, and monitor event-loop lag.
- B) WAL mode serialises readers; switch to rollback mode.
- C) Share the main-thread connection with a worker thread to avoid a second page cache.
- D) Wrap the query in `async` so it runs in the background.

<details><summary>Answer</summary>

**A.** A connection must never be used by two threads at once, so each worker opens its own.

- Why not B: WAL readers do not block each other; the stall is in JavaScript.
- Why not C: sharing a connection between threads is unsafe in the multi-thread build and gives no parallelism anyway.
- Why not D: `async` does not move synchronous native work off the thread.
- Ref: [modules/09-application-concurrency.md](../modules/09-application-concurrency.md#3-synchronous-drivers-and-the-event-loop), https://nodejs.org/api/worker_threads.html

</details>

### Q-SQLITE-056 · Network filesystems · difficulty 3 · scenario

Two Kubernetes pods on different nodes mount the same `ReadWriteMany` volume (backed by NFS) and both open `/data/app.db` in WAL mode. Everything works for weeks, then queries start returning `database disk image is malformed`. Explain and propose an architecture.

- A) NFS lacks reliable cross-host locking and WAL needs coherent shared memory (`-shm`) between processes on one kernel, so the file is eventually corrupted. Run one writer pod with a local volume and replicate, or use a server-based database.
- B) The pods ran out of inodes; resize the volume.
- C) WAL mode must be replaced by `journal_mode = MEMORY` on NFS.
- D) Add `PRAGMA locking_mode = EXCLUSIVE` in both pods so they take turns.

<details><summary>Answer</summary>

**A.** The rule: every process that opens the database must run under the same kernel, on a local filesystem. A cloud block volume attached to a single node is fine; a volume mounted on several nodes is a network filesystem.

- Why not B: inode exhaustion would not produce a malformed image.
- Why not C: `MEMORY` loses atomicity and does not fix locking.
- Why not D: exclusive mode makes the second pod fail rather than coordinate, and does not repair missing shared memory.
- Ref: [modules/09-application-concurrency.md](../modules/09-application-concurrency.md#6-network-filesystems-and-containers), https://www.sqlite.org/howtocorrupt.html

</details>

### Q-SQLITE-057 · fork() · difficulty 2 · scenario

A Python service using gunicorn with `preload_app` opens its SQLite connection at import time, then forks 4 workers. Sporadic corruption and lock errors appear. Why, and what do you change?

- A) Children inherit the open file descriptor, lock state and page cache of one connection, so processes drive it independently and can drop each other's POSIX locks. Open connections after the fork, for example in a post-fork hook.
- B) gunicorn disables WAL mode in forked workers.
- C) Python's `sqlite3` is not safe on Linux; use a different language.
- D) Add `check_same_thread=False` to share the connection among workers.

<details><summary>Answer</summary>

**A.** Never use a connection across `fork()`; this is listed among the documented corruption causes.

- Why not B: that behaviour does not exist.
- Why not C: the library is fine; the usage pattern is the problem.
- Why not D: that flag concerns threads, and sharing across processes is the problem.
- Ref: [modules/09-application-concurrency.md](../modules/09-application-concurrency.md#7-fork-process-pools-and-lock-lifetimes), https://www.sqlite.org/howtocorrupt.html

</details>

### Q-SQLITE-058 · Concurrent writers · difficulty 3 · hands-on

Run 8 worker threads, each with its own connection to one WAL database, each incrementing the same counter row 200 times. First use `BEGIN IMMEDIATE`, then deferred transactions. Observable result: with `BEGIN IMMEDIATE` there are no errors and the counter ends at exactly 1600; with deferred transactions some transactions fail with `SQLITE_BUSY` or `SQLITE_BUSY_SNAPSHOT` despite a long busy timeout, and every successful transaction is still counted exactly once.

Verification: `examples/ts/09-application-concurrency.test.ts`, tests "8 worker threads x 200 BEGIN IMMEDIATE increments: no errors, no lost updates" and "negative: the same workers with DEFERRED transactions hit SQLITE_BUSY_SNAPSHOT / BUSY".

<details><summary>Answer</summary>

`BEGIN IMMEDIATE` takes the write lock before the first read, so the busy timeout can wait and the snapshot is current. A deferred read-then-write transaction may read under an old snapshot and then be refused, which the busy handler cannot fix. SQLite never silently loses an update inside a transaction; it refuses, and the application retries the whole transaction.

- Ref: [modules/09-application-concurrency.md](../modules/09-application-concurrency.md#5-lost-updates-and-how-to-avoid-them), https://www.sqlite.org/wal.html

</details>

### Q-SQLITE-059 · Group commit · difficulty 2 · single

In a write queue that batches the jobs of one event-loop tick into one `BEGIN IMMEDIATE ... COMMIT`, when should each job's promise be resolved?

- A) Right after the job's statements run, to keep latency low.
- B) Only after the batch's `COMMIT` has returned successfully (with `synchronous = FULL` if the acknowledgement must survive power loss).
- C) Before the job runs, then retry in the background.
- D) After `PRAGMA wal_checkpoint(TRUNCATE)`.

<details><summary>Answer</summary>

**B.** Resolving earlier would tell a client "saved" for data that a failure of the batch or a crash could still undo. Per-job savepoints isolate a failing job (`ROLLBACK TO` rejects only its promise).

- Why not A and C: both acknowledge uncommitted work.
- Why not D: a checkpoint is not required for durability of a commit.
- Ref: [modules/09-application-concurrency.md](../modules/09-application-concurrency.md#42-group-commit), https://www.sqlite.org/lang_savepoint.html

</details>

---

## D10 · Durability and operations

### Q-SQLITE-060 · Live backup · difficulty 1 · single

Which is the safest way to take a consistent backup of a database that is being written to?

- A) `cp app.db backup.db`
- B) `VACUUM INTO 'backup.db'` (or the online backup API)
- C) Copy only `app.db-wal`
- D) `rm app.db-wal` then `cp app.db backup.db`

<details><summary>Answer</summary>

**B.** It produces a consistent, self-contained copy from one read transaction, including WAL-only commits.

- Why not A: it can miss WAL-only commits or capture torn pages.
- Why not C: the WAL alone is not a database.
- Why not D: deleting `-wal` discards committed transactions.
- Ref: [modules/10-durability-backup-and-operations.md](../modules/10-durability-backup-and-operations.md#3-backing-up-a-live-database), https://www.sqlite.org/lang_vacuum.html#vacuuminto

</details>

### Q-SQLITE-061 · Backup API · difficulty 3 · scenario

A nightly job copies a busy database with the online backup API in steps of 5 pages, sleeping between steps. It sometimes never finishes. Why, and what are the options?

- A) If another connection writes the source between steps, the backup restarts from page 1 at the next step, so small steps on a busy database can restart forever. Use large steps or a single step (`-1`), run the backup through the connection that does the writing (its changes are mirrored), or use `VACUUM INTO`.
- B) The API cannot copy WAL databases.
- C) Sleeping between steps releases the database file permanently.
- D) The backup API needs `synchronous = OFF`.

<details><summary>Answer</summary>

**A.**

- Why not B: WAL databases are supported, and a single step does not block writers there.
- Why not C: each step takes short read locks and then releases them.
- Why not D: the setting is unrelated.
- Ref: [modules/10-durability-backup-and-operations.md](../modules/10-durability-backup-and-operations.md#31-the-online-backup-api), https://www.sqlite.org/backup.html

</details>

### Q-SQLITE-062 · Restore drill · difficulty 2 · ordering

Put a restore drill for a SQLite backup in a sensible order:

1. Compare row counts with expectations
2. Copy the backup to a scratch path
3. Run `PRAGMA foreign_key_check`
4. Open the copy
5. Check `user_version` against the application's migration list
6. Run `PRAGMA integrity_check`

<details><summary>Answer</summary>

**2, 4, 6, 3, 1, 5.** Work on a copy, check structure first, then referential integrity, then content and schema version. A backup that has never been restored is a hope, not a backup.

- Ref: [modules/10-durability-backup-and-operations.md](../modules/10-durability-backup-and-operations.md#32-restore-drills), https://www.sqlite.org/pragma.html#pragma_integrity_check

</details>

### Q-SQLITE-063 · Migrations · difficulty 2 · scenario

Two instances of a service start at the same time against one database file, and a migration that adds a column then crashes halfway. Later, both instances sometimes try to apply the same migration. How should the migration runner be built?

- A) Keep the version in `PRAGMA user_version`. For each pending migration run `BEGIN IMMEDIATE`, re-check the version under the write lock, run the DDL, bump `user_version` in the same transaction, and commit. DDL is transactional, so a failure rolls back both. Refuse to run when the database version is newer than the code.
- B) Keep the version in a text file next to the database and update it after each migration.
- C) Run every migration outside a transaction for speed, and ignore "duplicate column" errors.
- D) Use `PRAGMA schema_version` as the migration counter.

<details><summary>Answer</summary>

**A.** Migrations that need the 12-step rebuild must toggle `foreign_keys` outside the transaction.

- Why not B: the file and the database can diverge after a crash.
- Why not C: it loses atomicity and hides real errors.
- Why not D: `schema_version` is the schema cookie that SQLite itself increments on every DDL; `user_version` is the field reserved for the application.
- Ref: [modules/10-durability-backup-and-operations.md](../modules/10-durability-backup-and-operations.md#5-schema-migrations-with-user_version), https://www.sqlite.org/pragma.html#pragma_user_version

</details>

### Q-SQLITE-064 · Durability · difficulty 3 · multi

Which statements about durability are true? (Select all that apply.)

- A) A test that `kill -9`s a writer proves crash atomicity, not durability against power loss.
- B) With WAL and `synchronous = NORMAL`, the most recent commits can roll back after power loss while the database stays consistent.
- C) On macOS, `fsync()` does not flush the drive's cache; SQLite uses `F_FULLFSYNC` only with `PRAGMA fullfsync = ON`.
- D) `synchronous = FULL` guarantees durability whatever the hypervisor and the drive do with flush requests.
- E) A process crash can lose a committed transaction in WAL mode with `NORMAL`.

<details><summary>Answer</summary>

**A, B, C.**

- Why not D: durability depends on every layer honouring flushes, and some virtual disks and consumer SSDs acknowledge them early.
- Why not E: the committed data is already in the OS page cache; only an OS crash or power loss can lose it.
- Ref: [modules/10-durability-backup-and-operations.md](../modules/10-durability-backup-and-operations.md#1-the-durability-chain), https://www.sqlite.org/pragma.html#pragma_fullfsync

</details>

### Q-SQLITE-065 · Changesets · difficulty 2 · hands-on

With `node:sqlite` sessions, record changes to a table with a primary key on database A and apply the changeset to database B. Observable result: when B matches A's old values, `applyChangeset` returns `true` and B has the same changes; when B's row has diverged, `applyChangeset` returns `false` with the default conflict handler and B is left untouched.

Verification: `examples/ts/10-durability-backup-and-operations.test.ts`, tests "record changes on one database and replay them on another" and "negative: a conflicting target makes applyChangeset abort by default".

<details><summary>Answer</summary>

A changeset stores, for each changed row, the operation, primary key, old and new values. An `UPDATE` whose recorded old values no longer match the target is a conflict. A custom `onConflict` can omit the change, replace the row or abort. Only tables with a declared primary key are tracked, and DDL is not recorded.

- Note: the session extension is built into `node:sqlite` but not into better-sqlite3.
- Ref: [modules/10-durability-backup-and-operations.md](../modules/10-durability-backup-and-operations.md#6-sessions-and-changesets), https://www.sqlite.org/sessionintro.html

</details>

---

## D11 · Edge and distributed SQLite

### Q-SQLITE-066 · Browser persistence · difficulty 2 · single

Which statement about persistent SQLite in the browser (official WASM build) is correct?

- A) `opfs` works on the main thread with no special headers.
- B) `opfs-sahpool` needs no COOP/COEP headers and is fast, but supports only one connection, so a second tab fails unless the app pauses and unpauses the VFS.
- C) `kvvfs` gives hundreds of megabytes on `localStorage`.
- D) All OPFS VFSes also work in Node.js.

<details><summary>Answer</summary>

**B.**

- Why not A: `opfs` needs a Worker and `SharedArrayBuffer`, so the page must send `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`.
- Why not C: `kvvfs` is limited to about 5 MB.
- Why not D: in Node `sqlite3_vfs_find('opfs')` returns 0.
- Ref: [modules/11-edge-and-distributed-sqlite.md](../modules/11-edge-and-distributed-sqlite.md#11-persistence-vfses-for-the-browser), https://sqlite.org/wasm/doc/trunk/persistence.md

</details>

### Q-SQLITE-067 · Litestream · difficulty 2 · scenario

After Litestream is added, the team's existing cron job that runs `PRAGMA wal_checkpoint(TRUNCATE)` every minute causes replication gaps and errors. Why?

- A) Litestream holds a long-lived read transaction so SQLite cannot reset the WAL before Litestream copies new frames, and performs checkpoints itself at moments it controls. Application-scheduled `TRUNCATE` or `RESTART` checkpoints fight with it; remove them.
- B) `TRUNCATE` is not allowed in WAL mode.
- C) Litestream requires `journal_mode = DELETE`.
- D) The cron job opens the file with a different VFS.

<details><summary>Answer</summary>

**A.** Litestream controls checkpointing so it can copy WAL frames to replica storage before they are overwritten or truncated. External TRUNCATE or RESTART checkpoints force WAL resets out of band, fighting with Litestream's read transactions and replication cycle.

- Why not B: it is a valid checkpoint mode.
- Why not C: Litestream replicates the WAL.
- Why not D: the VFS is irrelevant to the symptom.
- Ref: [modules/11-edge-and-distributed-sqlite.md](../modules/11-edge-and-distributed-sqlite.md#32-what-litestream-adds), https://litestream.io

</details>

### Q-SQLITE-068 · WAL shipping · difficulty 3 · hands-on

Build a replica using only file copies. On the primary, disable automatic checkpoints and run `wal_checkpoint(TRUNCATE)`, copy the main file as the snapshot, commit two more rows, then copy the `-wal` file next to the snapshot and open it. Repeat with a `-wal` copy that is missing its last 100 bytes. Observable result: the full copy shows all rows and `integrity_check` is `ok`; the torn copy shows the first transaction only, silently dropping the incomplete one, with no corruption.

Verification: `examples/ts/11-edge-and-distributed.test.ts`, tests "a replica built from a checkpointed snapshot and a copied -wal file sees later commits" and "negative: a torn WAL copy is cut at the last valid commit frame, not corrupted".

<details><summary>Answer</summary>

A snapshot of the main file plus every later WAL frame reproduces the database at any commit point. Recovery trusts frames only up to the last one with matching salts, checksum and commit marker, so partial uploads are safe by construction.

- Ref: [modules/11-edge-and-distributed-sqlite.md](../modules/11-edge-and-distributed-sqlite.md#31-the-principle-proven), https://www.sqlite.org/fileformat2.html#the_write_ahead_log

</details>

### Q-SQLITE-069 · SQLite or PostgreSQL? · difficulty 2 · scenario

A team runs a single-region SaaS on one application server with SQLite in WAL mode. Traffic doubled, and the CTO asks to migrate to PostgreSQL "to scale". Writes are short transactions, about 300 per second. How do you evaluate it?

- A) Measure first: short write transactions on one writer handle thousands per second and reads scale with cores, so doubled traffic alone is no trigger. Leave SQLite only if writers on several hosts must commit the same data with strong consistency, write transactions must be long-lived under concurrency, database-level access control is needed, the data outgrows one machine, or HA and PITR needs exceed what Litestream-style tooling provides.
- B) Migrate immediately: SQLite cannot exceed 100 requests per second.
- C) Migrate only if the file exceeds 1 GB.
- D) Keep SQLite and move the file to NFS so a second server can help.

<details><summary>Answer</summary>

**A.** Request rate alone, "it is production" or "we might scale later" are not triggers.

- Why not B and C: neither limit exists; the ceiling is far higher.
- Why not D: NFS is the one placement that breaks SQLite's locking.
- Ref: [modules/11-edge-and-distributed-sqlite.md](../modules/11-edge-and-distributed-sqlite.md#6-when-to-graduate-to-postgresql), https://www.sqlite.org/whentouse.html

</details>

### Q-SQLITE-070 · Replicating to the edge · difficulty 3 · scenario

A product catalog is written by one admin service (about 5,000 writes per day) and read by users worldwide, with a target of a few milliseconds per read from edge nodes. Stale reads of a few seconds are acceptable, and a user who edits an item must see their change. Which design fits SQLite-based tooling best?

- A) One primary accepts all writes; each edge node keeps a libSQL embedded replica (local reads, writes forwarded, sync on an interval). Route a writer's read-after-write to the primary or call `sync()` before it.
- B) Mount the primary's database file over NFS on every edge node.
- C) Run cr-sqlite so every edge node accepts writes, and enforce unique SKUs in each replica.
- D) Copy the file to the edges nightly and send writes to a random edge node.

<details><summary>Answer</summary>

**A.** Reads are local and fast; the single primary keeps one writer; staleness is bounded by the sync interval; read-your-writes is handled explicitly.

- Why not B: network filesystems break SQLite's locking and WAL's shared memory.
- Why not C: CRDT replicas cannot enforce global invariants such as unique SKUs.
- Why not D: nightly copies are far too stale, and random write routing creates several writers.
- Alternatives for the same shape: Litestream gives backup and point-in-time restore, not live read replicas (its read-replica VFS is experimental); rqlite adds consensus latency per write.
- Ref: [modules/12-libsql-and-turso.md](../modules/12-libsql-and-turso.md#23-embedded-replicas), https://docs.turso.tech

</details>

---

## D12 · libSQL and Turso

### Q-SQLITE-071 · Lineage · difficulty 1 · single

What is the difference between libSQL and Turso Database?

- A) They are the same project under two names.
- B) libSQL is a fork of the SQLite C code (base 3.45.1) with a server, protocol, embedded replicas and vectors; Turso Database (formerly Limbo) is a from-scratch Rust rewrite, still 0.x, adding MVCC concurrent writes, CDC and encryption.
- C) libSQL is the Rust rewrite and Turso Database is the C fork.
- D) Turso Database is a hosted service only and cannot run locally.

<details><summary>Answer</summary>

**B.**

- Why not A and C: they are different code bases in different languages.
- Why not D: Turso Cloud is the hosted platform; Turso Database runs in-process (`@tursodatabase/database`).
- Ref: [modules/12-libsql-and-turso.md](../modules/12-libsql-and-turso.md#1-lineage), https://docs.turso.tech

</details>

### Q-SQLITE-072 · Version lag · difficulty 2 · scenario

A migration runs `ALTER TABLE account ALTER COLUMN email SET NOT NULL` on better-sqlite3 13.0.3 (SQLite 3.53.4) in CI and passes, but fails against the production database behind `@libsql/client` 0.18.0. What do you do?

- A) libSQL's SQLite base is 3.45.1, which predates `SET NOT NULL` (3.53.0). Check `sqlite_version()` on every backend, and use the 12-step rebuild for the libSQL target.
- B) Add `PRAGMA strict = ON` in production.
- C) Upgrade Node.
- D) Wrap the statement in `BEGIN CONCURRENT`.

<details><summary>Answer</summary>

**A.** Everything upstream after 3.45.1 is missing in libSQL, and some gaps fail silently (date modifiers return `NULL`). Do not assume parity; assert the version.

- Why not B: no such pragma exists.
- Why not C: the Node version does not change the engine inside libSQL.
- Why not D: `BEGIN CONCURRENT` is a Turso Database feature, unrelated to DDL support.
- Ref: [modules/12-libsql-and-turso.md](../modules/12-libsql-and-turso.md#24-the-cost-of-the-fork-version-lag), https://docs.turso.tech

</details>

### Q-SQLITE-073 · Embedded replicas · difficulty 2 · scenario

An edge worker uses a libSQL embedded replica. A user changes a setting through the API, which writes via the replica; a second client then reads the setting from a different node's replica and sees the old value for several seconds. Explain and propose handling.

- A) Reads are served locally and writes are forwarded to the primary and then reflected back, so another replica is stale until its next `sync()` or `syncInterval`. Accept bounded staleness, call `sync()` before reads that must be fresh, or route such reads to the primary.
- B) Embedded replicas replicate synchronously, so the read must be wrong due to a bug.
- C) The replica has to be dropped and recreated on every write.
- D) Use `PRAGMA synchronous = FULL` on the replica.

<details><summary>Answer</summary>

**A.** This is the classic replication-lag anomaly. The client's `readYourWrites` option only concerns the connection's own writes, not other clients' writes.

- Why not B: replication is WAL-frame based and pulled, not synchronous.
- Why not C: far too expensive and unnecessary.
- Why not D: `synchronous` is a local durability setting and does not make replicas fresher.
- Ref: [modules/12-libsql-and-turso.md](../modules/12-libsql-and-turso.md#23-embedded-replicas), https://docs.turso.tech

</details>

### Q-SQLITE-074 · MVCC conflict · difficulty 3 · hands-on

With Turso Database 0.8.3, enable MVCC (`PRAGMA journal_mode = 'mvcc'`) and open two connections to one file. Run `BEGIN CONCURRENT` on both. First update disjoint rows, then update the same row from both. Observable result: disjoint updates both commit; on the same row the second writer's `UPDATE` fails immediately with a write-write conflict that already ended its transaction (an explicit `ROLLBACK` then fails with "no transaction is active"), and re-running the whole transaction succeeds with both increments counted.

Verification: `examples/ts/12-libsql-and-turso.test.ts`, tests "MVCC: BEGIN CONCURRENT lets two connections commit disjoint rows at the same time" and "negative: two concurrent writers to the same row conflict; the loser must roll back and retry".

<details><summary>Answer</summary>

This is optimistic concurrency control with row-level conflict detection: transactions run without locks and a conflict is found when two write the same row. Retry the **whole** transaction, not just the failed statement. For hot rows (a global counter) repeated conflicts can make MVCC slower than SQLite's plain serialised writes.

- Ref: [modules/12-libsql-and-turso.md](../modules/12-libsql-and-turso.md#32-mvcc-and-begin-concurrent), https://docs.turso.tech/tursodb/concurrent-writes

</details>

### Q-SQLITE-075 · Turso compatibility · difficulty 2 · multi

Which of these does Turso Database 0.8.x **not** offer compared with upstream SQLite? (Select all that apply.)

- A) FTS3/4/5 virtual tables
- B) Loading SQLite C extensions (`.so` files)
- C) The online backup API
- D) `BEGIN CONCURRENT` with MVCC
- E) A built-in change-data-capture table

<details><summary>Answer</summary>

**A, B, C.**

- Why not D and E: those are Turso Database's own additions (MVCC concurrent writes, `turso_cdc`).
- Also missing or partial: several window functions, aggregate `FILTER`, and many pragmas (`optimize`, `wal_autocheckpoint`, `mmap_size`). Always check `COMPAT.md` for the pinned version.
- Ref: [modules/12-libsql-and-turso.md](../modules/12-libsql-and-turso.md#36-compatibility-matrix), https://github.com/tursodatabase/turso/blob/main/COMPAT.md

</details>

---

## Mock interview (30 questions, 60 minutes)

A full-length simulation of the senior backend / database loop, drawn from the bank above. Allow **60 minutes**: about 1.5 minutes for a single or multi question, 2 minutes for a scenario or ordering question, and 3 to 4 minutes for a hands-on or design question (talk through the task and the observable result; do not run code). Answer from memory first, then open the answer blocks.

**Composition.** The domain mix follows the weights in the table at the top (2 / 3 / 2 / 3 / 3 / 3 / 3 / 2 / 3 / 3 / 2 / 1 questions for D1 to D12). It contains 3 hands-on tasks (items 2, 10 and 16) and 2 design scenarios (item 28, "SQLite or PostgreSQL?", and item 29, "replicate this to the edge").

| #   | Domain | Question     | Type              | Difficulty | Points |
| --- | ------ | ------------ | ----------------- | ---------- | ------ |
| 1   | D1     | Q-SQLITE-002 | scenario          | 2          | 2      |
| 2   | D1     | Q-SQLITE-005 | hands-on          | 3          | 3      |
| 3   | D2     | Q-SQLITE-008 | scenario          | 2          | 2      |
| 4   | D2     | Q-SQLITE-009 | scenario          | 2          | 2      |
| 5   | D2     | Q-SQLITE-011 | single            | 3          | 3      |
| 6   | D3     | Q-SQLITE-012 | scenario          | 2          | 2      |
| 7   | D3     | Q-SQLITE-014 | ordering          | 3          | 3      |
| 8   | D4     | Q-SQLITE-018 | single            | 1          | 1      |
| 9   | D4     | Q-SQLITE-021 | single            | 3          | 3      |
| 10  | D4     | Q-SQLITE-023 | hands-on          | 3          | 3      |
| 11  | D5     | Q-SQLITE-027 | scenario          | 1          | 1      |
| 12  | D5     | Q-SQLITE-026 | ordering          | 2          | 2      |
| 13  | D5     | Q-SQLITE-028 | single            | 3          | 3      |
| 14  | D6     | Q-SQLITE-034 | scenario          | 2          | 2      |
| 15  | D6     | Q-SQLITE-035 | single            | 2          | 2      |
| 16  | D6     | Q-SQLITE-039 | hands-on          | 2          | 2      |
| 17  | D7     | Q-SQLITE-040 | single            | 1          | 1      |
| 18  | D7     | Q-SQLITE-043 | scenario          | 2          | 2      |
| 19  | D7     | Q-SQLITE-046 | scenario          | 2          | 2      |
| 20  | D8     | Q-SQLITE-049 | single            | 1          | 1      |
| 21  | D8     | Q-SQLITE-050 | scenario          | 2          | 2      |
| 22  | D9     | Q-SQLITE-053 | scenario          | 2          | 2      |
| 23  | D9     | Q-SQLITE-054 | multi             | 2          | 2      |
| 24  | D9     | Q-SQLITE-056 | scenario          | 3          | 3      |
| 25  | D10    | Q-SQLITE-061 | scenario          | 3          | 3      |
| 26  | D10    | Q-SQLITE-063 | scenario          | 2          | 2      |
| 27  | D10    | Q-SQLITE-064 | multi             | 3          | 3      |
| 28  | D11    | Q-SQLITE-069 | scenario (design) | 2          | 2      |
| 29  | D11    | Q-SQLITE-070 | scenario (design) | 3          | 3      |
| 30  | D12    | Q-SQLITE-072 | scenario          | 2          | 2      |
|     |        |              | **Total**         |            | **66** |

### Scoring key

- **Points:** 1 per level-1 question (4 questions), 2 per level-2 (16 questions), 3 per level-3 (10 questions). Maximum **66**.
- **Partial credit:** `multi` and `ordering` questions are all-or-nothing in a strict marking; for self-study, award half the points when at most one option or position is wrong.
- **Hands-on and design items:** award full points only if you named the observable result (hands-on) or the trigger conditions and the trade-off (design), not merely the right keyword.
- **Pass mark:** 70 % = **47 / 66**.
- **Strong-hire bar:** 85 % = **57 / 66**.

| Score | Reading |
| --- | --- |
| 57 to 66 | Strong hire: can reason about internals, failure modes and design trade-offs. |
| 47 to 56 | Pass: solid, with gaps. Review the domains where you lost level-2 and level-3 points. |
| below 47 | Not yet. Re-read the modules for the domains with the most misses and redo the matching hands-on tests in `examples/ts/`. |

Answers are in the bank above under the listed question IDs. Domain sub-scores (D1 to D12) show where to study next.
