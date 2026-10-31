# EDB PostgreSQL 18 Associate & Professional Certification Question Bank

This preparation bank contains 65 rigorous, original practice questions covering the complete syllabus of the EDB Certified Associate (EDB-CA) and EDB Certified Professional (EDB-CP) examinations, as well as staff-level PostgreSQL DBA / database reliability engineering interview loops.

---

## Domain 1: Architecture, Process Engine & Shared Memory

### Q-EDB-001 · Architecture · difficulty 1 · single
What process model does PostgreSQL utilize to handle concurrent client connections?
- A) A single-threaded event loop with non-blocking asynchronous socket multiplexing
- B) A dedicated multi-threaded pool where worker threads share a common heap address space
- C) A process-per-connection model where the Postmaster forks an independent OS backend process for each authenticated client
- D) An actor model executing lightweight virtual threads on a managed runtime
<details><summary>Answer</summary>

**C.** PostgreSQL employs a multi-process architecture. When a client initiates a connection, the supervisor daemon (`postmaster`) authenticates the client, forks a dedicated operating system backend process, and transfers the socket descriptor.
- Why not A: Single-threaded event loops are characteristic of systems like Node.js or Redis, not PostgreSQL.
- Why not B: Multi-threaded architectures are used by MySQL/InnoDB and SQL Server. PostgreSQL backends do not share private process heaps.
- Why not D: PostgreSQL does not use virtual thread runtimes.
- Ref: [modules/01-architecture-process-memory-and-storage.md](../modules/01-architecture-process-memory-and-storage.md#2-process-architecture--the-multi-process-model), https://www.postgresql.org/docs/18/overview.html
</details>

### Q-EDB-002 · Architecture · difficulty 2 · scenario
A database administrator provisions a dedicated PostgreSQL 18 server with 128GB of physical RAM on an NVMe SSD storage array. A junior engineer recommends setting `shared_buffers = 115GB` (90% of RAM) to "maximize cache hits". What operational consequence will occur under heavy concurrent workload?
- A) Memory utilization will be optimized because PostgreSQL bypasses the operating system page cache entirely using Direct I/O
- B) System performance degrades due to double-buffering cache waste, and the server risks kernel Out-Of-Memory (OOM) killer terminating backend processes
- C) Checkpoint duration will decrease to zero because all modified pages are permanently pinned in SRAM
- D) The server will fail to start because PostgreSQL enforces an absolute maximum `shared_buffers` ceiling of 32GB
<details><summary>Answer</summary>

**B.** PostgreSQL relies on standard buffered operating system I/O, resulting in double buffering between `shared_buffers` and the Linux kernel page cache. Allocating 90% of RAM to `shared_buffers` leaves almost no physical memory for backend private allocations (`work_mem`, connection stacks, maintenance memory) and OS filesystem cache, precipitating Linux OOM killer invocation. The standard recommended allocation is 25% to 40% of physical RAM.
- Why not A: Standard PostgreSQL uses buffered read/write calls and does not bypass the kernel page cache.
- Why not C: Dirty pages must still be flushed by checkpointer; a massive buffer pool increases checkpoint flush volume.
- Why not D: There is no arbitrary 32GB engine ceiling, though sizing beyond 32–64GB yields diminishing returns.
- Ref: [modules/01-architecture-process-memory-and-storage.md](../modules/01-architecture-process-memory-and-storage.md#3-shared-memory--double-buffering-mechanics), https://www.postgresql.org/docs/18/runtime-config-resource.html
</details>

### Q-EDB-003 · Architecture · difficulty 2 · multi
Which of the following background auxiliary processes are managed directly by the Postmaster supervisor? (Select THREE)
- A) Checkpointer
- B) Query Rewriter Daemon
- C) Background Writer (`bgwriter`)
- D) Autovacuum Launcher
- E) PL/pgSQL JIT Compiler Daemon
<details><summary>Answer</summary>

**A, C, D.**
- **A (Checkpointer)**: Asynchronously flushes dirty shared buffer pages and writes checkpoint records to WAL.
- **C (`bgwriter`)**: Continuously flushes dirty pages using clock sweep to ensure backends readily find clean buffers.
- **D (Autovacuum Launcher)**: Supervises autovacuum worker processes to reclaim dead tuples and freeze XIDs.
- Why not B: Query rewriting is a compile-time executor phase executed within individual backend processes, not an independent background daemon.
- Why not E: JIT compilation is performed in-process by the backend via LLVM libraries.
- Ref: [modules/01-architecture-process-memory-and-storage.md](../modules/01-architecture-process-memory-and-storage.md#2-process-architecture--the-multi-process-model), https://www.postgresql.org/docs/18/
</details>

### Q-EDB-004 · Architecture · difficulty 3 · single
In an 8192-byte storage page, what is the role of the Line Pointer (`ItemIdData`) array?
- A) It stores the cryptographic SHA-256 block hash for data integrity validation
- B) It maps index tuples to raw hardware SSD sector addresses
- C) It provides an indirect byte-offset pointer to physical tuple locations, allowing tuples to be defragmented without invalidating secondary indexes
- D) It maintains the Free Space Map (`_fsm`) tree inside the page header
<details><summary>Answer</summary>

**C.** Line pointers (`ItemIdData`, 4 bytes each) decouple logical row addressing from physical byte offsets on disk. External index pointers store an ItemPointer (`ctid = (block, offset)`), where `offset` indexes into the Line Pointer array. When tuples are updated via HOT or defragmented within the page, only the byte offset inside `ItemIdData` is updated; the external index pointers remain untouched.
- Why not A: Page checksums are stored in `pd_checksum` in the 24-byte page header.
- Why not B: Indexes reference logical block and offset numbers, not physical NVMe storage sectors.
- Why not D: The FSM is stored in an entirely separate fork (`_fsm`), not inside the page header.
- Ref: [modules/01-architecture-process-memory-and-storage.md](../modules/01-architecture-process-memory-and-storage.md#5-physical-anatomy-of-an-8kb-storage-page), https://www.postgresql.org/docs/18/storage-page-layout.html
</details>

### Q-EDB-005 · Architecture · difficulty 2 · single
What fundamental architectural change occurred in PostgreSQL 18 regarding cluster initialization and data block corruption detection?
- A) SHA-512 block signatures replaced 16-bit CRC checksums
- B) Cluster data block checksums (`data_checksums`) are now enabled by default during `initdb`
- C) All database relations are encrypted at rest using AES-GCM by default
- D) The default database block size (`BLCKSZ`) was increased from 8KB to 16KB
<details><summary>Answer</summary>

**B.** PostgreSQL 18 enables data checksums by default during `initdb`. Every 8KB block calculates an internal checksum stored in `pd_checksum`. If silent disk bit-rot alters bytes, the engine raises an error (`XX001`) upon reading rather than silently returning corrupted data.
- Why not A: PostgreSQL continues to use CRC-32C algorithms for page checksums.
- Why not C: Transparent Data Encryption (TDE) is not enabled by default in standard PostgreSQL.
- Why not D: Default block size remains 8192 bytes (8KB).
- Ref: [modules/01-architecture-process-memory-and-storage.md](../modules/01-architecture-process-memory-and-storage.md#6-postgresql-18--19-io-evolution), https://www.postgresql.org/docs/18/release-18.html
</details>

---

## Domain 2: Relational Modeling, Types & Constraints

### Q-EDB-006 · Data Types · difficulty 1 · single
Which data type must strictly be selected when storing financial ledger amounts, account balances, and monetary transactions?
- A) `REAL` (`FLOAT4`)
- B) `DOUBLE PRECISION` (`FLOAT8`)
- C) `NUMERIC` (or `DECIMAL`)
- D) `MONEY` (PostgreSQL legacy type)
<details><summary>Answer</summary>

**C.** `NUMERIC` stores exact arbitrary-precision Base-10,000 numbers with up to 131,072 digits before the decimal point, completely eliminating binary rounding errors inherent in IEEE 754 floating-point representations (`float4`/`float8`).
- Why not A & B: Binary floating-point cannot accurately represent decimal fractions (e.g., $0.1 + 0.2 \ne 0.3$), causing rounding drift.
- Why not D: The `money` type is locale-dependent, formatted poorly across international currencies, and historically discouraged.
- Ref: [modules/02-relational-modeling-types-and-constraints.md](../modules/02-relational-modeling-types-and-constraints.md#2-advanced-data-types-representation--storage-mechanics), https://www.postgresql.org/docs/18/datatype-numeric.html
</details>

### Q-EDB-007 · Constraints · difficulty 3 · scenario
A DBA needs to add a foreign key constraint referencing `parent(id)` onto a high-traffic table with 80 million rows. Executing `ALTER TABLE child ADD CONSTRAINT fk_parent FOREIGN KEY (parent_id) REFERENCES parent(id);` would lock the table for minutes. What is the correct zero-downtime procedure?
- A) `ALTER TABLE child ADD CONSTRAINT fk_parent FOREIGN KEY (parent_id) REFERENCES parent(id) NOT VALID;` followed by `ALTER TABLE child VALIDATE CONSTRAINT fk_parent;`
- B) `CREATE INDEX CONCURRENTLY idx_child_parent ON child (parent_id);` which automatically creates the foreign key constraint
- C) `ALTER TABLE child ADD CONSTRAINT fk_parent FOREIGN KEY (parent_id) REFERENCES parent(id) CONCURRENTLY;`
- D) Temporarily disable Row-Level Security, run the standard DDL command, and re-enable RLS
<details><summary>Answer</summary>

**A.** Adding a constraint with `NOT VALID` acquires a brief `ACCESS EXCLUSIVE` lock to update catalog metadata without scanning existing rows. Subsequently running `VALIDATE CONSTRAINT` acquires only a `SHARE UPDATE EXCLUSIVE` lock, scanning existing rows to verify referential integrity while permitting concurrent `SELECT`, `INSERT`, `UPDATE`, and `DELETE` queries.
- Why not B: Creating an index does not establish a foreign key constraint.
- Why not C: `CONCURRENTLY` is valid for `CREATE/DROP INDEX` and `REINDEX`, not `ADD CONSTRAINT`.
- Why not D: Disabling RLS does not prevent the full table exclusive lock taken by unvalidated constraints.
- Ref: [modules/02-relational-modeling-types-and-constraints.md](../modules/02-relational-modeling-types-and-constraints.md#5-constraint-architecture--production-safety), https://www.postgresql.org/docs/18/sql-altertable.html
</details>

### Q-EDB-008 · Types · difficulty 2 · single
Why does UUIDv7 (native in PostgreSQL 18) eliminate the B-tree index bloat and write amplification caused by random UUIDv4 identifiers?
- A) UUIDv7 compresses from 128 bits down to 64 bits using Brotli compression
- B) UUIDv7 encodes a 48-bit millisecond Unix timestamp prefix, guaranteeing monotonic sortability and append-only B-tree leaf page locality
- C) UUIDv7 values are stored out-of-line in the TOAST table rather than on the primary page
- D) UUIDv7 forces PostgreSQL to use BRIN indexes instead of B-tree indexes
<details><summary>Answer</summary>

**B.** UUIDv4 generates uniformly distributed random 128-bit values, causing inserts to scatter randomly across all B-tree leaf pages and triggering frequent page splits. UUIDv7 prefixes a 48-bit timestamp, making new keys monotonically increasing. New inserts consistently append to the rightmost leaf node of the B-tree, preserving cache locality and eliminating page splits.
- Why not A: UUIDv7 is 128 bits, identical in size to UUIDv4.
- Why not C: UUIDs are 16 bytes and never moved to TOAST tables.
- Why not D: UUIDv7 can be indexed using standard B-tree indexes.
- Ref: [modules/02-relational-modeling-types-and-constraints.md](../modules/02-relational-modeling-types-and-constraints.md#2-advanced-data-types-representation--storage-mechanics), https://www.postgresql.org/docs/18/functions-uuid.html
</details>

### Q-EDB-009 · TOAST · difficulty 2 · multi
Which of the following statements accurately describe PostgreSQL's TOAST storage mechanism? (Select TWO)
- A) Rows smaller than 512 bytes are moved to the TOAST table to optimize sequential scans
- B) The `EXTERNAL` storage strategy allows out-of-line storage in the TOAST table but disables compression
- C) TOAST chunks are stored in a dedicated auxiliary table named `pg_toast_<relfilenode>`
- D) Columns with the `PLAIN` strategy are compressed using LZ4 inline on the main heap page
- E) Setting `default_toast_compression = 'lz4'` requires restarting the database cluster
<details><summary>Answer</summary>

**B, C.**
- **B**: `EXTERNAL` moves values exceeding the threshold out-of-line without attempting compression, ideal for pre-compressed media.
- **C**: TOAST auxiliary tables reside in the `pg_toast` schema, designated by the primary relation's OID.
- Why not A: TOAST is triggered only when tuples exceed approximately 2KB (`TOAST_TUPLE_THRESHOLD = 2040 bytes`).
- Why not D: `PLAIN` completely disables compression and out-of-line storage.
- Why not E: `default_toast_compression` can be reloaded without server restart or set per session.
- Ref: [modules/02-relational-modeling-types-and-constraints.md](../modules/02-relational-modeling-types-and-constraints.md#3-toast-physical-storage--compression-strategies), https://www.postgresql.org/docs/18/storage-toast.html
</details>

### Q-EDB-010 · Constraints · difficulty 3 · single
What capability was introduced in PostgreSQL 18 for temporal primary and unique constraints?
- A) Automatic TTL expiration of rows using `EXPIRES AFTER`
- B) The SQL:2011 standard `WITHOUT OVERLAPS` clause on composite primary/unique keys with range types
- C) Mandatory system-versioned temporal tables using Git commit hashes
- D) Partitioning tables automatically by nanosecond intervals
<details><summary>Answer</summary>

**B.** PostgreSQL 18 implements the SQL:2011 temporal constraint standard via `WITHOUT OVERLAPS`. When creating a primary or unique key on a composite key containing an identifier and a range (`tsrange`), `WITHOUT OVERLAPS` ensures no two records share an overlapping time range for that identifier.
- Why not A: PostgreSQL does not use `EXPIRES AFTER` table syntax.
- Why not C: System-versioned temporal tables are an SQL standard, but PostgreSQL 18 implements the `WITHOUT OVERLAPS` constraint.
- Why not D: Range partitioning does not use nanosecond automated intervals.
- Ref: [modules/02-relational-modeling-types-and-constraints.md](../modules/02-relational-modeling-types-and-constraints.md#6-exclusion--temporal-constraints-without-overlaps), https://www.postgresql.org/docs/18/release-18.html
</details>

---

## Domain 3: SQL Querying, Joins, 3VL & Mutations

### Q-EDB-011 · Querying · difficulty 2 · single
Why does the query `SELECT * FROM users WHERE status NOT IN (SELECT status FROM blacklisted_statuses);` return zero rows if `blacklisted_statuses` contains even a single `NULL` value?
- A) The PostgreSQL optimizer aborts queries that compare against non-indexed subqueries
- B) In SQL Three-Valued Logic, `val <> NULL` evaluates to `UNKNOWN`; chaining inequalities with `AND` causes the entire condition to evaluate to `UNKNOWN` or `FALSE`
- C) The `NOT IN` clause automatically invokes a `TRUNCATE` trigger on the outer table
- D) PostgreSQL treats `NULL` as a wildcard matching every string value
<details><summary>Answer</summary>

**B.** `NOT IN` expands to `status <> s1 AND status <> s2 AND status <> NULL`. Because any comparison against `NULL` yields `UNKNOWN`, and `TRUE AND UNKNOWN` yields `UNKNOWN`, the `WHERE` clause evaluates to `UNKNOWN` for every row. The engine only returns rows where the condition evaluates strictly to `TRUE`. The safe alternative is `WHERE NOT EXISTS (...)`.
- Why not A: The optimizer evaluates the query; it does not abort.
- Why not C: Queries do not invoke DDL truncate triggers.
- Why not D: `NULL` represents missing or unknown data, not a regex wildcard.
- Ref: [modules/03-sql-querying-filtering-and-joins.md](../modules/03-sql-querying-filtering-and-joins.md#2-three-valued-logic-3vl--the-null-pitfall), https://www.postgresql.org/docs/18/functions-subquery.html
</details>

### Q-EDB-012 · Joins · difficulty 2 · single
Which join algorithm is selected by the cost-based optimizer when joining a small, filtered outer relation against a large inner relation with a B-tree index on the join key?
- A) Hash Join
- B) Merge Join
- C) Nested Loop Join with Index Scan
- D) Bitmap Full Scan Join
<details><summary>Answer</summary>

**C.** When the outer relation is small (or filtered to few rows) and the inner relation possesses an index on the join condition, a Nested Loop Join seeks the index for each outer row in $O(N \log M)$ time, avoiding the startup cost and memory overhead of building an in-memory hash table or sorting relations.
- Why not A: Hash joins require scanning the inner relation to build a hash table in `work_mem`, which is wasteful for small outer sets.
- Why not B: Merge join requires both inputs to be sorted.
- Why not D: Bitmap scans are access methods, not relational join algorithms.
- Ref: [modules/03-sql-querying-filtering-and-joins.md](../modules/03-sql-querying-filtering-and-joins.md#3-physical-join-algorithms), https://www.postgresql.org/docs/18/
</details>

### Q-EDB-013 · Pagination · difficulty 2 · scenario
An engineer implements web API pagination using `SELECT * FROM events ORDER BY created_at DESC, id DESC LIMIT 20 OFFSET 5000000;`. Why is this an anti-pattern, and what is the optimal solution?
- A) `OFFSET` causes index page splits; the fix is using `LIMIT` without ordering
- B) The database must scan, sort, and discard 5,000,000 rows on disk; the fix is Keyset Pagination (`WHERE (created_at, id) < ($last_ts, $last_id)`)
- C) `OFFSET` locks the entire table in `EXCLUSIVE` mode; the fix is running `ANALYZE`
- D) PostgreSQL restricts `OFFSET` values to a maximum integer threshold of 32,767
<details><summary>Answer</summary>

**B.** `OFFSET 5000000` requires the database engine to perform $O(N)$ work: reading and evaluating 5,000,020 rows through the index or heap, discarding 5,000,000, and returning 20. Keyset pagination (seek method) filters directly against indexed values, seeking to the target leaf node in $O(\log N)$ time and streaming 20 rows in $O(1)$ time.
- Why not A: `OFFSET` does not cause index splits; reads do not split pages.
- Why not C: `OFFSET` does not take exclusive table locks.
- Why not D: `OFFSET` accepts 64-bit integers (`int8`).
- Ref: [modules/03-sql-querying-filtering-and-joins.md](../modules/03-sql-querying-filtering-and-joins.md#5-keyset-pagination-vs-offset-pagination), https://use-the-index-luke.com/sql/partial-results/fetch-next-page
</details>

### Q-EDB-014 · Mutations · difficulty 3 · single
In PostgreSQL 18, what capability does the `RETURNING OLD / NEW` clause provide during an `UPDATE` statement?
- A) It rolls back the transaction if the `OLD` and `NEW` values match
- B) It allows simultaneous inspection of both pre-mutation (`OLD`) and post-mutation (`NEW`) column values in the returned result set
- C) It replicates old and new tuples directly into an external Kafka broker
- D) It creates an automatic historical audit table in the `archive` schema
<details><summary>Answer</summary>

**B.** PostgreSQL 18 introduces `RETURNING old.col, new.col` for `UPDATE` statements, allowing client applications to capture exact before-and-after values in a single atomic SQL command without writing triggers or executing pre-update `SELECT` queries.
- Why not A: Matching values do not trigger rollback; standard updates complete normally.
- Why not C: Kafka replication requires logical decoding or CDC plugins like Debezium.
- Why not D: It does not create tables; it emits rows to the client result stream.
- Ref: [modules/03-sql-querying-filtering-and-joins.md](../modules/03-sql-querying-filtering-and-joins.md#7-postgresql-18-returning-oldnew-mechanics), https://www.postgresql.org/docs/18/release-18.html
</details>

### Q-EDB-015 · Querying · difficulty 2 · single
When using a `LATERAL` join in PostgreSQL, what syntactic capability is unlocked compared to a standard `JOIN`?
- A) The joined subquery can reference attributes from tables appearing before it in the `FROM` list
- B) The joined table is stored exclusively in GPU video memory
- C) It guarantees that all joins are executed using parallel SIMD instructions
- D) It automatically converts inner joins into full outer anti-joins
<details><summary>Answer</summary>

**A.** `LATERAL` joins act like correlated subqueries in the `FROM` clause: the right-hand relation or function subquery can reference columns emitted by preceding relations in the `FROM` list, evaluated dynamically for each row.
- Why not B & C: PostgreSQL executes on standard CPU architecture; GPU memory is not used.
- Why not D: `LATERAL` does not convert joins to outer anti-joins.
- Ref: [modules/03-sql-querying-filtering-and-joins.md](../modules/03-sql-querying-filtering-and-joins.md#4-lateral-joins--correlated-subqueries), https://www.postgresql.org/docs/18/queries-table-expressions.html#QUERIES-LATERAL
</details>

---

## Domain 4: Advanced SQL, CTEs, Window Functions & Analytics

### Q-EDB-016 · Advanced SQL · difficulty 2 · single
How does PostgreSQL 12+ optimize Common Table Expressions (CTEs) declared using `WITH ... AS (...)`, and how can a developer override this behavior?
- A) CTEs are always materialized to disk; override with `AS VIRTUAL`
- B) Non-recursive, side-effect-free CTEs are inlined by default into the outer query; override with `AS MATERIALIZED`
- C) CTEs are compiled into temporary tables with indexes; override with `AS TEMP`
- D) CTEs are cached across separate database connections; override with `AS LOCAL`
<details><summary>Answer</summary>

**B.** In PostgreSQL 12+, the optimizer automatically inlines CTEs into the parent query, allowing joint join reordering and predicate pushdown. Specifying `AS MATERIALIZED` acts as an optimization fence, forcing PostgreSQL to evaluate the CTE independently once and materialize its result.
- Why not A: Pre-PG12 materialized by default; modern PostgreSQL inlines by default.
- Why not C: CTEs are not created as temporary tables in `temp_buffers`.
- Why not D: CTEs cannot cross session boundaries.
- Ref: [modules/04-advanced-sql-ctes-and-window-functions.md](../modules/04-advanced-sql-ctes-and-window-functions.md#2-common-table-expressions-inlining-vs-as-materialized), https://www.postgresql.org/docs/18/queries-with.html
</details>

### Q-EDB-017 · Advanced SQL · difficulty 3 · single
What is the purpose of the SQL:2016 `CYCLE` clause when executing recursive CTEs in PostgreSQL?
- A) It schedules the recursive query to execute periodically using `cron`
- B) It prevents infinite recursion in cyclic graphs by tracking visited identifiers and setting a boolean termination flag
- C) It converts recursive graph traversals into breadth-first search on GPU tensors
- D) It limits recursion depth strictly to 10 iterations
<details><summary>Answer</summary>

**B.** The declarative `CYCLE col SET is_cycle USING path` clause tracks visited node keys in an internal array. If a newly computed row contains an identifier already present in `path`, the query engine sets `is_cycle = true` and halts recursion on that branch, preventing infinite loops.
- Why not A: In-database scheduling is managed by extensions like `pg_cron`.
- Why not C: Recursive execution uses CPU heap memory.
- Why not D: Depth is not statically limited to 10; it terminates dynamically upon cycle detection.
- Ref: [modules/04-advanced-sql-ctes-and-window-functions.md](../modules/04-advanced-sql-ctes-and-window-functions.md#4-recursive-ctes--sql2016-cycle-detection), https://www.postgresql.org/docs/18/queries-with.html#QUERIES-WITH-CYCLE
</details>

### Q-EDB-018 · Window Functions · difficulty 2 · scenario
Consider the following window query:
`SELECT id, amount, SUM(amount) OVER (ORDER BY created_at) AS total FROM transactions;`
Multiple transactions share the exact same `created_at` timestamp. What subtle result occurs?
- A) PostgreSQL raises an error: `duplicate sort key in window frame`
- B) The default frame `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` treats identical timestamps as peers, yielding the identical cumulative sum across all peer rows
- C) The window function skips duplicate timestamp rows completely
- D) The transaction aborts with a serialization failure
<details><summary>Answer</summary>

**B.** When `ORDER BY` is present in an `OVER ()` clause without explicit frame bounds, SQL defaults to `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`. Under `RANGE`, rows with identical sort key values are treated as peers; the frame encompasses the entire peer group, producing an identical cumulative total across all matching rows rather than a step-by-step running balance. Specifying `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` enforces row-by-row accumulation.
- Why not A: Duplicate timestamps are valid in window ordering.
- Why not C: Window functions never skip partition rows.
- Why not D: Window evaluation does not trigger serialization aborts.
- Ref: [modules/04-advanced-sql-ctes-and-window-functions.md](../modules/04-advanced-sql-ctes-and-window-functions.md#5-window-frames-in-depth-rows-range--groups), https://www.postgresql.org/docs/18/tutorial-window.html
</details>

### Q-EDB-019 · Aggregation · difficulty 2 · single
What is the functional difference between `GROUP BY ROLLUP (year, quarter, month)` and `GROUP BY CUBE (year, quarter, month)`?
- A) `ROLLUP` produces hierarchical subtotals ($N+1$ combinations), while `CUBE` generates all possible combinatorial groupings ($2^N$ combinations)
- B) `ROLLUP` generates all permutations, while `CUBE` only calculates the grand total
- C) `ROLLUP` requires an OLAP columnar index; `CUBE` operates on row storage
- D) `ROLLUP` is evaluated in parallel; `CUBE` is evaluated sequentially
<details><summary>Answer</summary>

**A.** For 3 attributes, `ROLLUP` generates 4 hierarchical groupings: `(year, quarter, month)`, `(year, quarter)`, `(year)`, and `()`. `CUBE` generates all $2^3 = 8$ mathematical subsets: `(y, q, m)`, `(y, q)`, `(y, m)`, `(q, m)`, `(y)`, `(q)`, `(m)`, and `()`.
- Why not B: This reverses the definitions of ROLLUP and CUBE.
- Why not C: Both are standard SQL grouping constructs operating on row storage.
- Why not D: Parallel aggregation capabilities apply to both grouping styles.
- Ref: [modules/04-advanced-sql-ctes-and-window-functions.md](../modules/04-advanced-sql-ctes-and-window-functions.md#7-multi-dimensional-aggregation-grouping-sets-rollup--cube), https://www.postgresql.org/docs/18/queries-table-expressions.html#QUERIES-GROUPING-SETS
</details>

### Q-EDB-020 · Advanced SQL · difficulty 1 · single
What is the syntax for filtering rows inside an aggregate function without using a `CASE WHEN` expression?
- A) `COUNT(*) WHERE (status = 'active')`
- B) `COUNT(*) FILTER (WHERE status = 'active')`
- C) `COUNT(*) HAVING (status = 'active')`
- D) `COUNT(*) QUALIFY (status = 'active')`
<details><summary>Answer</summary>

**B.** The SQL standard `FILTER (WHERE predicate)` clause applies directly to aggregate function calls, evaluating the condition and passing only matching tuples to the accumulator.
- Why not A: `WHERE` belongs to the query table expression, not aggregate calls.
- Why not C: `HAVING` filters result groups after aggregation.
- Why not D: `QUALIFY` filters window function results in some analytical databases (Snowflake/BigQuery), not aggregate calls in PostgreSQL.
- Ref: [modules/04-advanced-sql-ctes-and-window-functions.md](../modules/04-advanced-sql-ctes-and-window-functions.md#7-multi-dimensional-aggregation-grouping-sets-rollup--cube), https://www.postgresql.org/docs/18/sql-expressions.html#SYNTAX-AGGREGATES
</details>

---

## Domain 5: Semi-Structured Data, JSONB & Full-Text Search

### Q-EDB-021 · JSONB · difficulty 2 · single
What operator class should be chosen when creating a GIN index on a JSONB column if the application queries exclusively using the containment operator (`@>`) and desires the smallest possible index footprint?
- A) `jsonb_ops`
- B) `jsonb_path_ops`
- C) `btree_jsonb_ops`
- D) `hash_jsonb_ops`
<details><summary>Answer</summary>

**B.** `jsonb_path_ops` hashes entire path-value pairs into 32-bit values, supporting only the containment operator (`@>`). This results in indexes that are 30% to 50% smaller on disk and significantly faster for containment queries compared to default `jsonb_ops`, which indexes every key, value, and sub-path independently.
- Why not A: `jsonb_ops` supports key-existence operators (`?`, `?|`, `?&`), but produces significantly larger indexes.
- Why not C: B-tree indexes cannot index internal sub-document paths for containment queries.
- Why not D: Hash indexes do not index internal JSONB elements.
- Ref: [modules/05-json-jsonb-and-full-text-search.md](../modules/05-json-jsonb-and-full-text-search.md#4-gin-indexing-for-jsonb-jsonb_ops-vs-jsonb_path_ops), https://www.postgresql.org/docs/18/datatype-json.html#JSON-INDEXING
</details>

### Q-EDB-022 · SQL/JSON · difficulty 2 · single
What standard SQL/JSON function transforms a nested JSON document array into a structured relational virtual table with typed SQL columns?
- A) `jsonb_each_text()`
- B) `jsonb_to_recordset()`
- C) `JSON_TABLE()`
- D) `json_populate_record()`
<details><summary>Answer</summary>

**C.** `JSON_TABLE` is the SQL:2016 standard function in modern PostgreSQL that evaluates a JSONPath expression across a JSON document and maps extracted values into relational columns with explicit SQL data types.
- Why not A & B: These are legacy PostgreSQL-specific procedural helpers.
- Why not D: `json_populate_record` requires an existing user-defined composite type.
- Ref: [modules/05-json-jsonb-and-full-text-search.md](../modules/05-json-jsonb-and-full-text-search.md#3-sqljson-standard-functions--jsonpath), https://www.postgresql.org/docs/18/functions-json.html#FUNCTIONS-SQLJSON-TABLE
</details>

### Q-EDB-023 · Search · difficulty 2 · multi
Which components are extracted and stored inside a PostgreSQL `tsvector` data type? (Select TWO)
- A) Normalized distinct lexemes stripped of suffixes and punctuation
- B) The full, uncompressed raw HTML document text
- C) Arrays of integer word position pointers for each lexeme
- D) The original uppercase and lowercase capitalization formatting
- E) Stop words like "the", "and", "is"
<details><summary>Answer</summary>

**A, C.**
- **A**: `tsvector` normalizes words into distinct lexemes using dictionary stemmers (e.g., "jumping" $\rightarrow$ "jump").
- **C**: Integer position pointers record where each lexeme occurred in the document, enabling proximity phrase searching (`<->`).
- Why not B: Raw document text is not stored in `tsvector`.
- Why not D: Words are normalized to lowercase lexemes.
- Why not E: Dictionaries discard stop words during vector generation.
- Ref: [modules/05-json-jsonb-and-full-text-search.md](../modules/05-json-jsonb-and-full-text-search.md#5-full-text-search-tsvector-tsquery--relevance-ranking), https://www.postgresql.org/docs/18/datatype-textsearch.html
</details>

### Q-EDB-024 · Search · difficulty 3 · scenario
A web application executes `SELECT * FROM items WHERE sku ILIKE '%ABC%';`. A standard B-tree index on `sku` is ignored, resulting in a full table scan. How can this query be indexed in PostgreSQL?
- A) Create a BRIN index on `sku`
- B) Enable `pg_trgm` and create a GIN index using `sku gin_trgm_ops`
- C) Set `enable_seqscan = off` to force the B-tree index
- D) Convert the column to naive `json`
<details><summary>Answer</summary>

**B.** A standard B-tree cannot optimize queries with leading wildcards (`%ABC%`) because the prefix is unknown. The `pg_trgm` extension breaks strings into 3-character trigrams. A GIN index using `gin_trgm_ops` indexes individual trigrams, allowing PostgreSQL to satisfy arbitrary substring queries using an index scan.
- Why not A: BRIN indexes ranges of physical blocks; it cannot accelerate substring searches.
- Why not C: Forcing a B-tree on a leading wildcard forces an inefficient index scan that reads every leaf page.
- Why not D: Converting to `json` does not solve string search indexing.
- Ref: [modules/05-json-jsonb-and-full-text-search.md](../modules/05-json-jsonb-and-full-text-search.md#6-fuzzy-substring-matching-with-pg_trgm), https://www.postgresql.org/docs/18/pgtrgm.html
</details>

### Q-EDB-025 · Architecture · difficulty 2 · single
When is an engineering team advised to graduate from PostgreSQL Full-Text Search (`tsvector`) to a dedicated search cluster like Elasticsearch?
- A) As soon as the table exceeds 1,000 rows
- B) When search requires ACID transactions and immediate consistency with relational data
- C) When search index size exceeds RAM, requiring distributed multi-shard inverted indexes and complex BM25 scoring at scale
- D) When searching across integer primary keys
<details><summary>Answer</summary>

**C.** Graduate to Elasticsearch/OpenSearch when search volume or document corpus exceeds PostgreSQL's RAM cache, when distributed sharding across nodes is required, or when advanced natural language processing (complex morphology, phonetic matching) is necessary. Keep search in PostgreSQL when ACID transactional consistency and zero dual-write lag are required.
- Why not A: PostgreSQL FTS comfortably manages millions of documents on standard hardware.
- Why not B: Elasticsearch does not provide relational ACID transactions.
- Why not D: Integer primary keys are indexed with B-trees in PostgreSQL.
- Ref: [modules/05-json-jsonb-and-full-text-search.md](../modules/05-json-jsonb-and-full-text-search.md#7-architectural-seam-postgresql-fts-vs-elasticsearch), https://www.postgresql.org/docs/18/textsearch.html
</details>

---

## Domain 6: Indexing Strategies, Access Methods & Storage

### Q-EDB-026 · Indexing · difficulty 3 · single
How does PostgreSQL's Lehman-Yao B-link tree implementation maintain high concurrency during page splits?
- A) It acquires an exclusive lock on the entire table during splits
- B) Every node contains a "high key" and a "right-link" pointer to its sibling, allowing readers to traverse concurrent splits without locking parent nodes
- C) It converts overflowing nodes into unlogged hash tables
- D) It defers page splits to a background worker process executing once per hour
<details><summary>Answer</summary>

**B.** In the Lehman-Yao B-link tree algorithm, each page stores a high key (maximum value on the page) and a right-link pointer to its right sibling. When a page splits, a reader looking for a key higher than the high key simply follows the right-link to the new sibling page without needing to acquire locks on parent nodes.
- Why not A: Locking the whole table would destroy concurrency.
- Why not C: Nodes remain B-tree pages; they are not converted to hash tables.
- Why not D: Page splits must occur synchronously during insertion.
- Ref: [modules/06-indexing-in-depth.md](../modules/06-indexing-in-depth.md#2-b-tree-internals-the-lehman-yao-concurrency-architecture), Lehman & Yao (1981)
</details>

### Q-EDB-027 · Indexing · difficulty 2 · scenario
A table has a composite B-tree index on `(status, created_at)`, where `status` has only three distinct values ('pending', 'running', 'done'). In PostgreSQL 18, what execution optimization allows the query `SELECT * FROM tasks WHERE created_at > NOW();` to utilize this index despite omitting `status`?
- A) B-Tree Skip Scan
- B) Bitmap Index Join
- C) Parallel Sequential Heap Fetch
- D) Automatic GiST Conversion
<details><summary>Answer</summary>

**A.** PostgreSQL 18 introduces B-Tree Skip Scans. When a composite index has a low-cardinality leading column that is omitted in the query predicate, the engine hops across each distinct value of the prefix, executing binary search probes on the trailing column (`created_at`) within each prefix.
- Why not B: Bitmap joins do not perform skip scanning.
- Why not C: Sequential heap fetch is an unindexed table scan.
- Why not D: B-tree indexes are not converted into GiST indexes.
- Ref: [modules/06-indexing-in-depth.md](../modules/06-indexing-in-depth.md#3-postgresql-18-b-tree-skip-scans), https://www.postgresql.org/docs/18/release-18.html
</details>

### Q-EDB-028 · Indexing · difficulty 2 · single
Under what conditions can a query execute an **Index-Only Scan** without performing any heap page fetches?
- A) Only when the table is smaller than 10MB
- B) When all requested columns exist in the index AND the corresponding 8KB heap pages are marked as "all-visible" in the Visibility Map (`_vm`)
- C) Whenever a B-tree index has a `UNIQUE` constraint
- D) Only when running inside a `SERIALIZABLE` transaction
<details><summary>Answer</summary>

**B.** An Index-Only Scan satisfies all column data from the index. However, because indexes do not store MVCC transaction visibility metadata (`xmin`/`xmax`), the engine checks the Visibility Map (`_vm`). If the heap page has its all-visible bit set (guaranteeing all tuples are committed and visible to all transactions), the heap fetch is skipped. If not, the engine must fetch the heap page to verify visibility.
- Why not A: Index-Only Scans operate on tables of any size.
- Why not C: Uniqueness does not guarantee that tuples are visible to the active snapshot.
- Why not D: Index-Only Scans operate in all isolation levels.
- Ref: [modules/06-indexing-in-depth.md](../modules/06-indexing-in-depth.md#5-strategic-index-features-partial-expression--covering-include), https://www.postgresql.org/docs/18/indexes-index-only-scans.html
</details>

### Q-EDB-029 · Indexing · difficulty 3 · scenario
A `CREATE INDEX CONCURRENTLY` command on a production table is cancelled by a client statement timeout. What state is the index left in, and what operational impact does it have?
- A) The index is automatically rolled back and deleted from the database catalog
- B) The index remains in the catalog marked `INVALID` (`indisvalid = false`); it is never used for queries, but it continues to be updated on every write, consuming disk I/O and space
- C) The table is converted to read-only mode until a superuser runs `REPAIR INDEX`
- D) The table becomes corrupted and must be restored from base backup
<details><summary>Answer</summary>

**B.** When `CREATE INDEX CONCURRENTLY` fails or is cancelled, PostgreSQL does not automatically drop the partially built index. It remains in `pg_index` marked with `indisvalid = false`. The planner ignores it for queries, but the storage engine must continue maintaining it during all `INSERT`, `UPDATE`, and `DELETE` operations, causing write amplification until an administrator manually drops it (`DROP INDEX CONCURRENTLY`).
- Why not A: `CREATE INDEX CONCURRENTLY` operates outside a standard transaction block and does not automatically clean up failed attempts.
- Why not C & D: The table is not locked read-only or corrupted.
- Ref: [modules/06-indexing-in-depth.md](../modules/06-indexing-in-depth.md#6-operational-index-management-concurrency-failures--amcheck), https://www.postgresql.org/docs/18/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY
</details>

### Q-EDB-030 · Indexing · difficulty 2 · single
What built-in extension allows database administrators to verify the physical and logical structural integrity of B-tree indexes?
- A) `pg_stat_statements`
- B) `amcheck`
- C) `pageinspect`
- D) `pg_buffercache`
<details><summary>Answer</summary>

**B.** `amcheck` provides functions like `bt_index_check()` and `bt_index_parent_check()` to detect structural index corruption, invariant violations, and broken Lehman-Yao link pointers without locking tables against writes.
- Why not A: `pg_stat_statements` profiles query execution metrics.
- Why not C: `pageinspect` dumps raw byte contents of storage pages.
- Why not D: `pg_buffercache` inspects memory pages in `shared_buffers`.
- Ref: [modules/06-indexing-in-depth.md](../modules/06-indexing-in-depth.md#6-operational-index-management-concurrency-failures--amcheck), https://www.postgresql.org/docs/18/amcheck.html
</details>

---

## Domain 7: Query Planning, Cost Model & Tuning

### Q-EDB-031 · Cost Model · difficulty 2 · single
Why should administrators on modern NVMe SSD storage adjust `random_page_cost` from its default value of 4.0 down to approximately 1.1?
- A) Because setting it to 1.1 enables hardware compression on NVMe controllers
- B) Because 4.0 was calibrated for spinning mechanical disk seek latency; on NVMe SSDs, random and sequential read latencies are nearly identical, and 4.0 wrongly biases the planner against index scans
- C) Because NVMe drives cannot execute sequential reads
- D) Because `random_page_cost` controls the memory size allocated to hash tables
<details><summary>Answer</summary>

**B.** `random_page_cost` measures the estimated cost of reading an arbitrary 8KB disk page relative to a sequential page read (`seq_page_cost = 1.0`). On spinning hard drives, disk seek latency made random reads 4x more expensive. On NVMe SSDs, random reads have virtually zero mechanical seek penalty. Leaving the parameter at 4.0 tricks the optimizer into assuming index scans are prohibitively expensive, causing it to select slow full sequential scans.
- Why not A: It does not affect hardware controller compression.
- Why not C: NVMe drives execute sequential reads exceptionally fast.
- Why not D: Hash memory is governed by `work_mem`.
- Ref: [modules/07-query-planning-cost-model-and-tuning.md](../modules/07-query-planning-cost-model-and-tuning.md#2-mathematical-foundations-the-postgresql-cost-model), https://www.postgresql.org/docs/18/runtime-config-query.html#GUC-RANDOM-PAGE-COST
</details>

### Q-EDB-032 · Extended Statistics · difficulty 3 · scenario
A table contains 10,000,000 car records with columns `make` and `model`. A query filters `WHERE make = 'Porsche' AND model = '911'`. The planner estimates 12 rows, but the actual result is 50,000 rows. The planner selects an inappropriate Nested Loop join, causing the query to run for 30 seconds. What is the root cause and the fix?
- A) Table bloat; the fix is running `VACUUM FULL`
- B) Attribute value independence assumption underestimating correlated column selectivity; the fix is `CREATE STATISTICS stats_cars (dependencies, mcv) ON make, model FROM cars; ANALYZE cars;`
- C) Missing primary key constraint; the fix is adding an identity column
- D) `shared_buffers` exhaustion; the fix is restarting the database
<details><summary>Answer</summary>

**B.** By default, the optimizer assumes columns are statistically independent: $P(A \land B) = P(A) \times P(B)$. For correlated attributes (almost all 911s have make Porsche), multiplying single-column probabilities severely underestimates matching rows (estimating 12 instead of 50,000). The planner chooses a nested loop join that loops 50,000 times. `CREATE STATISTICS` captures joint multivariate dependencies and MCVs, correcting the estimate.
- Why not A: Bloat affects I/O volume, but does not cause planner probability multiplication errors.
- Why not C: Primary keys do not supply multivariate column distribution data.
- Why not D: Memory sizing does not alter optimizer selectivity formulas.
- Ref: [modules/07-query-planning-cost-model-and-tuning.md](../modules/07-query-planning-cost-model-and-tuning.md#4-the-correlated-column-trap--extended-statistics), https://www.postgresql.org/docs/18/planner-stats.html#PLANNER-STATS-EXTENDED
</details>

### Q-EDB-033 · Prepared Statements · difficulty 2 · single
When does PostgreSQL switch a prepared statement from executing custom plans to a frozen generic plan?
- A) Immediately on the second execution
- B) On the sixth execution, if the generic plan's estimated cost is on average cheaper than or equal to the custom plans
- C) Only when an explicit `REINDEX` command is executed
- D) Never; prepared statements always regenerate custom plans
<details><summary>Answer</summary>

**B.** For the first five executions of a prepared statement, PostgreSQL generates custom plans specific to parameter values. On execution 6, it evaluates whether a generic plan (parameter-agnostic) is cheaper on average. If so, it locks into the generic plan. If parameter values are heavily skewed, this can trigger a sudden latency cliff. Setting `plan_cache_mode = 'force_custom_plan'` forces custom planning.
- Why not A: The threshold is 5 custom plan executions, not 1.
- Why not C: Reindexing does not affect prepared statement cache logic.
- Why not D: PostgreSQL explicitly caches generic plans to avoid repetitive planning overhead.
- Ref: [modules/07-query-planning-cost-model-and-tuning.md](../modules/07-query-planning-cost-model-and-tuning.md#6-prepared-statements-generic-vs-custom-plan-flips), https://www.postgresql.org/docs/18/sql-prepare.html
</details>

### Q-EDB-034 · JIT · difficulty 2 · single
Why was the default setting of Just-In-Time (JIT) compilation changed to `off` in PostgreSQL 19?
- A) LLVM support was removed from the PostgreSQL source tree
- B) JIT compilation overhead (10ms–50ms) frequently exceeded total query execution duration for fast transactional OLTP queries, degrading system throughput
- C) JIT compilation causes unrecoverable memory leaks in `shared_buffers`
- D) JIT compilation prevents the use of B-tree indexes
<details><summary>Answer</summary>

**B.** While JIT accelerates complex analytical queries processing millions of tuples, it introduces a 10ms to 50ms LLVM compilation latency penalty per query. On high-throughput OLTP applications where queries are expected to complete in under 5ms, JIT increased latency by 10x and exhausted CPU cores. PostgreSQL 19 defaults `jit = off` to protect transactional workloads.
- Why not A: LLVM JIT remains fully supported and can be enabled when needed.
- Why not C: JIT does not corrupt or leak `shared_buffers`.
- Why not D: JIT optimizes expression evaluation and tuple deforming; it does not block index access.
- Ref: [modules/07-query-planning-cost-model-and-tuning.md](../modules/07-query-planning-cost-model-and-tuning.md#7-just-in-time-jit-compilation-benefits--oltp-hazard), https://www.postgresql.org/docs/19/release-19.html
</details>

### Q-EDB-035 · EXPLAIN · difficulty 2 · multi
In `EXPLAIN (ANALYZE, BUFFERS)` output, what do the metrics `shared hit` and `shared read` indicate? (Select TWO)
- A) `shared hit` indicates the count of 8KB pages retrieved directly from PostgreSQL `shared_buffers` memory
- B) `shared hit` indicates the number of cache hits in the client web browser
- C) `shared read` indicates 8KB pages that were not present in `shared_buffers` and had to be fetched from operating system cache or disk
- D) `shared read` indicates pages read exclusively from standby streaming replicas
- E) `shared hit` indicates rows that matched an index condition
<details><summary>Answer</summary>

**A, C.**
- **A**: `shared hit` records pages found in PostgreSQL's shared memory buffer pool (~100 nanosecond RAM access).
- **C**: `shared read` records buffer cache misses requiring a POSIX `read()` call to the OS kernel page cache or physical disk.
- Why not B: PostgreSQL server telemetry has no visibility into web browser caches.
- Why not D: It measures local buffer access, not streaming replica network reads.
- Why not E: `shared hit` counts 8KB pages, not logical rows.
- Ref: [modules/07-query-planning-cost-model-and-tuning.md](../modules/07-query-planning-cost-model-and-tuning.md#5-reading-explain-analyze-buffers-execution-plans), https://www.postgresql.org/docs/18/using-explain.html
</details>

---

## Domain 8: Concurrency Control, MVCC Internals & Locking

### Q-EDB-036 · Locking · difficulty 3 · scenario
A long-running analytical query runs `SELECT * FROM orders` for 20 seconds. 5 seconds into the query, a developer runs `ALTER TABLE orders ADD COLUMN notes TEXT;`. Immediately, hundreds of incoming customer checkout `SELECT * FROM orders WHERE id = ?` queries stall, and the application crashes with connection pool exhaustion. What occurred?
- A) The `ALTER TABLE` aborted the analytical query due to deadlock detection
- B) `ALTER TABLE` requests an `ACCESS EXCLUSIVE` lock and queues behind the analytical reader; because the lock queue is FIFO, all subsequent `ACCESS SHARE` readers queue behind `ALTER TABLE`, blocking all traffic
- C) PostgreSQL ran out of Transaction IDs and entered emergency read-only shutdown
- D) The analytical query locked the operating system network interface
<details><summary>Answer</summary>

**B.** This is the classic "Lock Queue Pileup". The analytical query holds `ACCESS SHARE`. `ALTER TABLE` requires `ACCESS EXCLUSIVE`. Because `ACCESS EXCLUSIVE` conflicts with `ACCESS SHARE`, the DDL waits at the head of the lock queue. Any subsequent query requesting `ACCESS SHARE` conflicts with the pending `ACCESS EXCLUSIVE` lock and must wait behind it in the queue. The defense is setting `SET LOCAL lock_timeout = '2s';` before running DDL.
- Why not A: `ALTER TABLE` does not abort active readers; it waits in the queue.
- Why not C: Wraparound shutdown does not occur due to an ALTER TABLE.
- Why not D: Database processes do not lock physical network cards.
- Ref: [modules/08-concurrency-mvcc-and-isolation.md](../modules/08-concurrency-mvcc-and-isolation.md#5-the-lock-queue-hazard--production-ddl-pileups), https://www.postgresql.org/docs/18/explicit-locking.html
</details>

### Q-EDB-037 · MVCC · difficulty 2 · single
Why can a purely read-only `SELECT` query in PostgreSQL dirty pages in `shared_buffers` and cause physical disk writes?
- A) Because `SELECT` updates the `last_read_timestamp` column on every row
- B) Because the first reader that verifies transaction commit status in the Commit Log (`pg_xact`) writes "Hint Bits" directly onto the 8KB page header in memory
- C) Because PostgreSQL encrypts every page during reads
- D) Because `SELECT` executes a background `VACUUM` on every scanned page
<details><summary>Answer</summary>

**B.** When tuples are inserted or updated, their commit status is unconfirmed on the page itself. The first reader transaction that inspects a tuple queries the Commit Log (`pg_xact`) and writes Hint Bits (e.g., `HEAP_XMIN_COMMITTED`) directly onto the tuple's `t_infomask` inside the 8KB page in `shared_buffers`. Subsequent readers bypass `pg_xact`. Writing these hint bits modifies page bytes, marking the page dirty and requiring disk flush.
- Why not A: PostgreSQL does not maintain automatic row-level read timestamps.
- Why not C: Reading does not encrypt pages.
- Why not D: `SELECT` does not invoke vacuuming.
- Ref: [modules/08-concurrency-mvcc-and-isolation.md](../modules/08-concurrency-mvcc-and-isolation.md#2-low-level-tuple-anatomy--hint-bit-dynamics), https://www.interdb.jp/pg/
</details>

### Q-EDB-038 · Work Queues · difficulty 2 · single
How does `SELECT ... FOR UPDATE SKIP LOCKED` enable lock-free, highly scalable background worker queues?
- A) It deletes the rows immediately upon read
- B) It allows concurrent workers to immediately skip rows currently locked by other sessions without waiting or blocking
- C) It moves locked rows into an in-memory Redis cluster
- D) It grants workers superuser privileges during query execution
<details><summary>Answer</summary>

**B.** In standard `FOR UPDATE`, concurrent workers attempting to lock candidate rows block and wait until the locking transaction finishes. With `SKIP LOCKED`, workers check row lock state; if a row is locked by another session, the engine ignores it and streams the next available unlocked row, eliminating lock waits and contention.
- Why not A: Rows are locked, not deleted; deletion occurs only upon explicit `DELETE`.
- Why not C: PostgreSQL operates independently of Redis.
- Why not D: It does not alter user privileges.
- Ref: [modules/08-concurrency-mvcc-and-isolation.md](../modules/08-concurrency-mvcc-and-isolation.md#6-row-level-locking--non-blocking-work-queues), https://www.postgresql.org/docs/18/sql-select.html#SQL-FOR-UPDATE-SHARE
</details>

### Q-EDB-039 · Isolation · difficulty 3 · single
What anomaly is prevented by `SERIALIZABLE` isolation in PostgreSQL that is permitted under `REPEATABLE READ`?
- A) Dirty Reads
- B) Non-Repeatable Reads
- C) Write Skew
- D) Lost Updates
<details><summary>Answer</summary>

**C.** Write Skew occurs when two concurrent transactions read overlapping state, make independent updates based on that state, and violate a global business invariant that neither transaction violated individually (e.g., medical on-call rotation where at least one doctor must remain on call). Repeatable Read allows Write Skew; Serializable Snapshot Isolation (SSI) tracks read-write anti-dependencies and aborts one transaction with error `40001`.
- Why not A & B: Both Dirty Reads and Non-Repeatable Reads are already prevented by Repeatable Read.
- Why not D: Lost Updates are prevented under Repeatable Read via first-updater-wins row locking.
- Ref: [modules/08-concurrency-mvcc-and-isolation.md](../modules/08-concurrency-mvcc-and-isolation.md#3-snapshot-isolation--ansi-isolation-levels), Berenson et al. (1995)
</details>

### Q-EDB-040 · Locks · difficulty 2 · multi
Which of the following table lock modes conflict with `ROW EXCLUSIVE` (the lock acquired by `INSERT`, `UPDATE`, and `DELETE`)? (Select THREE)
- A) `ACCESS SHARE`
- B) `SHARE`
- C) `SHARE ROW EXCLUSIVE`
- D) `ACCESS EXCLUSIVE`
- E) `ROW SHARE`
<details><summary>Answer</summary>

**B, C, D.**
- `ROW EXCLUSIVE` conflicts with `SHARE`, `SHARE ROW EXCLUSIVE`, `EXCLUSIVE`, and `ACCESS EXCLUSIVE`.
- Why not A: `ROW EXCLUSIVE` does NOT conflict with `ACCESS SHARE` (`SELECT`). Readers never block writers.
- Why not E: `ROW EXCLUSIVE` does NOT conflict with `ROW SHARE` (`SELECT FOR UPDATE`).
- Ref: [modules/08-concurrency-mvcc-and-isolation.md](../modules/08-concurrency-mvcc-and-isolation.md#4-the-8-level-table-lock-conflict-matrix), https://www.postgresql.org/docs/18/explicit-locking.html
</details>

---

## Domain 9: Vacuum Internals, Freezing & Bloat Mitigation

### Q-EDB-041 · Vacuum · difficulty 2 · single
What are the two mandatory prerequisites for an `UPDATE` to utilize the Heap-Only Tuple (HOT) optimization?
- A) The table must be partitioned, and the update must run inside a transaction
- B) The new tuple must physically fit on the exact same 8KB page as the old tuple, and no column referenced by any index on the table may be modified
- C) The table must have zero foreign keys, and `shared_buffers` must be at least 16GB
- D) The update must modify an indexed column using an `IMMUTABLE` function
<details><summary>Answer</summary>

**B.** HOT requires: (1) free space on the current 8KB page to place the new tuple version, and (2) zero indexed columns altered by the `UPDATE`. This allows the engine to create an intra-page line pointer redirect chain without generating new index entries across secondary indexes.
- Why not A: HOT operates on standard heap tables; partitioning is not required.
- Why not C: Foreign keys and memory size do not dictate HOT eligibility.
- Why not D: Modifying an indexed column strictly breaks HOT and forces index tuple insertion.
- Ref: [modules/09-vacuum-freezing-and-bloat.md](../modules/09-vacuum-freezing-and-bloat.md#3-heap-only-tuples-hot--fillfactor-optimization), https://www.postgresql.org/docs/18/storage-hot.html
</details>

### Q-EDB-042 · Wraparound · difficulty 3 · scenario
A cluster monitoring alert triggers: `database age is 2,050,000,000 transactions`. Autovacuum fails to freeze transaction IDs because a developer left an uncommitted `BEGIN` session open 3 weeks ago. What emergency consequence will occur if the transaction count reaches the critical threshold ($2^{31} - 1,000,000$)?
- A) Autovacuum will automatically kill the developer's session and resume normal operation
- B) The database cluster will halt assignment of new transaction IDs, refusing all write commands to prevent data loss, requiring manual freezing to recover
- C) Transaction IDs will wrap around to 0 silently without service interruption
- D) The database drops un-frozen tables to preserve the catalog
<details><summary>Answer</summary>

**B.** To prevent Transaction ID wraparound (where ancient committed data becomes invisible due to modulo-$2^{31}$ arithmetic), PostgreSQL warns aggressively when 3 million transactions remain (`xidWarnLimit`). When 1 million transactions remain before wraparound (`xidStopLimit`), PostgreSQL halts the assignment of new transaction IDs, refusing all write transactions and commands that consume an XID. Existing connections remain active and read-only queries continue to function, but writes fail until freezing is executed. Recovery requires starting PostgreSQL in single-user standalone mode (`postgres --single`) or superuser maintenance and running a manual freeze `VACUUM`.
- Why not A: PostgreSQL will not automatically terminate open client sessions unless `idle_in_transaction_session_timeout` is configured.
- Why not C: Wraparound without freezing causes catastrophic data invisibility.
- Why not D: PostgreSQL never drops user tables automatically.
- Ref: [modules/09-vacuum-freezing-and-bloat.md](../modules/09-vacuum-freezing-and-bloat.md#5-transaction-id-xid-wraparound--emergency-freezing), https://www.postgresql.org/docs/18/routine-vacuuming.html#VACUUM-FOR-WRAPAROUND
</details>

### Q-EDB-043 · Horizon Blockers · difficulty 2 · multi
Which of the following conditions prevent autovacuum from cleaning dead tuple versions across a database cluster? (Select THREE)
- A) An open, idle transaction holding `backend_xmin` (e.g. an uncommitted `psql` session)
- B) An inactive or disconnected replication slot (`active = false`)
- C) An orphaned two-phase commit prepared transaction (`pg_prepared_xacts`)
- D) Running `EXPLAIN ANALYZE` on a read-only query
- E) A table having `fillfactor = 85`
<details><summary>Answer</summary>

**A, B, C.**
- **A**: An open transaction holds open `backend_xmin`; autovacuum cannot purge any tuple deleted after that transaction began.
- **B**: An inactive replication slot pins the catalog/database `xmin` horizon to protect the disconnected replica.
- **C**: Orphaned prepared transactions persist across restarts and pin `xmin`.
- Why not D: Executing EXPLAIN ANALYZE does not hold long-lived transactions open after completion.
- Why not E: `fillfactor = 85` reserves space for HOT; it does not block vacuum.
- Ref: [modules/09-vacuum-freezing-and-bloat.md](../modules/09-vacuum-freezing-and-bloat.md#6-the-three-critical-vacuum-horizon-blockers), https://www.postgresql.org/docs/18/routine-vacuuming.html
</details>

### Q-EDB-044 · Vacuum · difficulty 2 · single
What formula dictates when the autovacuum daemon launches a vacuum worker on table $R$?
- A) $\text{Dead Tuples} > 1,000,000$
- B) $\text{Dead Tuples} > \text{autovacuum\_vacuum\_threshold} + (\text{autovacuum\_vacuum\_scale\_factor} \times \text{reltuples})$
- C) $\text{Heap Size} > \text{shared\_buffers} / 2$
- D) $\text{Time Elapsed} > \text{checkpoint\_timeout} \times 2$
<details><summary>Answer</summary>

**B.** Autovacuum wakes up when dead tuples exceed the static threshold (default 50) plus the dynamic scale factor (default 0.2, or 20%) multiplied by estimated table row count (`reltuples`).
- Why not A: Thresholds are dynamic, not static 1 million rows.
- Why not C & D: Buffer sizing and checkpoint timeouts do not govern autovacuum worker triggers.
- Ref: [modules/09-vacuum-freezing-and-bloat.md](../modules/09-vacuum-freezing-and-bloat.md#4-autovacuum-daemon-mechanics--mathematical-tuning), https://www.postgresql.org/docs/18/routine-vacuuming.html#AUTOVACUUM
</details>

### Q-EDB-045 · Upgrades · difficulty 3 · single
In PostgreSQL 19, what native SQL command replaces `VACUUM FULL` and third-party tools like `pg_repack` to rebuild bloated relations online without exclusive table locks?
- A) `OPTIMIZE TABLE CONCURRENTLY`
- B) `REPACK CONCURRENTLY`
- C) `ALTER TABLE REBUILD`
- D) `VACUUM ONLINE`
<details><summary>Answer</summary>

**B.** PostgreSQL 19 introduces native `REPACK` and `REPACK CONCURRENTLY`. Unlike `VACUUM FULL` (which acquires an `ACCESS EXCLUSIVE` lock taking the table offline), `REPACK CONCURRENTLY` rebuilds the table and indexes online in the background, allowing production reads and writes to proceed uninterrupted.
- Why not A: `OPTIMIZE TABLE` is MySQL syntax.
- Why not C & D: These are non-existent SQL commands in PostgreSQL.
- Ref: [modules/09-vacuum-freezing-and-bloat.md](../modules/09-vacuum-freezing-and-bloat.md#7-postgresql-18--19-maintenance-evolution), https://www.postgresql.org/docs/19/release-19.html
</details>

---

## Domain 10: Server Programming, RBAC & Security Architecture

### Q-EDB-046 · Security · difficulty 3 · scenario
A DBA creates a maintenance function: `CREATE FUNCTION fix_perms() RETURNS VOID SECURITY DEFINER LANGUAGE plpgsql AS ...`. The function does not specify a `search_path`. What severe vulnerability is introduced?
- A) Buffer overflow in the PL/pgSQL bytecode virtual machine
- B) Search-Path Hijacking: an unprivileged user can create a malicious table or operator in `public`; when an administrator runs the function, it executes the attacker's code with owner/superuser privileges
- C) The function will lock all tables in the database exclusively
- D) PostgreSQL will automatically drop all user accounts
<details><summary>Answer</summary>

**B.** `SECURITY DEFINER` functions execute with the privileges of the function's owner (often a superuser). If unqualified objects are referenced without an explicit `search_path`, PostgreSQL searches schemas in the caller's session `search_path`. An attacker can place a trojan horse object in `public`, which the function executes with administrative privileges. The defense is: `ALTER FUNCTION fix_perms() SET search_path = pg_catalog, pg_temp;`.
- Why not A: It is an authorization and name resolution vulnerability, not a C-level buffer overflow.
- Why not C & D: It does not lock tables or drop accounts automatically.
- Ref: [modules/10-server-programming-and-security.md](../modules/10-server-programming-and-security.md#6-neutralizing-security-definer-search-path-hijacking), https://www.postgresql.org/docs/18/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY
</details>

### Q-EDB-047 · Volatility · difficulty 2 · single
Why must a user-defined function used in an expression index (`CREATE INDEX ON tbl ((my_func(col))))`) strictly be declared `IMMUTABLE`?
- A) Because `VOLATILE` functions require more disk storage
- B) Because the optimizer assumes the function's output will never change for given inputs, pre-computing index values; non-immutable functions cause stale, corrupted index lookups
- C) Because `IMMUTABLE` functions are compiled into GPU machine code
- D) Because PostgreSQL restricts index creation to functions written in C
<details><summary>Answer</summary>

**B.** The `IMMUTABLE` contract guarantees that a function produces identical outputs for identical inputs forever, with zero database side-effects. The engine evaluates the function once at write time and stores the result in the B-tree index. If a function is marked `IMMUTABLE` but depends on configuration, time, or table data, index entries will diverge from reality, corrupting query results.
- Why not A: Volatility categories do not dictate disk byte widths.
- Why not C: Functions execute on CPU.
- Why not D: PL/pgSQL, SQL, and internal functions can all be declared `IMMUTABLE`.
- Ref: [modules/10-server-programming-and-security.md](../modules/10-server-programming-and-security.md#3-function-volatility-categories-the-integrity-contract), https://www.postgresql.org/docs/18/xfunc-volatility.html
</details>

### Q-EDB-048 · RLS · difficulty 2 · single
What occurs when an application superuser account executes queries on a table with Row-Level Security (RLS) enabled?
- A) Superusers are restricted strictly to rows where `tenant_id = 0`
- B) Superusers bypass Row-Level Security policies by default, observing all rows across all tenants
- C) The query fails with: `permission denied for relation`
- D) Superusers are automatically demoted to unprivileged roles
<details><summary>Answer</summary>

**B.** In PostgreSQL, superuser roles bypass all Row-Level Security checks by default. Even with strict tenant isolation policies in place, connecting an application as a superuser exposes all tenant data. Application connections must strictly connect as unprivileged database roles.
- Why not A, C, D: Superusers retain full, unrestricted access across all database relations.
- Ref: [modules/10-server-programming-and-security.md](../modules/10-server-programming-and-security.md#7-row-level-security-rls--multi-tenant-defense), https://www.postgresql.org/docs/18/ddl-rowsecurity.html
</details>

### Q-EDB-049 · Routines · difficulty 2 · single
What operational advantage do stored Procedures (`CREATE PROCEDURE`) possess over Functions (`CREATE FUNCTION`) in PostgreSQL?
- A) Procedures can execute transaction control statements (`COMMIT` and `ROLLBACK`) internally
- B) Procedures execute 100x faster than functions
- C) Procedures can be invoked from within a `SELECT` projection clause
- D) Procedures automatically cache query results in Redis
<details><summary>Answer</summary>

**A.** Functions execute atomically inside the caller's transaction and cannot commit or roll back. Procedures (invoked via `CALL`) can manage transaction boundaries internally, issuing `COMMIT` and `ROLLBACK` during batch data processing loops to free locks and allow vacuuming.
- Why not B: Both execute using the same procedural engine.
- Why not C: Procedures cannot be invoked inside `SELECT` expressions; they require `CALL`.
- Why not D: PostgreSQL does not interface natively with Redis.
- Ref: [modules/10-server-programming-and-security.md](../modules/10-server-programming-and-security.md#2-server-programming-functions-vs-procedures), https://www.postgresql.org/docs/18/sql-createprocedure.html
</details>

### Q-EDB-050 · Authentication · difficulty 2 · single
What authentication enhancement was introduced in PostgreSQL 18?
- A) Deprecation of MD5 password hashing with server warnings, and native support for OAuth 2.0 / OIDC JWT bearer tokens
- B) Mandatory biometric WebAuthn verification on all TCP connections
- C) Complete removal of SCRAM-SHA-256
- D) Elimination of the `pg_hba.conf` configuration file
<details><summary>Answer</summary>

**A.** PostgreSQL 18 officially deprecates legacy MD5 authentication, issuing server configuration warnings, and adds native support for OAuth 2.0 / OpenID Connect (OIDC) JWT token authentication, enabling centralized identity provider integration.
- Why not B: WebAuthn is an application-layer standard; PostgreSQL TCP protocol does not require biometrics.
- Why not C: SCRAM-SHA-256 remains the recommended secure password standard.
- Why not D: `pg_hba.conf` remains the core client authentication configuration file.
- Ref: [modules/10-server-programming-and-security.md](../modules/10-server-programming-and-security.md#8-authentication--connection-security-postgresql-18-oauth), https://www.postgresql.org/docs/18/release-18.html
</details>

---

## Domain 11: Partitioning, Connection Architecture & Pooling

### Q-EDB-051 · Partitioning · difficulty 3 · single
Why can PostgreSQL not enforce a global unique constraint across child partitions in declarative partitioning unless the partition key is included in the unique index?
- A) Because the SQL standard prohibits unique constraints on partitioned tables
- B) Because child partitions are physically distinct relations (`pg_class`) with local B-tree index files; without a global index, validating uniqueness would require probing every partition index on every insert
- C) Because the checkpointer process cannot write to multiple partitions simultaneously
- D) Because unique constraints require Hash partitioning
<details><summary>Answer</summary>

**B.** PostgreSQL indexes are local to individual physical tables. There are no cross-table "global" index structures in PostgreSQL. If a unique constraint did not include the partition key, an insert into Partition 1 would require probing the indexes of Partition 2, Partition 3, ..., Partition $N$, transforming an $O(\log N)$ insert into an expensive distributed scan. Enforcing that the partition key is part of the constraint guarantees uniqueness can be validated strictly within a single local index.
- Why not A: SQL standard permits unique constraints on partitioned tables.
- Why not C: The checkpointer flushes buffer pages independent of partitioning.
- Why not D: Unique constraints work across Range, List, and Hash partitioning.
- Ref: [modules/11-partitioning-connections-and-application-integration.md](../modules/11-partitioning-connections-and-application-integration.md#2-declarative-partitioning--dynamic-pruning), https://www.postgresql.org/docs/18/ddl-partitioning.html#DDL-PARTITIONING-DECLARATIVE-LIMITATIONS
</details>

### Q-EDB-052 · Pooling · difficulty 2 · scenario
An infrastructure team configures PgBouncer in **Transaction Pooling** mode to handle 10,000 microservice connections. Which of the following application patterns will BREAK or leak state across clients?
- A) Executing standard parameterized `SELECT` queries inside `BEGIN ... COMMIT`
- B) Using session-level `SET search_path = my_schema;`, temporary tables (`CREATE TEMP TABLE`), or session-level advisory locks
- C) Using `INSERT ... ON CONFLICT DO UPDATE`
- D) Querying views in the `public` schema
<details><summary>Answer</summary>

**B.** In Transaction Pooling mode, a backend connection is returned to the pool immediately upon `COMMIT` or `ROLLBACK`. Any session-level state (`SET`, temporary tables, `LISTEN/NOTIFY`, or session advisory locks) either vanishes on the next transaction or leaks to another client that subsequently checks out the same backend. The fix is using `SET LOCAL`, transaction-level advisory locks (`pg_advisory_xact_lock()`), and dedicated session-pooled connections for `LISTEN`.
- Why not A, C, D: These are standard transactional operations that function properly in transaction pooling.
- Ref: [modules/11-partitioning-connections-and-application-integration.md](../modules/11-partitioning-connections-and-application-integration.md#3-connection-architecture--scaling-the-pgbouncer-tier), https://www.pgbouncer.org/features.html
</details>

### Q-EDB-053 · Partitioning · difficulty 2 · single
What command allows an administrator to detach an active partition from a parent partitioned table without acquiring an `ACCESS EXCLUSIVE` lock on the entire partitioned hierarchy?
- A) `DROP PARTITION partition_name;`
- B) `ALTER TABLE parent DETACH PARTITION child CONCURRENTLY;`
- C) `ALTER TABLE child RENAME TO standalone_table;`
- D) `TRUNCATE TABLE child;`
<details><summary>Answer</summary>

**B.** `ALTER TABLE ... DETACH PARTITION ... CONCURRENTLY` detaches a partition using a low-level lock, running in two brief phases that avoid holding exclusive locks on the parent table, permitting continuous client queries during partition archival.
- Why not A: `DROP PARTITION` is non-standard syntax.
- Why not C: Renaming a child partition does not detach it from the parent.
- Why not D: `TRUNCATE` deletes data but does not detach the partition.
- Ref: [modules/11-partitioning-connections-and-application-integration.md](../modules/11-partitioning-connections-and-application-integration.md#2-declarative-partitioning--dynamic-pruning), https://www.postgresql.org/docs/18/sql-altertable.html
</details>

### Q-EDB-054 · Connection Tuning · difficulty 2 · single
What formula defines the optimal number of active PostgreSQL backend server connections for maximum throughput on a dedicated server?
- A) $\text{Connections} = \text{Client Application Threads} \times 10$
- B) $\text{Connections} \approx (\text{CPU Cores} \times 2) + \text{Effective Spindle / Storage Channel Count}$
- C) $\text{Connections} = \text{RAM in GB} \times 100$
- D) $\text{Connections} = 5000$
<details><summary>Answer</summary>

**B.** Based on queueing theory and hardware benchmarks, optimal database throughput occurs when concurrent active worker backends approximate $2 \times \text{Cores} + \text{Disk Channels}$. Beyond this threshold, CPU context-switching, cache invalidation, and shared memory lock contention degrade overall throughput. Thousands of clients should be multiplexed onto this small pool via PgBouncer.
- Why not A & D: Creating thousands of backend processes exhausts RAM and stalls CPUs in context switches.
- Why not C: Connection count should scale with CPU processing cores, not raw RAM capacity.
- Ref: [modules/11-partitioning-connections-and-application-integration.md](../modules/11-partitioning-connections-and-application-integration.md#3-connection-architecture--scaling-the-pgbouncer-tier), PostgreSQL Wiki
</details>

### Q-EDB-055 · Migration · difficulty 2 · multi
Which of the following DDL operations can be executed on a 50-million-row production table in PostgreSQL 18 without causing extended service downtime or full table rewrites? (Select TWO)
- A) `ALTER TABLE tbl ADD COLUMN col INT DEFAULT 0;`
- B) `ALTER TABLE tbl ALTER COLUMN col TYPE BIGINT;`
- C) `CREATE INDEX CONCURRENTLY idx ON tbl (col);`
- D) `VACUUM FULL tbl;`
- E) `ALTER TABLE tbl ADD CONSTRAINT fk FOREIGN KEY (ref_id) REFERENCES ref(id);` (without `NOT VALID`)
<details><summary>Answer</summary>

**A, C.**
- **A**: Since PostgreSQL 11, adding a column with a constant default performs an instant catalog update without rewriting table rows on disk.
- **C**: `CREATE INDEX CONCURRENTLY` builds the index online without acquiring write-blocking exclusive locks.
- Why not B: Changing column data types (e.g. INT to BIGINT) requires rewriting every 8KB heap page, holding an `ACCESS EXCLUSIVE` lock.
- Why not D: `VACUUM FULL` acquires an `ACCESS EXCLUSIVE` lock, taking the table offline.
- Why not E: Adding an unvalidated foreign key scans the table under an exclusive lock.
- Ref: [modules/11-partitioning-connections-and-application-integration.md](../modules/11-partitioning-connections-and-application-integration.md#6-zero-downtime-schema-evolution-the-expand-contract-pattern), https://www.postgresql.org/docs/18/
</details>

---

## Domain 12: Durability, WAL, Backup & PITR

### Q-EDB-056 · WAL · difficulty 2 · single
What critical torn-page protection mechanism is enforced by PostgreSQL's `full_page_writes = on` parameter?
- A) It encrypts full disk pages with AES-256 before writing to WAL
- B) It writes a full 8KB image of each page to the WAL stream on its first modification after a checkpoint, allowing crash recovery to overwrite partially written OS blocks
- C) It flushes all memory pages to S3 cloud storage
- D) It prevents developers from dropping tables without superuser credentials
<details><summary>Answer</summary>

**B.** Operating systems write data in 4KB (or 512-byte) sectors, while PostgreSQL writes 8KB blocks. Power failure during a write can result in a "torn page" (4KB written, 4KB corrupt). Standard WAL delta records cannot be applied to a torn page. `full_page_writes = on` writes the complete 8KB block image into WAL on the first modification after each checkpoint. Crash recovery overwrites any torn page on disk with the pristine 8KB image before applying deltas.
- Why not A: WAL is not encrypted by `full_page_writes`.
- Why not C: Cloud archiving is handled by `archive_command` or tools like `pgBackRest`.
- Why not D: It is an internal storage engine durability mechanism, not an authorization policy.
- Ref: [modules/12-durability-backup-and-pitr.md](../modules/12-durability-backup-and-pitr.md#2-write-ahead-log-wal-architecture--torn-page-protection), https://www.postgresql.org/docs/18/wal-reliability.html
</details>

### Q-EDB-057 · Checkpoints · difficulty 2 · single
To eliminate severe periodic disk I/O saturation spikes during checkpoints, how should `checkpoint_completion_target` be configured?
- A) Set `checkpoint_completion_target = 0.0` to flush pages as fast as possible
- B) Set `checkpoint_completion_target = 0.9` to spread checkpoint writes smoothly across 90% of the `checkpoint_timeout` interval
- C) Set `checkpoint_completion_target = 5.0` to delay checkpoints indefinitely
- D) Disable the checkpointer process entirely
<details><summary>Answer</summary>

**B.** `checkpoint_completion_target` specifies the fraction of the `checkpoint_timeout` duration over which the checkpointer should throttle and spread its disk write operations. Setting it to `0.9` smooths I/O across 90% of the checkpoint window, eliminating I/O storms and preserving disk bandwidth for client queries.
- Why not A: Setting it to 0.0 forces the checkpointer to write pages at maximum speed immediately, saturating disk controllers and stalling queries.
- Why not C: The parameter accepts values between 0.0 and 1.0.
- Why not D: Checkpointers cannot be disabled; without checkpoints, WAL would grow infinitely and crash recovery would take hours.
- Ref: [modules/12-durability-backup-and-pitr.md](../modules/12-durability-backup-and-pitr.md#3-checkpoint-tuning-eliminating-io-spikes), https://www.postgresql.org/docs/18/wal-configuration.html
</details>

### Q-EDB-058 · Backups · difficulty 2 · single
What command introduced in PostgreSQL 17 combines physical incremental backups with a base backup to produce a complete restorable cluster directory?
- A) `pg_restore`
- B) `pg_combinebackup`
- C) `pg_merge`
- D) `pg_assemble`
<details><summary>Answer</summary>

**B.** PostgreSQL 17 introduced native incremental physical backups via `pg_basebackup --incremental` and the corresponding synthesis utility `pg_combinebackup`, which merges a base backup and one or more incremental manifests into a standalone restorable `$PGDATA` directory.
- Why not A: `pg_restore` restores logical custom/directory dumps generated by `pg_dump`.
- Why not C & D: These are non-existent PostgreSQL administrative utilities.
- Ref: [modules/12-durability-backup-and-pitr.md](../modules/12-durability-backup-and-pitr.md#4-physical-base-backups--incremental-backups-pg17), https://www.postgresql.org/docs/18/app-pgcombinebackup.html
</details>

### Q-EDB-059 · PITR · difficulty 3 · ordering
Place the following Point-In-Time Recovery (PITR) disaster recovery steps into the correct chronological order:
1. Create a `recovery.signal` file in `$PGDATA` and configure `restore_command` and `recovery_target_time` in `postgresql.conf`
2. Stop the PostgreSQL service and move corrupted data files to an archive location
3. Restore the physical base backup files into `$PGDATA` and clear `pg_wal/`
4. Start the PostgreSQL server and verify that replay halts at the target timestamp and branches to a new Timeline
- A) 2 $\rightarrow$ 3 $\rightarrow$ 1 $\rightarrow$ 4
- B) 1 $\rightarrow$ 2 $\rightarrow$ 4 $\rightarrow$ 3
- C) 3 $\rightarrow$ 1 $\rightarrow$ 2 $\rightarrow$ 4
- D) 2 $\rightarrow$ 1 $\rightarrow$ 3 $\rightarrow$ 4
<details><summary>Answer</summary>

**A.** The correct operational sequence is:
1. Stop the corrupted server and clear/isolate the broken data directory (Step 2).
2. Restore the pristine physical base backup into `$PGDATA` (Step 3).
3. Place `recovery.signal` in `$PGDATA` and specify `restore_command` and `recovery_target_time` (Step 1).
4. Start the server; the startup process reads WAL from the archive, stops at the target time, promotes to a new timeline, removes `recovery.signal`, and opens for client read-write traffic (Step 4).
- Ref: [modules/12-durability-backup-and-pitr.md](../modules/12-durability-backup-and-pitr.md#5-point-in-time-recovery-pitr-drill), https://www.postgresql.org/docs/18/continuous-archiving.html
</details>

### Q-EDB-060 · Upgrades · difficulty 2 · single
What major performance advantage does `pg_upgrade` in PostgreSQL 18 introduce over earlier major versions?
- A) It compresses all tables using gzip during the upgrade
- B) It automatically transfers optimizer statistics (`pg_statistic`), eliminating the post-upgrade cold-cache and missing-statistics performance cliff
- C) It eliminates the need to verify catalog versions
- D) It upgrades from MySQL directly without schema translation
<details><summary>Answer</summary>

**B.** In previous versions, `pg_upgrade` completed with an empty `pg_statistic` catalog, forcing administrators to run `vacuumdb --all --analyze-in-stages` while queries suffered from terrible generic execution plans. PostgreSQL 18 transfers optimizer statistics directly to the new cluster during `pg_upgrade`, allowing the upgraded database to immediately run queries with optimal plans.
- Why not A: `pg_upgrade --link` hard-links existing storage files without recompressing.
- Why not C: Catalog version checks remain mandatory.
- Why not D: `pg_upgrade` upgrades between PostgreSQL major versions; it does not convert MySQL databases.
- Ref: [modules/12-durability-backup-and-pitr.md](../modules/12-durability-backup-and-pitr.md#7-major-upgrades-with-pg_upgrade-the-postgresql-18-advantage), https://www.postgresql.org/docs/18/release-18.html
</details>

---

## Domain 13: High Availability, Replication, Extensions & Telemetry

### Q-EDB-061 · CDC · difficulty 3 · single
How do Synchronized Failover Slots (introduced in PostgreSQL 17 and enhanced in PostgreSQL 18) prevent Change Data Capture (CDC) pipeline failures during primary database failovers?
- A) By replicating raw disk sectors directly to Kafka
- B) By continuously synchronizing logical replication slot LSN positions from the primary to physical standbys (`sync_replication_slots`), allowing CDC subscribers to fail over to the newly promoted primary without missing or duplicating events
- C) By converting all logical subscriptions into physical streaming standbys
- D) By disabling logical replication completely during failover events
<details><summary>Answer</summary>

**B.** Historically, logical replication slots existed strictly on the primary. If the primary failed and a physical standby was promoted, the logical replication slots were absent on the new primary, breaking downstream CDC tools (e.g. Debezium) and requiring full re-snapshots. PostgreSQL 17 introduced `sync_replication_slots` and failover slots (`failover = true`). The standby synchronizes slot positions continuously. Upon promotion, all logical slots are up-to-date, allowing CDC consumers to reconnect seamlessly.
- Why not A: Logical decoding uses decoded tuple changes (`pgoutput`), not raw disk sectors.
- Why not C: Standbys remain physical; subscriptions remain logical.
- Why not D: Disabling replication during failover is the exact failure mode this feature eliminates.
- Ref: [modules/13-high-availability-replication-and-extensions.md](../modules/13-high-availability-replication-and-extensions.md#4-logical-replication-cdc--postgresql-17-synchronized-failover-slots), https://www.postgresql.org/docs/18/logical-replication-failover.html
</details>

### Q-EDB-062 · Replication · difficulty 2 · scenario
An inactive logical replication slot is left on a production primary server after an external analytics test concludes. 24 hours later, the primary server crashes due to 100% disk exhaustion. What caused this, and what setting prevents it?
- A) The slot leaked shared memory buffers; fix with `shared_buffers = 128MB`
- B) The replication slot prevented PostgreSQL from deleting unacknowledged WAL segments, accumulating WAL until disk filled; fix with `max_slot_wal_keep_size`
- C) The slot disabled autovacuum cluster-wide; fix with `autovacuum = on`
- D) The slot forced all transactions to run in `SERIALIZABLE` mode
<details><summary>Answer</summary>

**B.** A replication slot guarantees that the primary server will not purge any WAL segment needed by the replica. If the consumer disconnects or is abandoned, WAL segments accumulate indefinitely in `pg_wal` until the filesystem is 100% full, forcing database shutdown. Setting `max_slot_wal_keep_size` (e.g. `64GB`) establishes an upper ceiling: if an inactive slot exceeds this limit, PostgreSQL invalidates the slot and resumes normal WAL cleanup, preserving primary availability.
- Why not A: WAL is stored on disk, not in shared buffers.
- Why not C: While an inactive slot pins `xmin` (causing bloat), disk filling in `pg_wal` is caused by WAL retention.
- Why not D: Slots do not change transaction isolation levels.
- Ref: [modules/13-high-availability-replication-and-extensions.md](../modules/13-high-availability-replication-and-extensions.md#3-replication-slots--the-inactive-slot-disk-exhaustion-hazard), https://www.postgresql.org/docs/18/warm-standby.html#STREAMING-REPLICATION-SLOTS
</details>

### Q-EDB-063 · Vector Search · difficulty 2 · single
When comparing vector index access methods in `pgvector`, what is the primary operational tradeoff between HNSW and IVFFlat?
- A) IVFFlat is faster for queries but consumes 10x more memory than HNSW
- B) HNSW builds a multi-layer proximity graph delivering superior query speed and recall (> 98%), but requires more memory and build time; IVFFlat builds quickly and uses less memory, but requires data to be loaded before indexing and has lower recall
- C) HNSW operates only on 2-dimensional geometric points; IVFFlat operates on 1536-dimensional embeddings
- D) HNSW can only be searched using Euclidean L2 distance; IVFFlat supports only Cosine similarity
<details><summary>Answer</summary>

**B.** HNSW builds an in-memory hierarchical graph that supports incremental inserts on empty tables and delivers fast queries with high recall (> 98%), but consumes significant RAM and build CPU. IVFFlat clusters data into Voronoi cells using k-means; it builds quickly with a small memory footprint, but must be built after data is populated (otherwise empty centroids form) and delivers lower query recall.
- Why not A: HNSW is faster for queries, not IVFFlat.
- Why not C: Both support high-dimensional vector embeddings (up to thousands of dimensions).
- Why not D: Both HNSW and IVFFlat support L2 (`<->`), Inner Product (`<#>`), and Cosine Distance (`<=>`).
- Ref: [modules/13-high-availability-replication-and-extensions.md](../modules/13-high-availability-replication-and-extensions.md#6-generative-ai-vector-search-pgvector-architecture), https://github.com/pgvector/pgvector
</details>

### Q-EDB-064 · High Availability · difficulty 2 · single
In an automated high-availability PostgreSQL cluster managed by Patroni and `etcd`, how is the "Split-Brain" hazard prevented when a primary node suffers network partitioning?
- A) By waiting 24 hours before promoting any node
- B) The primary must maintain an active lease heartbeat in `etcd`; if partitioned, its lease expires, Patroni demotes or fences the old primary, and the remaining nodes elect a new leader backed by Raft quorum
- C) By routing all writes to both nodes simultaneously using two-phase commit
- D) Split-brain cannot occur in PostgreSQL under any circumstances
<details><summary>Answer</summary>

**B.** Patroni uses a Distributed Consensus Store (`etcd`) implementing Raft consensus. The primary holds a leader lock with a time-to-live (TTL, e.g. 10s) and must renew it via heartbeats. If a network partition isolates the primary, it fails to renew its lease and demotes itself. Standbys observe the expired lock, hold an election, and promote the standby with the highest WAL LSN. Fencing (STONITH) ensures the old primary cannot accept writes.
- Why not A: Failover occurs in seconds, not 24 hours.
- Why not C: Dual-writing to partitioned primaries is the exact definition of split-brain corruption.
- Why not D: Split-brain is a classic distributed systems failure mode that requires explicit consensus and fencing defenses.
- Ref: [modules/13-high-availability-replication-and-extensions.md](../modules/13-high-availability-replication-and-extensions.md#5-automated-high-availability-with-patroni--raft-consensus), Patroni Documentation
</details>

### Q-EDB-065 · Telemetry · difficulty 2 · multi
Which PostgreSQL system catalogs or views are primary tools for diagnosing query performance degradation and lock contention in real time? (Select TWO)
- A) `pg_stat_statements`
- B) `pg_stat_activity`
- C) `pg_timezone_names`
- D) `pg_shdescription`
- E) `pg_collation`
<details><summary>Answer</summary>

**A, B.**
- **A (`pg_stat_statements`)**: Tracks normalized query execution metrics across all queries (calls, total/mean exec time, buffer hit ratios).
- **B (`pg_stat_activity`)**: Displays live active client sessions, current executing SQL statements, transaction durations, and wait event classifications (`Lock`, `IO`, `IPC`).
- Why not C: `pg_timezone_names` lists supported timezones.
- Why not D: `pg_shdescription` stores system catalog comments.
- Why not E: `pg_collation` lists language collation rules.
- Ref: [modules/13-high-availability-replication-and-extensions.md](../modules/13-high-availability-replication-and-extensions.md#7-production-observability-pg_stat_statements-pg_stat_io--wait-events), https://www.postgresql.org/docs/18/monitoring-stats.html
</details>

---

## 5. Full Mock Examination

### Exam Overview
- **Examination Code**: EDB-CP-PG18-MOCK
- **Total Questions**: 65
- **Time Allowed**: 90 minutes
- **Passing Score**: 70% (46 / 65 correct)
- **Domain Distribution**:
  - Architecture & Storage (D01): Q1–Q5
  - Data Types & Modeling (D02): Q6–Q10
  - Querying & Joins (D03): Q11–Q15
  - Advanced SQL & CTEs (D04): Q16–Q20
  - Semi-Structured Data & FTS (D05): Q21–Q25
  - Indexing Strategies (D06): Q26–Q30
  - Query Optimization & Tuning (D07): Q31–Q35
  - Concurrency, MVCC & Locking (D08): Q36–Q40
  - Vacuum, Freezing & Bloat (D09): Q41–Q45
  - Server Programming & Security (D10): Q46–Q50
  - Partitioning & Connections (D11): Q51–Q55
  - Durability, WAL & PITR (D12): Q56–Q60
  - HA, Replication & Telemetry (D13): Q61–Q65

### Mock Exam Scoring Key
1. **C** | 2. **B** | 3. **A, C, D** | 4. **C** | 5. **B**
6. **C** | 7. **A** | 8. **B** | 9. **B, C** | 10. **B**
11. **B** | 12. **C** | 13. **B** | 14. **B** | 15. **A**
16. **B** | 17. **B** | 18. **B** | 19. **A** | 20. **B**
21. **B** | 22. **C** | 23. **A, C** | 24. **B** | 25. **C**
26. **B** | 27. **A** | 28. **B** | 29. **B** | 30. **B**
31. **B** | 32. **B** | 33. **B** | 34. **B** | 35. **A, C**
36. **B** | 37. **B** | 38. **B** | 39. **C** | 40. **B, C, D**
41. **B** | 42. **B** | 43. **A, B, C** | 44. **B** | 45. **B**
46. **B** | 47. **B** | 48. **B** | 49. **A** | 50. **A**
51. **B** | 52. **B** | 53. **B** | 54. **B** | 55. **A, C**
56. **B** | 57. **B** | 58. **B** | 59. **A** | 60. **B**
61. **B** | 62. **B** | 63. **B** | 64. **B** | 65. **A, B**
