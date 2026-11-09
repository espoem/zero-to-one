# Redis Certifications & Exam Coverage

This directory holds the exam coverage matrix for the Redis track and the preparation question bank ([redis-certified-associate-developer.md](redis-certified-associate-developer.md)).

---

## 1. Exam status (verified 2026-11-06)

| Exam | Vendor | Status | Format | Product version |
| --- | --- | --- | --- | --- |
| **Redis Certified Associate Developer** | Redis Ltd. | **Active** (relaunched; registration open on [redis.io/certifications/developer](https://redis.io/certifications/developer/)) | 65 questions, 90 minutes, passing score 70 %, online, AI-proctored via Kryterion Webassessor, English only, $175 per attempt, 14-day wait before a retake, valid 2 years | Redis 8.x / 7.x core commands |
| Redis Certified Associate Cloud Operator | Redis Ltd. | Listed on [redis.io/certifications](https://redis.io/certifications) | Same delivery model | Redis Cloud (out of scope: product-specific operations) |
| Redis Certified Associate Software Operator | Redis Ltd. | Listed on [redis.io/certifications](https://redis.io/certifications) | Same delivery model | Redis Software (out of scope: commercial product) |
| Redis Certified Developer (2019 programme) | Redis Ltd. | **Retired**: registrations closed June 2024, certificates expired 31 Dec 2024 | — | — |

**Official exam guide (retrieved 2026-11-06).** The official exam guide (`guide-b.pdf`, hosted on `cdn.sanity.io` and linked from [redis.io/certifications/developer](https://redis.io/certifications/developer/) / Redis University) specifies 65 questions, 90 minutes, 70 % passing score, and the following 5 official domains and weights:

1. **D1 Data Modeling with Redis data structures**: 46 % (~30 questions)
2. **D2 Caching strategies and expiration**: 20 % (~13 questions)
3. **D3 Persistence, key lifecycle, and operational commands**: 15 % (~10 questions)
4. **D4 Client library usage and connection management**: 11 % (~7 questions)
5. **D5 Concurrency, transactions, and atomicity**: 8 % (~5 questions)

**Exam delta.** The exam page names no Redis version. Core commands follow 7.x/8.x semantics. Features newer than 8.0 (8.2 `BITOP` operators and `XDELEX`/`XACKDEL`, 8.4 `DELEX`/`DIGEST`/`MSETEX`/`CLUSTER MIGRATION`, 8.6 `HOTKEYS`/LRM/`IDMP`, 8.8 Array/`INCREX`/`XNACK`, 8.10 compact hashes/`LMOVEM`/`SUNIONCARD`) are treated as unlikely to appear on standard exam forms. Questions on them belong in the bank only as harder-than-exam items, tagged as such.

**Interview-format fallback.** For roles that do not care about the certificate, the same bank doubles as preparation for the **senior backend engineer interview** on Redis: system-design follow-ups (caching, rate limiting, locks, queues), data-structure selection, and failure-mode questions. Each module's Interview Drill is the oral-interview counterpart of the bank.

---

## 2. Scope boundaries

- Administration of Redis Cloud and Redis Software is out of scope (commercial products; separate operator exams).
- Client-library specifics beyond node-redis/ioredis concepts (Jedis, Lettuce, redis-py APIs) are out of scope; the exam is language-neutral at the command level although the course offers several languages.
- Operations topics (persistence internals, security, kernel settings) are covered by the track for completeness and appear in the bank as a minority of "performance/debugging awareness" questions.

---

## 3. Domain → module coverage matrix

Official domains and weights verified 2026-11-06 against the official Redis Certified Associate Developer exam guide (`guide-b.pdf` via `cdn.sanity.io` / Redis University).

| # | Domain / objectives | Official weight | Target Qs | Modules | Executable proofs | Status |
| --- | --- | --- | --- | --- | --- | --- |
| D1 | **Data Modeling with Redis data structures**: Core types (strings, lists, hashes, sets, sorted sets, streams, bitmaps, HyperLogLog), JSON, Query Engine, secondary indexing, vector search, Streams consumer groups, key naming and design patterns | 46 % | 30 | [02](../modules/02-core-data-types-encodings-and-complexity.md), [03](../modules/03-keys-expiry-eviction-and-memory.md), [06](../modules/06-messaging-pubsub-streams-and-queues.md), [07](../modules/07-coordination-rate-limits-locks-and-idempotency.md), [08](../modules/08-query-engine-json-vectors-and-probabilistic.md) | `02-*`, `03-*`, `06-*`, `07-*`, `08-*` hermetic and integration tests | ✅ |
| D2 | **Caching strategies and expiration**: Cache-aside, write-through, near-cache/client-side caching (RESP3 tracking, BCAST), TTL semantics, active/passive key expiration, eviction policies (LRU, LFU, LRM), memory limits | 20 % | 13 | [03](../modules/03-keys-expiry-eviction-and-memory.md), [04](../modules/04-caching-patterns.md) | `03-*`, `04-*` | ✅ |
| D3 | **Persistence, key lifecycle, and operational commands**: RDB snapshots, AOF append-only logging (fsync policies, multi-part AOF), `WAITAOF`, object inspection (`OBJECT`, `MEMORY USAGE`), operational diagnostics (`INFO`, `SLOWLOG`, `LATENCY`, `MONITOR`, hot/big keys) | 15 % | 10 | [03](../modules/03-keys-expiry-eviction-and-memory.md), [09](../modules/09-persistence-rdb-aof-and-backup.md), [12](../modules/12-operations-security-observability-and-valkey.md) | `03-*`, `09-*`, `12-*` | ✅ |
| D4 | **Client library usage and connection management**: RESP2 vs RESP3 protocol negotiation, pipelining, connection pools, Cluster client topology routing (`MOVED`, `ASK`), Sentinel connection failover, retry and backoff strategies | 11 % | 7 | [01](../modules/01-model-architecture-and-protocol.md), [10](../modules/10-replication-and-sentinel.md), [11](../modules/11-redis-cluster.md) | `01-*`, `10-*`, `11-*` | ✅ |
| D5 | **Concurrency, transactions, and atomicity**: `MULTI`/`EXEC`, optimistic locking (`WATCH`), Lua scripting (`EVAL`/`EVALSHA`), Functions (7.0+), atomic conditional commands (`DELEX`, `INCREX`, `SET NX PX`), distributed locks, and fencing tokens | 8 % | 5 | [05](../modules/05-transactions-scripting-and-functions.md), [07](../modules/07-coordination-rate-limits-locks-and-idempotency.md) | `05-*`, `07-*`, [`examples/lua/`](../examples/lua/) | ✅ |

All 5 official domains are fully covered (0 ❌, 0 🟡).

---

## 4. Module → domain index

| Module                                        | Primary official domains |
| --------------------------------------------- | ------------------------ |
| 01 Execution model, RESP, licensing           | D4                       |
| 02 Data types, encodings, complexity          | D1                       |
| 03 Keys, expiry, eviction, memory             | D1, D2, D3               |
| 04 Caching patterns                           | D2                       |
| 05 Transactions, scripting, Functions         | D1, D5                   |
| 06 Messaging                                  | D1                       |
| 07 Coordination patterns                      | D1, D2, D5               |
| 08 Query Engine, JSON, vectors, probabilistic | D1                       |
| 09 Persistence                                | D3                       |
| 10 Replication and Sentinel                   | D3, D4                   |
| 11 Redis Cluster                              | D1, D4                   |
| 12 Operations, security, Valkey               | D3                       |

---

## 5. Question-bank specification (for the drafter)

**Output file:** [redis-certified-associate-developer.md](redis-certified-associate-developer.md). Follow AGENTS.md § Certification and Exam Coverage exactly, including the per-question format:

```markdown
### Q-RCAD-<NNN> · <Domain code and name> · difficulty <1-3> · <single|multi|scenario|ordering|hands-on>

<question text>
- A) …
- B) …
<details><summary>Answer</summary>

**B.** <explanation>

- Why not A: …
- Ref: [modules/NN-….md](../modules/NN-….md#anchor), <official redis.io doc URL>

</details>
```

**Target counts** (65 questions = one exam length; matching official guide domain distribution):

| Domain | Official weight | Questions | Of which difficulty 3 | Suggested types |
| --- | --- | --- | --- | --- |
| D1 Data Modeling with Redis data structures | 46 % | 30 | 8 | single, multi, scenario (data structures, patterns, JSON, vectors, streams) |
| D2 Caching strategies and expiration | 20 % | 13 | 3 | scenario-heavy (cache-aside, TTLs, client-side caching, eviction policies) |
| D3 Persistence, key lifecycle, and operational commands | 15 % | 10 | 3 | scenario, ordering (RDB/AOF, diagnostics, INFO, memory) |
| D4 Client library usage and connection management | 11 % | 7 | 2 | single, scenario (RESP3, pipelining, MOVED/ASK, topology) |
| D5 Concurrency, transactions, and atomicity | 8 % | 5 | 1 | single, scenario (MULTI/EXEC, WATCH, Lua scripts, locks) |
| **Total** | **100 %** | **65** | **17** |  |

**Rules for the drafter:**

1. **Original questions only.** Do not reproduce, paraphrase or seek real exam content or the official practice questions. Base every question on the modules and on redis.io documentation.
2. **Every fact must come from a module of this track** (cite the module and an existing heading anchor: run `node tools/link-check/check.mjs technologies/redis`) plus one official doc URL. Do not use facts the modules mark as unverified (`IDMP` syntax, `BACKUP`, `CLUSTER MIGRATION` syntax, Array commands, `INCREX` on Valkey) except as explicitly flagged difficulty-3 "beyond the exam" items.
3. **Distractors** must be plausible and each needs a one-line "Why not X". Prefer the misconceptions the modules name (e.g. "MULTI rolls back", "SCAN never returns duplicates", "volatile-lru evicts any key", "Pub/Sub stores messages for offline subscribers", "Redlock gives correctness", "ASK updates the slot map").
4. **Hands-on tasks** (at least 3, in D1, D5, D6): each must point to an existing runnable test in `examples/ts/` or `examples/ts/integration/` that verifies the answer (for example the `CLUSTER KEYSLOT`, `WATCH` or `XAUTOCLAIM` tests). Do not create new test files; list any test you would need in the review file instead.
5. **Mock exam section** at the end: 65 questions in 90 minutes, domain mix as in the table, listing question IDs per domain, a scoring key (pass at 46/65 ≈ 70 %), and a per-domain score breakdown template.
6. Respect Markdown gates: escape `|` inside table cells as `\|`, no Mermaid needed, relative links only.
7. Tag version-specific facts with the version ("since 7.0", "8.4+").

Related references: [GLOSSARY.md](../GLOSSARY.md) (EN ↔ CZ, established terms only, root-glossary terms reused verbatim) and [CHEATSHEET.md](../CHEATSHEET.md) (commands by type with complexity, configs and defaults from the modules, error replies, cluster/replication cheat lines).

---

## 6. Upkeep

When the exam guide is retrieved or updated upstream, update § 1 (guide version/date, product version, official domains), § 3 (weights, status), § 5 (counts) and the bank in the same change (AGENTS.md § Certification and Exam Coverage rule 6).
