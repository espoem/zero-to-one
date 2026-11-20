# Brief: Functional Programming (`architecture/functional-programming`)

|                   |                                           |
| ----------------- | ----------------------------------------- |
| Phase             | 5 (Post-v1 Expansion)                     |
| Kind              | NEW foundation track: create from scratch |
| Branch / worktree | `track/scala-fp` · `../zto-scala-fp`      |
| Research dossier  | `.agents/research/scala-fp.md`            |

## 1. Ownership

- **Owns (full treatment):** Referential transparency, substitution model, λ-calculus, parametricity & free theorems, persistent data structures & structural sharing, algebraic error handling (`Option`, `Either`, `Validated`), strictness/laziness & corecursion, purely functional state (`State`), purely functional parallelism (`Par` & non-blocking actors), algebraic property-based testing (`Gen`/`Prop`, shrinking), parser combinators, `Semigroup`/`Monoid`/`Foldable`, `Functor`/`Monad`/Kleisli, `Applicative`/`Traverse`, external effects/`IO`/trampolining/`Free`, scoped local mutation (`ST`/rank-2 polymorphism), pull-based stream transducers & resource-safe streaming.
- **Cross-link only:** Scala 3 language mechanics & Typelevel/ZIO realisations (`languages/scala`), TypeScript type-level encoding (`languages/typescript`), general test pyramid (`languages/javascript`), language-neutral locks/lock-free concurrency (`algorithms/dsa` M13).

## 2. Module Plan (12 modules, >=400 lines each, Interview Drill at end)

1. `01-referential-transparency-and-lambda-calculus.md`
2. `02-persistent-data-structures-and-structural-sharing.md`
3. `03-algebraic-error-handling-and-totality.md`
4. `04-strictness-laziness-and-corecursion.md`
5. `05-purely-functional-state-and-combinators.md`
6. `06-purely-functional-parallelism-and-laws.md`
7. `07-property-based-testing-and-shrinking.md`
8. `08-parser-combinators-and-algebraic-design.md`
9. `09-monoids-foldables-and-parallel-reduction.md`
10. `10-functors-monads-and-kleisli-composition.md`
11. `11-applicative-and-traversable-functors.md`
12. `12-effects-io-trampolining-st-and-streaming.md`

## 3. Executable Proofs & Exams

- Primary: CLRS-style / equational pseudocode + TypeScript (`node --test` + `fast-check` 4.10.3 on Node 26.13.0 / TS 7.0.2).
- Secondary: Scala 3.10.1 (`scala test examples/scala` with MUnit + ScalaCheck) for higher-kinded type classes (`Monoid`, `Functor`, `Monad`, `Applicative`, `Traverse`, `Free`/`TailRec`, rank-2 `ST`) that TypeScript cannot express natively.
- Exams: `exams/README.md` (coverage matrix, 0 ❌) + `exams/fp-interview.md` (65 sequential questions `Q-FP-001`..`Q-FP-065`, ≥5 per domain, difficulty 1–3, full distractor rationales + full timed mock exam with scoring key).
