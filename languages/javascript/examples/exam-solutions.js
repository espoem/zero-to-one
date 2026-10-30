// Reference solutions for the hands-on tasks in exams/interview.md.
// To check your own solutions, export the same names from a file and run:
//   SOLUTIONS=./path/to/your-solutions.js node --test examples/exam-hands-on.test.js
// (the path is resolved relative to this examples/ directory).
export { promiseAll, mapWithConcurrency, debounce } from './07-async-utils.ts';

/** H4: Function.prototype.bind without using bind. */
export function myBind(fn, thisArg, ...bound) {
  if (typeof fn !== 'function') throw new TypeError('myBind target must be callable');
  function boundFn(...args) {
    return new.target
      ? Reflect.construct(fn, [...bound, ...args], new.target === boundFn ? fn : new.target)
      : fn.apply(thisArg, [...bound, ...args]);
  }
  Object.defineProperty(boundFn, 'name', { value: `bound ${fn.name}` });
  Object.defineProperty(boundFn, 'length', { value: Math.max(0, fn.length - bound.length) });
  boundFn.prototype = fn.prototype; // so that instanceof works for `new boundFn()`
  return boundFn;
}

/** H5: deep clone supporting cycles, shared references, arrays, plain objects, Map, Set and Date. */
export function deepClone(value, seen = new Map()) {
  if (typeof value !== 'object' || value === null) return value;
  if (seen.has(value)) return seen.get(value);
  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof Map) {
    const out = new Map();
    seen.set(value, out);
    for (const [k, v] of value) out.set(deepClone(k, seen), deepClone(v, seen));
    return out;
  }
  if (value instanceof Set) {
    const out = new Set();
    seen.set(value, out);
    for (const v of value) out.add(deepClone(v, seen));
    return out;
  }
  const out = Array.isArray(value) ? [] : Object.create(Object.getPrototypeOf(value));
  seen.set(value, out);
  for (const key of Reflect.ownKeys(value)) {
    const desc = /** @type {PropertyDescriptor} */ (Object.getOwnPropertyDescriptor(value, key));
    if ('value' in desc) desc.value = deepClone(desc.value, seen);
    Object.defineProperty(out, key, desc);
  }
  return out;
}

/** H6: a microtask-batched signal store (minimal reactive primitive). */
export function createSignal(initial) {
  let value = initial;
  const subscribers = new Set();
  let scheduled = false;
  const flush = () => { scheduled = false; for (const fn of [...subscribers]) fn(value); };
  return {
    get: () => value,
    set(next) {
      if (Object.is(next, value)) return;           // SameValue: no notification for equal values
      value = next;
      if (!scheduled) { scheduled = true; queueMicrotask(flush); }
    },
    subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); },
  };
}
