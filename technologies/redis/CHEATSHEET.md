# Redis 8.x Cheatsheet

Fast lookup for the rules taught in [modules/](modules/). Defaults are those of Redis Open Source 8.10.3 as stated in the modules (verified 2026-11-04). Valkey differences appear only where a module marks them.

## Command complexity ([02](modules/02-core-data-types-encodings-and-complexity.md#2-complexity-what-a-command-really-costs))

| Type | Command | Complexity | Note |
| --- | --- | --- | --- |
| String | `GET`, `SET`, `INCR`, `APPEND` | O(1) | `APPEND` is amortised O(1). |
| String | `GETRANGE`, `SETRANGE`, `MGET`, `MSET` | O(N) | `SETRANGE` far beyond the end can allocate up to 512 MB. |
| List | `LPUSH`, `RPUSH`, `LPOP`, `RPOP`, `BLMOVE` | O(1) per element | Blocking commands block the connection, not the server. |
| List | `LINDEX`, `LSET`, `LINSERT`, `LTRIM` | O(N) | `LINDEX`/`LSET`/`LINSERT` walk from the nearer end. |
| List | `LRANGE s e` | O(S+N) | `LRANGE 0 -1` on a huge list is a latency incident. |
| Hash | `HGET`, `HSET`, `HDEL`, `HINCRBY` | O(1) per field |  |
| Hash | `HGETALL`, `HKEYS`, `HVALS` | O(N) | Prefer `HSCAN` or `HMGET`. |
| Set | `SADD`, `SREM`, `SISMEMBER`, `SCARD` | O(1) |  |
| Set | `SMEMBERS`, `SUNION`, `SDIFF` | O(N) |  |
| Set | `SINTER` | O(N·M) worst | Iterates the smallest set. `SINTERCARD … LIMIT` (7.0) bounds the work. |
| Sorted set | `ZADD`, `ZREM`, `ZINCRBY`, `ZRANK` | O(log N) | `ZRANK` uses skip-list spans. |
| Sorted set | `ZSCORE` | O(1) | Member to score dict. |
| Sorted set | `ZRANGE` (index, `BYSCORE`, `BYLEX`) | O(log N + M) | M = elements returned. |
| Sorted set | `ZUNIONSTORE`, `ZINTERSTORE` | O(N) + O(M log M) | Expensive; bound inputs. |
| Keyspace | `DEL` of an aggregate | O(N) | Use `UNLINK` (O(1) on the main thread). |
| Keyspace | `KEYS pattern` | O(N) over the database | Never in production. |
| Keyspace | `SCAN` | O(1) per call | Duplicates possible; run until cursor is 0. |
| HyperLogLog | `PFADD`, `PFCOUNT`, `PFMERGE` | O(1) / O(N) merge | About 12 KB per key, 0.81 % error; `PFCOUNT` can write. |

## Encodings and default thresholds ([02](modules/02-core-data-types-encodings-and-complexity.md#33-thresholds-and-the-one-way-rule))

| Type | Compact encoding | Converts when | Defaults |
| --- | --- | --- | --- |
| String | `int` / `embstr` / `raw` | `embstr` up to 44 bytes; canonical 64-bit integer is `int` | `APPEND`/`SETRANGE` make `raw` |
| Hash | `listpack` | more than `hash-max-listpack-entries`, or a value over `hash-max-listpack-value` | 512 / 64 |
| Set | `intset` | non-integer member, or more than `set-max-intset-entries` | 512 |
| Set | `listpack` (7.2+) | more than `set-max-listpack-entries`, or a member over `set-max-listpack-value` | 128 / 64 |
| Sorted set | `listpack` | more than `zset-max-listpack-entries`, or a member over `zset-max-listpack-value` | 128 / 64 |
| List | `listpack` (7.2+) then `quicklist` | node exceeds `list-max-listpack-size` | -2 (8 KB per node) |
| Stream | radix tree of listpacks | `stream-node-max-entries` / `stream-node-max-bytes` | 100 / 4096 |

Conversions are one-way while the key lives; only an RDB reload re-encodes. `hll-sparse-max-bytes` defaults to 3000.

## TTL and expiry ([03](modules/03-keys-expiry-eviction-and-memory.md#12-which-commands-touch-the-ttl))

| Operation | Effect on TTL |
| --- | --- |
| `SET k v` (no `KEEPTTL`), `GETSET` | Clears the TTL. `SET … KEEPTTL` (6.0+) keeps it. |
| `INCR`, `APPEND`, `LPUSH`, `HSET`, `SADD`, `ZADD` | Keep the TTL. |
| `RENAME src dst` | `dst` takes `src`'s TTL. |
| `PERSIST k` | Removes the TTL. |
| `EXPIRE k s [NX\|XX\|GT\|LT]` (7.0+) | `NX` only if none, `XX` only if one, `GT`/`LT` only if the new TTL is greater/less. |
| `EXPIRE k 0` or a past time | Deletes the key immediately. |
| `GETEX k EX s` / `GETEX k PERSIST` (6.2+) | Read and change the TTL atomically. |
| `HEXPIRE` family (7.4+) | Per-field TTL; `HSET` on the field clears it; reply has one code per field (-2, 0, 1, 2). |

`TTL`/`PTTL` return -1 for a persistent key and -2 for a missing key. `expired` notifications fire when the key is deleted, not when its time passes.

## Eviction and memory ([03](modules/03-keys-expiry-eviction-and-memory.md#3-eviction-under-maxmemory))

| Setting | Default | Meaning |
| --- | --- | --- |
| `maxmemory` | 0 (unlimited, 64-bit) | Cap on `used_memory` minus replica and AOF buffers. |
| `maxmemory-policy` | `noeviction` | Writes fail with `-OOM`; reads and deletes work. |
| `maxmemory-samples` | 5 | Sampled keys per eviction; eviction pool holds 16. |
| `maxmemory-eviction-tenacity` | 10 | Eviction effort versus latency. |
| `lfu-log-factor` / `lfu-decay-time` | 10 / 1 (minutes) | New keys start at 5; 1M hits is about 255. |
| `active-expire-effort` | 1 (range 1-10) | 20 keys per loop, repeat while more than 10 % expired. |
| `hz` | 10 | `serverCron` runs per second. |
| `replica-ignore-maxmemory` | `yes` | Replicas apply the primary's evictions. |
| `lazyfree-lazy-eviction`, `-expire`, `-server-del`, `-user-del`, `-user-flush`, `replica-lazy-flush` | `no` | Free in the background when `yes`. |

Policies: `allkeys-lru`, `volatile-lru`, `allkeys-lfu`, `volatile-lfu` (4.0+), `allkeys-lrm`, `volatile-lrm` (8.6+), `allkeys-random`, `volatile-random`, `volatile-ttl`, `noeviction`. A `volatile-*` policy with no TTL keys behaves like `noeviction`. Change at runtime with `CONFIG SET maxmemory-policy`.

`mem_fragmentation_ratio` = RSS / `used_memory`: above 1.5 sustained is fragmentation, below 1 is swapping. Tools: `MEMORY USAGE key [SAMPLES n]`, `MEMORY STATS`, `MEMORY DOCTOR`, `redis-cli --bigkeys`, `--memkeys`, `--hotkeys` (LFU policy required).

## Protocol and client limits ([01](modules/01-model-architecture-and-protocol.md#43-limits-that-protect-the-server))

| Setting | Default |
| --- | --- |
| `proto-max-bulk-len` | 512 MB |
| `client-query-buffer-limit` | 1 GB |
| `client-output-buffer-limit` normal / replica / pubsub | `0 0 0` / `256mb 64mb 60` / `32mb 8mb 60` |
| `maxclients` | 10 000 |
| `timeout` / `tcp-keepalive` | 0 (never) / 300 |
| `databases` | 16 (Cluster: database 0 only) |
| `io-threads` | 1 (disabled) |
| `busy-reply-threshold` (was `lua-time-limit`) | 5000 ms |

RESP: `+` simple string, `-` error, `:` integer, `$` bulk string, `*` array, and RESP3 `_` null, `#` boolean, `,` double, `%` map, `~` set, `>` push. `HELLO 3` upgrades the connection.

## Transactions and scripting ([05](modules/05-transactions-scripting-and-functions.md))

| Topic | Rule |
| --- | --- |
| `MULTI`/`EXEC` | Isolation, no rollback. Runtime errors are in the `EXEC` array; queue-time errors give `-EXECABORT`. |
| `WATCH` | `EXEC` returns a null reply if a watched key was modified (including expiry); same connection as `MULTI`. |
| `EVAL` | Lua 5.1, atomic, declare keys in `KEYS`; no rollback. `EVAL_RO` / `EVALSHA_RO` (7.0+). |
| Lua to Redis | `false` and `nil` give nil; `true` gives 1; numbers truncate (return `tostring`); tables stop at the first `nil`. |
| Redis to Lua | A nil reply becomes `false`. |
| `EVALSHA` | Script cache is volatile; handle `-NOSCRIPT` with `EVAL` or `SCRIPT LOAD`. |
| Functions (7.0+) | `FUNCTION LOAD`, `FCALL`; stored in RDB/AOF and replicated; load on every Cluster primary. |
| Long scripts | After `busy-reply-threshold` others get `-BUSY`; `SCRIPT KILL` works only before the first write, else `-UNKILLABLE` (wait or `SHUTDOWN NOSAVE`). |

## Streams, Pub/Sub, queues ([06](modules/06-messaging-pubsub-streams-and-queues.md))

| Need | Command |
| --- | --- |
| Append | `XADD key [MAXLEN \| MINID [~] n] * f v` (IDs strictly increase) |
| Create group | `XGROUP CREATE key g $ \| 0 [MKSTREAM]` |
| Read as consumer | `XREADGROUP GROUP g c COUNT n [BLOCK ms] STREAMS key >` (`>` new entries; `0` own pending) |
| Acknowledge | `XACK key g id…` (does not delete the entry) |
| Inspect | `XPENDING key g [IDLE ms] - + n`, `XINFO GROUPS key` (`lag`, `pel-count`) |
| Recover | `XAUTOCLAIM key g c min-idle start [COUNT n]` (6.2+, bumps delivery count) |
| Trim | `XTRIM key MAXLEN [~ \| =] n`; `~` removes whole nodes only |
| Pub/Sub | `PUBLISH`, `SUBSCRIBE`, `PSUBSCRIBE`; sharded `SPUBLISH`, `SSUBSCRIBE` (7.0+) |
| Reliable list queue | `BLMOVE queue processing:w RIGHT LEFT t`, then `LREM processing:w 1 job` |
| Keyspace events | `notify-keyspace-events` (default empty); at-most-once |

Pub/Sub is at-most-once with nothing stored; streams with groups and list queues with a processing list are at-least-once. `stream-node-max-entries` 100, `client-output-buffer-limit pubsub 32mb 8mb 60`.

## Coordination one-liners ([07](modules/07-coordination-rate-limits-locks-and-idempotency.md))

| Need | Pattern |
| --- | --- |
| Lock | `SET lock:r <token> NX PX ttl`; release with `DELEX lock:r IFEQ <token>` (8.4+; Valkey `DELIFEQ` 9.0) or a compare-and-delete script |
| Fencing | Increment a counter atomically with acquisition and make the storage reject lower tokens |
| Fixed-window limiter | `INCR` + `EXPIRE … NX` in `MULTI`; admits up to 2L at a boundary |
| `INCREX` (8.8+) | `INCREX k BYINT 1 UBOUND L EX W ENX` returns `[value, applied]` |
| Idempotency key | `SET idem:K "processing\|fp" NX EX 86400`, store response, reject a different fingerprint; also enforce uniqueness in the database |
| Leaderboard | `ZINCRBY`, `ZRANGE k 0 9 REV WITHSCORES`, `ZREVRANK` |
| Redlock | Majority of N, validity = ttl - elapsed - drift (ttl·0.01 + 2 ms); no fencing token |

## Query Engine, JSON, probabilistic ([08](modules/08-query-engine-json-vectors-and-probabilistic.md))

| Item | Rule |
| --- | --- |
| JSON | `JSON.SET/GET/NUMINCRBY/ARRAPPEND`; a `$` path returns an array of matches |
| `FT.CREATE` | `ON HASH\|JSON PREFIX 1 p: SCHEMA f TEXT\|TAG\|NUMERIC\|GEO\|VECTOR …`; existing keys index in the background |
| Queries | Escape TAG values; pass `DIALECT 2`; `LIMIT` defaults to 10 |
| Vectors | Little-endian FLOAT32 blobs in `PARAMS`; `COSINE` is a distance (0 identical, 2 opposite) |
| Vector sets (8.0+) | `VADD`, `VSIM … FILTER`, 8-bit quantisation by default |
| Bloom | `BF.RESERVE k err cap`; bits per element = -ln p / (ln 2)²; k = ceil(-log2 p); 1 % is 9.6 bits and 7 hashes |

## Persistence ([09](modules/09-persistence-rdb-aof-and-backup.md))

| Setting | Default / rule |
| --- | --- |
| `save` | commented default `3600 1 300 100 60 10000` (8.10.3); `BGSAVE` forks |
| `appendonly` | `no`; with `yes`, multi-part AOF directory `appendonlydir/` (7.0+) |
| `appendfsync` | `everysec`: about 1 s loss on machine crash (up to about 2 s); `always` about 0; `no` kernel-flush interval |
| `aof-use-rdb-preamble` | `yes` |
| `auto-aof-rewrite-percentage` / `-min-size` | 100 / 64mb |
| `aof-load-truncated` | `yes` (torn tail truncated) |
| `aof-timestamp-enabled` | `no` |
| `stop-writes-on-bgsave-error` | `yes` (`-MISCONF` on failed save) |
| `rdbcompression` / `rdbchecksum` | `yes` / `yes` |

Process crash with the OS alive loses nothing already written to the kernel. Restore: stop, place `dump.rdb`, remove `appendonlydir/` if `appendonly yes`, start. Kernel: THP `never`, `vm.overcommit_memory = 1`, no swap. `WAITAOF numlocal numreplicas timeout` (7.2+).

## Replication and Sentinel ([10](modules/10-replication-and-sentinel.md))

| Setting / rule | Value |
| --- | --- |
| `repl-backlog-size` | 1 MB; size at least write rate x outage seconds |
| `replica-read-only` | `yes` (`-READONLY` on writes) |
| `repl-diskless-sync` / `-delay` | `yes` / 5 s |
| `replica-serve-stale-data` | `yes` |
| `min-replicas-to-write` / `min-replicas-max-lag` | refuse writes with `-NOREPLICAS` unless enough fresh replicas |
| PSYNC | `+CONTINUE` if replid (or `replid2` up to its offset) matches and the offset is in the backlog; else `+FULLRESYNC` |
| `WAIT n t` | Replica acknowledgements; no rollback on timeout |
| Sentinel | At least 3 on separate failure domains; SDOWN (`down-after-milliseconds`), ODOWN (quorum), leader needs a majority of all Sentinels |
| Replica choice | Priority (0 excluded), then highest offset, then smallest run ID |
| Clients | Ask `SENTINEL GET-MASTER-ADDR-BY-NAME`; subscribe to `+switch-master`; check `ROLE` |

## Cluster ([11](modules/11-redis-cluster.md))

| Item | Rule |
| --- | --- |
| Slot | CRC16 (XMODEM) of the key or hash tag mod 16384; `CRC16("123456789")` = 0x31C3 |
| Hash tag | Bytes between the first `{` and the next `}` if non-empty; only the first tag counts |
| Multi-key | All keys in one slot or `-CROSSSLOT`; `SELECT` refused (database 0 only) |
| `-MOVED slot host:port` | Permanent: update the slot map |
| `-ASK slot host:port` | Mid-migration: send `ASKING` then the command; do not update the map |
| `cluster-node-timeout` | commented default 15 000 ms; `PFAIL` then `FAIL` by a majority of primaries |
| Election delay | 500 ms + random(0..500) + rank x 1000 ms; highest `configEpoch` wins |
| `cluster-require-full-coverage` | `yes`: any uncovered slot stops all queries |
| Inspect | `CLUSTER INFO`, `CLUSTER SHARDS`, `CLUSTER KEYSLOT`, `redis-cli --cluster check` |
| Migration | `SETSLOT IMPORTING/MIGRATING`, `MIGRATE`, `SETSLOT NODE`; atomic `CLUSTER MIGRATION` (8.4+) |

## Operations and observability ([12](modules/12-operations-security-observability-and-valkey.md))

| Item | Default / rule |
| --- | --- |
| `slowlog-log-slower-than` / `slowlog-max-len` | 10 000 µs / 128; execution time only |
| `latency-monitor-threshold` | 0 (off); `LATENCY LATEST`, `HISTORY`, `DOCTOR`, `HISTOGRAM` |
| `INFO` sections | `commandstats`, `latencystats`, `memory`, `persistence`, `replication`, `stats`, `keyspace` |
| ACL | `ACL SETUSER u on >pw ~prefix:* +@read -@dangerous`; left to right; `ACL DRYRUN`, `ACL LOG`, `ACL WHOAMI` |
| Exposure | `bind 127.0.0.1 -::1`, `protected-mode yes`, `enable-debug-command no`, `enable-module-command no` |
| `MONITOR` | Roughly halves throughput; never leave it on |

## Error replies

| Error | Cause | Module |
| --- | --- | --- |
| `-WRONGTYPE` | Command on a key of another type | [02](modules/02-core-data-types-encodings-and-complexity.md#1-the-type-system) |
| `-OOM` | Over `maxmemory` and nothing evictable | [03](modules/03-keys-expiry-eviction-and-memory.md#31-when-eviction-runs) |
| `-MOVED` / `-ASK` | Slot elsewhere / mid-migration | [11](modules/11-redis-cluster.md#31-the-protocol) |
| `-CROSSSLOT` | Keys in different slots | [11](modules/11-redis-cluster.md#2-hash-tags-and-multi-key-operations) |
| `-BUSY` / `-UNKILLABLE` | Script running / cannot be killed after a write | [05](modules/05-transactions-scripting-and-functions.md#5-blocking-risk-busy-scripts-and-script-kill) |
| `-NOSCRIPT` | `EVALSHA` of an uncached script | [05](modules/05-transactions-scripting-and-functions.md#33-evalsha-and-the-script-cache) |
| `-EXECABORT` | Queue-time error in a transaction | [05](modules/05-transactions-scripting-and-functions.md#11-operational-semantics) |
| `-NOPERM` | ACL denies the command or key | [12](modules/12-operations-security-observability-and-valkey.md#21-model) |
| `-NOREPLICAS` | `min-replicas-to-write` not satisfied | [10](modules/10-replication-and-sentinel.md#6-split-brain-and-min-replicas-to-write) |
| `-MISCONF` | Last background save failed | [09](modules/09-persistence-rdb-aof-and-backup.md#7-production-failure-modes) |
| `-READONLY` | Write sent to a replica | [10](modules/10-replication-and-sentinel.md#15-replica-behaviour) |
| `-WRONGPASS` | Wrong password | [12](modules/12-operations-security-observability-and-valkey.md#2-acls) |
| `-BUSYGROUP` | `XGROUP CREATE` on an existing group | [06](modules/06-messaging-pubsub-streams-and-queues.md#22-consumer-groups-and-the-pel) |
| `-NOGROUP` | `XREADGROUP` on a missing key or group | [06](modules/06-messaging-pubsub-streams-and-queues.md#22-consumer-groups-and-the-pel) |

## Redis 8.10 versus Valkey 9.1 ([12](modules/12-operations-security-observability-and-valkey.md#71-feature-matrix-redis-8103-vs-valkey-913-verified-2026-11-04))

| Area | Redis | Valkey |
| --- | --- | --- |
| Licence | RSALv2 / SSPLv1 / AGPLv3 | BSD-3-Clause |
| Compare-and-delete | `DELEX k IFEQ v` (8.4) | `DELIFEQ k v` (9.0) |
| Bounded increment | `INCREX` (8.8) | `INCREX` only in 9.2 release candidates |
| JSON, Search, Bloom | Built in | Modules in `valkey-bundle` |
| Time series, vector sets, Array | Yes | No |
| Cluster `SELECT` | No | Yes (9.0) |
| Atomic slot migration | 8.4+ | 9.0+ |
| RDB | Redis 7.4+ files not assumed loadable by Valkey | Loads Redis 7.2 and older |

## Version history ([02 § 6.5](modules/02-core-data-types-encodings-and-complexity.md#65-then-vs-now-data-type-commands-since-62))

| Version | Notable |
| --- | --- |
| 6.2 | `GETEX`, `LMOVE`, unified `ZRANGE`, `XAUTOCLAIM` |
| 7.0 | Functions, multi-part AOF, listpack, sharded Pub/Sub, ACL selectors |
| 7.2 | Listpack sets and lists, `WAITAOF` |
| 7.4 | Hash field expiration |
| 8.0 | Query Engine, JSON, time series, probabilistic types, vector sets, `HGETEX`/`HSETEX`/`HGETDEL` |
| 8.2 | `XDELEX`, `XACKDEL`, new `BITOP` operators, `CLUSTER SLOT-STATS` |
| 8.4 | `DELEX`, `DIGEST`, `MSETEX`, `CLUSTER MIGRATION`, `FT.HYBRID` |
| 8.6 | `IDMP`, LRM eviction, `HOTKEYS` |
| 8.8 | Array type, `INCREX`, `XNACK` |
| 8.10 | Compact hashes, `LMOVEM`, `SUNIONCARD` |
