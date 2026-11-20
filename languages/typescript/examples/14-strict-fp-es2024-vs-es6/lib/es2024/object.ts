import { isEqual, none, some, type Option } from './core.ts';
import { isPlainObject } from './math-lang.ts';

const FORBIDDEN_KEYS = new Set<PropertyKey>(['__proto__', 'constructor', 'prototype']);

function assertSafeKey(key: PropertyKey): void {
  if (FORBIDDEN_KEYS.has(key)) {
    throw new Error(`Unsafe property key rejected to prevent prototype pollution: ${String(key)}`);
  }
}

export type PathSegment = string | number;
export type PropertyPath = readonly PathSegment[] | string;

export function toPath(pathInput: PropertyPath): PathSegment[] {
  if (Array.isArray(pathInput)) {
    return pathInput.slice();
  }
  const str = pathInput as string;
  if (str.length === 0) return [];
  const segments: PathSegment[] = [];
  const regex = /[^.[\]]+|\[(?:(-?\d+)|(['"])(.*?)\2)\]/g;
  let match = regex.exec(str);
  while (match !== null) {
    if (match[1] !== undefined) {
      segments.push(Number(match[1]));
    } else if (match[3] !== undefined) {
      segments.push(match[3]);
    } else if (match[0] !== undefined) {
      segments.push(match[0]);
    }
    match = regex.exec(str);
  }
  return segments;
}

type PrevDepth = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8];

type BuiltinLeaf =
  | Date
  | RegExp
  | Map<unknown, unknown>
  | Set<unknown>
  | ((...args: never[]) => unknown)
  | readonly unknown[];

/** Compile-time checked dot-path union (depth-bounded, works on both `interface` and `type`). */
export type DotPath<T, D extends number = 6> = [D] extends [never]
  ? never
  : T extends BuiltinLeaf
    ? never
    : T extends object
      ? {
          [K in keyof T & string]: NonNullable<T[K]> extends BuiltinLeaf
            ? K
            : NonNullable<T[K]> extends object
              ? K | `${K}.${DotPath<NonNullable<T[K]>, PrevDepth[D]>}`
              : K;
        }[keyof T & string]
      : never;

export type DotPathValue<T, P extends string> = P extends `${infer Head}.${infer Tail}`
  ? Head extends keyof T
    ? undefined extends T[Head]
      ? DotPathValue<NonNullable<T[Head]>, Tail> | undefined
      : DotPathValue<NonNullable<T[Head]>, Tail>
    : never
  : P extends keyof T
    ? T[P]
    : never;

export function getPath<T extends object, P extends DotPath<T>>(
  obj: T,
  pathStr: P,
): Option<DotPathValue<T, P>> {
  const segments = pathStr.split('.');
  let cursor: unknown = obj;
  for (const segment of segments) {
    if (cursor === null || typeof cursor !== 'object' || !Object.hasOwn(cursor, segment)) {
      return none();
    }
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return some(cursor as DotPathValue<T, P>);
}

export function keys<T extends object>(obj: T): (keyof T & string)[] {
  return Object.keys(obj) as (keyof T & string)[];
}

export function values<T extends object>(obj: T): T[keyof T & string][] {
  return Object.values(obj) as T[keyof T & string][];
}

export function entries<T extends object>(obj: T): [keyof T & string, T[keyof T & string]][] {
  return Object.entries(obj) as [keyof T & string, T[keyof T & string]][];
}

export function assign<T extends Record<string, unknown>, U extends Record<string, unknown>>(
  target: T,
  source: U,
): Omit<T, keyof U> & U {
  return { ...target, ...source };
}
export const extend: typeof assign = assign;

export function defaults<T extends Record<string, unknown>>(
  target: T,
  ...sources: readonly Record<string, unknown>[]
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...target };
  for (const src of sources) {
    for (const key of Object.keys(src)) {
      assertSafeKey(key);
      if (out[key] === undefined) {
        out[key] = src[key];
      }
    }
  }
  return out;
}

export function mergeDeepRight(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...left };
  for (const key of Object.keys(right)) {
    assertSafeKey(key);
    const lVal = out[key];
    const rVal = right[key];
    if (isPlainObject(lVal) && isPlainObject(rVal)) {
      out[key] = mergeDeepRight(lVal, rVal);
    } else {
      out[key] = rVal;
    }
  }
  return out;
}
export const merge: typeof mergeDeepRight = mergeDeepRight;

export function mergeDeepLeft(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): Record<string, unknown> {
  return mergeDeepRight(right, left);
}

export function mergeWith<V>(
  resolver: (leftVal: V, rightVal: V, key: string) => V,
  left: Readonly<Record<string, V>>,
  right: Readonly<Record<string, V>>,
): Record<string, V> {
  const out: Record<string, V> = { ...left };
  for (const key of Object.keys(right)) {
    assertSafeKey(key);
    const rVal = right[key]!;
    if (Object.hasOwn(out, key)) {
      out[key] = resolver(out[key]!, rVal, key);
    } else {
      out[key] = rVal;
    }
  }
  return out;
}

export function defaultsDeep(
  target: Record<string, unknown>,
  fallback: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...target };
  for (const key of Object.keys(fallback)) {
    assertSafeKey(key);
    const current = out[key];
    const fb = fallback[key];
    if (current === undefined) {
      out[key] = fb;
    } else if (isPlainObject(current) && isPlainObject(fb)) {
      out[key] = defaultsDeep(current, fb);
    }
  }
  return out;
}

export function pick<T extends object, K extends keyof T>(
  obj: T,
  selectedKeys: readonly K[],
): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of selectedKeys) {
    if (Object.hasOwn(obj, k)) {
      out[k] = obj[k];
    }
  }
  return out;
}

export function pickBy<T extends Record<string, unknown>>(
  obj: T,
  predicate: (value: T[keyof T], key: string) => boolean,
): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key] as T[keyof T];
    if (predicate(val, key)) {
      out[key] = val;
    }
  }
  return out as Partial<T>;
}

export function omit<T extends object, K extends keyof T>(
  obj: T,
  excludedKeys: readonly K[],
): Omit<T, K> {
  const excludeSet = new Set<PropertyKey>(excludedKeys);
  const out: Record<PropertyKey, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (!excludeSet.has(key)) {
      out[key] = (obj as Record<string, unknown>)[key];
    }
  }
  return out as Omit<T, K>;
}

export function omitBy<T extends Record<string, unknown>>(
  obj: T,
  predicate: (value: T[keyof T], key: string) => boolean,
): Partial<T> {
  return pickBy(obj, (val, key) => !predicate(val, key));
}

export function mapValues<T extends Record<string, unknown>, U>(
  obj: T,
  fn: (value: T[keyof T], key: string) => U,
): Record<keyof T, U> {
  const out = {} as Record<keyof T, U>;
  for (const [key, val] of Object.entries(obj)) {
    out[key as keyof T] = fn(val as T[keyof T], key);
  }
  return out;
}
export const mapObjIndexed: typeof mapValues = mapValues;

export function mapKeys<V>(
  obj: Readonly<Record<string, V>>,
  fn: (key: string, value: V) => string,
): Record<string, V> {
  const out: Record<string, V> = {};
  for (const [key, val] of Object.entries(obj)) {
    const newKey = fn(key, val);
    assertSafeKey(newKey);
    out[newKey] = val;
  }
  return out;
}

export function invert<V extends PropertyKey>(obj: Readonly<Record<string, V>>): Record<V, string> {
  const out = {} as Record<V, string>;
  for (const [key, val] of Object.entries(obj)) {
    assertSafeKey(val);
    out[val] = key;
  }
  return out;
}

export function invertBy<T>(
  obj: Readonly<Record<string, T>>,
  keyFn: (value: T) => string = String,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [key, val] of Object.entries(obj)) {
    const groupedKey = keyFn(val);
    assertSafeKey(groupedKey);
    const bucket = out[groupedKey];
    if (bucket === undefined) {
      out[groupedKey] = [key];
    } else {
      bucket.push(key);
    }
  }
  return out;
}

export function pathOption<R = unknown>(obj: unknown, pathInput: PropertyPath): Option<R> {
  const segments = toPath(pathInput);
  let cursor: unknown = obj;
  for (const seg of segments) {
    if (cursor === null || cursor === undefined || typeof cursor !== 'object') {
      return none();
    }
    if (Array.isArray(cursor)) {
      const idx = typeof seg === 'number' ? seg : Number(seg);
      if (!Number.isInteger(idx) || idx < 0 || idx >= cursor.length) return none();
      cursor = cursor[idx];
    } else {
      const key = String(seg);
      if (!Object.hasOwn(cursor, key)) return none();
      cursor = (cursor as Record<string, unknown>)[key];
    }
  }
  return cursor === undefined ? none() : some(cursor as R);
}

export function get<R = unknown>(
  obj: unknown,
  pathInput: PropertyPath,
  defaultValue?: R,
): R | undefined {
  const opt = pathOption<R>(obj, pathInput);
  return opt.tag === 'some' ? opt.value : defaultValue;
}
export const path: typeof get = get;

export function pathOr<R>(defaultValue: R, pathInput: PropertyPath, obj: unknown): R {
  const opt = pathOption<R>(obj, pathInput);
  return opt.tag === 'some' ? opt.value : defaultValue;
}

export function has(obj: unknown, pathInput: PropertyPath): boolean {
  const segments = toPath(pathInput);
  if (segments.length === 0) return false;
  let cursor: unknown = obj;
  for (const seg of segments) {
    if (cursor === null || cursor === undefined || typeof cursor !== 'object') return false;
    if (Array.isArray(cursor)) {
      const idx = typeof seg === 'number' ? seg : Number(seg);
      if (!Number.isInteger(idx) || idx < 0 || idx >= cursor.length) return false;
      cursor = cursor[idx];
    } else {
      const key = String(seg);
      if (!Object.hasOwn(cursor, key)) return false;
      cursor = (cursor as Record<string, unknown>)[key];
    }
  }
  return true;
}
export const hasPath: typeof has = has;

function setPathRecursive(
  node: unknown,
  segments: readonly PathSegment[],
  depth: number,
  value: unknown,
): unknown {
  if (depth >= segments.length) return value;
  const seg = segments[depth]!;
  assertSafeKey(seg);

  const isIndex = typeof seg === 'number' && Number.isInteger(seg) && seg >= 0;
  if (isIndex && (Array.isArray(node) || node === undefined || node === null)) {
    const arr = Array.isArray(node) ? node.slice() : [];
    arr[seg] = setPathRecursive(arr[seg], segments, depth + 1, value);
    return arr;
  }

  const baseObj: Record<string, unknown> =
    typeof node === 'object' && node !== null && !Array.isArray(node)
      ? { ...(node as Record<string, unknown>) }
      : {};
  const key = String(seg);
  baseObj[key] = setPathRecursive(baseObj[key], segments, depth + 1, value);
  return baseObj;
}

export function assocPath<T>(pathInput: PropertyPath, value: unknown, obj: T): T {
  const segments = toPath(pathInput);
  if (segments.length === 0) return value as T;
  return setPathRecursive(obj, segments, 0, value) as T;
}
export const set: typeof assocPath = assocPath;

export function assoc<T extends Record<string, unknown>, K extends string, V>(
  key: K,
  value: V,
  obj: T,
): Omit<T, K> & Record<K, V> {
  assertSafeKey(key);
  return { ...obj, [key]: value };
}

function dissocPathRecursive(
  node: unknown,
  segments: readonly PathSegment[],
  depth: number,
): unknown {
  if (node === null || node === undefined || typeof node !== 'object') return node;
  const seg = segments[depth]!;
  const isLast = depth === segments.length - 1;

  if (Array.isArray(node)) {
    const idx = typeof seg === 'number' ? seg : Number(seg);
    if (!Number.isInteger(idx) || idx < 0 || idx >= node.length) return node;
    if (isLast) return node.toSpliced(idx, 1);
    return node.with(idx, dissocPathRecursive(node[idx], segments, depth + 1));
  }

  const key = String(seg);
  if (!Object.hasOwn(node, key)) return node;
  const copy: Record<string, unknown> = { ...(node as Record<string, unknown>) };
  if (isLast) {
    delete copy[key];
    return copy;
  }
  copy[key] = dissocPathRecursive(copy[key], segments, depth + 1);
  return copy;
}

export function dissocPath<T>(pathInput: PropertyPath, obj: T): T {
  const segments = toPath(pathInput);
  if (segments.length === 0) return obj;
  return dissocPathRecursive(obj, segments, 0) as T;
}
export const unset: typeof dissocPath = dissocPath;

export function dissoc<T extends Record<string, unknown>, K extends keyof T>(
  key: K,
  obj: T,
): Omit<T, K> {
  return omit(obj, [key]);
}

export function modifyPath<T, V = unknown>(
  pathInput: PropertyPath,
  fn: (current: V) => V,
  obj: T,
): T {
  const current = pathOption<V>(obj, pathInput);
  if (current.tag === 'none') return obj;
  return assocPath(pathInput, fn(current.value), obj);
}
export const updatePath: typeof modifyPath = modifyPath;

export function prop<T extends object, K extends keyof T>(key: K): (obj: T) => T[K] {
  return (obj: T): T[K] => obj[key];
}

export function propOr<T extends Record<string, unknown>, K extends string, D>(
  defaultValue: D,
  key: K,
): (obj: T) => NonNullable<T[K]> | D {
  return (obj: T): NonNullable<T[K]> | D => {
    const val = obj[key];
    return val === null || val === undefined ? defaultValue : (val as NonNullable<T[K]>);
  };
}

export function props<T extends Record<string, unknown>, K extends keyof T>(
  selectedKeys: readonly K[],
  obj: T,
): T[K][] {
  return selectedKeys.map((k) => obj[k]);
}

export function propEq(value: unknown, key: string): (obj: Record<string, unknown>) => boolean {
  return (obj: Record<string, unknown>): boolean =>
    Object.hasOwn(obj, key) && isEqual(obj[key], value);
}

export function pathEq(value: unknown, pathInput: PropertyPath): (obj: unknown) => boolean {
  return (obj: unknown): boolean => {
    const res = pathOption(obj, pathInput);
    return res.tag === 'some' && isEqual(res.value, value);
  };
}

export type Spec<T extends Record<string, unknown>> = {
  readonly [K in keyof T]?: (value: T[K]) => boolean;
};

export function where<T extends Record<string, unknown>>(spec: Spec<T>): (obj: T) => boolean {
  const specKeys = Object.keys(spec) as (keyof T)[];
  return (obj: T): boolean => {
    for (const key of specKeys) {
      const pred = spec[key];
      if (pred !== undefined && !pred(obj[key])) return false;
    }
    return true;
  };
}

export function whereEq<T extends Record<string, unknown>>(spec: Partial<T>): (obj: T) => boolean {
  const specKeys = Object.keys(spec) as (keyof T)[];
  return (obj: T): boolean => {
    for (const key of specKeys) {
      if (!Object.hasOwn(obj, key) || !isEqual(obj[key], spec[key])) return false;
    }
    return true;
  };
}

export function project<T extends object, K extends keyof T>(
  selectedKeys: readonly K[],
  list: readonly T[],
): Pick<T, K>[] {
  return list.map((item) => pick(item, selectedKeys));
}

export type Evolver<T> = {
  readonly [K in keyof T]?: T[K] extends BuiltinLeaf
    ? (value: T[K]) => T[K]
    : T[K] extends object
      ? ((value: T[K]) => T[K]) | Evolver<T[K]>
      : (value: T[K]) => T[K];
};
export type EvolutionMap<T> = Evolver<T>;

export function evolve<T extends object>(transformations: Evolver<T>, target: T): T {
  const out: Record<string, unknown> = { ...(target as Record<string, unknown>) };
  const targetRec = target as Record<string, unknown>;
  for (const key of Object.keys(targetRec)) {
    const spec = (transformations as Record<string, unknown>)[key];
    const current = targetRec[key];
    if (typeof spec === 'function') {
      out[key] = (spec as (v: unknown) => unknown)(current);
    } else if (isPlainObject(spec) && isPlainObject(current)) {
      out[key] = evolve(spec as Evolver<Record<string, unknown>>, current);
    }
  }
  return out as T;
}

export interface Lens<S, A> {
  readonly get: (source: S) => A;
  readonly set: (value: A, source: S) => S;
}

export function lens<S, A>(
  getter: (source: S) => A,
  setter: (value: A, source: S) => S,
): Lens<S, A> {
  return Object.freeze({ get: getter, set: setter });
}

export function lensProp<S extends object, K extends keyof S & string>(key: K): Lens<S, S[K]> {
  return lens(
    (source: S): S[K] => source[key],
    (value: S[K], source: S): S => ({ ...source, [key]: value }),
  );
}

export function lensPath<S, A = unknown>(pathInput: PropertyPath): Lens<S, A | undefined> {
  const segments = toPath(pathInput);
  return lens(
    (source: S): A | undefined => get<A>(source, segments),
    (value: A | undefined, source: S): S => assocPath(segments, value, source),
  );
}

export function lensIndex<T>(index: number): Lens<readonly T[], Option<T>> {
  return lens(
    (items: readonly T[]): Option<T> =>
      index >= 0 && index < items.length ? some(items[index]!) : none(),
    (value: Option<T>, items: readonly T[]): readonly T[] => {
      if (index < 0 || index >= items.length || value.tag === 'none') return items;
      return items.with(index, value.value);
    },
  );
}

export function composeLens<S, A, B>(outer: Lens<S, A>, inner: Lens<A, B>): Lens<S, B> {
  return lens(
    (source: S): B => inner.get(outer.get(source)),
    (value: B, source: S): S => outer.set(inner.set(value, outer.get(source)), source),
  );
}

export function view<S, A>(optic: Lens<S, A>, source: S): A {
  return optic.get(source);
}

export function setLens<S, A>(optic: Lens<S, A>, value: A, source: S): S {
  return optic.set(value, source);
}

export function over<S, A>(optic: Lens<S, A>, fn: (value: A) => A, source: S): S {
  return optic.set(fn(optic.get(source)), source);
}

export function freezeDeep<T>(
  value: T,
  seen: WeakSet<object> = new WeakSet<object>(),
): Readonly<T> {
  if (typeof value !== 'object' || value === null) return value;
  if (seen.has(value as object)) return value;
  seen.add(value as object);
  Object.freeze(value);
  for (const key of Reflect.ownKeys(value as object)) {
    const child = (value as Record<PropertyKey, unknown>)[key];
    freezeDeep(child, seen);
  }
  return value;
}
