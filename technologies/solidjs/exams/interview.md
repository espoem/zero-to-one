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

### Q-SOLID-007 · D1 · difficulty 2 · single
`createEffect(() => status() !== "off", on => { start(); return stop; })`. `status` changes from `"active"` to `"busy"`. What runs?
- A) Nothing: the compute returned `true` both times.
- B) `stop()` then `start()`.
- C) Only `start()`.
- D) Only the compute half.
<details><summary>Answer</summary>

**B.** Effects never compare: when compute re-runs, the previous cleanup and apply run again. Put a memo in front to get equality cut-off.
- Why not A: that is memo behaviour, not effect behaviour.
- Why not C: the cleanup always precedes the next apply.
- Why not D: apply follows every compute re-run.
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
