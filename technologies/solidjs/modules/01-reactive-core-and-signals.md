# Module 01 — Reactive Core and Signals (SolidJS 2.x)

SolidJS 2.x replaces the 1.x pull-only scheduler with a fine-grained push-pull graph shipped as `@solidjs/signals`: producers push change notifications to their exact subscribers, and each subscriber pulls (recomputes) only its own value, so updating one signal never re-runs component bodies and never diffs a virtual DOM. Component functions execute exactly once per mount to build the graph, and every later update flows directly from the changed signal into the JSX bindings, memos, and effects that read it. This module covers signal and memo creation (including lazy memos and writable derived signals), deterministic microtask batching with `flush()`, the two-phase split-effect API with its render/user lanes, ownership primitives and dev diagnostics, and the async-aware `onSettled` lifecycle.

## 1. Fine-grained push-pull graph

`createSignal` creates a source node holding a committed value plus a subscriber set, while `createMemo` creates a derived node that recomputes from its dependencies and notifies only its own downstream readers. Because dependencies are discovered by tracking reads (there is no dependency array), the compiler and runtime know precisely which bindings to update, and everything else in the component stays untouched.

```ts
import { createSignal, createMemo, createRoot, flush } from "solid-js";

createRoot((dispose) => {
  const [count, setCount] = createSignal(0);
  const doubled = createMemo(() => count() * 2); // recomputes only when count changes
  setCount(1);
  flush(); // commit the queued write before reading
  console.log(doubled()); // 2
  dispose();
});
```

The setter also accepts an updater (`setCount((previous) => previous + 1)`), which resolves against the latest pending value, so consecutive updater writes compose correctly inside one microtask. A memo's second argument is its options object, and its `prev` seed comes from a default parameter (`createMemo((prev = 0) => ..., { name: "doubled" })`), not from the options.

### Lazy memos and `unobserved`

An eager memo evaluates immediately at creation, but `createMemo(fn, { lazy: true })` defers its first evaluation until the first read, which keeps expensive derivations (parsers, large sorts, async sources) off the startup path when the component may never display them. A settled lazy memo tears down once its final subscriber leaves and restarts fresh on the next read, and the `unobserved` callback reports that teardown so you can release external resources; pending async work survives brief unobserved gaps so a new subscriber rejoins the in-flight computation instead of restarting it.

```ts
const expensive = createMemo(() => sortHugeList(rows()), {
  lazy: true,
  unobserved: () => releaseScratchBuffers(),
});
```

### Writable derived signals

`createSignal(() => props.initial)` selects the compute overload and creates a writable derived signal: it tracks the source expression like a memo, but exposes a setter for local overrides (draft edits, optimistic input) that a later upstream change replaces. Note the overload subtlety: a generic `createSignal<T>(initial)` value that happens to be a function hits `Exclude<T, Function>`, so always write the derivation as an arrow function returning the value (`createSignal(() => initial)`) to select the compute overload deliberately.

```ts
const [draft, setDraft] = createSignal(() => props.initial); // follows props.initial, locally editable
setDraft("my edit"); // local override wins until props.initial changes
```

> [!NOTE]
> Component bodies run once; reading `props.title` inside JSX or a memo/compute callback stays live, while destructuring (`const { title } = props`) or capturing (`const title = props.title`) freezes the initial value and warns in dev.

### 1.4 Reactive Graph DAG Semantics, Topological Sorting & Glitch Freedom

Formally, the reactive graph in `@solidjs/signals` is a **Directed Acyclic Graph** (DAG) $G = (V, E)$, where:
- $V = V_{\text{source}} \cup V_{\text{computation}} \cup V_{\text{effect}}$
- An edge $(u, v) \in E$ denotes that node $v$ reads (observes) node $u$.

#### Invalidation vs Evaluation (Push-Pull Mechanics)
1. **Push Phase (Marking Stale)**: When a source signal $s \in V_{\text{source}}$ is mutated, the runtime marks $s$ as dirty and recursively pushes an invalidation flag down all reachable directed paths in $G$. Computations are not re-evaluated yet; they are marked `STALE` or `CHECK_DIRTY`.
2. **Pull Phase (Topological Evaluation)**: When an observer or effect accesses a derived node, the runtime traverses the graph in **topological order**. Before evaluating node $v$, all prerequisite dependencies $u \in \text{parents}(v)$ are brought up to date. If parents did not change value, $v$ skips re-evaluation.

#### Glitch Freedom and The Diamond Problem
A classic failure mode in reactive architectures is the **Diamond Problem**:

```text
       A (Source: count)
      / \
     B   C (Memos: count * 10, count + 5)
      \ /
       D (Derived Memo: `${b()}-${c()}`)
```

In a naive push-only or depth-first system, updating $A$ pushes to $B$, which immediately triggers $D$. At this transient moment, $D$ observes $B_{\text{new}}$ combined with $C_{\text{old}}$, producing an invalid intermediate state (a **glitch** or tear). Then $C$ updates and triggers $D$ a second time.

SolidJS 2.0 mathematically guarantees **Glitch Freedom**:
- Node $D$ evaluates strictly in topological order after both $B$ and $C$ have settled.
- Node $D$ executes **exactly once** per transaction with consistent, synchronized snapshots.

## 2. Deterministic microtask batching

Solid 2.0 removes `batch()` entirely because batching is now automatic: every setter queues its write onto a deterministic microtask, consecutive writes in the same tick coalesce into one commit, and subscribers run once with the final value. A synchronous read immediately after a write therefore observes the stale committed value, which is expected behavior rather than a bug; call `flush()` to drain the queue synchronously (render lane, then user lane, then `onSettled` callbacks) before asserting or measuring.

```ts
const [count, setCount] = createSignal(0);
setCount(1);
console.log(count()); // still 0: write is queued, not committed
flush();
console.log(count()); // 1
const token = flush(() => count() * 10); // flush(fn) runs fn, drains, and returns its value
```

Use `flush()` at imperative boundaries (event handlers that must read updated DOM, tests asserting committed values) and `flush(fn)` when the write and the dependent read belong together; never sprinkle `flush()` inside memos or compute callbacks, which must stay pure derivations.

## 3. Split effects and ownership

Solid 2.0 replaces the 1.x single-callback `createEffect(fn)`, the `on()` helper, and `createComputed` with one two-phase primitive, `createEffect(computeFn, applyFn, options?)`, imported from `solid-js`. The compute callback declares dependencies by reading them and returns a plain value, while the apply callback runs untracked, receives `(value, previous)` (both starting from `undefined` unless seeded), and returns either a cleanup function or `undefined`. Returning an assignment from apply leaks a non-function value as a fake cleanup, so always wrap assignments in braces.

```ts
createEffect(
  () => ({ title: props.title, count: count() }), // tracked: declares dependencies
  (value, previous) => { // untracked: performs the side effect
    document.title = `${value.title}: ${value.count}`;
    return () => { /* teardown before the next apply or on disposal */ };
  },
  { defer: true }, // optional: skip the initial apply, still computes
);
```

For derived snapshots, extract store fields in compute (`() => ({ name: store.user.name })`) or use `deep(store)` for a plain tracked copy, and use `snapshot(store)` when apply needs an untracked copy for upload or persistence. Reading a signal or store field inside apply instead of compute is untracked and raises `STRICT_READ_UNTRACKED` in dev, which almost always means a dependency was declared in the wrong phase.

### Error arm

Pass `{ effect, error }` as the second argument to handle compute failures and async rejections on the same schedule as apply; the third argument stays reserved for effect configuration such as `name`/`defer`. The error handler receives the exact thrown value (including `undefined`/`null` with class identity preserved) plus a `cleanup()` trigger, an error recovered within one flush still delivers the success arm, and errors thrown by apply itself or by the error handler propagate to the enclosing boundary instead of recursing.

```ts
createEffect(() => fetchData(id()), {
  effect: (data) => { renderData(data); },
  error: (error, cleanup) => { setError(String(error)); cleanup(); },
});
```

The single-callback form has no TypeScript overload and throws synchronously with `MISSING_EFFECT_FN` in dev, so any 1.x `createEffect(() => {...})` or `createComputed` must be split into compute/apply pairs during migration.

### Render lane vs user lane

`createRenderEffect(compute, apply)` shares the split-effect signature but runs in the render lane ahead of the user lane inside the same pre-paint microtask flush, alongside DOM bindings and hydration work, while the user lane may additionally be deferred during hydration or held loading. Both lanes run before paint, so choosing the user lane never causes a visible flash; reach for the render lane only when you measure DOM geometry and then position or size it, or when you write renderer bindings, and keep logging, persistence, subscriptions, and network in the user lane. When a handler needs updated DOM immediately, the pattern is write, then `flush()`, then read, rather than switching lanes.

| Need | Primitive |
|---|---|
| Logging, persistence, subscriptions, network | `createEffect(compute, apply)` |
| Measure DOM geometry, then position or size it; renderer bindings | `createRenderEffect(compute, apply)` |
| Read updated DOM immediately in a handler | write → `flush()` → read |

### `createReaction(onInvalidate)`

`createReaction` covers the narrow case where a memo is too heavyweight: it returns a tracking function that watches one expression, fires `onInvalidate` exactly once on the next invalidation, and then disarms until tracked again (often re-armed from inside the callback). A second tracking call replaces the previous arm rather than adding to it, so `track(a); track(b)` watches only `b`; prefer memos for ordinary derived state and reserve reactions for schedulers, dirty-checking, and test harnesses.

### Ownership rules and diagnostics

Create primitives inside a component body or `createRoot`, and perform writes only from imperative scopes: event handlers, effect apply/error callbacks, actions, and `onSettled`. Writes inside component/root bodies, memos, or compute callbacks throw `REACTIVE_WRITE_IN_OWNED_SCOPE` in dev (action calls throw `ACTION_CALLED_IN_OWNED_SCOPE`), because those scopes build and derive the graph rather than mutating it. `untrack(fn)` suppresses dependency tracking for its reads but does not change the ambient owner or lift the write guard; `runWithOwner(owner, fn)` and `getOwner()`/`getObserver()` restore and inspect scopes for library code, and `createRoot` nests under its parent unless deliberately detached with `runWithOwner(null, () => createRoot(...))`. Subscribe to the dev channel via `OBSERVE?.diagnostics` (or serializable `@solidjs/diagnostics` adapters) and budget reruns per named computation; a healthy scenario asserts zero diagnostics, while a scenario that deliberately breaks a rule asserts that exact diagnostic.

| Diagnostic | Repair |
|---|---|
| `STRICT_READ_UNTRACKED` | Move the read into JSX/compute, or capture intentionally with `untrack` |
| `REACTIVE_WRITE_IN_OWNED_SCOPE` / `ACTION_CALLED_IN_OWNED_SCOPE` | Derive state; invoke writes/actions from imperative callbacks |
| `MISSING_EFFECT_FN` | Supply both compute and apply callbacks |
| `PENDING_ASYNC_UNTRACKED_READ` | Move async reads into JSX/compute |
| `NO_OWNER_EFFECT` / `NO_OWNER_CLEANUP` | Create the primitive inside a component or root |

## 4. Async-aware lifecycle

Solid 2.x moves mount work from `onMount` to `onSettled`, which runs after the graph settles and is safe to interleave with async sources: call it from the component body with setup plus an optional returned teardown, and the component's owner adopts that teardown. A subscription that needs no post-settlement timing can instead be created directly in the component or root body with `onCleanup(unsubscribe)`, while an out-of-band `onSettled` (from a handler, a tracked effect, or a nested callback) is one-shot only, so returning cleanup there throws `SETTLED_CLEANUP_UNOWNED` in dev.

```ts
onSettled(() => {
  const resize = () => measureLayout();
  window.addEventListener("resize", resize);
  return () => window.removeEventListener("resize", resize);
});
```

> [!TIP]
> Prefer split effects for anything that reads pending async state; `onSettled` and the deprecated `createTrackedEffect` are leaf scopes where pending async reads and reentrant `flush()` are outside the contract.

## 5. Anti-patterns vs best practices

| Anti-pattern (1.x habit or sync thinking) | Best practice (Solid 2.x) |
|---|---|
| Calling removed `batch()` around writes | Rely on automatic microtask batching; `flush()` only at imperative boundaries |
| Reading a signal right after `set()` and expecting the new value | Treat the pre-flush read as stale; `flush()` first, or `flush(() => ...)` for write-plus-read |
| Single-callback `createEffect(() => {...})`, `on()`, `createComputed` | Split into `createEffect(compute, apply, options?)`, with `{ effect, error }` for failures |
| Side-effect assignments inside compute, reads inside apply | Compute derives values; apply performs untracked work and returns cleanup |
| Destructuring props (`const { title } = props`) | Keep the props object; alias changing expressions as accessors (`const title = () => props.title`) |
| Writing to signals in component bodies or memos | Derive state; write from handlers, apply/error callbacks, actions, `onSettled` |
| `onMount` for async-dependent setup | `onSettled` with returned teardown, owned by the component body |

## 6. Hands-on exercises

### Exercise 1 — Stale reads and `flush(fn)`

Given a `count` signal starting at `0`, write a function `incrementAndDouble(setCount, doubled)` that increments the signal and returns twice the new value without ever observing a stale read, then assert the result is `2` after a single increment. The solution must use `flush(fn)` so the write commits before the memo is read, and a correct solution performs exactly one increment with no manual `batch()` call.

<details>
<summary>Solution</summary>

```ts
import { createSignal, createMemo, flush } from "solid-js";

const [count, setCount] = createSignal(0);
const doubled = createMemo(() => count() * 2);

function incrementAndDouble(): number {
  return flush(() => {
    setCount((previous) => previous + 1);
    return -1; // placeholder replaced after flush below
  }) as never;
}

// Correct version: write inside flush(fn), read after flush returns.
function incrementAndDoubleFixed(): number {
  flush(() => { setCount((previous) => previous + 1); });
  return doubled();
}
console.log(incrementAndDoubleFixed()); // 2
```

The placeholder variant shows why the return must come after the drain: `flush(fn)` returns `fn()`'s value, but queued writes commit during the drain that follows `fn`, so compute the derived read after `flush(fn)` returns rather than inside `fn`.

</details>

### Exercise 2 — Split effect with error arm and cleanup

Build a title synchronizer: compute `{ title, count }` from props and a signal, apply it to a fake `documentTitle` holder with a cleanup that records teardowns, and route compute failures into a local error signal via the `{ effect, error }` form. The solution must skip the initial apply with `{ defer: true }`, return a real cleanup function from the effect arm, and recover on the next successful compute without manual reset logic.

<details>
<summary>Solution</summary>

```ts
import { createSignal, createEffect, flush } from "solid-js";

const teardowns: string[] = [];
let documentTitle = "";
const [title, setTitle] = createSignal("Home");
const [count, setCount] = createSignal(0);
const [failure, setFailure] = createSignal<unknown>(null);

createEffect(
  () => {
    if (title() === "boom") throw new Error("bad title");
    return { title: title(), count: count() };
  },
  {
    effect: (value) => {
      documentTitle = `${value.title}: ${value.count}`;
      return () => { teardowns.push(documentTitle); };
    },
    error: (error, cleanup) => { cleanup(); setFailure(error); },
  },
  { defer: true },
);

flush(); // compute runs, initial apply skipped by defer
setCount(1);
flush(); // documentTitle === "Home: 1"
setTitle("boom");
flush(); // error arm records the failure, previous cleanup ran
setTitle("Home");
flush(); // success arm re-applies with no manual reset
```

</details>
