# 12 · Performance, Testing, Upgrades & Production Operations

> **Track:** `technologies/react` · **React:** 19.3.1 · **Proofs:** [`examples/12-perf-testing/perf-testing.test.tsx`](../examples/12-perf-testing/perf-testing.test.tsx), [`examples/12-perf-testing/virtual-window.ts`](../examples/12-perf-testing/virtual-window.ts)
>
> **Cross-links.** Core Web Vitals measurement and the browser rendering pipeline: [languages/css](../../../languages/css/README.md); testing theory (pyramid, property-based, mutation testing) is proposed for [languages/javascript](../../../languages/javascript/README.md); bundling and chunking in depth belong to the build tool. Supply-chain security (SBOM, signing, Renovate policies): [technologies/gitlab-ci](../../gitlab-ci/README.md). Monitoring, RUM and alerting: [technologies/observability](../../observability/README.md).

This module turns the mechanics of Modules 01–11 into operational practice: how to **measure** render cost, the handful of techniques that fix most performance problems, how to **test** React code with React Testing Library and `act`, how to **upgrade** from React 18 to 19 (removed APIs), and the patch-level **security hygiene** that the RSC advisories made mandatory. It ends with the version history table for the track.

---

## 1. Measure first

### 1.1 What to measure

| Metric | What it captures | React levers |
|---|---|---|
| **INP** (Interaction to Next Paint) | Latency from input to the next frame | Transitions/deferred values (Module 05), smaller render scope, cheaper layout effects (Module 04) |
| **LCP** (Largest Contentful Paint) | When main content appears | Streaming SSR/RSC (Modules 06–07), preload (Module 11), less JS |
| **CLS** (Cumulative Layout Shift) | Unexpected movement | Reserve space for Suspense fallbacks; avoid "mounted" flags; `browser()` with sized fallbacks |
| Render count / duration per interaction | React work | Profiler, Performance Tracks |
| JS bytes | Download + parse + hydrate | RSC, `lazy`, removing dependencies |

### 1.2 Tools

1. **`<Profiler id onRender>`** — programmatic: `onRender(id, phase, actualDuration, baseDuration, startTime, commitTime)` after each commit of the subtree. `actualDuration` is time spent rendering this commit (memoisation lowers it); `baseDuration` estimates a full re-render without memoisation. Test "onRender reports phase and timings…" sees `mount` then `update`. Profiling in production requires the `react-dom/profiling` build.
2. **React DevTools Profiler** — flame graph per commit, "why did this render?", highlight updates.
3. **Performance Tracks (19.2)** in the Chrome Performance panel: a **Scheduler ⚛** track group (*Blocking*, *Transition*, *Suspense*, *Idle* — the lane groups of Module 05), showing what React worked on, when it was blocked waiting for another priority or for paint; and a **Components ⚛** track showing the component tree being rendered or having effects mounted. In the 19.3.1 dev build they are emitted with `console.timeStamp` into a custom track group. They make "why was this interaction slow?" answerable without DevTools: you see the click's blocking render, the transition that followed, and long effects.
4. **`why-did-you-render`-style tools** — optional; prefer the Profiler.

**Rule:** profile a production build (or the profiling build) with CPU throttling. Development builds do extra work (Strict Mode double renders, warnings, owner stacks) and mislead.

---

## 2. The techniques that matter, in order

1. **Do less work per update: state colocation.** Move state down to where it is used; lift content up as `children` (Module 02 §5). Most "React is slow" reports are an app-level state update re-rendering the whole tree.
2. **Let the React Compiler memoise** (Module 09). It removes most need for `memo`/`useMemo`/`useCallback`.
3. **Stabilise context values / split contexts.** Test "NEGATIVE: an inline context value re-renders every consumer, even under memo" counts 4 renders of a `memo` consumer for 3 unrelated theme toggles; with a memoised value, 1 ("a memoised (stable) value lets unrelated consumers skip"). Put rarely-changing and frequently-changing data in different contexts, or use an external store with selectors (`useSyncExternalStore`, Module 03).
4. **Make big updates non-blocking**: `startTransition`/`useDeferredValue` (Module 05).
5. **Virtualise long lists.** Render only rows that intersect the viewport:

```text
VISIBLE-RANGE(scrollTop, viewport, h, n, k)
  first ← ⌊scrollTop / h⌋
  last  ← ⌈(scrollTop + viewport) / h⌉
  return [max(0, first − k), min(n, last + k))
```

Invariant: every row intersecting `[scrollTop, scrollTop + viewport)` lies in the range, and the range has $O(\text{viewport}/h + 2k)$ rows regardless of $n$. Tests: the worked example (10,000 rows → 26 rendered), a fast-check property for coverage and bounds, and a rendered windowed list mounting 12 of 10,000 rows. Libraries (TanStack Virtual, react-window) add variable heights, measurement and scroll anchoring. CSS `content-visibility: auto` is a cheaper alternative when DOM size, not React work, is the problem.

6. **Split code by route and by heavy widget** with `lazy` + Suspense (§3).
7. **Move work to the server**: RSC for heavy rendering/markdown/data shaping; zero client JS for non-interactive parts (Module 07).
8. **Fix effect cascades** (`set-state-in-effect` lint; Module 04 §7).

---

## 3. Code splitting with `lazy`

```tsx
const Chart = lazy(() => import("./Chart"));   // module level!
<Suspense fallback={<ChartSkeleton />}><Chart /></Suspense>
```

`lazy` returns a component that, on first render, calls the loader, suspends until the module resolves, and caches the result **per `lazy` call** (test "lazy loads the module on first render…": one load). Calling `lazy` inside a component creates a new component type on every render — the subtree remounts and the loader runs again (test "NEGATIVE: lazy() inside a component creates a new type each render": 2 loads).

Operational notes: preload on intent (`onMouseEnter={() => import("./Chart")}`, or `preloadModule`); a chunk that 404s after a deploy rejects the `lazy` promise — catch it with an error boundary and reload once (Module 10 §6); under RSC, client components are split automatically per `"use client"` boundary.

---

## 4. Testing React code

### 4.1 `act`

> **Definition 12.1.** `act(callback)` runs the callback, then flushes all React work it scheduled (renders, effects, resolved Suspense retries) before returning. In an environment with `globalThis.IS_REACT_ACT_ENVIRONMENT = true`, React warns when an update happens outside `act`.

- `act` is exported from **`react`** since 18.3/19. `react-dom/test-utils` now only re-exports a deprecated `act` (test "react-dom/test-utils act is deprecated in favour of React.act"); the rest of `test-utils` (`Simulate`, `renderIntoDocument`, …) was **removed in 19**.
- Use `await act(async () => …)` whenever promises are involved. Test "testing Suspense: render inside an AWAITED act…" records a pitfall observed with React 19.3.1 + RTL 16.3.3: when the initial (synchronous) `render()` suspends, the boundary never revealed after the promise resolved; rendering inside an awaited async `act` fixed it.
- Updates outside `act` warn *"An update to C inside a test was not wrapped in act(...)"* (test "NEGATIVE: updates outside act() in a test warn"). The warning means your assertion may run before React finished.
- The examples in this track set `IS_REACT_ACT_ENVIRONMENT` in [`examples/setup.ts`](../examples/setup.ts) and occasionally leave it to observe production scheduling (Module 03 batching, Module 10 root callbacks).

### 4.2 React Testing Library

RTL renders into jsdom and queries the DOM the way users perceive it:

| Query | When |
|---|---|
| `getByRole(role, { name })` | Default — also tests accessibility |
| `getByLabelText`, `getByText` | Forms, content |
| `queryBy*` | Asserting absence |
| `findBy*` (async) | UI that appears later (polls inside `act`) — test "findBy* waits for async UI; getBy* is synchronous" |

Principles: test behaviour through the DOM, not implementation (no reading state or calling component methods); prefer `@testing-library/user-event` for realistic interactions (this track uses `fireEvent` to keep dependencies minimal); mock at the network boundary (MSW) rather than mocking hooks.

### 4.3 Testing the hard parts

| Feature | Technique | Where in this track |
|---|---|---|
| Suspense / `use` | Controlled promises (`deferred()`), resolve inside `act`, or `findBy*` | Modules 06, 12 |
| Transitions / `isPending` | `await act(async () => startTransition(...))`, assert pending, resolve, assert | Module 05 |
| Actions / forms | Click the submit button inside `act`; control the action's promise | Module 08 |
| Optimistic UI | Assert during the pending window and after settle/fail | Module 08 |
| Error boundaries | Throwing test component; spy on `console.error` | Module 10 |
| SSR / hydration | `renderToString`/stream helpers + `hydrateRoot` + `onRecoverableError` | Module 06 |
| Server Components | Run the server graph in a separate process with `--conditions react-server` | Module 07 |
| Scheduler internals | `scheduler/unstable_mock` | Module 05 |
| Compiler | Transform fixtures + run compiled output | Module 09 |
| Real layout, view transitions, CSP | Playwright (browser) | Module 11 §6 |

---

## 5. Upgrading from React 18 to 19 (and to 19.3)

### 5.1 Removed and changed APIs

All rows marked ✅ are asserted by the "upgrading 18 → 19" tests.

| API | Status in 19 | Replacement | Test |
|---|---|---|---|
| `ReactDOM.render`, `hydrate`, `unmountComponentAtNode` | **Removed** | `createRoot`, `hydrateRoot`, `root.unmount()` | ✅ |
| `ReactDOM.findDOMNode` | **Removed** | Refs, Fragment refs (19.3) | ✅ |
| `unstable_renderSubtreeIntoContainer` | Removed | Portals | ✅ |
| `React.createFactory` | Removed | JSX | ✅ |
| `React.PropTypes` (long gone) / `propTypes` checks | `propTypes` **silently ignored** | TypeScript, runtime schemas at boundaries | ✅ |
| `defaultProps` on function components | **Ignored** | ES default parameters | ✅ (classes still support it ✅) |
| String refs | **Removed** (throws) | Callback/object refs | ✅ |
| Legacy context (`contextTypes`, `getChildContext`) | Removed | `createContext` | — |
| `react-dom/test-utils` | Only deprecated `act` remains | `React.act`, RTL | ✅ |
| `react-test-renderer` | Deprecated | RTL | — |
| `element.ref` | Removed (warning getter) | `element.props.ref` | Module 01 |
| `forwardRef` | Works, unnecessary | `ref` as a prop | Module 01 |
| `<Context.Provider>` | Works | `<Context value>` | Module 03 |
| `renderToNodeStream` | Removed | `renderToPipeableStream` | Module 06 |
| `useFormState` (canary) | Renamed | `useActionState` | Module 08 |
| UMD builds | Removed | ESM CDNs | — |

Behaviour changes to retest: errors are no longer re-thrown (root callbacks, Module 10); Strict Mode reuses memoised results on the second render; `useRef` requires an argument in `@types/react` 19; ref callbacks may return cleanups (TypeScript rejects implicit returns, Module 04); JSX namespace typing moved to `React.JSX` (TS M12).

### 5.2 Minor-version changes that bite (19.x)

| Version | Change | Module |
|---|---|---|
| 19.1 | `useId` format `«r»` | 06 |
| 19.2 | `useId` `_r_`; batched SSR reveals; `<Activity>`, `useEffectEvent`, `cacheSignal`, PPR APIs, Performance Tracks; eslint-plugin-react-hooks v6 flat config | 04–06 |
| 19.3 | Untangled transitions; Strict Mode effects on hydration; conditional-`use` warning; errors don't escape hidden `<Activity>`; `onReset` on automatic form reset; `<ViewTransition>`, Fragment refs, `browser()`, Trusted Types, Context in Server Components stable | 03–11 |

### 5.3 Migration procedure

1. Upgrade to **18.3** first: it adds deprecation warnings for everything removed in 19. Fix them.
2. Run the [React 19 codemods](https://github.com/reactjs/react-codemod) (`npx codemod@latest react/19/migration-recipe`): replace `ReactDOM.render`, string refs, `act` imports, `useFormState`, `forwardRef` removal (optional).
3. Upgrade `react`, `react-dom`, `react-server-dom-*` (if any), `@types/react`, `@types/react-dom` **together, pinned to the same version** (Module 01 §7.3).
4. Run the test suite under `<StrictMode>`; fix effect cleanups exposed by the 19.3 hydration double-invoke.
5. Replace `defaultProps` on function components with default parameters (search: `\.defaultProps\s*=`).
6. Check dependencies that use removed APIs (`findDOMNode` in old drag-and-drop/animation libraries; `react-test-renderer`).
7. Enable the `react-hooks` 7 lint preset; then consider the Compiler (Module 09).
8. Add the security version gate (§6).

---

## 6. Patch-level security hygiene

The 2025–2026 RSC advisories (Module 07 §7) changed the operational stance for React from "upgrade by minor when convenient" to "**patch within days**" for any app with a React server:

1. **Know your exposure.** Any app with React Server Components (Next.js App Router, React Router RSC, Waku, Parcel RSC, `@vitejs/plugin-rsc`) runs the Flight reply decoder — whether or not you wrote Server Functions.
2. **Keep the lockstep.** `react`, `react-dom` and `react-server-dom-*` on the same exact version; frameworks that vendor React (Next.js) are upgraded as a unit.
3. **Automate.** Renovate/Dependabot for React packages and the framework, with security updates auto-merged when CI is green.
4. **Gate in CI.** A test that fails when the installed `react-server-dom-*` is below the patched floor of its line (this track's Module 07 gate: 19.0.8 / 19.1.9 / 19.2.8 / any 19.3).
5. **Subscribe** to the React blog security posts and GitHub advisories for `facebook/react` → `react/react`.
6. **Defence in depth** for Server Functions: authN/authZ/validation (Module 07 §6.1), request body size limits, rate limits, timeouts.
7. **Client-side:** CSP + Trusted Types (19.3, Module 11 §5); never `dangerouslySetInnerHTML` unsanitised input; React's `javascript:` URL blocking is a backstop, not a policy (Module 01).

---

## 7. Version history (practitioner view)

| Version | Date | What practitioners should know |
|---|---|---|
| 16.0 | 2017-09 | **Fiber** reconciler; error boundaries; fragments; portals |
| 16.3 | 2018-03 | New context API, `createRef`, `forwardRef`; string refs deprecated |
| 16.6 | 2018-10 | `memo`, `lazy`, `<Suspense>` for code splitting |
| 16.8 | 2019-02 | **Hooks** |
| 17.0 | 2020-10 | New JSX transform; event delegation to the root container; no new features |
| 18.0 | 2022-03 | **Concurrent root** (`createRoot`), automatic batching, transitions, `useId`, `useSyncExternalStore`, streaming SSR with Suspense, selective hydration |
| 18.3 | 2024-04 | Deprecation warnings for 19 removals |
| 19.0 | 2024-12-05 | Actions, `useActionState`, `useOptimistic`, `useFormStatus`, `use`, ref as prop + ref cleanups, `<Context>` provider, metadata/stylesheet hoisting, resource APIs, RSC stable for frameworks, root error callbacks, removed legacy APIs |
| 19.1 | 2025-03-28 | Owner stacks, Suspense fixes, `useId` `«r»` |
| 19.2 | 2025-10-01 | `<Activity>`, `useEffectEvent`, `cacheSignal`, Performance Tracks, partial pre-rendering, batched SSR reveals, Web Streams on Node, `useId` `_r_`; eslint-plugin-react-hooks v6 |
| — | 2025-10-07 | **React Compiler 1.0** |
| 19.0.1/19.1.2/19.2.1 | 2025-12-03 | **CVE-2025-55182** RSC RCE fix; DoS/source-exposure follow-ups through 2026 (Module 07) |
| — | 2026-02-24 | React moves to the **React Foundation** (Linux Foundation) |
| 19.3 | 2026-09-09 | Stable `<ViewTransition>`, `addTransitionType`, Fragment refs, `browser()`, Trusted Types, Context in Server Components, **untangled transitions**, Strict Mode on hydration, conditional-`use` warning |
| 19.3.1 | 2026-10-14 | Current stable (this track); backports 19.2.9 / 19.1.10 / 19.0.9 the same day |

Dates of the 19.x releases are from the npm registry; earlier ones from the React blog.

---

## 8. Production failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Whole page re-renders on each keystroke | State too high; inline context value | Colocate; memoise/split context; Compiler |
| Long list scroll jank | Thousands of mounted rows | Virtualise; `content-visibility` |
| Big initial bundle | No route/widget splitting; client-only rendering of static content | `lazy`; RSC |
| "Loading chunk failed" after deploys | Old chunks deleted while sessions are open | Error boundary + one-time reload; keep old assets for a while |
| Flaky tests with "not wrapped in act" | Assertions before React flushed | `await act`, `findBy*` |
| Suspense test never reveals | Initial `render()` suspended inside a sync `act` | Render inside `await act(async …)` |
| App crashes after upgrading to 19 | Library uses `findDOMNode`/`ReactDOM.render`/string refs | Upgrade or replace the library |
| Function component defaults vanished after upgrade | `defaultProps` ignored in 19 | Default parameters |
| RSC app vulnerable months after a fix | No patch automation | §6 |
| Profiling numbers don't match production | Profiling a dev build | Profile production/profiling build with throttling |

---

## 9. Executable proofs

| Claim | Test (`perf-testing.test.tsx`) |
|---|---|
| Profiler phases and timings | "onRender reports phase and timings…" |
| Context identity cost and the fix | "NEGATIVE: an inline context value…", "a memoised (stable) value…" |
| Windowing algorithm (example, property, rendered list) | "list virtualisation…" (3 tests) |
| `lazy` caching and the inline-`lazy` anti-pattern | "code splitting with lazy()" (2 tests) |
| RTL async queries; Suspense testing with awaited `act`; act warnings; test-utils deprecation | "testing with React Testing Library and act" (4 tests) |
| Removed APIs and ignored `propTypes`/`defaultProps`; string refs throw | "upgrading 18 → 19: removed APIs" (5 tests) |

---

## 10. Interview Drill

<details><summary><strong>1. A page is slow when typing in a search box. How do you diagnose and fix it?</strong></summary>

Profile a production build with the React Profiler/Performance Tracks to see what renders per keystroke. Typical fixes in order: colocate the input state so only the search area re-renders; let the Compiler (or `memo`) skip unchanged subtrees; render results with `useDeferredValue` so typing stays urgent; virtualise the result list; debounce network requests.
</details>

<details><summary><strong>2. Why can a context make <code>memo</code> useless, and how do you fix it?</strong></summary>

Context consumers re-render whenever the provider value changes identity, regardless of `memo`. An inline object value changes identity on every provider render. Memoise the value, split fast- and slow-changing data into separate contexts, or use an external store with selector subscriptions.
</details>

<details><summary><strong>3. What does <code>act</code> do and when do you need the async form?</strong></summary>

It runs the callback and flushes all React work it caused (renders, effects, Suspense retries) before returning, so assertions see a settled UI. Use `await act(async () => …)` whenever promises, Suspense, transitions or actions are involved. RTL's `render`, `fireEvent` and `findBy*` wrap act for you, but async React work still needs awaiting.
</details>

<details><summary><strong>4. List the APIs removed in React 19 that most often break upgrades.</strong></summary>

`ReactDOM.render`/`hydrate`/`unmountComponentAtNode`, `findDOMNode`, string refs, legacy context, `createFactory`, `defaultProps` on function components (ignored), `propTypes` checks (ignored), most of `react-dom/test-utils`, `renderToNodeStream`, UMD builds.
</details>

<details><summary><strong>5. How do you split code in React and what are the pitfalls?</strong></summary>

`lazy(() => import(...))` at module level plus a Suspense boundary, by route and heavy widget; RSC splits client code per `"use client"` boundary automatically. Pitfalls: `lazy` inside a component (remount and reload every render), missing error boundaries for chunk-load failures after deploys, and waterfalls when a lazy component also fetches data — preload on intent.
</details>

<details><summary><strong>6. What are Performance Tracks?</strong></summary>

Since React 19.2, custom tracks in the Chrome Performance panel: a Scheduler track group showing React work by priority (blocking, transition, suspense, idle) and when it waits, and a Components track showing which components render or mount effects. They connect an interaction to the React work it caused.
</details>

<details><summary><strong>7. How do you keep a React Server Components app secure operationally?</strong></summary>

Patch quickly (automated updates, security PRs auto-merged on green CI), keep `react`/`react-dom`/`react-server-dom-*` in lockstep, gate CI on the patched floor, harden Server Functions (auth, authorisation, validation, size/rate limits, timeouts), and use CSP/Trusted Types on the client.
</details>

<details><summary><strong>8. How does list virtualisation work?</strong></summary>

Compute which rows intersect the viewport from the scroll offset and row heights, render only those plus an overscan margin, and position them with padding/transforms inside a full-height container. Work and DOM size become proportional to the viewport, not the list length; variable heights need measurement and scroll anchoring.
</details>
