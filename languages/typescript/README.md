# TypeScript: Type System, Compiler & Tooling (TypeScript 7)

A single progressive course on the TypeScript type system and its toolchain: erasure and the native compiler, narrowing and assignability, generics and inference, type-level programming, API design, runtime boundaries, typing UI frameworks, and shipping typed libraries.

Verified against TypeScript 7.0.2 (7.1.0-beta noted as preview), `@typescript/typescript6` 6.0.2, Node 26.12.1, Zod 4.6.7, `@standard-schema/spec` 1.1.0, `@types/react` 19.3.0, `solid-js`/`@solidjs/web` 2.0.0-rc.19, `@types/node` 26.6.6, expect-type 1.4.0, `@arethetypeswrong/cli` 0.18.5, publint 0.3.25 (npm registry and release posts) on 2026-10-29.

**Ownership.** This track owns the type system, inference, variance, declaration emit, tsconfig, the typing of JSX/components/hooks, and Standard Schema/Zod typing (see `.agents/OWNERSHIP.md`). Runtime semantics are cross-linked instead of re-explained: JavaScript language semantics (`this`, closures, promises, ESM, `using`, decorators at runtime) belong to `languages/javascript`, Node's type stripping and loader to `technologies/nodejs`, React internals to [technologies/react](../../technologies/react/README.md), and Solid's reactive runtime to [technologies/solidjs](../../technologies/solidjs/README.md).

## Prerequisites

Working JavaScript (functions, objects, classes, promises, modules) and a terminal. No prior TypeScript is assumed; the course deepens continuously from Module 01 to Module 13.

## Syllabus

| # | Module | Covers | Example / tests |
|---|---|---|---|
| 01 | [Toolchain & compiler model (TS 7)](./modules/01-toolchain-and-compiler-model.md) | Erasure, compiler pipeline, Go port and parallel checkers, 6.0/7.0 defaults and removals, no classic API and the 6.0 bridge, Node type stripping | [`01-toolchain`](./examples/01-toolchain/) |
| 02 | [Essential types & functions](./modules/02-essential-types-and-functions.md) | Types as sets, literals and widening, functions, tuples, `Set`/`Map`, `unknown`, Promise and iterator/generator typing | [`02-essential-types`](./examples/02-essential-types/) |
| 03 | [Unions, narrowing & control-flow analysis](./modules/03-unions-narrowing-and-control-flow.md) | CFA model, discriminated unions, exhaustiveness, closures, `switch (true)`, inferred predicates | [`03-unions-narrowing`](./examples/03-unions-narrowing/) |
| 04 | [Objects, assignability & the "weird parts"](./modules/04-objects-assignability-and-weird-parts.md) | Formal assignability and variance, deliberate unsoundness, freshness, `{}`/`object`/`unknown`, `satisfies`, strictness flags | [`04-assignability`](./examples/04-assignability/) |
| 05 | [Classes, mutability & TS-only syntax](./modules/05-classes-mutability-and-ts-only-syntax.md) | `readonly`/`as const`, `#private`, `override`, abstract classes, `this` typing, enums under `erasableSyntaxOnly` | [`05-classes-mutability`](./examples/05-classes-mutability/) |
| 06 | [Modules, declarations & tsconfig](./modules/06-modules-declarations-and-tsconfig.md) | `nodenext` vs `bundler`, `verbatimModuleSyntax`, `.d.ts`, ambient modules, merging, augmentation, project references | [`06-modules-tsconfig`](./examples/06-modules-tsconfig/) |
| 07 | [Generics & inference](./modules/07-generics-and-inference.md) | Inference sites and phases, `const T`, `NoInfer`, partial inference, variance annotations, overloads | [`07-generics`](./examples/07-generics/) |
| 08 | [Type-level programming I: derivation](./modules/08-type-derivation-and-template-literals.md) | `typeof`/`keyof`/indexed access, utility types, template literal types, `string & {}` | [`08-type-derivation`](./examples/08-type-derivation/) |
| 09 | [Type-level programming II: conditional, mapped & recursive](./modules/09-conditional-mapped-and-recursive-types.md) | Distributivity, `infer … extends`, homomorphic mapped types, recursion limits, TS 7 code-point inference | [`09-conditional-mapped`](./examples/09-conditional-mapped/) |
| 10 | [Type-safe API design patterns](./modules/10-type-safe-api-design-patterns.md) | Brands, predicates/assertions, builders, `NoInfer`, `Disposable` and decorator typing, library case studies | [`10-api-design`](./examples/10-api-design/) |
| 11 | [Runtime boundaries: validation & Standard Schema](./modules/11-runtime-boundaries-validation.md) | Parse-don't-validate, Zod 4 input/output types, Zod 3→4, Standard Schema, typed fetch and env | [`11-runtime-boundaries`](./examples/11-runtime-boundaries/) |
| 12 | [Typing UI frameworks: React & Solid](./modules/12-typing-ui-frameworks.md) | How JSX is checked, React 19 and Solid 2.0 RC component/prop/hook/event/ref typing | [`12-typing-ui-frameworks`](./examples/12-typing-ui-frameworks/) |
| 13 | [Library authoring, type performance & type tests](./modules/13-library-authoring-performance-and-type-tests.md) | Declaration emit, `isolatedDeclarations`, `exports`/`types`, attw/publint, type tests, performance limits, migration, version history | [`13-library-authoring`](./examples/13-library-authoring/) |

Also: [GLOSSARY.md](./GLOSSARY.md) (EN ↔ CZ), [CHEATSHEET.md](./CHEATSHEET.md), [exams/](./exams/README.md).

**Out of scope, with reasons:** framework runtime behaviour (owned by the react/solidjs tracks); JavaScript semantics (owned by `languages/javascript`); the TS 7.1 API, content mappers and `import source` are previewed only (beta at the time of writing); Vue/Angular/Svelte typing (no track in this repository yet); the language-service plugin API (absent in TS 7.0).

## Running the examples

```bash
mise install                      # node 26 + typescript 7.0.2 (see .mise.toml)
mise exec -- npm ci
mise exec -- npm test             # node --test over examples/**/*.test.ts
mise exec -- npm run typecheck    # tsc 7 on the track + the React and Solid JSX projects
mise exec -- node --test examples/09-conditional-mapped/   # one module
```

How the tests prove things:
- **Runtime tests** use `node --test`; Node 26 runs `.ts` files by stripping types, which is why the track enforces `erasableSyntaxOnly` and `verbatimModuleSyntax`.
- **Type tests** are `expectTypeOf(…)` assertions and `// @ts-expect-error` negatives, checked by `npm run typecheck` (a stale `@ts-expect-error` fails with TS2578).
- **Compiler-fixture tests** spawn the pinned `tsc` against small projects under `examples/**/fixtures/` and assert exact diagnostic codes (TS2591, TS2882, TS5102, TS5108, TS5011, TS1294, TS2835, TS1484, TS1543, TS6306, TS9013, TS2589, …).
- **Packaging tests** build a tiny package and run publint and attw against good and broken `exports`.

Performance numbers (e.g. `--checkers` speed-ups) are hardware dependent and are never asserted.

## Certifications & Exams

There is **no official Microsoft certification** for TypeScript. The recognised proctored exam is the independent **certificates.dev TypeScript Certification** (<https://certificates.dev/typescript>, checked 2026-10-29):

| Level | Status | Format | Pass rule | Targets |
|---|---|---|---|---|
| Junior | Active | 50 multiple-choice, 40 min, proctored | Not stated per level | TS version not stated |
| Mid-Level | Active | 40 multiple-choice + 2 coding challenges, 135 min | "70% of the questions and both challenges" | Not stated |
| Senior | Active | 40 multiple-choice + 2 coding challenges, 135 min | Same | Not stated |

Domain weights are not published. The coverage matrix, exam delta (TS 7 vs older material) and a 70-question bank with two hands-on challenges and a full mock exam are in [exams/README.md](./exams/README.md) and [exams/certificates-dev-typescript.md](./exams/certificates-dev-typescript.md). Every module also ends with an Interview Drill for interview-format preparation.
