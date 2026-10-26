# Module 13: SolidJS 2.x with TypeScript — Fine-Grained Reactivity, Signals, Stores, & Async Architecture
**Extension Module | Total TypeScript Professional Course**

---

## Overview & Mental Model

While React treats component functions as rendering routines executed repeatedly on every state change, **SolidJS executes component functions exactly once as initialization constructors**. In Solid, components are not units of re-rendering; they exist solely to wire a reactive dependency graph directly to DOM nodes. Once setup finishes, reactive updates bypass the component function and mutate DOM text nodes and attributes directly—without a Virtual DOM (VDOM), reconciliation diffing, or component re-execution.

In **SolidJS 2.x (`@solidjs/signals`)**, the framework elevates this model by rebuilding its core reactive engine from the ground up:
1. **Asynchronous Reactivity in the Graph**: Asynchronicity is a first-class citizen. Ordinary memos and async computations (`createAsync`, `createMemo`) natively return promises; downstream subscribers track pending states automatically and bubble out-of-band to `<Loading>` and `<Errored>` boundaries.
2. **Deterministic Microtask Batching**: State writes are batched onto the microtask queue by default. Synchronous reads inside the same tick remain stable and glitch-free until a `flush()` occurs or the microtask resolves.
3. **Two-Phase Split Effects**: `createEffect(compute, effect)` cleanly isolates synchronous reactive dependency tracking (Phase 1) from untracked side-effect execution and cleanup (Phase 2).
4. **Draft-First Stores & Projections**: `createStore` defaults to draft-first mutation semantics, while `createProjection` creates fine-grained, derived read-only stores that update with $O(1)$ property-level precision.
5. **Unified Control Flow & Directives**: List rendering is unified under `<For>` (with child item accessors and `keyed={false}` replacing the removed `<Index>`), while custom directives transition from compiler transforms (`use:*`) to composable **ref directive factories**.

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
| **Async Reactivity** | `createResource` returning `[Resource<T>, { mutate, refetch }]` (`T \| undefined`) | **First-class async in graph**: `createAsync` & async `createMemo` return non-nullable `Accessor<T>` | Eliminates the mental tax of async data being an external wrapper; promises flow through ordinary memos. |
| **Async Inspection** | `resource.loading`, `resource.error` | `isPending(accessor)` & `await resolve(accessor)` | Standalone utility functions inspect any async accessor without coupling to resource wrappers. |
| **UI Boundaries** | `<Suspense fallback={...}>` & `<ErrorBoundary fallback={...}>` | **`<Loading fallback={...}>`** & **`<Errored fallback={...}>`** | Granular async settlement; supports stale-while-revalidate transitions without layout flickering. |
| **Side Effects** | Single-function `createEffect(() => ...)` (implicit dependency tracking across entire body) | **Split two-phase `createEffect(compute, effect)`** | Phase 1 synchronously defines tracked dependencies; Phase 2 executes side effects and returns cleanups. |
| **Component Lifecycles** | `onMount(() => ...)` with separate `onCleanup` | **`onSettled(() => { ...; return () => ...; })`** | Async-aware: executes after initial render and async dependencies settle; directly returns cleanups. |
| **List Iteration** | `<For>` (by item reference) + separate `<Index>` (by array index) | **Unified `<For>`**: `<For keyed={false}>` replaces `<Index>`; child parameters receive accessors | Unifies list rendering; child parameters consistently receive accessors across keyed and unkeyed modes. |
| **Directives** | Compiler transform `use:name={val}` + `JSX.Directives` interface augmentation | **Ref Directive Factories**: `ref={directiveFactory(...)}` | Eliminates compiler magic and namespace collisions; uses standard composable ref functions. |
| **Store Setters** | Path syntax tuples or external `produce(...)` wrapper | **Draft-first store setters**: `setStore(draft => { ... })` | Intuitive mutable draft semantics are native to store setters without extra library imports. |
| **Derived Stores** | `createMemo(() => state.items.filter(...))` returning new array references | **`createProjection(draft => ...)`** | Maintains derived stores via mutable drafts, preserving identity and updating with $O(1)$ precision. |

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
    "jsxImportSource": "solid-js"
  }
}
```

- `"jsx": "preserve"`: Leaves JSX intact in `.tsx` files for `@solidjs/vite-plugin` or `babel-preset-solid`.
- `"jsxImportSource": "solid-js"`: Resolves JSX types from `solid-js/jsx-runtime` instead of `@types/react`.

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

### 13.2.2 First-Class Async `createMemo<T>` & `createAsync<T>`

In Solid 1.x, asynchronous data fetching required `createResource`, which returned `[Resource<T>, { mutate, refetch }]` where `resource()` returned `T | undefined`.

**Solid 2.0 introduces first-class async directly into the reactive graph**, superseding `createResource`:
1. `createMemo` and `createAsync` natively accept promises or async iterables.
2. The accessor returned by `createAsync<T>` is typed as `Accessor<T>` (`() => T`, **not** `T | undefined`!).
3. If the promise is pending or rejected, the runtime automatically suspends execution of the tracking scope and propagates the state out-of-band to the nearest `<Loading>` or `<Errored>` boundary.

```typescript
import { createAsync, Accessor } from "solid-js";

interface Article { id: string; title: string; body: string; }
declare function fetchArticle(id: string): Promise<Article>;

export function ArticleViewer(props: { articleId: Accessor<string> }) {
  const article = createAsync<Article>(async () => fetchArticle(props.articleId()));
  //    ^? const article: Accessor<Article>
  type TestArticleType = Expect<Equal<ReturnType<typeof article>, Article>>;

  return <article><h2>{article().title}</h2><p>{article().body}</p></article>;
}
```

#### Inspecting and Resolving Async Signals: `isPending` and `resolve`

In Solid 2.0, checking whether an async signal is loading or extracting its underlying Promise is handled via standalone utility functions:

```typescript
import { isPending, resolve, Accessor } from "solid-js";
declare const articleAccessor: Accessor<{ id: string; title: string }>;

// 1. `isPending` returns boolean without triggering boundary suspension:
const loading: boolean = isPending(articleAccessor);

// 2. `resolve` extracts a Promise<T> to await programmatically:
async function printArticle() {
  const data = await resolve(articleAccessor);
  console.log("Resolved article:", data.title);
}
```

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
import { createStore, Store, SetStoreFunction } from "solid-js/store";

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
import { createStore } from "solid-js/store";

// 1. Native draft-first setter: mutate directly on the draft!
setState((draft) => {
  draft.todos.push({ id: "2", title: "Ship curriculum", completed: false });
  draft.user.preferences.theme = "dark";
});

// 2. Path syntax: Target nested properties directly with strict compile-time checking
setState("user", "preferences", "theme", "light");
```

### 13.3.3 Solid 2.0 `createProjection`: Derived Store Projections

In Solid 1.x, deriving filtered collections via `createMemo` returned new array references on every change, invalidating downstream subscriber identity.

**Solid 2.0 introduces `createProjection`**, which maintains a read-only derived store updated via a mutable draft callback with $O(1)$ property-level notifications:

```typescript
import { createStore, createProjection, Store } from "solid-js/store";

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

---

## Lesson 13.4: Typing Solid Components, Props (`mergeProps`, `splitProps`), Control Flow, and Boundaries

### 13.4.1 Component Types: `Component`, `ParentComponent`, `VoidComponent`, `FlowComponent`

```typescript
import { Component, ParentComponent, VoidComponent, FlowComponent, JSX } from "solid-js";

// 1. Component<P>: Standard component; does NOT implicitly include children
export const Avatar: Component<{ src: string; size?: number }> = (p) => <img src={p.src} width={p.size ?? 40} />;

// 2. ParentComponent<P>: Intersects P with { children?: JSX.Element }
export const Card: ParentComponent<{ elevation: 1 | 2 | 3 }> = (p) => <div class={`card-${p.elevation}`}>{p.children}</div>;

// 3. VoidComponent<P>: Forbids children (children?: never)
export const Divider: VoidComponent<{ horizontal?: boolean }> = (p) => <hr class={p.horizontal ? "h" : "v"} />;

// 4. FlowComponent<P, C>: Custom render-prop or function children
export const List = <T,>(p: FlowComponent<{ items: T[] }, (item: T) => JSX.Element>) => <div>{p.items.map(p.children)}</div>;
```

### 13.4.2 Preserving Reactivity: `mergeProps` & `splitProps`

#### `mergeProps`: Type-Safe Default Values

`mergeProps` creates a reactive proxy merging defaults without evaluating getters eagerly, while turning optional defaulted keys into required types:

```typescript
import { mergeProps } from "solid-js";

interface ButtonProps { label: string; variant?: "primary" | "secondary"; size?: "sm" | "md"; }

export function Button(rawProps: ButtonProps) {
  const props = mergeProps({ variant: "primary" as const, size: "md" as const }, rawProps);
  type TestVariant = Expect<Equal<typeof props.variant, "primary" | "secondary">>;
  type TestSize = Expect<Equal<typeof props.size, "sm" | "md">>;
  return <button class={`btn-${props.variant} btn-${props.size}`}>{props.label}</button>;
}
```

#### `splitProps`: Splitting Local and Forwarded Attributes

`splitProps` extracts specific keys into a typed tuple: `[Pick<Props, K1>, Pick<Props, K2>, Omit<Props, K1 | K2>]`:

```typescript
import { splitProps, JSX } from "solid-js";

interface InputProps extends JSX.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  errorMessage?: string;
}

export function TextInput(props: InputProps) {
  const [local, inputAttrs] = splitProps(props, ["label", "errorMessage"]);
  type TestLocalLabel = Expect<Equal<typeof local.label, string>>;
  type TestLocalError = Expect<Equal<typeof local.errorMessage, string | undefined>>;

  return (
    <div class="field">
      <label>{local.label}</label>
      <input {...inputAttrs} />
      {local.errorMessage && <span class="error">{local.errorMessage}</span>}
    </div>
  );
}
```

### 13.4.3 Unified Control Flow: `<Show>`, `<For>` (Accessor Child & `keyed={false}`), `<Switch>`

In Solid 1.x, `<For>` and `<Index>` were separate primitives with differing callback conventions.

In **Solid 2.0**:
- `<Index>` is **removed**.
- List rendering is unified under **`<For>`**.
- In keyed mode (default), `<For>` passes an **`Accessor<T>`** for items (`(item: Accessor<T>, index: Accessor<number>) => ...`).
- In unkeyed mode (replacing `<Index>`), pass **`keyed={false}`**, where each child receives `(item: Accessor<T>, index: number)`.

```tsx
import { Show, For, Switch, Match, createSignal, Accessor, JSX } from "solid-js";
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
            {/* 2. <Switch> / <Match>: Discriminated matching */}
            <Switch fallback={<span>Member Mode</span>}>
              <Match when={activeUser().role === "admin"}><span>Admin Console</span></Match>
            </Switch>
          </div>
        )}
      </Show>

      {/* 3. <For> Keyed (Default): item is Accessor<T>, index is Accessor<number> */}
      <For each={tags()}>
        {(tag: Accessor<string>, index: Accessor<number>) => (
          <div>{index()}: {tag()}</div>
        )}
      </For>

      {/* 4. <For keyed={false}> (Replaces removed <Index>): index is number, item is Accessor<T> */}
      <For each={tags()} keyed={false}>
        {(tag: Accessor<string>, index: number) => (
          <div>{index}: {tag()}</div>
        )}
      </For>
    </div>
  );
}
```

### 13.4.4 Async Boundaries in Solid 2.0: `<Loading>` and `<Errored>`

Solid 2.0 rethinks boundaries to match its native async graph:
- **`<Loading fallback={<Spinner />}>`**: Suspends when any child signal read is pending. Supports stale-while-revalidate transitions so the existing UI remains visible during background re-fetching.
- **`<Errored fallback={(err, reset) => <ErrorView error={err} onRetry={reset} />}>`**: Catches unhandled promise rejections and reactive compute exceptions.

```tsx
import { Loading, Errored } from "solid-js";

export function AsyncLayout(props: { children: any }) {
  return (
    <Errored fallback={(err, reset) => <div>Failed: {String(err)} <button onClick={reset}>Retry</button></div>}>
      <Loading fallback={<div>Loading data...</div>}>
        {props.children}
      </Loading>
    </Errored>
  );
}
```

### 13.4.5 Strongly Typed Context: `createSafeSolidContext<T>`

Solid's `createContext<T>()` returns `Context<T | undefined>` when initialized without defaults. The `createSafeSolidContext` factory guarantees non-undefined returns:

```typescript
import { createContext, useContext, ParentComponent, Accessor } from "solid-js";

export function createSafeSolidContext<T>(name: string): [Provider: ParentComponent<{ value: T }>, useHook: () => T] {
  const Context = createContext<T | undefined>(undefined);
  const Provider: ParentComponent<{ value: T }> = (props) => <Context.Provider value={props.value}>{props.children}</Context.Provider>;
  const useHook = (): T => {
    const value = useContext(Context);
    if (value === undefined) throw new Error(`useSafeContext: "${name}" was used outside Provider!`);
    return value;
  };
  return [Provider, useHook] as const;
}

interface AuthState { user: Accessor<string | null>; logout: () => void; }
const [AuthProvider, useAuth] = createSafeSolidContext<AuthState>("AuthContext");

export function Nav() {
  const auth = useAuth();
  //    ^? const auth: AuthState (Guaranteed non-undefined)
  return <button onClick={auth.logout}>Logout</button>;
}
```

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
import { For, JSX } from "solid-js";

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
            <span>{item().title}</span>
            <button onClick={[handleDelete, item().id]}>Delete</button>
          </li>
        )}
      </For>
    </ul>
  );
}
```

### 13.5.5 Strongly Typed Polymorphic Components (`<Dynamic>`)

To create polymorphic UI components (e.g. `<Button as="a" href="..." />`), Solid provides `<Dynamic>` from `solid-js/web`:

```tsx
import { splitProps, ValidComponent, ComponentProps } from "solid-js";
import { Dynamic } from "solid-js/web";

export type PolymorphicProps<T extends ValidComponent, P = {}> = P & { as?: T; } & Omit<ComponentProps<T>, keyof P | "as">;

export function PolymorphicButton<T extends ValidComponent = "button">(props: PolymorphicProps<T, { variant?: "solid" | "outline" }>) {
  const [local, others] = splitProps(props, ["as", "variant"]);
  return <Dynamic component={local.as ?? "button"} class={`btn-${local.variant ?? "solid"}`} {...others} />;
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

## Anti-Patterns vs. Best Practices

| Category | ❌ Solid 1.x Legacy / React Anti-Pattern | ✅ Solid 2.x Best Practice | Reason / Impact |
| :--- | :--- | :--- | :--- |
| **Props** | `function Box({ title, count }: Props)` | `function Box(props: Props)` | Destructuring severs the reactive proxy. Access via `props.x`, `splitProps`, or `mergeProps`. |
| **Default Props** | `{ size = "md" } = props;` | `const p = mergeProps({ size: "md" }, props);` | Object destructuring reads properties once at setup. `mergeProps` preserves dynamic reactivity. |
| **Async Data** | `const [res] = createResource(fetcher)` | `const data = createAsync(() => fetcher())` | Solid 2.0 replaces `createResource` with first-class async signals returning non-nullable `Accessor<T>`. |
| **Pending States** | `res.loading ? <Spinner /> : ...` | `<Loading fallback={<Spinner />}>` / `isPending(data)` | Boundaries handle loading out-of-band; `isPending` inspects transitions without suspense triggers. |
| **Error Handling** | `<ErrorBoundary fallback={...}>` | `<Errored fallback={(err, reset) => ...}>` | Solid 2.0 `<Errored>` boundary integrates natively with promise rejections and reactive errors. |
| **Effects** | `createEffect(() => console.log(x()))` | `createEffect(() => x(), (val) => console.log(val))` | Two-phase split prevents unintentional dependency tracking and cleans up naturally. |
| **Lifecycles** | `onMount(() => { ...; onCleanup(...) })` | `onSettled(() => { ...; return () => ...; })` | `onSettled` waits for async resolution and directly returns its cleanup function. |
| **List Iteration** | `<Index each={items()}>...` | `<For each={items()} keyed={false}>...` | `<Index>` is removed in 2.0; unified `<For>` handles unkeyed index iteration via `keyed={false}`. |
| **Directives** | `<div use:clickOutside={onClose} />` | `<div ref={clickOutside(onClose)} />` | `use:*` compiler syntax is removed; ref directive factories provide clean composability without JSX augmentation. |
| **Store Setters** | `setState(produce(draft => { ... }))` | `setState(draft => { ... })` | Store setters feature native draft-first semantics; no external `produce` wrapper needed. |
| **Derived Stores** | `createMemo(() => state.items.filter(...))` | `createProjection(draft => ...)` | Returning new array references breaks subscriber identity. `createProjection` emits fine-grained updates. |
| **Event Handlers** | `onClick={() => deleteItem(item().id)}` | `onClick={[deleteItem, item().id]}` | Inline lambdas allocate new closures per row. Tuple delegation uses zero allocations. |

---

## Hands-On Exercises

### Exercise 13.1: Reactive State Machine & Async Search Filter with `createSignal`, `createAsync`, and `isPending`

#### Problem Statement
Build a type-safe autocomplete search system in Solid 2.x:
1. Define a discriminated union state machine representing search states: `idle`, `loading`, `success`, `error`.
2. Implement a `useDebouncedSearch` primitive accepting a query `Accessor<string>` and an async search fetcher.
3. Use Solid 2.0's first-class async primitive (`createAsync`), check pending state via `isPending`, and ensure accessor return types are statically verified.

#### Complete Solution & Explanation

```typescript
import { createSignal, createEffect, createMemo, createAsync, Accessor, isPending } from "solid-js";

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

  const results = createAsync<SearchResult[]>(async () => {
    const q = debouncedQuery().trim();
    if (q.length === 0) return [];
    return await fetcher(q);
  });

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
import { createStore, createProjection, Store } from "solid-js/store";

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
    setState("products", productId, (draft) => {
      if (draft && draft.stock >= count) draft.stock -= count;
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

### Exercise 13.3: Strongly Typed Polymorphic UI Primitive with `splitProps`, `<Dynamic>`, and Ref Directive Factory

#### Problem Statement
Build an accessible polymorphic `<Box>` component with Solid 2.0 ref directive integration:
1. Accept an optional `as` prop accepting any valid Solid HTML tag or component (e.g., `"div"`, `"button"`, `"a"`).
2. Extract custom styling props (`padding`, `elevation`, `bordered`) using `splitProps`.
3. Support element-specific attributes (e.g., `href` only allowed when `as="a"`) without TypeScript errors.
4. Attach an auto-focus ref directive factory using Solid 2.0 `ref={...}` semantics.

#### Complete Solution & Explanation

```tsx
import { splitProps, ValidComponent, ComponentProps, JSX } from "solid-js";
import { Dynamic } from "solid-js/web";

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
  const [local, nativeAttrs] = splitProps(props as BoxProps<ValidComponent>, [
    "as", "padding", "elevation", "bordered", "children",
  ]);

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

### Exercise 13.4: Safe Solid Context Provider with Signal/Store Fallback, `<Loading>`, and `onSettled`

#### Problem Statement
Construct an enterprise Theme & Feature Flag context architecture in Solid 2.0:
1. Support both signal accessors (`theme: Accessor<"light" | "dark">`) and a store of feature flags (`flags: Store<Record<string, boolean>>`).
2. Implement a `createSafeSolidContext` helper preventing runtime null assertions.
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
  JSX,
  Show,
  onSettled
} from "solid-js";
import { createStore, Store } from "solid-js/store";

export type ThemeMode = "light" | "dark";

export interface AppConfigContextValue {
  theme: Accessor<ThemeMode>;
  setTheme: (mode: ThemeMode) => void;
  flags: Store<Record<string, boolean>>;
  setFlag: (flagName: string, enabled: boolean) => void;
}

export function createStrictContext<T>(name: string): [
  Provider: ParentComponent<{ value: T }>,
  useHook: () => T
] {
  const Ctx = createContext<T | undefined>(undefined);

  const Provider: ParentComponent<{ value: T }> = (props) => (
    <Ctx.Provider value={props.value}>{props.children}</Ctx.Provider>
  );

  const useHook = (): T => {
    const val = useContext(Ctx);
    if (!val) throw new Error(`Context "${name}" must be consumed within its Provider!`);
    return val;
  };

  return [Provider, useHook] as const;
}

const [ConfigProvider, useAppConfig] = createStrictContext<AppConfigContextValue>("AppConfigContext");

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
    setFlag: (flag, enabled) => setFlagsStore(flag, enabled),
  };

  return <ConfigProvider value={value}>{props.children}</ConfigProvider>;
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
3. **Never Destructure Props**: Props are reactive proxy objects. Destructuring destroys reactivity. Access via `props.title`, `mergeProps` (for default values), and `splitProps` (for prop extraction).
4. **Control-Flow Narrowing**: Use `<Show when={val()}>{(v) => ...}</Show>` to narrow types inside JSX. `v` is typed as `Accessor<NonNullable<T>>`.
5. **Solid 2.0 First-Class Async**: `createAsync` directly returns `Accessor<T>` (not `T | undefined`). Pending computations propagate to `<Loading>` and `<Errored>` boundaries automatically. Inspect via `isPending(accessor)` and `await resolve(accessor)`.
6. **Two-Phase Effects**: Solid 2.0 `createEffect(compute, effect)` separates pure synchronous tracking from side-effect execution, providing automatic TypeScript parameter inference and direct cleanup return.
7. **Stores & Draft Setters**: `createStore` manages deep nested proxies. Setters support native draft mutations (`setState(draft => { draft.done = true; })`) without Immer or `produce` wrapper boilerplate.
8. **Derived Projections**: `createProjection` creates derived stores via mutable draft callbacks without invalidating array or object references, preserving $O(1)$ fine-grained notification precision.
9. **Unified List Iteration**: `<For>` is unified across keyed (default) and unkeyed (`keyed={false}`, replacing removed `<Index>`). Child render parameters consistently receive accessors.
10. **Ref Directive Factories**: Legacy `use:*` compiler directives are removed in favor of composable ref factories `ref={directiveFactory(...)}` returning optional cleanup functions.
11. **Async-Aware Lifecycle**: `onSettled` replaces `onMount`, executing after async dependencies resolve and supporting direct cleanup returns.
12. **Polymorphic `<Dynamic>`**: Combine `ValidComponent`, `ComponentProps<T>`, and `splitProps` to build strongly typed primitives with the `as` prop.
