# SQLite Bilingual Terminology Glossary

Terms used in the `technologies/sqlite/` track. All definitions are in English; each term gives its canonical English name and an established Czech equivalent. Where Czech technical usage has not settled on a translation, the English term is kept in _italics_ (or in parentheses), as Czech developer literature does; such terms are not translated here. Definitions follow the SQLite documentation, the track's modules and the Turso documentation. The source column links to the module section that teaches the term.

Terms shared with the [root glossary](../../GLOSSARY.md) are reproduced verbatim in [§13](#13-shared-with-the-root-glossary). Czech terms for concepts owned by other tracks (inverted index, Bloom filter, group commit, snapshot isolation, optimistic concurrency control, CTE, window function, trigger) follow the glossaries of [architecture/data-systems](../../architecture/data-systems/GLOSSARY.md) and [technologies/postgres](../postgres/GLOSSARY.md).

---

## 1. What SQLite is, bindings and the CLI (Module 01)

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Embedded Database** | **Vestavěná databáze** | A database engine linked into the application as a library and running in its process, with no separate server. | [Module 01](./modules/01-what-sqlite-is-bindings-and-cli.md#1-formal-definition) |
| **Serverless (SQLite sense)** | _serverless_ | No daemon owns the database file; every process that opens it runs its own copy of the engine and coordinates through OS file locks (and, in WAL mode, shared memory). | [Module 01](./modules/01-what-sqlite-is-bindings-and-cli.md#1-formal-definition) |
| **Amalgamation** | _amalgamation_ | The single-file C source (`sqlite3.c`) into which the SQLite sources are combined; every binding compiles its own copy. | [Module 01](./modules/01-what-sqlite-is-bindings-and-cli.md#3-bindings-and-the-version-you-actually-run) |
| **Connection** | **Spojení (databázové připojení)** | One open handle (`sqlite3*`) to one or more database files, with its own schema cache, page cache and transaction state. | [Module 01](./modules/01-what-sqlite-is-bindings-and-cli.md#21-the-object-model-every-binding-wraps) |
| **Prepared Statement** | **Připravený příkaz** | A compiled bytecode program (`sqlite3_stmt*`) for one SQL statement, which can be bound, stepped and reset repeatedly. | [Module 01](./modules/01-what-sqlite-is-bindings-and-cli.md#21-the-object-model-every-binding-wraps) |
| **VDBE (Virtual DataBase Engine)** | **Virtuální databázový stroj (VDBE)** | The register-based bytecode interpreter that executes the program the code generator emits for a statement. | [Module 01](./modules/01-what-sqlite-is-bindings-and-cli.md#2-the-architecture-from-sql-text-to-disk-pages) |
| **VFS (Virtual File System)** | **Virtuální souborový systém (VFS)** | SQLite's portability layer for open, read, write, sync, lock and shared memory; browser builds swap in an OPFS VFS. | [Module 01](./modules/01-what-sqlite-is-bindings-and-cli.md#2-the-architecture-from-sql-text-to-disk-pages) |
| **Threading Mode** | _threading mode_ | The compile-time choice (single-thread, multi-thread, serialized) that decides whether the application or SQLite serialises access to a connection. | [Module 01](./modules/01-what-sqlite-is-bindings-and-cli.md#22-threading-modes) |
| **Compile-Time Option** | **Volba při překladu (compile-time option)** | A build-time setting such as `DQS=0` or `DEFAULT_FOREIGN_KEYS` that changes defaults; visible through `PRAGMA compile_options`. | [Module 01](./modules/01-what-sqlite-is-bindings-and-cli.md#4-compile-time-defaults-the-hidden-configuration) |
| **Result Code / Extended Result Code** | **Výsledný kód / rozšířený výsledný kód** | The primary code is the low 8 bits of what an API call returns; extended codes add detail in the upper bits. | [Module 01](./modules/01-what-sqlite-is-bindings-and-cli.md#8-result-codes-the-error-vocabulary) |
| **SQLITE_BUSY** | `SQLITE_BUSY` | A different connection holds a conflicting file lock; a busy handler can sometimes wait it out. | [Module 01](./modules/01-what-sqlite-is-bindings-and-cli.md#8-result-codes-the-error-vocabulary) |
| **SQLITE_LOCKED** | `SQLITE_LOCKED` | A conflict inside the same connection (or shared cache); waiting never helps. | [Module 01](./modules/01-what-sqlite-is-bindings-and-cli.md#8-result-codes-the-error-vocabulary) |
| **Application File Format** | **Aplikační formát souboru** | Using a SQLite database as the document format of an application, identified through `application_id` and versioned through `user_version`. | [Module 01](./modules/01-what-sqlite-is-bindings-and-cli.md#12-sqlite-as-an-application-file-format) |
| **URI Filename** | **URI název souboru** | A `file:` URI accepted by `open` that carries parameters such as `mode`, `immutable`, `cache` and `vfs`. | [Module 01](./modules/01-what-sqlite-is-bindings-and-cli.md#61-uri-filenames) |

## 2. Type system and schema (Module 02)

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Storage Class** | _storage class_ | One of the five kinds of stored value: NULL, INTEGER, REAL, TEXT, BLOB. | [Module 02](./modules/02-type-system-and-schema.md#11-formal-model) |
| **Type Affinity** | _type affinity_ | A column's preferred storage class, derived from the spelling of its declared type by five ordered substring rules. | [Module 02](./modules/02-type-system-and-schema.md#12-type-affinity-the-five-rules) |
| **Manifest Typing** | _manifest typing_ | SQLite's model in which the type belongs to the value, not the column. | [Module 02](./modules/02-type-system-and-schema.md#11-formal-model) |
| **STRICT Table** | _STRICT_ tabulka | A table declared `STRICT`, which accepts only values losslessly coercible to the column's one declared type (INT, INTEGER, REAL, TEXT, BLOB, ANY). | [Module 02](./modules/02-type-system-and-schema.md#2-strict-tables) |
| **Rowid** | _rowid_ | The 64-bit signed integer key of the B+tree that stores an ordinary table. | [Module 02](./modules/02-type-system-and-schema.md#31-the-rowid) |
| **Rowid Alias (`INTEGER PRIMARY KEY`)** | _rowid alias_ | A column declared exactly `INTEGER PRIMARY KEY`, whose value is the rowid and costs no separate index. | [Module 02](./modules/02-type-system-and-schema.md#31-the-rowid) |
| **WITHOUT ROWID Table** | **Tabulka `WITHOUT ROWID`** | A table stored as a B-tree keyed by its declared primary key (a clustered index) with no rowid. | [Module 02](./modules/02-type-system-and-schema.md#33-without-rowid-tables) |
| **AUTOINCREMENT** | `AUTOINCREMENT` | A keyword that makes rowids monotonic and never reused, at the cost of maintaining `sqlite_sequence`. | [Module 02](./modules/02-type-system-and-schema.md#32-rowid-selection) |
| **Conflict Resolution Algorithm** | **Algoritmus řešení konfliktů** | One of ABORT, ROLLBACK, FAIL, IGNORE, REPLACE, selecting what happens when a constraint is violated. | [Module 02](./modules/02-type-system-and-schema.md#41-the-on-conflict-algorithms) |
| **Generated Column (virtual / stored)** | **Generovaný sloupec (virtuální / uložený)** | A column computed from other columns of the same row, either on read (virtual) or on write (stored). | [Module 02](./modules/02-type-system-and-schema.md#5-generated-columns) |
| **Foreign Key Enforcement** | **Vynucování cizích klíčů** | The per-connection setting `PRAGMA foreign_keys`, off in the library default. | [Module 02](./modules/02-type-system-and-schema.md#6-foreign-keys) |
| **Deferred Constraint** | **Odložené omezení** | A constraint checked at `COMMIT` instead of at each statement (`DEFERRABLE INITIALLY DEFERRED`). | [Module 02](./modules/02-type-system-and-schema.md#6-foreign-keys) |
| **Collating Sequence (BINARY / NOCASE / RTRIM)** | **Kolace (collating sequence)** | The rule that orders and compares text values; NOCASE folds ASCII letters only. | [Module 02](./modules/02-type-system-and-schema.md#15-collations) |
| **Schema Table (`sqlite_schema`)** | **Schematická tabulka (`sqlite_schema`)** | The table, rooted at page 1, that stores the original `CREATE` text of every object. | [Module 02](./modules/02-type-system-and-schema.md#7-the-schema-is-a-table) |

## 3. SQL dialect (Module 03)

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Common Table Expression (CTE)** | **Společný tabulkový výraz (CTE)** | A named subquery introduced by `WITH`, optionally `MATERIALIZED`. | [Module 03](./modules/03-sql-dialect-and-features.md#2-common-table-expressions) |
| **Recursive CTE** | **Rekurzivní CTE** | A CTE evaluated as a queue-driven fixpoint iteration; `UNION` ends cycles, `UNION ALL` does not. | [Module 03](./modules/03-sql-dialect-and-features.md#21-semantics-of-a-recursive-cte) |
| **Window Frame (`ROWS` / `RANGE` / `GROUPS`)** | **Vymezení rámce okna (window frame)** | The set of rows around the current row over which a window function computes; the default with `ORDER BY` is `RANGE` and includes peers. | [Module 03](./modules/03-sql-dialect-and-features.md#61-frames) |
| **UPSERT** | **Atomická vložení/úprava (upsert)** | `INSERT ... ON CONFLICT DO UPDATE`, which updates the existing row in place. | [Module 03](./modules/03-sql-dialect-and-features.md#31-upsert) |
| **RETURNING** | **Klauzule `RETURNING`** | A clause that makes `INSERT`, `UPDATE` and `DELETE` produce the affected rows; all changes happen on the first step. | [Module 03](./modules/03-sql-dialect-and-features.md#32-returning) |
| **JSONB** | **Binární formát JSON (JSONB)** | SQLite's internal binary encoding of JSON stored as a BLOB (3.45+); not the same as PostgreSQL `jsonb`. | [Module 03](./modules/03-sql-dialect-and-features.md#41-text-json-jsonb-and-the-operators) |
| **Bare Column** | _bare column_ | A non-aggregated, non-grouped column selected next to a single `min()` or `max()`; it comes from the extreme row. | [Module 03](./modules/03-sql-dialect-and-features.md#81-bare-columns-in-aggregates) |
| **12-Step Table Rebuild** | **Dvanáctikrokové přestavění tabulky** | The generalised `ALTER TABLE` procedure: create new, copy, drop old, rename, re-create dependants, with foreign keys disabled outside the transaction. | [Module 03](./modules/03-sql-dialect-and-features.md#7-alter-table-and-the-12-step-rebuild) |
| **Date Modifier** | **Modifikátor data** | An argument such as `+1 month` or `end of month` to the date functions; unknown modifiers return NULL. | [Module 03](./modules/03-sql-dialect-and-features.md#5-date-and-time) |

## 4. File format and storage (Module 04)

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Page** | **Datová stránka (blok)** | The fixed-size unit (a power of two from 512 to 65,536 bytes) into which the database file is divided. | [Module 04](./modules/04-file-format-and-b-trees.md#1-formal-model-a-file-is-an-array-of-pages) |
| **Database Header** | **Hlavička databáze** | The first 100 bytes of page 1, holding the magic string, page size, change counter, schema cookie, `user_version` and more. | [Module 04](./modules/04-file-format-and-b-trees.md#2-the-100-byte-header) |
| **Table B+tree** | **B+ strom tabulky** | The B+tree keyed by rowid whose leaves hold the row data. | [Module 04](./modules/04-file-format-and-b-trees.md#4-table-btrees-and-index-b-trees) |
| **Index B-tree** | **B-strom indexu** | A B-tree keyed by an arbitrary record (index columns plus rowid), which stores keys in interior pages too. | [Module 04](./modules/04-file-format-and-b-trees.md#4-table-btrees-and-index-b-trees) |
| **Cell** | _cell_ | One entry on a B-tree page (a key and possibly a payload). | [Module 04](./modules/04-file-format-and-b-trees.md#3-anatomy-of-a-b-tree-page) |
| **Cell Pointer Array** | **Pole ukazatelů na buňky (cell pointer array)** | The sorted array of 2-byte offsets at the start of a B-tree page that locates its cells. | [Module 04](./modules/04-file-format-and-b-trees.md#3-anatomy-of-a-b-tree-page) |
| **Varint** | _varint_ | SQLite's big-endian variable-length integer of 1 to 9 bytes. | [Module 04](./modules/04-file-format-and-b-trees.md#51-varints) |
| **Record** | **Záznam** | A header (header size plus one serial type per column) followed by the concatenated column values. | [Module 04](./modules/04-file-format-and-b-trees.md#52-records) |
| **Serial Type** | _serial type_ | The varint in a record header that gives both the type and the byte length of one value. | [Module 04](./modules/04-file-format-and-b-trees.md#52-records) |
| **Overflow Page** | **Přetoková stránka (overflow page)** | A page in a singly linked chain that holds the part of a large payload that does not fit on the B-tree page. | [Module 04](./modules/04-file-format-and-b-trees.md#6-overflow-pages) |
| **Freelist** | **Seznam volných stránek (freelist)** | The chain of trunk and leaf pages that records pages no longer in use. | [Module 04](./modules/04-file-format-and-b-trees.md#71-the-freelist) |
| **VACUUM** | `VACUUM` | Rebuilds the database into compact form; `VACUUM INTO` writes the compacted copy to a new file. | [Module 04](./modules/04-file-format-and-b-trees.md#72-vacuum) |
| **Auto-Vacuum** | **Automatické zmenšování souboru (auto-vacuum)** | NONE, FULL or INCREMENTAL mode controlling whether free pages are returned to the filesystem. | [Module 04](./modules/04-file-format-and-b-trees.md#73-auto_vacuum) |
| **Pointer-Map Page** | _pointer-map page_ | A page that exists only with auto-vacuum and records the parent of each page so pages can be moved. | [Module 04](./modules/04-file-format-and-b-trees.md#1-formal-model-a-file-is-an-array-of-pages) |
| **Lock-Byte Page** | _lock-byte page_ | The page containing offset 2^30, never used for data because locks live there. | [Module 04](./modules/04-file-format-and-b-trees.md#1-formal-model-a-file-is-an-array-of-pages) |
| **Page Cache** | **Mezipaměť stránek (page cache)** | The per-connection cache of database pages managed by the pager. | [Module 04](./modules/04-file-format-and-b-trees.md#31-from-pages-on-disk-to-pages-in-memory) |
| **dbstat** | `dbstat` | The virtual table that returns one row per page with its owner, type and space use. | [Module 04](./modules/04-file-format-and-b-trees.md#9-measuring-space-dbstat-and-diskused) |

## 5. Transactions and locking (Module 05)

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Transaction** | **Transakce** | A unit of work that is atomic, consistent, isolated and durable; in SQLite every statement runs in one. | [Module 05](./modules/05-transactions-locking-and-rollback-journal.md#1-transactions-in-sqlite) |
| **Lock State (SHARED / RESERVED / PENDING / EXCLUSIVE)** | **Stav zámku (sdílený / rezervovaný / čekající / exkluzivní)** | The five states the pager moves a connection through to coordinate access to the database file. | [Module 05](./modules/05-transactions-locking-and-rollback-journal.md#2-the-five-lock-states) |
| **Rollback Journal** | _rollback journal_ | An undo log in which original page images are saved before the database file is overwritten. | [Module 05](./modules/05-transactions-locking-and-rollback-journal.md#4-atomic-commit-with-a-rollback-journal) |
| **Hot Journal** | _hot journal_ | A valid, non-empty journal left by a writer that crashed before its commit point; the next connection rolls it back. | [Module 05](./modules/05-transactions-locking-and-rollback-journal.md#5-hot-journals-and-recovery) |
| **Atomic Commit** | **Atomické potvrzení** | A commit that either applies a transaction completely or not at all, whatever the crash point. | [Module 05](./modules/05-transactions-locking-and-rollback-journal.md#4-atomic-commit-with-a-rollback-journal) |
| **Commit Point** | **Bod potvrzení** | The instant after which a transaction is committed: deleting the journal (rollback mode) or writing the commit frame (WAL). | [Module 05](./modules/05-transactions-locking-and-rollback-journal.md#4-atomic-commit-with-a-rollback-journal) |
| **Busy Handler / Busy Timeout** | _busy handler_ / časový limit čekání (busy timeout) | The callback, or its simple timed form, that retries instead of returning `SQLITE_BUSY`. | [Module 05](./modules/05-transactions-locking-and-rollback-journal.md#7-sqlite_busy-and-the-busy-handler) |
| **Deferred / Immediate / Exclusive Transaction** | **Odložená / okamžitá / exkluzivní transakce** | The three `BEGIN` modes that decide when locks are taken. | [Module 05](./modules/05-transactions-locking-and-rollback-journal.md#3-begin-deferred-immediate-and-exclusive) |
| **Savepoint** | **Záchytný bod (savepoint)** | A named point inside a transaction to which work can be rolled back without ending the transaction. | [Module 05](./modules/05-transactions-locking-and-rollback-journal.md#8-savepoints-and-statement-journals) |
| **Statement Journal** | _statement journal_ | A temporary journal that lets a single statement be undone without undoing the whole transaction. | [Module 05](./modules/05-transactions-locking-and-rollback-journal.md#8-savepoints-and-statement-journals) |
| **Super-Journal** | _super-journal_ | The journal (formerly master journal) that names every per-file journal so a multi-file commit is atomic. | [Module 05](./modules/05-transactions-locking-and-rollback-journal.md#41-transactions-across-attached-databases) |
| **Journal Mode** | _journal mode_ | The setting (DELETE, TRUNCATE, PERSIST, MEMORY, WAL, OFF) that chooses how atomicity is implemented. | [Module 05](./modules/05-transactions-locking-and-rollback-journal.md#6-journal-modes) |

## 6. WAL mode (Module 06)

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **WAL File** | **Soubor WAL** | The `-wal` file holding appended page frames until a checkpoint copies them into the database. | [Module 06](./modules/06-wal-mode.md#21-the--wal-file) |
| **Wal-Index (`-shm`)** | _wal-index_ (`-shm`) | The shared-memory hash index from page number to latest frame, with read marks and lock bytes. | [Module 06](./modules/06-wal-mode.md#22-the--shm-file-wal-index) |
| **Frame** | _frame_ | One WAL record: a page image plus page number, commit size, salts and checksum. | [Module 06](./modules/06-wal-mode.md#21-the--wal-file) |
| **Commit Frame** | _commit frame_ | A frame whose commit size is non-zero; it ends a transaction. | [Module 06](./modules/06-wal-mode.md#1-formal-model) |
| **Read Mark** | _read mark_ | A wal-index slot recording the frame index an active snapshot is pinned to. | [Module 06](./modules/06-wal-mode.md#3-reading-snapshots-and-read-marks) |
| **Snapshot** | **Snímek (snapshot)** | The consistent view a reader keeps: the database as of the last commit frame at the time its read began. | [Module 06](./modules/06-wal-mode.md#3-reading-snapshots-and-read-marks) |
| **Checkpoint (PASSIVE / FULL / RESTART / TRUNCATE)** | **Kontrolní bod (checkpoint)** | Copying WAL frames into the database file; the four modes differ in whom they wait for and in what they leave behind. | [Module 06](./modules/06-wal-mode.md#61-modes) |
| **Checkpoint Starvation** | _checkpoint starvation_ | The WAL growing without bound because some reader is always open, so it can never be reset. | [Module 06](./modules/06-wal-mode.md#63-checkpoint-starvation) |
| **synchronous** | `synchronous` | The pragma (OFF, NORMAL, FULL, EXTRA) that decides how often SQLite calls `fsync`. | [Module 06](./modules/06-wal-mode.md#5-durability-synchronousnormal-versus-full) |
| **SQLITE_BUSY_SNAPSHOT** | `SQLITE_BUSY_SNAPSHOT` | A write attempt from a reader whose snapshot is no longer the latest; waiting cannot succeed. | [Module 06](./modules/06-wal-mode.md#4-writing-one-writer-latest-snapshot-only) |
| **WAL Reset** | _WAL reset_ | Restarting the WAL from its beginning after a full checkpoint with no readers; the site of the 2010–2026 race. | [Module 06](./modules/06-wal-mode.md#7-the-wal-reset-bug-20102026) |

## 7. Query planner and VDBE (Module 07)

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Query Planner (NGQP)** | **Plánovač dotazů (NGQP)** | The cost-based component that chooses join order and an access path per table; "next-generation" since 3.8.0. | [Module 07](./modules/07-query-planner-and-vdbe.md#1-from-sql-to-bytecode) |
| **Bytecode / Opcode** | **Bajtkód / operační kód (opcode)** | The VDBE program and its instructions, shown by `EXPLAIN`. | [Module 07](./modules/07-query-planner-and-vdbe.md#21-model) |
| **Cursor** | **Kurzor** | An open handle on a B-tree used by the VDBE to iterate or seek. | [Module 07](./modules/07-query-planner-and-vdbe.md#21-model) |
| **EXPLAIN QUERY PLAN** | `EXPLAIN QUERY PLAN` | The statement prefix that returns the chosen access paths and join order as a tree. | [Module 07](./modules/07-query-planner-and-vdbe.md#3-reading-explain-query-plan) |
| **Covering Index** | **Pokrývající index** | An index containing every column a query reads, so the table is not opened. | [Module 07](./modules/07-query-planner-and-vdbe.md#44-covering-indexes) |
| **Partial Index** | **Částečný index (partial index)** | An index with a `WHERE` clause that covers only the rows satisfying it. | [Module 07](./modules/07-query-planner-and-vdbe.md#43-conditions-that-silently-disable-an-index) |
| **Expression Index** | _expression index_ | An index on an expression, usable only when the query contains the same expression. | [Module 07](./modules/07-query-planner-and-vdbe.md#43-conditions-that-silently-disable-an-index) |
| **Automatic Index** | _automatic index_ | A transient index built for one statement to avoid scanning the inner table of a join repeatedly. | [Module 07](./modules/07-query-planner-and-vdbe.md#5-joins-automatic-indexes-and-bloom-filters) |
| **Skip-Scan** | _skip-scan_ | Using an index without a constraint on its leading column by iterating that column's distinct values. | [Module 07](./modules/07-query-planner-and-vdbe.md#73-skip-scan) |
| **ANALYZE / `sqlite_stat1` / `sqlite_stat4`** | `ANALYZE` / statistiky (`sqlite_stat1`, `sqlite_stat4`) | The command and tables that store row-count and selectivity statistics for the planner. | [Module 07](./modules/07-query-planner-and-vdbe.md#71-analyze-and-sqlite_stat1) |
| **Bloom Filter** | **Bloomův filtr** | A probabilistic set used since 3.38 to skip inner-loop seeks that cannot match. | [Module 07](./modules/07-query-planner-and-vdbe.md#5-joins-automatic-indexes-and-bloom-filters) |
| **LIKE Optimisation** | **Optimalizace operátoru `LIKE`** | Rewriting `LIKE 'abc%'` into a range so an index can serve it, under collation and affinity preconditions. | [Module 07](./modules/07-query-planner-and-vdbe.md#6-the-like-and-glob-optimisation) |
| **Selectivity** | **Selektivita** | The fraction of rows a predicate matches, which the planner estimates from statistics. | [Module 07](./modules/07-query-planner-and-vdbe.md#7-statistics) |

## 8. Extensions (Module 08)

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Virtual Table** | **Virtuální tabulka** | A table whose rows come from code through the module interface (`xBestIndex`, `xFilter`). | [Module 08](./modules/08-extensions-fts5-rtree-and-virtual-tables.md#41-how-the-planner-talks-to-a-virtual-table) |
| **Shadow Table** | _shadow table_ | An ordinary table a virtual table creates to hold its data, such as FTS5's `_data` and `_idx`. | [Module 08](./modules/08-extensions-fts5-rtree-and-virtual-tables.md#21-architecture) |
| **FTS5** | **Fulltextové vyhledávání (FTS5)** | SQLite's full-text search virtual table with BM25 ranking, tokenizers and external-content options. | [Module 08](./modules/08-extensions-fts5-rtree-and-virtual-tables.md#2-fts5-full-text-search) |
| **Tokenizer** | **Tokenizér** | The component that splits text into index tokens (`unicode61`, `ascii`, `porter`, `trigram`). | [Module 08](./modules/08-extensions-fts5-rtree-and-virtual-tables.md#24-tokenizers) |
| **Stemming** | **Stemming (kmenování)** | Reducing words to a stem so that forms match; the `porter` tokenizer does it for English. | [Module 08](./modules/08-extensions-fts5-rtree-and-virtual-tables.md#24-tokenizers) |
| **Trigram Tokenizer** | **Trigramový tokenizér** | A tokenizer that indexes every 3-character sequence, so substring `LIKE` and `GLOB` can use the index. | [Module 08](./modules/08-extensions-fts5-rtree-and-virtual-tables.md#24-tokenizers) |
| **BM25** | **BM25** | The Okapi ranking function; FTS5 returns it multiplied by −1, so smaller is better. | [Module 08](./modules/08-extensions-fts5-rtree-and-virtual-tables.md#23-ranking-with-bm25) |
| **External-Content Table** | _external-content table_ | An FTS5 table whose text lives in an ordinary table and which is kept in sync by triggers. | [Module 08](./modules/08-extensions-fts5-rtree-and-virtual-tables.md#25-content-options) |
| **R\*Tree** | **R*-strom (R*Tree)** | A virtual table indexing N-dimensional bounding boxes, with 32-bit float coordinates by default. | [Module 08](./modules/08-extensions-fts5-rtree-and-virtual-tables.md#3-rtree-and-geopoly) |
| **Application-Defined Function** | **Uživatelsky definovaná funkce** | A scalar, aggregate or window function registered from the host language. | [Module 08](./modules/08-extensions-fts5-rtree-and-virtual-tables.md#61-scalar-functions) |
| **Deterministic Function** | **Deterministická funkce** | A function whose result depends only on its arguments; required in index expressions. | [Module 08](./modules/08-extensions-fts5-rtree-and-virtual-tables.md#61-scalar-functions) |
| **Loadable Extension** | **Načítatelné rozšíření** | A shared library exporting `sqlite3_extension_init`, disabled by default. | [Module 08](./modules/08-extensions-fts5-rtree-and-virtual-tables.md#7-loadable-extensions-and-sqlite-vec) |
| **trusted_schema** | `trusted_schema` | The setting that, when OFF, lets only innocuous functions run from the schema. | [Module 08](./modules/08-extensions-fts5-rtree-and-virtual-tables.md#62-security-flags-and-trusted_schema) |

## 9. Application concurrency (Module 09)

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Single-Writer Model** | **Model jediného zapisovatele** | At most one write transaction at a time; throughput is about 1 / lock-hold time. | [Module 09](./modules/09-application-concurrency.md#1-a-capacity-model-for-one-writer) |
| **Connection per Thread** | **Jedno spojení na vlákno** | The rule that a connection is never used by two threads at once; each thread opens its own. | [Module 09](./modules/09-application-concurrency.md#2-connections-threads-and-processes) |
| **Event-Loop Blocking** | **Blokování smyčky událostí** | A synchronous driver running a slow query on the main thread and delaying all other work. | [Module 09](./modules/09-application-concurrency.md#3-synchronous-drivers-and-the-event-loop) |
| **Worker Thread** | **Pracovní vlákno (worker thread)** | A Node.js thread with its own event loop and database connection for heavy queries. | [Module 09](./modules/09-application-concurrency.md#3-synchronous-drivers-and-the-event-loop) |
| **Write Queue** | **Fronta zápisů** | A FIFO queue that funnels the writes of a process through one connection. | [Module 09](./modules/09-application-concurrency.md#41-contending-connections-versus-a-queue) |
| **Lost Update** | **Ztracená aktualizace** | An anomaly in which two read-modify-write cycles overwrite each other's result. | [Module 09](./modules/09-application-concurrency.md#5-lost-updates-and-how-to-avoid-them) |
| **Network Filesystem** | **Síťový souborový systém** | A filesystem such as NFS or SMB, where SQLite's locking and WAL's shared memory are unreliable. | [Module 09](./modules/09-application-concurrency.md#6-network-filesystems-and-containers) |

## 10. Durability and operations (Module 10)

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Durability** | **Trvanlivost (durabilita)** | The property that a committed transaction survives crashes and power loss, subject to the OS and disk honouring flushes. | [Module 10](./modules/10-durability-backup-and-operations.md#1-the-durability-chain) |
| **fsync / fullfsync** | `fsync` / `fullfsync` | The call that flushes data to the device; on macOS only `F_FULLFSYNC` (via `PRAGMA fullfsync`) flushes the drive cache. | [Module 10](./modules/10-durability-backup-and-operations.md#1-the-durability-chain) |
| **Corruption** | **Poškození databáze** | A file that violates the format; the documented causes are mostly outside SQLite. | [Module 10](./modules/10-durability-backup-and-operations.md#2-how-sqlite-databases-get-corrupted) |
| **Integrity Check** | **Kontrola integrity** | `PRAGMA integrity_check` and `quick_check`, which verify page structure and indexes. | [Module 10](./modules/10-durability-backup-and-operations.md#21-detecting-and-repairing-corruption) |
| **Online Backup API** | _online backup API_ | The incremental page-copy interface that backs up a live database. | [Module 10](./modules/10-durability-backup-and-operations.md#31-the-online-backup-api) |
| **VACUUM INTO** | `VACUUM INTO` | Writes a compacted, consistent copy of a database to a new file in one read transaction. | [Module 10](./modules/10-durability-backup-and-operations.md#3-backing-up-a-live-database) |
| **Restore Drill** | **Zkouška obnovy ze zálohy** | Restoring a backup to a scratch path and verifying it, to prove it works. | [Module 10](./modules/10-durability-backup-and-operations.md#32-restore-drills) |
| **`user_version` Migration** | **Migrace schématu přes `user_version`** | Versioning the schema in the header integer and applying pending migrations transactionally. | [Module 10](./modules/10-durability-backup-and-operations.md#5-schema-migrations-with-user_version) |
| **Session Extension** | _session extension_ | The extension that records changes to primary-keyed tables as changesets. | [Module 10](./modules/10-durability-backup-and-operations.md#6-sessions-and-changesets) |
| **Changeset / Patchset** | _changeset_ / _patchset_ | A serialised set of row changes with old and new values (changeset) or without old values for updates (patchset). | [Module 10](./modules/10-durability-backup-and-operations.md#6-sessions-and-changesets) |
| **Encryption at Rest** | **Šifrování uložených dat** | Encrypting the database file; upstream SQLite does not, so SEE, SQLCipher or fork-specific options are used. | [Module 10](./modules/10-durability-backup-and-operations.md#7-encryption-at-rest) |

## 11. Edge and distributed SQLite (Module 11)

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **WebAssembly (WASM)** | **WebAssembly (WASM)** | The portable binary format into which the official SQLite build is compiled to run in browsers. | [Module 11](./modules/11-edge-and-distributed-sqlite.md#1-sqlite-in-the-browser-the-official-wasm-build) |
| **OPFS (Origin Private File System)** | **Privátní souborový systém původu (OPFS)** | The browser storage API used by the persistent SQLite VFSes. | [Module 11](./modules/11-edge-and-distributed-sqlite.md#11-persistence-vfses-for-the-browser) |
| **WAL Shipping** | _WAL shipping_ | Copying a snapshot plus later WAL frames to another place, which reproduces the database at any commit point. | [Module 11](./modules/11-edge-and-distributed-sqlite.md#31-the-principle-proven) |
| **Read Replica** | **Čtecí replika** | A copy of the database that serves reads and receives changes asynchronously. | [Module 11](./modules/11-edge-and-distributed-sqlite.md#2-replicating-sqlite-the-design-space) |
| **Raft Consensus Algorithm** | **Konsenzuální algoritmus Raft** | The leader-based consensus protocol rqlite uses to replicate SQL statements. | [Module 11](./modules/11-edge-and-distributed-sqlite.md#4-litefs-rqlite-and-cr-sqlite) |
| **CRDT (Conflict-Free Replicated Data Type)** | **Datový typ replikovaný bez konfliktů (CRDT)** | A structure whose replicas accept concurrent writes and merge deterministically; cr-sqlite applies it to tables. | [Module 11](./modules/11-edge-and-distributed-sqlite.md#4-litefs-rqlite-and-cr-sqlite) |
| **Edge Database** | _edge database_ | A database placed close to users, for example per tenant or per object. | [Module 11](./modules/11-edge-and-distributed-sqlite.md#5-sqlite-on-edge-platforms) |

## 12. libSQL and Turso (Module 12)

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Embedded Replica** | _embedded replica_ | A local libSQL file kept in sync with a remote primary; reads are local, writes are forwarded. | [Module 12](./modules/12-libsql-and-turso.md#23-embedded-replicas) |
| **Fork (software)** | **Fork (odštěpený projekt)** | An independent continuation of a code base, as libSQL is of SQLite. | [Module 12](./modules/12-libsql-and-turso.md#1-lineage) |
| **BEGIN CONCURRENT** | `BEGIN CONCURRENT` | Turso Database's transaction mode (with MVCC) that lets several writers proceed and detects conflicts per row. | [Module 12](./modules/12-libsql-and-turso.md#32-mvcc-and-begin-concurrent) |
| **Write-Write Conflict** | **Konflikt zápis-zápis** | Two concurrent transactions modifying the same row; the second fails and must be retried. | [Module 12](./modules/12-libsql-and-turso.md#32-mvcc-and-begin-concurrent) |
| **Last-Write-Wins (last push wins)** | _last-write-wins_ | A conflict policy in which the most recent write or push overwrites earlier ones; Turso Sync uses it. | [Module 12](./modules/12-libsql-and-turso.md#35-turso-sync) |
| **Vector Index (ANN, DiskANN)** | **Vektorový index (ANN, DiskANN)** | An approximate nearest-neighbour index over vector columns; libSQL's is DiskANN-based. | [Module 12](./modules/12-libsql-and-turso.md#22-native-vectors) |
| **Change Data Capture (CDC)** | **Zachytávání změn dat (CDC)** | Recording every row change into a table for downstream use; Turso's is `turso_cdc`. | [Module 12](./modules/12-libsql-and-turso.md#33-change-data-capture) |

## 13. Shared with the root glossary

Copied verbatim from the [root glossary](../../GLOSSARY.md).

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Multi-Version Concurrency Control (MVCC)** | **Víceverzně řízené souběžné zpracování (MVCC)** | A concurrency control method where mutations generate new physical record versions instead of modifying data in place, allowing readers and writers to execute concurrently without mutual blocking. | Bernstein, Hadzilacos, Goodman (Concurrency Control & Recovery) |
| **Write-Ahead Logging (WAL)** | **Zápis do předstihového deníku (WAL)** | A durability protocol requiring state modifications to be flushed to non-volatile sequential log storage before the corresponding dirty page blocks are written to heap storage. | Mohan et al. (ARIES Recovery Algorithm) |
| **B-Tree (Balanced Tree)** | **B-strom (vyvážený vyhledávací strom)** | A self-balancing search tree data structure maintaining sorted keys with logarithmic search, insertion, and deletion times, optimized for disk block page access. | Bayer & McCreight (Organization and Maintenance of Large Ordered Indices) |
| **Point-In-Time Recovery (PITR)** | **Obnova k určitému časovému bodu (PITR)** | A disaster recovery mechanism that restores a base snapshot and continuously rolls forward sequential write-ahead logs up to an exact timestamp or transaction boundary. | Database Systems Architecture |
| **ACID** | **ACID (Atomicity, Consistency, Isolation, Durability)** | A suite of four standard properties guaranteeing that database transactions are processed reliably. | Haerder & Reuter |
| **Idempotence / Idempotency** | **Idempotence** | The property of an operation where multiple identical executions yield the exact same system state as a single execution (`f(f(x)) = f(x)`). | ISO/IEC 2382, RFC 9110 (HTTP Semantics) |
