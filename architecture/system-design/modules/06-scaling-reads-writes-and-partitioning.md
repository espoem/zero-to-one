# Module 06 — Scaling Reads, Scaling Writes, and Partitioning

Vertical scaling eventually runs out: a single database instance has finite CPU, memory, IOPS, and connection slots. The three levers for going beyond it are replicating reads, partitioning data across independent shards, and reshaping the write path so it does not serialize on a single row or synchronous dependency. This module covers **read replicas and read-your-writes routing** under asynchronous replication lag; **sharding and consistent hashing in practice**, including why `hash(key) % N` causes a remapping storm and why virtual nodes are mandatory; and **write scaling** through denormalization, CQRS, batching, buffering, and high-throughput counters. The executable proofs for the hashing and caching-adjacent claims live in `../examples/03-caching-and-hashing.test.ts`. Replication mechanics and sharding internals are owned by [`architecture/data-systems`](../../data-systems/README.md); algorithm proofs for hashing, sketches, and data structures are owned by [`algorithms/dsa`](../../../algorithms/dsa/README.md); consistency models and clock/lease theory are owned by [`architecture/distributed-systems`](../../distributed-systems/README.md); Redis operations such as `INCR` are owned by [`technologies/redis`](../../../technologies/redis/README.md).

---

## 1. Scaling Reads

### 1.1 Read Replicas and Connection Routing

The first scaling move is to add **read replicas**: asynchronous copies of the primary database that serve `SELECT` traffic while all writes continue to go to the primary. Because most web workloads are read-dominated (often 90:1 or higher), offloading reads multiplies effective capacity without changing the schema.

```mermaid
flowchart TD
    A["Client request"] --> B{"Read or write?"}
    B -->|"Write"| C["Primary database, single writer"]
    B -->|"Read"| D["Replica selector"]
    D --> E["Replica 1"]
    D --> F["Replica 2"]
    D --> G["Replica 3"]
    C -->|"Async replication stream"| E
    C -->|"Async replication stream"| F
    C -->|"Async replication stream"| G
```

Routing is implemented either in the application (a datasource that picks a connection) or in an intermediary such as a proxy or service mesh. The selector must do more than round-robin: it should be **lag-aware**, excluding replicas whose replication delay exceeds a threshold, and it should respect **session affinity** when the application requires read-your-writes. Connection pooling matters as much as routing: without pooling, each replica's `max_connections` becomes a hard ceiling that is easy to exceed during a traffic spike.

The fundamental complication is that replication is asynchronous. The primary acknowledges a write as soon as it is locally durable; the replicas receive it later. Between those two moments the system is in a window where the primary knows about the write and the replicas do not.

### 1.2 Read-Your-Writes Under Replication Lag

**Read-Your-Writes (RYW)** is the guarantee that a client which performed a write will observe that write (or a later one) on its subsequent reads. With a single primary serving both, RYW is trivial. With asynchronous replicas it is not: a client writes, then reads from a replica that has not yet caught up, and sees the old value. The client perceives this as a bug — "I saved my profile change and it reverted" — even though the system is behaving exactly as configured.

```mermaid
sequenceDiagram
    participant C as "Client"
    participant P as "Primary"
    participant R as "Replica"
    C->>P: "UPDATE profile SET name = new, commit"
    P-->>C: "ACK, LSN = 1050"
    P->>R: "Replication of LSN 1050 in flight"
    C->>R: "SELECT name, expects new"
    R-->>C: "returns old, replica at LSN 1048"
    Note over C,R: "RYW violation, bounded by replication lag"
```

The violation window is the replication lag $\Delta$, typically milliseconds but spikes to seconds during backups, network hiccups, or large transactions. Four mechanisms address it, each with a different cost.

**Mechanism 1 — LSN or GTID watermarks.** Every committed transaction has a log sequence number (Postgres LSN, MySQL GTID). The primary returns the commit LSN to the client alongside the write response. For subsequent reads, the client passes that LSN as a minimum: the router either waits until the chosen replica's applied LSN reaches the watermark (bounded wait, then fall back to primary), or it routes directly to a replica known to be caught up. This gives precise RYW without a time-based heuristic, but it requires threading the watermark through every layer and a replica that can report its applied position.

```text
write_response = { value, commit_lsn }
read(key, min_lsn):
    replica = select_replica_with_applied_lsn_at_least(min_lsn)
    if replica is none:
        wait_until_caught_up(min_lsn, timeout = T)
        if still behind: route_to_primary()
    return replica.read(key)
```

**Mechanism 2 — Primary routing for $T$ seconds.** The simplest and most common fix: after any write, route that user's reads to the primary for a fixed window $T$ (say 5 seconds) chosen to exceed the normal replication lag. A cookie or a server-side flag marks the session as "recently wrote". This is easy to implement and works well in practice, but it is a heuristic: if lag exceeds $T$, RYW still breaks, and every recent writer adds primary load. $T$ must be tuned against the observed lag distribution, especially its tail.

**Mechanism 3 — Sticky sessions.** Pinning a user to a consistent application instance lets the app remember the "recently wrote" flag and the last commit LSN in local memory, avoiding a distributed lookup. Sticky sessions are not themselves a consistency mechanism — they are an enabler for mechanisms 1 and 2 — and they can create load imbalance if one instance accumulates many heavy users.

**Mechanism 4 — Bounding lag and shedding replicas.** The router continuously monitors each replica's lag and removes any replica above a threshold (for example 1 second) from the read pool. This does not guarantee RYW by itself, but it bounds the worst-case staleness of any replica read, which makes the $T$-second primary-routing heuristic reliable. A replica that repeatedly exceeds the threshold is a health signal: it may need repair, more IOPS, or removal from the pool until it catches up.

| Mechanism | Precision | Cost | Failure mode |
| --- | --- | --- | --- |
| LSN or GTID watermark | Exact | Client and router plumbing | Watermark lost between layers |
| Primary routing for $T$ | Heuristic | Extra primary load | Lag exceeds $T$ |
| Sticky sessions | Enabler only | Load imbalance | Instance restart loses state |
| Lag-aware shedding | Bounds staleness | Needs accurate lag telemetry | All replicas shed, primary overload |

In production these are combined: lag-aware shedding bounds the population of replicas, LSN watermarks give precision where the client can carry them, and a $T$-second primary route is the safety net for clients that cannot.

### 1.3 Read Scaling Is Not a Consistency Fix

It is worth stating plainly: replicas improve _throughput_, not _freshness_. A system that needs strict serializability for an operation must route that operation to the primary or through a consensus path; no amount of replica tuning changes that. The formal results on consistency models and linearizability are owned by [`architecture/distributed-systems`](../../distributed-systems/README.md). The system-design takeaway is to classify each endpoint by its consistency requirement and route accordingly, rather than applying a single "read from replica" rule to the whole application.

### 1.4 Connection Pooling and Routing Implementation

Read replicas are only useful if the application can actually reach them. Each application process maintains a **connection pool** to the primary and to each replica; opening a database connection is expensive, so pools reuse connections and bound their count. The sizing follows Little's Law, $L = \lambda W$: with $\lambda = 2{,}000$ queries/s and an average query time $W = 5$ ms, the steady-state concurrency is $L = 10$ connections; provisioning well above that adds contention without adding throughput. The estimation method is developed in Module 02.

```mermaid
flowchart TD
    A["Application process"] --> B["Router with lag and RYW state"]
    B --> C["Primary pool: writes and RYW reads"]
    B --> D["Replica 1 pool"]
    B --> E["Replica 2 pool"]
    B --> F["Replica N pool"]
    C --> G["Database max_connections budget"]
    D --> G
    E --> G
    F --> G
```

Routing can live in the application library, in a database proxy, or in a service mesh. Application-side routing has the most information (it knows the user and the last write LSN) but must be implemented in every language in the stack. A proxy centralizes the logic and can observe lag across all clients, but it cannot know application-level intent such as "this user wrote five seconds ago" unless that information is passed in a hint. A practical split is to let the proxy handle lag-aware load balancing and let the application pass a "route to primary" hint for RYW-sensitive requests.

| Concern                  | Application routing             | Proxy routing             |
| ------------------------ | ------------------------------- | ------------------------- |
| Knowledge of user intent | Full                            | Needs explicit hints      |
| Lag-aware balancing      | Must be built per service       | Centralized               |
| Language coverage        | One implementation per language | One implementation total  |
| Failure blast radius     | Bug affects one service         | Bug affects every service |

Pool exhaustion is a common hidden failure: when replica reads are shed due to lag, all that traffic lands on the primary pool, which may be sized much smaller. Size the primary for the shed case, or cap the rate of replica-to-primary fallback with load shedding so the primary is not overwhelmed by the very mechanism meant to protect consistency.

### 1.5 Sources of Replication Lag

Lag is rarely constant; it is a distribution with a long tail. Understanding the sources lets you distinguish a benign millisecond delay from a dangerous seconds-long stall.

| Source | Typical effect | Mitigation |
| --- | --- | --- |
| Large write transaction | Replica applies a big batch atomically, delaying visibility | Break large transactions into smaller commits |
| Replica IOPS saturation | Apply thread cannot keep up with primary | Provision replica I/O independently |
| Long read queries on replica | Lock contention with the apply worker | Route analytics to a separate replica |
| Network hiccup | Replay pauses then bursts | Monitor and shed replicas past the lag threshold |
| Backups and maintenance | Replica busy or paused | Take backups from a dedicated replica |

```mermaid
flowchart LR
    A["Primary commits"] --> B["Replication stream"]
    B --> C{"Apply worker keeps up?"}
    C -->|"Yes"| D["Lag in milliseconds, RYW window small"]
    C -->|"No"| E["Lag grows to seconds"]
    E --> F["Shed replica and route to primary"]
```

The practical rule is to treat lag as a continuously measured SLI with a tail, not as a constant to be assumed. Alert on the 99th percentile of lag, not the mean, and remember that a replica that has fallen far behind may never catch up without intervention if the primary keeps writing at full rate.

---

## 2. Sharding and Consistent Hashing in Practice

When a single primary cannot hold the dataset or the write rate, the data must be **partitioned (sharded)** across multiple independent databases. The problem is not splitting the data once; it is choosing a mapping that survives growth without a full rebalance, and choosing a shard key that does not concentrate all traffic on one shard.

### 2.1 Why `hash(key) % N` Is a Remapping Storm

The naive mapping is $shard = hash(key) \bmod N$. It distributes keys uniformly for a fixed $N$. But adding one node changes the modulus from $N$ to $N+1$, and for most keys the result changes. Because $\gcd(N, N+1) = 1$, the Chinese Remainder Theorem over $\mathrm{lcm}(N, N+1) = N(N+1)$ shows that $h \bmod N = h \bmod (N+1)$ holds only for the $N$ residues in $\{0, 1, \dots, N-1\}$ out of $N(N+1)$. Thus, when growing from $N$ to $N+1$, the exact fraction of keys that stay on the same shard is $\frac{N}{N(N+1)} = \frac{1}{N+1}$, and the fraction that must move is:

$$1 - \frac{1}{N+1} = \frac{N}{N+1}$$

For $N = 1 \to 2$, $50\%$ of keys move; for $N = 10 \to 11$, $\frac{10}{11} \approx 91\%$ of all keys move; for $N = 100 \to 101$, $\frac{100}{101} \approx 99\%$ move.

The consequence is catastrophic in practice: roughly 91% of your cache entries are now on the wrong shard at $N = 10$, so the hit rate collapses, and 91% of reads fall through to the database at once. This is the **cold-cache DB collapse** — a scaling event that looks like an outage. Moving the data itself is also expensive: nearly the entire dataset must be copied across the network.

### 2.2 Consistent Hashing Moves Only $K/N$ Keys

**Consistent hashing** places both nodes and keys on a circular hash ring of $2^m$ positions. A key maps to the first node encountered clockwise from the key's position. When a node is added, only keys that fall in the arc between its predecessor and itself move — a fraction $\frac{K}{N}$ of the keyspace for $K$ total keys and $N$ nodes (more precisely $\frac{1}{N+1}$ of the ring for the new node). Existing nodes keep almost all of their keys. The ring algorithms — including jump hash and rendezvous hashing — and their proofs are owned by [`algorithms/dsa`](../../../algorithms/dsa/README.md); we use them here as black boxes with known guarantees.

```mermaid
flowchart LR
    A["Key space hashed to ring positions"] --> B["Node added at position p"]
    B --> C["Only keys in arc before p move"]
    C --> D["All other keys remain on their shard"]
    D --> E["Cache hit rate largely preserved"]
```

### 2.3 Virtual Nodes Are Mandatory

A ring with one position per node has a serious flaw: node positions are random, so the arcs they own vary wildly in size. With only $N$ points on the ring, the standard deviation of the load per node is large — some nodes own tiny arcs and are nearly idle, others own huge arcs and are overloaded. This is the **skew problem**, and it is worst for small $N$.

The fix is **virtual nodes (vnodes)**: each physical node is represented by many points on the ring (commonly 100–200 per node, or more), each derived from a distinct hash of the node identifier. With $N \cdot V$ points, the arcs become fine-grained and the load distribution tightens: the relative standard deviation of the load per node falls roughly with $\frac{1}{\sqrt{V}}$, so 100–200 vnodes per node collapses skew to a few percent. Vnodes also enable **weighted heterogeneous nodes**: give a larger machine more vnodes, and it automatically owns a proportionally larger share of the keyspace.

| Configuration | Keys moved on node add | Load skew | Heterogeneous weights |
| --- | --- | --- | --- |
| `hash(key) % N` | About $\frac{N}{N+1}$ | Low for fixed $N$ | Awkward |
| Consistent ring, 1 point per node | About $\frac{K}{N}$ | High, random arcs | Impossible |
| Consistent ring with vnodes | About $\frac{K}{N}$ | Low, tunable by $V$ | Natural via vnode count |

The proofs that bound skew and movement are in the DSA track's consistent-hashing module and reproduced in `../examples/03-caching-and-hashing.test.ts`, which asserts a load standard-deviation bound with and without vnodes.

### 2.4 A Worked Remapping Example

Consider 1,000,000 keys spread over 10 shards with a warm cache holding 80% of them, and suppose each cache miss costs one database read. With `hash(key) % 10`, adding an eleventh shard moves $\frac{10}{11} \approx 91\%$ of keys (`~909,000` keys), so roughly `727,000` cached entries become useless at once and the database absorbs an extra `727,000` reads in a burst. With a consistent ring, the new node takes about $\frac{1}{11}$ of the keyspace, so roughly `91,000` keys move and with an `80%` warm cache only about `73,000` cache entries are invalidated — a tenfold reduction in the cold-start load. The difference is precisely why production shard maps never use a plain modulus.

```text
hash % N:       keys moved = (10/11) x 1,000,000 ~= 909,000
consistent:     keys moved = (1/11) x 1,000,000 ~= 91,000
cache misses:   ~727,000 vs ~73,000 after an 80% warm cache
```

This calculation is deliberately conservative: it ignores the fact that a remapping storm also forces cross-shard data copies, which for a terabyte-scale dataset can saturate the network for hours. The hash choice therefore determines both steady-state distribution and the cost of every future scaling event.

### 2.5 Choosing a Shard Key

The shard key is the single most consequential schema decision in a sharded system, because it is nearly immutable after launch. Use these criteria.

**Cardinality.** The key must have enough distinct values to spread across all shards. A boolean or a small enum produces only a handful of shards no matter how many you provision. User IDs or order IDs typically have ample cardinality.

**Access locality.** Choose a key that keeps related data together so the common query touches one shard. For a multi-tenant application, `tenant_id` is often ideal: nearly all queries are scoped to one tenant, and a tenant's data is co-located. If the dominant query is "fetch all orders for a user", `user_id` is the natural key.

**Avoid monotonic hot shards.** Sharding by a timestamp or an auto-incrementing ID sends all new writes to the shard that currently owns the maximum value — a classic **hot partition**. This is the sharding analogue of the hot-key problem in Module 05 §3.3, but for writes, which cannot be fixed with an L1 cache. Hash the monotonic key, or prefix it with a high-cardinality dimension, to spread new writes.

**Avoid cross-shard joins and transactions.** A query that joins data on two shards requires a distributed join or a scatter-gather, and a transaction spanning shards requires a distributed commit protocol owned by [`architecture/distributed-systems`](../../distributed-systems/README.md). Denormalization (§3.1) is the usual remedy. If your access pattern fundamentally requires joining two entities atomically, they probably belong on the same shard under a shared key.

**Plan for resharding.** Even a good key eventually needs more shards. Consistent hashing with vnodes makes addition cheap, and a directory-based layer can remap individual keys, but a range or hash scheme must be designed for online migration from day one.

### 2.6 Sharding Schemes and Online Migration

| Scheme | How it maps | Strength | Weakness |
| --- | --- | --- | --- |
| Directory-based | Lookup service maps key to shard | Flexible per-key moves | Lookup is a bottleneck and a new dependency |
| Range | Contiguous key ranges per shard | Efficient range scans | Hot spots on monotonic keys, uneven sizes |
| Hash | Hash of key to shard or ring | Uniform distribution | No range queries without a secondary index |

**Online migration** must keep the system available while data moves. The standard **dual-write / shadow-read** protocol is:

```text
phase 1: start writing new key to both old and new shard (dual-write)
phase 2: backfill historical data from old to new shard in the background
phase 3: shadow-read from both shards and compare results (detect divergence)
phase 4: switch reads to the new shard for a fraction of traffic (canary)
phase 5: complete the switch, then stop dual-writing and retire the old shard
```

The invariant is that no write is ever accepted in only one location during the transition, and divergence is measured before traffic shifts. A trickier variant is **splitting** a single overloaded shard into two: the parent continues to serve while the children are backfilled, then a brief handoff switches the mapping. The directory-based scheme makes this a routing change; a pure hash scheme requires the ring to be updated consistently across all clients, which is why the ring configuration should be a shared, versioned artifact rather than hard-coded.

### 2.7 Detecting and Handling Hot Partitions

Even a well-chosen key can develop a hot partition: a celebrity tenant, a viral post, or a flash-sale item concentrates traffic on one shard. The first requirement is **detection** — per-shard request rate, CPU, and lock wait must be on a dashboard, with alerts on the ratio of the hottest shard to the median. Averages hide a single overloaded shard, so always look at the distribution.

```mermaid
flowchart TD
    A["Per-shard telemetry"] --> B{"Hottest shard above threshold?"}
    B -->|"No"| C["Continue monitoring"]
    B -->|"Yes"| D["Identify responsible key or tenant"]
    D --> E{"Read or write hot spot?"}
    E -->|"Read"| F["L1 micro-cache and key salting"]
    E -->|"Write"| G["Sharded counters or fan-out with batching"]
    F --> H["Verify load redistributes"]
    G --> H
```

Read hot spots are mitigated exactly as in Module 05 §3.3: an in-process L1 cache and, if needed, key salting. Write hot spots cannot be cached; they need the counter and buffering techniques of §3.5. If a single tenant is responsible, the long-term fix may be to **split that tenant across multiple shards** with a finer-grained key such as `(tenant_id, user_id)`, accepting the loss of single-shard transactions within the tenant.

| Symptom | Likely cause | First response |
| --- | --- | --- |
| One shard high CPU, others idle | Read hot key | L1 cache, then key salting |
| One shard high lock wait | Write hot row | Sharded counter or buffered writes |
| All shards hot, rising together | Global traffic spike | Load shedding and autoscale |
| One shard growing in size only | Uneven key distribution or vnode skew | Rebalance vnodes or split the shard |

---

## 3. Scaling Writes

Reads can be replicated; writes must be coordinated. Scaling writes therefore means reducing the number of synchronous, contended operations per logical write.

### 3.1 Denormalization and Materialized Views

Normalization minimizes write cost and redundancy; read performance at scale often requires the opposite. **Denormalization** stores redundant copies of data so a common read needs no join, and a **materialized view** is a pre-computed, incrementally maintained read projection of a base table.

```mermaid
flowchart TD
    A["Write to base table: posts"] --> B["Update materialized view: posts_with_author"]
    A --> C["Update feed projection per follower"]
    B --> D["Read serves from pre-computed projection"]
    C --> D
    D --> E["No join at read time, low latency"]
```

The cost is **write amplification**: one logical write now updates several structures, and each additional projection multiplies write load. This is a conscious trade — you pay more on writes to make reads cheap — but it must be bounded. Every projection needs an owner, an update path, and a reconciliation job to repair drift when an update is missed. If the projection is maintained asynchronously, it is eventually consistent and inherits the lag concerns of §1.

### 3.2 CQRS: When It Is Worth It

**Command Query Responsibility Segregation (CQRS)** takes denormalization to its logical conclusion: the write model and the read model are separate, independently scaled, and may use different databases. Commands mutate a normalized write store; events update one or more read projections optimized for specific queries.

CQRS is genuinely valuable when the read and write models have **different scaling or shape requirements** — for example, complex analytical reads over a simple append-only write log, or multiple read projections with different latency needs. It is needless complexity when the read and write models are basically the same tables: you have added message plumbing, eventual consistency, and reconciliation for no benefit. The honest test is whether a single model would actually be a bottleneck; if not, do not adopt CQRS. The saga and event-sourcing correctness theory behind it is owned by [`architecture/distributed-systems`](../../distributed-systems/README.md).

### 3.3 Write Batching and Group Commit

Databases pay a fixed cost per transaction (WAL flush, fsync, index update). **Batching** groups many logical writes into one transaction, and **group commit** lets a single WAL flush acknowledge many concurrent transactions. Both convert many small random writes into fewer larger sequential ones.

```text
without batching: 1000 writes = 1000 transactions = 1000 fsyncs
with batching:    1000 writes = 10 batches of 100 = 10 fsyncs
```

Batching trades latency for throughput: a request waits for the batch to fill or for a short timeout (often 1–10 ms). It is most effective for write-heavy ingest pipelines where per-event latency is unimportant but aggregate throughput is critical. The batch size and timeout must be bounded — an unbounded batch under low traffic adds latency, and an unbounded queue under overload hides saturation.

### 3.4 Async Write-Behind Buffering

When writes arrive in spikes faster than the database can absorb them, an **async write-behind buffer** (a durable queue such as Kafka) absorbs the spike and lets the database consume at its own pace. This is the write-side analogue of a cache: it decouples producer and consumer timing. The buffer must be durable, otherwise the throughput gain is paid for with lost writes, and it must apply backpressure when full. Delivery semantics and idempotent-consumer theory are owned by [`architecture/distributed-systems`](../../distributed-systems/README.md).

```mermaid
flowchart LR
    A["Producers: 50k writes/s spike"] --> B["Durable buffer, Kafka"]
    B --> C["Consumers batch writes"]
    C --> D["Database, 10k writes/s steady"]
    B --> E["Backpressure when buffer full"]
```

### 3.5 High-Throughput Counters at Scale

Counters — likes, views, shares, inventory counts — are the classic write hot spot. The naive implementation is one row in a table:

```sql
UPDATE posts SET likes = likes + 1 WHERE id = 42;
```

This statement acquires an **exclusive row lock** on the single row for the duration of its transaction. Every increment to the same post must wait for the previous one, so the operations are fully serialized on one lock and one row's worth of WAL. Even on fast hardware this tops out at roughly 500–2,000 writes per second for a single contended row; beyond that, lock wait time and transaction aborts dominate and latency grows without bound. Adding more application servers does nothing — the database row is the bottleneck.

Four techniques break the serialization.

**Technique 1 — Sharded counters.** Replace the single value with $S$ sub-rows, `likes_42_0` through `likes_42_{S-1}`. An increment picks a sub-row (by request hash or at random) and updates it; the total is the sum of the sub-rows, computed on read or by a periodic rollup into a canonical value. With $S = 32$, write throughput rises by roughly $32\times$ because 32 independent rows can be locked concurrently. Reads become an aggregation, which is acceptable because counters are read far less often than written. The periodic rollup also gives a natural place to reset the sub-rows.

```text
increment(post_id):
    slot = random_int(0, S-1)
    UPDATE counter_shard SET value = value + 1
      WHERE post_id = post_id AND slot = slot

read_total(post_id):
    return SELECT SUM(value) FROM counter_shard WHERE post_id = post_id
```

**Technique 2 — Redis `INCR` plus async DB flush.** Redis increments are in-memory and atomic on a single thread, so a single key can absorb on the order of 100,000 operations per second. Accept increments with `INCR`, then flush the accumulated value to the database periodically (for example every second) or on threshold. The Redis operations and persistence trade-offs are owned by [`technologies/redis`](../../../technologies/redis/README.md). The cost is a durability gap: a Redis crash before the flush loses the unflushed increments, so pair it with a durable buffer if the count must survive exactly.

**Technique 3 — Probabilistic sketches.** For _unique_ counts and heavy hitters, exact counters are the wrong tool. **HyperLogLog** estimates cardinality (unique visitors) with about 12 KB per sketch and a ~2% error, regardless of how many millions of elements are added. **Count-Min Sketch** estimates per-item frequencies (heavy hitters) with a bounded overestimation error. Both use sub-linear memory where an exact set would be enormous; their math is owned by [`algorithms/dsa`](../../../algorithms/dsa/README.md).

**Technique 4 — Buffered batch increments.** Accumulate increments in a process-local or queue-based buffer and apply them to the database in batches, combining Technique 1 and §3.3. This reduces the number of lock acquisitions without changing the data model.

| Technique | Exactness | Throughput | Main cost |
| --- | --- | --- | --- |
| Single row update | Exact | 500–2,000/s | Row-lock serialization |
| Sharded counters | Exact | Scales with $S$ | Read-time aggregation |
| Redis plus flush | Exact if flushed, gap before | Very high | Durability gap |
| HyperLogLog / Count-Min | Approximate | Very high | Bounded error, no per-item exact value |

### 3.6 Write-Scaling Decision Order

The techniques should be applied in a deliberate order: first remove unnecessary synchronous work (batching, group commit); then remove contention (sharded counters); then offload to a faster store or buffer (Redis, durable queue); and only then accept approximation (sketches). Adopting a sketch before fixing a contended row lock means paying an accuracy cost for a bottleneck you never addressed.

### 3.7 Worked Counter Sizing

Suppose a popular post receives 20,000 likes per second. A single-row counter saturates near 1,000 writes/s, giving a twentyfold gap. With $S = 32$ sharded sub-rows, the theoretical ceiling becomes roughly 32,000 writes/s, leaving headroom, and each sub-row sees about 625 writes/s — comfortably below the single-row limit. A read that sums 32 sub-rows costs one indexed query returning 32 values, which is negligible at the read rate of a single post.

```text
target write rate:      20,000 likes/s
single row ceiling:    ~1,000 writes/s  -> 20x overload
shards S = 32:         ~625 writes/s per sub-row -> safe
read cost:              one SUM over 32 rows
```

If the count is a unique-visitor metric instead, sharded counters are the wrong abstraction: storing every visitor ID to deduplicate would consume gigabytes. A HyperLogLog sketch gives a ~2% estimate in about 12 KB, and for a leaderboard of the most-liked posts a Count-Min Sketch identifies heavy hitters with bounded error. The choice between exact and approximate is therefore a function of the _question being asked_, not just the write rate. The same arithmetic applies to any single contended resource: measure the per-resource ceiling first, then decide whether to fan out, buffer, or approximate rather than reaching for the most complex option by default.

---

## 4. Then vs Now

| Concern | Earlier practice | Current practice |
| --- | --- | --- |
| Read routing | All reads to primary, or blind round-robin to replicas | Lag-aware routing plus LSN watermarks and RYW windows |
| Shard mapping | `hash(key) % N` with planned downtime | Consistent hashing with 100–200 vnodes, online migration |
| Hot writes | Bigger database instance | Sharded counters, buffered flushes, sketches |
| Read models | Joins at query time | Materialized views and selective CQRS |
| Counters | Exact single row | Approximate sketches where exactness is not required |

---

## 5. Production Design Checklist

- **Consistency classification**: Which endpoints truly require read-your-writes, and how is that requirement expressed at the router?
- **Lag telemetry**: Is replica lag measured continuously, and are lagging replicas shed from the read pool?
- **Watermark plumbing**: Can the commit LSN be carried through to read requests where precision is needed?
- **Shard key durability**: Does the key have enough cardinality, locality, and freedom from monotonic hot spots?
- **Cross-shard avoidance**: Have the common queries been checked for joins and transactions spanning shards?
- **Remapping cost**: What fraction of keys move when a node is added, and does the cache survive it?
- **Vnode count**: Is the ring configured with enough virtual nodes to bound load skew and support heterogeneous nodes?
- **Migration plan**: Is there a tested dual-write and shadow-read procedure for adding or splitting shards?
- **Write amplification**: Has each materialized view been justified by a measured read benefit?
- **Contention audit**: Is any single row or key receiving more writes than one lock can serialize?
- **Buffer durability**: Are write buffers durable and backpressured so throughput cannot silently lose data?
- **Approximation policy**: Where is an approximate count acceptable, and what error bound is documented?
- **Hot-partition alerts**: Is the ratio of hottest to median shard monitored, not just the fleet average?
- **Fallback sizing**: Can the primary absorb replica reads when replicas are shed, or is fallback rate-limited?
- **Connection budgets**: Do pooled connections across all services fit within each database's `max_connections`?
- **Batch bounds**: Are batch size and batch timeout both bounded so low traffic cannot add latency?
- **Projection repair**: Does every materialized view have an owner and a reconciliation job for drift?

---

## Interview Drill

**Q1. Explain why adding a node to a `hash(key) % N` setup causes a cold-cache database collapse, and quantify it for $N = 10$.**

<details><summary>Model Answer</summary>

Changing the modulus from $N$ to $N+1$ changes the bucket of almost every key. The fraction that stay is about $1/N$, so the fraction that move is $\frac{N-1}{N}$. For $N = 10$ that is 90% of keys. Those keys' cache entries are now on the wrong shard, so the hit rate collapses and roughly 90% of reads fall through to the database simultaneously — a self-inflicted denial of service during a routine scaling operation. Consistent hashing limits the moved fraction to about $\frac{K}{N}$, preserving the cache.
</details>

**Q2. Why does a consistent-hashing ring with one point per node produce skewed load, and how do vnodes fix it?**

<details><summary>Model Answer</summary>

Node positions on the ring are random, so the arcs between them vary in size; a node with a large arc owns far more keys than one with a small arc. With only $N$ points the standard deviation of per-node load is large. Adding 100–200 virtual nodes per physical node replaces a few large arcs with many small ones, so the law of large numbers tightens the distribution and the relative standard deviation falls roughly with $\frac{1}{\sqrt{V}}$. Vnodes also let a bigger machine own more vnodes and thus a proportionally larger share.
</details>

**Q3. A user updates their profile, then immediately reloads and sees the old value. Walk through the causes and the full set of RYW mitigations.**

<details><summary>Model Answer</summary>

The write was acknowledged by the primary but the replica serving the read has not applied that LSN yet, so replication lag produces a stale read. Mitigations: carry the commit LSN/GTID as a watermark and route to a replica that has applied it, or wait until one has; route the user's reads to the primary for $T$ seconds after a write using a session flag; use sticky sessions so the app can remember that flag and LSN; and shed replicas whose lag exceeds a threshold so the staleness window is bounded. In practice these are combined.
</details>

**Q4. What makes a good shard key, and why is a monotonic timestamp or auto-incrementing ID a bad choice?**

<details><summary>Model Answer</summary>

A good key has high cardinality, aligns with access locality so common queries touch one shard, avoids cross-shard joins and transactions, and spreads writes evenly. A monotonic key sends every new write to whichever shard currently owns the maximum value, creating a write hot partition that more shards cannot fix. Hash the monotonic value or combine it with a high-cardinality dimension to distribute new writes.
</details>

**Q5. Design an online migration from 10 to 11 shards without downtime.**

<details><summary>Model Answer</summary>

Use consistent hashing with vnodes so only about $\frac{K}{N}$ of keys move in the first place. Start dual-writing affected keys to old and new shards, backfill historical data in the background, shadow-read both and compare, canary a fraction of reads to the new shard, then cut over fully and retire the old placement. If a directory layer exists, the final switch is a routing change; otherwise the ring configuration must be versioned and consistent across all clients.
</details>

**Q6. Why does `UPDATE posts SET likes = likes + 1 WHERE id = 42` die at roughly 500–2,000 writes/s, and how does key salting help?**

<details><summary>Model Answer</summary>

Every increment takes an exclusive row lock on one row, so all writes to that post serialize on the same lock and WAL entry; latency and aborts grow without bound past a few thousand per second. Key salting creates $S$ sub-rows and sends each increment to a randomly chosen one, so up to $S$ rows can be locked concurrently, multiplying write throughput by roughly $S$. Reads sum the sub-rows or use a periodic rollup.
</details>

**Q7. When should you choose CQRS, and when is it needless complexity?**

<details><summary>Model Answer</summary>

Choose it when the read and write models genuinely diverge — for example, a simple append-only write store feeding several differently shaped read projections with different scaling needs. It is needless when reads and writes would use essentially the same tables: you add message plumbing, eventual consistency, and reconciliation without removing a real bottleneck. The test is whether a single model is actually a bottleneck before paying the complexity cost.
</details>

**Q8. For a "unique visitors" metric and a "most-viewed posts" leaderboard, which counting structures would you use and why?**

<details><summary>Model Answer</summary>

Unique visitors needs cardinality estimation, so HyperLogLog gives a ~2% estimate in about 12 KB per sketch regardless of scale, where an exact set would be enormous. The most-viewed leaderboard needs per-item frequencies to find heavy hitters, so a Count-Min Sketch gives frequencies with bounded overestimation; an exact sorted set is used when precise ordering matters and the key space is small. Both sketch math details belong to the DSA track; here they are chosen as building blocks to avoid exact counters at extreme scale.
</details>
