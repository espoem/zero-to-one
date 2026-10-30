# Exam & Interview Coverage Matrix: Data Structures & Algorithms

This directory contains the certification and technical examination mapping for the `algorithms/dsa` curriculum, covering university computer science curricula (**MIT 6.1210** / **MIT 6.1220J**) and **FAANG Senior/Staff Technical Interview Loops**.

---

## 1. Primary Reference Curricula & Exam Standards

| Curricula / Examination | Authority / Institution | Verified Baseline | Exam / Guide Reference |
|---|---|---|---|
| **MIT 6.1210 (formerly 6.006)** | MIT EECS / CSAIL | Spring 2020 / Current | [MIT 6.1210 Introduction to Algorithms](https://toc.csail.mit.edu/node/1802) |
| **MIT 6.1220J (formerly 6.046)** | MIT EECS / Mathematics | Spring 2015 / Current | [MIT 6.1220J Design and Analysis of Algorithms](https://toc.csail.mit.edu/node/1803) |
| **Senior/Staff DSA Coding Loop** | Industry Standard (Google, Meta, Apple, Amazon) | 2026 Baseline | Comprehensive Algorithm Design, Verification & Complexity |

---

## 2. Comprehensive Domain Coverage Matrix

| Domain & Topic | Weight | Curriculum Modules | Executable Proofs | Status |
|---|---|---|---|---|
| **1. Models of Computation & Asymptotic Analysis**<br>Word-RAM, Master Theorem, Akra-Bazzi, Amortized Potential Method $\Phi(D) = 2S - C$, Invariants | 10% | [Module 01](../modules/01-models-of-computation-and-asymptotics.md) | `01-models-and-asymptotics.test.ts` | ✅ Full |
| **2. Linear Data Structures & Memory Layout**<br>Contiguous vectors, V8 elements kinds, Ring-buffer Deques, Doubly-linked sentinels, Word-RAM bitwise math | 8% | [Module 02](../modules/02-linear-structures-and-memory-layout.md) | `02-linear-structures-and-deque.test.ts` | ✅ Full |
| **3. Hashing, Hash Tables & Rolling Hash**<br>Separate chaining vs open addressing, Robin Hood hashing with DIB, HashDoS, Carter-Wegman universal hashing, Rabin-Karp | 8% | [Module 03](../modules/03-hashing-and-hash-tables.md) | `03-hashing-and-hash-tables.test.ts` | ✅ Full |
| **4. Sorting, Selection & Search Invariants**<br>$\Omega(n \log n)$ decision tree bound, Quicksort (Lomuto, Hoare, 3-way Dijkstra DNF), TimSort, Quickselect $O(n)$, Binary search on answer | 10% | [Module 04](../modules/04-sorting-selection-and-search-invariants.md) | `04-sorting-and-selection.test.ts` | ✅ Full |
| **5. Linear Interview Patterns & Two Pointers**<br>Two pointers, Sliding window monotonicity vs negative numbers trap, Monotonic stack/queue, Prefix sums, Kadane, Cyclic sort | 10% | [Module 05](../modules/05-interview-patterns-linear-and-pointers.md) | `05-interview-patterns-linear.test.ts` | ✅ Full |
| **6. Trees, Balanced BSTs & Priority Queues**<br>Morris in-order traversal $O(1)$ space, AVL vs Red-Black 5 invariants, Binary Heap $O(n)$ `buildHeap` proof, Two-heaps median, Fenwick tree, Tries | 10% | [Module 06](../modules/06-trees-heaps-and-priority-queues.md) | `06-trees-and-heaps.test.ts` | ✅ Full |
| **7. Graph Foundations & Traversals**<br>Adjacency representations, Stack-safe iterative BFS/DFS, DFS tree/back/forward/cross edge classification, Kahn's algorithm, Tarjan's SCC, 0-1 BFS, Bipartite coloring | 10% | [Module 07](../modules/07-graph-foundations-and-traversals.md) | `07-graph-traversals.test.ts` | ✅ Full |
| **8. Shortest Paths, MST & Disjoint-Set Union**<br>Dijkstra greedy invariant, Bellman-Ford negative cycle detection, Floyd-Warshall all-pairs, Kruskal's MST, Prim's MST, DSU with path compression + rank ($O(\alpha(n))$ bound) | 8% | [Module 08](../modules/08-shortest-paths-mst-and-disjoint-sets.md) | `08-shortest-paths-and-mst.test.ts` | ✅ Full |
| **9. Recursion, Backtracking & Divide-and-Conquer**<br>State-space tree template, N-Queens $O(1)$ bitmask pruning, Karatsuba multiplication $O(n^{1.585})$, Meet-in-the-Middle $O(2^{n/2} \cdot n)$ | 6% | [Module 09](../modules/09-recursion-backtracking-and-divide-and-conquer.md) | `09-backtracking-and-divide-conquer.test.ts` | ✅ Full |
| **10. Dynamic Programming: Foundations to Advanced Dimensions**<br>Optimal substructure, overlapping subproblems DAG, 0/1 vs unbounded knapsack, LIS via Patience Sorting $O(n \log n)$, LCS & Edit Distance, TSP Bitmask DP $O(n^2 2^n)$ | 10% | [Module 10](../modules/10-dynamic-programming-foundations-to-advanced.md) | `10-dynamic-programming.test.ts` | ✅ Full |
| **11. Greedy Algorithms & Exchange Arguments**<br>Greedy-choice property, formal exchange argument proof schema, Interval scheduling, Huffman coding proof, Jump Game, Gas Station, Matroid theory & Rado-Edmonds, Coin change counterexample | 5% | [Module 11](../modules/11-greedy-algorithms-and-exchange-arguments.md) | `11-greedy-algorithms.test.ts` | ✅ Full |
| **12. String Algorithms & Pattern Matching**<br>KMP prefix function $\pi$, Z-algorithm, Aho-Corasick multi-pattern automaton, Suffix Array & Kasai's $O(n)$ LCP, Manacher's linear $O(n)$ palindrome algorithm | 5% | [Module 12](../modules/12-string-algorithms-and-pattern-matching.md) | `12-string-pattern-matching.test.ts` | ✅ Full |
| **13. Probabilistic Data Structures, Caches & Randomization**<br>Bloom filter error derivation ($p \approx (1 - e^{-kn/m})^k$), Count-Min Sketch Markov bounds, HyperLogLog harmonic mean, $O(1)$ LRU & LFU caches, Consistent Hash Ring & Jump Consistent Hash, Reservoir sampling | 5% | [Module 13](../modules/13-probabilistic-data-structures-and-randomized-algorithms.md) | `13-probabilistic-and-caches.test.ts` | ✅ Full |
| **14. Parallel Algorithms, Concurrency & Interview Execution**<br>PRAM model, Work-Span analysis ($T_1 / T_\infty$), Brent's Theorem, Lock-free Treiber stack & MS-Queue, CAS mechanics & ABA avoidance, UMPIRE interview framework, TS $\leftrightarrow$ Python matrix | 5% | [Module 14](../modules/14-parallel-algorithms-concurrency-and-interview-execution.md) | `14-concurrency-and-interview.test.ts` | ✅ Full |

---

## 3. Question Bank Inventory

The question bank lives in [`interview.md`](./interview.md):
- **Total Questions**: 75 comprehensive questions.
- **Difficulty Distribution**:
  - Difficulty 1 (Foundational / Core): 25 questions.
  - Difficulty 2 (Intermediate / Advanced Application): 35 questions.
  - Difficulty 3 (Staff / Mathematical Rigor / Expert Boundary): 15 questions.
- **Timed Mock Examination**:
  - 1 full 90-minute mock examination simulating a Staff-level DSA technical interview loop (4 progressive scenario-based coding and architectural problems) with complete rubrics and scoring key.
