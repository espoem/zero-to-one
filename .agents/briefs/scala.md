# Brief: Scala 3 (`languages/scala`)

|                   |                                                                    |
| ----------------- | ------------------------------------------------------------------ |
| Phase             | 5 (Post-v1 Expansion)                                              |
| Kind              | NEW language track: create from scratch                            |
| Branch / worktree | `track/scala-fp` · `../zto-scala-fp`                               |
| Depends on        | `architecture/functional-programming` (cross-links pure FP theory) |
| Research dossier  | `.agents/research/scala-fp.md`                                     |

## 1. Ownership

- **Owns (full treatment):** Scala 3.10.1 / 3.9 LTS language mechanics, TASTy binary format & JVM bytecode lowering, `enum` ADTs & GADTs, declaration-site variance & local type inference, `given`/`using` contextual abstractions & `derives`, `opaque type`, union/intersection/match types, native type lambdas, `inline`/mirrors/macros, JVM virtual threads/Loom & `Future` pitfalls, Capture Checking & Ox 1.0.9, Cats 2.13.0, Cats Effect 3.7.1, FS2 3.16.0, ZIO 2.1.26, MUnit 1.3.6 / ScalaCheck 1.20.0, Scala 2 → Scala 3 migration ("Then vs now").
- **Cross-link only:** Pure FP theory, laws, combinator derivations, trampolining/ST/stream-transducer theory (`architecture/functional-programming`), language-neutral concurrency theory (`algorithms/dsa` M13).

## 2. Module Plan (10 modules, >=400 lines each, Interview Drill at end)

1. `01-scala3-toolchain-tasty-and-jvm-lowering.md`
2. `02-adts-enums-pattern-matching-and-collections.md`
3. `03-type-system-variance-and-type-inference.md`
4. `04-contextual-abstractions-given-using-and-typeclasses.md`
5. `05-type-level-scala-opaque-match-and-lambdas.md`
6. `06-metaprogramming-inline-mirrors-and-macros.md`
7. `07-concurrency-fibers-virtual-threads-and-capture-checking.md`
8. `08-typelevel-ecosystem-cats-and-cats-effect.md`
9. `09-functional-streaming-fs2-and-zio-ecosystem.md`
10. `10-production-scala-testing-interoperability-and-evolution.md`

## 3. Executable Proofs & Exams

- Primary: Scala 3.10.1 (via `mise`-pinned OpenJDK 25.0.5 LTS + Scala 3.10.1 / Scala CLI 1.18.0) with MUnit 1.3.6 + ScalaCheck 1.20.0 (`munit-scalacheck` 1.3.1) and negative compile-time tests via `scala.compiletime.testing.typeChecks` / `compileErrors`.
- Exams: `exams/README.md` (EPFL / Scala Center Coursera specializations + Senior Scala Interview coverage matrix, 0 ❌) + `exams/scala-epfl-interview.md` (65 sequential questions `Q-SCALA-001`..`Q-SCALA-065`, ≥5 per domain, difficulty 1–3, full distractor rationales + full timed mock exam with scoring key).
