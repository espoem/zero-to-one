# Review: typescript

## Hand-off (author: Opus, in progress — updated after every commit)

Status: 🟦 in progress on `track/typescript`. Tests: `npm test` (node --test) and `npm run typecheck` (tsc 7.0.2 on root + React + Solid projects) green at every commit.

Done:
- Handover map for old 09–13 (below).
- Restructure to the brief's 13-module syllabus; tooling bump (node 26, typescript 7.0.2, zod 4.6.7, @types/node 26.6.6, @types/react 19.3.0, solid-js/@solidjs/web 2.0.0-rc.19, expect-type 1.4.0, attw 0.18.5, publint 0.3.25, @standard-schema/spec 1.1.0).
- M01 toolchain (new) + fixture tests asserting TS7 diagnostics.
- M11 runtime boundaries (rewritten for Zod 4 + Standard Schema) + tests.
- M12 typing UI frameworks (new, React 19 + Solid 2 RC) + type tests.
- M13 library authoring, type performance, type tests, migration, version history (new) + package/attw/publint/TS2589/TS2578/trace fixtures.
- M09 conditional/mapped/recursive: formal semantics, recursion limits, TS 7 code-point and 7.1 distributive changes, drill; new dedicated example (the "missing example for module 06").
- M10 API design: renumbered old 08 lessons, new lessons on Disposable typing, TC39 vs legacy decorator typing (Then vs now), case studies from old 11.1, drill; new examples for using/DisposableStack and decorator typing.
- M06 modules/declarations/tsconfig: rewritten (module formats, nodenext vs bundler with Then vs now, verbatimModuleSyntax Then vs now, d.ts, ambient assets, merging, augmentation, project references, TS 7 tsconfigs) + fixture tests (TS2835, TS1484, TS1543, TS6306, tsc -b --builders).
- M04 objects/assignability: formal assignability and variance, unsoundness table, freshness, reordered lessons, strictness flags with Then vs now, drill + new example (runtime crashes for bivariance/array covariance, TS2375 fixture).
- M02 essential types: sets-of-values intro, renumbered lessons, iteration/generator typing lesson with Then vs now (BuiltinIteratorReturn), drill + new example.
- M03 unions/narrowing: CFA formalism, closure-narrowing Then vs now (5.4), switch(true), inferred predicates, drill + new control-flow example.
- M05 classes/mutability: this typing, abstract/override/accessor, erasableSyntaxOnly Then vs now, drill + new example.
- M07 generics: inference phases, variance annotations (method bivariance caveat verified), drill + new inference/variance example.

## Remaining work (ordered)
1. (done) M13.
2. (done) M09.
3. (done) M10.
4. M02–M08: retitle headers (remove "Weeks"/track labels), add formal definitions, TS 7 notes, Then vs now where practice changed, Interview Drill; M04 merged sections need a coherent intro; M06 needs nodenext/bundler, exports/types conditions, project references, `types: []`, `rootDir`, import attributes; M03 add `switch(true)`; M08 add `string & {}`.
5. Convert old script-style examples (essentials-and-narrowing, generics-and-overloads, type-transformations, advanced-patterns, modern-features-typing, zod-schema-validation) to `test()` blocks; add examples for M02, M04, M05, M06.
6. exams/README.md + exams/interview.md (certificates.dev TS cert: 40 MCQ + 2 coding in 135 min; no published weights) + mock exam.
7. GLOSSARY.md, CHEATSHEET.md, final README (Certifications & Exams, `Verified against … on <date>`).
8. Run `mise lock` on a machine with mise: `mise.lock` still pins node 24.22.1 (node 26 checksums could not be fetched here).

## Least-certain claims
- `--builders` default (not stated in the 7.0 post).
- Version in which Node removed `--experimental-transform-types` (Node 26.12.1 rejects it; introduced in 22.7).
- 5.x release months in the M01 version table (marked unverified).
- Zod 3 version that first implemented Standard Schema (stated as 3.24).

## Corrections to the brief found during verification
- Most "TS 7 defaults" (strict, module esnext, types [], rootDir, noUncheckedSideEffectImports) changed in **6.0**; 7.0 made the 6.0 deprecations hard errors.
- `rootDir` change is not silent in 7.0.2: tsc reports TS5011 when the inferred common source dir differs.
- `experimentalDecorators`/`emitDecoratorMetadata` still work in 7.0.2 (fixture compiled, metadata emitted). `--extendedDiagnostics` and `--generateTrace` work in 7.0.2 (trace writes one types_N.json per checker).
- 7.0.2 has no classic API on the main entry, but ships `typescript/unstable/*` subpath exports.
- Zod 4.6.7 does not deprecate `.superRefine` (typings); brief's "unverified" item resolved.
- Executable proofs use `node --test` + tsc (AGENTS.md § Code Example Languages) instead of the brief's vitest `--typecheck`; AGENTS.md wins.

## Proposals for integrator
- Convert plain-text references to `languages/javascript` and `technologies/nodejs` into links once those tracks exist (they do not exist on this branch).

## Handover

Owner decision (brief §1): modules 09–13 of `languages/typescript` shrink to the TypeScript-typing angle. Runtime and framework mechanics move to the owning tracks listed in `.agents/OWNERSHIP.md`. This table lists **every section** of the pre-restructure modules 09–13 (as of commit `9700c8d`, path `languages/typescript/modules/`), so the receiving authors can pull the old text with `git show 9700c8d:languages/typescript/modules/<file>` and nothing is lost.

Legend for the target columns:
- **TS (new Mnn)**: stays in this track, in the new module number (see the new syllabus in `languages/typescript/README.md`). Only the *types* stay: signatures, inference, narrowing, declaration merging.
- **react Mnn / solidjs Mnn / javascript Mnn**: module numbers from `.agents/briefs/react.md`, `.agents/briefs/solidjs.md` and `.agents/briefs/javascript.md`.
- **Drop**: obsolete or redundant; the reason is given.

Receiving tracks should cross-link back to **TS M12** (`languages/typescript/modules/12-typing-ui-frameworks.md`) for the typing of components, hooks, JSX and refs, and to **TS M11** (`languages/typescript/modules/11-runtime-boundaries-validation.md`) for Zod / Standard Schema typing.

### Old M09: "Runtime Checking with Zod & React with TypeScript Foundations"

| Old section | Stays in TS (typing angle) | → react | → solidjs | → javascript | Notes |
|---|---|---|---|---|---|
| Overview, type-testing helpers | Type-test helpers become `expect-type` + `vitest --typecheck` (TS M13) | — | — | — | Hand-rolled `Expect<Equal<…>>` helpers stay as a teaching device in TS M09 |
| 9.1.1 Runtime boundary problem | **TS M11** (parse-don't-validate, `unknown` at the edge) | — | — | `JSON.parse` precision/BigInt reviver → javascript M13 | |
| 9.1.2 Primitives/objects/arrays/tuples in Zod | **TS M11**, updated to Zod 4 (`z.email()` etc. top-level formats) | — | — | — | |
| 9.1.3 Enums, unions, discriminated unions in Zod | **TS M11** | — | — | — | |
| 9.1.4 optional/nullable/default/catch | **TS M11** (input vs output type effect of `.default`, `.catch`) | — | — | — | |
| 9.2.1 Input vs output types | **TS M11** (`z.input`/`z.output`/`z.infer`) | — | — | — | |
| 9.2.2 `.parse` vs `.safeParse` | **TS M11** (result-type narrowing on `success`) | — | — | — | |
| 9.2.3 `.refine` / `.superRefine` | **TS M11** (type effect only; Zod 4 `.check`/`.superRefine` status re-verified there) | — | — | — | |
| 9.2.4 Schema composition (`extend`/`pick`/`omit`/`merge`) | **TS M11** (Zod 4: `.merge` deprecated in favour of `.extend`/spread) | — | — | — | |
| 9.2.5 Fetcher pattern | **TS M11** (typed `fetch` with a schema parameter) | — | — | `fetch`/`AbortSignal` semantics → javascript M07 | |
| 9.3.1 Component signatures, direct typing vs `React.FC` | **TS M12** | Function-component render model → react M01 | — | — | |
| 9.3.2 `ReactNode` vs `JSX.Element` vs `ReactElement` | **TS M12** | Element objects, `$$typeof` → react M01 | — | — | |
| 9.3.3 HTML props inheritance and overrides (`ComponentProps<'button'>`, `Omit`) | **TS M12** | — | — | — | |
| 9.4.1 Synthetic events | **TS M12** (event generic types: `ChangeEvent<HTMLInputElement>`, `currentTarget` vs `target` typing) | Event delegation/root listener semantics → react M01/M02 | — | DOM event propagation basics → javascript (HTML event loop row) | |
| 9.4.2 `useState`/`useEffect`/`useCallback`/`useMemo` | **TS M12** (`useState<T>` inference, `undefined` initialiser, setter types) | Effect semantics, dependency arrays, batching, async effects/race → react M03/M04 | — | — | The "async effects" anti-pattern (old §5) moves to react M04 |
| 9.4.3 `useRef` overloads | **TS M12** (`RefObject<T \| null>`, React 19 single-overload change) | Ref mutation semantics → react M04 | — | — | |
| 9.4.4 `useReducer` with discriminated unions | **TS M12** (action-union typing, exhaustiveness) | Reducer design, purity, batching → react M03 | — | — | |
| Anti-patterns 1–5 | 1, 2, 3, 4 → TS M11/M12 | 5 "async effects" → react M04 | — | — | |
| Exercise 9.1 checkout schema | **TS M11** exercise | — | — | — | |
| Exercise 9.2 `superRefine` form validator | **TS M11** exercise (rewritten for Zod 4) | — | — | — | |
| Exercise 9.3 `LabeledInput` with ref forwarding | **TS M12** exercise, rewritten with ref-as-prop (React 19) | — | — | — | `forwardRef` version dropped |
| Exercise 9.4 `useCart` reducer | **TS M12** exercise (types only) | Reducer runtime tests → react M03 | — | — | |
| Summary & cheat sheet | Merged into `CHEATSHEET.md` | — | — | — | |

### Old M10: "Advanced React with TypeScript"

| Old section | Stays in TS | → react | → solidjs | → javascript | Notes |
|---|---|---|---|---|---|
| 10.1.1 Mutually exclusive props via discriminated unions | **TS M12** | — | — | — | |
| 10.1.2 Destructuring gotcha | Generic rule → **TS M03** (destructuring trap); props-specific note → **TS M12** | — | Solid's *reactivity* destructuring trap is a different bug → solidjs M03 | — | |
| 10.1.3 Boolean discriminators, `Record<string, never>` | **TS M12** | — | — | — | |
| 10.2.1 Generic components `Table<TRow>`, `Select<TOption>` | **TS M12** | — | — | — | |
| 10.2.2 Constraining type params / explicit type args in JSX | **TS M12** | — | — | — | |
| 10.2.3 DRY prop helpers | **TS M12** | — | — | — | |
| 10.3.1 `as const` tuple returns from hooks | **TS M12** | — | — | — | |
| 10.3.2 `createSafeContext` | **TS M12** (typing of a default-less context) | Context propagation/re-render cost → react M03/M12 | — | — | |
| 10.3.3 State machines & discriminated tuples in hooks | Types → **TS M12** | State-machine hook design → react M03 | — | — | |
| 10.4.1 `JSX.Element` vs `ReactElement` vs `ReactNode` | **TS M12** (merged with 9.3.2) | — | — | — | |
| 10.4.2 `JSX.IntrinsicElements` | **TS M12** (JSX namespace resolution, `jsxImportSource`) | — | — | — | |
| 10.4.3 Global JSX augmentation & CSS custom properties | **TS M12** | — | — | — | Panda/CSS custom-property typing: cross-link from panda-css |
| 10.5.1 Polymorphic `as` prop | **TS M12** | — | — | — | |
| 10.5.2 `forwardRef` generic erasure fix | **TS M12** one-paragraph legacy note ("Then vs now": 18 vs 19) | `forwardRef` deprecation path → react M12 (18→19 upgrade) | — | — | |
| 10.5.3 React Hook Form wrapper, TanStack Query overloads | **TS M10** case study (overload design, `DataTag`) | Library usage itself: out of scope everywhere | — | — | |
| Anti-patterns 1–4 | **TS M12** | — | — | — | |
| Exercises 10.1–10.4 | 10.1 polymorphic, 10.2 generic table, 10.3 safe context → **TS M12**; 10.4 `useForm` wrapper → **TS M10** case study | — | — | — | |

### Old M11: "Expert Interviews, Modern TypeScript & JavaScript Mastery"

| Old section | Stays in TS | → react | → solidjs | → javascript | Notes |
|---|---|---|---|---|---|
| 11.1.1 Rosenwasser: erasable types, `tsgo` | Facts folded into **TS M01** (toolchain, TS 7 architecture) | — | — | — | Dropped as an "interview" lesson (owner decision) |
| 11.1.2 tRPC zero-codegen | **TS M10** case study (inference across a router object) | — | — | — | |
| 11.1.3 Zod: parse-don't-validate, dual phantoms | **TS M11** | — | — | — | |
| 11.1.4 TanStack `DataTag` & overloads | **TS M10** case study | — | — | — | |
| 11.1.5 Redux tuple accumulation | **TS M10** case study (variadic tuple accumulation) | — | — | — | |
| 11.1.6 ts-pattern exhaustiveness | **TS M10** case study | — | — | — | |
| 11.1.7 Enterprise migration strategies | **TS M13** (JS→TS and 5.x→7 migration) | — | — | — | |
| 11.2.1 `using` / `await using` | Typing only (`Disposable`, `AsyncDisposable`, `lib: esnext.disposable`) → **TS M10** | — | — | Dispose order, `SuppressedError`, `DisposableStack` runtime → **javascript M10** | |
| 11.2.2 Stage-3 decorators | Decorator *typing* (`ClassMethodDecoratorContext<This, Value>`), legacy `experimentalDecorators` "Then vs now" → **TS M10** | — | — | Evaluation order, `context.addInitializer`, `accessor` runtime → **javascript M04** (classes) / decorators row | |
| 11.2.3 ES2023–2025 array/collection methods | Only the lib typing (`lib` targets, `toSorted` return types) → **TS M06** | — | — | All runtime behaviour → **javascript M05** (iterators) and M02/M04 | |
| 11.2.4 Async & iterator primitives (`Promise.withResolvers`, `Array.fromAsync`, iterator helpers) | Generic signatures only (`IteratorObject`, `BuiltinIteratorReturn`) → **TS M02** | — | — | Runtime semantics → **javascript M05/M07** | |
| 11.2.5 `isolatedDeclarations` | **TS M13** | — | — | — | |
| 11.3.1 `switch (true)` narrowing | **TS M03** | — | — | — | |
| 11.3.2 `string & {}` autocompletion trick | **TS M08** | — | — | — | |
| 11.3.3 HOCs & class components | HOC typing → **TS M12** appendix | Class components, error boundaries → **react M10** | — | — | |
| 11.3.4 Workshop challenges | Distributed into TS M09/M10 exercises | — | — | — | |
| Exercise 11.1 RPC builder | **TS M10** | — | — | — | |
| Exercise 11.2 unit-of-work with `using` | Typing half → **TS M10**; runtime dispose-order assertions → **javascript M10** | — | — | ✓ | |
| Exercise 11.3 pattern-matching state machine | **TS M10** | — | — | — | |
| Exercise 11.4 `DataTag` query options | **TS M10** | — | — | — | |

### Old M12: "React 19 & Modern React with TypeScript"

| Old section | Stays in TS | → react | → solidjs | → javascript | Notes |
|---|---|---|---|---|---|
| 12.1.1 Why `forwardRef` broke generics | **TS M12** legacy note | — | — | — | |
| 12.1.2 `ref` as a prop | **TS M12** (prop type) | Runtime: ref attachment timing → react M01/M04 | — | — | |
| 12.1.3 `ComponentProps` vs `…WithRef` vs `…WithoutRef` | **TS M12** | — | — | — | |
| 12.1.4 Generic components with `ref` | **TS M12** | — | — | — | |
| 12.1.5 Ref callback cleanup | Type only (callback may return `() => void`; implicit-return rejection) → **TS M12** | Cleanup semantics, when React calls it → **react M04** | — | — | |
| 12.1.6 Strict `useRef<T>`, `React.JSX` namespace | **TS M12** | — | — | — | |
| 12.2.1 `use()` signature | `use<T>(usable: Usable<T>): T` → **TS M12** | Suspension protocol, cached promises → **react M06** | — | — | |
| 12.2.2 Conditional context via `use()` | Typing → **TS M12** | Why `use` may be conditional (no hook list slot) → **react M03/M06** | — | — | |
| 12.2.3 Streaming promises server→client | Type of a `Promise<T>` prop → **TS M12** | Streaming, serialization → **react M06/M07** | — | — | |
| 12.2.4 `<Context value>` | **TS M12** | Provider deprecation path → react M12 | — | — | |
| 12.3.1 Async transitions | `startTransition` callback type → **TS M12** | Transition semantics → **react M05/M08** | — | — | |
| 12.3.2 `<form action>`, `formAction` | Prop types (`(formData: FormData) => void \| Promise<void>`) → **TS M12** | Progressive enhancement, ordering → **react M08** | — | — | |
| 12.3.3 `useActionState<State, Payload>` | Generic signature, discriminated state → **TS M12** | Semantics, queuing, races → **react M08** | — | — | |
| 12.3.4 `useFormStatus` | Return type → **TS M12** | Semantics → **react M08** | — | — | |
| 12.3.5 `useOptimistic<State, Action>` | Generic signature → **TS M12** | Rollback, hung-request failure mode → **react M08** | — | — | |
| 12.4.1 Async server components | Return type `Promise<ReactNode>` → **TS M12** | RSC execution model → **react M07** | — | — | |
| 12.4.2 Serialization boundaries at type level | `Serializable` constraint type → **TS M12** | What Flight actually serializes → **react M07** | — | `structuredClone` limits → javascript (serialisation row) | |
| 12.4.3 Server actions + Zod + `useActionState` | Arg typing of `"use server"` functions, schema at the boundary → **TS M11/M12** | Directives, security model, CVE-2025-55182, auth/IDOR → **react M07** | — | — | |
| 12.5.1 React Compiler & immutability contracts | — | **All → react M09** ("React Forget" is the obsolete codename; product is React Compiler 1.0) | — | — | |
| 12.5.2 `useEffectEvent` | — | **All → react M04** (stable since 19.2, not experimental) | — | — | |
| 12.5.3 Document metadata & resource preloading | — | **All → react M11** | — | — | |
| Anti-patterns | Types-only rows → **TS M12** | Behavioural rows → react M04/M08 | — | — | |
| Exercise 12.1 generic dropdown with `ref` | **TS M12** | — | — | — | |
| Exercise 12.2 conditional context with `use()` | Type half → **TS M12** | Runtime half → **react M06** | — | — | |
| Exercise 12.3 action form | Type half → **TS M12** | Runtime half → **react M08** | — | — | |
| Exercise 12.4 RSC serialization validator | **TS M12** | — | — | — | |

### Old M13: "SolidJS 2.x with TypeScript"

| Old section | Stays in TS | → react | → solidjs | → javascript | Notes |
|---|---|---|---|---|---|
| Overview; Solid 1.x vs 2.x comparison table | — | — | **solidjs M10** (migration map) | — | |
| 13.1.1 Components run once; prop-destructuring trap; control-flow narrowing in JSX | `<Show>` narrowing (callback receives a narrowed accessor) → **TS M12** | — | Run-once model, destructuring trap → **solidjs M01/M03** | — | |
| 13.1.2 tsconfig for Solid 2 | `jsx: "preserve"`, `jsxImportSource: "@solidjs/web"` → **TS M12** (verify against rc) | — | Build/plugin setup → solidjs M03/M08 | — | |
| 13.1.3 Microtask batching & `flush()` | — | — | **solidjs M01** | Microtask queue → javascript M06 | |
| 13.2.1 `createSignal<T>` accessors/setters, widening | `Accessor<T>`/`Setter<T>` types, literal widening, function-valued signals → **TS M12** | — | Semantics → **solidjs M01** | — | |
| 13.2.2 Async `createMemo`, `AsyncIterable`, `NotReadyError`, `latest`, `isPending` | Return type of async memo (`Accessor<T>` not `Accessor<Promise<T>>`) → **TS M12** | — | **solidjs M06** | Async iteration → javascript M05 | |
| 13.2.3 Split `createEffect`/`createRenderEffect` | Two-arg overload typing → **TS M12** | — | **solidjs M02** | — | |
| 13.3.1 `createStore<T extends object>` | **TS M12** (constraint, `Store<T>` readonly view) | — | Semantics → **solidjs M05** | Proxy mechanics → javascript M09 | |
| 13.3.2 Draft-first setters, path mutations | Setter overload typing → **TS M12** | — | **solidjs M05** | — | |
| 13.3.3 `createProjection` | Generic signature → **TS M12** | — | **solidjs M05** | — | |
| 13.3.4 `storePath`, `snapshot`/`deep`, `merge`/`omit` | `merge`/`omit` result types → **TS M12** | — | Rest → **solidjs M05** | — | |
| 13.4.1 `Component`/`ParentComponent`/`VoidComponent`/`FlowComponent` | **TS M12** | — | — | — | |
| 13.4.2 `merge`/`omit` (vs 1.x `mergeProps`/`splitProps`) | Result types → **TS M12** | — | Reactivity preservation, 1.x→2.0 rename → **solidjs M03/M10** | — | |
| 13.4.3 `<Show>`, `<For>` (three keying modes), `<Repeat>`, `<Switch>` | Callback parameter types per keying mode → **TS M12** | — | Runtime semantics → **solidjs M04** | — | |
| 13.4.4 `<Loading>`, `<Errored>` | — (prop types trivial) | — | **solidjs M06** | — | |
| 13.4.5 Providerless context, `ContextNotFoundError` | Context typed `T` vs `T \| undefined` → **TS M12** | — | Runtime → **solidjs M04** | — | |
| 13.5.1 Variable vs callback refs | Ref prop types → **TS M12** | — | **solidjs M03** | — | |
| 13.5.2 Ref directive factories (replacing `use:*`) | Factory type → **TS M12** | — | **solidjs M03** | — | |
| 13.5.3 `onSettled` replacing `onMount` | — | — | **solidjs M02** | — | |
| 13.5.4 Delegated vs native events, tuple delegation | Handler types → **TS M12** | — | Delegation semantics → **solidjs M03** | — | |
| 13.5.5 Polymorphic `<Dynamic>` | `ValidComponent`, `ComponentProps<T>` → **TS M12** | — | `dynamic()` vs `<Dynamic>` runtime → **solidjs M04** | — | |
| 13.6.1 Generator `action(fn*)` | Generator typing (`Generator<Y, R, N>`) → **TS M12** | — | **solidjs M07** | Generator protocol → javascript M05 | |
| 13.6.2 `createOptimistic`/`createOptimisticStore` | — | — | **solidjs M07** | — | |
| 13.6.3 `"use server"`, `handleServerFunctionRequest` | Argument/return serializability types → **TS M12** | — | **solidjs M08** | — | |
| 13.6.4 "Full 7-Module Solid Track" pointer | — | — | — | — | **Drop** (stub pointer; brief says delete) |
| Anti-patterns | Types-only rows → **TS M12** | — | Behavioural rows → solidjs M02–M04 | — | |
| Exercise 13.1 async search filter | Type assertions → **TS M12** | — | Runtime → **solidjs M06** | — | |
| Exercise 13.2 store + projection | Type assertions → **TS M12** | — | Runtime → **solidjs M05** | — | |
| Exercise 13.3 polymorphic primitive | **TS M12** | — | Runtime → **solidjs M04** | — | |
| Exercise 13.4 providerless context + `<Loading>` | Context typing → **TS M12** | — | Runtime → **solidjs M04/M06** | — | |

### Also moving out of old modules 01–08 (runtime semantics → javascript)

| Old section | Stays in TS | → javascript |
|---|---|---|
| 01.1.4 "`tsx` for rapid execution" | **TS M01** (TS 7 toolchain: Node type stripping vs `tsx`) | Node type-stripping internals → **technologies/nodejs** |
| 01.5.1–01.5.2 Promises, `Promise.all`/`allSettled` | `Promise<T>`, `Awaited<T>`, tuple typing of `Promise.all` → **TS M02** | Job queue, combinator semantics → **javascript M06/M07** |
| 03.2 "Contextual `this` in functions and objects" | `this` parameter and `ThisType<T>` typing → **TS M05** | `this` binding rules → **javascript M03** |
| 04.3 "Modules vs scripts & `moduleDetection`" | Type-checker view → **TS M06** | Module Records, live bindings → **javascript M08** |
