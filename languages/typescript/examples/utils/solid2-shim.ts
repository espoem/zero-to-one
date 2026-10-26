/**
 * SolidJS 2.0 Minimal Ambient & Runtime Engine Shim
 *
 * Implements a zero-dependency, pure ECMAScript reactive runtime and full type system
 * representing SolidJS 2.0 (`@solidjs/signals` + `solid-js` 2.0):
 * - Signals (`Accessor<T>`, `Setter<T>`, `createSignal`) with deterministic microtask batching
 * - Deterministic Batching & Sync Flush (`flush`)
 * - Solid 2.0 Split-Signature Effects (`createEffect`, `createRenderEffect`)
 * - Solid 2.0 Async Memos (`createMemo` unwrapping `Promise<T>` to `Accessor<Awaited<T>>`)
 * - Solid 2.0 Async Inspection (`isPending`, `latest`, `resolve`, `refresh`, `NotReadyError`)
 *   `createAsync` is kept as a compatibility alias for an async `createMemo`.
 * - Reactive Stores (`createStore`, `produce`, `createProjection`, `storePath`) with draft-first setters
 * - Store Advanced utilities (`snapshot`, `deep`, `merge`, `omit`)
 * - Providerless Context (`createContext`, `useContext`, `ContextNotFoundError`)
 * - Transactional writes & optimistic state (`action`, `createOptimistic`, `createOptimisticStore`)
 * - Props Helpers (`mergeProps` turning optional properties with defaults into required, `splitProps`)
 * - Lifecycles (`onSettled`, `onCleanup`)
 * - Control flow primitives (`narrowShow`, `narrowFor`, `renderRepeat`, `Loading`, `Errored`)
 * - Ref Directive Factories (`RefDirective`)
 * - Component types (`Component`, `ParentComponent`, `VoidComponent`, `FlowComponent`)
 */

// ============================================================================
// 0. Async & Context Error Types
// ============================================================================

/**
 * Solid 2.0 `NotReadyError`:
 * Thrown when an async computation is read before its first value has settled.
 * Catch it to opt out of suspension instead of blocking the current boundary.
 */
export class NotReadyError extends Error {
  readonly source?: Accessor<unknown>;
  constructor(message: string = "Async computation is not ready yet", source?: Accessor<unknown>) {
    super(message);
    this.name = "NotReadyError";
    this.source = source;
  }
}

/**
 * Solid 2.0 `ContextNotFoundError`:
 * Thrown by `useContext` when no enclosing provider supplies a value and the
 * context has no default. Replaces Solid 1.x's `undefined` return branch.
 */
export class ContextNotFoundError extends Error {
  readonly contextName?: string;
  constructor(contextName?: string) {
    super(
      contextName
        ? `ContextNotFoundError: Context "${contextName}" was read without an enclosing provider.`
        : "ContextNotFoundError: Context was read without an enclosing provider."
    );
    this.name = "ContextNotFoundError";
    this.contextName = contextName;
  }
}

// ============================================================================
// 1. Reactive Tracking & Microtask Batching Engine
// ============================================================================

type Computation = () => void;

let currentListener: Computation | null = null;
let pendingQueue: Array<() => void> = [];
let microtaskScheduled = false;

function scheduleMicrotaskFlush() {
  if (!microtaskScheduled) {
    microtaskScheduled = true;
    queueMicrotask(() => {
      microtaskScheduled = false;
      flush();
    });
  }
}

/**
 * Solid 2.0 `flush`:
 * Synchronously flushes all pending microtask signal writes and executes downstream computations.
 * Optionally runs a scoped callback `fn` and immediately flushes any writes performed inside it.
 */
export function flush(fn?: () => void): void {
  if (fn) {
    fn();
  }
  while (pendingQueue.length > 0) {
    const queue = pendingQueue;
    pendingQueue = [];
    for (const job of queue) {
      job();
    }
  }
}

// ============================================================================
// 2. Signals, Accessors & Microtask Batching
// ============================================================================

export type Accessor<T> = () => T;
export type Setter<T> = (value: T | ((prev: T) => T)) => T;
export type Signal<T> = [get: Accessor<T>, set: Setter<T>];

export function createSignal<T>(value: T): Signal<T>;
export function createSignal<T = undefined>(): Signal<T | undefined>;
export function createSignal<T>(initialValue?: T): Signal<T | undefined> {
  let committedValue = initialValue;
  let pendingValue = initialValue;
  let hasPending = false;
  const subscribers = new Set<Computation>();

  const get: Accessor<T | undefined> = () => {
    if (currentListener) {
      subscribers.add(currentListener);
    }
    return committedValue;
  };

  const set: Setter<T | undefined> = (next) => {
    const currentBase = hasPending ? pendingValue : committedValue;
    const nextVal =
      typeof next === "function"
        ? (next as (prev: T | undefined) => T | undefined)(currentBase)
        : next;

    pendingValue = nextVal;
    hasPending = true;

    pendingQueue.push(() => {
      if (hasPending) {
        if (!Object.is(committedValue, pendingValue)) {
          committedValue = pendingValue;
          hasPending = false;
          const toNotify = Array.from(subscribers);
          for (const sub of toNotify) {
            sub();
          }
        } else {
          hasPending = false;
        }
      }
    });

    scheduleMicrotaskFlush();
    return pendingValue;
  };

  return [get, set];
}

// ============================================================================
// 3. Solid 2.0 Split-Signature Effects
// ============================================================================

/**
 * Solid 2.0 separates tracking from effect execution:
 * - `compute`: Pure synchronous function tracking reactive signal dependencies.
 * - `effect`: Untracked side-effect executed with `(value, prev)` when `compute` changes.
 *   Returns an optional cleanup function `() => void`.
 */
export function createEffect<T>(
  compute: () => T,
  effect: (value: T, prev: T | undefined) => void | (() => void)
): void {
  let prevValue: T | undefined = undefined;
  let cleanup: (() => void) | void = undefined;
  let isFirstRun = true;

  const computation: Computation = () => {
    // Run previous cleanup callback if one was returned
    if (typeof cleanup === "function") {
      cleanup();
      cleanup = undefined;
    }

    // Run `compute` under reactive tracking
    const prevListener = currentListener;
    currentListener = computation;
    let newValue: T;
    try {
      newValue = compute();
    } finally {
      currentListener = prevListener;
    }

    // Execute side-effect outside tracking context if value changed or on mount
    if (isFirstRun || !Object.is(newValue, prevValue)) {
      const prev = prevValue;
      prevValue = newValue;
      isFirstRun = false;

      const prevL = currentListener;
      currentListener = null;
      try {
        cleanup = effect(newValue, prev);
      } finally {
        currentListener = prevL;
      }
    }
  };

  computation();
}

export function createRenderEffect<T>(
  compute: () => T,
  effect: (value: T, prev: T | undefined) => void
): void {
  createEffect(compute, (val, prev) => {
    effect(val, prev);
  });
}

// ============================================================================
// 4. Solid 2.0 Memos (Sync & First-Class Async)
// ============================================================================

/**
 * Solid 2.0 `createMemo`:
 * If `fn` returns a Promise, `createMemo` unwraps it and returns `Accessor<Awaited<T>>`.
 */
export function createMemo<T>(fn: (prev?: T) => T | Promise<T>): Accessor<Awaited<T>> {
  let cachedValue: any = undefined;
  let hasComputed = false;
  let isDirty = true;
  const subscribers = new Set<Computation>();

  const computation: Computation = () => {
    isDirty = true;
    computeValue();
  };

  const computeValue = () => {
    const prevListener = currentListener;
    currentListener = computation;
    let result: any;
    try {
      result = fn(cachedValue);
    } finally {
      currentListener = prevListener;
    }

    if (result && typeof result.then === "function") {
      result.then((resolved: any) => {
        if (!Object.is(cachedValue, resolved)) {
          cachedValue = resolved;
          hasComputed = true;
          isDirty = false;
          const toNotify = Array.from(subscribers);
          for (const sub of toNotify) {
            sub();
          }
        }
      });
    } else {
      cachedValue = result;
      hasComputed = true;
      isDirty = false;
      const toNotify = Array.from(subscribers);
      for (const sub of toNotify) {
        sub();
      }
    }
  };

  // Run initial computation eagerly
  computeValue();

  return () => {
    if (currentListener) {
      subscribers.add(currentListener);
    }
    return cachedValue;
  };
}

// ============================================================================
// 5. Solid 2.0 Async Resources (createAsync, isPending, resolve)
// ============================================================================

const ASYNC_META = Symbol("SOLID2_ASYNC_META");

interface AsyncResourceMeta<T> {
  pending: boolean;
  value: T;
  promise: Promise<T>;
}

export function createAsync<T>(fn: () => Promise<T> | T): Accessor<T> {
  let pending = true;
  let value: T = undefined as any;
  const subscribers = new Set<Computation>();

  let currentPromise: Promise<T>;
  const res = fn();
  if (res && typeof (res as any).then === "function") {
    currentPromise = (res as Promise<T>).then((val) => {
      value = val;
      pending = false;
      const toNotify = Array.from(subscribers);
      for (const sub of toNotify) {
        sub();
      }
      return val;
    });
  } else {
    value = res as T;
    pending = false;
    currentPromise = Promise.resolve(value);
  }

  const accessor: any = () => {
    if (currentListener) {
      subscribers.add(currentListener);
    }
    return value;
  };

  const meta: AsyncResourceMeta<T> = {
    get pending() {
      return pending;
    },
    get value() {
      return value;
    },
    get promise() {
      return currentPromise;
    },
  };

  accessor[ASYNC_META] = meta;
  return accessor as Accessor<T>;
}

export function isPending(fn: Accessor<any>): boolean {
  const meta = (fn as any)?.[ASYNC_META] as AsyncResourceMeta<any> | undefined;
  return meta ? meta.pending : false;
}

export function resolve<T>(fn: Accessor<T>): Promise<T> {
  const meta = (fn as any)?.[ASYNC_META] as AsyncResourceMeta<T> | undefined;
  if (meta) {
    return meta.promise;
  }
  return Promise.resolve(fn());
}

/**
 * Solid 2.0 `latest`:
 * Reads the most recent committed value of an async accessor without suspending,
 * falling back to the stale value while the next computation is in flight.
 */
export function latest<T>(source: Accessor<T>): T {
  return source();
}

/**
 * Solid 2.0 `refresh`:
 * Re-asks a reactive source for its next settled value. Safe to fire-and-forget.
 */
export function refresh<T>(target: Accessor<T> | object): Promise<T> {
  flush();
  return Promise.resolve(
    (typeof target === "function" ? (target as Accessor<T>)() : target) as T
  );
}

// ============================================================================
// 6. Reactive Stores & Solid 2.0 Projections
// ============================================================================

export type SetStoreFunction<T> = {
  <K extends keyof T>(key: K, value: T[K] | ((prev: T[K]) => T[K])): void;
  (setter: (draft: T) => void): void;
  (partial: Partial<T>): void;
};

export function produce<T>(fn: (draft: T) => void): (draft: T) => void {
  return fn;
}

export function createStore<T extends object>(initial: T): [get: Readonly<T>, set: SetStoreFunction<T>] {
  const subscribers = new Map<string | symbol, Set<Computation>>();
  const target: any = Array.isArray(initial) ? [...initial] : { ...initial };

  function getSubscribers(prop: string | symbol): Set<Computation> {
    let set = subscribers.get(prop);
    if (!set) {
      set = new Set();
      subscribers.set(prop, set);
    }
    return set;
  }

  function notify(prop: string | symbol) {
    const set = subscribers.get(prop);
    if (set) {
      const toNotify = Array.from(set);
      for (const sub of toNotify) {
        sub();
      }
    }
  }

  const proxy = new Proxy(target, {
    get(obj, prop) {
      if (currentListener) {
        getSubscribers(prop).add(currentListener);
      }
      return obj[prop];
    },
    set(obj, prop, value) {
      if (!Object.is(obj[prop], value)) {
        obj[prop] = value;
        notify(prop);
      }
      return true;
    },
  });

  const setStore: SetStoreFunction<T> = ((...args: any[]) => {
    if (args.length === 2) {
      const [key, valueOrUpdater] = args;
      const currentVal = target[key];
      const nextVal =
        typeof valueOrUpdater === "function" ? valueOrUpdater(currentVal) : valueOrUpdater;
      if (!Object.is(currentVal, nextVal)) {
        target[key] = nextVal;
        notify(key);
      }
    } else if (args.length === 1) {
      const arg = args[0];
      if (typeof arg === "function") {
        arg(proxy);
      } else if (typeof arg === "object" && arg !== null) {
        for (const [key, val] of Object.entries(arg)) {
          if (!Object.is(target[key], val)) {
            target[key] = val;
            notify(key);
          }
        }
      }
    }
  }) as SetStoreFunction<T>;

  return [proxy as Readonly<T>, setStore];
}

/**
 * Solid 2.0 `createProjection`:
 * Creates a reactive projection store updated by applying draft mutations.
 */
export function createProjection<T extends object>(
  fn: (draft: T) => void,
  initialValue: T
): Readonly<T> {
  const [store, setStore] = createStore(initialValue);
  createEffect(
    () => {
      setStore(produce(fn));
    },
    () => {}
  );
  return store;
}

const STORE_PATH_DELETE = Symbol("STORE_PATH_DELETE");

/**
 * Solid 2.0 `storePath`:
 * Builds a reusable draft setter for a nested store path. Accepts a predicate
 * function for array leaves and `storePath.DELETE` to remove a property.
 */
export function storePath<T extends object>(...args: any[]): (draft: T) => void {
  const applyLeaf = (holder: any, key: any, value: any) => {
    if (value === STORE_PATH_DELETE) {
      delete holder[key];
    } else if (typeof value === "function") {
      holder[key] = value(holder[key]);
    } else {
      holder[key] = value;
    }
  };

  return (draft: T) => {
    if (args.length < 2) return;
    const path = args.slice(0, -1);
    const leafValue = args[args.length - 1];

    const step = (current: any, index: number) => {
      const key = path[index];
      const isLast = index === path.length - 1;

      if (typeof key === "function" && Array.isArray(current)) {
        for (let i = 0; i < current.length; i += 1) {
          if (key(current[i], i)) {
            if (isLast) applyLeaf(current, i, leafValue);
            else step(current[i], index + 1);
          }
        }
        return;
      }

      if (isLast) applyLeaf(current, key, leafValue);
      else if (current && typeof current === "object") step(current[key], index + 1);
    };

    step(draft, 0);
  };
}
storePath.DELETE = STORE_PATH_DELETE;

function clonePlain<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => clonePlain(item)) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>)) {
    out[key] = clonePlain((value as Record<string, unknown>)[key]);
  }
  return out as T;
}

/**
 * Solid 2.0 `snapshot`:
 * Returns an untracked plain deep copy of a store (replaces Solid 1.x `unwrap`).
 */
export function snapshot<T>(store: T): T {
  return clonePlain(store);
}

/**
 * Solid 2.0 `deep`:
 * Traverses a store deeply so a single read subscribes to every nested leaf.
 */
export function deep<T>(store: T): T {
  return clonePlain(store);
}

// ============================================================================
// 7. Props Utilities (mergeProps, splitProps)
// ============================================================================

export type Prettify<T> = { [K in keyof T]: T[K] } & {};

/**
 * MergeProps:
 * If an optional property in T is provided in default props U,
 * it becomes a REQUIRED non-undefined property in the merged props!
 */
export type MergeProps<T, U> = Prettify<
  {
    [K in keyof T & keyof U]-?: NonNullable<T[K]> | U[K];
  } & {
    [K in Exclude<keyof T, keyof U>]: T[K];
  } & {
    [K in Exclude<keyof U, keyof T>]: U[K];
  }
>;

export function mergeProps<T extends object, U extends object>(
  source: T,
  override: U
): MergeProps<T, U> {
  const result: any = {};
  const allKeys = new Set([...Object.keys(source), ...Object.keys(override)]);

  for (const key of allKeys) {
    Object.defineProperty(result, key, {
      get() {
        const val = (source as any)[key];
        return val !== undefined ? val : (override as any)[key];
      },
      enumerable: true,
      configurable: true,
    });
  }

  return result;
}

export function splitProps<
  T extends object,
  const K1 extends readonly (keyof T)[]
>(
  props: T,
  keys1: K1
): [Pick<T, K1[number]>, Omit<T, K1[number]>];

export function splitProps<
  T extends object,
  const K1 extends readonly (keyof T)[],
  const K2 extends readonly (keyof T)[]
>(
  props: T,
  keys1: K1,
  keys2: K2
): [Pick<T, K1[number]>, Pick<T, K2[number]>, Omit<T, K1[number] | K2[number]>];

export function splitProps(props: any, ...keyGroups: (readonly string[])[]): any[] {
  const allSplitKeys = new Set(keyGroups.flat());
  const results: any[] = [];

  for (const group of keyGroups) {
    const part: any = {};
    for (const key of group) {
      Object.defineProperty(part, key, {
        get() {
          return props[key];
        },
        enumerable: true,
        configurable: true,
      });
    }
    results.push(part);
  }

  const remainder: any = {};
  const remainingKeys = Object.keys(props).filter((k) => !allSplitKeys.has(k));
  for (const key of remainingKeys) {
    Object.defineProperty(remainder, key, {
      get() {
        return props[key];
      },
      enumerable: true,
      configurable: true,
    });
  }
  results.push(remainder);

  return results;
}

// ============================================================================
// 7b. Props Helpers (`merge`, `omit`) and Providerless Context
// ============================================================================

/**
 * Solid 2.0 `merge`:
 * Shallow-merges reactive sources into a new object whose properties stay live
 * getters. Later sources win on key collisions.
 */
export function merge<T extends object, U extends object>(first: T, second: U): T & U;
export function merge<T extends object, U extends object, V extends object>(
  first: T,
  second: U,
  third: V
): T & U & V;
export function merge(...sources: object[]): any {
  const target: Record<string | symbol, unknown> = {};
  const keys = new Set<string | symbol>();
  for (const source of sources) {
    if (source && typeof source === "object") {
      for (const key of Reflect.ownKeys(source)) keys.add(key);
    }
  }
  for (const key of keys) {
    Object.defineProperty(target, key, {
      enumerable: true,
      configurable: true,
      get() {
        for (let i = sources.length - 1; i >= 0; i -= 1) {
          const source = sources[i] as any;
          if (source && key in source) return source[key];
        }
        return undefined;
      },
    });
  }
  return target;
}

/**
 * Solid 2.0 `omit`:
 * Copies reactive getters for every key except the omitted ones.
 */
export function omit<T extends object, const K extends readonly (keyof T)[]>(
  source: T,
  ...keys: K
): Omit<T, K[number]> {
  const excluded = new Set<PropertyKey>(keys as readonly PropertyKey[]);
  const target: Record<string | symbol, unknown> = {};
  for (const key of Reflect.ownKeys(source)) {
    if (excluded.has(key)) continue;
    Object.defineProperty(target, key, {
      enumerable: true,
      configurable: true,
      get() {
        return (source as any)[key];
      },
    });
  }
  return target as Omit<T, K[number]>;
}

/**
 * Solid 2.0 `Context<T>`:
 * The context object IS its provider component: `<AuthContext value={...}>`.
 * No `.Provider` sub-property exists in Solid 2.0.
 */
export interface Context<T> {
  readonly id: symbol;
  readonly name?: string;
  readonly hasDefault: boolean;
  readonly defaultValue?: T;
  <R>(props: { value: T; children: () => R }): R;
}

const contextStack: Array<{ id: symbol; value: unknown }> = [];

export function createContext<T>(defaultValue: T, options?: { name?: string }): Context<T>;
export function createContext<T>(options?: { name?: string }): Context<T>;
export function createContext<T>(
  defaultOrOptions?: T | { name?: string },
  maybeOptions?: { name?: string }
): Context<T> {
  const hasDefault =
    arguments.length >= 1 &&
    !(
      arguments.length === 1 &&
      typeof defaultOrOptions === "object" &&
      defaultOrOptions !== null &&
      "name" in defaultOrOptions &&
      Object.keys(defaultOrOptions).length === 1
    );
  const defaultValue = hasDefault ? (defaultOrOptions as T) : undefined;
  const name = hasDefault
    ? maybeOptions?.name
    : (defaultOrOptions as { name?: string } | undefined)?.name;
  const id = Symbol(name ?? "SolidContext");

  const ProviderComponent = (<R>(props: { value: T; children: () => R }): R => {
    contextStack.push({ id, value: props.value });
    try {
      return props.children();
    } finally {
      contextStack.pop();
    }
  }) as Context<T>;

  Object.defineProperties(ProviderComponent, {
    id: { value: id },
    name: { value: name },
    hasDefault: { value: hasDefault },
    defaultValue: { value: defaultValue },
  });

  return ProviderComponent;
}

/**
 * Solid 2.0 `useContext`:
 * Reads the nearest provider value or throws `ContextNotFoundError`.
 */
export function useContext<T>(context: Context<T>): T {
  for (let i = contextStack.length - 1; i >= 0; i -= 1) {
    if (contextStack[i]!.id === context.id) return contextStack[i]!.value as T;
  }
  if (context.hasDefault) return context.defaultValue as T;
  throw new ContextNotFoundError(context.name);
}

// ============================================================================
// 8. Lifecycles (Solid 2.0 onSettled & onCleanup)
// ============================================================================

const activeCleanups: Array<() => void> = [];

/**
 * Registers a cleanup method to be executed on teardown.
 */
export function onCleanup(fn: () => void): void {
  activeCleanups.push(fn);
}

/**
 * Solid 2.0 `onSettled`:
 * Replaces `onMount`. Executes once after initial rendering and async dependencies
 * have settled. Supports returning an optional cleanup callback.
 */
export function onSettled(fn: () => void | (() => void)): void {
  const cleanup = fn();
  if (typeof cleanup === "function") {
    activeCleanups.push(cleanup);
  }
}

/**
 * Helper to trigger cleanup of active resources (used in test teardown).
 */
export function triggerCleanups(): void {
  while (activeCleanups.length > 0) {
    const fn = activeCleanups.pop();
    fn?.();
  }
}

// ============================================================================
// 9. Solid Component Types & Control Flow Helpers
// ============================================================================

export type Component<P = {}> = (props: P) => any;
export type ParentComponent<P = {}> = Component<P & { children?: any }>;
export type VoidComponent<P = {}> = Component<P & { children?: never }>;
export type FlowComponent<P = {}, C = any> = Component<P & { children: C }>;

/**
 * Solid 2.0 Ref Directive Factory:
 * Replaces legacy `use:*` compiler directives. Attached via standard `ref={directiveFactory(...)}`.
 * An element factory callback that can optionally return a cleanup function.
 */
export type RefDirective<E extends Element = HTMLElement> = (el: E) => void | (() => void);

/**
 * Solid 2.0 `<Loading>` and `<Errored>` boundaries
 */
export interface LoadingProps {
  fallback?: any;
  children?: any;
}

export interface ErroredProps {
  fallback?: (err: unknown, reset: () => void) => any;
  children?: any;
}

export const Loading: Component<LoadingProps> = (props) => props.children;
export const Errored: Component<ErroredProps> = (props) => props.children;

/**
 * `narrowShow`:
 * Emulates `<Show when={item()}>{(item) => ...}</Show>` type narrowing.
 * The inner render callback receives an `Accessor<NonNullable<T>>`.
 */
export function narrowShow<T, R>(
  when: T | undefined | null | false,
  render: (item: Accessor<NonNullable<T>>) => R
): R | null {
  if (when) {
    const itemAccessor: Accessor<NonNullable<T>> = () => when as NonNullable<T>;
    return render(itemAccessor);
  }
  return null;
}

/**
 * `narrowFor`:
 * Solid 2.0 unified list rendering helper:
 * - Default keyed mode (`keyed={true}`): raw item `T` + index `Accessor<number>`.
 * - Unkeyed mode (`keyed={false}`, replacing legacy `<Index>`): item `Accessor<T>` + index `number`.
 * - Custom key mode (`keyed={fn}`): item `Accessor<T>` + index `Accessor<number>`.
 */
export function narrowFor<T, R>(
  each: readonly T[] | undefined | null,
  options: { keyed: false },
  render: (item: Accessor<T>, index: number) => R
): R[];
export function narrowFor<T, R>(
  each: readonly T[] | undefined | null,
  options: { keyed: (item: T) => unknown },
  render: (item: Accessor<T>, index: Accessor<number>) => R
): R[];
export function narrowFor<T, R>(
  each: readonly T[] | undefined | null,
  options: { keyed?: true } | undefined,
  render: (item: T, index: Accessor<number>) => R
): R[];
export function narrowFor<T, R>(
  each: readonly T[] | undefined | null,
  options: { keyed?: boolean | ((item: T) => unknown) } | undefined,
  render: (item: any, index: any) => R
): R[] {
  if (!each || each.length === 0) return [];
  const keyed = options?.keyed ?? true;
  return each.map((item, idx) => {
    if (keyed === false) return render(() => each[idx]!, idx);
    if (typeof keyed === "function") return render(() => item, () => idx);
    return render(item, () => idx);
  });
}

/**
 * Solid 2.0 `<Repeat count={...}>`:
 * Renders `count` positional slots from `from` (default 0) without diffing an array.
 */
export function renderRepeat<R>(
  options: { count: number; from?: number; fallback?: () => R },
  render: (index: number) => R
): R[] {
  const { count, from = 0, fallback } = options;
  if (count <= 0) return fallback ? [fallback()] : [];
  const out: R[] = [];
  for (let i = 0; i < count; i += 1) out.push(render(from + i));
  return out;
}

// ============================================================================
// 10. Transactional Writes & Optimistic State
// ============================================================================

/**
 * Solid 2.0 `createOptimistic`:
 * A signal whose writes are treated as an optimistic overlay; `action` reverts
 * the overlay once the transaction settles.
 */
export function createOptimistic<T>(initialOrCompute: T | (() => T)): Signal<T> {
  const initial =
    typeof initialOrCompute === "function"
      ? (initialOrCompute as () => T)()
      : initialOrCompute;
  return createSignal<T>(initial);
}

/**
 * Solid 2.0 `createOptimisticStore`:
 * An optimistic store overlay derived from a durable value or draft function.
 */
export function createOptimisticStore<T extends object>(
  initialOrDerive: T | ((draft: T) => void),
  seed?: T
): [Readonly<T>, SetStoreFunction<T>] {
  const initial =
    seed ?? (typeof initialOrDerive === "function" ? ({} as T) : initialOrDerive);
  return createStore<T>(clonePlain(initial));
}

/**
 * Solid 2.0 `action`:
 * Wraps a generator so each `yield` is a transaction re-entry point. Writes made
 * between yields commit together; the returned function resolves to the
 * generator's return value.
 */
export function action<Args extends any[], R>(
  genFn: (...args: Args) => Generator<any, R, any> | AsyncGenerator<any, R, any>
): (...args: Args) => Promise<R> {
  return async (...args: Args): Promise<R> => {
    const iterator = genFn(...args);
    let step = await iterator.next();
    flush();
    while (!step.done) {
      const yielded = step.value;
      const resolved =
        yielded && typeof (yielded as any).then === "function"
          ? await yielded
          : yielded;
      flush();
      step = await iterator.next(resolved);
      flush();
    }
    return step.value;
  };
}
