# Data Systems Architecture Fast-Lookup Cheatsheet

A high-density reference sheet for foundational storage engine design, database internals, transaction isolation models, replication consistency, and distributed partitioning algorithms.

---

## 1. Relational Algebra & Normal Form Matrix

### Algebraic Primitives

| Operation | Symbol | Algebraic Definition | SQL Equivalent |
| :-- | :-: | :-- | :-- |
| **Selection** | $\sigma_\phi(R)$ | $\{t \in R \mid \phi(t)\}$ | `SELECT * FROM R WHERE phi` |
| **Projection** | $\pi_{A_1,\dots,A_k}(R)$ | $\{t[A_1,\dots,A_k] \mid t \in R\}$ (set distinct) | `SELECT DISTINCT A1, ... FROM R` |
| **Cartesian Product** | $R \times S$ | $\{(r, s) \mid r \in R \land s \in S\}$ | `SELECT * FROM R CROSS JOIN S` |
| **Union** | $R \cup S$ | $\{t \mid t \in R \lor t \in S\}$ | `SELECT * FROM R UNION SELECT * FROM S` |
| **Difference** | $R - S$ | $\{t \mid t \in R \land t \notin S\}$ | `SELECT * FROM R EXCEPT SELECT * FROM S` |
| **Theta Join** | $R \bowtie_\theta S$ | $\sigma_\theta(R \times S)$ | `SELECT * FROM R JOIN S ON theta` |

### Normal Form Verification Checklist

```
1NF: All attribute values atomic (no arrays/nested records, scalar domains only).
 └── 2NF: 1NF + No partial dependencies (every non-prime attribute depends on full candidate key).
      └── 3NF: 2NF + No transitive dependencies (for X -> A: X is superkey OR A is prime).
           └── BCNF: For every non-trivial FD (X -> A), determinant X MUST be a candidate/superkey.
                └── 4NF: BCNF + No non-trivial multivalued dependencies (X ->> Y implies X is superkey).
                     └── 5NF: 4NF + Every join dependency is implied by candidate keys (lossless project-join).
```

---

## 2. Storage Engines: Slotted Pages, B+Trees & LSM-Trees

### Slotted Page Structure & Compaction

```
+------------------------------------------------------------------------------------+
| Page Header | Slot 0 | Slot 1 | Slot 2 | ... | Free Space | Tuple 2 | Tuple 1 | Tuple 0 |
| (LSN, pins) | (off,len)                          | (bytes)    | (bytes) | (bytes) | (bytes) |
+------------------------------------------------------------------------------------+
0             ^--- Slot Array grows DOWN --->      <--- Tuple bytes grow UP ---^     PageSize (8KB)
```

- **Tuple ID (RID)**: `(PageNumber: 32-bit, SlotIndex: 16-bit)` indirection pointer.
- **Compaction**: Retains slot indices; shifts remaining tuple bytes contiguous to high memory; updates `free_space_offset`.

### B+Tree Node Capacity & Split Rules

- **Order $M$**: Maximum child pointers per internal node.
- **Node Keys**: Internal node holds $M-1$ keys and $M$ pointers. Leaf node holds up to $L$ data tuples.
- **Leaf Split**: When keys $= L+1$, split into:
  - Left Leaf: $\lceil L/2 \rceil$ keys.
  - Right Leaf: $\lfloor L/2 \rfloor + 1$ keys.
  - **Copy** first key of right leaf up to parent internal node (key is preserved in leaf).
- **Internal Split**: When keys $= M$, split into left $(\lceil M/2 \rceil - 1)$ and right $(\lfloor M/2 \rfloor)$.
  - **Push** (move) median key up to parent (key is removed from internal node).

### LSM-Tree Write & Read Amplification

| Metric | Size-Tiered Compaction (STCS) | Leveled Compaction (LCS, $T=10$) | B+Tree (Random Writes) |
| :-- | :-: | :-: | :-: |
| **Write Amplification ($WA$)** | Low: $O(\log_T N)$ ($\sim 2 - 8$) | High: $O(T \cdot \log_T N)$ ($\sim 10 - 30$) | Very High: $O(\text{PageSize} / \text{RowSize})$ ($\sim 30 - 100$) |
| **Read Amplification ($RA$)** | High: Checks all runs per tier | Low: 1 SSTable per level ($\le L$) | Lowest: Exactly $h = \log_B N$ seeks ($\sim 3 - 4$) |
| **Space Amplification ($SA$)** | High: Up to $100\%$ extra capacity | Low: Typically $\sim 10\% - 20\%$ | Moderate: 33% empty space (67% page fill) |

### The RUM Trade-Off Triangle

$$\text{Read Overhead} + \text{Update Overhead} + \text{Memory/Storage Overhead} \ge \text{Constant}$$

- **B+Tree**: Minimizes Read; accepts higher Update and Memory overhead.
- **LSM-Tree**: Minimizes Update; accepts higher Read and temporary Space overhead.
- **Fractal Tree / Inverted Index**: Minimizes Read & Update; consumes high Memory overhead.

---

## 3. Indexing & Vector Search Quick Reference

### Okapi BM25 Lexical Ranking

$$\text{Score}(D, Q) = \sum_{i=1}^{n} \text{IDF}(q_i) \cdot \frac{f(q_i, D) \cdot (k_1 + 1)}{f(q_i, D) + k_1 \cdot \left(1 - b + b \cdot \frac{|D|}{\text{avgdl}}\right)}$$

- $k_1 \in [1.2, 2.0]$: Term frequency saturation (higher = more sensitive to repeated terms).
- $b \in [0.75]$: Document length penalty ($b=1 \implies$ full length penalty; $b=0 \implies$ no length normalization).

### Vector Search: Index Types & Quantization

| Index / Quantizer | Search Complexity | Memory Footprint | Recall @ 10 | Primary Seam |
| :-- | :-: | :-: | :-: | :-- |
| **Flat (Brute-Force)** | $O(N \cdot d)$ | $100\%$ (Raw float32) | $1.00$ ($100\%$) | Small datasets ($N < 50{,}000$) |
| **IVF (Inverted File)** | $O(n_{\text{probe}} \cdot \frac{N}{K} \cdot d)$ | $100\%$ | $0.80 - 0.95$ | Medium datasets, fast build |
| **HNSW (Hierarchical Graph)** | $O(\log N \cdot d)$ | $120\% - 150\%$ (Graph edges) | $0.95 - 0.99$ | Low latency, high memory budget |
| **SQ8 (Scalar Quantization)** | Same as base index | $25\%$ ($4\times$ reduction) | $0.93 - 0.98$ | Uniform dimension scales |
| **PQ (Product Quantization)** | Symmetric distance table | $6.25\% - 12.5\%$ ($8 - 16\times$) | $0.85 - 0.92$ | Ultra-large scale (billions) |

---

## 4. Buffer Management & OS I/O Mechanics

### Page Replacement State Machines

- **CLOCK**: Frame has usage bit $u \in \{0, 1\}$.
  - On Page Hit: Set $u \leftarrow 1$ (atomic bitwise OR, no mutex lock).
  - On Page Fault: Hand sweeps circularly. If $u=1 \rightarrow u \leftarrow 0$, advance hand; If $u=0 \rightarrow$ victim found, evict.
- **2Q Policy**:
  - $A1\text{in}$ (FIFO): New pages admitted on first access (probation).
  - $A1\text{out}$ (Ghost FIFO): Metadata of evicted $A1\text{in}$ pages to remember recently seen keys.
  - $Am$ (LRU): Promoted only if hit occurs while in $A1\text{out}$ (prevents sequential scan pollution).

### Operating System I/O Modes

| Feature | Standard OS Page Cache (`read`/`write`) | Direct I/O (`O_DIRECT`) | Memory-Mapped (`mmap`) |
| :-- | :-- | :-- | :-- |
| **Buffering** | Double buffering (Kernel cache + DB pool) | Single buffer (DB buffer pool only) | OS Page cache only |
| **WAL Invariant** | Kernel writeback may flush before WAL sync | Explicit, deterministic `fsync()` order | **Breaks invariant** (kernel evicts dirty pages) |
| **Eviction Policy** | OS heuristic (Kernel LRU/inactive list) | Database-controlled (2Q, CLOCK, LIRS) | OS heuristic |
| **I/O Engine** | Synchronous or POSIX AIO threadpool | `io_uring` batched submission queue | Synchronous page fault traps (SIGBUS) |

---

## 5. Transactions, ACID & Isolation Anomaly Hierarchy

### Formal Anomaly Taxonomy (Berenson 1995 / Adya 1999)

| Code | Anomaly Name | Conflict Pattern | Prevented By |
| :-- | :-- | :-- | :-- |
| **$G0$** | Dirty Write | $w_1[x] \dots w_2[x] \dots (c_1 \lor a_1)$ | Read Uncommitted |
| **$A1$** | Dirty Read | $w_1[x] \dots r_2[x] \dots (a_1 \text{ or } c_1)$ | Read Committed |
| **$P4$ / $G\text{-upd}$** | Lost Update | $r_1[x] \dots r_2[x] \dots w_1[x] \dots w_2[x] \dots c_1$ | Snapshot Isolation |
| **$A2$** | Fuzzy / Non-Repeatable Read | $r_1[x] \dots w_2[x] \dots c_2 \dots r_1[x]$ | Snapshot Isolation / Repeatable Read |
| **$A3$** | Phantom Read | $r_1[P] \dots w_2[y \in P] \dots c_2 \dots r_1[P]$ | Predicate Locking / SSI |
| **$G\text{-skew}$** | Write Skew | $(r_1[x], r_1[y]) \dots (r_2[x], r_2[y]) \dots w_1[x] \dots w_2[y] \dots c_1 \dots c_2$ | Serializable / SSI |
| **$G\text{-read}$** | Read Skew | $r_1[x] \dots w_2[x] \dots w_2[y] \dots c_2 \dots r_1[y]$ | Snapshot Isolation |

### MVCC Snapshot Visibility Invariants

$$ \text{Visible}(T_{\text{snapshot}}, \text{row}) \iff \begin{cases}
\text{row.xmin} \in \text{Committed} \land \text{row.xmin} < T_{\text{snapshot.id}} \land \text{row.xmin} \notin \text{ActiveTxns} \\
\land \; (\text{row.xmax} = 0 \lor \text{row.xmax} > T_{\text{snapshot.id}} \lor \text{row.xmax} \in \text{ActiveTxns} \lor \text{row.xmax} \in \text{Aborted})
\end{cases}$$

---

## 6. Durability, WAL & ARIES Recovery

### Buffer Policy Invariants
- **Steal**: Uncommitted pages flushed to disk $\implies$ **Requires UNDO logging**.
- **No-Force**: Committed transactions not forced to disk pages $\implies$ **Requires REDO logging**.
- **WAL Flush Invariant**:
  $$\text{PageLSN} \le \text{FlushedToDiskLSN}$$

### ARIES 3-Pass Recovery Algorithm
```
           Checkpoint
                |
Log Stream: ----C-------[Smallest recLSN in DPT]--------CRASH
                        |                                 |
1. Analysis:            +-------------------------------->+  Scan forward from Checkpoint. Identify Losers & DPT.
2. Redo:                +-------------------------------->+  Scan forward from min(recLSN). Repeat History.
3. Undo:                <---------------------------------+  Scan backward. Roll back Losers. Write CLRs.
```
- **Compensation Log Record (CLR)**: `[LSN, TxnId, Type=CLR, UndoNextLSN=PrevLSN, Action]` *Infallible idempotency: Recovery never undos a CLR.*

---

## 7. Distributed Replication & Quorum Rules

### Quorum Intersection Inequality
$$W + R > N$$
- $N$: Replication factor (total replicas).
- $W$: Write quorum acknowledgment threshold.
- $R$: Read quorum response threshold.
- **Pigeonhole Proof**: If $W + R = N + 1$, the write set and read set must intersect on at least 1 node:
  $$|W \cap R| = W + R - N \ge 1$$

### Distributed Locking & Fencing Tokens
```
Client 1: [Acquire Lock] ------------> (Lease: Token=31) ----[GC Pause 60s]----> [Write Storage (Token=31)] -> REJECT!
Client 2:               [Acquire Lock] -----------------> (Lease: Token=32) ---> [Write Storage (Token=32)] -> ACCEPT (32 > 31)
```

---

## 8. Partitioning & Consistent Hashing

### Consistent Hash Ring Equations
- Key position: $H(k) = \text{Hash}(k) \pmod{2^{32}}$
- Node assignment: First node on ring where $H(\text{Node}) \ge H(k)$ (wrap-around to 0).
- **Migration Fraction**: When adding $(N+1)$-th node with uniform vnodes:
  $$\Delta_{\text{migrated}} = \frac{1}{N + 1}$$
- Standard Vnode Count: $V \in [128, 256]$ vnodes per physical node reduces standard deviation $\sigma < 5\%$.

### Scatter-Gather Tail Latency
$$P(\text{Query Latency} > T) = 1 - (1 - p)^S$$
- $S$: Shard fan-out count.
- $p$: Probability of individual shard latency spike.
- *Example*: For $S = 100$ shards and $p = 1\%$, query spike probability $= 1 - (0.99)^{100} = 63.4\%$.

---

## 9. Caching Patterns & Stampede Mitigation

### Cache-Aside Safe Invalidation Sequence
1. Application begins database transaction.
2. Application updates persistent database record.
3. Database commits transaction durably.
4. Application executes: `Cache.delete(key)` *(Invalidation avoids race conditions of write-to-cache)*.

### Probabilistic Early Expiration (The XFetch Algorithm)
$$-\beta \cdot \delta \cdot \ln(\text{rand}()) > \text{TTL}_{\text{remaining}}$$
- $\delta$: Time taken to compute the value from the database (in seconds/ms).
- $\beta > 0$: Aggressiveness parameter (default $\beta = 1.0$).
- $\text{rand}() \sim U(0, 1)$: Uniform random variable.
- $\text{TTL}_{\text{remaining}} = \text{ExpiresAt} - \text{Now}$.

---

## 10. Binary Wire Serialization & Encoding

### Varint (7-Bit Payload) Bitwise Masks
```
Byte format: [ Continuation Bit (1=more, 0=last) | 7 bits of data ]
Encoding 300 (0x012C):
  Binary: 00000001 00101100
  Low 7 bits:  0101100 (0x2C) -> Set continuation bit -> 10101100 (0xAC)
  High 7 bits: 0000010 (0x02) -> Last byte           -> 00000010 (0x02)
  Wire Bytes:  [0xAC, 0x02]
```

### ZigZag Signed Encoding Formula
$$\text{ZigZag}(n) = \begin{cases}
(n \ll 1) \oplus (n \gg 31) & \text{for 32-bit signed integer} \\
(n \ll 1) \oplus (n \gg 63) & \text{for 64-bit signed integer}
\end{cases}$$
- Maps: $0 \rightarrow 0, -1 \rightarrow 1, 1 \rightarrow 2, -2 \rightarrow 3, 2 \rightarrow 4$.

### Schema Evolution Rules
| Evolution Mode | New Reader Reads Old Data? | Old Reader Reads New Data? | Permitted Schema Modifications |
| :--- | :---: | :---: | :--- |
| **Backward** | ✅ Yes | ❌ No | Add optional fields; delete optional fields |
| **Forward** | ❌ No | ✅ Yes | Delete optional fields; add optional fields with defaults |
| **Full** | ✅ Yes | ✅ Yes | Add or delete fields **ONLY if they have default values** |

---

## 11. Stream-Table Duality & Log Compaction

### Formal Mathematical Relationship
$$\text{Table}(t) = \int_0^t \text{Stream}(\tau) \, d\tau \quad \Longleftrightarrow \quad \text{Stream} = \frac{d}{dt}\big(\text{Table}\big)$$
- **Log Compaction Invariant**: Retain latest event offset per key:
  $$\text{CompactedLog}(K) = \{e \in \text{Log} \mid e.\text{offset} = \max(\text{offsets}(e.\text{key}))\}$$
- **Tombstone**: Record with `value = null`. Retained for `delete.retention.ms` before garbage collection.

---

## 12. Workload Classification & Distributed Theorems

### PACELC Theorem Classification
$$\text{If Partition }(P) \implies \text{Choose } [A \text{ vs } C] \quad \mathbf{ELSE} \; (E) \implies \text{Choose } [L \text{ vs } C]$$
| System | PACELC Classification | Behavior Under Partition ($P$) | Normal Operation Behavior ($E$) |
| :--- | :---: | :--- | :--- |
| **Google Cloud Spanner** | **PC/EC** | Rejects non-quorum writes; preserves consistency | Synchronous Paxos consensus; pays latency cost |
| **Apache Cassandra** | **PA/EL** | Accepts writes to available nodes; returns stale data | Reads/writes local node with lowest latency |
| **Amazon DynamoDB** (default) | **PA/EL** | High availability, eventual consistency | Ultra-low read latency (eventual consistency) |
| **MongoDB** (w:majority) | **PC/EC** | Blocks writes if primary isolated | Synchronous majority replica acknowledgment |

### Storage Engine Workload Alignment
```
                 ┌──────────────────────────────────────────────────────────┐
                 │                Workload Architecture                     │
                 └────────────────────────────┬─────────────────────────────┘
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      ▼                                               ▼
          [ OLTP: Point Writes/Reads ]                    [ OLAP: Analytical Scans ]
          - Slotted-Page B+Tree or LSM                    - Columnar Storage (Parquet, ClickHouse)
          - Row-oriented layout                           - Vectorized SIMD execution
          - Strict ACID serializability                   - Dictionary / RLE compression
          - Examples: PostgreSQL, Spanner                 - Examples: Snowflake, ClickHouse, DuckDB
```

---

## 13. Database Concepts Master Quick Map

| Concept | Core Mechanics & Rules | Reference |
| :--- | :--- | :--- |
| **Primary / Foreign Key** | **PK**: minimal non-null unique row identifier (`NOT NULL + UNIQUE`, entity integrity). **FK**: column(s) referencing a parent PK/unique key (`RESTRICT`, `CASCADE`, `SET NULL`, referential integrity). | [M01](modules/01-data-models-and-query-languages.md#1-formal-foundations-relational-algebra-and-relational-calculus) |
| **Normalization (1NF–BCNF)** | **1NF** atomic scalars; **2NF** no partial key deps; **3NF** no transitive non-key deps; **BCNF** every non-trivial FD $X \to Y$ has superkey $X$. Denormalize selectively when join cost exceeds write amplification. | [M01](modules/01-data-models-and-query-languages.md#functional-dependencies-and-normal-forms-1nf-through-bcnf) |
| **Join Algorithms** | **Nested Loop**: $O(\lvert R \rvert \cdot \lvert S \rvert)$ naive, $O(\lvert R \rvert \cdot \log \lvert S \rvert)$ indexed (best for small outer + selective index). **Hash Join**: $O(\lvert R \rvert + \lvert S \rvert)$ build/probe on unsorted equi-joins (Grace spill to disk). **Sort-Merge**: $O(\lvert R \rvert \log \lvert R \rvert + \lvert S \rvert \log \lvert S \rvert)$ or $O(\lvert R \rvert + \lvert S \rvert)$ pre-sorted via B+Tree; preserves sort order. | [M01](modules/01-data-models-and-query-languages.md#3-data-model-paradigms-relational-document-graph-and-columnar) |
| **B+Tree / LSM Indexes** | **B+Tree**: balanced $O(\log_B N)$ in-place pages, lowest read amp, point + range queries. **LSM-Tree**: append-only MemTable + SSTables + compaction, lowest write amp, requires Bloom filters and compaction headroom. | [M02](modules/02-storage-engines-b-trees-and-lsm.md), [M03](modules/03-indexing-theory-and-vector-search.md) |
| **Transactions & ACID** | **A**tomicity (all-or-nothing UNDO), **C**onsistency (app + schema invariants), **I**solation (serializable or bounded concurrency), **D**urability (WAL `fsync` before commit ack). | [M05](modules/05-transactions-acid-and-isolation-levels.md#1-formal-acid-deconstruction) |
| **Isolation Levels** | Read Uncommitted (forbids $G0$) $\to$ Read Committed (forbids $A1$) $\to$ Repeatable Read / SI (forbids $P4, A2, G\text{-read}$, allows $G\text{-skew}$) $\to$ Serializable / SSI (forbids $G\text{-skew}, A3$). | [M05](modules/05-transactions-acid-and-isolation-levels.md#3-the-isolation-level-spectrum-ansi-versus-reality) |
| **MVCC** | Readers never block writers; tuple versions carry `xmin`/`xmax`; snapshot visibility filters committed versions $< T_{\text{snapshot}}$; first-committer-wins catches concurrent same-row writes. | [M05](modules/05-transactions-acid-and-isolation-levels.md#2-multi-version-concurrency-control-mvcc-and-snapshot-isolation) |
| **Deadlocks** | **Coffman conditions**: Mutual Exclusion, Hold-and-Wait, No Preemption, Circular Wait. **Wait-For Graph**: edges $T_i \to T_j$ (`T_i` waits on `T_j`); deadlock $\iff$ cycle (abort victim, PG `40P01`). **Wait-Die** (non-preemptive: older waits, younger dies) vs **Wound-Wait** (preemptive: older wounds younger, younger waits). **Canonical lock ordering**: acquire locks in deterministic sorted key order to eliminate circular wait. | [M05](modules/05-transactions-acid-and-isolation-levels.md#1-two-phase-locking-2pl-and-deadlock-management), [Proof](examples/13-caching-and-deadlocks.test.ts) |
| **Replication** | **Single-Leader** (read scaling; async lag breaks Read-Your-Writes / Monotonic Reads), **Multi-Leader** (multi-region writes; conflict resolution), **Leaderless** ($W + R > N$ quorums + Read Repair). | [M07](modules/07-replication-mechanics-and-consensus.md) |
| **Sharding** | **Range** (fast range scans, monotonic hot-spot risk) vs **Hash / Consistent Hashing** (uniform spread, $\frac{1}{N+1}$ migration with vnodes); local vs global secondary indexes. | [M08](modules/08-partitioning-sharding-and-routing.md) |
| **CAP / PACELC** | On Partition ($P$): choose **A vs C**; Else ($E$): choose **L vs C** (Spanner `PC/EC` vs Cassandra/Dynamo `PA/EL`). | [M12](modules/12-architectural-decision-matrix-and-polyglot-persistence.md#4-theoretical-boundaries-the-cap-and-pacelc-theorems), [DistSys M01](../distributed-systems/modules/01-system-models-and-impossibility.md#5-cap-theorem-formal-gilbert-lynch-statement-and-pacelc) |
| **Caching** | Cache-Aside, Read/Write-Through, Write-Behind, Write-Around, Refresh-Ahead; Single-Flight + XFetch stampede defense; CDC WAL invalidation; W-TinyLFU eviction. | [M09](modules/09-caching-theory-and-consistency.md), [Proof](examples/13-caching-and-deadlocks.test.ts) |

### SQL vs NoSQL Decision Matrix

| Dimension | Relational (SQL) | Document Store | Key-Value / Cache | Wide-Column | Graph Store | Columnar OLAP |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Data Model** | Normalized tables, strict schema | Self-contained JSON/BSON aggregates | Opaque values by primary key | Sparse row key + column families | Vertices, typed edges, properties | Column vectors, compressed blocks |
| **Joins & ACID** | Rich joins, full multi-row ACID | Single-document ACID; weak cross-doc joins | Atomic single-key ops; no joins | Partition-local writes; no joins | Index-free adjacency traversals | Batch/append-only; analytical joins |
| **Scaling Profile** | Vertical primary + read replicas (or NewSQL) | Hash/range sharding by shard key | Horizontal slots / consistent hash ring | Masterless consistent-hash ring | Vertical or partitioned subgraphs | MPP distributed scan across shards |
| **PACELC Bias** | `PC/EC` (or single-node ACID) | Configurable (`PC/EC` majority default) | `PA/EL` (async replicas) | `PA/EL` (tunable $W+R>N$) | `PC/EC` | `PC/EC` (or object-storage decoupled) |
| **Canonical Fit** | Ledgers, orders, complex relational invariants | Catalogs, user profiles, evolving schemas | Sessions, rate limits, hot read cache | High-write telemetry, time-series logs | Fraud rings, social/knowledge graphs | BI dashboards, petabyte aggregations |
| **Examples** | PostgreSQL, MySQL, Spanner | MongoDB, DynamoDB (doc), Couchbase | Redis, Valkey, Memcached | Cassandra, ScyllaDB, Bigtable | Neo4j, Amazon Neptune | ClickHouse, DuckDB, Snowflake |
