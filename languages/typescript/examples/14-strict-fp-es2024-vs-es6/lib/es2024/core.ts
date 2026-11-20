export function assertNever(value: never, context = 'Unexpected unreachable state'): never {
  throw new Error(`${context}: ${String(value)}`);
}

export type Ordering = -1 | 0 | 1;
export type Comparator<T> = (a: T, b: T) => Ordering;

export type Primitive = string | number | boolean | bigint | symbol | null | undefined;

export type TypedArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array
  | BigInt64Array
  | BigUint64Array;

export type ClassifiedValue =
  | { readonly kind: 'primitive'; readonly value: Primitive }
  | { readonly kind: 'function'; readonly value: (...args: never[]) => unknown }
  | { readonly kind: 'date'; readonly value: Date }
  | { readonly kind: 'regexp'; readonly value: RegExp }
  | { readonly kind: 'array'; readonly value: readonly unknown[] }
  | { readonly kind: 'map'; readonly value: ReadonlyMap<unknown, unknown> }
  | { readonly kind: 'set'; readonly value: ReadonlySet<unknown> }
  | { readonly kind: 'dataView'; readonly value: DataView }
  | { readonly kind: 'typedArray'; readonly value: TypedArray }
  | { readonly kind: 'object'; readonly value: Record<PropertyKey, unknown> };

export function classifyValue(value: unknown): ClassifiedValue {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) {
    return { kind: 'primitive', value: value as Primitive };
  }
  if (typeof value === 'function') {
    return { kind: 'function', value: value as (...args: never[]) => unknown };
  }
  if (value instanceof Date) return { kind: 'date', value };
  if (value instanceof RegExp) return { kind: 'regexp', value };
  if (Array.isArray(value)) return { kind: 'array', value };
  if (value instanceof Map) return { kind: 'map', value };
  if (value instanceof Set) return { kind: 'set', value };
  if (value instanceof DataView) return { kind: 'dataView', value };
  if (ArrayBuffer.isView(value)) return { kind: 'typedArray', value: value as TypedArray };
  return { kind: 'object', value: value as Record<PropertyKey, unknown> };
}

export const PLACEHOLDER_SYMBOL: unique symbol = Symbol('strata.fp.placeholder');

export interface Placeholder {
  readonly [PLACEHOLDER_SYMBOL]: true;
}

export const __: Placeholder = Object.freeze({
  [PLACEHOLDER_SYMBOL]: true as const,
});

export function isPlaceholder(value: unknown): value is Placeholder {
  return (
    typeof value === 'object' &&
    value !== null &&
    PLACEHOLDER_SYMBOL in value &&
    (value as { readonly [PLACEHOLDER_SYMBOL]?: unknown })[PLACEHOLDER_SYMBOL] === true
  );
}

export interface Some<T> {
  readonly tag: 'some';
  readonly value: T;
}

export interface None {
  readonly tag: 'none';
}

export type Option<T> = Some<T> | None;

const NONE_SINGLETON: None = Object.freeze({ tag: 'none' as const });

export function some<T>(value: T): Some<T> {
  return Object.freeze({ tag: 'some' as const, value });
}

export function none(): None {
  return NONE_SINGLETON;
}

export function isSome<T>(opt: Option<T>): opt is Some<T> {
  return opt.tag === 'some';
}

export function isNone<T>(opt: Option<T>): opt is None {
  return opt.tag === 'none';
}

export function fromNullable<T>(value: T | null | undefined): Option<T> {
  return value === null || value === undefined ? NONE_SINGLETON : some(value);
}

export function mapOption<T, U>(opt: Option<T>, fn: (value: T) => U): Option<U> {
  switch (opt.tag) {
    case 'some':
      return some(fn(opt.value));
    case 'none':
      return NONE_SINGLETON;
    default:
      return assertNever(opt);
  }
}

export function flatMapOption<T, U>(opt: Option<T>, fn: (value: T) => Option<U>): Option<U> {
  switch (opt.tag) {
    case 'some':
      return fn(opt.value);
    case 'none':
      return NONE_SINGLETON;
    default:
      return assertNever(opt);
  }
}

export function getOrElse<T>(opt: Option<T>, fallback: () => T): T {
  switch (opt.tag) {
    case 'some':
      return opt.value;
    case 'none':
      return fallback();
    default:
      return assertNever(opt);
  }
}

export function matchOption<T, R>(
  opt: Option<T>,
  handlers: { readonly some: (value: T) => R; readonly none: () => R },
): R {
  switch (opt.tag) {
    case 'some':
      return handlers.some(opt.value);
    case 'none':
      return handlers.none();
    default:
      return assertNever(opt);
  }
}

export interface Ok<T> {
  readonly tag: 'ok';
  readonly value: T;
}

export interface Err<E> {
  readonly tag: 'err';
  readonly error: E;
}

export type Result<T, E> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return Object.freeze({ tag: 'ok' as const, value });
}

export function err<E>(error: E): Err<E> {
  return Object.freeze({ tag: 'err' as const, error });
}

export function isOk<T, E>(res: Result<T, E>): res is Ok<T> {
  return res.tag === 'ok';
}

export function isErr<T, E>(res: Result<T, E>): res is Err<E> {
  return res.tag === 'err';
}

export function mapResult<T, U, E>(res: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  switch (res.tag) {
    case 'ok':
      return ok(fn(res.value));
    case 'err':
      return res;
    default:
      return assertNever(res);
  }
}

export function flatMapResult<T, U, E>(
  res: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> {
  switch (res.tag) {
    case 'ok':
      return fn(res.value);
    case 'err':
      return res;
    default:
      return assertNever(res);
  }
}

export function mapError<T, E, F>(res: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  switch (res.tag) {
    case 'ok':
      return res;
    case 'err':
      return err(fn(res.error));
    default:
      return assertNever(res);
  }
}

export function tryResult<T, E = Error>(
  thunk: () => T,
  onError: (caught: unknown) => E = (e: unknown): E =>
    (e instanceof Error ? e : new Error(String(e))) as E,
): Result<T, E> {
  try {
    return ok(thunk());
  } catch (caught: unknown) {
    return err(onError(caught));
  }
}

export function matchResult<T, E, R>(
  res: Result<T, E>,
  handlers: { readonly ok: (value: T) => R; readonly err: (error: E) => R },
): R {
  switch (res.tag) {
    case 'ok':
      return handlers.ok(res.value);
    case 'err':
      return handlers.err(res.error);
    default:
      return assertNever(res);
  }
}

export const REDUCED_SYMBOL: unique symbol = Symbol('strata.fp.reduced');

export interface Reduced<T> {
  readonly [REDUCED_SYMBOL]: true;
  readonly value: T;
}

export function reduced<T>(value: T): Reduced<T> {
  return Object.freeze({
    [REDUCED_SYMBOL]: true as const,
    value,
  });
}

export function isReduced<T>(value: T | Reduced<T>): value is Reduced<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    REDUCED_SYMBOL in value &&
    (value as { readonly [REDUCED_SYMBOL]?: unknown })[REDUCED_SYMBOL] === true
  );
}

export function unreduced<T>(value: T | Reduced<T>): T {
  return isReduced(value) ? value.value : value;
}

export type StepResult<Acc> =
  | { readonly status: 'continue'; readonly value: Acc }
  | { readonly status: 'reduced'; readonly value: Acc };

export function cont<Acc>(value: Acc): StepResult<Acc> {
  return { status: 'continue', value };
}

export function doneStep<Acc>(value: Acc): StepResult<Acc> {
  return { status: 'reduced', value };
}

function recordCyclePair(seen: WeakMap<object, WeakSet<object>>, a: object, b: object): boolean {
  const seenA = seen.get(a);
  if (seenA?.has(b)) return true;
  const seenB = seen.get(b);
  if (seenB?.has(a)) return true;

  if (seenA !== undefined) {
    seenA.add(b);
  } else {
    const nextA = new WeakSet<object>();
    nextA.add(b);
    seen.set(a, nextA);
  }
  if (seenB !== undefined) {
    seenB.add(a);
  } else {
    const nextB = new WeakSet<object>();
    nextB.add(a);
    seen.set(b, nextB);
  }
  return false;
}

function equalInternal(a: unknown, b: unknown, seen: WeakMap<object, WeakSet<object>>): boolean {
  // SameValueZero (+0 === -0 and NaN === NaN)
  if (Object.is(a, b) || a === b) return true;

  const ca = classifyValue(a);
  const cb = classifyValue(b);
  if (ca.kind !== cb.kind) return false;

  switch (ca.kind) {
    case 'primitive':
      return cb.kind === 'primitive' && (Object.is(ca.value, cb.value) || ca.value === cb.value);
    case 'function':
      return cb.kind === 'function' && ca.value === cb.value;
    case 'date':
      return cb.kind === 'date' && Object.is(ca.value.getTime(), cb.value.getTime());
    case 'regexp':
      return (
        cb.kind === 'regexp' &&
        ca.value.source === cb.value.source &&
        ca.value.flags === cb.value.flags
      );
    case 'dataView': {
      if (cb.kind !== 'dataView' || ca.value.byteLength !== cb.value.byteLength) return false;
      for (let i = 0; i < ca.value.byteLength; i++) {
        if (ca.value.getUint8(i) !== cb.value.getUint8(i)) return false;
      }
      return true;
    }
    case 'typedArray': {
      if (
        cb.kind !== 'typedArray' ||
        ca.value.constructor !== cb.value.constructor ||
        ca.value.byteLength !== cb.value.byteLength
      ) {
        return false;
      }
      const viewA = new Uint8Array(ca.value.buffer, ca.value.byteOffset, ca.value.byteLength);
      const viewB = new Uint8Array(cb.value.buffer, cb.value.byteOffset, cb.value.byteLength);
      for (let i = 0; i < viewA.length; i++) {
        if (viewA[i] !== viewB[i]) return false;
      }
      return true;
    }
    case 'array': {
      if (cb.kind !== 'array' || ca.value.length !== cb.value.length) return false;
      if (recordCyclePair(seen, ca.value, cb.value)) return true;
      for (let i = 0; i < ca.value.length; i++) {
        if (!equalInternal(ca.value[i], cb.value[i], seen)) return false;
      }
      return true;
    }
    case 'set': {
      if (cb.kind !== 'set' || ca.value.size !== cb.value.size) return false;
      if (recordCyclePair(seen, ca.value, cb.value)) return true;
      // Bijective matching prevents false positives when distinct object elements match one target
      const itemsB = Array.from(cb.value.values());
      const usedB = new Uint8Array(itemsB.length);
      for (const itemA of ca.value.values()) {
        let matched = false;
        for (let i = 0; i < itemsB.length; i++) {
          if (usedB[i] === 0 && equalInternal(itemA, itemsB[i], seen)) {
            usedB[i] = 1;
            matched = true;
            break;
          }
        }
        if (!matched) return false;
      }
      return true;
    }
    case 'map': {
      if (cb.kind !== 'map' || ca.value.size !== cb.value.size) return false;
      if (recordCyclePair(seen, ca.value, cb.value)) return true;
      // Structural key + value matching handles object keys without relying on reference identity
      const entriesB = Array.from(cb.value.entries());
      const usedB = new Uint8Array(entriesB.length);
      for (const [kA, vA] of ca.value.entries()) {
        let matched = false;
        for (let i = 0; i < entriesB.length; i++) {
          if (usedB[i] === 1) continue;
          const entryB = entriesB[i]!;
          if (equalInternal(kA, entryB[0], seen) && equalInternal(vA, entryB[1], seen)) {
            usedB[i] = 1;
            matched = true;
            break;
          }
        }
        if (!matched) return false;
      }
      return true;
    }
    case 'object': {
      if (cb.kind !== 'object') return false;
      if (Object.getPrototypeOf(ca.value) !== Object.getPrototypeOf(cb.value)) return false;
      if (recordCyclePair(seen, ca.value, cb.value)) return true;
      const keysA = Reflect.ownKeys(ca.value);
      const keysB = Reflect.ownKeys(cb.value);
      if (keysA.length !== keysB.length) return false;
      for (let i = 0; i < keysA.length; i++) {
        const key = keysA[i]!;
        if (!Object.hasOwn(cb.value, key)) return false;
        if (!equalInternal(ca.value[key], cb.value[key], seen)) return false;
      }
      return true;
    }
    default:
      return assertNever(ca);
  }
}

export function isEqual(a: unknown, b: unknown): boolean {
  return equalInternal(a, b, new WeakMap<object, WeakSet<object>>());
}

export function equals(a: unknown): (b: unknown) => boolean;
export function equals(a: unknown, b: unknown): boolean;
export function equals(a: unknown, b?: unknown): boolean | ((b: unknown) => boolean) {
  if (arguments.length === 1) {
    return (other: unknown): boolean => isEqual(a, other);
  }
  return isEqual(a, b);
}

export function clone<T>(value: T): T {
  const classified = classifyValue(value);
  switch (classified.kind) {
    case 'primitive':
    case 'function':
      return value;
    case 'date':
      return new Date(classified.value.getTime()) as T;
    case 'regexp': {
      const cloned = new RegExp(classified.value.source, classified.value.flags);
      cloned.lastIndex = classified.value.lastIndex;
      return cloned as T;
    }
    case 'array':
      return classified.value.slice() as T;
    case 'map':
      return new Map(classified.value) as T;
    case 'set':
      return new Set(classified.value) as T;
    case 'dataView': {
      const copy = new Uint8Array(
        classified.value.buffer,
        classified.value.byteOffset,
        classified.value.byteLength,
      ).slice();
      return new DataView(copy.buffer) as T;
    }
    case 'typedArray': {
      const Ctor = classified.value.constructor as new (buf: ArrayBuffer) => TypedArray;
      const copy = new Uint8Array(
        classified.value.buffer,
        classified.value.byteOffset,
        classified.value.byteLength,
      ).slice();
      return new Ctor(copy.buffer) as T;
    }
    case 'object': {
      const proto = Object.getPrototypeOf(classified.value) as object | null;
      const copy = Object.create(proto) as Record<PropertyKey, unknown>;
      for (const key of Reflect.ownKeys(classified.value)) {
        const desc = Object.getOwnPropertyDescriptor(classified.value, key);
        if (desc !== undefined) {
          Object.defineProperty(copy, key, desc);
        }
      }
      return copy as T;
    }
    default:
      return assertNever(classified);
  }
}

function cloneDeepInternal<T>(value: T, cache: WeakMap<object, unknown>): T {
  const classified = classifyValue(value);
  switch (classified.kind) {
    case 'primitive':
    case 'function':
      return value;
    case 'date':
      return new Date(classified.value.getTime()) as T;
    case 'regexp': {
      const cloned = new RegExp(classified.value.source, classified.value.flags);
      cloned.lastIndex = classified.value.lastIndex;
      return cloned as T;
    }
    case 'dataView': {
      const copy = new Uint8Array(
        classified.value.buffer,
        classified.value.byteOffset,
        classified.value.byteLength,
      ).slice();
      return new DataView(copy.buffer) as T;
    }
    case 'typedArray': {
      const Ctor = classified.value.constructor as new (buf: ArrayBuffer) => TypedArray;
      const copy = new Uint8Array(
        classified.value.buffer,
        classified.value.byteOffset,
        classified.value.byteLength,
      ).slice();
      return new Ctor(copy.buffer) as T;
    }
    case 'array': {
      if (cache.has(classified.value)) return cache.get(classified.value) as T;
      const out: unknown[] = new Array(classified.value.length);
      cache.set(classified.value, out);
      for (let i = 0; i < classified.value.length; i++) {
        out[i] = cloneDeepInternal(classified.value[i], cache);
      }
      return out as T;
    }
    case 'set': {
      if (cache.has(classified.value)) return cache.get(classified.value) as T;
      const out = new Set<unknown>();
      cache.set(classified.value, out);
      for (const item of classified.value.values()) {
        out.add(cloneDeepInternal(item, cache));
      }
      return out as T;
    }
    case 'map': {
      if (cache.has(classified.value)) return cache.get(classified.value) as T;
      const out = new Map<unknown, unknown>();
      cache.set(classified.value, out);
      for (const [k, v] of classified.value.entries()) {
        out.set(cloneDeepInternal(k, cache), cloneDeepInternal(v, cache));
      }
      return out as T;
    }
    case 'object': {
      if (cache.has(classified.value)) return cache.get(classified.value) as T;
      const proto = Object.getPrototypeOf(classified.value) as object | null;
      const out = Object.create(proto) as Record<PropertyKey, unknown>;
      cache.set(classified.value, out);
      for (const key of Reflect.ownKeys(classified.value)) {
        const desc = Object.getOwnPropertyDescriptor(classified.value, key);
        if (desc === undefined) continue;
        if ('value' in desc) {
          Object.defineProperty(out, key, { ...desc, value: cloneDeepInternal(desc.value, cache) });
        } else {
          Object.defineProperty(out, key, desc);
        }
      }
      return out as T;
    }
    default:
      return assertNever(classified);
  }
}

export function cloneDeep<T>(value: T): T {
  return cloneDeepInternal(value, new WeakMap<object, unknown>());
}
