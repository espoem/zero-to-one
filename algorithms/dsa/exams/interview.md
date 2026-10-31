# Data Structures & Algorithms Question Bank & Mock Examination

This bank contains 75 rigorous questions covering algorithmic theory, runtime mechanics, invariant proofs, and senior/staff-level problem solving, aligned with **MIT 6.1210**, **MIT 6.1220J**, and **FAANG Senior/Staff Technical Interview Loops**.

---

## Part 1: Domain Question Banks (Questions 1–75)

### Domain 1: Models of Computation & Asymptotic Analysis

#### Q-DSA-001 · Models of Computation · difficulty 1 · single
In the Word-RAM model of computation with word size $w$ bits, what is the required relationship between $w$ and input size $n$ for array indexing to execute in $O(1)$ time?
- A) $w = \Theta(1)$
- B) $w \ge \log_2 n$
- C) $w \le \sqrt{n}$
- D) $w = \Theta(n)$
<details><summary>Answer</summary>

**B.** In the Word-RAM model, addressing any of the $n$ distinct memory cells requires a pointer containing at least $\log_2 n$ bits. If $w < \log_2 n$, the machine cannot address its own input in a single word operation.
- Why not A: A constant word size restricts addressable memory to $2^c$ cells, violating arbitrary input sizing.
- Why not C: $\sqrt{n}$ is unnecessarily large; only logarithmic bits are needed.
- Why not D: A word size of $n$ bits would allow $O(1)$ exponential operations, violating physical realism.
- Ref: [modules/01-models-of-computation-and-asymptotics.md](../modules/01-models-of-computation-and-asymptotics.md), MIT 6.1210 Lecture 1
</details>

#### Q-DSA-002 · Asymptotic Analysis · difficulty 2 · single
Given the recurrence $T(n) = 3T(n/4) + n \log n$, what is the asymptotic bound via the Master Theorem?
- A) $\Theta(n^{\log_4 3})$
- B) $\Theta(n \log n)$
- C) $\Theta(n^2)$
- D) $\Theta(\sqrt{n})$
<details><summary>Answer</summary>

**B.** We compare $f(n) = n \log n$ with $n^{\log_b a} = n^{\log_4 3} \approx n^{0.792}$. Since $f(n) = \Omega(n^{\log_4 3 + \epsilon})$ for $\epsilon \approx 0.2$, and the regularity condition $3(n/4 \log(n/4)) \le c n \log n$ holds for $c = 3/4 < 1$, Master Theorem Case 3 applies. Thus $T(n) = \Theta(n \log n)$.
- Why not A: Case 1 applies only when the subproblem work dominates, which is not true here ($0.792 < 1$).
- Why not C: $n^2$ strictly overestimates the linearithmic driving function.
- Why not D: $\sqrt{n} = n^{0.5}$, which is strictly smaller than the subproblem bound.
- Ref: [modules/01-models-of-computation-and-asymptotics.md](../modules/01-models-of-computation-and-asymptotics.md), CLRS 4e Chapter 4
</details>

#### Q-DSA-003 · Amortized Analysis · difficulty 2 · scenario
In the Potential Method of amortized analysis, potential function $\Phi$ is defined as $\Phi(D) = 2S - C$, where $S$ is the number of elements and $C$ is the allocated capacity of a dynamic array. Initially $S = 0, C = 0$. When the array is full ($S = C$) and an element is inserted, capacity doubles to $2C$. What is the amortized cost $\hat{c}_i = c_i + \Phi(D_i) - \Phi(D_{i-1})$ of this doubling insertion?
- A) $\hat{c}_i = 1$
- B) $\hat{c}_i = 3$
- C) $\hat{c}_i = C$
- D) $\hat{c}_i = 2C$
<details><summary>Answer</summary>

**B.** Before insertion, $S_{i-1} = C_{i-1}$, so $\Phi(D_{i-1}) = 2C_{i-1} - C_{i-1} = C_{i-1}$. Upon inserting the new element with doubling: actual cost $c_i = C_{i-1} + 1$ (copying $C_{i-1}$ elements plus 1 insertion). The new state has $S_i = C_{i-1} + 1$ and new capacity $C_i = 2C_{i-1}$. Thus $\Phi(D_i) = 2(C_{i-1} + 1) - 2C_{i-1} = 2$.
Amortized cost: $\hat{c}_i = (C_{i-1} + 1) + 2 - C_{i-1} = 3$.
- Why not A: Actual insertion plus future copy prepayment requires 3 amortized credits.
- Why not C or D: Unamortized actual cost is $O(C)$, but amortized cost is $O(1)$.
- Ref: [modules/01-models-of-computation-and-asymptotics.md](../modules/01-models-of-computation-and-asymptotics.md), CLRS 4e Chapter 17
</details>

#### Q-DSA-004 · Invariant Verification · difficulty 2 · multi
Which of the following conditions MUST hold for a binary search lower_bound invariant `[lo, hi)` over array $A$ and target $x$? (Select all that apply)
- A) All elements $A[k]$ for $k < lo$ are strictly $< x$.
- B) All elements $A[k]$ for $k \ge hi$ are $\ge x$.
- C) When $lo == hi$, $lo$ is the index of the first element $\ge x$ (or $A.\text{length}$ if none exists).
- D) Midpoint must be calculated as $(lo + hi) / 2$ using 32-bit signed addition.
<details><summary>Answer</summary>

**A, B, C.** A, B, and C formally define the loop invariant of half-open binary search `[lo, hi)`.
- Why not D: Calculating midpoint as $(lo + hi) / 2$ in 32-bit signed arithmetic causes integer overflow when $lo + hi > 2^{31} - 1$. The correct formulation is $lo + ((hi - lo) >>> 1)$.
- Ref: [modules/01-models-of-computation-and-asymptotics.md](../modules/01-models-of-computation-and-asymptotics.md)
</details>

#### Q-DSA-005 · Amortized Bounds · difficulty 3 · single
If an array dynamically expands by a constant additive term $k$ (e.g. adding 100 slots whenever full) instead of multiplying by a factor $\alpha > 1$, what is the amortized cost per insertion over $N$ insertions?
- A) $O(1)$
- B) $O(\log N)$
- C) $O(N)$
- D) $O(N^2)$
<details><summary>Answer</summary>

**C.** When expanding by constant $k$, the array resizes $N / k$ times. The total number of elements copied is $\sum_{i=1}^{N/k} i \cdot k = k \frac{(N/k)(N/k + 1)}{2} = \Theta(N^2 / k)$. Dividing by $N$ insertions yields an amortized cost of $\Theta(N)$ per operation.
- Why not A: Additive resizing fails to achieve $O(1)$ amortized time.
- Why not B: Logarithmic amortized time occurs in tree structures, not linear additive reallocation.
- Why not D: Total work is $O(N^2)$, so the per-operation amortized cost is $O(N)$.
- Ref: [modules/01-models-of-computation-and-asymptotics.md](../modules/01-models-of-computation-and-asymptotics.md)
</details>

---

### Domain 2: Linear Data Structures & Memory Layout

#### Q-DSA-006 · JavaScript Runtime · difficulty 1 · single
Why does `array.shift()` on a standard JavaScript Array in Node.js/V8 exhibit $O(n)$ time complexity?
- A) V8 arrays are linked lists requiring pointer dereferences from the tail.
- B) V8 arrays are backed by contiguous memory vectors requiring all $n - 1$ subsequent elements to shift left by one memory word.
- C) V8 triggers garbage collection on every shift operation.
- D) JavaScript engines sort arrays after every removal.
<details><summary>Answer</summary>

**B.** JavaScript engines represent standard dense arrays as contiguous flat memory vectors. Removing the element at index 0 requires copying the remaining $n - 1$ elements to adjacent lower memory offsets ($O(n)$ time).
- Why not A: V8 arrays are flat vectors, not linked lists.
- Why not C: GC runs periodically when heap thresholds are crossed, not deterministically on every shift.
- Why not D: Arrays are never sorted automatically upon deletion.
- Ref: [modules/02-linear-structures-and-memory-layout.md](../modules/02-linear-structures-and-memory-layout.md)
</details>

#### Q-DSA-007 · Ring Buffer Mechanics · difficulty 2 · single
In a circular ring-buffer Deque of capacity $C = 2^k$, what is the bitwise formula to advance the pointer `head` forward by 1 index with $O(1)$ wrap-around?
- A) `head = (head + 1) % C`
- B) `head = (head + 1) & (C - 1)`
- C) `head = (head + 1) | (C - 1)`
- D) `head = (head + 1) ^ C`
<details><summary>Answer</summary>

**B.** When $C$ is a power of 2 ($2^k$), the bitmask $C - 1$ consists of $k$ ones. Performing bitwise AND `(head + 1) & (C - 1)` evaluates in a single CPU cycle, completely avoiding division/remainder instructions and signed negative modulo anomalies.
- Why not A: While mathematically equivalent for non-negatives, modulo `%` is significantly slower than bitwise AND.
- Why not C: Bitwise OR sets bits rather than restricting the range to $[0, C-1]$.
- Why not D: Bitwise XOR does not produce circular modular indexing.
- Ref: [modules/02-linear-structures-and-memory-layout.md](../modules/02-linear-structures-and-memory-layout.md)
</details>

#### Q-DSA-008 · Bitwise Math · difficulty 2 · single
What is the mathematical effect of the expression `x & (-x)` in two's complement integer arithmetic?
- A) Clears the lowest set bit of `x`.
- B) Isolates the lowest set bit of `x` (lowest power of 2 dividing `x`).
- C) Computes the population count of `x`.
- D) Inverts all bits of `x`.
<details><summary>Answer</summary>

**B.** In two's complement arithmetic, $-x = \sim x + 1$. Bitwise ANDing $x$ with its two's complement $-x$ zeroes all bits except the least significant 1-bit, isolating it. This is the foundation of Fenwick tree index updates.
- Why not A: Clearing the lowest set bit is `x & (x - 1)`.
- Why not C: Population count requires Kernighan's loop or a hardware `POPCNT` instruction.
- Why not D: Inverting all bits is `~x`.
- Ref: [modules/02-linear-structures-and-memory-layout.md](../modules/02-linear-structures-and-memory-layout.md)
</details>

#### Q-DSA-009 · Linked List Design · difficulty 2 · single
What primary architectural advantage does a Doubly Linked List with dummy Sentinel `head` and `tail` nodes provide?
- A) Reduces memory usage by eliminating node pointers.
- B) Eliminates edge-case null-pointer checks during head insertions, tail insertions, and deletions.
- C) Guarantees cache locality identical to contiguous arrays.
- D) Enables $O(1)$ random access by index.
<details><summary>Answer</summary>

**B.** Sentinel nodes ensure that every valid data node always has a non-null `prev` and `next` neighbor. This unifies boundary operations (inserting at head, deleting the last element) into identical 4-pointer mutations with zero conditional branches.
- Why not A: Sentinels add two dummy node allocations.
- Why not C: Nodes remain independently heap-allocated and fragmented across memory.
- Why not D: Traversing to index $k$ still requires $O(k)$ pointer chasing.
- Ref: [modules/02-linear-structures-and-memory-layout.md](../modules/02-linear-structures-and-memory-layout.md)
</details>

#### Q-DSA-010 · Bitwise Operations · difficulty 3 · scenario
In JavaScript, why does executing `x = (x & (x - 1))` on a 32-bit unsigned integer `x = 0xffffffff` produce a signed negative number `-2` if not explicitly coerced with `>>> 0`?
- A) V8 limits integers to 16 bits.
- B) In ECMAScript, all bitwise operations convert operands to signed 32-bit two's complement integers (`ToInt32`).
- C) Bitwise AND converts numbers to 64-bit IEEE-754 floats.
- D) `0xffffffff` is a reserved symbol in ECMAScript.
<details><summary>Answer</summary>

**B.** Per the ECMAScript specification, bitwise operators (`&`, `|`, `^`, `<<`, `>>`) implicitly evaluate their arguments via `ToInt32()`. The 32-bit pattern `0xffffffff` evaluates to signed `-1`. Subtracting 1 gives `-2`. To treat the result as an unsigned 32-bit integer, it must be coerced via zero-fill right shift `>>> 0`.
- Why not A: V8 supports 32-bit integers (Smis) and 64-bit BigInts.
- Why not C: Bitwise operators coerce *from* floats *to* 32-bit integers, not the reverse.
- Why not D: It is a valid numeric literal ($2^{32} - 1$).
- Ref: [modules/02-linear-structures-and-memory-layout.md](../modules/02-linear-structures-and-memory-layout.md)
</details>

---

### Domain 3: Hashing, Hash Tables & Rolling Hash

#### Q-DSA-011 · Hash Table Collisions · difficulty 1 · single
What is the primary difference between Separate Chaining and Open Addressing in hash table collision resolution?
- A) Chaining uses secondary arrays; Open Addressing uses binary trees.
- B) Chaining stores colliding elements outside the primary table (e.g. linked lists); Open Addressing stores all elements within the primary table array.
- C) Open Addressing allows load factors $\alpha > 1$; Chaining requires $\alpha < 0.5$.
- D) Chaining requires cryptographic hashes; Open Addressing does not.
<details><summary>Answer</summary>

**B.** In Separate Chaining, each bucket points to an external auxiliary container (such as a linked list or small tree). In Open Addressing, all keys reside directly inside the table array, using probe sequences (linear, quadratic, double hashing) to find empty slots.
- Why not A: Open addressing does not use binary trees; it probes contiguous table slots.
- Why not C: Open addressing strictly requires $\alpha < 1$ because table capacity cannot be exceeded. Chaining supports $\alpha > 1$.
- Why not D: Neither requires cryptographic hash functions.
- Ref: [modules/03-hashing-and-hash-tables.md](../modules/03-hashing-and-hash-tables.md)
</details>

#### Q-DSA-012 · Robin Hood Hashing · difficulty 2 · single
What invariant does Robin Hood Hashing maintain during open addressing insertion?
- A) Keys with higher hash values are always placed at lower indices.
- B) If the incoming key has a larger Distance from Initial Bucket (DIB) than the occupant, the incoming key takes the slot and the occupant is displaced.
- C) All collisions are resolved by rehashing into a secondary table.
- D) Items are deleted by zeroing the entire table.
<details><summary>Answer</summary>

**B.** Robin Hood hashing "takes from the rich and gives to the poor": if a probe finds an existing occupant whose DIB is strictly less than the current key's DIB, the existing occupant is swapped out, and the displaced occupant continues probing. This dramatically reduces probe sequence variance.
- Why not A: Sorting by hash values is not maintained in open addressing.
- Why not C: That describes Cuckoo hashing, not Robin Hood hashing.
- Why not D: Deletion uses tombstones or backward-shift deletion, not full zeroing.
- Ref: [modules/03-hashing-and-hash-tables.md](../modules/03-hashing-and-hash-tables.md)
</details>

#### Q-DSA-013 · HashDoS Vulnerability · difficulty 2 · single
How does an adversary execute a Hash Flooding Denial of Service (HashDoS) attack against a web application?
- A) By overflowing the TCP receive window with SYN packets.
- B) By crafting thousands of distinct request keys that evaluate to the identical hash bucket under a deterministic, non-randomized hash function.
- C) By sending malformed UTF-8 characters that crash the V8 parser.
- D) By repeatedly opening and closing WebSocket handshakes.
<details><summary>Answer</summary>

**B.** When an application uses a deterministic hash function (e.g. DJB2 without random seeding), an attacker can precompute thousands of colliding keys. Submitting them in a POST request forces hash table lookup and insertion from $O(1)$ average time into quadratic $O(n^2)$ worst-case time, starving CPU cores.
- Why not A: That is a SYN flood attack on networking transport layers.
- Why not C: Malformed UTF-8 is handled safely by string decoders.
- Why not D: WebSocket churn is an application resource exhaustion attack, not algorithmic HashDoS.
- Ref: [modules/03-hashing-and-hash-tables.md](../modules/03-hashing-and-hash-tables.md)
</details>

#### Q-DSA-014 · Rolling Hash Mechanics · difficulty 2 · single
In the Rabin-Karp rolling hash algorithm for base $B$ and prime modulus $M$, when sliding a window of length $m$ forward from $S[i \dots i+m-1]$ to $S[i+1 \dots i+m]$, what is the formula to compute the new hash $H_{i+1}$ from $H_i$ in $O(1)$ time?
- A) $H_{i+1} = (H_i \cdot B + S[i+m]) \pmod M$
- B) $H_{i+1} = ((H_i - S[i] \cdot B^{m-1}) \cdot B + S[i+m]) \pmod M$
- C) $H_{i+1} = (H_i + S[i+m] - S[i]) \pmod M$
- D) $H_{i+1} = (H_i \oplus S[i]) \cdot B \pmod M$
<details><summary>Answer</summary>

**B.** To slide the window: (1) subtract the outgoing leading character scaled by $B^{m-1}$, (2) multiply the entire remaining polynomial by $B$ (shifting left by 1 position), and (3) add the new incoming character $S[i+m]$, all modulo $M$.
- Why not A: Fails to subtract the outgoing character $S[i]$.
- Why not C: Treats all characters with equal positional weight, causing extreme collision rates across anagrams.
- Why not D: Bitwise XOR cannot represent polynomial rolling base positions.
- Ref: [modules/03-hashing-and-hash-tables.md](../modules/03-hashing-and-hash-tables.md)
</details>

#### Q-DSA-015 · ECMAScript Map Semantics · difficulty 2 · single
What equality algorithm does JavaScript `Map.prototype.get(key)` use to compare keys?
- A) Strict Equality (`===`)
- B) Abstract Equality (`==`)
- C) SameValueZero
- D) SameValue (`Object.is`)
<details><summary>Answer</summary>

**C.** ECMAScript `Map` and `Set` use the `SameValueZero` comparison. This behaves identically to `===` except that `NaN` is considered equal to `NaN`, and `+0` is considered equal to `-0`.
- Why not A: Under `===`, `NaN === NaN` is `false`, which would make `NaN` keys un-retrievable in a Map.
- Why not B: Abstract equality performs implicit type coercion, which `Map` never does.
- Why not D: `SameValue` (`Object.is`) distinguishes `+0` and `-0`, whereas `Map` treats `+0` and `-0` as the identical key.
- Ref: [modules/03-hashing-and-hash-tables.md](../modules/03-hashing-and-hash-tables.md)
</details>

---

### Domain 4: Sorting, Selection & Search Invariants

#### Q-DSA-016 · Comparison Sort Lower Bound · difficulty 1 · single
What is the theoretical worst-case lower bound for any comparison-based sorting algorithm on $n$ elements, and what mathematical structure proves it?
- A) $\Omega(n)$, proven by Pigeonhole Principle.
- B) $\Omega(n \log n)$, proven by the height of a Binary Decision Tree with $n!$ leaves.
- C) $\Omega(n^2)$, proven by pairwise inversion counts.
- D) $\Omega(2^n)$, proven by Master Theorem.
<details><summary>Answer</summary>

**B.** A comparison sort can be modeled as a binary decision tree where every comparison has two branches. To distinguish among all $n!$ possible permutations of $n$ elements, the tree must contain at least $n!$ leaves. A binary tree of height $h$ has at most $2^h$ leaves. Therefore, $2^h \ge n! \implies h \ge \log_2(n!) = \Omega(n \log n)$ by Stirling's approximation.
- Why not A: $\Omega(n)$ is achievable only with non-comparison algorithms (counting/radix sort).
- Why not C: Comparison sorts like Merge Sort achieve $O(n \log n)$, disproving $\Omega(n^2)$ as a lower bound.
- Why not D: $2^n$ is an exponential upper bound for brute-force permutations, not a lower bound for comparison sorting.
- Ref: [modules/04-sorting-selection-and-search-invariants.md](../modules/04-sorting-selection-and-search-invariants.md)
</details>

#### Q-DSA-017 · Quicksort Partitioning · difficulty 2 · single
Why does Dijkstra's 3-Way Partitioning (Dutch National Flag) outperform standard Lomuto or Hoare partitioning on arrays with many duplicate elements?
- A) It eliminates the recursion stack completely.
- B) It groups elements equal to the pivot into a middle segment that is never partitioned again, reducing running time on identical elements to $O(n)$.
- C) It converts Quicksort into an in-place Merge Sort.
- D) It sorts strings in lexicographical order.
<details><summary>Answer</summary>

**B.** Standard Lomuto and Hoare partitions degrade to $O(n^2)$ when all elements are equal because pivots fail to divide the array evenly. Dijkstra's 3-way partition splits the array into three segments: $< \text{pivot}$, $= \text{pivot}$, and $> \text{pivot}$. Because the $= \text{pivot}$ segment is in its final sorted position, it is excluded from future recursive calls, processing an array of all duplicates in linear $O(n)$ time.
- Why not A: Recursion is still required for the $< \text{pivot}$ and $> \text{pivot}$ subproblems.
- Why not C: It remains an in-place partition, not merge sort.
- Why not D: It operates on any comparable type, not just strings.
- Ref: [modules/04-sorting-selection-and-search-invariants.md](../modules/04-sorting-selection-and-search-invariants.md)
</details>

#### Q-DSA-018 · Quickselect Complexity · difficulty 2 · single
What is the average time complexity and worst-case time complexity of Quickselect (Hoare's Selection Algorithm) to find the $k$-th smallest element?
- A) Average: $O(n \log n)$, Worst-case: $O(n^2)$
- B) Average: $O(n)$, Worst-case: $O(n^2)$
- C) Average: $O(n)$, Worst-case: $O(n \log n)$
- D) Average: $O(1)$, Worst-case: $O(n)$
<details><summary>Answer</summary>

**B.** Quickselect discards one partition side at each step: $T(n) = T(n/2) + O(n) = O(n)$ on average (geometric series $n + n/2 + n/4 + \dots = 2n$). In the worst case (e.g. sorted array with first element chosen as pivot), it discards only 1 element per step: $T(n) = T(n-1) + O(n) = O(n^2)$.
- Why not A: Quickselect recurses on only one partition branch, avoiding the $O(n \log n)$ sorting cost.
- Why not C: Worst-case is quadratic, not linearithmic (unless Median-of-Medians BFPRT is used).
- Why not D: Scanning an array requires at least $O(n)$ work.
- Ref: [modules/04-sorting-selection-and-search-invariants.md](../modules/04-sorting-selection-and-search-invariants.md)
</details>

#### Q-DSA-019 · Binary Search on Answer · difficulty 2 · single
When applying "Binary Search on Answer" to an optimization problem, what mathematical property MUST the feasibility function $f(\text{candidate})$ exhibit?
- A) Differentiability
- B) Monotonicity over the search domain (e.g. `false, false, ..., true, true`)
- C) Periodicity
- D) Uniform distribution
<details><summary>Answer</summary>

**B.** Binary search operates on a monotone predicate where all inputs $\le x^*$ evaluate to `false` (or `true`) and all inputs $> x^*$ evaluate to `true` (or `false`). This single step-change boundary guarantees that comparing at midpoint allows discarding half of the remaining search space.
- Why not A: Discrete integer domains are non-differentiable.
- Why not C: Periodic functions have multiple roots, breaking the binary halving invariant.
- Why not D: Distribution does not matter; only the monotonicity of the feasibility test matters.
- Ref: [modules/04-sorting-selection-and-search-invariants.md](../modules/04-sorting-selection-and-search-invariants.md)
</details>

#### Q-DSA-020 · TimSort Mechanics · difficulty 3 · single
What architectural technique does TimSort (used by Python and V8's `Array.prototype.sort`) use to achieve $O(n)$ running time on partially sorted real-world data?
- A) Identifies natural ascending and strictly descending runs, extends short runs with insertion sort to a minimum run length (`minrun`), and merges runs using a balanced stack.
- B) Converts data into a B-tree in memory.
- C) Samples 10% of elements with reservoir sampling and builds a Radix tree.
- D) Uses Bitonic sorting networks on SIMD registers.
<details><summary>Answer</summary>

**A.** TimSort scans for contiguous natural runs (reversing strictly descending runs in $O(n)$ time). If a run is shorter than `minrun` (typically 32–64), it extends it using Binary Insertion Sort. It then uses a stack with invariant constraints ($A > B + C$ and $B > C$) to merge runs efficiently in $O(n \log n)$ worst case and $O(n)$ best case.
- Why not B: TimSort is an in-place merge sort derivative, not a B-tree.
- Why not C: Radix sort requires digit representations; TimSort is a general comparison sort.
- Why not D: Bitonic networks are specialized hardware sorters, not TimSort's software architecture.
- Ref: [modules/04-sorting-selection-and-search-invariants.md](../modules/04-sorting-selection-and-search-invariants.md)
</details>

---

### Domain 5: Linear Interview Patterns & Two Pointers

#### Q-DSA-021 · Sliding Window Preconditions · difficulty 2 · single
Why does the variable-size sliding window pattern ("expand right, shrink left while condition violated") fail to find the longest subarray summing to $k$ when the array contains negative numbers?
- A) Negative numbers cause integer underflow in CPU registers.
- B) Expanding the window no longer guarantees monotonic growth of the window sum, so shrinking the left pointer cannot guarantee that a larger sum won't appear later.
- C) JavaScript arrays cannot store negative numbers.
- D) Monotonic queues require strictly positive integers.
<details><summary>Answer</summary>

**B.** The sliding window technique relies fundamentally on monotonicity: if all numbers are non-negative, expanding the right pointer strictly increases the sum and advancing the left pointer strictly decreases the sum. With negative numbers, adding elements can decrease the sum and removing elements can increase the sum, breaking the monotone boundary. The problem must instead be solved using Prefix Sums with a Hash Map in $O(n)$ time.
- Why not A: Numbers are standard 64-bit floats or 32-bit integers; negative values do not trigger underflow.
- Why not C: JavaScript arrays handle signed floats and integers natively.
- Why not D: Monotonic queues can store negative numbers without issue.
- Ref: [modules/05-interview-patterns-linear-and-pointers.md](../modules/05-interview-patterns-linear-and-pointers.md)
</details>

#### Q-DSA-022 · Cycle Detection · difficulty 2 · single
In Floyd's Cycle-Finding Algorithm (Tortoise and Hare), when slow and fast pointers meet inside a cycle, why does moving slow to the list head while keeping fast at the meeting point and advancing both by 1 step guarantee they meet at the cycle entrance?
- A) Because the cycle length is always a prime number.
- B) Because the distance from the head to the cycle start $F$ equals the distance from the meeting point to the cycle start along the cycle: $F \equiv -k \pmod C$.
- C) Because the fast pointer was traveling backwards.
- D) Because the list length must be an even integer.
<details><summary>Answer</summary>

**B.** Let $F$ be the length of the non-cyclic prefix, $C$ the cycle length, and $a$ the distance from cycle entrance to the meeting point. When they meet: $2(F + a) = F + n C + a \implies F + a = n C \implies F = n C - a = (n - 1)C + (C - a)$. Advancing one pointer from head ($0$) and the other from meeting point ($a$) at equal speed of 1 step per tick guarantees they meet after exactly $F$ steps at the cycle entrance.
- Why not A: Cycle length $C$ can be any positive integer.
- Why not C: The fast pointer travels strictly forward at speed 2.
- Why not D: The list length can be even or odd.
- Ref: [modules/05-interview-patterns-linear-and-pointers.md](../modules/05-interview-patterns-linear-and-pointers.md)
</details>

#### Q-DSA-023 · Difference Arrays · difficulty 2 · single
Given an array of zeros of length $n$, what data structure executes $m$ arbitrary range additions `add(left, right, val)` in $O(1)$ time per update and produces the final array in $O(n)$ time?
- A) Monotonic Stack
- B) Difference Array where `diff[left] += val` and `diff[right + 1] -= val`
- C) Disjoint Set Union
- D) Trie
<details><summary>Answer</summary>

**B.** A difference array stores the delta between adjacent elements $D[i] = A[i] - A[i-1]$. Adding `val` to range $[L, R]$ changes only two boundary deltas: $D[L] \mathrel{+}= \text{val}$ and $D[R+1] \mathrel{-}= \text{val}$ in $O(1)$ time. Computing the prefix sums of $D$ at the end recovers the mutated array in a single $O(n)$ pass.
- Why not A: Monotonic stacks find next greater elements, not range additions.
- Why not C: DSU manages disjoint connectivity components.
- Why not D: Tries store strings by character prefixes.
- Ref: [modules/05-interview-patterns-linear-and-pointers.md](../modules/05-interview-patterns-linear-and-pointers.md)
</details>

#### Q-DSA-024 · Monotonic Stack Complexity · difficulty 2 · single
What is the amortized time complexity of finding the Next Greater Element for all $n$ elements using a Monotonic Decreasing Stack?
- A) $O(1)$
- B) $O(n)$
- C) $O(n \log n)$
- D) $O(n^2)$
<details><summary>Answer</summary>

**B.** Although the inner `while` loop pops elements from the stack, every element in the array is pushed onto the stack exactly once and popped at most once across the entire algorithm. The total number of stack operations is at most $2n$, proving strictly linear $O(n)$ amortized time.
- Why not A: Processing $n$ elements requires at least $\Omega(n)$ operations.
- Why not C: No sorting or tree operations are used; linear time is achieved.
- Why not D: $O(n^2)$ is the naive brute force, but the stack achieves $O(n)$.
- Ref: [modules/05-interview-patterns-linear-and-pointers.md](../modules/05-interview-patterns-linear-and-pointers.md)
</details>

#### Q-DSA-025 · Cyclic Sort Invariant · difficulty 2 · single
For an array of length $n$ containing numbers from $1$ to $n$, what is the termination invariant of Cyclic Sort?
- A) `nums[i] === i + 1` for all indices $0 \le i < n$.
- B) Array elements are placed in reverse order.
- C) Every element is mapped to a hash table bucket.
- D) The sum of elements equals $n(n+1)/2$.
<details><summary>Answer</summary>

**A.** Cyclic sort iteratively places each element `val = nums[i]` into its target index `val - 1` by swapping. Because each swap places at least one element into its permanent correct position, at most $n - 1$ swaps occur, terminating with `nums[i] === i + 1` for all $i$ in $O(n)$ time and $O(1)$ auxiliary space.
- Why not B: It sorts in ascending order, not reverse.
- Why not C: It operates strictly in-place in the array without hash maps.
- Why not D: The arithmetic sum can match even if elements are scrambled.
- Ref: [modules/05-interview-patterns-linear-and-pointers.md](../modules/05-interview-patterns-linear-and-pointers.md)
</details>

---

### Domain 6: Trees, Balanced BSTs & Priority Queues

#### Q-DSA-026 · Morris Traversal · difficulty 3 · single
How does Morris In-Order Traversal achieve $O(1)$ auxiliary space without recursion or an explicit stack?
- A) By dynamically allocating memory on the operating system heap.
- B) By creating temporary threaded links from the rightmost node of a node's left subtree back to the current node.
- C) By converting the binary tree into a 2-3-4 tree.
- D) By encoding child pointers in 16-bit floating point mantissas.
<details><summary>Answer</summary>

**B.** Morris traversal identifies the in-order predecessor (the rightmost node of the left subtree). If its `right` pointer is null, it points it to `curr` (creating a thread) and steps left. If its `right` pointer already points to `curr`, the thread is dismantled (restoring tree structure), `curr` is visited, and the traversal steps right. Total time is $O(n)$ and space is $O(1)$.
- Why not A: Morris traversal allocates zero auxiliary heap memory.
- Why not C: It leaves the binary tree unmodified upon completion.
- Why not D: Pointers are standard object references, not floating point numbers.
- Ref: [modules/06-trees-heaps-and-priority-queues.md](../modules/06-trees-heaps-and-priority-queues.md)
</details>

#### Q-DSA-027 · Red-Black Tree Invariants · difficulty 2 · multi
Which of the following are mandatory invariants of a valid Red-Black Tree? (Select all that apply)
- A) Every node is either red or black.
- B) The root and all leaf nodes (NIL) are black.
- C) If a node is red, both its children must be black (no adjacent red nodes).
- D) For each node, all simple paths from the node to descendant leaves contain the same number of black nodes (black-height).
<details><summary>Answer</summary>

**A, B, C, D.** All four statements are part of the five classical Red-Black Tree invariants (along with the fifth property that NIL leaves are black), which together guarantee that the tree's height cannot exceed $2 \log_2(n + 1)$.
- Ref: [modules/06-trees-heaps-and-priority-queues.md](../modules/06-trees-heaps-and-priority-queues.md), CLRS 4e Chapter 13
</details>

#### Q-DSA-028 · Linear Heap Construction · difficulty 2 · single
Why is `buildHeap` (calling `siftDown` bottom-up from index $\lfloor n/2 \rfloor$ down to $0$) bounded by $O(n)$ time, whereas inserting $n$ elements sequentially into an initially empty heap takes $O(n \log n)$?
- A) Because `siftDown` uses bitwise shift instructions while `insert` does not.
- B) Because most nodes reside near the bottom of the tree where their maximum sift distance $h$ is very small: $\sum_{h=0}^{\log n} \frac{n}{2^{h+1}} h = O(n)$.
- C) Because V8 pre-allocates memory for heaps.
- D) Because binary heaps are implemented using circular queues.
<details><summary>Answer</summary>

**B.** In a binary heap of height $H = \log_2 n$, level $h$ from the bottom has $\lceil n / 2^{h+1} \rceil$ nodes, and each node can sift down at most $h$ steps. The total work is bounded by $n \sum_{h=0}^\infty \frac{h}{2^h} = n \cdot 2 = O(n)$. Sequential insertions call `siftUp` on nodes at the bottom of the tree, which can travel all the way up to the root, summing to $\Theta(n \log n)$.
- Why not A: Both `siftDown` and `siftUp` use the same index arithmetic.
- Why not C: Memory pre-allocation does not change asymptotic comparison complexity.
- Why not D: Binary heaps are complete binary trees in flat arrays, not circular queues.
- Ref: [modules/06-trees-heaps-and-priority-queues.md](../modules/06-trees-heaps-and-priority-queues.md), CLRS 4e Chapter 6
</details>

#### Q-DSA-029 · Fenwick Tree Lowbit · difficulty 2 · single
In a 1-indexed Fenwick Tree (Binary Indexed Tree) of size $n$, how do you advance the index during a point update operation `add(i, delta)`?
- A) `i = i - (i & -i)`
- B) `i = i + (i & -i)`
- C) `i = i >> 1`
- D) `i = (i * 2) + 1`
<details><summary>Answer</summary>

**B.** In a Fenwick tree, adding the lowest set bit (`i + (i & -i)`) navigates up the responsibility tree to the parent intervals that cover index `i`. Conversely, prefix sum queries strip the lowest set bit (`i - (i & -i)`) to aggregate disjoint power-of-two prefix intervals.
- Why not A: Subtracting `i & -i` is used for prefix sum queries, not updates.
- Why not C: Right shift navigates a standard binary heap, not a Fenwick tree.
- Why not D: Navigates a Segment Tree child index.
- Ref: [modules/06-trees-heaps-and-priority-queues.md](../modules/06-trees-heaps-and-priority-queues.md)
</details>

#### Q-DSA-030 · Median from Data Stream · difficulty 2 · scenario
How can the running median of a numerical stream be retrieved in $O(1)$ time with $O(\log n)$ updates?
- A) Using a sorted linked list.
- B) Using two heaps: a Max-Heap for the lower half of numbers and a Min-Heap for the upper half, balanced such that size differences never exceed 1.
- C) Using a single Bloom Filter.
- D) Using Quickselect on every query.
<details><summary>Answer</summary>

**B.** By partitioning data into two heaps: `maxHeap` (storing the smaller half) and `minHeap` (storing the larger half), the tops of the heaps represent the boundary elements. If the total count is odd, the median is the root of the larger heap. If even, it is the average of both roots. Rebalancing takes $O(\log n)$ per insertion.
- Why not A: Inserting into a sorted linked list takes $O(n)$ time.
- Why not C: Bloom filters test set membership, not numeric ranking or medians.
- Why not D: Quickselect takes $O(n)$ time per query, which is unacceptably slow for high-frequency stream requests.
- Ref: [modules/06-trees-heaps-and-priority-queues.md](../modules/06-trees-heaps-and-priority-queues.md)
</details>

---

### Domain 7: Graph Foundations, Traversals & Topological Sorting

#### Q-DSA-031 · Stack Safety in Graph Traversals · difficulty 2 · single
Why is recursive Depth-First Search (DFS) dangerous on large graph inputs (e.g. $10^5$ nodes) in Node.js/V8, and how is it resolved?
- A) It exhausts physical RAM; resolved by increasing swap memory.
- B) The call stack exceeds the V8 engine frame limit (~10,000 frames) throwing `RangeError: Maximum call stack size exceeded`; resolved by using an explicit heap-allocated array stack in an iterative loop.
- C) It causes floating point rounding errors; resolved with BigInt.
- D) Node.js terminates asynchronous events after 1000ms; resolved with `setTimeout`.
<details><summary>Answer</summary>

**B.** Node.js/V8 allocates a fixed call-stack memory budget per thread (~1MB), accommodating only ~10,000–20,000 active function frames. On long degenerate paths (e.g. a linear line graph of $10^5$ nodes), recursive DFS crashes immediately with a `RangeError`. Implementing iterative DFS with an array stack (`const stack = [start]`) stores frames in the V8 heap, which can grow to gigabytes without stack overflow.
- Why not A: The issue is stack frame limits, not general RAM exhaustion.
- Why not C: Graph traversal uses integer node IDs.
- Why not D: Synchronous execution does not trigger timeout cancellations.
- Ref: [modules/07-graph-foundations-and-traversals.md](../modules/07-graph-foundations-and-traversals.md)
</details>

#### Q-DSA-032 · DFS Edge Classification · difficulty 2 · single
In a directed graph, which edge type indicates the presence of a directed cycle during Depth-First Search?
- A) Tree Edge
- B) Forward Edge
- C) Back Edge (pointing to an ancestor in the current active recursion stack / "gray" node)
- D) Cross Edge
<details><summary>Answer</summary>

**C.** A back edge connects a vertex to an ancestor in the DFS tree that is currently being explored (colored gray). Because the ancestor was discovered earlier and has not yet finished, following this back edge completes a directed cycle.
- Why not A: Tree edges discover new unvisited vertices.
- Why not B: Forward edges connect an ancestor to an already finished descendant.
- Why not D: Cross edges connect vertices across different branches of the DFS forest without creating cycles.
- Ref: [modules/07-graph-foundations-and-traversals.md](../modules/07-graph-foundations-and-traversals.md), CLRS 4e Chapter 20
</details>

#### Q-DSA-033 · Topological Sorting · difficulty 1 · single
Which algorithm detects cycles while computing a topological sort of a Directed Acyclic Graph (DAG) using vertex in-degrees?
- A) Tarjan's SCC Algorithm
- B) Kahn's Algorithm (BFS-based queue of in-degree 0 nodes)
- C) Bellman-Ford Algorithm
- D) Prim's Algorithm
<details><summary>Answer</summary>

**B.** Kahn's algorithm initializes a queue with all vertices having in-degree 0. As vertices are dequeued, their outgoing edges are removed and destination in-degrees decremented. If the count of dequeued vertices is less than the total vertex count $V$, the graph contains at least one directed cycle.
- Why not A: Tarjan's algorithm uses DFS stack low-link values.
- Why not C: Bellman-Ford finds shortest paths with negative weights.
- Why not D: Prim's algorithm finds Minimum Spanning Trees on undirected graphs.
- Ref: [modules/07-graph-foundations-and-traversals.md](../modules/07-graph-foundations-and-traversals.md)
</details>

#### Q-DSA-034 · 0-1 BFS Mechanics · difficulty 2 · single
When finding shortest paths in a graph where edge weights are restricted to $\{0, 1\}$, why can 0-1 BFS run in $O(V + E)$ time without a priority queue?
- A) It uses a Double-Ended Queue (Deque): pushing 0-weight edges to the front and 1-weight edges to the back ensures distances in the deque remain monotonically sorted.
- B) It skips all 1-weight edges.
- C) It converts edge weights to logarithms.
- D) It runs Dijkstra's algorithm with Fibonacci heaps.
<details><summary>Answer</summary>

**A.** Because edge weights are only 0 or 1, vertices in the Deque always span at most two consecutive distance layers: $d$ and $d + 1$. Pushing 0-cost transitions to the front (`deque.unshift()`) and 1-cost transitions to the back (`deque.push()`) maintains strict monotonic distance ordering in $O(1)$ per step, eliminating the $O(\log V)$ priority queue overhead.
- Why not B: 1-weight edges must be explored to find valid paths.
- Why not C: Logarithmic conversion is for multiplying probabilities, not 0-1 BFS.
- Why not D: Fibonacci heaps add large constant factor overhead ($O(E + V \log V)$), whereas 0-1 BFS runs in strictly linear $O(V + E)$ time.
- Ref: [modules/07-graph-foundations-and-traversals.md](../modules/07-graph-foundations-and-traversals.md)
</details>

#### Q-DSA-035 · Strongly Connected Components · difficulty 3 · single
What condition triggers the extraction of a Strongly Connected Component (SCC) in Tarjan's linear-time algorithm?
- A) When a node has in-degree equal to 0.
- B) When backtracking from vertex $u$ and discovering that $\text{low}[u] === \text{disc}[u]$.
- C) When a back-edge is encountered.
- D) When all edges in the graph have been traversed.
<details><summary>Answer</summary>

**B.** In Tarjan's algorithm, `disc[u]` is the discovery timestamp of $u$, and `low[u]` is the smallest discovery time reachable from $u$ via its DFS subtree and at most one back-edge into the current stack. If $\text{low}[u] === \text{disc}[u]$, vertex $u$ is the root of an SCC; popping elements from the stack down to $u$ extracts that exact SCC.
- Why not A: SCCs can have non-zero in-degrees.
- Why not C: Encountering a back-edge updates `low[u]`, but does not trigger component extraction.
- Why not D: SCCs are extracted incrementally during traversal, not all at once at the end.
- Ref: [modules/07-graph-foundations-and-traversals.md](../modules/07-graph-foundations-and-traversals.md)
</details>

---

### Domain 8: Shortest Paths, MST & Disjoint-Set Union

#### Q-DSA-036 · Dijkstra Failure Modes · difficulty 2 · single
Why does Dijkstra's algorithm fail to produce correct shortest paths on graphs containing negative-weight edges?
- A) It throws a runtime exception when encountering negative weights.
- B) The greedy choice property assumes that adding an edge to an already finalized shortest-path tree can never decrease the total path cost: $d(u) + w(u, v) \ge d(u)$.
- C) It loops indefinitely.
- D) It corrupts the binary heap.
<details><summary>Answer</summary>

**B.** Dijkstra's algorithm irrevocably marks a vertex as settled once it is extracted from the priority queue, assuming no future edge can offer a shorter route. A negative edge can retroactively reduce the distance to an already settled vertex, invalidating all subsequent shortest-path calculations.
- Why not A: Dijkstra executes without throwing exceptions, silently returning incorrect distances.
- Why not C: In a DAG with negative edges, it terminates without looping, but still yields wrong results.
- Why not D: Binary heaps handle negative numbers without corruption.
- Ref: [modules/08-shortest-paths-mst-and-disjoint-sets.md](../modules/08-shortest-paths-mst-and-disjoint-sets.md)
</details>

#### Q-DSA-037 · Bellman-Ford Invariant · difficulty 2 · single
In a graph with $V$ vertices, why does Bellman-Ford relax all edges exactly $V - 1$ times to guarantee finding all shortest paths (assuming no negative cycles)?
- A) Because the longest possible simple path in a graph with $V$ vertices contains at most $V - 1$ edges.
- B) Because $V - 1$ is the number of edges in a binary tree.
- C) Because each pass updates exactly one edge.
- D) Because the graph must be bipartite.
<details><summary>Answer</summary>

**A.** A simple path visiting $V$ vertices contains at most $V - 1$ edges. Since each relaxation pass extends shortest paths by at least one edge along any optimal path, $V - 1$ passes guarantee that shortest paths of any length up to $V - 1$ edges are fully propagated. If a distance can still be relaxed on the $V$-th pass, a negative-weight cycle exists.
- Why not B: The graph does not need to be a binary tree.
- Why not C: Each pass relaxes all $|E|$ edges.
- Why not D: Bellman-Ford works on arbitrary directed graphs.
- Ref: [modules/08-shortest-paths-mst-and-disjoint-sets.md](../modules/08-shortest-paths-mst-and-disjoint-sets.md)
</details>

#### Q-DSA-038 · Disjoint Set Union Complexity · difficulty 2 · single
What is the amortized time complexity per operation of a Disjoint Set Union (DSU) data structure implementing BOTH Path Compression and Union by Rank?
- A) $O(1)$
- B) $O(\alpha(n))$, where $\alpha$ is the Inverse Ackermann function
- C) $O(\log n)$
- D) $O(n)$
<details><summary>Answer</summary>

**B.** Robert Tarjan proved that combining path compression (flattening tree paths during `find`) with union by rank (attaching the shallower tree under the deeper tree root) bounds the amortized time per operation to $O(\alpha(n))$. For any physically conceivable universe ($n < 10^{80}$), $\alpha(n) \le 4$, making it effectively $O(1)$ in practice.
- Why not A: Strictly speaking it is $O(\alpha(n))$, not pure $O(1)$.
- Why not C: $O(\log n)$ is the bound when using Union by Rank *without* Path Compression.
- Why not D: $O(n)$ is the worst-case bound when *neither* optimization is used.
- Ref: [modules/08-shortest-paths-mst-and-disjoint-sets.md](../modules/08-shortest-paths-mst-and-disjoint-sets.md)
</details>

#### Q-DSA-039 · Kruskal vs Prim · difficulty 2 · single
When should Kruskal's algorithm be chosen over Prim's algorithm for finding a Minimum Spanning Tree?
- A) When the graph is dense ($E \approx V^2$).
- B) When the graph is sparse ($E \ll V^2$) or when edges are already sorted.
- C) When the graph has directed edges.
- D) When the graph has negative cycles.
<details><summary>Answer</summary>

**B.** Kruskal's algorithm sorts all edges first: $O(E \log E)$. On sparse graphs where $E = O(V)$, Kruskal runs in $O(E \log V)$. If edges are already sorted, Kruskal runs in nearly linear $O(E \alpha(V))$ time with DSU. On dense graphs, Prim with an adjacency matrix runs in $O(V^2)$ without edge sorting overhead.
- Why not A: On dense graphs, Prim's algorithm ($O(V^2)$ or $O(E + V \log V)$) outperforms Kruskal.
- Why not C: MST algorithms operate on undirected graphs.
- Why not D: MST is undefined for graphs with directed negative cycles.
- Ref: [modules/08-shortest-paths-mst-and-disjoint-sets.md](../modules/08-shortest-paths-mst-and-disjoint-sets.md)
</details>

#### Q-DSA-040 · Floyd-Warshall DP Formulation · difficulty 2 · single
In the Floyd-Warshall all-pairs shortest paths algorithm, what is the meaning of the outer loop variable $k$ from $0$ to $V-1$?
- A) The maximum number of edges in the path.
- B) The highest-indexed intermediate vertex allowed along the path between $i$ and $j$.
- C) The target destination vertex.
- D) The source vertex.
<details><summary>Answer</summary>

**B.** The Floyd-Warshall recurrence defines $DP[k][i][j]$ as the shortest path from vertex $i$ to vertex $j$ using only intermediate vertices from the set $\{0, 1, \dots, k\}$. The recurrence transitions by deciding whether passing through vertex $k$ improves the path: $\min(DP[k-1][i][j], DP[k-1][i][k] + DP[k-1][k][j])$.
- Why not A: Path length in edges is the Bellman-Ford parameter, not Floyd-Warshall.
- Why not C or D: Source and destination are $i$ and $j$, while $k$ is the intermediate bridge node.
- Ref: [modules/08-shortest-paths-mst-and-disjoint-sets.md](../modules/08-shortest-paths-mst-and-disjoint-sets.md)
</details>

---

### Domain 9: Recursion, Backtracking & Divide-and-Conquer

#### Q-DSA-041 · Backtracking Template · difficulty 1 · single
What are the three canonical stages of the recursive Backtracking state-space exploration template?
- A) Read, Write, Delete
- B) Choose, Explore, Unchoose (Revert State)
- C) Push, Pop, Peek
- D) Map, Filter, Reduce
<details><summary>Answer</summary>

**B.** The classical backtracking schema: (1) **Choose**: Apply a candidate move to the mutable state, (2) **Explore**: Make the recursive call to explore subsequent decisions down this subtree, (3) **Unchoose**: Undo the mutation to restore state before evaluating the next sibling candidate.
- Why not A: Read/write are I/O operations, not search algorithms.
- Why not C: Push/pop are stack operations.
- Why not D: Map/filter/reduce are functional programming idioms.
- Ref: [modules/09-recursion-backtracking-and-divide-and-conquer.md](../modules/09-recursion-backtracking-and-divide-and-conquer.md)
</details>

#### Q-DSA-042 · Bitmask Pruning in N-Queens · difficulty 2 · single
In the N-Queens problem, how can column and diagonal attacks be checked in $O(1)$ time without scanning an $N \times N$ board?
- A) Using three 32-bit integer bitmasks: `cols`, `diag1` ($r - c + N$), and `diag2` ($r + c$).
- B) Using an AVL tree.
- C) By checking if $N$ is prime.
- D) Using a matrix transpose.
<details><summary>Answer</summary>

**A.** A queen placed at $(r, c)$ attacks column $c$, main diagonal $r - c$ (shifted by $+ N$ to keep index positive), and anti-diagonal $r + c$. By tracking occupied lines with bitwise masks (`(cols & (1 << c)) !== 0`), conflict checking and state mutation run in $O(1)$ single-cycle bitwise operations.
- Why not B: An AVL tree incurs $O(\log N)$ lookup overhead per queen check, whereas bitmask operations evaluate in single-cycle $O(1)$ CPU operations.
- Why not C: Primality of $N$ has no bearing on column or diagonal attack geometry.
- Why not D: Matrix transposition changes axes but still requires traversal scanning.
- Ref: [modules/09-recursion-backtracking-and-divide-and-conquer.md](../modules/09-recursion-backtracking-and-divide-and-conquer.md)
</details>

#### Q-DSA-043 · Meet-in-the-Middle · difficulty 2 · single
How does the Meet-in-the-Middle technique reduce the complexity of the $O(2^N)$ Subset Sum problem for $N = 40$?
- A) It runs Quicksort on the input array.
- B) It splits the array into two halves of size $N/2 = 20$, generates all $2^{20} \approx 10^6$ subset sums for each half, sorts one half, and uses binary search to find target pairs in $O(2^{N/2} \cdot N)$ time.
- C) It converts the problem into linear programming.
- D) It approximates the sum using Monte Carlo sampling.
<details><summary>Answer</summary>

**B.** Evaluating $2^{40} \approx 1.1 \times 10^{12}$ operations exceeds standard computation limits. By dividing into two halves of 20 elements, generating $2^{20} \approx 10^6$ sums takes milliseconds. Sorting list $B$ and querying each element $a \in A$ for target $- a$ via binary search executes in $O(2^{N/2} \cdot N)$ total time.
- Why not A: Sorting the original array does not change the exponential number of subsets.
- Why not C: Subset sum is NP-complete.
- Why not D: Meet-in-the-Middle provides an exact deterministic answer, not an approximation.
- Ref: [modules/09-recursion-backtracking-and-divide-and-conquer.md](../modules/09-recursion-backtracking-and-divide-and-conquer.md)
</details>

#### Q-DSA-044 · Karatsuba Multiplication · difficulty 2 · single
What is the asymptotic time complexity of Karatsuba's divide-and-conquer multiplication of two $n$-digit integers, and why does it beat the grade-school $O(n^2)$ method?
- A) $O(n \log n)$, using Fast Fourier Transforms.
- B) $O(n^{\log_2 3}) \approx O(n^{1.585})$, by computing 3 sub-multiplications instead of 4: $(a+b)(c+d) - ac - bd = ad + bc$.
- C) $O(n)$, by parallelizing across SIMD registers.
- D) $O(n^2)$, by rearranging loop orders.
<details><summary>Answer</summary>

**B.** Standard grade-school multiplication computes four $n/2$-digit products ($ac, ad, bc, bd$). Karatsuba noticed that $(a+b)(c+d) = ac + (ad+bc) + bd$. By computing $P_1 = ac, P_2 = bd$, and $P_3 = (a+b)(c+d)$, the middle term is $P_3 - P_1 - P_2$, requiring only 3 multiplications. The recurrence $T(n) = 3T(n/2) + O(n)$ yields $O(n^{\log_2 3}) \approx O(n^{1.585})$.
- Why not A: $O(n \log n)$ is achieved by the Schönhage–Strassen or Harvey-Hoeven FFT algorithms, not Karatsuba.
- Why not C: Sub-multiplication still requires non-linear work.
- Why not D: It strictly beats $O(n^2)$.
- Ref: [modules/09-recursion-backtracking-and-divide-and-conquer.md](../modules/09-recursion-backtracking-and-divide-and-conquer.md)
</details>

#### Q-DSA-045 · Closest Pair of Points · difficulty 3 · single
In the $O(n \log n)$ divide-and-conquer algorithm for finding the Closest Pair of 2D Points, when inspecting the strip around the dividing line with minimum distance $\delta = \min(\delta_L, \delta_R)$, at most how many points must each point be compared against?
- A) All $n$ points in the strip
- B) At most 7 points (a constant geometric packing bound)
- C) $\log n$ points
- D) $\sqrt{n}$ points
<details><summary>Answer</summary>

**B.** In the vertical strip of width $2\delta$ centered at the dividing line, all points in the left half are separated by at least $\delta$, and all points in the right half are separated by at least $\delta$. A $\delta \times 2\delta$ rectangle can hold at most 8 points with pairwise distances $\ge \delta$. Therefore, when points in the strip are sorted by $y$-coordinate, each point needs to be compared against at most 7 subsequent points, keeping the combine step strictly linear $O(n)$.
- Why not A: Comparing against all points in the strip would degrade worst-case time to $O(n^2)$.
- Why not C or D: Geometric sphere-packing bounds the candidate count to a small constant.
- Ref: [modules/09-recursion-backtracking-and-divide-and-conquer.md](../modules/09-recursion-backtracking-and-divide-and-conquer.md), CLRS 4e Chapter 33
</details>

---

### Domain 10: Dynamic Programming: Foundations to Advanced Dimensions

#### Q-DSA-046 · Knapsack Loops · difficulty 2 · single
When optimizing the space of 0/1 Knapsack to a 1-D array `dp[w]`, why MUST capacity $w$ be traversed backwards from $W$ down to $w_i$?
- A) To prevent the current item from being included multiple times in the same knapsack.
- B) To avoid JavaScript array resizing penalties.
- C) Because V8 executes backwards loops faster.
- D) To sort items by value.
<details><summary>Answer</summary>

**A.** In 0/1 Knapsack, each item may be used at most once. Traversing backwards ensures that when computing $dp[w] = \max(dp[w], dp[w - w_i] + v_i)$, the lookup $dp[w - w_i]$ still holds the value from the *previous* item iteration $i - 1$. Traversing forwards would use newly updated values from the *current* item, turning it into Unbounded Knapsack.
- Why not B: Array size $W + 1$ is pre-allocated and fixed.
- Why not C: Directional execution differences in V8 are micro-optimizations unrelated to recurrence correctness.
- Why not D: Items are processed by index, not sorted values.
- Ref: [modules/10-dynamic-programming-foundations-to-advanced.md](../modules/10-dynamic-programming-foundations-to-advanced.md)
</details>

#### Q-DSA-047 · LIS Patience Sorting · difficulty 2 · single
In the $O(n \log n)$ Longest Increasing Subsequence algorithm using Patience Sorting, what does each entry `tails[len]` store?
- A) The actual sequence of elements forming the LIS.
- B) The smallest ending value of all increasing subsequences of length `len + 1` found so far.
- C) The frequency of elements.
- D) The index of the maximum value.
<details><summary>Answer</summary>

**B.** `tails[len]` records the minimal tail element for an increasing subsequence of length `len + 1`. Maintaining the minimal tail guarantees that future elements have the highest probability of extending the subsequence. Because `tails` is strictly monotonically increasing, the correct insertion/replacement index is located in $O(\log n)$ time via binary search.
- Why not A: `tails` does not hold the actual subsequence elements because later replacements can mix elements from different candidate subsequences.
- Why not C: It stores values, not counts.
- Why not D: It stores values across all lengths, not a single index.
- Ref: [modules/10-dynamic-programming-foundations-to-advanced.md](../modules/10-dynamic-programming-foundations-to-advanced.md)
</details>

#### Q-DSA-048 · Edit Distance Recurrence · difficulty 2 · single
What is the recurrence relation for Levenshtein Edit Distance $DP[i][j]$ when characters $S_1[i-1] \neq S_2[j-1]$?
- A) $DP[i][j] = DP[i-1][j-1]$
- B) $DP[i][j] = 1 + \min(DP[i-1][j], DP[i][j-1], DP[i-1][j-1])$
- C) $DP[i][j] = DP[i-1][j] + DP[i][j-1]$
- D) $DP[i][j] = \max(DP[i-1][j], DP[i][j-1])$
<details><summary>Answer</summary>

**B.** When characters differ, transforming prefix $S_1[0 \dots i-1]$ into $S_2[0 \dots j-1]$ can be achieved via: (1) Deleting $S_1[i-1]$ ($DP[i-1][j]$), (2) Inserting $S_2[j-1]$ ($DP[i][j-1]$), or (3) Replacing $S_1[i-1]$ with $S_2[j-1]$ ($DP[i-1][j-1]$). Taking the minimum plus 1 cost gives the optimal edit distance.
- Why not A: That applies when characters match ($S_1[i-1] === S_2[j-1]$), incurring zero cost.
- Why not C: Summing options counts paths rather than minimizing operation cost.
- Why not D: Max is used in Longest Common Subsequence (LCS), not Edit Distance minimization.
- Ref: [modules/10-dynamic-programming-foundations-to-advanced.md](../modules/10-dynamic-programming-foundations-to-advanced.md)
</details>

#### Q-DSA-049 · Bitmask DP Complexity · difficulty 2 · single
For the Traveling Salesperson Problem on $n = 20$ vertices, what are the time complexities of the Held-Karp Bitmask DP versus naive brute force?
- A) Held-Karp: $O(n^2 2^n)$, Brute Force: $O(n!)$
- B) Held-Karp: $O(n)$, Brute Force: $O(n^2)$
- C) Held-Karp: $O(2^n)$, Brute Force: $O(n^n)$
- D) Held-Karp: $O(n^3)$, Brute Force: $O(2^n)$
<details><summary>Answer</summary>

**A.** Naive brute force evaluates all permutations of cities: $n! \approx 2.4 \times 10^{18}$ for $n = 20$, which is impossible. Held-Karp represents visited cities as an $n$-bit mask with state $DP(\text{mask}, u)$ representing the minimum cost ending at city $u$. There are $2^n \cdot n$ states with $n$ transitions per state, totaling $O(n^2 2^n) \approx 4 \times 10^8$ operations, executable in ~1 second.
- Why not B or D: TSP is NP-hard; no polynomial $O(n)$ or $O(n^3)$ algorithm is known.
- Ref: [modules/10-dynamic-programming-foundations-to-advanced.md](../modules/10-dynamic-programming-foundations-to-advanced.md)
</details>

#### Q-DSA-050 · Space Optimization · difficulty 1 · single
In the Longest Common Subsequence (LCS) recurrence $DP[i][j]$, why can the space complexity be reduced from $O(m \cdot n)$ to $O(\min(m, n))$?
- A) Because the algorithm can terminate early on the first match.
- B) Because computing row $i$ depends strictly on the current row $i$ and the immediately preceding row $i - 1$; older rows are never accessed again.
- C) Because strings are immutable in JavaScript.
- D) Because LCS does not require tabulation.
<details><summary>Answer</summary>

**B.** In the recurrence $DP[i][j] = \max(DP[i-1][j], DP[i][j-1])$ or $DP[i-1][j-1] + 1$, row $i$ accesses only row $i - 1$. Retaining only two rows (`prev` and `curr`), or orienting the matrix such that the shorter string forms the columns, reduces memory to $O(\min(m, n))$.
- Why not A: Early termination does not compute the global LCS.
- Why not C: String immutability does not affect DP table matrix allocation.
- Why not D: Tabulation is standard; rolling rows optimize the memory footprint.
- Ref: [modules/10-dynamic-programming-foundations-to-advanced.md](../modules/10-dynamic-programming-foundations-to-advanced.md)
</details>

---

### Domain 11: Greedy Algorithms & Exchange Arguments

#### Q-DSA-051 · Exchange Argument Principle · difficulty 2 · single
What is the core logical mechanism of an Exchange Argument proof in greedy algorithm analysis?
- A) It exchanges recursive calls for iterative loops.
- B) It assumes an optimal solution $O$ that differs from greedy solution $G$, identifies the first divergence, and swaps the optimal element with the greedy element, proving the modified solution $O'$ remains feasible and optimal.
- C) It exchanges time complexity for space complexity.
- D) It proves NP-completeness by polynomial reduction.
<details><summary>Answer</summary>

**B.** The exchange argument constructs a valid path between a hypothetical optimal solution $O$ and the greedy solution $G$. By showing that swapping the divergent optimal element with the greedy choice never degrades the objective function, repeated swaps transform $O$ into $G$, proving $|G| \ge |O|$ (or $\text{cost}(G) \le \text{cost}(O)$).
- Why not A: That is loop unrolling or recursion elimination.
- Why not C: That describes space-time trade-offs.
- Why not D: That describes Cook-Levin reductions.
- Ref: [modules/11-greedy-algorithms-and-exchange-arguments.md](../modules/11-greedy-algorithms-and-exchange-arguments.md)
</details>

#### Q-DSA-052 · Interval Scheduling Sorting Criterion · difficulty 2 · single
In the Interval Scheduling problem (selecting the maximum number of mutually non-overlapping intervals), why must intervals be sorted by finish time $f_i$ rather than start time $s_i$ or duration?
- A) Sorting by finish time leaves the maximum possible remaining time for all subsequent intervals.
- B) Sorting by start time takes quadratic time.
- C) Finish time sorting uses less memory.
- D) Start times can be negative numbers.
<details><summary>Answer</summary>

**A.** Choosing the interval that finishes earliest frees up the resource as early as possible, maximizing the capacity remaining for subsequent intervals. Sorting by start time fails when an early-starting interval spans the entire day. Sorting by shortest duration fails when an isolated short interval conflicts with two non-overlapping intervals on either side.
- Why not B: All sorting criteria take $O(n \log n)$ time.
- Why not C: Auxiliary space is identical.
- Why not D: Negative start times would not alter the validity of finish time sorting.
- Ref: [modules/11-greedy-algorithms-and-exchange-arguments.md](../modules/11-greedy-algorithms-and-exchange-arguments.md)
</details>

#### Q-DSA-053 · Huffman Tree Construction · difficulty 2 · single
What data structure is used to build a Huffman Coding tree in $O(n \log n)$ time?
- A) Hash Table
- B) Min-Priority Queue (Binary Min-Heap)
- C) Suffix Automaton
- D) Monotonic Stack
<details><summary>Answer</summary>

**B.** Huffman's algorithm inserts all $n$ character nodes into a Min-Priority Queue keyed by frequency. In each iteration, it extracts the two nodes with minimal frequency, merges them under a parent node with weight equal to their sum, and reinserts the parent into the heap. $n - 1$ extractions and insertions in $O(\log n)$ take $O(n \log n)$ total time.
- Why not A: Hash tables cannot extract running minimums in $O(\log n)$ time.
- Why not C: Suffix automata are for string substring matching.
- Why not D: Monotonic stacks do not maintain running global multi-element sums.
- Ref: [modules/11-greedy-algorithms-and-exchange-arguments.md](../modules/11-greedy-algorithms-and-exchange-arguments.md)
</details>

#### Q-DSA-054 · Coin Change Counterexample · difficulty 1 · single
For coin denominations $[1, 3, 4]$ and target $6$, what does the standard greedy approach choose versus the optimal solution?
- A) Greedy: $4 + 1 + 1$ (3 coins); Optimal: $3 + 3$ (2 coins)
- B) Greedy: $3 + 3$ (2 coins); Optimal: $4 + 1 + 1$ (3 coins)
- C) Both choose $3 + 3$ (2 coins)
- D) Greedy cannot find any combination
<details><summary>Answer</summary>

**A.** The greedy approach takes the largest coin $\le 6$: picks $4$. Remaining target is $2$. Next picks $1$, then $1$, totaling 3 coins ($4 + 1 + 1$). The optimal approach chooses two 3-value coins ($3 + 3 = 6$), totaling 2 coins. This proves greedy fails on arbitrary coin denominations.
- Ref: [modules/11-greedy-algorithms-and-exchange-arguments.md](../modules/11-greedy-algorithms-and-exchange-arguments.md)
</details>

#### Q-DSA-055 · Matroid Theory & Greed · difficulty 3 · single
What does the Rado-Edmonds Theorem prove regarding matroids?
- A) Every matroid can be inverted in polynomial time.
- B) For any weighted matroid $(S, \mathcal{I})$, the greedy algorithm is guaranteed to find an independent set of maximum total weight.
- C) Matroids are equivalent to Turing machines.
- D) Greedy algorithms fail on graphic matroids.
<details><summary>Answer</summary>

**B.** A matroid satisfies three axioms: non-empty, hereditary, and the independent set exchange property. The Rado-Edmonds Theorem establishes that the greedy algorithm (sorting elements by weight and including each if the set remains independent) provably produces the global maximum-weight independent set.
- Why not A: Matroids are combinatorial structures, not invertible functions.
- Why not C: Matroids define independence systems, not universal computation.
- Why not D: Kruskal's MST algorithm is a direct instance of the greedy algorithm operating on a graphic matroid.
- Ref: [modules/11-greedy-algorithms-and-exchange-arguments.md](../modules/11-greedy-algorithms-and-exchange-arguments.md#6-matroids-and-the-rado-edmonds-theorem)
</details>

---

### Domain 12: String Algorithms & Pattern Matching

#### Q-DSA-056 · KMP Failure Function · difficulty 2 · single
What does the $\pi$ (LPS) array in the Knuth-Morris-Pratt (KMP) algorithm represent for pattern $P[0 \dots m-1]$?
- A) The number of vowels in the prefix.
- B) The length of the longest proper prefix of $P[0 \dots i]$ that is also a suffix of $P[0 \dots i]$.
- C) The frequency of character $P[i]$.
- D) The index of the first mismatch.
<details><summary>Answer</summary>

**B.** The $\pi$ (or LPS) array stores $\pi[i] = \max \{ k : 0 \le k < i \land P[0 \dots k-1] = P[i-k+1 \dots i] \}$. When a mismatch occurs during text search, $\pi$ tells the algorithm the longest prefix that matches the suffix of the current match, allowing the pattern to slide forward without backtracking the text index.
- Ref: [modules/12-string-algorithms-and-pattern-matching.md](../modules/12-string-algorithms-and-pattern-matching.md)
</details>

#### Q-DSA-057 · KMP Linear Running Time · difficulty 2 · single
Why is the matching phase of KMP strictly bounded by $O(n)$ time even though the pattern index can decrement inside a `while` loop?
- A) Decrements are executed in parallel.
- B) The text index $i$ increments in every step of the outer loop, and the pattern index $j$ can decrement along $\pi$ links at most as many times as it has incremented (at most $n$ times).
- C) V8 optimizes string jumps using string ropes.
- D) Modulo arithmetic prevents backtracking.
<details><summary>Answer</summary>

**B.** In each step of the outer loop, the text index $i$ increases by 1 ($n$ times). In each step, pattern pointer $j$ increases by at most 1. Because $j \ge 0$, $j$ can decrement at most as many times as it has increased ($j \le n$). The total number of decrements across the entire execution is bounded by $n$, proving amortized $O(n)$ time.
- Ref: [modules/12-string-algorithms-and-pattern-matching.md](../modules/12-string-algorithms-and-pattern-matching.md)
</details>

#### Q-DSA-058 · Z-Algorithm Definition · difficulty 2 · single
What does $Z[i]$ represent in the Z-Algorithm for string $S$?
- A) The index of the next vowel after $i$.
- B) The length of the longest common prefix between $S$ and the suffix of $S$ starting at index $i$.
- C) The hash code of substring $S[0 \dots i]$.
- D) The edit distance between $S[i]$ and $S[0]$.
<details><summary>Answer</summary>

**B.** For a string $S$, $Z[i]$ is the length of the longest common prefix (LCP) between $S$ and the suffix $S[i \dots |S|-1]$. The Z-algorithm maintains a window $[L, R]$ with maximal $R$, allowing $Z[i]$ to be computed in strictly linear $O(|S|)$ time.
- Ref: [modules/12-string-algorithms-and-pattern-matching.md](../modules/12-string-algorithms-and-pattern-matching.md)
</details>

#### Q-DSA-059 · Kasai's LCP Invariant · difficulty 3 · single
Why does Kasai's algorithm construct the Longest Common Prefix (LCP) array from a Suffix Array in $O(n)$ time rather than $O(n^2)$?
- A) By checking only adjacent characters in the alphabet.
- B) Because when iterating suffixes in order of their original text positions ($i = 0, 1, \dots, n-1$), the LCP value $h$ between suffix $i$ and its suffix array predecessor decreases by at most 1 ($h \ge h_{\text{prev}} - 1$).
- C) By converting suffixes to Bloom filters.
- D) By running Fast Fourier Transforms on ASCII values.
<details><summary>Answer</summary>

**B.** Stripping the first character from suffix $i$ to form suffix $i + 1$ can reduce the shared prefix length with its predecessor by at most 1. Because $h$ decrements at most $n$ times across the loop and cannot exceed $n$, the total number of character increments across all steps is bounded by $2n$, proving strictly linear $O(n)$ time.
- Ref: [modules/12-string-algorithms-and-pattern-matching.md](../modules/12-string-algorithms-and-pattern-matching.md)
</details>

#### Q-DSA-060 · Manacher's Linear Palindrome Trick · difficulty 2 · single
How does Manacher's Algorithm handle both odd-length (`"aba"`) and even-length (`"abba"`) palindromes without branch splitting?
- A) By inserting a delimiter character (e.g. `#`) between every character and at both ends of the string.
- B) By checking reverse strings with Rabin-Karp.
- C) By squaring character codes.
- D) By running KMP backwards.
<details><summary>Answer</summary>

**A.** Padding with `#` transforms `"aba"` to `"#a#b#a#"` (length 7, center `b`) and `"abba"` to `"#a#b#b#a#"` (length 9, center `#`). Every palindrome in the original string maps directly to an odd-length palindrome centered on a character or `#` delimiter in the transformed string, unifying both cases into a single mathematical radius search.
- Ref: [modules/12-string-algorithms-and-pattern-matching.md](../modules/12-string-algorithms-and-pattern-matching.md)
</details>

---

### Domain 13: Probabilistic Data Structures, Caches & Randomization

#### Q-DSA-061 · Bloom Filter Guarantees · difficulty 1 · single
What guarantees does a standard Bloom Filter make regarding False Positives and False Negatives?
- A) Zero False Positives, Bounded False Negatives
- B) Zero False Negatives, Bounded False Positives
- C) Zero False Positives, Zero False Negatives
- D) Bounded False Positives, Bounded False Negatives
<details><summary>Answer</summary>

**B.** A Bloom filter guarantees zero false negatives: if an item was inserted, all $k$ hashed bit positions were set to 1, so querying an inserted item will always return `true`. However, hash collisions can cause all $k$ bits to be 1 even if an item was never inserted, producing a bounded false positive probability $p \approx (1 - e^{-kn/m})^k$.
- Ref: [modules/13-probabilistic-data-structures-and-randomized-algorithms.md](../modules/13-probabilistic-data-structures-and-randomized-algorithms.md)
</details>

#### Q-DSA-062 · Count-Min Sketch Query · difficulty 2 · single
In a Count-Min Sketch of depth $d$ and width $w$, why does the query operation take the MINIMUM across all $d$ hashed row cells rather than the average or maximum?
- A) To minimize CPU instruction counts.
- B) Because hash collisions can only increase counter values (additive noise), so the minimum value contains the least error from collisions.
- C) Because counts can be negative numbers.
- D) To comply with IEEE-754 floating point standards.
<details><summary>Answer</summary>

**B.** Every insertion increments row counters. Collisions with other keys only add positive counts to cells, meaning $\text{matrix}[i][h_i(x)] \ge a_x$ for all rows $i$. The true frequency $a_x$ is bounded from below, so taking the minimum across all independent rows isolates the cell with the least collision noise.
- Ref: [modules/13-probabilistic-data-structures-and-randomized-algorithms.md](../modules/13-probabilistic-data-structures-and-randomized-algorithms.md)
</details>

#### Q-DSA-063 · HyperLogLog Aggregation · difficulty 2 · single
Why does HyperLogLog use the Harmonic Mean rather than the Geometric or Arithmetic Mean when combining estimates across its $m$ registers?
- A) Harmonic mean is faster to compute in hardware.
- B) Harmonic mean effectively suppresses the distorting effect of large outliers (registers with anomalously large runs of leading zeros due to chance).
- C) Arithmetic mean cannot operate on integers.
- D) Geometric mean requires complex numbers.
<details><summary>Answer</summary>

**B.** Flajolet et al. demonstrated that single random outliers (a key happening to hash to 30 leading zeros in an otherwise small dataset) skew arithmetic and geometric means upward. The harmonic mean gives greater weight to smaller values, neutralizing high-zero outliers and achieving standard error $1.04 / \sqrt{m}$.
- Ref: [modules/13-probabilistic-data-structures-and-randomized-algorithms.md](../modules/13-probabilistic-data-structures-and-randomized-algorithms.md)
</details>

#### Q-DSA-064 · Consistent Hashing Node Churn · difficulty 2 · single
In a Consistent Hash Ring with $N$ nodes and $K$ keys, what fraction of keys must be relocated on average when a node is added or removed?
- A) $1/N$
- B) $1/2$
- C) $(N - 1)/N$
- D) $K / 2$
<details><summary>Answer</summary>

**A.** In traditional modulo hashing (`hash % N`), changing $N$ to $N + 1$ remaps nearly $100\%$ of keys. In a Consistent Hash Ring (Karger et al.), adding or removing a node affects only the keys belonging to the adjacent partition on the ring, relocating an optimal fraction of only $K / N$ keys ($1/N$ of the total).
- Ref: [modules/13-probabilistic-data-structures-and-randomized-algorithms.md](../modules/13-probabilistic-data-structures-and-randomized-algorithms.md)
</details>

#### Q-DSA-065 · Reservoir Sampling Uniformity · difficulty 2 · single
In Reservoir Sampling of $k$ items from a stream of unknown size $N$, when item $i$ arrives ($i \ge k$), what is the probability that it replaces an item in the reservoir?
- A) $1 / N$
- B) $k / (i + 1)$
- C) $1 / 2$
- D) $k / 2^i$
<details><summary>Answer</summary>

**B.** At 0-indexed step $i$, generating a random integer $r \in [0, i]$ and replacing a reservoir item if $r < k$ selects the incoming item with probability $k / (i + 1)$. Inductively, every item seen so far has an exact, uniform $k / (i + 1)$ probability of being in the reservoir.
- Ref: [modules/13-probabilistic-data-structures-and-randomized-algorithms.md](../modules/13-probabilistic-data-structures-and-randomized-algorithms.md)
</details>

---

### Domain 14: Parallel Algorithms, Concurrency & Interview Execution

#### Q-DSA-066 · Work-Span Definitions · difficulty 1 · single
In the Work-Span model of parallel computing, what do $T_1$ and $T_\infty$ represent?
- A) $T_1$ is clock frequency; $T_\infty$ is memory latency.
- B) $T_1$ is the total execution time on 1 processor (Work); $T_\infty$ is the critical path execution time on an infinite-processor machine (Span).
- C) $T_1$ is initialization time; $T_\infty$ is garbage collection time.
- D) $T_1$ is the first iteration; $T_\infty$ is the final iteration.
<details><summary>Answer</summary>

**B.** $T_1$ (Work) is the total number of operations performed across all threads. $T_\infty$ (Span or Critical Path Length) is the length of the longest chain of sequential dependencies. The ratio $P = T_1 / T_\infty$ represents the maximum theoretical parallelism.
- Ref: [modules/14-parallel-algorithms-concurrency-and-interview-execution.md](../modules/14-parallel-algorithms-concurrency-and-interview-execution.md)
</details>

#### Q-DSA-067 · Brent's Theorem Upper Bound · difficulty 2 · single
According to Brent's Theorem, what is the upper bound on execution time $T_p$ for an algorithm with Work $T_1$ and Span $T_\infty$ running on $p$ processors with a greedy scheduler?
- A) $T_p \le T_1 \cdot p$
- B) $T_p \le \frac{T_1 - T_\infty}{p} + T_\infty \le \frac{T_1}{p} + T_\infty$
- C) $T_p \le T_\infty / p$
- D) $T_p \le \log_p(T_1)$
<details><summary>Answer</summary>

**B.** Brent's Theorem proves that a greedy scheduler guarantees execution time $T_p \le \frac{T_1 - T_\infty}{p} + T_\infty$. As long as the processor count $p \ll T_1 / T_\infty$, the first term $\frac{T_1}{p}$ dominates, achieving near-linear parallel speedup.
- Ref: [modules/14-parallel-algorithms-concurrency-and-interview-execution.md](../modules/14-parallel-algorithms-concurrency-and-interview-execution.md)
</details>

#### Q-DSA-068 · Lock-Free CAS Mechanics · difficulty 2 · single
What does the atomic Compare-And-Swap (CAS) instruction do?
- A) It swaps two memory addresses without checking values.
- B) It compares the value at a memory location with an expected value, and if and only if they are identical, modifies the location to a new desired value as a single atomic CPU cycle.
- C) It acquires an operating system mutex lock.
- D) It invalidates the L1 cache.
<details><summary>Answer</summary>

**B.** CAS is a hardware atomic read-modify-write primitive: `CAS(address, expected, desired)`. If `*address == expected`, it updates `*address = desired` and returns `true`. If another thread modified the value, CAS fails and returns `false`, allowing lock-free retry loops without blocking mutexes.
- Ref: [modules/14-parallel-algorithms-concurrency-and-interview-execution.md](../modules/14-parallel-algorithms-concurrency-and-interview-execution.md)
</details>

#### Q-DSA-069 · The ABA Problem · difficulty 2 · single
How does the ABA Problem manifest in lock-free concurrent programming, and how is it resolved?
- A) Pointers overflow 32-bit bounds; resolved with BigInt.
- B) A memory location changes from $A \to B \to A$; a thread's CAS succeeds assuming no changes occurred, despite intervening structural mutations. Resolved via tagged/versioned pointers `(ptr, version)`.
- C) Threads deadlock waiting for locks; resolved via timeout.
- D) CPUs reorder instructions; resolved with memory fences.
<details><summary>Answer</summary>

**B.** Thread 1 reads value $A$ at memory location $M$. While preempted, Thread 2 modifies $M$ to $B$, and then back to $A$. When Thread 1 runs CAS, it compares $M$ with $A$ and succeeds, even though underlying data structures referenced by $A$ may have been freed or reallocated. Pairing each pointer with an incrementing 64-bit version counter ensures that `(A, v1)` fails to match `(A, v2)`.
- Ref: [modules/14-parallel-algorithms-concurrency-and-interview-execution.md](../modules/14-parallel-algorithms-concurrency-and-interview-execution.md)
</details>

#### Q-DSA-070 · UMPIRE Framework · difficulty 1 · single
In the UMPIRE technical interview framework, what do the letters stand for?
- A) Understand, Match, Plan, Implement, Review, Evaluate
- B) Universal, Monadic, Primitive, Iterative, Recursive, Exhaustive
- C) Unit, Module, Package, Integration, Regression, End-to-End
- D) Update, Mutate, Process, Index, Retrieve, Export
<details><summary>Answer</summary>

**A.** UMPIRE is the industry-standard interview methodology:
1. **Understand**: Clarify inputs, edge cases, bounds.
2. **Match**: Map problem characteristics to algorithmic patterns.
3. **Plan**: Formulate invariants, pseudocode, target complexities.
4. **Implement**: Clean, modular code without extraneous state.
5. **Review**: Dry-run with concrete examples and boundary cases.
6. **Evaluate**: Articulate Time and Space complexities and trade-offs.
- Ref: [modules/14-parallel-algorithms-concurrency-and-interview-execution.md](../modules/14-parallel-algorithms-concurrency-and-interview-execution.md)
</details>

#### Q-DSA-071 · Multi-Threaded Data Race · difficulty 2 · single
What is the formal definition of a **data race** in concurrent memory models?
- A) When two threads execute at different clock speeds.
- B) When two or more concurrent threads access the same memory location simultaneously without synchronization, and at least one access is a write.
- C) When a program runs out of threads.
- D) When a lock is held for longer than 1 second.
<details><summary>Answer</summary>

**B.** In the C++20, Java, and Rust memory models, a data race occurs when two or more memory actions in different threads access the same memory location concurrently, at least one is a write, and no synchronization (e.g. mutex, atomic acquire-release fence) orders them. Data races cause undefined behavior.
- Ref: [modules/14-parallel-algorithms-concurrency-and-interview-execution.md](../modules/14-parallel-algorithms-concurrency-and-interview-execution.md)
</details>

#### Q-DSA-072 · Python vs JS Interview Idioms · difficulty 1 · single
In a live coding interview, why is Python's `heapq` preferred over JavaScript for priority queue problems unless a heap class is pre-provided?
- A) Python executes faster than C++.
- B) JavaScript has no native built-in Priority Queue / Heap class in its standard library (`Array.prototype` only provides $O(n \log n)$ sorting), requiring candidates to write a 40-line `MinHeap` class from scratch.
- C) Python standard library heaps are $O(1)$ for all operations.
- D) JavaScript does not support recursion.
<details><summary>Answer</summary>

**B.** Unlike Python (`heapq`), Java (`PriorityQueue`), or C++ (`std::priority_queue`), JavaScript has no built-in binary heap or priority queue. Implementing `MinHeap` consumes 10–15 minutes of interview time. In TypeScript environments, candidates must either use pre-provided data structures or clarify with the interviewer if a heap can be stubbed.
- Ref: [modules/14-parallel-algorithms-concurrency-and-interview-execution.md](../modules/14-parallel-algorithms-concurrency-and-interview-execution.md)
</details>

#### Q-DSA-073 · Coordinate Encoding Optimization · difficulty 2 · single
When tracking visited cells in a 2D grid graph of size $R \times C$ ($C \le 1000$), why is packing coordinates as `r * C + c` superior to string template keys `` `${r},${c}` ``?
- A) Numbers cannot collide; strings always collide.
- B) Number packing operates in a single CPU cycle ($O(1)$) with zero heap memory allocation and garbage collection churn, whereas string interpolation allocates thousands of temporary string objects in the V8 heap.
- C) V8 cannot hash strings.
- D) Strings limit coordinates to 100.
<details><summary>Answer</summary>

**B.** String interpolation `` `${r},${c}` `` allocates a new string object and computes its hash for every neighbor check. In a $1000 \times 1000$ grid with $4 \times 10^6$ transitions, this creates massive heap allocation and GC pauses. Packing into a 32-bit integer `r * C + c` (or using a flat 1-D typed array `new Uint8Array(R * C)`) executes in zero-allocation CPU cycles.
- Ref: [modules/14-parallel-algorithms-concurrency-and-interview-execution.md](../modules/14-parallel-algorithms-concurrency-and-interview-execution.md)
</details>

#### Q-DSA-074 · Parallel Merge Sort Scalability · difficulty 3 · single
In Parallel Merge Sort, why does parallelizing only the two recursive sort calls while leaving the merge step sequential fail to achieve massive multicore scalability?
- A) Sequential merge takes $O(n)$ time, so the critical path Span is $T_\infty(n) = T_\infty(n/2) + O(n) = O(n)$, yielding parallelism of only $T_1 / T_\infty = O(\log n)$.
- B) Because Merge Sort is an unstable sort.
- C) Because processors overheat during sequential merges.
- D) Because memory cannot be shared across threads.
<details><summary>Answer</summary>

**A.** By the Span Law, execution time can never be faster than the critical path $T_\infty$. If merging takes $O(n)$ sequential time, $T_\infty = O(n)$. Total work is $T_1 = O(n \log n)$. The maximum theoretical parallelism is $\frac{T_1}{T_\infty} = \frac{O(n \log n)}{O(n)} = O(\log n)$. For $n = 10^6$, $\log_2 n \approx 20$, meaning adding more than 20 cores yields diminishing returns. A fully parallel merge using binary search partitions reduces span to $O(\log^3 n)$, unlocking parallelism of $O(n / \log^2 n)$.
- Ref: [modules/14-parallel-algorithms-concurrency-and-interview-execution.md](../modules/14-parallel-algorithms-concurrency-and-interview-execution.md)
</details>

#### Q-DSA-075 · Boundary Testing Rigor · difficulty 2 · multi
Which of the following test inputs represent critical boundary edge cases that candidates must verify before declaring an algorithm complete? (Select all that apply)
- A) Empty array `[]` or null tree root
- B) Single-element input `[x]`
- C) Array where all elements are identical `[5, 5, 5, 5]`
- D) Array sorted in reverse order
- E) Extremal integer values (`-2^31`, `2^31 - 1`) testing for arithmetic overflow
<details><summary>Answer</summary>

**A, B, C, D, E.** All five represent classical structural and mathematical edge cases that reveal off-by-one errors, infinite loops, null pointer dereferences, worst-case partitioning degradation, and 32-bit arithmetic overflows.
- Ref: [modules/14-parallel-algorithms-concurrency-and-interview-execution.md](../modules/14-parallel-algorithms-concurrency-and-interview-execution.md)
</details>

---

## Part 2: Timed Mock Examination (90 Minutes)

This mock examination simulates a comprehensive **Staff-Level DSA Technical Interview Loop** (4 problems, 90 minutes).

### Problem 1: Monotonic Window Optimization (20 Minutes · 25 Points)
Given an integer array `nums` and a sliding window of size `k`, find the maximum value in each sliding window as it moves from left to right.
1. Design an algorithm running in strictly $O(n)$ time and $O(k)$ auxiliary space.
2. Prove why standard `Array.prototype.slice` + `Math.max` fails the complexity requirements.
3. Write clean, working TypeScript code using a monotonic double-ended queue.

<details><summary>Model Answer & Scoring Rubric</summary>

**1. Algorithm & Invariant**:
Maintain a Monotonic Decreasing Deque of array indices.
- *Invariant*: Indices in the deque correspond to elements sorted in strictly decreasing order: `nums[deque[0]] > nums[deque[1]] > ...`.
- For each incoming index $i$:
  - Pop expired indices from the front: `while (deque[0] <= i - k) deque.shift()`.
  - Pop indices from the back whose values are $\le nums[i]$: `while (nums[deque[last]] <= nums[i]) deque.pop()`.
  - Push $i$ to the back.
  - For $i \ge k - 1$, record `nums[deque[0]]` as the window maximum.

**2. Complexity Proof**:
- Naive `slice(i, i + k)` takes $O(k)$ per window across $n - k + 1$ windows, totaling $O(n \cdot k)$ time (quadratic for $k = n/2$).
- Monotonic Deque: Every element is pushed at most once and popped at most once. Total deque operations $\le 2n$, proving strictly $O(n)$ time and $O(k)$ space.

**3. TypeScript Implementation**:
```typescript
export function maxSlidingWindow(nums: number[], k: number): number[] {
  const result: number[] = [];
  const deque: number[] = []; // stores indices
  let head = 0; // head pointer to simulate O(1) unshift

  for (let i = 0; i < nums.length; i++) {
    // Evict expired
    if (head < deque.length && deque[head]! <= i - k) {
      head++;
    }
    // Evict smaller elements from back
    while (deque.length > head && nums[deque[deque.length - 1]!]! <= nums[i]!) {
      deque.pop();
    }
    deque.push(i);

    if (i >= k - 1) {
      result.push(nums[deque[head]!]!);
    }
  }
  return result;
}
```

**Scoring Rubric (25 Points)**:
- 10 pts: Correct monotonic invariant and $O(n)$ amortized proof.
- 10 pts: Clean implementation avoiding $O(n)$ `array.shift()` bottleneck.
- 5 pts: Proper handling of edge cases ($k = 1$, $k = n$, negative numbers).
</details>

---

### Problem 2: Topological Graph Scheduling with Cycle Audit (25 Minutes · 25 Points)
You are given $n$ tasks labeled $0$ to $n-1$ and a list of prerequisites `[u, v]` indicating task $v$ must be completed before task $u$ ($v \to u$).
1. Design an algorithm to output a valid execution schedule if possible, or an empty list if tasks have circular dependencies.
2. Trace the step-by-step execution on graph with vertices $0, 1, 2, 3$ and edges $1 \to 0, 2 \to 0, 3 \to 1, 3 \to 2$.
3. Analyze the exact Time and Auxiliary Space complexities in terms of $V$ and $E$.

<details><summary>Model Answer & Scoring Rubric</summary>

**1. Design**:
Use Kahn's algorithm (BFS with in-degrees):
- Build adjacency list `adj` and in-degree array `inDegree` of size $V$.
- Enqueue all vertices with `inDegree[u] === 0`.
- Dequeue vertex $u$, append to `order`, and for each neighbor $v \in adj[u]$: decrement `inDegree[v]`. If `inDegree[v] === 0`, enqueue $v$.
- If `order.length === n`, return `order`; otherwise return `[]` (cycle detected).

**2. Trace**:
- Graph: $1 \to 0, 2 \to 0, 3 \to 1, 3 \to 2$.
- In-degrees: $0: 2, 1: 1, 2: 1, 3: 0$.
- Queue initially: `[3]`.
- Step 1: Pop 3 $\to$ `order = [3]`. Dec in-degree of 1 ($0$), 2 ($0$). Enqueue 1, 2. Queue: `[1, 2]`.
- Step 2: Pop 1 $\to$ `order = [3, 1]`. Dec in-degree of 0 ($1$). Queue: `[2]`.
- Step 3: Pop 2 $\to$ `order = [3, 1, 2]`. Dec in-degree of 0 ($0$). Enqueue 0. Queue: `[0]`.
- Step 4: Pop 0 $\to$ `order = [3, 1, 2, 0]`. Queue empty.
- Valid schedule: `[3, 1, 2, 0]`.

**3. Complexity**:
- **Time**: $O(V + E)$ (each vertex enqueued once, each edge traversed once).
- **Space**: $O(V + E)$ (adjacency list $O(V + E)$, in-degree array $O(V)$, queue $O(V)$).

**Scoring Rubric (25 Points)**:
- 10 pts: Full Kahn's algorithm or 3-color DFS implementation.
- 5 pts: Accurate cycle detection logic.
- 5 pts: Deterministic execution trace.
- 5 pts: Correct $O(V + E)$ complexity analysis.
</details>

---

### Problem 3: Patience Sorting LIS with Exact Predecessor Reconstruction (25 Minutes · 25 Points)
The standard $O(n \log n)$ LIS algorithm computes the *length* of the Longest Increasing Subsequence, but the `tails` array does not contain the actual subsequence elements.
1. Formulate the predecessor pointer invariant required to reconstruct the exact subsequence in $O(n \log n)$ time.
2. Implement the full algorithm returning one valid longest increasing subsequence.

<details><summary>Model Answer & Scoring Rubric</summary>

**1. Predecessor Invariant**:
- Maintain `tailsIndices[len]`: stores the *original array index* of the minimal ending element of an increasing subsequence of length `len + 1`.
- Maintain `parent[i]`: stores the index of the predecessor element in `nums` that extends to `nums[i]`.
- When updating `tailsIndices[idx] = i`:
  - If `idx > 0`, set `parent[i] = tailsIndices[idx - 1]`.
  - If `idx === 0`, set `parent[i] = -1` (no predecessor).
- After scanning all elements, backtrack from the index stored at `tailsIndices[last]` using `parent` pointers to recover the exact sequence in reverse.

**2. Implementation**:
```typescript
export function reconstructLIS(nums: number[]): number[] {
  if (nums.length === 0) return [];
  const tailsIndices: number[] = [];
  const parent = new Array<number>(nums.length).fill(-1);

  for (let i = 0; i < nums.length; i++) {
    const x = nums[i]!;
    let lo = 0;
    let hi = tailsIndices.length;
    while (lo < hi) {
      const mid = lo + ((hi - lo) >>> 1);
      if (nums[tailsIndices[mid]!]! >= x) {
        hi = mid;
      } else {
        lo = mid + 1;
      }
    }

    if (lo > 0) {
      parent[i] = tailsIndices[lo - 1]!;
    }

    if (lo === tailsIndices.length) {
      tailsIndices.push(i);
    } else {
      tailsIndices[lo] = i;
    }
  }

  // Reconstruct path
  const lis: number[] = [];
  let curr = tailsIndices[tailsIndices.length - 1]!;
  while (curr !== -1) {
    lis.push(nums[curr]!);
    curr = parent[curr]!;
  }
  return lis.reverse();
}
```

**Scoring Rubric (25 Points)**:
- 10 pts: Proper explanation of why `tails` does not hold the actual sequence.
- 10 pts: Correct parent pointer tracking during binary search updates.
- 5 pts: Correct backtracking and order reversal.
</details>

---

### Problem 4: High-Concurrency Consistent Ring Router (20 Minutes · 25 Points)
Design a production-grade Consistent Hash Ring data structure:
1. Support dynamic addition and removal of physical nodes.
2. Support virtual nodes ($V = 100$) to guarantee uniform load distribution.
3. Support binary search key lookups in $O(\log(N \cdot V))$ time.
4. Explain how this structure protects cache clusters from cascading failures during node crash events.

<details><summary>Model Answer & Scoring Rubric</summary>

**1. Design & Implementation**:
- Nodes are hashed along a 32-bit integer ring $[0, 2^{32} - 1]$.
- Each physical node creates $V$ virtual nodes (e.g. `node#vn0`, `node#vn1`).
- The ring is stored as a sorted array of `{ hash, node }`.
- When querying `getNode(key)`: compute `hash(key)`, perform binary search (`lowerBound`) on the ring. If `lo === ring.length`, wrap around to index 0.

**2. Cascading Failure Protection**:
- In standard modulo hashing (`key % N`), losing 1 node changes $N \to N - 1$, causing $(N - 1)/N \approx 100\%$ of keys to map to new servers. Every backend cache misses simultaneously, causing the entire database tier to collapse under load (cache stampede).
- In Consistent Hashing, losing 1 node relocates only $1/N$ of keys (those belonging to the failed node's partitions). Furthermore, virtual nodes interleave partitions uniformly across *all* surviving servers, distributing the remapped workload evenly instead of overloading a single adjacent neighbor.

**Scoring Rubric (25 Points)**:
- 10 pts: Working ring structure with virtual nodes and binary search lookups.
- 10 pts: In-depth architectural articulation of cache stampede protection and $1/N$ remapping bound.
- 5 pts: Clean edge-case handling (empty ring, wrap-around at $2^{32} - 1$).
</details>

---

## Part 3: Grading & Scoring Matrix

| Total Score | Level Equivalent | Readiness Assessment |
|---|---|---|
| **90–100 Points** | **Staff / Principal SWE** | Flawless invariant formulation, $O(1)$ memory consciousness, robust concurrent & distributed theory. |
| **75–89 Points** | **Senior SWE (L5)** | Strong algorithmic intuition, clean implementation, handles edge cases with minimal prompting. |
| **60–74 Points** | **Mid-Level SWE (L4)** | Correct core logic, but minor gaps in formal proofs or asymptotic edge cases. |
| **< 60 Points** | **Needs Additional Practice** | Revisit Modules 01–14, re-verify proofs, and practice timed problem sets. |
