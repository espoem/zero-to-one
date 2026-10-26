# SolidJS 2.0 Fast-Lookup Cheat Sheet

A comprehensive desk reference for `solid-js@2.0.0-rc.8`, `@solidjs/signals`, and `@solidjs/web@2.0.0-rc.8`.

---

## 1. Core API Signatures

### Reactive Primitives (`solid-js`)

```ts
// 1. Signal creation (atomic value)
function createSignal<T>(initialValue: T, options?: { name?: string; equals?: false | ((prev: T, next: T) => boolean) }): [get: Accessor<T>, set: Setter<T>];

// 2. Writable derived signal (tracks computeFn, permits manual local setter overrides)
function createSignal<T>(computeFn: (prev?: T) => T, options?: SignalOptions<T>): [get: Accessor<T>, set: Setter<T>];

// 3. Derived memo (synchronous or async via Promise / AsyncIterable)
function createMemo<T>(fn: (prev?: T) => Promise<T> | AsyncIterable<T> | T, options?: { name?: string; equals?: false | ((prev: T, next: T) => boolean); loadingValue?: T; lazy?: boolean; unobserved?: () => void }): Accessor<T>;

// 4. Split side-effect (compute: tracked dependency phase; apply: untracked execution)
function createEffect<T>(compute: (prev?: T) => T, apply: (value: T, prev: T | undefined) => void | (() => void), options?: { name?: string; defer?: boolean }): void;
function createEffect<T>(compute: (prev?: T) => T, handlers: { effect: (value: T, prev: T | undefined) => void | (() => void); error: (err: unknown, cleanup: () => void) => void }, options?: EffectOptions): void;

// 5. Pre-paint layout effect (runs in render lane before paint and ahead of user effects)
function createRenderEffect<T>(compute: (prev?: T) => T, apply: (value: T, prev: T | undefined) => void | (() => void), options?: EffectOptions): void;

// 6. Microtask batch drain (synchronously flushes pending writes and effect lanes)
function flush<T = void>(fn?: () => T): T;

// 7. Non-tracking execution wrapper
function untrack<T>(fn: () => T): T;

// 8. Lifecycle hooks
function onCleanup(fn: () => void): void;
function onSettled(fn: () => void | (() => void)): void;

// 9. Root & ownership management
function createRoot<T>(fn: (dispose: () => void) => T): T;
function runWithOwner<T>(owner: Owner | null, fn: () => T): T;
function getOwner(): Owner | null;
function getObserver(): Computation | null;
```

### Stores & Projections (`solid-js`)

```ts
// 1. Draft-first store creation (object or array state)
function createStore<T extends object>(initial: T, options?: { name?: string; shallow?: boolean }): [Store<T>, StoreSetter<T>];

// 2. Derived store (computes or reconciles updates into a draft)
function createStore<T extends object>(derive: (draft: T) => void | T | Promise<void | T> | AsyncIterable<void | T>, seed: T, options?: ProjectionOptions): [Store<T>, StoreSetter<T>];

// 3. Store projection (read-only derived store updated via draft function)
function createProjection<T extends object>(derive: (draft: T) => void | T | Promise<void | T> | AsyncIterable<void | T>, seed?: T, options?: ProjectionOptions): Store<T>;

// 4. Declarative path-based mutation helper
function storePath<T extends object>(...args: any[]): (draft: T) => void;
storePath.DELETE; // sentinel symbol to delete properties or array elements

// 5. Structural reconciliation
function reconcile<T extends object>(incoming: T, key?: string | ((item: any) => any) | null): (draft: T) => void;

// 6. Store inspection and tracking
function snapshot<T>(store: T): T; // untracked, plain deep clone
function deep<T>(store: T): T;     // recursively subscribes to all nested properties
```

### Context & Props Helpers (`solid-js`)

```ts
// 1. Providerless Context creation
function createContext<T>(defaultValue: T, options?: { name?: string }): Context<T>;
function createContext<T>(options?: { name?: string }): Context<T>; // throws ContextNotFoundError if missing

// 2. Context consumption
function useContext<T>(context: Context<T>): T;

// 3. Props helpers
function merge<T extends object, U extends object>(first: T, second: U): T & U;
function merge<T extends object, U extends object, V extends object>(first: T, second: U, third: V): T & U & V; // undefined overrides earlier keys!
function omit<T extends object, const K extends readonly (keyof T)[]>(source: T, ...keys: K): Omit<T, K[number]>;
```

### Async Primitives & Inspections (`solid-js`)

```ts
function isPending(target: Accessor<unknown> | object): boolean; // non-suspending pending check
function latest<T>(source: Accessor<T>): T;                      // reads most recent resolved/in-flight value
function resolve<T>(source: Accessor<T>): Promise<T>;            // awaits async memo settlement
function refresh<T>(target: Accessor<T> | object): Promise<T>;   // re-evaluates async memo or projection store
```

### Transactional Actions & Optimistic State (`solid-js`)

```ts
// 1. Generator action wrapper
function action<Args extends any[], R>(genFn: (...args: Args) => Generator<any, R, any> | AsyncGenerator<any, R, any>): (...args: Args) => Promise<R>;

// 2. Optimistic store (maintains active draft mutations over confirmed state)
function createOptimisticStore<T extends object>(deriveOrInitial: T | ((draft: T) => void | T | Promise<void | T>), seed?: T, options?: ProjectionOptions): [Store<T>, StoreSetter<T>];

// 3. Optimistic signal
function createOptimistic<T>(initialOrCompute: T | (() => T)): Signal<T>;

// 4. Action helpers
function affects(target: Accessor<unknown> | object, key?: PropertyKey): void;
function until<T>(predicate: () => T, options?: { timeout?: number; signal?: AbortSignal }): Promise<NonNullable<T>>;
```

### Server Functions & Web Responses (`@solidjs/web/server-functions` & `@solidjs/web`)

```ts
// 1. Server function configuration & decorators (`@solidjs/web/server-functions`)
function GET<Args extends any[], R>(fn: ServerFunctionReference<Args, R>): ServerFunctionReference<Args, R>;
function withMeta<Args extends any[], R>(fn: ServerFunctionReference<Args, R>, meta: Record<string, unknown>): ServerFunctionReference<Args, R>;
function invoke<Args extends any[], R>(fn: ServerFunctionReference<Args, R>, options: InvokeOptions, ...args: Args): Promise<R>;
function handleServerFunctionRequest(request: Request): Promise<Response>;

// 2. Response helpers, request event & safety (`@solidjs/web`)
function respond<T>(value: T, init?: { status?: number; headers?: Record<string, string>; revalidate?: string | string[] }): ResponseEnvelope<T>;
function redirect(url: string, init?: { status?: number; headers?: Record<string, string>; revalidate?: string | string[] }): Response;
function markSafeError<E extends Error>(error: E): E;
function isSafeError(error: unknown): boolean;
function getRequestEvent(): RequestEvent;
```

---

## 2. `<For>` Keying Matrix

The unified `<For>` component in Solid 2.0 covers all collection iteration strategies based on its `keyed` prop.

| `keyed` Mode | Item Argument | Index Argument | DOM Element Lifecycle | Primary Use Case |
| :--- | :--- | :--- | :--- | :--- |
| **`keyed={true}`** (default) | Raw value (`T`) | Reactive Accessor (`Accessor<number>`) | Persistent per object identity; rows move rather than re-creating when array reorders. | Normalized record lists, entities with stable identities, editable inputs. |
| **`keyed={false}`** (replaces `<Index>`) | Reactive Accessor (`Accessor<T>`) | Plain number (`number`) | Fixed DOM nodes per array position; row nodes are reused when values swap at index. | Primitive arrays (`string[]`, `number[]`), immutable feeds, virtualized viewports. |
| **`keyed={(item) => item.id}`** | Reactive Accessor (`Accessor<T>`) | Reactive Accessor (`Accessor<number>`) | Persistent per extracted key; preserves DOM node even if object references are re-allocated. | Server responses returning fresh object instances with stable primary keys. |

---

## 3. Migration Fast Lookup (Solid 1.x $\rightarrow$ Solid 2.0)

| 1.x API / Import | 2.0 Replacement | Migration Rationale & Behavioral Difference |
| :--- | :--- | :--- |
| `import from "solid-js/store"` | `import from "solid-js"` | Store exports consolidated into core `solid-js` package. |
| `import from "solid-js/web"` | `import from "@solidjs/web"` | Web and DOM rendering utilities scoped under `@solidjs/web`. |
| `jsxImportSource: "solid-js"` | `jsxImportSource: "@solidjs/web"` | JSX types and runtime factories moved to `@solidjs/web/jsx-runtime`. |
| `batch(() => { ... })` | Automatic microtask batching + `flush()` | Writes batch automatically on microtask; call `flush()` only for immediate imperative reads. |
| `createEffect(fn)` | `createEffect(compute, apply)` | Single callback split into pure tracked derivation (`compute`) and untracked execution (`apply`). |
| `createComputed(fn)` | `createSignal(() => derivation)` or `createMemo` | Derived writes replaced by writable derived signals; readonly computations use `createMemo`. |
| `on(deps, fn)` | `createEffect(() => deps(), (val) => ...)` | Explicit dependency tracking achieved naturally by reading sources in the compute phase. |
| `onMount(fn)` | `onSettled(fn)` | Executes after microtask batch and async work settle; natively supports returned cleanup functions. |
| `createResource(src, fetcher)` | Async `createMemo` / `createProjection` | Colorless async: promises flow directly through ordinary reactive graph computations. |
| `<Suspense>` | `<Loading>` | Scoped to initial readiness; holds established content during subsequent background refreshes. |
| `<SuspenseList>` | `<Reveal>` | Coordinated display of sibling boundaries using `order="together" \| "sequential" \| "natural"`. |
| `<ErrorBoundary>` | `<Errored>` | Fallback receives an error accessor (`err()`); boundary self-heals when upstream dependencies recover. |
| `<Index>` | `<For keyed={false}>` | Non-keyed positional rendering unified into `<For>`. |
| `use:directive` | Ref Directive Factories (`ref={factory()}`) | Custom JSX directive transform replaced by composable ref callback closures. |
| `classList={{ ... }}` | `class={[ ..., { ... } ]}` | Unified `class` binding natively accepting strings, arrays, and boolean record objects. |
| `<Context.Provider value={...}>` | `<Context value={...}>` | Providerless syntax; context object is its own component. Missing provider throws `ContextNotFoundError`. |
| `mergeProps(a, b)` | `merge(a, b)` | Combines props; explicit `undefined` in later objects intentionally overrides earlier defaults. |
| `splitProps(props, keys)` | `omit(props, ...keys)` | Returns rest props excluding keys; use explicit property access for local props. |
| `unwrap(store)` | `snapshot(store)` | Untracked deep clone of plain JavaScript data from store proxy. |
| `produce(draft => ...)` | `setStore(draft => ...)` | Draft-first setters are the default in `createStore`; manual `produce` wrapper removed. |
| `createMutable(obj)` | `createStore(obj)` | Mutable proxies removed in favor of explicit draft-first store setters and transactions. |
| `createSelector(id)` | `createProjection(draft => ...)` | $O(1)$ selection updates over sparse keyed records, eliminating unselected row notifications. |

---

## 4. Diagnostics & Compiler Warning Repair Table

| Diagnostic Code | Underlying Cause | Verified Code Repair |
| :--- | :--- | :--- |
| **`STRICT_READ_UNTRACKED`** | Reading a signal, store, or async memo inside an untracked context (e.g. effect apply phase, event callback, or unowned utility) where changes will not trigger updates. | Move reactive reads into the `compute` callback of `createEffect`, or wrap in a `createMemo` derivation. |
| **`REACTIVE_WRITE_IN_OWNED_SCOPE`** | Invoking a signal setter or store mutation directly inside a component setup body, memo function, or effect compute callback. | Move state mutations into event handlers, action bodies, `onSettled` callbacks, or the `apply` phase of `createEffect`. |
| **`ACTION_CALLED_IN_OWNED_SCOPE`** | Calling a transactional `action(...)` directly during component render or initialization. | Dispatch actions in response to user events (e.g., `onClick`, `onSubmit`) or within `onSettled` routines. |
| **`MISSING_EFFECT_FN`** | Passing only one callback argument to `createEffect` (legacy Solid 1.x pattern). | Split into two arguments: `createEffect(() => count(), (val) => { console.log(val); })`. |
| **`OPTIMISTIC_REVERTED`** | An optimistic transaction failed (network error, thrown exception, or server rejection), causing `createOptimisticStore` to revert active draft overlays. | Wrap the action dispatch in a `try/catch` or attach `.catch()` to display user-facing feedback while allowing automatic graph rollback. |
| **`ASYNC_STORE_SETTER`** | Passing an `async` function to `setStore(async (draft) => { ... })`. Store draft updates must be synchronous. | Perform asynchronous fetches first, then pass the resolved payload synchronously into `setStore` or manage via generator `action`. |
| **`CONTEXT_NOT_FOUND`** | Calling `useContext(Context)` on a context without a default value when no parent `<Context value={...}>` exists in the component tree. | Ensure the consuming component is enclosed within `<Context value={...}>`, or provide a default fallback value to `createContext(defaultValue)`. |
| **`PROPS_DESTRUCTURED`** | Destructuring component props (`const { id, title } = props;`), causing loss of reactive getter tracking. | Access properties directly on the props object (`props.title`), or use `omit(props, ...)` to preserve getter proxies. |

---

## 5. Anti-Patterns & Quick Fixes

### 1. Destructuring Props
- ❌ **Anti-Pattern**:
  ```ts
  function UserCard({ name, avatar }: { name: string; avatar: string }) {
    return <div><img src={avatar} /><h1>{name}</h1></div>;
  }
  ```
- ✅ **Quick Fix**:
  ```ts
  function UserCard(props: { name: string; avatar: string }) {
    return <div><img src={props.avatar} /><h1>{props.name}</h1></div>;
  }
  ```

### 2. Synchronous Read Immediately After Mutation Without Flush
- ❌ **Anti-Pattern**:
  ```ts
  setFilter("completed");
  if (filter() === "completed") { focusInput(); } // FAILS: filter() still uncommitted!
  ```
- ✅ **Quick Fix**:
  ```ts
  setFilter("completed");
  flush(); // Drains microtask queue synchronously
  if (filter() === "completed") { focusInput(); }
  ```

### 3. Mutating Stores Asynchronously
- ❌ **Anti-Pattern**:
  ```ts
  setTodos(async (draft) => {
    const data = await fetchTodos();
    draft.items = data; // FAILS: proxy detached across await boundary
  });
  ```
- ✅ **Quick Fix**:
  ```ts
  const updateTodos = action(function* () {
    const data = yield fetchTodos();
    setTodos((draft) => { draft.items = data; });
  });
  ```

### 4. Reading Signals in Effect Apply Phase
- ❌ **Anti-Pattern**:
  ```ts
  createEffect(
    () => count(),
    () => { console.log(user()); } // STRICT_READ_UNTRACKED: user() is untracked!
  );
  ```
- ✅ **Quick Fix**:
  ```ts
  createEffect(
    () => ({ c: count(), u: user() }),
    ({ c, u }) => { console.log(`Count: ${c}, User: ${u}`); }
  );
  ```
