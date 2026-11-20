import {
  assertNever,
  cont,
  doneStep,
  isReduced,
  none,
  reduced,
  some,
  unreduced,
  type Option,
  type Reduced,
  type StepResult,
} from './core.ts';

export function map<T, U>(array: readonly T[], fn: (item: T, index: number) => U): U[] {
  return array.map(fn);
}

export function filter<T, S extends T>(
  array: readonly T[],
  predicate: (item: T, index: number) => item is S,
): S[];
export function filter<T>(array: readonly T[], predicate: (item: T, index: number) => boolean): T[];
export function filter<T>(
  array: readonly T[],
  predicate: (item: T, index: number) => boolean,
): T[] {
  return array.filter(predicate);
}

export function reject<T>(
  array: readonly T[],
  predicate: (item: T, index: number) => boolean,
): T[] {
  return array.filter((item, idx) => !predicate(item, idx));
}

export function reduce<T, Acc>(
  array: readonly T[],
  reducer: (acc: Acc, item: T, index: number) => Acc | Reduced<Acc>,
  initialValue: Acc,
): Acc {
  let acc = initialValue;
  for (let i = 0; i < array.length; i++) {
    const next = reducer(acc, array[i]!, i);
    if (isReduced(next)) return next.value;
    acc = next;
  }
  return acc;
}

export function reduceRight<T, Acc>(
  array: readonly T[],
  reducer: (acc: Acc, item: T, index: number) => Acc | Reduced<Acc>,
  initialValue: Acc,
): Acc {
  let acc = initialValue;
  for (let i = array.length - 1; i >= 0; i--) {
    const next = reducer(acc, array[i]!, i);
    if (isReduced(next)) return next.value;
    acc = next;
  }
  return acc;
}

export function flatMap<T, U>(
  array: readonly T[],
  fn: (item: T, index: number) => readonly U[],
): U[] {
  return array.flatMap((item, idx) => fn(item, idx));
}
export const chain: typeof flatMap = flatMap;

export function find<T>(
  array: readonly T[],
  predicate: (item: T, index: number) => boolean,
): Option<T> {
  for (let i = 0; i < array.length; i++) {
    const item = array[i]!;
    if (predicate(item, i)) return some(item);
  }
  return none();
}

export function findLast<T>(
  array: readonly T[],
  predicate: (item: T, index: number) => boolean,
): Option<T> {
  const idx = array.findLastIndex(predicate);
  return idx === -1 ? none() : some(array[idx]!);
}

export function every<T>(
  array: readonly T[],
  predicate: (item: T, index: number) => boolean,
): boolean {
  return array.every(predicate);
}
export const all: typeof every = every;

export function someMatch<T>(
  array: readonly T[],
  predicate: (item: T, index: number) => boolean,
): boolean {
  return array.some(predicate);
}
export const any: typeof someMatch = someMatch;

export function noneMatch<T>(
  array: readonly T[],
  predicate: (item: T, index: number) => boolean,
): boolean {
  return !array.some(predicate);
}

export function includes<T>(array: readonly T[], target: T): boolean {
  return array.includes(target);
}
export const contains: typeof includes = includes;

export function size(
  collection:
    | readonly unknown[]
    | string
    | ReadonlyMap<unknown, unknown>
    | ReadonlySet<unknown>
    | Readonly<Record<string, unknown>>,
): number {
  if (typeof collection === 'string' || Array.isArray(collection)) return collection.length;
  if (collection instanceof Map || collection instanceof Set) return collection.size;
  return Object.keys(collection).length;
}

export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' || Array.isArray(value)) return value.length === 0;
  if (value instanceof Map || value instanceof Set) return value.size === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return true;
}

export function sum(numbers: readonly number[]): number {
  let total = 0;
  for (const n of numbers) total += n;
  return total;
}

export function sumBy<T>(items: readonly T[], selector: (item: T) => number): number {
  let total = 0;
  for (const item of items) total += selector(item);
  return total;
}

export function product(numbers: readonly number[]): number {
  let acc = 1;
  for (const n of numbers) acc *= n;
  return acc;
}

export function mean(numbers: readonly number[]): Option<number> {
  if (numbers.length === 0) return none();
  return some(sum(numbers) / numbers.length);
}

export function meanBy<T>(items: readonly T[], selector: (item: T) => number): Option<number> {
  if (items.length === 0) return none();
  return some(sumBy(items, selector) / items.length);
}

export function median(numbers: readonly number[]): Option<number> {
  if (numbers.length === 0) return none();
  const sorted = numbers.toSorted((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return some(sorted[mid]!);
  return some((sorted[mid - 1]! + sorted[mid]!) / 2);
}

export function min(numbers: readonly number[]): Option<number> {
  if (numbers.length === 0) return none();
  let current = numbers[0]!;
  for (let i = 1; i < numbers.length; i++) {
    const val = numbers[i]!;
    if (val < current) current = val;
  }
  return some(current);
}

export function max(numbers: readonly number[]): Option<number> {
  if (numbers.length === 0) return none();
  let current = numbers[0]!;
  for (let i = 1; i < numbers.length; i++) {
    const val = numbers[i]!;
    if (val > current) current = val;
  }
  return some(current);
}

export function minBy<T>(items: readonly T[], selector: (item: T) => number): Option<T> {
  if (items.length === 0) return none();
  let best = items[0]!;
  let bestKey = selector(best);
  for (let i = 1; i < items.length; i++) {
    const candidate = items[i]!;
    const key = selector(candidate);
    if (key < bestKey) {
      best = candidate;
      bestKey = key;
    }
  }
  return some(best);
}

export function maxBy<T>(items: readonly T[], selector: (item: T) => number): Option<T> {
  if (items.length === 0) return none();
  let best = items[0]!;
  let bestKey = selector(best);
  for (let i = 1; i < items.length; i++) {
    const candidate = items[i]!;
    const key = selector(candidate);
    if (key > bestKey) {
      best = candidate;
      bestKey = key;
    }
  }
  return some(best);
}

export type StepReducer<Acc, Input> = (acc: Acc, input: Input) => Acc | Reduced<Acc>;
export type Transducer<In, Out> = <Acc>(next: StepReducer<Acc, Out>) => StepReducer<Acc, In>;

export type AdtReducer<Acc, Input> = (acc: Acc, input: Input) => StepResult<Acc>;
export type AdtTransducer<In, Out> = <Acc>(next: AdtReducer<Acc, Out>) => AdtReducer<Acc, In>;

export function mapT<A, B>(fn: (value: A) => B): Transducer<A, B> {
  return <Acc>(next: StepReducer<Acc, B>): StepReducer<Acc, A> =>
    (acc, input) =>
      next(acc, fn(input));
}

export function filterT<A>(predicate: (value: A) => boolean): Transducer<A, A> {
  return <Acc>(next: StepReducer<Acc, A>): StepReducer<Acc, A> =>
    (acc, input) =>
      predicate(input) ? next(acc, input) : acc;
}

export function takeT<A>(limit: number): Transducer<A, A> {
  const maxItems = Math.max(0, Math.floor(limit));
  return <Acc>(next: StepReducer<Acc, A>): StepReducer<Acc, A> => {
    let taken = 0;
    return (acc, input) => {
      if (maxItems === 0) return reduced(acc);
      taken++;
      const res = next(acc, input);
      if (taken >= maxItems) {
        return isReduced(res) ? res : reduced(res);
      }
      return res;
    };
  };
}

export function dropT<A>(count: number): Transducer<A, A> {
  const toSkip = Math.max(0, Math.floor(count));
  return <Acc>(next: StepReducer<Acc, A>): StepReducer<Acc, A> => {
    let skipped = 0;
    return (acc, input) => {
      if (skipped < toSkip) {
        skipped++;
        return acc;
      }
      return next(acc, input);
    };
  };
}

export function flatMapT<A, B>(fn: (value: A) => readonly B[]): Transducer<A, B> {
  return <Acc>(next: StepReducer<Acc, B>): StepReducer<Acc, A> =>
    (acc, input) => {
      const items = fn(input);
      let current: Acc | Reduced<Acc> = acc;
      for (const item of items) {
        current = next(unreduced(current), item);
        if (isReduced(current)) return current;
      }
      return current;
    };
}

export function dedupeT<A>(equalsFn: (a: A, b: A) => boolean = Object.is): Transducer<A, A> {
  type PrevState = { readonly tag: 'empty' } | { readonly tag: 'has'; readonly value: A };
  return <Acc>(next: StepReducer<Acc, A>): StepReducer<Acc, A> => {
    let prev: PrevState = { tag: 'empty' };
    return (acc, input) => {
      if (prev.tag === 'has' && equalsFn(prev.value, input)) {
        return acc;
      }
      prev = { tag: 'has', value: input };
      return next(acc, input);
    };
  };
}

export function composeTransducers<A, B>(t1: Transducer<A, B>): Transducer<A, B>;
export function composeTransducers<A, B, C>(
  t1: Transducer<A, B>,
  t2: Transducer<B, C>,
): Transducer<A, C>;
export function composeTransducers<A, B, C, D>(
  t1: Transducer<A, B>,
  t2: Transducer<B, C>,
  t3: Transducer<C, D>,
): Transducer<A, D>;
export function composeTransducers<A, B, C, D, E>(
  t1: Transducer<A, B>,
  t2: Transducer<B, C>,
  t3: Transducer<C, D>,
  t4: Transducer<D, E>,
): Transducer<A, E>;
export function composeTransducers(
  ...transducers: readonly Transducer<unknown, unknown>[]
): Transducer<unknown, unknown> {
  return <Acc>(next: StepReducer<Acc, unknown>): StepReducer<Acc, unknown> => {
    let step = next;
    for (let i = transducers.length - 1; i >= 0; i--) {
      step = transducers[i]!(step);
    }
    return step;
  };
}

export function transduce<In, Out, Acc>(
  xf: Transducer<In, Out>,
  reducer: StepReducer<Acc, Out>,
  initialValue: Acc,
  iterable: Iterable<In>,
): Acc {
  const step = xf(reducer);
  let acc = initialValue;
  for (const item of iterable) {
    const next = step(acc, item);
    if (isReduced(next)) return next.value;
    acc = next;
  }
  return acc;
}

export function transduceAdt<In, Out, Acc>(
  xf: AdtTransducer<In, Out>,
  reducer: AdtReducer<Acc, Out>,
  initialValue: Acc,
  iterable: Iterable<In>,
): Acc {
  const step = xf(reducer);
  let acc = initialValue;
  for (const item of iterable) {
    const res = step(acc, item);
    switch (res.status) {
      case 'continue':
        acc = res.value;
        break;
      case 'reduced':
        return res.value;
      default:
        return assertNever(res);
    }
  }
  return acc;
}

export function intoArray<In, Out>(xf: Transducer<In, Out>, iterable: Iterable<In>): Out[] {
  return transduce<In, Out, Out[]>(
    xf,
    (acc, value) => {
      acc.push(value);
      return acc;
    },
    [],
    iterable,
  );
}

export { cont, doneStep };

export class LazySeq<T> implements Iterable<T> {
  private readonly factory: () => Iterator<T>;

  public constructor(source: Iterable<T> | (() => Iterator<T>)) {
    this.factory =
      typeof source === 'function' ? source : (): Iterator<T> => source[Symbol.iterator]();
  }

  public [Symbol.iterator](): Iterator<T> {
    return this.factory();
  }

  public map<U>(fn: (item: T, index: number) => U): LazySeq<U> {
    const upstream = this.factory;
    return new LazySeq<U>(function* () {
      let i = 0;
      const iter = upstream();
      while (true) {
        const step = iter.next();
        if (step.done) return;
        yield fn(step.value, i++);
      }
    });
  }

  public filter(predicate: (item: T, index: number) => boolean): LazySeq<T> {
    const upstream = this.factory;
    return new LazySeq<T>(function* () {
      let i = 0;
      const iter = upstream();
      while (true) {
        const step = iter.next();
        if (step.done) return;
        if (predicate(step.value, i++)) yield step.value;
      }
    });
  }

  public flatMap<U>(fn: (item: T, index: number) => Iterable<U>): LazySeq<U> {
    const upstream = this.factory;
    return new LazySeq<U>(function* () {
      let i = 0;
      const iter = upstream();
      while (true) {
        const step = iter.next();
        if (step.done) return;
        yield* fn(step.value, i++);
      }
    });
  }

  public take(count: number): LazySeq<T> {
    const limit = Math.max(0, Math.floor(count));
    const upstream = this.factory;
    return new LazySeq<T>(function* () {
      if (limit === 0) return;
      let yielded = 0;
      const iter = upstream();
      while (yielded < limit) {
        const step = iter.next();
        if (step.done) return;
        yield step.value;
        yielded++;
      }
    });
  }

  public drop(count: number): LazySeq<T> {
    const skip = Math.max(0, Math.floor(count));
    const upstream = this.factory;
    return new LazySeq<T>(function* () {
      let skipped = 0;
      const iter = upstream();
      while (true) {
        const step = iter.next();
        if (step.done) return;
        if (skipped < skip) {
          skipped++;
          continue;
        }
        yield step.value;
      }
    });
  }

  public reduce<Acc>(reducer: (acc: Acc, value: T, index: number) => Acc, initialValue: Acc): Acc {
    let acc = initialValue;
    let i = 0;
    for (const item of this) {
      acc = reducer(acc, item, i++);
    }
    return acc;
  }

  public toArray(): T[] {
    return Array.from(this);
  }

  public first(): Option<T> {
    const iter = this.factory();
    const step = iter.next();
    return step.done ? none() : some(step.value);
  }
}

export function lazy<T>(source: Iterable<T>): LazySeq<T> {
  return new LazySeq(source);
}
