# PostgreSQL 18 Bilingual Terminology Glossary

This glossary provides authoritative English ↔ Czech definitions of core database concepts, architectural components, query semantics, and administration primitives for PostgreSQL 18. In accordance with repository standards, all definitions, classifications, and explanations are written in English, pairing canonical English database nomenclature with established Czech technical equivalents.

---

## 1. Engine Architecture, Process Model & Storage Layout

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Postmaster Process** | **Hlavní řídicí proces (postmaster)** | The primary daemon supervisor process in PostgreSQL that initializes shared memory, starts background workers, and forks a dedicated backend process for each incoming client connection. | PostgreSQL 18 Architecture Documentation |
| **Backend Process** | **Backendový proces klienta** | A dedicated operating system process spawned by the postmaster to handle queries, transaction state, and local execution for a single client session. | PostgreSQL 18 Internal Architecture |
| **Shared Buffers (`shared_buffers`)** | **Sdílená vyrovnávací paměť stránek** | A shared memory buffer pool where PostgreSQL caches disk pages (tables, indexes, free space maps) to minimize physical storage I/O. | PostgreSQL 18 Resource Consumption Guide |
| **Work Memory (`work_mem`)** | **Pracovní paměť dotazu (`work_mem`)** | The private memory budget allocated per sort operation or hash table execution before spilling temporary data to disk. | PostgreSQL 18 Memory Configuration |
| **Maintenance Work Memory (`maintenance_work_mem`)** | **Údržbová pracovní paměť** | The maximum memory allocated for maintenance operations, such as `VACUUM`, `CREATE INDEX`, and `ALTER TABLE ADD FOREIGN KEY`. | PostgreSQL 18 Resource Configuration |
| **Asynchronous I/O (AIO)** | **Asynchronní I/O subsystém** | The subsystem introduced in PostgreSQL 18 that executes non-blocking disk reads and writes via kernel interfaces (e.g., `io_uring` or POSIX AIO), significantly accelerating sequential scans, vacuuming, and prefetching. | PostgreSQL 18 Release Notes & Architecture |
| **Write-Ahead Logging (WAL)** | **Zápis do předstihového deníku (WAL)** | The durability protocol where data modifications must be written and flushed to a sequential log before corresponding dirty pages are written to heap storage. | ACID / PostgreSQL 18 Reliability Guide |
| **Log Sequence Number (LSN)** | **Sekvenční číslo záznamu v deníku (LSN)** | A 64-bit integer representing an exact byte offset within the Write-Ahead Log stream, uniquely identifying transaction events. | PostgreSQL 18 WAL Internals |
| **Full Page Image (FPI / `full_page_writes`)** | **Úplný obraz stránky (FPI)** | A complete 8KB snapshot of a page written to WAL upon its first modification after a checkpoint, preventing torn page corruption caused by OS block write failures. | PostgreSQL 18 Reliability Guide |
| **Checkpointer Process** | **Proces zápisu kontrolních bodů (checkpointer)** | A background utility process responsible for periodically writing dirty shared buffers to disk and creating consistent restore checkpoints. | PostgreSQL 18 Background Processes |
| **Background Writer (`bgwriter`)** | **Zapisovač na pozadí (`bgwriter`)** | A background worker that continually flushes dirty pages from `shared_buffers` to disk ahead of demand to ensure free buffers are readily available for backend processes. | PostgreSQL 18 Server Configuration |
| **Disk Page (Block)** | **Datová stránka (blok)** | The fundamental unit of disk allocation and buffering in PostgreSQL, default 8KB, containing page header, item pointer array, and physical tuples. | PostgreSQL 18 Storage Layout |
| **Tuple (Heap Row)** | **N-tice (záznam v haldě)** | A physical row version stored inside a database page, prefixed with header fields including `t_xmin`, `t_xmax`, and `t_ctid`. | PostgreSQL 18 Storage Engine |
| **Free Space Map (FSM)** | **Mapa volného místa (FSM)** | An auxiliary binary fork accompanying each table and index tracking available allocation space across individual pages to avoid unnecessary file fragmentation. | PostgreSQL 18 Database Physical Storage |
| **Visibility Map (VM)** | **Mapa viditelnosti (VM)** | A bitmap fork tracking whether all tuples on a given heap page are visible to all current and future transactions, facilitating index-only scans and skipping clean pages during vacuuming. | PostgreSQL 18 Storage Subsystem |
| **Tablespace** | **Diskový prostor (tablespace)** | A physical filesystem directory location defined in the database cluster where underlying data files for specific databases, tables, or indexes reside. | PostgreSQL 18 Administrator's Guide |
| **Host-Based Authentication (`pg_hba.conf`)** | **Konfigurace autentizace hostitelů** | The primary configuration file governing client connection authorization, specifying allowed network ranges, databases, user roles, and authentication methods. | PostgreSQL 18 Client Authentication |
| **SCRAM-SHA-256** | **Autentizační mechanismus SCRAM-SHA-256** | The salted challenge-response authentication mechanism providing cryptographically secure credential verification without transmitting passwords over the wire. | RFC 7677 / PostgreSQL 18 Security |
| **OAuth 2.0 / OpenID Connect Authentication** | **Autentizace přes OAuth 2.0 / OIDC** | Native support in PostgreSQL 18 allowing database clients to authenticate against the server using cryptographically verified JSON Web Tokens (JWT) from identity providers. | PostgreSQL 18 Release Highlights |

---

## 2. Relational Modeling, Advanced Types & Constraints

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Universally Unique Identifier Version 7 (`uuidv7`)** | **Časově řazený univerzální identifikátor (`uuidv7`)** | A 128-bit identifier incorporating a 48-bit UNIX millisecond timestamp prefix, ensuring monotonic ordering and optimal B-tree index locality without fragmentation. | RFC 9562 / PostgreSQL 18 Data Types |
| **TOAST (The Oversized-Attribute Storage Technique)** | **Technika ukládání nadrozměrných atributů (TOAST)** | PostgreSQL's mechanism that compresses and moves wide attributes exceeding 2KB out-of-line into a secondary chunked table (`pg_toast_*`) to maintain compact 8KB heap tuples. | PostgreSQL 18 Storage Internals |
| **Virtual Generated Column** | **Virtuální generovaný sloupec** | A column defined by an expression whose value is computed dynamically upon read operations without consuming physical disk storage (the default for generated columns in PostgreSQL 18). | PostgreSQL 18 DDL Reference |
| **Stored Generated Column** | **Uložený generovaný sloupec** | A column defined by an expression that is evaluated during row insertion or modification and written persistently into the physical heap tuple. | PostgreSQL 18 DDL Reference |
| **Temporal Constraint (`WITHOUT OVERLAPS`)** | **Časové (temporální) omezení (`WITHOUT OVERLAPS`)** | An SQL:2016 constraint supported in PostgreSQL 18 enforcing uniqueness or foreign key integrity across time intervals or range types to prevent schedule collisions. | SQL:2016 / PostgreSQL 18 DDL |
| **Referential Integrity** | **Referenční integrita** | The database guarantee that foreign key references consistently point to existing, valid rows in the referenced relation, governed by cascade actions (`RESTRICT`, `CASCADE`, `SET NULL`). | Relational Database Theory |
| **Domain Constraint** | **Doménové omezení** | A user-defined data type extension that attaches specific `CHECK` constraints to a base primitive type. | PostgreSQL 18 Data Types |
| **Identity Column (`IDENTITY`)** | **Identitní sloupec** | A standard SQL conformant auto-incrementing integer or bigint column backed by an implicit sequence (`GENERATED ALWAYS AS IDENTITY`). | PostgreSQL 18 DDL Reference |
| **Multirange Types** | **Multirozsahové datové typy (multiranges)** | Data types representing non-contiguous intervals or ordered collections of ranges, providing native support for set union, intersection, and difference operations. | PostgreSQL 18 Data Types |
| **Exclusion Constraint (`EXCLUDE USING`)** | **Vylučovací omezení (exclusion constraint)** | A generalized constraint implemented via index operator classes (typically GiST) guaranteeing that no two rows satisfy a specified comparison across defined columns. | PostgreSQL 18 Constraints |

---

## 3. SQL Engine, Projections, Filtering & Joins

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Three-Valued Logic (3VL)** | **Tříhodnotová logika (3VL)** | The propositional logic framework evaluated by SQL (`TRUE`, `FALSE`, `UNKNOWN`/`NULL`) derived from Kleene strong logic of indeterminacy ($K_3$). | SQL Standards / Formal Logic |
| **Null-Safe Equality (`IS DISTINCT FROM`)** | **Rovnost bezpečná vůči hodnotám NULL** | A comparison operator treating two NULL values as identical and a non-null value as distinct from NULL, returning strictly TRUE or FALSE. | SQL:1999 Standards |
| **Cartesian Product (Cross Join)** | **Kartézský součin** | A relational join operation returning all possible row combinations between two tables without filtering on an equality predicate. | Relational Algebra / SQL Standards |
| **Equi-Join** | **Ekvivalentní spojení (equi-join)** | A join operation where relational association between tables is evaluated strictly using the equality operator (`=`). | SQL:2016 Standards |
| **Outer Join** | **Vnější spojení (outer join)** | A join operation (`LEFT`, `RIGHT`, or `FULL`) that preserves unmatched rows from one or both participating relations, filling missing column values with `NULL`. | SQL Standards Reference |
| **Lateral Join (`LATERAL`)** | **Laterální spojení (korelovaný join)** | A subquery correlation in the `FROM` clause that allows an inner query or set-returning function to reference columns from preceding tables in the join order. | PostgreSQL 18 SQL Reference |
| **Correlated Subquery** | **Korelovaný poddotaz** | A nested subquery that references column values from an outer query block, requiring row-by-row re-evaluation unless rewritten by the query optimizer. | SQL Database Principles |
| **Upsert (`ON CONFLICT`)** | **Atomická vložení/úprava (upsert)** | An atomic DML construct executing an `INSERT` with an optional `ON CONFLICT (...) DO UPDATE` or `DO NOTHING` clause to handle unique violation collisions safely. | PostgreSQL 18 SQL Reference |
| **DML Returning (`RETURNING OLD / NEW`)** | **Vracení hodnot z DML (`RETURNING`)** | The clause returning modified row values immediately after `INSERT`, `UPDATE`, `DELETE`, or `MERGE`, enhanced in PostgreSQL 18 to expose both `OLD` and `NEW` row versions. | PostgreSQL 18 DML Reference |
| **Grouping Sets, Rollup & Cube** | **Seskupovací sady, souhrny a datové krychle** | Advanced multi-dimensional aggregation primitives generating hierarchical subtotal and grand total summary rows in a single query pass. | PostgreSQL 18 Aggregations |

---

## 4. Advanced SQL, CTEs & Window Functions

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Common Table Expression (CTE)** | **Společný tabulkový výraz (CTE)** | A named temporary result set defined within an execution scope using the `WITH` keyword, improving readability and modular query composition. | PostgreSQL 18 Queries Documentation |
| **Optimization Fence (`AS MATERIALIZED`)** | **Optimalizační bariéra** | A planner boundary that forces a CTE to be evaluated into an in-memory tuplestore rather than inlined, preventing outer predicates from pushing down. | PostgreSQL 18 Queries Reference |
| **Data-Modifying CTE** | **DML modifikující CTE** | A CTE enclosing `INSERT`, `UPDATE`, or `DELETE` statements that writes data modifications while exposing affected tuples to downstream query expressions. | PostgreSQL 18 Advanced SQL |
| **Recursive CTE** | **Rekurzivní tabulkový výraz** | A self-referential CTE evaluated iteratively using an anchor query and a recursive union term until the evaluation produces an empty set under least fixpoint semantics. | PostgreSQL 18 Queries Documentation |
| **Cycle Detection Clause (`CYCLE`)** | **Detekce cyklů v rekurzi (`CYCLE`)** | A native SQL standard clause in recursive CTEs tracking visited keys to terminate infinite recursion in cyclic graphs. | PostgreSQL 18 Queries Reference |
| **Window Function** | **Okenní funkce (window function)** | A calculation function operating across a specified set of table rows related to the current row without collapsing them into a single aggregate row. | SQL:2003 / PostgreSQL 18 Windowing |
| **Window Partition (`PARTITION BY`)** | **Rozdělení okna (partice)** | The sub-clause within `OVER()` that divides input rows into independent groups for separate window calculation passes. | PostgreSQL 18 Window Functions |
| **Window Frame Clause (`ROWS / RANGE / GROUPS`)** | **Vymezení rámce okna (window frame)** | The boundary definition within an ordered partition determining which rows relative to the current row participate in the calculation (e.g. running sum). | PostgreSQL 18 Window Functions |
| **Filtered Aggregate (`FILTER (WHERE ...)`)** | **Filtrovaná agregace** | An SQL standard clause applied to an aggregate function restricting evaluation strictly to rows satisfying a Boolean predicate without requiring `CASE` expressions. | SQL:2003 / PostgreSQL 18 Aggregates |

---

## 5. Semi-Structured Data: JSONB & Full-Text Search

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **JSONB (`Binary JSON`)** | **Binární formát JSON (JSONB)** | A parsed, decomposed binary representation of JSON data supporting indexed lookups, key uniqueness enforcement, and efficient binary slicing. | PostgreSQL 18 Data Types |
| **Containment Operator (`@>`)** | **Operátor zahrnutí (containment)** | A binary operator evaluating whether the left-hand JSONB document structural envelope completely contains the right-hand JSONB pattern. | PostgreSQL 18 JSON Reference |
| **SQL/JSON Path Expressions** | **Cestové výrazy SQL/JSON** | Standardized language syntax (`jsonb_path_query`, `jsonb_path_exists`) evaluating JSON queries using projection filters and JSONPath predicates. | SQL:2016 Part 14 / PostgreSQL 18 |
| **Text Search Vector (`tsvector`)** | **Vektor textového vyhledávání** | A sorted collection of normalized lexemes representing an input document, omitting stop words and containing positional word offsets. | PostgreSQL 18 Full-Text Search |
| **Text Search Query (`tsquery`)** | **Dotaz textového vyhledávání** | A Boolean condition tree of normalized lexemes connected via `&` (AND), `\|` (OR), `!` (NOT), and `<->` (PHRASE) operators. | PostgreSQL 18 Full-Text Search |
| **Lexeme** | **Lexém (kořen slova)** | A canonical, stemmed representation of a word produced by a dictionary analyzer for uniform indexing and search matching. | PostgreSQL 18 Full-Text Search |
| **Cover Density Ranking (`ts_rank_cd`)** | **Hodnocení podle hustoty pokrytí** | A full-text ranking metric prioritizing documents where search query lexemes appear within close proximity to one another. | PostgreSQL 18 Full-Text Search |
| **Stopwords** | **Stop-slova (nevýznamová slova)** | Common high-frequency words (such as "the", "and", "in") stripped out during text normalization to conserve index space and eliminate low-signal matches. | PostgreSQL 18 Full-Text Search |

---

## 6. Indexing In-Depth: B-Tree, GIN, GiST, BRIN & Skip Scans

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Lehman-Yao B-link Tree** | **B-strom dle Lehman-Yao** | High-concurrency B-tree variant with right-sibling links, permitting concurrent searches without locking during page splits. | ACM TODS 1981 / PostgreSQL B-Tree |
| **B-Tree Skip Scan** | **Přeskakovací průchod B-stromem (skip scan)** | A PostgreSQL 18 index scan capability allowing multicolumn composite B-tree indexes to satisfy queries that omit the leading column by hopping over prefix distinct values. | PostgreSQL 18 Release Highlights |
| **Generalized Inverted Index (GIN)** | **Zobecněný invertovaný index (GIN)** | An index structure mapping individual composite elements (JSONB keys/values, array elements, text lexemes) to lists of matching heap tuples. | PostgreSQL 18 Index Types |
| **`jsonb_path_ops` GIN Opclass** | **Optimalizovaná třída operátorů `jsonb_path_ops`** | A compact GIN operator class that hashes complete key-value paths into 32-bit values, dramatically reducing index footprint for `@>` queries. | PostgreSQL 18 Indexing Internals |
| **Generalized Search Tree (GiST)** | **Zobecněný vyhledávací strom (GiST)** | A balanced tree index supporting arbitrary geometric, range, and hierarchical indexing rules through user-defined operator classes. | PostgreSQL 18 Index Types |
| **Block Range Index (BRIN)** | **Rozsahový blokový index (BRIN)** | A lightweight index storing summary minimum and maximum values for physical ranges of adjacent pages, ideal for naturally ordered append-only tables. | PostgreSQL 18 Index Types |
| **Partial Index** | **Částečný index (partial index)** | An index built over a filtered subset of a table specified by a `WHERE` predicate, dramatically reducing index size and maintenance cost. | PostgreSQL 18 Indexes Reference |
| **Covering Index (`INCLUDE`)** | **Pokrývající index (`INCLUDE`)** | An index that includes non-key payload columns into the leaf pages to facilitate index-only scans without adding overhead to the tree navigation hierarchy. | PostgreSQL 18 Indexes Reference |
| **Page Fillfactor (`fillfactor`)** | **Faktor naplnění stránky (`fillfactor`)** | A storage parameter (10–100%) defining how much space to leave empty in newly created index or table pages to accommodate local updates without page splits. | PostgreSQL 18 Storage Parameters |

---

## 7. Query Planning, Cost Model & Performance Tuning

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Cost-Based Optimizer (CBO)** | **Nákladový optimalizátor dotazů** | The engine subsystem estimating total I/O and CPU cost for alternative query execution paths and selecting the cheapest execution plan. | PostgreSQL 18 Planner Internals |
| **Selinger Cost Model** | **Selingerův nákladový model** | The dynamic programming cost evaluation framework estimating plan costs through page fetches and CPU cycle weights. | IBM System R / ACM SIGMOD 1979 |
| **Sequential Scan (`Seq Scan`)** | **Sekvenční průchod tabulkou** | An execution plan node that reads every data block of a relation sequentially from disk or cache. | PostgreSQL 18 Planner Nodes |
| **Index Only Scan** | **Průchod pouze přes index** | An optimal execution scan where all required projection and filter attributes are satisfied directly from index tuples, consulting the Visibility Map to bypass heap page reads. | PostgreSQL 18 Performance Guide |
| **Bitmap Index Scan / Bitmap Heap Scan** | **Bitmapový průchod indexem a haldou** | A two-phase scan where an index produces an in-memory page bitmap of matching tuples, followed by physical sequential reading of targeted heap blocks. | PostgreSQL 18 Query Execution |
| **Nested Loop Join** | **Vnořené cykly (nested loop join)** | A join execution node that iterates through rows of the outer relation and executes a lookup in the inner relation for each matching candidate. | PostgreSQL 18 Join Nodes |
| **Hash Join** | **Hašovací spojení (hash join)** | A join execution node that builds an in-memory hash table over the smaller inner relation and probes it sequentially with rows from the outer relation. | PostgreSQL 18 Join Nodes |
| **Merge Join** | **Slévací spojení (merge join)** | A join execution node that scans two pre-sorted relations simultaneously in step, merging matching keys with linear complexity. | PostgreSQL 18 Join Nodes |
| **Extended Statistics (`CREATE STATISTICS`)** | **Rozšířená statistika** | Custom statistics objects capturing multivariate dependencies, distinct counts, or frequent value combinations across multiple columns for accurate planner estimates. | PostgreSQL 18 Performance Tuning |
| **JIT Compilation (`jit`)** | **Kompilace za běhu (JIT)** | Just-In-Time compilation of complex SQL expressions and tuple deforming using LLVM, providing CPU acceleration for long-running analytics queries. | PostgreSQL 18 JIT Documentation |

---

## 8. Concurrency Control, MVCC & Transaction Isolation

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Multi-Version Concurrency Control (MVCC)** | **Víceverzně řízené souběžné zpracování (MVCC)** | The concurrency model where data modifications create new row versions instead of overwriting existing blocks, ensuring readers do not block writers and writers do not block readers. | Database Systems Architecture |
| **Heap-Only Tuples (HOT)** | **Úpravy pouze v haldě (HOT)** | An optimization where an updated tuple is placed on the same 8KB page without modifying secondary indexes, linking rows via an intra-page chain. | PostgreSQL 18 Storage Engine |
| **Hint Bits** | **Nápovědné bity viditelnosti (hint bits)** | Status bits written to `t_infomask` by reader queries confirming whether `t_xmin` or `t_xmax` committed, avoiding subsequent CLOG lookups. | PostgreSQL 18 Internal Layout |
| **Transaction ID (`xid`, `xmin`, `xmax`)** | **Identifikátor transakce** | A 32-bit (or 64-bit epoch) identifier assigned to modifying transactions; `t_xmin` denotes creation transaction, while `t_xmax` denotes updating/deleting transaction. | PostgreSQL 18 Internal Layout |
| **Read Committed Isolation** | **Úroveň izolace Read Committed** | The default isolation level where a query sees only data committed before the individual statement began execution, re-reading rows on concurrent updates. | ANSI SQL / PostgreSQL 18 Isolation |
| **Repeatable Read Isolation** | **Úroveň izolace Repeatable Read** | An isolation level where all statements within a transaction observe the snapshot taken at the beginning of the transaction, aborting on concurrent modification conflicts. | ANSI SQL / PostgreSQL 18 Isolation |
| **Serializable Snapshot Isolation (SSI)** | **Sériovatelná izolace přes snímky (SSI)** | The strictest isolation level that guarantees execution equivalent to a purely serial transaction order by tracking rw-antidependencies without blocking concurrent reads. | PostgreSQL 18 Concurrency Control |
| **Write Skew Anomaly** | **Anomálie souběžného zápisu (write skew)** | A concurrency anomaly occurring when concurrent transactions read overlapping datasets, satisfy individual constraints, but perform disjoint writes violating global consistency. | Distributed Systems & Concurrency Theory |
| **Row-Level Lock (`FOR UPDATE / SHARE`)** | **Řádkový zámek** | An explicit lock acquired on selected heap tuples to control concurrent update ordering without locking the entire relational table. | PostgreSQL 18 Explicit Locking |
| **Skip Locked (`SKIP LOCKED`)** | **Přeskakování uzamčených řádků** | A locking modifier in `SELECT ... FOR UPDATE` that skips currently locked tuples, enabling ultra-fast, contention-free transactional queues. | PostgreSQL 18 SQL Concurrency |
| **Advisory Lock** | **Doporučující (aplikační) zámek** | An explicit application-managed lock primitive identified by a 64-bit key, evaluated in memory without altering table contents. | PostgreSQL 18 Locking Guide |
| **Head-of-Line Lock Blocking** | **Blokování v čele fronty zámků** | A pathological lock queue pileup where a pending exclusive lock request blocks subsequent shared lock requests, causing cascading connection pool starvation. | PostgreSQL 18 Concurrency Pitfalls |

---

## 9. Vacuuming, Freezing, Bloat & Statistics Maintenance

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Autovacuum Daemon** | **Automatický čistící proces (autovacuum)** | The background automation subsystem monitoring table write activities, executing vacuuming to reclaim dead tuple storage and updating catalog statistics. | PostgreSQL 18 Routine Maintenance |
| **Transaction ID (XID) Wraparound** | **Přetečení čítače transakčních ID (wraparound)** | The exhaustion of the 32-bit transaction ID horizon ($2^{31}$), requiring freezing of past tuples to prevent catastrophic silent data loss. | PostgreSQL 18 Routine Maintenance |
| **Tuple Freezing (`FrozenTransactionId`)** | **Zmrazení starých záznamů (freezing)** | Replacing old `t_xmin` values with the special identifier 2 (`FrozenTransactionId`), marking tuples as permanently committed in the past to all transactions. | PostgreSQL 18 Storage Engine |
| **Table & Index Bloat** | **Nafouknutí tabulky a indexu (bloat)** | Physical disk space consumed by dead tuples that have not yet been reclaimed or reused, leading to inflated I/O costs and degraded cache hit rates. | PostgreSQL 18 Administration |
| **Fast Ingest (`COPY`)** | **Rychlý hromadný import (`COPY`)** | The high-throughput command streaming binary or delimited text directly into table storage while bypassing individual SQL parsing overhead. | PostgreSQL 18 Data Ingestion |
| **In-Place Upgrade (`pg_upgrade`)** | **Přímý upgrade databáze (`pg_upgrade`)** | A utility performing major version cluster migrations in seconds using hard links, enhanced in PostgreSQL 18 to preserve optimizer statistics across upgrades. | PostgreSQL 18 Migration & Upgrades |
| **Online Table Reorganization (`REPACK CONCURRENTLY`)** | **Online reorganizace tabulky** | A zero-downtime table and index defragmentation capability replacing bloat with compacted layout without holding long exclusive table locks. | PostgreSQL 18/19 Roadmap & `pg_repack` |

---

## 10. Server Programming, Extensibility & Security

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **PL/pgSQL Procedural Language** | **Procedurální jazyk PL/pgSQL** | The native procedural language in PostgreSQL providing control flow constructs, exception handling, and seamless SQL execution within the engine. | PostgreSQL 18 Server Programming |
| **Execution Plan Caching** | **Cachování plánů dotazů** | The PL/pgSQL mechanism where statements are parsed once and cached, switching from generic plans to custom plans based on parameter selectivity. | PostgreSQL 18 PL/pgSQL Internals |
| **Stored Procedure** | **Uložená procedura** | A server routine invoked via `CALL` that possesses transaction control capabilities, allowing programmatic `COMMIT` and `ROLLBACK` within the routine body. | PostgreSQL 18 Server Programming |
| **Trigger (`BEFORE / AFTER / INSTEAD OF`)** | **Databázový spouštěč (trigger)** | An event-driven routine executed automatically before or after row modifications (`INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`) or over views. | PostgreSQL 18 Triggers Guide |
| **Row-Level Security (RLS)** | **Řádková bezpečnost (RLS)** | Fine-grained access control policies (`CREATE POLICY`) evaluating security predicates dynamically to restrict which rows a specific database role can view or modify. | PostgreSQL 18 Security Guide |
| **`SECURITY DEFINER` Execution Context** | **Spuštění s oprávněním tvůrce (`SECURITY DEFINER`)** | A function attribute executing routine logic with the privileges of the user that owns the function, requiring strict `search_path` lockdown to prevent escalation. | PostgreSQL 18 Security Guide |
| **Role-Based Access Control (RBAC)** | **Řízení přístupu na základě rolí (RBAC)** | A security authorization architecture where permissions are granted to abstract database roles and subsequently inherited by login users. | PostgreSQL 18 User Administration |
| **Asynchronous Notification (`LISTEN / NOTIFY`)** | **Asynchronní notifikace (`LISTEN / NOTIFY`)** | An inter-process pub/sub event system allowing PostgreSQL backends to broadcast event signals and string payloads to listening client connections. | PostgreSQL 18 Event System |

---

## 11. Declarative Partitioning, Connection Architecture & Pooling

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Declarative Partitioning** | **Deklarativní particionování** | Splitting a large table into distinct physical child tables based on Range, List, or Hash boundaries while exposing a single logical table interface. | PostgreSQL 18 Partitioning Guide |
| **Partition Pruning** | **Ořezávání particí (partition pruning)** | An optimization where the query planner or execution engine eliminates non-matching partition tables from execution scans based on query WHERE clauses. | PostgreSQL 18 Planner Optimization |
| **Run-Time Partition Pruning** | **Běhové ořezávání particí** | Pruning child partitions during query execution when comparison parameters or subquery results become known only at runtime. | PostgreSQL 18 Performance Guide |
| **Cross-Partition Foreign Key** | **Meziparticový cizí klíč** | A referential integrity constraint referencing a declarative partitioned parent table, validated across all underlying child partitions. | PostgreSQL 18 Partitioning |
| **Connection Pooling** | **Sdružování klientských spojení (pooling)** | An intermediate proxy architecture (e.g., PgBouncer) multiplexing thousands of client connections over a compact pool of server backend processes. | PostgreSQL 18 Scaling Architecture |
| **Transaction Pooling Mode** | **Režim transakčního poolování** | A pooling strategy where a server connection is borrowed from the pool only for the duration of a transaction, releasing it immediately upon commit/rollback. | PgBouncer Architecture & Documentation |
| **Client-Side Pipeline Mode** | **Klientské zřetězení dotazů (pipelining)** | A client driver capability (libpq pipeline mode) streaming multiple SQL queries concurrently without waiting for previous statement responses, mitigating network RTT overhead. | PostgreSQL 18 Client Interfaces |
| **Threadpool / Process Exhaustion** | **Vyčerpání systémových procesů a paměti** | The severe performance degradation and OS memory paging caused by spawning excessive concurrent PostgreSQL backend processes without connection pooling. | PostgreSQL 18 Operations Guide |

---

## 12. Durability, Write-Ahead Logging & Point-In-Time Recovery

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **ARIES Recovery Protocol** | **Algoritmus obnovy ARIES** | The canonical recovery algorithm comprising Analysis, Redo (repeating history), and Undo phases ensuring transactional durability and consistency. | C. Mohan / IBM Research 1992 |
| **Logical Backup (`pg_dump / pg_restore`)** | **Logická záloha (`pg_dump`)** | An extracted database snapshot containing SQL DDL statements and data copies that can be restored across heterogeneous architectures and versions. | PostgreSQL 18 Backup Guide |
| **Base Backup (`pg_basebackup`)** | **Fyzická základní záloha** | A binary copy of the entire physical database cluster directory and associated tablespaces taken while the primary server is running. | PostgreSQL 18 Continuous Archiving |
| **WAL Archiving** | **Archivace žurnálových segmentů WAL** | The practice of copying completed 16MB WAL segment files to an external persistent storage location via `archive_command` or `archive_library`. | PostgreSQL 18 Disaster Recovery |
| **Point-In-Time Recovery (PITR)** | **Obnova k určitému časovému bodu (PITR)** | The recovery process of restoring a physical base backup and continuously replaying archived WAL logs up to an exact timestamp, transaction ID, or restore point. | PostgreSQL 18 Reliability Guide |
| **Restore Point (`pg_create_restore_point`)** | **Pojmenovaný bod obnovy** | A named marker inserted into the Write-Ahead Log stream to serve as an exact recovery target during emergency rollback operations. | PostgreSQL 18 Disaster Recovery |
| **Target LSN Recovery (`recovery_target_lsn`)** | **Cílové zotavení podle LSN** | Directing PostgreSQL recovery to stop execution precisely before or at a specified Log Sequence Number in the WAL stream. | PostgreSQL 18 Recovery Configuration |
| **Torn Page Protection** | **Ochrana proti natrženým stránkám** | The safety mechanism of writing Full Page Images (FPI) to the WAL stream on first modification after checkpoint to recover from interrupted 8KB OS writes. | PostgreSQL 18 Reliability Guide |

---

## 13. High Availability, Replication & Modern Extensions

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Physical Streaming Replication** | **Proudové fyzické replikování** | The physical replication protocol where the primary server continuously streams Write-Ahead Log records across a network socket to standby instances. | PostgreSQL 18 High Availability |
| **Synchronous Standby (`synchronous_commit`)** | **Synchronní replika** | A standby server requiring confirmation of WAL write, flush, or apply before the primary marks the originating client transaction as committed. | PostgreSQL 18 Replication Guide |
| **Replication Slot** | **Replikační slot** | An automated server marker ensuring the primary node retains Write-Ahead Log segments until all connected standbys or subscribers have received them. | PostgreSQL 18 Streaming Replication |
| **Synchronized Failover Slots (`sync_replication_slots`)** | **Synchronizované failover sloty** | A PostgreSQL 17/18 feature ensuring physical standby nodes synchronize logical replication slots, allowing downstream subscribers to resume uninterrupted after primary failover. | PostgreSQL 17/18 Replication Guide |
| **Logical Replication** | **Logická replikace** | A publish-subscribe replication architecture transmitting individual row data mutations based on a logical decoding stream, permitting cross-version data replication. | PostgreSQL 18 Logical Replication |
| **Patroni Clustering** | **Orchestrace clusteru Patroni** | An enterprise high-availability template utilizing a Distributed Consensus Store (DCS, e.g., etcd or Consul) for automated leader election and failover. | Patroni HA Architecture |
| **Split-Brain Prevention & Fencing** | **Prevence rozpadu clusteru (split-brain) a izolace (fencing)** | The architectural guarantee (via DCS quorum and node fencing/stonith) that only a single primary node can accept write transactions during network partitions. | Distributed Systems HA Architecture |
| **Hierarchical Navigable Small World (HNSW)** | **Hierarchický malý svět (HNSW graf)** | A multi-layer skip-graph vector index algorithm providing sub-millisecond approximate nearest neighbor searches with high recall for high-dimensional AI embeddings. | Malkov & Yashunin (2018) / pgvector |
| **Inverted File Index (IVFFlat)** | **Invertovaný souborový index (IVFFlat)** | An approximate nearest neighbor index partitioning vector space into Voronoi cells via k-means clustering, trading recall for faster build times and smaller footprint. | pgvector Specification |
| **Vector Similarity Search (`pgvector`)** | **Vektorové vyhledávání podobnosti (`pgvector`)** | An open-source extension enabling dense vector embeddings storage and approximate nearest neighbor (ANN) indexing via HNSW and IVFFlat for AI workloads. | pgvector Specification & Architecture |
| **Standby LSN Synchronization (`WAIT FOR LSN`)** | **Synchronizace čtení repliky (`WAIT FOR LSN`)** | A PostgreSQL 19 capability allowing client applications to pause read execution on a standby until the standby has replayed the WAL up to a specified primary LSN (read-your-writes). | PostgreSQL 19 Roadmap & Performance |
