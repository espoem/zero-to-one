# Scala 3: Certifications & Exam Coverage

Verified on 2026-11-20 against [Coursera EPFL / Scala Center Specializations](https://www.coursera.org/specializations/scala), [Effective Programming in Scala](https://www.coursera.org/learn/effective-scala), and the [Scala 3 Language Reference](https://docs.scala-lang.org/scala3/reference/).

## 1. Certification Landscape

There is **no active official proctored vendor certification** for the Scala language. Lightbend (now Akka) retired its commercial _Lightbend Certified Scala Developer_ and _Lightbend Certified Scala Professional (Levels 1 & 2)_ programs.

Per the repository certification standard, this track prepares engineers for the recognized academic and industry equivalents:

| Credential / Loop | Provider | Status | Format | Passing / Evaluation Criteria |
| --- | --- | --- | --- | --- |
| **Functional Programming in Scala Specialization** (5 courses) | EPFL / Scala Center (Coursera) | Active | Programming assignments + graded quizzes across FP design, parallel computation, Spark/big-data FP, and capstone | Graded test suites (>= 80% per assignment) |
| **Effective Programming in Scala** | EPFL / Scala Center (Coursera) | Active | Scala 3 syntax, ADTs, type classes, collections, error modeling, testing, and concurrency assignments | Graded programming labs + quizzes |
| **Senior Scala & Functional Systems Interview Loop** | Industry standard | Active | Technical architecture & live coding covering Scala 3 type system, `given`/`using`, metaprogramming, Cats Effect 3 / ZIO, FS2 streaming, and JVM 25 concurrency | Problem correctness, type-safety proofs, concurrency soundness |

> **Exam delta.** Legacy EPFL Scala 2 materials and older Scala interview rubrics still reference `sealed trait` + `case object` ADTs, `Stream`, `implicit val`/`implicit def`, `AnyVal` value classes, and `kind-projector` (`*`). This track teaches Scala 3.10.1 idioms (`enum`, `LazyList`, `given`/`using`, `opaque type`, native `[X] =>> F[S, X]` type lambdas) alongside explicit "Then vs now" equivalents so you can answer both Scala 3 and migration questions accurately.

## 2. Domain → Module Coverage Matrix

Weights reflect the combined syllabus emphasis of EPFL's Scala Center specializations and Senior Scala & Functional Systems interview loops (totaling 100%).

| # | Domain | Weight | Modules | Runnable Examples | Questions | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Toolchain, TASTy & ADTs | 15% | [01](../modules/01-scala3-toolchain-tasty-and-jvm-lowering.md), [02](../modules/02-adts-enums-pattern-matching-and-collections.md) | [`01-AdtsEnumsAndLazyList.test.scala`](../examples/01-AdtsEnumsAndLazyList.test.scala) | `Q-SCALA-001`..`Q-SCALA-010` (10) | ✅ |
| 2 | Type System, Variance & Type Inference | 15% | [03](../modules/03-type-system-variance-and-type-inference.md) | [`02-VarianceGivenOpaqueAndMatch.test.scala`](../examples/02-VarianceGivenOpaqueAndMatch.test.scala) | `Q-SCALA-011`..`Q-SCALA-020` (10) | ✅ |
| 3 | Contextual Abstractions & Type Classes | 20% | [04](../modules/04-contextual-abstractions-given-using-and-typeclasses.md) | [`02-VarianceGivenOpaqueAndMatch.test.scala`](../examples/02-VarianceGivenOpaqueAndMatch.test.scala) | `Q-SCALA-021`..`Q-SCALA-032` (12) | ✅ |
| 4 | Type-Level Scala & Metaprogramming | 15% | [05](../modules/05-type-level-scala-opaque-match-and-lambdas.md), [06](../modules/06-metaprogramming-inline-mirrors-and-macros.md) | [`02-VarianceGivenOpaqueAndMatch.test.scala`](../examples/02-VarianceGivenOpaqueAndMatch.test.scala) | `Q-SCALA-033`..`Q-SCALA-042` (10) | ✅ |
| 5 | Concurrency, Effect Systems & Streaming | 25% | [07](../modules/07-concurrency-fibers-virtual-threads-and-capture-checking.md), [08](../modules/08-typelevel-ecosystem-cats-and-cats-effect.md), [09](../modules/09-functional-streaming-fs2-and-zio-ecosystem.md) | [`03-CatsLawsAndValidation.test.scala`](../examples/03-CatsLawsAndValidation.test.scala), [`04-CatsEffectAndFs2Streams.test.scala`](../examples/04-CatsEffectAndFs2Streams.test.scala) | `Q-SCALA-043`..`Q-SCALA-057` (15) | ✅ |
| 6 | Production Testing, Interop & Scala 2 → 3 Migration | 10% | [10](../modules/10-production-scala-testing-interoperability-and-evolution.md) | [`01`..`04` suites](../examples/) | `Q-SCALA-058`..`Q-SCALA-065` (8) | ✅ |

## 3. Question Bank & Timed Simulation

- [`scala-epfl-interview.md`](./scala-epfl-interview.md): **65 original questions** (`Q-SCALA-001` through `Q-SCALA-065`) across all 6 domains (>= 8 questions per domain, difficulties 1–3, mixing `single`, `multi`, `scenario`, `ordering`, and `hands-on` tasks backed by the runnable MUnit/ScalaCheck test suites), complete with distractor rationales and primary documentation links, plus a **30-question / 90-minute timed Mock Exam** with scoring key.

All questions are original and synthesized from public EPFL syllabi, the Scala 3 Language Reference, Typelevel documentation, and ZIO documentation. No proprietary or NDA-protected exam content was used.
