import {
  __,
  assertNever,
  isPlaceholder,
  none,
  some,
  type Option,
  type Placeholder,
} from './core.ts';

export function identity<T>(value: T): T {
  return value;
}

export function always<T>(value: T): () => T {
  return (): T => value;
}
export const constant: typeof always = always;

export function noop(): void {}

export function T(): true {
  return true;
}

export function F(): false {
  return false;
}

export function tap<T>(fn: (value: T) => void): (value: T) => T {
  return (value: T): T => {
    fn(value);
    return value;
  };
}

export function pipe<A, B>(f1: (a: A) => B): (a: A) => B;
export function pipe<A, B, C>(f1: (a: A) => B, f2: (b: B) => C): (a: A) => C;
export function pipe<A, B, C, D>(f1: (a: A) => B, f2: (b: B) => C, f3: (c: C) => D): (a: A) => D;
export function pipe<A, B, C, D, E>(
  f1: (a: A) => B,
  f2: (b: B) => C,
  f3: (c: C) => D,
  f4: (d: D) => E,
): (a: A) => E;
export function pipe<A, B, C, D, E, FRes>(
  f1: (a: A) => B,
  f2: (b: B) => C,
  f3: (c: C) => D,
  f4: (d: D) => E,
  f5: (e: E) => FRes,
): (a: A) => FRes;
export function pipe<A, B, C, D, E, FRes, G>(
  f1: (a: A) => B,
  f2: (b: B) => C,
  f3: (c: C) => D,
  f4: (d: D) => E,
  f5: (e: E) => FRes,
  f6: (f: FRes) => G,
): (a: A) => G;
export function pipe(...fns: readonly ((arg: unknown) => unknown)[]): (arg: unknown) => unknown;
export function pipe(...fns: readonly ((arg: unknown) => unknown)[]): (arg: unknown) => unknown {
  return (initial: unknown): unknown => {
    let acc = initial;
    for (let i = 0; i < fns.length; i++) {
      acc = fns[i]!(acc);
    }
    return acc;
  };
}
export const flow: typeof pipe = pipe;

export function compose<A, B>(f1: (a: A) => B): (a: A) => B;
export function compose<A, B, C>(f2: (b: B) => C, f1: (a: A) => B): (a: A) => C;
export function compose<A, B, C, D>(f3: (c: C) => D, f2: (b: B) => C, f1: (a: A) => B): (a: A) => D;
export function compose<A, B, C, D, E>(
  f4: (d: D) => E,
  f3: (c: C) => D,
  f2: (b: B) => C,
  f1: (a: A) => B,
): (a: A) => E;
export function compose<A, B, C, D, E, FRes>(
  f5: (e: E) => FRes,
  f4: (d: D) => E,
  f3: (c: C) => D,
  f2: (b: B) => C,
  f1: (a: A) => B,
): (a: A) => FRes;
export function compose(...fns: readonly ((arg: unknown) => unknown)[]): (arg: unknown) => unknown;
export function compose(...fns: readonly ((arg: unknown) => unknown)[]): (arg: unknown) => unknown {
  return pipe(...fns.toReversed());
}
export const flowRight: typeof compose = compose;

export interface Curried2<A, B, R> {
  (a: A, b: B): R;
  (a: A): (b: B) => R;
  (a: Placeholder, b: B): (a: A) => R;
}

export function curry2<A, B, R>(fn: (a: A, b: B) => R): Curried2<A, B, R> {
  function curried(a: A | Placeholder, b?: B): R | ((x: never) => R) {
    if (arguments.length >= 2) {
      if (a === __ || isPlaceholder(a)) {
        return (realA: A): R => fn(realA, b as B);
      }
      return fn(a as A, b as B);
    }
    return (realB: B): R => fn(a as A, realB);
  }
  return curried as Curried2<A, B, R>;
}

export type CurriedFn<R> = (...args: readonly unknown[]) => unknown | R;

function mergePlaceholderArgs(prev: readonly unknown[], next: readonly unknown[]): unknown[] {
  const merged: unknown[] = [];
  let nextIdx = 0;
  for (let i = 0; i < prev.length; i++) {
    const item = prev[i];
    if (isPlaceholder(item) && nextIdx < next.length) {
      merged.push(next[nextIdx++]);
    } else {
      merged.push(item);
    }
  }
  while (nextIdx < next.length) {
    merged.push(next[nextIdx++]);
  }
  return merged;
}

export function curryN<R>(arity: number, fn: (...args: never[]) => R): CurriedFn<R> {
  const targetArity = Math.max(0, Math.floor(arity));
  const rawFn = fn as unknown as (...args: unknown[]) => R;

  const build = (collected: readonly unknown[]): CurriedFn<R> => {
    return (...incoming: readonly unknown[]): unknown => {
      const combined = mergePlaceholderArgs(collected, incoming);
      let solidCount = 0;
      for (let i = 0; i < combined.length; i++) {
        if (!isPlaceholder(combined[i])) solidCount++;
      }
      const hasLeadingPlaceholder = combined.slice(0, targetArity).some(isPlaceholder);
      if (solidCount >= targetArity && !hasLeadingPlaceholder) {
        return rawFn(...combined);
      }
      return build(combined);
    };
  };

  return build([]);
}

export function curry<R>(fn: (...args: never[]) => R): CurriedFn<R> {
  return curryN(fn.length, fn);
}

export function partial<R>(
  fn: (...args: never[]) => R,
  ...bound: readonly (unknown | Placeholder)[]
): (...rest: readonly unknown[]) => R {
  const rawFn = fn as unknown as (...args: unknown[]) => R;
  return (...rest: readonly unknown[]): R => rawFn(...mergePlaceholderArgs(bound, rest));
}

export function partialRight<R>(
  fn: (...args: never[]) => R,
  ...rightArgs: readonly unknown[]
): (...leftArgs: readonly unknown[]) => R {
  const rawFn = fn as unknown as (...args: unknown[]) => R;
  return (...leftArgs: readonly unknown[]): R => rawFn(...leftArgs, ...rightArgs);
}

export function flip<A, B, R>(fn: (a: A, b: B) => R): (b: B, a: A) => R {
  return (b: B, a: A): R => fn(a, b);
}

export function unary<A, R>(fn: (a: A, ...rest: never[]) => R): (a: A) => R {
  return (a: A): R => fn(a);
}

export function binary<A, B, R>(fn: (a: A, b: B, ...rest: never[]) => R): (a: A, b: B) => R {
  return (a: A, b: B): R => fn(a, b);
}

export function nAry<R>(
  n: number,
  fn: (...args: never[]) => R,
): (...args: readonly unknown[]) => R {
  const limit = Math.max(0, Math.floor(n));
  const rawFn = fn as unknown as (...args: unknown[]) => R;
  return (...args: readonly unknown[]): R => rawFn(...args.slice(0, limit));
}

export type Predicate<Args extends readonly unknown[]> = (...args: Args) => boolean;

export function complement<Args extends readonly unknown[]>(
  predicate: Predicate<Args>,
): Predicate<Args> {
  return (...args: Args): boolean => !predicate(...args);
}
export const negate: typeof complement = complement;

export function both<Args extends readonly unknown[]>(
  p1: Predicate<Args>,
  p2: Predicate<Args>,
): Predicate<Args> {
  return (...args: Args): boolean => p1(...args) && p2(...args);
}

export function either<Args extends readonly unknown[]>(
  p1: Predicate<Args>,
  p2: Predicate<Args>,
): Predicate<Args> {
  return (...args: Args): boolean => p1(...args) || p2(...args);
}

export function allPass<Args extends readonly unknown[]>(
  predicates: readonly Predicate<Args>[],
): Predicate<Args> {
  return (...args: Args): boolean => {
    for (let i = 0; i < predicates.length; i++) {
      if (!predicates[i]!(...args)) return false;
    }
    return true;
  };
}

export function anyPass<Args extends readonly unknown[]>(
  predicates: readonly Predicate<Args>[],
): Predicate<Args> {
  return (...args: Args): boolean => {
    for (let i = 0; i < predicates.length; i++) {
      if (predicates[i]!(...args)) return true;
    }
    return false;
  };
}

export function ifElse<T, A, B>(
  predicate: (value: T) => boolean,
  onTrue: (value: T) => A,
  onFalse: (value: T) => B,
): (value: T) => A | B {
  return (value: T): A | B => (predicate(value) ? onTrue(value) : onFalse(value));
}

export function when<T>(
  predicate: (value: T) => boolean,
  transform: (value: T) => T,
): (value: T) => T {
  return (value: T): T => (predicate(value) ? transform(value) : value);
}

export function unless<T>(
  predicate: (value: T) => boolean,
  transform: (value: T) => T,
): (value: T) => T {
  return (value: T): T => (predicate(value) ? value : transform(value));
}

export function condOption<T, R>(
  pairs: readonly (readonly [(value: T) => boolean, (value: T) => R])[],
): (value: T) => Option<R> {
  return (value: T): Option<R> => {
    for (let i = 0; i < pairs.length; i++) {
      const [predicate, transformer] = pairs[i]!;
      if (predicate(value)) return some(transformer(value));
    }
    return none();
  };
}

export function cond<T, R>(
  pairs: readonly (readonly [(value: T) => boolean, (value: T) => R])[],
): (value: T) => R | undefined {
  const matcher = condOption(pairs);
  return (value: T): R | undefined => {
    const res = matcher(value);
    return res.tag === 'some' ? res.value : undefined;
  };
}

export function converge<T, R>(
  afterFn: (...branchResults: never[]) => R,
  branches: readonly ((input: T) => unknown)[],
): (input: T) => R {
  const rawAfter = afterFn as unknown as (...args: unknown[]) => R;
  return (input: T): R => {
    const results: unknown[] = new Array(branches.length);
    for (let i = 0; i < branches.length; i++) {
      results[i] = branches[i]!(input);
    }
    return rawAfter(...results);
  };
}

export function juxt<Args extends readonly unknown[], R>(
  fns: readonly ((...args: Args) => R)[],
): (...args: Args) => R[] {
  return (...args: Args): R[] => {
    const out: R[] = new Array(fns.length);
    for (let i = 0; i < fns.length; i++) {
      out[i] = fns[i]!(...args);
    }
    return out;
  };
}

export function overArgs<R>(
  fn: (...transformed: never[]) => R,
  transforms: readonly ((arg: unknown) => unknown)[],
): (...args: readonly unknown[]) => R {
  const rawFn = fn as unknown as (...args: unknown[]) => R;
  return (...args: readonly unknown[]): R => {
    const mapped = args.map((arg, idx) => {
      const t = transforms[idx];
      return t !== undefined ? t(arg) : arg;
    });
    return rawFn(...mapped);
  };
}
export const useWith: typeof overArgs = overArgs;

export function ap<A, B>(fns: readonly ((a: A) => B)[], values: readonly A[]): B[] {
  const result: B[] = new Array(fns.length * values.length);
  let k = 0;
  for (let i = 0; i < fns.length; i++) {
    const fn = fns[i]!;
    for (let j = 0; j < values.length; j++) {
      result[k++] = fn(values[j]!);
    }
  }
  return result;
}

export type OnceState<R> =
  | { readonly tag: 'uncalled' }
  | { readonly tag: 'called'; readonly value: R };

export interface OnceFunction<Args extends readonly unknown[], R> {
  (...args: Args): R;
  readonly getState: () => OnceState<R>;
}

export function once<Args extends readonly unknown[], R>(
  fn: (...args: Args) => R,
): OnceFunction<Args, R> {
  let state: OnceState<R> = { tag: 'uncalled' };

  const wrapped = ((...args: Args): R => {
    switch (state.tag) {
      case 'uncalled': {
        const computed = fn(...args);
        state = Object.freeze({ tag: 'called' as const, value: computed });
        return computed;
      }
      case 'called':
        return state.value;
      default:
        return assertNever(state);
    }
  }) as OnceFunction<Args, R>;

  Object.defineProperty(wrapped, 'getState', {
    value: (): OnceState<R> => state,
    enumerable: true,
  });

  return wrapped;
}

export function after<Args extends readonly unknown[], R>(
  n: number,
  fn: (...args: Args) => R,
): (...args: Args) => Option<R> {
  type AfterState =
    | { readonly tag: 'counting'; readonly remaining: number }
    | { readonly tag: 'active' };

  const threshold = Math.max(0, Math.floor(n));
  let state: AfterState =
    threshold <= 1 ? { tag: 'active' } : { tag: 'counting', remaining: threshold - 1 };

  return (...args: Args): Option<R> => {
    switch (state.tag) {
      case 'counting': {
        const nextRem = state.remaining - 1;
        state = nextRem <= 0 ? { tag: 'active' } : { tag: 'counting', remaining: nextRem };
        return none();
      }
      case 'active':
        return some(fn(...args));
      default:
        return assertNever(state);
    }
  };
}

export function before<Args extends readonly unknown[], R>(
  n: number,
  fn: (...args: Args) => R,
): (...args: Args) => Option<R> {
  type BeforeState =
    | { readonly tag: 'active'; readonly remaining: number; readonly lastValue: Option<R> }
    | { readonly tag: 'exhausted'; readonly lastValue: Option<R> };

  const limit = Math.max(0, Math.floor(n));
  let state: BeforeState =
    limit <= 1
      ? { tag: 'exhausted', lastValue: none() }
      : { tag: 'active', remaining: limit - 1, lastValue: none() };

  return (...args: Args): Option<R> => {
    switch (state.tag) {
      case 'active': {
        const value = some(fn(...args));
        const nextRem = state.remaining - 1;
        state =
          nextRem <= 0
            ? { tag: 'exhausted', lastValue: value }
            : { tag: 'active', remaining: nextRem, lastValue: value };
        return value;
      }
      case 'exhausted':
        return state.lastValue;
      default:
        return assertNever(state);
    }
  };
}

export interface MemoizeOptions<Args extends readonly unknown[], K> {
  readonly resolver?: (...args: Args) => K;
  readonly maxSize?: number;
}

export interface MemoizedFunction<Args extends readonly unknown[], R, K> {
  (...args: Args): R;
  readonly cache: Map<K, R>;
  readonly getCached: (key: K) => Option<R>;
  readonly delete: (key: K) => boolean;
  readonly clear: () => void;
  readonly stats: () => { readonly hits: number; readonly misses: number; readonly size: number };
}

export function memoize<Args extends readonly unknown[], R, K = Args[0]>(
  fn: (...args: Args) => R,
  options: MemoizeOptions<Args, K> = {},
): MemoizedFunction<Args, R, K> {
  const maxSize = options.maxSize ?? Number.POSITIVE_INFINITY;
  if (maxSize <= 0) {
    throw new RangeError('maxSize must be greater than 0');
  }
  const cache = new Map<K, R>();
  const resolver = options.resolver ?? ((...args: Args): K => args[0] as unknown as K);
  let hits = 0;
  let misses = 0;

  const memoized = ((...args: Args): R => {
    const key = resolver(...args);
    if (cache.has(key)) {
      hits++;
      const existing = cache.get(key) as R;
      cache.delete(key);
      cache.set(key, existing);
      return existing;
    }
    misses++;
    const computed = fn(...args);
    if (cache.size >= maxSize) {
      const oldestKey = cache.keys().next();
      if (!oldestKey.done) {
        cache.delete(oldestKey.value);
      }
    }
    cache.set(key, computed);
    return computed;
  }) as MemoizedFunction<Args, R, K>;

  Object.defineProperties(memoized, {
    cache: { value: cache, enumerable: true },
    getCached: {
      value: (key: K): Option<R> => (cache.has(key) ? some(cache.get(key) as R) : none()),
      enumerable: true,
    },
    delete: { value: (key: K): boolean => cache.delete(key), enumerable: true },
    clear: {
      value: (): void => {
        cache.clear();
        hits = 0;
        misses = 0;
      },
      enumerable: true,
    },
    stats: {
      value: (): { readonly hits: number; readonly misses: number; readonly size: number } => ({
        hits,
        misses,
        size: cache.size,
      }),
      enumerable: true,
    },
  });

  return memoized;
}

export type DebounceMode =
  | { readonly edge: 'trailing' }
  | { readonly edge: 'leading' }
  | { readonly edge: 'both' };

export type DebounceState<Args extends readonly unknown[]> =
  | { readonly status: 'idle' }
  | {
      readonly status: 'waitingTrailing';
      readonly timerId: ReturnType<typeof setTimeout>;
      readonly pendingArgs: Args;
    }
  | { readonly status: 'coolingLeading'; readonly timerId: ReturnType<typeof setTimeout> }
  | {
      readonly status: 'coolingWithPending';
      readonly timerId: ReturnType<typeof setTimeout>;
      readonly pendingArgs: Args;
    }
  | { readonly status: 'disposed' };

export interface DebouncedFunction<Args extends readonly unknown[], R> extends Disposable {
  (...args: Args): Option<R>;
  readonly cancel: () => void;
  readonly flush: () => Option<R>;
  readonly getState: () => DebounceState<Args>['status'];
  readonly dispose: () => void;
}

export function debounce<Args extends readonly unknown[], R = void>(
  fn: (...args: Args) => R,
  waitMs: number,
  mode: DebounceMode = { edge: 'trailing' },
): DebouncedFunction<Args, R> {
  if (waitMs < 0 || !Number.isFinite(waitMs)) {
    throw new RangeError('waitMs must be a finite non-negative number');
  }

  let current: DebounceState<Args> = { status: 'idle' };

  const onTimerFired = (): void => {
    switch (current.status) {
      case 'idle':
      case 'disposed':
        return;
      case 'coolingLeading':
        current = { status: 'idle' };
        return;
      case 'waitingTrailing':
      case 'coolingWithPending': {
        const args = current.pendingArgs;
        current = { status: 'idle' };
        fn(...args);
        return;
      }
      default:
        assertNever(current);
    }
  };

  const cancel = (): void => {
    switch (current.status) {
      case 'idle':
      case 'disposed':
        return;
      case 'waitingTrailing':
      case 'coolingLeading':
      case 'coolingWithPending':
        clearTimeout(current.timerId);
        current = { status: 'idle' };
        return;
      default:
        assertNever(current);
    }
  };

  const flush = (): Option<R> => {
    switch (current.status) {
      case 'idle':
      case 'disposed':
        return none();
      case 'coolingLeading':
        clearTimeout(current.timerId);
        current = { status: 'idle' };
        return none();
      case 'waitingTrailing':
      case 'coolingWithPending': {
        const args = current.pendingArgs;
        clearTimeout(current.timerId);
        current = { status: 'idle' };
        return some(fn(...args));
      }
      default:
        return assertNever(current);
    }
  };

  const dispose = (): void => {
    cancel();
    current = { status: 'disposed' };
  };

  const invoke = ((...args: Args): Option<R> => {
    switch (current.status) {
      case 'disposed':
        return none();
      case 'idle': {
        const timerId = setTimeout(onTimerFired, waitMs);
        switch (mode.edge) {
          case 'trailing':
            current = { status: 'waitingTrailing', timerId, pendingArgs: args };
            return none();
          case 'leading':
          case 'both':
            current = { status: 'coolingLeading', timerId };
            return some(fn(...args));
          default:
            return assertNever(mode);
        }
      }
      case 'waitingTrailing': {
        clearTimeout(current.timerId);
        const timerId = setTimeout(onTimerFired, waitMs);
        current = { status: 'waitingTrailing', timerId, pendingArgs: args };
        return none();
      }
      case 'coolingLeading': {
        clearTimeout(current.timerId);
        const timerId = setTimeout(onTimerFired, waitMs);
        switch (mode.edge) {
          case 'leading':
            current = { status: 'coolingLeading', timerId };
            return none();
          case 'both':
            current = { status: 'coolingWithPending', timerId, pendingArgs: args };
            return none();
          case 'trailing':
            current = { status: 'waitingTrailing', timerId, pendingArgs: args };
            return none();
          default:
            return assertNever(mode);
        }
      }
      case 'coolingWithPending': {
        clearTimeout(current.timerId);
        const timerId = setTimeout(onTimerFired, waitMs);
        current = { status: 'coolingWithPending', timerId, pendingArgs: args };
        return none();
      }
      default:
        return assertNever(current);
    }
  }) as DebouncedFunction<Args, R>;

  Object.defineProperties(invoke, {
    cancel: { value: cancel, enumerable: true },
    flush: { value: flush, enumerable: true },
    getState: { value: (): DebounceState<Args>['status'] => current.status, enumerable: true },
    dispose: { value: dispose, enumerable: true },
    [Symbol.dispose]: { value: dispose, enumerable: false },
  });

  return invoke;
}

export type ThrottleState<Args extends readonly unknown[]> =
  | { readonly status: 'idle' }
  | { readonly status: 'cooling'; readonly timerId: ReturnType<typeof setTimeout> }
  | {
      readonly status: 'coolingWithQueued';
      readonly timerId: ReturnType<typeof setTimeout>;
      readonly queuedArgs: Args;
    }
  | { readonly status: 'disposed' };

export interface ThrottledFunction<Args extends readonly unknown[], R> extends Disposable {
  (...args: Args): Option<R>;
  readonly cancel: () => void;
  readonly getState: () => ThrottleState<Args>['status'];
  readonly dispose: () => void;
}

export function throttle<Args extends readonly unknown[], R = void>(
  fn: (...args: Args) => R,
  intervalMs: number,
): ThrottledFunction<Args, R> {
  if (intervalMs < 0 || !Number.isFinite(intervalMs)) {
    throw new RangeError('intervalMs must be a finite non-negative number');
  }

  let current: ThrottleState<Args> = { status: 'idle' };

  const onIntervalComplete = (): void => {
    switch (current.status) {
      case 'idle':
      case 'disposed':
        return;
      case 'cooling':
        current = { status: 'idle' };
        return;
      case 'coolingWithQueued': {
        const args = current.queuedArgs;
        const timerId = setTimeout(onIntervalComplete, intervalMs);
        current = { status: 'cooling', timerId };
        fn(...args);
        return;
      }
      default:
        assertNever(current);
    }
  };

  const cancel = (): void => {
    switch (current.status) {
      case 'idle':
      case 'disposed':
        return;
      case 'cooling':
      case 'coolingWithQueued':
        clearTimeout(current.timerId);
        current = { status: 'idle' };
        return;
      default:
        assertNever(current);
    }
  };

  const dispose = (): void => {
    cancel();
    current = { status: 'disposed' };
  };

  const invoke = ((...args: Args): Option<R> => {
    switch (current.status) {
      case 'disposed':
        return none();
      case 'idle': {
        const timerId = setTimeout(onIntervalComplete, intervalMs);
        current = { status: 'cooling', timerId };
        return some(fn(...args));
      }
      case 'cooling':
      case 'coolingWithQueued':
        current = { status: 'coolingWithQueued', timerId: current.timerId, queuedArgs: args };
        return none();
      default:
        return assertNever(current);
    }
  }) as ThrottledFunction<Args, R>;

  Object.defineProperties(invoke, {
    cancel: { value: cancel, enumerable: true },
    getState: { value: (): ThrottleState<Args>['status'] => current.status, enumerable: true },
    dispose: { value: dispose, enumerable: true },
    [Symbol.dispose]: { value: dispose, enumerable: false },
  });

  return invoke;
}

export type Bounce<T> =
  | { readonly tag: 'done'; readonly value: T }
  | { readonly tag: 'more'; readonly thunk: () => Bounce<T> };

export function done<T>(value: T): Bounce<T> {
  return { tag: 'done', value };
}

export function more<T>(thunk: () => Bounce<T>): Bounce<T> {
  return { tag: 'more', thunk };
}

export function trampoline<T>(initial: Bounce<T>): T {
  let step: Bounce<T> = initial;
  while (true) {
    switch (step.tag) {
      case 'done':
        return step.value;
      case 'more':
        step = step.thunk();
        break;
      default:
        return assertNever(step);
    }
  }
}
