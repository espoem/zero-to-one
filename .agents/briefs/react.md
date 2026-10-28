# Brief: React (`technologies/react`)

| | |
|---|---|
| Phase | 1 |
| Kind | EXISTING track: restructure and update in place, keeping tests green throughout |
| Primary (author) | **Opus · claude.ai** |
| Drafter (on request) | pi · DeepSeek |
| Challenger | pi · Muse Spark 1.3 |
| Verifier | Antigravity |
| Final gate | Opus (claude.ai session) |
| Branch / worktree | `track/react` · `../zto-react` |
| Depends on | none (can start now) |
| Research dossier | `.agents/research/A-frontend.md` |

## 0. Read before starting (binding)
1. `AGENTS.md`: the contract. If it conflicts with this brief, AGENTS.md wins; log the conflict in your review file.
2. `.agents/OWNERSHIP.md`: what you own vs only cross-link.
3. `.agents/REVIEW.md`: the checklist your work is judged against.
4. Your global/agent instructions still apply where they do not conflict.

## 1. Owner decisions and track-specific instructions
- Expand every existing module from ~70 lines to full depth (rule of thumb: 400–900 lines). Add the two new modules from the dossier.
- Merge in the framework mechanics handed over from TypeScript modules 09–13 (see `.agents/reviews/typescript.md` § Handover once it exists).
- Cover React 19.2/19.3 (Activity, useEffectEvent, cacheSignal, ViewTransition, Fragment refs, partial prerender), React Compiler 1.0, and the Dec-2025 RSC RCE (CVE-2025-55182) with a "Then vs now" for pre-patch RSC setups.
- Add the missing `mise.lock`.
- Teach the **latest stable** versions. Add **Then vs now** comparisons wherever practice changed (AGENTS.md § Version Currency).
- Pin **all** tooling via mise (`.mise.toml` + `mise.lock`): node 26 for JS/TS, plus every CLI and runtime the examples need.

## 2. Ownership
**You own (full treatment):**
- Fiber, lanes, Suspense, RSC/Flight, Actions, React Compiler

**Cross-link only (do not re-explain):**
- Types & coercion, scope/closures/`this`, prototypes/classes → owned by `languages/javascript`
- Iterators, generators, async iteration, Promise/job-queue semantics (spec level) → owned by `languages/javascript`
- ESM semantics (Module Records, live bindings, TLA), `exports` conditions at runtime → owned by `languages/javascript`
- HTML event loop & rendering steps (task → microtasks → rAF → style/layout/paint) → owned by `languages/javascript`
- `structuredClone`, serialisation limits → owned by `languages/javascript`
- Typing JSX, components, hooks, generic/polymorphic components → owned by `languages/typescript` (M12)
- Standard Schema, Zod typing of runtime boundaries → owned by `languages/typescript` (M11)
- View transitions, scroll-driven animations, top layer → owned by `languages/css`
- Rendering pipeline internals (style → layout → paint → composite, reflow triggers) → owned by `languages/css`
- React vs Solid mental-model comparison (written once) → owned by `technologies/solidjs` (M10)
- HTTP/1.1, HTTP/2, HTTP/3, WebSockets, gRPC, HTTP caching (RFC 9111), CDNs, L4/L7 load balancing → owned by `architecture/networking`

## 3. Research dossier (verified 2026-10-27/28; re-verify before use)

#### React — `technologies/react`

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

## 4. Re-verify list
These claims were marked unverified during research. Confirm or correct each one against a primary source before teaching it:
- `@types/react@19.3.0`. Canary is 19.3.0-canary; nothing 19.4/20 has been announced (unverified beyond the npm dist-tags).
- Meta Front-End Developer Professional Certificate on Coursera (unverified current syllabus).
- Reconciler/hooks/effects/transitions: `act()` + RTL in jsdom. Deterministic scheduling via `act` and the `scheduler/unstable_mock` build (unverified that it still ships in 19.3).
- RSC/Flight: a separate Vitest project run with `--conditions react-server`, using `react-server-dom-webpack/server` + `/client` to round-trip a tree and snapshot Flight rows (unverified feasibility without a bundler; fallback `@vitejs/plugin-rsc`).
- HTTP caching, streaming and CSP/Trusted Types theory belong to a web-platform/security track (`technologies/web-platform`, unverified track name).

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
1. **Primary (Opus)** works on branch `track/react` and sets this track's row in `.agents/STATUS.md` to 🟦.
2. **Verify versions first.** Check every version in the dossier against its primary source today. Record the results in the README's `Verified against …` line. Resolve every item in the re-verify list below.
3. Build in stages: README syllabus + exam matrix → modules one by one, each with its examples/tests → glossary → cheatsheet → question banks → mock exam. Delegate bulk drafting (question-bank drafts, glossary candidates, cheatsheet tables) to the **Drafter**, then correct and integrate it yourself.
4. Before each commit: run `mise exec -- npm test` and `npm run typecheck` (or the equivalents), and `test:integration` if present. Commit with Conventional Commits scoped `(react)`.
5. Self-check against `.agents/REVIEW.md`. Then set STATUS to 🟨 and write the hand-off at the top of `.agents/reviews/react.md`:
   - what was done;
   - what was not done, and why;
   - every claim you are least sure of.
6. The **Challenger** attacks it and the **Verifier** checks it independently. Both record findings in `.agents/reviews/react.md` (prompts in `.agents/KICKOFF.md`). The primary resolves the findings (🟧), Opus runs the final gate (🟪), and the owner merges (✅).
