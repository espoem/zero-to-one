# Brief: SolidJS (`technologies/solidjs`)

| | |
|---|---|
| Phase | 1 |
| Kind | EXISTING track: restructure and update in place, keeping tests green throughout |
| Primary (author) | **Opus · claude.ai** |
| Drafter (on request) | pi · DeepSeek |
| Challenger | pi · Muse Spark 1.3 |
| Verifier | Antigravity |
| Final gate | Opus (claude.ai session) |
| Branch / worktree | `track/solidjs` · `../zto-solidjs` |
| Depends on | none (can start now) |
| Research dossier | `.agents/research/A-frontend.md` |

## 0. Read before starting (binding)
1. `AGENTS.md`: the contract. If it conflicts with this brief, AGENTS.md wins; log the conflict in your review file.
2. `.agents/OWNERSHIP.md`: what you own vs only cross-link.
3. `.agents/REVIEW.md`: the checklist your work is judged against.
4. Your global/agent instructions still apply where they do not conflict.

## 1. Owner decisions and track-specific instructions
- Bump to the latest Solid 2 RC (rc.19 at research time; re-check). Fix the README, which still says rc.8.
- Start mode lives in `@solidjs/vite-plugin`. Warn that `@solidjs/start` 2.x targets Solid 1.9.
- Merge in the Solid content handed over from TypeScript module 13. Grow to the 10-module structure in the dossier. Write the React-vs-Solid comparison here, once (react links to it).
- Keep a "Solid 1.x → 2.0" Then-vs-now module (the existing module 07 is the base).
- Teach the **latest stable** versions. Add **Then vs now** comparisons wherever practice changed (AGENTS.md § Version Currency).
- Pin **all** tooling via mise (`.mise.toml` + `mise.lock`): node 26 for JS/TS, plus every CLI and runtime the examples need.

## 2. Ownership
**You own (full treatment):**
- Signals graph, push-pull, stores/projections, colorless async, start mode
- React vs Solid mental-model comparison (written once)

**Cross-link only (do not re-explain):**
- Types & coercion, scope/closures/`this`, prototypes/classes → owned by `languages/javascript`
- Iterators, generators, async iteration, Promise/job-queue semantics (spec level) → owned by `languages/javascript`
- ESM semantics (Module Records, live bindings, TLA), `exports` conditions at runtime → owned by `languages/javascript`
- Proxy/Reflect, WeakRef/FinalizationRegistry → owned by `languages/javascript`
- HTML event loop & rendering steps (task → microtasks → rAF → style/layout/paint) → owned by `languages/javascript`
- `structuredClone`, serialisation limits → owned by `languages/javascript`
- Typing JSX, components, hooks, generic/polymorphic components → owned by `languages/typescript` (M12)
- Standard Schema, Zod typing of runtime boundaries → owned by `languages/typescript` (M11)
- View transitions, scroll-driven animations, top layer → owned by `languages/css`
- Rendering pipeline internals (style → layout → paint → composite, reflow triggers) → owned by `languages/css`
- HTTP/1.1, HTTP/2, HTTP/3, WebSockets, gRPC, HTTP caching (RFC 9111), CDNs, L4/L7 load balancing → owned by `architecture/networking`

## 3. Research dossier (verified 2026-10-27/28; re-verify before use)

#### SolidJS — `technologies/solidjs`

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

## 4. Re-verify list
These claims were marked unverified during research. Confirm or correct each one against a primary source before teaching it:
- Ground truth: the `CHEATSHEET.md` shipped inside `solid-js@2.0.0-rc.19`, plus https://github.com/solidjs/solid/tree/next/documentation/solid-2.0 (RFCs, MIGRATION.md). There is no GA date (unverified).
- docs.solidjs.com (1.x-era ToC; the 2.0 docs status is unverified).
- Background: Ryan Carniato's reactivity writing; the TC39 Signals proposal (https://github.com/tc39/proposal-signals, Stage 1, unverified current stage).
- Server functions: call the handler from `@solidjs/web/server-functions` directly with a `Request` object (unverified exact entry signature).
- M01 "Render lane vs user lane": terminology not found in the cheatsheet (unverified). Check it against the RFCs.

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
1. **Primary (Opus)** works on branch `track/solidjs` and sets this track's row in `.agents/STATUS.md` to 🟦.
2. **Verify versions first.** Check every version in the dossier against its primary source today. Record the results in the README's `Verified against …` line. Resolve every item in the re-verify list below.
3. Build in stages: README syllabus + exam matrix → modules one by one, each with its examples/tests → glossary → cheatsheet → question banks → mock exam. Delegate bulk drafting (question-bank drafts, glossary candidates, cheatsheet tables) to the **Drafter**, then correct and integrate it yourself.
4. Before each commit: run `mise exec -- npm test` and `npm run typecheck` (or the equivalents), and `test:integration` if present. Commit with Conventional Commits scoped `(solidjs)`.
5. Self-check against `.agents/REVIEW.md`. Then set STATUS to 🟨 and write the hand-off at the top of `.agents/reviews/solidjs.md`:
   - what was done;
   - what was not done, and why;
   - every claim you are least sure of.
6. The **Challenger** attacks it and the **Verifier** checks it independently. Both record findings in `.agents/reviews/solidjs.md` (prompts in `.agents/KICKOFF.md`). The primary resolves the findings (🟧), Opus runs the final gate (🟪), and the owner merges (✅).
