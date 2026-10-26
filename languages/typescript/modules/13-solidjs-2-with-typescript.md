# Module 13: SolidJS 2.x with TypeScript — Fine-Grained Reactivity, Signals, Stores, & Async Architecture
**Extension Module | Total TypeScript Professional Course**

---

## Overview & Mental Model

While React treats component functions as rendering routines executed repeatedly on every state change, **SolidJS executes component functions exactly once as initialization constructors**. In Solid, components are not units of re-rendering; they exist solely to wire a reactive dependency graph directly to DOM nodes. Once setup finishes, reactive updates bypass the component function and mutate DOM text nodes and attributes directly—without a Virtual DOM (VDOM), reconciliation diffing, or component re-execution.

In **SolidJS 2.x (`@solidjs/signals`)**, the framework elevates this model by rebuilding its core reactive engine from the ground up:
1. **Asynchronous Reactivity in the Graph**: Asynchronicity is a first-class citizen. Ordinary memos (`createMemo`) natively accept promises and async iterables and return a non-nullable `Accessor<T>`; downstream subscribers track pending states automatically and bubble out-of-band to `<Loading>` and `<Errored>` boundaries. `createMemo` is the official Solid 2.0 async primitive; `createAsync` is only a local test-shim helper in `solid2-shim.ts`, not a framework export.
2. **Deterministic Microtask Batching**: State writes are batched onto the microtask queue by default. Synchronous reads inside the same tick remain stable and glitch-free until a `flush()` occurs or the microtask resolves.
3. **Two-Phase Split Effects**: `createEffect(compute, effect)` cleanly isolates synchronous reactive dependency tracking (Phase 1) from untracked side-effect execution and cleanup (Phase 2).
4. **Draft-First Stores & Projections**: `createStore` defaults to draft-first mutation semantics, `storePath` builds reusable path setters, and `createProjection` creates fine-grained, derived read-only stores that update with `O(1)` property-level precision.
5. **Unified Control Flow & Directives**: List rendering is unified under `<For>` (with `keyed={true}` raw items, `keyed={false}` unkeyed accessors replacing the removed `<Index>`, and `keyed={fn}` custom keys) plus positional `<Repeat>`, while custom directives transition from compiler transforms (`use:*`) to composable **ref directive factories**.

```
                    ┌────────────────────────────────────────────────────────┐
                    │            SolidJS 2.x Reactive Architecture           │
                    └───────────────────────────┬────────────────────────────┘
                                                │ Runs ONCE at setup phase
                                                ▼
                    ┌────────────────────────────────────────────────────────┐
                    │          Component Setup: function App(props)          │
                    │  Creates signals, stores, memos, effects, and DOM nodes│
                    └───────────────┬────────────────────────┬───────────────┘
                                    │                        │
       Microtask Batched Writes &   │                        │ Draft-First Stores &
       Fine-Grained Signal Updates  ▼                        ▼ Fine-Grained Projections
┌──────────────────────────────────────────────┐  ┌──────────────────────────────────────────┐
│ Signal Accessor: <span>{count()}</span>      │  │ createProjection / Store Leaf            │
│ Directly updates DOM text node in place      │  │ Directly notifies target property leaf   │
└──────────────────────────────────────────────┘  └──────────────────────────────────────────┘
```

### Type Testing Helpers

All type assertions in this module are validated using standard Total TypeScript verification helpers:

```typescript
export type Expect<T extends true> = T;
export type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false;
```

---

## Architectural Comparison: SolidJS 1.x vs. SolidJS 2.x

To eliminate confusion between versions, the following matrix clearly isolates the breaking changes and architectural evolution from SolidJS 1.x to SolidJS 2.x:

| Architectural Area | SolidJS 1.x (Legacy) | SolidJS 2.x (Modern `@solidjs/signals`) | Architectural Justification |
| :--- | :--- | :--- | :--- |
| **Reactivity Engine** | Synchronous push reactivity (`solid-js`) | Push-pull hybrid via `@solidjs/signals` | Solves over-computation, intermediate glitches, and enables cross-framework signal interop. |
| **Batching & Scheduling** | Synchronous signal writes; manual `batch(() => ...)` | **Microtask-batched by default**; `flush()` / `flush(fn)` | Guarantees consistent dependency snapshots before effects run; prevents layout thrashing. |
| **Async Reactivity** | `createResource` returning `[Resource<T>, { mutate, refetch }]` (`T \| undefined`) | **Async `createMemo`** — the official async primitive (`createAsync` is only a local test-shim helper in `solid2-shim.ts`): promises and `AsyncIterable`s return non-nullable `Accessor<T>` | Eliminates the mental tax of async data being an external wrapper; promises flow through ordinary memos. |
| **Async Inspection** | `resource.loading`, `resource.error` | `isPending(accessor)` & `await resolve(accessor)` | Standalone utility functions inspect any async accessor without coupling to resource wrappers. |
| **UI Boundaries** | `<Suspense fallback={...}>` & `<ErrorBoundary fallback={...}>` | **`<Loading fallback={...}>`** & **`<Errored fallback={...}>`** | Granular async settlement; supports stale-while-revalidate transitions without layout flickering. |
| **Side Effects** | Single-function `createEffect(() => ...)` (implicit dependency tracking across entire body) | **Split two-phase `createEffect(compute, effect)`** | Phase 1 synchronously defines tracked dependencies; Phase 2 executes side effects and returns cleanups. |
| **Component Lifecycles** | `onMount(() => ...)` with separate `onCleanup` | **`onSettled(() => { ...; return () => ...; })`** | Async-aware: executes after initial render and async dependencies settle; directly returns cleanups. |
| **List Iteration** | `<For>` (by item reference) + separate `<Index>` (by array index) | **Unified `<For>`**: default `keyed={true}` raw item, `keyed={false}` replaces `<Index>`, `keyed={fn}` custom keys; `<Repeat count={...}>` for positional slots | Unifies list rendering and adds a dedicated positional primitive that avoids array diffing. |
| **Directives** | Compiler transform `use:name={val}` + `JSX.Directives` interface augmentation | **Ref Directive Factories**: `ref={directiveFactory(...)}` | Eliminates compiler magic and namespace collisions; uses standard composable ref functions. |
| **Store Setters** | Path syntax tuples or external `produce(...)` wrapper | **Draft-first store setters**: `setStore(draft => { ... })` | Intuitive mutable draft semantics are native to store setters without extra library imports. |
| **Derived Stores** | `createMemo(() => state.items.filter(...))` returning new array references | **`createProjection(draft => ...)`** | Maintains derived stores via mutable drafts, preserving identity and updating with `O(1)` precision. |

---

## Lesson 13.1: Mental Model vs. React, `tsconfig.json`, & Deterministic Microtask Batching

### 13.1.1 Why Solid Components Run Once (Setup Phase)

In React, state updates re-render the entire component function. In SolidJS, **the component body runs exactly once on mount**.

```tsx
import { createSignal, onSettled } from "solid-js";

export function Counter() {
  console.log("Counter setup executed!"); // Logs EXACTLY ONCE on mount!
  const [count, setCount] = createSignal<number>(0);

  onSettled(() => {
    const timer = setInterval(() => setCount((prev) => prev + 1), 1000);
    return () => clearInterval(timer); // Cleanups returned directly in Solid 2.0!
  });

  // The component function never re-runs when count changes.
  return <button onClick={() => setCount((c) => c + 1)}>Count: {count()}</button>;
}
```

Because the function body never re-runs, top-level local variables are not re-evaluated. This creates two critical differences from React:

#### 1. The Prop Destructuring Reactivity Trap

Props in Solid are backed by a reactive JavaScript `Proxy` with dynamic getters. Destructuring props in the function signature or top-level body evaluates the getters once, permanently severing reactivity:

```tsx
interface CardProps { title: string; count: number; }

// ❌ ANTI-PATTERN: Destructuring props severs the reactive proxy!
export function BrokenCard({ title, count }: CardProps) {
  return <div>{title}: {count}</div>; // Frozen primitive values evaluated at mount time
}

// ✅ BEST PRACTICE: Read properties directly from `props` inside JSX or tracking contexts
export function ReactiveCard(props: CardProps) {
  return <div>{props.title}: {props.count}</div>; // Fine-grained subscriber attached
}
```

#### 2. Control-Flow Narrowing in JSX

In React, early returns based on state are common (`if (!user) return <Spinner />`). In Solid, early returns fail because setup executes only once:

```tsx
// ❌ FAILS IN SOLID: The setup function executes ONCE!
export function BrokenProfile() {
  const [user, setUser] = createSignal<{ name: string } | null>(null);
  if (!user()) return <div>Loading...</div>; // Returns Spinner and NEVER checks again!
  return <h1>{user()!.name}</h1>;
}
```

Calling an accessor twice in JSX cannot be narrowed across separate function invocations:

```tsx
// ❌ Compile Error: Object is possibly 'null' on props.user().name
// function NaiveView(props: { user: () => { name: string } | null }) {
//   return <div>{props.user() ? <span>{props.user().name}</span> : null}</div>;
// }
```

Solid solves this with `<Show>`, which provides an accessor callback narrowed to non-nullable values:

```tsx
import { Show, Accessor } from "solid-js";
interface User { id: string; name: string; }

export function ProfileView(props: { user: Accessor<User | null> }) {
  return (
    <Show when={props.user()} fallback={<div>No user authenticated</div>}>
      {(nonNullUser: Accessor<User>) => <div>Welcome, {nonNullUser().name}!</div>}
    </Show>
  );
}
```

### 13.1.2 Configuring `tsconfig.json` for Solid 2.x

Solid compiles JSX into real DOM creation templates (`_tmpl$()`). TypeScript must preserve JSX and import types from `solid-js`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "jsx": "preserve",
    "jsxImportSource": "@solidjs/web"
  }
}
```

- `"jsx": "preserve"`: Leaves JSX intact in `.tsx` files for `@solidjs/vite-plugin` or `babel-preset-solid`.
- `"jsxImportSource": "@solidjs/web"`: Resolves JSX types from `@solidjs/web/jsx-runtime` instead of `@types/react`. Store APIs live in `solid-js`; JSX runtime and DOM helpers live in `@solidjs/web`.

### 13.1.3 Solid 2.0 Deterministic Microtask Batching & `flush()`

A foundational architectural shift in Solid 2.0 is **deterministic microtask batching**. In Solid 1.x, signal writes updated synchronously. In Solid 2.0, signal writes are queued onto the JavaScript microtask queue by default:

```typescript
import { createSignal, flush, createMemo } from "solid-js";

const [count, setCount] = createSignal(10);
const doubled = createMemo(() => count() * 2);

setCount(25);
// In Solid 2.0, count() is STILL 10 here! The write is queued on the microtask queue:
console.log(count()); // 10

// When immediate synchronous synchronization is required, call `flush()`:
flush();
console.log(count());   // 25
console.log(doubled()); // 50

// `flush()` also accepts a callback, draining all writes within its block immediately:
flush(() => {
  setCount((c) => c + 5);
});
console.log(count()); // 30
```

> [!IMPORTANT]
> Microtask batching prevents intermediate layout thrashing, cascading recalculations, and inconsistencies when multiple asynchronous sources update interdependent signals.

---

## Lesson 13.2: Fine-Grained Reactive Primitives in Solid 2.x (`@solidjs/signals`)

Solid 2.0 unifies reactivity around `@solidjs/signals`. Reactivity consists of two atomic concepts: **Signals** (producers) and **Computations/Effects** (consumers).

### 13.2.1 `createSignal<T>`: Accessors, Setters, and Type Widening

A signal is an observable state container returning a getter/setter tuple:

```typescript
import { createSignal, Accessor, Setter, flush } from "solid-js";

type Signal<T> = [get: Accessor<T>, set: Setter<T>];

const [count, setCount] = createSignal<number>(0);
//    ^? const count: Accessor<number>
//           ^? const setCount: Setter<number>
flush(() => setCount(10));                 // Direct value update
flush(() => setCount((prev) => prev + 1)); // Functional updater

type TestAccessor = Expect<Equal<typeof count, Accessor<number>>>;
type TestSetter = Expect<Equal<typeof setCount, Setter<number>>>;

// Uninitialized signals widen to T | undefined:
const [query, setQuery] = createSignal<string>();
//    ^? const query: Accessor<string | undefined>
type TestUninit = Expect<Equal<ReturnType<typeof query>, string | undefined>>;

const [tab, setTab] = createSignal<"home" | "profile">("home");
type TestTab = Expect<Equal<ReturnType<typeof tab>, "home" | "profile">>;
```

### 13.2.2 First-Class Async `createMemo<T>` (the Official Async Primitive)

In Solid 1.x, asynchronous data fetching required `createResource`, which returned `[Resource<T>, { mutate, refetch }]` where `resource()` returned `T | undefined`.

**Solid 2.0 introduces first-class async directly into the reactive graph**, superseding `createResource`. The primary API is a plain **async `createMemo`**:
1. `createMemo` natively accepts a function returning a `Promise<T>` **or an `AsyncIterable<T>`**.
2. The returned accessor is typed as `Accessor<Awaited<T>>` (`() => T`, **not** `T | undefined`!).
3. If the computation is pending or rejected, the runtime automatically suspends execution of the tracking scope and propagates the state out-of-band to the nearest `<Loading>` or `<Errored>` boundary.

```tsx
import { createMemo, Accessor } from "solid-js";

interface Article { id: string; title: string; body: string; }
declare function fetchArticle(id: string): Promise<Article>;

export function ArticleViewer(props: { articleId: Accessor<string> }) {
  // ✅ Primary Solid 2.0 API: an ordinary memo with an async function.
  const article = createMemo(() => fetchArticle(props.articleId()));
  //    ^? const article: Accessor<Article>
  type TestArticleType = Expect<Equal<ReturnType<typeof article>, Article>>;

  return <article><h2>{article().title}</h2><p>{article().body}</p></article>;
}
```

#### Streaming with `AsyncIterable`

An async memo that returns an `AsyncIterable` streams values into the graph. Readers suspend until the first value arrives, then re-run for every subsequent yield:

```tsx
import { createMemo } from "solid-js";

async function* streamTokens(prompt: string): AsyncIterable<string> {
  for (const token of prompt.split(" ")) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    yield `${token} `;
  }
}

export function StreamingAnswer(props: { prompt: () => string }) {
  const answer = createMemo(() => streamTokens(props.prompt()));
  //    ^? const answer: Accessor<string>
  return <p>{answer()}</p>;
}
```

#### Opting Out of Suspension: `NotReadyError`, `latest`, and `isPending`

Not every consumer should suspend. Solid 2.0 exposes three escape hatches:

```typescript
import { NotReadyError, isPending, latest, resolve, refresh, Accessor } from "solid-js";
declare const articleAccessor: Accessor<{ id: string; title: string }>;

// 1. `isPending` reports in-flight state without triggering boundary suspension:
const loading: boolean = isPending(articleAccessor);

// 2. `latest` reads the most recent committed value instead of suspending.
const staleButUsable = latest(articleAccessor);

// 3. Throw `NotReadyError` yourself when a derived computation cannot proceed.
function requireTitle(source: Accessor<{ title: string } | undefined>): string {
  const value = source();
  if (!value) throw new NotReadyError("title is not ready", source);
  return value.title;
}

// 4. `resolve` awaits the settled value; `refresh` re-asks for the next one.
async function printArticle() {
  const data = await resolve(articleAccessor);
  await refresh(articleAccessor); // fire-and-forget is also safe
  console.log("Resolved article:", data.title);
}
```

Memo options also include `loadingValue`, which supplies a seed value while the first async result is in flight (pairs naturally with optimistic state in Lesson 13.6).

> [!NOTE]
> **Official primitive:** use async `createMemo` in new code — `createMemo` is the official Solid 2.0 async primitive. `createAsync` is only a local test-shim helper in `solid2-shim.ts` (kept exported so existing examples and exercises still run), not a separate v2 primitive.

### 13.2.3 Split `createEffect` & `createRenderEffect`

In Solid 1.x, `createEffect` used a single callback that implicitly tracked all signals read anywhere inside it.

**Solid 2.0 splits `createEffect` into two distinct phases**:
- **Phase 1 (`compute`)**: A pure tracking callback that synchronously reads signals and returns a value of type `T`.
- **Phase 2 (`effect`)**: A side-effect callback that runs asynchronously with `(value: T, prev?: T)`. Signals read here are **not** tracked. It can return an optional cleanup function `() => void`.

```typescript
import { createSignal, createEffect, flush } from "solid-js";

const [volume, setVolume] = createSignal<number>(75);
const [muted, setMuted] = createSignal<boolean>(false);

createEffect(
  // Phase 1 (compute): Only signals read here are tracked!
  () => ({ currentVolume: volume(), isMuted: muted() }),
  // Phase 2 (effect): TypeScript infers `data: T` from compute's return type!
  (data, prevData) => {
    // ^? (parameter) data: { currentVolume: number; isMuted: boolean; }
    // ^? (parameter) prevData: { currentVolume: number; isMuted: boolean; } | undefined
    console.log(`Volume: ${data.currentVolume}, Muted: ${data.isMuted}`);
    return () => console.log("Cleanup on next execution or unmount");
  }
);
```

`createRenderEffect` follows this exact two-phase contract, running synchronously immediately after DOM mutations before browser paint.

---

## Lesson 13.3: Deep Reactivity with `createStore`, Draft-First Mutations, and Solid 2.0 `createProjection`

While `createSignal` manages primitive values or atomic replacements, **Stores** provide fine-grained, nested reactivity for complex object trees and arrays without replacing parent references.

### 13.3.1 Typing `createStore<T extends object>`

A store wraps an object in a deep reactive proxy:

```typescript
import { createStore, Store, SetStoreFunction } from "solid-js";

interface TodoItem { id: string; title: string; completed: boolean; }
interface AppState { user: { name: string; preferences: { theme: "light" | "dark" } }; todos: TodoItem[]; }

const [state, setState] = createStore<AppState>({
  user: { name: "Alex", preferences: { theme: "light" } },
  todos: [{ id: "1", title: "Write Solid 2.x Module", completed: false }],
});
type TestStore = Expect<Equal<typeof state, Store<AppState>>>;
```

When an expression reads `state.user.preferences.theme`, Solid subscribes that expression exclusively to the `theme` property leaf. Mutating `state.todos` does not notify theme subscribers.

### 13.3.2 Draft-First Store Setters & Path Mutations

In Solid 1.x, mutating nested objects required importing a separate `produce` utility or using path syntax tuples.

In Solid 2.0, store setters support **draft-first semantics natively**:

```typescript
import { createStore, storePath } from "solid-js";

// 1. Native draft-first setter: mutate directly on the draft!
setState((draft) => {
  draft.todos.push({ id: "2", title: "Ship curriculum", completed: false });
  draft.user.preferences.theme = "dark";
});

// 2. Explicit `storePath` setter: target nested properties with strict compile-time checking.
setState(storePath("user", "preferences", "theme", "light"));

// 3. Reusable `storePath` setters: predicates target array elements, `DELETE` removes a leaf.
setState(storePath("todos", (todo: TodoItem) => todo.id === "2", "completed", true));
setState(storePath("user", "preferences", "theme", storePath.DELETE));
```

`createStore` also has a function form: `createStore(fn, seed)` accepts a draft-mutator `(draft) => void` or a lazy/async loader `() => T | Promise<T> | AsyncIterable<T>` with an explicit seed. The async form is the store-level counterpart of an async memo and is the basis of optimistic stores in Lesson 13.6.

### 13.3.3 Solid 2.0 `createProjection`: Derived Store Projections

In Solid 1.x, deriving filtered collections via `createMemo` returned new array references on every change, invalidating downstream subscriber identity.

**Solid 2.0 introduces `createProjection`**, which maintains a read-only derived store updated via a mutable draft callback with `O(1)` property-level notifications:

```typescript
import { createStore, createProjection, Store } from "solid-js";

interface Task { id: string; title: string; done: boolean; }
const [tasksState] = createStore<{ items: Task[] }>({
  items: [{ id: "a", title: "Task A", done: false }, { id: "b", title: "Task B", done: true }],
});

// createProjection derives a reactive Store of completed tasks:
const completedTasks = createProjection<Task[]>((draft) => {
  draft.length = 0;
  for (const item of tasksState.items) {
    if (item.done) draft.push(item);
  }
}, []);

// `completedTasks` is typed as Store<Task[]>, NOT Accessor<Task[]>!
type TestProjection = Expect<Equal<typeof completedTasks, Store<Task[]>>>;
```

### 13.3.4 Store Advanced Utilities: `storePath`, `snapshot`/`deep`, `merge`/`omit`

Solid 2.0 moves every store export into `solid-js` and adds utilities that used to be separate packages or hand-written helpers:

| Utility | Purpose |
| :--- | :--- |
| `storePath(...path, value)` | Reusable path setter. A predicate function targets matching array elements; `storePath.DELETE` removes the leaf. |
| `snapshot(store)` | Untracked plain deep copy (replaces Solid 1.x `unwrap`). Mutating the snapshot never touches the store and reading it never subscribes. |
| `deep(store)` | Deeply traverses every nested leaf so a single read subscribes to the whole subtree. |
| `merge(a, b, ...)` | Shallow-merges reactive sources into live getters; later sources win. |
| `omit(source, ...keys)` | Copies reactive getters for every property except the omitted keys. |

```typescript
import { createStore, storePath, snapshot, deep, merge, omit } from "solid-js";

interface Profile { user: { name: string; nickname?: string }; active: boolean; }
const [profile, setProfile] = createStore<Profile>({
  user: { name: "Ada", nickname: "A" },
  active: true,
});

setProfile(storePath("user", "nickname", storePath.DELETE));
type TestNicknameGone = Expect<Equal<typeof profile.user.nickname, string | undefined>>;

const plain = snapshot(profile); // untracked, detached copy
const trackedView = deep(profile); // subscribes to every leaf read below it
const publicView = omit(profile, "active"); // Omit<Profile, "active">
const withDefaults = merge({ role: "admin" as const }, publicView);

type TestPublic = Expect<Equal<typeof publicView, Omit<Profile, "active">>>;
type TestMerged = Expect<Extends<typeof withDefaults, { role: "admin" }>>;
```

`snapshot` is the v2 replacement for `unwrap`. Use it at API boundaries where you need plain JSON, and `deep` when an effect must observe every nested property.

---

## Lesson 13.4: Typing Solid Components, Props (`merge`, `omit`), Control Flow, and Boundaries

### 13.4.1 Component Types: `Component`, `ParentComponent`, `VoidComponent`, `FlowComponent`

```typescript
import { Component, ParentComponent, VoidComponent, FlowComponent } from "solid-js";
import { type JSX } from "@solidjs/web";

// 1. Component<P>: Standard component; does NOT implicitly include children
export const Avatar: Component<{ src: string; size?: number }> = (p) => <img src={p.src} width={p.size ?? 40} />;

// 2. ParentComponent<P>: Intersects P with { children?: JSX.Element }
export const Card: ParentComponent<{ elevation: 1 | 2 | 3 }> = (p) => <div class={`card-${p.elevation}`}>{p.children}</div>;

// 3. VoidComponent<P>: Forbids children (children?: never)
export const Divider: VoidComponent<{ horizontal?: boolean }> = (p) => <hr class={p.horizontal ? "h" : "v"} />;

// 4. FlowComponent<P, C>: Custom render-prop or function children
export const List = <T,>(p: FlowComponent<{ items: T[] }, (item: T) => JSX.Element>) => <div>{p.items.map(p.children)}</div>;
```

### 13.4.2 Preserving Reactivity: `merge` & `omit` (`mergeProps` & `splitProps` Are 1.x Legacy Predecessors)

The primary Solid 2.0 APIs for prop defaults and prop extraction are `merge` and `omit`. `mergeProps` and `splitProps` are their 1.x legacy predecessors — prefer `merge`/`omit` in new code.

#### `merge`: Type-Safe Default Values

`merge` is the primary Solid 2.0 API for default values. It creates a reactive proxy merging defaults without evaluating getters eagerly, while turning optional defaulted keys into required types (`mergeProps` is the 1.x legacy predecessor):

```typescript
import { merge } from "solid-js";

interface ButtonProps { label: string; variant?: "primary" | "secondary"; size?: "sm" | "md"; }

export function Button(rawProps: ButtonProps) {
  const props = merge({ variant: "primary" as const, size: "md" as const }, rawProps);
  type TestVariant = Expect<Equal<typeof props.variant, "primary" | "secondary">>;
  type TestSize = Expect<Equal<typeof props.size, "sm" | "md">>;
  return <button class={`btn-${props.variant} btn-${props.size}`}>{props.label}</button>;
}
```

#### `omit`: Splitting Local and Forwarded Attributes

`omit` is the primary Solid 2.0 API for prop extraction. It copies reactive getters for every property except the omitted keys (`splitProps` is the 1.x legacy predecessor that returned a `[picked, rest]` tuple):

```typescript
import { omit } from "solid-js";
import { type JSX } from "@solidjs/web";

interface InputProps extends JSX.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  errorMessage?: string;
}

export function TextInput(props: InputProps) {
  // Primary Solid 2.0 API: read local props directly, forward the rest via `omit`.
  // (`splitProps` is the 1.x legacy predecessor.)
  const inputAttrs = omit(props, ["label", "errorMessage"]);
  type TestLocalLabel = Expect<Equal<typeof props.label, string>>;
  type TestLocalError = Expect<Equal<typeof props.errorMessage, string | undefined>>;

  return (
    <div class="field">
      <label>{props.label}</label>
      <input {...inputAttrs} />
      {props.errorMessage && <span class="error">{props.errorMessage}</span>}
    </div>
  );
}
```

### 13.4.3 Unified Control Flow: `<Show>`, `<For>` (Three Keying Modes), `<Repeat>`, `<Switch>`

In Solid 1.x, `<For>` and `<Index>` were separate primitives with differing callback conventions.

In **Solid 2.0**:
- `<Index>` is **removed**.
- List rendering is unified under **`<For>`** with three keying modes.
- Default `keyed={true}` passes the **raw item** and an index accessor: `(item: T, index: Accessor<number>) => ...`.
- `keyed={false}` replaces `<Index>` and passes an **item accessor** with a numeric index: `(item: Accessor<T>, index: number) => ...`.
- `keyed={fn}` uses a **custom key function** and passes an item accessor with an index accessor: `(item: Accessor<T>, index: Accessor<number>) => ...`.
- `<Repeat count={...}>` renders positional slots (optionally from `from`) without diffing an array at all.

```tsx
import { Show, For, Repeat, Switch, Match, createSignal, Accessor } from "solid-js";
interface UserProfile { id: string; username: string; role: "admin" | "member"; }

export function ControlFlowDemo() {
  const [user] = createSignal<UserProfile | null>(null);
  const [tags] = createSignal<string[]>(["solid", "typescript"]);

  return (
    <div>
      {/* 1. <Show>: Accessor callback narrows to non-nullable type */}
      <Show when={user()} fallback={<p>Please log in.</p>}>
        {(activeUser: Accessor<UserProfile>) => (
          <div>
            <h3>Welcome, {activeUser().username}</h3>
            <Switch fallback={<span>Member Mode</span>}>
              <Match when={activeUser().role === "admin"}><span>Admin Console</span></Match>
            </Switch>
          </div>
        )}
      </Show>

      {/* 2. Default `keyed={true}`: raw item T + index Accessor<number> */}
      <For each={tags()}>
        {(tag: string, index: Accessor<number>) => (
          <div>{index()}: {tag}</div>
        )}
      </For>

      {/* 3. `keyed={false}` (replaces <Index>): item Accessor<T> + index number */}
      <For each={tags()} keyed={false}>
        {(tag: Accessor<string>, index: number) => (
          <div>{index}: {tag()}</div>
        )}
      </For>

      {/* 4. `keyed={fn}` custom key: item Accessor<T> + index Accessor<number> */}
      <For each={tags()} keyed={(tag: string) => tag.toUpperCase()}>
        {(tag: Accessor<string>, index: Accessor<number>) => (
          <div>{index()}: {tag()}</div>
        )}
      </For>

      {/* 5. <Repeat>: positional slots, no array diffing */}
      <Repeat count={3} from={1}>
        {(index: number) => <span>Row {index}</span>}
      </Repeat>
    </div>
  );
}
```

### 13.4.4 Async Boundaries in Solid 2.0: `<Loading>` and `<Errored>`

Solid 2.0 rethinks boundaries to match its native async graph:
- **`<Loading fallback={<Spinner />}>`**: Suspends when any child signal read is pending. Supports stale-while-revalidate transitions so the existing UI remains visible during background re-fetching.
- **`<Errored fallback={(err, reset) => <ErrorView error={err()} onRetry={reset} />}>`**: Catches unhandled promise rejections and reactive compute exceptions. The fallback receives an error accessor `err()` (not a raw value) plus `reset`.
- **`<Reveal>`**: Orders sibling regions so a later async region does not reveal earlier than its dependencies; useful for progressive disclosure without layout jumps.

```tsx
import { Loading, Errored, Reveal } from "solid-js";

export function AsyncLayout(props: { children: any }) {
  return (
    <Errored fallback={(err, reset) => <div>Failed: {String(err())} <button onClick={reset}>Retry</button></div>}>
      <Loading fallback={<div>Loading data...</div>}>
        <Reveal>
          {props.children}
        </Reveal>
      </Loading>
    </Errored>
  );
}
```

### 13.4.5 Providerless Context: `<AuthContext value={...}>` and `ContextNotFoundError`

Solid 1.x required `createContext<T | undefined>(undefined)`, a `<Context.Provider value={...}>` wrapper, and a hand-written `undefined` guard. **Solid 2.0 removes all three**: `createContext` returns a context object that is itself the provider component, and reading it without a provider throws `ContextNotFoundError`.

```tsx
import { createContext, useContext, ParentComponent, Accessor } from "solid-js";

interface AuthState { user: Accessor<string | null>; logout: () => void; }

// The context object is the provider. Name it for a readable error message.
const AuthContext = createContext<AuthState>({ name: "AuthContext" });

export const AuthProvider: ParentComponent<{ value: AuthState }> = (props) => (
  <AuthContext value={props.value}>{props.children}</AuthContext>
  //           ^ no `.Provider` in Solid 2.0!
);

export function useAuth(): AuthState {
  return useContext(AuthContext);
  // Typed as AuthState (never undefined). Without a provider this throws
  // ContextNotFoundError — no manual `undefined` branch is needed.
}

export function Nav() {
  const auth = useAuth();
  return <button onClick={auth.logout}>Logout</button>;
}
```

`createContext(defaultValue)` still accepts a default value. Do not wrap the context in a custom `createSafeSolidContext` helper — that helper is a Solid 1 idiom and hides the built-in `ContextNotFoundError`.

---

## Lesson 13.5: DOM Refs, Ref Directive Factories, Event Delegation, and Polymorphic Components

### 13.5.1 DOM Refs: Variable Refs vs Callback Refs

In Solid, refs assign the instantiated DOM node directly to a variable rather than using a `{ current: T }` container:

```tsx
import { onSettled } from "solid-js";

export function AutoFocusInput() {
  let inputRef!: HTMLInputElement; // Definite assignment assertion

  onSettled(() => {
    inputRef.focus();
    inputRef.select();
  });

  return <input ref={inputRef} placeholder="Focused when settled" />;
}

export const CallbackRef = () => <input ref={(el: HTMLInputElement) => el.setAttribute("data-ready", "true")} />;
```

### 13.5.2 Ref Directive Factories (Replacing Legacy `use:*`)

In Solid 1.x, custom directives used the compiler-transformed `use:directiveName={value}` syntax and required augmenting `namespace JSX { interface Directives { ... } }`.

**Solid 2.0 removes the `use:*` compiler syntax in favor of composable Ref Directive Factories**:
- A ref directive is simply a standard function returning an element callback.
- The callback can return an optional cleanup function that executes when the element is removed.
- Ref directive factories avoid global namespace collisions and provide natural TypeScript parameter inference.

```tsx
export type RefDirective<E extends Element = HTMLElement> = (el: E) => void | (() => void);

export function clickOutside(onClose: () => void): RefDirective<HTMLElement> {
  return (el) => {
    const onClick = (e: MouseEvent) => {
      if (!el.contains(e.target as Node)) onClose();
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick); // Cleanup returned directly!
  };
}

export function Dropdown(props: { onClose: () => void }) {
  return <div ref={clickOutside(props.onClose)}>Dropdown Content</div>;
}
```

### 13.5.3 Lifecycle Management: `onSettled` Replacing `onMount`

In Solid 2.0, **`onMount` is deprecated and replaced by `onSettled`**:
- `onSettled` executes after initial rendering and all pending asynchronous dependencies have settled.
- `onSettled` natively accepts a returned cleanup function, eliminating the need for nested `onCleanup` calls.

```typescript
import { onSettled } from "solid-js";

export function WindowWatcher() {
  onSettled(() => {
    const onResize = () => console.log("Width:", window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize); // Cleaned up on unmount!
  });

  return <div>Watching window resize...</div>;
}
```

### 13.5.4 Event Handlers: Delegated vs Native & Tuple Event Delegation

Solid provides two event handling models:
1. **Delegated Events (`onClick`, `onInput`)**: Solid attaches a single delegated listener at the `document` root.
2. **Native Events (`on:click`, `on:keydown`)**: Solid attaches an un-delegated listener directly to the element with `addEventListener`.

#### Tuple Event Delegation: Zero Closure Allocation

In large lists, inline arrow functions allocate hundreds of closure instances. Solid supports tuple event delegation `[handler, data]` with compile-time type checking:

```tsx
import { For } from "solid-js";
import { type JSX } from "@solidjs/web";

interface Item { id: number; title: string; }

export function ItemList(props: { items: Item[]; onRemove: (id: number) => void }) {
  const handleDelete: JSX.EventHandlerUnion<HTMLButtonElement, MouseEvent> = (id: number, event: MouseEvent) => {
    event.stopPropagation();
    props.onRemove(id);
  };

  return (
    <ul>
      <For each={props.items}>
        {(item) => (
          <li>
            <span>{item.title}</span>
            <button onClick={[handleDelete, item.id]}>Delete</button>
          </li>
        )}
      </For>
    </ul>
  );
}
```

### 13.5.5 Strongly Typed Polymorphic Components (`<Dynamic>`)

To create polymorphic UI components (e.g. `<Button as="a" href="..." />`), Solid provides `<Dynamic>` from `@solidjs/web`:

```tsx
import { ValidComponent, omit } from "solid-js";
import { Dynamic, type ComponentProps } from "@solidjs/web";

export type PolymorphicProps<T extends ValidComponent, P = {}> = P & { as?: T; } & Omit<ComponentProps<T>, keyof P | "as">;

export function PolymorphicButton<T extends ValidComponent = "button">(props: PolymorphicProps<T, { variant?: "solid" | "outline" }>) {
  // Primary Solid 2.0 API: forward the rest via `omit` (`splitProps` is the 1.x legacy predecessor).
  const others = omit(props, ["as", "variant"]);
  return <Dynamic component={props.as ?? "button"} class={`btn-${props.variant ?? "solid"}`} {...others} />;
}

export function ButtonUsage() {
  return (
    <>
      <PolymorphicButton onClick={(e) => console.log(e.currentTarget)}>Button</PolymorphicButton>
      <PolymorphicButton as="a" href="https://solidjs.com" target="_blank">Link</PolymorphicButton>
    </>
  );
}
```

---

## Lesson 13.6: Transactional Writes, Optimistic State, and Server Functions

### 13.6.1 Generator `action(fn*)`: Transaction Boundaries at Every `yield`

Solid 2.0 treats a mutation as a transaction. `action` wraps a generator so that each `yield` is a re-entry point: every write made between two yields commits together, and the returned function resolves to the generator's return value.

```typescript
import { action, createStore, refresh } from "solid-js";

declare function apiAdd(item: string): Promise<void>;

const [cart, setCart] = createStore<{ items: string[]; status: "idle" | "pending" | "confirmed" }>({
  items: [],
  status: "idle",
});

const addToCart = action(function* (item: string): Generator<Promise<void>, string, void> {
  setCart((draft) => { draft.items.push(item); draft.status = "pending"; }); // transaction 1
  yield apiAdd(item);                            // commit, await server
  setCart((draft) => { draft.status = "confirmed"; }); // transaction 2
  return item;
});

await addToCart("keyboard"); // Promise<string>
await refresh(cart);         // re-ask for the next settled state
```

### 13.6.2 Optimistic State: `createOptimistic` and `createOptimisticStore`

- `createOptimistic<T>()` returns a `Signal<T>` whose writes form an optimistic overlay.
- `createOptimisticStore<T>(fn, seed)` returns `[Store<T>, SetStoreFunction<T>]` layered over a durable/derived value, so the UI updates immediately while the server catches up. `refresh(store)` discards the overlay once the confirmed value settles.

```typescript
import { createOptimistic, createOptimisticStore, refresh } from "solid-js";

const [optimisticItems, setOptimisticItems] = createOptimistic<string[]>([]);
setOptimisticItems((items) => [...items, "pending-item"]);

const [optimisticCart, setOptimisticCart] = createOptimisticStore(
  () => ({ count: 0 }),
  { count: 0 }
);
setOptimisticCart((draft) => { draft.count += 1; });
await refresh(optimisticCart); // overlay reverts to the confirmed value
```

Relevant diagnostics include `OPTIMISTIC_REVERTED`, `ACTION_CALLED_IN_OWNED_SCOPE`, and `ASYNC_STORE_SETTER`; these fire when an optimistic write is discarded, an action is created inside an owned scope, or an async value is written through a sync store setter.

### 13.6.3 Server Functions: `"use server"` and `handleServerFunctionRequest`

With `@solidjs/vite-plugin` 3.x in start mode, a `"use server"` module compiles into a callable RPC endpoint (default `/_server/data/<id>`). Server functions need no router. Validate arguments at the boundary (for example with Zod or Valibot, both Standard Schema implementers) and dispatch with `handleServerFunctionRequest`:

```typescript
// app/actions.ts
"use server";
import { redirect } from "@solidjs/web";
import { z } from "zod";

const CreateTodo = z.object({ title: z.string().min(1) });

export async function createTodo(input: unknown) {
  const { title } = CreateTodo.parse(input); // accept `unknown`, parse before use
  await db.todos.create({ title });
  return { ok: true };
}
```

```typescript
// server entry
import { handleServerFunctionRequest } from "@solidjs/web";

export const handleRequest = (request: Request) => handleServerFunctionRequest(request);
```

Related exports include `configureServerFunctionsServer`, `configureServerFunctionsClient`, `getServerFunctionInvocation`, `invoke`, `createNoJSHandler`, `getRequestEvent`, `provideRequestEvent`, `respond`, `redirect`, `markSafeError`/`isSafeError`, and `parseCookieHeader`/`serializeCookie`. `handleRequest(request)` itself is **not** a Solid export — use `handleServerFunctionRequest` for dispatch.

### 13.6.4 Full 7-Module Solid Track

This module is the TypeScript-focused slice. For the complete `solid-js@2.0.0-rc.8` curriculum — reactive core, DOM templating/control flow, draft-first stores, colorless async, transactional/optimistic writes, start mode/server functions, and Solid 1 vs. 2 deep dives — see [`technologies/solidjs/`](../../../technologies/solidjs/).

---

## Anti-Patterns vs. Best Practices

| Category | ❌ Solid 1.x Legacy / React Anti-Pattern | ✅ Solid 2.x Best Practice | Reason / Impact |
| :--- | :--- | :--- | :--- |
| **Props** | `function Box({ title, count }: Props)` | `function Box(props: Props)` | Destructuring severs the reactive proxy. Access via `props.x`, `omit`, or `merge` (`splitProps`/`mergeProps` are 1.x legacy predecessors). |
| **Default Props** | `{ size = "md" } = props;` | `const p = merge({ size: "md" }, props);` | Object destructuring reads properties once at setup. `merge` preserves dynamic reactivity (`mergeProps` is the 1.x legacy predecessor). |
| **Async Data** | `const [res] = createResource(fetcher)` | `const data = createMemo(() => fetcher())` (`createAsync` is only a local test-shim helper in `solid2-shim.ts`) | Solid 2.0 replaces `createResource` with async memos returning non-nullable `Accessor<T>`. |
| **Pending States** | `res.loading ? <Spinner /> : ...` | `<Loading fallback={<Spinner />}>` / `isPending(data)` | Boundaries handle loading out-of-band; `isPending` inspects transitions without suspense triggers. |
| **Error Handling** | `<ErrorBoundary fallback={...}>` | `<Errored fallback={(err, reset) => ...}>` (fallback receives an error accessor — call `err()`, e.g. `String(err())`) | Solid 2.0 `<Errored>` boundary integrates natively with promise rejections and reactive errors. |
| **Effects** | `createEffect(() => console.log(x()))` | `createEffect(() => x(), (val) => console.log(val))` | Two-phase split prevents unintentional dependency tracking and cleans up naturally. |
| **Lifecycles** | `onMount(() => { ...; onCleanup(...) })` | `onSettled(() => { ...; return () => ...; })` | `onSettled` waits for async resolution and directly returns its cleanup function. |
| **List Iteration** | `<Index each={items()}>...` | `<For each={items()} keyed={false}>...` / `<Repeat count={...}>` | `<Index>` is removed in 2.0; unified `<For>` handles unkeyed iteration via `keyed={false}`, and `<Repeat>` handles positional slots. |
| **Context** | `createContext<T \| undefined>()` + `<Ctx.Provider>` + manual undefined guard | `const Ctx = createContext<T>()` + `<Ctx value={...}>` + `useContext(Ctx)` | The context object is its own provider; reading without a provider throws `ContextNotFoundError`. |
| **Mutations** | Manual `loading` flags + hand-rolled rollback | `action(function* () { ...; yield api.save(); ... })` + `createOptimisticStore` + `refresh` | Generator actions create transaction boundaries; optimistic overlays revert automatically on settlement. |
| **Directives** | `<div use:clickOutside={onClose} />` | `<div ref={clickOutside(onClose)} />` | `use:*` compiler syntax is removed; ref directive factories provide clean composability without JSX augmentation. |
| **Store Setters** | `setState(produce(draft => { ... }))` | `setState(draft => { ... })` | Store setters feature native draft-first semantics; no external `produce` wrapper needed. |
| **Derived Stores** | `createMemo(() => state.items.filter(...))` | `createProjection(draft => ...)` | Returning new array references breaks subscriber identity. `createProjection` emits fine-grained updates. |
| **Event Handlers** | `onClick={() => deleteItem(item.id)}` | `onClick={[deleteItem, item.id]}` | Inline lambdas allocate new closures per row. Tuple delegation uses zero allocations. |

---

## Hands-On Exercises

### Exercise 13.1: Reactive State Machine & Async Search Filter with `createSignal`, async `createMemo`, and `isPending`

#### Problem Statement
Build a type-safe autocomplete search system in Solid 2.x:
1. Define a discriminated union state machine representing search states: `idle`, `loading`, `success`, `error`.
2. Implement a `useDebouncedSearch` primitive accepting a query `Accessor<string>` and an async search fetcher.
3. Use Solid 2.0's primary async primitive (async `createMemo`), check pending state via `isPending`, and ensure accessor return types are statically verified.

#### Complete Solution & Explanation

```typescript
import { createSignal, createEffect, createMemo, Accessor, isPending } from "solid-js";

export interface SearchResult { id: string; label: string; }
export type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; results: SearchResult[] }
  | { status: "error"; error: string };

export function createDebouncedSignal<T>(source: Accessor<T>, delayMs: number): Accessor<T> {
  const [debounced, setDebounced] = createSignal<T>(source());
  let timer: NodeJS.Timeout | number | undefined;

  createEffect(
    () => source(),
    (value) => {
      clearTimeout(timer);
      timer = setTimeout(() => setDebounced(() => value), delayMs);
      return () => clearTimeout(timer); // Cleanups returned directly in Solid 2.0 two-phase effect!
    }
  );

  return debounced;
}

export function useDebouncedSearch(
  query: Accessor<string>,
  fetcher: (q: string) => Promise<SearchResult[]>
) {
  const debouncedQuery = createDebouncedSignal(query, 300);

  const results = createMemo(async () => {
    const q = debouncedQuery().trim();
    if (q.length === 0) return [];
    return await fetcher(q);
  });
  //    ^? Accessor<SearchResult[]> — async `createMemo` is the official primitive; `createAsync` is only a local test-shim helper in `solid2-shim.ts`

  const searchState = createMemo<SearchState>(() => {
    const q = debouncedQuery().trim();
    if (q.length === 0) return { status: "idle" };
    if (isPending(results)) return { status: "loading" };
    try {
      const items = results();
      return { status: "success", results: items };
    } catch (err) {
      return { status: "error", error: err instanceof Error ? err.message : "Unknown error" };
    }
  });

  return { results, searchState };
}

// Compile-Time Type Tests:
declare const mockQuery: Accessor<string>;
declare const mockFetcher: (q: string) => Promise<SearchResult[]>;
const { results, searchState } = useDebouncedSearch(mockQuery, mockFetcher);

type TestResultsType = Expect<Equal<typeof results, Accessor<SearchResult[]>>>;
type TestStateType = Expect<Equal<typeof searchState, Accessor<SearchState>>>;
```

---

### Exercise 13.2: Deep Store Manipulation with Draft-First Setters & `createProjection`

#### Problem Statement
Design an inventory tracking store with fine-grained projections in Solid 2.0:
1. Define a domain store containing `products` (dictionary indexed by string ID) and `cart` (array of cart items).
2. Write typed mutation functions for adding an item to the cart using draft-first setters without external produce wrappers.
3. Create a derived store projection using Solid 2.0 `createProjection` that calculates cart totals and identifies out-of-stock items.

#### Complete Solution & Explanation

```typescript
import { createStore, createProjection, Store } from "solid-js";

export interface Product { id: string; name: string; price: number; stock: number; }
export interface CartItem { productId: string; quantity: number; }
export interface InventoryState { products: Record<string, Product>; cart: CartItem[]; }
export interface CartSummary { totalItems: number; totalPrice: number; outOfStockIds: string[]; }

export function createInventoryManager(initialProducts: Product[]) {
  const productsMap: Record<string, Product> = {};
  for (const p of initialProducts) productsMap[p.id] = p;

  const [state, setState] = createStore<InventoryState>({ products: productsMap, cart: [] });

  const addToCart = (productId: string, quantity: number = 1) => {
    setState((draft) => {
      const existing = draft.cart.find((item) => item.productId === productId);
      if (existing) {
        existing.quantity += quantity;
      } else {
        draft.cart.push({ productId, quantity });
      }
    });
  };

  const decrementStock = (productId: string, count: number) => {
    setState((draft) => {
      const product = draft.products[productId];
      if (product && product.stock >= count) product.stock -= count;
    });
  };

  const summary = createProjection<CartSummary>((draft) => {
    let itemsCount = 0;
    let priceSum = 0;
    const outOfStock: string[] = [];

    for (const item of state.cart) {
      const prod = state.products[item.productId];
      if (prod) {
        itemsCount += item.quantity;
        priceSum += prod.price * item.quantity;
        if (prod.stock < item.quantity) outOfStock.push(prod.id);
      }
    }

    draft.totalItems = itemsCount;
    draft.totalPrice = priceSum;
    draft.outOfStockIds = outOfStock;
  }, { totalItems: 0, totalPrice: 0, outOfStockIds: [] });

  return { state, addToCart, decrementStock, summary };
}

// Compile-Time Type Tests:
const manager = createInventoryManager([{ id: "p1", name: "Keyboard", price: 100, stock: 5 }]);
type TestManagerStore = Expect<Equal<typeof manager.state, Store<InventoryState>>>;
type TestSummaryType = Expect<Equal<typeof manager.summary, Store<CartSummary>>>;
```

---

### Exercise 13.3: Strongly Typed Polymorphic UI Primitive with `omit`, `<Dynamic>`, and Ref Directive Factory

#### Problem Statement
Build an accessible polymorphic `<Box>` component with Solid 2.0 ref directive integration:
1. Accept an optional `as` prop accepting any valid Solid HTML tag or component (e.g., `"div"`, `"button"`, `"a"`).
2. Extract custom styling props (`padding`, `elevation`, `bordered`) and forward the rest via the primary Solid 2.0 API `omit` (`splitProps` is the 1.x legacy predecessor).
3. Support element-specific attributes (e.g., `href` only allowed when `as="a"`) without TypeScript errors.
4. Attach an auto-focus ref directive factory using Solid 2.0 `ref={...}` semantics.

#### Complete Solution & Explanation

```tsx
import { ValidComponent, omit } from "solid-js";
import { Dynamic, type ComponentProps, type JSX } from "@solidjs/web";

export type Spacing = "none" | "sm" | "md" | "lg";
export interface BoxCustomProps { padding?: Spacing; elevation?: 1 | 2 | 3; bordered?: boolean; }

export type BoxProps<T extends ValidComponent = "div"> = BoxCustomProps & {
  as?: T;
  children?: JSX.Element;
} & Omit<ComponentProps<T>, keyof BoxCustomProps | "as" | "children">;

export function autoFocusOnMount(): (el: HTMLElement) => void {
  return (el) => {
    el.focus();
  };
}

export function Box<T extends ValidComponent = "div">(props: BoxProps<T>): JSX.Element {
  // Primary Solid 2.0 API: forward native attributes via `omit` (`splitProps` is the 1.x legacy predecessor).
  const nativeAttrs = omit(props as BoxProps<ValidComponent>, [
    "as", "padding", "elevation", "bordered", "children",
  ]);
  const local = props as BoxProps<ValidComponent>;

  const computeClasses = () => {
    const list = ["ui-box"];
    if (local.padding) list.push(`p-${local.padding}`);
    if (local.elevation) list.push(`elevation-${local.elevation}`);
    if (local.bordered) list.push("box-bordered");
    return list.join(" ");
  };

  return (
    <Dynamic component={local.as ?? "div"} class={computeClasses()} {...nativeAttrs}>
      {local.children}
    </Dynamic>
  );
}

// Compile-Time Verification:
export function BoxTestCases() {
  return (
    <>
      <Box padding="md" elevation={2} role="region">Default Box</Box>
      <Box as="a" href="https://solidjs.com" target="_blank" bordered>Link Box</Box>
      <Box as="button" type="submit" disabled padding="sm" ref={autoFocusOnMount()}>Submit Box</Box>
    </>
  );
}
```

---

### Exercise 13.4: Providerless Context with Signal/Store Fallback, `<Loading>`, and `onSettled`

#### Problem Statement
Construct an enterprise Theme & Feature Flag context architecture in Solid 2.0:
1. Support both signal accessors (`theme: Accessor<"light" | "dark">`) and a store of feature flags (`flags: Store<Record<string, boolean>>`).
2. Use Solid 2.0's providerless context (`<AppConfigContext value={...}>` without `.Provider`) so `useContext` throws `ContextNotFoundError` when unprovided.
3. Build a `<FeatureGate>` flow component that narrows children rendering based on active feature flags.
4. Use `onSettled` to sync active theme preferences to `localStorage`.

#### Complete Solution & Explanation

```tsx
import {
  createContext,
  useContext,
  createSignal,
  ParentComponent,
  Accessor,
  Show,
  onSettled
} from "solid-js";
import { type JSX } from "@solidjs/web";
import { createStore, Store } from "solid-js";

export type ThemeMode = "light" | "dark";

export interface AppConfigContextValue {
  theme: Accessor<ThemeMode>;
  setTheme: (mode: ThemeMode) => void;
  flags: Store<Record<string, boolean>>;
  setFlag: (flagName: string, enabled: boolean) => void;
}

// Solid 2.0: the context object IS the provider component.
const AppConfigContext = createContext<AppConfigContextValue>({ name: "AppConfigContext" });

export function useAppConfig(): AppConfigContextValue {
  // Typed as AppConfigContextValue; throws ContextNotFoundError if no provider encloses it.
  return useContext(AppConfigContext);
}

export const AppSettingsProvider: ParentComponent = (props) => {
  const [theme, setThemeSignal] = createSignal<ThemeMode>("light");
  const [flags, setFlagsStore] = createStore<Record<string, boolean>>({
    betaCheckout: false,
    newDashboard: true,
  });

  onSettled(() => {
    const saved = localStorage.getItem("app_theme") as ThemeMode | null;
    if (saved) setThemeSignal(saved);
    return () => localStorage.setItem("app_theme", theme());
  });

  const value: AppConfigContextValue = {
    theme,
    setTheme: (t) => setThemeSignal(t),
    flags,
    setFlag: (flag, enabled) => setFlagsStore((draft) => { draft[flag] = enabled; }),
  };

  return <AppConfigContext value={value}>{props.children}</AppConfigContext>;
};

export interface FeatureGateProps {
  flag: string;
  fallback?: JSX.Element;
  children: JSX.Element;
}

export function FeatureGate(props: FeatureGateProps): JSX.Element {
  const config = useAppConfig();
  const isEnabled = () => Boolean(config.flags[props.flag]);

  return (
    <Show when={isEnabled()} fallback={props.fallback}>
      {props.children}
    </Show>
  );
}

// Compile-Time Type Verification:
export function ComponentUnderContext() {
  const config = useAppConfig();
  //    ^? const config: AppConfigContextValue

  type TestTheme = Expect<Equal<ReturnType<typeof config.theme>, "light" | "dark">>;
  type TestFlags = Expect<Equal<typeof config.flags, Store<Record<string, boolean>>>>;

  return (
    <div>
      <p>Theme: {config.theme()}</p>
      <FeatureGate flag="betaCheckout" fallback={<p>Feature disabled</p>}>
        <button onClick={() => config.setTheme("dark")}>Checkout Now</button>
      </FeatureGate>
    </div>
  );
}
```

---

## Module 13 Summary & Cheat Sheet

1. **Setup Phase Execution**: Solid components run **once**. Local variables in component functions do not re-run on state changes.
2. **Deterministic Microtask Batching**: Signal writes are queued on the microtask queue by default. Immediate reads remain stable until `flush()` is called or the microtask drains.
3. **Never Destructure Props**: Props are reactive proxy objects. Destructuring destroys reactivity. Access via `props.title`, `merge` (for default values), and `omit` (for prop extraction). `mergeProps`/`splitProps` are 1.x legacy predecessors.
4. **Control-Flow Narrowing**: Use `<Show when={val()}>{(v) => ...}</Show>` to narrow types inside JSX. `v` is typed as `Accessor<NonNullable<T>>`.
5. **Solid 2.0 Async Memos**: async `createMemo` returns `Accessor<Awaited<T>>` (not `T | undefined`) for promises and `AsyncIterable`s. `createMemo` is the official Solid 2.0 async primitive; `createAsync` is only a local test-shim helper in `solid2-shim.ts`. Pending computations propagate to `<Loading>` and `<Errored>` boundaries automatically. Inspect via `isPending`, `latest`, `resolve`, and `refresh`; throw `NotReadyError` to opt out of suspension.
6. **Two-Phase Effects**: Solid 2.0 `createEffect(compute, effect)` separates pure synchronous tracking from side-effect execution, providing automatic TypeScript parameter inference and direct cleanup return.
7. **Stores & Draft Setters**: `createStore` manages deep nested proxies. Setters support native draft mutations (`setState(draft => { draft.done = true; })`) without Immer or `produce` wrapper boilerplate. `storePath` builds reusable path setters; `snapshot`/`deep`/`merge`/`omit` cover plain copies, deep tracking, and prop-style composition.
8. **Derived Projections**: `createProjection` creates derived stores via mutable draft callbacks without invalidating array or object references, preserving `O(1)` fine-grained notification precision.
9. **Unified List Iteration**: `<For>` has three modes — default `keyed={true}` (raw item + index accessor), `keyed={false}` (item accessor + index number, replacing `<Index>`), and `keyed={fn}` (item accessor + index accessor). `<Repeat count={...}>` renders positional slots without array diffing.
10. **Ref Directive Factories**: Legacy `use:*` compiler directives are removed in favor of composable ref factories `ref={directiveFactory(...)}` returning optional cleanup functions.
11. **Async-Aware Lifecycle**: `onSettled` replaces `onMount`, executing after async dependencies resolve and supporting direct cleanup returns.
12. **Polymorphic `<Dynamic>`**: Combine `ValidComponent`, `ComponentProps<T>` (from `@solidjs/web`), and `omit` to build strongly typed primitives with the `as` prop (`splitProps` is the 1.x legacy predecessor).
13. **Providerless Context**: `createContext` returns the provider component itself. Use `<AuthContext value={...}>` (no `.Provider`) and rely on `ContextNotFoundError` instead of manual `undefined` guards.
14. **Transactional Actions**: `action(function* () { ... yield ... })` groups writes between yields into transactions and returns `Promise<R>`. `refresh(target)` re-asks for the next settled state.
15. **Optimistic State**: `createOptimistic` returns a signal overlay; `createOptimisticStore(derive, seed)` returns a store overlay that reverts when the confirmed value settles.
16. **Server Functions**: `"use server"` modules compile to RPC endpoints dispatched by `handleServerFunctionRequest` from `@solidjs/web`. Validate `unknown` input with Zod/Valibot, and remember `handleRequest` is not a Solid export.
