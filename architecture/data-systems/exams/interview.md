# Data Systems Architecture: Technical Interview & Examination Question Bank

This question bank contains 65 original examination and senior technical interview questions covering foundational data systems architecture, storage engine internals, distributed consistency, and concurrency control.

---

## Domain 01: Data Models, Relational Algebra & Schema Design

### Q-DATA-001 · Data Models · difficulty 1 · single
Which relational algebra operator expresses the elimination of duplicate rows and the restriction of a relation to a specific subset of its attributes?
- A) Selection ($\sigma$)
- B) Projection ($\pi$)
- C) Theta Join ($\bowtie_\theta$)
- D) Difference ($-$)
<details><summary>Answer</summary>

**B.** Projection ($\pi$) produces a relation with a specified subset of attributes from the input relation, implicitly eliminating duplicate tuples under pure relational set semantics.
- Why not A: Selection ($\sigma$) filters tuples (rows) based on a boolean predicate, retaining all attributes.
- Why not C: Theta join combines tuples from two relations satisfying a comparison condition $\theta$.
- Why not D: Set difference returns tuples in relation $R$ that do not appear in relation $S$.
- Ref: [modules/01-data-models-and-query-languages.md](../modules/01-data-models-and-query-languages.md#relational-algebra-formal-algebraic-primitives), Codd (1970)
</details>

### Q-DATA-002 · Data Models · difficulty 2 · multi
A relation $R(A, B, C, D)$ has functional dependencies $A \rightarrow B$ and $B \rightarrow C$. The primary key is $(A, D)$. Which of the following statements are correct regarding its normalization state? (Select TWO)
- A) The relation violates Second Normal Form (2NF) due to partial dependency $A \rightarrow B$.
- B) The relation satisfies 2NF because $(A, D)$ uniquely identifies every tuple.
- C) Decomposing $R$ into $R_1(A, B)$, $R_2(B, C)$, and $R_3(A, D)$ is a lossless-join, dependency-preserving BCNF decomposition.
- D) The relation satisfies Third Normal Form (3NF) because $B \rightarrow C$ is a transitive dependency through a candidate key.
<details><summary>Answer</summary>

**A and C.**
- A is correct: $A$ is a proper subset of candidate key $(A, D)$, and $B$ is non-prime. $A \rightarrow B$ is a partial dependency, violating 2NF.
- C is correct: Decomposing into $R_1(A, B)$, $R_2(B, C)$, and $R_3(A, D)$ preserves functional dependencies $A \rightarrow B$ and $B \rightarrow C$, retains candidate key $(A, D)$ in $R_3$, and leaves all sub-relations in BCNF.
- Why not B: Satisfying candidate key uniqueness does not prevent non-prime attributes from depending on a proper subset of the key.
- Why not D: Transitive dependency of non-prime attributes violates 3NF; it does not satisfy it.
- Ref: [modules/01-data-models-and-query-languages.md](../modules/01-data-models-and-query-languages.md#functional-dependencies-and-normal-forms-1nf-through-bcnf)
</details>

### Q-DATA-003 · Data Models · difficulty 2 · scenario
An e-commerce platform stores user profiles with frequently changing dynamic attributes (such as marketing preferences, nested AB-test allocations, and third-party tracking identifiers). The core checkout pipeline requires strict atomic referential integrity against account balances, but marketing analysts constantly add new attribute fields without schema migrations. How should the storage architecture be designed?
- A) Migrate all user records to a pure schemaless document store and execute checkout payments using distributed two-phase commit.
- B) Maintain a relational core for account balances and credentials with foreign keys, and embed dynamic attributes in a typed JSONB/binary column with GIN indexing.
- C) Store each dynamic attribute as an entity-attribute-value (EAV) table with a separate row per attribute and join them on every checkout read.
- D) Store all profile attributes as unindexed serialized blobs and parse them inside the application server during checkout.
<details><summary>Answer</summary>

**B.** Hybrid relational modeling (relational columns for invariant core entities requiring strict constraints, combined with semi-structured JSONB columns for polymorphic schema-on-read attributes) avoids operational migration toil while preserving ACID transaction guarantees and indexing efficiency.
- Why not A: Migrating entire user accounts to a document store degrades transactional isolation and forces fragile distributed transactions during payments.
- Why not C: EAV schemas create massive table bloat, destroy cache locality, require deep self-joins, and break query optimization.
- Why not D: Unindexed blobs force full-table scans for any analytical filtering on marketing attributes.
- Ref: [modules/01-data-models-and-query-languages.md](../modules/01-data-models-and-query-languages.md#schema-on-write-vs-schema-on-read)
</details>

### Q-DATA-004 · Data Models · difficulty 3 · scenario
Consider a relation with multivalued dependency $A \twoheadrightarrow B$. Under what exact mathematical condition does $A \twoheadrightarrow B$ satisfy Fourth Normal Form (4NF)?
- A) $B$ must be a prime attribute belonging to at least one candidate key.
- B) $A$ must be a superkey of the relation, or the multivalued dependency is trivial ($B \subseteq A$ or $A \cup B = R$).
- C) The relation must already be in 3NF and contain no transitive functional dependencies.
- D) The projection of $A$ and $B$ must be functionally independent of all remaining attributes $R \setminus (A \cup B)$.
<details><summary>Answer</summary>

**B.** A relation is in 4NF if and only if for every non-trivial multivalued dependency $A \twoheadrightarrow B$, $A$ is a superkey of the relation.
- Why not A: The concept of prime attributes applies to 3NF definitions, not 4NF multivalued dependencies.
- Why not C: 3NF is necessary but insufficient; BCNF is required before 4NF, and BCNF relations can still contain non-trivial multivalued anomalies.
- Why not D: Multivalued independence is what caused the cross-product tuple multiplication anomaly in the first place.
- Ref: [modules/01-data-models-and-query-languages.md](../modules/01-data-models-and-query-languages.md#higher-normal-forms-4nf-5nf-and-denormalization-tradeoffs)
</details>

### Q-DATA-005 · Data Models · difficulty 2 · ordering
Order the normal forms from least restrictive (weakest constraints) to most restrictive (strongest constraints):
1. Boyce-Codd Normal Form (BCNF)
2. First Normal Form (1NF)
3. Third Normal Form (3NF)
4. Second Normal Form (2NF)
5. Fourth Normal Form (4NF)
- A) 2 $\rightarrow$ 4 $\rightarrow$ 3 $\rightarrow$ 1 $\rightarrow$ 5
- B) 1 $\rightarrow$ 2 $\rightarrow$ 4 $\rightarrow$ 3 $\rightarrow$ 5
- C) 2 $\rightarrow$ 3 $\rightarrow$ 4 $\rightarrow$ 1 $\rightarrow$ 5
- D) 4 $\rightarrow$ 2 $\rightarrow$ 3 $\rightarrow$ 5 $\rightarrow$ 1
<details><summary>Answer</summary>

**A.** The containment hierarchy of relational normal forms is $1\text{NF} \subset 2\text{NF} \subset 3\text{NF} \subset \text{BCNF} \subset 4\text{NF} \subset 5\text{NF}$.
- Why not B, C, D: 1NF precedes 2NF (elimination of partial dependencies), which precedes 3NF (elimination of transitive dependencies), which precedes BCNF (every determinant is a candidate key), which precedes 4NF (elimination of multivalued dependencies).
- Ref: [modules/01-data-models-and-query-languages.md](../modules/01-data-models-and-query-languages.md#functional-dependencies-and-normal-forms-1nf-through-bcnf)
</details>

---

## Domain 02: Storage Engines: Slotted Pages, B-Trees & LSM-Trees

### Q-DATA-006 · Storage Engines · difficulty 2 · single
In a slotted page physical architecture, how does the page header organize variable-length tuple offsets to prevent external fragmentation and pointer invalidation?
- A) The page header contains an array of slot pointers growing downward from the top, while tuple data is appended upward from the bottom of the page.
- B) Tuples are packed contiguously from byte 0, and offsets are computed using a global hash index stored in operating system memory.
- C) Tuples are placed in fixed 64-byte slots, and excess bytes spill automatically into adjacent disk sectors.
- D) The page header allocates pointers growing from the bottom up, while tuple bytes are written from the start of the page sequentially.
<details><summary>Answer</summary>

**A.** Slotted page layout divides the disk block into a slot array growing forwards from the header, and tuple byte payloads growing backwards from the end of the block. Tuples can be compacted within the page without changing slot indices (Tuple IDs/RIDs).
- Why not B: Hardcoding offsets contiguously without slot indirection requires rewriting external index pointers whenever a tuple expands or deletes.
- Why not C: Variable-length attributes cannot be constrained to fixed slots without massive internal fragmentation or pointer chasing.
- Why not D: Growing tuples from the front would collide immediately with the growing slot array.
- Ref: [modules/02-storage-engines-b-trees-and-lsm.md](../modules/02-storage-engines-b-trees-and-lsm.md#page-layout-slotted-pages-and-tuple-storage), [01-slotted-page.test.ts](../examples/01-slotted-page.test.ts)
</details>

### Q-DATA-007 · Storage Engines · difficulty 2 · single
Why does the Lehman-Yao B-link tree algorithm eliminate the need for top-down read latches during index traversals and page splits?
- A) It replaces all disk pointers with atomic hardware 64-bit compare-and-swap registers.
- B) Every node includes a right-sibling pointer (`high key`), allowing concurrent readers to detect that a split occurred and follow the right link without acquiring locks on parent nodes.
- C) It guarantees that only one transaction can access the B-Tree at any point in time.
- D) It rewrites split nodes to an append-only commit log before informing the buffer pool.
<details><summary>Answer</summary>

**B.** Lehman-Yao introduces a right-sibling pointer and a high-key value on each node. If a concurrent reader searches for key $k$ and finds $k > \text{high-key}$, it knows the node split concurrently and simply navigates to the right sibling without deadlock or parent-locking.
- Why not A: B-Trees live on disk pages, not solely within CPU registers.
- Why not C: Lehman-Yao is specifically designed to maximize concurrent readers and writers without exclusive tree latches.
- Why not D: Crash recovery logging is orthogonal to concurrent structural modification latching.
- Ref: [modules/02-storage-engines-b-trees-and-lsm.md](../modules/02-storage-engines-b-trees-and-lsm.md#b-trees-and-variants-b-trees-and-lehman-yao-b-link-trees), Lehman & Yao (1981)
</details>

### Q-DATA-008 · Storage Engines · difficulty 3 · scenario
An analytics logging engine experiences $150{,}000$ write operations per second with random primary keys. Under a traditional B+Tree engine, disk write throughput saturates and latency spikes, even though the total dataset is only 2 TB. What fundamental mechanical phenomenon causes this degradation, and how does an LSM-tree resolve it?
- A) B+Trees trigger random in-place updates across leaf pages, causing high write amplification and random disk I/O; an LSM-Tree transforms random writes into sequential writes in memory (MemTable) before flushing SSTables.
- B) B+Trees cannot store strings longer than 8 bytes; LSM-Trees compress strings using Huffman coding.
- C) B+Trees force an operating system crash due to thread starvation in the buffer pool manager.
- D) B+Trees require full-table vacuum scans after every 1,000 commits; LSM-Trees never compact data.
<details><summary>Answer</summary>

**A.** In B+Trees, modifying random keys requires reading and dirtying arbitrary 8KB/16KB disk pages, resulting in heavy random I/O and high write amplification. LSM-Trees buffer incoming writes sequentially into an in-memory MemTable (backed by a sequential WAL) and periodically flush immutable, sequentially ordered SSTables to disk.
- Why not B: B+Trees easily handle strings of arbitrary length using prefix compression and overflow pages.
- Why not C: Buffer pool managers manage concurrency with frame latches, not thread crashes.
- Why not D: LSM-Trees perform heavy background compaction; they do not avoid compaction.
- Ref: [modules/02-storage-engines-b-trees-and-lsm.md](../modules/02-storage-engines-b-trees-and-lsm.md#log-structured-merge-trees-lsm-and-ss-tables), [03-mini-lsm.test.ts](../examples/03-mini-lsm.test.ts)
</details>

### Q-DATA-009 · Storage Engines · difficulty 2 · multi
Which of the following statements correctly characterize the RUM Conjecture in database storage engine trade-offs? (Select TWO)
- A) You can simultaneously minimize Read overhead, Update overhead, and Memory/storage amplification without trade-offs.
- B) Optimizing for read latency (e.g. dense indexing) increases update overhead and storage amplification.
- C) Optimizing for write/update throughput (e.g. LSM-trees with deferred compaction) increases read overhead and temporary space amplification.
- D) Memory consumption can be reduced to zero by replacing in-memory hash tables with disk B-Trees without affecting query latency.
<details><summary>Answer</summary>

**B and C.**
- B is correct: Adding secondary indexes and maintaining sorted clustered pages reduces read lookup time but penalizes write updates and consumes storage.
- C is correct: LSM-trees optimize update costs by appending sequentially, but readers must check multiple levels and SSTables (read amplification) and space is temporarily duplicated until compaction runs.
- Why not A: The RUM conjecture formally proves that you can only optimize two of the three dimensions at the expense of the third.
- Why not D: Disk I/O latency is orders of magnitude slower than RAM; eliminating memory structures severely degrades latency.
- Ref: [modules/02-storage-engines-b-trees-and-lsm.md](../modules/02-storage-engines-b-trees-and-lsm.md#the-rum-conjecture-read-update-memory-trade-offs), Athanassoulis et al. (2016)
</details>

### Q-DATA-010 · Storage Engines · difficulty 3 · scenario
In an LSM storage engine using Leveled Compaction (LCS), Level $L$ has a capacity of 100 MB and Level $L+1$ has a capacity of 1 GB. When an SSTable from Level $L$ is compacted into Level $L+1$, what is the worst-case write amplification factor for that step?
- A) 1
- B) Up to 10
- C) Exactly 100
- D) 0 (zero-copy compaction)
<details><summary>Answer</summary>

**B.** In Leveled Compaction, the key range of a single SSTable in Level $L$ can overlap with up to 10 SSTables in Level $L+1$ (given a size ratio $T = 10$). Compaction must read and rewrite all overlapping SSTables in Level $L+1$, yielding a worst-case write amplification factor equal to the level amplification ratio $T \approx 10$.
- Why not A: A factor of 1 only occurs if there is zero key overlap across adjacent levels (extremely rare in random write workloads).
- Why not C: The ratio between adjacent levels is 10, not 100.
- Why not D: Compaction merges and sorts physical keys on disk; it cannot be zero-copy.
- Ref: [modules/02-storage-engines-b-trees-and-lsm.md](../modules/02-storage-engines-b-trees-and-lsm.md#compaction-strategies-size-tiered-vs-leveled)
</details>

---

## Domain 03: Indexing Theory, Inverted Indexes & Vector ANN

### Q-DATA-011 · Indexing Theory · difficulty 2 · single
In Okapi BM25 full-text scoring, what is the role of parameter $b$ in the document length normalization component $(1 - b + b \cdot \frac{|D|}{\text{avgdl}})$?
- A) It scales the term frequency saturation point asymptotically.
- B) It controls the penalty applied to long documents: $b = 1$ applies full document length normalization, while $b = 0$ ignores document length entirely.
- C) It adjusts the inverted index postings list compression ratio.
- D) It guarantees that stop words receive negative relevance weights.
<details><summary>Answer</summary>

**B.** The parameter $b$ (typically set to 0.75) regulates document length normalization. If $b = 1$, term frequencies are scaled strictly relative to average document length; if $b = 0$, document length normalization is deactivated.
- Why not A: Parameter $k_1$ controls term frequency saturation, not $b$.
- Why not C: Inverted index compression is handled by algorithms like PForDelta or Roaring Bitmaps.
- Why not D: IDF prevents common words from dominating; $b$ normalizes document verbosity.
- Ref: [modules/03-indexing-theory-and-vector-search.md](../modules/03-indexing-theory-and-vector-search.md#inverted-indexes-and-lexical-ranking-bm25), [12-vector-ann-hnsw.test.ts](../examples/12-vector-ann-hnsw.test.ts)
</details>

### Q-DATA-012 · Indexing Theory · difficulty 3 · scenario
A vector database indexing 100 million 1536-dimensional embedding vectors experiences memory exhaustion on 256 GB RAM instances when using an uncompressed Hierarchical Navigable Small World (HNSW) graph. What technique should be applied to compress vector memory consumption by up to $16\times$ while preserving high ANN recall?
- A) Replace HNSW with a full-table B+Tree scan.
- B) Apply Product Quantization (PQ) or Scalar Quantization (SQ8) to compress floating-point vectors into compact codebooks.
- C) Store all vectors as uncompressed text strings in a relational database column.
- D) Set the HNSW parameter $M = 0$ and $efConstruction = 0$.
<details><summary>Answer</summary>

**B.** Product Quantization (PQ) decomposes high-dimensional vectors into low-dimensional sub-vectors and quantizes them into cluster centroid indices (codebooks). Scalar Quantization (SQ8) compresses 32-bit floats into 8-bit integers, yielding an immediate $4\times$ to $16\times$ memory reduction with minimal recall degradation.
- Why not A: Brute-force scanning 100 million vectors on each query yields unacceptable multi-second latencies.
- Why not C: Text representations inflate memory usage even further.
- Why not D: Setting $M=0$ destroys the graph edges, rendering HNSW completely incapable of navigation.
- Ref: [modules/03-indexing-theory-and-vector-search.md](../modules/03-indexing-theory-and-vector-search.md#vector-quantization-sq8-pq-and-bbq)
</details>

### Q-DATA-013 · Indexing Theory · difficulty 2 · multi
Which of the following statements regarding HNSW (Hierarchical Navigable Small World) graphs are correct? (Select TWO)
- A) The top layers have fewer nodes with long-range links for fast logarithmic skip-list navigation across distant vector clusters.
- B) Node insertions are deterministic and require recomputing the entire multi-layer graph from scratch on every write.
- C) The bottom layer (Layer 0) contains every indexed vector and connects local nearest neighbors for high precision.
- D) HNSW graphs guarantee 100% exact $k$-nearest neighbors with zero recall loss under all configurations.
<details><summary>Answer</summary>

**A and C.**
- A is correct: Top layers contain exponentially fewer nodes with wide skip connections, providing $O(\log N)$ search complexity across the metric space.
- C is correct: Layer 0 contains all vectors in the dataset and establishes fine-grained local neighbor connections.
- Why not B: HNSW supports incremental insertions; vectors are probabilistically assigned a maximum layer and linked without global rebuilds.
- Why not D: HNSW is an *approximate* nearest neighbor (ANN) algorithm; recall is tunable via $efSearch$ and $M$ but is not 100% guaranteed.
- Ref: [modules/03-indexing-theory-and-vector-search.md](../modules/03-indexing-theory-and-vector-search.md#hierarchical-navigable-small-world-hnsw), Malkov & Yashunin (2018)
</details>

### Q-DATA-014 · Indexing Theory · difficulty 2 · single
Why are B+Trees ineffective for indexing multi-dimensional spatial points $(x, y, z)$ or vector embeddings?
- A) B+Trees cannot store numeric floating-point values.
- B) B+Trees enforce a 1-dimensional total ordering; mapping multidimensional points onto a 1D order without space-filling curves destroys spatial locality and forces full index scans for range queries.
- C) B+Trees can only index tables with fewer than 10,000 rows.
- D) B+Trees require disk blocks to match operating system page size.
<details><summary>Answer</summary>

**B.** B+Trees rely on a total ordering $\le$. Multidimensional spaces do not possess a natural total order. A composite B+Tree index on $(x, y)$ can only efficiently filter by $x$; filtering by $y$ requires scanning all matching $x$ ranges unless spatial access methods (R-Tree, BKD, or space-filling Hilbert/Z-order curves) are used.
- Why not A: B+Trees easily index single-dimensional floats and doubles.
- Why not C: B+Trees scale to trillions of rows.
- Why not D: Block size alignment is a standard feature of B+Trees, not a multi-dimensional limitation.
- Ref: [modules/03-indexing-theory-and-vector-search.md](../modules/03-indexing-theory-and-vector-search.md#spatial-and-multidimensional-indexes-r-trees-and-bkd-trees)
</details>

### Q-DATA-015 · Indexing Theory · difficulty 3 · scenario
In inverted index postings list compression, why is Roaring Bitmaps preferred over traditional bit vectors for storing document ID postings lists?
- A) Roaring Bitmaps adapt dynamically across three container formats (Array, Bitmap, Run-length encoded) depending on integer density, providing near-optimal compression and fast SIMD bitwise operations.
- B) Roaring Bitmaps encrypt document IDs using AES-256 in memory.
- C) Roaring Bitmaps eliminate the need for inverted indexes entirely.
- D) Roaring Bitmaps are stored exclusively in GPU high-bandwidth memory.
<details><summary>Answer</summary>

**A.** Roaring Bitmaps partition 32-bit integers into chunks by the high 16 bits. If a chunk contains fewer than 4,096 integers, it uses a sorted 16-bit Array container; if dense, it uses a 65,536-bit Bitmap container; if consecutive runs exist, it uses a Run container. This optimizes both space and bitwise intersection/union performance.
- Why not B: Roaring Bitmaps are a compression structure, not an encryption protocol.
- Why not C: They are used *inside* inverted index postings lists, not as a replacement for them.
- Why not D: Roaring Bitmaps run on standard CPU architectures and leverage AVX-512/NEON vector instructions.
- Ref: [modules/03-indexing-theory-and-vector-search.md](../modules/03-indexing-theory-and-vector-search.md#inverted-indexes-and-lexical-ranking-bm25), Chambi et al. (2016)
</details>

---

## Domain 04: Buffer Management, OS Paging & Direct I/O

### Q-DATA-016 · Buffer Management · difficulty 2 · single
Why do production database engines (e.g. PostgreSQL, MySQL InnoDB, CockroachDB) implement their own user-space Buffer Pool Manager rather than relying on the operating system `mmap` page cache?
- A) The OS kernel cannot allocate more than 4 GB of virtual memory.
- B) `mmap` prevents the database engine from controlling eviction policies, prevents fine-grained asynchronous write-back, triggers uncontrolled SIGBUS faults on I/O errors, and breaks the Write-Ahead Log (WAL) flush invariant.
- C) `mmap` can only read files sequentially and does not support random access.
- D) User-space code executes faster than kernel memory mappings due to bypassing CPU L1 caches.
<details><summary>Answer</summary>

**B.** As documented in *Are You Sure You Want to Use MMAP in Your Database Management System?* (CIDR 2022), `mmap` relinquishes eviction timing to the kernel OS page cache. The OS kernel may flush a dirty page to disk before its associated WAL record has been synced (violating WAL durability), handles page faults synchronously with high context-switch overhead, and raises fatal SIGBUS signals on full disks.
- Why not A: 64-bit OS kernels easily map hundreds of terabytes.
- Why not C: `mmap` supports random access anywhere in the mapped memory window.
- Why not D: Bypassing CPU cache is impossible; user-space buffer pools explicitly utilize CPU caches.
- Ref: [modules/04-buffer-management-and-operating-system-io.md](../modules/04-buffer-management-and-operating-system-io.md#the-mmap-critique-why-databases-manage-their-own-pages), Crotty et al. (CIDR 2022)
</details>

### Q-DATA-017 · Buffer Management · difficulty 2 · single
How does the CLOCK eviction algorithm approximate Least Recently Used (LRU) while avoiding the lock contention of maintaining a doubly-linked list on every page hit?
- A) It assigns a pseudo-random floating-point number to each page and deletes the lowest one.
- B) It maintains a circular array of frame metadata with a reference bit (`usage_count`); on page hit, the bit is set to 1; on eviction sweep, the hand checks the bit: if 1, it clears it to 0 and advances; if 0, the page is evicted.
- C) It tracks page access using a hardware GPS clock.
- D) It evicts pages in strict alphabetical order of their table name.
<details><summary>Answer</summary>

**B.** CLOCK approximates LRU using a single reference bit per frame. A read hit only requires an atomic bit set (`usage = 1`), eliminating the heavy mutex latch required to move a node to the head of an LRU linked list. The eviction hand sweeps frames circularly, giving frames a second chance before choosing one with bit 0.
- Why not A: Random eviction provides poor hit rates and does not capture temporal locality.
- Why not C: CLOCK refers to the circular rotating hand, not physical wall-clock GPS hardware.
- Why not D: Alphabetical eviction has zero correlation with query access patterns.
- Ref: [modules/04-buffer-management-and-operating-system-io.md](../modules/04-buffer-management-and-operating-system-io.md#eviction-algorithms-lru-clock-2q-and-lirs), [04-buffer-pool.test.ts](../examples/04-buffer-pool.test.ts)
</details>

### Q-DATA-018 · Buffer Management · difficulty 3 · scenario
A database undergoes a sequential scan of a 500 GB table while concurrent transactions are actively querying hot index pages in a 64 GB buffer pool. Under naive LRU eviction, what problem occurs, and how does the 2Q or LIRS algorithm prevent it?
- A) Buffer pool pollution occurs (the scan evicts all hot cached pages); 2Q separates pages into a FIFO queue for first-time accesses and a secondary LRU queue for pages accessed more than once.
- B) The database crashes with an out-of-memory kernel panic; 2Q prevents it by disabling disk reads.
- C) The scan corrupts the B+Tree indexes; 2Q runs checksums on every block.
- D) The WAL fills up; 2Q forces immediate checkpointing.
<details><summary>Answer</summary>

**A.** Sequential scans access large numbers of pages exactly once. Naive LRU inserts them at the MRU head, evicting frequently accessed hot working sets (buffer pool pollution). 2Q routes new pages into a probation queue ($A1$); only pages accessed repeatedly while in probation graduate to the hot cache ($Am$), insulating hot pages from sequential scan flooding.
- Why not B: Out-of-memory panics do not occur because buffer pools have fixed frame allocations.
- Why not C: Reading pages does not corrupt index structures.
- Why not D: Sequential reads do not generate WAL records.
- Ref: [modules/04-buffer-management-and-operating-system-io.md](../modules/04-buffer-management-and-operating-system-io.md#eviction-algorithms-lru-clock-2q-and-lirs), Johnson & Shasha (1994)
</details>

### Q-DATA-019 · Buffer Management · difficulty 3 · single
What was the core revelation of the PostgreSQL "fsyncgate" incident regarding Linux kernel page cache behavior upon writeback failure?
- A) The Linux kernel corrupts the hard drive partition table if `fsync()` is called concurrently.
- B) When a dirty kernel page writeback failed due to an underlying I/O error, the Linux kernel cleared the dirty bit and marked the page clean, so subsequent `fsync()` calls succeeded and reported no error even though data was never persisted.
- C) Linux kernel drivers refused to write more than 4 KB per second.
- D) Calling `fsync()` caused all file descriptors to close unexpectedly.
<details><summary>Answer</summary>

**B.** In Linux kernels prior to 4.13, when background buffered writeback failed (e.g. temporary SAN disconnect), the kernel evicted dirty flags. A subsequent `fsync()` call returned 0 (success). The database assumed data was safely on disk, leading to silent data corruption upon subsequent page eviction and reload.
- Why not A: Partition tables are unaffected by file fsync calls.
- Why not C: Fsyncgate was about silent error masking, not throughput throttling.
- Why not D: File descriptors remain open; error codes were simply discarded.
- Ref: [modules/04-buffer-management-and-operating-system-io.md](../modules/04-buffer-management-and-operating-system-io.md#operating-system-io-direct-io-fsyncgate-and-io_uring)
</details>

### Q-DATA-020 · Buffer Management · difficulty 2 · multi
Which of the following advantages are provided by Linux `io_uring` for high-throughput database storage engines? (Select TWO)
- A) True asynchronous disk I/O without dedicated threadpool context switching overhead.
- B) Zero-copy submission and completion queues shared between user-space and kernel memory via ring buffers.
- C) Elimination of the need for Write-Ahead Logging.
- D) Automatic hardware RAID mirroring without disk controllers.
<details><summary>Answer</summary>

**A and B.**
- A is correct: `io_uring` allows submitting batch I/O requests without spawning dedicated posix threads or blocking application execution threads.
- B is correct: The Submission Queue (SQ) and Completion Queue (CQ) are lockless ring buffers mapped into both user space and kernel space, allowing request dispatch with zero syscall context switches in polled mode.
- Why not C: `io_uring` is an I/O subsystem; it has nothing to do with database durability logging invariants.
- Why not D: Hardware RAID management is managed by disk controllers or Linux `mdadm`, not `io_uring`.
- Ref: [modules/04-buffer-management-and-operating-system-io.md](../modules/04-buffer-management-and-operating-system-io.md#operating-system-io-direct-io-fsyncgate-and-io_uring), Axboe (2019)
</details>

---

## Domain 05: Transactions, ACID & Isolation Anomaly Hierarchy

### Q-DATA-021 · Transactions & ACID · difficulty 2 · single
In the formal taxonomy of isolation anomalies defined by Berenson et al. (1995) and Adya (1999), what distinguishes Non-Repeatable Read (Fuzzy Read, $A2$) from Phantom Read ($A3$)?
- A) Non-Repeatable Read modifies existing data rows retrieved by a previous read; Phantom Read inserts or deletes rows matching a predicate condition.
- B) Non-Repeatable Read occurs only in distributed databases; Phantom Read occurs only in single-node databases.
- C) Non-Repeatable Read violates Atomicity; Phantom Read violates Durability.
- D) Non-Repeatable Read can only be prevented by Serializable isolation; Phantom Read is prevented by Read Committed.
<details><summary>Answer</summary>

**A.** A Non-Repeatable Read occurs when transaction $T_1$ reads a specific row, transaction $T_2$ modifies that row and commits, and $T_1$ re-reads the row to find different values. A Phantom Read occurs when $T_1$ reads a set of rows satisfying a predicate condition, $T_2$ creates or removes rows satisfying that predicate and commits, and $T_1$ re-evaluates the predicate to find newly materialized "phantom" rows.
- Why not B: Both anomalies apply equally to single-node and distributed systems.
- Why not C: Both are isolation anomalies, not atomicity or durability violations.
- Why not D: Repeatable Read prevents Non-Repeatable Read; Read Committed allows both.
- Ref: [modules/05-transactions-acid-and-isolation-levels.md](../modules/05-transactions-acid-and-isolation-levels.md#the-anomaly-hierarchy-beyond-ansi-sql-92), Berenson et al. (1995)
</details>

### Q-DATA-022 · Transactions & ACID · difficulty 3 · scenario
Two doctors on call, Alice and Bob, both submit requests to take medical leave simultaneously. Hospital policy requires at least one doctor on call at all times ($active\_doctors \ge 1$). 
- Under Snapshot Isolation, Transaction $T_1$ (Alice) checks $COUNT(*) \ge 2$ (true: 2 active) and updates Alice's status to inactive.
- Simultaneously, Transaction $T_2$ (Bob) checks $COUNT(*) \ge 2$ (true: 2 active) and updates Bob's status to inactive.
Both transactions commit successfully. What specific anomaly occurred, and why did standard Snapshot Isolation fail to detect it?
- A) Dirty Write ($G0$); Snapshot Isolation failed because neither transaction acquired a write lock on Alice.
- B) Write Skew ($G\text{-skew}$); each transaction read overlapping data but wrote to disjoint records, creating an anti-dependency cycle without a direct write-write conflict.
- C) Lost Update ($P4$); Bob's transaction silently overwrote Alice's updated row.
- D) Phantom Read ($A3$); doctors were added to the hospital table by a third background thread.
<details><summary>Answer</summary>

**B.** Write Skew occurs under Snapshot Isolation when concurrent transactions read overlapping datasets, evaluate a constraint, and make disjoint updates that violate the global constraint. Because neither transaction modified the same physical row (Alice updated record A; Bob updated record B), the first-committer-wins write-lock rule does not trigger.
- Why not A: Neither transaction wrote uncommitted values written by the other (no Dirty Write).
- Why not C: Neither row was overwritten; both rows transitioned from active to inactive.
- Why not D: No new rows were inserted; existing records were updated.
- Ref: [modules/05-transactions-acid-and-isolation-levels.md](../modules/05-transactions-acid-and-isolation-levels.md#the-anomaly-hierarchy-beyond-ansi-sql-92), [05-mvcc-transaction-manager.test.ts](../examples/05-mvcc-transaction-manager.test.ts)
</details>

### Q-DATA-023 · Transactions & ACID · difficulty 3 · single
How does Serializable Snapshot Isolation (SSI, Cahill et al. 2008) eliminate Write Skew without resorting to pessimistic two-phase locking?
- A) It blocks all readers whenever any writer is active in the database.
- B) It tracks $rw$-antidependency edges between concurrent transactions in an in-memory lock graph and aborts a transaction if two consecutive $rw$-edges form a dangerous structure ($T_1 \xrightarrow{rw} T_2 \xrightarrow{rw} T_3$).
- C) It executes all transactions sequentially on a single CPU thread.
- D) It rewrites all application queries to use table-level exclusive locks.
<details><summary>Answer</summary>

**B.** SSI dynamically tracks read-write conflicts (anti-dependencies, denoted $rw$) using lightweight SIREAD locks on tuples and index ranges. If a cycle or dangerous structure of two consecutive $rw$-edges is detected between overlapping transactions, SSI aborts one of the transactions, ensuring serializability while retaining lock-free reads.
- Why not A: SSI maintains the core MVCC principle: readers never block writers, and writers never block readers.
- Why not C: Sequential single-thread execution is VoltDB/Redis architecture, not SSI.
- Why not D: SSI avoids coarse table locks completely.
- Ref: [modules/05-transactions-acid-and-isolation-levels.md](../modules/05-transactions-acid-and-isolation-levels.md#serializable-snapshot-isolation-ssi), Cahill, Rohm & Fekete (2008)
</details>

### Q-DATA-024 · Transactions & ACID · difficulty 2 · ordering
Order the standard ANSI and modern transaction isolation levels from weakest guarantees (most anomalies permitted) to strongest guarantees (zero anomalies permitted):
1. Repeatable Read
2. Read Committed
3. Serializable
4. Read Uncommitted
5. Snapshot Isolation
- A) 4 $\rightarrow$ 2 $\rightarrow$ 1 $\rightarrow$ 5 $\rightarrow$ 3
- B) 4 $\rightarrow$ 2 $\rightarrow$ 5 $\rightarrow$ 1 $\rightarrow$ 3
- C) 2 $\rightarrow$ 4 $\rightarrow$ 1 $\rightarrow$ 5 $\rightarrow$ 3
- D) 4 $\rightarrow$ 1 $\rightarrow$ 2 $\rightarrow$ 5 $\rightarrow$ 3
<details><summary>Answer</summary>

**B.** The progression from weakest to strongest isolation is:
Read Uncommitted (permits dirty reads) $\rightarrow$ Read Committed (prevents dirty reads) $\rightarrow$ Snapshot Isolation (prevents non-repeatable reads and lost updates, permits write skew) $\rightarrow$ Repeatable Read (ANSI) $\rightarrow$ Serializable (guarantees serializable equivalent order).
- Why not A, C, D: Read Uncommitted is strictly the weakest level, followed by Read Committed. Snapshot Isolation prevents Lost Update ($G\text{-upd}$), whereas ANSI Repeatable Read does not prevent Write Skew.
- Ref: [modules/05-transactions-acid-and-isolation-levels.md](../modules/05-transactions-acid-and-isolation-levels.md#isolation-levels-and-their-anomalies)
</details>

### Q-DATA-025 · Transactions & ACID · difficulty 3 · scenario
Under Multi-Version Concurrency Control (MVCC), a row is updated by Transaction $T_{100}$ (xmin=100, xmax=0). Later, Transaction $T_{105}$ begins and reads the row. While $T_{105}$ is still executing, Transaction $T_{110}$ begins, updates the row to a new value (creating version with xmin=110), sets the old version's xmax=110, and commits. When $T_{105}$ re-reads the row under Snapshot Isolation, which version does it see?
- A) It sees the new version written by $T_{110}$ because $T_{110}$ already committed.
- B) It sees the original version ($xmin=100$) because $T_{110}$ began after $T_{105}$'s snapshot was taken ($xmin > \text{snapshot.txnId}$), so $T_{110}$'s mutation is invisible to $T_{105}$.
- C) It throws a serializable deadlock error.
- D) It reads null because the old version's xmax was populated.
<details><summary>Answer</summary>

**B.** In MVCC snapshot isolation, visibility is determined at snapshot acquisition. Any transaction ID greater than the snapshot transaction boundary ($T_{110} > T_{105}$) is strictly invisible. Therefore, $T_{105}$ ignores $xmax=110$ and continues to read the original version ($xmin=100$).
- Why not A: Reading $T_{110}$'s commit would violate Snapshot Isolation and cause a Non-Repeatable Read.
- Why not C: MVCC read operations do not take write locks and never trigger deadlocks.
- Why not D: Deletions or updates by younger transactions are ignored by older active snapshots.
- Ref: [modules/05-transactions-acid-and-isolation-levels.md](../modules/05-transactions-acid-and-isolation-levels.md#multi-version-concurrency-control-mvcc-internals), [05-mvcc-transaction-manager.test.ts](../examples/05-mvcc-transaction-manager.test.ts)
</details>

---

## Domain 06: Durability, Write-Ahead Logging & ARIES Crash Recovery

### Q-DATA-026 · Durability & WAL · difficulty 2 · single
What does the Steal / No-Force policy in database buffer management specify?
- A) Steal: The buffer pool manager may write uncommitted dirty pages to disk to free frames; No-Force: The buffer pool manager is NOT required to flush dirty pages to disk at transaction commit time.
- B) Steal: Transactions may steal locks from other transactions; No-Force: Transactions are not forced to write WAL records.
- C) Steal: Corrupt pages are discarded; No-Force: Checkpoints are optional.
- D) Steal: Memory is stolen from the OS; No-Force: CPU threads cannot be preempted.
<details><summary>Answer</summary>

**A.** Steal policy allows the buffer manager to flush dirty pages belonging to uncommitted transactions to disk to reclaim frames for other queries (requiring UNDO logging during crash recovery). No-Force policy means a transaction can commit as soon as its WAL records are synced, without forcing modified data pages to disk (requiring REDO logging).
- Why not B, C, D: Steal/Force are formal database concepts governing the relationship between the buffer pool and persistent disk pages.
- Ref: [modules/06-durability-wal-and-crash-recovery.md](../modules/06-durability-wal-and-crash-recovery.md#buffer-pool-policies-stealno-force-classification), Haerder & Reuter (1983)
</details>

### Q-DATA-027 · Durability & WAL · difficulty 3 · scenario
A database server experiences a sudden power loss. Upon reboot, the ARIES crash recovery algorithm executes its three phases. What occurs during the Redo phase?
- A) The engine undoes the actions of all transactions that were active at the crash point in reverse chronological order.
- B) The engine repeats history by scanning forward from the smallest `recLSN` in the Dirty Page Table (DPT) and reapplying all logged operations (for both committed and uncommitted transactions) to restore the exact state of the database prior to the crash.
- C) The engine truncates all tables and reloads them from the last full backup.
- D) The engine invalidates all secondary indexes and forces a rebuild.
<details><summary>Answer</summary>

**B.** ARIES Redo phase "repeats history" by scanning forward from the smallest unwritten log sequence number (`recLSN`) found during the Analysis phase. It reapplies changes for all transactions (including losers) to reconstruct the exact pre-crash state, logging Compensation Log Records (CLRs) as needed before the Undo phase begins.
- Why not A: Rolling back loser transactions occurs in the *Undo* phase, not the Redo phase.
- Why not C: Full backups are only used for catastrophic media failure recovery, not standard crash recovery.
- Why not D: B+Tree index changes are WAL-logged and recovered identically to data pages.
- Ref: [modules/06-durability-wal-and-crash-recovery.md](../modules/06-durability-wal-and-crash-recovery.md#the-three-passes-of-aries-analysis-redo-undo), Mohan et al. (1992)
</details>

### Q-DATA-028 · Durability & WAL · difficulty 3 · single
Why are Compensation Log Records (CLRs) recorded during the Undo phase of ARIES, and what prevents infinite recovery loops if the system crashes repeatedly during recovery?
- A) CLRs contain a pointer (`UndoNextLSN`) to the next record that needs to be undone for that transaction; if a crash occurs during recovery, the redo pass reapplies the CLR, and the subsequent undo pass jumps directly to `UndoNextLSN`, guaranteeing progress and idempotency without repeating previously undone actions.
- B) CLRs erase the WAL log file to prevent disk exhaustion.
- C) CLRs disable transaction aborts globally.
- D) CLRs convert all uncommitted transactions into committed transactions.
<details><summary>Answer</summary>

**A.** A Compensation Log Record (CLR) logs the undoing of an action. It carries an `UndoNextLSN` field pointing to the previous log record that still requires rollback. Because CLRs are never themselves undone, recovery is strictly idempotent and guaranteed to terminate even across repeated cascading crashes during recovery.
- Why not B: Erasing log files during crash recovery would destroy durability and corrupt data.
- Why not C: Aborting transactions is the fundamental requirement of rollback; it cannot be disabled.
- Why not D: Uncommitted transactions must be rolled back, never artificially committed.
- Ref: [modules/06-durability-wal-and-crash-recovery.md](../modules/06-durability-wal-and-crash-recovery.md#compensation-log-records-clrs-and-repeating-history), [06-aries-wal-recovery.test.ts](../examples/06-aries-wal-recovery.test.ts)
</details>

### Q-DATA-029 · Durability & WAL · difficulty 2 · ordering
Order the three phases of the ARIES recovery algorithm in their correct execution sequence:
1. Undo Phase
2. Analysis Phase
3. Redo Phase
- A) 1 $\rightarrow$ 2 $\rightarrow$ 3
- B) 2 $\rightarrow$ 3 $\rightarrow$ 1
- C) 3 $\rightarrow$ 2 $\rightarrow$ 1
- D) 2 $\rightarrow$ 1 $\rightarrow$ 3
<details><summary>Answer</summary>

**B.** ARIES executes strictly in the sequence:
1. Analysis: Scans forward from the checkpoint record to identify active transactions ("losers") and dirty pages.
2. Redo: Scans forward from smallest `recLSN` to repeat history.
3. Undo: Scans backward to roll back all loser transactions.
- Why not A, C, D: Redo cannot begin until Analysis determines the active transaction table and smallest `recLSN`; Undo cannot begin until history has been restored by Redo.
- Ref: [modules/06-durability-wal-and-crash-recovery.md](../modules/06-durability-wal-and-crash-recovery.md#the-three-passes-of-aries-analysis-redo-undo)
</details>

### Q-DATA-030 · Durability & WAL · difficulty 2 · single
What is the purpose of Group Commit in write-ahead log management?
- A) It forces transactions to execute in batches of 1,000 on a single thread.
- B) It amortizes the high latency cost of the `fsync()` system call across multiple concurrent committing transactions by batching their log flushes into a single synchronous disk write.
- C) It groups SQL queries together into stored procedures.
- D) It groups tables together into separate files on the filesystem.
<details><summary>Answer</summary>

**B.** Calling `fsync()` for every individual commit limits write throughput to physical storage IOPS (e.g. 100–200 commits/sec on spinning disks, or a few thousand on standard SSDs). Group commit allows one committing thread to act as leader, flushing log buffers for all concurrent transactions waiting to commit in a single atomic I/O operation.
- Why not A: Transactions execute concurrently across multiple threads; only the I/O flush is grouped.
- Why not C: Group commit is a low-level WAL I/O optimization, not application query batching.
- Why not D: Tablespace organization is unrelated to WAL group commit.
- Ref: [modules/06-durability-wal-and-crash-recovery.md](../modules/06-durability-wal-and-crash-recovery.md#group-commit-mechanics)
</details>

---

## Domain 07: Replication Mechanics, Consistency & Quorums

### Q-DATA-031 · Replication · difficulty 2 · single
In a leaderless replicated storage cluster (Dynamo-style) with $N$ replicas, write quorum $W$, and read quorum $R$, what condition must hold to guarantee strong consistency (preventing stale reads)?
- A) $W + R \le N$
- B) $W + R > N$
- C) $W = 1$ and $R = 1$
- D) $N = W \cdot R$
<details><summary>Answer</summary>

**B.** The Pigeonhole Principle dictates that when $W + R > N$, the set of nodes written to and the set of nodes read from must overlap by at least one node. That overlapping node is guaranteed to possess the latest version of the record (distinguished by timestamp or version vector).
- Why not A: If $W + R \le N$, the read quorum may query disjoint replicas that never received the latest write, returning stale data.
- Why not C: If $W=1, R=1$ in a cluster where $N \ge 2$, $W+R = 2 \le N$, permitting stale reads.
- Why not D: Multiplying cluster factors is mathematically invalid for quorum intersection.
- Ref: [modules/07-replication-mechanics-and-consensus.md](../modules/07-replication-mechanics-and-consensus.md#leaderless-replication-and-dynamo-style-quorums), [07-replication-quorum.test.ts](../examples/07-replication-quorum.test.ts)
</details>

### Q-DATA-032 · Replication · difficulty 3 · scenario
A user updates their account profile picture on an e-commerce website backed by a leader-follower database with asynchronous replication. Upon refreshing the page immediately, the user still sees their old profile picture. What specific consistency guarantee was violated, and how should it be resolved?
- A) Monotonic Reads was violated; resolve by routing all reads through Redis cache.
- B) Read-Your-Writes (Read-After-Write) Consistency was violated; resolve by routing the user's reads to the primary leader for a duration exceeding replication lag, or having the client track the write's LSN and wait for the replica to catch up (`WAIT FOR LSN`).
- C) Eventual Consistency was violated; resolve by terminating all read replicas.
- D) Atomicity was violated; resolve by running `ROLLBACK TRANSACTION`.
<details><summary>Answer</summary>

**B.** Read-Your-Writes consistency guarantees that when a user updates data, any subsequent read by that same user will observe the updated value. In asynchronous replication, routing immediate reads to a lagging replica returns stale data. Mitigations include tracking user modification timestamps and reading from the leader, or enforcing replica LSN synchronization.
- Why not A: Monotonic reads guarantees that a user who observes state $S_1$ will never later observe older state $S_0$; it does not guarantee immediate observation of fresh writes.
- Why not C: Terminating replicas destroys read scaling.
- Why not D: The transaction already committed atomically on the leader; the issue is replication lag.
- Ref: [modules/07-replication-mechanics-and-consensus.md](../modules/07-replication-mechanics-and-consensus.md#replication-lag-anomalies-and-guarantees)
</details>

### Q-DATA-033 · Replication · difficulty 3 · single
In Martin Kleppmann's critique of the Redlock distributed locking algorithm, why is relying on node system clocks and single-node Redis key TTLs unsafe for distributed mutual exclusion?
- A) Redis does not support network connections over TCP/IP.
- B) Unbounded process pauses (GC pauses, VM migration), network delays, and clock jumps can cause the lock lease to expire on Redis without the lock holder's knowledge, allowing another client to acquire the lock and corrupt shared resources unless cryptographic fencing tokens are used.
- C) Redlock can only run on single-core CPU architectures.
- D) Redis automatically converts strings to numbers without warning.
<details><summary>Answer</summary>

**B.** Kleppmann demonstrated that in an asynchronous network with non-zero process pauses (e.g. stop-the-world garbage collection or hypervisor descheduling), Client 1 can acquire a lease, freeze for longer than the TTL, have its lease expire on Redis, allow Client 2 to acquire the lock, and then Client 1 wakes up and writes to the shared storage concurrently with Client 2. Reliable mutual exclusion requires monotonically increasing fencing tokens validated at the storage layer.
- Why not A: Redis is built entirely on TCP/IP sockets.
- Why not C: Redis cluster nodes run on standard multi-core systems.
- Why not D: Redis key value typing is orthogonal to distributed lease safety.
- Ref: [modules/07-replication-mechanics-and-consensus.md](../modules/07-replication-mechanics-and-consensus.md#distributed-locks-and-the-redlock-critique), Kleppmann (2016)
</details>

### Q-DATA-034 · Replication · difficulty 2 · multi
Which of the following statements are correct regarding physical versus logical replication in relational databases? (Select TWO)
- A) Physical streaming replication replicates exact byte-level disk page modifications and WAL records, requiring identical database major versions and hardware architectures between leader and standby.
- B) Logical replication replicates individual SQL statements verbatim as text strings, executing `RAND()` and `NOW()` identically on all replicas.
- C) Logical replication streams row-level change events (decoded WAL tuples), enabling selective table replication, zero-downtime major version upgrades, and integration with external stream processors (CDC).
- D) Physical replication allows standbys to create writeable local tables while simultaneously receiving leader replication streams.
<details><summary>Answer</summary>

**A and C.**
- A is correct: Physical replication duplicates binary disk pages and exact WAL byte streams; it requires byte-for-byte binary compatibility across the cluster.
- C is correct: Logical decoding extracts data change tuples (INSERT, UPDATE, DELETE) independent of physical storage layouts, making cross-version replication and Kafka CDC ingestion possible.
- Why not B: Statement-based replication of non-deterministic functions (`NOW()`, `UUID()`) produces data divergences; modern logical replication streams row changes, not raw SQL strings.
- Why not D: Physical standbys are strictly read-only; they cannot write local tables because binary WAL replays would conflict with local page alterations.
- Ref: [modules/07-replication-mechanics-and-consensus.md](../modules/07-replication-mechanics-and-consensus.md#replication-log-implementations)
</details>

### Q-DATA-035 · Replication · difficulty 2 · single
What is the function of Read Repair in leaderless storage architectures?
- A) It rebuilds operating system filesystems when hard drives develop bad sectors.
- B) When a client reads from a quorum of replicas and detects that one or more replicas returned an older version of the data, the client asynchronously writes the newest version back to the stale replicas to restore convergence.
- C) It converts SQL queries into optimized machine code during runtime.
- D) It repairs corrupted index trees using offline table locks.
<details><summary>Answer</summary>

**B.** In leaderless systems (e.g. Apache Cassandra, Amazon Dynamo), read repair opportunistically heals replicas. When a read quorum returns diverging version numbers, the client returns the latest value to the caller and dispatches a background write containing the latest version to the stale nodes.
- Why not A: Filesystem repair is handled by `fsck`, not database read repair.
- Why not C: JIT compilers optimize queries, not replication.
- Why not D: Read repair operates online during standard client read operations.
- Ref: [modules/07-replication-mechanics-and-consensus.md](../modules/07-replication-mechanics-and-consensus.md#leaderless-replication-and-dynamo-style-quorums), [07-replication-quorum.test.ts](../examples/07-replication-quorum.test.ts)
</details>

---

## Domain 08: Partitioning, Consistent Hashing & Routing

### Q-DATA-036 · Partitioning & Routing · difficulty 2 · single
In consistent hashing, what is the primary benefit of introducing Virtual Nodes (vnodes)?
- A) It encrypts network traffic between physical storage servers.
- B) It maps each physical server to multiple positions on the hash ring, smoothing statistical variance in key distribution and allowing heterogeneous hardware nodes to be assigned capacity proportional to their performance.
- C) It eliminates the need for hashing algorithms.
- D) It forces all database keys to be stored in RAM.
<details><summary>Answer</summary>

**B.** With a single point per physical server on a hash ring, small cluster sizes suffer from significant variance (hot spots). Introducing virtual nodes (e.g. 128 to 256 vnodes per server) ensures keys are evenly distributed across the ring and enables proportional weighting for nodes with different CPU/storage capabilities.
- Why not A: Network encryption is handled by TLS/mTLS, not consistent hashing.
- Why not C: Consistent hashing fundamentally requires hashing algorithms (Murmur3, FNV-1a, SHA).
- Why not D: Consistent hashing is a routing abstraction; data can reside on SSD or disk.
- Ref: [modules/08-partitioning-sharding-and-routing.md](../modules/08-partitioning-sharding-and-routing.md#consistent-hashing-and-virtual-nodes), [08-consistent-hashing.test.ts](../examples/08-consistent-hashing.test.ts)
</details>

### Q-DATA-037 · Partitioning & Routing · difficulty 3 · scenario
A cluster consists of $N = 4$ nodes and stores 100,000 keys using consistent hashing. A 5th node is added to scale capacity. Under consistent hashing, approximately what fraction of the total keys must be migrated across the network?
- A) 100% of the keys
- B) Approximately $1 / (N+1) = 20\%$ of the keys
- C) Exactly 50% of the keys
- D) 0% of the keys
<details><summary>Answer</summary>

**B.** In consistent hashing, adding an $(N+1)$-th node only claims key ranges from its immediate predecessors on the ring. The theoretical fraction of keys migrated is $1 / (N+1) = 1/5 = 20\%$. In contrast, naive modular hashing ($\text{hash}(k) \pmod N$) forces rebalancing of nearly $(N / (N+1)) = 80\%$ of all keys.
- Why not A: Modular hashing rebalances almost all keys; consistent hashing minimizes rebalancing.
- Why not C: 50% migration only occurs when doubling a cluster from 1 to 2 nodes.
- Why not D: Adding a node to accept writes requires routing existing keys to it.
- Ref: [modules/08-partitioning-sharding-and-routing.md](../modules/08-partitioning-sharding-and-routing.md#consistent-hashing-and-virtual-nodes), Karger et al. (1997)
</details>

### Q-DATA-038 · Partitioning & Routing · difficulty 2 · multi
What are the trade-offs between Document-Partitioned (Local) Secondary Indexes and Term-Partitioned (Global) Secondary Indexes? (Select TWO)
- A) Local secondary indexes keep index entries on the exact same partition as the primary record, allowing fast single-partition writes, but queries on the secondary index must execute scatter-gather across every partition in the cluster.
- B) Global secondary indexes eliminate the need for primary keys.
- C) Global secondary indexes partition index entries across all nodes by search term, allowing point queries to hit a single node, but writes must update multiple remote partitions via distributed transactions or asynchronous updates.
- D) Local secondary indexes cannot index numeric or boolean columns.
<details><summary>Answer</summary>

**A and C.**
- A is correct: Local indexes isolate updates to a single node (co-located with the primary data row), but searching for a secondary term requires querying every shard in parallel (scatter-gather) and aggregating results.
- C is correct: Global indexes route lookups for a given term directly to the shard owning that term, but writing a row requires updating both the primary data shard and the remote global index shard.
- Why not B: Primary keys remain mandatory for unique record identification.
- Why not D: Local indexes support arbitrary column types.
- Ref: [modules/08-partitioning-sharding-and-routing.md](../modules/08-partitioning-sharding-and-routing.md#secondary-indexes-in-partitioned-systems)
</details>

### Q-DATA-039 · Partitioning & Routing · difficulty 3 · scenario
A distributed time-series database partitions data by sensor timestamp (e.g. range partitioning by day: `2026-10-30`). What operational failure mode does this design induce, and what is the standard architectural fix?
- A) Data corruption; fix by switching from SSD to HDD.
- B) Hotspotting: all incoming real-time write traffic hits the single partition corresponding to "today", saturating that node's CPU and disk while historical partitions sit idle; fix by compound key partitioning (`hash(sensor_id) + timestamp`).
- C) B-Tree deadlocks; fix by dropping indexes during the night.
- D) Memory fragmentation; fix by restarting servers every morning.
<details><summary>Answer</summary>

**B.** Partitioning purely by monotonically increasing timestamps directs 100% of current ingestion traffic to the single active partition for the current time window, creating a severe bottleneck. The industry standard fix uses a compound key: hashing a high-cardinality dimension (`sensor_id` or `tenant_id`) to distribute writes uniformly across the cluster, while sorting by timestamp within each partition.
- Why not A: SSD hardware is superior to HDD; changing disk types does not fix hotspot routing.
- Why not C: Deadlocks are not resolved by dropping essential indexes.
- Why not D: Periodic restarts do not resolve architectural workload imbalances.
- Ref: [modules/08-partitioning-sharding-and-routing.md](../modules/08-partitioning-sharding-and-routing.md#partitioning-strategies-range-hash-and-directory)
</details>

### Q-DATA-040 · Partitioning & Routing · difficulty 2 · single
Why does the tail latency ($P99.9$) of scatter-gather queries across 100 partitioned shards degrade significantly compared to the latency of an individual shard?
- A) Shard communication uses slow serial RS-232 connections.
- B) The scatter-gather query latency is bounded by the slowest single shard response among all 100 nodes; the probability of at least one node experiencing a transient GC pause, disk latency spike, or network jitter approaches $1 - (1 - p)^{100} \approx 63\%$ even if an individual spike occurs only $1\%$ of the time.
- C) Partitioned shards cannot execute queries concurrently.
- D) The coordinator node decrypts all disk sectors sequentially.
<details><summary>Answer</summary>

**B.** In scatter-gather operations, the coordinator must wait for the slowest replica to complete before returning results. As Dean & Barroso documented in *The Tail at Scale* (CACM 2013), tail latency compounding means that as partition fan-out increases, system response time rapidly converges to the worst-case outlier latency across the fleet.
- Why not A: Cluster communication uses high-speed Ethernet / InfiniBand.
- Why not C: Queries execute in parallel across all shards.
- Why not D: Disk decryption is performed locally at the storage layer, not by the query coordinator.
- Ref: [modules/08-partitioning-sharding-and-routing.md](../modules/08-partitioning-sharding-and-routing.md#scatter-gather-and-the-tail-at-scale-problem), Dean & Barroso (2013)
</details>

---

## Domain 09: Caching Theory, Cache Stampedes & Invalidation

### Q-DATA-041 · Caching Theory · difficulty 2 · single
In high-throughput systems, what is the fundamental flaw of the Cache-Aside pattern when an existing hot cache entry reaches its exact Time-To-Live (TTL) expiration?
- A) The database automatically deletes the underlying table.
- B) A Cache Stampede (Thundering Herd) occurs: the entry expires, and dozens or hundreds of concurrent requests simultaneously observe a cache miss and execute identical expensive database queries in parallel, crashing the database.
- C) The cache server crashes due to operating system page faults.
- D) Cache-aside patterns prevent client reads from returning data.
<details><summary>Answer</summary>

**B.** When a hot key expires under naive TTL, every incoming application thread concurrently misses the cache and attempts to compute the value from the database simultaneously. This sudden wave of concurrent queries can overload database connection pools, saturate CPU, and lead to cascading system failure.
- Why not A: Cache expiration in Redis/Memcached has no direct deletion effect on database tables.
- Why not C: Cache misses simply return null; they do not crash the cache server.
- Why not D: Reads succeed once the database responds, but with extreme latency degradation.
- Ref: [modules/09-caching-theory-and-consistency.md](../modules/09-caching-theory-and-consistency.md#the-cache-stampede-problem-thundering-herd), [09-cache-xfetch.test.ts](../examples/09-cache-xfetch.test.ts)
</details>

### Q-DATA-042 · Caching Theory · difficulty 3 · single
How does the XFetch algorithm (Vattani et al. 2015) prevent cache stampedes probabilistically without requiring distributed mutex locks?
- A) It deletes the cache entry randomly after 1 millisecond.
- B) While the cache entry is still valid, incoming reads evaluate the condition $-\beta \cdot \delta \cdot \ln(\text{rand}()) > \text{TTL}_{\text{remaining}}$, where $\delta$ is the computation time; as expiration nears, the probability of an early background refresh smoothly approaches 1.0, ensuring exactly one worker refreshes the value before it expires.
- C) It stores all cached items in a static hash table in the client's browser.
- D) It routes all cache misses to a secondary database replica.
<details><summary>Answer</summary>

**B.** XFetch computes early probabilistic expiration. When $\text{TTL}_{\text{remaining}}$ is large, the probability of early refresh is near zero. As expiration approaches (within a window proportional to the computation cost $\delta$ and tuning factor $\beta$), a random draw triggers an early refresh while returning the cached value immediately to the caller, preventing cache gaps.
- Why not A: Deleting entries prematurely increases database load.
- Why not C: Browser storage does not coordinate backend server load.
- Why not D: Hitting a replica still duplicates expensive computation and wastes read capacity.
- Ref: [modules/09-caching-theory-and-consistency.md](../modules/09-caching-theory-and-consistency.md#probabilistic-early-expiration-the-xfetch-algorithm), Vattani et al. (VLDB 2015)
</details>

### Q-DATA-043 · Caching Theory · difficulty 3 · scenario
Under the Cache-Aside pattern with updates, consider two operations: Write (updates database and invalidates cache) and Read (on cache miss, queries database and populates cache). If a developer implements the write as: `Update Cache -> Update Database`, what dangerous concurrency bug occurs?
- A) Deadlock in the operating system kernel.
- B) Stale Cache State / Inconsistent Dual-Write: If the database update fails (e.g. constraint violation), the cache holds mutated uncommitted data that never persisted to the database.
- C) Memory exhaustion in the application server.
- D) Immediate eviction of all other keys in the cache.
<details><summary>Answer</summary>

**B.** Modifying the cache before the database commits creates dirty data if the database transaction aborts. Even if the database succeeds, concurrent writes can interleave (`W1 cache -> W2 cache -> W2 DB -> W1 DB`), causing the database to hold $W_1$'s value while the cache permanently holds $W_2$'s value. Correct practice updates the database first and then invalidates (deletes) the cache entry.
- Why not A: User-space cache updates do not trigger OS kernel deadlocks.
- Why not C: Updating a single key does not exhaust server memory.
- Why not D: Redis LRU evicts based on memory pressure, not individual key update sequences.
- Ref: [modules/09-caching-theory-and-consistency.md](../modules/09-caching-theory-and-consistency.md#caching-topologies-and-patterns)
</details>

### Q-DATA-044 · Caching Theory · difficulty 2 · multi
Which of the following characteristics distinguish Window TinyLFU (used in modern high-performance caches like Caffeine) from traditional LRU? (Select TWO)
- A) It uses a compact Count-Min Sketch to estimate historical access frequency without maintaining heavy per-item counters.
- B) It maintains a small admission window cache for new items; when full, an incoming item must compete with the eviction candidate of the main cache based on historical frequency before being admitted.
- C) It never evicts any item from memory once written.
- D) It encrypts all cache keys using SHA-256 to accelerate hash lookups.
<details><summary>Answer</summary>

**A and B.**
- A is correct: TinyLFU uses 4-bit Count-Min Sketches with periodic halving (aging) to track long-term access frequency using only a fraction of a byte per key.
- B is correct: The W-TinyLFU policy admits new keys into a window cache ($1\%$ of space) and only promotes them to the main cache if their frequency exceeds the victim's frequency, resisting scan pollution.
- Why not C: Memory is finite; caches must evict candidates when capacity is reached.
- Why not D: Hashing keys with cryptographic SHA-256 severely slows down cache lookup latency.
- Ref: [modules/09-caching-theory-and-consistency.md](../modules/09-caching-theory-and-consistency.md#cache-replacement-policies-lru-lfu-and-window-tinylfu), Manasse et al. (2017)
</details>

### Q-DATA-045 · Caching Theory · difficulty 2 · single
What is the difference between Write-Through and Write-Back (Write-Behind) caching?
- A) Write-Through updates cache and database synchronously before acknowledging the client; Write-Back updates the cache immediately and asynchronously flushes dirty entries to the database in background batches.
- B) Write-Through only caches reads; Write-Back only caches writes.
- C) Write-Through runs on client devices; Write-Back runs on database servers.
- D) Write-Through guarantees zero memory usage; Write-Back uses 100% of RAM.
<details><summary>Answer</summary>

**A.** Write-Through guarantees immediate durability across both tiers at the cost of write latency. Write-Back provides near-instantaneous write latency and high throughput by buffering writes in cache, but introduces a risk of data loss if the cache server fails before dirty buffers are flushed to the database.
- Why not B: Both patterns handle write mutations.
- Why not C: Both are backend caching topologies.
- Why not D: Memory consumption is governed by eviction boundaries, not write topology.
- Ref: [modules/09-caching-theory-and-consistency.md](../modules/09-caching-theory-and-consistency.md#caching-topologies-and-patterns)
</details>

---

## Domain 10: Encoding, Binary Serialization & Schema Evolution

### Q-DATA-046 · Encoding & Serialization · difficulty 2 · single
How does Protocol Buffers (Protobuf) encode integers efficiently on the wire while preserving backward compatibility when field names change?
- A) It transmits ASCII strings of field names and integer values separated by semicolons.
- B) It identifies fields using numeric field tags (tag numbers) combined with wire types, and encodes integers using variable-length varints (7 bits of payload and 1 continuation bit per byte).
- C) It compresses records using GZIP before transmission.
- D) It maps all integers to 64-bit IEEE floating-point values.
<details><summary>Answer</summary>

**B.** Protobuf uses field tags rather than field names. When an application renames a field, the wire format is unaffected because the tag number remains unchanged. Varint encoding strips leading zero bytes, compressing small integers (e.g. 1) down to a single byte.
- Why not A: Text-based key-value formats (like JSON/XML) suffer from large payloads and high CPU parsing overhead.
- Why not C: Compression can be applied optionally, but it is not the foundational wire encoding format.
- Why not D: Floating-point conversions introduce rounding errors and byte overhead.
- Ref: [modules/10-encoding-serialization-and-schema-evolution.md](../modules/10-encoding-serialization-and-schema-evolution.md#binary-encoding-mechanics-varints-and-zigzag), [10-schema-evolution.test.ts](../examples/10-schema-evolution.test.ts)
</details>

### Q-DATA-047 · Encoding & Serialization · difficulty 2 · single
Why does Protocol Buffers utilize ZigZag encoding for signed integers (`sint32`, `sint64`) before applying standard Varint encoding?
- A) ZigZag encoding encrypts sensitive data against network sniffing.
- B) Under standard two's complement, small negative numbers (like -1) have their most significant bit set to 1, causing standard Varint to expand them into 10 bytes; ZigZag maps signed numbers onto positive integers ($0 \rightarrow 0, -1 \rightarrow 1, 1 \rightarrow 2, -2 \rightarrow 3$), allowing small negative numbers to encode in 1 or 2 bytes.
- C) ZigZag encoding eliminates the need for endianness handling.
- D) ZigZag encoding prevents floating-point overflow.
<details><summary>Answer</summary>

**B.** Two's complement representation of $-1$ is `0xFFFFFFFFFFFFFFFF` in 64 bits. A standard varint scans 7 bits at a time until no high bits remain, consuming 10 full bytes for $-1$. ZigZag interleaves positive and negative values ($(n \ll 1) \oplus (n \gg 63)$), ensuring values with small absolute magnitudes consume few bytes regardless of sign.
- Why not A: ZigZag is an integer representation mapping, not encryption.
- Why not C: Varints are inherently byte-stream oriented; ZigZag does not alter endianness.
- Why not D: ZigZag operates on integers, not floating-point numbers.
- Ref: [modules/10-encoding-serialization-and-schema-evolution.md](../modules/10-encoding-serialization-and-schema-evolution.md#binary-encoding-mechanics-varints-and-zigzag)
</details>

### Q-DATA-048 · Encoding & Serialization · difficulty 3 · scenario
In Apache Avro binary serialization, records are encoded without any field tags or type markers. How does a consumer decode the binary byte stream, and what is required to maintain Full Compatibility?
- A) The consumer guesses the fields using machine learning.
- B) The consumer must possess both the exact Writer's Schema (used when the message was encoded) and the Reader's Schema (used by the application); Avro resolves field differences by mapping matching field names, requiring newly added fields to define default values.
- C) Avro prepends the full JSON schema text to every individual 50-byte message on the network.
- D) Avro converts binary streams into CSV files before parsing.
<details><summary>Answer</summary>

**B.** Avro achieves dense serialization by omitting tags and delimiters from the binary payload; values are written consecutively. The reader needs the writer's schema (retrieved via schema registry ID or file header) and its own reader's schema. To maintain full compatibility (both forward and backward), any newly added or deleted field must specify a default value.
- Why not A: Binary parsers require deterministic schemas, not statistical guesses.
- Why not C: Prepending schema text to every message would ruin wire efficiency.
- Why not D: Avro decodes binary directly into in-memory object representations.
- Ref: [modules/10-encoding-serialization-and-schema-evolution.md](../modules/10-encoding-serialization-and-schema-evolution.md#apache-avro-schema-resolution-without-tags)
</details>

### Q-DATA-049 · Encoding & Serialization · difficulty 2 · multi
Which of the following modifications maintain Backward Compatibility in a binary schema evolution system (e.g. Protobuf or Avro)? (Select TWO)
- A) Adding an optional field with an explicit default value.
- B) Deleting a required field that has no default value.
- C) Renaming a Protobuf field while keeping its numeric field tag number unchanged.
- D) Changing the wire data type of a field from a string to a nested repeated struct.
<details><summary>Answer</summary>

**A and C.**
- A is correct: A new reader can successfully read data written by an old writer because the absent field is populated with the default value.
- C is correct: In Protobuf, the wire format only encodes field tag numbers; field names exist solely in generated code, so renaming a field does not break compatibility.
- Why not B: Deleting a required field causes older readers to fail validation when parsing new records.
- Why not D: Altering wire types violates wire decoding rules and corrupts field extraction.
- Ref: [modules/10-encoding-serialization-and-schema-evolution.md](../modules/10-encoding-serialization-and-schema-evolution.md#schema-evolution-rules-backward-forward-and-full)
</details>

### Q-DATA-050 · Encoding & Serialization · difficulty 2 · single
What is the function of the 5-byte framing header commonly prepended to Kafka messages when using the Confluent Schema Registry?
- A) 1 byte magic prefix (0x00) + 4-byte big-endian Schema Registry schema ID, allowing consumers to look up the exact writer's schema from the registry cache before decoding the remaining Avro/Protobuf bytes.
- B) 5 bytes of random cryptographic salt.
- C) 5 bytes specifying the user ID who submitted the message.
- D) 5 bytes containing the message creation timestamp in nanoseconds.
<details><summary>Answer</summary>

**A.** The Confluent framing standard uses byte 0 as the magic byte (currently `0x00`) followed by bytes 1–4 representing the 32-bit schema ID registered in the schema registry. The consumer extracts this ID, fetches the writer schema from its local cache, and parses the remaining payload without embedding full schemas in each message.
- Why not B: Framing headers provide format metadata, not encryption salt.
- Why not C: User IDs are application payload fields or Kafka message headers.
- Why not D: Timestamps are stored natively in Kafka's record batch metadata format.
- Ref: [modules/10-encoding-serialization-and-schema-evolution.md](../modules/10-encoding-serialization-and-schema-evolution.md#schema-registries-in-distributed-pipelines)
</details>

---

## Domain 11: Stream Processing, Event Logs & Compaction

### Q-DATA-051 · Stream Processing · difficulty 2 · single
What core principle defines the Stream-Table Duality in distributed data systems?
- A) Streams and tables cannot be used in the same architecture.
- B) A stream is a changelog of mutations over time; a table is a materialized view representing the latest state at a point in time. Materializing a stream yields a table; taking the changelog of a table yields a stream.
- C) Tables are stored on disk; streams can only exist in CPU caches.
- D) Streams can only store numeric values, while tables only store strings.
<details><summary>Answer</summary>

**B.** The stream-table duality (formalized in Kafka Streams and Apache Flink) proves that streams and tables are two representations of the same underlying data: $\text{Table} = \int \text{Stream} \, dt$ (aggregating an append-only stream of changelog events yields current state), and $\text{Stream} = \frac{d(\text{Table})}{dt}$ (capturing mutations on a table yields a changelog stream).
- Why not A: Modern data pipelines frequently integrate stream-table operations (e.g. stream-table joins).
- Why not C: Streaming logs (Kafka commit log) persist on disk; tables can exist in-memory or on disk.
- Why not D: Both structures support arbitrary schemas and data types.
- Ref: [modules/11-stream-processing-and-event-logs.md](../modules/11-stream-processing-and-event-logs.md#the-stream-table-duality), [11-stream-table-duality.test.ts](../examples/11-stream-table-duality.test.ts)
</details>

### Q-DATA-052 · Stream Processing · difficulty 2 · single
In an Apache Kafka topic configured with `cleanup.policy=compact`, how does log compaction handle record deletion?
- A) It deletes the entire partition when disk space runs out.
- B) A producer writes a record with the key to delete and a `null` payload (a tombstone); the compaction thread retains the latest value per key, preserves the tombstone across a configurable retention window (`delete.retention.ms`), and then purges all records for that key.
- C) Consumers send an HTTP DELETE request to the Kafka broker.
- D) Log compaction runs an immediate `VACUUM FULL` lock on the partition.
<details><summary>Answer</summary>

**B.** Log compaction preserves the latest state for each key. To signal a deletion, a tombstone record (key with null value) is appended. The cleaner retains this tombstone during compaction so that downstream consumers can process the delete; after `delete.retention.ms` elapses, the cleaner removes the tombstone permanently.
- Why not A: Compaction operates per-record based on keys; it does not drop entire partitions.
- Why not C: Kafka brokers process produce/fetch protocols, not HTTP deletes for individual log offsets.
- Why not D: Compaction runs continuously in the background without locking client readers.
- Ref: [modules/11-stream-processing-and-event-logs.md](../modules/11-stream-processing-and-event-logs.md#log-compaction-mechanics)
</details>

### Q-DATA-053 · Stream Processing · difficulty 3 · scenario
A streaming application calculating hourly revenue metrics receives event timestamps generated on mobile clients. Due to intermittent network connectivity, some checkout events arrive 45 minutes after their client-side event timestamp. How does a modern stream processing engine (e.g. Apache Flink) correctly handle this out-of-order data?
- A) By dropping all events that do not arrive in strict ascending timestamp order.
- B) By using Event-Time processing guided by Watermarks, which establish a temporal threshold indicating that no further events with timestamp $t \le W$ are expected, and optionally routing late arrivals to a side-output stream.
- C) By converting event timestamps to current broker arrival timestamps (Processing-Time).
- D) By pausing the entire stream pipeline for 45 minutes whenever any client disconnects.
<details><summary>Answer</summary>

**B.** Processing-time measures broker clock time, corrupting historical aggregations when network delays occur. Event-time evaluates the timestamps embedded in the events themselves. Watermarks act as temporal progress markers ($W(t)$), allowing windows to close deterministically while handling late-arriving events via allowed lateness or side outputs.
- Why not A: Silently dropping late events corrupts revenue calculations.
- Why not C: Processing-time assigns late data to the wrong analytical window.
- Why not D: Pausing pipelines destroys throughput and violates real-time processing requirements.
- Ref: [modules/11-stream-processing-and-event-logs.md](../modules/11-stream-processing-and-event-logs.md#windowing-semantics-event-time-vs-processing-time)
</details>

### Q-DATA-054 · Stream Processing · difficulty 3 · single
How does Apache Kafka guarantee "Exactly-Once Semantics" (EOS) across a consume-transform-produce streaming loop?
- A) By eliminating consumer groups and running all transformations on a single node.
- B) By combining idempotent producers (using sequence numbers and Producer IDs to eliminate network retries) with a two-phase transactional coordinator that writes consumer offsets and output messages atomically within a single transaction commit marker.
- C) By forcing consumers to execute distributed two-phase commit with client web browsers.
- D) By disabling network acknowledgments on the broker.
<details><summary>Answer</summary>

**B.** Kafka EOS combines: (1) Idempotent producer deduplication via monotonically increasing PID sequence numbers, and (2) Transactional coordination where consumer offset commits (`__consumer_offsets`) and produced output records are bound in an atomic transaction; downstream consumers configured with `read_committed` only observe messages once transaction commit markers are written.
- Why not A: Scaling requires partitioning across consumer groups.
- Why not C: Client browsers do not participate in Kafka broker transactions.
- Why not D: Disabling ACKs leads to severe data loss, destroying all correctness guarantees.
- Ref: [modules/11-stream-processing-and-event-logs.md](../modules/11-stream-processing-and-event-logs.md#processing-guarantees-at-least-once-vs-exactly-once)
</details>

### Q-DATA-055 · Stream Processing · difficulty 2 · multi
Which of the following statements are correct regarding Kafka consumer group partition rebalancing? (Select TWO)
- A) Eager rebalancing stops all consumers in the group, revokes all partition assignments, and reassigns them from scratch, causing a stop-the-world processing pause.
- B) Cooperative Sticky rebalancing revokes only the specific partitions that must migrate from one consumer to another, allowing unaffected consumers to continue processing without downtime.
- C) A single partition can be concurrently processed by multiple active consumers within the same consumer group.
- D) Rebalances only occur when a Kafka broker experiences hardware disk failure.
<details><summary>Answer</summary>

**A and B.**
- A is correct: Legacy eager rebalancing revokes all partitions across the entire consumer group before reassigning them, resulting in high latency spikes.
- B is correct: Incremental Cooperative Rebalancing (KIP-429) migrates only the subset of partitions being reassigned, preserving continuous throughput for all other partitions.
- Why not C: In a consumer group, each partition is strictly assigned to at most one consumer instance at any time to preserve ordering.
- Why not D: Rebalances are triggered by consumer additions, removals, crashes, or partition count changes.
- Ref: [modules/11-stream-processing-and-event-logs.md](../modules/11-stream-processing-and-event-logs.md#the-commit-log-abstraction-and-consumer-groups)
</details>

---

## Domain 12: Architectural Decision Matrix, CAP/PACELC & Polyglot

### Q-DATA-056 · Architecture & CAP · difficulty 2 · single
According to Abadi's PACELC theorem, what does a distributed system face when there is NO network partition ($E$)?
- A) It faces no trade-offs and achieves zero latency with infinite consistency.
- B) Else ($E$), the system must trade off Latency ($L$) versus Consistency ($C$).
- C) It must elect a new leader every 10 seconds.
- D) It automatically converts to a relational database.
<details><summary>Answer</summary>

**B.** The PACELC theorem extends CAP: If there is a Partition ($P$), how does the system choose between Availability ($A$) and Consistency ($C$)? Else ($E$, when the network is normal), how does the system choose between Latency ($L$) and Consistency ($C$)? Even during normal operation, replicating synchronously to maintain consistency adds latency.
- Why not A: Speed-of-light network latency and coordination overhead make trade-offs unavoidable.
- Why not C: Leader elections are triggered by heartbeats, not continuous periodic re-elections.
- Why not D: PACELC applies universally across relational and non-relational distributed systems.
- Ref: [modules/12-architectural-decision-matrix-and-polyglot-persistence.md](../modules/12-architectural-decision-matrix-and-polyglot-persistence.md#cap-vs-pacelc-formal-trade-offs), Abadi (2012)
</details>

### Q-DATA-057 · Architecture & CAP · difficulty 3 · scenario
Under the PACELC classification, how are Amazon DynamoDB (with default eventual consistency) and Google Cloud Spanner classified?
- A) DynamoDB is PA/EL; Spanner is PC/EC.
- B) DynamoDB is PC/EC; Spanner is PA/EL.
- C) Both are PA/EL systems.
- D) Both are PC/EL systems.
<details><summary>Answer</summary>

**A.** Under network partitions, DynamoDB prioritizes Availability ($PA$), and during normal execution it minimizes Latency by serving reads from a single replica with eventual consistency ($EL$). Google Cloud Spanner prioritizes Consistency during partitions ($PC$) using Paxos quorums, and enforces strict Linearizable consistency during normal execution ($EC$) via TrueTime atomic clocks.
- Why not B, C, D: DynamoDB's design trade-off is latency and availability; Spanner's core invariant is strict serializable consistency.
- Ref: [modules/12-architectural-decision-matrix-and-polyglot-persistence.md](../modules/12-architectural-decision-matrix-and-polyglot-persistence.md#cap-vs-pacelc-formal-trade-offs)
</details>

### Q-DATA-058 · Architecture & CAP · difficulty 2 · multi
Which storage architectural differences distinguish OLTP (Online Transaction Processing) from OLAP (Online Analytical Processing) systems? (Select TWO)
- A) OLTP systems typically use row-oriented storage (e.g. slotted pages) to optimize point reads and atomic row updates; OLAP systems use columnar storage (e.g. Parquet, ClickHouse) to optimize sequential scans over a subset of columns.
- B) OLTP systems execute multi-terabyte aggregations over years of historical data; OLAP systems execute short sub-millisecond point updates.
- C) OLAP systems use vectorized execution and dictionary/run-length encoding to maximize CPU SIMD instruction throughput on bulk column scans.
- D) OLTP engines never maintain indexes.
<details><summary>Answer</summary>

**A and C.**
- A is correct: Row layout excels at writing and retrieving complete individual records (OLTP); column layout stores individual attribute arrays contiguously, reading only the queried columns (OLAP).
- C is correct: Columnar engines process data in CPU vector registers (SIMD) and compress uniform data types using RLE and Bit-Packing.
- Why not B: The workloads are inverted; OLTP handles short point transactions, while OLAP handles large-scale analytical aggregations.
- Why not D: OLTP systems rely heavily on B+Tree secondary indexes.
- Ref: [modules/12-architectural-decision-matrix-and-polyglot-persistence.md](../modules/12-architectural-decision-matrix-and-polyglot-persistence.md#workload-taxonomy-oltp-vs-olap-vs-htap)
</details>

### Q-DATA-059 · Architecture & CAP · difficulty 3 · scenario
An organization designs a polyglot persistence architecture. Financial payments require strict serializability and referential integrity; high-velocity IoT metrics require 500,000 writes/sec with automated downsampling; user search requires fuzzy typographical matching; user sessions require sub-millisecond key-value lookups. Which storage engine selection maps correctly to these requirements?
- A) Payments: MongoDB; IoT: PostgreSQL; Search: Redis; Sessions: Elasticsearch.
- B) Payments: PostgreSQL/Spanner (ACID relational); IoT: ClickHouse/Timescale (columnar/LSM time-series); Search: Elasticsearch/OpenSearch (BM25 inverted index); Sessions: Redis (in-memory key-value).
- C) Store all workloads in a single SQLite file hosted on an NFS network share.
- D) Payments: Redis; IoT: Memcached; Search: Cassandra; Sessions: ClickHouse.
<details><summary>Answer</summary>

**B.** Polyglot persistence maps specialized workloads to engines optimized for their data access characteristics: ACID relational for financial ledgers, columnar/time-series for telemetry ingestion, inverted indexes for lexical search, and in-memory key-value for transient session caches.
- Why not A, D: Mismatches workloads (e.g. running fuzzy search on Redis or payments on in-memory caches).
- Why not C: Hosting SQLite over NFS destroys concurrency, risks file corruption, and cannot handle enterprise write throughput.
- Ref: [modules/12-architectural-decision-matrix-and-polyglot-persistence.md](../modules/12-architectural-decision-matrix-and-polyglot-persistence.md#the-architectural-decision-matrix)
</details>

### Q-DATA-060 · Architecture & CAP · difficulty 2 · single
What architectural mechanism enables HTAP (Hybrid Transactional/Analytical Processing) databases (such as TiDB or SingleStore) to execute analytical queries without impacting concurrent OLTP transactions?
- A) All data is copied to CSV files once per week.
- B) The storage engine maintains dual representations: an LSM/row-based engine for real-time OLTP mutations (e.g. TiKV), and an asynchronously replicated columnar engine (e.g. TiFlash) updated via Raft Learner nodes that execute analytical scans without consuming transactional locks.
- C) It disables all concurrency control locks in the database.
- D) It runs all OLTP transactions exclusively in RAM and discards them upon server shutdown.
<details><summary>Answer</summary>

**B.** Modern HTAP systems decouple transactional row-oriented consensus groups from analytical replicas. A dedicated columnar replica participates in the consensus cluster as a non-voting Raft learner. OLAP queries are routed to the columnar engine, eliminating lock contention on the row engine.
- Why not A: Weekly batch exports are legacy ETL, not real-time HTAP.
- Why not C: Disabling locks destroys transactional consistency.
- Why not D: Discarding data violates durability.
- Ref: [modules/12-architectural-decision-matrix-and-polyglot-persistence.md](../modules/12-architectural-decision-matrix-and-polyglot-persistence.md#workload-taxonomy-oltp-vs-olap-vs-htap)
</details>

---

## Comprehensive Hands-On & Algorithmic Scenarios

### Q-DATA-061 · Storage Engines · difficulty 3 · hands-on
In an in-memory B+Tree index implementation, a leaf node has a maximum capacity of 3 keys ($M = 3$). A leaf currently contains keys `[10, 20, 30]`. Key `25` is inserted. 
What is the exact sequence of structural modifications according to standard B+Tree split algorithms?
- A) Keys become `[10, 20, 25, 30]`; no split occurs.
- B) The leaf node overflows to temporary array `[10, 20, 25, 30]`. It splits into left leaf `[10, 20]` and right leaf `[25, 30]`. The first key of the right leaf (`25`) is copied up into the parent internal node as the separator key, and sibling pointers are updated.
- C) Key 10 is deleted from the tree to make space for 25.
- D) The entire tree is converted into an inverted index.
<details><summary>Answer</summary>

**B.** When a leaf node exceeds capacity $M$, it splits into two leaves of size $\lceil M/2 \rceil$ and $\lfloor M/2 \rfloor + 1$. In a B+Tree (unlike a classic B-Tree), leaf nodes store all actual data records, so the split separator key (`25`) is *copied* (retained) in the right leaf and pushed up into the parent internal node to route future queries.
- Why not A: Exceeding maximum capacity violates B+Tree node constraints.
- Why not C: B+Trees never discard valid existing data keys during an insert.
- Why not D: Inverted index conversion is completely unrelated to B+Tree leaf splits.
- Ref: [modules/02-storage-engines-b-trees-and-lsm.md](../modules/02-storage-engines-b-trees-and-lsm.md#b-trees-and-variants-b-trees-and-lehman-yao-b-link-trees), [02-bplus-tree.test.ts](../examples/02-bplus-tree.test.ts)
</details>

### Q-DATA-062 · Transactions & Concurrency · difficulty 3 · scenario
Two concurrent transactions execute under Snapshot Isolation on an inventory table with starting balance 100:
- $T_1$ reads balance = 100, decrements by 40, writes balance = 60.
- Simultaneously, $T_2$ reads balance = 100, decrements by 30, writes balance = 70.
$T_1$ commits first. When $T_2$ attempts to commit, what happens under the first-committer-wins rule?
- A) $T_2$ commits successfully, overwriting balance with 70 (Lost Update).
- B) $T_2$ aborts with a serialization failure / write-conflict error because $T_1$ already committed a mutation to the same row while $T_2$ was executing.
- C) $T_2$ automatically merges the two updates to balance = 30 without application intervention.
- D) The database locks permanently until an administrator intervenes.
<details><summary>Answer</summary>

**B.** Under Snapshot Isolation's first-committer-wins rule, when a transaction attempts to update a row that was concurrently modified and committed by another transaction after its snapshot started, the engine detects a write-write conflict and aborts the second transaction with a serialization failure.
- Why not A: Allowing $T_2$ to overwrite $T_1$'s update would cause a Lost Update anomaly ($P4$), which Snapshot Isolation explicitly prevents.
- Why not C: Standard relational engines do not automatically compute operational transforms or merge mathematical business logic without explicit retry loops or atomic `UPDATE ... SET balance = balance - 30`.
- Why not D: Write-conflict aborts are handled immediately by the transaction manager.
- Ref: [modules/05-transactions-acid-and-isolation-levels.md](../modules/05-transactions-acid-and-isolation-levels.md#multi-version-concurrency-control-mvcc-internals), [05-mvcc-transaction-manager.test.ts](../examples/05-mvcc-transaction-manager.test.ts)
</details>

### Q-DATA-063 · Storage Engines · difficulty 3 · scenario
An LSM-tree storage engine receives a deletion for key `"user_99"`. How is the deletion physically represented on disk, and when is the key's storage space finally reclaimed?
- A) The engine searches all SSTables on disk, locates the page containing `"user_99"`, and rewrites that page with zeroes immediately.
- B) The engine appends a Tombstone record (`key: "user_99", value: null`) to the MemTable and WAL. Space is only reclaimed later when background Compaction merges all SSTable levels containing the key and purges the tombstone once it reaches the bottom-most level.
- C) The engine throws a `FileNotFoundException` because deletions are not supported.
- D) The engine deletes the entire SSTable file where the key originally lived.
<details><summary>Answer</summary>

**B.** LSM-Trees are append-only. A deletion cannot perform random disk seeks to remove historical records in immutable SSTables. Instead, a tombstone marker is appended sequentially. During background multi-way merge-sort (compaction), older versions of the key and the tombstone itself are dropped once no older SSTable levels contain references to the key.
- Why not A: In-place disk rewriting would destroy the append-only write throughput advantage of LSM-trees.
- Why not C: Deletions are a core primitive supported by all LSM engines (RocksDB, Cassandra, Pebble).
- Why not D: Deleting an entire SSTable would discard all other non-deleted keys residing in that file.
- Ref: [modules/02-storage-engines-b-trees-and-lsm.md](../modules/02-storage-engines-b-trees-and-lsm.md#log-structured-merge-trees-lsm-and-ss-tables), [03-mini-lsm.test.ts](../examples/03-mini-lsm.test.ts)
</details>

### Q-DATA-064 · Durability & Recovery · difficulty 3 · hands-on
During ARIES crash recovery Analysis, the engine discovers:
- Transaction $T_1$ logged `COMMIT` at LSN 50.
- Transaction $T_2$ logged `UPDATE` at LSN 60, but has no `COMMIT` or `ABORT` record before the crash.
Which transaction belongs to the Loser Transactions set, and what action is performed on its changes during recovery?
- A) $T_1$ is a loser; its changes are undone.
- B) $T_2$ is a loser; its modifications are rolled back in reverse chronological order during the Undo phase, generating Compensation Log Records (CLRs).
- C) Both $T_1$ and $T_2$ are committed automatically.
- D) Neither transaction is modified.
<details><summary>Answer</summary>

**B.** Any transaction that was active at the time of the crash without an explicit `COMMIT` record is classified as a "loser" (uncommitted transaction). In ARIES, all changes by $T_2$ are rolled back during the Undo pass. As each change is undone, a CLR is written to prevent duplicate rollback if another crash occurs.
- Why not A: $T_1$ committed before the crash; its changes are durable and preserved during the Redo pass.
- Why not C: Uncommitted transactions cannot be committed without violating Atomicity.
- Why not D: Leaving $T_2$'s uncommitted writes in place would leave the database in an inconsistent state.
- Ref: [modules/06-durability-wal-and-crash-recovery.md](../modules/06-durability-wal-and-crash-recovery.md#the-three-passes-of-aries-analysis-redo-undo), [06-aries-wal-recovery.test.ts](../examples/06-aries-wal-recovery.test.ts)
</details>

### Q-DATA-065 · Replication & Quorums · difficulty 3 · scenario
In a 5-node Cassandra cluster ($N = 5$), a client executes a write with `ConsistencyLevel = QUORUM` and a read with `ConsistencyLevel = QUORUM`. 
What are the exact integer values of $W$ and $R$, and does this configuration guarantee strong consistency?
- A) $W = 2, R = 2$; No ($W + R = 4 \le 5$, stale reads possible).
- B) $W = 3, R = 3$; Yes ($W + R = 6 > 5$, quorums strictly overlap).
- C) $W = 5, R = 1$; Yes, but writes fail if any node is down.
- D) $W = 1, R = 5$; Yes, but reads fail if any node is down.
<details><summary>Answer</summary>

**B.** In quorum consensus, $\text{QUORUM} = \lfloor N/2 \rfloor + 1$. For $N = 5$, $\text{QUORUM} = \lfloor 5/2 \rfloor + 1 = 3$. 
Thus, $W = 3$ and $R = 3$. Because $W + R = 3 + 3 = 6 > 5$, any read quorum intersects with any write quorum on at least $6 - 5 = 1$ replica, mathematically guaranteeing strong consistency.
- Why not A: A quorum of 5 is 3, not 2.
- Why not C, D: Setting $W=5$ is `ConsistencyLevel = ALL`, not `QUORUM`.
- Ref: [modules/07-replication-mechanics-and-consensus.md](../modules/07-replication-mechanics-and-consensus.md#leaderless-replication-and-dynamo-style-quorums), [07-replication-quorum.test.ts](../examples/07-replication-quorum.test.ts)
</details>

---

## 60-Minute Mock Technical Examination

This mock examination simulates a senior/staff storage systems engineering interview round.
- **Time Limit**: 60 minutes
- **Total Questions**: 20
- **Passing Score**: 80% (16 / 20 correct)

### Mock Examination Questions
1. Domain 01: [Q-DATA-002](#q-data-002--data-models--difficulty-2--multi)
2. Domain 01: [Q-DATA-004](#q-data-004--data-models--difficulty-3--scenario)
3. Domain 02: [Q-DATA-006](#q-data-006--storage-engines--difficulty-2--single)
4. Domain 02: [Q-DATA-007](#q-data-007--storage-engines--difficulty-2--single)
5. Domain 02: [Q-DATA-008](#q-data-008--storage-engines--difficulty-3--scenario)
6. Domain 03: [Q-DATA-012](#q-data-012--indexing-theory--difficulty-3--scenario)
7. Domain 03: [Q-DATA-013](#q-data-013--indexing-theory--difficulty-2--multi)
8. Domain 04: [Q-DATA-016](#q-data-016--buffer-management--difficulty-2--single)
9. Domain 04: [Q-DATA-018](#q-data-018--buffer-management--difficulty-3--scenario)
10. Domain 05: [Q-DATA-022](#q-data-022--transactions--acid--difficulty-3--scenario)
11. Domain 05: [Q-DATA-023](#q-data-023--transactions--acid--difficulty-3--single)
12. Domain 06: [Q-DATA-026](#q-data-026--durability--wal--difficulty-2--single)
13. Domain 06: [Q-DATA-028](#q-data-028--durability--wal--difficulty-3--single)
14. Domain 07: [Q-DATA-031](#q-data-031--replication--difficulty-2--single)
15. Domain 07: [Q-DATA-033](#q-data-033--replication--difficulty-3--single)
16. Domain 08: [Q-DATA-037](#q-data-037--partitioning--routing--difficulty-3--scenario)
17. Domain 09: [Q-DATA-042](#q-data-042--caching-theory--difficulty-3--single)
18. Domain 10: [Q-DATA-047](#q-data-047--encoding--serialization--difficulty-2--single)
19. Domain 11: [Q-DATA-054](#q-data-054--stream-processing--difficulty-3--single)
20. Domain 12: [Q-DATA-057](#q-data-057--architecture--cap--difficulty-3--scenario)

---

### Scoring Key & Competency Evaluation
- **19–20 Correct (95–100%)**: **Staff / Principal Systems Architect**. Flawless mastery of storage engines, concurrency anomalies, distributed consensus, and physical I/O boundaries.
- **16–18 Correct (80–90%)**: **Senior Distributed Systems Engineer**. Solid operational and theoretical foundation; ready to design high-throughput storage pipelines.
- **12–15 Correct (60–75%)**: **Systems Practitioner**. Understands core concepts but exhibits gaps in deep mechanical trade-offs (e.g. SSI graph tracking, ARIES CLR recovery, or RUM trade-offs).
- **$< 12$ Correct ($< 60\%$)**: **Foundational Gap**. Review the 12 curriculum modules and verify concepts against the runnable test suites in `examples/`.
