# Exam & Interview Coverage Matrix: Functional Programming

This directory contains the certification/curriculum alignment and technical interview preparation bank for `architecture/functional-programming`. Because **no active proctored vendor certification exists for pure Functional Programming**, this track targets the recognised academic and industry equivalents: the **EPFL / Scala Center Functional Programming Specialization** and **Senior / Staff Functional Systems Architecture Interview Loops**.

---

## 1. Reference Curricula & Assessment Standards

| Assessment / Program | Authority / Format | Baseline | Coverage Scope |
| --- | --- | --- | --- |
| **EPFL / Scala Center Specialization** | EPFL / Coursera (_Functional Programming in Scala_ 5-course track) | Current 2026 | Equational reasoning, persistent ADTs, laziness, pure state, parallelism, effects, reactive streams |
| **Senior / Staff Functional Systems Interview Loop** | Industry technical architecture & coding rounds | 2026 Baseline | Algebraic API design, type-class laws, stack-safe trampolining, concurrency pitfalls, resource-safe streaming |

---

## 2. Domain Coverage Matrix (6 Domains, 100% Weight)

| Domain & Objectives | Weight | Curriculum Modules | Executable Proofs (TS & Scala 3) | Status |
| --- | --- | --- | --- | --- |
| **1. Foundations, RT & Persistent ADTs**<br>Referential transparency, substitution model, $\lambda$-calculus ($\alpha/\beta/\eta$), parametricity & free theorems, structural sharing, stack-unsafe `foldRight` vs `foldLeft`, tree catamorphisms | 18% | [Module 01](../modules/01-referential-transparency-and-lambda-calculus.md), [Module 02](../modules/02-persistent-data-structures-and-structural-sharing.md) | `01-persistent-and-errors.test.ts` | ✅ Full |
| **2. Totality, Laziness & Pure State**<br>Total functions vs exceptions, `Option`, `Either`, `Validated`, call-by-need thunk memoization, corecursion (`unfold`), stream fusion, Scala 2 `Stream` vs `LazyList`, `State[S, A]` & pure FSMs | 18% | [Module 03](../modules/03-algebraic-error-handling-and-totality.md), [Module 04](../modules/04-strictness-laziness-and-corecursion.md), [Module 05](../modules/05-purely-functional-state-and-combinators.md) | `01-persistent-and-errors.test.ts`, `02-laziness-and-state.test.ts` | ✅ Full |
| **3. Functional Parallelism & Property-Based Testing**<br>Algebraic `Par[A]`, explicit `fork`, bounded-pool deadlock mechanics, non-blocking continuation `Future`, `choiceN`, `Gen[A]` / `SGen[A]`, `Prop` falsification, integrated vs type-directed shrinking | 16% | [Module 06](../modules/06-purely-functional-parallelism-and-laws.md), [Module 07](../modules/07-property-based-testing-and-shrinking.md) | `03-par-deadlock-and-nonblocking.test.ts`, `AlgebraicLaws.test.scala` | ✅ Full |
| **4. Parser Combinators & Monoidal Reduction**<br>Algebraic parser design, context-sensitive `flatMap`, `scope` error stacks, committed errors vs `attempt`, `Semigroup`/`Monoid`, balanced `foldMapV`, `WC` word count, homomorphisms, `productMonoid`, `Foldable` | 16% | [Module 08](../modules/08-parser-combinators-and-algebraic-design.md), [Module 09](../modules/09-monoids-foldables-and-parallel-reduction.md) | `04-parsers-and-monoids.test.ts`, `AlgebraicLaws.test.scala` | ✅ Full |
| **5. Functors, Monads, Applicatives & Traverse**<br>`Functor` laws, `Monad` minimal primitive sets (`flatMap`, `compose`, `join`), Kleisli composition, 4 `Applicative` laws, `Validation` vs `Monad`, `Compose`, `Traverse` laws, `mapAccum`/`zipWithIndex` | 16% | [Module 10](../modules/10-functors-monads-and-kleisli-composition.md), [Module 11](../modules/11-applicative-and-traversable-functors.md) | `05-monad-applicative-traverse-laws.test.ts`, `AlgebraicLaws.test.scala` | ✅ Full |
| **6. Effects, Trampolines, Rank-2 `ST` & Streaming**<br>`IO` monad, naive recursion stack overflow, `TailRec` & `Free[F, A]` trampolines, natural-transformation interpreters, contextual purity & rank-2 `ST[S, A]` (pure Quicksort), pull-based `Process` transducers & resource-safe cleanup | 16% | [Module 12](../modules/12-effects-io-trampolining-st-and-streaming.md) | `06-trampoline-free-and-streams.test.ts`, `TrampolineAndST.test.scala` | ✅ Full |

---

## 3. Question Bank Inventory

The complete question bank lives in [`fp-interview.md`](fp-interview.md):

- **Total Questions**: 65 original questions (`Q-FP-001` through `Q-FP-065`), 10–12 questions per domain across all 6 domains.
- **Question Formats**: `single`, `multi`, `scenario`, `ordering`, and `hands-on` (backed by the executable TypeScript and Scala 3 suites).
- **Difficulty Distribution**:
  - Difficulty 1 (Foundations & Core Definitions): 18 questions.
  - Difficulty 2 (Algebraic Laws, Combinator Design & Edge Cases): 29 questions.
  - Difficulty 3 (Staff-Level Proofs, Type-System Mechanics & Failure Modes): 18 questions.
- **Timed Mock Examination**: 30-question / 90-minute simulation matching the domain weights, complete with a scoring key and readiness thresholds.
