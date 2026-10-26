/**
 * SolidJS 2.0 Minimal Ambient & Runtime Engine Shim
 *
 * Implements a zero-dependency, pure ECMAScript reactive runtime and full type system
 * representing SolidJS 2.0 (`@solidjs/signals` + `solid-js` 2.0):
 * - Signals (`Accessor<T>`, `Setter<T>`, `createSignal`)
 * - Solid 2.0 Split-Signature Effects (`createEffect`, `createRenderEffect`)
 * - Solid 2.0 Async Memos (`createMemo` unwrapping `Promise<T>` to `Accessor<Awaited<T>>`)
 * - Solid 2.0 Async Resources (`createAsync`, `isPending`, `resolve`)
 * - Reactive Stores (`createStore`, `produce`, `createProjection`)
 * - Props Helpers (`mergeProps` turning optional properties with defaults into required, `splitProps`)
 * - Component types (`Component`, `ParentComponent`, `VoidComponent`, `FlowComponent`, `narrowShow`)
 */

// ============================================================================
// 1. Reactive Tracking Engine
// ============================================================================

type Computation = () => void;

let currentListener: Computation | null = null;

// ============================================================================
// 2. Signals & Accessors
// ============================================================================

export type Accessor<T> = () => T;
export type Setter<T> = (value: T | ((prev: T) => T)) => T;
export type Signal<T> = [get: Accessor<T>, set: Setter<T>];

export function createSignal<T>(value: T): Signal<T>;
export function createSignal<T = undefined>(): Signal<T | undefined>;
export function createSignal<T>(initialValue?: T): Signal<T | undefined> {
  let value = initialValue;
  const subscribers = new Set<Computation>();

  const get: Accessor<T | undefined> = () => {
    if (currentListener) {
      subscribers.add(currentListener);
    }
    return value;
  };

  const set: Setter<T | undefined> = (next) => {
    const nextValue =
      typeof next === "function" ? (next as (prev: T | undefined) => T | undefined)(value) : next;
    if (!Object.is(value, nextValue)) {
      value = nextValue;
      const toNotify = Array.from(subscribers);
      for (const sub of toNotify) {
        sub();
      }
    }
    return value;
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
// 8. Solid Component Types & Narrowing Helper
// ============================================================================

export type Component<P = {}> = (props: P) => any;
export type ParentComponent<P = {}> = Component<P & { children?: any }>;
export type VoidComponent<P = {}> = Component<P & { children?: never }>;
export type FlowComponent<P = {}, C = any> = Component<P & { children: C }>;

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
