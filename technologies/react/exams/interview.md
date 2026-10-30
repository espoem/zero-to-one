# Senior React Interview — Question Bank

Original questions written for this track (no exam content reproduced). Format per AGENTS.md: `Q-<EXAM>-<NNN> · domain · difficulty 1–3 · type`. `EXAM` = `RI` (React interview). Difficulty 3 questions are deliberately harder than a typical interview. Answers state the React version when behaviour is version-specific (track: 19.3.1). Domain weights: [exams/README.md](README.md).

Contents: [D1](#d1-rendering-model--reconciliation) · [D2](#d2-state-hooks--effects) · [D3](#d3-concurrency--suspense) · [D4](#d4-ssr-streaming--hydration) · [D5](#d5-server-components-server-functions--security) · [D6](#d6-actions--forms) · [D7](#d7-performance--the-react-compiler) · [D8](#d8-errors-testing--upgrades) · [D9](#d9-dom-platform-integration) · [Mock interview](#mock-interview)

---

## D1 Rendering model & reconciliation

### Q-RI-001 · D1 · difficulty 1 · single
What does `const el = <Chart data={d} />;` do at runtime?
- A) Calls `Chart(d)` and stores its output
- B) Creates a plain element object describing `Chart` with props; `Chart` runs only if React renders `el`
- C) Mounts `Chart` into a detached fiber
- D) Schedules `Chart` to render in the next microtask
<details><summary>Answer</summary>

**B.** JSX lowers to `jsx(Chart, { data: d })`, an immutable description. Components run during reconciliation.
- Why not A: creating ≠ rendering; calling components directly breaks hooks.
- Why not C: fibers are created by the reconciler when the element is rendered at a position.
- Why not D: no scheduling happens at element creation.
- Ref: [modules/01-elements-jsx-and-render-model.md](../modules/01-elements-jsx-and-render-model.md), https://react.dev/learn/render-and-commit
</details>

### Q-RI-002 · D1 · difficulty 2 · single
Why can a JSON payload never be rendered as a forged React element?
- A) React sanitises all objects before rendering
- B) Elements carry `$$typeof: Symbol.for('react.transitional.element')`, and Symbols cannot be represented in JSON
- C) `JSON.parse` freezes objects
- D) React only renders objects created by `createElement` in the same module
<details><summary>Answer</summary>

**B.** The brand check rejects parsed objects ("Objects are not valid as a React child").
- Why not A: React does not sanitise arbitrary objects; it rejects them.
- Why not C: freezing is irrelevant to the brand.
- Why not D: elements from any module (or a library) are valid if branded.
- Ref: [modules/01 §3.2](../modules/01-elements-jsx-and-render-model.md), https://react.dev/reference/react/isValidElement
</details>

### Q-RI-003 · D1 · difficulty 2 · multi
Which changes destroy the state of `<Counter />` rendered at a given position? (Select all.)
- A) Its parent re-renders with different props for `Counter`
- B) Its `key` changes
- C) The wrapping element changes from `<div>` to `<section>`
- D) `Counter` is defined inside the parent component's body
- E) The parent switches between `cond ? <Counter label="a"/> : <Counter label="b"/>`
<details><summary>Answer</summary>

**B, C, D.** Identity is position + type + key. A key change or an ancestor type change remounts; a component defined inside render is a new type each render.
- Why not A: same type at the same position keeps state.
- Why not E: both branches put the same type in the same slot, so state is kept (tested in M02).
- Ref: [modules/02 §4](../modules/02-fiber-reconciler-and-commit.md), https://react.dev/learn/preserving-and-resetting-state
</details>

### Q-RI-004 · D1 · difficulty 3 · scenario
A keyed list `[a,b,c,d,e]` is re-rendered as `[e,a,b,c,d]`. How many DOM placement operations does React 19 perform for existing rows, and why?
- A) 1 — React moves `e` only
- B) 4 — `e` stays (its old index becomes `lastPlacedIndex`), so `a`–`d` all have smaller old indices and are moved
- C) 5 — React re-inserts every row on any reorder
- D) 0 — React reorders fibers, not DOM nodes
<details><summary>Answer</summary>

**B.** React's two-pass algorithm keeps a greedy increasing subsequence via `lastPlacedIndex`; moving the last item to the front makes every other item "move". Moving the first item to the end costs 1. The model and the real DOM counts are tested.
- Why not A: that is the minimum (LIS), which React does not compute.
- Why not C: unmoved keyed rows are reused in place.
- Why not D: fiber order must be reflected in the DOM with `insertBefore`.
- Ref: [modules/02 §4.3](../modules/02-fiber-reconciler-and-commit.md), [examples/02-fiber/keyed-diff.ts](../examples/02-fiber/keyed-diff.ts)
</details>

### Q-RI-005 · D1 · difficulty 1 · single
Under `<StrictMode>` in development, a component's `console.log` prints twice per render. What is the correct reaction?
- A) Remove Strict Mode in production builds
- B) Use a ref to log only on the first call
- C) Nothing, if render is pure; fix any visible effect of the second call
- D) Wrap the component in `memo`
<details><summary>Answer</summary>

**C.** Strict Mode double-invokes render to expose impurity; it does nothing in production.
- Why not A: Strict Mode is dev-only already.
- Why not B: detecting the second call hides real impurity.
- Why not D: `memo` is about props; it does not stop the double render.
- Ref: [modules/01 §5](../modules/01-elements-jsx-and-render-model.md), https://react.dev/reference/react/StrictMode
</details>

### Q-RI-006 · D1 · difficulty 2 · ordering
Order the commit sub-phases for one commit.
1. Layout effects run and refs are attached
2. DOM mutations; insertion effects; layout-effect cleanups
3. `root.current` is switched to the finished tree
4. Before-mutation (snapshots, `getSnapshotBeforeUpdate`)
5. Passive effects (usually after paint)
<details><summary>Answer</summary>

**4 → 2 → 3 → 1 → 5.** Mutation completes before the tree swap; layout effects see the new DOM and the new current tree; passive effects are deferred.
- Ref: [modules/02 §6](../modules/02-fiber-reconciler-and-commit.md)
</details>

### Q-RI-007 · D1 · difficulty 2 · single
`<Parent><Child /></Parent>` — `Parent` updates its own state. `Child` is not memoised. Does `Child` re-render?
- A) Yes, all children always re-render
- B) No: the `<Child />` element was created by the grandparent; its props object is identical, so React bails out
- C) Only if `Parent` passes new props
- D) Only in concurrent mode
<details><summary>Answer</summary>

**B.** Same element reference ⇒ `oldProps === newProps` ⇒ bailout. This "children as props" pattern is tested in M02.
- Why not A: the bailout applies without `memo`.
- Why not C: `Parent` cannot change props of an element it did not create.
- Why not D: the bailout is independent of the lane.
- Ref: [modules/02 §5](../modules/02-fiber-reconciler-and-commit.md)
</details>

### Q-RI-008 · D1 · difficulty 3 · single
A library you depend on ships its own copy of React 18 and returns elements you render in your React 19 app. What happens?
- A) Works, with a deprecation warning
- B) React 19 throws "A React Element from an older version of React was rendered"
- C) The elements render but hooks inside them fail silently
- D) React 19 converts them automatically
<details><summary>Answer</summary>

**B.** React 19 changed the brand to `react.transitional.element` and detects the old `react.element` symbol. Two React copies also break hooks ("Invalid hook call"). Fix the dependency graph (peer dependency, dedupe).
- Why not A/D: React performs no conversion and the brand mismatch is a hard error. Why not C: the render throws before hooks would run.
- Ref: [modules/01 §3.3](../modules/01-elements-jsx-and-render-model.md)
</details>

---

## D2 State, hooks & effects

### Q-RI-009 · D2 · difficulty 1 · single
`onClick={() => { setN(n + 1); setN(n + 1); setN(n + 1); }}` with `n = 0`. Next render shows?
- A) 3
- B) 1
- C) 0
- D) It depends on batching
<details><summary>Answer</summary>

**B.** All three updates read the same snapshot `n = 0`. Use `setN(x => x + 1)` to compose.
- Why not A: that requires functional updaters.
- Why not C: the update is applied.
- Why not D: batching affects render count, not the value.
- Ref: [modules/03 §1](../modules/03-state-hooks-and-closures.md), https://react.dev/learn/queueing-a-series-of-state-updates
</details>

### Q-RI-010 · D2 · difficulty 2 · single
Why must hooks be called in the same order on every render?
- A) Because hooks are identified by their variable names
- B) Because hook state is a linked list on the fiber matched to calls by position
- C) Because the compiler sorts hooks alphabetically
- D) Because effects run in declaration order
<details><summary>Answer</summary>

**B.** React walks the previous hook list in lockstep; a skipped or extra call shifts state ("Rendered more/fewer hooks…").
- Why not A: there are no names at runtime.
- Why not C: nonsense.
- Why not D: effect order is a consequence, not the reason.
- Ref: [modules/03 §2](../modules/03-state-hooks-and-closures.md)
</details>

### Q-RI-011 · D2 · difficulty 2 · multi
In React 19 with `createRoot`, which are batched into a single render? (Select all.)
- A) Two `setState` calls in a click handler
- B) Two `setState` calls inside a `setTimeout`
- C) Two `setState` calls after `await fetch()` in a handler
- D) Two `setState` calls each wrapped in its own `flushSync`
<details><summary>Answer</summary>

**A, B, C.** Automatic batching (18+) applies everywhere; `flushSync` opts out.
- Why not D: each `flushSync` commits synchronously.
- Ref: [modules/03 §4](../modules/03-state-hooks-and-closures.md)
</details>

### Q-RI-012 · D2 · difficulty 3 · scenario
`n = 0`. A transition enqueues `n => n + 10`; before it renders, a click enqueues `n => n * 2`. What do the urgent render and the final render show?
- A) 0, then 20
- B) 0, then 10
- C) 20, then 20
- D) 10, then 20
<details><summary>Answer</summary>

**A.** The urgent render skips the transition update (keeping it in the base queue) and applies `*2` to 0. The transition render rebases: `(0 + 10) * 2 = 20`. Updaters must be pure because they can run more than once.
- Why not B: the transition's update is replayed before `*2`, not dropped. Why not C/D: the urgent render must not include the transition's update.
- Ref: [modules/03 §3.3](../modules/03-state-hooks-and-closures.md)
</details>

### Q-RI-013 · D2 · difficulty 2 · single
What does `useSyncExternalStore` do when a store changes during a concurrent render?
- A) Ignores it until the next render
- B) Detects the inconsistent snapshot before commit and re-renders synchronously
- C) Merges both versions
- D) Throws an error
<details><summary>Answer</summary>

**B.** It re-reads snapshots before committing a concurrent render; a mismatch triggers a synchronous re-render, so the UI never tears (tested: `011` vs `111`).
- Ref: [modules/03 §7](../modules/03-state-hooks-and-closures.md), https://react.dev/reference/react/useSyncExternalStore
</details>

### Q-RI-014 · D2 · difficulty 2 · single
`useSyncExternalStore(subscribe, () => ({ count: store.count }))` crashes with "Maximum update depth exceeded". Why?
- A) `subscribe` is not stable
- B) `getSnapshot` returns a new object each call, so every consistency check sees a change
- C) The store is mutable
- D) Missing `getServerSnapshot`
<details><summary>Answer</summary>

**B.** Snapshots are compared with `Object.is`; return a cached/immutable snapshot.
- Why not A: an unstable `subscribe` resubscribes each render but does not loop.
- Why not C: mutability is fine if snapshots are versioned.
- Why not D: that matters only for SSR.
- Ref: [modules/03 §7.3](../modules/03-state-hooks-and-closures.md)
</details>

### Q-RI-015 · D2 · difficulty 1 · ordering
Order the events for a parent `P` with a child `C`, both using `useLayoutEffect` and `useEffect`, on mount.
1. P layout effect
2. C render
3. C passive effect
4. P render
5. C layout effect
6. P passive effect
<details><summary>Answer</summary>

**4 → 2 → 5 → 1 → 3 → 6.** Render top-down; effects bottom-up per phase.
- Ref: [modules/04 §2.1](../modules/04-effects-and-synchronization.md)
</details>

### Q-RI-016 · D2 · difficulty 2 · single
In React 19.3, which statement about Strict Mode is true?
- A) Effects are double-invoked only for client-rendered roots
- B) Effects are double-invoked on mount, including roots created with `hydrateRoot`
- C) Effects are double-invoked in production too
- D) Only render is double-invoked
<details><summary>Answer</summary>

**B.** 19.3 extended setup→cleanup→setup to hydration.
- Why not A: that was ≤19.2 behaviour.
- Why not C: Strict Mode is dev-only.
- Why not D: effects have been double-invoked since 18.
- Ref: [modules/04 §3](../modules/04-effects-and-synchronization.md), https://react.dev/blog/2026/09/09/react-19-3
</details>

### Q-RI-017 · D2 · difficulty 2 · scenario
A chat effect depends on `[roomId, theme]` only because it shows a toast with `theme` when connected; changing the theme reconnects. Best fix?
- A) Remove `theme` from deps and suppress the lint
- B) Move the toast into `useEffectEvent` and depend on `[roomId]`
- C) Store `theme` in a ref during render
- D) Wrap the effect body in `useCallback`
<details><summary>Answer</summary>

**B.** `useEffectEvent` (stable 19.2) reads the latest `theme` without being a dependency.
- Why not A: stale closure (tested).
- Why not C: writing refs during render breaks purity and the Compiler.
- Why not D: does not change dependency semantics.
- Ref: [modules/04 §5](../modules/04-effects-and-synchronization.md), https://react.dev/reference/react/useEffectEvent
</details>

### Q-RI-018 · D2 · difficulty 1 · single
What does React 19 do when a ref callback returns a function?
- A) Ignores it
- B) Calls it as cleanup when the ref is detached, instead of calling the ref with `null`
- C) Calls it immediately after attaching
- D) Throws
<details><summary>Answer</summary>

**B.**
- Why not A: React 19 uses the return value. Why not C: cleanup runs on detach/replace. Why not D: returning a function is the documented protocol.
- Ref: [modules/04 §4](../modules/04-effects-and-synchronization.md), https://react.dev/reference/react-dom/components/common#ref-callback
</details>

### Q-RI-019 · D2 · difficulty 3 · hands-on
Make the fetch-race test pass: implement a `Profile({ id })` that fetches in an effect and never shows a response for a superseded `id`, and aborts superseded requests.
<details><summary>Answer</summary>

Use an `ignore` flag set in the cleanup and an `AbortController` aborted in the cleanup; only call `setState` when `!ignore`.
- Verification: `npm test -- examples/04-effects` → "fetching in effects: races" (3 tests).
- Ref: [modules/04 §6](../modules/04-effects-and-synchronization.md)
</details>

---

## D3 Concurrency & Suspense

### Q-RI-020 · D3 · difficulty 2 · single
What does `lanes & -lanes` compute in React's scheduler?
- A) The number of pending lanes
- B) The lowest set bit, i.e. the highest-priority pending lane
- C) The union of all lanes
- D) The expired lanes
<details><summary>Answer</summary>

**B.** Two's complement isolates the lowest set bit; lower bits are higher priority.
- Why not A: that is a popcount. Why not C: union is `a | b`. Why not D: expiration is tracked separately per lane.
- Ref: [modules/05 §1](../modules/05-concurrency-lanes-transitions.md)
</details>

### Q-RI-021 · D3 · difficulty 2 · single
A slow component takes 80 ms to render inside `startTransition`. Typing still lags. Why?
- A) Transitions do not work with inputs
- B) React yields only between fibers; one 80 ms component blocks the main thread for 80 ms
- C) The transition was entangled with the input
- D) The scheduler's slice is 100 ms
<details><summary>Answer</summary>

**B.** Concurrency hides many small costs, never one big one. Split or optimise the component.
- Why not D: the slice is 5 ms.
- Why not A: transitions work with any updates. Why not C: entanglement concerns transitions with each other, not urgent input.
- Ref: [modules/05 §2, §6](../modules/05-concurrency-lanes-transitions.md)
</details>

### Q-RI-022 · D3 · difficulty 3 · scenario
React 19.3. Transition A sets state that suspends on a slow promise. While A is suspended, transition B updates an unrelated counter. What does the user see?
- A) Nothing changes until A resolves
- B) B's update commits immediately; A commits when its data arrives
- C) A's fallback replaces the current content
- D) B is dropped
<details><summary>Answer</summary>

**B.** Since 19.3 each transition lane renders independently ("untangled"). On 19.0–19.2 the answer was A (entangled). Tested.
- Ref: [modules/05 §3.4](../modules/05-concurrency-lanes-transitions.md), https://react.dev/blog/2026/09/09/react-19-3
</details>

### Q-RI-023 · D3 · difficulty 2 · single
`startTransition(async () => { await save(); setDone(true); })` — what is wrong?
- A) Transitions cannot be async
- B) `setDone` after `await` is outside the transition scope and must be wrapped in `startTransition` again
- C) `save` must be a Server Function
- D) Nothing
<details><summary>Answer</summary>

**B.** No async context propagation across `await` (yet), so the update gets a default lane.
- Why not A: async transitions are supported since 19.0.
- Ref: [modules/05 §3.3](../modules/05-concurrency-lanes-transitions.md), https://react.dev/reference/react/startTransition
</details>

### Q-RI-024 · D3 · difficulty 2 · multi
Which are true for `<Activity mode="hidden">`? (Select all.)
- A) State is preserved
- B) DOM is removed
- C) Effects are cleaned up
- D) Updates inside it are processed at a low (offscreen) priority
- E) Children are rendered for the first time even while hidden (pre-rendering)
<details><summary>Answer</summary>

**A, C, D, E.** The DOM is kept and hidden with `display: none !important`.
- Why not B: that is conditional rendering.
- Ref: [modules/05 §5](../modules/05-concurrency-lanes-transitions.md), https://react.dev/reference/react/Activity
</details>

### Q-RI-025 · D3 · difficulty 1 · single
`useDeferredValue(query)` during the urgent render after `query` changed returns?
- A) The new value
- B) The previous committed value; a background render then uses the new value
- C) `undefined`
- D) The value debounced by 300 ms
<details><summary>Answer</summary>

**B.** No fixed delay; the background render restarts if `query` changes again.
- Why not A: the urgent render deliberately keeps the old value. Why not C: it never returns undefined unless the value is. Why not D: there is no fixed delay.
- Ref: [modules/05 §4](../modules/05-concurrency-lanes-transitions.md)
</details>

### Q-RI-026 · D3 · difficulty 2 · single
`function User({ id }) { const u = use(fetchUser(id)); … }` — the boundary shows its fallback forever. Why?
- A) `use` only works in Server Components
- B) A new promise is created on every retry, so it is never the resolved one
- C) `fetchUser` must return JSON
- D) Missing error boundary
<details><summary>Answer</summary>

**B.** Promises passed to `use` must be cached across renders (RSC, a data library, a keyed cache).
- Ref: [modules/06 §2.2](../modules/06-suspense-streaming-ssr-and-hydration.md), https://react.dev/reference/react/use
</details>

### Q-RI-027 · D3 · difficulty 3 · single
Which statement about Suspense mechanics is accurate?
- A) Throwing a promise from your component is the supported API for suspending
- B) React resumes the suspended function at the `use` call when the promise resolves
- C) React re-runs the component from the top; `use` finds the promise fulfilled (status tagged on the object) and returns synchronously
- D) Suspense only works for `lazy`
<details><summary>Answer</summary>

**C.** The algebraic-effects analogy stops at resumption: React re-executes.
- Why not A: throwing promises is unsupported; `use` is the API.
- Why not B: JS has no resumable continuations.
- Why not D: `use`, RSC and libraries also suspend.
- Ref: [modules/06 §1.1–2.1](../modules/06-suspense-streaming-ssr-and-hydration.md)
</details>

### Q-RI-028 · D3 · difficulty 2 · hands-on
Demonstrate with a test that a transition keeps old content visible instead of a fallback, and that the same update without a transition shows the fallback.
<details><summary>Answer</summary>

Render a Suspense boundary with already-visible content; switch it to a suspending child once inside `startTransition` (old content + `isPending`) and once without (fallback).
- Verification: `npm test -- examples/05-concurrency` → "useTransition: isPending is true…" and "NEGATIVE: the same update without a transition…".
- Ref: [modules/05 §3.2](../modules/05-concurrency-lanes-transitions.md)
</details>

---

## D4 SSR, streaming & hydration

### Q-RI-029 · D4 · difficulty 1 · single
What is the "shell" in `renderToPipeableStream`?
- A) The HTML template file
- B) Everything outside Suspense boundaries plus the outermost fallbacks; `onShellReady` fires when it can be streamed
- C) The client JavaScript bundle
- D) The `<head>` element only
<details><summary>Answer</summary>

**B.**
- Why not A/D: the shell is a rendering concept, not a file or element. Why not C: JS is loaded via bootstrap scripts, separately.
- Ref: [modules/06 §3.2](../modules/06-suspense-streaming-ssr-and-hydration.md), https://react.dev/reference/react-dom/server/renderToPipeableStream
</details>

### Q-RI-030 · D4 · difficulty 2 · single
A component inside a Suspense boundary throws during streaming SSR. What happens?
- A) The response becomes a 500
- B) `onError` is called; the boundary streams its fallback marked for client rendering; the client retries rendering it
- C) The error is silently ignored
- D) `onShellError` is called
<details><summary>Answer</summary>

**B.** Only errors outside every boundary fail the shell (`onShellError`). Return a digest from `onError`.
- Why not A/D: only errors outside all boundaries fail the shell. Why not C: `onError` is always called.
- Ref: [modules/06 §3.2](../modules/06-suspense-streaming-ssr-and-hydration.md)
</details>

### Q-RI-031 · D4 · difficulty 2 · multi
Which commonly cause hydration mismatches? (Select all.)
- A) `new Date().toLocaleString()` in render
- B) `useId()` for label/input IDs
- C) `typeof window !== "undefined"` branches in render
- D) `<p><div/></p>` markup
- E) Reading a store without a matching `getServerSnapshot`
<details><summary>Answer</summary>

**A, C, D, E.**
- Why not B: `useId` is designed to be identical on server and client (tree-position based).
- Ref: [modules/06 §4.3](../modules/06-suspense-streaming-ssr-and-hydration.md)
</details>

### Q-RI-032 · D4 · difficulty 2 · single
On a text mismatch during hydration, React 19 …
- A) patches the text node in place
- B) client-renders the nearest Suspense boundary (or root) and reports `onRecoverableError`
- C) throws to the nearest error boundary
- D) keeps the server text silently
<details><summary>Answer</summary>

**B.** D is what `suppressHydrationWarning` does for one level.
- Why not A: React stopped patching mismatches in 18. Why not C: mismatches are recoverable, not render errors. Why not D: only with `suppressHydrationWarning`.
- Ref: [modules/06 §4.3](../modules/06-suspense-streaming-ssr-and-hydration.md)
</details>

### Q-RI-033 · D4 · difficulty 3 · single
In partial pre-rendering (19.2), what must hold for `resume(app, postponed)` to be correct?
- A) `postponed` must be passed as a live object from the prerender process
- B) The resumed tree must render the same shell as the prerendered one; `postponed` is JSON-serialisable and can be stored
- C) The prelude must be re-sent with the resume stream
- D) Resume works only with Node streams
<details><summary>Answer</summary>

**B.** The resume stream contains only hole segments and reveal instructions (tested).
- Why not D: `resume` (Web) and `resumeToPipeableStream` (Node) both exist.
- Ref: [modules/06 §5](../modules/06-suspense-streaming-ssr-and-hydration.md), https://react.dev/blog/2025/10/01/react-19-2
</details>

### Q-RI-034 · D4 · difficulty 2 · single
What does `use(browser("needs window"))` do during server rendering (19.3)?
- A) Throws a server error
- B) Suspends; the nearest boundary emits its fallback, React reports to `onBrowserBailout` (not `onError`), and the client renders the content after hydration
- C) Renders nothing and logs a warning
- D) Skips hydration for the whole page
<details><summary>Answer</summary>

**B.** It requires a Suspense boundary on the server; the reason is not serialised to HTML.
- Why not A: it is a bailout, not an error (`onError` is not called). Why not C: the fallback is rendered. Why not D: only the boundary is client-rendered.
- Ref: [modules/06 §6](../modules/06-suspense-streaming-ssr-and-hydration.md), https://react.dev/reference/react-dom/browser
</details>

---

## D5 Server Components, Server Functions & security

### Q-RI-035 · D5 · difficulty 1 · single
What does `"use client"` mark?
- A) A component that renders only in the browser and is skipped by SSR
- B) A module boundary: in the server graph its exports become client references; the module and its imports go to the client bundle
- C) A Server Function
- D) A component that cannot use hooks
<details><summary>Answer</summary>

**B.** Client Components are still SSR'd to HTML.
- Why not A: Client Components are server-rendered by SSR too. Why not C: that is `"use server"`. Why not D: client modules are where hooks live.
- Ref: [modules/07 §1.1](../modules/07-server-components-and-flight.md), https://react.dev/reference/rsc/use-client
</details>

### Q-RI-036 · D5 · difficulty 2 · multi
Which props can a Server Component pass to a Client Component? (Select all.)
- A) A `Date`
- B) An arrow function `() => alert(1)`
- C) A Promise
- D) An ORM entity class instance
- E) A Server Function
- F) JSX rendered on the server
<details><summary>Answer</summary>

**A, C, E, F.**
- Why not B: "Event handlers cannot be passed to Client Component props" (tested).
- Why not D: class instances are rejected; map to plain objects.
- Ref: [modules/07 §4](../modules/07-server-components-and-flight.md)
</details>

### Q-RI-037 · D5 · difficulty 2 · single
In a Flight row `0:["$","$L2",null,{"start":3}]`, what is `"$L2"`?
- A) A lazy reference to chunk 2 (here a client component imported by an `I` row)
- B) A literal string
- C) A link to a CSS file
- D) A promise
<details><summary>Answer</summary>

**A.** `$@` is a promise; `$$` escapes a literal `$`.
- Why not B: literal strings starting with `$` are escaped as `$$`. Why not C: Flight has no CSS references in this form. Why not D: promises are `$@`.
- Ref: [modules/07 §3.1](../modules/07-server-components-and-flight.md)
</details>

### Q-RI-038 · D5 · difficulty 3 · scenario
`deleteNote(id)` is a Server Function; the UI shows the delete button only on the user's own notes. A pentester deletes another user's note. Root cause and fix?
- A) CSRF; add a CSRF token only
- B) IDOR: Server Functions are public endpoints with attacker-controlled arguments; authenticate from the server session, authorise ownership, validate input
- C) The button should be hidden with CSS
- D) Use `"use client"` on the action
<details><summary>Answer</summary>

**B.** Tested end to end in M07 (`decode-reply` scenario).
- Why not A: CSRF protections don't stop an authenticated attacker calling the endpoint with their own session.
- Ref: [modules/07 §6.1](../modules/07-server-components-and-flight.md)
</details>

### Q-RI-039 · D5 · difficulty 2 · single
Which apps were exposed to CVE-2025-55182?
- A) Only apps that define Server Functions
- B) Any app using React Server Components with `react-server-dom-*` 19.0.0, 19.1.0, 19.1.1 or 19.2.0, even without Server Functions
- C) Every React 19 app
- D) Only Next.js Pages Router apps
<details><summary>Answer</summary>

**B.** Client-only apps and SSR without RSC were not affected.
- Why not A: the decoder endpoint exists in any RSC setup. Why not C: apps without an RSC server were not affected. Why not D: Pages Router does not use RSC.
- Ref: [modules/07 §7.1](../modules/07-server-components-and-flight.md), https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components
</details>

### Q-RI-040 · D5 · difficulty 3 · single
It is October 2026. Your RSC app runs `react-server-dom-webpack@19.2.6`. Is it fully patched against the advisories listed in this track?
- A) Yes, 19.2.1 fixed the RCE
- B) No: CVE-2026-44907 is fixed in 19.2.8; upgrade to the latest 19.2.x (or 19.3.x) in lockstep with `react`/`react-dom`
- C) Yes, DoS issues do not matter
- D) No, only 20.x is safe
<details><summary>Answer</summary>

**B.**
- Why not A: later DoS advisories need later patches. Why not C: availability is part of security. Why not D: patched 19.x lines exist.
- Ref: [modules/07 §7.2](../modules/07-server-components-and-flight.md), version gate in [examples/07-rsc/rsc.test.tsx](../examples/07-rsc/rsc.test.tsx)
</details>

### Q-RI-041 · D5 · difficulty 2 · single
What does `cache(fn)` provide in Server Components?
- A) A cross-request LRU cache
- B) Per-request memoisation by arguments; create it at module level
- C) Browser HTTP caching
- D) Memoisation of Client Component renders
<details><summary>Answer</summary>

**B.** `cacheSignal()` (19.2) aborts when the render completes, fails or is aborted.
- Why not A: the cache lives for one request. Why not C: unrelated to HTTP caching. Why not D: it is a Server Component API.
- Ref: [modules/07 §5](../modules/07-server-components-and-flight.md), https://react.dev/reference/react/cache
</details>

### Q-RI-042 · D5 · difficulty 2 · hands-on
Run a Server Component tree through Flight without a bundler and decode it on the client side.
<details><summary>Answer</summary>

Run the server half with `node --conditions react-server`, register client references with `registerClientReference`, pipe `renderToPipeableStream(tree, manifest)` to stdout; decode with `createFromNodeStream` and a `moduleMap` plus `__webpack_require__`.
- Verification: `npm test -- examples/07-rsc` → "the client decodes rows into React elements…".
- Ref: [modules/07 §1, §3](../modules/07-server-components-and-flight.md)
</details>

---

## D6 Actions & forms

### Q-RI-043 · D6 · difficulty 1 · single
Where must `useFormStatus` be called to see a form's pending state?
- A) In the component that renders `<form>`
- B) In a component rendered inside the `<form>`
- C) Anywhere in the app
- D) In the action function
<details><summary>Answer</summary>

**B.** Tested negative in M08.
- Why not A: the form-rendering component is not inside the form. Why not C: status is scoped to the parent form. Why not D: it is a hook, usable only in components.
- Ref: [modules/08 §2.2](../modules/08-actions-forms-and-optimistic-ui.md), https://react.dev/reference/react-dom/hooks/useFormStatus
</details>

### Q-RI-044 · D6 · difficulty 2 · single
Two quick `dispatch` calls to the same `useActionState`. What happens?
- A) They run in parallel and the slower wins
- B) They are queued; the second runs after the first settles and receives its result as previous state
- C) The second is dropped
- D) Both receive the initial state
<details><summary>Answer</summary>

**B.**
- Why not A/C/D: `useActionState` serialises dispatches and threads state through them.
- Ref: [modules/08 §3](../modules/08-actions-forms-and-optimistic-ui.md)
</details>

### Q-RI-045 · D6 · difficulty 2 · single
How does `useOptimistic` roll back after a failed request?
- A) You call `rollback()`
- B) Optimistic entries exist only while their Action is pending; when it settles without a real update, the real state shows again
- C) It retries automatically
- D) It never rolls back
<details><summary>Answer</summary>

**B.** If the Action never settles, the optimistic value stays — add timeouts.
- Why not A: there is no rollback API. Why not C: no automatic retries. Why not D: discard happens when the Action settles.
- Ref: [modules/08 §4](../modules/08-actions-forms-and-optimistic-ui.md), https://react.dev/reference/react/useOptimistic
</details>

### Q-RI-046 · D6 · difficulty 3 · scenario
After a save request hangs forever (no timeout), users report that tab switches (wrapped in `startTransition`) no longer work, but typing still does. Explain.
- A) The browser blocked the event loop
- B) The pending async Action scope entangles later transitions, so they wait for it (observed on 19.3.1); urgent updates are unaffected. Add timeouts to requests in Actions
- C) `useOptimistic` crashed
- D) Untangled transitions in 19.3 prevent this, so it must be a bug elsewhere
<details><summary>Answer</summary>

**B.** Tested in `hung-action.test.tsx`.
- Why not D: untangling is about lane grouping; the hold-back comes from the action scope.
- Ref: [modules/08 §1](../modules/08-actions-forms-and-optimistic-ui.md)
</details>

### Q-RI-047 · D6 · difficulty 2 · single
After a successful form action, the uncontrolled inputs are empty again. Why?
- A) A bug in React
- B) React resets the form after a successful action (19.3 also fires `onReset`); return values in state or use controlled inputs to keep them
- C) The browser reloads the page
- D) `useFormStatus` clears them
<details><summary>Answer</summary>

**B.**
- Why not A: documented behaviour. Why not C: the action prevents navigation. Why not D: status is read-only.
- Ref: [modules/08 §2.1](../modules/08-actions-forms-and-optimistic-ui.md)
</details>

---

## D7 Performance & the React Compiler

### Q-RI-048 · D7 · difficulty 1 · single
What does the React Compiler emit for a component?
- A) A Web Worker
- B) A per-instance cache (`_c(n)`, i.e. `useMemoCache`) and guarded blocks that recompute values only when their inferred dependencies change
- C) `React.memo` wrappers around every component
- D) A WebAssembly module
<details><summary>Answer</summary>

**B.**
- Why not A/D: it is a Babel transform emitting JS. Why not C: it memoises inside components, not by wrapping them in `memo`.
- Ref: [modules/09 §2.1](../modules/09-react-compiler.md), https://react.dev/learn/react-compiler
</details>

### Q-RI-049 · D7 · difficulty 2 · single
A component reads `ref.current` during render. What does React Compiler 1.0 do by default?
- A) Compiles it and memoises the ref value
- B) Reports a `CompileError` (Refs) and leaves the function uncompiled, silently in production builds
- C) Fails the build
- D) Converts the ref to state
<details><summary>Answer</summary>

**B.** Default `panicThreshold` is `"none"`; use lint/logger/CI threshold to surface it.
- Why not A: refs read during render are unsafe to memoise. Why not C: only with `panicThreshold` raised. Why not D: no such transformation.
- Ref: [modules/09 §3](../modules/09-react-compiler.md)
</details>

### Q-RI-050 · D7 · difficulty 3 · single
Which Rules-of-React violation is NOT caught by Compiler 1.0 + `react-hooks` 7 recommended lint in this track's tests?
- A) Conditional hook
- B) `ref.current` in render
- C) `props.items.push(x)` in render
- D) `Math.random()` in render
<details><summary>Answer</summary>

**C.** It compiles successfully and lints clean; memoised JSX keyed on the unchanged array reference can go stale.
- Ref: [modules/09 §3](../modules/09-react-compiler.md)
</details>

### Q-RI-051 · D7 · difficulty 2 · single
Should you remove existing `useMemo`/`useCallback` when enabling the compiler?
- A) Yes, always
- B) No; leave them unless tests cover the change — removing them can change compilation output
- C) Only `useCallback`
- D) They cause compile errors
<details><summary>Answer</summary>

**B.** Per the 1.0 announcement.
- Ref: [modules/09 §6](../modules/09-react-compiler.md), https://react.dev/blog/2025/10/07/react-compiler-1
</details>

### Q-RI-052 · D7 · difficulty 2 · single
`<Ctx value={{ user, setTheme }}>` re-renders a `memo`ised consumer on every provider render. Why?
- A) `memo` does not work with context
- B) The value is a new object each render; context consumers re-render on identity change regardless of `memo`
- C) Context always re-renders everything
- D) `setTheme` is unstable
<details><summary>Answer</summary>

**B.** Memoise or split the value (tested: 4 vs 1 renders).
- Ref: [modules/12 §2](../modules/12-performance-testing-and-production.md)
</details>

### Q-RI-053 · D7 · difficulty 2 · single
A list has 10,000 rows. What does virtualisation change?
- A) It renders rows in a Web Worker
- B) It renders only rows intersecting the viewport (plus overscan), so work is proportional to the viewport
- C) It caches row HTML
- D) It defers rendering with transitions
<details><summary>Answer</summary>

**B.**
- Why not A/C/D: virtualisation reduces mounted rows; workers, caching and transitions are different techniques.
- Ref: [modules/12 §2](../modules/12-performance-testing-and-production.md)
</details>

### Q-RI-054 · D7 · difficulty 3 · single
`function Page() { const W = lazy(() => import("./W")); return <W />; }` — consequence?
- A) Faster loads due to fresh imports
- B) A new component type every render: the subtree remounts and the loader runs again
- C) A compile error
- D) No effect
<details><summary>Answer</summary>

**B.** Declare `lazy` at module level (tested).
- Ref: [modules/12 §3](../modules/12-performance-testing-and-production.md)
</details>

### Q-RI-055 · D7 · difficulty 2 · hands-on
Show that the compiler stops an expensive child from re-rendering when only unrelated state changes.
<details><summary>Answer</summary>

Compile a `Page` with `babel-plugin-react-compiler`, run it and the uncompiled version, click an unrelated counter three times, count child renders (4 vs 1).
- Verification: `npm test -- examples/09-compiler` → "runtime effect…".
- Ref: [modules/09 §1](../modules/09-react-compiler.md)
</details>

---

## D8 Errors, testing & upgrades

### Q-RI-056 · D8 · difficulty 1 · multi
Which errors are caught by an error boundary? (Select all.)
- A) Thrown during render of a descendant
- B) Thrown in a descendant's `useEffect`
- C) Thrown in an `onClick` handler
- D) Thrown after `await` in an async function
- E) A rejected promise read with `use`
<details><summary>Answer</summary>

**A, B, E.**
- Why not C, D: they run outside rendering; forward with `setState(() => { throw e })` if needed.
- Ref: [modules/10 §2](../modules/10-errors-and-resilience.md)
</details>

### Q-RI-057 · D8 · difficulty 2 · single
Which root option receives errors that no boundary handled?
- A) `onCaughtError`
- B) `onUncaughtError` (and the root is unmounted)
- C) `onRecoverableError`
- D) `componentDidCatch`
<details><summary>Answer</summary>

**B.** `onRecoverableError` is for hydration mismatches and errors that succeeded on a synchronous retry.
- Why not A: that is for handled errors. Why not C: that is for errors React recovered from. Why not D: that is a boundary method.
- Ref: [modules/10 §3](../modules/10-errors-and-resilience.md), https://react.dev/reference/react-dom/client/createRoot
</details>

### Q-RI-058 · D8 · difficulty 2 · single
After upgrading to React 19, `Button.defaultProps = { size: "m" }` on a function component stopped working. Fix?
- A) Use `React.defaultProps`
- B) Use ES default parameters: `function Button({ size = "m" })`
- C) Downgrade
- D) Add `propTypes`
<details><summary>Answer</summary>

**B.** Function-component `defaultProps` are ignored in 19 (classes still support them); `propTypes` are ignored too.
- Ref: [modules/12 §5.1](../modules/12-performance-testing-and-production.md)
</details>

### Q-RI-059 · D8 · difficulty 2 · single
A test logs "An update to X inside a test was not wrapped in act(...)". What does it mean?
- A) The test is fine
- B) React work happened outside `act`, so assertions may run before React flushed; await `act`/`findBy*`
- C) The component has a memory leak
- D) Strict Mode is on
<details><summary>Answer</summary>

**B.**
- Ref: [modules/12 §4.1](../modules/12-performance-testing-and-production.md), https://react.dev/reference/react/act
</details>

### Q-RI-060 · D8 · difficulty 3 · scenario
An error boundary around a route shows its fallback; the user navigates to another route and the fallback stays. Fix?
- A) Call `forceUpdate` on the children
- B) Reset the boundary on navigation: `key={pathname}` or a `resetKey` compared in `getDerivedStateFromProps`
- C) Catch the error in each child
- D) Use `onUncaughtError`
<details><summary>Answer</summary>

**B.** Children are unmounted while the fallback shows; only resetting the boundary helps (tested).
- Ref: [modules/10 §4](../modules/10-errors-and-resilience.md)
</details>

---

## D9 DOM platform integration

### Q-RI-061 · D9 · difficulty 1 · single
Which updates animate inside `<ViewTransition>` (19.3)?
- A) All updates
- B) Only updates in a Transition (startTransition, Suspense reveal, useDeferredValue)
- C) Only mounts
- D) Only updates in `useLayoutEffect`
<details><summary>Answer</summary>

**B.** Tested with a recording stand-in for the browser API.
- Why not A: urgent updates are never animated. Why not C: mounts are not transitions. Why not D: effects do not start view transitions.
- Ref: [modules/11 §1](../modules/11-animation-and-dom-platform.md), https://react.dev/blog/2026/09/09/react-19-3
</details>

### Q-RI-062 · D9 · difficulty 2 · single
What is `ref.current` for `<Fragment ref={ref}>` in 19.3?
- A) `null`, fragments have no DOM
- B) A `FragmentInstance` whose methods (listeners, focus, observers, rects) apply to the fragment's first-level DOM children
- C) An array of DOM nodes
- D) The first child element
<details><summary>Answer</summary>

**B.**
- Why not A: 19.3 made Fragment refs stable. Why not C/D: it is an object with group-level methods, not a node list or a node.
- Ref: [modules/11 §2](../modules/11-animation-and-dom-platform.md)
</details>

### Q-RI-063 · D9 · difficulty 2 · single
A click inside a modal rendered with `createPortal(…, document.body)` triggers the "click outside closes the modal" handler on the React parent. Why?
- A) Portals break event delegation
- B) React events bubble through the React tree, not the DOM tree, so the parent sees the portal's click
- C) The modal is not mounted
- D) Browser bug
<details><summary>Answer</summary>

**B.** Check containment in the portal node or stop propagation.
- Ref: [modules/11 §3](../modules/11-animation-and-dom-platform.md), https://react.dev/reference/react-dom/createPortal
</details>

### Q-RI-064 · D9 · difficulty 2 · multi
In React 19, which of these rendered inside a deep component end up in `<head>`? (Select all.)
- A) `<title>`
- B) `<meta name="description">`
- C) `<link rel="stylesheet" href="/a.css" precedence="default">`
- D) `<div>`
<details><summary>Answer</summary>

**A, B, C.** Stylesheets with `precedence` are also deduplicated and ordered.
- Why not D: ordinary elements render where they are written.
- Ref: [modules/11 §4](../modules/11-animation-and-dom-platform.md)
</details>

### Q-RI-065 · D9 · difficulty 3 · single
Why couldn't a React app enforce `require-trusted-types-for 'script'` before 19.3?
- A) React used `eval`
- B) React stringified values before writing to sinks such as `innerHTML`, turning `TrustedHTML` into rejected strings; 19.3 passes them through
- C) React does not support CSP
- D) Trusted Types are not implemented in browsers
<details><summary>Answer</summary>

**B.**
- Why not A: React does not eval. Why not C: CSP works with React in general. Why not D: Chromium-based browsers implement Trusted Types.
- Ref: [modules/11 §5](../modules/11-animation-and-dom-platform.md)
</details>

---

## Mock interview

A senior React loop is usually a **60-minute technical screen** plus separate coding and design rounds. This mock reproduces the screen: **25 questions in 45 minutes** (≈1.8 min each), then a **15-minute design discussion**, with the domain mix of the weights in [README](README.md).

**Part A — questions (45 min).** Answer in order, without notes:

| Domain | Questions |
|---|---|
| D1 (3) | 003, 004, 006 |
| D2 (5) | 010, 012, 013, 016, 017 |
| D3 (4) | 021, 022, 024, 027 |
| D4 (2) | 031, 033 |
| D5 (3) | 036, 038, 040 |
| D6 (2) | 044, 046 |
| D7 (3) | 049, 050, 052 |
| D8 (2) | 056, 060 |
| D9 (1) | 062 |

**Part B — design discussion (15 min).** *"Design the product page of a large e-commerce site in React 19.3: static content, per-user price and stock, reviews, an add-to-cart form, and a recommendations carousel."* Cover: which parts are Server vs Client Components; where Suspense and error boundaries go; streaming vs partial pre-rendering for the static shell; how add-to-cart works (Server Function, `useActionState`, `useOptimistic`, timeout, authorisation, idempotency); how you prevent hydration mismatches for prices/time; performance budget and measurement; patch-level security policy for the RSC stack.

**Scoring key.**

| Part | Points |
|---|---|
| A: 25 questions × 2 points (multi-select: all correct options and no wrong ones = 2, one error = 1, else 0; ordering: exact = 2, one adjacent swap = 1) | 50 |
| B: Server/Client split justified (5), boundaries placed by UX (5), PPR/streaming choice (4), Action design incl. optimistic UI, timeouts, authz, idempotency (8), hydration-safe rendering (4), measurement plan (2), security/patching (2) | 30 |
| **Total** | **80** |

**Bands:** ≥ 64 strong senior · 52–63 senior with gaps (revisit the modules of missed domains) · < 52 not yet senior on React internals.

## Coverage summary

| Domain | Weight | Questions | Types present |
|---|---|---|---|
| D1 | 12% | 8 | single, multi, scenario, ordering |
| D2 | 18% | 11 | single, multi, scenario, ordering, hands-on |
| D3 | 14% | 9 | single, multi, scenario, hands-on |
| D4 | 10% | 6 | single, multi |
| D5 | 12% | 8 | single, multi, scenario, hands-on |
| D6 | 8% | 5 | single, scenario |
| D7 | 12% | 8 | single, hands-on |
| D8 | 8% | 5 | single, multi, scenario |
| D9 | 6% | 5 | single, multi |
| **Total** | 100% | **65** | |
