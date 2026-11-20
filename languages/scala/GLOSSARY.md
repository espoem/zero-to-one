# Scala 3 Glossary (EN ↔ CZ)

A bilingual English ↔ Czech terminology index for Scala 3.10.1, the JVM runtime, metaprogramming, and functional effect systems. Shared foundational terms reproduce the canonical definitions and Czech equivalents from the [repository root glossary](../../GLOSSARY.md) verbatim; Scala-specific terms are grounded in the [Scala 3 Language Reference](https://docs.scala-lang.org/scala3/reference/), Pierce (_Types and Programming Languages_), Okasaki (_Purely Functional Data Structures_), and Typelevel / ZIO specifications.

---

## 1. Foundational Functional Programming Terms (Shared with Root Glossary)

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Pure Function** | **Čistá funkce** | A function whose return value depends exclusively on its input arguments, producing no observable side effects. | Church (Lambda Calculus), Functional Programming Standards |
| **Side Effect** | **Vedlejší účinek** | Any state mutation outside the local execution scope of a function (e.g., modifying global state, performing I/O, writing to disk or network). | IEEE Standard Glossary of Software Engineering Technology |
| **Referential Transparency** | **Referenční transparentnost** | An expression property where any call can be substituted with its resulting value without altering the behavior of the program. | Strachey (Fundamental Concepts in Programming Languages) |
| **Immutability** | **Neměnnost (imutabilita)** | The property of a data structure or object whose state cannot be modified after instantiation. Modifications create a new instance. | Okasaki (Purely Functional Data Structures) |
| **Higher-Order Function** | **Funkce vyššího řádu** | A function that accepts one or more functions as arguments, returns a function, or both. | Abelson & Sussman (SICP) |
| **Closure** | **Uzávěr (lexikální uzávěr)** | The combination of a function bundled together with references to its surrounding lexical environment, allowing access to outer scope variables. | Landin (The Mechanical Evaluation of Expressions) |
| **Subtyping Variance** | **Variance podtypů** | The relationship between the subtyping of complex generic types ($F[A]$ and $F[B]$) and the subtyping of their component types ($A$ and $B$). | TAPL / PEP 484 |
| **Covariance** | **Kovariance** | A subtyping relationship where composite types preserve the subtyping direction of their components (`A ≤ B ⟹ F(A) ≤ F(B)`). Characteristic of function return types and read-only collections. | Pierce (TAPL), Cardelli |
| **Contravariance** | **Kontravariance** | A subtyping relationship where composite types reverse the subtyping direction of their components (`A ≤ B ⟹ F(B) ≤ F(A)`). Characteristic of function parameter types. | Pierce (TAPL), TS Handbook |
| **Invariance** | **Invariance** | A relationship where `F(A) ≤ F(B)` holds if and only if `A = B`. Characteristic of mutable read-write collections and structures. | Pierce (TAPL) |
| **Backpressure** | **Zpětný tlak (_backpressure_)** | The flow-control protocol where a slow consumer signals an upstream producer that intermediate buffers are full, pausing or throttling production until capacity drains. | Reactive Streams Specification, Node.js Streams |

---

## 2. Scala 3 Compiler, TASTy & JVM Lowering

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **TASTy (Typed Abstract Syntax Trees)** | **TASTy (typovaný abstraktní syntaktický strom)** | Scala 3's compact binary interchange format emitted alongside `.class` files, preserving full generic types, inline bodies, and macro ASTs for separate compilation and binary compatibility. | Scala 3 Reference (TASTy) |
| **JVM Type Erasure** | **Vymazání typů na JVM** | The JVM compilation step that replaces parameterized type arguments (`List[Int]`, `List[String]`) with their upper bounds (`List`) in bytecode, requiring `ClassTag`, `TypeTest`, or `Mirror` when type info is needed at runtime. | JVM Specification, Scala 3 Reference |
| **SAM Conversion (Single Abstract Method)** | **Konverze SAM (jediná abstraktní metoda)** | Compiler lowering that automatically synthesizes an implementation of a trait or Java interface containing a single abstract method from a lambda literal using `invokedynamic`. | Scala 3 Reference (SAM) |
| **Tail-Call Optimization (`@tailrec`)** | **Optimalizace koncové rekurze** | A compiler transformation converting self-recursive tail calls into an imperative JVM loop (`goto`), verified statically by `@tailrec` to guarantee constant $O(1)$ stack space. | Scala Standard Library (`scala.annotation.tailrec`) |
| **Top Type Lattice (`Any` / `Matchable`)** | **Horní typy (`Any` / `Matchable`)** | Scala 3's split at the top of the type hierarchy: `Any` is the universal supertype, while `Matchable` marks types that safely support runtime pattern matching and `getClass`, excluding opaque types and abstract values. | Scala 3 Reference (`Matchable`) |

---

## 3. Data Modeling, Pattern Matching & Collections

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Algebraic Data Type (ADT)** | **Algebraický datový typ (ADT)** | A composite type formed by combining product types (tuples, `case class` records) and sum types (disjoint variants in `enum` or `sealed trait`). | Pierce (TAPL), Scala 3 Reference |
| **Enum ADT (`enum`)** | **Výčtový ADT (`enum`)** | Scala 3's concise syntax for defining closed sum types and parameterized ADTs in one declaration, desugaring to a `sealed abstract class` and case companions. | Scala 3 Reference (Enumerations) |
| **Generalized Algebraic Data Type (GADT)** | **Zobecněný algebraický datový typ (GADT)** | A parameterized ADT whose constructors instantiate the parent type's type parameter to distinct concrete types (e.g., `Expr[Int]`, `Expr[Boolean]`), enabling static type refinement inside `match` branches. | Scala 3 Reference (GADTs), Peyton Jones et al. |
| **Exhaustivity Checking** | **Kontrola úplnosti (vyčerpání variant)** | Static compiler verification proving that a `match` expression covers all constructors of a closed `sealed` hierarchy or `enum`, emitting warnings (errors under `-Werror`) on missing cases. | Scala 3 Reference (Pattern Matching) |
| **Extractor (`unapply`)** | **Extraktor (`unapply`)** | An object method decomposing a value inside a pattern match via `Option`, `Boolean`, or product-match protocols without requiring inheritance or exposing internal representation. | Scala 3 Reference (Pattern Matching) |
| **LazyList** | **Líný seznam (`LazyList`)** | Scala 2.13/3's memoized persistent linked list whose head and tail are both lazy thunks, fixing Scala 2's eager-head `Stream` memory trap while avoiding OOM when consumed without retaining the head reference. | Scala Standard Library (`scala.collection.immutable.LazyList`) |
| **Head Retention** | **Držení hlavy seznamu (_head retention_)** | A memory leak pattern where holding a `val` reference to the first node of a memoized `LazyList` prevents GC from reclaiming already-traversed elements, causing $O(n)$ heap growth. | Chiusano & Bjarnason (FP in Scala) |
| **CHAMP Trie** | **CHAMP trie (komprimovaný prefixový strom)** | Compressed Hash-Array Mapped Prefix trie backing Scala's immutable `HashMap` and `HashSet` since Scala 2.13, separating inline payloads from subnode pointers via bitmaps for cache locality and fast iteration. | Steindorfer & Vinju (OOPSLA 2015) |
| **Structured Early Exit (`boundary` / `break`)** | **Strukturovaný předčasný návrat (`boundary` / `break`)** | Scala 3.3+ scoped control abstraction replacing non-local `return` with a typed `Label[T]` capability; intra-method breaks compile to local jumps and cross-closure breaks use lightweight stackless exceptions. | Scala 3 Reference (`scala.util.boundary`) |

---

## 4. Type System, Variance & Contextual Abstractions

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Declaration-Site Variance (`+A` / `-A`)** | **Variance v místě deklarace** | Variance annotations attached directly to a class or trait's type parameters (`+A` covariant, `-A` contravariant), checked by the compiler against every member's variance position. | Scala 3 Reference (Variance) |
| **Lower-Bound Widening (`B >: A`)** | **Rozšíření dolní mezí (`B >: A`)** | A method-level type bound allowing a covariant container `F[+A]` to accept an element of supertype `B >: A` and return `F[B]` without violating contravariant-position soundness. | Scala 3 Reference (Bounds) |
| **Local Type Inference** | **Lokální typová inference** | Bidirectional constraint-solving algorithm (colored local type inference) propagating expected return types and argument bounds across Scala expressions without requiring global Hindley-Milner annotations. | Odersky, Zenger & Zenger (POPL 2001) |
| **Path-Dependent Type** | **Typ závislý na cestě** | A nested type (`outer.Inner`) tied to a specific immutable value path `outer`, guaranteeing at compile time that inner values from two distinct outer instances cannot be mixed. | Amin, Rompf & Odersky (DOT Calculus) |
| **Union Type (`A \| B`)** | **Typ sjednocení (unijní typ)** | An unboxed, commutative, associative Scala 3 type inhabited by values of either `A` or `B` without requiring a common wrapper or shared base trait. | Scala 3 Reference (Union Types) |
| **Intersection Type (`A & B`)** | **Typ průniku (průnikový typ)** | A commutative Scala 3 type inhabited by values that simultaneously conform to both `A` and `B`, replacing Scala 2's order-sensitive compound `with` syntax. | Scala 3 Reference (Intersection Types) |
| **Contextual Abstraction (`given` / `using`)** | **Kontextová abstrakce (`given` / `using`)** | Scala 3's unified mechanism separating canonical type-class instance definitions (`given`) and context parameters (`using`) from implicit type conversions. | Scala 3 Reference (Contextual Abstractions) |
| **Extension Method (`extension`)** | **Rozšiřující metoda (`extension`)** | First-class Scala 3 syntax adding methods to existing types without wrapper allocations or Scala 2 `implicit class` boilerplate. | Scala 3 Reference (Extension Methods) |
| **Context Function Type (`A ?=> B`)** | **Kontextový funkční typ (`A ?=> B`)** | A first-class function type whose argument `A` is supplied implicitly from the enclosing `using` scope at the call site, enabling zero-boilerplate DSLs and capability passing. | Scala 3 Reference (Context Functions) |
| **Type-Class Coherence** | **Koherence typových tříd** | The design property ensuring at most one canonical type-class instance exists for a given type in a program, avoiding inconsistent behavior when merging data structures such as `Set` or `Map` with different `Order` instances. | Wadler & Blott (POPL 1989) |
| **Orphan Instance** | **Osiřelá instance (_orphan instance_)** | A type-class instance defined in a package/object belonging to neither the type class nor the data type, risking implicit conflicts and violating coherence when imported inconsistently. | Scala / Typelevel Best Practices |
| **Multiversal Equality (`CanEqual`)** | **Multiverzální rovnost (`CanEqual`)** | Opt-in (`scala.language.strictEquality`) type-class check rejecting meaningless `==` / `!=` comparisons between unrelated types at compile time unless a `given CanEqual[L, R]` exists. | Scala 3 Reference (Multiversal Equality) |

---

## 5. Type-Level Programming & Metaprogramming

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Opaque Type (`opaque type`)** | **Neprůhledný typový alias (`opaque type`)** | A zero-overhead nominal type alias whose equality to its underlying representation is visible only inside its defining scope, compiling away completely in JVM bytecode. | Scala 3 Reference (Opaque Types) |
| **Type Lambda (`[X] =>> F[S, X]`)** | **Typová lambda** | First-class Scala 3 syntax for constructing anonymous higher-kinded type functions without compiler plugins like Scala 2's `kind-projector`. | Scala 3 Reference (Type Lambdas) |
| **Match Type (`X match { ... }`)** | **Párovací typ (_match type_)** | A type-level pattern match that reduces a scrutinee type `X` to a target type at compile time (often paired with `inline` definitions). | Scala 3 Reference (Match Types) |
| **Polymorphic Function Type (`[A] => A => B`)** | **Polymorfní funkční typ** | A first-class value whose type parameter `A` is quantified on the function value itself rather than on an enclosing `def` method or trait. | Scala 3 Reference (Polymorphic Function Types) |
| **Mirror (`Mirror.ProductOf` / `SumOf`)** | **Zrcadlo typu (`Mirror`)** | Compiler-synthesized type-class metadata exposing field labels (`MirroredElemLabels`), element types (`MirroredElemTypes`), and constructors/ordinals for generic `derives` without runtime reflection. | Scala 3 Reference (Type Class Derivation) |
| **`inline` Modifier** | **Modifikátor `inline`** | A Scala 3 guarantee that a definition or match expression is expanded and reduced at the call site during compilation, enabling constant folding and zero-overhead abstraction. | Scala 3 Reference (Inline) |
| **`transparent inline`** | **Transparentní `inline` (`transparent inline`)** | An `inline` method whose call-site return type is refined to the precise concrete type of the expanded branch rather than its declared upper bound. | Scala 3 Reference (Inline) |
| **Quote & Splice (`'{...}` / `${...}`)** | **Citace a vložení AST (_quote & splice_)** | Scala 3's principled macro primitives: quoting (`'{ expr }`) lifts typed code into an `Expr[T]` AST, and splicing (`${ expr }`) evaluates a compile-time `Expr[T]` back into code. | Scala 3 Reference (Macros) |
| **Phase Consistency** | **Fázová konzistence** | The staging rule in Scala 3 macros enforcing that values defined at compile time (`stage 0`) cannot be referenced directly at runtime (`stage 1`) without lifting (`ToExpr`) or quoting across matching quote/splice levels. | Stucki, Biboudis & Odersky (Scala 2018) |

---

## 6. Concurrency, Capture Checking & Effect Systems

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Capture Checking (`^`)** | **Kontrola zachycení schopností (_capture checking_)** | Scala 3's capability-tracking type system extension (`language.experimental.captureChecking`) that tracks tracked resources/capabilities (`File^`, `CanThrow^`) in function types to prevent resource escape and enforce effect safety statically. | Odersky et al. (Scala 3 Capture Checking) |
| **Virtual Thread** | **Virtuální vlákno** | A lightweight JVM thread (`java.lang.Thread.ofVirtual()`, JEP 444 / OpenJDK 25) scheduled by the JVM onto carrier OS threads and automatically unmounted on blocking JDK I/O, enabling direct-style concurrency via libraries like Ox. | OpenJDK JEP 444 |
| **Fiber** | **Vlákno na úrovni runtime (_fiber_)** | A cooperatively or preemptively scheduled lightweight execution context managed in user space by an effect runtime (Cats Effect `FiberIO` or ZIO `Fiber`), supporting structured concurrency and asynchronous cancelation. | Cats Effect 3 Documentation |
| **Cancelation Masking (`uncancelable`)** | **Maskování zrušení (`uncancelable`)** | An effect-runtime primitive that temporarily defers fiber interruption signals during critical acquisition or cleanup regions while permitting explicit `poll` points inside long-running steps. | Cats Effect 3 Cancelation Model |
| **Resource Bracket (`Resource.make`)** | **Zdrojová závorka (`Resource.make`)** | A composable acquisition/release abstraction guaranteeing deterministic finalizer execution across normal completion, raised errors, and asynchronous fiber cancelation. | Cats Effect 3 `Resource` |
| **Effect Trampoline** | **Efektová trampolína** | A heap-allocated state machine inside `IO` or `ZIO` that interprets nested `flatMap`, `attempt`, and `async` nodes iteratively in a `while` loop, preventing JVM stack overflow on arbitrarily deep effect chains. | Bjarnason (Stackless Scala with Free Monads) |
| **`Ref` (Concurrent Atomic Reference)** | **Atomická reference `Ref`** | A purely functional, non-blocking mutable memory cell backed by `java.util.concurrent.atomic.AtomicReference` whose reads and CAS updates return suspended `F[A]` effects. | Cats Effect 3 `Ref` |
| **`Deferred` (Fiber Promise)** | **Jednorázová synchronizační buňka (`Deferred`)** | A purely functional write-once synchronization primitive that suspends consumer fibers semantically (without blocking carrier threads) until a producer completes it with a value. | Cats Effect 3 `Deferred` |
| **Pull-Based Chunked Stream** | **Tahový proud po blocích (_pull-based chunked stream_)** | FS2's `Stream[F, O]` architecture built on `Pull[F, O, R]`, where downstream consumers request discrete `Chunk[O]` batches upstream so resource scopes open lazily and close immediately on early termination. | FS2 Documentation |
| **Tagless Final (`F[_]`)** | **Bezznačkový konečný styl (_tagless final_)** | An architecture encoding domain algebras as polymorphic traits parameterized by an abstract effect constructor `F[_]` constrained by type classes (`Monad`, `Sync`, `Concurrent`), deferring runtime choice (`IO`, `Option`, test stub) to the application entry point. | Kiselyov (Typed Tagless Final Interpreters) |
| **`ZLayer` (ZIO Dependency Graph)** | **Závislostní vrstva (`ZLayer`)** | ZIO's typed, memoized, resource-safe service constructor `ZLayer[RIn, E, ROut]` that wires scoped application dependencies into the environment channel `R` of `ZIO[R, E, A]` at compile time. | ZIO 2 Documentation |
