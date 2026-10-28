# A — Frontend tracks: TypeScript, React, SolidJS, Panda CSS (gap analysis)

Research date: 2026-10-28. Versions verified against the npm registry (`npm view <pkg> dist-tags` / `time`) plus official release notes. Anything not confirmed is marked "(unverified)".

**Biggest surprises (read first)**
1. **Panda CSS is at 2.4.0** (2026-10-22). 1.0 shipped on 2025-08-05 and 2.0 on 2026-09-29. The repo pins `^0.51` (Dec 2024), which is two majors behind. v2 replaced the ts-morph/ts-evaluator pipeline with a **Rust/Oxc compiler** and removed `createStyleContext`, `panda ship`, `emit-pkg`, local Studio, template-literal syntax, `defineParts` and the `hooks` config. It also renamed `theme.containerSizes` to `theme.containers`. Several existing modules teach removed APIs.
2. **TypeScript 7.0 is the `typescript` package itself.** The first stable publish is 7.0.2 (2026-07-08); there was no 7.0.0 publish, only 7.0.1-rc. 7.0 ships **no programmatic API**, so typescript-eslint and Volar need the `@typescript/typescript6` bridge. TS 7.1.0-beta came out 2026-10-20 with the new API, `contentMappers` and `es2026`.
3. **On npm, "SolidStart 2.x" (`@solidjs/start@2.1.0`) targets Solid 1.9** (peer `solid-js ^1.9.15`, router `<2`). For Solid 2, the serving layer is **"start mode" in `@solidjs/vite-plugin`**, which was renamed from `vite-plugin-solid`. Solid 2 is at **2.0.0-rc.19** (2026-10-27); the repo has rc.18. `solid-js` `latest` is still 1.9.17.
4. **React is at 19.3.1** (2026-10-14). 19.3 (2026-09-09) made `<ViewTransition>` and Fragment refs stable and added `browser()`. React Compiler 1.0 shipped 2025-10-07. The existing React modules (~70 lines each) cover none of 19.2 or 19.3, and they miss the Dec-2025 RSC RCE (CVE-2025-55182, CVSS 10).

---

### TypeScript — `languages/typescript`

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

### React — `technologies/react`

- **Current stable version(s)**
  - `react` / `react-dom` **19.3.1** (2026-10-14). 19.3.0 shipped 2026-09-09 (https://react.dev/blog/2026/09/09/react-19-3; changelog https://github.com/facebook/react/blob/main/CHANGELOG.md). Backport lines get patches too: 19.2.9, 19.1.10, 19.0.9.
  - 19.3 adds:
    - stable `<ViewTransition>` + `addTransitionType` and stable Fragment refs (`FragmentInstance`);
    - `react-dom` `browser()` with the `onBrowserBailout` option on the server APIs;
    - Trusted Types support and `<Context>` rendered directly in Server Components;
    - **independent (untangled) transitions**;
    - a DEV warning for conditional `use()`, and Strict Mode double-invoking effects during hydration.
  - 19.2 (2025-10-01, https://react.dev/blog/2025/10/01/react-19-2) added:
    - `<Activity>`, `useEffectEvent`, `cacheSignal` (RSC), Performance Tracks;
    - Partial Pre-rendering (`prerender` → `postponed`, `resume`/`resumeToPipeableStream`, `resumeAndPrerender`);
    - batched SSR Suspense reveals, Web Streams in Node;
    - the `useId` prefix change to `_r_`.
  - React Compiler `babel-plugin-react-compiler@1.0.0` (2025-10-07). `eslint-plugin-react-hooks@7.1.1` ships the compiler-powered rules; flat config is the default since v6.
  - `@types/react@19.3.0`. Canary is 19.3.0-canary; nothing 19.4/20 has been announced (unverified beyond the npm dist-tags).
  - React moved to the React Foundation (Linux Foundation), announced 2026-02-24.
- **Authoritative syllabi used**
  - react.dev Learn + Reference (https://react.dev/learn, https://react.dev/reference/react), the react.dev blog posts above, and the React Compiler docs (https://react.dev/learn/react-compiler).
  - certificates.dev React Certification (Junior/Mid/Senior, https://certificates.dev/react): 40 MCQ + 105 min of coding in 135 min. Topics: JS, core concepts, JSX, components, events, state, hooks, React Router. Senior domains are not published.
  - Meta Front-End Developer Professional Certificate on Coursera (unverified current syllabus).
  - Source-level references: the `react-reconciler` (Fiber) and `scheduler` packages on GitHub; Dan Abramov's "RSC from scratch" (https://github.com/reactwg/server-components/discussions/5).
- **Proposed modules** (12; expand each existing module from ~70 lines to full depth)
  1. **Elements, JSX & the render model**: JSX transform (`react/jsx-runtime`), `$$typeof` and XSS protection, purity, props immutability, keys and identity, `ref` as a prop (19). Existing M01.
  2. **Fiber reconciler & commit**: fiber fields, double buffering, begin/complete/commit phases, two-pass keyed diff, bailouts (`memo`, same-element), Fragment refs. Existing M02.
  3. **State, hooks & closures**: hook linked list, update queues, functional updaters, automatic batching, stale closures, `useReducer` design, `useSyncExternalStore` and tearing. Existing M03, plus state-machine design from TS M10.3.
  4. **Effects & synchronization**: passive vs layout vs insertion effects, `useEffectEvent`, ref-callback cleanup, Strict Mode double-invoke (including hydration in 19.3), "you might not need an effect". Existing M04.
  5. **Concurrency: lanes, transitions & deferred values**: lane bitmask, 5 ms yield, `startTransition`/`useTransition`, `useDeferredValue`, **untangled transitions in 19.3**, `<Activity>` hidden-priority rendering. Existing M05.
  6. **Suspense, streaming SSR & hydration**: the `use(promise)` protocol, cached promises, `renderToPipeableStream`/`ReadableStream`, selective hydration, batched reveals, partial prerender/resume, `browser()`, hydration mismatch. Existing M06.
  7. **Server Components & the Flight protocol**: two module graphs (`react-server` condition), Flight rows, serialization, `"use client"`/`"use server"`, `cache`/`cacheSignal`, **security model (CVE-2025-55182)**. Existing M07.
  8. **Actions, forms & optimistic UI**: `<form action>`, `useActionState`, `useFormStatus`, `useOptimistic` rollback, action ordering/races, progressive enhancement. Existing M08.
  9. **React Compiler 1.0**: HIR, reactive scopes, memo-cache lowering, Rules of React as preconditions, `"use no memo"`, eslint `react-hooks` compiler rules, incremental adoption, how it interacts with manual `useMemo`. Existing M09.
  10. **Errors & resilience**: error boundaries, `onCaughtError`/`onUncaughtError`/`onRecoverableError` root options (19.0), reset strategies, errors in hidden `<Activity>`. Existing M10.
  11. **Animation & DOM platform integration (new)**: `<ViewTransition>` + `addTransitionType`, Fragment refs, Portals, document metadata/`<link>`/`<script>` hoisting, `preload`/`preinit`, Trusted Types.
  12. **Performance, testing & production ops (new)**: Profiler + Performance Tracks, render-cost diagnosis, context-splitting, list virtualisation; RTL + `act`; testing Suspense/actions; bundle splitting with `lazy`; upgrading 18→19 (removed APIs: `propTypes`, function `defaultProps`, string refs, legacy context, `ReactDOM.render`); patch-level security hygiene.
- **Gotchas & production failure modes**
  1. **CVE-2025-55182**: unauthenticated RCE through Server Function payload decoding in `react-server-dom-*` 19.0–19.2.0. It affects any RSC app (Next, React Router, Waku, `@vitejs/plugin-rsc`) even without explicit server functions. Fixed in 19.0.1/19.1.2/19.2.1, with follow-up DoS/source-exposure fixes on 2025-12-11 (the CVE IDs for those were not checked).
  2. Server Functions are public HTTP endpoints. Missing auth or validation inside `"use server"` is an IDOR, whatever the UI hides.
  3. Index keys on reorderable lists move state onto the wrong item (input text and focus jump rows).
  4. A Promise created during render and passed to `use()` without caching suspends forever (a new promise every render).
  5. Calling `use()` conditionally to "unblock" now warns in DEV (19.3). Earlier versions hid the race.
  6. Effects that set state from props cause cascading renders. Compiler-era lint (`react-hooks` v7) flags them; `useEffectEvent` is for non-reactive reads, not for skipping dependencies.
  7. Hydration mismatches come from `Date.now()`, `Math.random()`, locale formatting and `typeof window` branches. Use `useId` (prefix now `_r_`), `browser()` or `suppressHydrationWarning`, sparingly.
  8. External mutable stores read without `useSyncExternalStore` tear under concurrent rendering.
  9. Optimistic state that never reconciles. `useOptimistic` only reverts when the action/transition settles, so a hung request leaves the UI lying indefinitely.
  10. Out-of-order async action results overwrite newer state. Sequence or abort them.
  11. The React Compiler silently skips components that break the Rules of React (mutating props, reading refs in render). Expected memoisation vanishes; check with the compiler's eslint rules.
  12. Context value identity changes re-render every consumer. Split contexts or memoise the value.
  13. Error boundaries don't catch errors in event handlers, async code or SSR. Errors inside a hidden `<Activity>` no longer leak (fixed in 19.3), so behaviour differs between versions.
  14. `useLayoutEffect` on the server warns, and blocking layout effects hurt INP.
  15. Before 19.3, one slow transition held up unrelated transitions (entanglement). Behaviour changed in a minor, so test against the pinned version.
- **Interview hot topics**: reconciliation and keys; why hooks can't be conditional (linked list); stale closures; `useEffect` vs `useLayoutEffect` vs event handlers; concurrent rendering and transitions; Suspense mechanics; RSC vs SSR (and why RSC isn't SSR); server actions and their security; React Compiler vs manual memo; hydration errors; state colocation vs global stores (`useSyncExternalStore`); diagnosing performance (Profiler/Performance Tracks).
- **Executable-proof strategy**
  - `.mise.toml`: `node = "24"`. Pin `react@19.3.1`, `react-dom@19.3.1`, `vitest@5.0.5`, `jsdom@30.1.3` (or `happy-dom@21.0.4`), `@testing-library/react@16.3.3`, `babel-plugin-react-compiler@1.0.0` and `@vitejs/plugin-react@6.1.2` (peer `vite ^8`, `vite@8.3.5`).
  - Reconciler/hooks/effects/transitions: `act()` + RTL in jsdom. Deterministic scheduling via `act` and the `scheduler/unstable_mock` build (unverified that it still ships in 19.3).
  - SSR: `react-dom/server` `renderToString`/`renderToPipeableStream`/`prerender` + `resume` in Node, with HTML snapshot assertions. Hydration mismatch is tested by rendering server HTML then `hydrateRoot` in jsdom and capturing `onRecoverableError`.
  - RSC/Flight: a separate Vitest project run with `--conditions react-server`, using `react-server-dom-webpack/server` + `/client` to round-trip a tree and snapshot Flight rows (unverified feasibility without a bundler; fallback `@vitejs/plugin-rsc`).
  - Compiler: transform fixtures with `@babel/core` + the plugin, snapshotting the output (`_c(n)` cache slots), plus negative fixtures that must bail out.
  - Browser-only behaviour (`<ViewTransition>`, Fragment `observeUsing`, real layout): Playwright `@playwright/test@1.64.1` against `vite preview`.
  - Cannot be proven locally: production RSC deployments and real CVE exploitation. Fallback: a version-gate test asserting the installed `react-server-dom-*` ≥ the patched version.
- **Overlaps / dedupe**
  - TypeScript typing of components/hooks lives in **TS M12**; cross-link it.
  - The event loop, microtasks, closures, `structuredClone`/serialisation limits and `AbortController` go to **`languages/javascript`**.
  - HTTP caching, streaming and CSP/Trusted Types theory belong to a web-platform/security track (`technologies/web-platform`, unverified track name).
  - Next.js / React Router framework specifics: cross-link only.
  - The React vs Solid mental-model comparison lives once, in `solidjs` M07; React links to it.
- **Gap analysis vs existing**
  - **(a) Missing topics**
    - All of 19.2: `<Activity>`, `useEffectEvent` (only mentioned in TS M12), `cacheSignal`, Performance Tracks, partial prerender/resume, SSR reveal batching, the `useId` format.
    - All of 19.3: ViewTransition, Fragment refs, `browser()`, Trusted Types, untangled transitions, Strict Mode hydration double-invoke, the conditional-`use` warning.
    - `useSyncExternalStore`; context performance.
    - Testing (RTL/act); Profiler.
    - 18→19 removed APIs.
    - `react-hooks` v7 compiler lint.
    - **RSC security / CVE-2025-55182.**
    - Root error callbacks; document metadata and resource preloading (only in TS M12.5); Portals.
    - Data-fetching and state-management patterns.
  - **(b) Outdated or incorrect-looking claims**
    - M06 frames Suspense via "algebraic effects": fine as an analogy, but say explicitly that throwing promises from user code is unsupported and `use()` is the API.
    - M05 should note that transitions are no longer entangled (19.3).
    - M09 should name "React Compiler 1.0" and the stable eslint integration.
    - M07 Flight row format: 19.3 added string outlining/dedupe and `pending_weak`. Mark row-level details as version-specific and snapshot them, not prose.
    - M04 Strict Mode section: add the 19.3 hydration double-invoke.
    - The module depth (~52–97 lines) is far below the "master" bar. Each needs a 4–6× expansion with examples.
  - **(c) Proposed restructure**
    - Keep the 10 existing modules in order (renaming M03 to "State, hooks & closures").
    - Absorb the mechanics moved from TS M09.4/M10.3/M12.2–12.5, as mapped in the TS table.
    - Add M11 (Animation & DOM platform) and M12 (Performance, testing, upgrades & security).
    - Do not split further; depth is the problem, not structure.

---

### SolidJS — `technologies/solidjs`

- **Current stable version(s)**
  - `solid-js` `latest` = **1.9.17** (2026-10-07). Solid 2 is `next` = **2.0.0-rc.19** (2026-10-27); the repo has rc.18 (2026-10-23).
  - The RC cadence is roughly 2–5 days: rc.10 on 2026-09-27, with 34 betas from April to August.
  - Companion packages at rc.19: `@solidjs/signals`, `@solidjs/web` (owns JSX types, SSR, `server-functions`, `frames`, `serialization`, `storage`, `performance-tracks`) and `@solidjs/compiler` ("Solid's native Oxc JSX compiler", native binaries plus wasm).
  - `@solidjs/vite-plugin@3.0.0-next.52` (2026-10-28) **replaces `vite-plugin-solid`** and provides **"start mode"** (`solidPlugin({ start: true, ssr: true })`), "the serving layer that replaces SolidStart". It needs Vite 8/9 and Node ≥22.12.
  - Router for Solid 2: `@solidjs/router@2.0.0-next.43`. `@solidjs/router@1.0.0` (2026-07-28) is for Solid 1.
  - `@solidjs/start@2.1.0` (`latest`) peers on `solid-js ^1.9.15`, so it is **not** the Solid 2 stack.
  - Testing: `@solidjs/testing-library@1.0.0-rc.2` (peer `solid-js >=2.0.0-0`).
  - Ground truth: the `CHEATSHEET.md` shipped inside `solid-js@2.0.0-rc.19`, plus https://github.com/solidjs/solid/tree/next/documentation/solid-2.0 (RFCs, MIGRATION.md). There is no GA date (unverified).
- **Authoritative syllabi used**
  - Solid 2.0 RFCs and MIGRATION.md (link above); the package `CHEATSHEET.md` and `skills/` (`solid-2.0`, `reactivity-diagnostics`); `diagnostics.json` (diagnostic codes).
  - docs.solidjs.com (1.x-era ToC; the 2.0 docs status is unverified).
  - The `@solidjs/vite-plugin` README for start mode, SSR, `observe` builds and performance tracks.
  - No certification exists.
  - Background: Ryan Carniato's reactivity writing; the TC39 Signals proposal (https://github.com/tc39/proposal-signals, Stage 1, unverified current stage).
- **Proposed modules** (10)
  1. **Reactive core**: push-pull graph, glitch freedom, lazy memos/`unobserved`, `equals`, writable derived signals (`createSignal(fn)`), ownership/`createRoot`/`runWithOwner(null)`, microtask batching + `flush()`, "reads update only after flush". Existing M01.
  2. **Effects, lifecycle & invariants**:
     - two-arg `createEffect(compute, apply)` with an `error` arm; effects never compare;
     - `createRenderEffect`, `createTrackedEffect`, `createReaction`;
     - `onSettled` vs `onCleanup`; `onFlush`;
     - **no writes in an owned scope** (`ownedWrite`); no top-level reactive reads;
     - the diagnostics codes (`STRICT_READ_UNTRACKED`, `UNCOMMITTED_INPUT_OVERWRITTEN`, `LOADING_ON_OUTSIDE_HOLD`).
     Split out of existing M01.3.
  3. **Components, props & DOM templating**:
     - props are values (call accessors at the call site); no destructuring; `merge`/`omit`;
     - Oxc compiler output; event handlers bind once;
     - lowercase attributes, boolean presence, `class` object/array form;
     - refs as functions/arrays, directive factories (`applyRef`);
     - form-input binding semantics.
     Existing M02.
  4. **Control flow & composition**: `<For>` three keying modes and their callback shapes; callback bodies are owners, not tracking scopes; `<Repeat>`, `<Show>`/`<Switch>` narrowing; `dynamic()` factory vs `<Dynamic>`; `children()`, `lazy`, `Portal`; context (default-less throws `ContextNotFoundError`; `null` for optional). Split out of existing M02.
  5. **Stores & projections**: draft-first setters, the return-value (shallow) form, `reconcile(data, key)`, `createProjection`/`createStore(fn)` with keyed reconciliation, O(1) selection, `snapshot` vs `deep`, `storePath`. Existing M03.
  6. **Colorless async**:
     - async `createMemo`/`createProjection`; `<Loading>` (+ `on` semantics); `<Reveal>` ordering;
     - `isPending` vs `latest`, `createDeferred`, `from()` for push sources, `resolve()`, `NotReadyError`;
     - cancellation via `onCleanup` before the first await;
     - `<Errored>` self-healing.
     Existing M04.
  7. **Transactions & optimistic state**: `action(function*)` with `yield`; `createOptimistic`/`createOptimisticStore`; `affects`, `refresh` (quiet vs pending); `until(predicate, {timeout, signal})` + `TimeoutError`; race handling. Existing M05.
  8. **Full-stack: start mode, SSR & server functions**:
     - `@solidjs/vite-plugin` start mode; `renderToStream`, streaming, hydration, `clientOnly`, `httpStatus`/`httpHeader`;
     - **request isolation (module-scope state leaks across requests)**;
     - `"use server"`, `GET`/`withMeta`, `getRequestEvent`/`provideRequestEvent`;
     - Standard Schema validation; seroval serialisation; `@solidjs/web/frames` (experimental server components);
     - router 2.0-next.
     Existing M06.
  9. **Testing, debugging & performance (new)**: `createRoot` + `flush` in unit tests; `@solidjs/testing-library` rc; dev vs `observe` vs prod builds (export conditions); `@solidjs/web/performance-tracks` in Chrome DevTools; diagnostics; bundle and hydration cost; multiple-instance detection.
  10. **Migration 1.x→2.0 & architecture deep dives**: the full rename/removal map; React 19 vs Solid 2 execution traces; the O(1) projection proof; real-time sync. Existing M07; add the ecosystem-compatibility status (router, start, UI libs).
- **Gotchas & production failure modes**
  1. `setX(v); x()` returns the **old** value until the microtask flush. Code (and tests) that assume synchronous reads break; call `flush()`.
  2. Passing `count` instead of `count()` as a prop gives the child a function. This is the most common 2.0 bug, per the official cheatsheet.
  3. Destructuring props (`function C({ value })`) freezes reactivity.
  4. Reading an item accessor at the top of a `<For>`/`<Show>` callback freezes it, because the callback body is an owner, not a tracking scope.
  5. Writing a signal inside a memo, effect compute or component body throws in dev. `untrack` does not exempt it (the guard is owner-based).
  6. Event handler expressions bind once: `onClick={cond() ? a : b}` never re-evaluates.
  7. `value={committed()}` on an input combined with another dynamic attribute in the same template overwrites uncommitted typing (`UNCOMMITTED_INPUT_OVERWRITTEN`).
  8. Module-scope stores become **shared cross-request state** once SSR is on, leaking data between users. Create state in a Provider.
  9. `<Loading on={...}>` with the same data also read outside the boundary means the fallback never shows (`LOADING_ON_OUTSIDE_HOLD`).
  10. `isPending` is not 1.x `.loading`: a bare `refresh()` is silent. Use `affects(x); refresh(x)`, or an optimistic "saving" flag.
  11. Async cleanup registered *after* the first `await` never cancels the superseded fetch.
  12. `undefined` in `merge`/setters overrides; it does not skip.
  13. Two copies of `solid-js` (for example `@solidjs/start@2` pulling 1.9 next to 2.0-rc) produce the "Multiple Solid instances" error and dead reactivity. Pin and dedupe.
  14. Installing "SolidStart 2" for a Solid 2 app installs the wrong major. Use `@solidjs/vite-plugin` start mode.
  15. RC churn: APIs changed between rc.x releases (e.g. the 2026-10-06 note on `Loading` re-arm semantics being deferred). Pin exact RC versions, never `^2.0.0-rc`.
  16. A ref runs before attach (`el.isConnected === false`), so measuring layout in a ref gives zeros. Use `onSettled`.
- **Interview hot topics**: fine-grained vs VDOM (and why components run once); push-pull and glitch freedom; ownership and disposal; why props are getters (proxy) and destructuring breaks them; stores as proxies vs immutable updates; async without colouring (vs React Suspense/`use`); transactions and optimistic overlays; SSR request isolation; Solid 1→2 changes and why (deterministic batching); signals standardisation (TC39).
- **Executable-proof strategy**
  - `.mise.toml`: `node = "24"` (≥22.12 required). Pin exact versions: `solid-js@2.0.0-rc.19`, `@solidjs/web@2.0.0-rc.19`, `@solidjs/vite-plugin@3.0.0-next.52`, `vite@8.3.5`, `vitest@5.0.5`, `@solidjs/testing-library@1.0.0-rc.2`, `jsdom@30.1.3`.
  - Core/stores/async: plain Vitest (no DOM) with `createRoot` + `flush()` + `resolve()`; deterministic, because there are no timers. Fake async uses manually resolved deferreds.
  - Diagnostics: tests that use the dev export condition and assert the thrown or warned codes (negative tests).
  - DOM/control flow: testing-library in jsdom.
  - SSR: `renderToString`/`renderToStream` in Node with the server conditions, plus HTML snapshots and a hydrate round-trip in jsdom.
  - Server functions: call the handler from `@solidjs/web/server-functions` directly with a `Request` object (unverified exact entry signature).
  - Start mode end-to-end: `vite build` + `vite preview` + Playwright (slow, so a separate tag).
  - Cannot be proven: stability across future RCs. Fallback: a version-pin assertion test, and a CI job against `solid-js@next` that is allowed to fail.
- **Overlaps / dedupe**
  - Typing goes to **TS M12**.
  - The microtask queue, Proxies, generators (`action(function*)`), AsyncIterables, WeakRef/FinalizationRegistry and the TC39 Signals proposal go to **`languages/javascript`**.
  - The React comparison lives once, here (M10); React cross-links.
  - Panda+Solid integration (`jsxFramework: 'solid'`) lives in Panda; cross-link it.
- **Gap analysis vs existing**
  - **(a) Missing topics**
    - `createDeferred`, `from()`, `latest`, `resolve()`, `NotReadyError`, `<Reveal>` ordering/`collapsed`.
    - The `dynamic()` factory; `clientOnly`, `httpStatus`/`httpHeader`.
    - `createTrackedEffect`, `onFlush`.
    - The `ownedWrite` / no-owned-writes rule and the top-level-read warnings, with the diagnostic codes.
    - The props-as-values rule (stated as the #1 bug by the maintainers); form-input semantics; event handlers bind once.
    - SSR request isolation.
    - Testing (testing-library rc, `flush` in tests); dev/observe/prod export conditions and performance tracks.
    - The `@solidjs/web/storage` and `/serialization` subpaths; router 2.0-next.
    - The package rename to `@solidjs/vite-plugin`; Node ≥22.12.
  - **(b) Outdated or incorrect-looking claims**
    - Headings broadly match rc.19 exports. I verified these exist: `until`, `storePath`, `applyRef` (web), `createReaction`, `deep`, `frames`, `handleServerFunctionRequest`, `withMeta`, `provideRequestEvent`, `Repeat`, `mapArray`.
    - M06 "Vite plugin start mode" is correct, but must name `@solidjs/vite-plugin` (not `vite-plugin-solid`) and warn that `@solidjs/start@2.x` is a Solid **1.9** package.
    - M02 "Oxc/Rust compiler" is correct (`@solidjs/compiler`). Note that `@solidjs/babel-plugin` still exists alongside it.
    - M01 "Render lane vs user lane": terminology not found in the cheatsheet (unverified). Check it against the RFCs.
    - Bump every reference from rc.18 to rc.19 and re-run the examples. Re-check `Loading` re-arm semantics (flagged as pending upstream on 2026-10-06).
    - TS M13 13.5.5 says "polymorphic via `<Dynamic>`". rc.19 makes the `dynamic()` factory canonical and `<Dynamic>` the convenience form.
  - **(c) Proposed restructure**
    - Expand 7 modules to 10. Split M01 into Reactive core and Effects & invariants; split M02 into Components/props/DOM and Control flow & composition.
    - Keep M03–M06 (renumbered 5–8) and add M9 Testing/debugging/perf. M07 becomes M10.
    - Absorb TS M13's runtime material into M1–M8, as mapped in the TS table.

---

### Panda CSS — `technologies/panda-css`

- **Current stable version(s)**
  - `@pandacss/dev` **2.4.0** (2026-10-22). Release history: 2.0.0 on 2026-09-29; 1.0.0 on 2025-08-05; 1.9.0 on 2026-03-08 was the last 1.x on npm `latest` (the repo `main` changelog shows 1.12.1, unverified on npm). The repo's `^0.51` dates from 2024-12-31.
  - v2 architecture: a **Rust (Oxc) compiler** shipped as `@pandacss/compiler` (native binaries, plus `@pandacss/compiler-wasm`). The CLI is published as `@pandacss/cli`. **ESM-only** and **Node ≥22**.
  - `@pandacss/vite@2.4.0` is an inline-compiler Vite plugin, with `transform: true` to rewrite static `css()` calls to class strings at build time.
  - The PostCSS plugin is still supported.
  - MCP server: `@pandacss/mcp`. New `panda doctor`.
  - Upgrade guide: https://panda-css.com/docs/get-started/upgrading-to-v2 (v2 docs: https://panda-css.com, which v2.panda-css.com redirects to).
  - `@park-ui/panda-preset@0.43.1`; its v2 compatibility is unverified.
- **Authoritative syllabi used**
  - panda-css.com v2 docs ToC: Overview, Installation (CLI/PostCSS/framework guides/Storybook/Linting), Using AI (MCP/llms.txt/Agent Skills), Migration (StyleX, Tailwind, Styled Components, Emotion, vanilla-extract, Chakra), Frameworks (including SolidJS), Styling, Recipes, Theming, Design Systems, Reference.
  - W3C Design Tokens Format Module 2025.10 (final CG report, https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/). Whether Panda can import DTCG files is unverified.
  - The existing course is modelled on the official "Panda CSS" video course structure (unverified source).
  - No certification exists.
- **Proposed modules** (12)
  1. **Static CSS-in-JS mental model & v2 architecture**: build-time extraction vs runtime CSS-in-JS; atomic CSS; cascade layers (`reset, base, tokens, recipes, utilities`); the Rust/Oxc pipeline; the runtime `css()` helper vs `transform` mode; RSC/SSR implications (framework-neutral). Existing M01 + 09.1.
  2. **Installation & build integration**: CLI vs PostCSS vs `@pandacss/vite`; **explicit `@pandacss/preset-base` + `preset-panda`**; `styled-system` codegen + `prepare`; ESM-only config; `panda doctor`; `build --clean` after upgrades; TS 7 `noUncheckedSideEffectImports` + the CSS import declaration. Existing M02.1.
  3. **Styling API & conditions**: `css()`, shorthands, pseudo/data/group/peer conditions, custom conditions, responsive object syntax (**array syntax deprecated**), `css.raw()`/`cx()` merging, the `css` prop forwarding pattern. Existing M02.2–2.5.
  4. **Patterns & layout**: built-in patterns, `definePattern`, container queries with **`theme.containers`**, the `linkOverlay` a11y pattern. Existing M03.
  5. **Design tokens & semantic tokens**: token tiers, `defineTokens`/`defineSemanticTokens`, references, opacity modifier, `@property`-backed variables (and `optimize.propertyFallback`), `strictTokens`/`strictPropertyValues`, CSS variable scoping. Existing M08.
  6. **Color mode & theming**: condition-aware semantic tokens, `_osDark`, FOUC-free SSR script; `themes`, multi-brand; text/layer styles; keyframes and motion-safe. Merges existing M04 + M10.
  7. **Recipes (`cva`) & config recipes**: variants, `colorPalette` virtual colors, **compound variants emitted as separate classes (v2)**, `defineRecipe`, `splitVariantProps`, `RecipeVariantProps`, `staticCss` (now rarely needed). Merges existing M05 + M07.1–7.4.
  8. **Slot recipes & recipe contexts**: `sva`, `defineSlotRecipe`, compound components via **`createSlotRecipeContext`/`createRecipeContext`/`withRootProvider`**, headless (Ark/Park) integration. Merges existing M06 + M11.4 + M13.2.
  9. **JSX factory & style props**: `styled`, `jsxStyleProps` modes and their TS cost, `shouldForwardProp`, recipes as JSX. Examples for **both React and Solid** (`jsxFramework: 'solid'`). Existing M11.1–11.3.
  10. **Compiler internals & static-analysis debugging**: v2 extraction rules (named imports, barrels and path aliases resolve; default/namespace imports don't; runtime values never produce CSS); `panda debug`/`analyze`/`--profile`; `cssgen --splitting`; plugins with `hooks` (`config:resolved`, `parser:before`, `codegen:prepare`, `cssgen:done`). Rewrite of existing M13.1 + M07.5 + M08.8.
  11. **Monorepos & shipping a design-system library**: `importMap`, `include` scanning, **`panda lib` / `panda buildinfo`** (replacing `panda ship`/`emit-pkg`), presets via `definePreset`, Turborepo caching. Existing M12 + M10.4.
  12. **Migration & upgrades**: runtime CSS-in-JS (styled-components/Emotion/Stitches) → Panda; Tailwind → Panda; **v1 → v2 upgrade checklist**; the 25-practices catalog rewritten for v2. Existing M09 + M13.4.
- **Gotchas & production failure modes**
  1. In v2, forgetting `@pandacss/preset-base` in `presets` means no utilities, conditions or tokens. It is no longer implicit.
  2. Stale v1 `styled-system/*.mjs` next to v2 `.js` files lets Vite resolve the old file. Run `panda build --clean` once.
  3. `theme.containerSizes` is silently ignored in v2, so `@name/size` container conditions emit nothing. Rename it to `theme.containers`.
  4. Mixing v1 and v2 `@pandacss/*` packages (e.g. an old `@pandacss/postcss`) causes subtle codegen mismatches. They form a fixed version group.
  5. Dynamic values (`css({ color: props.color })`) never produce CSS. Use CSS variables, recipes or `staticCss`.
  6. Default and namespace imports of style helpers are not followed by the v2 extractor, so styles silently disappear. Use named imports.
  7. v2 compound variants no longer replace base properties. Overrides that relied on replacement stop winning.
  8. Border shorthands now sort by breadth, not source order. Use longhands when an override must win.
  9. `@property`-based variables need Safari ≥16.4 / Firefox ≥128. Older browsers render unstyled unless `optimize.propertyFallback: true`.
  10. `jsxStyleProps: 'all'` balloons TS type-check time in large apps. Use `'minimal'`.
  11. Concatenating class strings instead of `css()`/`cx()` merging produces order-dependent atomic conflicts.
  12. Unscoped `include` globs scan `node_modules` or build output, causing slow builds and bloated CSS. Monorepo packages not in `include` lose their styles.
  13. Color-mode FOUC on SSR without a blocking head script.
  14. Overriding a theme key without `extend` replaces only that entry in v2, but `breakpoints` still replace the full set. A partial breakpoint override deletes the others.
  15. `sizes.prose` changed from 65ch to 60ch in v2, a visual regression that only screenshots catch.
- **Interview hot topics**: static vs runtime CSS-in-JS trade-offs (RSC compatibility, runtime cost); atomic CSS and specificity/cascade layers; design-token tiers and semantic tokens for theming; recipe vs slot recipe vs config recipe; what static extraction can and cannot see; type-safety cost of style props; multi-brand theming without a runtime; shipping a design system across a monorepo; comparison with Tailwind v4 and StyleX.
- **Executable-proof strategy**
  - `.mise.toml`: `node = "24"` (≥22 required). Pin `@pandacss/dev@2.4.0` and `@pandacss/vite@2.4.0` exactly, with `vitest@5.0.5`.
  - Codegen/CSS: run `panda codegen` + `panda cssgen` on fixture source files, then snapshot the emitted CSS (deterministic hashing). Negative fixtures assert that runtime-only values and default-import usages produce **no** CSS.
  - `panda doctor --json` and `panda analyze` output are asserted in tests.
  - Type tests: `strictTokens`/`strictPropertyValues` rejections with `@ts-expect-error` under `tsc --noEmit` (TS 7).
  - Recipe behaviour: Vitest asserting class strings from `cva`/`sva`/`splitVariantProps`, without a DOM.
  - Rendering/cascade/color mode/container queries: Playwright (1.64.1) on a `vite preview` build, asserting `getComputedStyle` values. Also include a `transform: true` build check that the runtime chunk is absent.
  - Cannot be proven locally: cross-browser `@property` fallback on old Safari. Fallback: snapshot the fallback declarations emitted with `propertyFallback`.
- **Overlaps / dedupe**
  - CSS fundamentals go to a shared `technologies/css` (or `web-platform`) track, unverified whether it's planned: cascade layers, specificity, custom properties/`@property`, container queries, color spaces, view transitions.
  - Design-token theory (the DTCG spec) can live there too, with Panda cross-linking.
  - The React/Solid component mechanics used in the recipe components live in their own tracks.
  - Typing of generated `styled-system` types belongs to TS M12/M13, cross-linked.
- **Gap analysis vs existing**
  - **(a) Missing topics**
    - The whole v2 architecture and upgrade path.
    - `@pandacss/vite` + `transform`; `panda doctor`, `--profile`, `cssgen --splitting`.
    - Plugins/hooks; MCP/LLM tooling.
    - `@property` variables and browser floor; the v2 extraction rules.
    - Solid examples (the user's primary stack; all existing components are React).
    - Tailwind/StyleX migration.
    - Visual regression testing; CSS bundle-size budgets.
  - **(b) Outdated or incorrect claims vs 2.4.0**
    - M02 installs `^0.51`, needs Node ≥22 and ESM-only. Its array responsive syntax is now deprecated, and `prepare: panda codegen` is still advised.
    - M03.4: container queries must use `theme.containers`.
    - M05.5: compound variants semantics changed.
    - M07.4: `staticCss` is often unnecessary now that imports resolve.
    - M08.2 "Visualizing tokens with Panda Studio": local `panda studio` was removed (Studio is hosted).
    - M08.1/M13.1 "W3C DTCG compliance": unverified; don't claim compliance without a source.
    - M11.4 builds `createStyleContext`, which is **removed in v2**. Use `createSlotRecipeContext`/`createRecipeContext`.
    - M12.2 Strategy 3 "`panda ship`" was replaced by `panda lib`/`buildinfo`. `emit-pkg` is removed; check whether `emitPackage` config is still valid (unverified).
    - M13.1 "Box Evaluation Algorithm", "What Cannot Be Statically Evaluated" and "6 Formal Compiler Lowering Passes": these described the ts-morph/ts-evaluator engine, **replaced by Rust/Oxc in v2**. Rewrite from current source.
    - M13.1 "Debugging with Panda CLI" positional globs: v2 `analyze`/`debug` use the config `include`.
    - M01 is framed around Next.js App Router RSC; v2 is framework-neutral. Keep RSC as one case.
    - Template-literal `css` (if used in M09 migration examples) is removed in v2.
    - The `hooks` config, if mentioned, is now `plugins: [{ hooks }]`.
  - **(c) Proposed restructure** (13 → 12 modules)
    - Merge M04+M10 (color mode + theming), M05+M07 (recipes + config recipes) and M06+M11.4+M13.2 (slot recipes + contexts + headless).
    - Rewrite M13.1 as a standalone "Compiler internals" module (M10). Turn M13.3–13.4 into a v2 best-practices appendix inside M12.
    - Keep M02 (split into install vs styling API), M03, M08, M09 (as migration, plus v1→v2), M11 (JSX; add Solid) and M12.
    - Upgrade the pin to 2.4.0 first; every example must be regenerated.

---

### Planned shared `languages/javascript` — items flagged from these four tracks

- **Event loop & job queues**: macrotask vs microtask, `queueMicrotask`. Basis for Solid's flush batching, React's automatic batching and `act()`.
- **Closures, scope & `this`**: from TS M03.2 and the React stale-closure discussion.
- **Promises/async functions/async iterators/generators**: basis for Solid `action(function*)`, `from(AsyncIterable)` and React `use()`. `AbortController`/`AbortSignal`.
- **Proxies & Reflect**: Solid stores, draft setters, Panda runtime helpers. WeakMap/WeakRef/FinalizationRegistry.
- **Explicit Resource Management runtime semantics** (`using`, `DisposableStack`, `SuppressedError`). Stage-3 decorator runtime semantics, if confirmed shipped.
- **ES2023–ES2026 library**: immutable array methods, Set methods, iterator helpers, `Promise.try`, `RegExp.escape`, `Array.fromAsync`, `Error.isError`, `Math.sumPrecise`, Uint8Array base64/hex. Proposals: `Promise.allKeyed`, `Iterator.zip`/`chunks`. TS 7.1 types these under `es2026`/`esnext`.
- **Modules**: ESM vs CJS, package.json `exports` conditions at runtime (`browser`/`node`/`worker`/`development`/`react-server`/`observe`; Solid and React both rely on condition-based builds), import attributes, source-phase imports.
- **Serialisation**: `structuredClone`, JSON limits, seroval/Flight motivations.
- **Node running TS natively** (type stripping) as runtime behaviour; TS keeps the `erasableSyntaxOnly` typing side.
- **TC39 Signals proposal**: conceptual bridge for Solid (stage unverified).
