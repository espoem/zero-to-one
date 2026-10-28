# Module 01 — Architecture, Process, Memory & Setup

Welcome to **Module 01** of the PostgreSQL 18 Curriculum. This module provides a comprehensive, academically grounded, and production-tested architectural analysis of PostgreSQL 18. We examine how client requests flow through dedicated backend processes, explore the formal mechanics of Inter-Process Communication (IPC) and synchronization primitives (Spinlocks, LWLocks, Heavyweight Locks), analyze the memory hierarchy and the classic dual-caching problem, dissect the physical 8KB page format at the byte level, and investigate the revolutionary PostgreSQL 18 **Asynchronous I/O (AIO)** subsystem, **OAuth 2.0 / OpenID Connect** authentication, and **default block-level data checksums**.

---

## 1. Core Terminology & Concept Definitions

To establish unambiguous vocabulary across this curriculum, the following architectural terms are formally defined:

- **Postmaster (`postgres`)**: The central supervisor daemon that initializes shared memory segments, coordinates background worker processes, monitors socket endpoints (default TCP port 5432), and forks dedicated backend processes for authenticated client sessions.
- **Backend Process**: A dedicated, single-threaded operating system process spawned by the Postmaster to parse, plan, rewrite, and execute SQL statements, manage local transaction states, and allocate session-private memory.
- **Shared Buffers (`shared_buffers`)**: The primary shared memory region where PostgreSQL caches relation pages (heap, index, free space, and visibility maps), managed via a clock-sweep page replacement algorithm to avoid physical disk I/O.
- **Work Memory (`work_mem`)**: Private, per-backend memory allocated dynamically for in-memory sorting (`ORDER BY`, `DISTINCT`), hash tables (`Hash Join`, `HashAggregate`), and merge joins. Crucially, a single complex query containing multiple sort and hash operations can allocate multiple `work_mem` allocations simultaneously.
- **Maintenance Work Memory (`maintenance_work_mem`)**: Private memory reserved for large-scale utility operations, such as `VACUUM`, `CREATE INDEX`, `REINDEX`, and `ALTER TABLE ADD FOREIGN KEY`.
- **Asynchronous I/O (AIO)**: The unified non-blocking I/O subsystem in PostgreSQL 18 that offloads disk reads and writes to kernel ring buffers (such as Linux `io_uring` or POSIX AIO), eliminating backend blocking during sequential scans, bitmap heap scans, and background flushes.
- **Disk Page (Block)**: The fixed-size fundamental allocation unit of PostgreSQL storage (default 8192 bytes / 8KB). All tables and indexes are physically stored as contiguous arrays of 8KB blocks.
- **Tuple (Heap Row)**: The physical record stored within an 8KB disk page, comprising a 23-byte `HeapTupleHeaderData` binary header followed by an optional NULL-bitmap and aligned user data fields.
- **Free Space Map (FSM)**: A binary fork (`<relfilenode>_fsm`) accompanying each relation that tracks available free space within individual 8KB pages using a binary tree structure to accelerate tuple placement.
- **Visibility Map (VM)**: A bitmap fork (`<relfilenode>_vm`) tracking which 8KB pages contain tuples visible to all active transactions, enabling index-only scans to bypass heap lookups and allowing `VACUUM` to skip frozen pages.
- **Data Checksums**: 16-bit CRC algorithms computed for every 8KB disk block upon disk write and verified upon disk read to detect silent data corruption, storage bit-rot, and hardware failures (enabled by default in PostgreSQL 18).

---

## 2. Process Architecture & Lifecycle

PostgreSQL utilizes a multi-process, shared-memory architecture rather than a multi-threaded architecture. Each connected client communicates with an independent backend process. This design provides hardware-enforced fault isolation: a catastrophic memory error or segfault in one client session cannot corrupt the memory space or crash other concurrent sessions.

```mermaid
flowchart TD
    Client1["Client Application 1"] -->|"TCP Socket Connect"| Postmaster["Postmaster Daemon (postgres)"]
    Client2["Client Application 2"] -->|"TCP Socket Connect"| Postmaster
    Client3["Client Application 3"] -->|"TCP Socket Connect"| Postmaster

    Postmaster -->|"fork()"| Backend1["Backend Process 1<br/>(Private Memory: work_mem)"]
    Postmaster -->|"fork()"| Backend2["Backend Process 2<br/>(Private Memory: work_mem)"]
    Postmaster -->|"fork()"| Backend3["Backend Process 3<br/>(Private Memory: work_mem)"]

    subgraph BackgroundWorkers["Background Utility Worker Fleet"]
        BGWriter["Background Writer (bgwriter)"]
        Checkpointer["Checkpointer Process"]
        WALWriter["WAL Writer"]
        AutoVacuum["Autovacuum Launcher & Workers"]
        Archiver["WAL Archiver"]
        StatsCollector["Cumulative Statistics Subsystem"]
    end

    Postmaster -.-> BackgroundWorkers

    subgraph SharedMemoryArea["PostgreSQL Shared Memory Pool (IPC / mmap)"]
        SharedBuffers["shared_buffers (8KB Buffer Pool)"]
        WALBuffers["wal_buffers (In-Flight WAL Records)"]
        LockManager["Lock Manager & IPC Hash Tables"]
        ProcArray["ProcArray (Global Active Transactions)"]
    end

    Backend1 <--> SharedMemoryArea
    Backend2 <--> SharedMemoryArea
    Backend3 <--> SharedMemoryArea
    BackgroundWorkers <--> SharedMemoryArea
```

### The Background Worker Fleet

1. **Checkpointer**: Periodically establishes global durability synchronization points. It flushes dirty shared buffers to persistent storage, writes a checkpoint WAL record, guarantees data durability up to that Log Sequence Number (LSN), and updates `pg_control`.
2. **Background Writer (`bgwriter`)**: Continuously scans `shared_buffers` using a clock-sweep algorithm, identifying dirty pages and writing them to storage asynchronously ahead of demand. This ensures that incoming backend queries finding page misses can immediately claim clean buffer slots without suffering synchronous disk write latency.
3. **WAL Writer**: Periodically flushes unwritten Write-Ahead Log records from `wal_buffers` to disk storage even if active transactions have not yet reached commit, reducing commit wait latency.
4. **Autovacuum Launcher & Workers**: Dynamically monitors table modification and dead-tuple generation rates via the cumulative statistics system, spawning ephemeral worker processes to reclaim dead tuple storage and update column distribution statistics.
5. **Archiver**: Copies completed 16MB WAL segment files to disaster recovery targets or cloud object storage when WAL archiving is active (`archive_mode = on`).
6. **Cumulative Statistics System**: Tracks cluster-wide telemetry (tuple reads, inserts, index scans, buffer hits) directly in shared memory hash tables.

---

## 3. Inter-Process Communication (IPC) & Synchronization Primitives

Because PostgreSQL processes run in isolated address spaces, coordination relies on shared memory segments (`mmap(MAP_SHARED | MAP_ANONYMOUS)` on modern POSIX systems) and a strict hierarchy of synchronization primitives:

```mermaid
flowchart LR
    subgraph SyncHierarchy["PostgreSQL Synchronization Hierarchy"]
        direction TB
        Spin["1. Spinlocks<br/>• Hardware test-and-set atomics<br/>• Microsecond duration<br/>• No sleeping, tight CPU spin"]
        LWLock["2. Lightweight Locks (LWLocks)<br/>• Shared / Exclusive modes<br/>• Short durations (buffer reads/writes)<br/>• Supports sleep queues via semaphores"]
        HWLock["3. Heavyweight Locks (Lock Manager)<br/>• Full SQL transaction locks<br/>• 8 Lock Modes (AccessShare to AccessExclusive)<br/>• Supports Deadlock Detection (Wait-For Graph)"]
        Spin --> LWLock --> HWLock
    end
```

1. **Spinlocks**: Lowest-level atomic primitives implemented via hardware assembly (`test-and-set` or `compare-and-swap`). Used to protect tiny internal data structures (e.g., buffer header state flags) for a few CPU cycles. Spinlocks do not yield the CPU to the OS scheduler; they busy-wait in a bounded loop.
2. **Lightweight Locks (LWLocks)**: Provide shared (read) and exclusive (write) access control to shared data structures, such as buffer pool page contents and hash table buckets. If an LWLock is unavailable, the backend yields the CPU and blocks on an OS semaphore or condition variable.
3. **Heavyweight Locks (Regular Locks)**: Managed by the centralized Lock Manager in shared memory. These provide ACID transactional concurrency control across SQL entities (tables, pages, tuples). The Lock Manager maintains a global **Wait-For Graph** and runs an asynchronous deadlock detection algorithm if a process remains blocked beyond `deadlock_timeout` (default: 1 second).

---

## 4. Memory Architecture & Sizing Dynamics

Memory in PostgreSQL is strictly segregated into **Global Shared Memory** (allocated once at postmaster startup) and **Process-Local Memory** (allocated dynamically per backend session).

```mermaid
flowchart LR
    subgraph GlobalShared["Global Shared Memory (Persistent across sessions)"]
        direction TB
        SB["shared_buffers<br/>(Cached 8KB Heap & Index Pages)"]
        WB["wal_buffers<br/>(Cached WAL Records)"]
        LM["Lock Manager Space<br/>(Lock Hash Tables & Buckets)"]
        PA["ProcArray<br/>(Transaction IDs & Snapshots)"]
    end

    subgraph ProcessLocal["Backend Local Memory (Allocated per query operation)"]
        direction TB
        WM["work_mem<br/>(Sorting, Hashing, Materialize)"]
        MWM["maintenance_work_mem<br/>(VACUUM, REINDEX, DDL)"]
        TB["temp_buffers<br/>(Session Temporary Tables)"]
        CC["Catalog & Plan Cache<br/>(Prepared Statements)"]
    end

    ProcessLocal <--> GlobalShared
```

### The Dual-Caching Problem & Operating System Buffer Dynamics

When a PostgreSQL backend reads an 8KB page from disk, the data passes through two distinct caching layers:
1. **Operating System Page Cache**: The Linux kernel caches raw storage blocks in unallocated physical RAM.
2. **PostgreSQL `shared_buffers`**: PostgreSQL copies the block into its internal buffer pool, where it can be directly queried and modified.

```mermaid
flowchart TD
    DiskStorage["NVMe / SSD Storage"] -->|"POSIX read() / AIO"| KernelCache["Linux OS Page Cache"]
    KernelCache -->|"memcpy() into shared memory"| SharedBuf["PostgreSQL shared_buffers"]
    SharedBuf -->|"Tuple slot extraction"| BackendLocal["Backend Local Memory (work_mem)"]
```

#### Shared Buffers Sizing Rule of Thumb
On dedicated database instances:
- Set `shared_buffers` to **25% of total system RAM** (e.g., 16GB on a 64GB host).
- Sizing `shared_buffers` higher than 40%–50% of RAM frequently causes performance degradation due to **double-buffering overhead**, inefficient operating system page writeback interactions, and increased memory pressure on dirty page flushing.
- The remaining 75% of RAM is actively utilized by the OS page cache for sequential readahead, file system caching, and backend `work_mem` allocations.

#### Local Memory Sizing & OOM Protection
`work_mem` is allocated **per operator**, not per connection. A single complex query with 4 joins and 2 sorts can allocate:
$$\text{Memory Allocated} = \text{Active Operators} \times \text{work\_mem} \times \text{Parallel Workers}$$

If 100 concurrent connections execute queries containing 5 sort/hash nodes with `work_mem = 64MB`, peak local memory demand reaches:
$$100 \times 5 \times 64\,\text{MB} = 32\,\text{GB}$$
Exceeding physical RAM forces the Linux Out-Of-Memory (OOM) killer to terminate the postmaster.
Always ensure:
$$\text{shared\_buffers} + (\text{max\_connections} \times \text{work\_mem} \times 2) < \text{Total Physical RAM}$$

---

## 5. Connection Topologies: Connection Costs & Pooling Architectures

Creating a new PostgreSQL connection requires:
1. An operating system `fork()` system call by the Postmaster.
2. Duplicating file descriptor tables and memory pages via Copy-On-Write (COW).
3. Establishing TLS handshakes and authenticating via SCRAM-SHA-256 or OAuth.
4. Loading relation catalog caches (`syscache` and `relcache`) into backend local memory (~5MB–10MB resident set size per idle connection).

```mermaid
flowchart TD
    subgraph ClientPoolers["Connection Pooling Modes (e.g. PgBouncer)"]
        direction TB
        subgraph SessionMode["1. Session Pooling"]
            S_Desc["Connection tied to client for entire session lifecycle.<br/>• Full SQL feature support.<br/>• Low connection capacity."]
        end
        subgraph TxMode["2. Transaction Pooling (Recommended)"]
            T_Desc["Connection released to pool immediately upon COMMIT/ROLLBACK.<br/>• Massive scalability (thousands of clients to 50 backends).<br/>• Session-level features restricted."]
        end
        subgraph StmtMode["3. Statement Pooling"]
            St_Desc["Connection released after each individual SQL statement.<br/>• Multi-statement transactions prohibited.<br/>• Strictly read-only or single-query workloads."]
        end
    end
```

### Session State Restrictions in Transaction Pooling:
When operating under transaction pooling:
- **Prepared Statements**: Must be executed using client-side unnamed prepared statements or pool-aware protocol extensions.
- **Session-level variables**: `SET timezone = 'UTC'` persists only for the transaction unless `SET LOCAL` is used.
- **Temporary Tables**: Session temporary tables disappear or leak to subsequent clients; temporary tables should be avoided in favor of explicit transient schemas or CTEs.
- **Advisory Locks**: Session-level advisory locks must be replaced by transaction-level locks (`pg_advisory_xact_lock()`).

---

## 6. The PostgreSQL 18 Asynchronous I/O (AIO) Subsystem

Prior to PostgreSQL 18, when a backend encountered a page miss in `shared_buffers`, it executed a blocking POSIX `read()` or `pread()` system call. While waiting for disk storage, the CPU core remained idle, serializing disk operations and causing substantial throughput bottlenecks on high-IOPS NVMe hardware.

PostgreSQL 18 introduces a native **Asynchronous I/O (AIO)** subsystem built upon modern kernel interfaces:
- **Linux `io_uring`**: Submits batches of I/O requests directly via kernel shared submission queues (SQ) and reaps completions via completion queues (CQ) without incurring system call overhead per block.
- **POSIX AIO / Worker Thread Pool**: Fallback mechanism for platforms lacking native `io_uring` support.

```mermaid
sequenceDiagram
    autonumber
    participant Backend as Backend Process
    participant SharedBuf as shared_buffers Cache
    participant AIO as PostgreSQL 18 AIO Engine
    participant Kernel as Linux io_uring Subsystem
    participant Storage as NVMe Storage Controller

    Backend->>SharedBuf: Lookup Blocks 800..807
    SharedBuf-->>Backend: Blocks 800..807 Cache Miss
    Backend->>AIO: Submit Asynchronous Prefetch Request (800..807)
    AIO->>Kernel: io_uring_enter(SQE Batch of 8 Reads)
    Note over Backend: Backend continues processing earlier rows or parsing plan!
    Storage-->>Kernel: DMA Transfer Complete
    Kernel-->>AIO: CQE Event Ready
    AIO->>SharedBuf: Populate Buffer Slots Directly
    Backend->>SharedBuf: Retrieve Blocks 800..807 (Zero Wait Hit!)
```

### Impact of AIO on Execution Engines:
1. **Sequential Scans**: The engine prefetches pages in large contiguous windows ahead of the scan pointer.
2. **Bitmap Heap Scans**: The physical block numbers collected from index leaf pages are scheduled via AIO concurrently, converting random page reads into an optimal parallel I/O pipeline.
3. **VACUUM & Checkpointing**: Dirty page writebacks are issued in asynchronous batches, preventing I/O spikes from stalling query backends.

---

## 7. Physical Storage Layout: Files, Forks & The 8KB Page

### The `$PGDATA` Directory Layout
A PostgreSQL database cluster resides within a single file system directory tree:

```
$PGDATA/
├── PG_VERSION          # Text file containing major version number ("18")
├── base/                # Per-database storage directories (named by database OID)
│   ├── 1/               # template1 database
│   └── 16384/           # Primary application database
│       ├── 16390        # Main data fork for relation OID 16390 (up to 1GB per segment)
│       ├── 16390.1      # Secondary segment (if table exceeds 1GB)
│       ├── 16390_fsm    # Free Space Map fork
│       └── 16390_vm     # Visibility Map fork
├── global/              # Cluster-wide shared catalogs (pg_database, pg_authid)
├── pg_wal/              # 16MB Write-Ahead Log segment files (e.g. 000000010000000000000001)
├── pg_tblspc/           # Symbolic links to external tablespace mount paths
├── pg_hba.conf          # Client authentication host-based access control configuration
└── postgresql.conf      # Core configuration parameter file
```

### Binary Anatomy of an 8KB Disk Page

Every table and B-Tree index relation is stored as an array of 8192-byte blocks. The page layout is designed for variable-length tuple insertion without requiring whole-page compaction:

```mermaid
flowchart TD
    subgraph BlockFormat["8192-Byte Disk Page Internal Layout"]
        Header["PageHeaderData (24 bytes)<br/>• pd_lsn (8 bytes): LSN of last WAL record updating this page<br/>• pd_checksum (2 bytes): PostgreSQL 18 CRC-16 Checksum<br/>• pd_flags (2 bytes): Page status flags (e.g. PD_ALL_VISIBLE)<br/>• pd_lower (2 bytes): Byte offset to end of line pointers<br/>• pd_upper (2 bytes): Byte offset to start of unallocated space<br/>• pd_special (2 bytes): Offset to special space (used by indexes)"]
        
        LinePointers["Line Pointer Array (ItemIdData, 4 bytes each)<br/>• Item 1: (offset, flags, length)<br/>• Item 2: (offset, flags, length)<br/>• Item 3: (offset, flags, length)<br/>(Grows downward toward page center)"]
        
        FreeHole["Unallocated Free Space Hole<br/>(Between pd_lower and pd_upper)"]
        
        TupleData["Raw Heap Tuple Data<br/>• Tuple 3 (HeapTupleHeaderData + User Data)<br/>• Tuple 2<br/>• Tuple 1<br/>(Grows upward toward page center)"]
        
        Special["Special Space (0 bytes for Heap; stores B-Tree sibling links in Indexes)"]
    end

    Header --> LinePointers
    LinePointers --> FreeHole
    FreeHole --> TupleData
    TupleData --> Special
```

#### Tuple Addressing: The `ItemPointer` (`ctid`)
Every physical row version in a heap table is addressed by an immutable physical tuple identifier (`ctid`), represented as a pair of integers:
$$\text{ctid} = (\text{BlockNumber}, \text{OffsetNumber})$$
For example, `(42, 3)` references the 3rd line pointer on the 42nd disk block of that relation file. B-Tree index leaf entries store this exact `ctid` to point directly to heap rows.

---

## 8. Authentication & Security: `pg_hba.conf`, SCRAM & OAuth 2.0

Client authorization is enforced via `$PGDATA/pg_hba.conf`. Each non-comment record follows the schema:
$$\text{TYPE} \quad \text{DATABASE} \quad \text{USER} \quad \text{ADDRESS} \quad \text{METHOD} \quad [\text{OPTIONS}]$$

```
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             postgres                                peer
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256
host    production_db   api_service     10.0.0.0/8              scram-sha-256
host    analytics_db    data_engineer   10.0.0.0/8              oauth oauth_issuer="https://auth.company.internal"
```

### Key Security Standards in PostgreSQL 18:
1. **Mandatory SCRAM-SHA-256**: The insecure legacy `md5` authentication method is officially deprecated. `scram-sha-256` prevents eavesdropping and protects against rainbow table attacks through salted cryptographic proofs.
2. **Native OAuth 2.0 / OpenID Connect (OIDC)**: In PostgreSQL 18, database connections can be authenticated directly with JSON Web Tokens (JWT) signed by modern enterprise Identity Providers (e.g., Okta, Keycloak, Google Cloud IAM, Microsoft Entra ID).
3. **Data Checksums by Default**: In PostgreSQL 18, `initdb` initializes clusters with block checksums enabled. Every page read verifies CRC-16 integrity. If storage corruption occurs, PostgreSQL immediately halts the operation and reports an unambiguous error before corrupted data can propagate.

---

## 9. Practical Lab Environment: Docker Compose & Essential `psql` Operations

### Isolated Docker Compose Setup
Create the following `docker-compose.yml` to spin up a fully instrumented PostgreSQL 18 development instance:

```yaml
services:
  postgres:
    image: postgres:18-alpine
    container_name: postgres-18-training
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgrespassword
      POSTGRES_DB: training_db
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    command: >
      postgres
        -c shared_buffers=256MB
        -c work_mem=16MB
        -c maintenance_work_mem=64MB
        -c wal_level=logical
        -c track_io_timing=on

volumes:
  pgdata:
```

### Essential `psql` Administrative Commands
```bash
# Connect using the libpq connection string URI
psql "postgresql://postgres:postgrespassword@localhost:5432/training_db"

# 1. Enable query timing diagnostics
training_db=# \timing on
Timing is on.

# 2. Inspect active runtime configuration
training_db=# SELECT version();
training_db=# SHOW shared_buffers;
training_db=# SHOW io_method;

# 3. Explore schema catalog metadata
training_db=# \dn+      -- List schemas and authorization owners
training_db=# \dt+      -- List tables with physical disk footprint
training_db=# \di+      -- List indexes with physical disk footprint
training_db=# \d+ users -- Show column types, nullability, default expressions, and storage strategies

# 4. Enable auto-expanded output for wide query projections
training_db=# \x auto
```

---

## 10. Summary & Module Progression

In this opening module, we analyzed:
- The multi-process client architecture and the background worker fleet (`bgwriter`, `checkpointer`, `walwriter`, `autovacuum`).
- The synchronization hierarchy: hardware Spinlocks, Lightweight Locks (LWLocks), and transaction Heavyweight Locks with deadlock detection graphs.
- Memory segmentation, the dual-caching problem between `shared_buffers` and the OS page cache, and `work_mem` sizing bounds.
- Connection pooling modes (Session vs Transaction pooling) and session state boundaries.
- The PostgreSQL 18 Asynchronous I/O (AIO) architecture leveraging Linux `io_uring`.
- The physical binary anatomy of 8KB disk blocks and `ctid` addressing.
- Enterprise authentication standards: SCRAM-SHA-256, native OAuth 2.0 / OIDC, and default data checksums.

Proceed to **[Module 02 — Relational Modeling, Types & Constraints](./02-relational-modeling-types-and-constraints.md)** to master relational normalization theory, storage representations of native data types, time-ordered `uuidv7()`, virtual generated columns, and PostgreSQL 18 temporal constraints (`WITHOUT OVERLAPS`).
