# Module 07 — Migration from Solid 1.x to 2.0 & Architectural Deep Dives

SolidJS 2.0 (`solid-js@2.0.0-rc.8`, `@solidjs/signals`, `@solidjs/web`) modernizes the fine-grained reactive paradigm by integrating promises and async iterables directly into the computational graph, adopting deterministic microtask batching, enforcing a clear two-phase split for side effects, and promoting draft-first stores into the core runtime. Moving from Solid 1.x to Solid 2.0 eliminates several historical workarounds—such as manual `batch()` wrappers, `createComputed` write-backs, standalone `produce` decorators, and separate resource primitives—in favor of a cohesive, type-safe API surface. This module provides a complete side-by-side migration reference across all major subsystems, analyzes the architectural contrast between React 19 and Solid 2.0, and presents two comprehensive architectural deep dives: $O(1)$ high-performance selection projections over normalized state, and resilient real-time synchronization with generator actions, optimistic stores, and live WebSocket acknowledgments.

## 1. Complete Solid 1.x vs Solid 2.0 Side-by-Side Migration Map

The following sections detail every breaking change, package reorganization, and API evolution between Solid 1.x and Solid 2.0, complete with side-by-side TypeScript code snippets.

### 1.1 Package Imports and Build Configuration

Solid 2.0 consolidates package exports to separate platform-neutral reactive primitives from browser-specific DOM and SSR utilities. The historical `solid-js/store` subpath has been folded directly into `solid-js`, while browser-facing utilities and JSX runtimes now reside under `@solidjs/web`.

```ts
// --- Solid 1.x ---
import { createSignal, createEffect, onMount } from "solid-js";
import { createStore, produce, reconcile } from "solid-js/store";
import { render, Dynamic, Portal } from "solid-js/web";

// tsconfig.json (1.x)
// { "compilerOptions": { "jsx": "preserve", "jsxImportSource": "solid-js" } }
```

```ts
// --- Solid 2.0 ---
import {
  createSignal,
  createEffect,
  onSettled,
  createStore,
  createProjection,
  storePath,
  reconcile,
  snapshot,
  deep,
} from "solid-js";
import { render, Dynamic, Portal } from "@solidjs/web";

// tsconfig.json (2.0)
// { "compilerOptions": { "jsx": "preserve", "jsxImportSource": "@solidjs/web" } }
```

In Vite toolchains, replace `vite-plugin-solid` with `@solidjs/vite-plugin` (version 3.0+), which incorporates the native Rust/Oxc JSX transformation pipeline and optional full-stack Start mode. In Babel configurations, replace `babel-preset-solid` with `@solidjs/babel-plugin`.

### 1.2 Batching and Timing: `batch()` to Deterministic Microtask Batching and `flush()`

In Solid 1.x, signal writes executed synchronously unless explicitly wrapped inside `batch(() => { ... })`. In Solid 2.0, microtask batching is universal and automatic: every setter invocation enqueues its modification into a deterministic microtask queue. Multiple writes within the same event turn coalesce into a single graph update before rendering.

```ts
// --- Solid 1.x ---
import { createSignal, batch } from "solid-js";

const [first, setFirst] = createSignal("Ada");
const [last, setLast] = createSignal("Lovelace");

// Manual batching required to prevent intermediate observer execution
batch(() => {
  setFirst("Grace");
  setLast("Hopper");
});
console.log(first(), last()); // Grace Hopper (synchronous commit)
```

```ts
// --- Solid 2.0 ---
import { createSignal, flush } from "solid-js";

const [first, setFirst] = createSignal("Ada");
const [last, setLast] = createSignal("Lovelace");

setFirst("Grace");
setLast("Hopper");

// In Solid 2.0, reads immediately following writes observe uncommitted state
console.log(first()); // still "Ada" (write queued on microtask)

// Drain the queue synchronously when immediate DOM or state access is required
flush();
console.log(first(), last()); // Grace Hopper
```

Use `flush()` primarily at imperative boundaries, such as event handlers needing fresh DOM layout measurements, or unit test assertions. Never invoke `flush()` inside memos or compute callbacks.

### 1.3 Reactive Primitives: Single-Callback `createEffect` and `createComputed` to Split Effects and Writable Signals

Solid 1.x utilized a single callback for `createEffect`, tracking dependencies dynamically throughout the entire callback body. Developers frequently relied on `on(deps, fn)` to restrict tracking or `createComputed` to synchronize prop changes with internal signals. Solid 2.0 replaces all single-callback effect forms with a two-phase signature: `createEffect(compute, apply, options?)`.

```ts
// --- Solid 1.x ---
import { createSignal, createEffect, on } from "solid-js";

const [count, setCount] = createSignal(0);
const [name, setName] = createSignal("Ada");

// Unconstrained tracking or explicit on() wrapper
createEffect(on(count, (c) => {
  console.log(`Count is ${c}, name is ${name()}`); // name() tracked unless wrapped in untrack
}));
```

```ts
// --- Solid 2.0 ---
import { createSignal, createEffect } from "solid-js";

const [count, setCount] = createSignal(0);
const [name, setName] = createSignal("Ada");

// Phase 1 (compute): Pure derivation, strictly tracked
// Phase 2 (apply): Untracked execution of side effects, returns optional cleanup
createEffect(
  () => count(),
  (c, prev) => {
    console.log(`Count changed from ${prev} to ${c}, name is ${name()}`);
    // name() is untracked here; no untrack() wrapper necessary!
    return () => { /* cleanup runs before next apply or on owner disposal */ };
  },
  { defer: true } // skips initial apply execution if desired
);
```

For writable state derived from props, replace 1.x write-back effects with writable derived signals: `const [state, setState] = createSignal(() => props.initial);`. The derivation tracks upstream changes while the returned setter allows local overrides until the upstream prop mutates again.

### 1.4 Lifecycle: `onMount` to `onSettled`

Solid 1.x provided `onMount` for executing post-render DOM operations, requiring a separate `onCleanup` registration for teardown. Solid 2.0 replaces `onMount` with `onSettled`. `onSettled` executes after the component renders and all asynchronous dependencies have settled, and it natively accepts a returned cleanup function.

```ts
// --- Solid 1.x ---
import { onMount, onCleanup } from "solid-js";

onMount(() => {
  const timer = setInterval(tick, 1000);
  onCleanup(() => clearInterval(timer));
});
```

```ts
// --- Solid 2.0 ---
import { onSettled } from "solid-js";

onSettled(() => {
  const timer = setInterval(tick, 1000);
  return () => clearInterval(timer); // direct cleanup return
});
```

### 1.5 Async Data: `createResource` to Colorless Async `createMemo` and Projections

Solid 1.x segregated synchronous and asynchronous reactivity by requiring `createResource` for data fetching. Solid 2.0 implements colorless async reactivity: ordinary `createMemo` derivations seamlessly handle promises and async iterables, integrating with `<Loading>` and `<Errored>` boundaries without specialized resource wrappers.

```ts
// --- Solid 1.x ---
import { createSignal, createResource } from "solid-js";

const [userId, setUserId] = createSignal(1);
const [user, { refetch, mutate }] = createResource(userId, fetchUser);

// Reading user.loading, user.error, user()
```

```ts
// --- Solid 2.0 ---
import { createSignal, createMemo, isPending, latest, refresh } from "solid-js";

const [userId, setUserId] = createSignal(1);
// Colorless async memo: returns Accessor<User>
const user = createMemo(async () => fetchUser(userId()));

// Initial loading is caught by <Loading>; background refreshes are checked via isPending()
const refreshing = () => isPending(user);
const currentOrStale = () => latest(user);
```

### 1.6 Boundaries: `Suspense`, `SuspenseList`, and `ErrorBoundary` to `Loading`, `Reveal`, and `Errored`

In Solid 1.x, `<Suspense>` caught in-flight resources and displayed fallbacks. If a parameter changed later, Suspense often tore down existing UI unless coordinated through transitions. Solid 2.0 introduces `<Loading>`, which is strictly scoped to *initial readiness*. Once rendered, `<Loading>` keeps the established subtree visible during background re-evaluations.

```ts
// --- Solid 1.x ---
import { Suspense, SuspenseList, ErrorBoundary } from "solid-js";

<ErrorBoundary fallback={(err, reset) => <ErrorView error={err} onRetry={reset} />}>
  <SuspenseList revealOrder="together">
    <Suspense fallback={<Skeleton />}>
      <UserProfile />
    </Suspense>
  </SuspenseList>
</ErrorBoundary>
```

```ts
// --- Solid 2.0 ---
import { Loading, Reveal, Errored } from "solid-js";

// Errored boundary is self-healing: automatically recovers when upstream signals produce valid data
<Errored fallback={(err, reset) => <ErrorView error={err()} onRetry={reset} />}>
  <Reveal order="together">
    <Loading fallback={<Skeleton />}>
      <UserProfile />
    </Loading>
  </Reveal>
</Errored>
```

The `<Errored>` fallback receives an error accessor (`err()`), ensuring error messages update reactively. Furthermore, `<Errored>` boundaries self-heal: when an upstream dependency changes to a value that does not throw, the boundary recovers automatically without requiring manual reset calls.

### 1.7 Lists and Loops: `<Index>` to Unified `<For keyed={false}>` and `<Repeat>`

Solid 1.x used two separate components for collection rendering: `<For>` for reference-keyed item identity and `<Index>` for index-stable positional mapping. Solid 2.0 unifies collection mapping into `<For>`, using the `keyed` prop to declare item identity semantics, and introduces `<Repeat>` for positional numeric ranges.

```ts
// --- Solid 1.x ---
import { For, Index } from "solid-js";

// Keyed by object identity
<For each={items()}>{(item, index) => <div>{item.title} at {index()}</div>}</For>

// Keyed by array index
<Index each={items()}>{(item, index) => <div>{item().title} at {index}</div>}</Index>
```

```ts
// --- Solid 2.0 ---
import { For, Repeat } from "solid-js";

// Mode 1: Default keyed={true} (raw item value, reactive index accessor)
<For each={items()}>{(item, index) => <div>{item.title} at {index()}</div>}</For>

// Mode 2: Positional keyed={false} (replaces <Index>: reactive item accessor, plain index number)
<For each={items()} keyed={false}>{(item, index) => <div>{item().title} at {index}</div>}</For>

// Mode 3: Custom key extractor keyed={fn} (reactive item accessor, reactive index accessor)
<For each={items()} keyed={(item) => item.id}>{(item, index) => <div>{item().title} at {index()}</div>}</For>

// Positional slot rendering without array diffing
<Repeat count={10} from={0}>{(index) => <SkeletonRow index={index} />}</Repeat>
```

### 1.8 Directives and DOM Ref Attachment: `use:directive` to Ref Directive Factories

Solid 1.x relied on a custom JSX transform for `use:directive={param}` bindings, requiring global TypeScript namespace augmentations. Solid 2.0 drops custom directive transforms in favor of standard Ref Directive Factories: functions that return DOM ref callbacks with optional cleanup functions.

```ts
// --- Solid 1.x ---
// Required declare module "solid-js" { namespace JSX { ... } }
function clickOutside(el, accessor) {
  const handler = (e) => !el.contains(e.target) && accessor()();
  document.addEventListener("click", handler);
  onCleanup(() => document.removeEventListener("click", handler));
}

<div use:clickOutside={() => closeDropdown()} />
```

```ts
// --- Solid 2.0 ---
import { applyRef, type RefCallback } from "@solidjs/web";

function createClickOutside(onClickOutside: () => void): RefCallback<HTMLElement> {
  return (element) => {
    const handler = (e: MouseEvent) => {
      if (!element.contains(e.target as Node)) onClickOutside();
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler); // cleanup returned directly
  };
}

<div ref={createClickOutside(() => closeDropdown())} />
```

### 1.9 Styling: `classList` to Unified `class` Binding

Solid 1.x used `classList` for conditionally toggling CSS classes. Solid 2.0 unifies all class application under the standard `class` attribute, natively accepting strings, arrays, objects, and nested combinations.

```tsx
// --- Solid 1.x ---
<button
  class="btn"
  classList={{
    "btn-primary": isPrimary(),
    "btn-disabled": isDisabled(),
  }}
>Submit</button>
```

```tsx
// --- Solid 2.0 ---
<button
  class={[
    "btn",
    {
      "btn-primary": isPrimary(),
      "btn-disabled": isDisabled(),
    },
  ]}
>Submit</button>
```

### 1.10 Context: Providerless `<Context value={...}>` and `ContextNotFoundError`

In Solid 1.x, contexts were created via `createContext(defaultValue)` and required wrapping subtrees in `<ThemeContext.Provider value={...}>`. Reading a default-less context outside a provider returned `undefined`, forcing developers to write boilerplate defensive guards. In Solid 2.0, the context object itself serves as the provider component, and reading a default-less context without an enclosing provider immediately throws a descriptive `ContextNotFoundError`.

```tsx
// --- Solid 1.x ---
import { createContext, useContext } from "solid-js";

interface AuthState { user: string }
const AuthContext = createContext<AuthState | undefined>(undefined);

function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth used outside Provider");
  return ctx;
}

<AuthContext.Provider value={{ user: "Ada" }}>
  <App />
</AuthContext.Provider>
```

```tsx
// --- Solid 2.0 ---
import { createContext, useContext } from "solid-js";

interface AuthState { user: string }
const AuthContext = createContext<AuthState>({ name: "AuthContext" });

// Providerless component syntax; no .Provider needed
<AuthContext value={{ user: "Ada" }}>
  <App />
</AuthContext>
```

When `useContext(AuthContext)` is evaluated without an enclosing `<AuthContext value={...}>`, the runtime throws `ContextNotFoundError: Context "AuthContext" was read without an enclosing provider.`, eliminating runtime `undefined` branches.

### 1.11 Props and Store Utilities: `mergeProps`, `splitProps`, and `unwrap` to `merge`, `omit`, `snapshot`, and `deep`

Solid 1.x provided `mergeProps` and `splitProps` for preserving reactivity across component property manipulation. In Solid 2.0, these utilities have been streamlined into `merge` and `omit`, while store snapshotting is formalized through `snapshot` and `deep`.

```ts
// --- Solid 1.x ---
import { mergeProps, splitProps } from "solid-js";
import { unwrap } from "solid-js/store";

const merged = mergeProps({ theme: "dark" }, props);
const [local, others] = splitProps(props, ["title", "children"]);
const rawData = unwrap(store);
```

```ts
// --- Solid 2.0 ---
import { merge, omit, snapshot, deep } from "solid-js";

// merge: merges properties; note that undefined in later sources explicitly overrides
const merged = merge({ theme: "dark" }, props);

// omit: extracts rest props by excluding specified keys
const others = omit(props, "title", "children");

// snapshot: creates an untracked, plain clone of the store
const plainClone = snapshot(store);

// deep: traverses and subscribes to all nested properties within a tracked scope
createEffect(
  () => deep(store),
  (state) => persistToLocalStorage(state)
);
```

### 1.12 Stores: `produce` and `createMutable` to Draft-First `setStore` and `storePath`

In Solid 1.x, mutating store drafts required wrapping update callbacks in `produce(...)` from `solid-js/store`, while `createMutable` introduced un-isolated proxies. In Solid 2.0, store setters are draft-first by default: updater functions receive a mutable draft proxy directly. For legacy path-based updates, Solid 2.0 provides the explicit `storePath` utility.

```ts
// --- Solid 1.x ---
import { createStore, produce } from "solid-js/store";

const [state, setState] = createStore({ todos: [{ id: 1, text: "Write docs", done: false }] });

// Path update
setState("todos", 0, "done", true);

// Or produce wrapper
setState(produce((draft) => {
  draft.todos[0].done = true;
}));
```

```ts
// --- Solid 2.0 ---
import { createStore, storePath } from "solid-js";

const [state, setState] = createStore({ todos: [{ id: 1, text: "Write docs", done: false }] });

// 2.0 Default: Draft-first direct mutation
setState((draft) => {
  draft.todos[0].done = true;
});

// Explicit opt-in path utility for migrations or dynamic property paths
setState(storePath("todos", (item: any) => item.id === 1, "done", true));
```

> [!NOTE]
> Shallow stores (`createStore(initial, { shallow: true })`) notify subscribers only when root-level properties are reassigned. Treat nested objects in shallow stores as immutable values.

---

## 2. React 19 vs Solid 2.0: Fundamental Mental Model Comparison

While React 19 and Solid 2.0 both support modern features such as concurrent rendering, server functions, and optimistic updates, their underlying computational models are diametrically opposed. Understanding these differences is essential for engineers transitioning between the two frameworks.

| Architectural Dimension | React 19 | SolidJS 2.0 |
| :--- | :--- | :--- |
| **Component Execution Model** | Runs repeatedly on every state change or parent re-render. Renders a Virtual DOM tree and diffs it against prior output. | Component body executes **exactly once** during initialization. Returns DOM elements with fine-grained reactive bindings. |
| **Reactivity Mechanism** | Coarse-grained component invalidation. State updates schedule component re-renders. | Fine-grained push-pull signals (`@solidjs/signals`). State changes bypass component functions, updating precise DOM text nodes and attributes directly. |
| **Dependencies & Stale Closures** | Relies on explicit dependency arrays (`[deps]`) or the React Compiler. Omitted dependencies cause stale closures. | Automatic dependency tracking during execution. Reading an accessor (`count()`) subscribes the active computation automatically. |
| **Side Effect Scheduling** | `useEffect(fn, [deps])` runs after render and paint. Synchronous DOM reads require `useLayoutEffect`. | `createEffect(compute, apply)` separates synchronous dependency tracking from untracked effect application. Both `createRenderEffect` and `createEffect` run before paint. |
| **Optimistic Mutations** | `useOptimistic(state, updateFn)` tied to React transitions or form actions. Re-renders the component with transient state. | `createOptimisticStore(source, seed)` and generator `action(function* () {})`. Creates a reactive optimistic proxy layer that reconciles with authoritative data. |
| **Async Data Primitives** | `use(promise)` suspends component execution and unwinds call stack to the nearest `<Suspense>`. | Colorless async `createMemo(() => promise)`. Accessing unready data throws `NotReadyError`, caught by `<Loading>`. Re-evaluation holds stale UI via `latest()` without tearing down DOM. |
| **DOM Attributes & Directives** | Synthetic event system, `className`, `htmlFor`, camelCase properties. | Native DOM events, standard `class` (supporting strings, objects, arrays), Ref Directive Factories with native element cleanup. |

### Execution Trace: React 19 vs Solid 2.0

Consider what happens when a button is clicked in a counter component:

In React 19:
1. User clicks the button, invoking `setCount(c => c + 1)`.
2. React schedules a re-render of `Counter`.
3. The entire `Counter()` function executes again from top to bottom.
4. Hooks are re-invoked in identical order. Local helper functions and JSX objects are re-allocated.
5. React creates a new Virtual DOM node (`{ type: 'button', props: { children: 1 } }`).
6. React reconciles (diffs) the new VDOM against the prior VDOM, identifies that the button's text child changed from `"0"` to `"1"`, and mutates the physical DOM text node.

In Solid 2.0:
1. User clicks the button, invoking `setCount(c => c + 1)`.
2. The signal write queues a microtask update in `@solidjs/signals`.
3. The microtask drains (`flush()`). The signal pushes a notification to its exact subscriber: the closure wrapping the text node binding `document.createTextNode(count())`.
4. The closure re-evaluates `count()` and updates `textNode.data = "1"`.
5. The `Counter` component function **does not run**. No VDOM is created, no diffing algorithm executes, and no closures are re-instantiated.

---

## 3. Deep Dive 1: High-Performance $O(1)$ Selection & Normalized Projections

In large datasets—such as tabular grids, file trees, or data visualizations with tens of thousands of items—managing row selection is a classic performance bottleneck.

### The $O(N)$ Selection Problem in Naïve Reactivity

In a naive reactive architecture, each row in a list of $N$ items checks whether it is selected by comparing its own ID against a shared selected ID signal:

```tsx
// Anti-pattern: O(N) selection tracking
function Row(props: { id: number; selectedId: Accessor<number> }) {
  const isSelected = () => props.selectedId() === props.id;
  return <div class={{ selected: isSelected() }}>Row {props.id}</div>;
}
```

When `selectedId` changes from ID `10` to ID `42`:
1. The `selectedId` signal changes its value.
2. Every single row from $1$ to $N$ has subscribed to `selectedId()`.
3. The reactive runtime is forced to notify and re-evaluate all $N$ row computations.
4. $N - 2$ rows determine that they are still false (`10 !== id` and `42 !== id`), performing useless computation and triggering DOM attribute evaluations.
5. Complexity: $O(N)$ re-evaluations for a single selection change.

### The Solid 2.0 Solution: $O(1)$ Projections with `createProjection`

In Solid 1.x, developers used `createSelector(selectedId)` to mitigate this. In Solid 2.0, `createSelector` has been superseded by `createProjection`. A projection is a derived, read-only store updated via a draft function. By modeling selection state as a keyed dictionary (`Record<string, boolean>`), selection updates become mathematically and practically $O(1)$.

```tsx
import { For, createSignal, createProjection } from "solid-js";

function SelectionTable(props: { items: readonly { id: number; title: string }[] }) {
  const [selectedId, setSelectedId] = createSignal<number>(1);

  // createProjection maintains a sparse record of active selection keys
  const selection = createProjection<Record<string, boolean>>((draft) => {
    // 1. Clear previous selection keys
    for (const key of Object.keys(draft)) {
      delete draft[key];
    }
    // 2. Set current selection key
    const current = selectedId();
    if (current !== undefined) {
      draft[`row:${current}`] = true;
    }
  }, {});

  return (
    <For each={props.items}>
      {(item) => {
        // Fine-grained subscription: This row subscribes ONLY to selection[`row:${item.id}`]
        const isSelected = () => selection[`row:${item.id}`] === true;

        return (
          <div
            class={{ selected: isSelected() }}
            onClick={() => setSelectedId(item.id)}
          >
            {item.title}
          </div>
        );
      }}
    </For>
  );
}
```

### Mathematical and Architectural Proof of $O(1)$ Complexity

Let $S$ represent the store proxy wrapping the projection draft:
1. Each `Row` component evaluates `selection[\`row:${item.id}\`]`.
2. The Solid 2.0 store proxy interceptor records a property subscription indexed precisely by the property path `"row:item_id"`.
3. When `setSelectedId` changes from $A$ to $B$, the projection's derive callback executes:
   - `delete draft["row:A"]` fires a notification strictly to subscribers registered on property `"row:A"`. Row $A$ toggles its CSS class from `true` to `false`.
   - `draft["row:B"] = true` fires a notification strictly to subscribers registered on property `"row:B"`. Row $B$ toggles its CSS class from `false` to `true`.
4. None of the other $N - 2$ properties were read, modified, or deleted in the draft proxy.
5. The number of notified computations is invariant to list size $N$: exactly $2$ subscribers are notified on every selection transition. Thus, update complexity is strictly $O(1)$.

### Normalized State and Write-Through Views

`createProjection` also facilitates write-through, denormalized views over relational data structures without duplicating state or causing cascade invalidations:

```ts
interface User { id: string; name: string; }
interface Comment { id: string; authorId: string; body: string; }
interface NormalizedState {
  users: Record<string, User>;
  comments: Record<string, Comment>;
}

const [db, setDb] = createStore<NormalizedState>({
  users: { u1: { id: "u1", name: "Ada" } },
  comments: { c1: { id: "c1", authorId: "u1", body: "Hello World" } },
});

// Denormalized projection: updates automatically whenever db.users or db.comments change
const commentFeed = createProjection<Record<string, { body: string; authorName: string }>>((draft) => {
  for (const [id, comment] of Object.entries(db.comments)) {
    const author = db.users[comment.authorId];
    draft[id] = {
      body: comment.body,
      authorName: author ? author.name : "Unknown",
    };
  }
}, {});

// Updating a normalized user immediately updates the denormalized feed projection
setDb((draft) => {
  draft.users["u1"].name = "Countess of Lovelace";
});
flush();
console.log(commentFeed["c1"].authorName); // "Countess of Lovelace"
```

---

## 4. Deep Dive 2: Transactional Actions & Resilient Real-Time Synchronization

Client-side mutations in distributed web applications must balance instant UI responsiveness against asynchronous network latency, out-of-order responses, and server rejections.

### Generator Actions as Transactional Finite State Machines

Solid 2.0 formalizes mutations through `action(function* () {})`. While standard `async/await` functions execute as unconstrained promises, generator functions yield control at discrete checkpoints, enabling the runtime to maintain an active transaction context across suspension points.

```
       [UI User Event]
              │
              ▼
   action(function* () {})
              │
    ┌─────────┴─────────┐
    │ 1. Optimistic     │ ──► Immediately renders in UI via createOptimisticStore
    │    Write          │
    └─────────┬─────────┘
              │
            yield ───────────► Network Request in Flight
              │
    ┌─────────┴─────────┐
    │ 2. Reconcile or   │
    │    Rollback       │
    └─────────┬─────────┘
              │
     Success ─┴─ Failure
        │           │
        ▼           ▼
  Commit Server   Revert Optimistic Overlay
  Authoritative   Restore Previous Confirmed
  State           State
```

```ts
import { action, createOptimisticStore, refresh } from "solid-js";

interface Message {
  id: string;
  text: string;
  status: "pending" | "confirmed";
}

const [messages, setMessages] = createOptimisticStore<Message[]>(
  () => api.loadMessages(),
  []
);

const sendMessage = action(function* (text: string) {
  const tempId = `temp_${Date.now()}`;
  const optimisticMessage: Message = { id: tempId, text, status: "pending" };

  // 1. Transaction checkpoint: Apply optimistic mutation to store
  setMessages((draft) => {
    draft.push(optimisticMessage);
  });

  try {
    // 2. Yield network promise: transaction context is preserved across suspension
    const confirmed: Message = yield api.postMessage({ text });

    // 3. Reconcile authoritative server store
    yield refresh(messages);
    return confirmed;
  } catch (error) {
    // Transaction failure automatically rolls back the optimistic draft overlay!
    throw error;
  }
});
```

### Handling Concurrent Overlapping Mutations and Out-of-Order Responses

In collaborative environments, multiple mutations may be dispatched in quick succession. Network packet jitter can cause a mutation dispatched second to arrive before a mutation dispatched first.

In Solid 2.0:
1. `createOptimisticStore` stacks active optimistic mutations as an ordered sequence of draft transform functions.
2. Whenever authoritative data arrives or an action completes, the runtime reapplies only the *currently unconfirmed* optimistic mutations on top of the latest authoritative snapshot:
   $$\text{Display State} = \left(\text{Authoritative State}\right) \circ \text{Mutation}_1 \circ \text{Mutation}_2 \dots \circ \text{Mutation}_k$$
3. If an out-of-order response settles Mutation 2 first, Mutation 2 is removed from the active overlay queue while Mutation 1 continues to project cleanly until its network round-trip resolves.

### Real-Time WebSocket Synchronization via `until()`

In event-driven architectures (such as multiplayer canvases, chats, or document editors), the client sends an optimistic update over a WebSocket channel and must wait for the server to broadcast back an authoritative acknowledgment frame with a server-assigned sequence number.

Solid 2.0 provides `until(predicate, { timeout?, signal? })`, which suspends a generator action until a reactive predicate returns a truthy value:

```ts
import { action, until, createSignal } from "solid-js";

const [acknowledgedPackets, setAcknowledgedPackets] = createSignal<Record<string, boolean>>({});

// WebSocket client listener
socket.addEventListener("message", (event) => {
  const payload = JSON.parse(event.data);
  if (payload.type === "ACK") {
    setAcknowledgedPackets((prev) => ({ ...prev, [payload.clientMsgId]: true }));
  }
});

const sendCollaborativeAction = action(function* (clientMsgId: string, payload: unknown) {
  // Transmit over WebSocket connection
  socket.send(JSON.stringify({ clientMsgId, payload }));

  // Suspend the generator action until the server ACK arrives in the reactive graph!
  const ack = yield until(
    () => acknowledgedPackets()[clientMsgId] === true,
    { timeout: 5000 } // raises TimeoutError if server fails to ack within 5s
  );

  return ack;
});
```

Because `until()` uses fine-grained signal subscriptions under the hood, it avoids CPU-intensive polling loops (`setInterval`) and cleans up its own reactive root as soon as the condition is met or aborted.

---

## 5. Summary and Migration Checklist

Before transitioning a production application from Solid 1.x to Solid 2.0, review this migration readiness checklist:

1. **Package Declarations**: Update package dependencies to `solid-js@2.0.0-rc.8`, `@solidjs/web@2.0.0-rc.8`, and `@solidjs/vite-plugin@^3.0.0`. Replace all `solid-js/store` imports with `solid-js`.
2. **JSX Transform**: Configure `"jsxImportSource": "@solidjs/web"` in `tsconfig.json`.
3. **Effects**: Convert every single-callback `createEffect(fn)` and `on(...)` wrapper into the split signature `createEffect(compute, apply)`. Wrap DOM measurements in `createRenderEffect`.
4. **Lifecycle**: Replace `onMount` with `onSettled` and return cleanup functions directly.
5. **Context**: Remove `<Context.Provider>` wrappers; use `<Context value={...}>` directly and ensure optional contexts define defaults or handle `ContextNotFoundError`.
6. **Collections**: Audit all `<Index>` usages and replace them with `<For keyed={false}>` or `<Repeat>`.
7. **Directives**: Refactor `use:directive` attributes into Ref Directive Factories using standard `ref={...}` bindings.
8. **Asynchronous Data**: Transition `createResource` instances into async `createMemo` derivations, `<Loading>` boundaries, and generator `action` mutations.
