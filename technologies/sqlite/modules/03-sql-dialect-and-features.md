# Module 03: The SQL Dialect and Its Modern Features

SQLite's SQL has grown a great deal in the last eight years. Window functions arrived in 3.25 (2018), UPSERT in 3.24, `RETURNING` and `DROP COLUMN` in 3.35 (2021), the `->`/`->>` JSON operators in 3.38 (2022), `RIGHT` and `FULL OUTER JOIN` in 3.39, binary JSONB in 3.45 (2024), and `ALTER COLUMN ... SET NOT NULL` in 3.53 (2026). Tutorials written against older releases teach workarounds for problems that no longer exist. This module teaches the current dialect, explains the semantics where SQLite differs from PostgreSQL, and shows exactly which version introduced each feature, so that you can tell what an older binding will reject.

> **Owned elsewhere.** Relational algebra and query-language theory: [data-systems Module 01](../../../architecture/data-systems/modules/01-data-models-and-query-languages.md). Window-function frame theory is covered for PostgreSQL in [technologies/postgres Module 04](../../postgres/modules/04-advanced-sql-ctes-and-window-functions.md); this module covers the SQLite surface and its differences.

Proofs: [`examples/ts/03-sql-dialect-and-features.test.ts`](../examples/ts/03-sql-dialect-and-features.test.ts), including the 3.54 date modifiers on `node:sqlite`.

---

## 1. Where the dialect sits

SQLite implements most of SQL-92 plus a large set of later standard features and its own extensions. The [omitted-features list](https://www.sqlite.org/omitted.html) is now short:

| Not supported | Why / alternative |
| --- | --- |
| `GRANT` / `REVOKE` | No users. Access control is file permissions, or the authorizer callback for untrusted SQL. |
| Stored procedures | The application _is_ the server; use application-defined functions ([Module 08](./08-extensions-fts5-rtree-and-virtual-tables.md#6-application-defined-functions-and-aggregates)). |
| Writing to views | Only through `INSTEAD OF` triggers. |
| Some `ALTER TABLE` forms | Changing a type or adding most constraints needs the 12-step rebuild (§ 7). |
| `FOR UPDATE` row locks | Pointless with one writer. Use `BEGIN IMMEDIATE` ([Module 05](./05-transactions-locking-and-rollback-journal.md)). |

And it adds things the standard lacks: `INSERT OR REPLACE` and the other conflict clauses ([Module 02](./02-type-system-and-schema.md#41-the-on-conflict-algorithms)), bare columns in aggregates (§ 8.1), `GLOB`, `iif()`, the `->>` operator, and optional `LIMIT` on `UPDATE`/`DELETE` (compile option `SQLITE_ENABLE_UPDATE_DELETE_LIMIT`, which better-sqlite3 enables).

---

## 2. Common table expressions

### 2.1 Semantics of a recursive CTE

A recursive CTE `WITH RECURSIVE r AS (initial UNION [ALL] recursive)` is evaluated as a **fixpoint iteration** over a queue, as defined in [lang_with § 3](https://www.sqlite.org/lang_with.html#recursive_common_table_expressions):

```text
EVAL-RECURSIVE-CTE(initial, recursive, union_all)
  1  Q ← rows(initial)                        ▹ the queue
  2  R ← ∅                                     ▹ the result
  3  while Q ≠ ∅                               ▹ invariant: every row in R has been fed to `recursive` once
  4      x ← extract one row from Q           ▹ FIFO, or by ORDER BY if the CTE has one
  5      if not union_all and x ∈ R: continue ▹ UNION discards duplicates, which ends cycles
  6      R ← R ∪ {x}
  7      Q ← Q ∪ rows(recursive with r bound to the single row x)
  8      if LIMIT reached: break
  9  return R
```

Two properties follow:

- **`UNION` terminates on cyclic graphs** because a row already seen is discarded; `UNION ALL` on a cycle loops until a `LIMIT` or a `WHERE depth < n` stops it. The test walks a 3-node cycle with `UNION` and gets exactly three rows.
- **The recursive step sees one row at a time**, so the recursive part may reference the CTE only once and cannot use aggregates over it.

An `ORDER BY` inside the recursive CTE turns the queue into a priority queue. `ORDER BY depth DESC` gives depth-first traversal; the default FIFO order gives breadth-first. This is SQLite-specific behaviour, documented on the same page.

```sql
WITH RECURSIVE chain(id, name, depth) AS (
  SELECT id, name, 0 FROM emp WHERE boss IS NULL
  UNION ALL
  SELECT e.id, e.name, c.depth + 1 FROM emp e JOIN chain c ON e.boss = c.id
)
SELECT name, depth FROM chain ORDER BY depth, id;
```

Library builds lack `generate_series` (a CLI-only extension, as [Module 01](./01-what-sqlite-is-bindings-and-cli.md#4-compile-time-defaults-the-hidden-configuration) proves). A counter CTE replaces it: `WITH RECURSIVE s(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM s WHERE x < 100) SELECT sum(x) FROM s` returns 5050.

### 2.2 Materialisation hints

Since 3.35.0 a CTE can carry `AS MATERIALIZED` or `AS NOT MATERIALIZED`. By default the planner decides: a CTE used once is usually inlined like a subquery; a CTE used more than once is usually computed once into an ephemeral table. `MATERIALIZED` forces the latter, and the plan shows `MATERIALIZE c` (proven). Use it when the CTE is expensive and referenced several times, or to stop the planner from pushing a predicate into a subquery that you want evaluated once.

### 2.3 CTE, subquery, view or temp table?

| Need | Use | Reason |
| --- | --- | --- |
| Name a step to make one query readable | CTE (inlined) | No runtime cost when used once. |
| Reuse an expensive intermediate result within one query | `AS MATERIALIZED` CTE | Computed once into an ephemeral B-tree. |
| Reuse it across several statements in one connection | `CREATE TEMP TABLE` | Lives in the connection's temp database (`temp_store` decides RAM or file); can be indexed. |
| Share the definition across connections | `CREATE VIEW` | Stored in the schema; expanded at each use. |

---

## 3. UPSERT and RETURNING

### 3.1 UPSERT

UPSERT (3.24.0, syntax borrowed from PostgreSQL) attaches an `ON CONFLICT` clause to `INSERT` ([lang_upsert](https://www.sqlite.org/lang_upsert.html)):

```sql
INSERT INTO counter(k, n) VALUES (?, 1)
ON CONFLICT(k) DO UPDATE SET n = n + excluded.n
RETURNING k, n, note;
```

- `excluded` is the row that _would have been_ inserted. Unqualified column names in `DO UPDATE` refer to the existing row.
- The conflict target must match a `UNIQUE` index or the `PRIMARY KEY`, including a partial index if its `WHERE` is repeated in the target.
- Since 3.35.0 several `ON CONFLICT` clauses may be listed. They are tried in order, and the last one may omit its target. The test resolves an `id` conflict with `DO NOTHING` and an `email` conflict with `DO UPDATE`.
- Unlike `INSERT OR REPLACE`, it updates the row **in place**: columns not mentioned keep their values, the rowid is unchanged, and no delete triggers or FK cascades fire. The tests show `note = 'custom'` surviving an UPSERT and being reset to its default by `OR REPLACE`.

**Parsing ambiguity.** In `INSERT INTO a SELECT ... FROM b ON CONFLICT ...`, the parser cannot tell whether `ON` begins a join constraint for `b` or the UPSERT clause. The documented fix is to add `WHERE true` to the `SELECT`. Without it the statement is a syntax error (proven).

### 3.2 RETURNING

`RETURNING` (3.35.0) makes `INSERT`, `UPDATE` and `DELETE` produce rows ([lang_returning](https://www.sqlite.org/lang_returning.html)). The mechanics explain its limits:

1. On the **first** `sqlite3_step()` the statement performs _all_ of its changes and buffers the `RETURNING` rows; later steps only hand the buffered rows out. So even reading one row of a 1-million-row `DELETE ... RETURNING` does all the deleting.
2. It reports the values as modified by the statement itself. Changes made later by `AFTER` triggers are not reflected, and rows changed by triggers or foreign-key actions are not reported at all.
3. The order of returned rows is unspecified.
4. It may not contain aggregate or window functions, and it cannot be used inside a trigger body.

`RETURNING` replaces the old `last_insert_rowid()` pattern, which is per connection and therefore wrong if any other code on the same connection inserts in between, including a trigger.

### 3.3 UPDATE ... FROM

Since 3.33.0, `UPDATE` can join another table or subquery (PostgreSQL syntax). The test applies aggregated stock deltas in one statement. Two rules: the target table must not appear again in the `FROM` clause unless aliased, and if a target row matches several `FROM` rows, which one is used is arbitrary. So aggregate first, as the test does.

---

## 4. JSON and JSONB

JSON functions are built in since 3.38.0 (before that, the `json1` extension had to be compiled in). Since 3.45.0 there is also **JSONB**, a binary encoding stored as a `BLOB` ([json1](https://www.sqlite.org/json1.html)).

### 4.1 Text JSON, JSONB, and the operators

| Form | Storage | Produced by | Notes |
| --- | --- | --- | --- |
| JSON text | `TEXT` | `json(x)`, `json_object(...)`, `->` | Re-parsed on every access. |
| JSONB | `BLOB` | `jsonb(x)`, `jsonb_object(...)` and every `jsonb_*` function | Pre-parsed: a header byte with type and payload size per element. No re-parse; usually slightly smaller. |

Every `json_*` function accepts either form as input. The `jsonb_*` variants return JSONB, and the `json_*` variants return text. JSONB is an _internal_ format: it is not BSON or PostgreSQL's `jsonb`, and you should not parse it outside SQLite.

| Operator / function | Returns | Example (`doc = '{"a":{"b":[1,2,{"c":"x"}]}}'`) |
| --- | --- | --- |
| `doc -> '$.a.b[2]'` | JSON text of the sub-element | `'{"c":"x"}'` |
| `doc -> '$.a.b[2].c'` | JSON text, so strings keep quotes | `'"x"'` |
| `doc ->> '$.a.b[2].c'` | SQL value (TEXT, INTEGER, REAL or NULL) | `'x'` |
| `doc ->> '$.a.b[#-1].c'` | indexing from the end with `#-N` | `'x'` |
| `json_extract(doc, '$.a')` | SQL value for scalars, JSON text for containers |  |

`->` and `->>` also accept a bare key or integer on the right (`doc ->> 'n'`, `arr -> 0`), matching PostgreSQL and MySQL.

### 4.2 Table-valued and aggregate JSON

```sql
SELECT key, value, type FROM json_each('[10,20]');          -- one row per element
SELECT fullkey, value FROM json_tree(doc);                    -- recursive walk
SELECT json_group_array(x), json_group_object(k, v) FROM t;   -- aggregate into JSON
SELECT json_array_insert('[1,3]', '$[1]', 2);                 -- 3.53+: '[1,2,3]'
```

Since 3.51.0 there are `jsonb_each()` and `jsonb_tree()`. Since 3.42.0 the input side accepts **JSON5** (comments, trailing commas, unquoted keys); output is always canonical JSON. `json_valid(x, flags)` tests validity without raising; malformed input to `json()` raises "malformed JSON" (proven).

### 4.3 Indexing JSON

There is no GIN index. Index the specific paths you query, with an **expression index** or a generated column:

```sql
CREATE INDEX ev_kind ON ev(doc ->> '$.kind');
SELECT * FROM ev WHERE doc ->> '$.kind' = 'click';   -- plan: SEARCH ev USING INDEX ev_kind
```

The query must use the _same expression_ as the index, written the same way ([Module 07](./07-query-planner-and-vdbe.md)). For arbitrary-key search, use FTS5 over the JSON text, or normalise into a side table.

> **Then vs now.** Before 3.38, JSON needed the `json1` extension and `json_extract()` everywhere. Before 3.45, every access re-parsed the text. Store JSONB (`jsonb(?)` on insert) when documents are read far more often than they are written. Read it back with `json(col)` when the client needs text. libSQL's 3.45.1 base has JSONB, but not `jsonb_each` (3.51) or `json_array_insert` (3.53).

---

## 5. Date and time

SQLite has no date type ([Module 02](./02-type-system-and-schema.md#11-formal-model)). It has seven functions over three representations ([lang_datefunc](https://www.sqlite.org/lang_datefunc.html)): `date()`, `time()`, `datetime()`, `julianday()`, `unixepoch()`, `strftime()` and `timediff()`. Each takes a time value and zero or more modifiers.

| Representation | Example | Best for |
| --- | --- | --- |
| ISO-8601 `TEXT` | `'2026-10-09 12:00:00'` | Readability; sorts correctly as text when the format is uniform. |
| Unix epoch `INTEGER` | `1791547200` | Compact storage; easy arithmetic. |
| Julian day `REAL` | `2461323.0` | Day arithmetic with fractions. |

Rules that cause bugs:

1. **Everything is UTC** unless you apply `'localtime'`. `datetime('now')` is UTC.
2. **Unknown modifiers yield `NULL`, not an error** (proven with `'+1 fortnight'`). A typo, or a modifier newer than your binding, ships silently.
3. **Month arithmetic overflows by default.** `date('2026-01-31', '+1 month')` is `'2026-03-03'`: February 31st normalised forward (the `ceiling` behaviour). Add `'floor'` (3.46+) to get `'2026-02-28'`. Both are proven.
4. Modifiers apply **left to right**: `date('now', 'start of month', '+1 month', '-1 day')` is the classic last-day-of-month idiom.
5. `'subsec'` (3.42+) gives millisecond resolution; `unixepoch('now', 'subsec')` returns a REAL.

### 5.1 New in 3.54.0

| Modifier | Effect | Example (proven on `node:sqlite` 3.54.0) |
| --- | --- | --- |
| `end of month` / `end of year` / `end of day` | Shift forward to the last millisecond of the unit. | `date('2026-02-10', 'end of month')` → `'2026-02-28'`; `datetime('2026-02-10 08:00', 'end of day', 'subsec')` → `'2026-02-10 23:59:59.999'` |
| `weekday -N` (N = 0..6) | Move **backward** to the most recent weekday N (0 = Sunday), or stay if already on it. | `date('2026-01-01', 'end of year', 'weekday -5')` → `'2026-12-25'`, the last Friday of 2026 |

On better-sqlite3 (3.53.4) and libSQL (3.45.1) these return `NULL`. That is the canonical example of why this track asserts versions.

### 5.2 `timediff()` and `printf`

`timediff(A, B)` (3.43+) returns a human-readable `±YYYY-MM-DD HH:MM:SS.SSS` such that `datetime(A) = datetime(B, timediff(A, B))`. It is not an exact day count: February and March both come out as "1 month". Use `julianday(B) - julianday(A)` for exact spans.

`format()` (alias `printf()`) gained two conversions in 3.54.0 that render a value as a JSON string: `%j` escapes it without the surrounding quotes and `%J` produces a complete JSON string literal. The test shows `say "hi"` becoming `say \"hi\"` and `"say \"hi\""`. They are useful for building JSON with string formatting, although `json_quote()` and `json_object()` remain the safer tools.

---

## 6. Window functions

Window functions (3.25.0) follow the standard closely ([windowfunctions](https://www.sqlite.org/windowfunctions.html)): `OVER (PARTITION BY ... ORDER BY ... frame)`, named windows with `WINDOW w AS (...)`, the ranking functions (`row_number`, `rank`, `dense_rank`, `percent_rank`, `cume_dist`, `ntile`), navigation (`lag`, `lead`, `first_value`, `last_value`, `nth_value`), and every aggregate used as a window function. Application-defined aggregates can be window functions too, if they implement the `inverse` step ([Module 08](./08-extensions-fts5-rtree-and-virtual-tables.md#6-application-defined-functions-and-aggregates)).

### 6.1 Frames

The default frame with an `ORDER BY` is `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`, which includes **peers** (rows tied on the sort key). That is why a "running total" over a non-unique key jumps by the whole tie group. The three frame units, on data where day 2 appears twice (proven):

| Frame | Meaning | Sums for days 1, 2, 2, 3, 4 (amounts 10, 20, 5, 30, 15) |
| --- | --- | --- |
| `ROWS BETWEEN 1 PRECEDING AND CURRENT ROW` | physical rows | 10, 30, 25, 35, 45 |
| `RANGE BETWEEN 1 PRECEDING AND CURRENT ROW` | sort-key values within 1 | 10, 35, 35, 55, 45 |
| `GROUPS BETWEEN 1 PRECEDING AND CURRENT ROW` | peer groups | 10, 35, 35, 55, 45 |

`EXCLUDE NO OTHERS | CURRENT ROW | GROUP | TIES` (3.28.0) removes rows from the frame. `FILTER (WHERE ...)` (3.30.0) restricts the rows an aggregate sees, both in plain aggregates and window aggregates.

### 6.2 Cost model

Each window is computed by sorting the input by `PARTITION BY, ORDER BY` and streaming over it. The sort can be avoided if an index delivers that order. Each _distinct_ window specification needs its own pass, so reuse named windows. Aggregates with an `inverse` step (built-in `sum`, `count`, `avg`, `total`, `group_concat`) slide in O(1) per row; frames that need re-aggregation are O(frame size) per row.

---

## 7. ALTER TABLE and the 12-step rebuild

The schema is stored as the original `CREATE` text ([Module 02](./02-type-system-and-schema.md#7-the-schema-is-a-table)), and rows store only values, not column names. So `ALTER TABLE` can do exactly what is possible by editing that text and, at most, rewriting the table:

| Form | Since | Rewrites the table? | Restrictions |
| --- | --- | --- | --- |
| `RENAME TO new` | always | no | Since 3.26 references in triggers and views are rewritten. `legacy_alter_table=ON` restores the old behaviour. |
| `RENAME COLUMN a TO b` | 3.25.0 | no | Rewrites indexes, triggers and views that mention the column (proven). |
| `ADD COLUMN` | always | no | No `PRIMARY KEY` or `UNIQUE`; no `STORED` generated column (proven in Module 02); a `NOT NULL` column needs a non-NULL default; added `CHECK` constraints are tested against existing rows (3.37+). |
| `DROP COLUMN` | 3.35.0 | **yes** | Fails if the column is a primary key, `UNIQUE`, indexed, in a partial-index `WHERE`, in another column's `CHECK`, in a foreign key, in a generated column, or in a trigger or view. The error names the dependent object, for example "error in index t_a after drop column" (proven). |
| `ALTER COLUMN c SET NOT NULL` / `DROP NOT NULL` | **3.53.0** | no (validates rows) | `SET` fails if existing rows hold NULL (proven); if the column is already NOT NULL, the new constraint replaces the old one, which may have a different conflict clause. |

Everything else (changing a type, adding a `UNIQUE` or foreign key, making a table STRICT, changing the primary key) requires the **generalised 12-step procedure** from [lang_altertable § 7](https://www.sqlite.org/lang_altertable.html#otheralter):

```text
REBUILD-TABLE(X, new_definition)
  1  if foreign keys are enabled: PRAGMA foreign_keys = OFF     ▹ must happen OUTSIDE the transaction
  2  BEGIN
  3  saved ← SELECT type, sql FROM sqlite_schema WHERE tbl_name = 'X' (indexes, triggers, views)
  4  CREATE TABLE new_X (new_definition)
  5  INSERT INTO new_X SELECT ... FROM X                       ▹ transform values here
  6  DROP TABLE X
  7  ALTER TABLE new_X RENAME TO X
  8  re-create every object in saved
  9  re-create any views that referenced X
 10  if foreign keys were enabled: PRAGMA foreign_key_check     ▹ must return no rows
 11  COMMIT
 12  if foreign keys were enabled: PRAGMA foreign_keys = ON
```

The test runs this procedure to turn `parent.code` from an untyped column into a `STRICT` `INTEGER`. The children survive, and afterwards `ON DELETE CASCADE` points at the new table.

Why each guard matters:

- **Step 1 is mandatory.** With foreign keys on, `DROP TABLE parent` performs an implicit `DELETE FROM parent` first, and `ON DELETE CASCADE` deletes every child row. The negative test proves it: the children are gone. Because `PRAGMA foreign_keys` is a no-op inside a transaction, step 1 has to come before `BEGIN`.
- **Create-new-then-rename, never rename-old-then-create.** Renaming the old table first makes SQLite rewrite references in other tables' foreign keys, triggers and views to point at the _old_ name, which you are about to drop.
- **Step 10** catches values that the new definition made invalid.

---

## 8. SQLite-specific query semantics

### 8.1 Bare columns in aggregates

A query with exactly one `min()` or `max()` aggregate may select non-aggregated, non-grouped ("bare") columns, and SQLite returns them **from the row that produced the extreme value** ([lang_select § bare columns](https://www.sqlite.org/lang_select.html#bareagg)). `SELECT name, max(score) FROM s` returns the winner's name (proven). PostgreSQL rejects the query. With any other aggregate, or with two `min`/`max` calls, the bare column comes from an arbitrary row. Do not rely on the extension in portable SQL.

### 8.2 NULL handling

- `NULL = NULL` is `NULL`. `IS` and `IS NOT` are null-safe equality in SQLite; `IS [NOT] DISTINCT FROM` (3.39) is the standard spelling.
- `DISTINCT`, `GROUP BY`, `UNION` and `UNIQUE` treat `NULL`s as equal for de-duplication purposes, except that `UNIQUE` constraints allow many `NULL`s ([Module 02](./02-type-system-and-schema.md#4-constraints-and-conflict-resolution)).
- `NULL` sorts first in ascending order. `NULLS FIRST` / `NULLS LAST` are supported since 3.30.

### 8.3 Pattern matching

| Operator | Case | Wildcards | Note |
| --- | --- | --- | --- |
| `LIKE` | insensitive for **ASCII only** (`'Ärger' LIKE 'ärger'` is false, proven) | `%`, `_`, optional `ESCAPE` | `PRAGMA case_sensitive_like = ON` changes it (deprecated). |
| `GLOB` | sensitive | `*`, `?`, `[...]` | Unix shell syntax. |
| `REGEXP` | n/a |  | Syntax exists, but no implementation ships: you must register a `regexp()` function. Turso ships one. |

Index use by `LIKE` and `GLOB` has strict preconditions, covered in [Module 07](./07-query-planner-and-vdbe.md#6-the-like-and-glob-optimisation).

### 8.4 Joins

All join types are supported since 3.39.0, including `RIGHT JOIN` and `FULL OUTER JOIN` (proven). The planner may reorder inner joins freely. A `CROSS JOIN` written explicitly is never reordered, which is SQLite's documented way of forcing a join order ([Module 07](./07-query-planner-and-vdbe.md)).

### 8.5 Triggers and views

Triggers fire `BEFORE`, `AFTER` or `INSTEAD OF` (views only), `FOR EACH ROW` only; there are no statement-level triggers. `RAISE(ABORT | FAIL | ROLLBACK | IGNORE, msg)` aborts from a trigger; since 3.47 the message can be any expression. Triggers are not recursive unless `PRAGMA recursive_triggers = ON`. TEMP triggers may reference main-schema tables since 3.53.0.

Views are read-only stored queries; writing through them needs `INSTEAD OF` triggers. There are no materialised views: use a table refreshed by triggers or by a job.

### 8.6 Strings, Unicode and NULL propagation

| Function | Semantics | Proven result |
| --- | --- | --- |
| `length(x)` | **characters** for TEXT, bytes for BLOB | `length('žluťoučký')` = 9 |
| `octet_length(x)` (3.43+) | bytes of the encoded text | `octet_length('žluťoučký')` = 13 in UTF-8 |
| `substr(x, start, n)` | 1-based, in characters; negative `start` counts from the end | `substr('abcdef', -2)` = `'ef'` |
| `a \|\| b` | concatenation; **NULL if either side is NULL** | `'a' \|\| NULL` is NULL |
| `concat(...)`, `concat_ws(sep, ...)` (3.44+) | concatenation that **skips NULLs** | `concat('a', NULL, 'b')` = `'ab'` |
| `upper()`, `lower()` | ASCII only without ICU | `upper('é')` = `'é'` |
| `unicode(x)`, `char(n, ...)` | code point of the first character / string from code points | `char(382)` = `'ž'` |
| `unistr('\u017E')` (3.50+) | decode `\uXXXX` escapes | `'ž'` |

The NULL-propagation of `||` is a classic bug in display-name expressions such as `first || ' ' || last` when `last` is NULL. Use `concat_ws(' ', first, last)`, or `coalesce()` on each operand.

### 8.7 Math, statistics and aggregates

The math functions (`sqrt`, `pow`, `ln`, `log10`, `floor`, `ceil`, `pi`, trigonometry) exist only when the library is compiled with `SQLITE_ENABLE_MATH_FUNCTIONS`. The upstream amalgamation build enables them by default, and so do better-sqlite3 and `node:sqlite`. `median()`, `percentile()`, `percentile_cont()` and `percentile_disc()` were CLI-only from 3.47, and from 3.51 are part of the amalgamation behind `SQLITE_ENABLE_PERCENTILE`, which both Node bindings enable. `total()` is SQLite's NULL-safe sum: it returns `0.0` instead of NULL for an empty set, and it never overflows (it uses floating point). `group_concat(x, sep)` and its standard alias `string_agg()` (3.44) concatenate with an optional `ORDER BY` inside the call (3.44).

---

## 9. Then vs now: a version table for the dialect

| Feature | Version | Date | What older bindings do |
| --- | --- | --- | --- |
| UPSERT | 3.24.0 | 2018-06 | Syntax error. |
| Window functions | 3.25.0 | 2018-09 | Syntax error. |
| `RENAME COLUMN` | 3.25.0 | 2018-09 | Rebuild needed. |
| Generated columns | 3.31.0 | 2020-01 | Syntax error. |
| `UPDATE ... FROM` | 3.33.0 | 2020-08 | Correlated subqueries. |
| `RETURNING`, `DROP COLUMN`, multiple `ON CONFLICT`, `MATERIALIZED` | 3.35.0 | 2021-03 | Syntax error. |
| `STRICT` | 3.37.0 | 2021-11 | **Cannot open the database file at all.** |
| JSON built in, `->` / `->>` | 3.38.0 | 2022-02 | Needs `json1`; operators fail. |
| `RIGHT` / `FULL` join, `IS DISTINCT FROM` | 3.39.0 | 2022-06 | Syntax error. |
| JSON5 input, `subsec` | 3.42.0 | 2023-05 | Rejects or returns NULL. |
| JSONB | 3.45.0 | 2024-01 | No such function. |
| `json_pretty`, `floor`/`ceiling` modifiers | 3.46.0 | 2024-05 | No such function / NULL. |
| Two-argument `iif()`, `if()` | 3.48.0 | 2025-01 | Wrong number of arguments. |
| `unistr()` | 3.50.0 | 2025-05 | No such function. |
| `jsonb_each`, `jsonb_tree` | 3.51.0 | 2025-11 | No such function. |
| `SET`/`DROP NOT NULL`, `json_array_insert`, `REINDEX EXPRESSIONS` | 3.53.0 | 2026-04 | Rebuild needed / no such function. |
| `end of`, `weekday -N`, `%j` / `%J` | 3.54.0 | 2026-10 | **NULL** (modifiers) or empty output, silently. |

Reading the libSQL row of the README against this table explains most "works locally, fails on Turso" reports: its 3.45.1 base predates everything from 3.46 onward ([Module 12](./12-libsql-and-turso.md)).

---

## 10. Production failure modes

1. **Silent `NULL` from a date modifier** that your binding does not know, or that you misspelled. Proven. Guard with a `CHECK (col IS NOT NULL)` on derived dates, or validate in code.
2. **Month-end arithmetic overflow.** Billing dates computed with `'+1 month'` on the 31st roll into the next-but-one month. Proven. Use `'floor'`, or anchor at `'start of month'`.
3. **`DROP TABLE` during a migration deletes children**, because foreign keys were on. Proven. Follow the 12-step order exactly.
4. **`INSERT OR REPLACE` used as an upsert** resets columns and fires cascades. Proven.
5. **A huge `DELETE ... RETURNING` read with `.get()`.** All rows are deleted on the first step even if you read one result.
6. **Running totals that jump on ties**, because the default frame is `RANGE` with peers. Proven. Use `ROWS` or a unique tiebreaker.
7. **JSON queries that never use the index**, because the query's path expression differs textually from the index expression.
8. **Relying on bare-column semantics** in portable SQL; it works only with a single `min`/`max`.

---

## 11. Interview Drill

<details><summary>1. How does SQLite evaluate a recursive CTE, and why does <code>UNION</code> terminate on a cyclic graph while <code>UNION ALL</code> may not?</summary>

It keeps a queue initialised with the non-recursive part's rows. It repeatedly removes one row, adds it to the result, and runs the recursive part with the CTE bound to that single row, appending the output to the queue. With `UNION`, a row already in the result is discarded, so a cycle stops producing new rows and the queue drains. With `UNION ALL` the same rows re-enter forever unless a `LIMIT` or a depth predicate stops it.
</details>

<details><summary>2. UPSERT versus <code>INSERT OR REPLACE</code>: three observable differences.</summary>

UPSERT updates the existing row in place: unmentioned columns keep their values, the rowid stays the same, and no delete happens. `OR REPLACE` deletes the conflicting row and inserts a new one, so unmentioned columns revert to defaults, the rowid may change, and FK `ON DELETE` actions (and delete triggers, if recursive triggers are on) fire.
</details>

<details><summary>3. Why might <code>DELETE ... RETURNING id</code> followed by reading one row delete a million rows?</summary>

SQLite performs every modification during the first `sqlite3_step()` and buffers the `RETURNING` rows; subsequent steps only return buffered rows. Reading one row does not limit the work. Put a `LIMIT` in the statement (where enabled) or delete by key ranges.
</details>

<details><summary>4. You need to change a column from TEXT to INTEGER in a table referenced by foreign keys. Outline the safe procedure and the trap.</summary>

The 12-step rebuild: turn foreign keys off _before_ `BEGIN` (the pragma is a no-op inside a transaction), save the dependent index/trigger/view SQL, create `new_X`, copy with conversion, drop `X`, rename `new_X` to `X`, re-create dependants, run `PRAGMA foreign_key_check`, commit, and re-enable foreign keys. The trap: with foreign keys on, `DROP TABLE X` performs an implicit delete that cascades to children. Renaming the old table first is also wrong, because it rewrites references to point at the table you drop.
</details>

<details><summary>5. JSON text versus JSONB: when would you store JSONB, and what do you lose?</summary>

Store JSONB when documents are read and queried far more often than written: it avoids re-parsing on every `->>` and is usually a little smaller. You lose human readability in the raw column and portability: it is an SQLite-internal format, so other tools must go through `json()`. Every `json_*` function accepts both forms. It needs SQLite 3.45 or newer on every reader.
</details>

<details><summary>6. A running total over <code>ORDER BY day</code> shows the same value for two rows. Explain.</summary>

With `ORDER BY` and no frame, the default frame is `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`, which includes all peers of the current row (rows with the same `day`). Both tied rows see the sum including each other. Use `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` or add a unique tiebreaker to the `ORDER BY`.
</details>

<details><summary>7. A report shows NULL for "last day of the month" on one server but works on another. What do you check?</summary>

The SQLite version of each binding. The `'end of month'` modifier exists only from 3.54.0, and unknown modifiers make date functions return NULL instead of raising. Either upgrade the binding or use the portable idiom `date(x, 'start of month', '+1 month', '-1 day')`.
</details>

<details><summary>8. What does <code>SELECT name, max(score) FROM s</code> return in SQLite, and is it safe to rely on?</summary>

It returns the `name` from the row with the maximum score: a documented SQLite extension that applies when the query has exactly one `min()` or `max()` aggregate. It is safe within SQLite under that condition, but it is not portable (PostgreSQL rejects it), and with other aggregates the bare column's row is arbitrary.
</details>

<details><summary>9. Why is <code>first || ' ' || last</code> NULL for some users, and what are two fixes?</summary>

`||` propagates NULL: if `last` (or `first`) is NULL, the whole expression is NULL. Fix with `concat_ws(' ', first, last)` (3.44+), which skips NULL arguments, or wrap each operand in `coalesce(x, '')`.
</details>

<details><summary>10. Why prefer <code>INSERT ... RETURNING id</code> over calling <code>last_insert_rowid()</code> afterwards?</summary>

`last_insert_rowid()` is per connection and reports the most recent successful insert on that connection, including inserts done by triggers or by other code sharing the connection between your two calls. `RETURNING` reports the rows that this very statement inserted, atomically, and works for multi-row inserts. It needs 3.35.0 or newer.
</details>
