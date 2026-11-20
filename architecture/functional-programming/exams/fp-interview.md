# Functional Programming Question Bank & Mock Examination

This bank contains 65 original questions covering purely functional foundations, persistent data structures, algebraic error handling, laziness, pure state, functional parallelism, property-based testing, parser combinators, monoids, functors, monads, applicatives, traversals, trampolines, rank-2 `ST`, and pull-based stream transducers.

---

## Part 1: Domain Question Banks (Questions 1–65)

## Domain 1: Foundations, Referential Transparency & Persistent ADTs

### Q-FP-001 · Foundations & RT · difficulty 1 · single

Which definition captures **referential transparency** (RT) as formalized by Christopher Strachey?

- A) An expression is referentially transparent if it compiles without mutable `var` declarations anywhere in the project.
- B) An expression `e` is referentially transparent if, for all programs `p`, every occurrence of `e` in `p` can be replaced by the result of evaluating `e` without changing the meaning of `p`.
- C) A function is referentially transparent if it returns a primitive type rather than a heap-allocated object reference.
- D) An expression is referentially transparent if it executes in $O(1)$ time and allocates zero heap memory.

<details><summary>Answer</summary>

**B.** Strachey's definition of referential transparency is semantic: substituting an expression with its evaluated value leaves program behavior unchanged across every context `p`. This enables the substitution model of evaluation and equational reasoning.

- Why not A: Purity is modular and local; an expression can be RT while encapsulating local mutation (contextual purity) or coexisting with impure modules elsewhere.
- Why not C: Returning immutable heap-allocated values (like `List` or `Some(42)`) preserves RT completely.
- Why not D: Computational complexity and allocation count are orthogonal to semantic purity.
- Ref: [modules/01-referential-transparency-and-lambda-calculus.md](../modules/01-referential-transparency-and-lambda-calculus.md), https://www.scala-lang.org/api/3.x/

</details>

### Q-FP-002 · Foundations & RT · difficulty 2 · scenario

Consider the Scala snippet `val x = new StringBuilder("Hello"); val r1 = x.append(", World").toString; val r2 = x.append(", World").toString`. Why does replacing `x` in `r1` and `r2` with `new StringBuilder("Hello")` change the program's output?

- A) Because `StringBuilder.append` mutates internal state in place, violating referential transparency so `x` cannot be freely substituted.
- B) Because `StringBuilder` overrides `equals` using reference identity instead of structural equality.
- C) Because Scala `val` bindings re-evaluate their right-hand side on every reference like `def`.
- D) Because `toString` triggers garbage collection of the underlying character buffer.

<details><summary>Answer</summary>

**A.** In the original code, `r1` evaluates to `"Hello, World"` and `r2` evaluates to `"Hello, World, World"` because `append` mutates `x` in place. Substituting `new StringBuilder("Hello")` into both occurrences yields `"Hello, World"` for both `r1` and `r2`, proving `x.append(...)` is not referentially transparent.

- Why not B: The divergence occurs on `String` values (`r1 != r2`), not on `StringBuilder.equals`.
- Why not C: `val` is evaluated eagerly once at definition time; `def` re-evaluates on each call.
- Why not D: `toString` copies characters into an immutable `String`; it does not trigger GC.
- Ref: [modules/01-referential-transparency-and-lambda-calculus.md](../modules/01-referential-transparency-and-lambda-calculus.md), https://docs.scala-lang.org/scala3/book/fp-what-is-fp.html

</details>

### Q-FP-003 · Lambda Calculus · difficulty 2 · single

In untyped $\lambda$-calculus, which reduction step represents **$\beta$-reduction** of $(\lambda x.\; \lambda y.\; x\; y)\; z$ (assuming $y$ is not free in $z$)?

- A) $\lambda y.\; z\; y$
- B) $\lambda x.\; x\; z$
- C) $z$
- D) $\lambda w.\; (\lambda y.\; w\; y)\; z$

<details><summary>Answer</summary>

**A.** $\beta$-reduction substitutes the argument $z$ for every free occurrence of the outer bound parameter $x$ in the body $\lambda y.\; x\; y$, yielding $\lambda y.\; z\; y$.

- Why not B: $z$ binds to the outermost abstraction parameter $x$, not the inner parameter $y$.
- Why not C: $\eta$-contraction of $\lambda y.\; z\; y$ simplifies to $z$ only in a subsequent $\eta$-step, not in the single $\beta$-reduction step.
- Why not D: Renaming $x$ to $w$ is $\alpha$-conversion, not $\beta$-reduction.
- Ref: [modules/01-referential-transparency-and-lambda-calculus.md](../modules/01-referential-transparency-and-lambda-calculus.md), https://plato.stanford.edu/entries/lambda-calculus/

</details>

### Q-FP-004 · Parametricity · difficulty 3 · single

Using Reynolds's parametricity and Wadler's free theorems, if a total pure function in a polymorphic language has the type signature `def f[A](xs: List[A]): List[A]` (with no type-class constraints or reflection), which theorem MUST hold for every function `g: A => B`?

- A) `f(xs).length == xs.length`
- B) `f(xs.map(g)) == f(xs).map(g)`
- C) `f(xs) == xs.reverse`
- D) `f(xs ++ ys) == f(xs) ++ f(ys)`

<details><summary>Answer</summary>

**B.** By Wadler's free theorem for the natural transformation `List[A] => List[A]`, because `f` has zero knowledge of `A`'s structure, any element-level transformation `g` commutes with `f`: mapping `g` before `f` equals applying `f` first and then mapping `g` (`f` can only drop, duplicate, or reorder elements by position).

- Why not A: `f` could drop elements (`_ => Nil`) or duplicate elements (`xs ++ xs`), changing the length.
- Why not C: `xs.reverse` is only one of infinitely many valid implementations (e.g., `identity`, `take(1)`, `xs ++ xs`).
- Why not D: `xs => xs.take(1)` satisfies the type signature yet `take(1)([1] ++ [2]) != take(1)([1]) ++ take(1)([2])`.
- Ref: [modules/01-referential-transparency-and-lambda-calculus.md](../modules/01-referential-transparency-and-lambda-calculus.md), https://dl.acm.org/doi/10.1145/99370.99404

</details>

### Q-FP-005 · Tail Recursion · difficulty 2 · multi

Which conditions must hold for the Scala 3 compiler to optimize a recursive method annotated with `@tailrec` into a constant-stack JVM loop? (Select all that apply.)

- A) Every recursive call must appear strictly in tail position with no pending operation on its return value.
- B) The method must be `final`, `private`, or defined inside an `object` / local block so subclasses cannot override it via dynamic dispatch.
- C) The method must take at least one `LazyList` parameter.
- D) Mutual recursion between two separate top-level methods is automatically fused into a single `@tailrec` jump.

<details><summary>Answer</summary>

**A, B.** For the JVM backend to emit a jump (`goto`) rather than a stack frame, the recursive call must be the very last action (tail position) and statically resolved (`private`, `final`, or non-overridable).

- Why not C: `@tailrec` works on any parameter types (`Int`, `List`, etc.); laziness is unrelated.
- Why not D: The JVM lacks general tail-call elimination across distinct methods, so mutual recursion fails `@tailrec` compilation and requires a trampoline (`TailRec`).
- Ref: [modules/01-referential-transparency-and-lambda-calculus.md](../modules/01-referential-transparency-and-lambda-calculus.md), https://docs.scala-lang.org/scala3/reference/

</details>

### Q-FP-006 · Persistent Data Structures · difficulty 1 · single

Given an immutable persistent singly-linked list `xs = Cons(1, Cons(2, Cons(3, Nil)))`, what is the time and heap-allocation complexity of constructing `ys = Cons(0, xs)` and `zs = xs.tail`?

- A) $O(n)$ time and $O(n)$ heap allocation because immutable lists must defensively copy all nodes.
- B) $O(1)$ time and $O(1)$ heap allocation via structural sharing of the unmodified tail nodes.
- C) $O(\log n)$ time due to path copying from the root.
- D) $O(1)$ time for `Cons`, but $O(n)$ time for `tail`.

<details><summary>Answer</summary>

**B.** Because nodes in a persistent singly-linked list are strictly immutable, prepending `0` allocates a single `Cons(0, xs)` cell pointing directly to `xs`, and `tail` simply returns the existing pointer `xs.tail` in $O(1)$ time with zero copying.

- Why not A: Defensive copying is only required for mutable structures; immutability makes sharing completely safe.
- Why not C: $O(\log n)$ path copying applies to branching trees (like tries or RRB-vectors), not singly-linked lists at the head.
- Why not D: Returning `xs.tail` is a single pointer dereference in $O(1)$.
- Ref: [modules/02-persistent-data-structures-and-structural-sharing.md](../modules/02-persistent-data-structures-and-structural-sharing.md), https://www.cs.cmu.edu/~rwh/theses/okasaki.pdf

</details>

### Q-FP-007 · Persistent Data Structures · difficulty 2 · scenario

In an immutable singly-linked list `append(xs, ys)`, `xs` has length $n$ and `ys` has length $m$. How much memory is allocated, and which list is structurally shared?

- A) $O(n + m)$ nodes are allocated because both `xs` and `ys` must be copied.
- B) $O(m)$ nodes are allocated; `xs` is shared unchanged.
- C) $O(n)$ nodes are allocated (copying `xs`'s spine); `ys` is shared unchanged at the tail.
- D) $O(1)$ nodes are allocated by mutating the last `Cons` cell of `xs` to point to `ys`.

<details><summary>Answer</summary>

**C.** In a singly-linked list, `xs`'s last `Cons` cell currently points to `Nil` and cannot be mutated without breaking persistence for existing holders of `xs`. Therefore, `append(xs, ys)` rebuilds only the $n$ spine nodes of `xs` pointing to the existing unmodified `ys` head.

- Why not A: `ys` never needs copying because its tail links already terminate cleanly at `Nil`.
- Why not B: Rebuilding `ys` would not reconnect `xs`'s `Nil` terminator.
- Why not D: Mutating `xs`'s final `Cons` cell destroys immutability and violates referential transparency for callers still holding `xs`.
- Ref: [modules/02-persistent-data-structures-and-structural-sharing.md](../modules/02-persistent-data-structures-and-structural-sharing.md), https://www.cs.cmu.edu/~rwh/theses/okasaki.pdf

</details>

### Q-FP-008 · Stack Safety & Folds · difficulty 2 · scenario

A production batch job runs naive recursive `foldRight` over a persistent `List` of 25,000 elements and crashes with `StackOverflowError` (JVM) / `RangeError: Maximum call stack size exceeded` (Node.js). Why does `foldRight` overflow while `foldLeft` succeeds on the same list?

- A) `foldRight` pushes a stack frame for every element before applying the combining function `f` on the unwind, whereas `foldLeft` updates an accumulator in tail position before recursing.
- B) `foldRight` evaluates the list in reverse order using $O(n^2)$ heap allocations.
- C) `foldLeft` executes on a background thread pool automatically.
- D) `foldRight` disables JIT inlining in V8 and HotSpot.

<details><summary>Answer</summary>

**A.** Naive `foldRight(Cons(h, t), z)(f)` computes `f(h, foldRight(t, z)(f))`—calling `f` _after_ the recursive call returns, which prevents tail-call elimination and requires $O(n)$ live call-stack frames. `foldLeft(Cons(h, t), z)(f)` computes `foldLeft(t, f(z, h))(f)` in tail position, executing in $O(1)$ stack space.

- Why not B: Naive `foldRight` allocates $O(1)$ heap per step; its failure is $O(n)$ call-stack frames.
- Why not C: `foldLeft` is completely synchronous and single-threaded.
- Why not D: JIT inlining cannot eliminate non-tail-recursive stack growth over 25,000 dynamic list nodes.
- Ref: [modules/02-persistent-data-structures-and-structural-sharing.md](../modules/02-persistent-data-structures-and-structural-sharing.md), https://nodejs.org/api/test.html

</details>

### Q-FP-009 · Algebraic Data Types · difficulty 2 · single

How is an Algebraic Data Type (ADT) sized mathematically when combining **sum types** ($+$) and **product types** ($\times$)? Given `enum Expr { case Lit(b: Boolean); case Pair(x: Boolean, y: Boolean) }`, how many distinct inhabited values exist in `Expr`?

- A) $4$
- B) $6$
- C) $8$
- D) $2$

<details><summary>Answer</summary>

**B.** `Boolean` has cardinality $2$. `Lit(b)` contributes $2$ values, and `Pair(x, y)` is a product type contributing $2 \times 2 = 4$ values. As a disjoint sum type, `Expr` has cardinality $2 + (2 \times 2) = 6$.

- Why not A: $4$ counts only `Pair`, ignoring `Lit`.
- Why not C: $8$ multiplies $2 \times 4$ instead of summing the two variants.
- Why not D: $2$ counts only the number of constructors, not their inhabitants.
- Ref: [modules/02-persistent-data-structures-and-structural-sharing.md](../modules/02-persistent-data-structures-and-structural-sharing.md), https://docs.scala-lang.org/scala3/reference/enums/adts.html

</details>

### Q-FP-010 · Catamorphisms · difficulty 3 · single

What characterizes a **catamorphism** such as `fold[A, B](t: Tree[A])(f: A => B)(g: (B, B) => B): B`?

- A) It replaces each data constructor (`Leaf`, `Branch`) of an inductive ADT with an arbitrary algebra (`f`, `g`) of the target type `B`, generalizing all structural recursions (`size`, `depth`, `map`, `maximum`) over `Tree[A]`.
- B) It mutates tree nodes in place during a breadth-first traversal.
- C) It generates an infinite coinductive tree from a seed state `S`.
- D) It converts any non-tail-recursive function into a tail-recursive function automatically.

<details><summary>Answer</summary>

**A.** A catamorphism is the unique homomorphism from the initial algebra (`Tree[A]`) to any target algebra `(f: A => B, g: (B, B) => B)`, substituting constructors uniformly so operations like `size`, `depth`, and `map` become single-line fold algebras.

- Why not B: Catamorphisms are pure structural folds over immutable inductive data.
- Why not C: Generating a structure from a seed is an **anamorphism** (`unfold`), the dual of a catamorphism.
- Why not D: Naive `foldTree` is not tail-recursive without CPS/trampolining.
- Ref: [modules/02-persistent-data-structures-and-structural-sharing.md](../modules/02-persistent-data-structures-and-structural-sharing.md), https://research.utwente.nl/en/publications/functional-programming-with-bananas-lenses-envelopes-and-barbed-w

</details>

### Q-FP-011 · Stack Safety · difficulty 2 · ordering

Arrange the steps required to implement a **stack-safe** `foldRight` on an immutable singly-linked `List[A]` using `foldLeft` (assuming non-lazy strict evaluation):

1. Traverse the reversed list with `foldLeft`, applying `f(a, b)` to accumulate the final result `B`.
2. Pass the original `List[A]` into `reverse` implemented via `foldLeft(xs, Nil)((acc, a) => Cons(a, acc))`.
3. Return the accumulated `B` value in $O(1)$ stack space.

- A) 1 → 2 → 3
- B) 2 → 1 → 3
- C) 3 → 2 → 1
- D) 2 → 3 → 1

<details><summary>Answer</summary>

**B.** First reverse `xs` iteratively via `foldLeft` (`2`), then `foldLeft` over the reversed list applying `(b, a) => f(a, b)` (`1`), and finally return the accumulated `B` (`3`), keeping total call-stack depth $O(1)$ at the cost of $O(n)$ temporary heap cells for the reversed spine.

- Why not A, C, D: Applying `foldLeft` before reversing processes elements left-to-right instead of right-to-left, and returning before folding yields the reversed list instead of `B`.
- Ref: [modules/02-persistent-data-structures-and-structural-sharing.md](../modules/02-persistent-data-structures-and-structural-sharing.md), https://docs.scala-lang.org/scala3/api/scala/collection/immutable/List.html

</details>

### Q-FP-012 · Structural Sharing · difficulty 2 · hands-on

In `examples/typescript/01-persistent-and-errors.test.ts`, what negative counterexample and structural-sharing invariant are proved by executable tests?

- A) Naive recursive `foldRightUnsafe` throws `RangeError` on 25,000 elements while `foldLeft` and `foldRightSafe` compute the exact sum, and `Cons(0, xs).tail === xs` holds by strict reference equality.
- B) `Tree` catamorphisms automatically parallelize across Web Workers.
- C) JavaScript `Array.prototype.push` preserves structural sharing without mutation.
- D) `foldRightUnsafe` runs faster than `foldLeft` on 25,000 elements.

<details><summary>Answer</summary>

**A.** Running `mise exec -- npm run test:ts` executes `01-persistent-and-errors.test.ts`, asserting `assert.throws(..., RangeError)` for `foldRightUnsafe` at $n = 25{,}000$, exact sum equality for `foldLeft` and `foldRightSafe`, and `assert.strictEqual(ys.tail, xs)` for structural sharing.

- Why not B, C, D: `Tree` folding is single-threaded, `Array.push` mutates in place, and `foldRightUnsafe` crashes with `RangeError` rather than running faster.
- Ref: [modules/02-persistent-data-structures-and-structural-sharing.md](../modules/02-persistent-data-structures-and-structural-sharing.md), https://nodejs.org/api/test.html

</details>

---

## Domain 2: Totality, Laziness & Pure State

### Q-FP-013 · Totality & Exceptions · difficulty 1 · single

Why do thrown exceptions (`throw new RuntimeException(...)`) violate referential transparency in pure functional programming?

- A) Because the result of an expression containing `throw` depends on the dynamic surrounding `try/catch` block rather than being substitutable uniformly across every context `p`.
- B) Because exceptions cannot carry stack traces across generic functions.
- C) Because `try/catch` blocks are always slower than `if/else` statements even on the happy path.
- D) Because exceptions cannot be typed in JVM bytecode.

<details><summary>Answer</summary>

**A.** Consider `val y = throw new Exception("fail"); try { x + y } catch { case _ => 43 }` versus inlining `throw` inside a different `try/catch` block: an expression's meaning becomes context-dependent on dynamic control-flow handlers, breaking Strachey's substitution property and hiding partiality from the type signature.

- Why not B: Stack traces are a JVM diagnostic detail, not the reason RT fails.
- Why not C: Happy-path `try` blocks have near-zero overhead on modern JVMs; the defect is semantic, not performance.
- Why not D: JVM checked exceptions exist in Java, though Scala treats all exceptions as unchecked.
- Ref: [modules/03-algebraic-error-handling-and-totality.md](../modules/03-algebraic-error-handling-and-totality.md), https://docs.scala-lang.org/scala3/book/fp-functional-error-handling.html

</details>

### Q-FP-014 · Error Handling · difficulty 2 · single

Compare `Either[E, A]` and `Validated[NonEmptyList[E], A]` when validating a registration form with three independent fields (`name`, `email`, `age`). What happens if all three fields are invalid?

- A) `Either` with `flatMap`/`for`-comprehension collects all three errors; `Validated` stops at the first error.
- B) Both `Either` and `Validated` collect all three errors automatically when combined with `flatMap`.
- C) `Either`'s monadic `flatMap` short-circuits on the first `Left`, whereas `Validated` combined via applicative `map2` accumulates all three errors into the `NonEmptyList`.
- D) `Validated` throws an aggregate exception if more than one field is invalid.

<details><summary>Answer</summary>

**C.** A `Monad` (`Either.flatMap`) imposes sequential data dependency—step 2 cannot even be constructed without the `Right` value of step 1—so it must fail fast on the first `Left`. `Validated` has no lawful `Monad`, only an `Applicative` instance (`map2`), evaluating all independent branches and combining `Invalid` error lists via a `Semigroup`.

- Why not A: The behavior is the exact opposite.
- Why not B: `Validated` does not even support a lawful monadic `flatMap` that accumulates errors.
- Why not D: `Validated` is a pure algebraic data type; it never throws exceptions.
- Ref: [modules/03-algebraic-error-handling-and-totality.md](../modules/03-algebraic-error-handling-and-totality.md), https://typelevel.org/cats/datatypes/validated.html

</details>

### Q-FP-015 · Error Handling · difficulty 2 · single

What does `traverse[A, B](xs: List[A])(f: A => Option[B]): Option[List[B]]` do, and why is it strictly superior to `sequence(xs.map(f))`?

- A) It applies `f` to every element in a single pass and short-circuits immediately on the first `None`, avoiding allocating an intermediate `List[Option[B]]`.
- B) It runs `f` in parallel across CPU cores.
- C) It filters out all `None` elements and returns `Some` of the remaining values.
- D) It retries `f` whenever `None` is returned.

<details><summary>Answer</summary>

**A.** `sequence(xs.map(f))` traverses `xs` twice (once to build `List[Option[B]]`, then again in `sequence`). `traverse` fuses mapping and effect folding into one pass and exits early on the first `None`.

- Why not B: `Option` traversal is sequential unless combined with an explicit parallel context.
- Why not C: Filtering out `None` (`collect`/`flatten`) loses failure information; `traverse` returns `None` if _any_ element produces `None`.
- Why not D: `Option` carries no retry semantics.
- Ref: [modules/03-algebraic-error-handling-and-totality.md](../modules/03-algebraic-error-handling-and-totality.md), https://typelevel.org/cats/typeclasses/traverse.html

</details>

### Q-FP-016 · Strictness & Laziness · difficulty 1 · single

What is the key difference between **call-by-name** (`=> A`) and **call-by-need** (`lazy val` / memoized thunk) in Scala?

- A) Call-by-name evaluates the argument zero times or _multiple_ times (once per reference), whereas call-by-need evaluates the thunk at most _once_ and caches the result for subsequent accesses.
- B) Call-by-name evaluates eagerly at the call site; call-by-need evaluates asynchronously on a thread pool.
- C) Call-by-need cannot be used inside recursive data structures.
- D) Call-by-name automatically prevents memory leaks in infinite streams.

<details><summary>Answer</summary>

**A.** In call-by-name, every occurrence of parameter `x: => A` re-invokes the thunk `() => expr`. Smart constructors like `Stream.cons` cache the thunk into `lazy val` (call-by-need) so expensive head/tail expressions execute at most once.

- Why not B: Call-by-name is non-strict (not eager), and call-by-need is synchronous memoization.
- Why not C: Call-by-need (`lazy val`) is the foundation of recursive memoized streams (`LazyList`).
- Why not D: Memoization is actually what causes head retention if the stream head stays reachable.
- Ref: [modules/04-strictness-laziness-and-corecursion.md](../modules/04-strictness-laziness-and-corecursion.md), https://docs.scala-lang.org/scala3/book/fp-laziness.html

</details>

### Q-FP-017 · Laziness & Evolution · difficulty 3 · scenario

A legacy Scala 2 service suffers `OutOfMemoryError` when iterating `val lines = Stream.from(1).map(transform)` to element 10,000,000, and also throws an unexpected exception during stream _construction_ even before any element is demanded. Which two mechanisms explain these failures, and what changed in Scala 2.13 / Scala 3?

- A) `val lines` retains a GC root to the head of the memoized list (causing $O(n)$ heap retention), AND Scala 2 `Stream` evaluated its **head strictly** at construction; Scala 2.13/3 replaced `Stream` with `LazyList`, which is lazy in both head and tail.
- B) Scala 2 `Stream` stored elements in an off-heap `ByteBuffer` that never freed memory.
- C) `LazyList` deletes elements as soon as `map` is called, whereas `Stream` stored elements in a `HashMap`.
- D) Scala 2 `Stream` was eager in both head and tail, identical to `List`.

<details><summary>Answer</summary>

**A.** In Scala 2, `Stream` had a strict head and lazy tail (`Cons(hd: A, tl: () => Stream[A])`), forcing the first element immediately and risking premature failure. Worse, binding a memoized stream to a `val` (instead of a `def` or passing it directly without keeping the head pointer alive) prevents the GC from reclaiming already-traversed prefix cells. Scala 2.13/3 introduced `LazyList` with both lazy head and lazy tail, though callers must still avoid holding the head reference across large iterations.

- Why not B, C: Neither uses `ByteBuffer` or `HashMap`; both are singly-linked lazy cons structures.
- Why not D: Scala 2 `Stream` had a lazy tail (`#::`), not an eager tail like `List`.
- Ref: [modules/04-strictness-laziness-and-corecursion.md](../modules/04-strictness-laziness-and-corecursion.md), https://www.scala-lang.org/api/3.x/scala/collection/immutable/LazyList.html

</details>

### Q-FP-018 · Stream Fusion & Corecursion · difficulty 2 · single

When evaluating `LazyList(1, 2, 3, 4).map(_ + 10).filter(_ % 2 == 0).toList`, how does non-strict `foldRight`-based `map` and `filter` execute compared to strict `List`?

- A) It builds an intermediate `LazyList(11, 12, 13, 14)` completely before filtering begins.
- B) It interleaves `map` and `filter` element-by-element (deforestation / single-pass fusion), transforming `1 -> 11` then filtering `11` before ever inspecting `2`.
- C) It reverses the list twice to preserve tail recursion.
- D) It evaluates `filter` before `map` automatically.

<details><summary>Answer</summary>

**B.** Because `map` produces a non-strict `cons` whose tail is demanded one element at a time by `filter`, computation alternates between `map` and `filter` for each element without materializing intermediate lists. Short-circuiting combinators like `find` or `take(1)` terminate after inspecting only the prefix needed.

- Why not A: Building the entire intermediate collection is what strict `List` does, not non-strict `LazyList`.
- Why not C, D: Evaluation order remains left-to-right (`map` then `filter` per element), with zero reversal.
- Ref: [modules/04-strictness-laziness-and-corecursion.md](../modules/04-strictness-laziness-and-corecursion.md), https://dl.acm.org/doi/10.1145/1291151.1291199

</details>

### Q-FP-019 · Corecursion · difficulty 2 · single

What distinguishes **corecursion** (`unfold[A, S](z: S)(f: S => Option[(A, S)]): LazyList[A]`) from standard structural recursion?

- A) Structural recursion consumes finite data toward a base case, whereas corecursion _produces_ potentially infinite data from a seed state and only requires **productivity** (generating the next output constructor in finite steps).
- B) Corecursion requires a stack frame per infinite element, whereas recursion runs in $O(1)$ stack.
- C) Corecursion is only valid for binary trees, never linear streams.
- D) Corecursion cannot terminate even if `f` returns `None`.

<details><summary>Answer</summary>

**A.** Corecursion (anamorphism) is dual to recursion (catamorphism): instead of shrinking an input toward termination, it unfolds a seed `S` lazily one guarded constructor (`cons`) at a time, remaining well-defined on infinite sequences (`fibs`, `from(n)`) as long as each step is productive.

- Why not B: Because the recursive call sits inside a lazy tail thunk, demanding elements iteratively consumes $O(1)$ stack.
- Why not C: `unfold` is the canonical generator for linear streams (`LazyList`).
- Why not D: Returning `None` from `f` emits `Empty` and cleanly terminates a finite stream.
- Ref: [modules/04-strictness-laziness-and-corecursion.md](../modules/04-strictness-laziness-and-corecursion.md), https://citeseerx.ist.psu.edu/document?repid=rep1&type=pdf&doi=1973c600b0f71092a35733a02d7392c3e9a34c43

</details>

### Q-FP-020 · Purely Functional State · difficulty 1 · single

Why does a purely functional random number generator expose `def nextInt: (Int, RNG)` instead of `def nextInt(): Int`?

- A) Returning the updated state `(Int, RNG)` alongside the generated value preserves referential transparency: calling `rng.nextInt` twice on the same `rng` always yields the exact same `(Int, RNG)`.
- B) Returning a tuple avoids heap allocation on the JVM.
- C) `def nextInt(): Int` cannot compile in Scala 3.
- D) A tuple guarantees thread-safe shared mutation of the seed integer.

<details><summary>Answer</summary>

**A.** Mutating an internal seed inside `nextInt()` causes repeated calls on the same `rng` reference to return different integers, breaking referential transparency. Explicitly threading `(A, RNG)` turns state transitions into pure functions `S => (A, S)`.

- Why not B: Returning a boxed tuple allocates (unless specialized or flattened via `opaque type`/unboxed return); the motivation is purity, not zero allocation.
- Why not C: Impure methods compile normally in Scala 3.
- Why not D: Nothing is mutated; each step creates a new `RNG` value with the next seed.
- Ref: [modules/05-purely-functional-state-and-combinators.md](../modules/05-purely-functional-state-and-combinators.md), https://docs.scala-lang.org/scala3/book/fp-pure-functions.html

</details>

### Q-FP-021 · Purely Functional State · difficulty 2 · scenario

You have `type Rand[+A] = RNG => (A, RNG)` and implement `sequence[A](fs: List[Rand[A]]): Rand[List[A]]` using `foldRight(fs, unit(List.empty[A]))((f, acc) => map2(f, acc)(_ :: _))`. When the resulting `Rand[List[A]]` is applied to `rng0`, in what order are the `RNG` states threaded through `fs`?

- A) From the _last_ element of `fs` back to the first element.
- B) From the _first_ element of `fs` to the last element (`f1` receives `rng0` and passes `rng1` to `f2`, and so on), because `map2(f, acc)` evaluates `f(rng)` first and passes the resulting `rng2` to `acc(rng2)`.
- C) All elements of `fs` receive the identical `rng0`, producing duplicate values.
- D) In random hash order.

<details><summary>Answer</summary>

**B.** Although `foldRight` combines _combinators_ structurally from the tail, `map2(ra, rb)(f)` produces a function `rng => { val (a, rng2) = ra(rng); val (b, rng3) = rb(rng2); (f(a, b), rng3) }`. Thus `f1` (at the head) runs first on `rng0` and threads `rng1` into the accumulated tail `acc`.

- Why not A: The state function built by `map2` explicitly runs its left operand `f` before its right operand `acc`.
- Why not C: Passing `rng0` to both `ra` and `rb` would be a bug in `map2` violating sequential state threading.
- Why not D: List ordering is deterministic.
- Ref: [modules/05-purely-functional-state-and-combinators.md](../modules/05-purely-functional-state-and-combinators.md), https://www.scala-lang.org/api/3.x/

</details>

### Q-FP-022 · Purely Functional State · difficulty 3 · single

In Scala 3, why is `opaque type State[S, +A] = S => (A, S)` preferred over `case class State[S, +A](run: S => (A, S))` in performance-sensitive pure state pipelines?

- A) `opaque type` erases completely to the underlying function `S => (A, S)` in compiled bytecode while keeping `State[S, A]` abstract outside its defining scope, eliminating wrapper object allocations.
- B) `opaque type` automatically parallelizes `flatMap` chains across fibers.
- C) `case class State` cannot have covariant `+A` type parameters in Scala 3.
- D) `opaque type` converts recursive `State` loops into native C structs.

<details><summary>Answer</summary>

**A.** `opaque type State[S, +A] = S => (A, S)` gives compile-time type abstraction and extension methods with zero runtime boxing of the `State` wrapper class, whereas `case class State` allocates an extra heap wrapper on every `map`/`flatMap` step.

- Why not B: `State` remains strictly sequential; `opaque type` is a representation optimization.
- Why not C: `case class State[S, +A]` supports `+A` just fine because `A` is in covariant return position of `S => (A, S)`.
- Why not D: Scala 3 runs on the JVM/JS/Native; `opaque type` erases to the JVM function reference, not a C struct.
- Ref: [modules/05-purely-functional-state-and-combinators.md](../modules/05-purely-functional-state-and-combinators.md), https://docs.scala-lang.org/scala3/reference/other-new-features/opaques.html

</details>

### Q-FP-023 · State Machines · difficulty 2 · scenario

In the pure candy dispenser FSM (`Machine(locked: Boolean, candies: Int, coins: Int)`), initial state is `{ locked: true, candies: 5, coins: 10 }`. The input sequence `['Coin', 'Turn', 'Coin', 'Coin', 'Turn', 'Turn', 'Coin', 'Turn', 'Coin', 'Turn']` is simulated purely via `State.modify` + `sequence`. What is the resulting `(coins, candies, locked)` state?

- A) `(15, 0, true)`
- B) `(14, 1, true)`
- C) `(13, 2, false)`
- D) `(14, 1, false)`

<details><summary>Answer</summary>

**B.** Tracing the rules (inserting a coin on locked machine with candies > 0 unlocks and adds 1 coin; turning knob on unlocked machine dispenses 1 candy and locks; coins on unlocked machines and turns on locked machines are ignored): `'Coin','Turn'` -> `(11,4,true)`; `'Coin','Coin','Turn'` (2nd coin ignored) -> `(12,3,true)`; `'Turn'` (locked, ignored); `'Coin','Turn'` -> `(13,2,true)`; `'Coin','Turn'` -> `(14,1,true)`.

- Why not A: Only 4 valid `'Coin','Turn'` cycles occurred; the duplicate `'Coin'` did not add a 5th coin.
- Why not C: Four valid turns dispensed 4 candies (`5 - 4 = 1`), leaving 14 coins.
- Why not D: Each successful `'Turn'` leaves the machine in `locked = true`.
- Ref: [modules/05-purely-functional-state-and-combinators.md](../modules/05-purely-functional-state-and-combinators.md), https://docs.scala-lang.org/scala3/book/fp-pure-functions.html

</details>

### Q-FP-024 · Laziness & State · difficulty 2 · hands-on

In `examples/typescript/02-laziness-and-state.test.ts`, how is single-pass stream fusion (deforestation) verified deterministically?

- A) A trace array records each `map` and `filter` invocation on an infinite `unfold` stream; calling `findStream` for the first even square $> 10$ halts after `n = 4` with interleaved trace `['map(1)', 'filter(1)', ..., 'map(4)', 'filter(16)']`, never evaluating `n >= 5`.
- B) Node.js V8 heap snapshots assert zero garbage collection pauses.
- C) A `for` loop iterates 1,000,000 numbers and checks elapsed wall-clock milliseconds.
- D) `Object.freeze` checks that the stream object is deeply frozen.

<details><summary>Answer</summary>

**A.** Tracking thunk invocations in `02-laziness-and-state.test.ts` proves both call-by-need memoization (`headEvalCount === 1` across 3 reads) and interleaved lazy fusion (`map(1)` immediately followed by `filter(1)` rather than evaluating all `map` calls first).

- Why not B, C, D: Wall-clock timings and GC snapshots are flaky; deterministic trace assertions prove evaluation order directly.
- Ref: [modules/04-strictness-laziness-and-corecursion.md](../modules/04-strictness-laziness-and-corecursion.md), https://nodejs.org/api/test.html

</details>

---

## Domain 3: Functional Parallelism & Property-Based Testing

### Q-FP-025 · Functional Parallelism · difficulty 2 · scenario

Suppose `Par.fork(a)` is implemented naively over a `java.util.concurrent.ExecutorService` as `es => es.submit(() => a(es).get)`. What happens when executing `Par.fork(Par.fork(Par.unit(42)))` on a `Executors.newFixedThreadPool(1)`?

- A) It completes in $O(1)$ time using work stealing.
- B) It **deadlocks permanently**: the outer task occupies the sole worker thread and blocks in `.get()` waiting for the inner task, which sits queued waiting for the same sole worker thread to become free.
- C) It throws `RejectedExecutionException` immediately.
- D) It silently executes sequentially on the calling thread without touching the pool.

<details><summary>Answer</summary>

**B.** Blocking `.get()` inside a submitted task ties up a pool thread while waiting on work submitted to the same bounded pool. With a fixed pool of size $N$, any nesting of $N+1$ blocking `fork`s exhausts all threads and deadlocks.

- Why not A: Fixed thread pools do not perform work-stealing continuation resumption for blocking `.get()` calls.
- Why not C: `newFixedThreadPool` uses an unbounded `LinkedBlockingQueue`, so the inner task is queued, not rejected.
- Why not D: `es.submit` dispatches onto the pool thread, not the caller thread.
- Ref: [modules/06-purely-functional-parallelism-and-laws.md](../modules/06-purely-functional-parallelism-and-laws.md), https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/ExecutorService.html

</details>

### Q-FP-026 · Functional Parallelism · difficulty 3 · single

How does the non-blocking continuation-passing `Par` design (`type Par[A] = ExecutorService => Future[A]` where `Future[A]` accepts a callback `cb: A => Unit` and uses an actor / atomic reference) eliminate the `fork` deadlock?

- A) `fork` submits a runnable that registers callbacks and returns immediately, releasing the worker thread before downstream tasks run, so thread occupancy never nests across `fork` boundaries.
- B) It spawns an unbounded number of OS threads whenever a pool is full.
- C) It disables parallelism and runs all `Par` computations synchronously on the main thread.
- D) It catches `DeadlockError` and retries after 100ms.

<details><summary>Answer</summary>

**A.** When `Future` uses non-blocking callbacks (`cb: A => Unit`), `fork(pa)` simply submits `() => pa(es)(cb)` and finishes the outer runnable as soon as `pa` registers its continuation. Even a 1-thread pool can execute arbitrarily deep `fork` chains without blocking any worker thread.

- Why not B: Spawning unbounded OS threads defeats bounded resource control and crashes under load.
- Why not C: Tasks still execute concurrently across all available pool threads when capacity $> 1$.
- Why not D: Deadlocks are avoided structurally by eliminating blocking `.get()`, not via timeouts or retries.
- Ref: [modules/06-purely-functional-parallelism-and-laws.md](../modules/06-purely-functional-parallelism-and-laws.md), https://typelevel.org/cats-effect/docs/concepts

</details>

### Q-FP-027 · Functional Parallelism · difficulty 2 · single

In the `Par` algebra, why should `map2` combine `Unit` or lazy thunks via `lazyUnit[A](a: => A): Par[A] = fork(unit(a))` rather than evaluating `a` strictly inside `unit(a)`?

- A) `unit(a)` is strict in its argument, so `unit(expensiveComputation)` would run sequentially on the caller thread _before_ `Par` can fork it onto a worker pool; `lazyUnit` wraps `unit(a)` inside `fork` so evaluation is deferred to the pool.
- B) `unit(a)` cannot accept primitive types.
- C) `lazyUnit` automatically memoizes every call across different `ExecutorService` instances.
- D) `unit(a)` is deprecated in Scala 3.

<details><summary>Answer</summary>

**A.** Because Scala and TypeScript evaluate function arguments eagerly (call-by-value), calling `unit(sum(ints))` computes `sum(ints)` synchronously on the calling thread before `unit` even executes. Wrapping `unit(a)` in `fork` (`=> Par[A]`) delays evaluation until a worker thread executes the forked task.

- Why not B, D: `unit` is a core primitive of `Par` and works for any type `A`.
- Why not C: `fork` defers execution onto the `ExecutorService`; it does not globally cache results across pools.
- Ref: [modules/06-purely-functional-parallelism-and-laws.md](../modules/06-purely-functional-parallelism-and-laws.md), https://docs.scala-lang.org/scala3/book/fp-laziness.html

</details>

### Q-FP-028 · Functional Parallelism · difficulty 2 · single

Given `choiceN[A](n: Par[Int])(choices: List[Par[A]]): Par[A]` and `chooser[A, B](pa: Par[A])(choices: A => Par[B]): Par[B]`, what common algebraic operation does `chooser` actually correspond to?

- A) `Monoid.combine`
- B) `Monad.flatMap`
- C) `Functor.map`
- D) `Foldable.foldRight`

<details><summary>Answer</summary>

**B.** `chooser(pa)(f)` runs `pa`, inspects its dynamic result `a: A`, and selects the next `Par[B]` computation via `f(a: A)`—which is identical in signature and sequential-dependency semantics to `flatMap` (`bind`).

- Why not A: `Monoid.combine` takes two values of the same type `(A, A) => A`, not a dependent continuation `A => Par[B]`.
- Why not C: `map` transforms `A => B` without flattening a nested `Par[Par[B]]`.
- Why not D: `foldRight` collapses a collection rather than sequencing dependent parallel computations.
- Ref: [modules/06-purely-functional-parallelism-and-laws.md](../modules/06-purely-functional-parallelism-and-laws.md), https://typelevel.org/cats/typeclasses/monad.html

</details>

### Q-FP-029 · Functional Parallelism · difficulty 3 · single

In `Par`, if the identity law `map(y)(id) == y` holds and `map(map(y)(g))(f) == map(y)(f compose g)` holds, why does `Par.fork(x) == x` hold **denotationally** yet require care **operationally**?

- A) Denotationally, `fork(x)` evaluates to the exact same value `A` as `x`; operationally, `fork` inserts an asynchronous thread-pool boundary, so `fork(x) == x` can only hold if the `ExecutorService` implementation does not deadlock on `fork`.
- B) `fork(x)` always returns `Option[A]` whereas `x` returns `A`.
- C) `fork(x)` reverses the tuple order of `map2`.
- D) `fork(x)` discards exceptions whereas `x` propagates them.

<details><summary>Answer</summary>

**A.** `fork(x) == x` is an algebraic law stating that wrapping a parallel computation in `fork` does not alter its semantic result (`A`). However, under a blocking-`.get()` implementation on a bounded thread pool, `fork(x)` can deadlock while `x` completes—demonstrating how operational implementation bugs can break denotational laws.

- Why not B, C, D: `fork` preserves the exact return type `Par[A]`, does not alter `map2` tuple ordering, and should preserve error semantics.
- Ref: [modules/06-purely-functional-parallelism-and-laws.md](../modules/06-purely-functional-parallelism-and-laws.md), https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Thread.html

</details>

### Q-FP-030 · Property-Based Testing · difficulty 1 · single

In algebraic property-based testing, what is the role of `Gen[A]` when defined as `State[RNG, A]`?

- A) `Gen[A]` is a pure, deterministic generator of values of type `A` driven by an explicit `RNG` seed, making every generated test suite 100% reproducible given its initial seed.
- B) `Gen[A]` mutates a global `/dev/urandom` file descriptor on every test case.
- C) `Gen[A]` exhaustively enumerates all $2^{64}$ `Long` values before starting a test.
- D) `Gen[A]` compiles unit tests to native assembly.

<details><summary>Answer</summary>

**A.** Modeling `Gen[A]` as `State[RNG, A]` guarantees that test generation is a pure function of the seed `RNG`. When a property fails, recording the exact seed lets any engineer replay the identical failure deterministically.

- Why not B: Global entropy sources are non-reproducible and break referential transparency.
- Why not C: Exhaustive enumeration of $2^{64}$ values is infeasible; `Gen` samples bounded streams of cases.
- Why not D: `Gen` is a library combinator, not a compiler backend.
- Ref: [modules/07-property-based-testing-and-shrinking.md](../modules/07-property-based-testing-and-shrinking.md), https://www.cs.tufts.edu/~nr/cs257/archive/john-hughes/quick.pdf

</details>

### Q-FP-031 · Property-Based Testing · difficulty 2 · single

Why does `SGen[A]` (`Int => Gen[A]`) parameterize generators by a **size** integer when testing recursive structures like `List[A]` or `Tree[A]`?

- A) Size scaling starts with small inputs (size 0, 1, 2) to catch trivial edge cases early and gradually scales up to larger structures, preventing unbounded exponential tree growth.
- B) The `Int` parameter specifies how many CPU threads run the generator.
- C) `SGen[A]` is only required because Scala 3 cannot infer `Gen[A]`.
- D) `Int` represents the maximum allowed test runtime in milliseconds.

<details><summary>Answer</summary>

**A.** Testing with small sizes first catches boundary bugs (`Nil`, single-element lists) immediately and keeps recursive generators (like `Branch(l, r)`) from recursing infinitely by decreasing `size / 2` in recursive calls.

- Why not B, C, D: `SGen`'s `Int` strictly controls structural size/depth of generated test cases, not threading, type inference, or timeouts.
- Ref: [modules/07-property-based-testing-and-shrinking.md](../modules/07-property-based-testing-and-shrinking.md), https://scalacheck.org/documentation.html

</details>

### Q-FP-032 · Shrinking · difficulty 3 · single

Compare **type-directed shrinking** (classic ScalaCheck / Haskell QuickCheck `Shrink[A]`) with **integrated shrinking** (Hypothesis / `fast-check` / Hedgehog). What structural advantage does integrated shrinking provide?

- A) Integrated shrinking operates on the underlying PRNG choice tree (or generator structure), so invariants enforced by `flatMap` and `filter` (such as "sorted non-empty even list") are **automatically preserved** during shrinking without writing custom `Shrink` instances that might emit invalid counterexamples.
- B) Integrated shrinking always shrinks in $O(1)$ without re-running the property predicate.
- C) Type-directed shrinking never finds smaller counterexamples for integers.
- D) Integrated shrinking disables random generation and uses SAT solvers exclusively.

<details><summary>Answer</summary>

**A.** In type-directed shrinking (`Shrink[List[Int]]`), a separate `shrink` function has no knowledge of generator constraints like `suchThat(_.nonEmpty)` or `flatMap` dependencies, so shrinking can produce invalid test cases that violate the precondition. Integrated shrinking shrinks the generator's internal choice sequence, preserving all `map`/`flatMap` invariants by construction.

- Why not B: Shrinking still re-runs the property predicate on candidate smaller trees to verify the failure persists.
- Why not C: Type-directed shrinking handles primitive integers well; its weakness is compositional invariants under `flatMap`.
- Why not D: `fast-check` and Hypothesis still use PRNG-driven sampling, then shrink the recorded choice tree.
- Ref: [modules/07-property-based-testing-and-shrinking.md](../modules/07-property-based-testing-and-shrinking.md), https://fast-check.dev/docs/core-blocks/arbitraries/

</details>

### Q-FP-033 · Property-Based Testing · difficulty 2 · multi

When checking a property `forAll(g)(p)` over a finite domain vs. an infinite domain, which statements are accurate? (Select all that apply.)

- A) For a tiny finite domain (e.g., `Boolean` or `Option[Boolean]`), exhaustive enumeration `Prop.check` can **prove** the property holds universally rather than merely failing to falsify it.
- B) Passing 100 random trials over `List[Int]` proves universal correctness for all lists in $\mathbb{Z}^*$.
- C) Expressing algebraic properties using universal quantifiers (e.g., `xs.reverse.reverse == xs`) avoids duplicating the implementation logic inside the test oracle.
- D) Generators with `flatMap` cannot express dependent test data such as a pair `(list, indexInBounds)`.

<details><summary>Answer</summary>

**A, C.** Exhaustive checking over small finite domains gives mathematical proof, while random sampling over infinite domains provides probabilistic falsification. Checking algebraic invariants (`reverse.reverse == id`) avoids tautological test duplication.

- Why not B: Random sampling over infinite domains can falsify a property with 1 counterexample, never universally prove it.
- Why not D: `flatMap` is specifically how dependent generators (like generating `n` then choosing `0 <= idx < n`) are constructed.
- Ref: [modules/07-property-based-testing-and-shrinking.md](../modules/07-property-based-testing-and-shrinking.md), https://scalameta.org/munit/docs/integrations/scalacheck.html

</details>

### Q-FP-034 · Functional Parallelism · difficulty 2 · hands-on

In `examples/typescript/03-par-deadlock-and-nonblocking.test.ts`, what does the negative test prove about `BlockingPar` vs. non-blocking continuation `Par`?

- A) `blockingFork(() => blockingFork(() => blockingUnit(42)))` raises `DeadlockDetectedError` on a capacity-1 pool (and depth-3 raises on capacity-2), whereas non-blocking continuation `Par` completes 50 nested `fork`s cleanly on a 1-worker async scheduler.
- B) `BlockingPar` completes 50 nested forks faster than continuation `Par`.
- C) `choiceN` fails whenever choices are lazy.
- D) `parMap` executes items sequentially one after another with `setTimeout(100)`.

<details><summary>Answer</summary>

**A.** `03-par-deadlock-and-nonblocking.test.ts` deterministically detects worker-slot starvation when nested blocking tasks exceed pool capacity, contrasting directly with continuation-passing `Par`, which yields worker slots upon callback registration and survives 50 nested forks on 1 worker.

- Why not B, C, D: Blocking `Par` deadlocks instead of completing faster, `choiceN` works cleanly with `lazyUnit`, and `parMap` runs without artificial `setTimeout` delays.
- Ref: [modules/06-purely-functional-parallelism-and-laws.md](../modules/06-purely-functional-parallelism-and-laws.md), https://nodejs.org/api/test.html

</details>

---

## Domain 4: Parser Combinators & Monoidal Reduction

### Q-FP-035 · Parser Combinators · difficulty 2 · single

In an algebraic `Parsers[Parser]` interface, why is `flatMap` required alongside `or` and `product` (`**`) when parsing context-sensitive grammars (such as `"3abc"` where the digit specifies how many characters follow)?

- A) `product` (`**`) combines two parsers whose structure is fixed statically before parsing begins, whereas `flatMap` lets the second parser depend dynamically on the runtime value parsed by the first.
- B) `product` cannot parse strings longer than 2 characters.
- C) `or` only works on single characters without `flatMap`.
- D) `flatMap` enables automatic regex backtracking without `attempt`.

<details><summary>Answer</summary>

**A.** `product` (an `Applicative` combinator) composes independent parsers statically (`Context-Free`). `flatMap` (monadic bind) passes the parsed value `a: A` into `f: A => Parser[B]`, enabling data-dependent grammars (`Context-Sensitive`) like length-prefixed frames.

- Why not B, C: `product` and `or` work on arbitrary string parsers.
- Why not D: `flatMap` commits errors after consuming input; `attempt` is still needed for backtracking.
- Ref: [modules/08-parser-combinators-and-algebraic-design.md](../modules/08-parser-combinators-and-algebraic-design.md), https://typelevel.org/cats-parse/

</details>

### Q-FP-036 · Parser Combinators · difficulty 2 · scenario

Consider `val p = (string("ab") ** string("c")) or string("abd")` run on input `"abd"`. Under default committed-choice semantics (without `attempt`), what happens?

- A) It succeeds with `"abd"` because `or` always backtracks unconditionally on any failure.
- B) It **fails**: `string("ab")` consumes 2 characters, then `string("c")` fails on `'d'`; because input was consumed, the failure is **committed**, preventing `or` from trying `string("abd")` unless wrapped in `attempt`.
- C) It loops infinitely consuming zero characters.
- D) It succeeds with `"ab"` and ignores `'d'`.

<details><summary>Answer</summary>

**B.** Committing on first consumed character prevents exponential backtracking blowup and produces precise error messages (`Expected "c"` at offset 2) instead of generic top-level failures. Wrapping the left branch in `attempt(string("ab") ** string("c"))` resets `isCommitted = false` on failure so `or` falls back to `string("abd")`.

- Why not A: Unconditional backtracking causes exponential worst-case runtime and obscures nested syntax errors.
- Why not C: Input offset advances by 2, so there is no infinite loop.
- Why not D: `string("c")` fails, so the entire left `product` fails.
- Ref: [modules/08-parser-combinators-and-algebraic-design.md](../modules/08-parser-combinators-and-algebraic-design.md), https://hackage.haskell.org/package/parsec

</details>

### Q-FP-037 · Parser Combinators · difficulty 2 · single

Why does an algebraic parser library provide a primitive `slice[A](p: Parser[A]): Parser[String]` alongside `map`?

- A) `slice` returns the exact raw substring consumed by `p`, avoiding intermediate allocations (like constructing `List[Char]` via `many(char('a')).map(_.mkString)`) when only the matched text slice is needed.
- B) `slice` splits a string by commas using `String.split`.
- C) `slice` reverses the input buffer in place.
- D) `slice` strips whitespace from JSON keys automatically.

<details><summary>Answer</summary>

**A.** Implementing `many(p)` followed by `slice` lets the interpreter track start/end offsets (`loc.offset` to `loc.offset + consumed`) and extract a single substring slice in $O(1)$ without allocating a `List` of intermediate results for every character.

- Why not B, C, D: `slice` simply returns the consumed input span of any parser `p`, independent of commas, mutation, or whitespace.
- Ref: [modules/08-parser-combinators-and-algebraic-design.md](../modules/08-parser-combinators-and-algebraic-design.md), https://typelevel.org/cats-parse/

</details>

### Q-FP-038 · Parser Combinators · difficulty 3 · single

What bug occurs if `many(p)` is applied to a parser `p` that can succeed while consuming zero characters (such as `succeed(1)` or `regex("\\s*")`) without a zero-width guard?

- A) `many(p)` throws `ParseError("unexpected EOF")` on the first step.
- B) `many(p)` diverges into an **infinite loop** (or `OutOfMemoryError`) repeatedly matching `p` at the exact same input offset without advancing.
- C) `many(p)` silently skips one character per iteration.
- D) `many(p)` automatically converts `p` into `many1(p)`.

<details><summary>Answer</summary>

**B.** If `p` succeeds with `consumed == 0`, the cursor offset never advances, so `many(p)` keeps invoking `p` at the same offset forever, accumulating results until memory or stack is exhausted. Production parser libraries reject or break on zero-width progress inside `many`.

- Why not A: A zero-width match returns `Success`, not `Failure`.
- Why not C, D: `many` cannot invent characters to skip or turn nullable parsers into non-nullable ones without an explicit guard.
- Ref: [modules/08-parser-combinators-and-algebraic-design.md](../modules/08-parser-combinators-and-algebraic-design.md), https://hackage.haskell.org/package/parsec

</details>

### Q-FP-039 · Monoids & Semigroups · difficulty 1 · single

Which algebraic laws define a lawful **Monoid** `(A, combine, empty)`?

- A) Commutativity and idempotence only.
- B) **Associativity** (`combine(combine(x, y), z) == combine(x, combine(y, z))`) and **Left/Right Identity** (`combine(empty, x) == x == combine(x, empty)`).
- C) Distributivity over addition and multiplicative inverses.
- D) Reflexivity, symmetry, and transitivity.

<details><summary>Answer</summary>

**B.** A `Monoid` is a `Semigroup` (closed associative binary operation) equipped with a two-sided identity element `empty`. Commutativity is _not_ required (e.g., `String` concatenation and `List` concatenation are non-commutative monoids).

- Why not A: Commutativity and idempotence define a join-semilattice (CRDTs), not a general monoid.
- Why not C: Rings/fields require inverses and distributivity, not monoids.
- Why not D: Equivalence relations satisfy reflexivity, symmetry, and transitivity.
- Ref: [modules/09-monoids-foldables-and-parallel-reduction.md](../modules/09-monoids-foldables-and-parallel-reduction.md), https://typelevel.org/cats/typeclasses/monoid.html

</details>

### Q-FP-040 · Monoids & Parallelism · difficulty 2 · single

Why does **associativity** of a `Monoid[B]` enable balanced parallel reduction (`foldMapV`) over an indexed sequence of length $n$?

- A) Because associativity guarantees that arbitrary parenthesizations—such as splitting the sequence at the midpoint into left and right sub-trees—produce the exact same result as a sequential left-to-right or right-to-left fold, allowing $O(\log n)$ parallel tree depth.
- B) Because associativity implies `combine(a, b) == combine(b, a)` so worker results can be merged in arrival order without preserving sequence order.
- C) Because `empty` forces every element to be zero.
- D) Because associativity eliminates the need for `map` inside `foldMapV`.

<details><summary>Answer</summary>

**A.** Associativity means `(a + b) + (c + d) == ((a + b) + c) + d`, so splitting an array recursively at midpoints and reducing left and right halves concurrently yields identical results as long as the left half is combined on the left of the right half.

- Why not B: Associativity does _not_ imply commutativity (`"ab" + "cd" == "abcd"`, whereas `"cd" + "ab" == "cdab"`), so tree reduction must still preserve left-to-right positional order when merging subtree results.
- Why not C, D: `empty` handles the empty-sequence base case, and `foldMapV` still lifts elements `A => B` via `f`.
- Ref: [modules/09-monoids-foldables-and-parallel-reduction.md](../modules/09-monoids-foldables-and-parallel-reduction.md), https://typelevel.org/cats/typeclasses/monoid.html

</details>

### Q-FP-041 · Monoids · difficulty 3 · scenario

How does the `WC` (`Stub(chars)` \| `Part(lStub, words, rStub)`) monoid count words accurately in parallel over arbitrarily split character chunks of `"lorem ipsum dolor"`?

- A) By running a regex after concatenating the entire string back into memory first.
- B) Each `Part` tracks partial non-whitespace word fragments at its left (`lStub`) and right (`rStub`) boundaries plus complete interior `words`; when combining two `Part`s, if `a.rStub + b.lStub` is non-empty, they join into `1` completed middle word without re-scanning characters.
- C) By counting spaces only and subtracting 1.
- D) By requiring chunk boundaries to fall exclusively on whitespace characters.

<details><summary>Answer</summary>

**B.** Splitting `"lorem"` across chunk 1 (`Part("", 0, "lor")`) and chunk 2 (`Part("em", 0, "")`) leaves `"lor"` in `a.rStub` and `"em"` in `b.lStub`. When `wcMonoid.combine` merges them, `a.rStub.nonEmpty || b.lStub.nonEmpty` detects the bridged word and increments `words` by 1, preserving associativity for any split point!

- Why not A: Re-concatenating defeats parallel chunk reduction and requires $O(n)$ sequential scanning at the root.
- Why not C: Consecutive leading/trailing spaces (`"  foo  bar  "`) break space-counting heuristics.
- Why not D: `WC` specifically solves word counting across _arbitrary_ mid-word splits.
- Ref: [modules/09-monoids-foldables-and-parallel-reduction.md](../modules/09-monoids-foldables-and-parallel-reduction.md), https://typelevel.org/cats/typeclasses/monoid.html

</details>

### Q-FP-042 · Monoid Fusion · difficulty 2 · single

Given `productMonoid[A, B](ma: Monoid[A], mb: Monoid[B]): Monoid[(A, B)]` and `mapMergeMonoid[K, V](mv: Monoid[V]): Monoid[Map[K, V]]`, what practical benefit do composable monoids provide?

- A) Multiple aggregations (e.g., computing element count, sum, and per-key histogram) can be fused into a **single pass** over the data via `foldMap`, avoiding multiple traversals.
- B) They convert every `Map` into a sorted `Array` automatically.
- C) They eliminate the need for `equals` on keys `K`.
- D) They allow non-associative functions to become associative.

<details><summary>Answer</summary>

**A.** Monoids are closed under products, functions, options, and maps (`Map[K, V]` when `V` is a `Monoid`). Combining `(intAddition, intAddition)` via `productMonoid` computes both sum and length (for mean calculation) in one `foldMap` pass.

- Why not B, C, D: Map merging still relies on key hashing/equality, does not sort into arrays, and preserves (never repairs) associativity.
- Ref: [modules/09-monoids-foldables-and-parallel-reduction.md](../modules/09-monoids-foldables-and-parallel-reduction.md), https://typelevel.org/cats/typeclasses/monoid.html

</details>

### Q-FP-043 · Unlawful Monoids · difficulty 2 · hands-on

In `examples/typescript/04-parsers-and-monoids.test.ts` and `examples/scala/AlgebraicLaws.test.scala`, which two operations are falsified by `fast-check` / `ScalaCheck` as unlawful `Monoid` combiners?

- A) Integer addition and string concatenation.
- B) Integer subtraction (`(a - b) - c != a - (b - c)`) and IEEE 754 floating-point addition (`(a + b) + c != a + (b + c)` due to rounding).
- C) List concatenation and boolean `&&`.
- D) `Option[Int]` lifting and `productMonoid`.

<details><summary>Answer</summary>

**B.** Both TypeScript (`fc.check`) and Scala 3 (`Prop.forAll`) prove counterexamples where integer subtraction fails associativity (e.g., `(0 - 0) - 1 != 0 - (0 - 1)`) and IEEE 754 `double` addition loses low-order mantissa bits differently depending on parenthesization.

- Why not A, C, D: Integer addition (including two's-complement 32-bit wrap-around arithmetic modulo $2^{32}$ and arbitrary-precision `BigInt`), string concatenation, list concatenation, boolean `&&`, `Option[A]`, and `productMonoid` are all strictly associative.
- Ref: [modules/09-monoids-foldables-and-parallel-reduction.md](../modules/09-monoids-foldables-and-parallel-reduction.md), https://fast-check.dev/

</details>

### Q-FP-044 · Monoid Homomorphisms · difficulty 3 · single

A function $h: A \to B$ is a **monoid homomorphism** from $(A, \oplus_A, e_A)$ to $(B, \oplus_B, e_B)$ if $h(x \oplus_A y) = h(x) \oplus_B h(y)$ and $h(e_A) = e_B$. Which function is a valid monoid homomorphism?

- A) `_.length: String => Int` from `(String, +, "")` to `(Int, +, 0)`.
- B) `_.toInt: String => Int` from `(String, +, "")` to `(Int, +, 0)`.
- C) `Math.abs: Int => Int` from `(Int, +, 0)` to `(Int, +, 0)`.
- D) `_.length: List[Int] => Int` from `(List[Int], ++, Nil)` to `(Int, *, 1)`.

<details><summary>Answer</summary>

**A.** `(s1 + s2).length == s1.length + s2.length` and `"".length == 0`, so `String.length` preserves both the associative combiner and the identity element—allowing parallel length computation over chunks without concatenating strings.

- Why not B: `("1" + "2").toInt == 12 != 1 + 2`, and `"".toInt` is undefined.
- Why not C: `Math.abs(3 + (-5)) == 2 != Math.abs(3) + Math.abs(-5) == 8`.
- Why not D: `(xs ++ ys).length == xs.length + ys.length != xs.length * ys.length`, and `Nil.length == 0 != 1`.
- Ref: [modules/09-monoids-foldables-and-parallel-reduction.md](../modules/09-monoids-foldables-and-parallel-reduction.md), https://typelevel.org/cats/typeclasses/monoid.html

</details>

---

## Domain 5: Functors, Monads, Applicatives & Traverse

### Q-FP-045 · Functors · difficulty 1 · single

What are the two **Functor laws** for `F[_]` with `map[A, B](fa: F[A])(f: A => B): F[B]`?

- A) Identity (`map(fa)(id) == fa`) and Composition (`map(map(fa)(f))(g) == map(fa)(g compose f)`).
- B) Left identity (`unit(a).flatMap(f) == f(a)`) and Right identity (`m.flatMap(unit) == m`).
- C) Commutativity and idempotence.
- D) Homomorphism and interchange.

<details><summary>Answer</summary>

**A.** The Functor laws guarantee that `map` preserves structure without inspecting, reordering, dropping, or duplicating elements: mapping `identity` changes nothing, and two consecutive `map`s can always be fused into a single `map` of the composed function.

- Why not B: Those are the Monad identity laws.
- Why not C: Functors do not define a binary combination operator.
- Why not D: Homomorphism and interchange belong to `Applicative`.
- Ref: [modules/10-functors-monads-and-kleisli-composition.md](../modules/10-functors-monads-and-kleisli-composition.md), https://typelevel.org/cats/typeclasses/functor.html

</details>

### Q-FP-046 · Monads & Primitive Sets · difficulty 2 · multi

Which minimal sets of combinators can each serve as a complete basis to derive all standard `Monad[F[_]]` operations (`map`, `map2`, `flatMap`, `join`, `compose`)? (Select all that apply.)

- A) `unit` and `flatMap`
- B) `unit` and `compose` (Kleisli composition `f >=> g`)
- C) `unit`, `map`, and `join` (`F[F[A]] => F[A]`)
- D) `unit` and `map2` alone

<details><summary>Answer</summary>

**A, B, C.** In _FP in Scala_ Ch. 11 (M10), all three bases are algebraically equivalent: `flatMap(fa)(f) == join(map(fa)(f))`, `join(mma) == flatMap(mma)(identity)`, `compose(f, g)(a) == flatMap(f(a))(g)`, and `flatMap(fa)(f) == compose((_: Unit) => fa, f)(())`.

- Why not D: `unit` and `map2` define `Applicative`, which is strictly weaker than `Monad` and cannot express `join` or `flatMap` in general.
- Ref: [modules/10-functors-monads-and-kleisli-composition.md](../modules/10-functors-monads-and-kleisli-composition.md), https://typelevel.org/cats/typeclasses/monad.html

</details>

### Q-FP-047 · Kleisli Composition · difficulty 2 · single

How are the three **Monad laws** expressed cleanly in terms of Kleisli composition `compose[A, B, C](f: A => F[B], g: B => F[C]): A => F[C]` (`>=>`)?

- A) `compose(f, unit) == f`, `compose(unit, f) == f`, and `compose(compose(f, g), h) == compose(f, compose(g, h))` (monoid laws for Kleisli arrows).
- B) `compose(f, g) == compose(g, f)` (commutativity).
- C) `compose(f, f) == f` (idempotence).
- D) `compose(unit, unit) == join`.

<details><summary>Answer</summary>

**A.** Kleisli composition reveals that a `Monad` is simply a category (or monoid-like structure in endofunctors) where `unit` acts as the two-sided identity arrow and `>=>` is strictly associative.

- Why not B: Kleisli composition is not even type-compatible in reverse (`A => F[B]` and `B => F[C]` cannot swap when `A != C`), let alone commutative.
- Why not C: Applying an effectful function twice (`f >=> f`) generally runs the effect twice, not once.
- Why not D: `unit >=> unit` has type `A => F[A]`, whereas `join` has type `F[F[A]] => F[A]`.
- Ref: [modules/10-functors-monads-and-kleisli-composition.md](../modules/10-functors-monads-and-kleisli-composition.md), https://ncatlab.org/nlab/show/Kleisli+category

</details>

### Q-FP-048 · Scala 3 Type Lambdas · difficulty 3 · single

When defining `given stateMonad[S]: Monad[...]` in Scala 3 for `State[S, A]` (which has two type parameters `* -> * -> *`), how do you adapt it to `Monad[F[_]]` (which expects kind `* -> *`) without compiler plugins?

- A) Using a native Scala 3 type lambda: `Monad[[X] =>> State[S, X]]`.
- B) Using `Monad[State[S, _]]` because `_` always denotes a type lambda in Scala 3.
- C) Declaring `State` as `trait State[S]` with no second type parameter.
- D) Using `Monad[State]` raw without type arguments.

<details><summary>Answer</summary>

**A.** Scala 3 replaced Scala 2's verbose type-projection syntax `({type f[x] = State[S, x]})#f` and the `kind-projector` plugin (`State[S, *]`) with native type lambdas `[X] =>> State[S, X]`.

- Why not B: In Scala 3, `State[S, _]` (or `State[S, ?]`) denotes an existential wildcard type, _not_ a type lambda (`* -> *`).
- Why not C, D: `Monad` requires a unary type constructor `F[_]`; dropping `A` or omitting type arguments will fail kind-checking.
- Ref: [modules/10-functors-monads-and-kleisli-composition.md](../modules/10-functors-monads-and-kleisli-composition.md), https://docs.scala-lang.org/scala3/reference/new-types/type-lambdas.html

</details>

### Q-FP-049 · Applicative vs Monad · difficulty 2 · single

Why is `Applicative` strictly **less powerful** than `Monad`, and why is that reduced power a major architectural advantage in parsers, build systems, and RPC batching?

- A) Because `Applicative` (`map2`/`apply`) has no `flatMap` (`A => F[B]`), its computation graph is **statically known** before running any effects, enabling static optimization, automatic parallel batching (e.g., Facebook Haxl / Stitch), and error accumulation (`Validated`).
- B) Because `Applicative` cannot wrap primitive integers.
- C) Because `Applicative` skips all side effects at runtime.
- D) Because `Monad` cannot be implemented in TypeScript.

<details><summary>Answer</summary>

**A.** The principle of least power applies directly: `Monad.flatMap` introduces dynamic data dependencies where the next effect `f(a)` is opaque until `a` is computed. `Applicative` (`map2(fa, fb)`) keeps all sub-computations independent, enabling static inspection, error accumulation, and concurrent batching.

- Why not B, C, D: Both `Applicative` and `Monad` work over arbitrary types, compose effects, and can be encoded in TypeScript.
- Ref: [modules/11-applicative-and-traversable-functors.md](../modules/11-applicative-and-traversable-functors.md), https://www.staff.city.ac.uk/~ross/papers/Applicative.pdf

</details>

### Q-FP-050 · Applicative Laws · difficulty 3 · single

Which of the following are the four canonical **Applicative laws** (McBride & Paterson 2008)?

- A) Identity (`apply(unit(id))(v) == v`), Homomorphism (`apply(unit(f))(unit(x)) == unit(f(x))`), Interchange (`apply(u)(unit(y)) == apply(unit(f => f(y)))(u)`), and Associativity / Composition (`product(product(fa, fb), fc) ~= product(fa, product(fb, fc))`).
- B) Reflexivity, Symmetry, Transitivity, Antisymmetry.
- C) Left identity, Right identity, Distributivity, Commutativity.
- D) Totality, Termination, Productivity, Confluence.

<details><summary>Answer</summary>

**A.** These four laws ensure `unit` injects pure values/functions faithfully (identity & homomorphism), argument order doesn't alter pure application (interchange), and grouping independent effects with `map2`/`product` is associative up to tuple re-association.

- Why not B: Those are properties of partial orders / equivalence relations.
- Why not C: Applicatives need not be commutative (`List` zip/cartesian applicative) or distributive.
- Why not D: Those are rewriting/recursion properties, not the Applicative laws.
- Ref: [modules/11-applicative-and-traversable-functors.md](../modules/11-applicative-and-traversable-functors.md), https://www.staff.city.ac.uk/~ross/papers/Applicative.pdf

</details>

### Q-FP-051 · Applicative Composition · difficulty 3 · single

If `F[_]` and `G[_]` are both `Applicative` functors, is their composition `[X] =>> F[G[X]]` always an `Applicative`? What about `Monad` composition `[X] =>> F[G[X]]`?

- A) `Applicative` is **always closed under composition** (`F[G[_]]` is automatically an `Applicative`), whereas `Monad` does **not** compose in general without a `Traverse[G]` or monad transformer for the specific inner/outer pair.
- B) Neither `Applicative` nor `Monad` composes.
- C) `Monad` always composes automatically, whereas `Applicative` never composes.
- D) Both `Applicative` and `Monad` compose for all `F` and `G` identically.

<details><summary>Answer</summary>

**A.** Composing two `Applicative`s requires only `F.unit(G.unit(a))` and `F.map2(fga, fgb)(G.map2(_, _)(f))`. By contrast, implementing `join: F[G[F[G[A]]]] => F[G[A]]` for `Monad` requires swapping `G[F[_]] => F[G[_]]` (`sequence`), which does not exist for arbitrary monads (hence monad transformers like `OptionT` or `EitherT`).

- Why not B, C, D: `Applicative` composition is universal (`cats.data.Nested`), while `Monad` composition fails in general.
- Ref: [modules/11-applicative-and-traversable-functors.md](../modules/11-applicative-and-traversable-functors.md), https://typelevel.org/cats/datatypes/nested.html

</details>

### Q-FP-052 · Validated & Monad Incompatibility · difficulty 3 · scenario

Why is it impossible to give `Validated[E, *]` (which accumulates errors via `Semigroup[E]` in `map2`) a lawful `Monad` instance?

- A) Because `Monad`'s `map2` derived from `flatMap` must short-circuit on the first `Invalid(e1)` (since it has no `A` to pass to `f: A => Validated[E, B]`), directly contradicting `Validated`'s error-accumulating `Applicative.map2(Invalid(e1), Invalid(e2)) == Invalid(e1 |+| e2)`.
- B) Because `Validated` is a product type rather than a sum type.
- C) Because `Semigroup[E]` has no `empty` element.
- D) Because Scala 3 forbids `given` instances for two-parameter enums.

<details><summary>Answer</summary>

**A.** Every `Monad` induces an `Applicative` where `map2(fa, fb)(f) = flatMap(fa)(a => map(fb)(b => f(a, b)))`. If `fa` is `Invalid(e1)`, `flatMap` never inspects `fb`, so it can only return `Invalid(e1)`—violating `Applicative`/`Monad` consistency if `map2` accumulates errors. This is why Cats keeps `Validated` strictly `Applicative` and provides `.toEither` / `Parallel` conversions.

- Why not B, C, D: `Validated` is a sum type (`Valid | Invalid`), `Semigroup` suffices for combining two errors, and Scala 3 handles two-parameter `given`s via type lambdas.
- Ref: [modules/11-applicative-and-traversable-functors.md](../modules/11-applicative-and-traversable-functors.md), https://typelevel.org/cats/typeclasses/parallel.html

</details>

### Q-FP-053 · Traversable Functors · difficulty 2 · single

How can `Traverse[F[_]]` unify both `Functor[F]` (`map`) and `Foldable[F]` (`foldMap`) using only `traverse`?

- A) Instantiating the `Applicative` target context $G$ as the `Id` applicative recovers `map`, while instantiating $G$ as the `Const[M, *]` applicative (backed by `Monoid[M]`) recovers `foldMap`.
- B) By casting `F[A]` to `List[Any]` at runtime.
- C) Only `List` supports `Traverse`; `Tree` and `Option` cannot be traversed.
- D) `Traverse` ignores the structure of `F` and flattens everything to `Option`.

<details><summary>Answer</summary>

**A.** `traverse[Id, A, B](fa)(a => f(a))` preserves shape while transforming elements (`Functor.map`), and `traverse[[X] =>> Const[M, X], A, Nothing](fa)(a => Const(f(a)))` ignores `Nothing` while accumulating `M` via `Monoid[M]` (`Foldable.foldMap`)—proving `Traverse` is a common generalization of both!

- Why not B, C, D: `Traverse` is completely type-safe, applies to `Option`, `List`, `Tree`, `Map[K, *]`, etc., and strictly preserves the shape of `F`.
- Ref: [modules/11-applicative-and-traversable-functors.md](../modules/11-applicative-and-traversable-functors.md), https://www.cs.ox.ac.uk/jeremy.gibbons/publications/iterator.pdf

</details>

### Q-FP-054 · Traversable Functors · difficulty 2 · scenario

How do you implement `zipWithIndex[A](fa: F[A]): F[(A, Int)]` generically for _any_ `Traverse[F]` without knowing whether `F` is a `List`, `Option`, or `Tree`?

- A) Call `traverse` with the `State[Int, *]` applicative/monad: `traverse(fa)(a => State(i => ((a, i), i + 1))).run(0)._1`.
- B) Convert `fa` to an array with `toArray` and use a `for` loop.
- C) Use `Monoid[Int]` inside `foldMap`.
- D) Use `Par.parMap`.

<details><summary>Answer</summary>

**A.** Threading `State[Int, *]` through `Traverse[F].traverse` visits every element in `F`'s canonical traversal order, pairs it with the current counter `i`, increments `i + 1`, and preserves `F`'s exact shape (`List`, `Tree`, `Option`).

- Why not B: `Traverse` has no `toArray` and `toArray` loses `Tree` branching shape.
- Why not C: `foldMap` collapses `F` to a single `M`, discarding the container shape `F`.
- Why not D: `Par` evaluates branches concurrently without deterministic index ordering.
- Ref: [modules/11-applicative-and-traversable-functors.md](../modules/11-applicative-and-traversable-functors.md), https://www.cs.ox.ac.uk/jeremy.gibbons/publications/iterator.pdf

</details>

### Q-FP-055 · Algebraic Laws · difficulty 2 · hands-on

In `examples/scala/AlgebraicLaws.test.scala`, what happens if `Monad.map2` calls `map` while `Applicative.map` calls `map2` without `Monad` overriding `map`?

- A) Compilation fails with an ambiguous `given` error.
- B) Mutual recursion (`map2 -> map -> map2 -> ...`) triggers a `StackOverflowError` at runtime; overriding `Monad.map` as `flatMap(fa)(a => unit(f(a)))` breaks the cycle.
- C) Scala 3 automatically eliminates mutual recursion via `@tailrec`.
- D) `Applicative` silently drops the second argument `fb`.

<details><summary>Answer</summary>

**B.** `AlgebraicLaws.test.scala` defines `Applicative.map` via `map2(fa, unit(()))` and `Monad.map2` via `flatMap(fa)(a => map(fb)(...))`. Without `Monad` overriding `map` directly via `flatMap` and `unit`, calling either `map` or `map2` enters infinite mutual recursion and throws `StackOverflowError`.

- Why not A: There is no ambiguous `given`; both methods live inside the trait hierarchy.
- Why not C: `@tailrec` cannot eliminate virtual mutual recursion between `map` and `map2`.
- Why not D: Neither drops `fb`; they recurse infinitely before returning.
- Ref: [modules/10-functors-monads-and-kleisli-composition.md](../modules/10-functors-monads-and-kleisli-composition.md), https://scalameta.org/munit/

</details>

---

## Domain 6: Effects, Trampolines, Rank-2 ST & Streaming

### Q-FP-056 · IO Monad & Purity · difficulty 1 · single

How does wrapping side effects in an immutable `IO[A]` data type preserve referential transparency when performing console or file I/O?

- A) `IO[A]` separates **describing** an effectful program (building a pure, substitutable `IO` value) from **interpreting/executing** it at the program boundary (`unsafeRunSync`), so combining `IO` values with `map` and `flatMap` obeys equational reasoning.
- B) `IO[A]` eliminates all system calls at the OS kernel level.
- C) `IO[A]` caches the result of `readLine` forever so the second `readLine` never asks the user for input.
- D) `IO[A]` turns every impure exception into `None`.

<details><summary>Answer</summary>

**A.** `val p = printLine("hi"); (p, p)` is referentially transparent when `p` is an immutable `IO[Unit]` description: substituting `p` produces two identical descriptions, and nothing prints until the runtime executes the composed `IO` tree at the outer edge.

- Why not B: Real programs still make syscalls during interpretation at `main`.
- Why not C: Describing `readLine` twice in `for { a <- readLine; b <- readLine }` executes two distinct reads when interpreted.
- Why not D: Production `IO` types carry an error channel (or `Throwable` failure algebra) rather than silently swallowing errors as `None`.
- Ref: [modules/12-effects-io-trampolining-st-and-streaming.md](../modules/12-effects-io-trampolining-st-and-streaming.md), https://typelevel.org/cats-effect/docs/2x/datatypes/io

</details>

### Q-FP-057 · Stack Safety & Trampolining · difficulty 2 · scenario

A naive `IO` monad implements `flatMap(io, f)` as `() => f(io())()`. Executing a loop of 25,000 sequential `flatMap` steps throws `StackOverflowError` / `RangeError`. How does `TailRec[A]` (`Return`, `Suspend`, `FlatMap`) solve this in $O(1)$ call-stack space?

- A) `FlatMap(sub, k)` reifies the continuation onto the **heap** as an AST node rather than calling `sub()` on the stack, and the `@tailrec` driver loop re-associates left-nested `FlatMap(FlatMap(y, g), k)` to `FlatMap(y, a => FlatMap(g(a), k))` before stepping.
- B) `TailRec` increases JVM `-Xss` thread stack size dynamically at runtime.
- C) `TailRec` spawns a new OS thread every 1,000 `flatMap` calls.
- D) `TailRec` discards intermediate `FlatMap` continuations after 10,000 steps.

<details><summary>Answer</summary>

**A.** By turning control flow into heap data constructors (`Return`, `Suspend`, `FlatMap`) and rotating left-nested `FlatMap(FlatMap(y, g), k)` into right-associated form inside a single `@tailrec` loop (or iterative `while (true)` loop in TypeScript), call-stack depth remains $O(1)$ even for 100,000+ chained binds.

- Why not B, C, D: Increasing `-Xss` or spawning threads fails at arbitrary recursion depth and breaks $O(1)$ stack guarantees; discarding continuations would corrupt program semantics.
- Ref: [modules/12-effects-io-trampolining-st-and-streaming.md](../modules/12-effects-io-trampolining-st-and-streaming.md), https://blog.higher-order.com/assets/trampolines.pdf

</details>

### Q-FP-058 · Free Monad · difficulty 3 · single

What does `Free[F[_], A]` generalize beyond `TailRec[A]`, and how do you execute a `Free[ConsoleOp, A]` program against both production stdout/stdin and a deterministic pure in-memory test harness?

- A) `TailRec[A]` is `Free[Function0, A]`; parameterizing `Free` by an arbitrary functor/instruction algebra `F[_]` lets you interpret the exact same pure `Free[F, A]` AST via different **natural transformations** (`F ~> G`), such as `ConsoleOp ~> IO` in production vs. `ConsoleOp ~> State[Buffers, *]` in unit tests.
- B) `Free[F, A]` requires `F` to already be a `Monad`.
- C) `Free[F, A]` executes all `F` instructions in parallel automatically.
- D) `Free[F, A]` cannot express loops or recursion.

<details><summary>Answer</summary>

**A.** `Free[F, A]` constructs a stack-safe `Monad` for _any_ instruction ADT `F[_]` (not even requiring `F` to be a `Functor` when using `Suspend` + `FlatMap`). Interpreting via a natural transformation `F ~> G` (where `G` is a `Monad` like `IO`, `State`, or `Id`) cleanly decouples domain DSLs from execution backends.

- Why not B: `Free` builds a `Monad` for _free_ from any `F[_]`, precisely when `F` is _not_ already a `Monad`.
- Why not C: `Free` encodes sequential monadic control flow (`FlatMap`).
- Why not D: `Free` is stack-safe via trampolining, so infinite or deep recursive loops run in $O(1)$ stack.
- Ref: [modules/12-effects-io-trampolining-st-and-streaming.md](../modules/12-effects-io-trampolining-st-and-streaming.md), https://typelevel.org/cats/datatypes/freemonad.html

</details>

### Q-FP-059 · Async IO · difficulty 2 · single

Why is `TailRec` (`Free[Function0, A]`) insufficient on its own for non-blocking network/timer I/O, and what algebra extension lifts it to `Async[A]`?

- A) `Function0` (`() => A`) blocks the calling thread synchronously until `A` is computed; replacing `Function0` with `Par` (`Free[Par, A]`) allows `Suspend` nodes to represent asynchronous callback-driven computations (`(A => Unit) => Unit`) that park without blocking carrier threads.
- B) `Function0` cannot return `String` values.
- C) `Free[Par, A]` disables stack safety in favor of multi-threading.
- D) `Async` requires disabling garbage collection.

<details><summary>Answer</summary>

**A.** `Free[Par, A]` (and modern `IO` fiber runtimes like Cats Effect 3 / ZIO) combines trampolining (`FlatMap` stack safety) with non-blocking asynchronous callbacks (`async` / `Par`), enabling synchronous and asynchronous steps to interleave seamlessly without blocking OS threads.

- Why not B, C, D: `Free[Par, A]` remains stack-safe for `flatMap` chains and works over arbitrary types under normal GC.
- Ref: [modules/12-effects-io-trampolining-st-and-streaming.md](../modules/12-effects-io-trampolining-st-and-streaming.md), https://typelevel.org/cats-effect/docs/thread-model

</details>

### Q-FP-060 · Contextual Purity & Rank-2 ST · difficulty 3 · single

How does the `ST[S, A]` effect type allow **in-place array mutation** (such as $O(n \log n)$ in-place Quicksort) while remaining 100% referentially transparent to all callers?

- A) `ST.runST` accepts a **rank-2 polymorphic** computation `[S] => () => ST[S, A]` universally quantified over a phantom state token `S`; because `S` cannot unify with any type outside `runST`, mutable handles (`STRef[S, A]`, `STArray[S, A]`) are trapped inside the local scope and cannot leak out.
- B) `ST[S, A]` copies the entire array on every `write(i, v)` call.
- C) `ST[S, A]` runs every mutation inside an OS database transaction.
- D) `ST[S, A]` marks all variables `@volatile`.

<details><summary>Answer</summary>

**A.** Contextual purity guarantees no mutation is observable outside `ST.runST`. Rank-2 universal quantification (`[S] => () => ST[S, A]`) enforces this **statically at compile time**: any attempt to return `STRef[S, Int]` from `runST` fails type-checking because `S` is bound inside the polymorphic function parameter and cannot appear in the free result type `A`.

- Why not B: Copying on every write would degrade in-place Quicksort to $O(n^2 \log n)$ instead of mutating in place in $O(1)$ per swap.
- Why not C, D: `ST` is pure in-memory scoped mutability enforced by the type system, unrelated to databases or `@volatile` memory barriers.
- Ref: [modules/12-effects-io-trampolining-st-and-streaming.md](../modules/12-effects-io-trampolining-st-and-streaming.md), https://www.microsoft.com/en-us/research/publication/lazy-functional-state-threads/

</details>

### Q-FP-061 · Rank-2 ST Escape Prevention · difficulty 3 · hands-on

In `examples/scala/TrampolineAndST.test.scala`, what does `scala.compiletime.testing.typeChecks("val leaked = ST.runST([S] => () => STRef[S, Int](0))")` verify?

- A) It verifies at **compile time** (`assert(!escapesRef)`) that Scala 3 rejects returning `STRef[S, Int]` from `ST.runST`, because the phantom type `S` cannot escape the rank-2 polymorphic function `[S] => () => ST[S, A]`.
- B) It verifies that `STRef[S, Int](0)` throws `SecurityException` at runtime.
- C) It verifies that `STRef` automatically freezes into an immutable `Int` when returned.
- D) It verifies that Quicksort fails on empty lists.

<details><summary>Answer</summary>

**A.** `scala.compiletime.testing.typeChecks` inspects whether a Scala 3 snippet type-checks during test compilation. Returning `STRef[S, Int]` requires `A = STRef[S, Int]`, which illegally mentions the inner quantified type parameter `S` outside its scope—producing a compile-time type error proven by `assert(!escapesRef)`.

- Why not B, C, D: The safety guarantee is static (compile-time rejection), not a runtime exception or auto-freezing, and `PureQuicksort.sort(Nil)` returns `Nil`.
- Ref: [modules/12-effects-io-trampolining-st-and-streaming.md](../modules/12-effects-io-trampolining-st-and-streaming.md), https://docs.scala-lang.org/scala3/reference/new-types/polymorphic-function-types.html

</details>

### Q-FP-062 · Stream Transducers & Resource Safety · difficulty 2 · scenario

Why do pull-based stream transducers (`Process[F, O]` / FS2 `Stream[F, O]`) solve two critical limitations of `LazyList[A]` when processing multi-gigabyte log files?

- A) Pull-based transducers do **not** memoize previously emitted elements (running in $O(1)$ constant memory without head-retention leaks) AND they attach **bracketed resource finalizers** (`onComplete` / `Resource`) that deterministically close file handles even on early `take(n)` termination or downstream errors.
- B) Pull-based transducers load the entire file into a `Vector[String]` first so random indexing is $O(1)$.
- C) `LazyList[A]` cannot express `map` or `filter`.
- D) Pull-based transducers forbid `take(n)` combinators.

<details><summary>Answer</summary>

**A.** `LazyList` caches every evaluated node and lacks native `bracket` cleanup hooks—closing a file inside a `LazyList` when a consumer calls `.take(5)` and drops the stream is fragile or leaks until GC. Pull-based `Process` / FS2 explicitly propagates termination/kill signals upstream to run finalizers deterministically in constant memory.

- Why not B: Loading the whole file into a `Vector` causes the exact $O(n)$ OOM failure streaming avoids.
- Why not C, D: `LazyList` supports `map`/`filter`, and `take(n)` is a core pull-stream combinator that triggers upstream finalizers.
- Ref: [modules/12-effects-io-trampolining-st-and-streaming.md](../modules/12-effects-io-trampolining-st-and-streaming.md), https://fs2.io/

</details>

### Q-FP-063 · Stream Transducers · difficulty 2 · ordering

In a pull-based `Process` transducer pipeline (`resourceStream |> take(2) |> runLog`), order the lifecycle events when `take(2)` completes after reading 2 rows from a 1,000-row file:

1. `take(2)` emits the 2nd row and sends a `Kill` / upstream halt signal instead of pulling row 3.
2. `bracketResource` acquires the file handle upon the first pull (`Await`).
3. `bracketResource` intercepts the upstream `Kill` signal, executes `release(handle)` (`openHandles` returns to `0`), and emits `Halt`.

- A) 1 → 2 → 3
- B) 2 → 1 → 3
- C) 3 → 2 → 1
- D) 2 → 3 → 1

<details><summary>Answer</summary>

**B.** Acquisition happens lazily on first pull (`2`), downstream pulls 2 rows and signals `Kill` upon reaching the `take(2)` limit (`1`), and the upstream `bracketResource` wrapper runs `release(handle)` immediately upon receiving `Kill` (`3`).

- Why not A, C, D: A handle cannot be released before acquisition, and `Kill` cannot happen before the 2 rows are pulled.
- Ref: [modules/12-effects-io-trampolining-st-and-streaming.md](../modules/12-effects-io-trampolining-st-and-streaming.md), https://fs2.io/#/guide

</details>

### Q-FP-064 · Modern Effect Runtimes (Then vs Now) · difficulty 2 · single

Comparing the pedagogical `Process[F, O]` stream from _Functional Programming in Scala_ (2015) with modern production **FS2 3.x** (`Stream[F, O]`) and **Cats Effect 3 / ZIO 2** runtimes, what key architectural evolution occurred?

- A) Modern FS2 operates over **chunked** pulls (`Chunk[O]`) rather than single-element allocations per step, integrates fiber-level structured **cancelation** (replacing ad-hoc `Kill` exceptions), and delegates stack-safe async scheduling to an underlying fiber runtime (`IO` / `ZIO`).
- B) Modern FS2 dropped resource safety and switched back to `LazyList`.
- C) Modern FS2 blocks an OS thread per stream element.
- D) Cats Effect 3 removed `flatMap` in favor of global mutable variables.

<details><summary>Answer</summary>

**A.** Processing elements in contiguous `Chunk[O]` arrays amortizes interpreter overhead by orders of magnitude, while Cats Effect 3's uninterruptible `Resource` / `MonadCancel` fiber model ensures cleanup runs even under concurrent race/timeout cancelation.

- Why not B, C, D: Resource safety, non-blocking fiber scheduling, and pure `flatMap` remain the core pillars of FS2, Cats Effect 3, and ZIO 2.
- Ref: [modules/12-effects-io-trampolining-st-and-streaming.md](../modules/12-effects-io-trampolining-st-and-streaming.md), https://typelevel.org/cats-effect/docs/std/resource

</details>

### Q-FP-065 · Streams & Resource Cleanup · difficulty 2 · hands-on

In `examples/typescript/06-trampoline-free-and-streams.test.ts`, what two failure/termination scenarios verify that `bracketResource` leaks zero handles?

- A) Early termination via `takeProcess(..., 2)` on a 4-row resource stream AND mid-stream downstream failure (`Halt(new Error('downstream parse error'))`), both asserting `openHandles === 0` and exact `closeCalls` increments.
- B) Only normal EOF completion is tested.
- C) `TailRec` throwing `RangeError` at 100,000 steps.
- D) `FreeConsole` writing directly to `process.stdout`.

<details><summary>Answer</summary>

**A.** Both `takeProcess(linesFromFakeFile(...), 2)` (early truncation) and `failAfterN(..., 1)` (mid-stream error) invoke `killProcess`, triggering `releaseOnce()` inside `bracketResource` and asserting `openHandles === 0` after both cases.

- Why not B: Normal EOF is trivial; the real test of `bracket` is early pull termination and error unwinding.
- Why not C: `TailRec` succeeds at 100,000 steps (`NaiveIO` is the negative test that throws `RangeError` at 25,000).
- Why not D: `FreeConsole` is interpreted purely in memory without touching `process.stdout`.
- Ref: [modules/12-effects-io-trampolining-st-and-streaming.md](../modules/12-effects-io-trampolining-st-and-streaming.md), https://nodejs.org/api/test.html

</details>

---

## Mock Exam

### Timed Simulation: Senior / Staff Functional Systems Assessment

- **Duration**: 90 minutes (closed-book, whiteboard or IDE without external reference)
- **Question Count**: 30 questions selected from the bank above, weighted to match the 6 curriculum domains (18% / 18% / 16% / 16% / 16% / 16%)
- **Passing Threshold**: 23 / 30 (76%) for Senior readiness; 27 / 30 (90%) for Staff / Principal Functional Systems readiness

| Domain | Weight | Selected Mock Questions (30 Total) | Count |
| --- | --- | --- | --- |
| **1. Foundations, RT & Persistent ADTs** | 18% | `Q-FP-001`, `Q-FP-002`, `Q-FP-004`, `Q-FP-006`, `Q-FP-008`, `Q-FP-010` | 6 |
| **2. Totality, Laziness & Pure State** | 18% | `Q-FP-013`, `Q-FP-014`, `Q-FP-017`, `Q-FP-018`, `Q-FP-021` | 5 |
| **3. Functional Parallelism & PBT** | 16% | `Q-FP-025`, `Q-FP-026`, `Q-FP-029`, `Q-FP-032`, `Q-FP-033` | 5 |
| **4. Parser Combinators & Monoids** | 16% | `Q-FP-035`, `Q-FP-036`, `Q-FP-040`, `Q-FP-041`, `Q-FP-044` | 5 |
| **5. Functors, Monads, Applicatives & Traverse** | 16% | `Q-FP-046`, `Q-FP-047`, `Q-FP-049`, `Q-FP-052`, `Q-FP-053` | 5 |
| **6. Effects, Trampolines, Rank-2 `ST` & Streaming** | 16% | `Q-FP-057`, `Q-FP-058`, `Q-FP-060`, `Q-FP-062` | 4 |

### Mock Exam Scoring Key

| Question ID | Correct Answer | Domain   |
| ----------- | -------------- | -------- |
| `Q-FP-001`  | **B**          | Domain 1 |
| `Q-FP-002`  | **A**          | Domain 1 |
| `Q-FP-004`  | **B**          | Domain 1 |
| `Q-FP-006`  | **B**          | Domain 1 |
| `Q-FP-008`  | **A**          | Domain 1 |
| `Q-FP-010`  | **A**          | Domain 1 |
| `Q-FP-013`  | **A**          | Domain 2 |
| `Q-FP-014`  | **C**          | Domain 2 |
| `Q-FP-017`  | **A**          | Domain 2 |
| `Q-FP-018`  | **B**          | Domain 2 |
| `Q-FP-021`  | **B**          | Domain 2 |
| `Q-FP-025`  | **B**          | Domain 3 |
| `Q-FP-026`  | **A**          | Domain 3 |
| `Q-FP-029`  | **A**          | Domain 3 |
| `Q-FP-032`  | **A**          | Domain 3 |
| `Q-FP-033`  | **A, C**       | Domain 3 |
| `Q-FP-035`  | **A**          | Domain 4 |
| `Q-FP-036`  | **B**          | Domain 4 |
| `Q-FP-040`  | **A**          | Domain 4 |
| `Q-FP-041`  | **B**          | Domain 4 |
| `Q-FP-044`  | **A**          | Domain 4 |
| `Q-FP-046`  | **A, B, C**    | Domain 5 |
| `Q-FP-047`  | **A**          | Domain 5 |
| `Q-FP-049`  | **A**          | Domain 5 |
| `Q-FP-052`  | **A**          | Domain 5 |
| `Q-FP-053`  | **A**          | Domain 5 |
| `Q-FP-057`  | **A**          | Domain 6 |
| `Q-FP-058`  | **A**          | Domain 6 |
| `Q-FP-060`  | **A**          | Domain 6 |
| `Q-FP-062`  | **A**          | Domain 6 |
