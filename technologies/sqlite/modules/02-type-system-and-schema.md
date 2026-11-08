# Module 02: Type System and Schema

SQLite's type system is the feature that surprises engineers from PostgreSQL the most. A column's declared type is a _preference_, not a constraint. The engine decides how to store each value at insert time, from rules that depend on the spelling of the type name. This module states those rules precisely, proves each one, and then covers the tools that restore discipline: `STRICT` tables, constraints, generated columns and foreign keys. It also covers the `rowid` machinery that every ordinary table is built on.

> **Owned elsewhere.** Normal forms, keys and relational modelling theory belong to [architecture/data-systems Module 01](../../../architecture/data-systems/modules/01-data-models-and-query-languages.md). This module teaches SQLite's realisation and its traps.

Proofs: [`examples/ts/02-type-system-and-schema.test.ts`](../examples/ts/02-type-system-and-schema.test.ts), plus the Python STRICT and foreign-key cases in [`examples/python/test_python_sqlite3.py`](../examples/python/test_python_sqlite3.py).

---

## 1. Values, storage classes and dynamic typing

### 1.1 Formal model

In SQLite a **value** has a type; a **column** does not. Formally, every stored value is a pair _(c, p)_ where _c_ is one of five **storage classes** and _p_ is a payload:

| Storage class | Payload | On-disk encoding ([Module 04](./04-file-format-and-b-trees.md)) |
| --- | --- | --- |
| `NULL` | none | serial type 0 |
| `INTEGER` | signed 64-bit two's-complement | serial types 1–6 (1, 2, 3, 4, 6 or 8 bytes) plus 8 and 9 for the constants 0 and 1 |
| `REAL` | IEEE-754 binary64 | serial type 7 |
| `TEXT` | string in the database encoding (UTF-8, UTF-16le or UTF-16be) | serial type 2·n + 13 |
| `BLOB` | raw bytes | serial type 2·n + 12 |

The function `typeof(x)` returns the storage class of a value. The SQL standard's model is the opposite: the column has the type, and every value in it conforms. SQLite calls its model **manifest typing** (the [datatype page](https://www.sqlite.org/datatype3.html) and the [flexible typing essay](https://www.sqlite.org/flextypegood.html) argue for it). The practical upshot is that one column can contain integers, text and blobs in different rows, and the tests demonstrate exactly that.

There is no separate Boolean, date, decimal or UUID type:

- **Booleans** are integers. `TRUE` and `FALSE` are keywords for 1 and 0 (since 3.23.0).
- **Dates and times** are stored as ISO-8601 `TEXT`, Julian-day `REAL`, or Unix-epoch `INTEGER`. The date functions accept all three ([Module 03](./03-sql-dialect-and-features.md#5-date-and-time)).
- **Decimals** do not exist in the core. `DECIMAL(10,2)` gets NUMERIC affinity and stores binary floating point or integers. Money should be stored as integer minor units (cents). The optional `decimal` extension adds text-based decimal arithmetic but is not in most bindings.
- **UUIDs** are stored as 16-byte `BLOB` (compact) or 36-character `TEXT` (readable). Turso adds `uuid7()`; upstream needs an extension.

### 1.2 Type affinity: the five rules

Each column has an **affinity**: a _preferred_ storage class, derived from its declared type by the first matching rule:

```text
AFFINITY(declared_type)                 ▹ case-insensitive substring tests, in this order
  1  if declared_type contains "INT"                       return INTEGER
  2  if it contains "CHAR", "CLOB" or "TEXT"                return TEXT
  3  if it contains "BLOB" or declared_type is empty        return BLOB      ▹ formerly called NONE
  4  if it contains "REAL", "FLOA" or "DOUB"                return REAL
  5  return NUMERIC
```

The order creates traps that the tests prove:

| Declared type | Rule hit | Affinity | Surprise |
| --- | --- | --- | --- |
| `BIGINT`, `TINYINT`, `INT8` | 1 | INTEGER | none |
| `VARCHAR(3)` | 2 | TEXT | The length is ignored; `'toolong'` is stored whole. |
| `DOUBLE PRECISION` | 4 | REAL | none |
| `DECIMAL(10,2)`, `BOOLEAN`, `DATE`, `DATETIME` | 5 | NUMERIC | `'2026-01-01'` stays text, but `'42'` becomes an integer. |
| `STRING` | 5 | **NUMERIC** | `'0123'` is stored as integer `123`; leading zeros vanish. Postcodes and phone numbers break. |
| `FLOATING POINT` | **1** (`POINT` contains `INT`) | **INTEGER** | Works by accident, because INTEGER affinity keeps non-integral reals as REAL. |
| `CHARINT` | 1 | INTEGER | Rule 1 beats rule 2. |
| _(no type)_ | 3 | BLOB | Values are stored exactly as given. |
| `ANY` (ordinary table) | 5 | NUMERIC | Only in a STRICT table does `ANY` mean "keep as given". |

### 1.3 What affinity does on store

When a value is written to a column, SQLite _may_ convert it, according to the column's affinity:

```text
APPLY-AFFINITY(value, affinity)
  1  switch affinity
  2  case TEXT:
  3      if value is INTEGER or REAL: return its text rendering
  4      return value
  5  case NUMERIC, INTEGER:
  6      if value is TEXT and is a well-formed integer or real literal
  7          v ← parse(value)                             ▹ '1e3' → 1000.0
  8          if v is REAL and v is integral and fits in 64 bits
  9              return INTEGER(v)                         ▹ '3.0' → 3
 10          return v
 11      if value is REAL and affinity = NUMERIC and integral: return INTEGER(value)
 12      return value                                      ▹ 'abc' and BLOBs pass through unchanged
 13  case REAL:
 14      if value is INTEGER: return REAL(value)           ▹ stored compactly, read back as REAL
 15      if value is numeric TEXT: return REAL(parse(value))
 16      return value
 17  case BLOB:
 18      return value                                      ▹ never converted
```

Invariant: conversion is applied only when it is **lossless and reversible** in the direction it goes. `'abc'` in an `INTEGER` column stays `TEXT`, and a BLOB is never converted. That is why a non-STRICT `INTEGER` column can hold text, blobs and reals side by side.

### 1.4 Comparison semantics

Comparisons need a rule for mixed storage classes. Without any affinity in play, values order by class:

$$\text{NULL} < \{\text{INTEGER}, \text{REAL}\} < \text{TEXT} < \text{BLOB}$$

Integers and reals compare numerically with each other. Text compares with the collating sequence; blobs compare with `memcmp()`. So `'10' > 9` is true because any text exceeds any number.

Before comparing, SQLite applies affinity to the operands ([datatype3 § 4.2](https://www.sqlite.org/datatype3.html#type_conversions_prior_to_comparison)):

1. If one operand has INTEGER, REAL or NUMERIC affinity and the other has TEXT or BLOB affinity or none, NUMERIC affinity is applied to the other operand.
2. If one operand has TEXT affinity and the other has no affinity, TEXT affinity is applied to the other.
3. Otherwise no conversion happens.

A column reference has its column's affinity. `CAST(x AS type)` has that type's affinity. A literal has none. Hence, proven in the tests:

- `n = '10'` on an INTEGER column is true (rule 1 converts the literal).
- `t = 10` on a TEXT column is true (rule 2 converts the number to `'10'`).
- `'10' = 10` with two literals is false (no rule applies).

This matters for indexes. A predicate the planner can only satisfy after converting the _column_ cannot use the column's index. A predicate that converts the _literal_ can.

### 1.5 Collations

A collating sequence orders text. Three are built in:

| Collation | Rule |
| --- | --- |
| `BINARY` (default) | `memcmp()` of the encoded bytes. |
| `NOCASE` | Folds the 26 ASCII letters only. `'É' = 'é' COLLATE NOCASE` is **false** (proven). |
| `RTRIM` | Ignores trailing spaces. |

Collation is attached to a column (`name TEXT COLLATE NOCASE`), an index column, or an expression. An index can serve an `ORDER BY` or a comparison only if the collations agree, which is why `LIKE` index optimisation has collation preconditions ([Module 07](./07-query-planner-and-vdbe.md#6-the-like-and-glob-optimisation)). Unicode-aware case folding needs the ICU extension or an application-defined collation ([Module 08](./08-extensions-fts5-rtree-and-virtual-tables.md#6-application-defined-functions-and-aggregates)).

### 1.6 Arithmetic edge cases

| Expression | Result | Why |
| --- | --- | --- |
| `5 / 2` | `2` | Integer division truncates toward zero. |
| `5 / 2.0` | `2.5` | One REAL operand promotes the operation. |
| `9223372036854775807 + 1` | a REAL (≈ 9.22e18) | Integer overflow promotes to REAL instead of wrapping or raising. |
| `1 / 0` | `NULL` | Division by zero is NULL, not an error. |
| `0.1 + 0.2 = 0.3` | `0` | Binary floating point. |
| `'5' + 3` | `8` | Arithmetic operators apply NUMERIC conversion to text operands. |

At the JavaScript boundary, integers above 2⁵³ lose precision unless you ask for BigInt. The test proves that better-sqlite3 silently returns `9007199254740992` for a stored `9007199254740993`. Use `.safeIntegers(true)` (better-sqlite3), `readBigInts: true` (`node:sqlite`), or `intMode: 'bigint'` (`@libsql/client`) for 64-bit identifiers such as Snowflake IDs.

---

## 2. STRICT tables

`STRICT` (3.37.0, 2021-11-27) turns a table into a rigidly typed one ([STRICT tables](https://www.sqlite.org/stricttables.html)):

```sql
CREATE TABLE invoice (
  id        INTEGER PRIMARY KEY,
  customer  TEXT    NOT NULL,
  cents     INTEGER NOT NULL CHECK (cents >= 0),
  issued_at TEXT    NOT NULL,         -- ISO-8601; no DATETIME type in STRICT
  meta      ANY                       -- explicitly dynamic
) STRICT;
```

The rules:

1. Every column must declare exactly one of `INT`, `INTEGER`, `REAL`, `TEXT`, `BLOB` or `ANY`. `DATETIME`, `VARCHAR(20)` or `BOOLEAN` fail at `CREATE` time with "unknown datatype".
2. A value is accepted if it already has the column's class, or can be **losslessly** coerced the usual way. The text `'42'` becomes the integer `42`, and an integer goes into a `REAL` column as a real. Otherwise the write fails with `SQLITE_CONSTRAINT_DATATYPE`. Both `'abc'` and `1.5` are rejected by an `INTEGER` column.
3. `ANY` accepts any value and **never converts it**: `'0123'` stays text. In a non-STRICT table the same declaration means NUMERIC affinity.
4. `PRIMARY KEY` columns are implicitly `NOT NULL`, closing the legacy loophole in § 3.4.
5. Since 3.51.0, STRICT typing is also enforced on computed (generated) columns.

STRICT is a per-table, on-disk property recorded in the schema. Versions before 3.37.0 refuse to open a database containing a STRICT table, so it is a compatibility decision for files exchanged with old tools. Every binding in this track supports it, including libSQL's 3.45.1 base.

Can you combine `STRICT` with `WITHOUT ROWID`? Yes: `CREATE TABLE t(...) STRICT, WITHOUT ROWID`.

---

## 3. Rowid tables, INTEGER PRIMARY KEY and AUTOINCREMENT

### 3.1 The rowid

Every ordinary table is a **B+tree keyed by a 64-bit signed integer, the `rowid`** ([Module 04](./04-file-format-and-b-trees.md#4-table-btrees-and-index-b-trees)). It is reachable as `rowid`, `oid` or `_rowid_`, unless a real column uses one of those names. Since 3.54.0, `ALTER TABLE` refuses to add, drop or rename columns named `ROWID`, `_ROWID_` or `OID`.

A column declared **exactly** `INTEGER PRIMARY KEY` becomes an **alias** of the rowid. It is then not a separate column on disk: the key of the B+tree _is_ the column. Spellings that look equivalent are not:

| Declaration | Rowid alias? | Storage |
| --- | --- | --- |
| `id INTEGER PRIMARY KEY` | yes | the B+tree key |
| `id INTEGER PRIMARY KEY DESC` | **no** (historical quirk) | separate unique index |
| `id INT PRIMARY KEY` | **no** | separate unique index plus a hidden rowid |
| `id BIGINT PRIMARY KEY` | **no** | same |
| `id INTEGER, PRIMARY KEY(id)` | yes | table-constraint form also works |

The test proves the cost: `INT PRIMARY KEY` creates an extra `sqlite_autoindex_b_1` index, so every insert writes two B-trees and every lookup by `id` does two searches (index, then table).

### 3.2 Rowid selection

```text
NEXT-ROWID(table)                                  ▹ no AUTOINCREMENT
  1  m ← largest rowid currently in the table (or 0 if empty)
  2  if m < 2^63 − 1
  3      return m + 1                               ▹ so deleting the max row lets its rowid be reused
  4  repeat up to ~100 times
  5      r ← random positive 64-bit integer
  6      if r is unused: return r
  7  fail SQLITE_FULL
```

```text
NEXT-ROWID-AUTOINCREMENT(table)
  1  s ← sqlite_sequence[table]                     ▹ high-water mark, updated in the same transaction
  2  r ← max(s, largest rowid) + 1
  3  if r > 2^63 − 1: fail SQLITE_FULL              ▹ never wraps, never random
  4  sqlite_sequence[table] ← r
  5  return r
```

So `AUTOINCREMENT` guarantees _monotonic, never-reused_ keys at the cost of an extra read and write of the internal `sqlite_sequence` table on every insert. The [documentation](https://www.sqlite.org/autoinc.html) advises against it unless reuse is truly unacceptable: for example when deleted IDs were exposed externally and must never be reassigned. Both behaviours at the 2⁶³ − 1 boundary are proven in the tests.

### 3.3 WITHOUT ROWID tables

`WITHOUT ROWID` stores the table as a B-tree keyed by its declared `PRIMARY KEY` (a clustered index, in other engines' terms). Rules: the `PRIMARY KEY` is mandatory and implies `NOT NULL`, there is no `rowid`, and `AUTOINCREMENT` is unavailable.

Use it when:

- the primary key is non-integer or composite _and_ rows are small (the guideline is under about 1/20 of a page), for example a `(user_id, tag)` link table;
- most lookups are by the primary key, so the table-plus-index pair of a rowid table would mean two searches.

Avoid it when rows are large: a `WITHOUT ROWID` B-tree stores whole rows in interior pages, so large rows reduce fan-out. `last_insert_rowid()` and the incremental BLOB API do not work on it either.

### 3.4 The NULL primary key loophole

In an ordinary rowid table, a non-integer `PRIMARY KEY` column accepts `NULL`, and accepts many of them, because of a bug in early versions that is now kept for compatibility. The test inserts two `NULL` keys into `loose(k TEXT PRIMARY KEY)`. STRICT and `WITHOUT ROWID` tables enforce `NOT NULL`. In ordinary tables, write `TEXT PRIMARY KEY NOT NULL`.

---

## 4. Constraints and conflict resolution

| Constraint | SQLite specifics | Extended code on failure |
| --- | --- | --- |
| `NOT NULL` | As in the standard. Since 3.53.0 it can be added or dropped later: `ALTER TABLE t ALTER COLUMN c SET NOT NULL` / `DROP NOT NULL` ([Module 03](./03-sql-dialect-and-features.md#7-alter-table-and-the-12-step-rebuild)). | `SQLITE_CONSTRAINT_NOTNULL` |
| `UNIQUE` | Enforced by an automatic index (`sqlite_autoindex_<table>_<n>`). Many `NULL`s are allowed, because `NULL` is never equal to `NULL`. | `SQLITE_CONSTRAINT_UNIQUE` |
| `CHECK (expr)` | Evaluated per row on insert and update. A `NULL` result passes. Subqueries are not allowed. | `SQLITE_CONSTRAINT_CHECK` |
| `PRIMARY KEY` | See § 3. | `SQLITE_CONSTRAINT_PRIMARYKEY` |
| `REFERENCES` | See § 6. | `SQLITE_CONSTRAINT_FOREIGNKEY` |
| STRICT type check | See § 2. | `SQLITE_CONSTRAINT_DATATYPE` |

### 4.1 The ON CONFLICT algorithms

SQLite extends the standard with five [conflict-resolution algorithms](https://www.sqlite.org/lang_conflict.html). You attach one to a constraint in the DDL, or override it per statement with `INSERT OR <algorithm>` / `UPDATE OR <algorithm>`:

| Algorithm | Effect on the violating statement | Effect on the transaction |
| --- | --- | --- |
| `ABORT` (default) | Undo this statement's changes. | Kept; prior statements stay. |
| `ROLLBACK` | Abort the statement. | Rolled back entirely. |
| `FAIL` | Stop, but **keep** rows already changed by this statement. | Kept. |
| `IGNORE` | Skip the violating row and continue. | Kept. |
| `REPLACE` | Delete the pre-existing conflicting rows, then insert or update. For `NOT NULL`, substitute the column default. | Kept. |

`REPLACE` has two consequences people miss:

1. It is a **delete plus insert**. A new rowid may be assigned, unspecified columns revert to defaults, and with foreign keys on, `ON DELETE CASCADE` fires on the deleted row. Delete triggers fire only when `PRAGMA recursive_triggers = ON`.
2. It is not an upsert. To update in place, use `INSERT ... ON CONFLICT DO UPDATE` ([Module 03](./03-sql-dialect-and-features.md#3-upsert-and-returning)).

---

## 5. Generated columns

Generated columns (3.31.0) are computed from other columns of the same row ([docs](https://www.sqlite.org/gencol.html)):

```sql
CREATE TABLE line (
  price REAL, qty INTEGER,
  total REAL GENERATED ALWAYS AS (price * qty) STORED,   -- computed on write, occupies space
  label TEXT AS ('x' || qty) VIRTUAL                      -- computed on read (the default)
);
```

|                          | `VIRTUAL` (default)            | `STORED`                 |
| ------------------------ | ------------------------------ | ------------------------ |
| Computed                 | on read                        | on insert and update     |
| Disk space               | none                           | yes                      |
| `ALTER TABLE ADD COLUMN` | allowed                        | **not allowed** (proven) |
| Indexable                | yes (like an expression index) | yes                      |

Restrictions: the expression must be deterministic, may reference only columns of the same row, and cannot use subqueries or aggregates. Generated columns cannot be part of the `PRIMARY KEY`, and you cannot write to them (the test shows the error).

> **Then vs now: the 3.52 withdrawal.** Indexes on VIRTUAL generated columns whose expression yields a floating-point number derived from text or JSONB were one of the compatibility problems that caused 3.52.0 to be withdrawn. 3.53.0 adds `REINDEX EXPRESSIONS` to rebuild such indexes after an upgrade, and 3.54.0 stops updating an expression index during an `UPDATE` when the indexed value did not change.

---

## 6. Foreign keys

Foreign-key enforcement ([docs](https://www.sqlite.org/foreignkeys.html)) is a **per-connection** setting:

```sql
PRAGMA foreign_keys = ON;      -- must run outside a transaction; inside one it is a silent no-op
```

The library default is OFF, for compatibility with schemas from before 3.6.19 (2009). The bindings disagree, as [Module 01](./01-what-sqlite-is-bindings-and-cli.md#4-compile-time-defaults-the-hidden-configuration) proves: better-sqlite3 and `node:sqlite` turn it on, Python does not. Because the setting belongs to the connection, a single tool that forgets it (a migration script, an admin shell, a cron job) can insert orphans that the application would have refused.

What the tests prove:

- With enforcement off, a dangling reference is stored silently. `PRAGMA foreign_key_check` finds it afterwards, returning `(table, rowid, parent, fkid)` rows.
- With enforcement on, the insert fails with `SQLITE_CONSTRAINT_FOREIGNKEY`, and `ON DELETE CASCADE` deletes children.
- `PRAGMA foreign_keys = OFF` inside a transaction does nothing.
- `DEFERRABLE INITIALLY DEFERRED` postpones the check to `COMMIT`, so a transaction can insert the child before the parent. If a violation is still outstanding at `COMMIT`, the commit fails and the transaction **stays open**: you must fix the data or roll back. `PRAGMA defer_foreign_keys = ON` defers every constraint for the current transaction only.
- The parent key must be a `PRIMARY KEY` or have a `UNIQUE` index. Otherwise every write to the child fails with "foreign key mismatch", which is a DDL error that surfaces only at DML time.

### 6.1 Index the child column

SQLite does not create an index on the child (referencing) column. Deleting a parent row, or updating its key, makes SQLite search the child table for references. Without an index on `child(pid)` that is a full scan **per parent row**, so a bulk delete becomes O(parents × children). The fix is always the same: `CREATE INDEX child_pid ON child(pid);`. The same advice appears for PostgreSQL in [technologies/postgres Module 02](../../postgres/modules/02-relational-modeling-types-and-constraints.md).

---

## 7. The schema is a table

The schema lives in a B-tree like any other: `sqlite_schema` (also reachable by its legacy name `sqlite_master`), rooted at page 1. Each row holds `type`, `name`, `tbl_name`, `rootpage` and the original `sql` text:

```sql
SELECT type, name, rootpage, sql FROM sqlite_schema ORDER BY rootpage;
```

Three consequences:

1. **Every connection parses the whole schema on open, and again whenever another connection changes it.** The schema cookie at header offset 40 tells connections when to reload. Thousands of tables or triggers add startup cost, which is why 3.54.0 added `SQLITE_LIMIT_SCHEMA` (default 10 million objects).
2. **The original DDL text is preserved verbatim**, including comments. `ALTER TABLE` edits that text in place, which is why its abilities are limited ([Module 03](./03-sql-dialect-and-features.md#7-alter-table-and-the-12-step-rebuild)).
3. `PRAGMA writable_schema` lets you edit the schema table directly. That is a recovery tool, and a common way to corrupt a database ([Module 10](./10-durability-backup-and-operations.md)).

Useful introspection, all of it ordinary SQL since 3.16 (table-valued pragma functions):

```sql
SELECT * FROM pragma_table_info('invoice');          -- or pragma_table_xinfo for hidden/generated columns
SELECT * FROM pragma_index_list('invoice');
SELECT * FROM pragma_foreign_key_list('child');
SELECT name FROM pragma_table_list WHERE strict = 1;  -- 3.37+: which tables are STRICT
```

---

## 8. Then vs now

| Topic | Then (versions) | Now | Migration notes |
| --- | --- | --- | --- |
| Typing discipline | Affinity only; `CHECK (typeof(x) = 'integer')` as a workaround (all versions before 3.37.0) | `STRICT` tables (3.37.0+) | STRICT cannot be added with `ALTER TABLE`. Rebuild the table with the 12-step procedure, after cleaning rows that would violate the new types (find them with `typeof()`). |
| Booleans | `0`/`1` literals | `TRUE`/`FALSE` keywords (3.23.0+) | Values are still integers. |
| Generated columns | Triggers or views (before 3.31.0) | `GENERATED ALWAYS AS ... VIRTUAL/STORED` | Replace maintenance triggers with STORED columns; avoid relying on 3.52.0 for indexes on VIRTUAL columns. |
| Adding NOT NULL later | 12-step rebuild (before 3.53.0) | `ALTER TABLE ... ALTER COLUMN c SET NOT NULL` (3.53.0+) | Any binding that bundles 3.51 or older (libSQL's 3.45.1, for example) still needs the rebuild. |
| Schema table name | `sqlite_master` | `sqlite_schema` (3.33.0+), with the old name kept as an alias | Both work; new code should use `sqlite_schema`. |
| FK defaults in bindings | Off everywhere | On in better-sqlite3 and `node:sqlite`; still off in the library and in Python | Set it explicitly in every tool. |

---

## 9. Production failure modes

1. **Leading zeros vanish.** A column declared `STRING`, `NUMBER` or `DECIMAL` has NUMERIC affinity, so `'00420'` is stored as `420`. Use `TEXT` or `STRICT`. Proven.
2. **Text in a numeric column breaks aggregates.** `SUM(amount)` treats `'n/a'` as 0, and `ORDER BY amount` puts text after every number. Proven in principle by the storage-class ordering test; prevented by `STRICT`.
3. **Orphans from a tool without foreign keys.** One connection forgetting `PRAGMA foreign_keys = ON` silently corrupts referential integrity. Detect with `PRAGMA foreign_key_check` in CI and after migrations.
4. **Bulk parent delete takes minutes.** No index on the child FK column turns each cascade into a scan.
5. **`INSERT OR REPLACE` wipes columns and cascades.** It deletes and re-inserts, so columns not mentioned revert to defaults and FK cascades fire. Use UPSERT.
6. **IDs above 2⁵³ corrupted in JavaScript.** Default number mode rounds silently. Proven.
7. **`INT PRIMARY KEY` doubles write cost.** It is not a rowid alias.
8. **NULL primary keys** in ordinary tables with non-integer keys. Proven.
9. **Unicode case-insensitivity assumed.** `NOCASE` is ASCII-only. Proven.
10. **`AUTOINCREMENT` used by habit**: an extra B-tree write per insert, and a hard `SQLITE_FULL` at the end of the key space instead of random reuse. Proven.

---

## Interview Drill

<details><summary>1. A colleague says "SQLite ignores column types." Correct them precisely.</summary>

It does not ignore them; it maps each declared type to one of five affinities by substring rules (INT, then CHAR/CLOB/TEXT, then BLOB or empty, then REAL/FLOA/DOUB, else NUMERIC). Affinity is a _preference_: on store, values are converted to the preferred class when the conversion is lossless, and otherwise stored as given. Types are enforced only in `STRICT` tables, which reject non-coercible values with `SQLITE_CONSTRAINT_DATATYPE`.
</details>

<details><summary>2. Why does a column declared <code>STRING</code> lose leading zeros, while <code>VARCHAR</code> does not?</summary>

`VARCHAR` contains "CHAR", so it gets TEXT affinity. `STRING` matches none of the first four rules, so it falls through to NUMERIC affinity, which converts the well-formed numeric text `'0123'` to the integer 123.
</details>

<details><summary>3. What exactly makes a column a rowid alias, and why does it matter for performance?</summary>

Only the declaration `INTEGER PRIMARY KEY` (column or table-constraint form, not `DESC`), with the type spelled `INTEGER`. The column then _is_ the B+tree key, so a lookup by it is one tree search and an insert writes one tree. `INT PRIMARY KEY` or `BIGINT PRIMARY KEY` creates a separate unique index plus a hidden rowid: two B-trees per insert and two searches per lookup.
</details>

<details><summary>4. When is <code>AUTOINCREMENT</code> justified?</summary>

When a deleted ID must never be reassigned, for example because it was published in URLs, invoices or external systems. Without it SQLite uses max(rowid)+1, which reuses the top ID after the newest row is deleted. The cost is a `sqlite_sequence` read and write per insert, and `SQLITE_FULL` at 2⁶³ − 1 instead of random reuse.
</details>

<details><summary>5. When would you choose <code>WITHOUT ROWID</code>?</summary>

For tables with a non-integer or composite primary key and small rows that are mostly accessed by that key, such as many-to-many link tables or key/value tables with text keys. It saves the separate primary-key index and a second search. Avoid it for wide rows, since it stores whole rows in the B-tree, and where you need `last_insert_rowid()` or incremental BLOB I/O.
</details>

<details><summary>6. Your ETL inserted rows with orphaned foreign keys even though the schema declares REFERENCES. How?</summary>

Foreign-key enforcement is per connection and off by default in the library. The ETL's connection (Python, the CLI, or some other tool) never ran `PRAGMA foreign_keys = ON`, or ran it inside a transaction where it is a no-op. Detect with `PRAGMA foreign_key_check`; prevent by setting the pragma in every connection factory and by checking in CI.
</details>

<details><summary>7. Explain how SQLite decides whether <code>n = '10'</code> is true when <code>n</code> holds the integer 10.</summary>

Before comparing, it applies affinity. `n` is a column with INTEGER affinity and `'10'` is a literal with none, so NUMERIC affinity is applied to the literal, which becomes the integer 10, and the comparison is true. Two literals `'10' = 10` get no conversion, and TEXT is never equal to INTEGER, so that is false.
</details>
