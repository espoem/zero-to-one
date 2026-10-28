# Brief: Redis (`technologies/redis`)

| | |
|---|---|
| Phase | 2 |
| Kind | NEW track: create from scratch |
| Primary (author) | **Opus · Claude Code** |
| Drafter (on request) | pi · DeepSeek |
| Challenger | pi · Muse Spark 1.3 |
| Verifier | Antigravity |
| Final gate | Opus (claude.ai session) |
| Branch / worktree | `track/redis` · `../zto-redis` |
| Depends on | phase 1 foundations |
| Research dossier | `.agents/research/B-data.md` |

## 0. Read before starting (binding)
1. `AGENTS.md`: the contract. If it conflicts with this brief, AGENTS.md wins; log the conflict in your review file.
2. `.agents/OWNERSHIP.md`: what you own vs only cross-link.
3. `.agents/REVIEW.md`: the checklist your work is judged against.
4. Your global/agent instructions still apply where they do not conflict.

## 1. Owner decisions and track-specific instructions
- Teach Redis 8.x (tri-licensed RSALv2/SSPLv1/AGPLv3) and add a Valkey 9.x delta section with "Then vs now" for the 7.4 → 8.0 licence and module-bundling change.
- Teach the **latest stable** versions. Add **Then vs now** comparisons wherever practice changed (AGENTS.md § Version Currency).
- Pin **all** tooling via mise (`.mise.toml` + `mise.lock`): node 26 for JS/TS, plus every CLI and runtime the examples need.

## 2. Ownership
**You own (full treatment):**
- (see dossier "Overlaps / dedupe")

**Cross-link only (do not re-explain):**
- Heaps, tries, LRU/LFU implementations, B-tree *as a data structure* → owned by `algorithms/dsa`
- Bloom / HyperLogLog / Count-Min math → owned by `algorithms/dsa`
- Storage engines: B-tree vs LSM, WAL/ARIES, compaction, buffer pools → owned by `architecture/data-systems`
- Indexing theory: inverted index, BM25, vector ANN (HNSW, IVF, quantisation) → owned by `architecture/data-systems`
- Replication mechanics (leader/follower, multi-leader, leaderless), sharding/rebalancing, CDC → owned by `architecture/data-systems`
- Caching theory (consistency, dual writes, invalidation, stampede) → owned by `architecture/data-systems`
- Consensus (Paxos/Raft/ZAB), replicated state machines, leases & fencing, distributed locks → owned by `architecture/distributed-systems`

## 3. Research dossier (verified 2026-10-27/28; re-verify before use)

#### Redis — `technologies/redis` (NEW)

- **Current stable version(s)**
  - **Redis Open Source 8.10.2** (Latest; 2026-09-17 security release, alongside 8.8.3, 8.6.7, 8.4.7, 8.2.10) (https://github.com/redis/redis/releases).
  - What's new (https://redis.io/docs/latest/develop/whats-new/):
    - **8.10** (Q3 2026): compact hashes, incremental backup/restore, JSONPath extensions, `LMOVEM/BLMOVEM`, `SUNIONCARD/SDIFFCARD`, `FT.AGGREGATE COLLECT`
    - **8.8** (Q2 2026): new **Array** data type, `INCREX` rate limiter
    - **8.6** (Q1 2026): stream idempotency, LRM ("least recently modified") eviction policies, hot-key detection, TLS cert auth
    - **8.0** (GA May 2025): Search/Query Engine, JSON, TimeSeries and probabilistic structures merged into core; new **Vector Set** type (https://redis.io/blog/redis-8-ga/)
  - **Licensing:**
    - ≥8.0.0: **RSALv2 or SSPLv1 or AGPLv3** (pick one)
    - 7.4.x–7.8.x: RSALv2/SSPLv1 only
    - ≤7.2: BSD-3 (https://redis.io/legal/licenses/)
  - **Valkey** (Linux Foundation fork of 7.2.4, BSD-3):
    - **9.1.2 latest** (2026-08-31); 9.0.6; **9.2.0-rc1** (2026-09-16), which adds forkless RDB snapshots, a Path Hash type, ACL roles, server-side hot-key detection and B+tree large sorted sets (https://github.com/valkey-io/valkey/releases)
    - **9.0 GA Oct 2025:** atomic slot migration, numbered databases in cluster mode, hash field expiration (https://valkey.io/blog/introducing-valkey-9/)
    - Modules ecosystem: valkey-search, valkey-json, valkey-bloom (bundle naming unverified)
  - Other clones: Dragonfly and KeyDB as context only.
  - Clients (npm, verified today): `redis` (node-redis) **6.0.0**, `ioredis` **6.3.0**.
  - Local `redis-server` in this sandbox is 7.0.15, which shows why pinning matters.

- **Authoritative syllabi used**
  - Redis docs: https://redis.io/docs/latest/ (data types, Redis Query Engine, persistence, replication, Sentinel, Cluster spec https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/, latency/memory optimization, keyspace notifications, client-side caching, Lua/Functions, ACL).
  - **Redis Certified Developer:** domains are data structures, data modeling, performance, debugging and clustered code. Admin is excluded. **The exam was taken down in January 2026, with a relaunch planned for 2026** (https://redis.io/blog/redis-developer-certification-is-here/). Redis University "Develop with Redis" path as the substitute (https://redis.io/tutorials/university/).
  - Valkey docs: https://valkey.io/topics/
  - Kleppmann's "How to do distributed locking" (Redlock critique): https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html

- **Proposed modules** (12)
  1. **Model & architecture:** single-threaded command execution + I/O threads, event loop, RESP2/RESP3, pipelining, latency mental model, Redis vs Valkey vs managed offerings, licensing timeline.
  2. **Core data types & complexity:** strings/bitmaps/bitfields, lists, hashes (+ field expiration `HEXPIRE`), sets, sorted sets (skiplist + listpack), HyperLogLog, geo; Big-O per command; encodings (listpack/intset/quicklist) and `OBJECT ENCODING`.
  3. **Keys, expiry & memory:** TTL semantics (lazy + active expiry), `maxmemory` policies (LRU/LFU approximations, 8.6 LRM), memory overhead/fragmentation, `MEMORY USAGE`, big keys, `SCAN` vs `KEYS`, `UNLINK` vs `DEL`.
  4. **Caching patterns:** cache-aside/read-through/write-through/write-behind, stampede protection (locks, probabilistic early expiration, request coalescing), negative caching, invalidation, client-side caching (`CLIENT TRACKING`), consistency with the DB (dual-write problem).
  5. **Atomicity & scripting:** `MULTI/EXEC` (no rollback), `WATCH` optimistic locking, Lua `EVAL` vs Functions (`FUNCTION LOAD`), script determinism, blocking risk.
  6. **Messaging:** Pub/Sub (fire-and-forget, sharded pub/sub), Streams (`XADD`, consumer groups, PEL, `XAUTOCLAIM`, trimming, 8.6 idempotency), lists as queues (`BLMOVE` reliable queue), vs Kafka/SKIP LOCKED.
  7. **Coordination patterns:** rate limiters (fixed/sliding window, token bucket, 8.8 `INCREX`), distributed locks (`SET NX PX` + fencing; Redlock debate), leaderboards, sessions, idempotency keys.
  8. **Redis Query Engine & JSON:** JSON type + JSONPath, `FT.CREATE` on hash/JSON, TEXT/TAG/NUMERIC/GEO/VECTOR fields, `FT.SEARCH`/`FT.AGGREGATE`, vector search (FLAT/HNSW/SVS quantization), Vector Sets (`VADD/VSIM`), TimeSeries and probabilistic types (Bloom, Cuckoo, CMS, Top-K, t-digest). Valkey equivalents differ.
  9. **Persistence:** RDB (fork + COW), AOF (`appendfsync`, rewrite, multi-part AOF), hybrid, 8.10 incremental backup, durability guarantees and data-loss windows.
  10. **Replication & Sentinel:** async replication, PSYNC/backlog, `WAIT`/`WAITAOF`, replica-of-replica, Sentinel quorum/failover, split-brain and `min-replicas-to-write`.
  11. **Redis Cluster:** 16384 hash slots (CRC16), hash tags, MOVED/ASK, resharding, cross-slot errors, failover, client topology handling, Valkey 9 atomic slot migration and multi-DB cluster.
  12. **Operations & security:** ACLs, TLS, `protected-mode`, `rename-command`, `SLOWLOG`, `LATENCY DOCTOR`, `INFO`, hot/big key detection (8.6 / `--hotkeys`), kernel THP and overcommit, observability metrics.

- **Gotchas & production failure modes**
  1. `KEYS *` (and `SMEMBERS`/`HGETALL`/`LRANGE 0 -1` on huge collections) block the single command thread, causing a latency spike for all clients. Use `SCAN` family.
  2. `DEL` of a multi-million-element key blocks. Use `UNLINK`/`lazyfree-lazy-*`.
  3. `BGSAVE`/AOF rewrite `fork()` with a large dataset: COW memory doubling under write load, then OOM kill. Linux THP makes fork latency and COW worse; `vm.overcommit_memory=1` is required.
  4. `maxmemory` unset with `noeviction` gives write errors (OOM command not allowed). With `allkeys-*` on a store you treat as durable, data is silently evicted.
  5. Cache stampede on hot key expiry thunders the DB.
  6. `MULTI/EXEC` does not roll back on runtime errors; partial application surprises.
  7. Lua scripts that run long block everything. `SCRIPT KILL` only works if the script hasn't written.
  8. Async replication: acknowledged writes are lost on failover. `WAIT` reduces this but isn't strong consistency.
  9. Sentinel split brain: an old master keeps accepting writes in a minority partition (mitigate with `min-replicas-to-write`).
  10. Cluster `CROSSSLOT` errors for multi-key commands/Lua. Overusing hash tags creates hot slots.
  11. Pub/Sub messages are lost if the subscriber is disconnected. Slow subscribers blow the output buffer (`client-output-buffer-limit pubsub`) and get disconnected.
  12. Streams without `MAXLEN`/`MINID` trimming grow unbounded. A PEL left unclaimed leaves messages stuck forever.
  13. Distributed lock without fencing tokens: a GC pause or expiry means two holders.
  14. `SELECT` db numbers don't work in Cluster before Valkey 9 / not in Redis Cluster (unverified for Redis 8.x).
  15. Node clients: default offline queue + reconnect can replay commands; pipelining without backpressure leads to memory blowup.
  16. Licensing: AGPLv3 network-use clause if you modify and offer Redis as a service. Some orgs mandate Valkey instead.

- **Interview hot topics**
  - Why Redis is fast (in-memory, single-threaded command path, epoll)
  - Choosing a data structure for X (leaderboard, rate limit, dedupe)
  - Caching strategies, invalidation and stampede
  - Persistence RDB vs AOF trade-offs
  - Eviction policies
  - Replication consistency; Sentinel vs Cluster
  - Hash slots / resharding
  - Distributed locks and Redlock critique
  - Streams vs Pub/Sub vs Kafka
  - Hot keys / big keys diagnosis
  - Redis vs Valkey licensing story

- **Executable-proof strategy**
  - **Tier 1 (fast):** a `redis-server` binary pinned via mise (`redis` via asdf/aqua plugin; availability of 8.10 in the mise registry is unverified). Fallback: Docker `redis:8.10.2` and `valkey/valkey:9.1.2` (tags per Docker Hub convention; unverified). Use testcontainers 12.2.1 `GenericContainer` (or `@testcontainers/redis`, unverified version) and Vitest + node-redis 6.0.0.
  - **Deterministic patterns:**
    - Assert `OBJECT ENCODING` transitions (listpack→hashtable at thresholds).
    - Prove `MULTI` no-rollback and `WATCH` aborts.
    - Prove Lua atomicity; Streams consumer group + `XAUTOCLAIM` (use `DEBUG SLEEP`-free logic with explicit idle times via `XCLAIM … IDLE`).
    - Prove TTL behaviour with `DEBUG SET-ACTIVE-EXPIRE 0` to control expiry.
    - Prove eviction with a tiny `maxmemory`.
    - Prove `KEYS` blocking by measuring a concurrent `PING` latency distribution. Assert relative ordering only; mark timing as non-deterministic.
  - **Tier 2, docker compose:** primary + 2 replicas + 3 Sentinels (failover via `SENTINEL FAILOVER`, assert new master); 6-node Cluster (`redis-cli --cluster create`, assert MOVED/ASK, CROSSSLOT, reshard); Valkey side-by-side compat tests running the same suite against both images.
  - **Cannot prove locally:** real network partitions (approximate with `docker network disconnect` or `toxiproxy`; deterministic enough to assert lost-write scenarios), fork COW memory at scale, THP effects. Fallback: `INFO persistence`/`latest_fork_usec` assertions and config-validation tests.

- **Overlaps / dedupe**
  - `architecture/data-systems` owns replication theory (async vs sync, failover, split brain), partitioning/consistent-hashing theory, caching theory (consistency, dual writes, invalidation), distributed locking and fencing, and probabilistic data structures theory (HLL, Bloom).
  - The Redis track covers Redis's realisation.
  - Vector search theory goes in data-systems (shared with PG/ES/Turso).
  - Messaging/queues are compared with Kafka in a messaging track if one exists.

---

## 4. Re-verify list
These claims were marked unverified during research. Confirm or correct each one against a primary source before teaching it:
- Modules ecosystem: valkey-search, valkey-json, valkey-bloom (bundle naming unverified)
- 14. `SELECT` db numbers don't work in Cluster before Valkey 9 / not in Redis Cluster (unverified for Redis 8.x).
- **Tier 1 (fast):** a `redis-server` binary pinned via mise (`redis` via asdf/aqua plugin; availability of 8.10 in the mise registry is unverified). Fallback: Docker `redis:8.10.2` and `valkey/valkey:9.1.2` (tags per Docker Hub convention; unverified). Use testcontainers 12.2.1 `GenericContainer` (or `@testcontainers/redis`, unverified version) and Vitest + node-redis 6.0.0.

## 5. Certifications & exams
Follow AGENTS.md § Certification and Exam Coverage exactly. Minimum deliverables:
1. **README "Certifications & Exams" section.** Start from the exams named in the dossier above ("Authoritative syllabi used"). Re-verify each exam's code, status, guide version/date, targeted product version and domain weights on the official page. Where no certification exists, say so and use the recognised interview format.
2. **`exams/README.md` coverage matrix.** Rows are domain/objective, weight, modules, examples, status. No ❌ at hand-off.
3. **`exams/<exam-code>.md` question banks.**
   - At least 5 questions per domain and at least 60 per certification, weighted like the official domains.
   - The real exam's question types, plus hands-on tasks with verification scripts for performance-based exams.
   - Difficulty tags. Answers with explanations, why each distractor is wrong, and module + official-doc refs.
   - One full mock exam with a scoring key.
4. **Exam-delta callouts** where the exam's product version differs from the track's.
5. **Original questions only.** No braindump content.

## 6. Code languages
Per AGENTS.md § Code Example Languages:
- **Primary:** pseudocode (where algorithms or protocols are described) + TypeScript (or the track's own language, for language tracks).
- **Secondary:** Python, Rust or Nim only where it teaches something. Each language lives in `examples/<lang>/` with its own mise-pinned toolchain and native test runner, and `test` runs them all.

## 7. Workflow and definition of done
1. **Primary (Opus)** works on branch `track/redis` and sets this track's row in `.agents/STATUS.md` to 🟦.
2. **Verify versions first.** Check every version in the dossier against its primary source today. Record the results in the README's `Verified against …` line. Resolve every item in the re-verify list below.
3. Build in stages: README syllabus + exam matrix → modules one by one, each with its examples/tests → glossary → cheatsheet → question banks → mock exam. Delegate bulk drafting (question-bank drafts, glossary candidates, cheatsheet tables) to the **Drafter**, then correct and integrate it yourself.
4. Before each commit: run `mise exec -- npm test` and `npm run typecheck` (or the equivalents), and `test:integration` if present. Commit with Conventional Commits scoped `(redis)`.
5. Self-check against `.agents/REVIEW.md`. Then set STATUS to 🟨 and write the hand-off at the top of `.agents/reviews/redis.md`:
   - what was done;
   - what was not done, and why;
   - every claim you are least sure of.
6. The **Challenger** attacks it and the **Verifier** checks it independently. Both record findings in `.agents/reviews/redis.md` (prompts in `.agents/KICKOFF.md`). The primary resolves the findings (🟧), Opus runs the final gate (🟪), and the owner merges (✅).
