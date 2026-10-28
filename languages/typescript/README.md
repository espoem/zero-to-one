# TypeScript: Type System, Compiler & Tooling (TypeScript 7)

A single progressive course on the TypeScript type system and its toolchain, from erasure and narrowing to type-level programming, library authoring and the TypeScript 7 native compiler. Framework *runtime* mechanics live in their own tracks; this track owns the **typing** of everything (see `.agents/OWNERSHIP.md`).

> Restructure in progress (see `.agents/reviews/typescript.md`). The syllabus below is the target structure.

## Syllabus

| # | Module | Covers |
|---|---|---|
| 01 | [Toolchain & compiler model (TS 7)](./modules/01-toolchain-and-compiler-model.md) | Erasure, `tsc` vs bundlers vs Node type stripping, TS 7 architecture, defaults, the 6.0 bridge |
| 02 | [Essential types & functions](./modules/02-essential-types-and-functions.md) | Primitives, functions, arrays/tuples, `Set`/`Map`, Promise typing, `JSON.parse` → `unknown` |
| 03 | [Unions, narrowing & control-flow analysis](./modules/03-unions-narrowing-and-control-flow.md) | CFA, discriminated unions, exhaustiveness, predicates |
| 04 | [Objects, assignability & the "weird parts"](./modules/04-objects-assignability-and-weird-parts.md) | Structural typing, freshness, `{}`/`object`/`unknown`, variance of methods, `satisfies` |
| 05 | [Classes, mutability & TS-only syntax](./modules/05-classes-mutability-and-ts-only-syntax.md) | `readonly`, `as const`, `#private`, `override`, enums under `erasableSyntaxOnly` |
| 06 | [Modules, declarations & tsconfig](./modules/06-modules-declarations-and-tsconfig.md) | `nodenext` vs `bundler`, `exports`/`types`, `.d.ts`, augmentation, project references |
| 07 | [Generics & inference](./modules/07-generics-and-inference.md) | Inference sites, `const T`, `NoInfer`, overloads, variance annotations |
| 08 | [Type-level programming I: derivation](./modules/08-type-derivation-and-template-literals.md) | `keyof`/`typeof`/indexed access, utility types, template literal types |
| 09 | [Type-level programming II: conditional, mapped & recursive types](./modules/09-conditional-mapped-and-recursive-types.md) | Distributivity, `infer`, key remapping, recursion limits |
| 10 | [Type-safe API design patterns](./modules/10-type-safe-api-design-patterns.md) | Brands, assertion functions, builders, `Disposable` and decorator typing |
| 11 | [Runtime boundaries: validation & Standard Schema](./modules/11-runtime-boundaries-validation.md) | Zod 4, Standard Schema, parse-don't-validate |
| 12 | [Typing UI frameworks: React & Solid](./modules/12-typing-ui-frameworks.md) | JSX namespace, component/props/event/ref types, generic & polymorphic components |
| 13 | [Library authoring, type performance & type tests](./modules/13-library-authoring-performance-and-type-tests.md) | Declaration emit, `isolatedDeclarations`, `attw`, traces, migration to 7 |

## Running

```bash
mise install                 # node 26 + typescript 7.0.2 (see .mise.toml)
mise exec -- npm ci
mise exec -- npm test        # node --test over examples/**/*.test.ts (runtime + compiler-fixture tests)
mise exec -- npm run typecheck
```
