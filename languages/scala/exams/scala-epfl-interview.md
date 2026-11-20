# Scala 3: EPFL & Senior Functional Systems Interview Question Bank

A 65-question preparation bank (`Q-SCALA-001` through `Q-SCALA-065`) aligned with the EPFL / Scala Center Coursera specializations (_Functional Programming in Scala_ and _Effective Programming in Scala_) and Senior Scala & Functional Systems technical interviews. Targets Scala 3.10.1, OpenJDK 25.0.5 LTS, Cats 2.13.0, Cats Effect 3.7.1, FS2 3.16.0, and ZIO 2.1.26.

---

## Domain 1: Toolchain, TASTy & ADTs (`Q-SCALA-001`–`Q-SCALA-010`)

### Q-SCALA-001 · Toolchain, TASTy & ADTs · difficulty 1 · single

What primary problem does Scala 3's TASTy (Typed Abstract Syntax Trees) binary format solve compared to Scala 2's `.class`-embedded pickles?

- A) It eliminates JVM bytecode generation so Scala 3 runs directly from TASTy files without a JVM
- B) It preserves full Scala 3 type trees, inline bodies, and macro ASTs in a compact cross-minor-version format for separate compilation and binary compatibility
- C) It replaces Maven POM metadata with an embedded dependency lockfile inside every `.jar`
- D) It strips generic type parameters early so Java callers do not observe erased bridge methods

<details><summary>Answer</summary>

**B.** TASTy stores typed ASTs alongside `.class` bytecode, allowing newer Scala 3 compilers to read libraries compiled with older Scala 3 minor versions and enabling `inline` expansion, macro inspection, and cross-platform portability (JVM, Scala.js, Scala Native).

- Why not A: The JVM still executes `.class` bytecode; TASTy sits alongside `.class` files for the compiler and tooling.
- Why not C: TASTy encodes typed program syntax, not Maven/Coursier dependency lockfiles.
- Why not D: JVM type erasure still happens during backend bytecode generation; TASTy retains the un-erased type trees for Scala compilation.
- Ref: [modules/01-scala3-toolchain-tasty-and-jvm-lowering.md](../modules/01-scala3-toolchain-tasty-and-jvm-lowering.md), https://docs.scala-lang.org/scala3/reference/language-interoperability/tasty-overview.html

</details>

### Q-SCALA-002 · Toolchain, TASTy & ADTs · difficulty 2 · single

Why can an `object Main extends App` declaration in Scala 2 cause subtle initialization bugs that Scala 3's `@main def` eliminates?

- A) `App` uses the deprecated `DelayedInit` trait, causing constructor code to run inside an anonymous closure during `main`, which can expose uninitialized `val` fields to concurrent threads or superclasses
- B) `App` forces every `val` inside the object to be allocated on the stack instead of the static heap
- C) `@main` compiles to a Java `record`, whereas `App` compiles to an unchecked `Enumeration`
- D) `App` is incompatible with `-Werror` because it uses `var` fields internally

<details><summary>Answer</summary>

**A.** `scala.App` relied on `DelayedInit` compiler magic that rewrote the body of the object into a delayed lambda executed when `main` ran, creating subtle initialization-order races and breaking GraalVM/static analysis; `@main` generates a plain static entry-point class whose body executes via standard JVM method invocation.

- Why not B: JVM objects allocate fields on the heap regardless of `App` vs `@main`.
- Why not C: `@main` generates a regular JVM class with `public static void main(String[])`, not a Java `record`.
- Why not D: `App` was deprecated/discouraged in Scala 3 for initialization semantics (`DelayedInit` removal), not because of internal `var` warnings.
- Ref: [modules/01-scala3-toolchain-tasty-and-jvm-lowering.md](../modules/01-scala3-toolchain-tasty-and-jvm-lowering.md), https://docs.scala-lang.org/scala3/book/methods-main-methods.html

</details>

### Q-SCALA-003 · Toolchain, TASTy & ADTs · difficulty 2 · single

When compiling a recursive method annotated with `@tailrec`, what JVM bytecode does `scalac` emit, and when does compilation fail?

- A) It emits a `tailcall` JVM opcode; it fails only when the return type is `Unit`
- B) It rewrites self-recursive tail calls into an imperative local `goto` loop; it fails if any recursive call is not in tail position (e.g., wrapped in `try/catch` or followed by another operation) or is dynamically overridable
- C) It wraps each call in `cats.Eval.defer`; it fails when the recursion depth exceeds 1,000 at compile time
- D) It generates a virtual thread per recursive step; it fails on JDK versions older than 21

<details><summary>Answer</summary>

**B.** The JVM lacks a native general `tailcall` instruction, so `scalac` lowers `@tailrec` methods into `while`/label-`goto` loops in bytecode; non-final overridable methods or recursive calls inside `try` blocks or `1 + f(n - 1)` are not valid self-tail calls and fail compilation.

- Why not A: HotSpot JVM bytecode has no general `tailcall` instruction; `Unit` tail-recursive methods are completely valid.
- Why not C: `scalac` emits zero-allocation loop bytecode, not heap-allocated `Eval` thunks, and does not know runtime recursion depth.
- Why not D: `@tailrec` has existed since Scala 2 and uses plain JVM jumps, not virtual threads.
- Ref: [modules/01-scala3-toolchain-tasty-and-jvm-lowering.md](../modules/01-scala3-toolchain-tasty-and-jvm-lowering.md), https://www.scala-lang.org/api/current/scala/annotation/tailrec.html

</details>

### Q-SCALA-004 · Toolchain, TASTy & ADTs · difficulty 2 · scenario

You migrate a Scala 2 codebase to Scala 3.10.1 and encounter an `OutOfMemoryError` when processing a 10-million-element lazy sequence constructed via `val all = generate(0)` using `Stream`. Why did switching to `LazyList` fix part of the issue, and what bug still remains if `val all` stays in scope?

- A) `Stream` evaluated both head and tail strictly; `LazyList` solves everything even when `val all` is held in a local field
- B) `Stream` evaluated its head strictly on construction, whereas `LazyList` defers both head and tail; however, keeping a `val all` reference to the first node still causes $O(n)$ head retention until `all` becomes unreachable
- C) `LazyList` evicts memoized nodes using weak references automatically after 1,000 elements
- D) `Stream` was backed by `ArrayBuffer` whereas `LazyList` is backed by a CHAMP trie

<details><summary>Answer</summary>

**B.** Scala 2 `Stream` eagerly evaluated the head element (`h #:: t` evaluated `h` immediately), whereas `LazyList` makes both head and tail lazy; still, `LazyList` memoizes evaluated nodes, so binding the head to a long-lived `val` retains the entire prefix in memory unless constructed via `def` or discarded before traversal.

- Why not A: `Stream` had a lazy tail and strict head, and holding a `val` reference to the head of a `LazyList` still causes $O(n)$ heap retention.
- Why not C: `LazyList` uses strong references for memoized nodes, not `WeakReference` eviction.
- Why not D: Neither `Stream` nor `LazyList` uses `ArrayBuffer` or CHAMP tries; both are persistent cons-cell lists (`HashMap`/`HashSet` use CHAMP tries).
- Ref: [modules/02-adts-enums-pattern-matching-and-collections.md](../modules/02-adts-enums-pattern-matching-and-collections.md), https://www.scala-lang.org/api/current/scala/collection/immutable/LazyList.html

</details>

### Q-SCALA-005 · Toolchain, TASTy & ADTs · difficulty 2 · single

How does a Scala 3 GADT `enum Expr[A]` improve pattern matching compared to a standard non-indexed ADT?

- A) It disables exhaustivity checking so partial matches compile without warnings
- B) Matching a constructor like `case Expr.IntLit(n)` refines the abstract type `A` to `Int` inside that branch, letting the branch return `Int` where `A` is expected
- C) It erases all constructors to `java.lang.Enum` constants for switch-table dispatch
- D) It prevents `Expr` from being used inside `List[Expr[?]]`

<details><summary>Answer</summary>

**B.** In a GADT (`case IntLit(value: Int) extends Expr[Int]`), pattern matching establishes a local type equality constraint `A =:= Int` inside the case body, enabling type-safe evaluators `def eval[A](e: Expr[A]): A` without unsafe casts.

- Why not A: Exhaustivity checking remains active and even prunes impossible branches whose type arguments cannot unify with the scrutinee's type.
- Why not C: Parameterized `enum` cases compile to a `sealed abstract class` hierarchy with case classes, not `java.lang.Enum`.
- Why not D: Existential/wildcard containers like `List[Expr[?]]` work normally with GADTs.
- Ref: [modules/02-adts-enums-pattern-matching-and-collections.md](../modules/02-adts-enums-pattern-matching-and-collections.md), https://docs.scala-lang.org/scala3/reference/enums/adts.html

</details>

### Q-SCALA-006 · Toolchain, TASTy & ADTs · difficulty 2 · single

Why did Scala 2.13/3 replace the original Hash-Array Mapped Trie (HAMT) backing immutable `HashMap` and `HashSet` with a CHAMP (Compressed Hash-Array Mapped Prefix) trie?

- A) CHAMP eliminates hash collisions completely using perfect hashing at runtime
- B) CHAMP separates inline key/value payloads from child-node references via two 32-bit bitmaps, improving cache locality, reducing per-node allocations, and enabling fast iteration and structural equality
- C) CHAMP makes `HashMap` covariant in its key type `K`
- D) CHAMP stores all keys in sorted lexicographical order for $O(1)$ range queries

<details><summary>Answer</summary>

**B.** Steindorfer and Vinju's CHAMP layout uses separate node and data bitmaps inside each trie node so key-value pairs sit contiguously in a single array without boxing them into intermediate leaf wrapper objects, yielding lower memory footprint and faster cache-friendly iteration.

- Why not A: Hash collisions are still possible and handled via collision nodes, not perfect hashing.
- Why not C: `HashMap[K, +V]` remains invariant in `K` (keys are looked up in contravariant/invariant equality and hashing positions).
- Why not D: CHAMP is hash-ordered, not key-sorted (`TreeMap` provides sorted range queries).
- Ref: [modules/02-adts-enums-pattern-matching-and-collections.md](../modules/02-adts-enums-pattern-matching-and-collections.md), https://docs.scala-lang.org/overviews/collections-2.13/performance-characteristics.html

</details>

### Q-SCALA-007 · Toolchain, TASTy & ADTs · difficulty 3 · single

How does Scala 3's `scala.util.boundary` / `break` improve upon Scala 2 non-local `return` inside closures?

- A) `boundary` uses a compile-time `Label[T]` capability so breaks within the same method compile to local jumps, cross-closure breaks use lightweight stackless control exceptions caught at the boundary, and breaking outside the dynamic scope is rejected at compile time (or caught cleanly)
- B) `boundary` spawns a separate OS thread for the loop body so `break` simply interrupts that thread
- C) `boundary` automatically converts the body into a `LazyList` and drops remaining elements
- D) `boundary` requires `Cats Effect` on the classpath to suspend continuations

<details><summary>Answer</summary>

**A.** `boundary` introduces an implicit `Label[T]` that `break(value)` requires via `using`; intra-method breaks optimize directly to JVM jumps without throwing, while cross-lambda breaks use `Break` (extending `ControlThrowable` without stack-trace capture) and cannot accidentally return from an enclosing outer method like Scala 2's `return`.

- Why not B: `boundary`/`break` is synchronous control flow on the current thread, not multi-threaded interruption.
- Why not C: It is imperative structured control flow with no `LazyList` allocation.
- Why not D: `scala.util.boundary` is part of the Scala 3.3+ standard library with zero external dependencies.
- Ref: [modules/02-adts-enums-pattern-matching-and-collections.md](../modules/02-adts-enums-pattern-matching-and-collections.md), https://docs.scala-lang.org/scala3/reference/dropped-features/nonlocal-returns.html

</details>

### Q-SCALA-008 · Toolchain, TASTy & ADTs · difficulty 2 · multi

Which TWO statements accurately describe Scala 3 `unapply` extractors?

- A) Returning `Option[T]` implements an optional value match, whereas returning `Boolean` implements a zero-argument predicate test
- B) An extractor can implement Product Match by returning a type with `_1`, `_2`, ... members (or `Product`) and `isEmpty`/`get` without allocating `Some(...)` on every match
- C) `unapply` must always be declared inside a `sealed trait` companion object
- D) `unapply` disables exhaustivity checking only when matching `enum` values

<details><summary>Answer</summary>

**A, B.** Scala 3 formalizes fixed-arity extractors (`Boolean` test, `Option[T]` / name-based `isEmpty`/`get` single/product match) and name-based product extractors that avoid `Some` allocation when `isEmpty` is `false`.

- Why not C: `unapply` can live in any object or even a value class/instance (custom pattern objects), not solely `sealed trait` companions.
- Why not D: Custom `unapply` extractors are opaque to exhaustivity checking regardless of whether the scrutinee is an `enum` or another class.
- Ref: [modules/02-adts-enums-pattern-matching-and-collections.md](../modules/02-adts-enums-pattern-matching-and-collections.md), https://docs.scala-lang.org/scala3/reference/changed-features/pattern-matching.html

</details>

### Q-SCALA-009 · Toolchain, TASTy & ADTs · difficulty 2 · ordering

Order the stages of the Scala 3 compiler pipeline from source file to JVM execution:

1. Backend code generation (JVM `.class` bytecode)
2. Type checking and implicit (`given`) resolution (`typer`)
3. TASTy serialization and erasure/post-typer transformations
4. Parsing into untyped AST (`parser`)

- A) `4 → 2 → 3 → 1`
- B) `4 → 3 → 2 → 1`
- C) `2 → 4 → 3 → 1`
- D) `4 → 2 → 1 → 3`

<details><summary>Answer</summary>

**A (`4 → 2 → 3 → 1`).** The compiler parses source text into untyped trees, runs `typer` to infer types and resolve `given`s, emits TASTy before lowering/type-erasure phases, and finally emits JVM `.class` bytecode.

- Why not B, C, D: TASTy cannot be serialized before `typer` resolves types and `given`s, type checking requires a parsed AST, and JVM bytecode emission happens after erasure.
- Ref: [modules/01-scala3-toolchain-tasty-and-jvm-lowering.md](../modules/01-scala3-toolchain-tasty-and-jvm-lowering.md), https://docs.scala-lang.org/scala3/reference/language-interoperability/tasty-overview.html

</details>

### Q-SCALA-010 · Toolchain, TASTy & ADTs · difficulty 2 · hands-on

Write a Scala 3 `LazyList` test that proves `LazyList.cons(headExpr, tailExpr)` evaluates neither `headExpr` nor `tailExpr` upon construction, evaluates `headExpr` only once when `.head` is read twice, and verifies a `def`-generated infinite `LazyList` reaches element 1,000,000 without head retention.

<details><summary>Answer</summary>

Verified implementation in [`01-AdtsEnumsAndLazyList.test.scala`](../examples/01-AdtsEnumsAndLazyList.test.scala) (`"LazyList is lazy in BOTH head and tail on construction"` and `"LazyList generated via def avoids head retention across 1,000,000 elements"`). Run `mise run test` inside `languages/scala` to execute the MUnit assertions proving zero evaluations at construction and single memoized evaluation per accessed element.

- Ref: [modules/02-adts-enums-pattern-matching-and-collections.md](../modules/02-adts-enums-pattern-matching-and-collections.md), https://www.scala-lang.org/api/current/scala/collection/immutable/LazyList.html

</details>

---

## Domain 2: Type System, Variance & Type Inference (`Q-SCALA-011`–`Q-SCALA-020`)

### Q-SCALA-011 · Type System, Variance & Type Inference · difficulty 1 · single

Why did Scala 3 introduce the `Matchable` trait directly below `Any` in the unified type lattice?

- A) To allow `Int` and `String` to share a common numeric operator `+`
- B) To distinguish values that safely support runtime pattern matching and `getClass` (`AnyVal`/`AnyRef` subtypes) from opaque types and abstract `Any` values whose runtime representation must remain encapsulated
- C) To replace `Serializable` on every `case class`
- D) To make `Null` a subtype of `Int`

<details><summary>Answer</summary>

**B.** Previously, matching on an `Any` value (including an `opaque type` or unconstrained generic) violated parametricity and leaked underlying representations; restricting pattern matching scrutinees to `Matchable` preserves abstraction boundaries while keeping `Any` as the true top type.

- Why not A: `Matchable` defines no arithmetic operators.
- Why not C: `Matchable` has nothing to do with Java serialization (`scala.Product` / `Serializable`).
- Why not D: `Null` is a subtype of `AnyRef` (or separate under `-Yexplicit-nulls`), never `Int` (`AnyVal`).
- Ref: [modules/03-type-system-variance-and-type-inference.md](../modules/03-type-system-variance-and-type-inference.md), https://docs.scala-lang.org/scala3/reference/other-new-features/matchable.html

</details>

### Q-SCALA-012 · Type System, Variance & Type Inference · difficulty 2 · single

Why does `class Box[+A](value: A) { def put(x: A): Box[A] = Box(x) }` fail to compile in Scala 3?

- A) Because `Box` is a class rather than a `trait`
- B) Because `A` is declared covariant (`+A`) but appears in a contravariant method-parameter position (`x: A`), which would allow an unsound `Box[Animal]` reference to accept a `Cat` into a `Box[Dog]`
- C) Because `A` has no upper bound `<: AnyRef`
- D) Because `put` is missing an `inline` modifier

<details><summary>Answer</summary>

**B.** Method parameter positions flip variance polarity; putting a covariant type `+A` in a contravariant input slot violates type soundness (the classic mutable/covariant array problem), so Scala enforces lower-bound widening `def put[B >: A](x: B): Box[B]`.

- Why not A: Classes support variance annotations identically to traits when members obey variance positions.
- Why not C: Upper bounds on `A` do not alter variance position rules.
- Why not D: `inline` does not bypass variance soundness checks.
- Ref: [modules/03-type-system-variance-and-type-inference.md](../modules/03-type-system-variance-and-type-inference.md), https://docs.scala-lang.org/tour/variances.html

</details>

### Q-SCALA-013 · Type System, Variance & Type Inference · difficulty 2 · single

How does lower-bound widening (`def prepend[B >: A](elem: B): MyList[B]`) solve adding an element to a covariant `MyList[+A]`?

- A) It forces the caller to cast `elem` to `A` at runtime
- B) It introduces a fresh invariant method type parameter `B` constrained to be a supertype of `A`; `B` sits in contravariant parameter position (`elem: B`) and covariant return position (`MyList[B]`) legitimately, widening `MyList[Dog]` + `Cat` to `MyList[Animal]`
- C) It mutates the underlying `MyList` in place to hold `Any`
- D) It tells the compiler to erase `A` to `Object` before type checking

<details><summary>Answer</summary>

**B.** `B >: A` constrains `B` to be a supertype of `A` (`A <: B`), which places `A` in a valid covariant bound position on a covariant container `MyList[+A]`; `B` itself is an invariant method type parameter, allowing `elem: B` in parameter position and `MyList[B]` as the widened return type.

- Why not A: No runtime cast occurs; widening is verified statically.
- Why not C: `MyList` remains purely immutable and returns a new `MyList[B]`.
- Why not D: Variance checking occurs before erasure; `Object` erasure happens later in bytecode generation.
- Ref: [modules/03-type-system-variance-and-type-inference.md](../modules/03-type-system-variance-and-type-inference.md), https://docs.scala-lang.org/tour/lower-type-bounds.html

</details>

### Q-SCALA-014 · Type System, Variance & Type Inference · difficulty 2 · single

What are the variances of `A` and `B` in `Function1[-A, +B]` (written `A => B`), and what does `Cat => Animal` vs `Animal => Dog` imply?

- A) Covariant in `A`, contravariant in `B`; `Cat => Animal` is a subtype of `Animal => Dog`
- B) Contravariant in `A`, covariant in `B`; `Animal => Dog` is a subtype of `Cat => Animal`
- C) Invariant in both `A` and `B`; neither is a subtype of the other
- D) Contravariant in both `A` and `B`; `Animal => Animal` is a subtype of `Cat => Dog`

<details><summary>Answer</summary>

**B.** By the Liskov Substitution Principle, a function promising to accept any `Animal` and return a `Dog` (`Animal => Dog`) can safely stand in anywhere a caller supplies a `Cat` and expects an `Animal` (`Cat => Animal`), so `Animal => Dog <: Cat => Animal`.

- Why not A: That reverses both input and output variance, which would pass a `Dog` to a function expecting a `Cat`.
- Why not C: `Function1` explicitly declares `-T1, +R`.
- Why not D: Output types must be covariant (`Dog <: Animal`), not contravariant.
- Ref: [modules/03-type-system-variance-and-type-inference.md](../modules/03-type-system-variance-and-type-inference.md), https://docs.scala-lang.org/tour/variances.html

</details>

### Q-SCALA-015 · Type System, Variance & Type Inference · difficulty 3 · scenario

Consider `trait Sink[-A] { def handle[B](f: A => B): B }`. Does `Sink[-A]` compile, and why?

- A) No, because `f` is a contravariant method parameter and `A` is `Function1`'s contravariant input, so the two flips cancel to place `A` in covariant position, violating `Sink[-A]`
- B) Yes, because `A` appears inside the parameter list of `f: A => B`, which matches `Sink[-A]` contravariance directly
- C) Yes, because `B` is invariant
- D) No, because methods inside contravariant traits cannot have type parameters

<details><summary>Answer</summary>

**A.** Variance polarity flips twice: `handle`'s parameter `f: (A => B)` is contravariant (`-`), and `A` as the input of `Function1[-T, +R]` is contravariant (`-`), so two flips cancel to place `A` in **covariant** position. Because `Sink[-A]` declares `A` contravariant, placing `A` in covariant position is rejected by the compiler (otherwise a `Sink[Animal]` cast to `Sink[Dog]` could pass a `Cat` into a `Dog => B` callback).

- Why not B: It ignores the outer contravariant flip from `f` being a method parameter of `handle`, missing the double negation.
- Why not C: `B`'s variance does not override `A`'s variance position check.
- Why not D: Contravariant traits can have polymorphic methods as long as `A` respects its variance positions.
- Ref: [modules/03-type-system-variance-and-type-inference.md](../modules/03-type-system-variance-and-type-inference.md), https://docs.scala-lang.org/scala3/reference/other-new-features/variance-positions.html

</details>

### Q-SCALA-016 · Type System, Variance & Type Inference · difficulty 2 · single

What does a path-dependent type `val a: Box; a.Item` guarantee at compile time compared to `Box#Item`?

- A) `a.Item` ties the type `Item` to the specific stable value `a`, preventing an `a.Item` from being mixed with a `b.Item` even when `a` and `b` share the same outer type `Box`
- B) `a.Item` is a runtime-checked cast generated by `ClassTag`
- C) `a.Item` makes `Item` mutable across all instances of `Box`
- D) `a.Item` forces `Box` to be a `case object`

<details><summary>Answer</summary>

**A.** Path-dependent types index the inner type member by a stable singleton path (`a.type`), enabling type-safe graph nodes, database sessions, and scoped capabilities without mixing values from distinct outer instances; general type projection `T#U` on abstract `T` was removed in Scala 3 for soundness in the DOT calculus.

- Why not B: Path-dependent types are checked purely statically without `ClassTag`.
- Why not C: Immutability (`val` path stability) is required for path-dependent types, not mutability.
- Why not D: Any class or trait instance bound to a stable `val` supports path-dependent types.
- Ref: [modules/03-type-system-variance-and-type-inference.md](../modules/03-type-system-variance-and-type-inference.md), https://docs.scala-lang.org/scala3/reference/dropped-features/type-projection.html

</details>

### Q-SCALA-017 · Type System, Variance & Type Inference · difficulty 2 · single

How does Scala's local type inference behave when a generic method has multiple parameter lists `def fold[B](z: B)(op: (B, Int) => B): B` vs a single parameter list `def fold[B](z: B, op: (B, Int) => B): B`?

- A) Multiple parameter lists have zero effect on type inference in Scala 3
- B) Information flows left-to-right across parameter lists: inferring `B` from `z` in the first list fixes `B` for the lambda `op` in the second list so the user need not annotate lambda parameter types
- C) Single parameter lists infer `B` faster using Hindley-Milner unification
- D) Multiple parameter lists forbid currying in Scala 3

<details><summary>Answer</summary>

**B.** Scala's colored local type inference solves constraints per parameter list (with Scala 3 improving propagation even further via expected types and improved constraint ordering); separating `(z: B)` from `(op: (B, Int) => B)` guarantees `B` is known before typing the `op` lambda parameters.

- Why not A: Multi-parameter-list inference remains one of Scala's core ergonomic mechanisms for lambda parameter type inference.
- Why not C: Scala uses local type inference, not global Hindley-Milner unification, and single lists historically required annotations when `B` appeared in both arguments.
- Why not D: Multiple parameter lists directly support partial application / currying.
- Ref: [modules/03-type-system-variance-and-type-inference.md](../modules/03-type-system-variance-and-type-inference.md), https://docs.scala-lang.org/tour/multiple-parameter-lists.html

</details>

### Q-SCALA-018 · Type System, Variance & Type Inference · difficulty 2 · single

Why is Scala's `Nothing` type useful as the type of `throw new RuntimeException(...)` and `Nil: List[Nothing]`?

- A) `Nothing` is a supertype of `AnyRef` only
- B) `Nothing` is the uninhabited bottom type (subtype of every type), so `throw` expressions conform to any expected return type and `List[Nothing]` is a subtype of `List[A]` for every `A` via covariance
- C) `Nothing` compiles to `java.lang.Void` and holds a singleton `null` value
- D) `Nothing` automatically converts any `Option[A]` to `None`

<details><summary>Answer</summary>

**B.** Because `Nothing <: T` for every type `T` and `List[+A]` is covariant, `Nil: List[Nothing]` is assignable to `List[Int]`, `List[String]`, or any `List[A]` without allocation, and non-returning expressions (`???`, `throw`) typecheck in any branch.

- Why not A: `Nothing` is the bottom type (subtype of both `AnyVal` and `AnyRef`), not a supertype.
- Why not C: `Nothing` has zero runtime values (`Null` has `null`, `Unit` has `()`); `throw` never produces a value.
- Why not D: `None` has type `Option[Nothing]`, which is a subtype of `Option[A]`, not an automatic conversion.
- Ref: [modules/03-type-system-variance-and-type-inference.md](../modules/03-type-system-variance-and-type-inference.md), https://docs.scala-lang.org/tour/unified-types.html

</details>

### Q-SCALA-019 · Type System, Variance & Type Inference · difficulty 3 · multi

Which TWO statements about Scala 3's `-Yexplicit-nulls` flag are true?

- A) Reference types such as `String` no longer accept `null` unless explicitly typed as `String | Null`
- B) Flow-sensitive type narrowing (`if x != null then ...`) narrows `x: String | Null` to `String` inside the `then` branch
- C) Java methods returning `String` are typed as `Nothing` until wrapped in `Option`
- D) `Null` becomes a subtype of `Int` and `Boolean`

<details><summary>Answer</summary>

**A, B.** Under `-Yexplicit-nulls`, `Null` is detached from `AnyRef` (becoming a direct subtype of `Any`), nullable values require `T | Null`, and Scala 3 performs flow-based non-null narrowing after `x != null` checks (while Scala 3.5+ flexible types smooth Java interop).

- Why not C: Java reference return types are typed using flexible types (`T?` / `T | Null` compatibility), not `Nothing`.
- Why not D: `Null` remains disjoint from `AnyVal` value types (`Int`, `Boolean`).
- Ref: [modules/03-type-system-variance-and-type-inference.md](../modules/03-type-system-variance-and-type-inference.md), https://docs.scala-lang.org/scala3/reference/experimental/explicit-nulls.html

</details>

### Q-SCALA-020 · Type System, Variance & Type Inference · difficulty 2 · hands-on

Demonstrate using `scala.compiletime.testing.typeCheckErrors` that placing a covariant type parameter `+A` in a contravariant method parameter position is rejected by `scalac`, while widening with `[B >: A]` compiles and widens `CovariantBox[Dog]` to `CovariantBox[Animal]`.

<details><summary>Answer</summary>

Verified in [`02-VarianceGivenOpaqueAndMatch.test.scala`](../examples/02-VarianceGivenOpaqueAndMatch.test.scala) (`"CovariantBox preserves subtyping and widens via lower bound B >: A"` and `"Negative compile-time checks"` assertion `(1)` verifying `"covariant type A occurs in contravariant position"`). Run `mise run test` inside `languages/scala` to verify.

- Ref: [modules/03-type-system-variance-and-type-inference.md](../modules/03-type-system-variance-and-type-inference.md), https://docs.scala-lang.org/scala3/reference/metaprogramming/compiletime-ops.html

</details>

---

## Domain 3: Contextual Abstractions & Type Classes (`Q-SCALA-021`–`Q-SCALA-032`)

### Q-SCALA-021 · Contextual Abstractions & Type Classes · difficulty 1 · single

In Scala 3, if package `codecs` defines `given JsonEncoder[User] = ...`, what happens if a caller writes `import codecs.*`?

- A) The `given` instance is imported automatically along with all regular definitions
- B) Non-given definitions are imported, but `given JsonEncoder[User]` is **not** imported; the caller must write `import codecs.given` (or `import codecs.{*, given}`)
- C) It triggers an ambiguous implicit error at the import site
- D) It imports only `given` instances and skips regular `val`s and `def`s

<details><summary>Answer</summary>

**B.** Scala 3 deliberately separates wildcard value/type imports (`import pkg.*`) from contextual instance imports (`import pkg.given`) so accidental wildcard imports cannot silently hijack implicit resolution.

- Why not A: That was Scala 2's behavior (`import pkg._`), which Scala 3 intentionally changed.
- Why not C: An unused or absent `given` does not create ambiguity on its own.
- Why not D: `import codecs.*` imports non-given members; `import codecs.given` imports `given` instances.
- Ref: [modules/04-contextual-abstractions-given-using-and-typeclasses.md](../modules/04-contextual-abstractions-given-using-and-typeclasses.md), https://docs.scala-lang.org/scala3/reference/contextual/given-imports.html

</details>

### Q-SCALA-022 · Contextual Abstractions & Type Classes · difficulty 2 · single

Why does Scala 3 replace Scala 2's `implicit class RichInt(val n: Int) extends AnyVal` pattern with first-class `extension` methods?

- A) `extension` methods require zero wrapper-class boilerplate, never silently double-allocate when used in generic contexts, and can be organized inside type-class traits directly
- B) `extension` methods execute dynamically via reflection at runtime
- C) `extension` methods bypass JVM visibility rules so they can read `private[this]` fields of foreign classes
- D) `extension` methods can only extend `AnyVal` primitives

<details><summary>Answer</summary>

**A.** `extension (n: Int) def ...` desugars directly to a static-style extension method with no intermediate wrapper class (`RichInt`) and integrates seamlessly inside type classes (`trait Monoid[A] { extension (x: A) def combine(y: A): A }`).

- Why not B: `extension` methods resolve statically at compile time and compile to direct method calls.
- Why not C: Extension methods obey normal visibility rules and cannot access private internals of unrelated classes.
- Why not D: `extension` works on any type, including generic type parameters `extension [A](xs: List[A])`.
- Ref: [modules/04-contextual-abstractions-given-using-and-typeclasses.md](../modules/04-contextual-abstractions-given-using-and-typeclasses.md), https://docs.scala-lang.org/scala3/reference/contextual/extension-methods.html

</details>

### Q-SCALA-023 · Contextual Abstractions & Type Classes · difficulty 2 · single

What is an **orphan instance** in Scala type-class design, and why should production codebases avoid it?

- A) A `given` instance declared inside the type class's own companion object; it causes stack overflow
- B) A `given` instance defined outside both the type class's companion object and the data type's companion object, breaking type-class coherence and causing ambiguous implicit errors or inconsistent behavior depending on imports
- C) A `given` instance that has no `using` parameters
- D) A `given` instance marked `private` inside a test suite

<details><summary>Answer</summary>

**B.** Defining `given Order[User]` in an unrelated `Implicits` object (neither `Order`'s companion nor `User`'s companion) creates an orphan instance: two modules can define conflicting instances and build `Set[User]`s with incompatible ordering invariants, violating global coherence.

- Why not A: Defining an instance in the type class's companion object (for stdlib types) or the data type's companion object is the canonical _non-orphan_ placement.
- Why not C: Base instances like `given Show[Int]` naturally have no `using` parameters.
- Why not D: Local test instances scoped strictly inside a test do not leak globally (though coherence still matters if passed to shared structures).
- Ref: [modules/04-contextual-abstractions-given-using-and-typeclasses.md](../modules/04-contextual-abstractions-given-using-and-typeclasses.md), https://typelevel.org/cats/typeclasses.html

</details>

### Q-SCALA-024 · Contextual Abstractions & Type Classes · difficulty 2 · single

Where does Scala 3 search for a `given TC[MyType]` when none is in local lexical scope or explicitly imported?

- A) It scans every class on the entire JVM classpath at compile time
- B) It inspects the **implicit scope** of `TC[MyType]`, including the companion objects of `TC`, `MyType`, any superclasses/mixins of `MyType`, and any type arguments inside `MyType`
- C) It falls back to runtime reflection via `ServiceLoader`
- D) It only searches `Predef`

<details><summary>Answer</summary>

**B.** Scala separates `given` lookup into lexical scope (locals, enclosing scopes, imports) and the implicit scope computed from the type's parts (companion objects of the type class, target type, base types, and type parameters).

- Why not A: Scanning the entire classpath would destroy modularity and compile performance.
- Why not C: `given` resolution is completely static at compile time.
- Why not D: `Predef` is only one part of the default lexical scope; companion objects in the implicit scope are always checked automatically.
- Ref: [modules/04-contextual-abstractions-given-using-and-typeclasses.md](../modules/04-contextual-abstractions-given-using-and-typeclasses.md), https://docs.scala-lang.org/scala3/reference/contextual/relationship-implicits.html

</details>

### Q-SCALA-025 · Contextual Abstractions & Type Classes · difficulty 3 · single

What happens when two `given Codec[Int]` instances exist at the same specificity level in lexical scope?

- A) Scala picks the one declared earlier in the file
- B) Scala picks the one whose synthesized name comes first alphabetically
- C) Compilation fails with an `"Ambiguous given instances"` error
- D) Scala composes both codecs sequentially

<details><summary>Answer</summary>

**C.** Unlike Scala 2's older silent shadowing edge cases or non-deterministic fallback, Scala 3 strictly rejects equally specific competing `given` instances in the same scope with a compile-time ambiguity error (`Ambiguous given instances`).

- Why not A: Declaration order does not break ties in implicit resolution.
- Why not B: Synthesized names have no precedence weight.
- Why not D: The compiler cannot invent type-class composition semantics.
- Ref: [modules/04-contextual-abstractions-given-using-and-typeclasses.md](../modules/04-contextual-abstractions-given-using-and-typeclasses.md), https://docs.scala-lang.org/scala3/reference/changed-features/implicit-resolution.html

</details>

### Q-SCALA-026 · Contextual Abstractions & Type Classes · difficulty 2 · single

What does a Scala 3 context function type `type Transactional[A] = DbSession ?=> A` achieve?

- A) It forces `DbSession` to be passed explicitly as a tuple argument
- B) A value of type `Transactional[A]` is a first-class function whose `DbSession` parameter is supplied automatically from the enclosing `using` scope at both definition and call sites
- C) It executes `A` asynchronously on a separate thread pool
- D) It marks `DbSession` as a compile-time `inline` macro

<details><summary>Answer</summary>

**B.** Context functions (`A ?=> B`) allow first-class capability-passing APIs (such as `transaction { ... }` or `boundary { ... }`) where the body receives an implicit `DbSession` automatically and nests cleanly without manual `(using session)` boilerplate.

- Why not A: `?=>` passes the argument contextually (`using`), not as an explicit tuple.
- Why not C: `?=>` has no threading or concurrency semantics on its own.
- Why not D: Context functions are ordinary runtime function values (`ContextFunction1` / `Function1` after lowering), not macros.
- Ref: [modules/04-contextual-abstractions-given-using-and-typeclasses.md](../modules/04-contextual-abstractions-given-using-and-typeclasses.md), https://docs.scala-lang.org/scala3/reference/contextual/context-functions.html

</details>

### Q-SCALA-027 · Contextual Abstractions & Type Classes · difficulty 2 · single

Under `-language:strictEquality` (or `import scala.language.strictEquality`), why does `1 == "1"` fail to compile?

- A) Because `==` is removed from `Any` in Scala 3
- B) Because multiversal equality requires an in-scope `given CanEqual[Int, String]` instance to compare values of distinct types, and no such instance exists between `Int` and `String`
- C) Because `String` is an `opaque type`
- D) Because `1` is widened to `Double` before comparison

<details><summary>Answer</summary>

**B.** Multiversal equality (`CanEqual[L, R]`) turns accidental cross-type comparisons like `Option(1) == 1` or `1 == "1"` into compile-time errors unless a `CanEqual` witness is explicitly defined or derived (`derives CanEqual`).

- Why not A: `Any.==` still exists for backward compatibility when `strictEquality` is off.
- Why not C: `String` is `java.lang.String`, not an opaque type.
- Why not D: `1` is not widened to `Double` in `1 == "1"`.
- Ref: [modules/04-contextual-abstractions-given-using-and-typeclasses.md](../modules/04-contextual-abstractions-given-using-and-typeclasses.md), https://docs.scala-lang.org/scala3/reference/contextual/multiversal-equality.html

</details>

### Q-SCALA-028 · Contextual Abstractions & Type Classes · difficulty 3 · scenario

Given a contravariant type class `trait Show[-A]` with both `given listShow[A](using Show[A]): Show[List[A]]` and `given seqShow[A](using Show[A]): Show[Seq[A]]` in scope, you call `summon[Show[List[Int]]]`. Why does Scala 3 select `listShow` instead of `seqShow` (or failing with ambiguity)?

- A) Because `List` appears alphabetically before `Seq`
- B) Because Scala 3's improved implicit specificity rule compares type-class arguments and treats `listShow` (matching `List[Int]` directly) as strictly more specific than `seqShow` (matching via the supertype `Seq[Int]`), fixing Scala 2's contravariant specificity inversion
- C) Because `Seq` is excluded from implicit search
- D) Because `listShow` must be declared before `seqShow` in the source file

<details><summary>Answer</summary>

**B.** Even though contravariance makes `Show[Seq[Int]] <: Show[List[Int]]`, Scala 3 refines implicit specificity for contravariant type-class positions so that an instance matching the narrower target type (`List[Int]`) wins over a supertype instance (`Seq[Int]`), regardless of declaration order.

- Why not A: Alphabetical ordering has no role in implicit specificity.
- Why not C: `Seq` participates normally in implicit search (and `seqShow` is chosen for `Vector[Int]` or `Seq[Int]`).
- Why not D: Specificity resolution is independent of declaration order inside the file.
- Ref: [modules/04-contextual-abstractions-given-using-and-typeclasses.md](../modules/04-contextual-abstractions-given-using-and-typeclasses.md), https://docs.scala-lang.org/scala3/reference/changed-features/implicit-resolution.html

</details>

### Q-SCALA-029 · Contextual Abstractions & Type Classes · difficulty 2 · single

In `case class User(name: String, age: Int) derives Show, Eq`, what code does the compiler generate?

- A) Runtime reflection proxies inside `User`'s constructor
- B) `given derived$Show: Show[User] = Show.derived` and `given derived$Eq: Eq[User] = Eq.derived` inside `object User`
- C) Java annotations `@Show` and `@Eq` on the JVM class file
- D) An implicit conversion from `User` to `Tuple2[String, Int]`

<details><summary>Answer</summary>

**B.** The `derives` clause desugars into `given` definitions in the companion object calling `TC.derived` (which typically accepts a compiler-synthesized `using Mirror.Of[User]`).

- Why not A: Scala 3 `derives` works purely at compile time via `Mirror` and `inline`, avoiding runtime reflection.
- Why not C: Type classes are Scala `given` objects, not Java annotations.
- Why not D: No implicit conversion to `Tuple2` is synthesized.
- Ref: [modules/04-contextual-abstractions-given-using-and-typeclasses.md](../modules/04-contextual-abstractions-given-using-and-typeclasses.md), https://docs.scala-lang.org/scala3/reference/contextual/derivation.html

</details>

### Q-SCALA-030 · Contextual Abstractions & Type Classes · difficulty 2 · multi

Which TWO statements accurately contrast Scala 3 `Conversion[A, B]` with Scala 2 `implicit def` conversions?

- A) Defining `given Conversion[A, B]` still emits a feature warning at call sites unless `scala.language.implicitConversions` is enabled
- B) `Conversion[A, B]` is an ordinary abstract class/function type whose `given` instances must be imported explicitly via `.given`
- C) `Conversion[A, B]` is applied automatically inside `opaque type` definitions even across unrelated modules
- D) `Conversion[A, B]` completely replaces `using` parameters for type classes

<details><summary>Answer</summary>

**A, B.** Scala 3 isolates implicit conversions behind `scala.Conversion[A, B]` and still guards their use with `scala.language.implicitConversions` to discourage accidental implicit coercion while keeping `given`/`using` clean for type classes.

- Why not C: `opaque type` boundaries are strictly enforced across modules regardless of `Conversion`.
- Why not D: `using` parameters handle type classes and context passing; `Conversion` is strictly for value conversions.
- Ref: [modules/04-contextual-abstractions-given-using-and-typeclasses.md](../modules/04-contextual-abstractions-given-using-and-typeclasses.md), https://docs.scala-lang.org/scala3/reference/contextual/conversions.html

</details>

### Q-SCALA-031 · Contextual Abstractions & Type Classes · difficulty 2 · ordering

Order the steps Scala 3 performs when resolving a `using` parameter of type `TC[List[User]]`:

1. Search the companion objects of `TC`, `List`, and `User` (implicit scope) if not found locally
2. Check local definitions, enclosing class/object members, and explicit `import ...given` statements (lexical scope)
3. Verify there is a unique most-specific candidate (failing with ambiguity if tied)
4. Recursively resolve any `using` parameters required by the selected `given` (e.g., `given [A: TC]: TC[List[A]]`)

- A) `1 → 2 → 3 → 4`
- B) `2 → 1 → 3 → 4`
- C) `2 → 3 → 4 → 1`
- D) `4 → 2 → 1 → 3`

<details><summary>Answer</summary>

**B (`2 → 1 → 3 → 4`).** The compiler checks lexical scope first, falls back to the implicit scope of the type's parts, ensures a unique most-specific match, and recursively resolves nested `using` prerequisites.

- Why not A, C, D: Lexical scope always takes precedence over companion implicit scope, and nested `using` prerequisites are resolved only after selecting a candidate.
- Ref: [modules/04-contextual-abstractions-given-using-and-typeclasses.md](../modules/04-contextual-abstractions-given-using-and-typeclasses.md), https://docs.scala-lang.org/scala3/reference/changed-features/implicit-resolution.html

</details>

### Q-SCALA-032 · Contextual Abstractions & Type Classes · difficulty 2 · hands-on

Using `scala.compiletime.testing.typeCheckErrors`, write compile-time negative tests proving that (1) two competing `given Codec[Int]` instances produce `"Ambiguous given instances"`, and (2) `import scala.language.strictEquality` rejects `1 == "1"`.

<details><summary>Answer</summary>

Verified in [`02-VarianceGivenOpaqueAndMatch.test.scala`](../examples/02-VarianceGivenOpaqueAndMatch.test.scala) (`"Negative compile-time checks"` assertions `(2)` and `(4)`). Run `mise run test` inside `languages/scala` to execute and confirm both compiler diagnostic assertions.

- Ref: [modules/04-contextual-abstractions-given-using-and-typeclasses.md](../modules/04-contextual-abstractions-given-using-and-typeclasses.md), https://docs.scala-lang.org/scala3/reference/contextual/multiversal-equality.html

</details>

---

## Domain 4: Type-Level Scala & Metaprogramming (`Q-SCALA-033`–`Q-SCALA-042`)

### Q-SCALA-033 · Type-Level Scala & Metaprogramming · difficulty 2 · single

Why does `opaque type UserId = String` inside `object Domain` provide stronger zero-cost encapsulation than Scala 2's `final case class UserId(value: String) extends AnyVal`?

- A) `AnyVal` value classes silently box into a heap wrapper whenever passed to generic functions (`List[UserId]`, `Option[UserId]`, `Either[E, UserId]`) or pattern-matched; `opaque type` always erases directly to `String` at runtime with zero allocation
- B) `opaque type` automatically validates regex invariants at runtime
- C) `AnyVal` cannot have `def` methods
- D) `opaque type` generates a separate JVM `.class` file per value instance

<details><summary>Answer</summary>

**A.** JVM erasure forces `AnyVal` wrappers to box onto the heap whenever stored in polymorphic containers (`Option[UserId]`, `List[UserId]`) or used as a trait subtype; `opaque type` is purely a compile-time nominal abstraction whose equality `UserId = String` holds only inside its defining scope (`object Domain`) and vanishes completely in bytecode.

- Why not B: Validation still requires a smart constructor inside `object Domain`.
- Why not C: `AnyVal` value classes can define methods (`def`), though with allocation caveats.
- Why not D: `opaque type` generates zero wrapper classes on the JVM.
- Ref: [modules/05-type-level-scala-opaque-match-and-lambdas.md](../modules/05-type-level-scala-opaque-match-and-lambdas.md), https://docs.scala-lang.org/scala3/reference/other-new-features/opaque-types.html

</details>

### Q-SCALA-034 · Type-Level Scala & Metaprogramming · difficulty 2 · single

In Scala 3, how do union types (`Int | String`) and intersection types (`Named & Logged`) behave at compile time and after JVM erasure?

- A) Both are strictly ordered (`Int | String` is distinct from `String | Int`)
- B) Both are commutative and associative at compile time (`A | B =:= B | A`, `A & B =:= B & A`); at JVM runtime, `Int | String` erases to the least upper bound (`Matchable` / `Object`), whereas `Named & Logged` erases to the lub or first parent class
- C) `Int | String` compiles to `Either[Int, String]` automatically
- D) `Named & Logged` allocates a runtime `Tuple2[Named, Logged]`

<details><summary>Answer</summary>

**B.** Scala 3 union and intersection types are unordered algebraic type combinators (`|` and `&`) with zero runtime wrapper overhead—which means pattern matching `x: List[Int] | List[String]` still hits JVM type erasure on `List`'s element type!

- Why not A: Unlike Scala 2's linearization-dependent `A with B`, Scala 3's `&` and `|` are commutative.
- Why not C: `Either` is a tagged disjoint sum (`Left`/`Right`), whereas `A | B` is an untagged union.
- Why not D: `Named & Logged` requires a single value implementing both types, not a `Tuple2`.
- Ref: [modules/05-type-level-scala-opaque-match-and-lambdas.md](../modules/05-type-level-scala-opaque-match-and-lambdas.md), https://docs.scala-lang.org/scala3/reference/new-types/union-types.html

</details>

### Q-SCALA-035 · Type-Level Scala & Metaprogramming · difficulty 2 · single

How do native Scala 3 type lambdas (`[X] =>> Either[String, X]`) simplify higher-kinded programming compared to Scala 2?

- A) They eliminate the need for compiler plugins (`kind-projector`) and ugly structural type-projection encodings (`({ type L[X] = Either[String, X] })#L`) when supplying partially applied type constructors to `Functor` or `Monad`
- B) They convert `Either` into `Validated` automatically at runtime
- C) They allow type parameters to be inspected via `getClass`
- D) They remove all variance checks from higher-kinded types

<details><summary>Answer</summary>

**A.** Native type lambdas (`[X] =>> F[S, X]`) are first-class type-level functions built directly into Scala 3's type system, replacing Scala 2's unsound structural type projections and third-party compiler plugins.

- Why not B: Type lambdas are purely type-level currying with zero runtime effect.
- Why not C: Type lambdas erase on the JVM just like regular type constructors.
- Why not D: Type lambdas still obey variance and kind-checking rules.
- Ref: [modules/05-type-level-scala-opaque-match-and-lambdas.md](../modules/05-type-level-scala-opaque-match-and-lambdas.md), https://docs.scala-lang.org/scala3/reference/new-types/type-lambdas.html

</details>

### Q-SCALA-036 · Type-Level Scala & Metaprogramming · difficulty 3 · single

When defining a Scala 3 match type `type Elem[X] = X match { case String => Char; case Iterable[t] => t; case Any => X }`, why can `Elem[X]` fail to reduce when `X` is an abstract type parameter inside a method?

- A) Match types can only match `Int` and `Boolean`
- B) To preserve type soundness, `scalac` only advances past a case (`case String => ...`) when the scrutinee `X` is known to match it **or** is provably disjoint from it; an unconstrained abstract `X` could later be instantiated to `String` or an unrelated subtype
- C) Match types require `-Yexplicit-nulls` to reduce
- D) Match types are evaluated at runtime via `ClassTag`

<details><summary>Answer</summary>

**B.** Disjointness checking ensures `Elem[X]` never reduces prematurely to the wrong branch; for example, a non-final class `Foo` cannot prove disjointness from a trait `Bar` unless `Foo` is `final` or `sealed`, because a subclass `class Baz extends Foo with Bar` could exist!

- Why not A: Match types work on arbitrary class/trait/tuple/singleton types.
- Why not C: Match-type reduction has no dependency on `-Yexplicit-nulls`.
- Why not D: Match types are evaluated statically by the type checker during compilation.
- Ref: [modules/05-type-level-scala-opaque-match-and-lambdas.md](../modules/05-type-level-scala-opaque-match-and-lambdas.md), https://docs.scala-lang.org/scala3/reference/new-types/match-types.html

</details>

### Q-SCALA-037 · Type-Level Scala & Metaprogramming · difficulty 2 · single

What distinguishes a `transparent inline def` from a plain `inline def` in Scala 3?

- A) `transparent inline def` executes on a background virtual thread
- B) `transparent inline def` exposes the precise, narrowed type of the inlined expansion to the call site (allowing `if b then 1 else "x"` to typecheck as `1` or `"x"` when `b` is statically known), whereas a plain `inline def` keeps its declared return type
- C) `transparent inline def` disables `-Werror` inside the function body
- D) `transparent inline def` can only be called from Java code

<details><summary>Answer</summary>

**B.** `transparent inline` lets the expanded expression refine the return type at the call site, making it essential for type-level programming, heterogeneous tuple projections, and whitebox-style macro helpers without sacrificing TASTy type safety.

- Why not A: `inline` and `transparent inline` are compile-time expansion mechanisms, not concurrency primitives.
- Why not C: Compiler warnings and errors still apply to expanded code.
- Why not D: Java callers cannot expand Scala 3 `inline` definitions without Scala compilation.
- Ref: [modules/06-metaprogramming-inline-mirrors-and-macros.md](../modules/06-metaprogramming-inline-mirrors-and-macros.md), https://docs.scala-lang.org/scala3/reference/metaprogramming/inline.html

</details>

### Q-SCALA-038 · Type-Level Scala & Metaprogramming · difficulty 2 · single

How does `Mirror.ProductOf[User]` enable zero-reflection `derives Show` in Scala 3?

- A) It invokes `java.lang.Class.getDeclaredFields` at startup
- B) The compiler synthesizes a `Mirror.ProductOf[User]` whose type members `MirroredElemLabels` and `MirroredElemTypes` encode the field names and field types as compile-time literal/tuple types, which `inline erasedValue` and `summonInline` traverse statically
- C) It serializes `User` to JSON at compile time and embeds the string
- D) It generates bytecode proxies using `sun.misc.Unsafe`

<details><summary>Answer</summary>

**B.** `Mirror.ProductOf` exposes structural metadata purely at the type level (`MirroredElemLabels`, `MirroredElemTypes`, `fromProduct`), letting `inline` derivation loops unroll field-by-field `summonInline` lookups at compile time with zero runtime reflection.

- Why not A: No Java reflection (`getDeclaredFields`) is used during `Mirror` derivation.
- Why not C: `Mirror` provides structural metadata for arbitrary type classes (`Show`, `Eq`, codecs), not pre-baked JSON strings.
- Why not D: `Mirror` relies on compiler-synthesized companion metadata and standard `Product` accessors, not `Unsafe`.
- Ref: [modules/06-metaprogramming-inline-mirrors-and-macros.md](../modules/06-metaprogramming-inline-mirrors-and-macros.md), https://docs.scala-lang.org/scala3/reference/contextual/derivation.html

</details>

### Q-SCALA-039 · Type-Level Scala & Metaprogramming · difficulty 3 · single

In a Scala 3 macro using quotes (`'{ ... }`) and splices (`${ ... }`), what does **Phase Consistency** forbid?

- A) Calling `println` inside a macro implementation
- B) Referencing a compile-time local variable `val x: Int` directly inside a runtime quote `'{ x + 1 }` without lifting it into an `Expr[Int]` via `Expr(x)` (`ToExpr[Int]`)
- C) Defining two macros in the same object
- D) Splicing an `Expr[T]` returned by a helper method

<details><summary>Answer</summary>

**B.** Scala 3 enforces multi-stage programming (phase consistency): expressions inside `'{ ... }` execute one stage later (runtime) than the enclosing macro code (compile time), so compile-time values must cross the stage boundary explicitly via `ToExpr` (`Expr(x)` / `${ Expr(x) }`).

- Why not A: Compile-time logging/reporting (`report.info`, etc.) is valid during macro expansion.
- Why not C: Multiple macros in the same object are completely normal.
- Why not D: Delegating AST construction to helper methods returning `Expr[T]` (passing `using Quotes`) is the standard modular macro pattern.
- Ref: [modules/06-metaprogramming-inline-mirrors-and-macros.md](../modules/06-metaprogramming-inline-mirrors-and-macros.md), https://docs.scala-lang.org/scala3/reference/metaprogramming/macros.html

</details>

### Q-SCALA-040 · Type-Level Scala & Metaprogramming · difficulty 2 · multi

Which TWO statements about Polymorphic Function Types (`[A] => List[A] => Option[A]`) in Scala 3 are accurate?

- A) They allow a universally quantified function to be stored in a `val`, passed as an argument, or returned from a method without wrapping it in a single-method `trait`
- B) They are essential for passing rank-2 polymorphic callbacks (such as `ST[S, A]` run blocks `[S] => ST[S, A]`) as first-class values
- C) They eliminate type erasure on the JVM for `List[A]`
- D) They can only take one type parameter

<details><summary>Answer</summary>

**A, B.** Polymorphic function values (`PolyFunction` desugaring) bring rank-2 polymorphism directly to first-class Scala values, enabling APIs like `[S] => Region[S] => A` or generic combinators without ad-hoc helper traits.

- Why not C: Runtime JVM type erasure still applies to `List[A]`.
- Why not D: Multiple type parameters (`[A, B] => (A, B) => (B, A)`) are fully supported.
- Ref: [modules/05-type-level-scala-opaque-match-and-lambdas.md](../modules/05-type-level-scala-opaque-match-and-lambdas.md), https://docs.scala-lang.org/scala3/reference/new-types/polymorphic-function-types.html

</details>

### Q-SCALA-041 · Type-Level Scala & Metaprogramming · difficulty 3 · ordering

Order the compile-time steps `scalac` performs when expanding a `derives Show` clause on `case class User(name: String, age: Int)`:

1. Unroll `inline erasedValue[m.MirroredElemTypes]` recursively and invoke `summonInline[Show[String]]` and `summonInline[Show[Int]]`
2. Synthesize `given derived$Show: Show[User] = Show.derived` in `object User`
3. Synthesize `Mirror.ProductOf[User]` with `MirroredElemLabels = ("name", "age")` and `MirroredElemTypes = (String, Int)`
4. Emit specialized JVM bytecode calling `Show[String]` and `Show[Int]` directly with no runtime reflection

- A) `2 → 3 → 1 → 4`
- B) `1 → 2 → 3 → 4`
- C) `3 → 1 → 4 → 2`
- D) `2 → 1 → 3 → 4`

<details><summary>Answer</summary>

**A (`2 → 3 → 1 → 4`).** The `derives` clause emits the `given` calling `Show.derived`, the compiler supplies `Mirror.ProductOf[User]`, `inline` expansion unrolls `summonInline` for every field type, and the backend emits direct static calls.

- Why not B, C, D: `erasedValue[m.MirroredElemTypes]` cannot be unrolled before `Show.derived` is synthesized and receives `Mirror.ProductOf[User]`, and bytecode emission is always final.
- Ref: [modules/06-metaprogramming-inline-mirrors-and-macros.md](../modules/06-metaprogramming-inline-mirrors-and-macros.md), https://docs.scala-lang.org/scala3/reference/contextual/derivation.html

</details>

### Q-SCALA-042 · Type-Level Scala & Metaprogramming · difficulty 3 · hands-on

Implement a `Mirror.ProductOf`-backed `Show` type class with `derives Show`, an `opaque type PositiveInt = Int` smart constructor, and a negative `typeCheckErrors` test proving `opaque type` methods (such as `String.length`) do not leak outside the defining object.

<details><summary>Answer</summary>

Verified in [`02-VarianceGivenOpaqueAndMatch.test.scala`](../examples/02-VarianceGivenOpaqueAndMatch.test.scala) (sections `2. Opaque types`, `5. Given/using & Mirror type-class derivation`, and `6. Compile-time negative tests` assertion `(3)`). Execute `mise run test` inside `languages/scala` to run all compile-time and runtime assertions.

- Ref: [modules/05-type-level-scala-opaque-match-and-lambdas.md](../modules/05-type-level-scala-opaque-match-and-lambdas.md), [modules/06-metaprogramming-inline-mirrors-and-macros.md](../modules/06-metaprogramming-inline-mirrors-and-macros.md)

</details>

---

## Domain 5: Concurrency, Effect Systems & Streaming (`Q-SCALA-043`–`Q-SCALA-057`)

### Q-SCALA-043 · Concurrency, Effect Systems & Streaming · difficulty 2 · single

Why does `scala.concurrent.Future` violate referential transparency compared to Cats Effect `IO` or `ZIO`?

- A) `Future` cannot run on OpenJDK 25
- B) `Future { sideEffect() }` is eagerly memoized and immediately scheduled on an `ExecutionContext` upon construction, so substituting `val f = Future(x)` into `(f, f)` runs the effect **once**, whereas inlining `(Future(x), Future(x))` runs it **twice**
- C) `Future` does not support `flatMap`
- D) `Future` always blocks the calling thread synchronously

<details><summary>Answer</summary>

**B.** `Future` represents an already-running computation (memoized handle), not a pure description of an effect; `IO` and `ZIO` are lazy effect values where `val io = IO(x); (io, io)` and `(IO(x), IO(x))` have identical semantics.

- Why not A: `Future` runs on any JVM, including OpenJDK 25.
- Why not C: `Future` provides `map` and `flatMap` (requiring an implicit/given `ExecutionContext` on every combinator call).
- Why not D: `Future` executes asynchronously on the supplied `ExecutionContext` unless `Await.result` is called.
- Ref: [modules/07-concurrency-fibers-virtual-threads-and-capture-checking.md](../modules/07-concurrency-fibers-virtual-threads-and-capture-checking.md), https://typelevel.org/cats-effect/docs/concepts

</details>

### Q-SCALA-044 · Concurrency, Effect Systems & Streaming · difficulty 2 · scenario

A blocking JDBC call is placed inside `Future { jdbcQuery() }` running on Scala's default global `ExecutionContext` (sized to CPU core count). Under load, all HTTP request handlers freeze even though CPU usage is near 0%. What happened, and how do OpenJDK 25 virtual threads (or Cats Effect `IO.blocking`) avoid this?

- A) Thread starvation: blocking calls pinned all fixed carrier threads; OpenJDK 25 virtual threads unmount from carrier OS threads during blocking JDK I/O (and `IO.blocking` shifts work onto an elastic cached blocking pool)
- B) The garbage collector froze the `ExecutionContext` because `Future` uses weak references
- C) `jdbcQuery()` exceeded Scala's `-Xmax-inlines` limit
- D) `ExecutionContext.global` limits total `Future` allocations to 8 per JVM lifetime

<details><summary>Answer</summary>

**A.** Fixed-size compute pools (`Runtime.getRuntime.availableProcessors`) deadlock/starve when threads block on I/O (or nested `Await.result`); OpenJDK 25 virtual threads (JEP 444 + JEP 491 synchronized-unpinning) park lightweight virtual continuations off the carrier thread, while Cats Effect `IO.blocking` dispatches blocking calls onto a dedicated unbounded cached thread pool so compute fibers keep running.

- Why not B: The issue is thread-pool exhaustion, not GC or weak references.
- Why not C: `-Xmax-inlines` is a compile-time limit.
- Why not D: `ExecutionContext.global` limits concurrent carrier threads, not total `Future` objects allocated.
- Ref: [modules/07-concurrency-fibers-virtual-threads-and-capture-checking.md](../modules/07-concurrency-fibers-virtual-threads-and-capture-checking.md), https://typelevel.org/cats-effect/docs/thread-model

</details>

### Q-SCALA-045 · Concurrency, Effect Systems & Streaming · difficulty 3 · single

What safety guarantee does Scala 3's experimental **Capture Checking** (`^`) add over traditional effect systems or unannotated capabilities?

- A) It automatically retries failed HTTP requests
- B) It tracks captured capabilities (such as file handles `File^` or `CanThrow^`) in function types statically so a resource created inside a scoped region (`usingFile { f => ... }`) cannot escape in a returned closure or `LazyList` thunk after the scope closes
- C) It converts every `IO` monad into a `ZLayer`
- D) It removes `Ref` atomic operations from the JVM

<details><summary>Answer</summary>

**B.** Capture Checking tracks capability sets in the type system (`A ->{cap} B` / `A => B` pure vs `A ->^ B` impure), preventing resource-escape bugs (e.g., returning a lazy iterator or closure capturing a closed `File` or Ox `Fork` scope) at compile time.

- Why not A: Retry policies are application/library logic, not type-level capability tracking.
- Why not C: Capture checking is a language-level type system feature orthogonal to `IO`/`ZLayer`.
- Why not D: Atomic `Ref`s remain necessary for shared concurrent state.
- Ref: [modules/07-concurrency-fibers-virtual-threads-and-capture-checking.md](../modules/07-concurrency-fibers-virtual-threads-and-capture-checking.md), https://docs.scala-lang.org/scala3/reference/experimental/cc.html

</details>

### Q-SCALA-046 · Concurrency, Effect Systems & Streaming · difficulty 2 · single

Why is `ValidatedNel[E, A]` not a `Monad` in Cats, and what happens if you attempt to use it in a `for`-comprehension?

- A) Because `ValidatedNel` has no `map` method
- B) Because `Monad`'s `flatMap` requires sequential data dependency (short-circuiting on the first `Invalid` error because no `A` exists to pass to `f: A => ValidatedNel[E, B]`), which contradicts `Validated`'s parallel error-accumulating `Applicative` behavior; using `flatMap` directly is disallowed (unless explicitly converting via `.toEither` or `andThen`)
- C) Because `ValidatedNel` can only store `Throwable` errors
- D) Because `NonEmptyList` is not associative

<details><summary>Answer</summary>

**B.** A lawful `Monad`'s `ap` must agree with `flatMap`; since `flatMap` must short-circuit when the first step fails (it lacks an `A` to invoke the continuation), `Validated` intentionally provides `Applicative` (`mapN`) error accumulation instead of `Monad`.

- Why not A: `Validated` is a lawful `Functor` and `Applicative`, so it defines `map` and `ap`.
- Why not C: The error channel `E` in `ValidatedNel[E, A]` can be any type (usually domain ADTs or `String`).
- Why not D: `NonEmptyList` forms a lawful `Semigroup`, which is precisely why error accumulation works.
- Ref: [modules/08-typelevel-ecosystem-cats-and-cats-effect.md](../modules/08-typelevel-ecosystem-cats-and-cats-effect.md), https://typelevel.org/cats/datatypes/validated.html

</details>

### Q-SCALA-047 · Concurrency, Effect Systems & Streaming · difficulty 2 · single

How does Cats' `Parallel[M]` (`parMapN`, `parTraverse`) allow `Either[NonEmptyList[E], A]` or `IO[A]` to alternate between sequential and parallel/accumulating semantics?

- A) It mutates the `Monad` instance globally at runtime
- B) It defines a natural transformation `M ~> F` to a companion `Applicative` `F` (`Validated` for `Either`, `IO.Par` for `IO`), combines independent effects under `F`, and transforms `F ~> M` back
- C) It spawns OS processes via `ProcessBuilder`
- D) It converts `Either` into `Option` and drops all error values

<details><summary>Answer</summary>

**B.** `Parallel` pairs a `Monad` `M` with a related `Applicative` `F` via natural transformations (`parallel` and `sequential`), allowing `Either` to accumulate errors like `Validated` inside `parMapN` and `IO` to run concurrent fibers inside `parTraverse` while keeping regular `flatMap` sequential.

- Why not A: Type-class instances are immutable compile-time `given`s; `Parallel` uses explicit natural transformations.
- Why not C: `Parallel` executes in-process via the target `Applicative` (`Validated` / fiber runtime).
- Why not D: All errors are preserved and combined via `Semigroup` (for `Either`) or structured race/cancellation (for `IO`).
- Ref: [modules/08-typelevel-ecosystem-cats-and-cats-effect.md](../modules/08-typelevel-ecosystem-cats-and-cats-effect.md), https://typelevel.org/cats/typeclasses/parallel.html

</details>

### Q-SCALA-048 · Concurrency, Effect Systems & Streaming · difficulty 2 · single

How does Cats Effect 3 `IO` execute 100,000+ chained `flatMap` calls without throwing `StackOverflowError`?

- A) It requires the JVM `-Xss128m` flag
- B) It reifies `IO` combinators (`Pure`, `Delay`, `FlatMap`, `HandleErrorWith`, `Async`) as heap-allocated ADT nodes interpreted by an iterative trampoline `while` loop (`IORunLoop`) on each fiber
- C) It compiles `flatMap` chains into `@tailrec` methods via a Scala 3 macro
- D) It spawns a new virtual thread on every `flatMap`

<details><summary>Answer</summary>

**B.** `IO` builds an explicit heap-allocated AST/continuation stack (`ArrayStack`) executed by a trampolined run loop, making arbitrary recursion via `flatMap` completely stack-safe in $O(1)$ JVM call stack frames.

- Why not A: Default JVM thread stacks suffice because frames live in the heap continuation stack, not the JVM call stack.
- Why not C: Dynamic runtime recursion through `flatMap` cannot generally be rewritten into static `@tailrec`.
- Why not D: Sequential `flatMap` steps execute on the same fiber without spawning new threads or fibers.
- Ref: [modules/08-typelevel-ecosystem-cats-and-cats-effect.md](../modules/08-typelevel-ecosystem-cats-and-cats-effect.md), https://typelevel.org/cats-effect/docs/core/io

</details>

### Q-SCALA-049 · Concurrency, Effect Systems & Streaming · difficulty 3 · scenario

Suppose a fiber acquires a database connection using `IO.uncancelable { poll => acquire.flatMap(conn => poll(use(conn)).guarantee(release(conn))) }` (equivalent to `Resource.make`). Another fiber calls `fiber.cancel` while `use(conn)` is suspended on `IO.never`. What happens?

- A) `acquire` and `release` are both skipped immediately
- B) `poll(use(conn))` receives the cancelation signal and aborts `use(conn)`, then `release(conn)` executes **uncancelably** before `fiber.cancel` completes (backpressured cancelation)
- C) `fiber.cancel` throws `InterruptedException` in the caller fiber immediately without waiting for `release(conn)`
- D) `use(conn)` continues forever because `IO.uncancelable` wraps the entire block

<details><summary>Answer</summary>

**B.** Cats Effect 3 guarantees **backpressured cancelation**: `poll` re-enables cancelation inside `use`, aborting `use(conn)`, while `release(conn)` inside `guarantee` runs uncancelably and `fiber.cancel` semantically suspends until `release(conn)` finishes!

- Why not A: Once `acquire` succeeds inside an uncancelable region, `release` is guaranteed to run.
- Why not C: `fiber.cancel` awaits completion of all finalizers rather than returning prematurely with leaked resources.
- Why not D: `poll(...)` explicitly punches a cancelable window around `use(conn)`.
- Ref: [modules/08-typelevel-ecosystem-cats-and-cats-effect.md](../modules/08-typelevel-ecosystem-cats-and-cats-effect.md), https://typelevel.org/cats-effect/docs/core/cancellation

</details>

### Q-SCALA-050 · Concurrency, Effect Systems & Streaming · difficulty 2 · single

Why is `Ref.modify(s => (nextState, result))` preferred over calling `ref.get` followed by `ref.set` in concurrent fiber code?

- A) `ref.get` followed by `ref.set` is non-atomic and suffers from lost updates under concurrent fibers, whereas `Ref.modify` executes a lock-free compare-and-swap (CAS) retry loop atomically
- B) `ref.get` blocks an OS thread
- C) `Ref.modify` locks the entire JVM heap
- D) `Ref` does not support `get` in Cats Effect 3

<details><summary>Answer</summary>

**A.** Separating `get` and `set` introduces a classic TOCTOU (time-of-check to time-of-use) race condition; `Ref.modify` and `Ref.update` loop atomically via `AtomicReference.compareAndSet`, ensuring pure state transitions never lose concurrent updates (provided the transition function is pure and fast).

- Why not B: `Ref.get` is a non-blocking volatile read wrapped in `F[A]`.
- Why not C: `Ref` is lock-free via CAS, not global locking.
- Why not D: `Ref` provides `get`, `set`, `update`, and `modify`.
- Ref: [modules/08-typelevel-ecosystem-cats-and-cats-effect.md](../modules/08-typelevel-ecosystem-cats-and-cats-effect.md), https://typelevel.org/cats-effect/docs/std/ref

</details>

### Q-SCALA-051 · Concurrency, Effect Systems & Streaming · difficulty 2 · single

What happens when a consumer fiber calls `deferred.get` on an empty `Deferred[IO, A]`?

- A) It spins in a busy-wait `while` loop consuming 100% of a CPU core
- B) It throws `NoSuchElementException` immediately
- C) It semantically suspends (deschedules) the fiber without blocking any carrier OS thread until another fiber calls `deferred.complete(a)`
- D) It returns `None` after 1 second

<details><summary>Answer</summary>

**C.** `Deferred` is a purely functional single-assignment promise that registers a fiber callback when incomplete, freeing the carrier OS thread to run other fibers until `complete(a)` wakes all waiters.

- Why not A: Semantic fiber blocking avoids busy-waiting and thread-pool pinning.
- Why not B: `Deferred.get` waits asynchronously rather than throwing when incomplete.
- Why not D: `Deferred.get` has no built-in timeout (`IO.timeout` handles timeouts explicitly).
- Ref: [modules/08-typelevel-ecosystem-cats-and-cats-effect.md](../modules/08-typelevel-ecosystem-cats-and-cats-effect.md), https://typelevel.org/cats-effect/docs/std/deferred

</details>

### Q-SCALA-052 · Concurrency, Effect Systems & Streaming · difficulty 2 · single

How does FS2's `Stream[F, O]` achieve high throughput without per-element monadic `flatMap` overhead, while still maintaining deterministic cleanup on `.take(3)`?

- A) It eagerly evaluates the entire stream into a `Vector` before applying `.take(3)`
- B) It processes elements in batched `Chunk[O]` arrays driven by a downstream pull state machine (`Pull[F, O, R]`), opening `Stream.bracket` scopes lazily on first pull and running finalizers immediately once 3 elements are emitted
- C) It relies on `finalize()` GC hooks to close sockets
- D) It buffers infinitely in an unbounded `ConcurrentLinkedQueue`

<details><summary>Answer</summary>

**B.** FS2 separates chunk-level pure array/vector operations (`Chunk`) from `Pull` interpreter steps, amortizing `F` monadic overhead while enforcing pull-driven backpressure and lexical/dynamic resource scoping (`Scope`).

- Why not A: Eager evaluation would break infinite streams and waste memory/I/O.
- Why not C: JVM `finalize()` is non-deterministic and deprecated; FS2 `Scope` closes resources deterministically upon pull completion or error.
- Why not D: Unbounded buffering defeats backpressure and causes `OutOfMemoryError`.
- Ref: [modules/09-functional-streaming-fs2-and-zio-ecosystem.md](../modules/09-functional-streaming-fs2-and-zio-ecosystem.md), https://fs2.io/#/guide

</details>

### Q-SCALA-053 · Concurrency, Effect Systems & Streaming · difficulty 2 · single

What do the three type parameters in ZIO 2's `ZIO[R, E, A]` represent, and how does `ZIO` compare to Cats Effect `IO[A]`?

- A) `R` is retry count, `E` is executor thread, `A` is array buffer
- B) `R` is required environment/dependencies (wired via `ZLayer`), `E` is typed failure channel (distinct from unrecoverable `Cause` defects), and `A` is success value; `IO[A]` fixes environment to `Unit` (using explicit constructor/parameter passing or Tagless Final) and fixes errors to `Throwable`
- C) `R` is return type, `E` is side effect, `A` is allocator
- D) `ZIO` is strictly single-threaded whereas `IO` is multi-threaded

<details><summary>Answer</summary>

**B.** `ZIO[-R, +E, +A]` models dependency injection (`R`) and checked errors (`E`) in its effect type (supported by variance `-R, +E, +A` and `ZLayer` wiring), whereas Cats Effect `IO[+A]` keeps a single type parameter (`Throwable` error channel, explicit constructors or `Resource` dependency graphs, or `EitherT` / Tagless Final).

- Why not A, C: Those invent non-existent meanings for `R`, `E`, and `A`.
- Why not D: Both Cats Effect 3 and ZIO 2 run on multi-threaded fiber work-stealing schedulers.
- Ref: [modules/09-functional-streaming-fs2-and-zio-ecosystem.md](../modules/09-functional-streaming-fs2-and-zio-ecosystem.md), https://zio.dev/overview/basic-concepts

</details>

### Q-SCALA-054 · Concurrency, Effect Systems & Streaming · difficulty 3 · multi

Which TWO statements accurately describe Tagless Final (`trait UserRepo[F[_]]`) vs concrete `IO` / `ZIO` in Scala 3 production services?

- A) Tagless Final decouples domain algebras from concrete effect runtimes and allows testing pure logic with `Id` or `Either`, or swapping `IO` and `ZIO` interpreters
- B) Over-constraining every leaf function with `F[_]: Async: Clock: Console` can leak low-level runtime capabilities everywhere and add type-class dictionary indirection when concrete `IO` or narrow domain algebras would be simpler
- C) Tagless Final eliminates all `given` resolution at compile time
- D) Tagless Final forces every method to run synchronously on the calling thread

<details><summary>Answer</summary>

**A, B.** Tagless Final shines at abstracting narrow domain algebras (`UserRepo[F]`) with minimal constraints (`MonadError` / `Sync` only at boundaries), whereas threading `Async[F]` everywhere reproduces the "everything can do arbitrary I/O" anti-pattern with extra syntactic noise.

- Why not C: Tagless Final relies heavily on `given`/`using` type-class resolution.
- Why not D: Runtime execution depends on the instantiated `F` (e.g., `IO` runs asynchronously on fibers).
- Ref: [modules/08-typelevel-ecosystem-cats-and-cats-effect.md](../modules/08-typelevel-ecosystem-cats-and-cats-effect.md), [modules/09-functional-streaming-fs2-and-zio-ecosystem.md](../modules/09-functional-streaming-fs2-and-zio-ecosystem.md)

</details>

### Q-SCALA-055 · Concurrency, Effect Systems & Streaming · difficulty 2 · single

In FS2, how do `s.mapAsync(n)(f)` and `s.parEvalMapUnordered(n)(f)` differ?

- A) `mapAsync(n)` runs at most `n` effects concurrently while preserving the **upstream element order** downstream (head-of-line blocking if element 1 is slower than element 2), whereas `parEvalMapUnordered(n)` emits results as soon as each effect completes
- B) `mapAsync(n)` runs sequentially (`n = 1` always)
- C) `parEvalMapUnordered(n)` drops errors silently
- D) `mapAsync(n)` requires `ZIO` whereas `parEvalMapUnordered` requires `Future`

<details><summary>Answer</summary>

**A.** Both bound in-flight concurrency to `n` with backpressure, but `mapAsync` (`parEvalMap`) preserves original stream ordering, while `parEvalMapUnordered` maximizes throughput when downstream order does not matter.

- Why not B: `mapAsync(n)` executes up to `n` effects concurrently.
- Why not C: Failures in any concurrent pull cancel remaining in-flight fibers and propagate downstream.
- Why not D: Both are native `fs2.Stream` combinators parameterized over `F[_]: Concurrent`.
- Ref: [modules/09-functional-streaming-fs2-and-zio-ecosystem.md](../modules/09-functional-streaming-fs2-and-zio-ecosystem.md), https://fs2.io/#/guide

</details>

### Q-SCALA-056 · Concurrency, Effect Systems & Streaming · difficulty 3 · ordering

Order the execution lifecycle when `Stream.bracket(open)(close).flatMap(use).take(3).compile.toVector` runs on Cats Effect `IO`:

1. Downstream `.take(3)` stops pulling and signals termination upstream
2. `open` executes inside an uncancelable acquisition step and opens the FS2 `Scope`
3. `use` pulls and outputs chunks up to 3 elements
4. The FS2 `Scope` invokes `close` uncancelably before `compile.toVector` completes

- A) `2 → 3 → 1 → 4`
- B) `3 → 2 → 1 → 4`
- C) `2 → 1 → 3 → 4`
- D) `2 → 3 → 4 → 1`

<details><summary>Answer</summary>

**A (`2 → 3 → 1 → 4`).** `Stream.bracket` acquires the resource lazily on the first pull, emits up to 3 items, stops pulling on `.take(3)`, and closes the stream scope deterministically before returning the `Vector`.

- Why not B, C, D: `use` cannot run before `open` acquires the resource, `.take(3)` signals stop only after receiving 3 elements, and `close` executes after downstream stops pulling.
- Ref: [modules/09-functional-streaming-fs2-and-zio-ecosystem.md](../modules/09-functional-streaming-fs2-and-zio-ecosystem.md), https://fs2.io/#/guide

</details>

### Q-SCALA-057 · Concurrency, Effect Systems & Streaming · difficulty 3 · hands-on

Prove in MUnit with Cats Effect 3.7.1 and FS2 3.16.0 that (1) 100,000 chained `IO.flatMap` calls complete without `StackOverflowError`, (2) `Resource.make` runs its release finalizer when a suspended fiber is canceled via `fiber.cancel`, and (3) `Stream.bracket` closes its resource immediately upon a custom `Pull`-based `take(3)` termination.

<details><summary>Answer</summary>

Verified in [`04-CatsEffectAndFs2Streams.test.scala`](../examples/04-CatsEffectAndFs2Streams.test.scala) (`"Cats Effect IO is stack-safe across 100,000 chained flatMap operations"`, `"Resource.make executes finalizers deterministically on normal exit, error, and cancelation"`, and `"FS2 Pull-based chunked Stream runs bracket finalizers on early take(3) termination"`). Run `mise run test` inside `languages/scala` to verify.

- Ref: [modules/08-typelevel-ecosystem-cats-and-cats-effect.md](../modules/08-typelevel-ecosystem-cats-and-cats-effect.md), [modules/09-functional-streaming-fs2-and-zio-ecosystem.md](../modules/09-functional-streaming-fs2-and-zio-ecosystem.md)

</details>

---

## Domain 6: Production Testing, Interop & Scala 2 → 3 Migration (`Q-SCALA-058`–`Q-SCALA-065`)

### Q-SCALA-058 · Production Testing, Interop & Scala 2 → 3 Migration · difficulty 2 · single

Why do property-based tests (ScalaCheck `forAll` / Discipline) catch bugs in algebraic combinators that example-based unit tests miss?

- A) Property tests run in parallel across Kubernetes nodes
- B) Generators explore edge cases (`Int.MinValue`, `0`, empty strings/lists, negative numbers) and shrink failing inputs to minimal counterexamples, falsifying broken laws such as non-associative subtraction or integer-overflow bugs
- C) Property tests prove mathematical soundness for all possible inputs exhaustively
- D) Property tests skip compiling test fixtures

<details><summary>Answer</summary>

**B.** Randomized shrinking generators systematically probe boundary values (`Int.MinValue`, empty collections, duplicates) and minimize failing inputs, exposing subtle law violations (e.g., `(a - b) - c != a - (b - c)` or `math.abs(Int.MinValue) < 0`) immediately.

- Why not A: ScalaCheck runs in-process on generated test cases, not Kubernetes clusters.
- Why not C: Property testing is bounded randomized falsification (typically 100 cases by default), not formal deductive proof over infinite domains.
- Why not D: Property suites are normal compiled Scala test code.
- Ref: [modules/10-production-scala-testing-interoperability-and-evolution.md](../modules/10-production-scala-testing-interoperability-and-evolution.md), https://scalacheck.org/

</details>

### Q-SCALA-059 · Production Testing, Interop & Scala 2 → 3 Migration · difficulty 2 · single

When migrating a large Scala 2.13 codebase to Scala 3.10.1, which statement accurately describes binary and TASTy interoperability across Scala 2.13 and Scala 3 versions?

- A) Scala 3.10.1 cannot depend on any Scala 2.13 artifacts
- B) Scala 3 consumes non-macro Scala 2.13 compiled `.jar`s natively (without `-Ytasty-reader`), whereas Scala 2.13's `-Ytasty-reader` flag supports reading Scala 3 `.tasty` libraries only up to Scala 3.7 (Scala 3.8+ dropped 2.13 TASTy reader compatibility), and Scala 2 macros must be ported or dual-compiled
- C) Scala 3 requires passing `-Ytasty-reader` to read Scala 2.13 `.class` files
- D) Scala 2.13.4 with `-Ytasty-reader` can consume libraries compiled with Scala 3.10.1 without upgrading

<details><summary>Answer</summary>

**B.** Scala 3's compiler reads Scala 2.13 `.class` pickle signatures natively (only Scala 2 macros require porting to Scala 3 `inline`/`Mirror`/`Quotes`). Conversely, `-Ytasty-reader` is a **Scala 2.13** compiler flag that reads Scala 3 TASTy up to Scala 3.7—Scala 3.8+ dropped 2.13 TASTy reader compatibility, making Scala 3.9/3.10 ↔ 2.13 interoperability unidirectional for library publishing.

- Why not A: Scala 3 natively consumes non-macro Scala 2.13 `.jar`s.
- Why not C: `-Ytasty-reader` is a Scala 2.13 flag for reading Scala 3 `.tasty` files, not a Scala 3 flag.
- Why not D: Scala 2.13's `-Ytasty-reader` stops at Scala 3.7 and cannot decode Scala 3.10.1 TASTy.
- Ref: [modules/10-production-scala-testing-interoperability-and-evolution.md](../modules/10-production-scala-testing-interoperability-and-evolution.md), https://docs.scala-lang.org/scala3/guides/migration/compatibility-intro.html

</details>

### Q-SCALA-060 · Production Testing, Interop & Scala 2 → 3 Migration · difficulty 2 · single

What does compiling with `-source:3.0-migration -rewrite` automate when upgrading a Scala 2 codebase to Scala 3?

- A) It automatically rewrites all Scala 2 `macro` implementations into Scala 3 `Quotes` macros
- B) It accepts deprecated Scala 2 syntax (`implicit` imports via `_`, procedure syntax, `varargs` `: _*`, old `for` generators) and rewrites syntactic changes in place (`*` wildcards, `using`/`given` call sites, indented/braced fixes)
- C) It converts `Future` into Cats Effect `IO`
- D) It generates MUnit tests for every public method

<details><summary>Answer</summary>

**B.** `-source:3.0-migration` paired with `-rewrite` (and Scalafix rules) automates mechanical syntax migrations (`import pkg._` → `import pkg.*`, `xs: _*` → `xs*`, `new` removal, wildcard `?`) while flagging semantic changes for developer review.

- Why not A: Scala 2 `scala.reflect.macros` require manual porting to Scala 3 `inline`/`Mirror`/`Quotes`.
- Why not C, D: Migration flags operate on language syntax, not effect libraries or test generation.
- Ref: [modules/10-production-scala-testing-interoperability-and-evolution.md](../modules/10-production-scala-testing-interoperability-and-evolution.md), https://docs.scala-lang.org/scala3/guides/migration/tooling-migration-mode.html

</details>

### Q-SCALA-061 · Production Testing, Interop & Scala 2 → 3 Migration · difficulty 2 · single

How does Scala 3 achieve cleaner Java interoperability for `Function` interfaces and enums compared to Scala 2?

- A) Scala 3 lambdas undergo Single Abstract Method (SAM) conversion to any Java functional interface (`java.util.function.Function`, `Predicate`, `Runnable`) via `invokedynamic`, and `enum Color extends java.lang.Enum[Color]` generates a true Java enum
- B) Scala 3 removes `java.lang.String` from the standard library
- C) Java callers must invoke `scala.Function1.apply` via reflection
- D) Scala 3 `Option` compiles to `java.util.Optional` automatically

<details><summary>Answer</summary>

**A.** SAM conversion makes Scala lambdas drop-in arguments for Java streams/APIs, and extending `java.lang.Enum[E]` on a simple Scala 3 `enum` emits a genuine Java enum usable in Java `switch` statements and annotations.

- Why not B: Scala `String` is a type alias for `java.lang.String`.
- Why not C: SAM conversion and static `@main`/companion forwarders allow direct Java method invocation.
- Why not D: `scala.Option` and `java.util.Optional` remain distinct classes (convertible via `scala.jdk.OptionConverters`).
- Ref: [modules/10-production-scala-testing-interoperability-and-evolution.md](../modules/10-production-scala-testing-interoperability-and-evolution.md), https://docs.scala-lang.org/scala3/reference/enums/enums.html

</details>

### Q-SCALA-062 · Production Testing, Interop & Scala 2 → 3 Migration · difficulty 3 · scenario

Your team enables `-Werror -Wunused:all` in CI and a developer writes `import codecs.*` in a file that passes a `JsonEncoder[User]` implicitly. Compilation fails with an unused-import warning promoted to error on `import codecs.*`, AND a missing-given error for `JsonEncoder[User]`. Why did both happen?

- A) `-Wunused:all` disables all imports globally
- B) `import codecs.*` does not import `given` instances (so `JsonEncoder[User]` wasn't found and nothing from `codecs.*` was used); changing it to `import codecs.given` fixes both errors
- C) `JsonEncoder` must extend `java.io.Serializable`
- D) `-Werror` turns off implicit resolution

<details><summary>Answer</summary>

**B.** In Scala 3, `import pkg.*` ignores `given` definitions, leaving the wildcard import unused (flagged by `-Wunused:all` + `-Werror`) while failing to bring `JsonEncoder[User]` into scope; switching to `import codecs.given` imports the contextual instance cleanly.

- Why not A: `-Wunused:all` flags genuinely unused imports rather than disabling imports.
- Why not C: Type classes do not require `Serializable`.
- Why not D: `-Werror` escalates compiler warnings to errors without altering `typer` implicit search.
- Ref: [modules/10-production-scala-testing-interoperability-and-evolution.md](../modules/10-production-scala-testing-interoperability-and-evolution.md), https://docs.scala-lang.org/scala3/reference/contextual/given-imports.html

</details>

### Q-SCALA-063 · Production Testing, Interop & Scala 2 → 3 Migration · difficulty 2 · multi

Which TWO Scala 2 features were dropped or replaced in Scala 3?

- A) XML literals and procedure syntax (`def foo() { ... }` without `=`)
- B) DelayedInit (`App` magic) and general abstract type projections (`T#U` when `T` is abstract)
- C) `@tailrec` and `LazyList`
- D) Pattern matching and `Option`

<details><summary>Answer</summary>

**A, B.** Scala 3 dropped procedure syntax (`def f() { ... }`), `DelayedInit`, general abstract type projection (`T#U`), and legacy Scala 2 features like existential `forSome` and XML literals (deprecated/dropped in favor of interpolators).

- Why not C, D: `@tailrec`, `LazyList`, pattern matching, and `Option` are core retained features in Scala 3.
- Ref: [modules/10-production-scala-testing-interoperability-and-evolution.md](../modules/10-production-scala-testing-interoperability-and-evolution.md), https://docs.scala-lang.org/scala3/reference/dropped-features/index.html

</details>

### Q-SCALA-064 · Production Testing, Interop & Scala 2 → 3 Migration · difficulty 2 · ordering

Order the recommended migration workflow for moving a multi-module Scala 2.13 codebase to Scala 3.10.1:

1. Cross-compile or migrate leaf libraries onto Scala 3 LTS (`3.3`–`3.7` if Scala 2.13 consumers still need `-Ytasty-reader`, otherwise `3.9` LTS) using `-Xsource:3` and `-source:3.0-migration -rewrite`
2. Upgrade to Scala 2.13.latest and replace Scala 2 macros / compiler plugins (`kind-projector` → native type lambdas, `shapeless` → `Mirror`)
3. Remove `-source:3.0-migration` and enforce strict `-Werror -Wunused:all` on pure Scala 3.10.1
4. Migrate downstream application modules onto Scala 3.9 LTS / 3.10.1 consuming Scala 3 LTS TASTy and remaining non-macro 2.13 `.jar`s natively

- A) `1 → 2 → 4 → 3`
- B) `2 → 1 → 4 → 3`
- C) `2 → 4 → 1 → 3`
- D) `2 → 1 → 3 → 4`

<details><summary>Answer</summary>

**B (`2 → 1 → 4 → 3`).** Prepare on Scala 2.13.latest (replacing macros and plugins), migrate leaf libraries first (publishing against `3.3`–`3.7` if 2.13 `-Ytasty-reader` consumers remain), roll upward through downstream application modules, and finally drop migration flags and enforce strict Scala 3.10.1 flags.

- Why not A, C, D: Macros must be replaced before Scala 3 compilation succeeds, leaf libraries must migrate before downstream modules consume them as Scala 3 artifacts, and strict `-Werror` lockdown completes the migration last.
- Ref: [modules/10-production-scala-testing-interoperability-and-evolution.md](../modules/10-production-scala-testing-interoperability-and-evolution.md), https://docs.scala-lang.org/scala3/guides/migration/compatibility-intro.html

</details>

### Q-SCALA-065 · Production Testing, Interop & Scala 2 → 3 Migration · difficulty 2 · hands-on

Write a negative ScalaCheck property test in `munit.ScalaCheckSuite` proving that a `Monoid[Int]` implemented with subtraction (`combine = _ - _`, `empty = 0`) is falsified by `org.scalacheck.Test.check` on the associativity law.

<details><summary>Answer</summary>

Verified in [`03-CatsLawsAndValidation.test.scala`](../examples/03-CatsLawsAndValidation.test.scala) (`"Negative property test: subtraction fails Monoid associativity under ScalaCheck"`). Run `mise run test` inside `languages/scala` to execute both the positive law suites (`Monoid`, `Functor`, `Applicative`, `Monad`, `Traverse`) and the deterministic falsification assertion (`assert(!result.passed)`).

- Ref: [modules/10-production-scala-testing-interoperability-and-evolution.md](../modules/10-production-scala-testing-interoperability-and-evolution.md), https://typelevel.org/cats/typeclasses/lawtesting.html

</details>

---

## Mock Exam

A full timed simulation matching an EPFL capstone check + Senior Scala & Functional Systems technical assessment: **30 questions in 90 minutes**, closed-book (no reference modules or compiler REPL during the timed block; execute hands-on tasks in a fresh terminal after finishing multiple-choice items).

### Domain Mix (30 Questions)

| Domain | Weight | Selected Questions | Count |
| --- | --- | --- | --- |
| 1. Toolchain, TASTy & ADTs | 15% | `Q-SCALA-001`, `Q-SCALA-003`, `Q-SCALA-004`, `Q-SCALA-005`, `Q-SCALA-010` | 5 |
| 2. Type System, Variance & Type Inference | 15% | `Q-SCALA-012`, `Q-SCALA-013`, `Q-SCALA-015`, `Q-SCALA-016`, `Q-SCALA-019` | 5 |
| 3. Contextual Abstractions & Type Classes | 20% | `Q-SCALA-021`, `Q-SCALA-023`, `Q-SCALA-025`, `Q-SCALA-026`, `Q-SCALA-027`, `Q-SCALA-028` | 6 |
| 4. Type-Level Scala & Metaprogramming | 15% | `Q-SCALA-033`, `Q-SCALA-036`, `Q-SCALA-037`, `Q-SCALA-038`, `Q-SCALA-039` | 5 |
| 5. Concurrency, Effect Systems & Streaming | 25% | `Q-SCALA-043`, `Q-SCALA-044`, `Q-SCALA-046`, `Q-SCALA-048`, `Q-SCALA-049`, `Q-SCALA-052`, `Q-SCALA-057` | 7 |
| 6. Production Testing, Interop & Scala 2 → 3 Migration | 10% | `Q-SCALA-058`, `Q-SCALA-062` | 2 |

### Scoring Key

- **Single / Scenario / Ordering (1 point each):** Full credit only for the exact option or exact sequence.
- **Multi-select (1 point each):** Full credit only when all correct options and zero incorrect options are selected.
- **Hands-on (`Q-SCALA-010`, `Q-SCALA-057` — 2 points each, or 1 point per suite verification):** Passing requires all assertions in the corresponding MUnit / ScalaCheck suite (`mise run test`) and zero warnings under `mise run lint` (`-Werror -Wunused:all`).
- **Passing Threshold:** **>= 24 / 32 points (75%)** for EPFL-equivalent proficiency; **>= 27 / 32 points (84%)** with both hands-on tasks passing cleanly on first compile for Senior Scala readiness.
