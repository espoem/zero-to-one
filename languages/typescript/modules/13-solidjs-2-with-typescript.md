# Module 13: SolidJS 2.x with TypeScript — Fine-Grained Reactivity, Signals, Stores, & Async Architecture
**Extension Module | Total TypeScript Professional Course**

---

## Overview & Mental Model

While React treats component functions as rendering routines executed repeatedly on every state change, **SolidJS executes component functions exactly once as initialization constructors**. In Solid, components are not units of re-rendering; they exist solely to wire a reactive dependency graph directly to DOM nodes. Once setup finishes, reactive updates bypass the component function and mutate DOM text nodes and attributes directly—without a Virtual DOM (VDOM), reconciliation diffing, or component re-execution.

This architectural shift fundamentally redefines TypeScript patterns:
1. **Prop Reactivity**: Destructuring props severs reactivity because Solid's props are getter proxies. Preserving reactivity requires `props.property`, `mergeProps`, or `splitProps`.
2. **Control Flow & Narrowing**: React-style `if (user()) return <Child user={user()} />` evaluates once during setup. Narrowing dynamic values in JSX requires accessor callbacks: `<Show when={user()}>{(u) => <Child user={u()} />}</Show>`.
3. **Solid 2.0 Async-First Reactivity (`@solidjs/signals`)**: Solid 2.0 deprecates `createResource` in favor of first-class async signals. Any `createMemo` or `createAsync` can return a `Promise<T>`, yet its accessor return type is statically typed as `Accessor<T>` (`() => T`, not `T | undefined`), propagating pending and error states out-of-band to `<Loading>` and `<ErrorBoundary>`.
4. **Deep Store Projections**: `createStore` manages nested reactive proxy trees with path-syntax mutations, while Solid 2.0's `createProjection` derives read-only store projections using mutable draft callbacks that notify subscribers with $O(1)$ precision.
5. **DOM Primitives & Directives**: Solid provides compile-time safety for DOM variable refs, custom directives (`use:*`), tuple-delegated events (`onClick={[handler, data]}`), and polymorphic UI primitives (`<Dynamic>`).

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
               Fine-Grained Updates │                        │ Nested Property Updates
                                    ▼                        ▼
┌──────────────────────────────────────────────┐  ┌──────────────────────────────────────────┐
│ Signal Accessor: <span>{count()}</span>      │  │ createProjection / Store Path            │
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

## Lesson 13.1: SolidJS Mental Model vs. React & `tsconfig.json` Setup for Solid 2.x

### 13.1.1 Why Solid Components Run Once (Setup Phase)

In React, state updates re-render the entire component function. In SolidJS, **the component body runs exactly once on mount**.

```tsx
import { createSignal, onCleanup } from "solid-js";

export function Counter() {
  console.log("Counter setup executed!"); // Logs EXACTLY ONCE on mount!
  const [count, setCount] = createSignal<number>(0);
  const timer = setInterval(() => setCount((prev) => prev + 1), 1000);
  onCleanup(() => clearInterval(timer));

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

---

## Lesson 13.2: Fine-Grained Reactive Primitives in Solid 2.x (`@solidjs/signals`)

Solid 2.0 unifies reactivity around `@solidjs/signals`. Reactivity consists of two atomic concepts: **Signals** (producers) and **Computations/Effects** (consumers).

### 13.2.1 `createSignal<T>`: Accessors, Setters, and Uninitialized Signals

A signal is an observable state container returning a getter/setter tuple:

```typescript
import { createSignal, Accessor, Setter } from "solid-js";

type Signal<T> = [get: Accessor<T>, set: Setter<T>];

const [count, setCount] = createSignal<number>(0);
//    ^? const count: Accessor<number>
//           ^? const setCount: Setter<number>
setCount(10);                 // Direct value update
setCount((prev) => prev + 1); // Functional updater

type TestAccessor = Expect<Equal<typeof count, Accessor<number>>>;
type TestSetter = Expect<Equal<typeof setCount, Setter<number>>>;

// Uninitialized signals widen to T | undefined:
const [query, setQuery] = createSignal<string>();
//    ^? const query: Accessor<string | undefined>
type TestUninit = Expect<Equal<ReturnType<typeof query>, string | undefined>>;

const [tab, setTab] = createSignal<"home" | "profile">("home");
type TestTab = Expect<Equal<ReturnType<typeof tab>, "home" | "profile">>;
```

### 13.2.2 First-Class Async `createMemo<T>` & `createAsync<T>` in Solid 2.0

In Solid 1.x, asynchronous data required `createResource`, which returned `[Resource<T>, { mutate, refetch }]` where `resource()` returned `T | undefined`.

**Solid 2.0 introduces first-class async directly into the reactive graph**, superseding `createResource`:
1. `createMemo` and `createAsync` natively accept promises or async iterables.
2. The accessor returned by `createAsync<T>` is typed as `Accessor<T>` (`() => T`, **not** `T | undefined`!).
3. If the promise is pending or rejected, the runtime automatically suspends execution of the tracking scope and propagates the state to the nearest `<Loading>` or `<ErrorBoundary>` boundary.

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

```typescript
import { isPending, resolve, Accessor } from "solid-js";
declare const articleAccessor: Accessor<{ id: string; title: string }>;

// 1. `isPending` returns Accessor<boolean> without triggering Suspense:
const loading = isPending(articleAccessor);
type TestPending = Expect<Equal<typeof loading, Accessor<boolean>>>;

// 2. `resolve` extracts a Promise<T> to await programmatically:
async function printArticle() {
  const data = await resolve(articleAccessor);
  console.log("Resolved article:", data.title);
}
```

### 13.2.3 Split `createEffect` & `createRenderEffect` in Solid 2.0

Solid 2.0 separates pure reactive compute/tracking from side-effect execution:
- **Phase 1 (`compute`)**: A pure tracking callback that synchronously reads signals and returns a value of type `T`.
- **Phase 2 (`effect`)**: A side-effect callback that runs asynchronously with `(value: T, prev?: T)`. Signals read here are **not** tracked.

```typescript
import { createSignal, createEffect } from "solid-js";

const [volume, setVolume] = createSignal<number>(75);
const [muted, setMuted] = createSignal<boolean>(false);

createEffect(
  // Compute callback: Only signals read here are tracked
  () => ({ currentVolume: volume(), isMuted: muted() }),
  // Effect handler: TypeScript infers `data: T` from compute's return type!
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

## Lesson 13.3: Deep Reactivity with `createStore`, `produce`, `reconcile`, and Solid 2.0 `createProjection`

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

### 13.3.2 Path-Syntax Type Safety, `produce`, and `reconcile`

`SetStoreFunction` supports path tuples, Immer-like mutable drafts with `produce`, and structural diffing with `reconcile`:

```typescript
import { produce, reconcile } from "solid-js/store";

// 1. Path syntax: Target nested property directly with full type-checking
setState("user", "preferences", "theme", "dark");
// 2. Predicate filter path: Toggle completed for matching items
setState("todos", (todo) => !todo.completed, "completed", true);
// 3. `produce` for mutable drafts:
setState("todos", produce((draft) => {
  draft.push({ id: "2", title: "Ship course", completed: false });
  if (draft[0]) draft[0].title = "Draft Solid 2.x Module";
}));
// 4. `reconcile` for deep diffing external payloads:
async function syncTodos() {
  const fresh: TodoItem[] = await (await fetch("/api/todos")).json();
  setState("todos", reconcile(fresh, { key: "id" }));
}
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

## Lesson 13.4: Typing Solid Components, Props (`mergeProps`, `splitProps`), Control Flow, and Context

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

### 13.4.3 Type-Narrowing in Control Flow (`<Show>`, `<For>`, `<Index>`, `<Switch>`, `<Loading>`)

```tsx
import { Show, For, Index, Switch, Match, createSignal, Accessor, JSX } from "solid-js";
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
      {/* 3. <For>: Keyed by ITEM reference (item is T, index is Accessor<number>) */}
      <For each={tags()}>{(tag, index) => <div>{index()}: {tag}</div>}</For>
      {/* 4. <Index>: Keyed by ARRAY INDEX (index is number, item is Accessor<T>) */}
      <Index each={tags()}>{(tagAcc, index) => <div>{index}: {tagAcc()}</div>}</Index>
    </div>
  );
}
```

> **`<For>` vs `<Index>`**:
> - `<For>` keys by item reference. Use when items move, reorder, or have unique IDs (`item: T`, `index: Accessor<number>`).
> - `<Index>` keys by position. Use for primitive arrays where array size is stable but values change (`item: Accessor<T>`, `index: number`).

### 13.4.4 Strongly Typed Context: `createSafeSolidContext<T>`

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

## Lesson 13.5: DOM Refs, Custom Directives, Event Handlers, and Polymorphic Components

### 13.5.1 DOM Refs: Variable Refs vs Callback Refs

In Solid, refs assign the instantiated DOM node directly to a variable rather than using a `{ current: T }` container:

```tsx
import { onMount } from "solid-js";

export function AutoFocusInput() {
  let inputRef!: HTMLInputElement; // Definite assignment assertion
  onMount(() => { inputRef.focus(); inputRef.select(); });
  return <input ref={inputRef} placeholder="Focused on mount" />;
}

export const CallbackRef = () => <input ref={(el: HTMLInputElement) => el.setAttribute("data-ready", "true")} />;
```

### 13.5.2 Custom Directives (`use:*`) & Global JSX Augmentation

Directives attach reusable behaviors to DOM nodes (`use:directiveName={value}`). Augment `JSX.Directives` to make directives type-safe:

```typescript
import { Accessor, onCleanup } from "solid-js";

export function clickOutside(el: HTMLElement, accessor: Accessor<() => void>) {
  const onClick = (e: MouseEvent) => { if (!el.contains(e.target as Node)) accessor()(); };
  document.addEventListener("click", onClick);
  onCleanup(() => document.removeEventListener("click", onClick));
}

declare module "solid-js" {
  namespace JSX { interface Directives { clickOutside: () => void; } }
}

export function Dropdown(props: { onClose: () => void }) {
  false && clickOutside;
  return <div use:clickOutside={props.onClose}>Dropdown Content</div>;
}
```

### 13.5.3 Event Handlers: `on:*` vs `onClick` & Tuple Delegation

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
            <span>{item.title}</span>
            <button onClick={[handleDelete, item.id]}>Delete</button>
          </li>
        )}
      </For>
    </ul>
  );
}
```

### 13.5.4 Polymorphic Components in Solid (`<Dynamic>`)

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

| Category | ❌ Anti-Pattern | ✅ Solid 2.x Best Practice | Reason / Impact |
| :--- | :--- | :--- | :--- |
| **Props** | `function Box({ title, count }: Props)` | `function Box(props: Props)` | Destructuring severs the reactive proxy. Access via `props.x`, `splitProps`, or `mergeProps`. |
| **Default Props** | `{ size = "md" } = props;` | `const p = mergeProps({ size: "md" }, props);` | Object destructuring reads properties once at setup. `mergeProps` preserves dynamic reactivity. |
| **Async Data** | `const [res] = createResource(fetcher)` | `const data = createAsync(() => fetcher())` | Solid 2.0 replaces `createResource` with first-class async signals returning non-nullable `Accessor<T>`. |
| **JSX Narrowing** | `{user() ? <span>{user().name}</span> : null}` | `<Show when={user()}>{(u) => <span>{u().name}</span>}</Show>` | TS cannot narrow across repeated `user()` calls. `<Show>` passes a narrowed `Accessor<NonNullable<T>>`. |
| **List Iteration** | `items().map((i) => <Item item={i} />)` | `<For each={items()}>{(i) => <Item item={i} />}</For>` | Array `.map()` in JSX destroys and re-creates DOM nodes on every update. `<For>` diffs by reference. |
| **Derived State** | `createEffect(() => setDouble(count() * 2))` | `const double = createMemo(() => count() * 2)` | Syncing state via effects causes extra rendering cycles. Memos compute lazily and cache. |
| **List Handlers** | `onClick={() => deleteItem(item.id)}` | `onClick={[deleteItem, item.id]}` | Inline lambdas allocate new closure instances per row. Tuple delegation uses zero allocations. |
| **Derived Stores** | `createMemo(() => state.items.filter(...))` | `createProjection<Item[]>(draft => ...)` | Returning new arrays from `createMemo` invalidates references. `createProjection` emits fine-grained updates. |

---

## Hands-On Exercises

### Exercise 13.1: Reactive State Machine & Async Search Filter with `createSignal` and `createAsync`

#### Problem Statement
Build a type-safe autocomplete search system in Solid 2.x:
1. Define a discriminated union state machine representing search states: `idle`, `loading`, `success`, `error`.
2. Implement a `useDebouncedSearch` primitive accepting a query `Accessor<string>` and an async search fetcher.
3. Use Solid 2.0's first-class async primitives (`createAsync`) and ensure the accessor return type is statically verified.

#### Complete Solution & Explanation

```typescript
import { createSignal, createMemo, createAsync, Accessor, onCleanup } from "solid-js";

export interface SearchResult { id: string; label: string; }
export type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; results: SearchResult[] }
  | { status: "error"; error: string };

export function createDebouncedSignal<T>(source: Accessor<T>, delayMs: number): Accessor<T> {
  const [debounced, setDebounced] = createSignal<T>(source());
  let timer: NodeJS.Timeout | number | undefined;

  createMemo(() => {
    const value = source();
    clearTimeout(timer);
    timer = setTimeout(() => setDebounced(() => value), delayMs);
  });

  onCleanup(() => clearTimeout(timer));
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

### Exercise 13.2: Deep Store Manipulation with `createStore`, `produce`, and `createProjection`

#### Problem Statement
Design an inventory tracking store with fine-grained projections:
1. Define a domain store containing `products` (dictionary indexed by string ID) and `cart` (array of cart items).
2. Write typed mutation functions for adding an item to the cart using path syntax, and modifying quantities using `produce`.
3. Create a derived store projection using Solid 2.0 `createProjection` that calculates cart totals and warns when inventory is below threshold.

#### Complete Solution & Explanation

```typescript
import { createStore, produce, createProjection, Store } from "solid-js/store";

export interface Product { id: string; name: string; price: number; stock: number; }
export interface CartItem { productId: string; quantity: number; }
export interface InventoryState { products: Record<string, Product>; cart: CartItem[]; }
export interface CartSummary { totalItems: number; totalPrice: number; outOfStockIds: string[]; }

export function createInventoryManager(initialProducts: Product[]) {
  const productsMap: Record<string, Product> = {};
  for (const p of initialProducts) productsMap[p.id] = p;

  const [state, setState] = createStore<InventoryState>({ products: productsMap, cart: [] });

  const addToCart = (productId: string, quantity: number = 1) => {
    const existingIndex = state.cart.findIndex((item) => item.productId === productId);
    if (existingIndex >= 0) {
      setState("cart", existingIndex, "quantity", (q) => q + quantity);
    } else {
      setState("cart", (prev) => [...prev, { productId, quantity }]);
    }
  };

  const decrementStock = (productId: string, count: number) => {
    setState("products", productId, produce((draft) => {
      if (draft && draft.stock >= count) draft.stock -= count;
    }));
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

### Exercise 13.3: Strongly Typed Polymorphic UI Primitive with `splitProps` and `<Dynamic>`

#### Problem Statement
Build an accessible polymorphic `<Box>` component:
1. Accept an optional `as` prop accepting any valid Solid HTML tag or component (e.g., `"div"`, `"button"`, `"a"`).
2. Extract custom styling props (`padding`, `elevation`, `bordered`) using `splitProps`.
3. Support element-specific attributes (e.g., `href` only allowed when `as="a"`) without TypeScript errors.

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
      <Box as="button" type="submit" disabled padding="sm">Submit Box</Box>
    </>
  );
}
```

---

### Exercise 13.4: Safe Solid Context Provider with Signal/Store Fallback and Accessor Narrowing

#### Problem Statement
Construct an enterprise Theme & Feature Flag context architecture:
1. Support both signal accessors (`theme: Accessor<"light" | "dark">`) and a store of feature flags (`flags: Store<Record<string, boolean>>`).
2. Implement a `createSafeSolidContext` helper preventing runtime null assertions.
3. Build a `<FeatureGate>` flow component that narrows children rendering based on active feature flags.

#### Complete Solution & Explanation

```tsx
import {
  createContext,
  useContext,
  createSignal,
  ParentComponent,
  Accessor,
  JSX,
  Show
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
2. **Never Destructure Props**: Props are reactive proxy objects. Destructuring destroys reactivity. Access via `props.title`, `mergeProps` (for default values), and `splitProps` (for prop extraction).
3. **Control-Flow Narrowing**: Use `<Show when={val()}>{(v) => ...}</Show>` to narrow types inside JSX. `v` is typed as `Accessor<NonNullable<T>>`.
4. **Solid 2.0 First-Class Async**: `createAsync` directly returns `Accessor<T>` (not `T | undefined`). Pending computations propagate to `<Loading>` and `<Suspense>` boundaries automatically.
5. **Two-Phase Effects**: Solid 2.0 `createEffect(compute, effect)` separates pure synchronous tracking from side-effect execution, providing automatic TypeScript parameter inference.
6. **Stores & Path Syntax**: `createStore` manages deep nested proxies. Mutate using path syntax (`setState("items", 0, "done", true)`), `produce` (for mutable drafts), or `reconcile` (for diffing external JSON).
7. **Derived Projections**: `createProjection` creates derived stores via mutable draft callbacks without invalidating array or object references.
8. **Directives & Events**: Augment `declare module "solid-js" { namespace JSX { interface Directives { ... } } }` for `use:*`. Prefer tuple event delegation `onClick={[handler, data]}` over inline arrow functions to eliminate closure allocations.
9. **Polymorphic `<Dynamic>`**: Combine `ValidComponent`, `ComponentProps<T>`, and `splitProps` to build strongly typed primitives with the `as` prop.
