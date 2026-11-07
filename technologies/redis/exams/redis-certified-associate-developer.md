# Redis Certified Associate Developer: Preparation Question Bank

A bank of 65 original practice questions for the **Redis Certified Associate Developer** exam (2026 relaunch: about 65 questions, 90 minutes, 70 % to pass), with a full-length mock exam at the end ([Mock exam](#mock-exam)). The bank doubles as preparation for a senior backend interview on Redis (caching, rate limiting, locks, queues, failure modes).

**How to use it.** Answer first, then open the answer. Every explanation says why each wrong option is wrong, and links to the teaching module heading and to an official redis.io page. Questions tagged `hands-on` can be reproduced against a real server; each names the existing test in [`examples/ts/`](../examples/ts/) that proves the answer.

---

## 1. Scope, version and integrity

- **Product version.** Questions teach **Redis Open Source 8.x** behaviour. Valkey is mentioned only where a module marks a difference (for example `DELEX` versus `DELIFEQ`). Facts newer than 8.0 are tagged with their version (for example "8.4+") and appear only as part of harder, difficulty 3 reasoning, never as the only thing a question tests. The exam page names no product version, so treat 8.2+ features as beyond the exam ([exams/README.md § 1](README.md#1-exam-status-verified-2026-11-06)).
- **Domain weights.** Verified 2026-11-06 against the official Redis Certified Associate Developer exam guide (`guide-b.pdf` hosted on `cdn.sanity.io` / Redis University). The official guide defines 5 domains: Data Modeling with Redis data structures (46 %, ~30 Qs), Caching strategies and expiration (20 %, ~13 Qs), Persistence, key lifecycle, and operational commands (15 %, ~10 Qs), Client library usage and connection management (11 %, ~7 Qs), and Concurrency, transactions, and atomicity (8 %, ~5 Qs). The bank maps the curriculum across these domains with detailed breakdown below ([exams/README.md § 3](README.md#3-domain--module-coverage-matrix)).
- **Originality.** All questions were written from this track's modules and the public redis.io documentation. None reproduces or paraphrases real exam content or the official practice questions.
- **Question IDs.** `Q-RCAD-<NNN>`; header fields are domain, difficulty (1 = recall, 2 = application, 3 = harder than the exam: multi-step reasoning, failure modes, version-specific detail) and type.
- **Types.** `single` (one answer), `multi` (the number of answers to select is stated), `scenario` (a production situation), `ordering` (put the steps in order), `hands-on` (a task with an observable result).

| Official Domain | Weight | Questions in Bank | Difficulty 3 | Modules |
| --- | --- | --- | --- | --- |
| D1 Data Modeling with Redis data structures | 46 % | 30 | 8 | [02](../modules/02-core-data-types-encodings-and-complexity.md), [03](../modules/03-keys-expiry-eviction-and-memory.md), [06](../modules/06-messaging-pubsub-streams-and-queues.md), [07](../modules/07-coordination-rate-limits-locks-and-idempotency.md), [08](../modules/08-query-engine-json-vectors-and-probabilistic.md) |
| D2 Caching strategies and expiration | 20 % | 13 | 3 | [03](../modules/03-keys-expiry-eviction-and-memory.md), [04](../modules/04-caching-patterns.md) |
| D3 Persistence, key lifecycle, and operational commands | 15 % | 10 | 3 | [03](../modules/03-keys-expiry-eviction-and-memory.md), [09](../modules/09-persistence-rdb-aof-and-backup.md), [12](../modules/12-operations-security-observability-and-valkey.md) |
| D4 Client library usage and connection management | 11 % | 7 | 2 | [01](../modules/01-model-architecture-and-protocol.md), [10](../modules/10-replication-and-sentinel.md), [11](../modules/11-redis-cluster.md) |
| D5 Concurrency, transactions, and atomicity | 8 % | 5 | 1 | [05](../modules/05-transactions-scripting-and-functions.md), [07](../modules/07-coordination-rate-limits-locks-and-idempotency.md) |
| **Total** | **100 %** | **65** | **17** |  |

---

## Domain 1: Data Modeling with Redis data structures

### Q-RCAD-001 · D1 Data Modeling with Redis data structures · difficulty 1 · single

A list key `jobs` holds exactly one element. A worker runs `LPOP jobs`, then `EXISTS jobs` and `TYPE jobs`. What do the last two commands return?

- A) `EXISTS` returns 1 and `TYPE` returns `list`, because a key lives until it is deleted explicitly
- B) `EXISTS` returns 0 and `TYPE` returns `none`, because an aggregate key is deleted when its last element is removed
- C) `EXISTS` returns 0 and `TYPE` returns `list`, because the type is remembered after the key is gone
- D) Both commands fail with `-WRONGTYPE` because the list is empty

<details><summary>Answer</summary>

**B.** Lists, sets, sorted sets and hashes never exist empty: removing the last element deletes the key, so `EXISTS` returns 0 and `TYPE` reports `none`. Streams are the exception because an empty stream still carries consumer groups and a last ID.

- Why not A: there is no such thing as an empty list key; the key is removed together with its last element.
- Why not C: a missing key has no type, so `TYPE` answers `none`.
- Why not D: `-WRONGTYPE` is raised when a command meets a key holding another type; a missing key is not an error for these commands.
- Ref: [modules/02-core-data-types-encodings-and-complexity.md](../modules/02-core-data-types-encodings-and-complexity.md#1-the-type-system), https://redis.io/docs/latest/commands/lpop/

</details>

### Q-RCAD-002 · D1 Data Modeling with Redis data structures · difficulty 1 · single

Which sorted-set command runs in O(1) time?

- A) `ZRANK`
- B) `ZADD`
- C) `ZRANGE key 0 0`
- D) `ZSCORE`

<details><summary>Answer</summary>

**D.** A large sorted set keeps a dict from member to score next to the skiplist, so `ZSCORE` is a single hash lookup.

- Why not A: `ZRANK` is O(log N); it walks the skiplist and sums the spans along the search path.
- Why not B: `ZADD` must position the member in the skiplist: O(log N).
- Why not C: a range by index is O(log N + M), where M is the number of elements returned.
- Ref: [modules/02-core-data-types-encodings-and-complexity.md](../modules/02-core-data-types-encodings-and-complexity.md#2-complexity-what-a-command-really-costs), https://redis.io/docs/latest/commands/zscore/

</details>

### Q-RCAD-003 · D1 Data Modeling with Redis data structures · difficulty 2 · single

A server with default settings runs `SET a 12345`, `SET b 007` and `SET c <40 ASCII characters>`. What do `OBJECT ENCODING a`, `b` and `c` report?

- A) `a`: `int`, `b`: `embstr`, `c`: `embstr`
- B) `a`: `int`, `b`: `int`, `c`: `embstr`
- C) `a`: `embstr`, `b`: `embstr`, `c`: `raw`
- D) `a`: `int`, `b`: `embstr`, `c`: `raw`

<details><summary>Answer</summary>

**A.** `12345` is the canonical decimal form of a 64-bit integer, so it is stored as `int`. `007` is not canonical (leading zeros), so it is an ordinary string; at 3 bytes it is `embstr`. In standard Redis certification material and Redis 7, strings up to 44 bytes fit the `embstr` single allocation (16 + 3 + 44 + 1 = 64 bytes); in Redis 8 `kvobj` dictionary embedding ($k_{\text{len}} + v_{\text{len}} \le 41$), a 1-byte key embeds values up to 40 bytes.

- Why not B: `007` is not a canonical integer, so it is not `int`.
- Why not C: `12345` is canonical and is stored as `int`, and 44 bytes still fits `embstr`.
- Why not D: 40 bytes fits `embstr` on both Redis 7 (limit 44 bytes) and Redis 8 (1-byte key limit 40 bytes); it becomes `raw` only when exceeding the embedding threshold or after `APPEND`/`SETRANGE`.
- Ref: [modules/02-core-data-types-encodings-and-complexity.md](../modules/02-core-data-types-encodings-and-complexity.md#31-objects-and-sds-strings), https://redis.io/docs/latest/commands/object-encoding/

</details>

### Q-RCAD-004 · D1 Data Modeling with Redis data structures · difficulty 2 · multi

Select **TWO** correct statements about HyperLogLog in Redis.

- A) A key needs at most about 12 KB however many distinct elements were added, with a standard error of about 0.81 %
- B) `TYPE` on a HyperLogLog key returns `hyperloglog`
- C) `PFCOUNT` can modify the key it reads, because it caches its last result in the header
- D) `PFREM` removes a single element from a HyperLogLog
- E) The count is exact as long as fewer than 1 000 elements were added

<details><summary>Answer</summary>

**A, C.** A HyperLogLog is 16 384 six-bit registers (about 12 KB dense, with a smaller sparse form), with standard error 1.04 / sqrt(16 384) ≈ 0.81 %. `PFCOUNT` stores its cached result in the header, so the documentation calls it technically a write command.

- Why not B: the value is an ordinary string, so `TYPE` returns `string` (which is also why you can `GET`/`SET` it to move it between instances).
- Why not D: there is no command to remove an element; you cannot list or remove members.
- Why not E: the sparse form is only a space optimisation; the result is still an estimate with a probabilistic error.
- Ref: [modules/02-core-data-types-encodings-and-complexity.md](../modules/02-core-data-types-encodings-and-complexity.md#5-hyperloglog-and-geo-redis-specific-realisation), https://redis.io/docs/latest/develop/data-types/probabilistic/hyperloglogs/

</details>

### Q-RCAD-005 · D1 Data Modeling with Redis data structures · difficulty 3 · scenario

A team stores each user's feature flags in a hash. Most hashes have under 100 short fields and report `listpack`. A campaign pushed some hashes to 600 fields, and memory per key jumped several-fold. The campaign flags were then deleted with `HDEL`, leaving 40 fields per hash, yet memory did not come back. Which explanation and remedy are correct?

- A) Past `hash-max-listpack-entries` (512 by default) the hash converted to `hashtable`; conversion is one-way while the key lives, so shrinking never re-packs it. The compact encoding returns only when the key is reloaded from an RDB (restart, `DEBUG RELOAD`, a replica's full resync) or rebuilt through a path that re-encodes, such as `DUMP` plus `RESTORE` or reading the fields and writing them into a new key
- B) The hash converted to `hashtable` and Redis converts it back automatically on the next `serverCron` tick once it is under the threshold again
- C) The jump is caused by the `listpackex` encoding; running `HPERSIST` on all fields converts the hash back to `listpack`
- D) The jump is the incremental rehash of the main dict, which ends by itself and then returns the memory

<details><summary>Answer</summary>

**A.** Encoding conversions to the memory-hungry form are one-way while the key lives. The 513th field (default 512 entries, or a value over 64 bytes) converted the hash; `HDEL` does not re-pack it. Only a reload from RDB re-encodes (restart, `DEBUG RELOAD`, or the full resync of a replica), or writing the data into a new key. Checked on Redis 7.0.15: after `HDEL` down to 40 fields the hash still reports `hashtable`; `DUMP`/`RESTORE` into a new key and an `HGETALL`/`HSET` rebuild both give `listpack`, while `COPY` and `RENAME` keep `hashtable`, so those two are not remedies. The same data as a dict costs about 2.7× the memory of a listpack in the module's measurement (80 versus 216 bytes for two fields).

- Why not B: there is no automatic reverse conversion.
- Why not C: `listpackex` is the encoding for hashes with field TTLs and is unrelated to growth; `HPERSIST` does not shrink anything.
- Why not D: rehashing is the resize of the main dictionary, unrelated to one key's encoding.
- Ref: [modules/02-core-data-types-encodings-and-complexity.md](../modules/02-core-data-types-encodings-and-complexity.md#33-thresholds-and-the-one-way-rule), https://redis.io/docs/latest/operate/oss_and_stack/management/optimization/memory-optimization/

</details>

### Q-RCAD-006 · D1 Data Modeling with Redis data structures · difficulty 2 · single

`SETBIT visits 4000000000 1` is executed on a key that does not exist yet. What happens?

- A) Redis stores a single set bit in a sparse structure; the key uses a few bytes
- B) Redis allocates a string of about 500 MB at once, with all lower bits zero
- C) The command is rejected with an offset out of range error because bitmaps are limited to 2^31 bits
- D) Redis creates a `bitmap` type with 4 billion sparse entries

<details><summary>Answer</summary>

**B.** Bitmaps are ordinary strings, so a high offset allocates the whole string up to that byte: 4 × 10^9 bits is 500 MB, allocated immediately (a memory and latency event). A bitmap keyed by user ID costs `max_id / 8` bytes, so sparse large IDs waste memory.

- Why not A: strings are dense; there is no sparse representation.
- Why not C: the offset is within the 512 MB string limit, so it is accepted.
- Why not D: there is no `bitmap` type; the key's `TYPE` is `string`.
- Ref: [modules/02-core-data-types-encodings-and-complexity.md](../modules/02-core-data-types-encodings-and-complexity.md#4-strings-beyond-strings-counters-bitmaps-bitfields), https://redis.io/docs/latest/commands/setbit/

</details>

### Q-RCAD-007 · D1 Data Modeling with Redis data structures · difficulty 1 · single

A leaderboard receives `ZADD lb 100 bob 100 alice` and then `ZRANGE lb 0 -1`. In which order are the members returned?

- A) `bob`, `alice`, because insertion order breaks ties
- B) The order is undefined; Redis may return either
- C) The command fails because two members cannot share a score
- D) `alice`, `bob`, because ties on score are ordered by the member's bytes

<details><summary>Answer</summary>

**D.** A sorted set is totally ordered by (score, member bytes). With equal scores `alice` sorts before `bob`. If "first to reach the score wins", encode a time component into the score.

- Why not A: Redis does not record insertion order for ties.
- Why not B: the order is deterministic.
- Why not C: scores need not be unique; members must be.
- Ref: [modules/02-core-data-types-encodings-and-complexity.md](../modules/02-core-data-types-encodings-and-complexity.md#1-the-type-system), https://redis.io/docs/latest/commands/zadd/

</details>

### Q-RCAD-008 · D1 Data Modeling with Redis data structures · difficulty 3 · single

A game uses 64-bit IDs larger than 2^53 as sorted-set scores so that players sort by ID. Players with consecutive IDs sometimes swap order or appear tied. What is the cause and the fix?

- A) Scores are IEEE-754 doubles, exact only up to 2^53; keep all scores at 0 and order lexicographically with `ZRANGE … BYLEX` on zero-padded string members
- B) Scores are signed 32-bit integers; use `ZADD … GT` to keep the order
- C) `ZADD` rounds scores on replicas; call `WAIT` after each write
- D) Ties are ordered by insertion time; use `ZADD NX` to preserve insertion order

<details><summary>Answer</summary>

**A.** Scores are float64. Integers above 2^53 lose precision, so neighbouring IDs collapse to the same score and then order by member bytes. A lexicographic sorted set (all scores equal, `BYLEX` ranges) or zero-padded string members avoids the loss; store money in integer minor units for the same reason.

- Why not B: scores are 64-bit floats, not 32-bit integers, and `GT` only controls updates of an existing member.
- Why not C: the rounding happens in the double representation on the primary, not in replication, and `WAIT` is unrelated.
- Why not D: ties are ordered by member bytes, not by insertion time.
- Ref: [modules/02-core-data-types-encodings-and-complexity.md](../modules/02-core-data-types-encodings-and-complexity.md#8-production-failure-modes), https://redis.io/docs/latest/commands/zrange/

</details>

### Q-RCAD-009 · D1 Data Modeling with Redis data structures · difficulty 2 · single

On Redis 8, a document was stored with `JSON.SET doc $ '{"a":1,"b":[1,2]}'`. What does `JSON.GET doc $.a` return?

- A) `1`
- B) `{"a":1}`
- C) `[1]`
- D) `(nil)`

<details><summary>Answer</summary>

**C.** A path that starts with `$` is a JSONPath that may match several nodes, so the command returns an array of matches, here `[1]`.

- Why not A: a bare value is what the legacy dot-path syntax (`.a`) returns.
- Why not B: only the matched subtree is returned, not the whole document.
- Why not D: the path matches, so there is a result.
- Ref: [modules/08-query-engine-json-vectors-and-probabilistic.md](../modules/08-query-engine-json-vectors-and-probabilistic.md#2-json), https://redis.io/docs/latest/commands/json.get/

</details>

### Q-RCAD-010 · D1 Data Modeling with Redis data structures · difficulty 3 · single

A raffle picks the winner with `SRANDMEMBER entrants` on a set of 5 million members stored as a `hashtable`. A reviewer says the draw is not fair. Which statement is correct?

- A) The draw is fair: `SRANDMEMBER` is uniform for every encoding
- B) On a `hashtable` set Redis picks a random non-empty bucket and then a random element of its chain, so the distribution is not perfectly uniform; for fairness-critical sampling shuffle client-side or use a sorted set with random scores
- C) The draw is biased only when `SRANDMEMBER` is called with a negative count
- D) The draw is biased because `SRANDMEMBER` always prefers the lexicographically smallest members

<details><summary>Answer</summary>

**B.** The bucket-then-chain selection favours members in short chains, so the distribution is only approximately uniform when chain lengths differ. That is fine for sampling for display, not for a lottery.

- Why not A: that assumption is exactly what the documentation of this behaviour warns against.
- Why not C: a negative count only allows repeats; it does not create the bias.
- Why not D: selection is random, not ordered by member bytes.
- Ref: [modules/02-core-data-types-encodings-and-complexity.md](../modules/02-core-data-types-encodings-and-complexity.md#62-lists-and-sets-the-operations-people-misuse), https://redis.io/docs/latest/commands/srandmember/

</details>

### Q-RCAD-011 · D1 Data Modeling with Redis data structures · difficulty 2 · hands-on

**Task.** Against a Redis 7.2+ server with default `hash-max-listpack-*` settings:

1. Create a hash `h` with 513 fields, each with a short value (`HSET h f1 v … f513 v`).
2. Run `OBJECT ENCODING h`.
3. Delete 500 of the fields with `HDEL`, leaving 13.
4. Run `OBJECT ENCODING h` again.

What are the two observed results?

- A) `listpack`, then `listpack`
- B) `hashtable`, then `listpack`
- C) `hashtable`, then `hashtable`
- D) `listpack`, then `hashtable`

<details><summary>Answer</summary>

**C.** The 513th field exceeds `hash-max-listpack-entries` (512), so the hash converts to `hashtable`. Deleting fields afterwards does not convert it back: the conversion is one-way while the key lives.

- Why not A: 513 fields is over the threshold, and shrinking does not restore `listpack`.
- Why not B: there is no automatic reverse conversion after `HDEL`.
- Why not D: the encoding cannot go from the compact form to the dict form because of deletions.
- Verification: [examples/ts/integration/02-encodings.test.ts](../examples/ts/integration/02-encodings.test.ts) › `hash: listpack -> hashtable at 513 fields, and no conversion back after HDEL` (`npm run test:integration` in `technologies/redis`); the hermetic model is in [examples/ts/02-data-types-and-encodings.test.ts](../examples/ts/02-data-types-and-encodings.test.ts).
- Ref: [modules/02-core-data-types-encodings-and-complexity.md](../modules/02-core-data-types-encodings-and-complexity.md#33-thresholds-and-the-one-way-rule), https://redis.io/docs/latest/commands/object-encoding/

</details>

---

## Domain 2: Data modeling and patterns

### Q-RCAD-012 · D1 Data Modeling with Redis data structures · difficulty 1 · single

A game needs "top 10 players" and "my rank" with constant updates. Which design fits best?

- A) A hash from player to score; fetch it with `HGETALL` and sort in the client
- B) A list kept sorted with `LINSERT`
- C) A sorted set: update with `ZADD`/`ZINCRBY`, top 10 with `ZRANGE lb 0 9 REV WITHSCORES`, rank with `ZREVRANK`
- D) A set of `player:score` strings read with `SMEMBERS`

<details><summary>Answer</summary>

**C.** A sorted set gives O(log N) updates and rank queries, and the top-k is O(log N + k). Ties order by member bytes, and scores are doubles.

- Why not A: `HGETALL` is O(N) on every read and the sort moves to the client.
- Why not B: `LINSERT` is O(N) and a list has no rank query.
- Why not D: `SMEMBERS` is O(N) and a set is unordered.
- Ref: [modules/07-coordination-rate-limits-locks-and-idempotency.md](../modules/07-coordination-rate-limits-locks-and-idempotency.md#3-leaderboards), https://redis.io/docs/latest/commands/zrevrank/

</details>

### Q-RCAD-013 · D1 Data Modeling with Redis data structures · difficulty 2 · single

A scheduler must run millions of jobs at their due time. Which Redis design is the most appropriate?

- A) A key per job with a TTL, listening to `expired` keyspace events to start the job
- B) A sorted set scored by due timestamp, polled with `ZRANGE … BYSCORE -inf now LIMIT 0 100` and claimed atomically (for example `ZPOPMIN` with a check, or a script)
- C) A stream trimmed with `MAXLEN`, where consumers sleep until each entry is due
- D) One list per minute, popped at the start of each minute

<details><summary>Answer</summary>

**B.** A sorted set by due time answers "what is due before now" in O(log N + M) and, with an atomic claim, avoids double processing.

- Why not A: the `expired` event fires when the key is _deleted_, which can be long after the TTL passed, and keyspace notifications are at-most-once; never build a precise scheduler on them.
- Why not C: a stream has no notion of a due time; consumers would have to hold or re-queue entries.
- Why not D: minute-granular lists give coarse timing and no cheap cancel or reschedule.
- Ref: [modules/02-core-data-types-encodings-and-complexity.md](../modules/02-core-data-types-encodings-and-complexity.md#7-modelling-guide), [modules/03-keys-expiry-eviction-and-memory.md](../modules/03-keys-expiry-eviction-and-memory.md#23-expiry-and-replication-persistence-notifications), https://redis.io/docs/latest/commands/zrange/

</details>

### Q-RCAD-014 · D1 Data Modeling with Redis data structures · difficulty 2 · scenario

A search service builds `"@city:{" + userInput + "}"` for `FT.SEARCH`. A user submits `x} | @role:{admin`. What is the risk and the mitigation?

- A) No risk: Redis rejects malformed queries
- B) The input closes the tag clause and adds another predicate, a search-engine equivalent of SQL injection; escape user-provided values and validate field names against an allow-list
- C) Only a performance risk; enable `search-workers`
- D) The risk disappears by passing `DIALECT 2`

<details><summary>Answer</summary>

**B.** Punctuation and whitespace are syntax in the query language. Unescaped input can add predicates (for example another tenant's tag) or cause errors. Escape every tag value (`new\-york`) and allow-list the fields a user may query.

- Why not A: the query is syntactically valid after the injection; it simply means something else.
- Why not C: workers move query execution off the main thread; they do not change what a query means.
- Why not D: the dialect selects syntax versions (needed for vector queries) and does not sanitise input.
- Ref: [modules/08-query-engine-json-vectors-and-probabilistic.md](../modules/08-query-engine-json-vectors-and-probabilistic.md#32-query-syntax-pitfalls-and-injection), https://redis.io/docs/latest/commands/ft.search/

</details>

### Q-RCAD-015 · D1 Data Modeling with Redis data structures · difficulty 3 · single

Size a Bloom filter for 50 million user IDs at a 0.1 % false-positive rate (`BF.RESERVE users 0.001 50000000`). Which estimate is right?

- A) About 60 MB with 7 hash functions
- B) About 12 KB, fixed regardless of the number of IDs
- C) About 90 MB with 10 hash functions
- D) About 900 MB, the same order as a set of the IDs

<details><summary>Answer</summary>

**C.** Bits per element = -ln(p) / (ln 2)^2 = 14.4 for p = 0.001, so 50 M × 14.4 / 8 ≈ 90 MB, with k = ceil(-log2 p) = 10 hash functions. A set of the same IDs costs hundreds of megabytes to gigabytes. Reserve the real cardinality up front, because filters grow by chaining sub-filters (`NONSCALING` makes `BF.ADD` fail when full instead).

- Why not A: 9.59 bits and 7 hash functions are the figures for a 1 % rate.
- Why not B: 12 KB is the HyperLogLog bound; a Bloom filter grows with the number of elements.
- Why not D: that is ten times too large; the filter is much smaller than the exact set.
- Ref: [modules/08-query-engine-json-vectors-and-probabilistic.md](../modules/08-query-engine-json-vectors-and-probabilistic.md#6-probabilistic-structures-redis-realisation), https://redis.io/docs/latest/commands/bf.reserve/

</details>

### Q-RCAD-016 · D1 Data Modeling with Redis data structures · difficulty 2 · scenario

Two features are planned. (1) "Similar items" among 2 million catalog items, with an attribute filter such as `year > 2020` and no schema to manage. (2) A document search that combines text, tag and numeric filters with vector ranking in one query. Which pairing fits Redis 8?

- A) Both with Vector Sets
- B) (1) with the Query Engine, (2) with a Vector Set
- C) (1) with a Vector Set (`VADD`/`VSIM … FILTER`), (2) with a Query Engine index that has a `VECTOR` field
- D) Both with `KEYS` patterns and client-side filtering

<details><summary>Answer</summary>

**C.** A Vector Set is a data type with one key per collection, an HNSW index inside it and optional JSON attributes; it suits "nearest items among N". A Query Engine vector field lives in hash/JSON documents and combines with text, tag and numeric predicates (and hybrid scoring) in one query.

- Why not A: Vector Sets cannot combine full-text and numeric predicates in the Query Engine sense.
- Why not B: reversed; the Query Engine needs a schema and index, and a Vector Set has no text search.
- Why not D: `KEYS` is O(N) and cannot rank by similarity.
- Ref: [modules/08-query-engine-json-vectors-and-probabilistic.md](../modules/08-query-engine-json-vectors-and-probabilistic.md#4-vector-sets-80), https://redis.io/docs/latest/commands/vadd/

</details>

---

## Domain 3: Performance

### Q-RCAD-017 · D1 Data Modeling with Redis data structures · difficulty 1 · single

Which statement about Redis threading is precisely correct?

- A) Everything, including network I/O, runs on one thread
- B) Commands run in parallel on all cores once `io-threads` is above 1
- C) Redis starts one thread per client connection
- D) Command execution is serial on the main thread; I/O threads can read and parse requests and write replies, background threads free memory and fsync, and a forked child writes snapshots

<details><summary>Answer</summary>

**D.** "Single-threaded" means command execution. I/O threads (`io-threads`, default 1 = disabled) handle socket work; `bio` threads handle lazy freeing, `close()` and AOF `fsync`; RDB snapshots and AOF rewrites use a forked child. Because execution is serial, one slow command delays every client.

- Why not A: Redis has been multi-threaded for I/O since 6.0, and 8.0 replaced that implementation.
- Why not B: I/O threads do not parallelise execution of commands on the data.
- Why not C: Redis multiplexes sockets with `epoll`/`kqueue` on an event loop.
- Ref: [modules/01-model-architecture-and-protocol.md](../modules/01-model-architecture-and-protocol.md#22-what-is-not-on-the-main-thread), https://redis.io/docs/latest/develop/get-started/faq/

</details>

### Q-RCAD-018 · D1 Data Modeling with Redis data structures · difficulty 2 · multi

Select **TWO** correct statements about `SCAN`.

- A) A key present for the whole iteration is returned at least once
- B) A key is never returned more than once
- C) `COUNT` fixes exactly how many keys each call returns
- D) The same key may be returned more than once, so clients deduplicate if they need to
- E) An empty reply means the iteration is complete

<details><summary>Answer</summary>

**A, D.** The documented guarantees: elements present throughout are returned at least once, elements may repeat, elements added or removed during the iteration may or may not appear. The iteration ends only when the returned cursor is 0.

- Why not B: duplicates are possible, for example after the table shrinks.
- Why not C: `COUNT` is a hint about work per call.
- Why not E: `MATCH` filters after fetching, so a call can return no keys with a non-zero cursor; keep going until the cursor is 0.
- Ref: [modules/03-keys-expiry-eviction-and-memory.md](../modules/03-keys-expiry-eviction-and-memory.md#51-guarantees-from-the-scan-documentation), https://redis.io/docs/latest/commands/scan/

</details>

### Q-RCAD-019 · D1 Data Modeling with Redis data structures · difficulty 2 · scenario

You must remove a sorted set with 30 million members from a production instance without a latency spike. What do you do?

- A) `DEL` it during off-peak hours
- B) `FLUSHDB ASYNC`
- C) `SCAN … MATCH` the key and `DEL` it from the result
- D) `UNLINK` it (or enable `lazyfree-lazy-user-del yes` so `DEL` behaves like `UNLINK`)

<details><summary>Answer</summary>

**D.** `UNLINK` removes the key from the keyspace in O(1) on the main thread and frees the value in a `bio` background thread.

- Why not A: `DEL` frees every element synchronously, O(N), which blocks all clients even off-peak.
- Why not B: that deletes every key in the database.
- Why not C: `SCAN` only finds keys; the delete is still a synchronous `DEL`.
- Ref: [modules/03-keys-expiry-eviction-and-memory.md](../modules/03-keys-expiry-eviction-and-memory.md#6-deleting-big-keys-del-vs-unlink-and-lazy-free), https://redis.io/docs/latest/commands/unlink/

</details>

### Q-RCAD-020 · D1 Data Modeling with Redis data structures · difficulty 3 · multi

Select **TWO** correct statements about Lua scripts run with `EVAL`.

- A) `redis.call('GET', KEYS[1]) == nil` is true when the key does not exist
- B) A script that returns the Lua number 3.99 produces the Redis integer 3; return `tostring(x)` to keep decimals
- C) `redis.call('GET', k)` on a missing key returns the Lua value `false`
- D) A script that returns the table `{1, 2, nil, 4}` produces an array of four elements with a null in third place
- E) If a script raises an error after writing, Redis rolls its writes back

<details><summary>Answer</summary>

**B, C.** A nil bulk reply becomes `false` in Lua, and numbers convert to integers by truncation.

- Why not A: because a missing key yields `false`, the comparison with `nil` is never true.
- Why not D: the conversion of a Lua table stops at the first `nil`, so the reply is `[1, 2]`.
- Why not E: scripts have no rollback; structure scripts as validate everything, then write.
- Ref: [modules/05-transactions-scripting-and-functions.md](../modules/05-transactions-scripting-and-functions.md#32-type-conversion), https://redis.io/docs/latest/develop/programmability/eval-intro/

</details>

### Q-RCAD-021 · D1 Data Modeling with Redis data structures · difficulty 2 · scenario

A service calls only `EVALSHA`. After a failover to a replica, every script call fails with `-NOSCRIPT` until the service is restarted. What is the right fix?

- A) Set `busy-reply-threshold` to 0
- B) Call `SCRIPT FLUSH` at start-up
- C) Replace the scripts with `MULTI/EXEC`
- D) Catch `-NOSCRIPT` and fall back to `EVAL` (or `SCRIPT LOAD` and retry); alternatively deploy the logic as a Function, which is stored in RDB/AOF and replicated

<details><summary>Answer</summary>

**D.** The script cache is volatile: it is emptied on restart and by `SCRIPT FLUSH`, and a promoted replica or a new node may not have it. Most client libraries (`defineScript` in node-redis, `defineCommand` in ioredis) implement the fallback. Functions (7.0+) are loaded once with `FUNCTION LOAD`, persisted and replicated (in Cluster they must be loaded on every primary).

- Why not A: that setting controls when other clients start receiving `-BUSY` during a long script.
- Why not B: flushing empties the cache, which is the problem.
- Why not C: `MULTI/EXEC` cannot read a value and decide within the transaction.
- Ref: [modules/05-transactions-scripting-and-functions.md](../modules/05-transactions-scripting-and-functions.md#33-evalsha-and-the-script-cache), https://redis.io/docs/latest/develop/programmability/eval-intro/

</details>

### Q-RCAD-022 · D1 Data Modeling with Redis data structures · difficulty 3 · scenario

A Lua script has been looping for 30 seconds. Every other client receives `-BUSY`. An operator runs `SCRIPT KILL` and gets `-UNKILLABLE`. What does this mean and what are the options?

- A) Retry `SCRIPT KILL`; it always succeeds on the second attempt
- B) The script has already performed a write, and killing it would leave a half-applied operation, so Redis refuses; wait for it to finish, or `SHUTDOWN NOSAVE` and lose data since the last persistence point, then fail over. Prevent it by bounding the work scripts do
- C) Raise `busy-reply-threshold` so the script is allowed to finish
- D) Run `FLUSHALL` to remove the data the script is iterating over

<details><summary>Answer</summary>

**B.** After `busy-reply-threshold` (default 5000 ms; named `lua-time-limit` before 7.0) the server only starts answering other clients with `-BUSY`; it does not stop the script. `SCRIPT KILL` (`FUNCTION KILL` for functions) works only before the first write, to preserve atomicity. A long script can even make Sentinel see a busy primary as down and trigger a failover.

- Why not A: the answer depends on whether a write happened, not on the number of attempts.
- Why not C: the threshold only decides when `BUSY` replies start; it never kills anything.
- Why not D: while a script runs only `SCRIPT KILL` and `SHUTDOWN NOSAVE` are accepted; `FLUSHALL` is refused with `-BUSY`.
- Ref: [modules/05-transactions-scripting-and-functions.md](../modules/05-transactions-scripting-and-functions.md#5-blocking-risk-busy-scripts-and-script-kill), https://redis.io/docs/latest/commands/script-kill/

</details>

### Q-RCAD-023 · D1 Data Modeling with Redis data structures · difficulty 2 · single

Many application instances must decrement a stock counter only while it is positive, and must never expose a negative value. What is the best approach?

- A) A Lua script or Function that reads the value and `DECR`s only if it is positive; `WATCH` + `MULTI/EXEC` with a retry loop is the alternative at low contention
- B) `GET` the value in the client, then `DECR` if it is positive
- C) `DECR` first, then `INCR` it back if the result is negative
- D) `MULTI`, `DECR stock`, `GET stock`, `EXEC`, and check the result afterwards

<details><summary>Answer</summary>

**A.** Read-decide-write needs either server-side logic (atomic, no retries) or optimistic concurrency with `WATCH`. A script avoids retries under contention.

- Why not B: another client can change the value between `GET` and `DECR` (a lost-update race).
- Why not C: other clients can observe the negative value in between.
- Why not D: inside a transaction commands only queue; you cannot branch on a value read in the same transaction, and the decrement has already been applied.
- Ref: [modules/05-transactions-scripting-and-functions.md](../modules/05-transactions-scripting-and-functions.md#6-choosing-the-tool), https://redis.io/docs/latest/develop/programmability/eval-intro/

</details>

---

## Domain 7: Messaging

### Q-RCAD-024 · D1 Data Modeling with Redis data structures · difficulty 1 · scenario

Order-confirmation emails are dispatched with `PUBLISH emails <json>` to worker subscribers. During deploys some emails are never sent. Why, and what is the fix?

- A) Raise `client-output-buffer-limit pubsub`
- B) Switch the workers to `PSUBSCRIBE`
- C) Pub/Sub is at-most-once and stores nothing, so messages published while no worker is subscribed are lost; use a Stream with a consumer group (`XADD`, `XREADGROUP`, `XACK`) or a reliable list queue
- D) Turn on AOF so published messages are persisted

<details><summary>Answer</summary>

**C.** `PUBLISH` delivers only to subscribers connected at that moment and returns how many received it (0 means it went nowhere). Anything that must not be lost (orders, emails, payments, job dispatch) belongs in a structure that stores entries and tracks acknowledgements.

- Why not A: the output-buffer limit disconnects slow subscribers; it does not store messages.
- Why not B: patterns change which channels match, not delivery guarantees.
- Why not D: Pub/Sub messages are never written to the dataset, so persistence settings cannot help.
- Ref: [modules/06-messaging-pubsub-streams-and-queues.md](../modules/06-messaging-pubsub-streams-and-queues.md#11-semantics), https://redis.io/docs/latest/develop/pubsub/

</details>

### Q-RCAD-025 · D1 Data Modeling with Redis data structures · difficulty 2 · single

A stream consumer `c1` in group `g` crashed after reading entries but before acknowledging them, and restarts under the same name. Which command returns the entries still pending for it?

- A) `XREADGROUP GROUP g c1 STREAMS s >`
- B) `XREAD STREAMS s 0`
- C) `XGROUP SETID s g 0`
- D) `XREADGROUP GROUP g c1 STREAMS s 0`

<details><summary>Answer</summary>

**D.** In `XREADGROUP`, the special ID `>` asks for entries never delivered to the group; any other ID (such as `0`) returns the history of _this consumer's_ pending entries. A restarted consumer should process those first, then switch to `>`. Delivery is at-least-once, so processing must be idempotent.

- Why not A: `>` returns only new entries; the pending ones are not repeated.
- Why not B: `XREAD` bypasses groups and does not touch the pending entries list.
- Why not C: it moves the group's last-delivered ID, which affects what is delivered next to the whole group, and it does not list a consumer's pending entries.
- Ref: [modules/06-messaging-pubsub-streams-and-queues.md](../modules/06-messaging-pubsub-streams-and-queues.md#22-consumer-groups-and-the-pel), https://redis.io/docs/latest/commands/xreadgroup/

</details>

### Q-RCAD-026 · D1 Data Modeling with Redis data structures · difficulty 2 · single

A stream has accumulated a million acknowledged entries and uses a lot of memory. Which statement is correct?

- A) `XACK` removes entries from the pending list only; the stream keeps them, so trim with `XADD … MAXLEN ~ N` or `MINID`, or `XTRIM`; `~` removes whole nodes and may leave slightly more than N, `=` is exact
- B) `XACK` deletes the entry from the stream as well
- C) A stream trims itself once every group has acknowledged an entry
- D) `~` and `=` give identical results; `~` is only a different spelling

<details><summary>Answer</summary>

**A.** Streams never shrink on their own; without trimming a stream is a memory leak with a deadline. The integration test shows `MAXLEN ~ 100` leaving somewhat more than 100 entries and `XTRIM … MAXLEN = 100` leaving exactly 100. Redis 8.2 added `XACKDEL` and `XDELEX` for deleting while respecting group references.

- Why not B: acknowledging only clears the pending entry.
- Why not C: there is no automatic trimming.
- Why not D: approximate trimming is cheaper because it removes whole radix-tree nodes only.
- Ref: [modules/06-messaging-pubsub-streams-and-queues.md](../modules/06-messaging-pubsub-streams-and-queues.md#24-trimming-and-memory), https://redis.io/docs/latest/commands/xtrim/

</details>

### Q-RCAD-027 · D1 Data Modeling with Redis data structures · difficulty 2 · hands-on

**Task.**

1. `XGROUP CREATE s g $ MKSTREAM`, then `XADD s * f v`.
2. `XREADGROUP GROUP g c1 COUNT 1 STREAMS s >` (do not acknowledge).
3. Wait at least 200 ms.
4. `XAUTOCLAIM s g c2 100 0-0 COUNT 10`.
5. `XPENDING s g - + 10`.

What does `XPENDING` show for the entry?

- A) Owner `c1`, delivery count 1
- B) Owner `c2`, delivery count 2
- C) Owner `c2`, delivery count 1
- D) The entry is gone from the pending list because it was delivered

<details><summary>Answer</summary>

**B.** `XAUTOCLAIM` (6.2+) transfers entries idle for at least `min-idle-time` to the caller and increments their delivery counter. That counter is the poison-message detector: after too many deliveries, move the entry to a dead-letter stream and `XACK` it.

- Why not A: the entry was idle for longer than 100 ms, so it was claimed by `c2`.
- Why not C: claiming increments the delivery count (1 on the first delivery, 2 after the claim).
- Why not D: an entry leaves the pending list only with `XACK`, `XACKDEL` or when its stream entry is trimmed away.
- Verification: [examples/ts/integration/06-messaging.test.ts](../examples/ts/integration/06-messaging.test.ts) › `XAUTOCLAIM transfers a dead consumer's entries and bumps the delivery count`; hermetic model: [examples/ts/06-messaging.test.ts](../examples/ts/06-messaging.test.ts).
- Ref: [modules/06-messaging-pubsub-streams-and-queues.md](../modules/06-messaging-pubsub-streams-and-queues.md#23-recovering-stuck-entries-xclaim-and-xautoclaim), https://redis.io/docs/latest/commands/xautoclaim/

</details>

### Q-RCAD-028 · D1 Data Modeling with Redis data structures · difficulty 2 · single

A 12-node Redis Cluster uses `PUBLISH` for chat messages, and total Pub/Sub throughput does not grow when nodes are added. Which change addresses this?

- A) Add replicas that subscribers read from
- B) Switch subscribers to `PSUBSCRIBE` with patterns
- C) Use sharded Pub/Sub (`SPUBLISH`/`SSUBSCRIBE`, 7.0+): the channel is hashed to a slot and messages stay within that shard
- D) Lower `cluster-node-timeout`

<details><summary>Answer</summary>

**C.** Classic `PUBLISH` in a Cluster is broadcast to every node over the cluster bus, so it does not scale with cluster size. Sharded Pub/Sub keeps traffic within the shard that owns the channel's slot. After resharding, subscribers get an `sunsubscribe` and must resubscribe.

- Why not A: broadcasting to all nodes is the cost; replicas do not remove it.
- Why not B: patterns change matching, not routing.
- Why not D: the node timeout is for failure detection.
- Ref: [modules/06-messaging-pubsub-streams-and-queues.md](../modules/06-messaging-pubsub-streams-and-queues.md#12-pubsub-in-cluster-sharded-pubsub-70), https://redis.io/docs/latest/commands/spublish/

</details>

### Q-RCAD-029 · D1 Data Modeling with Redis data structures · difficulty 3 · scenario

Producers append with `XADD events MAXLEN ~ 100000 …`. A reporting service reads through consumer group `reports`. After a two-hour outage the group resumes, and some events are missing, with no error reported anywhere. What happened and what should be done?

- A) `XAUTOCLAIM` has a bug that drops entries; replace it with `XCLAIM`
- B) `XACK` deleted the unprocessed entries; stop acknowledging
- C) The group was created with `$`; recreate it with `0`
- D) Trimming removes entries whether or not groups have consumed them; the lagging group's pending entries pointed at trimmed (deleted) entries. Size `MAXLEN` for the worst-case lag and alert on the group's `lag` in `XINFO GROUPS`

<details><summary>Answer</summary>

**D.** `MAXLEN`/`MINID` trimming ignores consumer groups. A group that falls behind the trim point silently loses entries (`XAUTOCLAIM` reports their IDs as deleted and, since 7.0, removes them from the pending list).

- Why not A: `XAUTOCLAIM` only _reports_ the entries the trim already removed.
- Why not B: acknowledging removes pending-list entries only; it does not touch the stream.
- Why not C: `$` affects where a new group starts reading; the entries were trimmed after being appended.
- Ref: [modules/06-messaging-pubsub-streams-and-queues.md](../modules/06-messaging-pubsub-streams-and-queues.md#24-trimming-and-memory), https://redis.io/docs/latest/commands/xinfo-groups/

</details>

### Q-RCAD-030 · D1 Data Modeling with Redis data structures · difficulty 3 · ordering

A worker `w` uses a list-based reliable queue. Put the events of a crash and recovery in order.

- A) Another worker's `BLMOVE` delivers the job again
- B) The reaper sees that the heartbeat of `w` is gone and moves the job back with `LMOVE processing:w queue RIGHT LEFT`
- C) Worker `w` crashes before it acknowledges the job with `LREM`
- D) The heartbeat key `worker:w`, refreshed with `SET worker:w alive EX 30`, expires
- E) Worker `w` runs `BLMOVE queue processing:w RIGHT LEFT 0`, so the job now exists only in `processing:w`

<details><summary>Answer</summary>

**E, C, D, B, A.** `BLMOVE` is atomic, so a job is never in neither list; the crash leaves it in the processing list; the missing heartbeat identifies the dead worker; the reaper requeues the job; another worker processes it. This is at-least-once delivery, so jobs must be idempotent. A plain `BRPOP` would have lost the job when the worker crashed.

- Why not another order: the reaper can only act after the heartbeat has expired, and the job can be delivered again only after it is back in `queue`.
- Verification (related): [examples/ts/integration/06-messaging.test.ts](../examples/ts/integration/06-messaging.test.ts) › `BLMOVE reliable queue: the job survives in the processing list until acknowledged`.
- Ref: [modules/06-messaging-pubsub-streams-and-queues.md](../modules/06-messaging-pubsub-streams-and-queues.md#3-lists-as-queues-and-the-reliable-queue-pattern), https://redis.io/docs/latest/commands/blmove/

</details>

---

## Domain 2: Caching strategies and expiration

### Q-RCAD-031 · D2 Caching strategies and expiration · difficulty 1 · single

A session was written with `SET session:9 abc EX 100`. Ten seconds later the application runs `SET session:9 def` and then `TTL session:9`. What does `TTL` return?

- A) 100
- B) 90
- C) -1
- D) -2

<details><summary>Answer</summary>

**C.** A plain `SET` creates a new value object and clears the TTL, so the key is now persistent and `TTL` returns -1. Only `SET … KEEPTTL` (6.0+) or in-place modifications such as `INCR`, `APPEND`, `HSET` keep the old TTL.

- Why not A: a plain `SET` does not restart the old TTL; only `SET … EX 100` would set a new one.
- Why not B: that would be the result if the TTL had been kept (as `INCR` or `KEEPTTL` would do).
- Why not D: -2 means the key does not exist; the key exists and has no expiry.
- Ref: [modules/03-keys-expiry-eviction-and-memory.md](../modules/03-keys-expiry-eviction-and-memory.md#12-which-commands-touch-the-ttl), https://redis.io/docs/latest/commands/set/

</details>

### Q-RCAD-032 · D2 Caching strategies and expiration · difficulty 2 · single

A key `promo` has about 50 seconds of TTL left. The application runs `EXPIRE promo 30 GT` (Redis 7.0+). What happens?

- A) The TTL becomes 30 seconds and the reply is 1
- B) The reply is 0 and the TTL stays at about 50 seconds, because `GT` applies the new TTL only if it is greater than the current one
- C) The key is deleted because 30 is smaller than the remaining 50
- D) The command fails with a syntax error because `GT` must be combined with `XX`

<details><summary>Answer</summary>

**B.** `GT` sets the expiry only when the new TTL is greater than the current one (and `LT` only when it is smaller), which is how you implement "extend but never shorten" atomically. Here 30 is not greater than 50, so nothing changes and the reply is 0.

- Why not A: that is what `LT` would do; `GT` refuses to shorten the TTL.
- Why not C: only `EXPIRE k 0` or a time in the past deletes a key immediately.
- Why not D: `GT` is a valid flag on its own; `NX`, `XX`, `GT` and `LT` were all added in 7.0.
- Ref: [modules/03-keys-expiry-eviction-and-memory.md](../modules/03-keys-expiry-eviction-and-memory.md#12-which-commands-touch-the-ttl), https://redis.io/docs/latest/commands/expire/

</details>

### Q-RCAD-033 · D2 Caching strategies and expiration · difficulty 2 · single

On Redis 7.4+ an application runs `HPEXPIRE user:42 1800000 FIELDS 1 cart`, and later `HSET user:42 cart "[]"`. Which statement is correct?

- A) `HPEXPIRE` returns one integer for the whole command, 1 if the key now expires
- B) The key `user:42` itself now expires after 30 minutes
- C) The `HSET` on the `cart` field clears that field's TTL, so the field now persists
- D) The field TTL survives `HSET`, because `HSET` changes only the value

<details><summary>Answer</summary>

**C.** Hash field expiration is per field: writing a field with `HSET` clears that field's TTL. Field TTLs are independent of the key's own TTL.

- Why not A: the reply is an array with one status code per field (-2 no such field, 0 condition not met, 1 TTL set, 2 field deleted because the time was in the past).
- Why not B: field TTLs do not make the key expire; the key's TTL is separate.
- Why not D: that is the common assumption, but `HSET` on a field removes its TTL.
- Ref: [modules/02-core-data-types-encodings-and-complexity.md](../modules/02-core-data-types-encodings-and-complexity.md#6-hashes-with-per-field-ttl), https://redis.io/docs/latest/commands/hexpire/

</details>

### Q-RCAD-034 · D2 Caching strategies and expiration · difficulty 2 · single

A product price lives in a SQL database and is cached with cache-aside. When the price changes, which write path minimises stale cache entries, and what bounds the worst case?

- A) Delete the cache key first, then update the database; the TTL is unnecessary
- B) Update the cache and the database in parallel without ordering; the TTL is unnecessary
- C) Update the database and never touch the cache; rely on the TTL only
- D) Commit the database update first, then delete the cache key; the race is narrowed but not removed, and only the TTL bounds the worst case

<details><summary>Answer</summary>

**D.** Deleting after the commit leaves only a narrow race (a slow reader that loaded the old row before the update and writes it after the delete). A TTL on every entry bounds the damage; delayed double delete, versioned writes or change-data-capture shrink it further.

- Why not A: a reader can miss between the delete and the update, load the old row and re-cache it for a full TTL; this is the likelier race.
- Why not B: with no ordering, either interleaving can leave the old value cached, and there is no transaction across the database and Redis.
- Why not C: this is legal but gives the maximum staleness (the whole TTL) every time; invalidation shortens the typical case.
- Ref: [modules/04-caching-patterns.md](../modules/04-caching-patterns.md#4-consistency-with-the-database-the-dual-write-problem-in-redis-terms), https://redis.io/docs/latest/commands/del/

</details>

### Q-RCAD-035 · D2 Caching strategies and expiration · difficulty 2 · scenario

Bots request `GET /user/:id` with random IDs that do not exist. Every request misses the cache and hits the database. Which change addresses this cache penetration?

- A) Cache the "not found" result with a short TTL (negative caching), optionally with a Bloom filter of existing IDs in front
- B) Raise the TTL of the cached positive entries
- C) Switch `maxmemory-policy` to `allkeys-lfu`
- D) Check for existence with `KEYS user:*` before querying the database

<details><summary>Answer</summary>

**A.** A short-lived negative entry turns repeated misses into hits, and a Bloom filter (`BF.EXISTS`, built into Redis 8) rejects definite misses without touching the database. The module's test shows 50 lookups of a missing user cause 1 database query with negative caching and 50 without.

- Why not B: positive entries are not the problem; the missing IDs never get an entry.
- Why not C: the eviction policy decides what is dropped when memory is full; it does not create entries for absent data.
- Why not D: `KEYS` is O(N) on the whole database and blocks every client; it would not know about rows in the database anyway.
- Ref: [modules/04-caching-patterns.md](../modules/04-caching-patterns.md#2-cache-aside-done-properly), https://redis.io/docs/latest/commands/bf.exists/

</details>

### Q-RCAD-036 · D2 Caching strategies and expiration · difficulty 2 · multi

A hot cache key expires and 200 application pods miss at once. Select **TWO** measures that reduce database load across processes, not just inside each pod.

- A) In-process request coalescing (single flight) in each pod
- B) A lock `SET lock:key <token> NX PX <ttl>` so one process recomputes while the others wait briefly and re-read
- C) Probabilistic early recomputation (XFetch), so a refresh usually happens before the key expires
- D) Lowering `maxmemory-samples`
- E) Moving the key to another numbered database

<details><summary>Answer</summary>

**B, C.** The `NX PX` lock coordinates processes; early recomputation avoids the synchronized miss in the first place (the trigger probability rises as expiry approaches, scaled by recompute time).

- Why not A: single flight only merges concurrent loads inside one process, so 200 pods can still cause up to 200 loads. It is worth having, but it does not solve the cross-process case.
- Why not D: that tunes eviction sampling and has nothing to do with expiry.
- Why not E: numbered databases share the process, memory and command thread; expiry and misses behave the same.
- Ref: [modules/04-caching-patterns.md](../modules/04-caching-patterns.md#3-stampede-protection-in-redis), https://redis.io/docs/latest/commands/set/

</details>

### Q-RCAD-037 · D2 Caching strategies and expiration · difficulty 2 · scenario

An API allows 10 requests per minute using `INCR rl:{u}:<minute>` with an expiry (a fixed window). A client sends 10 requests at 12:00:59.9 and 10 more at 12:01:00.1. What happens, and what tightens the limit?

- A) All 20 are admitted, because the two bursts fall into different windows; a sliding log (exact), a sliding-window counter or a token bucket limits this boundary burst
- B) The second burst is rejected, because the counter key from the first minute is still present
- C) 15 are admitted, because Redis smooths the counters across the boundary
- D) All 20 are rejected, because `EXPIRE` resets the counter on every `INCR`

<details><summary>Answer</summary>

**A.** A fixed window admits up to 2L around a boundary (the module's test admits 20 requests within 200 ms for a "10 per minute" limit). A sliding log is exact but costs O(L) members per identity; a sliding-window counter weights the previous window; a token bucket allows a burst of B and a sustained rate r.

- Why not B: each minute has its own key, so the second burst starts from zero.
- Why not C: Redis does no smoothing; that behaviour comes only from a sliding-window algorithm you implement.
- Why not D: a limiter built with `EXPIRE … NX` (or `INCREX … ENX`) sets the expiry once; it does not reset the count on each request.
- Ref: [modules/07-coordination-rate-limits-locks-and-idempotency.md](../modules/07-coordination-rate-limits-locks-and-idempotency.md#12-redis-implementations-and-their-costs), https://redis.io/docs/latest/commands/incr/

</details>

### Q-RCAD-038 · D2 Caching strategies and expiration · difficulty 3 · scenario

A payments API must not charge twice when clients retry with an `Idempotency-Key` header. Which design is correct?

- A) Store `idem:K` with `SET … NX EX 86400` after the charge succeeds; Redis is the only record
- B) `GET idem:K`; if absent, charge and then `SET idem:K` without `NX`
- C) Hold a lock for the request timeout and re-execute every retry
- D) Claim the key first with `SET idem:K "processing|<fingerprint>" NX EX 86400`, replay the stored response for duplicates, reject a reused key with a different request fingerprint, and also enforce a unique constraint on the key in the same database transaction as the charge

<details><summary>Answer</summary>

**D.** Claim before executing so concurrent duplicates see "in progress"; fingerprint the body so a reused key with a different request is rejected; release the claim on a known failure. The side effect and the Redis key are not atomic, and Redis can lose the key on failover (asynchronous replication), so for money the database must hold the uniqueness guarantee and Redis is the fast path.

- Why not A: recording after the charge leaves a window in which a retry also charges, and Redis alone cannot survive a failover or a crash after the charge.
- Why not B: two concurrent requests both see an absent key and both charge; without `NX` the claim is not atomic.
- Why not C: a lock does not remember the outcome, so retries after it expires execute again.
- Ref: [modules/07-coordination-rate-limits-locks-and-idempotency.md](../modules/07-coordination-rate-limits-locks-and-idempotency.md#5-idempotency-keys), https://redis.io/docs/latest/commands/set/

</details>

### Q-RCAD-039 · D2 Caching strategies and expiration · difficulty 2 · scenario

A cache instance has `maxmemory-policy volatile-lru` and is at its `maxmemory`. `SET` fails with `-OOM command not allowed when used memory > 'maxmemory'`, and `INFO keyspace` shows `db0:keys=4000000,expires=0`. Why, and what fixes it?

- A) `volatile-*` policies evict only keys with a TTL; none exist, so there are no candidates and writes fail as under `noeviction`. Use an `allkeys-*` policy for a pure cache, or give every cache key a TTL
- B) `volatile-lru` needs `maxmemory-samples` of at least 10 before it evicts anything
- C) The error is impossible with any policy other than `noeviction`; the configuration was not applied until restart
- D) The expires dictionary is full; run `DEBUG RELOAD`

<details><summary>Answer</summary>

**A.** With no volatile keys the policy has nothing to evict, so the instance behaves like `noeviction`: writes fail with `OOM` while reads and deletes still work. Never mix cache and durable data under `volatile-*`: one forgotten TTL turns the cache into an outage.

- Why not B: the sample size tunes how well LRU is approximated; it does not gate eviction.
- Why not C: policies can be changed at runtime with `CONFIG SET`, and `volatile-*` can produce this error exactly as described.
- Why not D: there is no such limit.
- Ref: [modules/03-keys-expiry-eviction-and-memory.md](../modules/03-keys-expiry-eviction-and-memory.md#32-policies), https://redis.io/docs/latest/develop/reference/eviction/

</details>

### Q-RCAD-040 · D2 Caching strategies and expiration · difficulty 2 · single

What does raising `maxmemory-samples` from 5 to 10 do?

- A) It turns the approximation into exact LRU
- B) It makes the sampled LRU approximation closer to true LRU, at more CPU per eviction
- C) It enlarges the 16-entry eviction pool
- D) It switches the policy to LFU

<details><summary>Answer</summary>

**B.** Redis samples `maxmemory-samples` random keys, merges them into a pool of the 16 most idle candidates and evicts the most idle one. More samples improve the approximation (10 is close to true LRU) and cost CPU; it never becomes exact LRU.

- Why not A: exact LRU would need a linked list and a list update on every read; Redis deliberately avoids that.
- Why not C: the pool size is a compile-time constant (16), not tied to the setting.
- Why not D: the policy is chosen by `maxmemory-policy`.
- Ref: [modules/03-keys-expiry-eviction-and-memory.md](../modules/03-keys-expiry-eviction-and-memory.md#33-approximated-lru-sampling-plus-a-pool), https://redis.io/docs/latest/develop/reference/eviction/

</details>

### Q-RCAD-041 · D2 Caching strategies and expiration · difficulty 2 · ordering

Put the steps of default-mode, server-assisted client-side caching (RESP3, one connection) in the correct order.

- A) The server pushes an `invalidate` message naming the key to client 1
- B) Client 1 sends `CLIENT TRACKING ON`
- C) Client 1 removes the key from its near cache; its next read goes to Redis
- D) Client 2 modifies the key, for example with `SET`
- E) Client 1 reads the key with `GET` and stores the reply locally; the server records that client 1 may have cached it

<details><summary>Answer</summary>

**B, E, D, A, C.** Tracking is enabled first; a read registers the key in the server's invalidation table; a write by anyone triggers the push; the client drops its copy.

- Why not another order: the server only tracks keys the client has read after tracking was enabled, so `GET` cannot precede `CLIENT TRACKING ON`, and the push cannot be sent before the modification.
- Ref: [modules/04-caching-patterns.md](../modules/04-caching-patterns.md#5-server-assisted-client-side-caching), https://redis.io/docs/latest/develop/clients/client-side-caching/

</details>

### Q-RCAD-042 · D2 Caching strategies and expiration · difficulty 3 · scenario

A service keeps a near cache with `CLIENT TRACKING` over RESP3. After a 20-second network interruption the connection is re-established. What should the client do?

- A) Keep the near cache; the server resends missed invalidations when the client reconnects
- B) Clear the whole near cache on reconnect, because invalidations sent while the connection was down are lost; keep a TTL on near-cache entries as a backstop
- C) Clear only the keys read during the last TTL interval
- D) Switch to `BCAST` mode, which guarantees delivery of every invalidation

<details><summary>Answer</summary>

**B.** Redis does not queue invalidations for a disconnected client, so anything cached before the break may be stale. The same flush applies when a `null` invalidation arrives (sent after `FLUSHALL` or when the server could not keep track). Correct clients also guard the read-versus-invalidation race by marking a key "pending" before the `GET`.

- Why not A: no replay of missed invalidations exists.
- Why not C: a stale key may have been read at any time earlier; a partial flush can keep stale data.
- Why not D: `BCAST` changes which keys produce messages (prefix based), not delivery guarantees.
- Ref: [modules/04-caching-patterns.md](../modules/04-caching-patterns.md#53-correctness-rules), https://redis.io/docs/latest/develop/clients/client-side-caching/

</details>

### Q-RCAD-043 · D2 Caching strategies and expiration · difficulty 3 · scenario

Under `allkeys-lfu` with the default `lfu-log-factor 10` and `lfu-decay-time 1`, key X is read 1 000 000 times and key Y is written once and never read again. Which expectation is right for the LFU counters?

- A) X holds 1 000 000, because the counter is exact
- B) X is near 18 and Y stays at 5 forever
- C) X is saturated near 255 (the 8-bit maximum); Y starts at 5 and loses one point per idle minute, so it reaches 0 within minutes
- D) X is near 255 and Y starts at 0 and gains one point per idle minute

<details><summary>Answer</summary>

**C.** The counter is an 8-bit Morris-style logarithmic counter (increment with probability 1 / ((c − 5) × factor + 1)); with factor 10 about 100 hits give ~10, 1 000 give ~18 and 1 000 000 give ~255. New keys start at 5 so they are not instant victims, and the counter decays by one per `lfu-decay-time` minutes of inactivity, so former hot keys age out. Decay is computed lazily from the last-access minute when the counter is read (`OBJECT FREQ`) or the key is sampled for eviction (`LFUDecrAndReturn` in `evict.c`), not by a background sweep, and the initial value of 5 is applied only to keys created while an LFU policy is active.

- Why not A: 8 bits cannot hold a million; the counter is logarithmic.
- Why not B: ~18 is the value for about 1 000 hits, and idle keys decay.
- Why not D: new keys start at 5, and idleness lowers the counter.
- Ref: [modules/03-keys-expiry-eviction-and-memory.md](../modules/03-keys-expiry-eviction-and-memory.md#34-lfu-an-8-bit-logarithmic-counter-with-decay), https://redis.io/docs/latest/commands/object-freq/

</details>

---

## Domain 4: Debugging and observability

## Domain 3: Persistence, key lifecycle, and operational commands

### Q-RCAD-044 · D3 Persistence, key lifecycle, and operational commands · difficulty 2 · scenario

Clients report 200 ms latency spikes, but `SLOWLOG GET` is empty with default settings. Which explanation is correct, and what do you use next?

- A) `SLOWLOG` records only command execution time above `slowlog-log-slower-than` (default 10 000 µs); time lost to a `fork`, an `fsync`, queueing behind other clients' commands or the network is invisible to it. Enable the latency monitor (`latency-monitor-threshold` above 0), measure intrinsic latency and compare with client timings
- B) `SLOWLOG` is switched off whenever AOF is enabled
- C) `SLOWLOG` records only write commands, so slow reads never appear
- D) `SLOWLOG` works only while `MONITOR` is running

<details><summary>Answer</summary>

**A.** The slow log excludes network and queueing time, so a stalled server with only fast commands shows nothing. `LATENCY` samples events such as `fork`, `aof-fsync-always`, `expire-cycle` and `eviction-cycle` once `latency-monitor-threshold` is set (default 0 = off); `redis-cli --intrinsic-latency` measures stalls caused by the host.

- Why not B: AOF has no effect on the slow log.
- Why not C: reads and writes are recorded alike when they exceed the threshold.
- Why not D: `MONITOR` is unrelated, and it roughly halves throughput; never leave it running in production.
- Ref: [modules/12-operations-security-observability-and-valkey.md](../modules/12-operations-security-observability-and-valkey.md#4-diagnosing-latency), https://redis.io/docs/latest/commands/slowlog-get/

</details>

### Q-RCAD-045 · D3 Persistence, key lifecycle, and operational commands · difficulty 2 · scenario

`INFO memory` on a busy instance shows:

```text
used_memory:4294967296
used_memory_rss:3435973837
mem_fragmentation_ratio:0.80
```

How do you read this, and what do you do?

- A) It is healthy: a ratio below 1 means very efficient memory use
- B) Heavy fragmentation: enable `activedefrag yes`
- C) A replication problem: the replica holds 80 % of the data
- D) The resident set is smaller than the memory Redis allocated, so pages were swapped out; latency will be severe, so relieve the memory pressure and keep swap off

<details><summary>Answer</summary>

**D.** `mem_fragmentation_ratio` is `used_memory_rss / used_memory`. Above about 1.5 sustained means fragmentation; **below 1 means part of the dataset is swapped to disk**, which turns microseconds into milliseconds. Fix the memory pressure (smaller dataset, more RAM, correct container limits) and disable or minimise swap.

- Why not A: below 1 is the swapping signal, not an optimisation.
- Why not B: active defrag addresses ratios well above 1, not below 1.
- Why not C: the ratio compares two numbers of one process; it says nothing about replicas.
- Ref: [modules/03-keys-expiry-eviction-and-memory.md](../modules/03-keys-expiry-eviction-and-memory.md#42-reading-info-memory), https://redis.io/docs/latest/commands/info/

</details>

### Q-RCAD-046 · D3 Persistence, key lifecycle, and operational commands · difficulty 1 · single

Writes suddenly fail with `-MISCONF`. What does the error mean?

- A) The last background save failed (disk full, permissions or a failed `fork`) and `stop-writes-on-bgsave-error yes` (the default) makes the server refuse writes. Fix the cause, then run `BGSAVE` again
- B) `maxmemory` was reached under `noeviction`
- C) The connected user lacks permission for the command
- D) The connection is on a read-only replica

<details><summary>Answer</summary>

**A.** The server refuses writes rather than silently running without persistence. Check `rdb_last_bgsave_status` and the log; a common cause is `fork: Cannot allocate memory` with `vm.overcommit_memory = 0`. Do not silence it by turning the option off without fixing persistence.

- Why not B: that is `-OOM command not allowed when used memory > 'maxmemory'`.
- Why not C: that is `-NOPERM`.
- Why not D: that is `-READONLY`.
- Ref: [modules/09-persistence-rdb-aof-and-backup.md](../modules/09-persistence-rdb-aof-and-backup.md#7-production-failure-modes), https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/

</details>

### Q-RCAD-047 · D3 Persistence, key lifecycle, and operational commands · difficulty 3 · scenario

Four service users all have `~*` and are created as shown. Rules are applied left to right. Which user can run `KEYS *`?

- A) `ACL SETUSER u1 on >pw ~* +@read -@dangerous`
- B) `ACL SETUSER u2 on >pw ~* +@all -@dangerous +keys`
- C) `ACL SETUSER u3 on >pw ~* +@all +keys -@dangerous`
- D) `ACL SETUSER u4 on >pw ~* +get +set`

<details><summary>Answer</summary>

**B.** `KEYS` belongs to `@dangerous` (and `@slow`). In `u2` the category is removed first and `+keys` then adds the single command back; later rules win.

- Why not A: `-@dangerous` removes `KEYS` and nothing adds it back.
- Why not C: `+keys` is applied first, then `-@dangerous` removes it again.
- Why not D: `KEYS` was never granted.
- Test it without running it: `ACL DRYRUN u2 KEYS '*'` (7.0+).
- Ref: [modules/12-operations-security-observability-and-valkey.md](../modules/12-operations-security-observability-and-valkey.md#21-model), https://redis.io/docs/latest/operate/oss_and_stack/management/security/acl/

</details>

### Q-RCAD-048 · D3 Persistence, key lifecycle, and operational commands · difficulty 1 · single

You want to know whether the `orders-api` user would be allowed to run `HSET orders:7 status paid` without executing it. Which command do you use?

- A) `ACL WHOAMI`
- B) `ACL LOG RESET`
- C) `ACL DRYRUN orders-api HSET orders:7 status paid`
- D) `MONITOR`

<details><summary>Answer</summary>

**C.** `ACL DRYRUN user command [arg …]` (7.0+) reports whether the command would be allowed for that user, including the key patterns, and explains the denial. In production a denied command returns `-NOPERM`, and `ACL LOG` lists recent denials.

- Why not A: it shows who the _current_ connection is authenticated as.
- Why not B: it clears the denial log.
- Why not D: it streams every command to you and halves throughput; it does not evaluate permissions.
- Ref: [modules/12-operations-security-observability-and-valkey.md](../modules/12-operations-security-observability-and-valkey.md#21-model), https://redis.io/docs/latest/commands/acl-dryrun/

</details>

### Q-RCAD-049 · D3 Persistence, key lifecycle, and operational commands · difficulty 3 · scenario

On a cache with `maxmemory-policy allkeys-lru`, `redis-cli --hotkeys` aborts with an error that says an LFU policy is not selected. What is the cause, and what can you do without restarting?

- A) `--hotkeys` reads each key's `OBJECT FREQ`, which exists only under an LFU policy; switch with `CONFIG SET maxmemory-policy allkeys-lfu` (the per-key metadata is reinterpreted, so counters take time to become meaningful), or on Redis 8.6+ use the server-side `HOTKEYS` command
- B) `--hotkeys` works only with `appendonly yes`; restart with AOF enabled
- C) `--hotkeys` works only on replicas, because it needs `READONLY`
- D) `--hotkeys` needs `notify-keyspace-events KEA`; set it with `CONFIG SET`

<details><summary>Answer</summary>

**A.** The tool scans with `SCAN` and calls `OBJECT FREQ` on each key; under a non-LFU policy the server replies `An LFU maxmemory policy is not selected, access frequency not tracked`, and `redis-cli` prints it and exits (`findHotKeys` and `getKeyFreqs` in `redis-cli.c`, `objectCommand` in `object.c`). `OBJECT IDLETIME` is the metadata that exists under LRU. The error text itself warns that after a runtime switch, LRU and LFU data take some time to adjust, so run the scan some time after switching. Policies can be switched at runtime. `HOTKEYS START … / GET / STOP` (8.6+) tracks top keys by CPU time and network bytes; `CLUSTER SLOT-STATS` (8.2+) gives per-slot figures in a Cluster.

- Why not B: persistence is irrelevant to access counters.
- Why not C: no replica role is required. The tool sends `READONLY` itself so that it can scan a replica in a cluster, but it works against a primary too.
- Why not D: keyspace notifications publish events; they do not provide access frequency.
- Ref: [modules/12-operations-security-observability-and-valkey.md](../modules/12-operations-security-observability-and-valkey.md#5-hot-keys-and-big-keys), [modules/03-keys-expiry-eviction-and-memory.md](../modules/03-keys-expiry-eviction-and-memory.md#32-policies), https://redis.io/docs/latest/commands/object-freq/

</details>

### Q-RCAD-050 · D3 Persistence, key lifecycle, and operational commands · difficulty 2 · scenario

A primary writes about 5 MB/s. Replicas sometimes lose their link for up to 60 seconds. The `repl-backlog-size` is the 1 MB default, and `INFO stats` shows `sync_full` climbing. What is happening and what should you do?

- A) The 1 MB backlog holds only about 0.2 s of writes, so a 60 s disconnect cannot resume with a partial resync and forces a full resync (fork plus full transfer); size the backlog to at least write rate × outage, here 5 MB/s × 60 s = 300 MB
- B) Partial resync works regardless of backlog size; the climbing counter is normal
- C) Set `repl-backlog-size` to 5 MB, the per-second write volume
- D) Increase `client-output-buffer-limit pubsub` so replicas receive more

<details><summary>Answer</summary>

**A.** A reconnecting replica asks `PSYNC <replid> <offset+1>`; the primary continues only if those bytes are still in the circular backlog. Otherwise it answers `+FULLRESYNC`, and large write-heavy instances can even fall into a full-resync loop.

- Why not B: a growing `sync_full` means the backlog is too small or replicas are being dropped.
- Why not C: 5 MB covers one second, not the 60-second outage.
- Why not D: the Pub/Sub limit does not apply to replica connections (`client-output-buffer-limit replica` does, default `256mb 64mb 60`).
- Ref: [modules/10-replication-and-sentinel.md](../modules/10-replication-and-sentinel.md#14-partial-resync-and-psync2), https://redis.io/docs/latest/operate/oss_and_stack/management/replication/

</details>

### Q-RCAD-051 · D3 Persistence, key lifecycle, and operational commands · difficulty 1 · single

A client gets `+OK` for a `SET` on the primary. The primary crashes before the write reaches any replica, and Sentinel promotes a replica. Is the write present on the new primary?

- A) Yes, because `+OK` means the write was replicated
- B) Yes, because the promoted replica replays the old primary's AOF
- C) Yes, but only if RDB persistence is enabled on the old primary
- D) Not necessarily: replication is asynchronous, so the primary replies before replicas acknowledge, and an acknowledged write can be lost on failover; `WAIT`/`WAITAOF` reduce the risk for chosen writes but give no strong consistency

<details><summary>Answer</summary>

**D.** Redis replicates asynchronously. The old primary's AOF or RDB is irrelevant to the promoted replica, and when the old primary rejoins as a replica it discards its own history. `WAIT numreplicas timeout` tells you how many replicas acknowledged; it does not roll back on timeout.

- Why not A: `+OK` is sent before replicas acknowledge.
- Why not B: the promoted replica has its own data set and never reads the old primary's files.
- Why not C: persistence on the old node does not change what the new primary holds.
- Ref: [modules/10-replication-and-sentinel.md](../modules/10-replication-and-sentinel.md#2-replication-is-asynchronous-and-what-that-loses), https://redis.io/docs/latest/commands/wait/

</details>

### Q-RCAD-052 · D3 Persistence, key lifecycle, and operational commands · difficulty 2 · single

With `appendonly yes` and `appendfsync everysec`, what can be lost in each of two failures: the Redis process is killed with `kill -9` while the operating system stays up, versus a power loss?

- A) Process kill: essentially nothing that was already written to the kernel; power loss: about the last second, up to about two seconds if the disk is slow
- B) Process kill: up to one second; power loss: up to one second
- C) Process kill: everything since the last RDB snapshot; power loss: everything since the last snapshot
- D) Nothing in both cases, because every write is synced before the reply

<details><summary>Answer</summary>

**A.** The main thread `write()`s the AOF buffer before sleeping, so a process crash loses nothing already handed to the kernel page cache; the background thread `fsync()`s once a second, so a machine crash loses about a second, and Redis delays writes only after an fsync has been pending for two seconds. Asynchronous replicas can additionally miss writes after a failover.

- Why not B: a process crash does not lose data in the page cache.
- Why not C: that describes RDB-only persistence.
- Why not D: syncing every write is `appendfsync always`, not `everysec`.
- Ref: [modules/09-persistence-rdb-aof-and-backup.md](../modules/09-persistence-rdb-aof-and-backup.md#31-write-path-and-appendfsync), https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/

</details>

### Q-RCAD-053 · D3 Persistence, key lifecycle, and operational commands · difficulty 3 · scenario

A primary runs with persistence disabled under a supervisor that restarts crashed processes automatically; two replicas follow it. After a crash and automatic restart, the application finds the data gone on all three nodes. Why, and what is the fix?

- A) The replicas had `replica-read-only yes` and could not keep the data; set it to `no`
- B) `min-replicas-to-write` was not set; set it to 2
- C) The primary restarted empty, and the replicas then resynchronised from the empty primary and erased their own copies; enable persistence on the primary, or disable automatic restart so Sentinel promotes a replica
- D) A full resync always deletes the data on the primary; schedule resyncs off-peak

<details><summary>Answer</summary>

**C.** A restart without persistence starts a new, empty history. Replicas that reconnect treat the primary as the source of truth and flush their data to load its (empty) snapshot. Either let the primary restart from an RDB/AOF, or prevent the restart so failover promotes a replica that still has the data.

- Why not A: replicas are read-only by default and that does not cause data loss.
- Why not B: that setting makes an isolated primary refuse writes; it cannot restore an empty dataset.
- Why not D: a full resync flushes and reloads the replica, not the primary.
- Ref: [modules/09-persistence-rdb-aof-and-backup.md](../modules/09-persistence-rdb-aof-and-backup.md#4-choosing-a-configuration), https://redis.io/docs/latest/operate/oss_and_stack/management/replication/

</details>

## Domain 4: Client library usage and connection management

### Q-RCAD-054 · D4 Client library usage and connection management · difficulty 2 · scenario

A service reads 10 000 keys with individual `GET`s. The network round trip is 0.5 ms and Redis does about 20 ms of work in total, so the loop takes about 5 seconds. The service switches to pipelines of 100 commands, awaiting each batch. What total time should it expect?

- A) About 5 seconds, because pipelining does not change server work
- B) About 20 ms, because round trips become free
- C) About 0.2 ms
- D) About 70 ms: 100 round trips of 0.5 ms plus the 20 ms of server time

<details><summary>Answer</summary>

**D.** Wall time is ceil(n / w) × RTT + n × S = 100 × 0.5 ms + 20 ms = 70 ms. Pipelining divides only the round-trip term; once windows are large, server time dominates and bigger windows stop helping. Pipelining gives no atomicity.

- Why not A: that is the unpipelined time; the 10 000 round trips are what disappear.
- Why not B: 100 round trips remain (50 ms).
- Why not C: that ignores both the round trips and the server work.
- Ref: [modules/01-model-architecture-and-protocol.md](../modules/01-model-architecture-and-protocol.md#3-a-latency-mental-model), https://redis.io/docs/latest/develop/using-commands/pipelining/

</details>

### Q-RCAD-055 · D4 Client library usage and connection management · difficulty 2 · scenario

After a Sentinel failover, one service logs `-READONLY You can't write against a read only replica.` on every write until it is restarted; all other services recovered. What is the most likely cause?

- A) The service lacks write permission in its ACL
- B) `min-replicas-to-write` blocks the write
- C) The instance is at `maxmemory` under `noeviction`
- D) The service connects to the fixed address of the old primary, which is now a replica, instead of asking Sentinel for the current primary

<details><summary>Answer</summary>

**D.** After a failover, Sentinels reconfigure the old primary as a replica of the new one. Clients must be Sentinel-aware (`SENTINEL GET-MASTER-ADDR-BY-NAME`, subscribe to `+switch-master`, verify the role with `ROLE` after connecting), otherwise they keep writing to the demoted node.

- Why not A: a permission problem returns `-NOPERM`.
- Why not B: that returns `-NOREPLICAS`.
- Why not C: that returns `-OOM`.
- Ref: [modules/10-replication-and-sentinel.md](../modules/10-replication-and-sentinel.md#53-clients-and-sentinel), https://redis.io/docs/latest/operate/oss_and_stack/management/sentinel/

</details>

---

## Domain 5: Clustered and highly available code

### Q-RCAD-056 · D4 Client library usage and connection management · difficulty 2 · hands-on

**Task.** On any node of a Redis Cluster, run `CLUSTER KEYSLOT` for each of these keys: `{user1000}.following`, `user1000`, `foo{bar}{zap}`, `foo{zap}`, `foo{{bar}}zap`, `{bar}x`, `foo{}{bar}`, `bar`. Compare the slot numbers. Which statement is true?

- A) `foo{bar}{zap}` and `foo{zap}` share a slot
- B) `{user1000}.following` and `user1000` share a slot
- C) `foo{{bar}}zap` and `{bar}x` share a slot
- D) `foo{}{bar}` and `bar` share a slot

<details><summary>Answer</summary>

**B.** If a key contains `{` and a `}` follows with at least one byte between them, only the bytes between the first `{` and the first `}` after it are hashed. `{user1000}.following` hashes `user1000`, exactly like the key `user1000` (slot 3443).

- Why not A: only the first tag counts, so `foo{bar}{zap}` hashes `bar` (slot 5061) while `foo{zap}` hashes `zap` (slot 6469).
- Why not C: `foo{{bar}}zap` hashes `{bar` (slot 4015) while `{bar}x` hashes `bar` (slot 5061).
- Why not D: in `foo{}{bar}` the first `{` is closed immediately, so the whole key is hashed (slot 8363); `bar` is slot 5061.
- Verification: [examples/ts/integration/11-cluster.test.ts](../examples/ts/integration/11-cluster.test.ts) › `CLUSTER KEYSLOT agrees with the track's CRC16 implementation` (3 spawned nodes; `npm run test:integration` in `technologies/redis`), and the hermetic [examples/ts/11-cluster.test.ts](../examples/ts/11-cluster.test.ts) › `hash tags follow the spec examples exactly`. The slot numbers above were computed with the track's own `keySlot` implementation.
- Ref: [modules/11-redis-cluster.md](../modules/11-redis-cluster.md#2-hash-tags-and-multi-key-operations), https://redis.io/docs/latest/commands/cluster-keyslot/

</details>

### Q-RCAD-057 · D4 Client library usage and connection management · difficulty 2 · single

A cluster client receives `-MOVED 3999 10.0.0.7:6379` for one request and, later, `-ASK 3999 10.0.0.9:6379` for another. How should it handle them?

- A) On `MOVED` update the slot map (usually by refreshing it) and retry on the new node; on `ASK` send `ASKING` followed by the command to the named node for this one request only, without updating the map
- B) On `MOVED` send `ASKING` and retry; on `ASK` update the slot map
- C) Update the slot map for both and retry
- D) Treat both as errors and return them to the caller

<details><summary>Answer</summary>

**A.** `MOVED` means the slot is permanently served elsewhere. `ASK` means the slot is mid-migration and this key is already on the target; the target answers only if the request is preceded by `ASKING`, and the map must not change because the slot still belongs to the source.

- Why not B: the roles are swapped.
- Why not C: updating the map on `ASK` would send later requests for keys still on the source to the wrong node.
- Why not D: clients are expected to follow redirections (cluster-aware libraries do this transparently, up to a retry limit).
- Ref: [modules/11-redis-cluster.md](../modules/11-redis-cluster.md#31-the-protocol), https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/

</details>

### Q-RCAD-058 · D4 Client library usage and connection management · difficulty 3 · scenario

A multi-tenant application names keys `{tenant}:order:<id>` so multi-key commands work in Cluster. After onboarding a very large tenant, one node is saturated while the others are idle. What is the right fix?

- A) Remove the hash tags everywhere and rely on scripts across keys
- B) Increase `cluster-node-timeout`
- C) Tag by the smallest unit that needs atomicity (for example `order:{<orderId>}` or `cart:{42}`) and accept that operations across orders are not atomic
- D) Give each tenant its own numbered database with `SELECT`

<details><summary>Answer</summary>

**C.** Every key with the same tag lands in one slot, hence on one node: tagging by a large entity creates a hot slot (the module's test puts 10 000 keys in one slot). Tag by the smallest unit that needs atomicity.

- Why not A: without tags, multi-key operations across slots fail with `-CROSSSLOT`, and scripts must declare all keys in one slot.
- Why not B: the timeout concerns failure detection, not load distribution.
- Why not D: Redis Cluster supports only database 0 and `SELECT` is refused (Valkey 9.0 adds numbered databases in cluster mode).
- Ref: [modules/11-redis-cluster.md](../modules/11-redis-cluster.md#2-hash-tags-and-multi-key-operations), https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/

</details>

### Q-RCAD-059 · D4 Client library usage and connection management · difficulty 3 · scenario

A deployment has five Sentinels with `quorum 2`. The primary has crashed. A network partition leaves two Sentinels on one side and three Sentinels (plus the replicas) on the other; neither side can reach the primary. Which statement is correct?

- A) The side with two Sentinels can fail over, because its two Sentinels meet the quorum
- B) Both sides can declare the primary objectively down, but only the side with three Sentinels can win the leader election, because failover needs a majority of all five Sentinels
- C) Neither side can fail over, because a failover needs all five Sentinels
- D) Both sides promote a replica and the one with the higher configuration epoch wins afterwards

<details><summary>Answer</summary>

**B.** The quorum only decides detection (ODOWN). The Sentinel that wants to fail over must be elected leader in a new epoch by a majority of all Sentinels (and at least the quorum), so a minority can detect but cannot act. That prevents a partitioned minority from promoting a second primary.

- Why not A: two of five is not a majority, so it cannot win the election.
- Why not C: the three-Sentinel side holds a majority and can proceed.
- Why not D: the minority cannot promote anything; the epoch rule resolves configuration conflicts afterwards, but the election rule means conflicts do not arise here.
- Ref: [modules/10-replication-and-sentinel.md](../modules/10-replication-and-sentinel.md#52-from-down-to-a-new-primary), https://redis.io/docs/latest/operate/oss_and_stack/management/sentinel/

</details>

### Q-RCAD-060 · D4 Client library usage and connection management · difficulty 2 · hands-on

**Task.** Three-node cluster; hash slot S is owned by node A. Run `CLUSTER SETSLOT S IMPORTING <A-id>` on node B and `CLUSTER SETSLOT S MIGRATING <B-id>` on node A, then `MIGRATE` a key `k` of slot S from A to B. Now send, in this order:

1. `GET k` to node A.
2. `GET k` to node B, without `ASKING`.
3. `ASKING` and then `GET k` to node B.
4. Finish with `CLUSTER SETSLOT S NODE <B-id>` on both nodes, then `GET k` to node A.

Which sequence of replies is observed?

- A) (1) value, (2) value, (3) value, (4) value
- B) (1) `-MOVED S B`, (2) `-ASK S A`, (3) `-MOVED S A`, (4) value
- C) (1) `-ASK S B`, (2) value, (3) value, (4) `-ASK S B`
- D) (1) `-ASK S B`, (2) `-MOVED S A`, (3) value, (4) `-MOVED S B`

<details><summary>Answer</summary>

**D.** The migrating source answers `-ASK` for a key it no longer has. The importing node refuses the key without `ASKING` and sends the client back to the official owner with `-MOVED`. With `ASKING` it serves the key. After ownership is reassigned, the old owner answers `-MOVED` to the new one, and a client updates its slot map on that reply.

- Why not A: the nodes do not proxy requests; they redirect.
- Why not B: it swaps the redirection types and the nodes.
- Why not C: the importing node does not serve the key without `ASKING`, and after `SETSLOT … NODE` the old owner sends `MOVED`, not `ASK`.
- Verification: [examples/ts/integration/11-cluster.test.ts](../examples/ts/integration/11-cluster.test.ts) › `ASK during a manual slot migration, then MOVED after the slot is reassigned`; hermetic model: [examples/ts/11-cluster.test.ts](../examples/ts/11-cluster.test.ts) › `ASK during migration: one-off redirect with ASKING, slot map not updated; MOVED after it completes`.
- Ref: [modules/11-redis-cluster.md](../modules/11-redis-cluster.md#41-classic-key-by-key-migration), https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/

</details>

---

## Domain 6: Atomicity and programmability

## Domain 5: Concurrency, transactions, and atomicity

### Q-RCAD-061 · D5 Concurrency, transactions, and atomicity · difficulty 2 · scenario

Worker A takes a lock with `SET lock:report <tokenA> NX PX 30000`, runs for 40 seconds, then calls `DEL lock:report`. Meanwhile worker B acquired the lock after it expired. What is wrong and what is the fix?

- A) Nothing: `DEL` only removes the caller's own lock
- B) Replace `SET … NX PX` with `SETNX` followed by `EXPIRE`
- C) Raise the TTL to one hour and keep the unconditional `DEL`
- D) A's `DEL` removes B's lock; release must be an atomic compare-and-delete on the token (a Lua script, or `DELEX … IFEQ` on Redis 8.4+; Valkey has `DELIFEQ` instead)

<details><summary>Answer</summary>

**D.** A lock with a TTL is a lease: the holder can outlive it. An unconditional `DEL` then deletes the next holder's lock. Release only if the stored token is still yours, atomically (`GET` then `DEL` from the client is not atomic).

- Why not A: `DEL` has no notion of ownership.
- Why not B: that is the pre-2.6.12 form with a crash window between the two commands, which can leave a lock without a TTL forever.
- Why not C: a longer TTL only makes the overrun rarer; any TTL can be exceeded by a pause, and the release is still unsafe.
- Ref: [modules/07-coordination-rate-limits-locks-and-idempotency.md](../modules/07-coordination-rate-limits-locks-and-idempotency.md#21-single-instance-lock), https://redis.io/docs/latest/commands/set/

</details>

### Q-RCAD-062 · D5 Concurrency, transactions, and atomicity · difficulty 3 · scenario

A job runner guards a non-idempotent write to object storage with `SET lock NX PX 10000`. Client 1 stalls for 15 seconds in a garbage-collection pause, the lease expires, client 2 acquires the lock and writes, then client 1 wakes up and writes too. How do you guarantee that a stale holder cannot overwrite the newer write?

- A) Use a longer TTL, such as 60 seconds
- B) Run Redlock on five instances instead of one
- C) Generate a fencing token at acquisition (an `INCR` counter, atomically with the lock), send it with every write, and make the storage reject a token lower than one it has already seen
- D) Call `WAIT 1 100` right after acquiring the lock

<details><summary>Answer</summary>

**C.** No lock service can stop a paused holder from acting after its lease expired; only the protected resource can, by checking a monotonic fencing token (for example a conditional `UPDATE … WHERE fence < $token`).

- Why not A: any TTL can be exceeded by a pause or a slow network.
- Why not B: Redlock depends on the same timing assumptions (bounded pauses, delays and clock drift) and provides no fencing token.
- Why not D: `WAIT` narrows replication loss on failover; it does nothing about a stalled client.
- Ref: [modules/07-coordination-rate-limits-locks-and-idempotency.md](../modules/07-coordination-rate-limits-locks-and-idempotency.md#22-why-a-lease-is-not-mutual-exclusion-the-pause-problem), https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/

</details>

### Q-RCAD-063 · D5 Concurrency, transactions, and atomicity · difficulty 2 · hands-on

**Task.** Against any Redis server, using a client that shows the raw `EXEC` reply (for example `redis-cli`), run:

```text
SET s text
MULTI
SET a 1
INCR s
SET b 2
EXEC
GET a
GET b
```

What is observed?

- A) `EXEC` returns `-EXECABORT`; `GET a` and `GET b` return nil
- B) `EXEC` returns an array of three replies: `OK`, an error (`value is not an integer or out of range`), `OK`; `GET a` returns 1 and `GET b` returns 2
- C) `EXEC` rolls everything back and returns the error; `GET a` and `GET b` return nil
- D) `EXEC` stops at the failing command; `GET a` returns 1 and `GET b` returns nil

<details><summary>Answer</summary>

**B.** `INCR` on a non-numeric string fails at run time. Runtime errors do not abort or roll back a transaction: the commands before and after the failing one are applied, and the error appears in the `EXEC` array. Beware client libraries: `node-redis`'s `multi().exec()` rejects on the first error reply, which hides that the other commands were applied.

- Why not A: `-EXECABORT` is for errors detected at queue time (unknown command, wrong arity), not runtime errors.
- Why not C: Redis has no rollback; validate before you write, or move the logic into a script that validates first.
- Why not D: execution does not stop at the first error.
- Verification: [examples/ts/integration/05-transactions-scripting.test.ts](../examples/ts/integration/05-transactions-scripting.test.ts) › `MULTI/EXEC on a real server: runtime error inside, the rest still applied` (reads the raw `EXEC` reply with the track's RESP parser); hermetic model in [examples/ts/05-transactions-and-scripting.test.ts](../examples/ts/05-transactions-and-scripting.test.ts).
- Ref: [modules/05-transactions-scripting-and-functions.md](../modules/05-transactions-scripting-and-functions.md#12-what-you-get-and-what-you-do-not), https://redis.io/docs/latest/develop/using-commands/transactions/

</details>

### Q-RCAD-064 · D5 Concurrency, transactions, and atomicity · difficulty 2 · single

A client sends this sequence:

```text
MULTI
SET a 1
FOO
SET b 2
EXEC
```

What happens?

- A) `FOO` is queued; `EXEC` runs `SET a`, reports an error for `FOO`, and runs `SET b`
- B) `EXEC` returns a nil reply because the transaction is dirty
- C) `FOO` is refused with an error as soon as it is sent, `EXEC` fails with `-EXECABORT`, and neither `a` nor `b` is set
- D) `EXEC` runs all three and rolls back `SET a` after `FOO` fails

<details><summary>Answer</summary>

**C.** An unknown command or a wrong arity is a queue-time error: the transaction is flagged and `EXEC` discards the whole queue with `-EXECABORT` (since 2.6.5).

- Why not A: that is how _runtime_ errors behave.
- Why not B: a nil reply from `EXEC` means a `WATCH`ed key was modified.
- Why not D: there is no rollback in Redis.
- Verification: [examples/ts/integration/05-transactions-scripting.test.ts](../examples/ts/integration/05-transactions-scripting.test.ts) › `negative: unknown command inside MULTI makes EXEC fail with EXECABORT`.
- Ref: [modules/05-transactions-scripting-and-functions.md](../modules/05-transactions-scripting-and-functions.md#11-operational-semantics), https://redis.io/docs/latest/commands/exec/

</details>

### Q-RCAD-065 · D5 Concurrency, transactions, and atomicity · difficulty 1 · single

Client 1 runs `WATCH stock`, reads it, then `MULTI`, `DECR stock`. Before it sends `EXEC`, client 2 runs `INCRBY stock 5`. What does client 1's `EXEC` do?

- A) It returns a null reply and executes nothing; the client should retry the read-check-write loop
- B) It executes `DECR stock` and returns its result
- C) It fails with `-EXECABORT`
- D) It blocks until client 2 finishes

<details><summary>Answer</summary>

**A.** `WATCH` gives optimistic concurrency: if any watched key is modified before `EXEC` (by another client, by expiry, by eviction, by `FLUSHDB`), `EXEC` returns a null reply and runs nothing. The pattern is a retry loop; under heavy contention a script is a better tool. `WATCH` must be on the same connection as `MULTI/EXEC`.

- Why not B: that happens only when the watched keys were not touched.
- Why not C: `-EXECABORT` comes from queue-time errors.
- Why not D: `EXEC` never waits for other clients.
- Verification: [examples/ts/integration/05-transactions-scripting.test.ts](../examples/ts/integration/05-transactions-scripting.test.ts) › `WATCH: a concurrent write makes EXEC return nil`.
- Ref: [modules/05-transactions-scripting-and-functions.md](../modules/05-transactions-scripting-and-functions.md#2-watch-optimistic-concurrency-check-and-set), https://redis.io/docs/latest/commands/watch/

</details>

## Mock exam

A full-length simulation built from the 65 questions above, with the domain mix of the bank ([§ 1](#1-scope-version-and-integrity)). The mock reuses the 65 questions of the bank in a shuffled order, so take it **before** you work through the domains, or after enough time that you no longer remember the answers.

**Rules.**

- 65 questions, **90 minutes** (about 83 seconds per question). Suggested plan: 65 minutes for a first pass, 25 minutes to review flagged questions.
- One point per question. `multi` and `ordering` questions are all-or-nothing: no partial credit and no negative marking.
- **Pass mark: 46 of 65 (70.8 %)**, the smallest score at or above the exam's 70 % (45.5 questions).
- No documentation, no running a server, except where a question is tagged `hands-on` and you choose to reproduce it afterwards.
- Open the questions in the order of the delivery table below, not in file order, so that neighbouring questions do not hint at each other.

### Domain mix

| Domain                                                  | Questions | Question IDs |
| ------------------------------------------------------- | --------- | ------------ |
| D1 Data Modeling with Redis data structures             | 30        | 001–030      |
| D2 Caching strategies and expiration                    | 13        | 031–043      |
| D3 Persistence, key lifecycle, and operational commands | 10        | 044–053      |
| D4 Client library usage and connection management       | 7         | 054–060      |
| D5 Concurrency, transactions, and atomicity             | 5         | 061–065      |
| **Total**                                               | **65**    |              |

IDs are the numeric part of `Q-RCAD-<NNN>`. Difficulty mix: 11 at difficulty 1, 37 at difficulty 2, 17 at difficulty 3.

### Delivery order

Take the questions in this order (position, then question).

| Position | Question | Position | Question | Position | Question | Position | Question | Position | Question |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 053 | 14 | 054 | 27 | 059 | 40 | 050 | 53 | 047 |
| 2 | 049 | 15 | 046 | 28 | 028 | 41 | 014 | 54 | 025 |
| 3 | 027 | 16 | 052 | 29 | 032 | 42 | 009 | 55 | 057 |
| 4 | 007 | 17 | 002 | 30 | 021 | 43 | 012 | 56 | 030 |
| 5 | 024 | 18 | 017 | 31 | 045 | 44 | 040 | 57 | 011 |
| 6 | 016 | 19 | 008 | 32 | 035 | 45 | 062 | 58 | 023 |
| 7 | 036 | 20 | 019 | 33 | 013 | 46 | 003 | 59 | 065 |
| 8 | 055 | 21 | 051 | 34 | 063 | 47 | 038 | 60 | 001 |
| 9 | 043 | 22 | 034 | 35 | 020 | 48 | 037 | 61 | 010 |
| 10 | 042 | 23 | 058 | 36 | 029 | 49 | 022 | 62 | 006 |
| 11 | 004 | 24 | 041 | 37 | 018 | 50 | 048 | 63 | 031 |
| 12 | 061 | 25 | 015 | 38 | 026 | 51 | 056 | 64 | 060 |
| 13 | 005 | 26 | 064 | 39 | 033 | 52 | 044 | 65 | 039 |

### Scoring key

Cover this section until you have answered all questions. For `ordering` questions the key is the correct sequence; for `multi` questions it is the set of correct options.

| Question | Domain | Type     | Difficulty | Key           |
| -------- | ------ | -------- | ---------- | ------------- |
| 001      | D1     | single   | 1          | B             |
| 002      | D1     | single   | 1          | D             |
| 003      | D1     | single   | 2          | A             |
| 004      | D1     | multi    | 2          | A, C          |
| 005      | D1     | scenario | 3          | A             |
| 006      | D1     | single   | 2          | B             |
| 007      | D1     | single   | 1          | D             |
| 008      | D1     | single   | 3          | A             |
| 009      | D1     | single   | 2          | C             |
| 010      | D1     | single   | 3          | B             |
| 011      | D1     | hands-on | 2          | C             |
| 012      | D1     | single   | 1          | C             |
| 013      | D1     | single   | 2          | B             |
| 014      | D1     | scenario | 2          | B             |
| 015      | D1     | single   | 3          | C             |
| 016      | D1     | scenario | 2          | C             |
| 017      | D1     | single   | 1          | D             |
| 018      | D1     | multi    | 2          | A, D          |
| 019      | D1     | scenario | 2          | D             |
| 020      | D1     | multi    | 3          | B, C          |
| 021      | D1     | scenario | 2          | D             |
| 022      | D1     | scenario | 3          | B             |
| 023      | D1     | single   | 2          | A             |
| 024      | D1     | scenario | 1          | C             |
| 025      | D1     | single   | 2          | D             |
| 026      | D1     | single   | 2          | A             |
| 027      | D1     | hands-on | 2          | B             |
| 028      | D1     | single   | 2          | C             |
| 029      | D1     | scenario | 3          | D             |
| 030      | D1     | ordering | 3          | E, C, D, B, A |
| 031      | D2     | single   | 1          | C             |
| 032      | D2     | single   | 2          | B             |
| 033      | D2     | single   | 2          | C             |
| 034      | D2     | single   | 2          | D             |
| 035      | D2     | scenario | 2          | A             |
| 036      | D2     | multi    | 2          | B, C          |
| 037      | D2     | scenario | 2          | A             |
| 038      | D2     | scenario | 3          | D             |
| 039      | D2     | scenario | 2          | A             |
| 040      | D2     | single   | 2          | B             |
| 041      | D2     | ordering | 2          | B, E, D, A, C |
| 042      | D2     | scenario | 3          | B             |
| 043      | D2     | scenario | 3          | C             |
| 044      | D3     | scenario | 2          | A             |
| 045      | D3     | scenario | 2          | D             |
| 046      | D3     | single   | 1          | A             |
| 047      | D3     | scenario | 3          | B             |
| 048      | D3     | single   | 1          | C             |
| 049      | D3     | scenario | 3          | A             |
| 050      | D3     | scenario | 2          | A             |
| 051      | D3     | single   | 1          | D             |
| 052      | D3     | single   | 2          | A             |
| 053      | D3     | scenario | 3          | C             |
| 054      | D4     | scenario | 2          | D             |
| 055      | D4     | scenario | 2          | D             |
| 056      | D4     | hands-on | 2          | B             |
| 057      | D4     | single   | 2          | A             |
| 058      | D4     | scenario | 3          | C             |
| 059      | D4     | scenario | 3          | B             |
| 060      | D4     | hands-on | 2          | D             |
| 061      | D5     | scenario | 2          | D             |
| 062      | D5     | scenario | 3          | C             |
| 063      | D5     | hands-on | 2          | B             |
| 064      | D5     | single   | 2          | C             |
| 065      | D5     | single   | 1          | A             |

### Per-domain score breakdown

Copy this table, fill the "Correct" column and compute the percentage. The "Weight" column is the official exam guide domain weight ([§ 1](#1-scope-version-and-integrity)).

| Domain | Questions | Weight | Correct | Percent | Next step if below 70 % |
| --- | --- | --- | --- | --- | --- |
| D1 Data Modeling with Redis data structures | 30 | 46.2 % | ___ | ___ % | Modules 02, 06, 08; re-run encoding tests, stream PEL and vector search |
| D2 Caching strategies and expiration | 13 | 20.0 % | ___ | ___ % | Modules 03 and 04; redo stampede, cache-aside, near-cache and eviction questions |
| D3 Persistence, key lifecycle, and operational commands | 10 | 15.4 % | ___ | ___ % | Modules 03, 09, 12; redo AOF/RDB, replication loss, ACL, and latency diagnosis |
| D4 Client library usage and connection management | 7 | 10.8 % | ___ | ___ % | Modules 01, 10, 11; redo pipelining, Sentinel failover, and Cluster MOVED/ASK routing |
| D5 Concurrency, transactions, and atomicity | 5 | 7.7 % | ___ | ___ % | Modules 05 and 07; reproduce MULTI/WATCH, atomic conditional and fencing token tests |
| **Total** | 65 | 100 % | ___ / 65 | ___ % | Pass at 46 or more |

**Reading the result.** A pass overall with one domain below 50 % is still a gap: the real exam draws from every domain. Review the explanations of every question you missed, not only the correct option, because each "Why not" line names a misconception the modules warn about (rollback in `MULTI`, `SCAN` duplicates, `volatile-*` without TTLs, Pub/Sub as a queue, Redlock as a correctness guarantee, `ASK` updating the slot map).
