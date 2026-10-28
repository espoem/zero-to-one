# Brief: TypeScript (`languages/typescript`)

| | |
|---|---|
| Phase | 1 |
| Kind | EXISTING track: restructure and update in place, keeping tests green throughout |
| Primary (author) | **Opus · claude.ai** |
| Drafter (on request) | pi · DeepSeek |
| Challenger | pi · Muse Spark 1.3 |
| Verifier | Antigravity |
| Final gate | Opus (claude.ai session) |
| Branch / worktree | `track/typescript` · `../zto-typescript` |
| Depends on | none (can start now) |
| Research dossier | `.agents/research/A-frontend.md` |

## 0. Read before starting (binding)
1. `AGENTS.md`: the contract. If it conflicts with this brief, AGENTS.md wins; log the conflict in your review file.
2. `.agents/OWNERSHIP.md`: what you own vs only cross-link.
3. `.agents/REVIEW.md`: the checklist your work is judged against.
4. Your global/agent instructions still apply where they do not conflict.

## 1. Owner decisions and track-specific instructions
- **Dedupe (owner decision):** modules 09–13 shrink to the TypeScript-typing angle only. Follow the "stays in TS / moves to react / moves to solidjs" split in the dossier. Hand the moved framework content to the react and solidjs authors as notes in `.agents/reviews/typescript.md` (section "Handover"), so nothing is lost.
- Runtime-semantics content (closures, `this`, microtasks, `using` runtime, ESM loading) moves to `languages/javascript`. Leave cross-links.
- Upgrade the tsconfig module for the TS 7 defaults. Add "Then vs now" sections for TS 5.x/6.x vs 7.0 (no programmatic API in 7.0, the `@typescript/typescript6` bridge).
- Add the missing example for module 06. Keep the TS 7 `typecheck` script running through mise.
- Teach the **latest stable** versions. Add **Then vs now** comparisons wherever practice changed (AGENTS.md § Version Currency).
- Pin **all** tooling via mise (`.mise.toml` + `mise.lock`): node 26 for JS/TS, plus every CLI and runtime the examples need.

## 2. Ownership
**You own (full treatment):**
- The type system, inference, variance, declaration emit, tsconfig
- Typing JSX, components, hooks, generic/polymorphic components
- Standard Schema, Zod typing of runtime boundaries

**Cross-link only (do not re-explain):**
- Types & coercion, scope/closures/`this`, prototypes/classes → owned by `languages/javascript`
- ESM semantics (Module Records, live bindings, TLA), `exports` conditions at runtime → owned by `languages/javascript`
- Temporal, explicit resource management (`using`, `DisposableStack`) runtime semantics → owned by `languages/javascript`
- Decorators runtime semantics (TC39) → owned by `languages/javascript`
- Node runtime type stripping → owned by `technologies/nodejs`
- Fiber, lanes, Suspense, RSC/Flight, Actions, React Compiler → owned by `technologies/react`
- Signals graph, push-pull, stores/projections, colorless async, start mode → owned by `technologies/solidjs`

## 3. Research dossier (verified 2026-10-27/28; re-verify before use)

#### TypeScript — `languages/typescript`

- **Current stable version(s)**
  - `typescript@7.0.2`: native Go port, published 2026-07-08 (npm `time`). Announcement: https://devblogs.microsoft.com/typescript/announcing-typescript-7.0/. It reports 7.7–11.9× faster full builds at the default `--checkers 4`.
  - Breaking vs 6.0:
    - Removed options: `target: es5`, `downlevelIteration`, `moduleResolution: node/node10/classic`, `module: amd/umd/systemjs/none` and `baseUrl`.
    - Must be on: `esModuleInterop`, `allowSyntheticDefaultImports`, `alwaysStrict`.
    - New defaults: `strict: true`, `module: esnext`, `types: []`, `rootDir: ./`, `noUncheckedSideEffectImports: true`, and `stableTypeOrdering: true` (cannot be turned off).
    - Syntax: `import ... asserts` must become `with`, and namespace declarations can't use the `module` keyword.
    - JS/JSDoc checking was reworked: `@enum` and Closure-style function types are gone.
    - Template-literal inference is now code-point aware.
    - Language-service plugins and the programmatic API are absent.
    - New flags: `--checkers`, `--builders`, `--singleThreaded`.
  - Bridge for tools: `@typescript/typescript6@6.0.2` provides `tsc6` and the 6.0 API. Alias it with `"typescript": "npm:@typescript/typescript6@^6.0.2"` (e.g. for typescript-eslint 8.72.1).
  - `typescript@6.0.3` (2026-04-16) is the last JS-based compiler.
  - **Preview:** `7.1.0-beta` (2026-10-20, https://devblogs.microsoft.com/typescript/announcing-typescript-7-1-beta/). It adds:
    - a new API (`typescript/sync`, `/async`, `/fs`, `/ast`, `/ast/is`, `/ast/factory`), with Disposable objects;
    - `contentMappers` plus `--runExternalCode`, so Vue/Svelte/Astro/MDX/CSS Modules can be checked again;
    - `--target/lib es2026`, import attributes in ambient modules (`declare module "*" with { type: "css" }`) and `import source`;
    - a stricter distributive-conditional relation.
  - `@typescript/native-preview` is frozen at a 2026-07-07 nightly; nightlies now ship as `typescript@next`.
- **Authoritative syllabi used**
  - TS Handbook + tsconfig reference: https://www.typescriptlang.org/docs/ and https://www.typescriptlang.org/tsconfig
  - TS 7.0 / 7.1 release posts (above). TS 6.0 deprecation notes (unverified URL: devblogs "Announcing TypeScript 6.0").
  - certificates.dev TypeScript Certification (independent, proctored; Junior/Mid/Senior), https://certificates.dev/typescript. The Senior domains are: how the type system works; conditional & mapped types; type-level programming; designing types others use; authoring/shipping typed libraries; performance & the native compiler; runtime validation & migration. Format: 40 MCQ + 2 coding challenges in 135 min. No domain weightings are published.
  - type-challenges (https://github.com/type-challenges/type-challenges), Total TypeScript (Pocock), the basis of existing modules 01–08.
  - "Are the types wrong?" (`@arethetypeswrong/cli@0.18.5`) for publishing.
- **Proposed modules** (13; existing 01–08 mostly kept, 09–13 rebuilt as typing-only)
  1. **Toolchain & compiler model (TS 7)**: erasure; `tsc` vs bundlers vs Node type stripping (`erasableSyntaxOnly`); `tsgo` architecture (Go, parallel checkers); `--checkers/--builders`; the LSP-based editor; the 6.0 bridge; `tsx` vs `node --experimental-strip-types` (unverified flag status).
  2. **Essential types & functions**: primitives, arrays/tuples, `Set`/`Map`, async/Promise typing, `JSON.parse` → `unknown`. Keep existing M01, minus build-pipeline material, which moves to M1.
  3. **Unions, narrowing & control-flow analysis**: CFA formalism, discriminated unions, exhaustiveness, `in`/`instanceof`/predicate narrowing, closures and narrowing, `switch(true)` (pulled in from 11.3.1). Existing M02.
  4. **Objects, assignability & the "weird parts"**: structural typing formalised (`A` assignable to `B`); freshness/excess-property checks; `{}`/`object`/`unknown`; method vs function-property bivariance and `strictFunctionTypes`; `exactOptionalPropertyTypes`; `noUncheckedIndexedAccess`; index signatures. Merges existing M02.4 and M04.2.
  5. **Classes, mutability & TS-only syntax**: `readonly`/`as const`; `#private`; `override`; `accessor`; enums/namespaces/parameter properties under `erasableSyntaxOnly`; the `as const`-object pattern. Existing M03.
  6. **Modules, declarations & tsconfig (TS 7 edition)**:
     - `module`/`moduleResolution` (`nodenext` vs `bundler`), `verbatimModuleSyntax`;
     - package.json `exports`/`types` conditions; `.d.ts`, ambient modules, `declare global`, module augmentation;
     - `types: []` and `rootDir` defaults; `noUncheckedSideEffectImports`; import attributes in ambient modules (7.1);
     - project references and `tsc -b`.
     Existing M04.3–4 plus the 08.2 globals, deduped.
  7. **Generics & inference**: inference sites, `const T`, `NoInfer`, partial inference, overloads vs conditional types, variance and the `in`/`out` annotations, "useless generics". Existing M07.
  8. **Type-level programming I: derivation**: `keyof`/`typeof`/indexed access, utility types, template literal types (with the code-point change in 7.0). Existing M05.
  9. **Type-level programming II: conditional/mapped/recursive types**:
     - distributivity; `infer` with `extends` constraints;
     - mapped-type modifiers and key remapping, homomorphic mapped types;
     - recursion limits (instantiation depth 50/100, unverified exact numbers), tail-recursive conditional types;
     - the 7.1 change to distributive relations.
     Existing M06.
  10. **Type-safe API design patterns**: branded types, predicates/assertion functions, builder/type-state, reverse-mapped types, identity functions, `using`/`Disposable` typing, decorator typing. Existing M08 + 11.2 (typing angle only).
  11. **Runtime boundaries: validation & Standard Schema**: Zod 4 (`zod@4.6.7`) input/output types, `z.infer`; Standard Schema (`StandardSchemaV1`) as a library-neutral contract; parse-don't-validate; branded outputs; typed `fetch` and env loaders. This is the reduced M09.1–2.
  12. **Typing UI frameworks: React & Solid (typing only)**: the JSX namespace and `jsxImportSource`; `IntrinsicElements`; component prop types; generic & polymorphic components; context typing; event types; ref types. Replaces M09.3–4, M10, M12 and M13 (split spec below).
  13. **Library authoring, type performance & testing types**:
      - `isolatedDeclarations`, declaration emit, `attw`, dual ESM/CJS pitfalls;
      - type tests (`expect-type@1.4.0`, `vitest --typecheck`, `@ts-expect-error` negatives);
      - diagnosing slow types (`--extendedDiagnostics`, `--generateTrace`; TS7 support unverified);
      - JSDoc/`checkJs` in 7.0;
      - migrating JS→TS and 5.x→7.
- **Gotchas & production failure modes**
  1. Upgrading to TS 7 makes `process`, `describe` and `Buffer` "Cannot find name", because the `types` default is now `[]`. Add `"types": ["node", "vitest/globals"]`.
  2. Under TS 7, `import "./index.css"` (and Panda's root CSS) can fail with `noUncheckedSideEffectImports: true`. You need an ambient `declare module "*.css"`, or the 7.1 `with { type: "css" }` declaration.
  3. Leftover `baseUrl` path aliases or `moduleResolution: "node"` are hard errors in 7.0, not warnings. Monorepos break all at once.
  4. typescript-eslint, Volar/vue-tsc, Angular language service and TS-plugin-based tools (CSS Modules plugins, the Next.js TS plugin) do not work on 7.0. Run 7.0 `tsc` alongside `@typescript/typescript6`.
  5. `rootDir` now defaults to `./`, so `outDir` layout silently changes (`dist/src/...`).
  6. `as` / `!` / `JSON.parse` lie at runtime boundaries. A missing validation step shows up as a production `undefined` crash far from its cause.
  7. Destructuring a discriminated union before narrowing loses the correlation (the "destructuring trap").
  8. `Object.keys` returns `string[]`, by design (open object types). Casting it to `(keyof T)[]` is unsound under subtyping.
  9. Method-shorthand parameters are bivariant even with `strictFunctionTypes`, so unsound callbacks get through.
  10. `enum`, `namespace` and parameter properties break Node's native type stripping. Enforce `erasableSyntaxOnly`.
  11. `const enum` across package boundaries breaks under `isolatedModules` and bundlers.
  12. Deep recursive conditional types trigger TS2589 ("excessively deep"). Editor latency or CI OOM come from type explosion, so profile with traces.
  13. `isolatedDeclarations` requires explicit return types on exports. Turning it on late creates thousands of errors.
  14. Dual-package hazard: separate ESM and CJS type entries without matching `exports.types` conditions give "masquerading as ESM/CJS". Check with `attw`.
  15. `stableTypeOrdering` changes union order in emitted `.d.ts` and error text, so snapshot tests of declarations churn when you upgrade.
  16. JS projects using `@enum` or Closure-style JSDoc lose types under 7.0.
- **Interview hot topics**: structural vs nominal typing and branding; `unknown` vs `any` vs `never`; distributive conditional types and how to stop distribution; variance (co/contra/bi; `in`/`out`); `satisfies` vs annotation vs `as`; `interface` vs `type` (merging, performance); module resolution (`bundler` vs `nodenext`, `exports`); what TS 7 changed and why it's 10× faster (Go, shared-memory parallel checking); type-level parsing (route params, query strings); designing generic library APIs (inference sites, `NoInfer`, `const T`); runtime validation strategy; `erasableSyntaxOnly` and running TS natively.
- **Executable-proof strategy**
  - `.mise.toml`: `node = "24"` (Active LTS; exact patch unverified) and `npm:typescript = "7.0.2"`. Add `@typescript/typescript6@6.0.2` only for lint.
  - Type tests: `*.test-d.ts` with `expect-type@1.4.0` + `vitest@5.0.5 --typecheck`. Negative tests use `// @ts-expect-error` (they fail if no error occurs).
  - A `tsc --noEmit -p examples/<module>` CI step per module.
  - Runtime tests: `vitest` for predicates, Zod parsers and builders.
  - Config tests: fixture projects compiled with `tsc --showConfig` and `tsc -p`, asserting expected diagnostics (TS2589 etc.) by snapshotting stderr.
  - Library module: build a tiny package, then run `attw --pack` and `publint`.
  - Hard to prove locally: perf claims (`--checkers` speedup), because they're hardware dependent. Fallback: record `--extendedDiagnostics` numbers as informational, not asserted.
- **Overlaps / dedupe**
  - **Move to `languages/javascript`**:
    - the runtime semantics of `using`/`await using` (dispose order, `SuppressedError`);
    - decorator runtime semantics (Stage-3 evaluation order, `context.addInitializer`);
    - iterator helpers, ES2023–2026 array/Set/Map methods, `Promise.withResolvers`, `Array.fromAsync`, `Error.isError`, `Math.sumPrecise`;
    - ESM vs CJS loading and package.json `exports` at runtime;
    - closures and `this` binding (existing M03.2 "contextual this");
    - Promise/microtask semantics behind M01.5.
  - TS keeps only the *typing* of each of these.
  - React/Solid mechanics live in their own tracks, which cross-link to TS M12.
  - Expert-interview lesson 11.1: drop it as a lesson. Fold its design lessons (DataTag, tuple accumulation, ts-pattern exhaustiveness) into M10/M13 as case studies.
- **Gap analysis vs existing**
  - **(a) Missing topics**
    - TS 7 toolchain and breaking defaults; the 6.0 bridge and editor setup.
    - `erasableSyntaxOnly` and Node type stripping.
    - `verbatimModuleSyntax`; `nodenext` vs `bundler` and package `exports`/`types` conditions.
    - Project references / `tsc -b` / `--builders`.
    - Variance annotations; formal assignability rules (bivariance, `strictFunctionTypes`); `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`.
    - Recursion limits and type performance tracing.
    - Library publishing (`attw`, declaration emit, dual packages); Standard Schema.
    - 7.1 items: new API, `contentMappers`, `import source`, `es2026` lib.
    - JSDoc/checkJs changes; `unique symbol`; abstract classes; `this` types.
  - **(b) Outdated or incorrect-looking claims**
    - M01.1.4 "`tsx` for rapid execution": add Node native type stripping as the default path. `tsx@4.23.15` still works.
    - M04.4 "Recommended tsconfig matrix": re-verify every key against 7.0. `baseUrl`, `moduleResolution: node` and `esModuleInterop: false` are now hard errors. `strict`, `module` and `types` defaults changed, so the matrix should state only what differs from the defaults.
    - M11.2 title "TypeScript 5.x–6.x/7.0 Feature Mastery" mixes JS features with TS versions. The 7.0 framing needs the facts above, not speculation.
    - M11.2.2 "Stage-3 decorators (TS 5.0+)": whether 7.0 still supports `experimentalDecorators`/`emitDecoratorMetadata` was not confirmed (unverified). Verify before teaching.
    - M12.5 "React Compiler (React Forget)": the product is React Compiler 1.0 (2025-10-07). "Forget" is the obsolete codename. `useEffectEvent` and `<Activity>` are now stable (19.2), not experimental.
    - M06 template-literal challenges that split strings may behave differently with astral characters under 7.0's code-point inference.
    - M08.5.2 "`NoInfer<T>` (TS 5.4+)" and M07.3.4 "`<const T>` (TS 5.0+)" are correct, but version tags are noise in a 7.x course. Drop them.
    - M13 headings are broadly consistent with the rc.19 API, but 13.6.4 "Full 7-Module Solid Track" is a stub pointer; delete it.
  - **(c) Proposed restructure**
    - Keep: M02, M03, M05, M06, M07, M08 (renumbered as above).
    - Split M01: toolchain goes to new M1, types stay in M2.
    - Merge M02.4 + M04.2 into new M4 (assignability). Merge M04.3–4 + M08.2 into new M6.
    - New: M11 (Standard Schema/Zod 4) and M13 (library authoring/type perf/type tests).
    - Retire M11 as a lesson (see Overlaps).
    - Collapse M09.3–4, M10, M12 and M13 into new M12, as specified below.
  - **Exact split of current M09–M13**

    | Current | Stays in TS (→ new module) | Moves to |
    |---|---|---|
    | 09.1–9.2 Zod | Schema typing, `z.input/z.output/z.infer`, refinements' type effects, branded outputs, fetcher pattern → **M11**. Update to Zod 4 API (top-level string formats, unified `error` param; superRefine→`.check` deprecation is **unverified**) | — |
    | 09.3 Components & props | `ComponentProps<'button'>`, `ReactNode` vs `JSX.Element` vs `ReactElement`, overriding HTML props → **M12** | Component/render model → `react` M01 |
    | 09.4 Events & core hooks | Event generic types, `useState<T>` inference, `useRef` overloads, reducer action unions → **M12** | Effect semantics, batching, reducer design → `react` M03/M04 |
    | 10.1–10.2 Discriminated & generic props | Keep all → **M12** | — |
    | 10.3 Hooks/state | `as const` tuple returns, `createSafeContext` typing → **M12** | State-machine hook design → `react` M03 |
    | 10.4 React types deep dive | `JSX.IntrinsicElements`, global JSX augmentation, CSS custom-property typing → **M12** | — |
    | 10.5 Polymorphic/forwardRef/external libs | Polymorphic `as`, generic components with `ref` as a prop (19) → **M12**; drop the `forwardRef` generic-erasure workaround or keep it as a one-paragraph legacy note | — |
    | 11.3.3 HOCs & class components | HOC typing → **M12** appendix | Class components/error boundaries → `react` M10 |
    | 12.1 ref-as-prop, `ComponentPropsWithRef`, ref cleanup types | Types only → **M12** | Ref cleanup semantics → `react` M04 |
    | 12.2 `use()`, context-as-provider | Signature of `use<T>(Usable<T>)`, `<Context value>` typing → **M12** | Suspension protocol, streaming → `react` M06 |
    | 12.3 Actions/`useActionState`/`useFormStatus`/`useOptimistic` | Generic signatures only `(State, Payload)` → **M12** | Semantics, races, progressive enhancement → `react` M08 |
    | 12.4 RSC & serialization | Type-level "serializable" constraint and `"use server"` arg typing → **M12** | Flight protocol, directives, security → `react` M07 |
    | 12.5 Compiler, `useEffectEvent`, metadata | — | All → `react` M04/M09 |
    | 13.1 Solid mental model & tsconfig | `jsxImportSource: "@solidjs/web"` (rc.19: `solid-js` no longer ships `jsx-runtime`) → **M12** | Run-once components, microtask batching → `solidjs` M01 |
    | 13.2 Signals/memos/effects | `Accessor<T>`/`Setter<T>` types, signal widening, writable-memo overload typing → **M12** | Everything else → `solidjs` M01/M04 |
    | 13.3 Stores/projections | `Store<T>`/draft setter typing, `createProjection` generic signature → **M12** | Semantics → `solidjs` M03 |
    | 13.4 Components/props/control flow/context | `Component`/`ParentComponent`/`VoidComponent`/`FlowComponent`; `merge`/`omit` result types; `<Show>` narrowing to an accessor; `<For>` callback types per keying mode; context typed `T` (default-less throws `ContextNotFoundError`) → **M12** | Runtime behaviour → `solidjs` M02 |
    | 13.5 Refs/directives/events/Dynamic | Ref directive factory types, `dynamic()`/`<Dynamic>` `ValidComponent`/`ComponentProps<T>` → **M12** | DOM/event semantics → `solidjs` M02 |
    | 13.6 Actions/optimistic/server fns | Generator-action typing only → **M12** | → `solidjs` M05/M06 |

---

## 4. Re-verify list
These claims were marked unverified during research. Confirm or correct each one against a primary source before teaching it:
- TS 7.0 / 7.1 release posts (above). TS 6.0 deprecation notes (unverified URL: devblogs "Announcing TypeScript 6.0").
- 1. **Toolchain & compiler model (TS 7)**: erasure; `tsc` vs bundlers vs Node type stripping (`erasableSyntaxOnly`); `tsgo` architecture (Go, parallel checkers); `--checkers/--builders`; the LSP-based editor; the 6.0 bridge; `tsx` vs `node --experimental-strip-types` (unverified flag status).
- recursion limits (instantiation depth 50/100, unverified exact numbers), tail-recursive conditional types;
- diagnosing slow types (`--extendedDiagnostics`, `--generateTrace`; TS7 support unverified);
- `.mise.toml`: `node = "24"` (Active LTS; exact patch unverified) and `npm:typescript = "7.0.2"`. Add `@typescript/typescript6@6.0.2` only for lint.
- M11.2.2 "Stage-3 decorators (TS 5.0+)": whether 7.0 still supports `experimentalDecorators`/`emitDecoratorMetadata` was not confirmed (unverified). Verify before teaching.
- | 09.1–9.2 Zod | Schema typing, `z.input/z.output/z.infer`, refinements' type effects, branded outputs, fetcher pattern → **M11**. Update to Zod 4 API (top-level string formats, unified `error` param; superRefine→`.check` deprecation is **unverified**) | — |

## 5. Certifications & exams
Follow AGENTS.md § Certification and Exam Coverage exactly. Minimum deliverables:
1. **README "Certifications & Exams" section.** Start from the exams named in the dossier above ("Authoritative syllabi used"). Re-verify each exam's code, status, guide version/date, targeted product version and domain weights on the official page. Where no certification exists, say so and use the recognised interview format.
2. **`exams/README.md` coverage matrix.** Rows are domain/objective, weight, modules, examples, status. No ❌ at hand-off.
3. **`exams/<exam-code>.md` question banks.**
   - At least 5 questions per domain and at least 60 per certification, weighted like the official domains.
   - The real exam's question types, plus hands-on tasks with verification scripts for performance-based exams.
   - Difficulty tags. Answers with explanations, why each distractor is wrong, and module + official-doc refs.
   - One full mock exam with a scoring key.
4. **Exam-delta callouts** where the exam's product version differs from the track's.
5. **Original questions only.** No braindump content.

## 6. Code languages
Per AGENTS.md § Code Example Languages:
- **Primary:** pseudocode (where algorithms or protocols are described) + TypeScript (or the track's own language, for language tracks).
- **Secondary:** Python, Rust or Nim only where it teaches something. Each language lives in `examples/<lang>/` with its own mise-pinned toolchain and native test runner, and `test` runs them all.

## 7. Workflow and definition of done
1. **Primary (Opus)** works on branch `track/typescript` and sets this track's row in `.agents/STATUS.md` to 🟦.
2. **Verify versions first.** Check every version in the dossier against its primary source today. Record the results in the README's `Verified against …` line. Resolve every item in the re-verify list below.
3. Build in stages: README syllabus + exam matrix → modules one by one, each with its examples/tests → glossary → cheatsheet → question banks → mock exam. Delegate bulk drafting (question-bank drafts, glossary candidates, cheatsheet tables) to the **Drafter**, then correct and integrate it yourself.
4. Before each commit: run `mise exec -- npm test` and `npm run typecheck` (or the equivalents), and `test:integration` if present. Commit with Conventional Commits scoped `(typescript)`.
5. Self-check against `.agents/REVIEW.md`. Then set STATUS to 🟨 and write the hand-off at the top of `.agents/reviews/typescript.md`:
   - what was done;
   - what was not done, and why;
   - every claim you are least sure of.
6. The **Challenger** attacks it and the **Verifier** checks it independently. Both record findings in `.agents/reviews/typescript.md` (prompts in `.agents/KICKOFF.md`). The primary resolves the findings (🟧), Opus runs the final gate (🟪), and the owner merges (✅).
