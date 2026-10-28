# Brief: DSA (`algorithms/dsa`)

| | |
|---|---|
| Phase | 2 |
| Kind | NEW track: create from scratch |
| Primary (author) | **Opus · claude.ai** |
| Drafter (on request) | pi · DeepSeek |
| Challenger | pi · Muse Spark 1.3 |
| Verifier | Antigravity |
| Final gate | Opus (claude.ai session) |
| Branch / worktree | `track/dsa` · `../zto-dsa` |
| Depends on | phase 1 foundations |
| Research dossier | `.agents/research/D-cs.md` |

## 0. Read before starting (binding)
1. `AGENTS.md`: the contract. If it conflicts with this brief, AGENTS.md wins; log the conflict in your review file.
2. `.agents/OWNERSHIP.md`: what you own vs only cross-link.
3. `.agents/REVIEW.md`: the checklist your work is judged against.
4. Your global/agent instructions still apply where they do not conflict.

## 1. Owner decisions and track-specific instructions
- **Code languages (decision D4):** every algorithm has CLRS-style pseudocode with invariants + TypeScript (`node --test`, fast-check). Add Python, Rust or Nim only where it teaches something (see AGENTS.md § Code Example Languages). Pin python/uv, rust and nim via mise.
- Course numbers changed: MIT 6.006 → 6.1210, 6.046 → 6.1220.
- Open ownership question: add a language-neutral "Concurrency & parallel algorithms" module here (see OWNERSHIP.md). Propose its outline in your review file.
- Teach the **latest stable** versions. Add **Then vs now** comparisons wherever practice changed (AGENTS.md § Version Currency).
- Pin **all** tooling via mise (`.mise.toml` + `mise.lock`): node 26 for JS/TS, plus every CLI and runtime the examples need.

## 2. Ownership
**You own (full treatment):**
- Asymptotic analysis, linear/tree/graph structures, sorting, DP, greedy, amortisation
- Heaps, tries, LRU/LFU implementations, B-tree *as a data structure*
- Bloom / HyperLogLog / Count-Min math
- Consistent hashing algorithms (ring, jump, rendezvous)
- Concurrency models, locks, data races, lock-free structures (language-neutral)

**Cross-link only (do not re-explain):**
- V8 shapes/ICs at the "why is my code slow" level → owned by `languages/javascript`
- Python data model, typing, asyncio, CPython internals, packaging (uv) → owned by `languages/python`

## 3. Research dossier (verified 2026-10-27/28; re-verify before use)

#### Data structures & algorithms — `algorithms/dsa`

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

#### Context from `D-cs.md`

##### 0. Boundary contract: data-systems vs distributed-systems vs system-design (vs DSA)

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

## 4. Re-verify list
These claims were marked unverified during research. Confirm or correct each one against a primary source before teaching it:
- Texts (stable, no new editions found): CLRS *Introduction to Algorithms* 4th ed., MIT Press 2022, ISBN 9780262046305 (https://readings.com.au/product/9780262046305/). Sedgewick & Wayne *Algorithms* 4th ed. (2011) + https://algs4.cs.princeton.edu. Skiena *The Algorithm Design Manual* 3rd ed. (2020) (unverified — no 4th ed. found). Erickson *Algorithms* (free, https://jeffe.cs.illinois.edu/teaching/algorithms/).
- CLRS 4e parts I–VII (incl. 4e additions: bipartite matching, online algorithms, ML clustering/gradient descent chapters, string matching rework) (chapter-level detail from memory, unverified).
- Interview pattern taxonomy: NeetCode roadmap categories (Arrays & Hashing, Two Pointers, Sliding Window, Stack, Binary Search, Linked List, Trees, Tries, Heap/PQ, Backtracking, Graphs, Advanced Graphs, 1-D DP, 2-D DP, Greedy, Intervals, Math & Geometry, Bit Manipulation) (https://neetcode.io/roadmap — page did not render categories; list from memory, unverified); Grokking-style patterns (fast/slow pointers, merge intervals, cyclic sort, in-place reversal, top-K, k-way merge, modified binary search, subsets, topological sort, monotonic stack).

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
1. **Primary (Opus)** works on branch `track/dsa` and sets this track's row in `.agents/STATUS.md` to 🟦.
2. **Verify versions first.** Check every version in the dossier against its primary source today. Record the results in the README's `Verified against …` line. Resolve every item in the re-verify list below.
3. Build in stages: README syllabus + exam matrix → modules one by one, each with its examples/tests → glossary → cheatsheet → question banks → mock exam. Delegate bulk drafting (question-bank drafts, glossary candidates, cheatsheet tables) to the **Drafter**, then correct and integrate it yourself.
4. Before each commit: run `mise exec -- npm test` and `npm run typecheck` (or the equivalents), and `test:integration` if present. Commit with Conventional Commits scoped `(dsa)`.
5. Self-check against `.agents/REVIEW.md`. Then set STATUS to 🟨 and write the hand-off at the top of `.agents/reviews/dsa.md`:
   - what was done;
   - what was not done, and why;
   - every claim you are least sure of.
6. The **Challenger** attacks it and the **Verifier** checks it independently. Both record findings in `.agents/reviews/dsa.md` (prompts in `.agents/KICKOFF.md`). The primary resolves the findings (🟧), Opus runs the final gate (🟪), and the owner merges (✅).
