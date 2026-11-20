import { isEqual, none, some, type Option } from './core.ts';

export function chunk<T>(array: readonly T[], size: number): T[][] {
  if (size < 1 || !Number.isFinite(size)) return [];
  const step = Math.floor(size);
  const len = array.length;
  if (len === 0) return [];
  const result: T[][] = new Array(Math.ceil(len / step));
  let outIdx = 0;
  for (let i = 0; i < len; i += step) {
    result[outIdx++] = array.slice(i, i + step);
  }
  return result;
}

export const splitEvery: typeof chunk = chunk;

export type Falsy = false | 0 | -0 | 0n | '' | null | undefined;

export function compact<T>(array: readonly T[]): Exclude<T, Falsy>[] {
  const result: Exclude<T, Falsy>[] = [];
  for (const item of array) {
    if (item) {
      result.push(item as Exclude<T, Falsy>);
    }
  }
  return result;
}

export function concat<T>(...arrays: readonly (readonly T[] | T)[]): T[] {
  const result: T[] = [];
  for (const entry of arrays) {
    if (Array.isArray(entry)) {
      for (const item of entry) {
        result.push(item as T);
      }
    } else {
      result.push(entry as T);
    }
  }
  return result;
}

export function difference<T>(array: readonly T[], ...values: readonly (readonly T[])[]): T[] {
  const exclude = new Set<T>();
  for (const group of values) {
    for (const item of group) {
      exclude.add(item);
    }
  }
  return array.filter((item) => !exclude.has(item));
}

export function differenceBy<T, K>(
  array: readonly T[],
  values: readonly T[],
  iteratee: (item: T) => K,
): T[] {
  const excludeKeys = new Set<K>(values.map(iteratee));
  return array.filter((item) => !excludeKeys.has(iteratee(item)));
}

export function differenceWith<T>(
  array: readonly T[],
  values: readonly T[],
  comparator: (a: T, b: T) => boolean = isEqual,
): T[] {
  return array.filter((item) => !values.some((other) => comparator(item, other)));
}

export function drop<T>(array: readonly T[], n = 1): T[] {
  return array.slice(Math.max(0, Math.floor(n)));
}

export function dropRight<T>(array: readonly T[], n = 1): T[] {
  const count = Math.max(0, Math.floor(n));
  return count >= array.length ? [] : array.slice(0, array.length - count);
}

export function dropWhile<T>(
  array: readonly T[],
  predicate: (item: T, index: number) => boolean,
): T[] {
  let start = 0;
  while (start < array.length && predicate(array[start]!, start)) {
    start++;
  }
  return array.slice(start);
}

export function dropRightWhile<T>(
  array: readonly T[],
  predicate: (item: T, index: number) => boolean,
): T[] {
  let end = array.length;
  while (end > 0 && predicate(array[end - 1]!, end - 1)) {
    end--;
  }
  return array.slice(0, end);
}

export function take<T>(array: readonly T[], n = 1): T[] {
  return array.slice(0, Math.max(0, Math.floor(n)));
}

export function takeRight<T>(array: readonly T[], n = 1): T[] {
  const count = Math.max(0, Math.floor(n));
  if (count === 0) return [];
  return array.slice(Math.max(0, array.length - count));
}

export function takeWhile<T>(
  array: readonly T[],
  predicate: (item: T, index: number) => boolean,
): T[] {
  let end = 0;
  while (end < array.length && predicate(array[end]!, end)) {
    end++;
  }
  return array.slice(0, end);
}

export function takeRightWhile<T>(
  array: readonly T[],
  predicate: (item: T, index: number) => boolean,
): T[] {
  let start = array.length;
  while (start > 0 && predicate(array[start - 1]!, start - 1)) {
    start--;
  }
  return array.slice(start);
}

export function head<T>(array: readonly T[]): T | undefined {
  return array.at(0);
}
export const first: typeof head = head;

export function headOption<T>(array: readonly T[]): Option<T> {
  return array.length > 0 ? some(array[0]!) : none();
}

export function last<T>(array: readonly T[]): T | undefined {
  return array.at(-1);
}

export function lastOption<T>(array: readonly T[]): Option<T> {
  return array.length > 0 ? some(array[array.length - 1]!) : none();
}

export function tail<T>(array: readonly T[]): T[] {
  return array.slice(1);
}
export const rest: typeof tail = tail;

export function initial<T>(array: readonly T[]): T[] {
  return array.length <= 1 ? [] : array.slice(0, -1);
}
export const init: typeof initial = initial;

export function nth<T>(array: readonly T[], index: number): T | undefined {
  return array.at(index);
}

export function nthOption<T>(array: readonly T[], index: number): Option<T> {
  const resolved = index < 0 ? array.length + index : index;
  if (resolved < 0 || resolved >= array.length) return none();
  return some(array[resolved]!);
}

export function reverse<T>(array: readonly T[]): T[] {
  return array.toReversed();
}

export function flatten<T>(array: readonly (readonly T[] | T)[]): T[] {
  return array.flat(1) as T[];
}
export const unnest: typeof flatten = flatten;

export function flattenDeep<T = unknown>(array: readonly unknown[]): T[] {
  const result: T[] = [];
  const stack: unknown[] = array.toReversed();
  while (stack.length > 0) {
    const current = stack.pop();
    if (Array.isArray(current)) {
      for (let i = current.length - 1; i >= 0; i--) {
        stack.push(current[i]);
      }
    } else {
      result.push(current as T);
    }
  }
  return result;
}

export function flattenDepth(array: readonly unknown[], depth = 1): unknown[] {
  if (depth < 1) return array.slice();
  return array.flat(Math.floor(depth));
}

export function fromPairs<K extends PropertyKey, V>(
  pairs: readonly (readonly [K, V])[],
): Record<K, V> {
  return Object.fromEntries(pairs) as Record<K, V>;
}

export function toPairs<T extends Record<string, unknown>>(
  obj: T,
): [keyof T & string, T[keyof T & string]][] {
  return Object.entries(obj) as [keyof T & string, T[keyof T & string]][];
}

export function intersection<T>(...arrays: readonly (readonly T[])[]): T[] {
  if (arrays.length === 0) return [];
  const firstArr = arrays[0]!;
  if (firstArr.length === 0) return [];
  const otherSets = arrays.slice(1).map((arr) => new Set<T>(arr));
  const seen = new Set<T>();
  const result: T[] = [];
  for (const item of firstArr) {
    if (seen.has(item)) continue;
    if (otherSets.every((s) => s.has(item))) {
      seen.add(item);
      result.push(item);
    }
  }
  return result;
}

export function intersectionBy<T, K>(
  a: readonly T[],
  b: readonly T[],
  iteratee: (item: T) => K,
): T[] {
  const bKeys = new Set<K>(b.map(iteratee));
  const seen = new Set<K>();
  const result: T[] = [];
  for (const item of a) {
    const key = iteratee(item);
    if (bKeys.has(key) && !seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

export function union<T>(...arrays: readonly (readonly T[])[]): T[] {
  const seen = new Set<T>();
  const result: T[] = [];
  for (const arr of arrays) {
    for (const item of arr) {
      if (!seen.has(item)) {
        seen.add(item);
        result.push(item);
      }
    }
  }
  return result;
}

export function unionBy<T, K>(a: readonly T[], b: readonly T[], iteratee: (item: T) => K): T[] {
  return uniqBy([...a, ...b], iteratee);
}

export function uniq<T>(array: readonly T[]): T[] {
  return Array.from(new Set(array));
}

export function uniqBy<T, K>(array: readonly T[], iteratee: (item: T) => K): T[] {
  const seen = new Set<K>();
  const result: T[] = [];
  for (const item of array) {
    const key = iteratee(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

export function uniqWith<T>(
  array: readonly T[],
  comparator: (a: T, b: T) => boolean = isEqual,
): T[] {
  const result: T[] = [];
  for (const item of array) {
    if (!result.some((existing) => comparator(item, existing))) {
      result.push(item);
    }
  }
  return result;
}

export function without<T>(array: readonly T[], ...values: readonly T[]): T[] {
  return difference(array, values);
}

export function xor<T>(...arrays: readonly (readonly T[])[]): T[] {
  const counts = new Map<T, number>();
  for (const arr of arrays) {
    for (const item of new Set<T>(arr)) {
      counts.set(item, (counts.get(item) ?? 0) + 1);
    }
  }
  const result: T[] = [];
  for (const [item, count] of counts.entries()) {
    if (count === 1) result.push(item);
  }
  return result;
}

export function zip<T extends readonly (readonly unknown[])[]>(
  ...arrays: T
): { [K in keyof T]: T[K] extends readonly (infer U)[] ? U | undefined : never }[] {
  if (arrays.length === 0) return [];
  let maxLen = 0;
  for (const arr of arrays) {
    if (arr.length > maxLen) maxLen = arr.length;
  }
  const result: unknown[][] = new Array(maxLen);
  for (let i = 0; i < maxLen; i++) {
    const tuple: unknown[] = new Array(arrays.length);
    for (let j = 0; j < arrays.length; j++) {
      tuple[j] = arrays[j]![i];
    }
    result[i] = tuple;
  }
  return result as { [K in keyof T]: T[K] extends readonly (infer U)[] ? U | undefined : never }[];
}

export function zipObject<K extends PropertyKey, V>(
  keys: readonly K[],
  values: readonly V[],
): Record<K, V | undefined> {
  const result = {} as Record<K, V | undefined>;
  for (let i = 0; i < keys.length; i++) {
    result[keys[i]!] = values[i];
  }
  return result;
}

export function zipWith<A, B, R>(
  a: readonly A[],
  b: readonly B[],
  combiner: (left: A, right: B) => R,
): R[] {
  const len = Math.min(a.length, b.length);
  const result: R[] = new Array(len);
  for (let i = 0; i < len; i++) {
    result[i] = combiner(a[i]!, b[i]!);
  }
  return result;
}

export function unzip<T>(matrix: readonly (readonly T[])[]): (T | undefined)[][] {
  if (matrix.length === 0) return [];
  return zip(...matrix);
}

export function partition<T, S extends T>(
  array: readonly T[],
  predicate: (item: T, index: number) => item is S,
): [S[], Exclude<T, S>[]];
export function partition<T>(
  array: readonly T[],
  predicate: (item: T, index: number) => boolean,
): [T[], T[]];
export function partition<T>(
  array: readonly T[],
  predicate: (item: T, index: number) => boolean,
): [T[], T[]] {
  const pass: T[] = [];
  const fail: T[] = [];
  for (let i = 0; i < array.length; i++) {
    const item = array[i]!;
    if (predicate(item, i)) {
      pass.push(item);
    } else {
      fail.push(item);
    }
  }
  return [pass, fail];
}

export function groupBy<T, K extends PropertyKey>(
  array: readonly T[],
  keyFn: (item: T, index: number) => K,
): Partial<Record<K, T[]>> {
  const grouped = Object.groupBy(array, keyFn);
  return Object.assign({}, grouped) as Partial<Record<K, T[]>>;
}

export function groupByMap<T, K>(
  array: readonly T[],
  keyFn: (item: T, index: number) => K,
): Map<K, T[]> {
  return Map.groupBy(array, keyFn);
}

export function keyBy<T, K extends PropertyKey>(
  array: readonly T[],
  keyFn: (item: T, index: number) => K,
): Record<K, T> {
  const out = {} as Record<K, T>;
  for (let i = 0; i < array.length; i++) {
    const item = array[i]!;
    out[keyFn(item, i)] = item;
  }
  return out;
}
export const indexBy: typeof keyBy = keyBy;

export function countBy<T, K extends PropertyKey>(
  array: readonly T[],
  keyFn: (item: T, index: number) => K,
): Record<K, number> {
  const out = {} as Record<K, number>;
  for (let i = 0; i < array.length; i++) {
    const key = keyFn(array[i]!, i);
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

export type SortOrder = 'asc' | 'desc';

export function sortBy<T, K extends number | string | bigint>(
  array: readonly T[],
  keyFn: (item: T) => K,
): T[] {
  return array
    .map((item, idx) => ({ item, key: keyFn(item), idx }))
    .toSorted((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.idx - b.idx))
    .map((entry) => entry.item);
}

export function orderBy<T>(
  array: readonly T[],
  iteratees: readonly ((item: T) => number | string | bigint)[],
  orders: readonly SortOrder[] = [],
): T[] {
  return array
    .map((item, idx) => ({ item, keys: iteratees.map((fn) => fn(item)), idx }))
    .toSorted((a, b) => {
      for (let i = 0; i < iteratees.length; i++) {
        const ka = a.keys[i]!;
        const kb = b.keys[i]!;
        if (ka !== kb) {
          const dir = orders[i] === 'desc' ? -1 : 1;
          return ka < kb ? -dir : dir;
        }
      }
      return a.idx - b.idx;
    })
    .map((d) => d.item);
}

export function range(start: number, end?: number, step?: number): number[] {
  const actualStart = end === undefined ? 0 : start;
  const actualEnd = end === undefined ? start : end;
  const actualStep = step ?? (actualStart < actualEnd ? 1 : -1);
  if (actualStep === 0) return [];
  const length = Math.max(Math.ceil((actualEnd - actualStart) / actualStep), 0);
  const result: number[] = new Array(length);
  for (let i = 0; i < length; i++) {
    result[i] = actualStart + i * actualStep;
  }
  return result;
}

export function times<T>(n: number, iteratee: (index: number) => T): T[] {
  const count = Math.max(0, Math.floor(n));
  const result: T[] = new Array(count);
  for (let i = 0; i < count; i++) {
    result[i] = iteratee(i);
  }
  return result;
}

export function aperture<T>(n: number, array: readonly T[]): T[][] {
  const size = Math.floor(n);
  if (size <= 0 || size > array.length) return [];
  const count = array.length - size + 1;
  const result: T[][] = new Array(count);
  for (let i = 0; i < count; i++) {
    result[i] = array.slice(i, i + size);
  }
  return result;
}

export function splitAt<T>(index: number, array: readonly T[]): [T[], T[]] {
  const resolved = index < 0 ? Math.max(0, array.length + index) : Math.min(array.length, index);
  return [array.slice(0, resolved), array.slice(resolved)];
}

export function splitWhen<T>(predicate: (item: T) => boolean, array: readonly T[]): [T[], T[]] {
  let idx = 0;
  while (idx < array.length && !predicate(array[idx]!)) {
    idx++;
  }
  return [array.slice(0, idx), array.slice(idx)];
}

export function intersperse<T>(separator: T, array: readonly T[]): T[] {
  if (array.length <= 1) return array.slice();
  const result: T[] = new Array(array.length * 2 - 1);
  for (let i = 0; i < array.length; i++) {
    result[i * 2] = array[i]!;
    if (i < array.length - 1) {
      result[i * 2 + 1] = separator;
    }
  }
  return result;
}

export function insert<T>(index: number, element: T, array: readonly T[]): T[] {
  const idx = index < 0 ? array.length : Math.min(index, array.length);
  return array.toSpliced(idx, 0, element);
}

export function remove<T>(start: number, count: number, array: readonly T[]): T[] {
  return array.toSpliced(Math.max(0, start), Math.max(0, count));
}

export function update<T>(index: number, value: T, array: readonly T[]): T[] {
  const resolved = index < 0 ? array.length + index : index;
  if (resolved < 0 || resolved >= array.length) return array.slice();
  return array.with(resolved, value);
}

export function adjust<T>(index: number, fn: (item: T) => T, array: readonly T[]): T[] {
  const resolved = index < 0 ? array.length + index : index;
  if (resolved < 0 || resolved >= array.length) return array.slice();
  return array.with(resolved, fn(array[resolved]!));
}

export function move<T>(fromIndex: number, toIndex: number, array: readonly T[]): T[] {
  const len = array.length;
  const from = fromIndex < 0 ? len + fromIndex : fromIndex;
  const to = toIndex < 0 ? len + toIndex : toIndex;
  if (from < 0 || from >= len || to < 0 || to >= len) return array.slice();
  const item = array[from]!;
  return array.toSpliced(from, 1).toSpliced(to, 0, item);
}

export function append<T>(value: T, array: readonly T[]): T[] {
  return [...array, value];
}

export function prepend<T>(value: T, array: readonly T[]): T[] {
  return [value, ...array];
}

export function xprod<A, B>(a: readonly A[], b: readonly B[]): [A, B][] {
  const result: [A, B][] = new Array(a.length * b.length);
  let k = 0;
  for (const left of a) {
    for (const right of b) {
      result[k++] = [left, right];
    }
  }
  return result;
}

export function transpose<T>(matrix: readonly (readonly T[])[]): T[][] {
  let maxCols = 0;
  for (const row of matrix) {
    if (row.length > maxCols) maxCols = row.length;
  }
  const result: T[][] = [];
  for (let c = 0; c < maxCols; c++) {
    const col: T[] = [];
    for (const row of matrix) {
      if (c < row.length) col.push(row[c]!);
    }
    result.push(col);
  }
  return result;
}

export function scan<T, Acc>(
  reducer: (acc: Acc, value: T) => Acc,
  initialValue: Acc,
  array: readonly T[],
): Acc[] {
  const result: Acc[] = new Array(array.length + 1);
  let acc = initialValue;
  result[0] = acc;
  for (let i = 0; i < array.length; i++) {
    acc = reducer(acc, array[i]!);
    result[i + 1] = acc;
  }
  return result;
}

export function mapAccum<Acc, T, U>(
  fn: (acc: Acc, value: T) => readonly [Acc, U],
  initialAcc: Acc,
  array: readonly T[],
): [Acc, U[]] {
  let acc = initialAcc;
  const mapped: U[] = new Array(array.length);
  for (let i = 0; i < array.length; i++) {
    const [nextAcc, out] = fn(acc, array[i]!);
    acc = nextAcc;
    mapped[i] = out;
  }
  return [acc, mapped];
}

export function pluck<T, K extends keyof T>(key: K, array: readonly T[]): T[K][] {
  return array.map((item) => item[key]);
}

export function shuffle<T>(array: readonly T[], random: () => number = Math.random): T[] {
  const copy = array.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy;
}

export function sample<T>(array: readonly T[], random: () => number = Math.random): Option<T> {
  if (array.length === 0) return none();
  return some(array[Math.floor(random() * array.length)]!);
}

export function sampleSize<T>(
  array: readonly T[],
  n: number,
  random: () => number = Math.random,
): T[] {
  const count = Math.max(0, Math.min(Math.floor(n), array.length));
  if (count === 0) return [];
  return shuffle(array, random).slice(0, count);
}
