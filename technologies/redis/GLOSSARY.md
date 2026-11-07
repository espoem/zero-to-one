# Redis Glossary

Terms used in the `technologies/redis/` track (Redis Open Source 8.x, with Valkey 9.x differences where the modules mark them). All definitions are in English; each term gives its canonical English name and an established Czech equivalent. Where Czech technical usage has not settled on a translation, the English term is kept in italics in the Czech column, as Czech developer literature does. Definitions follow the track's [modules](modules/) and the redis.io documentation they cite.

Terms shared with the [root glossary](../../GLOSSARY.md) are reproduced verbatim in [§10](#10-shared-with-the-root-glossary).

---

## 1. Execution model and protocol

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Data-structure server** | **Server datových struktur** | A server that holds typed values (strings, lists, hashes, sets, sorted sets, streams, JSON documents, vector sets) in memory and exposes commands that operate on them atomically. This is the accurate description of Redis, in place of "an in-memory cache". | Redis docs: Data types; module 01 § 1 |
| **Keyspace** | _Keyspace_ | The map from binary-safe keys (up to 512 MB) to typed values held by one numbered database; a standalone server has 16 databases by default and Redis Cluster supports only database 0. | Redis docs: Keys and values; module 01 § 1 |
| **Event loop** | **Smyčka událostí (event loop)** | The `ae` loop of the main thread: it flushes replies, waits for socket readiness with `epoll`/`kqueue`, executes the commands read from ready clients and runs periodic timer work (`serverCron`, `hz` times per second). | Module 01 § 2.1 |
| **Command thread (main thread)** | **Hlavní vlákno** | The single thread that executes every command, one at a time, which makes each command atomic and makes a slow command delay all other clients. | Module 01 § 2 |
| **I/O thread** | **Vstupně-výstupní vlákno (I/O thread)** | An optional thread (`io-threads` above 1) that reads and parses requests and writes replies; command execution stays on the main thread. | Module 01 § 2.2 |
| **Head-of-line blocking** | _Head-of-line blocking_ | The effect of one long command (`KEYS`, `HGETALL` of a huge hash, a long script) adding its whole service time to the waiting time of every client queued behind it. | Module 01 § 3 |
| **Pipelining** | _Pipelining_ | Sending several commands without waiting for each reply; replies arrive in order. It removes round trips but provides no atomicity. | Redis docs: Pipelining; module 01 § 3.1 |
| **RESP (REdis Serialization Protocol)** | **RESP (serializační protokol Redisu)** | The length-prefixed, CRLF-terminated wire format between clients and server; a command is always an array of bulk strings. RESP3 (opt-in with `HELLO 3`) adds maps, sets, doubles, booleans, a single null and push messages. | Redis docs: Protocol specification; module 01 § 4 |
| **Push message** | _Push message_ | A RESP3 out-of-band frame (prefix `>`) that the server sends outside the request-reply flow, such as a Pub/Sub message or a client-side-caching invalidation. | Redis docs: Protocol specification; module 01 § 4.2 |
| **Inline command** | _Inline command_ | A request that does not start with `*` and is parsed as space-separated words, which makes `telnet` usable and is the root of the cross-protocol attack. | Module 01 § 4.4 |
| **Lazy free** | _Lazy free_ | Releasing the memory of a deleted value in a background `bio` thread instead of inline (`UNLINK`, `FLUSHALL ASYNC`, the `lazyfree-lazy-*` settings). | Redis docs: UNLINK; module 03 § 6 |
| **Numbered database** | **Číslovaná databáze** | One of the logical keyspaces selected with `SELECT n`; they share one process, memory budget, eviction policy and command thread, so they are not isolation. | Module 01 § 5.3 |

## 2. Data types and encodings

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Encoding** | **Interní reprezentace (encoding)** | The internal representation a type currently uses (`OBJECT ENCODING key`); Redis switches between encodings as a value grows. | Module 02 § 1 |
| **SDS (Simple Dynamic String)** | **SDS (jednoduchý dynamický řetězec)** | The length-prefixed, binary-safe, NUL-terminated string buffer that holds string payloads. | Module 02 § 3.1 |
| **Listpack** | _Listpack_ | A single contiguous allocation of entries, each storing its own length at its end, used for small hashes, sets, sorted sets and lists; it replaced the ziplist in Redis 7.0. | Module 02 § 3.2 |
| **Ziplist** | _Ziplist_ | The pre-7.0 compact encoding whose entries stored the length of the previous entry, which could trigger cascading updates with O(N²) worst-case cost. | Module 02 § 3.2 |
| **Intset** | _Intset_ | A sorted array of 16-, 32- or 64-bit integers used for sets of integers, searched with binary search. | Module 02 § 3.6 |
| **Quicklist** | _Quicklist_ | A doubly linked list of listpack nodes used for large lists; `list-compress-depth` can LZF-compress the inner nodes. | Module 02 § 3.6 |
| **Skip list** | _Skip list_ | The probabilistic ordered structure used by large sorted sets; each forward link stores a span, so rank queries cost O(log N). | Pugh (1990); module 02 § 3.5 |
| **Span** | _Span_ | The number of level-0 nodes that a skip-list forward link jumps over; summing spans along a search path gives the rank. | Module 02 § 3.5 |
| **Hash table (dict)** | **Hashovací tabulka (rozptylová tabulka)** | The chained hash table behind keys, hashes, sets and sorted-set dictionaries, resized incrementally through two tables. | Module 02 § 3.4; dsa M03 |
| **Incremental rehashing** | _Incremental rehashing_ | Moving buckets from the old table to the new one a step at a time on each dictionary operation and in `serverCron`, instead of one O(N) pause. | Module 02 § 3.4 |
| **Hash field expiration** | _Hash field expiration_ | Per-field TTLs inside a hash (`HEXPIRE` family, 7.4+); a field TTL does not expire the key, and `HSET` on the field clears it. | Redis docs: HEXPIRE; module 02 § 6 |
| **Stream** | **Datový proud (stream)** | An append-only log of entries with strictly increasing IDs `<ms>-<seq>`, stored as a radix tree of listpacks, with optional consumer groups. | Redis docs: Streams; module 06 § 2 |
| **HyperLogLog** | **HyperLogLog** | A probabilistic cardinality estimator stored as a string of 16 384 six-bit registers (about 12 KB dense) with a standard error of about 0.81 %. | Redis docs: HyperLogLog; module 02 § 5 |
| **Geohash** | **Geohash** | The 52-bit interleaving of longitude and latitude that Redis stores as a sorted-set score for geospatial indexes. | Module 02 § 5 |
| **Bloom filter** | **Bloomův filtr** | A probabilistic set-membership structure with no false negatives and a configurable false-positive rate; about 9.6 bits per element at 1 %. | Redis docs: Bloom filter; module 08 § 6 |
| **Probabilistic data structure** | **Pravděpodobnostní datová struktura** | A structure that trades exactness for fixed memory: HyperLogLog, Bloom and Cuckoo filters, Count-Min sketch, Top-K, t-digest. | Module 08 § 6; dsa M13 |
| **Vector set** | _Vector set_ | A Redis 8.0 data type holding elements with vectors and optional JSON attributes, indexed by an HNSW graph inside the key (`VADD`, `VSIM`). | Redis docs: VADD; module 08 § 4 |
| **Inverted index** | **Invertovaný index** | The index of the Query Engine `TEXT` and `TAG` fields that maps terms to the documents containing them. | Module 08 § 3.1; data-systems M03 |
| **Approximate nearest-neighbour search** | **Přibližné hledání nejbližších sousedů (ANN)** | Vector similarity search that trades exact results for speed (`HNSW`, `SVS-VAMANA`), compared with the exact `FLAT` index. | Module 08 § 3.4 |

## 3. Keys, expiry, eviction and memory

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **TTL (time to live)** | **Doba života klíče (TTL)** | The remaining lifetime of a key, stored as an absolute expiry time in the expires dictionary; `TTL` returns -1 for a persistent key and -2 for a missing one. | Redis docs: Keys and values; module 03 § 1 |
| **Volatile key** | _Volatile key_ | A key with an entry in the expires dictionary; the eviction policies named `volatile-*` consider only such keys. | Module 03 § 1.1 |
| **Lazy expiry** | _Lazy expiry_ | Deleting an expired key at the moment a command touches it; a key never accessed again is not reclaimed by this path. | Module 03 § 2.1 |
| **Active expiry** | _Active expiry_ | The sampling cycle that deletes expired keys in the background: 20 volatile keys per loop, repeated while more than 10 % of the sample had expired, within a CPU budget. | Module 03 § 2.2 |
| **Eviction policy** | _Eviction policy_ | The `maxmemory-policy` rule that chooses which keys to remove when `maxmemory` is reached; `noeviction` is the default. | Redis docs: Key eviction; module 03 § 3 |
| **Approximated LRU** | _Approximated LRU_ | Redis's least-recently-used eviction: sample `maxmemory-samples` keys (default 5), merge them into a pool of 16 candidates kept across calls and evict the most idle. | Module 03 § 3.3; dsa M13 |
| **LFU counter** | _LFU counter_ | The 8-bit logarithmic (Morris-style) access counter kept under LFU policies; new keys start at 5 and the counter decays by one per `lfu-decay-time` minutes of inactivity. | Module 03 § 3.4 |
| **LRM (least recently modified)** | _Least recently modified (LRM)_ | The Redis 8.6 `allkeys-lrm` / `volatile-lrm` policies, which rank keys by when they were last written. | Module 03 § 3.2 |
| **Big key** | _Big key_ | A single key with a very large value or collection whose full reads, deletes, migration or eviction cause latency spikes; found with `--bigkeys`, `--memkeys` and `MEMORY USAGE`. | Module 02 § 8; module 12 § 5 |
| **Hot key** | _Hot key_ | A key that receives a disproportionate share of requests and saturates one thread or one Cluster shard; found with `HOTKEYS` (8.6+) or `--hotkeys` under an LFU policy. | Module 02 § 8; module 12 § 5 |
| **Memory fragmentation** | **Fragmentace paměti** | Memory held by the process but not usable for new allocations, reported as `mem_fragmentation_ratio` (`used_memory_rss` / `used_memory`); a ratio below 1 means pages were swapped out. | Module 03 § 4.2 |
| **Cursor (SCAN)** | **Kurzor (SCAN)** | The opaque value that `SCAN` returns and accepts to continue an iteration; the iteration ends only when it is 0, and it advances by incrementing the reversed bits of the bucket index. | Redis docs: SCAN; module 03 § 5 |

## 4. Caching and coordination

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Cache** | **Mezipaměť (cache)** | A derived copy of source-of-truth data whose staleness is bounded by a TTL. | Module 04 § 1; data-systems M09 |
| **Cache-aside** | _Cache-aside_ | The pattern in which the application reads the cache, loads from the source of truth on a miss and writes the result back, and invalidates the key when it writes the source. | Module 04 § 1 |
| **Cache stampede** | _Cache stampede_ | Many concurrent requests missing the same expired or evicted hot key and all recomputing it against the source of truth. | Module 04 § 3 |
| **Single flight (request coalescing)** | _Single flight_ | Letting concurrent callers in one process await a single in-flight load for a key; it does not help across processes. | Module 04 § 3.1 |
| **XFetch (probabilistic early recomputation)** | _XFetch_ | Recomputing a value before expiry with a probability that rises as expiry approaches, scaled by the recomputation time. | Module 04 § 3.3 |
| **Negative caching** | _Negative caching_ | Storing a short-lived "not found" result so that lookups of non-existent IDs stop reaching the source of truth. | Module 04 § 2 |
| **Cache penetration** | _Cache penetration_ | Repeated requests for keys that do not exist, which always miss the cache and hit the source of truth. | Module 04 § 7 |
| **Client-side caching (tracking)** | _Client-side caching_ | Server-assisted near caching: the server remembers the keys a client read (`CLIENT TRACKING`) and pushes an invalidation when any client modifies them. | Redis docs: Client-side caching; module 04 § 5 |
| **Near cache** | _Near cache_ | The cache inside the application process that client-side caching keeps consistent. | Module 04 § 5 |
| **Rate limiter** | _Rate limiter_ | A component that admits a request only while a bound on requests per identity and window holds; variants are fixed window, sliding log, sliding-window counter, token bucket and GCRA. | Module 07 § 1 |
| **Token bucket** | _Token bucket_ | A limiter with a bucket of capacity B refilled at r tokens per second: bursts up to B, sustained rate r. | Module 07 § 1.1 |
| **GCRA (generic cell rate algorithm)** | _GCRA_ | A token-bucket formulation that stores one number, the theoretical arrival time. | Module 07 § 1.1 |
| **Lease** | _Lease_ | A lock with a time limit; its holder cannot know the lease is still valid when it acts, so a lease alone is not mutual exclusion. | Module 07 § 2.2; distributed-systems M08 |
| **Fencing token** | _Fencing token_ | A number that increases with every lock acquisition, carried with every write and rejected by the protected resource if lower than one already seen. | Module 07 § 2.2 |
| **Redlock** | **Redlock** | The algorithm that acquires the same lock on a majority of N independent Redis primaries within a time budget; criticised because it depends on timing assumptions and has no fencing token. | Redis docs: Distributed locks; module 07 § 2.3 |
| **Idempotency key** | _Idempotency key_ | A client-supplied identifier that lets a server execute a non-idempotent request once and replay the stored response for retries. | Module 07 § 5 |
| **Leaderboard** | **Žebříček (leaderboard)** | A ranking maintained in a sorted set, with O(log N) updates and rank queries. | Module 07 § 3 |

## 5. Atomicity and programmability

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Atomic command** | **Atomická operace** | A command that the server executes from start to finish without interleaving any other client's command. | Module 01 § 1 |
| **Transaction (MULTI/EXEC)** | **Transakce (MULTI/EXEC)** | A queue of commands run back to back with no interleaving, giving isolation but no rollback on runtime errors. | Redis docs: Transactions; module 05 § 1 |
| **Queue-time error** | _Queue-time error_ | An error such as an unknown command or wrong arity detected while queueing; it makes `EXEC` fail with `-EXECABORT`. | Module 05 § 1.1 |
| **Optimistic locking (WATCH)** | **Optimistické zamykání (WATCH)** | Check-and-set concurrency: `EXEC` returns a null reply and runs nothing if a watched key was modified since `WATCH`. | Redis docs: WATCH; module 05 § 2 |
| **Lua script (EVAL)** | **Skript v jazyce Lua (EVAL)** | Server-side Lua 5.1 code that runs atomically on the command thread and accesses keys declared in `KEYS`. | Redis docs: Scripting with Lua; module 05 § 3 |
| **Script cache (EVALSHA)** | _Script cache_ | The volatile server-side cache of scripts keyed by SHA-1; `-NOSCRIPT` means the script is not cached and the client must fall back to `EVAL`. | Module 05 § 3.3 |
| **Function (Redis Functions)** | **Funkce (Redis Functions)** | A named, versioned server-side library loaded with `FUNCTION LOAD`, called with `FCALL`, persisted in RDB/AOF and replicated (7.0+). | Redis docs: Redis functions; module 05 § 4 |
| **Effects replication** | _Effects replication_ | Propagating the write commands a script performed, wrapped in `MULTI/EXEC`, instead of the script itself; the only mode since 7.0. | Module 05 § 3.4 |

## 6. Messaging

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Publish/subscribe (Pub/Sub)** | _Publish/subscribe (Pub/Sub)_ | At-most-once broadcast to the clients subscribed at that moment; nothing is stored. | Redis docs: Pub/Sub; module 06 § 1 |
| **Sharded Pub/Sub** | _Sharded Pub/Sub_ | Pub/Sub (`SPUBLISH`/`SSUBSCRIBE`, 7.0+) in which a channel is hashed to a slot and messages stay within that shard. | Redis docs: SPUBLISH; module 06 § 1.2 |
| **Consumer group** | _Consumer group_ | A named cursor over a stream that delivers each entry to exactly one consumer of the group and tracks it until acknowledged. | Redis docs: Streams; module 06 § 2.2 |
| **Pending entries list (PEL)** | _Pending entries list (PEL)_ | The per-group record of entries delivered but not yet acknowledged, with consumer, delivery time and delivery count. | Redis docs: Streams; module 06 § 2.2 |
| **At-most-once delivery** | **Doručení nejvýše jednou (at-most-once)** | A guarantee under which a message is delivered zero or one time and may be lost, as with Pub/Sub and a plain `BRPOP`. | Module 06 § 1.1; distributed-systems M10 |
| **At-least-once delivery** | **Doručení alespoň jednou (at-least-once)** | A guarantee under which a message is delivered one or more times; consumers must be idempotent. Streams with consumer groups and reliable list queues provide it. | Module 06 § 2.2; distributed-systems M10 |
| **Poison message** | _Poison message_ | An entry that crashes every consumer that processes it and would circulate forever; detected with the delivery counter and moved to a dead-letter stream. | Module 06 § 2.3 |
| **Reliable queue** | **Spolehlivá fronta** | A list queue in which `BLMOVE` atomically moves a job into a per-worker processing list until it is acknowledged with `LREM`. | Module 06 § 3 |
| **Keyspace notification** | _Keyspace notification_ | A Pub/Sub message about a key event, enabled with `notify-keyspace-events`; at-most-once, and `expired` fires when the key is deleted. | Redis docs: Keyspace notifications; module 06 § 4 |
| **Trimming (streams)** | _Trimming_ | Removing old stream entries with `MAXLEN` or `MINID`; `~` makes it approximate (whole nodes only). It ignores consumer-group progress. | Redis docs: XTRIM; module 06 § 2.4 |

## 7. Persistence and replication

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Snapshot (RDB)** | **Snímek (RDB)** | A compact binary serialisation of the dataset at one instant, written by a forked child to a temporary file and renamed to `dump.rdb`. | Redis docs: Persistence; module 09 § 2 |
| **Append-only file (AOF)** | _Append-only file (AOF)_ | The log of write commands in RESP format replayed at start-up; since 7.0 a directory with a base file, incremental files and a manifest (multi-part AOF). | Redis docs: Persistence; module 09 § 3 |
| **Copy-on-write** | **Kopírování při zápisu (copy-on-write)** | The mechanism by which a forked child shares memory pages with the parent and the kernel copies a page when the parent first modifies it. | Module 09 § 2.2 |
| **Fork** | **Rozvětvení procesu (fork)** | The system call that creates the child process for snapshots, AOF rewrites and full resynchronisations; it copies page tables and stalls the main thread briefly (`latest_fork_usec`). | Module 09 § 2.2 |
| **Loss window** | _Loss window_ | The span of acknowledged writes that can be missing after a crash and restart, determined by the failure type and the `appendfsync` policy. | Module 09 § 1 |
| **Transparent huge pages (THP)** | **Transparentní velké stránky (THP)** | Kernel feature that makes copy-on-write copy 2 MB instead of 4 KB pages; it must be disabled for Redis. | Module 09 § 2.2 |
| **Replica** | **Replika** | A server that copies the dataset of a primary through the replication stream, is read-only by default and can be promoted. | Redis docs: Replication; module 10 § 1 |
| **Primary** | _Primary_ | The server that accepts writes for a dataset and streams them to its replicas (formerly "master"). | Module 10 § 1 |
| **Asynchronous replication** | **Asynchronní replikace** | Replication in which the primary replies to the client before replicas acknowledge, so an acknowledged write can be lost on failover. | Module 10 § 2 |
| **Replication ID (replid)** | _Replication ID_ | A 40-character random identifier of one history of the dataset; a promoted replica keeps the old one as `replid2`. | Module 10 § 1.1 |
| **Replication offset** | _Replication offset_ | The number of bytes of the replication stream produced by the primary or applied by a replica. | Module 10 § 1.1 |
| **Replication backlog** | _Replication backlog_ | The circular buffer on the primary holding the last `repl-backlog-size` bytes of the stream, from which a reconnecting replica can continue. | Module 10 § 1.1 |
| **Partial resynchronisation (PSYNC)** | _Partial resynchronisation_ | A replica continues from its offset using the backlog; otherwise the primary performs a full resynchronisation with a new RDB snapshot. | Module 10 § 1.4 |
| **Failover** | **Převzetí služeb při selhání (failover)** | Promoting a replica to primary when the primary fails, done by Sentinel or by the Cluster election. | Module 10 § 5; module 11 § 5 |
| **Sentinel** | **Sentinel** | The monitoring mode of the Redis binary that detects a failed primary, elects a leader, promotes a replica and tells clients the new address. | Redis docs: Sentinel; module 10 § 5 |
| **Quorum** | **Kvórum** | The number of Sentinels that must report a primary down (ODOWN); performing the failover also needs a majority of all Sentinels. | Module 10 § 5.2 |
| **Configuration epoch** | _Configuration epoch_ | The monotonically increasing number attached to a configuration or slot claim; the highest epoch wins ("last failover wins"). | Module 10 § 5.2; module 11 § 5.1 |
| **Split brain** | _Split brain_ | A partition in which an old primary keeps accepting writes while another node is promoted; the old primary's writes are discarded when it rejoins. Limited by `min-replicas-to-write`. | Module 10 § 6 |

## 8. Cluster

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Redis Cluster** | **Redis Cluster** | The shared-nothing sharding mode that distributes 16 384 hash slots across primaries, each with replicas, without a proxy. | Redis docs: Scale with Redis Cluster; module 11 § 1 |
| **Hash slot** | _Hash slot_ | One of the 16 384 partitions of the Cluster keyspace; slot = CRC16(key or hash tag) mod 16384. | Redis docs: Cluster specification; module 11 § 1 |
| **Hash tag** | _Hash tag_ | The part of a key between the first `{` and the first `}` after it, if non-empty, which alone is hashed so related keys share a slot. | Module 11 § 2 |
| **Resharding** | _Resharding_ | Moving hash slots between nodes to rebalance a Cluster. | Module 11 § 4 |
| **Slot migration** | _Slot migration_ | Moving the keys of one slot from a source to a target node, key by key with `MIGRATE` or atomically with `CLUSTER MIGRATION` (8.4+). | Module 11 § 4 |
| **MOVED / ASK redirection** | _MOVED / ASK redirection_ | `MOVED`: the slot permanently lives elsewhere, update the slot map. `ASK`: one-off redirect during a migration, send `ASKING` first and do not update the map. | Module 11 § 3 |
| **Cluster bus** | _Cluster bus_ | The node-to-node gossip channel on the data port plus 10 000 (or `cluster-port`), used for failure detection and failover. | Module 11 § 5.1 |

## 9. Security and operations

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **ACL (access control list)** | **Seznam řízení přístupu (ACL)** | Per-user rules for commands, key patterns and channels (since 6.0), applied left to right. | Redis docs: ACL; module 12 § 2 |
| **Protected mode** | _Protected mode_ | The default safeguard under which a server without a password and without an explicit `bind` accepts only loopback clients. | Module 12 § 1 |
| **Slow log** | _Slow log_ | The log of commands whose execution time exceeded `slowlog-log-slower-than` (default 10 000 µs); it excludes network and queueing time. | Redis docs: SLOWLOG; module 12 § 4 |
| **Latency monitor** | _Latency monitor_ | The sampler of blocking events (`fork`, `aof-fsync-always`, `expire-cycle` …) enabled by `latency-monitor-threshold`; queried with `LATENCY LATEST`, `LATENCY DOCTOR`. | Redis docs: Diagnosing latency; module 12 § 4 |
| **Source of truth** | **Zdroj pravdy (source of truth)** | The system whose data is authoritative, usually the relational database behind a cache. | Module 04 § 1 |

## 10. Shared with the root glossary

The following rows are copied verbatim from the [root glossary](../../GLOSSARY.md); a change belongs there first.

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Idempotence / Idempotency** | **Idempotence** | The property of an operation where multiple identical executions yield the exact same system state as a single execution (`f(f(x)) = f(x)`). | ISO/IEC 2382, RFC 9110 (HTTP Semantics) |
| **Eventual Consistency** | **Konečná konzistence** | A consistency model where, in the absence of new updates, all replicas eventually converge to the same value. | Vogels (Eventually Consistent) |
| **Write-Ahead Logging (WAL)** | **Zápis do předstihového deníku (WAL)** | A durability protocol requiring state modifications to be flushed to non-volatile sequential log storage before the corresponding dirty page blocks are written to heap storage. | Mohan et al. (ARIES Recovery Algorithm) |
| **Point-In-Time Recovery (PITR)** | **Obnova k určitému časovému bodu (PITR)** | A disaster recovery mechanism that restores a base snapshot and continuously rolls forward sequential write-ahead logs up to an exact timestamp or transaction boundary. | Database Systems Architecture |
