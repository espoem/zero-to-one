# SolidJS 2.0 — Senior Frontend Interview Question Bank

60 original questions across the seven domains in [README.md](./README.md#domain--module-coverage-matrix). Difficulty: **1** = screen, **2** = typical senior loop, **3** = harder than most loops. Hands-on tasks name the test that verifies the solution; run it with `npm test -- <file>`.

Official references used throughout:
- RFCs: `https://github.com/solidjs/solid/tree/next/documentation/solid-2.0` (cited as *RFC NN*)
- Package cheatsheet: `node_modules/solid-js/CHEATSHEET.md` (rc.19)
- API docs: `https://v2.solidjs.com/reference/...`

---

## D1 · Reactive core & effects (12)

### Q-SOLID-001 · D1 · difficulty 1 · single
After `const [n, setN] = createSignal(0); setN(1);`, what does `n()` return on the next line, with no `flush()`?
- A) `1`
- B) `0`
- C) `undefined`
- D) it throws `NotReadyError`
<details><summary>Answer</summary>

**B.** Writes are staged and committed at the next microtask or `flush()`; reads return the last committed value.
- Why not A: that is 1.x behaviour (synchronous writes).
- Why not C: the committed value is `0`.
- Why not D: `NotReadyError` is for pending async values.
- Ref: [modules/01-reactive-core.md](../modules/01-reactive-core.md#3-signals), RFC 01 "flush and microtask batching"
</details>

### Q-SOLID-002 · D1 · difficulty 2 · single
`a` feeds memos `b = a + 1` and `c = a * 10`; memo `d` reads `b` and `c`. After `setA(2); flush()`, how many times did `d` run in total (including creation), and which pairs did it see?
- A) 3 runs: `(2,10)`, `(3,10)`, `(3,20)`
- B) 2 runs: `(2,10)`, `(3,20)`
- C) 2 runs: `(2,10)`, `(2,20)`
- D) 1 run: `(2,10)`
<details><summary>Answer</summary>

**B.** Solid evaluates dirty nodes in height order after committing all writes, so `d` re-runs once and only sees a consistent snapshot (glitch freedom).
- Why not A: that is the glitch a naive push system produces.
- Why not C: `b` is already updated when `d` runs.
- Why not D: `d` depends on `a` transitively and must re-run.
- Ref: [modules/01-reactive-core.md](../modules/01-reactive-core.md#2-formal-definitions), test "diamond dependency" in `examples/typescript/01-reactive-core.test.ts`
</details>

### Q-SOLID-003 · D1 · difficulty 2 · multi
Which statements about `createMemo(fn, { lazy: true })` are true? (Choose 2.)
- A) `fn` does not run until the memo is first read.
- B) It recomputes on every read.
- C) When it loses its last subscriber it is torn down and recomputed from scratch on the next read.
- D) It cannot be async.
<details><summary>Answer</summary>

**A, C.** `lazy` defers the first compute and opts into autodisposal.
- Why not B: it is cached like any memo while observed.
- Why not D: any memo may return a Promise.
- Ref: [modules/01-reactive-core.md](../modules/01-reactive-core.md#41-lazy-memos-and-autodisposal), RFC 01 "Lazy memos"
</details>

### Q-SOLID-004 · D1 · difficulty 2 · single
Inside a component body you write `untrack(() => setCount(1))`. What happens in the dev build?
- A) Nothing; `untrack` makes the write safe.
- B) It throws `REACTIVE_WRITE_IN_OWNED_SCOPE`.
- C) It warns `STRICT_READ_UNTRACKED`.
- D) The write is silently dropped.
<details><summary>Answer</summary>

**B.** The guard checks the ambient owner; `untrack` only stops dependency tracking.
- Why not A: that confuses tracking with ownership.
- Why not C: that warning is about reads.
- Why not D: it throws in dev; production does not check.
- Ref: [modules/01-reactive-core.md](../modules/01-reactive-core.md#7-invariant-no-writes-inside-an-owned-scope), RFC 01 "No writes under owned scope"
</details>

### Q-SOLID-005 · D1 · difficulty 2 · single
`const [v, setV] = createSignal(() => src() * 10)`. You call `setV(5)`, flush, then `setSrc(2)` and flush. What is `v()`?
- A) `5`
- B) `20`
- C) `50`
- D) it throws: writable memos are read-only
<details><summary>Answer</summary>

**B.** A write lands immediately and never re-runs `fn`; a source change re-runs `fn`, which receives the write as `prev` and here ignores it.
- Why not A: the source change re-derived.
- Why not C: `fn` does not multiply `prev`.
- Why not D: function-form `createSignal` is the writable derived primitive.
- Ref: [modules/01-reactive-core.md](../modules/01-reactive-core.md#5-writable-derived-values-createsignalfn), RFC 02 "Function-form createSignal"
</details>

### Q-SOLID-006 · D1 · difficulty 2 · single
In Solid 2.0, what happens to a `createRoot` created inside a component when the component is disposed?
- A) It lives on until its own `dispose` is called.
- B) It is disposed with the component.
- C) It is moved to the document root.
- D) It throws `RUN_WITH_DISPOSED_OWNER`.
<details><summary>Answer</summary>

**B.** Roots are owned by their parent by default in 2.0. Detach explicitly with `runWithOwner(null, …)`.
- Why not A: that was 1.x behaviour.
- Why not C: there is no such mechanism.
- Why not D: that warning is for `runWithOwner` with a disposed owner.
- Ref: [modules/01-reactive-core.md](../modules/01-reactive-core.md#6-ownership-who-disposes-what), RFC 02
</details>

### Q-SOLID-007 · D1 · difficulty 2 · ordering
When an effect re-runs following a reactive update in Solid 2.0, what is the exact chronological execution sequence?
- 1: Signal write stages dirty marks in the reactive graph
- 2: Effect compute phase `compute()` re-runs and produces next state
- 3: Previous run's cleanup function executes
- 4: New apply phase `apply()` executes with the computed value

Sequence options:
- A) 1 → 2 → 3 → 4
- B) 1 → 3 → 2 → 4
- C) 3 → 1 → 2 → 4
- D) 2 → 1 → 4 → 3
<details><summary>Answer</summary>

**A.** (1 → 2 → 3 → 4). A signal write stages dirty marks in the graph (1); when scheduled, the pure compute phase `compute()` evaluates (2); if compute succeeds, the previous run's cleanup executes (3); finally, the new apply phase `apply()` executes with the new value (4).
- Why not B: The previous cleanup runs only after the new compute successfully returns.
- Why not C: Dirty marks are staged before any effect runs.
- Why not D: Compute cannot run before dirty marking, and apply cannot precede cleanup.
- Ref: [modules/02-effects-and-lifecycle.md](../modules/02-effects-and-lifecycle.md#11-formal-contract), RFC 01 "Split tracking from effect"
</details>

### Q-SOLID-008 · D1 · difficulty 1 · single
Which is the Solid 2.0 replacement for 1.x `onMount(() => { const id = setInterval(t, 1000); onCleanup(() => clearInterval(id)); })`?
- A) `createEffect(() => { const id = setInterval(t, 1000); onCleanup(() => clearInterval(id)); })`
- B) `onSettled(() => { const id = setInterval(t, 1000); return () => clearInterval(id); })`
- C) `onSettled(() => { const id = setInterval(t, 1000); onCleanup(() => clearInterval(id)); })`
- D) `createRenderEffect(() => setInterval(t, 1000))`
<details><summary>Answer</summary>

**B.** `onSettled` runs after the first settle and its returned function runs on disposal.
- Why not A: single-argument `createEffect` throws `MISSING_EFFECT_FN`.
- Why not C: `onCleanup` inside `onSettled` throws `CLEANUP_IN_FORBIDDEN_SCOPE`.
- Why not D: one-argument render effect and no cleanup.
- Ref: [modules/02-effects-and-lifecycle.md](../modules/02-effects-and-lifecycle.md#31-onsettled--the-canonical-lifecycle-primitive)
</details>

### Q-SOLID-009 · D1 · difficulty 3 · scenario
A menu calls `setOpen(false)` and then `props.onSelect(id)`; the consumer navigates, which loads data. Users report the menu stays open until the next page appears. What is the cause and fix?
- A) Event delegation delays the click; use a native listener.
- B) `setOpen(false)` is held together with the navigation's async work; write it in `onFlush(() => setOpen(false))`.
- C) `setOpen` needs `flush()` immediately after it.
- D) Use `queueMicrotask(() => setOpen(false))`.
<details><summary>Answer</summary>

**B.** Writes in one frame commit together; the navigation's pending data holds the whole frame. `onFlush` runs after the pending flush, so its write is its own update.
- Why not A: delegation is synchronous.
- Why not C: an early `flush()` applies the write but also runs every pending effect early; `onFlush` is the designed tool.
- Why not D: queued before the frame's first write, the microtask runs before that flush and its write joins the hold.
- Ref: [modules/02-effects-and-lifecycle.md](../modules/02-effects-and-lifecycle.md#33-onflush--keep-a-write-out-of-someone-elses-hold), RFC 01 "onFlush"
</details>

### Q-SOLID-010 · D1 · difficulty 2 · multi
Which diagnostics are **errors** (throw in dev)? (Choose 3.)
- A) `REACTIVE_WRITE_IN_OWNED_SCOPE`
- B) `STRICT_READ_UNTRACKED`
- C) `MISSING_EFFECT_FN`
- D) `CLEANUP_IN_FORBIDDEN_SCOPE`
- E) `NO_OWNER_EFFECT`
<details><summary>Answer</summary>

**A, C, D.**
- Why not B: warning; the read just won't track.
- Why not E: warning; the effect leaks.
- Ref: [modules/02-effects-and-lifecycle.md](../modules/02-effects-and-lifecycle.md#4-invariants-enforced-in-development), RFC 08
</details>

### Q-SOLID-011 · D1 · difficulty 3 · scenario
An effect apply half throws an uncaught `TypeError` and there is no `<Errored>` anywhere. What happens next?
- A) The effect is skipped and retried on the next change.
- B) The error goes to the effect's `error` arm if one exists.
- C) The reactive system halts (`REACTIVITY_HALTED`) and no further updates are processed.
- D) Only that component stops updating.
<details><summary>Answer</summary>

**C.** Apply-phase throws are application errors; with no boundary the scheduler stops for good and the cause goes to `reportError`.
- Why not A: that describes compute-phase errors without an `error` arm.
- Why not B: the `error` arm handles compute-phase errors only.
- Why not D: the halt is global.
- Ref: [modules/02-effects-and-lifecycle.md](../modules/02-effects-and-lifecycle.md#14-error-handling-the-effectbundle)
</details>

### Q-SOLID-012 · D1 · difficulty 2 · hands-on
Write a unit test that proves a memo recomputes once for three writes made before a flush. Constraints: no write may happen inside the `createRoot` callback.
<details><summary>Answer</summary>

Build the graph in the root, return the setter, write three times outside, `flush()`, assert the run counter went from 1 to 2.

```ts
const { doubled, runs, setCount, dispose } = createRoot((dispose) => {
  const [count, setCount] = createSignal(0);
  let runs = 0;
  const doubled = createMemo(() => (runs++, count() * 2));
  return { doubled, runs: () => runs, setCount, dispose };
});
setCount(1); setCount(2); setCount(3);
flush();
expect(doubled()).toBe(6);
expect(runs()).toBe(2);
dispose();
```
- Verification: `examples/typescript/01-reactive-core.test.ts`, test "non-lazy memos compute eagerly at creation and once per commit".
- Ref: [modules/09-testing-debugging-performance.md](../modules/09-testing-debugging-performance.md#12-unit-testing-the-graph)
</details>

## D2 · Components, DOM & control flow (9)

### Q-SOLID-013 · D2 · difficulty 1 · single
`<Counter value={count} />` where `count` is a signal accessor. What does `Counter` receive in `props.value`?
- A) the number
- B) the accessor function
- C) `undefined`
- D) a compile error
<details><summary>Answer</summary>

**B.** Props are values; the parent must call the accessor: `value={count()}`. The compiled getter then reads it lazily in the child.
- Why not A: nothing calls the accessor for you.
- Why not C/D: it compiles and passes the function.
- Ref: [modules/03-components-props-and-dom.md](../modules/03-components-props-and-dom.md#rule-1--at-the-call-site-pass-the-value), package CHEATSHEET "Props"
</details>

### Q-SOLID-014 · D2 · difficulty 2 · single
Why does `function Title({ title }) { return <h1>{title}</h1>; }` never update?
- A) Destructuring calls every prop getter once, in the untracked component body.
- B) `h1` text is static in Solid.
- C) Props are frozen with `Object.freeze`.
- D) The compiler drops destructured parameters.
<details><summary>Answer</summary>

**A.** Dev also warns `STRICT_READ_UNTRACKED`.
- Ref: [modules/03-components-props-and-dom.md](../modules/03-components-props-and-dom.md#rule-2--in-the-child-read-propsx-where-you-need-it-never-destructure)
</details>

### Q-SOLID-015 · D2 · difficulty 2 · single
`const p = merge({ size: "md" }, props)` and the parent renders `<Button size={undefined} />`. What is `p.size`?
- A) `"md"`
- B) `undefined`
- C) `null`
- D) it throws
<details><summary>Answer</summary>

**B.** In 2.0 `undefined` is a real value that overrides; 1.x `mergeProps` skipped it.
- Ref: [modules/03-components-props-and-dom.md](../modules/03-components-props-and-dom.md#21-merge-and-omit), RFC 04 "merge"
</details>

### Q-SOLID-016 · D2 · difficulty 3 · scenario
An input bound as `<input class={{ error: invalid() }} value={props.name} />` loses what the user typed whenever validation toggles `invalid`. Explain and fix.
- A) Event delegation resets inputs; use `onInput` natively.
- B) Attributes of one template share a grouped effect; toggling `class` re-runs it and rewrites `value` over uncommitted text. Keep typing in a draft signal and commit on change.
- C) `value` is an attribute, so use `defaultValue` always.
- D) Add `equals: false` to the name signal.
<details><summary>Answer</summary>

**B.** Dev warns `UNCOMMITTED_INPUT_OVERWRITTEN`.
- Why not A: delegation is unrelated.
- Why not C: uncontrolled inputs are one valid alternative, but `value` is handled as a property and the root cause is the grouped re-run.
- Why not D: re-asserting equal values is exactly what the diagnostic reports.
- Ref: [modules/03-components-props-and-dom.md](../modules/03-components-props-and-dom.md#6-form-inputs-not-strictly-controlled), RFC 07 "Form inputs"
</details>

### Q-SOLID-017 · D2 · difficulty 2 · single
Which replaces `<div use:tooltip={{ text: "Save" }} />`?
- A) `<div ref={tooltip({ text: "Save" })} />`
- B) `<div directive:tooltip={{ text: "Save" }} />`
- C) `<div tooltip={{ text: "Save" }} />`
- D) `<div use={[tooltip, { text: "Save" }]} />`
<details><summary>Answer</summary>

**A.** Directives are ref factories; `use:` is a compile error that names this replacement.
- Ref: [modules/03-components-props-and-dom.md](../modules/03-components-props-and-dom.md#5-refs-and-directives), RFC 07
</details>

### Q-SOLID-018 · D2 · difficulty 2 · single
In `<For each={items()} keyed={false}>{(item, i) => …}</For>`, what are `item` and `i`?
- A) raw value, accessor
- B) accessor, plain number
- C) both accessors
- D) both raw values
<details><summary>Answer</summary>

**B.** Non-keyed rows are slots: the index is stable, the item can change.
- Why not A: that is the default (identity-keyed) mode.
- Why not C: that is the custom-key mode.
- Ref: [modules/04-control-flow-and-composition.md](../modules/04-control-flow-and-composition.md#2-for-one-list-primitive-three-keying-modes)
</details>

### Q-SOLID-019 · D2 · difficulty 2 · scenario
A polled list re-creates every row (focus lost, animations restart) although the data is identical. Which two fixes work? (Choose 2.)
- A) `keyed={(row) => row.id}` on `<For>`
- B) reconcile the response into a store with `reconcile(data, "id")`
- C) wrap the list in `<Loading>`
- D) switch to `<Repeat>`
<details><summary>Answer</summary>

**A, B.** Default `<For>` keys by identity; fresh objects are new keys.
- Why not C: unrelated to identity.
- Why not D: `<Repeat>` renders by count and doesn't map data at all.
- Ref: [modules/04-control-flow-and-composition.md](../modules/04-control-flow-and-composition.md#21-how-keyed-mapping-works)
</details>

### Q-SOLID-020 · D2 · difficulty 2 · single
`const Ctx = createContext<Session | undefined>(undefined);` and a component calls `useContext(Ctx)` with no provider. What happens?
- A) returns `undefined`
- B) throws `ContextNotFoundError`
- C) returns `null`
- D) compile error
<details><summary>Answer</summary>

**B.** `undefined` means "not provided"; this is still a default-less context. Use `null` for optional contexts.
- Ref: [modules/04-control-flow-and-composition.md](../modules/04-control-flow-and-composition.md#7-context), RFC 02
</details>

### Q-SOLID-021 · D2 · difficulty 3 · hands-on
Implement a field component whose `value` binding survives unrelated attribute changes in the same template, and commits on `change`. Verify that toggling a class after typing keeps the typed text.
<details><summary>Answer</summary>

Draft pattern: `const [draft, setDraft] = createSignal(untrack(() => props.name));` with `value={draft()}`, `onInput={(e) => setDraft(e.currentTarget.value)}`, `onChange={() => props.onCommit(draft())}`.
- Verification: `examples/typescript/03-components-props-and-dom.test.tsx`, test "draft pattern: the binding always mirrors the box".
- Ref: [modules/03-components-props-and-dom.md](../modules/03-components-props-and-dom.md#6-form-inputs-not-strictly-controlled)
</details>

## D3 · Stores & projections (6)

### Q-SOLID-022 · D3 · difficulty 1 · single
Which is the canonical 2.0 store update?
- A) `setStore("user", "name", "B")`
- B) `setStore(produce((s) => { s.user.name = "B"; }))`
- C) `setStore((s) => { s.user.name = "B"; })`
- D) `store.user.name = "B"`
<details><summary>Answer</summary>

**C.** Draft-first setters.
- Why not A: path setters are gone (optional `storePath` helper exists in `@solidjs/signals`).
- Why not B: `produce` is removed; it is the default behaviour.
- Why not D: writes through the proxy are ignored (`STORE_WRITE_OUTSIDE_SETTER`).
- Ref: [modules/05-stores-and-projections.md](../modules/05-stores-and-projections.md#2-draft-first-setters)
</details>

### Q-SOLID-023 · D3 · difficulty 2 · single
What does returning a value from a store setter do?
- A) a keyed reconcile of the whole tree
- B) a shallow replacement: arrays by index and length, objects by top-level diff
- C) nothing; return values are ignored
- D) it replaces the store proxy identity
<details><summary>Answer</summary>

**B.** Keyed reconciliation needs `reconcile` or a projection.
- Ref: [modules/05-stores-and-projections.md](../modules/05-stores-and-projections.md#21-returning-a-value-shallow-replacement), RFC 04
</details>

### Q-SOLID-024 · D3 · difficulty 3 · scenario
A table of 10 000 rows highlights the selected row with `class={{ selected: selectedId() === row.id }}`. Selecting a row janks. What is the asymptotic problem and the 2.0 fix?
- A) O(n) bindings depend on `selectedId`; use a selection projection so only the two affected rows' slots notify (O(1)).
- B) DOM reflow; use `requestAnimationFrame`.
- C) Too many components; merge rows into one component.
- D) Use `createDeferred(selectedId)`.
<details><summary>Answer</summary>

**A.** Each row subscribes to its own projection slot; a change touches two slots.
- Why not D: deferring delays the same O(n) work.
- Ref: [modules/05-stores-and-projections.md](../modules/05-stores-and-projections.md#41-o1-selection), test "selection projection" (re-runs exactly 2 of 1000)
</details>

### Q-SOLID-025 · D3 · difficulty 2 · multi
`snapshot(store)` vs `deep(store)`: which are true? (Choose 2.)
- A) Both return plain objects.
- B) `snapshot` subscribes to every property.
- C) `deep` belongs in an effect's compute half when any nested change must re-run it.
- D) `deep` returns a proxy.
<details><summary>Answer</summary>

**A, C.** `snapshot` is untracked (serialization); `deep` tracks everything.
- Ref: [modules/05-stores-and-projections.md](../modules/05-stores-and-projections.md#5-plain-copies-snapshot-and-deep)
</details>

### Q-SOLID-026 · D3 · difficulty 3 · single
A projection's derive wraps its reads in `try { … } catch { /* ignore */ }`. It works in the browser but on the server the projection freezes at a partial result. Why?
- A) The server build has no projections.
- B) The catch swallows `NotReadyError`, which is the server build's only re-derive channel.
- C) Server rendering is synchronous.
- D) `try/catch` is not allowed in reactive code.
<details><summary>Answer</summary>

**B.** Use `isPending()` to branch on readiness instead.
- Ref: [modules/05-stores-and-projections.md](../modules/05-stores-and-projections.md#42-async-and-subscriptions-in-projections), RFC 04
</details>

### Q-SOLID-027 · D3 · difficulty 2 · hands-on
Prove that `reconcile(data, "id")` keeps an observed row's identity while reordering, and that only the changed leaf notifies.
<details><summary>Answer</summary>

Observe row 1 through a memo, reconcile a reordered array with one changed field, assert the memo returns the same object and the changed field's memo re-ran.
- Verification: `examples/typescript/05-stores-and-projections.test.ts`, test "reconcile(data, 'id') preserves the identity of surviving rows that are observed".
- Ref: [modules/05-stores-and-projections.md](../modules/05-stores-and-projections.md#3-reconcile-diffing-new-data-into-a-store)
</details>

## D4 · Async, transactions & optimistic state (12)

### Q-SOLID-028 · D4 · difficulty 1 · single
What replaces `const [user] = createResource(id, fetchUser)` in 2.0?
- A) `const user = createAsync(() => fetchUser(id()))` from `solid-js`
- B) `const user = createMemo(() => fetchUser(id()))`, read under `<Loading>`
- C) `const [user] = createResource(...)` is unchanged
- D) `const user = await fetchUser(id())` in the component body
<details><summary>Answer</summary>

**B.** Any computation may return a Promise; readers suspend to `<Loading>`.
- Why not A: `createAsync` is not a `solid-js` 2.0 export.
- Why not C: removed.
- Why not D: components are synchronous setup functions.
- Ref: [modules/06-colorless-async.md](../modules/06-colorless-async.md#1-the-model), RFC 05
</details>

### Q-SOLID-029 · D4 · difficulty 2 · single
A profile has rendered. The user id changes and the new profile is loading. With `<Loading fallback={<Spinner/>}>` (no `on`), what does the user see?
- A) the spinner until the new profile lands
- B) the old profile (and `isPending(() => user())` is `true`) until the new profile lands
- C) an empty box
- D) the new id next to the old profile
<details><summary>Answer</summary>

**B.** `<Loading>` covers first load; later changes are held and the old consistent frame stays.
- Why not A: that needs `on={id()}`.
- Why not D: holds prevent torn frames.
- Ref: [modules/06-colorless-async.md](../modules/06-colorless-async.md#2-loading-branch-readiness-not-is-fetching)
</details>

### Q-SOLID-030 · D4 · difficulty 2 · single
Which makes `isPending(() => user())` read `true`?
- A) `refresh(user)` from a button
- B) a 30-second poll that re-runs the same fetch
- C) `affects(user); refresh(user)`
- D) the very first load under `<Loading>`
<details><summary>Answer</summary>

**C.** A bare re-ask is quiet; `affects` declares the change. First load belongs to the boundary.
- Ref: [modules/06-colorless-async.md](../modules/06-colorless-async.md#31-ispendingfn), RFC 05 "isPending"
</details>

### Q-SOLID-031 · D4 · difficulty 2 · single
```ts
const items = createMemo(async () => {
  const res = await fetchItems();
  return res.filter((i) => i.tag === query());
});
```
What is wrong?
- A) nothing
- B) `query()` is read after the `await`, so it is not a dependency (`UNTRACKED_READ_AFTER_AWAIT`)
- C) async memos cannot filter
- D) `fetchItems` must be wrapped in `from()`
<details><summary>Answer</summary>

**B.** Read inputs before the first `await`.
- Ref: [modules/06-colorless-async.md](../modules/06-colorless-async.md#12-tracking-stops-at-the-first-await)
</details>

### Q-SOLID-032 · D4 · difficulty 3 · scenario
Search-as-you-type fires a request per keystroke and stale requests keep running. Which implementation cancels superseded requests?
- A) `createMemo(async () => { const q = query(); await debounce(); const ac = new AbortController(); onCleanup(() => ac.abort()); return fetch(url(q), { signal: ac.signal }); })`
- B) `createMemo(async () => { const ac = new AbortController(); onCleanup(() => ac.abort()); return fetch(url(query()), { signal: ac.signal }); })`
- C) `createEffect(() => query(), (q) => fetch(url(q)))`
- D) wrap the fetch in `untrack`
<details><summary>Answer</summary>

**B.** Cleanup must be registered before the first `await`, while the owner is current; a superseded uncommitted run is cleaned up.
- Why not A: `onCleanup` after the `await` has no owner and never runs.
- Why not C: an effect can't feed a value to the UI, and nothing aborts.
- Ref: [modules/06-colorless-async.md](../modules/06-colorless-async.md#4-cancellation), tests in `06-colorless-async.test.tsx` (positive and negative)
</details>

### Q-SOLID-033 · D4 · difficulty 3 · scenario
A page shows `comments().length` in the header (under its own `<Loading>`) and the comments list under `<Loading on={postId()}>`. On navigation the list's spinner never appears. Why?
- A) `on` must be a function
- B) the same data is read outside the boundary, so that read holds the frame until the data lands (`LOADING_ON_OUTSIDE_HOLD`)
- C) `on` compares values and the ids are equal
- D) spinners under 150 ms are suppressed
<details><summary>Answer</summary>

**B.** Move the header read under the same boundary.
- Why not A: `on` takes a value; a function would never notify.
- Why not C: `on` never compares.
- Why not D: `FALLBACK_FLASH` is an info finding, not suppression.
- Ref: [modules/06-colorless-async.md](../modules/06-colorless-async.md#22-on-show-the-fallback-again)
</details>

### Q-SOLID-034 · D4 · difficulty 2 · single
In `<Reveal>` (default order) with boundaries A then B, B's data resolves first. What is shown?
- A) B's content, A's fallback
- B) both fallbacks until A resolves
- C) both contents
- D) nothing
<details><summary>Answer</summary>

**B.** Sequential reveal: later boundaries wait for earlier ones.
- Ref: [modules/06-colorless-async.md](../modules/06-colorless-async.md#23-reveal-coordinating-siblings), RFC 03
</details>

### Q-SOLID-035 · D4 · difficulty 2 · single
How does an `<Errored>` boundary recover after its data source failed?
- A) only by remounting the app
- B) `reset()` re-runs the failing branch, and a later successful run (e.g. after an input change) heals it automatically
- C) `resetErrorBoundaries()`
- D) it never recovers
<details><summary>Answer</summary>

**B.** `resetErrorBoundaries` is removed; boundaries self-heal.
- Ref: [modules/06-colorless-async.md](../modules/06-colorless-async.md#5-errors)
</details>

### Q-SOLID-036 · D4 · difficulty 2 · single
Why are 2.0 actions written as generators (`action(function* () { … yield api.save(); … })`)?
- A) generators are faster than promises
- B) `yield` lets the runtime await and resume inside the same transaction, which `await` would lose without AsyncContext
- C) to support IE11
- D) generators can be cancelled by the browser
<details><summary>Answer</summary>

**B.**
- Ref: [modules/07-actions-and-optimistic-state.md](../modules/07-actions-and-optimistic-state.md#2-action), RFC 06
</details>

### Q-SOLID-037 · D4 · difficulty 2 · single
An optimistic write is made inside an action whose request then fails. What does the user see?
- A) the optimistic value stays until refresh
- B) it reverts automatically when the transaction settles; the action's promise rejects
- C) a `<Loading>` fallback
- D) a stale value from a cache
<details><summary>Answer</summary>

**B.** The overlay is discarded at settle; the committed state never changed.
- Ref: [modules/07-actions-and-optimistic-state.md](../modules/07-actions-and-optimistic-state.md#3-optimistic-primitives), test "a failed action reverts the optimistic write"
</details>

### Q-SOLID-038 · D4 · difficulty 3 · scenario
A chat app sends messages over a socket; the server echoes them on the live subscription. The optimistic message flickers out and back in. Which fix is correct?
- A) `setTimeout(refresh, 500)` after sending
- B) `yield until(() => messages.some((m) => m.clientId === id), { timeout: 10_000 })` in the action, with the optimistic row keyed by the same `clientId`
- C) `await socket.send()` then `refresh(messages)`
- D) remove optimistic UI
<details><summary>Answer</summary>

**B.** `until` holds the transaction until the live source confirms; it reads the authoritative view, so the optimistic row can't satisfy it; the timeout prevents a dead socket holding forever.
- Why not A: timers race.
- Why not C: the transport ack is not the confirmation.
- Ref: [modules/07-actions-and-optimistic-state.md](../modules/07-actions-and-optimistic-state.md#43-untilpredicate--timeout-signal-), test "inside an action, your own optimistic override cannot satisfy your own ack"
</details>

### Q-SOLID-039 · D4 · difficulty 3 · hands-on
Two `addTodo` actions overlap and the second request finishes first. Show that the UI never loses or duplicates a row and ends with exactly the server's rows.
<details><summary>Answer</summary>

Use `createOptimisticStore(() => server.list(), [])` keyed by `id`, an action that pushes optimistically, `yield server.add(todo)`, then `refresh(todos)`. Complete request 2, assert both guesses still visible, complete request 1, assert two rows.
- Verification: `examples/typescript/07-actions-and-optimistic-state.test.tsx`, test "overlapping actions resolving out of order converge on the server truth".
- Ref: [modules/07-actions-and-optimistic-state.md](../modules/07-actions-and-optimistic-state.md#5-concurrency-and-races)
</details>

## D5 · Full stack: SSR, start mode, server functions (9)

### Q-SOLID-040 · D5 · difficulty 1 · single
You are starting a new Solid 2.0 full-stack app (October 2026). What do you install for the serving layer?
- A) `@solidjs/start@latest`
- B) `@solidjs/vite-plugin` and configure `solid({ start: true, ssr: true })`
- C) `vite-plugin-solid@2`
- D) Next.js
<details><summary>Answer</summary>

**B.** `@solidjs/start@2.1.0` peers on `solid-js ^1.9.15`: it is the Solid 1.9 metaframework.
- Ref: [modules/08-ssr-and-start-mode.md](../modules/08-ssr-and-start-mode.md#1-the-20-full-stack-layout)
</details>

### Q-SOLID-041 · D5 · difficulty 2 · scenario
After enabling SSR, user A occasionally sees user B's name. The app keeps `const [session, setSession] = createStore({})` in `session.ts`. Explain.
- A) a hydration mismatch
- B) module scope is shared by every request in the process; per-request state must live in a provider or the request event
- C) seroval serialization bug
- D) the CDN cached the page
<details><summary>Answer</summary>

**B.** (D can also leak, but the code shown is the cause.)
- Ref: [modules/08-ssr-and-start-mode.md](../modules/08-ssr-and-start-mode.md#4-request-isolation-the-leak-you-only-see-in-production), test "module-scope state leaks between concurrent requests"
</details>

### Q-SOLID-042 · D5 · difficulty 2 · single
`await renderToStream(() => <App />)` resolves to:
- A) a `ReadableStream`
- B) the shell HTML only
- C) the fully settled HTML string
- D) `undefined`
<details><summary>Answer</summary>

**C.** The stream object is also a thenable; this replaces `renderToStringAsync`.
- Ref: [modules/08-ssr-and-start-mode.md](../modules/08-ssr-and-start-mode.md#31-entry-points), RFC 12
</details>

### Q-SOLID-043 · D5 · difficulty 3 · scenario
A product page streams; the product is fetched under `<Loading>` and the 404 page calls `httpStatus(404)` when the product is missing. Crawlers receive 200. Why, and how do you fix it?
- A) `httpStatus` only works on the client
- B) the status is decided after the shell flushed; mark the product source `deferStream: true` so the shell waits for it
- C) use `throw new Response(null, { status: 404 })` in the component
- D) set `renderMode: "async"` for every request
<details><summary>Answer</summary>

**B.** `httpStatus` is a shell-time API. (`renderMode: "async"` in middleware for bots is a valid broader alternative, but D's "every request" gives up streaming for all users.)
- Ref: [modules/08-ssr-and-start-mode.md](../modules/08-ssr-and-start-mode.md#33-status-and-headers-from-the-tree), RFC 12
</details>

### Q-SOLID-044 · D5 · difficulty 2 · multi
Which does `handleServerFunctionRequest` enforce by default? (Choose 3.)
- A) same-origin requests only, unless `csrf.origin` allowlists an origin
- B) POST for functions not declared with `GET`
- C) authentication of the user
- D) sanitizing plain thrown errors in production builds
- E) rate limiting
<details><summary>Answer</summary>

**A, B, D.** Authentication and rate limiting are the application's job (middleware).
- Ref: [modules/08-ssr-and-start-mode.md](../modules/08-ssr-and-start-mode.md#52-the-runtime-and-the-wire), tests "cross-site … refused" (403) and "non-POST methods … refused" (405)
</details>

### Q-SOLID-045 · D5 · difficulty 2 · single
A server function is called with a `Date` argument and the client throws before sending. Why?
- A) server functions can't take dates
- B) arguments are JSON by default; enable rich arguments with `enableRichArguments()`
- C) the codec plugins differ between client and server
- D) dates must be ISO strings in the URL
<details><summary>Answer</summary>

**B.** Results use the seroval codec, arguments are JSON unless rich arguments are enabled.
- Ref: [modules/08-ssr-and-start-mode.md](../modules/08-ssr-and-start-mode.md#52-the-runtime-and-the-wire), test "results are encoded with the seroval codec …"
</details>

### Q-SOLID-046 · D5 · difficulty 2 · single
Why is `"use server"` described as the privacy mechanism?
- A) it encrypts the function body
- B) the compiler replaces the body with a reference on the client and dead-code-eliminates everything only the body used
- C) it requires HTTPS
- D) it marks the module `server-only`
<details><summary>Answer</summary>

**B.**
- Ref: [modules/08-ssr-and-start-mode.md](../modules/08-ssr-and-start-mode.md#51-compilation), RFC 10
</details>

### Q-SOLID-047 · D5 · difficulty 3 · single
A hydrated memo does `const token = await getToken(); return fetch(url, { headers: { Authorization: token } });`. The network tab shows the request twice on load. Why?
- A) React Strict Mode
- B) the hydration tracking run fakes `fetch` only synchronously; the non-fake `await` resumes after the window, so a real duplicate request goes out
- C) `ssrSource: "hybrid"` is the default
- D) `<Loading>` refetches on mount
<details><summary>Answer</summary>

**B.** Start the request synchronously or read the token synchronously.
- Ref: [modules/08-ssr-and-start-mode.md](../modules/08-ssr-and-start-mode.md#32-hydration-policy-per-computation), RFC 05 "The tracking run"
</details>

### Q-SOLID-048 · D5 · difficulty 2 · hands-on
Prove that per-request data read through the request event is isolated between two concurrent streaming renders.
<details><summary>Answer</summary>

Wrap each render in `provideRequestEvent({ request, locals: { user } }, () => renderToStream(...))`, read `getRequestEvent().locals.user` before the first `await` in an async memo, run both concurrently with different delays, assert each HTML contains its own user.
- Verification: `examples/typescript/08-ssr-and-server-functions.server.test.tsx`, test "per-request state through the request event stays isolated".
</details>

## D6 · Testing, debugging & performance (6)

### Q-SOLID-049 · D6 · difficulty 2 · single
A Jest setup without special configuration imports `solid-js`. Which build does Node resolve?
- A) the browser development build
- B) the server build (`dist/server.js`), so reactivity is not exercised
- C) the observe build
- D) it fails to resolve
<details><summary>Answer</summary>

**B.** Use `@solidjs/vite-plugin`'s Vitest integration or set browser + development conditions.
- Ref: [modules/09-testing-debugging-performance.md](../modules/09-testing-debugging-performance.md#2-build-variants-are-export-conditions), test "plain Node resolves the server build"
</details>

### Q-SOLID-050 · D6 · difficulty 2 · single
`fireEvent.click(button); expect(button.textContent).toBe("clicked 2")` fails, but passes with one extra line. Which?
- A) `await new Promise((r) => setTimeout(r, 100))`
- B) `flush()`
- C) `render()` again
- D) `cleanup()`
<details><summary>Answer</summary>

**B.** Writes commit at the flush; `findBy*` queries also work. A timeout works but is slow and flaky.
- Ref: [modules/09-testing-debugging-performance.md](../modules/09-testing-debugging-performance.md#14-component-tests)
</details>

### Q-SOLID-051 · D6 · difficulty 2 · single
What is the `observe` build?
- A) the development build with extra logging
- B) production-speed code that keeps the diagnostics and attribution channels (and source names) for production monitoring
- C) a server-only build
- D) a build for Chrome DevTools only
<details><summary>Answer</summary>

**B.** Dev guards (e.g. owned writes) are not present there.
- Ref: [modules/09-testing-debugging-performance.md](../modules/09-testing-debugging-performance.md#2-build-variants-are-export-conditions)
</details>

### Q-SOLID-052 · D6 · difficulty 3 · scenario
With attribution enabled, you see `EFFECT_RELAY_TEAR` for an effect that writes `setTotal(a() + b())`. What does it mean and how do you fix it?
- A) the effect throws; add an error arm
- B) the effect relays derived state, so readers run twice per change (once torn); replace it with `createMemo(() => a() + b())`
- C) the signal needs `equals: false`
- D) move the write into `onSettled`
<details><summary>Answer</summary>

**B.**
- Ref: [modules/09-testing-debugging-performance.md](../modules/09-testing-debugging-performance.md#3-debugging-why-did-this-run), test "an effect relaying one signal into another…"
</details>

### Q-SOLID-053 · D6 · difficulty 2 · multi
A library's components don't react to your app's signals; the console shows "Multiple Solid instances". Which are valid fixes? (Choose 2.)
- A) dedupe `solid-js` (one version in the tree)
- B) make the library declare `solid-js` as a peer dependency instead of bundling it
- C) wrap the library in `untrack`
- D) call `flush()` more often
<details><summary>Answer</summary>

**A, B.**
- Ref: [modules/09-testing-debugging-performance.md](../modules/09-testing-debugging-performance.md#21-multiple-solid-instances)
</details>

### Q-SOLID-054 · D6 · difficulty 2 · hands-on
Write a test that fails if a component reads a prop at the top of its body.
<details><summary>Answer</summary>

Render the component in the dev build inside `OBSERVE.diagnostics.capture()` and assert the captured codes contain `STRICT_READ_UNTRACKED` (negative test) and not for the fixed component.
- Verification: `examples/typescript/02-effects-and-lifecycle.test.tsx`, tests "a top-level reactive read in a component body warns…" and "untrack marks an intentional one-time read".
</details>

## D7 · Migration & architecture (6)

### Q-SOLID-055 · D7 · difficulty 1 · single
Which 1.x API maps to `<For keyed={false}>`?
- A) `<Index>`
- B) `<Key>`
- C) `<Repeat>`
- D) `<SuspenseList>`
<details><summary>Answer</summary>

**A.**
- Ref: [modules/10-migration-and-react-comparison.md](../modules/10-migration-and-react-comparison.md#3-migration-map)
</details>

### Q-SOLID-056 · D7 · difficulty 2 · multi
Which 1.x code still compiles but behaves differently in 2.0? (Choose 2.)
- A) `setX(1); measure(x())` — now measures the old value
- B) `merge({ size: "md" }, props)` with `size={undefined}` — now `undefined`
- C) `createEffect(() => log(x()))` — now throws `MISSING_EFFECT_FN`
- D) `<Suspense>` — now a compile error
<details><summary>Answer</summary>

**A, B.** C throws loudly (not silent); D is a missing export (loud).
- Ref: [modules/10-migration-and-react-comparison.md](../modules/10-migration-and-react-comparison.md#31-migration-procedure), `10-solid1-vs-solid2.test.ts`
</details>

### Q-SOLID-057 · D7 · difficulty 2 · single
Why are stale closures a common React bug but not a Solid bug?
- A) Solid uses classes
- B) React closures capture one render's values; Solid closures capture accessors that read current values, and bodies never re-run
- C) Solid forbids closures in JSX
- D) Solid compiles closures away
<details><summary>Answer</summary>

**B.**
- Ref: [modules/10-migration-and-react-comparison.md](../modules/10-migration-and-react-comparison.md#41-unit-of-re-execution)
</details>

### Q-SOLID-058 · D7 · difficulty 3 · scenario
A team migrating to Solid 2 also upgrades `@kobalte/core` to `2.0.0-alpha.4`. Installs fail or two Solid copies appear. Why?
- A) Kobalte doesn't support Vite
- B) that alpha pins `solid-js` and `@solidjs/web` to exactly `2.0.0-rc.16`, conflicting with `rc.19`
- C) Kobalte requires React
- D) Kobalte is server-only
<details><summary>Answer</summary>

**B.** Align RC versions or use an override until the library bumps; audit peer ranges before migrating.
- Ref: [modules/10-migration-and-react-comparison.md](../modules/10-migration-and-react-comparison.md#2-ecosystem-compatibility-as-of-2026-10-28)
</details>

### Q-SOLID-059 · D7 · difficulty 2 · single
In React 19 the equivalent of Solid's `isPending(() => results())` while a new query loads is closest to:
- A) `useTransition()`'s `isPending` (or comparing `useDeferredValue` output with its input)
- B) `useEffect`
- C) `React.memo`
- D) `useRef`
<details><summary>Answer</summary>

**A.** React makes transitions opt-in; Solid holds by default and exposes per-read pending state.
- Ref: [modules/10-migration-and-react-comparison.md](../modules/10-migration-and-react-comparison.md#43-async-transitions-and-actions)
</details>

### Q-SOLID-060 · D7 · difficulty 3 · hands-on
Demonstrate, on both runtimes, that nested roots changed ownership semantics between 1.9 and 2.0.
<details><summary>Answer</summary>

Create a nested root with an `onCleanup` inside a parent root on each runtime, dispose the parent, and assert the inner cleanup ran only in 2.0.
- Verification: `examples/typescript/10-solid1-vs-solid2.test.ts`, test "nested roots: detached in 1.x, owned by the parent in 2.0".
</details>

---

## Mock interview (knowledge screen)

No official exam exists, so the mock mirrors a typical senior frontend knowledge screen: **25 questions in 45 minutes**, closed book, then one hands-on task (20 minutes) from the list below. Domain mix follows the weights (5 / 4 / 2 / 5 / 4 / 2 / 3).

| # | Question | # | Question | # | Question |
|---|---|---|---|---|---|
| 1 | Q-SOLID-001 | 10 | Q-SOLID-045 | 19 | Q-SOLID-042 |
| 2 | Q-SOLID-002 | 11 | Q-SOLID-024 | 20 | Q-SOLID-044 |
| 3 | Q-SOLID-004 | 12 | Q-SOLID-025 | 21 | Q-SOLID-049 |
| 4 | Q-SOLID-007 | 13 | Q-SOLID-029 | 22 | Q-SOLID-052 |
| 5 | Q-SOLID-009 | 14 | Q-SOLID-030 | 23 | Q-SOLID-056 |
| 6 | Q-SOLID-013 | 15 | Q-SOLID-032 | 24 | Q-SOLID-057 |
| 7 | Q-SOLID-014 | 16 | Q-SOLID-036 | 25 | Q-SOLID-058 |
| 8 | Q-SOLID-015 | 17 | Q-SOLID-038 | | |
| 9 | Q-SOLID-016 | 18 | Q-SOLID-041 | | |

Hands-on (pick one, 20 minutes, verify with the named test): Q-SOLID-021, Q-SOLID-039, Q-SOLID-048.

**Scoring key.** 1 point per question; multi-select questions score only when exactly right. Hands-on: 5 points if the named test's assertions hold for your implementation, 2 for a correct approach that does not pass. Maximum 30.

| Score | Reading |
|---|---|
| 26–30 | senior-ready on Solid 2 internals |
| 20–25 | solid working knowledge; revisit the modules of missed domains |
| < 20 | work through Modules 01, 02, 06 again before interviewing |

## Shortfalls

- Domain weights and the mock format are this track's own (no published standard exists for interview loops).
- No system-design-round prompts beyond scenario questions; a dedicated frontend system-design bank belongs to the `system-design` track.
