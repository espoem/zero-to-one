# Data Systems Architecture Bilingual Terminology Glossary

This glossary provides authoritative English ↔ Czech definitions of core data systems architecture concepts, storage engine mechanics, transaction isolation theory, distributed replication primitives, and indexing data structures. All definitions and explanations are written in English, pairing canonical English computer systems nomenclature with established Czech technical equivalents.

---

## 1. Data Models, Relational Algebra & Normal Forms

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Relational Algebra** | **Relační algebra** | A formal mathematical query system consisting of algebraic operations ($\sigma, \pi, \bowtie, \cup, \cap, -$) that take relations as input and produce relations as output. | E. F. Codd (1970) |
| **Functional Dependency ($X \rightarrow Y$)** | **Funkční závislost ($X \rightarrow Y$)** | A mathematical constraint stating that the value of attribute set $X$ uniquely and deterministically determines the value of attribute set $Y$ within relation $R$. | Armstrong's Axioms (1974) |
| **First Normal Form (1NF)** | **První normální forma (1NF)** | The property of a relation where every attribute domain contains only atomic (indivisible) scalar values and there are no repeating groups or nested relations. | Relational Database Theory |
| **Second Normal Form (2NF)** | **Druhá normální forma (2NF)** | The property where a relation is in 1NF and every non-prime attribute is fully functionally dependent on every candidate key (no partial dependencies on a proper subset of a key). | Codd (1971) |
| **Third Normal Form (3NF)** | **Třetí normální forma (3NF)** | The property where a relation is in 2NF and has no transitive functional dependencies of non-prime attributes on candidate keys ($X \rightarrow Y \implies X$ is a superkey or $Y$ is prime). | Codd (1971) |
| **Boyce-Codd Normal Form (BCNF)** | **Boyce-Coddova normální forma (BCNF)** | A strict variant of 3NF requiring that for every non-trivial functional dependency $X \rightarrow Y$, the determinant $X$ must be a superkey. | Boyce & Codd (1974) |
| **Multivalued Dependency ($X \twoheadrightarrow Y$)** | **Vícehodnotová závislost ($X \twoheadrightarrow Y$)** | A dependency where the presence of a pair of tuples implies the presence of other tuples with the same $X$ value, representing independent multi-attribute sets. | Fagin (1977) |
| **Fourth Normal Form (4NF)** | **Čtvrtá normální forma (4NF)** | The property where a relation is in BCNF and every non-trivial multivalued dependency $X \twoheadrightarrow Y$ has $X$ as a superkey, eliminating independent multi-attribute cross-product anomalies. | Fagin (1977) |
| **Schema-on-Write** | **Schéma při zápisu** | Traditional relational model where data structures and column types are explicitly defined and validated before data can be persisted. | Kleppmann (DDIA) |
| **Schema-on-Read** | **Schéma při čtení** | Document/data-lake approach where raw data is saved without upfront structural enforcement, and parsing/typing is performed dynamically by reader queries. | Kleppmann (DDIA) |

---

## 2. Storage Engines: Slotted Pages, B-Trees & LSM-Trees

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Slotted Page** | **Stránka se slotovým polem (slotted page)** | A physical disk page layout dividing the block into a forward-growing slot index array (Tuple IDs) and backward-growing variable-length data tuples, preventing external fragmentation. | Ramakrishnan & Gehrke |
| **Tuple ID / Record ID (RID)** | **Identifikátor záznamu (RID / TID)** | A physical indirection pointer consisting of `(PageNumber, SlotNumber)` uniquely identifying a row's location within a storage file. | CMU 15-445 |
| **B+Tree** | **B+ strom** | A self-balancing search tree data structure where all actual data records reside in leaf nodes, linked sequentially via sibling pointers, and internal nodes store only routing keys. | Comer (1979) |
| **Lehman-Yao B-link Tree** | **B-link strom dle Lehmana a Yao** | A concurrent B-Tree variant where every internal and leaf node contains a right-sibling pointer and a high-key, allowing lock-free reader traversals even during concurrent node splits. | Lehman & Yao (1981) |
| **Log-Structured Merge-Tree (LSM)** | **LSM strom (logově strukturovaný slučovací strom)** | A write-optimized storage architecture that appends updates to an in-memory MemTable (backed by a sequential WAL) and periodically flushes immutable, sorted SSTables to tiered disk levels. | O'Neil et al. (1996) |
| **MemTable** | **Paměťová tabulka (MemTable)** | An in-memory sorted data structure (typically a SkipList or Red-Black Tree) buffering incoming writes in an LSM storage engine before disk flush. | Chang et al. (Bigtable, 2006) |
| **Sorted String Table (SSTable)** | **Setříděná tabulka řetězců (SSTable)** | An immutable disk file containing ordered key-value pairs indexed by an internal sparse index block and an auxiliary Bloom filter. | Chang et al. (Bigtable, 2006) |
| **Tombstone** | **Náhrobní záznam (tombstone)** | An explicit deletion marker appended to an append-only commit log or MemTable to shadow older versions of a key until background compaction purges it. | LSM Storage Architecture |
| **Compaction** | **Kompakce (slučování SSTables)** | The background process in an LSM engine that reads multiple overlapping SSTables, merges them via $k$-way merge-sort, eliminates tombstones and overwritten keys, and writes new consolidated SSTables. | RocksDB / Cassandra Internals |
| **Size-Tiered Compaction (STCS)** | **Velikostně stupňovitá kompakce (STCS)** | Compaction strategy that groups SSTables of similar size together and merges them into a larger SSTable, optimizing write throughput at the cost of high space amplification. | Apache Cassandra Documentation |
| **Leveled Compaction (LCS)** | **Úrovňová kompakce (LCS)** | Compaction strategy where disk storage is divided into levels ($L_0, L_1, L_2 \dots$) with exponential capacity ratios, ensuring key ranges in Level $\ge 1$ never overlap, minimizing read amplification. | Google LevelDB / RocksDB |
| **RUM Conjecture** | **RUM hypotéza (kompromis čtení, zápisu a paměti)** | The theorem stating that a storage engine can optimize at most two of three design dimensions: Read overhead, Update overhead, and Memory/storage amplification. | Athanassoulis et al. (2016) |

---

## 3. Indexing Theory, Lexical Search & Vector ANN

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Inverted Index** | **Invertovaný index** | An indexing data structure mapping each unique lexical term (token) to a sorted postings list of document identifiers containing that term. | Manning, Raghavan & Schütze |
| **Okapi BM25** | **Relevanční skórovací funkce Okapi BM25** | A non-linear probabilistic term-ranking function that incorporates term frequency saturation ($k_1$) and document length normalization ($b$) to rank lexical query relevance. | Robertson & Jones (1994) |
| **Approximate Nearest Neighbor (ANN)** | **Aproximativní vyhledávání nejbližších sousedů (ANN)** | Algorithmic techniques that search for vectors closest to a query embedding in high-dimensional metric space with bounded recall trade-offs for orders-of-magnitude faster query latency. | Indyk & Motwani (1998) |
| **Hierarchical Navigable Small World (HNSW)** | **Hierarchický graf malého světa (HNSW)** | A multi-layer graph-based vector ANN index providing logarithmic search complexity by structuring vectors into skip-list-like hierarchical layers of long-distance and short-distance edges. | Malkov & Yashunin (2018) |
| **Product Quantization (PQ)** | **Produktová kvantizace (PQ)** | A vector compression algorithm that partitions high-dimensional vectors into orthogonal sub-vectors, quantizes each sub-space into cluster centroids, and stores compact integer centroid IDs. | Jégou et al. (2011) |
| **Scalar Quantization (SQ8)** | **Skalární kvantizace (SQ8)** | Uniform linear mapping of 32-bit floating-point vector dimensions onto 8-bit unsigned integers, providing a $4\times$ memory reduction with minimal loss of geometric angular fidelity. | Vector Database Internals |
| **Bloom Filter** | **Bloomův filtr** | A space-efficient probabilistic data structure using $k$ independent hash functions over a bit array of size $m$ to test set membership with zero false negatives and a bounded false positive rate. | Burton H. Bloom (1970) |

---

## 4. Buffer Management, Paging & Operating System I/O

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Buffer Pool Manager** | **Správce vyrovnávací paměti stránek (Buffer Pool)** | A database subsystem responsible for allocating a fixed pool of memory frames, caching disk blocks, tracking pin counts, and flushing dirty pages to storage. | CMU 15-445 / Stonebraker (1981) |
| **Pin Count / Latch** | **Počet referencí (pin count) a rámcový zámek (latch)** | Pin count tracks the number of concurrent query threads reading or modifying a page frame in memory (preventing eviction); latches provide mutual exclusion for frame data structures. | Database Systems Internals |
| **CLOCK Eviction Algorithm** | **Hodinový algoritmus vyřazování stránek (CLOCK)** | An efficient approximation of Least Recently Used (LRU) that sweeps frames circularly using a single reference usage bit, providing second-chance retention without lock contention on cache hits. | F. J. Corbató (1968) |
| **2Q Page Replacement** | **Dvoufrontový algoritmus nahrazování stránek (2Q)** | A scan-resistant buffer replacement policy that routes initial page loads into a FIFO probation queue ($A1$) and only promotes repeatedly referenced pages to an LRU queue ($Am$). | Johnson & Shasha (1994) |
| **Direct I/O (`O_DIRECT`)** | **Přímé diskové I/O (`O_DIRECT`)** | An operating system file flag that bypasses the kernel page cache entirely, reading and writing blocks directly between user-space memory buffers and storage controllers. | Linux I/O Subsystem |
| **Fsyncgate** | **Aféra fsyncgate (chyba správy chyb v Linux kernelu)** | The historical vulnerability where the Linux kernel cleared dirty page bits upon background writeback failure, causing subsequent `fsync()` calls to falsely report success. | PostgreSQL Development Community (2018) |
| **`io_uring`** | **Asynchronní I/O rozhraní `io_uring`** | A high-performance Linux kernel interface that uses shared lockless ring buffers (submission and completion queues) to execute truly asynchronous, batched, zero-copy system calls. | Jens Axboe (2019) |

---

## 5. Concurrency Control, Isolation Levels & MVCC

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **ACID Guarantees** | **ACID vlastnosti (Atomicity, Consistency, Isolation, Durability)** | The four foundational guarantees of database transactions: Atomicity (all-or-nothing), Consistency (state invariant preservation), Isolation (concurrency control), Durability (persistence after commit). | Haerder & Reuter (1983) |
| **Multi-Version Concurrency Control (MVCC)** | **Víceverzové řízení souběhu (MVCC)** | A concurrency mechanism where data updates create new row versions stamped with transaction IDs (`xmin`/`xmax`), allowing readers to access consistent historical snapshots without blocking writers. | Bernstein & Goodman (1981) |
| **Snapshot Isolation (SI)** | **Izolace snímkem (Snapshot Isolation)** | An isolation level where a transaction observes a static, internally consistent snapshot of the database taken at transaction begin, and writes are validated via the first-committer-wins rule. | Berenson et al. (1995) |
| **Write Skew ($G\text{-skew}$)** | **Anomálie vychýlení zápisu (Write Skew)** | An isolation anomaly under Snapshot Isolation where concurrent transactions evaluate a shared constraint over overlapping rows, execute disjoint updates, and both commit, violating the global constraint. | Berenson et al. (1995) |
| **Serializable Snapshot Isolation (SSI)** | **Serializovatelná izolace snímkem (SSI)** | A lock-free serializable concurrency control algorithm that dynamically tracks read-write anti-dependency edges ($rw$) between transactions and aborts a transaction if dangerous cycles form. | Cahill, Rohm & Fekete (2008) |
| **Two-Phase Locking (2PL)** | **Dvoufázové zamykání (2PL)** | A pessimistic concurrency protocol guaranteeing conflict serializability by dividing lock operations into a growing phase (locks acquired, none released) and a shrinking phase (locks released, none acquired). | Eswaran et al. (1976) |
| **Optimistic Concurrency Control (OCC)** | **Optimistické řízení souběhu (OCC)** | A transaction protocol that executes reads and writes without locks in local private workspaces, validates for conflicting modifications at commit time, and aborts on conflict. | Kung & Robinson (1981) |

---

## 6. Durability, Write-Ahead Logging & ARIES Crash Recovery

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Write-Ahead Logging (WAL)** | **Předstihový deník (WAL)** | The foundational durability invariant requiring that log records describing a change must be flushed to non-volatile storage before corresponding dirty database pages are written to disk. | Gray (1978) |
| **Log Sequence Number (LSN)** | **Sekvenční číslo záznamu v deníku (LSN)** | A 64-bit monotonically increasing byte offset in the write-ahead log used to track page modifications (`pageLSN`) and checkpoint positions (`checkpointLSN`). | Mohan et al. (ARIES, 1992) |
| **Steal / No-Force Policy** | **Zásada Steal / No-Force** | Steal allows uncommitted dirty pages to be written to disk to free buffer frames (requires UNDO); No-Force permits a transaction to commit without immediately flushing dirty data pages to disk (requires REDO). | Haerder & Reuter (1983) |
| **ARIES Recovery Algorithm** | **Algoritmus zotavení po havárii ARIES** | Algorithms for Recovery and Isolation Exploiting Semantics: A formal 3-pass crash recovery system utilizing Analysis, Repeating History (Redo), and Rollback (Undo) with CLRs. | Mohan, Haderle, Lindsay, Pirahesh, Schwarz (1992) |
| **Compensation Log Record (CLR)** | **Kompenzační záznam v deníku (CLR)** | A special WAL record logged during the Undo phase describing an undone action; it contains an `UndoNextLSN` pointer, ensuring crash recovery is strictly idempotent and never undoes an undo. | Mohan et al. (ARIES, 1992) |
| **Dirty Page Table (DPT)** | **Tabulka špinavých stránek (DPT)** | An in-memory data structure tracked during runtime and reconstructed during recovery Analysis recording every unwritten dirty page in the buffer pool and its earliest unwritten `recLSN`. | ARIES Protocol |
| **Fuzzy Checkpointing** | **Fuzzy (neblokující) kontrolní bod** | A non-blocking checkpointing mechanism that writes active transaction tables and DPT metadata to the log without pausing concurrent transactions or forcing dirty pages to disk. | Mohan et al. (ARIES, 1992) |
| **Group Commit** | **Skupinové potvrzení (Group Commit)** | An engine optimization that batches synchronous `fsync()` log flushes for multiple concurrent committing transactions into a single physical disk I/O write call. | DeWitt et al. (1984) |

---

## 7. Replication Mechanics, Quorums & Distributed Consensus

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Read-Your-Writes Consistency** | **Konzistence čtení vlastních zápisů** | A consistency model guaranteeing that after a user submits a mutation, any subsequent read by that same user will always observe that mutation or a newer state. | Terry et al. (1994) |
| **Monotonic Reads** | **Monotonní čtení** | A session consistency guarantee ensuring that after a client observes a particular data version, they will never subsequently observe an older version of that data. | Terry et al. (1994) |
| **Quorum Consensus ($W + R > N$)** | **Kvorum konsenzu ($W + R > N$)** | A leaderless replication rule stating that strong consistency is preserved across $N$ nodes if write quorum $W$ and read quorum $R$ overlap by at least one replica ($W + R > N$). | Gifford (1979) |
| **Read Repair** | **Oprava při čtení (Read Repair)** | An opportunistic healing mechanism in leaderless systems where a client detecting divergent versions across a read quorum immediately writes the latest version back to stale nodes. | Dynamo Paper (DeCandia et al. 2007) |
| **Fencing Token** | **Ohraničující token (fencing token)** | A monotonically increasing integer issued with a distributed lease that the underlying storage validates, rejecting writes from expired or zombie lock holders. | Martin Kleppmann (2016) |
| **Raft Consensus Algorithm** | **Konsenzuální algoritmus Raft** | An understandable distributed consensus algorithm designed around leader election, log replication, and committed index safety invariants. | Ongaro & Ousterhout (2014) |

---

## 8. Partitioning, Consistent Hashing & Routing

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Consistent Hashing** | **Konzistentní hashování** | A distributed routing technique that maps both nodes and keys onto a circular hash ring, guaranteeing that adding or removing a node migrates only $1/N$ of keys on average. | Karger et al. (1997) |
| **Virtual Nodes (vnodes)** | **Virtuální uzly (vnodes)** | The technique of mapping each physical server to multiple discrete positions on a consistent hash ring to balance statistical key distribution and accommodate heterogeneous hardware. | Dynamo Paper (2007) |
| **Document-Partitioned Index (Local)** | **Index dělený dle dokumentů (lokální sekundární index)** | Secondary index design where index entries are stored on the same shard as the primary data tuple, requiring scatter-gather queries across all shards to evaluate search predicates. | Kleppmann (DDIA) |
| **Term-Partitioned Index (Global)** | **Index dělený dle termínů (globální sekundární index)** | Secondary index design where index entries are partitioned by search term across dedicated shards, enabling single-shard lookups but requiring cross-shard updates on data mutations. | Kleppmann (DDIA) |
| **Scatter-Gather** | **Dotazování metodou Scatter-Gather** | A query pattern where a coordinator broadcasts sub-queries to all partitioned shards simultaneously and aggregates the returned responses into a final result set. | Distributed Query Processing |
| **Tail at Scale** | **Problém dlouhého konce latence (Tail at Scale)** | The phenomenon where query latency across a high fan-out cluster is dominated by the slowest single shard outlier (due to GC pauses, background I/O, or network jitter). | Dean & Barroso (CACM 2013) |

---

## 9. Caching Theory, Cache Topologies & Invalidation

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Cache-Aside (Lazy Loading)** | **Vzor Cache-Aside (líné načítání do mezipaměti)** | Application architecture where the application queries the cache first, reads from the database upon a cache miss, and populates the cache for subsequent readers. | Cloud Architecture Patterns |
| **Cache Stampede (Thundering Herd)** | **Lavina dotazů na mezipaměť (Cache Stampede)** | The failure mode where an expired hot cache key causes hundreds of concurrent application threads to query the database simultaneously, exhausting database connection pools. | Vattani et al. (2015) |
| **XFetch Algorithm** | **Pravděpodobnostní algoritmus XFetch** | A probabilistic early expiration formula ($-\beta \cdot \delta \cdot \ln(\text{rand}()) > \text{TTL}_{\text{remaining}}$) that triggers an asynchronous cache refresh before key expiration, eliminating stampedes. | Vattani et al. (VLDB 2015) |
| **Write-Through Caching** | **Průchozí zápis do mezipaměti (Write-Through)** | Caching strategy where writes synchronously update both the cache and the backing persistent storage before acknowledging success to the caller. | Storage Systems Design |
| **Write-Back Caching (Write-Behind)** | **Zpětný zápis do mezipaměti (Write-Back)** | Caching strategy where writes update the cache immediately and an asynchronous background worker flushes batched dirty entries to the persistent database. | Caching Architectures |
| **Window TinyLFU (W-TinyLFU)** | **Frekvenčně řízené vyřazování W-TinyLFU** | An admission-based cache replacement policy combining a small LRU admission window with a Count-Min Sketch frequency filter to protect the main cache against scan pollution. | Manasse et al. (2017) |

---

## 10. Binary Serialization, Encoding & Schema Evolution

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Variable-Length Quantity (Varint)** | **Celočíselný formát s proměnnou délkou (Varint)** | A binary integer encoding using 7 bits per byte for payload data and the most significant bit (MSB) as a continuation flag, compressing small integers into fewer bytes. | Google Protocol Buffers Specification |
| **ZigZag Encoding** | **Klikaté kódování (ZigZag encoding)** | A mathematical mapping of signed integers onto unsigned integers ($(n \ll 1) \oplus (n \gg 31)$) so that negative numbers with small absolute values can be efficiently compressed by Varints. | Protocol Buffers Internals |
| **Field Tag Number** | **Číselný identifikátor pole (tag number)** | An integer identifier embedded in binary protocols (e.g. Protobuf) to represent a field on the wire instead of transmitting human-readable string field names. | Protobuf Encoding Specification |
| **Backward Compatibility** | **Zpětná kompatibilita** | The schema property where code written with a newer schema version can successfully read data that was serialized using an older schema version. | Schema Evolution Theory |
| **Forward Compatibility** | **Dopředná kompatibilita** | The schema property where code written with an older schema version can successfully read data that was serialized using a newer schema version (ignoring unrecognised fields). | Schema Evolution Theory |
| **Schema Registry** | **Registr schémat (Schema Registry)** | A centralized distributed service that stores and versions message schemas (Avro, Protobuf, JSON Schema) and validates wire-compatibility rules during publishing. | Confluent Platform Architecture |

---

## 11. Stream Processing, Event Logs & Compaction

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Commit Log** | **Potvrzovací deník událostí (Commit Log)** | An append-only, totally ordered sequence of immutable records written to disk, serving as the foundational architectural primitive for distributed event streams. | Jay Kreps (2013) |
| **Stream-Table Duality** | **Dualita proudu a tabulky (Stream-Table Duality)** | The mathematical relationship stating that a stream represents a changelog of mutations over time, and a table represents the aggregated state at a specific point in time. | Kafka Streams / Apache Flink |
| **Log Compaction** | **Kompakce deníku (Log Compaction)** | A retention policy in an event log that purges older historical records for each key, retaining only the single latest record or tombstone per unique primary key. | Apache Kafka Architecture |
| **Event-Time vs. Processing-Time** | **Čas události vs. Čas zpracování** | Event-Time is the timestamp embedded in the event at the source device; Processing-Time is the local wall-clock time of the stream engine node processing the event. | Akidau et al. (Google Dataflow, 2015) |
| **Watermark** | **Časová značka postupu (Watermark)** | A monotonic temporal progress metric ($W(t)$) in stream engines asserting that the engine expects no further events with event-time timestamps older than $t$. | Google MillWheel / Apache Flink |
| **Idempotent Producer** | **Idempotentní producent** | A message publisher that tags messages with unique Producer IDs (PIDs) and sequence numbers, allowing brokers to discard network duplicate writes transparently. | Kafka Eos Architecture |

---

## 12. Workload Classification, CAP/PACELC & System Architecture

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **CAP Theorem** | **CAP teorém (teorém o kompromisu distribuovaných systémů)** | The formal theorem stating that in an asynchronous network subject to partitions ($P$), a distributed data store can guarantee at most Consistency ($C$) or Availability ($A$), but not both. | Eric Brewer (2000) / Gilbert & Lynch (2002) |
| **PACELC Theorem** | **PACELC teorém (rozšířený teorém kompromisů)** | The theorem stating that if there is a Partition ($P$), choose Availability ($A$) or Consistency ($C$); Else ($E$), choose Latency ($L$) or Consistency ($C$). | Daniel Abadi (2012) |
| **Linearizability** | **Linearizovatelnost (silná konzistence)** | A recency guarantee requiring that once any read or write completes globally, all subsequent operations on all nodes must observe that state or a newer state (appears as a single atomic copy). | Herlihy & Wing (1990) |
| **Online Transaction Processing (OLTP)** | **Transakční zpracování (OLTP)** | Workloads characterized by high-volume, low-latency point reads and updates over individual row tuples, prioritizing ACID atomicity and concurrency. | Database Architecture |
| **Online Analytical Processing (OLAP)** | **Analytické zpracování (OLAP)** | Workloads characterized by long-running complex aggregation queries scanning billions of records over a subset of columns, prioritizing columnar compression and vectorized execution. | Data Warehousing Architecture |
| **Hybrid Transactional/Analytical Processing (HTAP)** | **Hybridní transakční a analytické zpracování (HTAP)** | An architecture combining row-based transactional consensus with asynchronous columnar analytical replicas in a single unified distributed system. | Gartner (2014) |
| **Polyglot Persistence** | **Vícejazyčná persistence (polyglot persistence)** | The architectural practice of utilizing different specialized database storage engines within a single system to match distinct workload access patterns. | Martin Fowler (2011) |
