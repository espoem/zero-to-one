# Module 06 — Colorless Async: Async Computations, Boundaries and Pending State

> **Executable proof:** [`examples/typescript/06-colorless-async.test.tsx`](../examples/typescript/06-colorless-async.test.tsx) (19 tests). Every promise in the suite is a hand-settled deferred, so the tests contain no timers and no races.
>
> Promise and job-queue semantics, async functions and async iteration are owned by `languages/javascript`. This module covers how Solid's graph treats them.

"Function colouring" is the observation that `async` spreads: once a function returns a Promise, every caller must become `async` or handle the Promise. UI frameworks inherited the problem as loading flags: `T | undefined` in every type, `isLoading` branches in every component. Solid 2.0 removes the colour at the reactive layer: **any computation may return a Promise or an AsyncIterable**, and consumers read it with the same accessor call as a synchronous value. "Not ready yet" travels through the graph, and boundaries turn it into UI.

---

## 1. The model

### 1.1 Definition

Extend the value domain of a computation $c$ from $V$ to $V \cup \{\bot\}$, where $\bot$ means "not ready". A computation returning a Promise is $\bot$ until the Promise settles; an AsyncIterable is $\bot$ until its first yield.

- **Reading $\bot$ in a tracking scope** throws `NotReadyError` internally. The runtime catches it at the nearest consumer that can wait: a `<Loading>` boundary, a held transition, or an effect that defers its apply.
- **Reading $\bot$ outside any tracking scope** throws `NotReadyError` to you (proved: `untrack(user)` throws). The dev diagnostic is `PENDING_ASYNC_UNTRACKED_READ`.
- **Propagation.** A computation that reads $\bot$ is itself $\bot$ for that run. So `fullName = first() + last()` over an async `first` is not ready without being declared async: that is the "colourless" part.

```ts
const user = createMemo(() => fetchUser(id()));      // async memo — no createResource
const title = createMemo(() => `${user().name}!`);   // sync code over async data
```

You can also throw `new NotReadyError(...)` yourself to mark a derived value not ready (proved: `derived` throws until its source is set). That is a library-author tool.

### 1.2 Tracking stops at the first `await`

Dependencies are recorded while the computation runs synchronously. After the first `await`, the code runs in a later microtask with no current observer, so reads there are **not dependencies**. Proved: a memo that reads `q()` after `await` never re-runs when `q` changes, and the dev build warns `UNTRACKED_READ_AFTER_AWAIT` (V8-only check, based on async stack traces). Read every input before the first `await`:

```ts
const items = createMemo(async () => {
  const q = query();                 // ✅ tracked
  const res = await fetchItems();
  return res.filter((i) => i.tag === q);
});
```

### 1.3 Streams

A computation that returns an AsyncIterable updates its value on every yield (proved: `1 → 2 → 3`). When the computation re-runs, the runtime closes the old iterable (`return()`). For push sources, `from()` adapts a subscribe function `(next, error, complete) => unsubscribe`, an Observable, or an AsyncIterable; the subscription closes on re-run and on disposal (proved: the listener set empties on `dispose()`).

```ts
const price = createMemo(() => from(ticker(symbol())));
const label = createMemo(() => format(price()));      // transform downstream, not in a for-await
```

## 2. `<Loading>`: branch readiness, not "is fetching"

```tsx
<Loading fallback={<Spinner />}>
  <Profile />
</Loading>
```

`<Loading>` shows its fallback while its subtree *has not yet produced content* because something it reads is $\bot$. Once the branch has shown content, **revalidation keeps the content visible**: a changed input is answered in the background and the new value replaces the old one when it lands (proved: `Ada` stays on screen while id 2 loads, then `Grace` appears; the fallback never comes back).

Why: a spinner replacing content the user was reading is worse UX than slightly stale content plus an "updating" hint. That hint is `isPending`.

### 2.1 Holds

When a write makes something on screen $\bot$ (id changes, the profile refetches), the runtime **holds** that write: the screen keeps showing the old, consistent frame, then commits everything together when the new data lands. It does not show the new `id` next to the old profile. That is how 2.0 implements transitions: there is no `startTransition`; every write that leads to async is a transition, and several can be in flight. [Module 07](./07-actions-and-optimistic-state.md) covers how actions and optimistic values interact with holds.

### 2.2 `on`: show the fallback again

```tsx
<Loading on={id()} fallback={<Spinner />}><Comments /></Loading>
```

`on` is a **dependency list**, not a key: its value is never compared, only what it reads matters. When something it reads changes, the boundary stops holding its current content and shows the fallback while its subtree is pending (proved: `c1 → spinner → c2`). Use `on={[a(), b()]}` for several dependencies. `on` takes a value: `on={() => id()}` hands the boundary a function that nothing calls, so it never notifies.

The fallback **follows the frame**: it appears together with the change that caused it, not beside a page that does not yet reflect the change.

**Gotcha: `LOADING_ON_OUTSIDE_HOLD`.** If the same data is also read *outside* the boundary (a header showing `comments().length` under a different `<Loading>`), that outside read holds the frame until the data lands, so the boundary's fallback can never be seen. Proved: no `spinner` ever appears, and dev warns `LOADING_ON_OUTSIDE_HOLD`. Fix the structure: move the outside read under the boundary so one hold owns the data. (Upstream note dated 2026-10-06: how a re-armed boundary treats data an earlier change still holds is "deferred to a separate change". Re-check this after each RC bump.)

### 2.3 `<Reveal>`: coordinating siblings

`<Reveal>` (replaces `<SuspenseList>`) orders the reveal of sibling `<Loading>` boundaries:

| `order` | Behaviour | Proved |
|---|---|---|
| `"sequential"` (default) | reveal in DOM order; a later boundary waits until every earlier one has revealed | B resolved first but stayed on its fallback until A resolved |
| `"together"` | all keep their fallbacks until every one is ready | yes |
| `"natural"` | each reveals on its own; useful when nested as one slot of an outer group | — |

`collapsed` (sequential only) hides fallbacks past the frontier so only one skeleton shows. A nested `<Reveal>` is one composite slot of its parent, and the parent's hold is absolute: an inner `<Loading>` cannot escape it. Under SSR, `together` and `collapsed` need `renderToStream` ([Module 08](./08-ssr-and-start-mode.md)).

## 3. Pending state: `isPending`, `latest`, `createDeferred`

### 3.1 `isPending(fn)`

`isPending(() => x())` is `true` while **a change to `x` is in flight**: an input of `x` changed and the new answer has not landed, or in-flight work declared it will change `x` (`affects`). It performs the read, so place it under the same `<Loading>` that owns `x`'s first load.

**`isPending` is not 1.x `.loading`.** A re-ask of the *same* question is silent:

| Situation | `isPending` |
|---|---|
| first load (boundary shows fallback) | `false` (the boundary owns it) |
| input changed, refetch in flight | **`true`** (proved) |
| bare `refresh(x)` / polling | **`false`** — the shown data still answers the question (proved) |
| `affects(x); refresh(x)` | **`true`** (proved) |
| first flight of a memo with `loadingValue` | `false` (proved) |

For process affordances ("saving…", a disabled reload button), use an optimistic flag co-written in an action, not `isPending` ([Module 07](./07-actions-and-optimistic-state.md)).

### 3.2 `latest(fn)`

`latest(id)` reads the **in-flight** value during a hold. Proved: while id 2 loads, the frame shows `committed 1 / latest 2`. Use it for a fallback or indicator that names *what* is loading. `latest` escapes the transaction but not its own lane: a `latest()` view still waits for any *rendered* async derived from it, so it is never shown beside a half-computed derivation of itself.

### 3.3 `createDeferred(fn)`

A memo that **may lag but never leads** (React's `useDeferredValue`): after its first answer, a refetch keeps the previous value on screen instead of holding the change, and `isPending(() => rows())` reports the refetch (proved: `day-rows*` while week loads). Use it for search-as-you-type results under a fast-changing input.

### 3.4 `loadingValue`: declared first paint

`createMemo(fetchFeed, { loadingValue: placeholder })` makes the memo born committed with a placeholder. Its first flight never suspends, never shows a `<Loading>` fallback and never holds a transition; `isPending` is `false` during it (proved). Encode provisional-ness in the data (`provisional: true`), never impersonate real data. Store-family sources use `seedLoadingValue: true`. If a placeholder cannot be shaped like a real answer, you wanted a `<Loading>` boundary.

### 3.5 Imperative waiting: `resolve` and `until`

- `await resolve(() => user())` resolves with the first settled value (proved), rejects on error. Call it outside tracking scopes: tests, imperative code.
- `await until(() => predicate(), { timeout, signal })` resolves the first time the predicate settles **truthy** ([Module 07](./07-actions-and-optimistic-state.md)).

## 4. Cancellation

Solid drops a superseded run's *result* automatically. Stopping the *work* is the run's job:

```ts
const results = createMemo(async () => {
  const ac = new AbortController();
  onCleanup(() => ac.abort());          // must be registered BEFORE the first await
  return (await fetch(`/search?q=${query()}`, { signal: ac.signal })).json();
});
```

Rules (RFC 05):

1. **A run that never committed is cleaned up when it is superseded.** So the `abort` fires for a stale request (proved: the first request's signal is aborted when the query changes).
2. **Cleanup must be registered while the owner is current**, i.e. before the first `await`. After the `await` there is no owner; `onCleanup` is a no-op that warns `NO_OWNER_CLEANUP`, and the stale request runs to completion (proved by the negative test).
3. **The run on screen stays live until its replacement lands.** Its subscriptions and timers keep running because it is what the user sees.
4. **Deadlock trap:** never wait on that on-screen run's cleanup from inside the transition that replaces it (for example an action awaiting a promise resolved in a memo's `onCleanup`). The cleanup only runs after the replacement lands, and the replacement waits for you.

An iterable *returned* from the compute is closed on re-run. An iterable you `for await` *inside* an async compute is yours; wrap it in `from()` so a re-run stops it.

## 5. Errors

Async errors flow through the graph like values and are caught by **`<Errored>`** (replaces `<ErrorBoundary>`):

```tsx
<Errored fallback={(err, reset) => <button onClick={() => reset()}>Retry: {String(err().message)}</button>}>
  <Loading fallback={<Spinner />}><Page /></Loading>
</Errored>
```

- The fallback receives an **error accessor** (`err()`) and a `reset` action.
- **`reset()` retries** the errored branch: the failing computation re-runs (proved: a second request is made, and its success replaces the fallback).
- **Boundaries heal automatically.** When an input of the failed computation changes and the new run succeeds, the boundary returns to content without `reset` (proved). 1.x `resetErrorBoundaries` is gone.
- There is one error path. 1.x `resource.error` let code branch inline and bypass the boundary (invisible to SSR). In 2.0 handle async errors with `<Errored>` or an effect's `error` arm ([Module 02](./02-effects-and-lifecycle.md)).
- Report caught errors to monitoring with `configureClientErrors({ onError(error, { ownerPath, boundaryPath }) { … } })` (or per root via `render`'s options). An error that escapes every boundary halts the system (`REACTIVITY_HALTED`) and goes to `reportError`/`window.onerror`.

## 6. Sequence: a navigation with a held write

```mermaid
sequenceDiagram
  participant U as User
  participant G as Graph
  participant L as Loading (no on)
  participant S as Screen
  U->>G: setId(2)
  G->>G: user = fetch(2) → ⊥ ; write held
  G-->>S: keep frame [id 1, Ada] (isPending(user) = true)
  Note over S: optional "(updating)" via isPending, latest(id) = 2
  G->>G: fetch(2) resolves "Grace"
  G-->>S: commit [id 2, Grace] together
```

## 7. Then vs now

| 1.x (≤ 1.9) | 2.0 RC | Why it changed | Migration |
|---|---|---|---|
| `createResource(id, fetcher)` → `[data, { refetch, mutate }]`, typed `T \| undefined` | `createMemo(() => fetcher(id()))`, typed `T` | one model for sync and async | wrap reads in `<Loading>` |
| `data.loading` | `<Loading>` for first load; `isPending(() => data())` for in-flight changes | loading is structural | note: bare `refresh` is not pending |
| `data.error` / inline branching | `<Errored>` / effect `error` arm | one error path, SSR-visible | |
| `refetch()` | `refresh(data)` (returns a promise of the next quiescent state) | standalone, works on any derived source | `affects(x); refresh(x)` to read as pending |
| `mutate(v)` | `createOptimisticStore` + `action` | granular, reconciled, race-safe | Module 07 |
| `<Suspense>` / `<SuspenseList>` | `<Loading>` / `<Reveal>` | names match the role | revalidation no longer re-suspends |
| `<ErrorBoundary>` + `resetErrorBoundaries` | `<Errored>`; boundaries self-heal | | |
| `startTransition` / `useTransition` | built in (holds), multiple in flight | transitions are scheduling | delete; use `isPending` / optimistic APIs |
| `createResource({ initialValue })` | `loadingValue` / `seedLoadingValue` | honest placeholders | |
| `ssrLoadFrom`, `deferStream` on resources | `ssrSource`, `deferStream` on any computation | per-primitive SSR policy | Module 08 |

**Pitfall when mixing:** code ported from 1.x often keeps `<Show when={!data.loading}>` style branches. In 2.0 there is no `.loading`, and porting it to `isPending` makes the first-load case render nothing (first load is the boundary's job, `isPending` is `false`). Restructure around `<Loading>`.

## 8. Production failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Results never update when the filter changes | input read after `await` (`UNTRACKED_READ_AFTER_AWAIT`) | read inputs before the first `await` |
| Stale requests pile up while typing (`ABANDONED_FLIGHTS` in attribution) | no cancellation, or cleanup registered after `await` | `onCleanup(() => ac.abort())` before the first `await`; `createDeferred` |
| "Updating" indicator never shows on reload | bare `refresh` is quiet | `affects(x); refresh(x)` or an optimistic flag |
| Spinner never appears on navigation | same data read outside the `on` boundary (`LOADING_ON_OUTSIDE_HOLD`) | move the read under the boundary |
| UI frozen after an error | no `<Errored>`; `REACTIVITY_HALTED` | boundary near the root plus local ones |
| App hangs on a mutation | awaiting an on-screen run's cleanup from the replacing transition | signal from the input, not the cleanup |
| `NotReadyError` thrown in an event handler | reading a pending value untracked | `await resolve(() => x())`, or read in JSX |
| SSR projection frozen | `NotReadyError` swallowed by try/catch in a derive | never catch it (Module 05) |

---

## Interview Drill

<details><summary>1. What does "colorless async" mean in Solid 2.0?</summary>

Any computation (memo, projection, writable derived) may return a Promise or AsyncIterable, and consumers read it with the same accessor as a sync value. "Not ready" propagates through the graph as an internal `NotReadyError`, so derived code stays synchronous and types stay `T` instead of `T | undefined`. Boundaries (`<Loading>`, `<Errored>`) turn the state into UI.
</details>

<details><summary>2. Why doesn't `<Loading>` show its fallback again when data refetches?</summary>

It covers branch readiness: once a branch has shown content, a change that makes it pending is held, and the old consistent frame stays until the new data lands. That avoids replacing content with spinners. Use `isPending` for an "updating" hint, or `on={dep()}` when you do want the fallback back for a dependency change.
</details>

<details><summary>3. Contrast `isPending` with 1.x `resource.loading`.</summary>

`.loading` was true for every fetch. `isPending` is true only while a value *change* is in flight: an input changed or `affects()` declared one. A bare `refresh()` or poll is quiet. First load is `false` too, because the boundary owns it. For "saving…" use an optimistic flag.
</details>

<details><summary>4. Why must reads happen before the first `await` in an async memo?</summary>

Tracking is synchronous: the observer is current only during the synchronous part of the run. After an `await` the continuation runs later with no observer, so reads are not recorded and changes never re-run the memo. Dev warns `UNTRACKED_READ_AFTER_AWAIT`.
</details>

<details><summary>5. How do you cancel a superseded fetch?</summary>

Create an `AbortController` and register `onCleanup(() => ac.abort())` before the first `await`. A run that never committed is cleaned up when superseded, so the abort fires. Registered after the `await`, there is no owner and it never runs.
</details>

<details><summary>6. What is `latest()` for?</summary>

Reading the in-flight value of a source while the frame is held, for example to label a spinner with the id being loaded while `id()` still returns the committed one.
</details>

<details><summary>7. `createDeferred` vs a plain async memo?</summary>

A plain async memo holds a change until the new value lands (transition semantics). `createDeferred` lags but never leads: after the first answer it keeps the previous value on screen during refetches instead of holding the write, and `isPending` reports the refetch. Good for results under fast-changing input.
</details>

<details><summary>8. How do errors from async data reach the UI, and how do boundaries recover?</summary>

A rejection makes the computation errored; reads propagate the error to the nearest `<Errored>`, whose fallback gets `err()` and `reset`. `reset()` re-runs the failing branch; a successful re-run after an input change heals the boundary automatically. Uncaught errors halt the system.
</details>

<details><summary>9. When is `loadingValue` appropriate?</summary>

When the real loading UI is the real component with provisional data (placeholder rows, default chart), marked as provisional in the data. It commits the placeholder, never suspends, and keeps `isPending` false during the first flight. If the placeholder can't be shaped like a real answer, use `<Loading>`.
</details>

<details><summary>10. Explain `<Reveal>` sequential vs together.</summary>

Sequential reveals sibling boundaries in DOM order; a later one waits on its fallback until all earlier ones revealed even if its data is ready. Together keeps all fallbacks until every boundary is ready, then reveals at once. `collapsed` shows only the frontier fallback. Nested groups are one slot to their parent.
</details>
