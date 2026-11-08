# Module 08: Extensions, FTS5, R*Tree and Virtual Tables

SQLite's core is small, but it is built to be extended _in-process_. A **virtual table** looks like a table to SQL while its rows come from code. Application-defined **functions and aggregates** run your own code inside queries. **Loadable extensions** add both at run time from shared libraries. The full-text engine FTS5 and the R*Tree spatial index are themselves virtual tables that ship with the amalgamation. This module covers how those mechanisms work and where their sharp edges are, and it makes FTS5 production-ready: query syntax, BM25 ranking, tokenizers, external content, and index maintenance.

> **Owned elsewhere.** Inverted indexes, TF-IDF and the BM25 formula: [data-systems Module 03 § 2](../../../architecture/data-systems/modules/03-indexing-theory-and-vector-search.md#2-inverted-indexes-and-text-retrieval-tf-idf-and-bm25). R-trees: [§ 3](../../../architecture/data-systems/modules/03-indexing-theory-and-vector-search.md#3-multidimensional-and-spatial-indexing-r-trees-and-bkd-trees). Vector ANN: [§ 4](../../../architecture/data-systems/modules/03-indexing-theory-and-vector-search.md#4-vector-search-and-approximate-nearest-neighbors-ann). For full-text search in PostgreSQL, see [technologies/postgres Module 05](../../postgres/modules/05-json-jsonb-and-full-text-search.md).

Proofs: [`examples/ts/08-extensions.test.ts`](../examples/ts/08-extensions.test.ts) (31 tests) and the helper [`examples/ts/fts5-internals.ts`](../examples/ts/fts5-internals.ts), a reference BM25 and a segment-structure decoder that read only SQL-visible shadow tables.

---

## 1. Extension mechanisms and where they are available

| Mechanism | What it is | better-sqlite3 13 | `node:sqlite` (Node 26) | Python `sqlite3` |
| --- | --- | --- | --- | --- |
| Built-in virtual tables | FTS5, R*Tree, Geopoly, `dbstat`, `json_each`/`json_tree`, `pragma_*` functions | FTS3/4/5, R*Tree, Geopoly, dbstat | FTS3/5, R*Tree, Geopoly, dbstat, session | build-dependent |
| Scalar functions | `f(args) → value` in your language | `db.function()` | `db.function()` | `con.create_function()` |
| Aggregate / window functions | `step`, `result`, optional `inverse` | `db.aggregate()` | `db.aggregate()` | `con.create_aggregate()`, `create_window_function()` |
| Table-valued functions | a virtual table that takes parameters | `db.table()` | not exposed | not exposed |
| Collations | custom text ordering | not exposed | not exposed | `con.create_collation()` |
| Loadable extensions | `.so`/`.dylib`/`.dll` with `sqlite3_extension_init` | `db.loadExtension()` | `loadExtension()` only with `allowExtension: true` at open (proven) | `enable_load_extension(True)` |

The compile options of each build decide what is "built in", as [Module 01](./01-what-sqlite-is-bindings-and-cli.md#4-compile-time-defaults-the-hidden-configuration) showed. Check `PRAGMA compile_options` for `ENABLE_FTS5`, `ENABLE_RTREE`, `ENABLE_GEOPOLY`, `ENABLE_DBSTAT_VTAB`, `ENABLE_SESSION` and `ENABLE_MATH_FUNCTIONS` before relying on any of them.

---

## 2. FTS5 full-text search

### 2.1 Architecture

`CREATE VIRTUAL TABLE doc USING fts5(title, body)` creates the virtual table plus **shadow tables** that hold the index ([fts5.html](https://www.sqlite.org/fts5.html)):

| Shadow table | Content |
| --- | --- |
| `doc_data` | The inverted index: segment B-trees of term → (rowid, column, offset) postings, stored as blobs |
| `doc_idx` | The index of segments, for seeking to a term |
| `doc_content` | A copy of the indexed text (absent for external-content and contentless tables) |
| `doc_docsize` | Token counts per column per row, needed by BM25 |
| `doc_config` | Persistent configuration |

Writes do not update one global index in place. Each transaction writes a new small **segment**, and segments are merged in the background of later writes. This is a log-structured design within an SQLite database, like an LSM tree ([data-systems Module 02 § 3](../../../architecture/data-systems/modules/02-storage-engines-b-trees-and-lsm.md#3-append-only-storage-engines-log-structured-merge-trees-lsm)). The merge policy is tunable:

```sql
INSERT INTO doc(doc, rank) VALUES ('automerge', 8);    -- merge when 8 segments share a level (default 4)
INSERT INTO doc(doc, rank) VALUES ('crisismerge', 16); -- force a merge at this many segments
INSERT INTO doc(doc) VALUES ('optimize');              -- merge everything into one segment (slow; after bulk loads)
INSERT INTO doc(doc) VALUES ('integrity-check');       -- verify the index against the content
```

Query cost grows with the number of segments, and `optimize` after a bulk load is the FTS5 equivalent of `VACUUM`.

**Segment structure record.** The list of segments lives in one row of `doc_data`, `id = 10`. Its layout (from `fts5_index.c`, confirmed by decoding it in the tests) is a 4-byte big-endian _cookie_, then SQLite varints: `nLevel`, `nSegment`, `nWriteCounter`, and for each level `nMerge`, `nSeg` followed by `nSeg` triples `(segid, pgnoFirst, pgnoLast)`. The test decodes it and shows:

| Event | Segments in `doc_data` id 10 |
| --- | --- |
| 1 autocommit `INSERT` | 1 at level 0 |
| 3 autocommit `INSERT`s | 3 at level 0: **one segment per committed write** |
| 300 autocommit `INSERT`s | a few dozen at most: incremental automerge keeps the count bounded, but not at 1 |
| the same 200 rows in **one transaction** | exactly 1 |
| `INSERT INTO t(t) VALUES ('optimize')` | exactly 1 |

Two consequences. First, wrap bulk loads in a transaction: the cost of a row is the per-segment overhead (a page written, a new `doc_idx` entry, a larger structure record to rewrite on every flush), which a single transaction pays once. Second, automerge is _incremental_: it spends merge work in proportion to the data just written, so a steady trickle of one-row writes never reaches the single-segment state on its own. Run `optimize` (or `'merge', N`) from a maintenance job, off the write path, because it rewrites the whole index while holding the write lock ([Module 05 § 2](./05-transactions-locking-and-rollback-journal.md#2-the-five-lock-states)).

### 2.2 Query syntax

| Query | Meaning | Proven |
| --- | --- | --- |
| `wal` | rows containing the token | `[1, 4]` |
| `"write ahead logging"` | phrase (adjacent tokens in order) | `[1]` (the hyphen is a separator) |
| `check*` | prefix | `[4]` |
| `title:journal` / `{title body}:x` | column filter | `[2]` |
| `a AND b`, `a OR b`, `a NOT b` | boolean; implicit AND between terms; `NOT` is **binary** | `readers NOT wal` → `[2]` |
| `NEAR(a b, N)` | all tokens within N tokens of each other | `[4]` |
| `^first` | token must be the first in the column | – |

Raw user input must not be passed straight to `MATCH`. An input such as `wal AND` is a **syntax error** (proven), and a user-typed `title:` or `NEAR(` changes the query's meaning. The safe pattern is to quote the input as one phrase, doubling embedded double quotes:

```ts
const safe = '"' + userInput.replaceAll('"', '""') + '"';
db.prepare('SELECT rowid FROM doc WHERE doc MATCH ?').all(safe);
```

To support "all of these words", split the input on whitespace, quote each word, and join them with spaces.

### 2.3 Ranking with BM25

FTS5's built-in `bm25()` implements Okapi BM25 with *k*₁ = 1.2 and _b_ = 0.75 (formula in data-systems). Two SQLite-specific conventions catch people out:

- **Smaller is better.** `bm25()` returns the score multiplied by −1, so `ORDER BY bm25(doc)` ascending gives the best match first, and scores are negative (proven).
- **Column weights** are extra arguments, in column order: `bm25(doc, 10.0, 1.0)` makes a title hit worth ten body hits. The test shows that the ranking changes.

The hidden column `rank` defaults to `bm25(doc)`. `ORDER BY rank` gives the same order (proven), and it lets FTS5 optimise top-N queries. The default can be changed persistently:

```sql
INSERT INTO doc(doc, rank) VALUES ('rank', 'bm25(10.0, 1.0)');
```

#### 2.3.1 The formula, exactly as implemented

For a query of phrases *q*₁ … *q*ₘ, a table of _N_ rows, and a row _d_ of length |_d_| tokens (all columns together), `fts5_aux.c` computes

```text
idf(q)    = ln( (N − n(q) + 0.5) / (n(q) + 0.5) )        n(q) = rows containing q at least once
idf(q)    ← 1e-6   whenever idf(q) ≤ 0                    (the floor)
f(q, d)   = Σ over occurrences of q in d of  weight(column of the occurrence)
avgdl     = (total tokens in the table) / N
score(d)  = − Σ_q  idf(q) · f(q,d)·(k₁ + 1) / ( f(q,d) + k₁·(1 − b + b·|d| / avgdl) )      k₁ = 1.2, b = 0.75
```

Three details differ from textbook BM25 and are worth knowing. (1) The **floor**: a term that occurs in more than about half of the rows has a negative textbook IDF, so SQLite substitutes `1e-6`. The test's word `common` appears in every row and every score it produces lies in (−1e-5, 0): such a term _cannot_ influence the ranking, which is the right behaviour for stop words but a surprise in a ten-row test table. (2) Column weights multiply the **term frequency**, not the final score, and they do not change |_d_|. (3) |_d_| and _avgdl_ are token counts across **all** columns, taken from `doc_docsize`: a varint per column per row, so `01 03` is one title token and three body tokens.

```text
BM25-RANK(table, query)                       ▹ one pass over the rows that match
  1  N ← |rows|;  avgdl ← Σ docsize / N                       ▹ O(1): maintained in doc_data
  2  for each phrase q: n(q) ← count rows containing q       ▹ one extra index scan per phrase
  3  for each matching row d (in rowid order, from the posting-list intersection):
  4      for each phrase q: f ← Σ weights of q's occurrences in d
  5      score ← −Σ idf(q)·f·(k₁+1) / (f + k₁(1 − b + b|d|/avgdl))
  6  sort by score ascending                                   ▹ best (most negative) first
```

The invariant that makes it testable: with _f_ ≥ 1 the fraction lies in (0, k₁+1), so every score is **strictly negative**, and monotone: more occurrences raise the magnitude, and extra length lowers it. [`referenceBm25()`](../examples/ts/fts5-internals.ts) re-derives the scores from the `fts5vocab` tables and `doc_docsize` and agrees with `bm25()` to 1e-12, with and without column weights. If you need a different ranking (for example demoting old rows), compute it in SQL on top of `bm25()` and keep the sign in mind: `ORDER BY bm25(doc) / (1 + age_days)` shrinks an old row's negative score toward zero and so sorts it later in ascending order, while the same expression with `DESC` would invert the whole ranking.

`highlight(doc, col, open, close)` wraps matches in a column, and `snippet(doc, col, open, close, ellipsis, max_tokens)` extracts the best-matching fragment. Both are proven.

### 2.4 Tokenizers

| Tokenizer | Behaviour | Use |
| --- | --- | --- |
| `unicode61` (default) | Splits on Unicode separators, folds case per Unicode 6.1. `remove_diacritics 2` folds accents. | General text. Czech queries without accents match accented text (proven: `prilis zlutoucky KUN`). |
| `ascii` | ASCII-only folding | Identifiers, codes |
| `porter` | A wrapper that applies the Porter stemmer to another tokenizer's output | English: `writer` matches `writers` (proven) |
| `trigram` (3.34+) | Indexes every 3-character sequence; `case_sensitive 0/1`, `remove_diacritics 0/1` (mutually exclusive with `case_sensitive 1`; available from 3.45 per an SQLite forum post, the release notes do not mention it) | Substring search: `LIKE '%lite%'` and `GLOB` are served from the index (proven) |

The trigram tokenizer is the answer to the classic "how do I make `LIKE '%term%'` fast" question. It costs index size (roughly 3× the text), and a pattern needs at least three non-wildcard characters to use it. A one- or two-character `MATCH` query returns no rows at all rather than an error (proven), which is a silent failure in search boxes that fire on the first keystrokes. With `remove_diacritics 1` the substring `zlutou` finds `žluťoučký`, and a substring may cross a word boundary (`lis z` finds `příliš žluťoučký`), because the trigram tokenizer ignores word structure. Stemming is language-specific: Porter is English-only, and there is no built-in Czech stemmer, so Czech search usually relies on diacritics folding plus prefix queries (`kůň*`).

### 2.5 Content options

| Option | Text stored in FTS? | Can return column values? | Maintenance |
| --- | --- | --- | --- |
| default | yes (`_content`) | yes | automatic |
| `content='note', content_rowid='id'` (external content) | no: read from your table | yes, via the content table | **your triggers** |
| `content=''` (contentless) | no | no (NULL) | inserts only; deletes need the original values |
| `content='', contentless_delete=1` (3.43+) | no | no | `DELETE` by rowid works |
| `detail=column` | – | – | smaller index; phrase and `NEAR` queries fail with an error, column filters still work (proven) |
| `detail=none` | – | – | smallest index; additionally column filters (`title:x`) fail (proven) |

External content is the common production choice: the text lives once, in an ordinary table with real types and constraints, and FTS5 holds only the index. The test builds the documented trigger triple: `AFTER INSERT`, `AFTER DELETE` (with the special `'delete'` command, which needs the **old** values), and `AFTER UPDATE` (delete then insert). It verifies that no `_content` shadow table exists.

```sql
CREATE TABLE note(id INTEGER PRIMARY KEY, body TEXT NOT NULL);
CREATE VIRTUAL TABLE note_fts USING fts5(body, content = 'note', content_rowid = 'id');
CREATE TRIGGER note_ai AFTER INSERT ON note BEGIN
  INSERT INTO note_fts(rowid, body) VALUES (new.id, new.body); END;
CREATE TRIGGER note_ad AFTER DELETE ON note BEGIN
  INSERT INTO note_fts(note_fts, rowid, body) VALUES ('delete', old.id, old.body); END;
CREATE TRIGGER note_au AFTER UPDATE ON note BEGIN
  INSERT INTO note_fts(note_fts, rowid, body) VALUES ('delete', old.id, old.body);
  INSERT INTO note_fts(rowid, body) VALUES (new.id, new.body); END;
```

**Why `old.*`.** The `'delete'` command does not look the row up: it _recomputes the tokens from the values you pass_ and removes exactly those postings. FTS5 cannot read them back from the content table, which by now already holds the new text. Passing `new.*` removes postings that were never there and leaves the old ones behind. The test builds that bug: after the update, `alpha` still matches rowid 1 although the row says `gamma delta`. The plain `'integrity-check'` command passes, because it only checks the index against itself; `INSERT INTO note_fts(note_fts, rank) VALUES ('integrity-check', 1)` additionally compares the index with the **content table** and fails with `SQLITE_CORRUPT_VTAB` ("checksum mismatch"). Run the `rank = 1` form in CI after migrations and from a periodic job, and `'rebuild'` to repair.

The negative test shows the failure mode. Without a delete trigger, the index keeps returning a **ghost rowid** for a deleted row, and an `INSERT INTO note_fts(note_fts) VALUES ('rebuild')` repairs it by re-reading the content table. Ghost rows are worse than they sound: joining the ghost rowid back to the content table can return an _unrelated newer row_ that reused the rowid.

### 2.5.1 Prefix indexes

`check*` is answered by merging the posting lists of every term that starts with `check`, which can be thousands of terms for a two-letter prefix. `prefix='2 3'` (a space-separated list of lengths) additionally stores a posting list _per two- and three-character prefix_, so `lo*` and `lor*` read one list. The price is index size: in the test the 500-row table with `prefix='2 3'` has a `_data` table more than 1.5 times larger than the plain one, for identical answers. Add prefix lengths only for the lengths your autocomplete actually sends; longer prefixes match fewer terms and are cheap without help.

### 2.6 Introspection with fts5vocab

```sql
CREATE VIRTUAL TABLE v USING fts5vocab(doc, 'row');   -- also 'col' and 'instance'
SELECT term, doc, cnt FROM v ORDER BY cnt DESC LIMIT 20;
```

The `row` form returns, per term, the number of documents and the total occurrences (proven: `journal` occurs 5 times in 1 document). Use it for autocomplete, stop-word analysis, and debugging tokenizer behaviour.

### 2.7 When to graduate to a search engine

FTS5 handles millions of documents on one machine with millisecond queries. The ceiling is functional rather than scale: per-language analysers, synonyms, typo tolerance (fuzzy matching), faceting, and distributed indexing. FTS5 has none of these built in, although `spellfix1` and custom tokenizers can add some. The same graduation argument for PostgreSQL appears in [technologies/postgres Module 05](../../postgres/modules/05-json-jsonb-and-full-text-search.md).

---

## 3. R*Tree and Geopoly

An [R*Tree virtual table](https://www.sqlite.org/rtree.html) indexes N-dimensional bounding boxes (1 to 5 dimensions):

```sql
CREATE VIRTUAL TABLE place USING rtree(id, min_x, max_x, min_y, max_y);
SELECT id FROM place
WHERE max_x >= :x0 AND min_x <= :x1 AND max_y >= :y0 AND min_y <= :y1;   -- overlap with a window
```

- The query plan shows `SCAN place VIRTUAL TABLE INDEX …` with constraint codes, so the R*Tree is used (proven).
- Coordinates are stored as **32-bit floats** by default, rounded outward so that boxes never shrink. `0.1` reads back as a slightly different value (proven). Use `rtree_i32` for integer coordinates.
- Auxiliary columns (prefixed with `+`) can store payload in the R*Tree row itself, which saves a join.
- R*Tree answers *bounding-box* queries. Exact geometry tests (point-in-polygon) are a second step, done in SQL or with **Geopoly**, a GeoJSON-style polygon extension built on R*Tree (`geopoly_contains_point`, `geopoly_overlap`). Geopoly is enabled in both Node bindings.

```sql
CREATE VIRTUAL TABLE zone USING geopoly(name);
INSERT INTO zone(_shape, name) VALUES ('[[0,0],[10,0],[10,10],[0,10],[0,0]]', 'square');
SELECT geopoly_contains_point(_shape, 5, 5) FROM zone;   -- 2 strictly inside, 1 on the boundary, 0 outside
SELECT name FROM zone WHERE geopoly_overlap(_shape, :window_polygon);
```

The test uses a square and a right triangle sharing two edges. `geopoly_area` returns 100 and 50; the point (5, 5) is strictly inside the square (2) but lies on the triangle's hypotenuse (1); the point (8, 8) is inside the square and outside the triangle (0). `geopoly_overlap` and `geopoly_within` are indexed through the same R*Tree, so they are cheap filters; the R*Tree prunes by bounding box and Geopoly then performs the exact test. Polygons are stored in a compact binary form with 32-bit float coordinates, so the float-rounding caveat above applies to Geopoly as well.

---

## 4. Other built-in virtual tables and table-valued functions

| Name | Purpose | Module |
| --- | --- | --- |
| `dbstat` | per-page space accounting | [04](./04-file-format-and-b-trees.md#9-measuring-space-dbstat-and-diskused) |
| `json_each`, `json_tree`, `jsonb_each`, `jsonb_tree` | iterate JSON | [03](./03-sql-dialect-and-features.md#42-table-valued-and-aggregate-json) |
| `pragma_table_info('t')` and other pragma functions | schema introspection as SQL | [02](./02-type-system-and-schema.md#7-the-schema-is-a-table) |
| `carray` | bind a C array as a table; built into the amalgamation since 3.51 but disabled by default | – |
| `sqlite_dbpage` | read and write raw pages (`SQLITE_ENABLE_DBPAGE_VTAB`) | recovery tooling |
| `generate_series` | integer sequences; **CLI only** in most builds | [01](./01-what-sqlite-is-bindings-and-cli.md#4-compile-time-defaults-the-hidden-configuration) |

### 4.1 How the planner talks to a virtual table

A virtual table implements `xBestIndex`. The planner calls it with the usable constraints (`column op ?`) and the desired `ORDER BY`. The implementation answers which constraints it will handle, an _index number and string_ that identify its strategy, and an estimated cost. At run time `xFilter` receives that choice and the constraint values. That is why R*Tree and FTS5 plans read `VIRTUAL TABLE INDEX 2:…`: the number and string are the module's own encoding of the strategy. A virtual table that reports a poor cost estimate gets bad join orders, exactly like a table with stale statistics.

The contract, as pseudocode for a module author (C API names; the Node bindings hide the first two calls):

```text
PLAN(table, constraints C, order O)                        ▹ xBestIndex, called many times during planning
  1  for each usable constraint c in C: decide whether the module can evaluate it
  2  mark chosen constraints with an argvIndex (position of the value in xFilter's argv) and omit=1 if the core need not re-check
  3  output (idxNum, idxStr, estimatedCost, estimatedRows, orderByConsumed)

SCAN(idxNum, idxStr, argv)                                 ▹ xFilter, once per loop entry: the outer row's values arrive in argv
  1  position the cursor at the first row satisfying the chosen constraints
ITERATE                                                    ▹ xEof / xColumn / xRowid / xNext until the cursor reports EOF
```

The plan text `VIRTUAL TABLE INDEX <idxNum>:<idxStr>` is therefore the module's own private language, and each module documents it in its source. The tests decode two of them:

| Module | `idxNum` | `idxStr` | Reading |
| --- | --- | --- | --- |
| FTS5 | bit mask: `MATCH` 0x1, `rank MATCH` 0x2, `rowid =` 0x4, `<=` 0x8, `>=` 0x10, `ORDER BY rank` 0x20, `ORDER BY rowid` 0x40, `DESC` 0x80 | one item per `argv`: `M<col>` MATCH on a column, `=` / `<` / `>` rowid constraints, `r` rank argument | `32:M2` is `MATCH` with the output already in `rank` order, so no sorter is needed; `64:M2` is rowid order |
| R*Tree | 1 = rowid lookup, 2 = tree walk or full scan | two bytes per constraint: operator (`A` `=`, `B` `<=`, `C` `<`, `D` `>=`, `E` `>`, `F` `MATCH`) and coordinate column | `2:E0C1` is `min > ? AND max < ?` on the first and second coordinate columns |

Seeing `ORDER BY rank` absorbed into the strategy (`32:…`) rather than a `USE TEMP B-TREE FOR ORDER BY` line is the practical check that FTS5 will stream the top-N results instead of sorting every match.

**Table-valued functions are nested loops too.** For `FROM t, series(1, t.n)` the outer row's `t.n` becomes an argument and `xFilter` runs again for every outer row: the test counts three generator starts for a three-row outer table. Rows are produced **lazily**: with `LIMIT 3` over `series(1, 1000000)` the generator is stepped exactly three times, because `ResultRow` suspends the VDBE ([Module 07 § 2.1](./07-query-planner-and-vdbe.md#21-model)). Called without its arguments, a table-valued function silently returns zero rows rather than raising an error (proven), so a typo in a parameter-passing join produces an empty result, not a failure.

---

## 5. Then vs now

| Topic | Then | Now |
| --- | --- | --- |
| Full-text search | FTS3/FTS4 (2007–2015): `matchinfo()`, no built-in BM25, offsets-based ranking | **FTS5** (3.9.0, 2015): `bm25()`, `highlight()`, `snippet()`, better tokenizer API. FTS3/4 remain for old schemas. |
| Substring search | `LIKE '%x%'` full scans | trigram tokenizer (3.34.0, 2020); `remove_diacritics` for trigram from 3.45 (per an SQLite forum post, not in the release notes) |
| Contentless deletes | impossible without the original text | `contentless_delete=1` (3.43.0) |
| JSON | `json1` extension | built in (3.38.0) |
| `carray`, percentile | separate extension sources | in the amalgamation since 3.51 (opt-in) |
| Space analysis | `sqlite3_analyzer` | `diskused()` extension and `.diskused` (3.54.0) |

---

## 6. Application-defined functions and aggregates

### 6.1 Scalar functions

```ts
db.function('slug', { deterministic: true }, (s: unknown) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-'),
);
db.exec('CREATE INDEX post_slug ON post(slug(title))');
```

- **Deterministic** functions (same inputs, same output) may be used in expression indexes, partial-index predicates, `CHECK` constraints and generated columns, and the planner may evaluate them once per statement for constant arguments. A non-deterministic function in an index is rejected (proven: "non-deterministic functions prohibited in index expressions").
- **The schema now depends on your code.** A database with an index on `slug()` cannot be modified by a connection that has not registered `slug()`: the CLI, a migration tool, or another service will fail with "no such function" on writes to that table. Document such functions and register them in every connection factory.
- Calling into JavaScript costs a boundary crossing per row. A function evaluated over a million-row scan adds noticeable time; push simple logic into SQL expressions where possible.

### 6.2 Security flags and `trusted_schema`

A function used in the schema runs whenever _anyone_ writes to the table. A malicious database file could contain triggers or views that call powerful functions. SQLite therefore distinguishes:

- `SQLITE_DIRECTONLY`: the function may be called only from top-level SQL, never from triggers, views or schema expressions (`node:sqlite`'s `directOnly` option).
- `SQLITE_INNOCUOUS`: the function is safe to call from the schema even when `PRAGMA trusted_schema = OFF`.

Set `trusted_schema = OFF` when opening database files from untrusted sources. Then only innocuous functions can run from inside the schema.

### 6.3 Aggregates and window functions

An aggregate has `start` (initial state), `step` (fold one row), optional `result` (finalise), and optional `inverse` (remove one row). With `inverse`, the aggregate also works as a **sliding window function** in O(1) per row. The test registers `sumsq` and gets `[1, 5, 13, 25]` for a two-row sliding frame. Without `inverse`, SQLite can still use it as a window function only by re-running it over each whole frame (where the binding supports that).

### 6.4 Table-valued functions in JavaScript

better-sqlite3's `db.table()` defines an eponymous virtual table backed by a generator, so library builds can get a `generate_series`:

```ts
db.table('series', {
  columns: ['value'],
  parameters: ['start', 'stop'],
  *rows(start: unknown, stop: unknown) {
    for (let i = Number(start); i <= Number(stop); i++) yield { value: i };
  },
});
db.prepare('SELECT sum(value) FROM series(1, 100)').pluck().get(); // 5050
```

---

## 7. Loadable extensions and sqlite-vec

A loadable extension is a shared library exporting `sqlite3_extension_init`. Loading native code into the database process is a privilege, so it is **off by default** at every layer:

- The C API requires `sqlite3_enable_load_extension()` or `SQLITE_DBCONFIG_ENABLE_LOAD_EXTENSION`; the SQL function `load_extension()` stays disabled unless explicitly enabled.
- `node:sqlite` requires `allowExtension: true` **at construction**; otherwise `loadExtension()` throws (proven).
- Turso Database loads only its own extension format, not SQLite `.so` files ([Module 12](./12-libsql-and-turso.md)).

Commonly used extensions include ICU (Unicode case folding and collations, which also disables the LIKE optimisation), `spellfix1` (fuzzy matching), `uuid`, `regexp`, and **sqlite-vec**. sqlite-vec adds vector columns and KNN search through a `vec0` virtual table, using brute-force or quantised search. ANN theory is covered in [data-systems Module 03 § 4](../../../architecture/data-systems/modules/03-indexing-theory-and-vector-search.md#4-vector-search-and-approximate-nearest-neighbors-ann), and libSQL's built-in DiskANN vector index is proven in [Module 12](./12-libsql-and-turso.md). This track does not pin or test sqlite-vec. If you adopt it, pin the extension version alongside the SQLite version, because extensions are compiled against a specific API level.

---

## 7.1 Choosing a mechanism

| Need | Use | Why | Cost |
| --- | --- | --- | --- |
| A pure transformation used in `SELECT` or `WHERE` | scalar function | One boundary crossing per row; no schema footprint if not indexed | Per-row JS call |
| The same, but indexed or in a `CHECK` | **deterministic** scalar function | The only form allowed in index expressions | Schema now depends on your code in every writer |
| A custom fold (median, weighted mean) | aggregate (with `inverse` for windows) | The engine drives the grouping | `inverse` must be exact or window results drift |
| A generated or computed row source (series, parsed file, API-backed list) | table-valued function (`db.table()`) | Arguments from the outer row; lazy; re-run per outer row (proven) | No `xBestIndex` control from JS: the planner sees a fixed cost |
| An index over data that does not fit a B-tree (text, boxes, vectors) | built-in virtual table (FTS5, R*Tree, Geopoly) or a loadable extension | The module owns storage and the strategy | Shadow tables, a private plan language, version coupling |
| Custom text ordering | collation (Python) or a loadable extension | Index order depends on it | Changing the collation silently invalidates every index that used it: `REINDEX` is mandatory |

The last row is the quiet one. An index stores keys in the order the collation defined when the index was built. Registering a collation under the same name with different behaviour later leaves the B-tree in the old order and the planner trusting it, so lookups miss rows without any error ([Module 10 § 3](./10-durability-backup-and-operations.md#21-detecting-and-repairing-corruption) shows how `integrity_check` surfaces this class of problem).

---

## 8. Production failure modes

1. **User input passed to `MATCH`** causes syntax errors and query injection. Proven. Quote as phrases.
2. **External-content FTS without delete/update triggers** returns ghost rows. Proven, with `rebuild` as the repair.
3. **Many small FTS5 transactions** create one segment each (proven by decoding the structure record) and slow queries. Batch inserts in one transaction (one segment) and run `optimize` after bulk loads, from a maintenance job.
4. **Expecting `ORDER BY bm25(...) DESC`** to give the best match first. It gives the worst. Proven sign.
5. **A schema that depends on application functions** breaks every other tool that writes to the database.
6. **Opening untrusted database files with `trusted_schema = ON`** lets their triggers and views call your registered functions.
7. **R\*Tree coordinates assumed exact.** They are 32-bit floats. Proven.
8. **Extensions loaded in development but not in production**, or compiled against a different SQLite version.
9. **Stop-word-only queries rank arbitrarily.** A term in at least half the rows gets the `1e-6` IDF floor, so a query consisting only of such terms returns every row with near-identical scores and an order decided by length alone. Proven. Filter out or down-weight such terms in the application.
10. **One- and two-character queries on a trigram index return nothing**, silently. Proven. Fall back to a prefix query on a second, `unicode61` table or to `LIKE 'ab%'` on an indexed column for the first keystrokes.
11. **`detail=none` chosen for size, then a column filter is needed** (`title:x`). The query errors at run time, not at table creation. Proven.
12. **`prefix=` lists copied from a tutorial** inflate the index for lengths nobody queries. Proven to cost over 50 % more space in the test corpus.

---

## Interview Drill

<details><summary>1. How does FTS5 store its index, and why does it need periodic merging?</summary>

As segment B-trees of term → postings (rowid, column, position) stored in shadow tables (`_data`, `_idx`), plus `_content` and `_docsize`. Each write transaction adds a new segment rather than updating one index in place, which is an LSM-like design. Queries must consult every segment, so automerge combines segments as they accumulate, and `optimize` merges everything after bulk loads.
</details>

<details><summary>2. Why is <code>bm25()</code> negative, and how do you rank title matches higher?</summary>

FTS5 returns BM25 multiplied by −1 so that the natural ascending `ORDER BY bm25(t)` (or `ORDER BY rank`) puts the best matches first. Column weights are extra arguments in column order: `bm25(t, 10.0, 1.0)` weights the first column ten times more. The default rank function can be changed with the `'rank'` configuration command.
</details>

<details><summary>3. How do you make <code>LIKE '%term%'</code> fast in SQLite?</summary>

A B-tree index cannot help with a leading wildcard. Create an FTS5 table with the trigram tokenizer over the column. FTS5 then answers `LIKE` and `GLOB` substring patterns with at least three literal characters from the trigram index. The cost is index size, roughly three times the text.
</details>

<details><summary>4. What is an external-content FTS5 table, and what goes wrong if you implement it naively?</summary>

An FTS5 index whose text lives in an ordinary table (`content='note'`), so the text is stored once. FTS5 does not observe that table, so you must keep the index in sync with triggers; deletes and updates must pass the _old_ values with the `'delete'` command. Without them the index returns ghost rowids, which may now belong to unrelated rows. `'rebuild'` re-indexes from the content table.
</details>

<details><summary>5. What must be true for an application-defined function to be used in an index, and what is the operational risk?</summary>

It must be registered as deterministic. The risk is that the schema now depends on code: any connection that has not registered the function (the CLI, migration tools, other services) gets "no such function" when writing to the table. In addition, functions callable from the schema should be marked innocuous or direct-only, and untrusted files should be opened with `trusted_schema = OFF`.
</details>

<details><summary>6. How does a virtual table cooperate with the query planner?</summary>

Through `xBestIndex`: the planner offers the usable constraints and the requested order, and the module replies which constraints it consumes, an index number and string identifying its strategy, and an estimated cost and row count. The planner compares that with alternatives, and at execution time `xFilter` receives the chosen strategy and constraint values. Bad cost estimates lead to bad join orders.
</details>

<details><summary>7. What does an R*Tree index answer, and what does it not?</summary>

It answers containment and overlap queries over N-dimensional bounding boxes, in logarithmic time, for example "which boxes intersect this window". It does not test exact geometry, so a second filter (Geopoly or application code) is needed for polygons. Coordinates are stored as 32-bit floats, rounded outward, unless `rtree_i32` is used.
</details>
