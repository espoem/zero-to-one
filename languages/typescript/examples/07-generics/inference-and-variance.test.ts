/**
 * Module 07 — Inference sites, const type parameters, NoInfer, variance annotations,
 * partial inference and the "useless generic".
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { expectTypeOf } from "expect-type";

test("inference picks a best common candidate from all inference sites", () => {
  function pair<T>(a: T, b: T): [T, T] {
    return [a, b];
  }
  expectTypeOf(pair(1, 2)).toEqualTypeOf<[number, number]>();
  // @ts-expect-error — candidates number and string have no common supertype among them
  pair(1, "x");
  expectTypeOf(pair<number | string>(1, "x")).toEqualTypeOf<[string | number, string | number]>();
});

test("const type parameters keep literal and tuple types", () => {
  const plain = <T,>(x: T) => x;
  const exact = <const T,>(x: T) => x;
  expectTypeOf(plain(["a", "b"])).toEqualTypeOf<string[]>();
  expectTypeOf(exact(["a", "b"])).toEqualTypeOf<readonly ["a", "b"]>();
  assert.deepEqual(exact(["a", "b"]), ["a", "b"]);
});

test("NoInfer removes an inference site", () => {
  function machine<S extends string>(states: S[], initial: NoInfer<S>) {
    return { states, current: initial };
  }
  const m = machine(["idle", "busy"], "idle");
  expectTypeOf(m.current).toEqualTypeOf<"idle" | "busy">();
  // @ts-expect-error — without NoInfer, "done" would have widened S instead of erroring
  machine(["idle", "busy"], "done");
});

test("contextually sensitive arguments are inferred in a second pass", () => {
  function make<T>(factory: () => T, consume: (value: T) => string): string {
    return consume(factory());
  }
  // T is fixed from `factory` first, then `consume`'s parameter is typed contextually.
  assert.equal(make(() => ({ n: 2 }), (v) => String(v.n * 2)), "4");
});

test("partial inference is not supported: currying is the workaround", () => {
  function get<T, K extends keyof T>(obj: T, key: K): T[K] {
    return obj[key];
  }
  // Supplying only T is an error (TS2558): all or nothing.
  // @ts-expect-error — expected 2 type arguments, but got 1
  get<{ a: number }>({ a: 1 }, "a");
  const getFrom = <T,>(obj: T) => <K extends keyof T>(key: K): T[K] => obj[key];
  expectTypeOf(getFrom({ a: 1, b: "x" })("b")).toEqualTypeOf<string>();
});

// Variance annotations document and enforce how a type parameter is used.
interface Producer<out T> {
  get(): T;
}
interface Consumer<in T> {
  accept(value: T): void;
}
interface Cell<in out T> {
  get(): T;
  set(value: T): void;
}

test("variance: out = covariant, in = contravariant, in out = invariant", () => {
  const dogP: Producer<"dog"> = { get: () => "dog" };
  const strP: Producer<string> = dogP; // covariant
  const strC: Consumer<string> = { accept: () => {} };
  const dogC: Consumer<"dog"> = strC; // contravariant
  const dogCell: Cell<"dog"> = { get: () => "dog", set: () => {} };
  // @ts-expect-error — invariant: Cell<"dog"> is not a Cell<string>
  const strCell: Cell<string> = dogCell;
  void [strP, dogC, strCell];
  assert.equal(strP.get(), "dog");
});

test("a variance annotation that contradicts usage is an error (but method params are bivariant)", () => {
  // @ts-expect-error — TS2636: T is used in a function-typed property's parameter (contravariant)
  interface Wrong<out T> {
    accept: (value: T) => void;
  }
  // Not an error: method-shorthand parameters are bivariant (Module 04), so `out` is accepted.
  interface Lenient<out T> {
    accept(value: T): void;
  }
  void (null as unknown as Wrong<string> | Lenient<string>);
});

test("overloads: resolution picks the first matching signature", () => {
  function parse(x: string): number;
  function parse(x: number): string;
  function parse(x: string | number): string | number {
    return typeof x === "string" ? Number(x) : String(x);
  }
  expectTypeOf(parse("1")).toEqualTypeOf<number>();
  expectTypeOf(parse(1)).toEqualTypeOf<string>();
  // @ts-expect-error — the implementation signature is not callable from outside
  parse(Math.random() > 0.5 ? "1" : 1);
  assert.equal(parse("41") + 1, 42);
});

test("a useless generic is a cast in disguise", () => {
  // T appears once (in the return type): nothing is checked, the caller just picks a type.
  function readUseless<T>(json: string): T {
    return JSON.parse(json);
  }
  const user = readUseless<{ name: string }>('{"nom":"x"}');
  assert.equal(user.name, undefined); // the "type" was never verified
});
