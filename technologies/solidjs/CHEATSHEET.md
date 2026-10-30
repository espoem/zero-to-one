# SolidJS 2.0 Cheatsheet (rc.19)

Fast lookup for this track. Authoritative long form: `node_modules/solid-js/CHEATSHEET.md` (ships with the package) and the [modules](./modules/). Every rule below is proved by a test in [`examples/typescript/`](./examples/typescript/).

## Setup

```jsonc
// tsconfig.json
{ "compilerOptions": { "jsx": "preserve", "jsxImportSource": "@solidjs/web" } }
```
```ts
// vite.config.ts
import solid from "@solidjs/vite-plugin";            // renamed from vite-plugin-solid
export default { plugins: [solid({ start: true, ssr: true })] };   // start mode (full stack)
```
Pin exact RC versions: `"solid-js": "2.0.0-rc.19"`. Node ≥ 22.12, Vite 8/9. **Do not** install `@solidjs/start@2.x` (it is a Solid 1.9 package).

## Imports

| From | What |
|---|---|
| `solid-js` | signals, memos, effects, stores, projections, async, actions, flow components, context |
| `@solidjs/web` | `render`, `hydrate`, `Portal`, `dynamic`, `Dynamic` (deprecated), SSR, `httpStatus`, `getRequestEvent`, `JSX` types |
| `@solidjs/web/storage` | `provideRequestEvent` |
| `@solidjs/web/server-functions/server` · `/client` | handler, `registerServerFunction`, `GET`, `configureServerFunctions*` |
| `@solidjs/signals` | `storePath`, `ContextNotFoundError` (not re-exported by `solid-js`) |
| `solid-js/attribution` | `attribution`, `why`, `subscriptions` |

## Reactive core (M01)

```ts
const [n, setN] = createSignal(0);  setN(1);  n(); // 0 — reads lag writes
flush();                             n(); // 1
flush(() => { setA(1); setB(2); }); // drain writes made inside
const d = createMemo(() => n() * 2);                  // eager, cached, cut-off
const l = createMemo(fn, { lazy: true });             // compute on read, autodispose
const [v, setV] = createSignal(() => src() * 10);     // writable derived
createSignal(x, { equals: false | (a,b)=>bool, unobserved, ownedWrite: true, name })
untrack(() => x());  getOwner();  runWithOwner(owner, fn);  runWithOwner(null, () => createRoot(...)) // detached
```
No writes in component bodies, memos, effect computes, root bodies → `REACTIVE_WRITE_IN_OWNED_SCOPE` (dev). `untrack` does not exempt.

## Effects & lifecycle (M02)

```ts
createEffect(() => a(), (v, prev) => { …; return cleanup; });       // compute tracks, apply acts
createEffect(() => a(), { effect: (v) => …, error: (e) => … });     // error arm
createEffect(() => a(), apply, { defer: true });                     // skip initial
const on = createMemo(() => s() !== "off"); createEffect(() => on(), apply); // effects never compare
onSettled(() => { setup(); return teardown; });   // replaces onMount + onCleanup
onFlush(() => setOpen(false));                    // its own update, not held
```
Forbidden: one-arg `createEffect` (`MISSING_EFFECT_FN`), `onCleanup` in `onSettled` (`CLEANUP_IN_FORBIDDEN_SCOPE`), primitives in `onSettled`. `createTrackedEffect` is `@deprecated`.

## Components & DOM (M03)

```tsx
<Child value={count()} />                 // pass VALUES (not `count`)
function Child(props) { return <p>{props.value}</p>; }   // never destructure
const p = merge({ size: "md" }, props);  const rest = omit(props, "label");   // undefined overrides!
<div class={["card", { active: on() }]} style={{ width: `${w()}px` }} tabindex="0" disabled={b()} />
<button onClick={(e) => (cond() ? a : b)(e)} />          // handler expression binds once
<button onClick={[remove, id]} />                         // bound tuple
<input ref={el} />  <div ref={[autofocus, tooltip({ text })]} />   // bare var not assigned inside arrays
<input value={draft()} onInput={(e) => setDraft(e.currentTarget.value)} onChange={commit} />  // draft pattern
```
Compile errors: `on:`, `oncapture:`, `use:`, `attr:`, `bool:`, `classList`. Refs run before attach → measure in `onSettled`.

## Control flow (M04)

| Component | Callback args |
|---|---|
| `<For each>` (default, by identity) | `(item, i)` raw value, **accessor** index |
| `<For keyed={false}>` | `(item, i)` **accessor** item, number index |
| `<For keyed={(t) => t.id}>` | both accessors |
| `<Repeat count from>` | `(i)` number |
| `<Show when>` | `(v)` accessor; `keyed` → raw value, remount on identity change |

Callback bodies are owners, not tracking scopes: read accessors in JSX. `const C = dynamic(() => cond() ? A : B)`. `children(() => props.children)`. Context: `<Ctx value>`; default-less → `ContextNotFoundError`; `null` for optional; `undefined` = not provided.

## Stores (M05)

```ts
const [s, setS] = createStore({ list: [] });
setS((d) => { d.list.push(x); delete d.nick; });          // draft
setS((d) => d.list.filter(keep));                          // return = shallow replace
setS((d) => { reconcile(data, "id")(d.list); });           // keyed diff (null = positional)
const sel = createProjection((d) => { … }, {});            // read-only derived store
const [c, setC] = createStore((d) => { d.v = f(); }, { v: 0 });  // writable derived
snapshot(s) /* untracked plain */;  deep(s) /* tracks everything, use in compute */
createStore(rows, { shallow: true })  // records replaced, never edited
```
`ASYNC_STORE_SETTER`, `STORE_WRITE_OUTSIDE_SETTER`. Don't mutate an object after handing it to a store.

## Async (M06)

```tsx
const user = createMemo(() => fetchUser(id()));             // async memo (no createResource)
<Errored fallback={(err, reset) => <button onClick={reset}>{err().message}</button>}>
  <Loading fallback={<Spin/>} on={id()}>{user().name}</Loading>
</Errored>
isPending(() => user());  latest(id);  createDeferred(() => f(q()));
createMemo(fn, { loadingValue: placeholder });  await resolve(() => user());
createMemo(async () => { const q = query(); const ac = new AbortController(); onCleanup(() => ac.abort()); … await … });
const price = createMemo(() => from(subscribeFn));
<Reveal order="sequential|together|natural" collapsed>…</Reveal>
```
Read inputs before the first `await`. Bare `refresh(x)` is quiet; `affects(x); refresh(x)` pends. `LOADING_ON_OUTSIDE_HOLD` when the `on` data is also read outside.

## Actions & optimistic (M07)

```ts
const [todos, setTodos] = createOptimisticStore(() => api.list(), []);
const add = action(function* (t) {
  setTodos((d) => { d.push(t); });     // shows now, reverts at settle
  yield api.add(t);                    // stays in the transaction
  refresh(todos);                      // reconcile with truth
});
const [saving, setSaving] = createOptimistic(false);   // process flag
yield until(() => live.has(id), { timeout: 10_000 });   // live-channel ack; TimeoutError
```
Call actions from handlers, never during render (`ACTION_CALLED_IN_OWNED_SCOPE`).

## Full stack (M08)

```ts
renderToString(() => <App/>);  await renderToStream(() => <App/>);   // settled HTML
httpStatus(404); httpHeader("cache-control", "no-store");            // shell-time only
createMemo(fn, { ssrSource: "server" | "hybrid" | "client", deferStream: true });
export async function save(x: unknown) { "use server"; /* validate x */ }
```
Module scope is shared across requests → state in providers / `getRequestEvent().locals`. Handler: same-origin only (403), POST unless `GET(fn)` (405), prod sanitizes errors (`markSafeError`), args JSON unless `enableRichArguments()`.

## Testing & perf (M09)

```ts
const { set, value, dispose } = createRoot((dispose) => { …; return { …, dispose }; });
set(1); flush(); expect(value()).toBe(…); dispose();
render(() => <C/>); fireEvent.click(btn); flush();          // @solidjs/testing-library
OBSERVE.diagnostics.capture() … .stop()                      // assert diagnostic codes
attribution.enable();  // EFFECT_RELAY_TEAR, HOT_SCOPE_RERUNS, UNSTABLE_LIST_IDENTITY …
```
Builds: `browser+development` (guards, diagnostics) · `browser+observe` · `browser` (prod) · plain Node → server build.

## 1.x → 2.0 renames

`Suspense→Loading` · `SuspenseList→Reveal` · `ErrorBoundary→Errored` · `Index→For keyed={false}` · `mergeProps→merge` · `splitProps→omit` · `unwrap→snapshot` · `onMount→onSettled` · `createSelector→createProjection` · `Ctx.Provider→<Ctx value>` · `classList→class` · `use:x→ref={x()}` · `equalFn→isEqual` · `getListener→getObserver`.
Removed: `batch`, `createComputed`, `createResource`, `startTransition`/`useTransition`, `on`, `onError`/`catchError`, `produce`, `createMutable`, `observable`, `indexArray`, `resetErrorBoundaries`, `createDynamic`.
