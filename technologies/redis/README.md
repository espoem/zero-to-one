# Redis 8 (with Valkey 9 deltas)

> **Verified against Redis Open Source 8.10.3 (2026-10-26; Docker `redis:8.10.3`), Valkey 9.1.3 (2026-10-26; `valkey/valkey:9.1.3`), node-redis (`redis` on npm) 6.3.1, testcontainers 12.2.1, TypeScript 7.0.2, Node 26.12.1 on 2026-11-04.** Integration tests were executed while authoring against a local Redis 7.0.15 binary only; tests that need 7.2+/8.x skip with a message there and must be run against the pinned 8.10.3 image (see [Running the examples](#running-the-examples)).

Redis is a single-threaded, in-memory **data-structure server**: typed values, atomic commands, a simple wire protocol, with persistence, replication and clustering layered on top. Since 8.0, Redis Open Source also includes the former Redis Stack modules (Query Engine, JSON, time series, probabilistic types) and Vector Sets, under a choice of RSALv2, SSPLv1 or AGPLv3. Valkey is the BSD-licensed Linux Foundation fork of Redis 7.2.4. This track teaches Redis 8.x as one progressive narrative from the execution model to production operations, and marks every place where Valkey 9.x differs.

## Prerequisites

- TypeScript/Node.js basics (the examples are TypeScript run by `node --test`).
- Hash tables, skip lists and probabilistic structures at the level of [`algorithms/dsa`](../../algorithms/dsa/README.md); replication, partitioning and caching theory at the level of [`architecture/data-systems`](../../architecture/data-systems/README.md); locks, leases and delivery semantics from [`architecture/distributed-systems`](../../architecture/distributed-systems/README.md). This track links to them instead of repeating them.

## Syllabus

| # | Module | Core topics |
| --- | --- | --- |
| 01 | [Execution model, architecture, RESP, licensing](modules/01-model-architecture-and-protocol.md) | Event loop, what runs off the main thread, latency model, pipelining, RESP2/RESP3 byte by byte, connections and key specs, Redis vs Valkey licensing (Then vs now 7.2 → 7.4 → 8.0) |
| 02 | [Data types, encodings, complexity](modules/02-core-data-types-encodings-and-complexity.md) | Type system, Big-O per command, SDS/listpack/intset/dict/skiplist with spans, thresholds and the one-way rule, bitmaps, HLL, geo, hash-field TTL, 8.x additions, modelling guide |
| 03 | [Keys, expiry, eviction, memory](modules/03-keys-expiry-eviction-and-memory.md) | TTL semantics, lazy and active expiry, approximated LRU and LFU, 8.6 LRM, memory accounting, `SCAN`'s reverse-binary cursor, `UNLINK` and lazy free |
| 04 | [Caching patterns](modules/04-caching-patterns.md) | Cache-aside done properly, stampede protection, negative caching, XFetch, dual-write races, client-side caching with `CLIENT TRACKING` |
| 05 | [Transactions, Lua and Functions](modules/05-transactions-scripting-and-functions.md) | `MULTI/EXEC` without rollback, `WATCH`, `EVAL`/`EVALSHA`, conversions, effects replication, Functions, `BUSY`/`SCRIPT KILL` |
| 06 | [Pub/Sub, Streams, list queues](modules/06-messaging-pubsub-streams-and-queues.md) | Delivery semantics, sharded Pub/Sub, consumer groups and the PEL, `XAUTOCLAIM`, trimming, 8.6 idempotent production, `BLMOVE` reliable queues, keyspace notifications, vs Kafka |
| 07 | [Rate limits, locks, idempotency](modules/07-coordination-rate-limits-locks-and-idempotency.md) | Five rate limiters and 8.8 `INCREX`, locks and fencing tokens, the Redlock debate, leaderboards, sessions, idempotency keys |
| 08 | [Query Engine, JSON, vectors, probabilistic](modules/08-query-engine-json-vectors-and-probabilistic.md) | JSONPath, `FT.CREATE`/`FT.SEARCH`/`FT.AGGREGATE`, query injection, vector search, Vector Sets, time series, Bloom/Cuckoo/CMS/Top-K/t-digest, valkey-bundle |
| 09 | [Persistence and backups](modules/09-persistence-rdb-aof-and-backup.md) | RDB and `fork()`/copy-on-write, AOF and `appendfsync`, multi-part AOF (7.0), loss windows, backups, 8.10 `BACKUP` |
| 10 | [Replication and Sentinel](modules/10-replication-and-sentinel.md) | PSYNC/PSYNC2, backlog sizing, asynchronous loss, `WAIT`/`WAITAOF`, Sentinel quorum vs majority, split brain and `min-replicas-to-write` |
| 11 | [Redis Cluster](modules/11-redis-cluster.md) | 16 384 slots, hash tags, `CROSSSLOT`, `MOVED`/`ASK`, resharding and atomic slot migration, failover and lost writes, Valkey 9 cluster features |
| 12 | [Operations, security, observability, Valkey delta](modules/12-operations-security-observability-and-valkey.md) | Exposure, ACLs, TLS, latency diagnosis, hot/big keys, kernel settings, alerts, Redis 8.10 vs Valkey 9.1 matrix, version history |

**Out of scope:** Redis Cloud and Redis Software administration (commercial products with their own operator exams); Redis modules development (`RM_*` C API); Active-Active (CRDT) geo-replication, which is a Redis Software feature; Dragonfly and KeyDB beyond context.

## Certifications & Exams

- **Redis Certified Associate Developer** (Redis Ltd.): **active**, relaunched in 2026; 65 questions, 90 minutes, 70 % to pass, online and AI-proctored, $175, valid 2 years; product version not stated (Redis 8.x/7.x core commands). Official page: [redis.io/certifications/developer](https://redis.io/certifications/developer/). Official exam guide (`guide-b.pdf`) verified 2026-11-06 with 5 domains: Data Modeling (46 %), Caching & Expiration (20 %), Persistence & Operations (15 %), Client Libraries & Connections (11 %), and Concurrency & Transactions (8 %).
- The 2019 **Redis Certified Developer** programme is **retired** (registrations closed June 2024, certificates expired December 2024).
- Redis Certified Associate Cloud Operator and Software Operator exams exist for the commercial products and are out of scope.
- Interview format: the same material prepares for senior backend interviews on Redis (system-design follow-ups and failure modes); every module ends with an Interview Drill.

Coverage matrix and domain specification: [exams/README.md](exams/README.md). Preparation question bank: [exams/redis-certified-associate-developer.md](exams/redis-certified-associate-developer.md) (65 questions across 5 official domains with full mock exam). Bilingual glossary: [GLOSSARY.md](GLOSSARY.md). Command & configuration reference: [CHEATSHEET.md](CHEATSHEET.md).

## Running the examples

```bash
mise install                 # node 26 + TypeScript 7.0.2 (see .mise.toml / mise.lock)
mise exec -- npm ci
mise exec -- npm test        # hermetic: RESP parser, encodings, expiry/eviction models, Lua via an embedded interpreter, …
mise exec -- npm run typecheck
```

**Integration tests** (`npm run test:integration`) need a real server. The harness tries, in order:

1. `REDIS_URL=redis://host:port` — an existing server (add `ZTO_DEDICATED=1` if it is a throwaway server, so tests that change `maxmemory` or flush data run);
2. `REDIS_SERVER_BIN=/path/to/redis-server` — spawns private servers on free ports (required for the multi-process tests: replica, Sentinel, 3-node Cluster, `kill -9` recovery);
3. Docker via testcontainers with the pinned `redis:8.10.3` image (`REDIS_IMAGE=valkey/valkey:9.1.3` runs the suite against Valkey);
4. otherwise every integration test skips with the reason.

Tests that need a newer server than the one found skip with "needs Redis >= x.y". Multi-node labs for Docker are in [docker-compose.yml](docker-compose.yml) (profiles `sentinel`, `cluster`, `valkey`).

Each module ends with a **Proof map** listing which claims are proven hermetically and which only by integration tests.
