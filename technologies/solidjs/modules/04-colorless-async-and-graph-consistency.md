# Module 04 — Colorless Async and Graph Consistency

Solid 1.x painted async code a different color: `createResource` returned a `T | undefined` accessor plus `loading`/`error` flags, and components suspended around it. Solid 2.x removes the color entirely. An async derivation is an ordinary `createMemo` whose compute returns a `Promise<T>` or an `AsyncIterable<T>`; its accessor keeps the non-nullable type `Accessor<T>` and throws `NotReadyError` until the first value commits. Components mount once, immediately, and boundaries handle readiness declaratively. This module covers native async derivations, the fetch-high/block-low architecture, readiness versus revalidation boundaries, the pending/latest/refresh toolkit, and self-healing error boundaries.

## 1. Native async derivations

Any `createMemo` (or `createProjection`) compute may return a promise or an async iterable — no `createResource`, no fetcher wrapper, no `T | undefined` branching at read sites:

```ts
import { createMemo, createProjection } from "solid-js";

const user = createMemo(() => fetchUser(id()));
const profile: () => User = user; // Accessor<User>, never Accessor<User | undefined>

async function* priceTicks(): AsyncGenerator<number, void, void> {
  yield 100;
  yield 101;
  yield 102;
}
const price = createMemo(() => priceTicks());
const users = createProjection<User[]>(() => api.listUsers(), []);
```

A `Promise<AsyncIterable<T>>` is flattened into a stream automatically. An async-generator memo publishes each `yield` as the current value; its `return` ends the stream and discards the return value, with the last published value remaining current. An empty completed stream settles to `undefined` and releases its boundary — distinguish that clean completion from a source still awaiting its first result. Because the accessor type stays non-nullable, loading is structural: consumers read a ready value under a boundary rather than nil-checking a resource.

### Register cleanup synchronously, before the first await or yield

Superseded computations are discarded, but discarding a promise does not stop the underlying work — an `AbortController` or a closed socket does. Register `onCleanup` synchronously at the top of compute, while the computation still owns the callback:

```ts
const user = createMemo(async () => {
  const abort = new AbortController();
  onCleanup(() => abort.abort());
  return fetchUser(id(), { signal: abort.signal });
});
```

After the first suspension the owner context is gone, so late-registered cleanup never runs. The same rule governs streams: a live source (WebSocket, event subscription) needs its unsubscribe registered up front, and disposal calls the iterator's `.return()` — which queues behind a parked `await` — so the cleanup must actively close and wake the source rather than relying on `finally` alone. When overlap between successive runs is forbidden, cancel the previous run explicitly before opening its replacement instead of trusting disposal ordering.

## 2. Fetch high, block low

Because `NotReadyError` travels through accessors, one boundary high in the tree covers every derivation below it. A component that reads an unresolved async memo (directly or through another memo) throws `NotReadyError`, the nearest `<Loading>` renders its fallback, and the component itself mounts exactly once — immediately — instead of blocking in a fetch waterfall:

```tsx
import { createMemo, Loading } from "solid-js";

const user = createMemo(() => fetchUser(id()));
const greeting = createMemo(() => `hi ${user().name}`); // throws NotReadyError until user resolves

<Loading fallback={<Spinner />}>
  <Profile user={user()} greeting={greeting()} />
</Loading>;
```

Reading pending data outside any boundary delays the client root mount (with an `ASYNC_OUTSIDE_LOADING_BOUNDARY` warning) and holds the shell under streaming SSR, so every async derivation rendered on screen needs a `<Loading>` above it. Untracked pending reads still throw — `untrack` does not make data ready — which keeps accidental reads outside boundaries loud instead of silently stale.

## 3. Readiness versus revalidation boundaries

Suspense is gone. Initial readiness belongs to `<Loading>`, list coordination to `<Reveal>`, and background refetches to the pending toolkit — three mechanisms because they answer three different questions.

`<Loading fallback={...} on={...}>` displays its fallback for an initially unready branch. Once revealed, it keeps the stale content during revalidation: refetches resolve quietly and swap in, with no flash of fallback. Passing `on={id()}` re-arms the boundary so a changed key re-shows the fallback while the new branch is pending — the right choice for tab switches and navigation, where stale content would be a lie:

```tsx
<Loading fallback={<Spinner />}>
  <Profile user={user()} />
</Loading>

<Loading fallback={<Spinner />} on={tab()}>
  {tab() === "a" ? <PaneA /> : <PaneB />}
</Loading>
```

`<Reveal>` replaces `<SuspenseList>` for coordinating several children: `order="together"` reveals them as one unit, `order="sequential"` (also written `"forwards"`) reveals in order so layouts assemble predictably, `order="natural"` reveals each child as it resolves, and `collapsed` hides already-revealed siblings until the group completes. Reach for `<Reveal>` when a page of cards or rows must appear coherently; a lone `<Loading>` per card is the default everywhere else.

> [!NOTE]
> `isPending(source)` performs a read — place it under the `<Loading>` that owns that source's initial fallback, and never confuse it with a process indicator: for a "Saving…" spinner, co-write a row flag or a separate optimistic boolean and read its value.

Background transitions stay stable without `startTransition` through four helpers. `isPending(accessor)` reports an unrevealed value change or a live transaction mark: tracked input changes pend until the new answer reveals, while a bare `refresh(source)` or same-input poll re-asks quietly. `latest(accessor)` reads the in-flight value, falling back to stale when the new answer has not arrived — the right source for optimistic-feeling previews that must not suspend. `await resolve(accessor)` waits for the first settled value in imperative code, and it keeps falsy values: a source resolving to `0`, `false`, or `undefined` still completes the waiter. Provisional first paint comes from data, not boundaries: `createMemo(fetcher, { loadingValue })` commits the loading value synchronously (it becomes the initial `prev`) so first paint renders real UI, and derived stores take `{ seedLoadingValue: true }` to make the seed visible before first resolution.

## 4. Self-healing error boundaries

`<Errored>` replaces `<ErrorBoundary>` with a graph-aware contract: the fallback receives the error as an accessor plus a reset action, and the boundary recovers automatically when upstream signals or live streams produce a valid result again — no manual reset required:

```tsx
<Errored fallback={(error, reset) => (
  <button onClick={reset}>Retry: {String(error())}</button>
)}>
  <Page />
</Errored>
```

Branch on the expected error value or type rather than its truthiness: error identity is preserved, including falsy rejections such as `reject(null)`. An inner `<Errored>` catches its content even through an intervening `<Loading>`, so nest freely — put the boundary where the fallback makes sense, not where the fetch happens. Programmatic compute errors use the two-phase `createEffect(compute, { effect, error })` split instead of try/catch inside derivations. For action failures and optimistic rollback, see Module 05.

## 5. Anti-patterns versus best practices

| Anti-pattern (v1 habit or trap) | Best practice (Solid 2.x) |
|---|---|
| `createResource(fetcher)` plus `T \| undefined` nil-checks and `.loading` flags at every read site | `createMemo(() => fetchUser(id()))` typed `Accessor<T>`; loading is structural under `<Loading>` |
| `await`-then-registering cleanup, or relying on iterator `finally` to close a silent socket | `onCleanup(() => abort.abort())` synchronously before the first await/yield; cancellation must wake parked consumers |
| Fetching inside each leaf component, waterfalling mounts | Fetch high (one async derivation), block low (one `<Loading>`): components mount once, `NotReadyError` covers the branch |
| Wrapping every refetch in `<Suspense>`/transitions, flashing fallbacks on background updates | Default `<Loading>` keeps stale content during revalidation; add `on={key}` only when the key change must re-show fallback |
| Coordinating multi-card reveals with ad-hoc flags | `<Reveal order="together" \| "sequential" \| "natural" collapsed>` for group reveal choreography |
| Reading `isPending(id)` to mean "data is loading", or using it as a save indicator | `isPending(source)` on the data source under its owning `<Loading>`; separate optimistic flags for process UI |
| `<ErrorBoundary>` with a static fallback string and manual reset plumbing everywhere | `<Errored fallback={(error, reset) => ...}>`: `error()` accessor, reset action, and automatic healing on upstream recovery |
| `startTransition` around refetches to avoid fallback flashes | No transitions needed: revealed boundaries stay stable, `refresh` is quiet, `latest`/`resolve` cover imperative reads |

## 6. Exercises

### Exercise 1 — Search box with cancellation, stale-while-revalidate, and keyed tabs

Build a search UI over a deferred fetcher: typing supersedes in-flight requests via `AbortController` cleanup; results render under a default `<Loading>` that keeps stale rows during refetches; a tab switch uses an `on`-keyed `<Loading>` that re-shows its fallback; a status line reads `isPending` and `latest` without suspending. Verify with the runtime boundary helpers.

```ts
import {
  createLoadingBoundary,
  createMemo,
  createSignal,
  flush,
  isPending,
  latest,
  onCleanup,
  resolve,
} from "../examples/utils/solid2-runtime.ts";

type Row = { id: string; title: string };
function deferred<T>() {
  let resolveFn: (value: T) => void = () => {};
  const promise = new Promise<T>(res => { resolveFn = res; });
  return { promise, resolve: (value: T) => resolveFn(value) };
}

// Solution.
const requests = new Map<string, Promise<Row[]>>();
const gate1 = deferred<Row[]>();
requests.set("solid", gate1.promise);
const [query, setQuery] = createSignal("solid");
const [tab, setTab] = createSignal<"results" | "about">("results");

const aborted: string[] = [];
const results = createMemo(async () => {
  const current = query();
  const controller = new AbortController();
  onCleanup(() => { aborted.push(current); controller.abort(); });
  await new Promise<void>(done => setTimeout(done, 5));
  if (controller.signal.aborted) throw new Error("superseded");
  return requests.get(current) as Promise<Row[]>;
});

const listView = createLoadingBoundary({
  fallback: () => "spinner",
  children: () => results().map(row => row.title).join(","),
});
const tabView = createLoadingBoundary({
  fallback: () => "loading-tab",
  children: () => (tab() === "results" ? listView() : "about-page"),
  on: () => tab(),
});
const status = (): string => (isPending(results) ? `refreshing (showing ${latest(results).length} rows)` : "settled");

// Verification.
console.assert(listView() === "spinner", "initially unready branch shows fallback");
gate1.resolve([{ id: "1", title: "Solid 2 guide" }]);
await resolve(results);
flush();
console.assert(listView() === "Solid 2 guide", "results reveal once ready");
console.assert(status() === "settled", "settled source reports no pending");

const gate2 = deferred<Row[]>();
requests.set("solid store", gate2.promise);
setQuery("solid store");
flush();
console.assert(isPending(results), "tracked input change pends");
console.assert(listView() === "Solid 2 guide", "revealed boundary keeps stale rows");
console.assert(status() === "refreshing (showing 1 rows)", "status reads latest without suspending");
gate2.resolve([{ id: "2", title: "Stores deep dive" }]);
await resolve(results);
flush();
console.assert(listView() === "Stores deep dive", "new answer swaps in quietly");
console.assert(aborted.includes("solid"), "superseded request was aborted");

setTab("about");
flush();
console.assert(tabView() === "about-page", "resolved tab renders immediately");
setTab("results");
flush();
console.assert(tabView() === "Stores deep dive", "returning to a ready tab shows content, not fallback");
```

> [!TIP]
> If the status line ever suspends instead of showing stale counts, check that it reads `latest(results)` (non-throwing) rather than `results()` (throwing while pending).

### Exercise 2 — Live price stream with error recovery

Combine an async-generator price stream, a self-healing `<Errored>` boundary, and a falsy-value handshake: the stream publishes ticks, a kill switch makes the derivation throw, the boundary shows the error with a retry action, and clearing the switch heals the branch without calling reset. A separate zero-price source proves `resolve` keeps falsy values.

```ts
import {
  createErroredBoundary,
  createMemo,
  createSignal,
  flush,
  isPending,
  latest,
  resolve,
} from "../examples/utils/solid2-runtime.ts";

// Solution.
const [killed, setKilled] = createSignal(false);

async function* prices(): AsyncGenerator<number, void, void> {
  yield 100;
  yield 101;
  yield 102;
}
const price = createMemo(() => prices());
const guarded = createMemo((): number => {
  if (killed()) throw new Error("feed down");
  return price();
});
let retry: (() => void) | undefined;
const priceView = createErroredBoundary({
  fallback: (error, reset) => {
    retry = reset;
    return `down:${(error() as Error).message}`;
  },
  children: () => `price:${guarded()}`,
});

// Verification.
for (let i = 0; i < 200 && latest(price) !== 102; i += 1) {
  await new Promise<void>(done => setTimeout(done, 0));
  flush();
}
flush();
console.assert(priceView() === "price:102", "stream publishes every yield, keeping the last");
console.assert(!isPending(price), "completed stream settles");

setKilled(true);
flush();
console.assert(priceView() === "down:feed down", "Errored catches the feed failure");
console.assert(typeof retry === "function", "fallback receives the reset action");
retry?.();
flush();
console.assert(priceView() === "down:feed down", "reset re-runs while upstream still fails");
setKilled(false);
flush();
console.assert(priceView().startsWith("price:"), "boundary self-heals when upstream recovers");

const zero = createMemo(async () => 0);
console.assert((await resolve(zero)) === 0, "resolve keeps falsy first values");
```

## 7. What to remember

Colorless async means one derivation primitive for sync, promised, and streamed data, with `Accessor<T>` staying non-nullable and `NotReadyError` marking the unready state. Fetch high so branches mount once; block low with `<Loading>`, keeping stale UI through revalidation unless an `on` key says otherwise; choreograph groups with `<Reveal>`. `isPending`, `latest`, `loadingValue`/`seedLoadingValue`, `resolve`, and quiet `refresh` replace transitions and loading flags. `<Errored>` turns failures into `(error, reset)` fallbacks that heal when the graph heals. The runnable suite in `examples/04-colorless-async-and-graph-consistency.ts` verifies every claim above — run it with `node examples/04-colorless-async-and-graph-consistency.ts`.
