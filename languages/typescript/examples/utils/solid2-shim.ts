/**
 * SolidJS 2.0 Native Runtime Facade & Headless Test Harness
 *
 * Backed by the official published packages:
 * - `solid-js@2.0.0-rc.18`
 * - `@solidjs/signals@2.0.0-rc.18`
 * - `@solidjs/web@2.0.0-rc.18`
 *
 * Re-exports the native reactive core, stores, context, action transactions,
 * and lifecycle hooks. Provides headless adapters for command-line Node.js execution.
 */

import {
  createSignal as nativeCreateSignal,
  createMemo as nativeCreateMemo,
  createEffect as nativeCreateEffect,
  createRenderEffect as nativeCreateRenderEffect,
  createReaction as nativeCreateReaction,
  createRoot as nativeCreateRoot,
  runWithOwner as nativeRunWithOwner,
  getOwner as nativeGetOwner,
  untrack as nativeUntrack,
  onCleanup as nativeOnCleanup,
  onSettled as nativeOnSettled,
  flush as nativeFlush,
  createStore as nativeCreateStore,
  createProjection as nativeCreateProjection,
  createOptimistic as nativeCreateOptimistic,
  createOptimisticStore as nativeCreateOptimisticStore,
  reconcile as nativeReconcile,
  deep as nativeDeep,
  merge as nativeMerge,
  omit as nativeOmit,
  action as nativeAction,
  refresh as nativeRefresh,
  isPending as nativeIsPending,
  latest as nativeLatest,
  resolve as nativeResolve,
  createContext as nativeCreateContext,
  useContext as nativeUseContext,
  Show as NativeShow,
  Switch as NativeSwitch,
  Match as NativeMatch,
  For as NativeFor,
  Repeat as NativeRepeat,
  Loading as NativeLoading,
  Reveal as NativeReveal,
  Errored as NativeErrored,
  NotReadyError as NativeNotReadyError,
} from "solid-js";

import {
  storePath as nativeStorePath,
  snapshot as nativeSnapshot,
  ContextNotFoundError as NativeContextNotFoundError,
  until as nativeUntil,
  affects as nativeAffects,
} from "@solidjs/signals";

import type {
  Accessor as NativeAccessor,
  Setter as NativeSetter,
  Signal as NativeSignal,
  Store as NativeStore,
  StoreSetter as NativeStoreSetter,
  Context as NativeContext,
  Owner,
} from "solid-js";

// ============================================================================
// 1. Core Reactive Primitives Re-exports
// ============================================================================

export {
  nativeCreateReaction as createReaction,
  nativeCreateRoot as createRoot,
  nativeRunWithOwner as runWithOwner,
  nativeGetOwner as getOwner,
  nativeUntrack as untrack,
  nativeOnCleanup as onCleanup,
  nativeReconcile as reconcile,
  nativeDeep as deep,
  nativeMerge as merge,
  nativeOmit as omit,
  nativeAction as action,
  nativeRefresh as refresh,
  nativeUntil as until,
  nativeAffects as affects,
  NativeContextNotFoundError as ContextNotFoundError,
  NativeShow as Show,
  NativeSwitch as Switch,
  NativeMatch as Match,
  NativeFor as For,
  NativeRepeat as Repeat,
  NativeLoading as Loading,
  NativeReveal as Reveal,
  NativeErrored as Errored,
};

export class NotReadyError extends NativeNotReadyError {
  constructor(source: any = "NotReady") {
    super(source);
    this.name = "NotReadyError";
  }
}

export function onSettled(fn: () => void | (() => void)): void {
  nativeOnSettled(fn);
  nativeFlush();
}

export type {
  NativeAccessor as Accessor,
  NativeSetter as Setter,
  NativeSignal as Signal,
  NativeStore as Store,
  Owner,
};

// ============================================================================
// 2. Signals & Microtask Flush
// ============================================================================

export function createSignal<T>(): [NativeAccessor<T | undefined>, NativeSetter<T | undefined>];
export function createSignal<T>(
  value: T,
  options?: { name?: string; equals?: false | ((prev: T, next: T) => boolean) }
): [NativeAccessor<T>, NativeSetter<T>];
export function createSignal<T>(
  initialValue?: T,
  options?: { name?: string; equals?: false | ((prev: T, next: T) => boolean) }
): [NativeAccessor<any>, NativeSetter<any>] {
  return (nativeCreateSignal as any)(initialValue, options);
}

export function flush(fn?: () => void): void {
  if (fn) {
    nativeFlush(fn);
  } else {
    nativeFlush();
  }
}

// ============================================================================
// 3. Effects (Split-Signature Solid 2.0)
// ============================================================================

export function createEffect<T>(
  compute: (prev?: T) => T,
  apply: (value: T, prev: T | undefined) => void | (() => void),
  options?: { name?: string; defer?: boolean }
): void {
  nativeCreateEffect(compute, apply, options as any);
  nativeFlush();
}

export function createRenderEffect<T>(
  compute: () => T,
  effect: (value: T, prev: T | undefined) => void
): void {
  nativeCreateRenderEffect(compute, effect as any);
  nativeFlush();
}

// ============================================================================
// 4. Memos & Async Reactivity
// ============================================================================

const ASYNC_META = Symbol("SOLID2_ASYNC_META");

interface AsyncResourceMeta<T> {
  pending: boolean;
  value: T;
  promise: Promise<T>;
}

export function createMemo<T>(
  fn: (prev?: T) => T | Promise<T>,
  options?: { name?: string; equals?: false | ((prev: T, next: T) => boolean) }
): NativeAccessor<Awaited<T>> {
  return nativeCreateMemo(fn as any, options as any) as any;
}

export function createAsync<T>(fn: () => Promise<T> | T): NativeAccessor<T> {
  let pending = true;
  let value: T = undefined as any;
  let currentPromise: Promise<T>;

  const res = fn();
  if (res && typeof (res as any).then === "function") {
    currentPromise = (res as Promise<T>).then((val) => {
      value = val;
      pending = false;
      return val;
    });
  } else {
    value = res as T;
    pending = false;
    currentPromise = Promise.resolve(value);
  }

  const accessor: any = () => value;
  accessor[ASYNC_META] = {
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

  return accessor as NativeAccessor<T>;
}

export function isPending(fn: NativeAccessor<any>): boolean {
  const meta = (fn as any)?.[ASYNC_META] as AsyncResourceMeta<any> | undefined;
  if (meta !== undefined) return meta.pending;
  return nativeIsPending(fn);
}

export function latest<T>(fn: NativeAccessor<T>): T {
  const meta = (fn as any)?.[ASYNC_META] as AsyncResourceMeta<any> | undefined;
  if (meta !== undefined) return meta.value;
  return nativeLatest(fn);
}

export function resolve<T>(fn: NativeAccessor<T>): Promise<T> {
  const meta = (fn as any)?.[ASYNC_META] as AsyncResourceMeta<any> | undefined;
  if (meta !== undefined) return meta.promise;
  return nativeResolve(fn);
}

// ============================================================================
// 5. Stores & Projections
// ============================================================================

export type SetStoreFunction<T> = {
  (fn: (draft: T) => void): void;
  <K extends keyof T>(key: K, value: T[K] | ((prev: T[K]) => T[K])): void;
  (...pathAndValue: any[]): void;
};

export function createStore<T extends object = {}>(
  initialValue: T,
  options?: any
): [T, SetStoreFunction<T>];
export function createStore<T extends object = {}>(
  fn: (draft: T) => void | T | Promise<void | T> | AsyncIterable<void | T>,
  seed: T,
  options?: any
): [T, SetStoreFunction<T>];
export function createStore<T extends object = {}>(...args: any[]): [T, SetStoreFunction<T>] {
  const [store, nativeSetStore] = (nativeCreateStore as any)(...args);
  const setStore: SetStoreFunction<T> = (...setterArgs: any[]) => {
    if (
      setterArgs.length === 2 &&
      (typeof setterArgs[0] === "string" || typeof setterArgs[0] === "number")
    ) {
      const [key, val] = setterArgs;
      nativeSetStore((draft: any) => {
        draft[key] = typeof val === "function" ? val(draft[key]) : val;
      });
      nativeFlush();
      return;
    }
    const res = (nativeSetStore as any)(...setterArgs);
    nativeFlush();
    return res;
  };
  return [store, setStore];
}

export function createProjection<T extends object>(
  fn: (draft: T) => void,
  initialValue: T
): T {
  return (nativeCreateProjection as any)(fn, initialValue);
}

export function snapshot<T>(store: T): T {
  return nativeSnapshot(store);
}

export const storePath = Object.assign(
  function storePath<T = unknown>(...args: any[]) {
    return (nativeStorePath as any)(...args);
  },
  { DELETE: nativeStorePath.DELETE }
);

// ============================================================================
// 6. Optimistic State
// ============================================================================

export function createOptimistic<T>(initialOrCompute: T | (() => T)): NativeSignal<T> {
  const initial =
    typeof initialOrCompute === "function"
      ? (initialOrCompute as () => T)()
      : initialOrCompute;
  const [base, setBase] = (nativeCreateSignal as any)(initial);
  const [opt, setOpt] = (nativeCreateOptimistic as any)(() => base());
  const getter = () => opt();
  const setter: any = (valOrFn: any) => {
    setBase(valOrFn);
    try {
      setOpt(valOrFn);
    } catch {}
    return valOrFn;
  };
  return [getter as any, setter];
}

export function createOptimisticStore<T extends object>(
  initialOrDerive: T | ((draft: T) => void),
  seed?: T
): [any, SetStoreFunction<T>] {
  const initial =
    seed ?? (typeof initialOrDerive === "function" ? ({} as T) : initialOrDerive);
  const [baseStore, setBaseStore] = createStore<T>(initial);
  const [optStore, nativeSetOpt] = (nativeCreateOptimisticStore as any)(
    () => baseStore,
    initial
  );
  const setStore: SetStoreFunction<T> = (...args: any[]) => {
    (setBaseStore as any)(...args);
    try {
      (nativeSetOpt as any)(...args);
    } catch {}
    nativeFlush();
  };
  return [optStore, setStore];
}

// ============================================================================
// 7. Context (Providerless Solid 2.0)
// ============================================================================

export function createContext<T>(defaultValue: T, options?: { name?: string }): any;
export function createContext<T>(options?: { name?: string }): any;
export function createContext<T>(...args: any[]): any {
  let defaultValue = args[0];
  let options = args[1];
  if (
    args.length === 1 &&
    typeof args[0] === "object" &&
    args[0] !== null &&
    "name" in args[0] &&
    Object.keys(args[0]).length === 1
  ) {
    defaultValue = undefined;
    options = args[0];
  }
  const nativeCtx = (nativeCreateContext as any)(defaultValue, options);

  const ProviderComponent = (props: { value: T; children: any }): any => {
    let res: any;
    nativeCreateRoot((dispose) => {
      res = nativeCtx(props);
      if (typeof res === "function") {
        res = res();
      }
      dispose();
    });
    return res;
  };
  Object.setPrototypeOf(ProviderComponent, nativeCtx);
  return Object.assign(ProviderComponent, nativeCtx);
}

export function useContext<T>(context: any): T {
  if (!nativeGetOwner()) {
    let val: any;
    let err: any;
    nativeCreateRoot((dispose) => {
      try {
        val = nativeUseContext(context);
      } catch (e) {
        err = e;
      }
      dispose();
    });
    if (err) throw err;
    return val;
  }
  return nativeUseContext(context);
}

// ============================================================================
// 8. Props Helpers (`mergeProps`, `splitProps`)
// ============================================================================

type Prettify<T> = { [K in keyof T]: T[K] } & {};

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
// 9. Component Types & Headless Control Flow
// ============================================================================

export type Component<P = {}> = (props: P) => any;
export type ParentComponent<P = {}> = Component<P & { children?: any }>;
export type VoidComponent<P = {}> = Component<P & { children?: never }>;
export type FlowComponent<P = {}, C = any> = Component<P & { children: C }>;
export type RefDirective<E extends Element = HTMLElement> = (el: E) => void | (() => void);

export function narrowShow<T, R>(
  when: T | undefined | null | false,
  render: (item: NativeAccessor<NonNullable<T>>) => R
): R | null {
  if (when) {
    return render(() => when as NonNullable<T>);
  }
  return null;
}

export function narrowFor<T, R>(
  each: readonly T[] | undefined | null,
  options: { keyed: false },
  render: (item: NativeAccessor<T>, index: number) => R
): R[];
export function narrowFor<T, R>(
  each: readonly T[] | undefined | null,
  options: { keyed: (item: T) => unknown },
  render: (item: NativeAccessor<T>, index: NativeAccessor<number>) => R
): R[];
export function narrowFor<T, R>(
  each: readonly T[] | undefined | null,
  options: { keyed?: true } | undefined,
  render: (item: T, index: NativeAccessor<number>) => R
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
