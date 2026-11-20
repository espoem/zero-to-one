# Research Dossier: Functional Programming & Scala 3 (2026-11-20)

Primary-source synthesis for adding two cleanly deduplicated tracks grounded in Paul Chiusano & Rúnar Bjarnason's _Functional Programming in Scala_ (1st ed., Manning, 2015, 15 chapters across 4 parts) and updated to modern **Scala 3.10.1 / Scala 3.9.0 LTS** and its 2026 ecosystem.

## 1. Verified Stable Versions (checked 2026-11-20)

| Component | Verified Version | Primary Source / Notes |
| --- | --- | --- |
| Scala 3 (Next) | `3.10.1` (Scala CLI runner `1.18.0`) | scala-lang.org, `github.com/scala/scala3/releases`, `mise ls-remote scala` |
| Scala 3 (LTS) | `3.9.0` (primary LTS) / `3.3.9` (legacy LTS) | scala-lang.org release announcements (Sept/Oct 2026) |
| JDK | OpenJDK Temurin `25.0.5+8.0.LTS` | Adoptium / `mise` verified (`openjdk version "25.0.5" 2026-10-20 LTS`) |
| Cats (`cats-core`) | `2.13.0` | `github.com/typelevel/cats/releases`, Maven Central |
| Cats Effect | `3.7.1` | `typelevel.org/cats-effect/` |
| FS2 (`co.fs2`) | `3.16.0` | Maven Central / Typelevel FS2 |
| ZIO | `2.1.26` | `zio.dev` |
| Ox (Direct-style structured concurrency) | `1.0.9` | `com.softwaremill.ox::core:1.0.9`, JDK 21+ / Scala 3 |
| MUnit / MUnit-ScalaCheck | `1.3.6` / `1.3.1` | `org.scalameta` / Maven Central |
| ScalaCheck | `1.20.0` | Maven Central |
| sbt | `2.1.0` | `mise ls-remote sbt` |
| Node.js / TypeScript (FP track TS proofs) | Node `26.13.0` / TypeScript `7.0.2` / `fast-check` `4.10.3` | Aligned with existing `zero-to-one` Phase 4 tracks |

## 2. Source Syllabus Mapping (15 Chapters → 2 Deduplicated Tracks)

| Book Part & Chapter (FP in Scala, 2015) | Owning Track & Module | Modern Scala 3 / Ecosystem Delta (`languages/scala`) |
| --- | --- | --- |
| Part 1 · Ch 1 What is FP? & Ch 2 Getting started | `architecture/functional-programming` M01 | `languages/scala` M01 (`@main`, indentation syntax, TASTy, `@tailrec` bytecode) |
| Part 1 · Ch 3 Functional data structures (`List`, `Tree`) | `architecture/functional-programming` M02 | `languages/scala` M02 (`enum` ADTs replacing `sealed trait` + `case object`, exhaustivity) |
| Part 1 · Ch 4 Handling errors without exceptions (`Option`, `Either`) | `architecture/functional-programming` M03 | `languages/scala` M02/M08 (boundary/break, Cats `Validated`, ZIO typed error channel) |
| Part 1 · Ch 5 Strictness and laziness (`Stream`) | `architecture/functional-programming` M04 | `languages/scala` M02 (**Then vs now**: Scala 2 `Stream` head-strict memory leak → Scala 2.13/3 `LazyList`) |
| Part 1 · Ch 6 Purely functional state (`RNG`, `State`) | `architecture/functional-programming` M05 | `languages/scala` M05 (`opaque type State[S, +A] = S => (A, S)` zero-cost wrapper) |
| Part 2 · Ch 7 Purely functional parallelism (`Par`) | `architecture/functional-programming` M06 | `languages/scala` M07 (`Future` pitfalls, JDK 25 virtual threads, Ox, CE3 `IO.parMapN`) |
| Part 2 · Ch 8 Property-based testing (`Gen`, `Prop`) | `architecture/functional-programming` M07 | `languages/scala` M10 (MUnit 1.3.6 + ScalaCheck 1.20.0 + Discipline law suites) |
| Part 2 · Ch 9 Parser combinators | `architecture/functional-programming` M08 | `languages/scala` M04/M05 (extension methods, `given`, Cats Parse) |
| Part 3 · Ch 10 Monoids & `Foldable` | `architecture/functional-programming` M09 | `languages/scala` M04/M08 (`given`/`using` type classes, `cats.kernel.Monoid`, `Foldable`) |
| Part 3 · Ch 11 Monads & `Functor` | `architecture/functional-programming` M10 | `languages/scala` M05/M08 (native type lambdas `[X] =>> State[S, X]` replacing kind-projector) |
| Part 3 · Ch 12 Applicative and traversable functors | `architecture/functional-programming` M11 | `languages/scala` M08 (`cats.Applicative`, `Parallel`, `Traverse`, `ValidatedNel`) |
| Part 4 · Ch 13 External effects & `IO` (`TailRec`, `Free`) | `architecture/functional-programming` M12 | `languages/scala` M08/M09 (Cats Effect 3.7.1 `IO` fiber runtime, ZIO 2.1.26) |
| Part 4 · Ch 14 Local effects & mutable state (`ST`) | `architecture/functional-programming` M12 | `languages/scala` M05/M07 (polymorphic function types `[S] => ST[S, A]`, Capture Checking) |
| Part 4 · Ch 15 Stream processing & incremental I/O (`Process`) | `architecture/functional-programming` M12 | `languages/scala` M09 (**Then vs now**: 2015 `Process` → FS2 3.14.0 chunked `Stream[F, O]`) |

## 3. Certification & Exam Landscape

- **No active official proctored vendor certification** exists for pure Functional Programming or for the Scala language itself. Lightbend (now Akka) pivoted away from commercial Scala language certification exams (Lightbend Certified Scala Developer / Professional Levels 1–2 are sunsetted).
- **Recognised substitutes (per `AGENTS.md § Certification and Exam Coverage`):**
  - For `languages/scala`: **EPFL / Scala Center Specializations on Coursera** (_Functional Programming in Scala_ — 5 courses; _Effective Programming in Scala_) paired with the **Senior Scala & Functional Systems Technical Interview Loop** (verified against EPFL syllabi and Scala 3 Language Reference).
  - For `architecture/functional-programming`: **Academic FP Problem Sets & Senior/Staff Functional Systems Architecture Interview Loop** (grounded in _Functional Programming in Scala_, Okasaki, Pierce _TAPL_, Wadler, and production effect-system engineering).

## 4. Key Gotchas & Production Failure Modes (must have negative tests)

1. **Fixed-thread-pool deadlock in `Par.fork`**: `ExecutorService.submit` calling `.get()` inside a submitted task starves a 1-thread (or N-thread nested) pool; solved by non-blocking continuation/actor execution or fiber runtimes.
2. **Stack overflow in naive monadic `IO` / `flatMap` chains**: Deep recursive `flatMap` blows the call stack unless control flow is reified onto the heap via trampolining (`TailRec` / `Free` with `FlatMap` right-association).
3. **Scala 2 `Stream` head retention & memory leak ("Then vs now")**: Retaining a reference to the head of a memoised lazy list causes O(n) heap retention (`OutOfMemoryError`); Scala 2 `Stream` evaluated the head strictly, whereas Scala 2.13/3 `LazyList` is fully lazy in head and tail.
4. **Unlawful algebraic instances**: Non-associative `Monoid` (e.g., subtraction or floating-point addition) produces different results under sequential vs balanced parallel folds; broken `Monad` associativity breaks `for`-comprehension refactoring.
5. **Non-tail-recursive `foldRight` / list traversals**: Stack-unsafe `foldRight` overflows on lists of ~10k elements unless implemented via `foldLeft` reversal or lazy/trampolined evaluation.
6. **Scala 3 variance & given-resolution failures**: Placing a covariant `+A` type parameter in contravariant method argument position fails compilation; ambiguous competing `given` instances fail implicit search (verified with Scala 3 `compileErrors`).
7. **Broken `Resource` / bracket cleanup under cancelation**: Imperative `try/finally` leaks handles across async boundaries or ignores interruption; resource-safe pull streams and CE3 `Resource` guarantee finalizers run even on cancelation.
