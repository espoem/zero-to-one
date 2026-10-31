# 05 · Concurrency: Lanes, Transitions, Deferred Values & `<Activity>`

> **Track:** `technologies/react` · **React:** 19.3.1 · **Proofs:** [`examples/05-concurrency/concurrency.test.tsx`](../examples/05-concurrency/concurrency.test.tsx), [`examples/05-concurrency/lane-model.ts`](../examples/05-concurrency/lane-model.ts)
>
> **Cross-links.** Tasks, microtasks, `MessageChannel` and where rendering steps happen in the event loop are owned by [languages/javascript](../../../languages/javascript/README.md). Typing `useTransition`/`useDeferredValue` is in [TypeScript M12](../../../languages/typescript/modules/12-react-19-and-modern-react-typescript.md).

"Concurrent React" does not mean threads. JavaScript on the main thread is single-threaded; React is concurrent in the operating-systems sense of **interleaving**: it can start rendering one update, pause, handle something more urgent, and come back — or throw the first render away. This module defines the priority model (**lanes**), the cooperative **scheduler** that slices work, the user-facing APIs (`startTransition`, `useTransition`, `useDeferredValue`, `<Activity>`), and the 19.3 change that made transitions **independent** of each other.

---

## 1. The model

> **Definition 5.1 (Lane).** A lane is a bit position $\ell \in \{0, \dots, 30\}$ in a 31-bit integer. A **lane set** $L$ is a 31-bit mask. Lower bit = higher priority. Every update carries exactly one lane; every fiber and root carries the set of lanes of its pending updates.

> **Definition 5.2 (Render).** A render works on a lane set $R$ (the *render lanes*). It processes exactly the updates whose lane $\in R$ (skipped updates are rebased later, Module 03 §3.3) and commits a tree that reflects those and all previously committed updates.

> **Definition 5.3 (Urgency classes).** Updates are **blocking** (must be reflected in the next frame: typing, clicking) or **non-blocking** (transitions: may be shown later, may be interrupted, must never show a worse UI than the current one).

Bitmasks make the scheduler's set operations single CPU instructions:

| Operation | Expression | Meaning |
|---|---|---|
| merge | $A \mid B$ | union of pending work |
| remove | $A \mathbin{\&} \sim B$ | mark $B$ as done |
| intersects | $(A \mathbin{\&} B) \neq 0$ | does this fiber have work in this render? |
| subset | $(A \mathbin{\&} B) = B$ | |
| highest priority | $A \mathbin{\&} -A$ | lowest set bit (two's complement) |

The test "lowest set bit = highest priority" exercises these with the model in [`lane-model.ts`](../examples/05-concurrency/lane-model.ts).

### 1.1 The lanes of react-dom 19.3.1

Lane values are **internal** and have changed in most minors; the table below is the shipped 19.3.1 layout, and the property test "the model equals react-dom 19.3.1's getHighestPriorityLanes for random lane sets" extracts the real function from the installed build and compares it with the model on 2,000 random lane sets.

| Bits | Lanes | Source of updates |
|---|---|---|
| 0, 2, 4 | `SyncHydration`, `InputContinuousHydration`, `DefaultHydration` | Hydrating with the matching priority |
| 1 | `SyncLane` | Discrete events (click, keydown, input), `flushSync` |
| 3 | `InputContinuousLane` | Continuous events (pointermove, scroll, wheel) |
| 5 | `DefaultLane` | Updates outside events: timers, network callbacks, `root.render` |
| 6 | `GestureLane` | Gesture-driven transitions (experimental API) |
| 7 | `TransitionHydrationLane` | |
| 8–17 | 10 × `TransitionUpdateLanes` | `startTransition`, `useTransition`, Actions — assigned round-robin |
| 18–21 | 4 × `TransitionDeferredLanes` | The background render of `useDeferredValue` |
| 22–25 | 4 × `RetryLanes` | Retrying a suspended Suspense boundary after its data resolved |
| 26 | `SelectiveHydrationLane` | Prioritising hydration of a boundary the user interacted with (Module 06) |
| 27–28 | `IdleHydrationLane`, `IdleLane` | Idle work |
| 29 | `OffscreenLane` | Hidden `<Activity>` content and pre-rendering |
| 30 | `DeferredLane` | Placeholder for deferred work, never rendered on its own |

Two non-obvious rules in `getHighestPriorityLanes` (both tested):

1. **Blocking lanes batch together.** If any of `Sync`, `InputContinuous` or `Default` is pending, the next render takes all of them (`lanes & 42`) — test "blocking lanes … are batched into one render".
2. **Since 19.3 each transition lane renders alone** (`return lanes & -lanes` for bits 8–17). In 19.2.x the same case returned `lanes & TransitionUpdateLanes` — every pending transition together (verified against the 19.2.9 build). See §4.3.

### 1.2 From lanes to work

```text
ENSURE-ROOT-IS-SCHEDULED(root)                           ▷ after every update
  next ← GET-NEXT-LANES(root)                             ▷ highest-priority pending set, minus suspended lanes
  if next = ∅ then cancel callback; return
  if root has a callback for an equal priority then return ▷ reuse it (batching)
  cancel the existing callback                             ▷ a more urgent lane preempts
  if next ∩ SyncUpdateLanes ≠ ∅ then
       schedule PERFORM-SYNC-WORK at the end of the current task (microtask)
  else
       SCHEDULER.scheduleCallback(LANE-TO-PRIORITY(next), PERFORM-CONCURRENT-WORK)

PERFORM-CONCURRENT-WORK(root)
  lanes ← GET-NEXT-LANES(root)
  if lanes ≠ the lanes of the in-progress render then
       PREPARE-FRESH-STACK(root, lanes)                    ▷ restart: throw away the WIP tree
  WORK-LOOP-CONCURRENT()                                   ▷ Module 02 §3.1, yields on SHOULD-YIELD
  if work remains then return PERFORM-CONCURRENT-WORK      ▷ continuation: resume later
  COMMIT-ROOT(root)
```

The two outcomes that make React "concurrent":

- **Resume.** If nothing more urgent arrived, the next slice continues from the saved `workInProgress` pointer.
- **Restart.** If a higher-priority update arrived, `getNextLanes` returns different lanes, React handles the urgent work first (from the *current* tree), and later **restarts** the transition from scratch, because its partial WIP tree was computed against a state that is no longer current. The interrupted work is simply discarded — possible only because render is pure (Module 01 §5).

---

## 2. The scheduler

`scheduler` is a separate package (0.28.0 with React 19.3) implementing a **cooperative, priority-based task queue** for the main thread:

- a **min-heap** of tasks ordered by `expirationTime = startTime + timeout(priority)`, where the timeouts are: Immediate −1 ms (already expired), UserBlocking 250 ms, Normal 5 s, Low 10 s, Idle 2³⁰−1 ms (effectively never);
- one host callback at a time, posted via `MessageChannel` (or `setImmediate` in Node) so it runs as a new task without the 4 ms clamping of nested `setTimeout`;
- `shouldYield()` returns true when the current slice has run longer than `frameInterval` (**5 ms**);
- a task that returns a function is a **continuation**: it stays at the head of the queue with the same priority and is resumed in the next slice.

The deterministic `scheduler/unstable_mock` build (still shipped in 0.28.0, resolving the brief's re-verify item) replaces the clock with a counter: `shouldYield()` becomes true after N values have been passed to `Scheduler.log()`. Tests:

| Property | Test |
|---|---|
| Priority order then FIFO | "callbacks run by priority, then by insertion order" |
| Yield + continuation resumes where it stopped | "a task yields when shouldYield() is true and resumes via a returned continuation" |
| Urgent work is interleaved between slices of a long task | "an urgent task scheduled while a long task has yielded runs before it resumes" → `long 0, long 1, click, long 2 …` |
| Expired tasks run regardless (no starvation) | "starvation guard: an expired low-priority task runs…" |

**Why 5 ms?** At 60 Hz a frame is 16.7 ms; leaving most of it to the browser for input handling, style, layout and paint keeps the page responsive while React makes progress. It is a heuristic, not a guarantee: a single component that takes 50 ms to render still blocks for 50 ms, because React can only yield *between* fibers. Concurrency hides *many small* costs, never *one big* one — split expensive components or move the work off the main thread.

---

## 3. Transitions

### 3.1 API

```tsx
import { startTransition, useTransition } from "react";

startTransition(() => setTab("photos"));           // anywhere, no pending flag

const [isPending, start] = useTransition();         // in a component
start(() => setTab("photos"));
start(async () => {                                 // React 19: async "Actions"
  const data = await save(form);
  startTransition(() => setResult(data));           // updates after await need their own wrapper (see below)
});
```

> **Definition 5.4 (Transition).** A transition is a set of updates enqueued inside a `startTransition` scope, assigned one transition lane. React renders it in the background, may interrupt and restart it, and **does not commit a state in which already-visible content is replaced by a Suspense fallback**; instead it keeps the current UI (and reports `isPending = true`) until the new UI is ready.

### 3.2 What transitions guarantee — tested

| Behaviour | Test |
|---|---|
| While a transition is suspended, the **old content stays** visible and `isPending` is `true` | "useTransition: isPending is true while the transition is outstanding" (`<em>pending</em><i>old</i>`) |
| Without a transition, the same update **replaces content with the fallback** | "NEGATIVE: the same update without a transition replaces content with the fallback" |
| Urgent updates (typing) commit while a transition is pending | "urgent updates are not blocked by a pending transition" |
| 19.3: an unrelated transition commits while another is suspended | "19.3 untangled transitions…" |

The fallback rule has a precise scope: a transition avoids hiding **already-revealed** boundaries. A *new* Suspense boundary that appears for the first time during a transition can still show its fallback — that is how you deliberately show a skeleton for a new section.

### 3.3 Async transitions (React 19)

React 19 lets `startTransition` take an `async` function. All updates made **synchronously inside the scope, and inside the awaited function before the first `await` returns**, share the transition; `isPending` stays true until the returned promise settles. Because of a JavaScript limitation (no async context propagation across `await` in browsers yet — the TC39 `AsyncContext` proposal), **updates after an `await` lose the transition context** and must be wrapped in `startTransition` again:

```tsx
start(async () => {
  await updateName(name);
  startTransition(() => setName(name)); // without this wrapper, this would be a Default-lane update
});
```

Internally, while an async action is outstanding, React keeps an "entangled action lane" (`currentEntangledLane` in the build) so that transitions started *inside the same action scope* share one lane and commit together. Actions, `useActionState` and `useOptimistic` build on this (Module 08).

### 3.4 Then vs now: transition scheduling

| | Then | Now |
|---|---|---|
| ≤17 | No transitions; everything sync or batched-sync | — |
| 18.0 | `startTransition`/`useTransition`, sync callbacks only | — |
| 19.0 | Async functions in transitions ("Actions") | — |
| 19.0–19.2 | All pending transition lanes rendered **together** ("entangled"): a transition suspended on slow data held back every other transition until it resolved | — |
| 19.3 | — | Each transition renders on **its own lane** ([react#37290](https://github.com/react/react/pull/37290)); a slow transition no longer blocks unrelated ones |

**Migration and pitfalls.** This changed in a *minor* release, so test against the version you pin:

- UI that *accidentally* relied on two transitions committing together (e.g. a tab switch and a filter change that should appear atomically) may now show them separately. If two updates must commit together, enqueue them in the **same** `startTransition` call.
- Tests that asserted "B is still old while A suspends" now fail on 19.3; they were asserting the old entanglement.
- Async actions are unaffected: updates in one action scope still share a lane.

---

## 4. `useDeferredValue`

```tsx
function Search({ query }: { query: string }) {
  const deferredQuery = useDeferredValue(query);        // or useDeferredValue(query, initialValue)
  const isStale = query !== deferredQuery;
  return <Results query={deferredQuery} dim={isStale} />;
}
```

> **Definition 5.5.** `useDeferredValue(v)` returns, during an urgent render, the value from the previous commit; it then schedules a background render (on a `TransitionDeferredLane`) in which it returns `v`. If `v` changes again before that render finishes, the background render is restarted with the newest value.

Test "renders first with the stale value, then again with the new value in the background" logs exactly `query=ab deferred=a` then `query=ab deferred=ab`. With an **initial value** (React 19), the very first render uses it and the real value is rendered in the background — test "initialValue (React 19)…" logs `""` then `"react"`. This is the pattern for "show a cheap placeholder on mount, then the expensive version".

**Transition vs deferred value.** Use a transition when you own the `setState` call; use a deferred value when you only receive the value (a prop) or when the urgent and non-urgent consumers of the *same* state differ (the input shows `query` instantly; the list renders `deferredQuery`). Neither debounces: React does no work for skipped values only because it restarts; it does not wait a fixed time. To avoid network requests per keystroke you still need a debounce or a cache.

For the deferred render to be cheap to interrupt, the expensive child must **bail out** when the deferred value is unchanged — wrap it in `memo` or let the React Compiler memoise it. Otherwise the urgent render re-renders the expensive list with the old value anyway, and nothing is gained.

19.3 fixed a bug where `useDeferredValue` could get stuck on an old value ([react#36134](https://github.com/react/react/pull/36134)).

---

## 5. `<Activity>`: hidden, not unmounted

[`<Activity mode="visible" \| "hidden">`](https://react.dev/reference/react/Activity) (stable since **19.2**, internally `ActivityComponent`, tag 31; legacy Suspense offscreen uses `OffscreenComponent`, tag 22) is a third option between rendering and not rendering:

| | `{cond && <Page/>}` | `<Activity mode={cond ? "visible" : "hidden"}>` |
|---|---|---|
| State when hidden | Destroyed | **Kept** |
| DOM when hidden | Removed | Kept, styled `display: none !important` |
| Effects when hidden | Cleaned up (unmounted) | **Cleaned up** (Module 04 §8) |
| Updates when hidden | n/a | Processed at `OffscreenLane` (idle-like) priority, after everything else |
| Coming back | Mount from scratch | Re-run effects; state and DOM already there |

Tests: "hidden content keeps state and DOM, unmounts effects, and resumes when visible"; "NEGATIVE: conditional rendering destroys the state…"; "content that starts hidden is pre-rendered (state exists) but effects do not run" — the **pre-rendering** use case: render the likely next screen at idle priority so navigation is instant, without running its effects (no subscriptions, no fetch-in-effect) until it becomes visible.

**Data fetching caveat.** Pre-rendering helps only with data loaded during render (Suspense-enabled sources, `use`, Server Components). Data fetched in effects will not load while hidden, because effects do not run.

**19.3 fixes worth knowing:** errors thrown inside a hidden `<Activity>` no longer escape to boundaries outside it ([react#35074](https://github.com/react/react/pull/35074), Module 10); portals inside a hidden `<Activity>` are now hidden too; `useSyncExternalStore` no longer misses store mutations made while hidden; `<title>` inside a hidden `<Activity>` is no longer hoisted; and `<Activity>` is supported in Server Components (Flight). If you depended on the old behaviour (e.g. an error boundary *outside* the Activity catching errors of hidden content), it changed in a minor.

> **Then vs now.** Before 19.2 the only way to "keep state while hidden" was CSS hiding (`style={{display: cond ? "" : "none"}}`), which keeps effects running (timers, subscriptions on invisible UI), or lifting state out of the hidden component. Both remain valid; `<Activity>` gives the effect semantics and priority that CSS hiding cannot. The unstable `unstable_Offscreen`/`unstable_Activity` names from canary builds are gone.

---

## 6. What concurrency cannot do

1. **It cannot interrupt a single slow component.** Yielding happens between fibers.
2. **It cannot make commits cheaper.** Commit is synchronous (Module 02 §6); 10,000 DOM mutations block regardless of lanes.
3. **It does not apply to external stores.** Updates from `useSyncExternalStore` are always synchronous (Module 03 §7).
4. **It does not reduce total work.** It reorders work for responsiveness and may *increase* total work (restarts).
5. **It does not debounce.** See §4.

When the Performance panel shows long tasks, the fix is usually smaller components, memoisation (Compiler), virtualisation, or moving computation off the main thread — Module 12 shows how to read **Performance Tracks** (19.2), which label each render by lane group (*Blocking*, *Transition*, *Suspense*, *Idle* tracks).

---

## 7. Production failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Typing lags while a big list re-renders | The list re-renders in the urgent update | Render the list with `useDeferredValue` and memoise it, or put its update in a transition |
| Content flashes to a spinner on tab switch | The update is not a transition | Wrap in `startTransition` |
| A transition never finishes (`isPending` stuck) | A promise used in render is never resolved, or a new one is created each render (Module 06) | Cache promises; add timeouts |
| State update after `await` in an action is not part of the transition | Lost transition context across `await` | Wrap post-`await` updates in `startTransition` |
| After upgrading to 19.3, two related updates appear one after the other | Untangled transitions | Put them in the same `startTransition` |
| Hidden tab still polling/subscribed | CSS hiding instead of `<Activity>` | `<Activity mode="hidden">` |
| Hidden pre-rendered page shows empty data when revealed | Data fetched in effects | Fetch during render (Suspense) or in a loader |
| UI shows mixed versions of global store | Store read without `useSyncExternalStore` | Module 03 |

---

## 8. Executable proofs

| Claim | Test (`concurrency.test.tsx`) |
|---|---|
| Lane algebra; model = shipped 19.3.1 function (property test, 2,000 runs) | "lanes: a bitmask algebra…" (4 tests) |
| 19.3 untangled lanes vs 19.2 entangled (model) | "19.3: two pending transition lanes are rendered separately" |
| Scheduler priority, yield/continuation, interleaving, expiry | "the scheduler…" (4 tests) |
| Transitions keep old UI; non-transition shows fallback; urgent updates proceed; untangled commit | "transitions" (4 tests) |
| `useDeferredValue` double render and `initialValue` | "useDeferredValue" (2 tests) |
| `<Activity>` keeps state/DOM, cleans effects, pre-renders | "<Activity>…" (3 tests) |

---

## 9. Interview Drill

<details><summary><strong>1. What is a lane and why a bitmask?</strong></summary>

A lane is one bit in a 31-bit mask representing a priority/batch; each update has one lane, fibers and roots carry the union of their pending lanes. Bitmasks make union, removal, intersection and "highest priority" (`lanes & -lanes`) single instructions, and allow batching several priorities into one render — something the earlier single `expirationTime` number could not express.
</details>

<details><summary><strong>2. How does React yield, and what happens to an interrupted render?</strong></summary>

The concurrent work loop checks `shouldYield()` (5 ms slices) between fibers and returns a continuation to the scheduler. If no more urgent work arrived, the next slice resumes from the saved `workInProgress`. If a higher-priority update arrived, React renders and commits it first and later restarts the transition from scratch; the partial work is discarded.
</details>

<details><summary><strong>3. What exactly does <code>startTransition</code> change in the UI?</strong></summary>

Its updates get a transition lane: they render in the background, can be interrupted, and React will not replace already-visible content with a Suspense fallback — it keeps the old UI and reports `isPending` until the new UI is ready. Urgent updates (typing) are processed in between.
</details>

<details><summary><strong>4. What changed with transitions in React 19.3?</strong></summary>

Transitions became independent: each transition lane renders on its own, so a transition suspended on slow data no longer blocks unrelated transitions. Before (19.0–19.2), all pending transition lanes were rendered together. Updates that must appear together should be in one `startTransition`.
</details>

<details><summary><strong>5. Why must updates after an <code>await</code> inside an async transition be wrapped again?</strong></summary>

React tracks the current transition in a synchronous scope; JavaScript has no async context propagation across `await` (AsyncContext is still a proposal), so code after the `await` runs outside the scope and its updates would get a default lane. Wrap them in `startTransition`.
</details>

<details><summary><strong>6. <code>useDeferredValue</code> vs debouncing?</strong></summary>

`useDeferredValue` renders immediately with the old value and then in the background with the new one, restarting if the value changes again; no fixed delay and no work for values that are skipped, but it does not reduce network requests. Debouncing delays the update by a fixed time and reduces requests but adds latency even on fast devices. They are often combined: debounce the fetch, defer the rendering.
</details>

<details><summary><strong>7. How is <code>&lt;Activity mode="hidden"&gt;</code> different from <code>display: none</code> and from conditional rendering?</strong></summary>

Conditional rendering destroys state and DOM. CSS hiding keeps state, DOM and running effects. `<Activity>` keeps state and DOM but unmounts effects and processes updates at the lowest (offscreen) priority, enabling pre-rendering without side effects.
</details>

<details><summary><strong>8. Your search input lags when the result list is large. Walk through the fix.</strong></summary>

Profile first. If the list re-renders on each keystroke, keep `query` urgent for the input, pass `useDeferredValue(query)` to the list, and make sure the list bails out when its prop is unchanged (`memo` or Compiler). If a single row is slow, concurrency won't help: optimise or virtualise. Optionally debounce fetching and show `query !== deferredQuery` as a stale indicator.
</details>

<details><summary><strong>9. What can concurrent rendering not fix?</strong></summary>

A single slow component (no yielding inside a fiber), expensive commits (synchronous DOM mutation), external-store updates (always sync), and total CPU cost (concurrency can increase it through restarts).
</details>
