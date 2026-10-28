# D-cs — CS foundations & architecture tracks (DSA, distributed systems, system design)

Research date: 2026-10-28. All versions checked against registries/official pages today unless marked "(unverified)".

## 0. Boundary contract: data-systems vs distributed-systems vs system-design (vs DSA)

Rule of thumb: **DSA = in-memory algorithms on one machine; data-systems = how one database/log works and how it is replicated/partitioned; distributed-systems = theory of correctness under partial failure (time, consensus, consistency, distributed transactions); system-design = composing off-the-shelf building blocks under requirements, numbers and SLOs.**

| Concept | Owner (full treatment) | Others only cross-link |
|---|---|---|
| Hash tables, heaps, trees, tries, graphs, Bloom filter / HyperLogLog / Count-Min math, consistent-hashing *algorithm* (ring, jump hash, rendezvous) | `algorithms/dsa` | system-design uses them as building blocks |
| B-tree vs LSM, WAL, compaction, indexes, MVCC implementation, isolation levels as implemented by Postgres/MySQL, encoding & schema evolution (Avro/Protobuf), leader/follower + multi-leader + leaderless (quorums, read repair, hinted handoff), sharding/rebalancing, CDC, batch & stream processing internals (DDIA 2e ch. 3–8, 11–12) | `architecture/data-systems` | distributed-systems links for replication lag anomalies; system-design links for "pick a DB" |
| System model (crash/omission/Byzantine, sync/partial-sync/async), FLP, CAP/PACELC as formal results, clocks (physical, Lamport, vector, HLC, TrueTime), consistency-model hierarchy (Jepsen), linearizability checking, consensus (Paxos/Raft/ZAB/VR), replicated state machines, leases & fencing, failure detectors/membership/gossip, 2PC/3PC/Percolator/Spanner/Calvin, sagas as a *correctness* problem, CRDTs, delivery semantics (at-most/at-least/effectively-once), BFT (DDIA 2e ch. 9–10; MIT 6.5840) | `architecture/distributed-systems` | data-systems links "transactions → distributed txns"; system-design links "why Raft/ZK behind your lock service" |
| Requirements → API → data model → HLD → deep dives; capacity estimation; LB/CDN/cache/rate-limiter/queue/search/blob as black boxes with knobs; canonical problems; observability, SLOs, error budgets, load shedding, backpressure (DDIA 2e ch. 1–2) | `architecture/system-design` | — |
| Kafka **operations** (broker config, KRaft, tiered storage, sizing) | a messaging/streaming track or data-systems (whoever owns Kafka) | distributed-systems teaches log abstraction + delivery semantics only; system-design treats Kafka as a black box |
| Observability tooling (OTel, Prometheus internals) | an SRE/observability track if proposed by another agent | system-design keeps SLO math + "what to measure" |

DDIA 2nd ed. chapter split (ToC from O'Reilly, https://www.oreilly.com/library/view/-/9781098119058): ch. 1–2 → system-design M1; ch. 3–8, 11–13 → data-systems; ch. 9–10 → distributed-systems; ch. 8 isolation → data-systems, ch. 8 "distributed transactions" section → distributed-systems; ch. 14 (ethics) → optional reading in system-design.

---

### Data structures & algorithms — `algorithms/dsa`

- **Current stable version(s)**
  - Texts (stable, no new editions found): CLRS *Introduction to Algorithms* 4th ed., MIT Press 2022, ISBN 9780262046305 (https://readings.com.au/product/9780262046305/). Sedgewick & Wayne *Algorithms* 4th ed. (2011) + https://algs4.cs.princeton.edu. Skiena *The Algorithm Design Manual* 3rd ed. (2020) (unverified — no 4th ed. found). Erickson *Algorithms* (free, https://jeffe.cs.illinois.edu/teaching/algorithms/).
  - **Language decision: TypeScript on Node.js, tested with `node:test` + `fast-check`.** Verified versions: Node.js 24 = LTS (Active support ended 2026-10-20, security to 2028-04-30); Node.js 26 = becoming Active LTS now (active support to 2027-10-27) (https://endoflife.date/nodejs). Recommend pinning `node = "24"` today, bump to 26 once its LTS promotion is confirmed. TypeScript 7.0.2 (native/Go compiler, published 2026-07-08; `7.1.0-beta` exists) (npm registry). fast-check 4.10.2, @fast-check/vitest 0.5.0, vitest 5.0.5, tsx 4.23.15, @types/node 26.6.5 (npm registry, 2026-10-28).
  - Rationale for TS over Python: (1) it is the user's daily language, so idioms transfer to work code; (2) Node runs `.ts` directly via type stripping (erasable syntax only — no `enum`/namespaces/parameter properties) so `node --test` needs zero build; (3) JS lacks a built-in heap, deque, sorted map, and bisect — implementing them is exactly the "master" depth this track wants; (4) typed signatures make invariants explicit. Cost: Python is the faster language *in a live coding interview* (heapq, bisect, deque, Counter, `@cache`). Mitigation: CHEATSHEET gets a "Python interview translation table" (TS idiom → Python stdlib one-liner). Python fallback stack if wanted: Python 3.14.10 / 3.15.2 (3.15 released 2026-10-09, https://endoflife.date/python), pytest 9.2.0 (2026-10-27), hypothesis 6.170.12 (2026-10-26), sortedcontainers 2.4.0 (PyPI).
- **Authoritative syllabi used**
  - MIT 6.006 → renumbered **6.1210** Introduction to Algorithms (https://toc.csail.mit.edu/node/1802); OCW Spring 2020 is the canonical public version (https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/): dynamic arrays, heaps, balanced BSTs, hashing, sorting, graph search, shortest paths, DP.
  - MIT 6.046 → **6.1220J** Design and Analysis of Algorithms (https://toc.csail.mit.edu/node/1803); OCW Spring 2015: divide & conquer, amortization, randomized, greedy/MST, network flow, LP, approximation, complexity, distributed/cache-oblivious.
  - CLRS 4e parts I–VII (incl. 4e additions: bipartite matching, online algorithms, ML clustering/gradient descent chapters, string matching rework) (chapter-level detail from memory, unverified).
  - Sedgewick algs4 (Coursera Part I/II): union-find, sorts, PQs, symbol tables, graphs, strings (tries, KMP, regex, compression).
  - Skiena ADM: war stories + "catalog of algorithmic problems" — used for problem→algorithm mapping.
  - Interview pattern taxonomy: NeetCode roadmap categories (Arrays & Hashing, Two Pointers, Sliding Window, Stack, Binary Search, Linked List, Trees, Tries, Heap/PQ, Backtracking, Graphs, Advanced Graphs, 1-D DP, 2-D DP, Greedy, Intervals, Math & Geometry, Bit Manipulation) (https://neetcode.io/roadmap — page did not render categories; list from memory, unverified); Grokking-style patterns (fast/slow pointers, merge intervals, cyclic sort, in-place reversal, top-K, k-way merge, modified binary search, subsets, topological sort, monotonic stack).
- **Proposed modules**
  1. **Models of computation & analysis** — word-RAM; asymptotics (O/Ω/Θ, little-o); recurrences (substitution, recursion tree, Master theorem, Akra–Bazzi mention); amortized analysis (aggregate, accounting, potential) via dynamic array doubling; expected vs worst vs amortized; loop invariants as correctness proofs.
  2. **Linear structures & the JS runtime** — arrays/dynamic arrays (V8 elements kinds, holey arrays), linked lists, ring-buffer deque, stack/queue, `Array.prototype.shift` O(n) trap; strings (UTF-16, `charCodeAt` vs code points), StringBuilder via arrays; bit manipulation (`>>>`, `Math.imul`, 32-bit coercion, BigInt).
  3. **Hashing** — hash functions, chaining vs open addressing (linear/robin-hood), load factor & resizing, universal hashing, hash flooding/DoS, JS `Map` semantics (SameValueZero, object identity keys, insertion order); rolling hash (Rabin–Karp); patterns: frequency counting, prefix-sum + hashmap (subarray sum = k).
  4. **Sorting & searching** — insertion/merge/quick (Lomuto vs Hoare, 3-way, introsort), heapsort, stability, lower bound Ω(n log n), counting/radix/bucket; TimSort (V8 since 7.0); quickselect & median-of-medians; binary search as invariant on a monotone predicate (lower_bound/upper_bound, search on answer).
  5. **Interview pattern catalog I (arrays)** — two pointers (opposite/same direction), sliding window (fixed/variable, why negatives break it), prefix sums/difference arrays, intervals (sort+sweep, merge, meeting rooms), cyclic sort, Kadane, monotonic stack/queue (next greater, histogram, sliding window max).
  6. **Trees & heaps** — binary trees, traversals (recursive/iterative/Morris), BST ops, balanced BSTs (AVL/red-black invariants, treaps/skip lists), B-trees (link to data-systems), binary heap + d-ary + indexed PQ, top-K / k-way merge / two-heaps median; segment tree & Fenwick tree; tries.
  7. **Graphs I** — representations; BFS/DFS (iterative to avoid stack overflow), DFS edge classification, cycle detection, topological sort (Kahn + DFS), SCC (Tarjan/Kosaraju), bipartiteness, grid graphs, multi-source BFS, 0-1 BFS.
  8. **Graphs II: shortest paths, MST, union-find** — Dijkstra (lazy vs decrease-key), Bellman–Ford/SPFA, negative cycles, Floyd–Warshall, A*, DAG shortest paths; Kruskal/Prim; disjoint-set with path compression + union by rank (inverse Ackermann).
  9. **Recursion, backtracking & divide-and-conquer** — subsets/permutations/combinations templates, pruning, N-Queens/Sudoku, meet-in-the-middle, Karatsuba/closest pair, Master theorem applications.
  10. **Dynamic programming** — optimal substructure + overlapping subproblems; top-down vs bottom-up, state design, space optimization; families: 1-D (house robber, climbing), knapsack (0/1, unbounded, subset sum), LIS (n log n), LCS/edit distance, interval DP, grid DP, tree DP, bitmask DP, digit DP (mention), DP on DAGs; reconstructing solutions.
  11. **Greedy & exchange arguments** — activity selection, Huffman, interval scheduling/partitioning, jump game, gas station; matroids (intuition); when greedy fails (coin change counterexample).
  12. **Strings** — KMP/prefix function, Z-algorithm, Rabin–Karp, tries/Aho–Corasick, suffix array (+LCP) overview, palindromes (expand-around-center, Manacher), regex/automata link.
  13. **Advanced & randomized** — network flow (Ford–Fulkerson/Edmonds–Karp, Dinic), bipartite matching, min-cut; randomized algorithms & reservoir sampling; probabilistic sketches (Bloom, Count-Min, HyperLogLog) with error bounds; LRU/LFU caches; consistent hashing variants (ring+vnodes, jump hash, rendezvous); NP-completeness, reductions, approximation.
  14. **Interview execution** — UMPIRE-style flow, complexity articulation, test-case design (empty, single, duplicates, overflow), code-review of own solution, mock sets per pattern, Python translation table.
- **Gotchas & production failure modes**
  - `[10, 9, 1].sort()` → `[1, 10, 9]`: default JS sort is lexicographic on string conversion; comparator returning a boolean (`a > b`) is silently wrong.
  - `queue.shift()` in BFS is O(n) on V8 large arrays → BFS becomes O(V²); use head-index or ring buffer.
  - Recursive DFS on a 10⁵-node path graph throws `RangeError: Maximum call stack size exceeded` (Node default stack ~10k–20k frames, depends on frame size); Python default recursion limit is 1000.
  - JS `%` is remainder, not modulo: `-1 % 5 === -1` → wrong bucket index/hash; use `((a % m) + m) % m`.
  - Numbers above 2⁵³ lose precision — rolling hashes / DP with `mod 1e9+7` overflow when multiplying two 30-bit values (≈2⁶⁰); use `BigInt` or split-multiply / `Math.imul` for 32-bit hashing.
  - Memo keys built as `i + j` or `` `${i}${j}` `` collide (1,23 vs 12,3); use `i * W + j` or a separator.
  - Python `[[0]*m]*n` aliases rows; `heapq` tuples `(prio, obj)` crash with `TypeError` on ties when `obj` is not comparable — add a counter tie-breaker.
  - Binary search: `mid = (lo + hi) >> 1` overflows for >2³¹ in 32-bit arithmetic (JS `>>` coerces to int32!) — use `lo + ((hi - lo) >>> 1)` or `Math.floor`; mixing `[lo, hi)` and `[lo, hi]` invariants causes infinite loops.
  - Dijkstra with negative edges silently returns wrong answers (no error); lazy Dijkstra must skip stale heap entries (`if (d > dist[u]) continue`).
  - Naive quicksort (first/last pivot) is O(n²) on sorted or all-equal input — adversarial inputs; also hash flooding against predictable hash functions (HashDoS).
  - Union-find without path compression *and* union by rank degrades to O(n) per op.
  - Sliding-window "shrink while sum > k" is only valid for non-negative numbers; with negatives use prefix sums + monotonic deque / hashmap.
  - `Map` with array/object keys compares by identity: `m.get([1,2])` is always `undefined`.
  - Floating-point equality in geometry/slope problems — use cross products on integers or reduced fractions (gcd) as keys.
  - String concatenation in nested loops is O(n²) in Python (and can be in JS ropes flatten) — collect parts and `join`.
  - Iterating while mutating a `Set`/`Map`/dict (Python raises `RuntimeError`; JS visits newly added entries).
- **Interview hot topics**
  - Pattern recognition: "sorted array → two pointers/binary search", "contiguous subarray → sliding window/prefix sum", "next greater → monotonic stack", "dependencies → topological sort", "connectivity online → union-find".
  - Top-K / k-th largest (heap vs quickselect trade-off).
  - LRU cache (hashmap + doubly linked list / JS `Map` insertion order trick and why it is accepted or not).
  - Graph BFS on grids (islands, rotting oranges, shortest path in binary matrix), Dijkstra variants (network delay, cheapest flights with k stops).
  - DP classics: coin change, LIS, edit distance, word break, house robber, knapsack, interval DP (burst balloons).
  - Intervals (merge, insert, meeting rooms II with heap/sweep).
  - Binary search on answer (Koko bananas, ship capacity, split array).
  - Trie (word search II, autocomplete).
  - Backtracking with pruning (combination sum, N-Queens, permutations with duplicates).
  - Complexity articulation incl. amortized and space of recursion stack.
  - Design-ish DS: rate limiter structure, median from data stream, time-based key-value store.
- **Executable-proof strategy**
  - `.mise.toml`: `node = "24"` (→ `26` after LTS promotion), optionally `python = "3.14"`. `package.json` with `"type": "module"`, devDeps `typescript@7.0.2` (typecheck only via `tsc --noEmit`, `erasableSyntaxOnly: true`), `fast-check@4.10.2`. Run `node --test examples/**/*.test.ts` (native type stripping; no tsx needed — keep tsx 4.23.15 only as fallback).
  - Every algorithm gets: (a) example-based tests incl. edge cases; (b) **property tests vs a brute-force oracle** with fast-check using a fixed `seed` and `numRuns` so runs are deterministic and failures replayable (`fc.assert(prop, { seed, path })`); (c) **negative tests** — e.g. Dijkstra on a negative edge is asserted to diverge from Bellman–Ford (documents the precondition), lexicographic default sort asserted wrong, recursive DFS asserted to throw `RangeError` on deep path while iterative passes.
  - **Complexity proofs without timing**: instrument comparators/array access counters and assert growth (e.g. comparisons ≤ c·n·log₂n for merge sort across n = 2¹⁰…2¹⁶; quicksort on sorted input asserted ≥ n²/4 comparisons). No wall-clock assertions (flaky); optional `node --test` benchmark scripts kept out of CI.
  - Invariant checkers as test helpers: `assertHeap`, `assertRedBlack`, `assertBST`, union-find rank bound, Fenwick vs prefix-sum oracle.
  - Everything is pure-CPU and fully local; nothing needs fallback.
- **Overlaps / dedupe**
  - Owns: probabilistic sketches math, consistent-hashing algorithms, B-tree *as a data structure*, LRU/LFU implementations.
  - Cross-link only: B-tree/LSM in storage engines → `architecture/data-systems`; Bloom filters in LSM read path → data-systems; rate limiter / cache eviction as system components → `architecture/system-design`; JS engine internals (V8 hidden classes, GC) → a Node.js/TypeScript runtime track if one exists.

---

### Distributed systems — `architecture/distributed-systems`

- **Current stable version(s)**
  - **DDIA 2nd edition is published**: Kleppmann & Riccomini, O'Reilly; O'Reilly lists release Feb 2026 (digital) (https://www.oreilly.com/library/view/-/9781098119058), print 31 Mar 2026, ~600 pp, ISBN 9781098119065 (https://www.readings.com.au/product/9781098119065/). New structure: 14 chapters, "Sharding" replaces "Partitioning", new ch. 1 trade-offs / ch. 2 nonfunctional requirements, ch. 13 "A Philosophy of Streaming Systems".
  - MIT **6.5840** (formerly 6.824) Spring 2026 (https://pdos.csail.mit.edu/6.824/schedule.html): labs in Go — 1 MapReduce, 2 KV server (linearizable, at-most-once over lossy net), 3A–D Raft (election, log, persistence, snapshots), 4A–C KV on Raft, 5A–D sharded KV. Lectures: MapReduce, RPC/threads, GFS, Paxos, Go patterns, Raft ×2, linearizability, ZooKeeper, distributed transactions, Spanner, chain replication, FaRM/OCC, IronFleet verification, Memcache@FB, AWS Lambda, Ray, SUNDR, Bitcoin, PBFT.
  - Tooling verified: Go 1.27.3 (1.27.0 released 2026-08-19; https://go.dev/doc/devel/release); Porcupine v1.3.1 (2026-09-21; https://pkg.go.dev/github.com/anishathalye/porcupine?tab=versions); Maelstrom 0.2.4 (bundles Jepsen 0.3.7, fixes a Knossos bug; https://github.com/jepsen-io/maelstrom/releases — year not shown, unverified); TLA+ tools: latest stable **v1.7.4** "Xenophanes", **v1.8.0 "Clarke" is still a pre-release** (dated 20 Oct, year not shown) and the **TLA+ Toolbox is no longer actively maintained** — use VS Code extension or CLI (https://github.com/tlaplus/tlaplus/releases/tag/v1.8.0). Apache Kafka latest **4.4.0 (2026-10-22)**, supported 4.3.1, 4.2.2 (https://kafka.apache.org/community/downloads/); Kafka 4.2 (2026-03-26) made **Queues for Kafka / share groups (KIP-932) GA** and KIP-1071 Streams rebalance GA (https://developer.confluent.io/newsletter/apache-kafka-42-released/). Node clients: `@confluentinc/kafka-javascript` 1.11.0; **kafkajs 2.2.4 last published 2023-02 — effectively unmaintained**. CRDT libs: yjs 13.6.33, @automerge/automerge 3.5.0 (npm). P language (p-org/P) version not verifiable (NuGet blocked by proxy) (unverified).
- **Authoritative syllabi used**
  - MIT 6.5840 Spring 2026 (above); Raft extended paper (https://raft.github.io/raft.pdf) + Ongaro thesis; Paxos Made Simple; Viewstamped Replication Revisited.
  - DDIA 2e ch. 9 "The Trouble with Distributed Systems", ch. 10 "Consistency and Consensus".
  - Jepsen consistency model map (https://jepsen.io/consistency/models): multi-object chain strict-serializable → serializable → RR / SI → MAV → cursor stability → RC → RU; single-object chain linearizable → sequential → causal → PRAM/WFR → MR/MW/RYW; availability classes: totally available (RU, RC, MAV, MR, MW, WFR), sticky available (RYW, PRAM, causal), not totally available (CS, SI, sequential and stronger).
  - Kleppmann's Cambridge "Concurrent and Distributed Systems" lecture notes (https://www.cl.cam.ac.uk/teaching/2122/ConcDisSys/) (year of current edition unverified); Fly.io Gossip Glomers (https://fly.io/dist-sys/) on Maelstrom; Herlihy & Wing linearizability; Shapiro et al. CRDTs; Adya's isolation thesis + Elle paper.
- **Proposed modules**
  1. **System models & impossibility** — fallacies of distributed computing; crash-stop/crash-recovery/omission/Byzantine; synchronous/partially synchronous/asynchronous; FLP; two generals; CAP stated precisely (Gilbert–Lynch) and PACELC; safety vs liveness.
  2. **Networks, RPC & failure detection** — RPC semantics (at-most-once, at-least-once, dedupe tables — 6.5840 Lab 2), timeouts, retries with jittered exponential backoff, idempotency keys, phi-accrual/heartbeat failure detectors, gray failures, SWIM gossip & membership.
  3. **Time & order** — physical clocks, NTP/PTP, skew/drift, monotonic vs wall clock; happens-before, Lamport clocks, vector clocks/version vectors, dotted version vectors, HLC; TrueTime & commit-wait; leases and fencing tokens.
  4. **Consistency models** — linearizability (formal: real-time order + legal sequential history), sequential, causal, session guarantees (RYW, MR, MW, WFR), eventual; transactional side (serializable, SI, strict serializable); Jepsen map & availability classes; how to *check* linearizability (WGL algorithm, Porcupine/Knossos, NP-completeness, P-compositionality).
  5. **Replication protocols** — primary-backup, chain replication (CRAQ), quorum systems (R+W>N and why it is *not* linearizable without read repair/ABD), state-machine replication; reads: leader reads, ReadIndex, lease reads, follower reads.
  6. **Consensus I: Paxos family** — single-decree Paxos proof sketch, Multi-Paxos, Flexible Paxos quorums, EPaxos (overview), ZAB/ZooKeeper (linearizable writes, FIFO client order, sync() reads).
  7. **Consensus II: Raft deep dive** — leader election (randomized timeouts, pre-vote, check-quorum), log replication, the 5 safety properties, Figure 8 commit rule, persistence requirements, snapshots/InstallSnapshot, membership changes (joint consensus vs single-server), log compaction, client interaction (sessions for exactly-once); implementation pitfalls (6.5840 students' guide).
  8. **Coordination services & primitives** — distributed locks (why Redlock is controversial), leader election via etcd/ZK leases, fencing, service discovery, barriers; etcd/ZooKeeper failure modes.
  9. **Distributed transactions** — atomic commit, 2PC (blocking, recovery, presumed abort), 3PC & why unused, Percolator (snapshot isolation over Bigtable), Spanner (Paxos groups + 2PC + TrueTime), Calvin/deterministic DBs, FaRM/OCC; sagas (orchestration vs choreography, compensations, semantic locks), transactional outbox/inbox; anomaly taxonomy G0/G1a-c/G2 (Adya) and Elle.
  10. **Logs, messaging & delivery semantics** — log as source of truth; Kafka model (partitions, ISR, high watermark, acks, idempotent producer, transactions & `read_committed`, consumer groups, KIP-848 protocol, share groups/queues GA in 4.2); at-most/at-least/effectively-once; ordering guarantees; exactly-once limits with external side effects.
  11. **Convergence without coordination: CRDTs** — strong eventual consistency; state-based (join semilattice: commutative, associative, idempotent merge) vs op-based (causal delivery) vs delta-state; G/PN-counter, LWW/MV-register, OR-set, RGA/sequence CRDTs (Yjs, Automerge); tombstones & GC; local-first.
  12. **Testing & verifying distributed systems** — deterministic simulation testing (FoundationDB, TigerBeetle VOPR https://docs.tigerbeetle.com/about/vopr), fault injection, Jepsen methodology (generators, nemeses, checkers), TLA+/PlusCal model checking (invariants vs temporal properties), P language, lightweight formal methods at AWS, IronFleet (6.5840 L15).
  13. **Byzantine & open systems** — PBFT (3f+1), Bitcoin/Nakamoto consensus, SUNDR fork consistency; when BFT is worth it.
  14. **Case studies & capstone** — GFS, MapReduce, Dynamo, Spanner, Memcache@FB, Aurora (quorum on storage), Kafka KRaft; capstone: sharded linearizable KV on own Raft (6.5840 Labs 4–5 in TS).
- **Gotchas & production failure modes**
  - Raft: replying to RequestVote/AppendEntries before fsyncing `currentTerm`, `votedFor`, `log[]` → two leaders in one term after crash-restart.
  - Raft Figure 8: leader marks an entry from a previous term committed because it is on a majority → committed entry later overwritten; only commit current-term entries by counting.
  - Serving reads from the leader's local state without ReadIndex/lease → stale reads from a deposed leader during a partition (etcd had this as a `serializable` vs `linearizable` read option; Jepsen etcd 3.4.3 findings).
  - Lease-based leadership/locks assume bounded clock drift and no process pauses; a 30 s GC/VM pause lets a "lock holder" write after expiry → need fencing tokens checked by the storage (Kleppmann on Redlock).
  - LWW conflict resolution with skewed wall clocks silently drops acknowledged writes (Cassandra/DynamoDB-style LWW); same-millisecond timestamps tie-break arbitrarily.
  - Quorum R+W>N is not linearizable: sloppy quorums/hinted handoff and concurrent read-during-write return new-then-old values.
  - "Exactly-once" in Kafka covers only Kafka→Kafka read-process-write with transactions; a consumer that writes to Postgres/HTTP then commits offsets is at-least-once → needs idempotent sink/outbox.
  - Kafka `acks=1` or `unclean.leader.election.enable=true` loses acknowledged writes on leader failover; `min.insync.replicas=1` with RF=3 does too.
  - Changing a topic's partition count remaps keys → per-key ordering broken and stateful consumers see keys move.
  - Consumer exceeding `max.poll.interval.ms` (slow handler) is evicted → rebalance storm + duplicate processing loop.
  - 2PC coordinator crash after PREPARE leaves participants holding locks indefinitely; Postgres prepared transactions also pin `xmin` → vacuum cannot clean, table bloat, eventual wraparound risk.
  - Dual write (DB commit then publish event) without outbox → lost or phantom events on crash between the two.
  - Saga compensations that are not idempotent/commutative fail on retry or arrive before the forward step (out-of-order delivery).
  - Retries without jitter/budgets at every layer → retry amplification (3 layers × 3 retries = 27×) and metastable failure that persists after the trigger is gone.
  - ZooKeeper/etcd session expiry while the client still believes it is leader (GC pause) → split brain unless fenced.
  - Vector-clock/version-vector sibling explosion with many writers (client IDs as actors) → use dotted version vectors / server actors.
  - CRDT tombstone growth (OR-set, sequence CRDTs) unbounded without causal-stability GC.
  - Snapshot isolation sold as "serializable" (Oracle SERIALIZABLE, Postgres pre-9.1) permits write skew; distributed SI (Percolator) likewise.
- **Interview hot topics**
  - CAP vs PACELC, explained with a concrete partition scenario (and why "CA" is not a choice).
  - Linearizability vs serializability vs strict serializability; session guarantees.
  - Raft: election, log matching, commit rule, why randomized timeouts, how reads are made linearizable.
  - Paxos vs Raft differences; why consensus needs 2f+1 nodes.
  - Logical clocks: Lamport vs vector vs HLC; how Spanner gets external consistency.
  - Distributed locks & fencing tokens; Redlock critique.
  - 2PC vs sagas vs outbox; idempotency keys.
  - Exactly-once delivery myth vs effectively-once processing; Kafka ordering & consumer groups.
  - Leaderless replication, quorums, read repair, anti-entropy (Merkle trees).
  - CRDTs for collaborative editing (Google Docs-style questions).
  - Failure detection & split brain; gray failure.
  - How would you test this? (Jepsen, DST, TLA+).
- **Executable-proof strategy**
  - **Primary: Raft in TypeScript inside a deterministic simulator** (`node:test`, Node 24/26, fast-check 4.10.2). Simulator = seeded PRNG (e.g. xoshiro128**), virtual clock + event queue (no `setTimeout`/`Date.now` in node code — inject `Clock` and `Network` interfaces), simulated network with drop/delay/duplicate/reorder/partition, crash-restart that discards volatile state and keeps a fake `Storage` (with optional "lost unfsynced write" fault). After every event, assert Raft invariants: Election Safety, Leader Append-Only, Log Matching, Leader Completeness, State Machine Safety. Tests sweep e.g. 500 seeds × 2 000 steps; failing seed is printed and replayable byte-for-byte. Port the 6.5840 lab test scenarios (3A–3D, 4A) as TS tests.
  - **Negative tests (bug-injection)**: flags that (a) skip persistence of `votedFor`, (b) commit previous-term entries by count (Figure 8), (c) serve leader reads without ReadIndex — each must be *caught* by the invariant checker / linearizability checker within N seeds. This proves the checkers have teeth.
  - **Linearizability checker**: implement Wing–Gong/Lowe (WGL) with memoization in TS for a KV model, plus P-compositionality per key; cross-validate on exported JSON histories with **Porcupine v1.3.1** (Go 1.27 via mise `go = "1.27"`; optional) which also renders HTML visualizations. Include known non-linearizable hand-written histories as negative fixtures.
  - **Maelstrom 0.2.4** (needs a JDK — `java = "temurin-21"` in mise; JDK version requirement unverified) for Gossip Glomers-style workloads (echo, unique-ids, broadcast, g-counter, kafka-style log, txn-rw-register) with nodes written in Node/TS over stdin/stdout JSON. Deterministic enough for CI with fixed `--time-limit` and `--rate`, though not seed-reproducible (Maelstrom uses real threads) → mark as "integration proof", not unit.
  - **TLA+**: PlusCal specs for 2PC (Lamport's TwoPhase/TCommit), a simple Raft election, and a lock-with-lease spec showing the fencing bug (TLC finds counterexample; fixed spec passes). Pin `tla2tools.jar` **v1.7.4** (latest stable) by SHA-256 in a mise task; run `java -cp tla2tools.jar tlc2.TLC -deadlock -workers 1` (single worker for deterministic output). 1.8.0 is pre-release — do not pin. P language as optional alternative (version unverified).
  - **Transactions / isolation**: Postgres via `testcontainers` 12.2.1 (Node) or PGlite (if the data-systems agent pins it) — reproduce write skew under REPEATABLE READ, show SERIALIZABLE aborts with `40001`; 2PC with `PREPARE TRANSACTION` (requires `max_prepared_transactions > 0`) and a coordinator-crash test showing a lingering prepared txn in `pg_prepared_xacts`. Small Adya-style dependency-graph cycle detector in TS (G0/G1c/G2) applied to recorded histories (Elle-lite); Elle itself is Clojure — optional.
  - **Messaging**: docker compose single-node KRaft `apache/kafka:4.4.0` (image tag unverified) + `@confluentinc/kafka-javascript` 1.11.0: tests for idempotent producer dedupe, transactional read-process-write with `isolation.level=read_committed`, rebalance-induced duplicates, partition-count change breaking key affinity; Toxiproxy (version unverified) for partitions/latency. Requires Docker/Colima on Mac; mark these as `test:integration` separate from deterministic unit tests.
  - **CRDTs**: own G-Counter/PN-Counter/OR-Set/LWW-Map implementations with fast-check properties: merge commutative, associative, idempotent; convergence after random delivery orders/duplication; compare with yjs 13.6.33 / automerge 3.5.0 behaviour on concurrent inserts.
  - **Cannot prove locally**: real clock skew/TrueTime, real WAN partitions, fsync durability on actual disks, BFT at scale → fallback: simulated faults in DST, TLA+ counterexamples, and paper-reading notes with "what would break" questions.
- **Overlaps / dedupe**
  - Belongs to `architecture/data-systems`: storage engines, single-node isolation implementation (MVCC, SSI internals), leader/follower & leaderless replication *mechanics*, sharding/rebalancing, CDC, stream-processing operators/windows. This track links those and only adds the correctness theory (anomaly definitions, linearizability, consensus).
  - Kafka operational depth → messaging/streaming track (or data-systems); here only log + delivery semantics.
  - Consistent hashing algorithm → `algorithms/dsa`; its use in sharding → data-systems.
  - Retry/backoff/circuit-breaker *patterns as components* → system-design; here the theory (amplification, metastability).
  - Go is used only as an optional runner for Porcupine/6.5840 originals; no Go teaching here.

---

### System design interviews — `architecture/system-design`

- **Current stable version(s)**
  - Books/courses (content, not software): Alex Xu, *System Design Interview Vol. 1* (2020) & *Vol. 2* (with Sahn Lam, 2022) — ByteByteGo course ToC verified (https://bytebytego.com/courses/system-design-interview/foreword): scale 0→millions, back-of-envelope, framework, rate limiter, consistent hashing, KV store, unique ID generator, URL shortener, web crawler, notification system, news feed, chat, search autocomplete, YouTube, Google Drive, proximity service, nearby friends, Google Maps, distributed message queue, metrics monitoring & alerting, ad click aggregation, hotel reservation, distributed email, S3-like object storage, gaming leaderboard, payment system, digital wallet, stock exchange. (Publication years from memory, unverified.)
  - **Hello Interview** "System Design in a Hurry" (https://hellointerview.com/learn/system-design/in-a-hurry/delivery): delivery framework — Requirements (~5 min, top 3 functional + 3–5 non-functional; skip estimation unless it changes the design) → Core entities (~2) → API (~5, default REST) → [optional] Data flow (~5) → High-level design (~10–15) → Deep dives (~10). Core concepts: networking, API design, data modeling, caching, sharding, consistent hashing, CAP, indexing, numbers to know. Key technologies: Redis, Elasticsearch, Kafka, Temporal, API gateway, Cassandra, DynamoDB, PostgreSQL, Flink, ZooKeeper. Patterns: real-time updates, contention, multi-step processes, scaling reads, scaling writes, large blobs, long-running tasks. 32 problem breakdowns (Bitly, Dropbox, Ticketmaster, WhatsApp, Uber, Top-K, ad click aggregator, Google Docs, payment system, ChatGPT, flash sale, …).
  - SRE canon: Google *SRE Book* & *SRE Workbook* (https://sre.google/books/) — SLIs/SLOs/error budgets, multiwindow multi-burn-rate alerting.
  - Tooling versions for labs: see executable proofs (Node 24/26, testcontainers 12.2.1; Redis/Valkey and Prometheus image tags unverified — pick at implementation time).
- **Authoritative syllabi used**
  - Alex Xu Vol 1/2 ToC (above); Hello Interview delivery framework + core concepts/patterns/key technologies (above); DDIA 2e ch. 1 "Trade-offs in data systems architecture" & ch. 2 "Defining nonfunctional requirements"; Google SRE Book/Workbook; AWS Builders' Library (timeouts/retries/backoff with jitter, load shedding, avoiding fallback) (https://aws.amazon.com/builders-library/); "Latency numbers every programmer should know" (Jeff Dean; values dated — use updated table, e.g. Colin Scott's interactive version, values approximate).
  - No certification covers this; AWS SA-Pro / GCP PCA are cloud-specific — cross-link to cloud tracks if they exist.
- **Proposed modules**
  1. **Framing & requirements** — functional vs non-functional (latency/availability/durability/consistency/cost), DDIA 2e reliability/scalability/maintainability, percentiles & tail latency, delivery framework timing, what interviewers grade by level (mid vs senior vs staff).
  2. **Back-of-the-envelope estimation** — powers of two, latency numbers, QPS (avg vs peak ×2–10), storage/bandwidth/egress, cache sizing (80/20), Little's law L = λW, server count from per-core throughput, cost estimates; sanity-checking orders of magnitude.
  3. **Networking & the edge** — DNS (TTL, GeoDNS), L4 vs L7 load balancing, algorithms (RR, least-conn, P2C, consistent hash), TLS termination, HTTP/1.1 vs 2 vs 3, WebSockets/SSE/long-poll, CDN (push vs pull, cache keys, `Vary`, purge/invalidation, origin shield), API gateway.
  4. **API & data modeling** — REST vs gRPC vs GraphQL, pagination (offset vs cursor), idempotency keys, versioning; choosing SQL vs document vs wide-column vs KV vs search vs blob; schema for access patterns; IDs (UUIDv7, Snowflake, ULID).
  5. **Caching** — cache-aside/read-through/write-through/write-behind, eviction (LRU/LFU/TinyLFU), TTL & jitter, stampede protection (single-flight, probabilistic early expiration, leases), hot keys, invalidation & consistency (Memcache@FB leases/delete-after-write), Redis data structures as building blocks.
  6. **Scaling reads & writes** — replicas & read-your-writes routing, sharding keys & hot partitions, denormalization/materialized views, CQRS, write batching/buffering, counters at scale (sharded counters, approximate counters).
  7. **Asynchrony: queues, streams, workflows** — queue vs log, fan-out (push vs pull/hybrid for news feed), backpressure, DLQs, poison messages, retries & idempotent consumers, outbox, workflow engines (Temporal) for multi-step processes, scheduled jobs & job schedulers.
  8. **Rate limiting & traffic management** — token bucket, leaky bucket, fixed/sliding window log/counter, GCRA; distributed limiting with Redis + Lua atomicity; load shedding, admission control, circuit breakers, bulkheads, timeouts & retry budgets.
  9. **Search, geo & specialized systems** — inverted index & Elasticsearch basics, typeahead/trie + top-K, geohash/quadtree/S2/H3 for proximity, top-K heavy hitters (Count-Min), real-time leaderboards (Redis sorted sets), blob storage & multipart/resumable upload with presigned URLs.
  10. **Contention & correctness under concurrency** — ticketing/flash sale/hotel booking: pessimistic locks, optimistic concurrency (version columns), reservation with TTL holds, distributed locks (link to distributed-systems), payments: idempotency, double-entry ledger, reconciliation, exactly-once illusions.
  11. **Reliability, observability & SLOs** — SLIs/SLOs/error budgets, burn-rate alerts, RED/USE methods, metrics vs logs vs traces (OpenTelemetry), cardinality, health checks, graceful degradation, multi-AZ/multi-region (active-passive vs active-active), RPO/RTO, backups & DR drills, deployments (canary, blue-green, feature flags).
  12. **Canonical problems I (read-heavy & content)** — URL shortener, pastebin, news feed, Instagram, YouTube/Netflix (transcoding, ABR, CDN), Dropbox/Google Drive (chunking, dedupe, sync), web crawler, search autocomplete.
  13. **Canonical problems II (real-time, geo, write-heavy)** — chat/WhatsApp, notifications, live comments, Uber/proximity/nearby friends, Google Maps, ad click aggregator, metrics monitoring, Top-K, distributed message queue, job scheduler.
  14. **Canonical problems III (transactional & staff-level)** — Ticketmaster/flash sale, hotel reservation, payment system/digital wallet, stock exchange (matching engine, sequencer), Google Docs (OT vs CRDT), rate limiter as a service, distributed cache, S3-like object storage, LLM serving (ChatGPT breakdown: streaming, GPU batching, KV cache) — plus how to run a deep dive and handle pushback.
- **Gotchas & production failure modes**
  - Cache stampede: a popular key expires and 10k concurrent misses hit the DB; fix with single-flight/request coalescing, TTL jitter, stale-while-revalidate.
  - Cache-aside race: reader misses, reads old value from DB, writer updates DB + deletes cache, reader then sets stale value → stale until TTL (Memcache@FB leases solve it).
  - CDN serving one user's personalized/authenticated page to others because `Cache-Control: private`/`Vary` missing or `Set-Cookie` responses cached.
  - Hot key / celebrity problem: one shard or Redis node saturated by a single key (viral post, flash-sale SKU); needs key splitting, local caching, or request coalescing.
  - Redis is single-threaded per command execution: `KEYS *`, big `DEL` of a 1M-element set, or long Lua scripts block all clients (use `SCAN`, `UNLINK`).
  - Per-node rate limiters behind a round-robin LB allow N× the intended limit; fixed-window limiters allow 2× bursts at window boundaries.
  - Fan-out tail latency: with 100 parallel backend calls each at 1% p99 >1 s, ~63% of requests (1 − 0.99¹⁰⁰) hit the slow path; hedged requests/timeouts needed.
  - Averaging p99s across hosts is mathematically meaningless — aggregate histograms (Prometheus buckets) instead.
  - Unbounded queues hide overload: latency grows without bound while throughput stays flat (Little's law); bound queues and shed load (LIFO under overload).
  - Retry storms across layers turn a brief blip into a metastable outage; use retry budgets, jittered backoff, and circuit breakers.
  - Deep health checks that query the DB cause the LB to eject every instance when the DB blips → full outage; separate liveness from readiness and fail open.
  - Metrics label cardinality explosion (user_id / request_id as label) OOMs Prometheus.
  - Offset pagination (`OFFSET 1000000`) scans and discards rows → use keyset/cursor pagination; also unstable under inserts.
  - Snowflake/time-based IDs break on clock moving backwards (NTP step) → duplicate IDs unless generator refuses/waits.
  - Synchronized cron/TTL expiry (everything on the hour) → thundering herd; add jitter.
  - Consistent hashing without virtual nodes gives badly skewed load; adding a node with a naive `hash % N` remaps ~all keys.
  - Geohash boundary problem: nearby points across a cell edge have different prefixes → always query neighbouring cells.
  - Payment retries without idempotency keys double-charge; timeouts from the PSP are *unknown outcome*, not failure → reconcile.
- **Interview hot topics**
  - Delivery framework and time management; driving the conversation and stating trade-offs.
  - Capacity estimation done quickly with explicit assumptions.
  - Rate limiter (algorithms + distributed implementation).
  - URL shortener / ID generation (base62, Snowflake, collisions).
  - News feed fan-out on write vs read (celebrity hybrid).
  - Chat (WebSockets, presence, delivery receipts, ordering per conversation).
  - Ticketmaster/flash sale contention (holds with TTL, queues, OCC).
  - Top-K / ad click aggregation (stream processing, windowing, Count-Min, Lambda vs Kappa).
  - Proximity/Uber (geohash/quadtree, location update write load).
  - Caching strategy & invalidation; CDN.
  - Payment system idempotency & ledger.
  - SLOs/observability: how you'd know it's broken; multi-region failover.
- **Executable-proof strategy**
  - **Capacity calculators as code**: small TS module (`estimate.ts`) with unit tests reproducing each canonical problem's numbers (QPS, storage over 5 years, bandwidth, cache size); tests assert order-of-magnitude bands, documenting assumptions in test names. Deterministic, `node --test`.
  - **Building-block micro-implementations with fake clocks** (`node:test` mock timers or injected `Clock`): token bucket, sliding-window counter, GCRA — property test (fast-check, fixed seed) that no window of length W admits > limit (and a *negative test* showing fixed-window admits 2× at the boundary); consistent hash ring with/without vnodes — assert load std-dev bound and ~K/N keys moved on node add vs `hash % N` moving ~all; single-flight cache — assert DB called once under 1 000 concurrent misses; LRU/TinyLFU hit-rate on a Zipf trace; Snowflake generator — clock-backwards test; Bloom filter FP rate within bound.
  - **Discrete-event queueing simulator** (seeded): M/M/1 and M/M/c to verify Little's law, show latency knee at ρ→1, retry amplification and metastable failure, hedged requests reducing p99, LIFO vs FIFO under overload, fan-out tail math (1 − 0.99ⁿ).
  - **Redis-backed labs** via `testcontainers` 12.2.1 with a Redis or Valkey container (tag unverified): atomic distributed rate limiter in Lua (`EVALSHA`), sorted-set leaderboard, `SET NX PX` lock *plus* negative test showing lock loss under a simulated pause without fencing. Mark as integration tests (Docker/Colima required).
  - **SLO math**: tests for error-budget and multiwindow multi-burn-rate thresholds (SRE Workbook: 14.4× over 1 h/5 min, 6× over 6 h/30 min, 1× over 3 d) (numbers from memory, unverified — confirm against https://sre.google/workbook/alerting-on-slos/). Optional: Prometheus alert rules unit-tested with `promtool test rules` in a container (version unverified).
  - **Design artifacts**: each canonical problem gets a written answer key (requirements → entities → API → HLD → deep dives) + Mermaid diagrams validated by `@mermaid-js/mermaid-cli` render in CI (version unverified) + a rubric checklist test (markdown lint that each answer contains required sections).
  - **Cannot prove locally**: real CDN behaviour, multi-region latency/failover, true scale (10⁶ QPS), managed-service limits → fallback: simulation, napkin math with cited sources, and config/plan validation in cloud tracks.
- **Overlaps / dedupe**
  - Data structures inside components (LRU, Bloom, Count-Min, trie, consistent hashing, heaps for Top-K) → `algorithms/dsa` owns implementation & proofs; here they are used and sized.
  - Database choice internals (LSM vs B-tree, replication modes, sharding schemes, isolation levels) → `architecture/data-systems`; here only the decision table.
  - Consensus, clocks, distributed locks correctness, exactly-once theory, CRDT/OT theory → `architecture/distributed-systems`.
  - Kafka/Redis/Postgres/Elasticsearch operations → their technology tracks; observability tooling internals → SRE/observability track if present; cloud-specific HA (AWS/GCP/Azure) → cloud tracks.

---

### Notes for the integrator
- Suggested shared mise baseline for these three tracks: `node = "24"` (re-pin to `26` after Node 26 LTS promotion is confirmed on https://nodejs.org/en/about/previous-releases), `go = "1.27"` (optional, Porcupine only), `java = "temurin-21"` (Maelstrom/TLA+; exact JDK requirement unverified), `python = "3.14"` (optional).
- Split each track's tests into `test` (deterministic, pure Node, runs anywhere) and `test:integration` (Docker: Postgres/Redis/Kafka/Maelstrom).
