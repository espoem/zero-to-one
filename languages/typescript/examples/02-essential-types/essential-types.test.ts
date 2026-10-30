/**
 * Module 02 — Essential types and functions.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { expectTypeOf } from "expect-type";

test("literal inference: const keeps literals, let widens", () => {
  const a = "x";
  let b = "x";
  expectTypeOf<typeof a>().toEqualTypeOf<"x">(); // use typeof: passing `a` to a generic would widen it
  expectTypeOf(b).toEqualTypeOf<string>();
  b = "y";
  assert.equal(b, "y");
});

test("optional and default parameters, rest parameters", () => {
  function greet(name: string, greeting = "Hello", punctuation?: string): string {
    return `${greeting}, ${name}${punctuation ?? "!"}`;
  }
  expectTypeOf(greet).parameters.toEqualTypeOf<[name: string, greeting?: string, punctuation?: string]>();
  function sum(...xs: number[]): number {
    return xs.reduce((s, x) => s + x, 0);
  }
  assert.equal(greet("Ada"), "Hello, Ada!");
  assert.equal(sum(1, 2, 3), 6);
  // @ts-expect-error — too few arguments
  greet();
});

test("function types: void return means 'ignored', not 'must be undefined'", () => {
  type Listener = (e: string) => void;
  const pushes: number[] = [];
  const l: Listener = (e) => pushes.push(e.length); // returns number, accepted for a void type
  l("abc");
  assert.deepEqual(pushes, [3]);
  // But a *declared* void function may not return a value:
  // @ts-expect-error — TS2322: number is not assignable to void
  function f(): void { return 1; }
  void f;
});

test("tuples are fixed-length, labelled and readonly-able", () => {
  type Range = readonly [start: number, end: number];
  const r: Range = [1, 5];
  expectTypeOf(r[0]).toEqualTypeOf<number>();
  // @ts-expect-error — index out of range for a 2-tuple
  void r[2];
  // @ts-expect-error — readonly tuple
  r[0] = 2;
  type WithOptional = [id: string, note?: string];
  const w: WithOptional = ["a"];
  assert.equal(w.length, 1);
});

test("arrays under noUncheckedIndexedAccess: reads may be undefined", () => {
  const xs = [10, 20];
  const first = xs[0];
  expectTypeOf(first).toEqualTypeOf<number | undefined>();
  assert.equal(xs.at(-1), 20);
});

test("Set and Map are generic; Map.get always includes undefined", () => {
  const roles = new Map<string, "admin" | "user">([["ada", "admin"]]);
  const r = roles.get("ada");
  expectTypeOf(r).toEqualTypeOf<"admin" | "user" | undefined>();
  if (roles.has("ada")) {
    // has() does not narrow get(): still possibly undefined
    expectTypeOf(roles.get("ada")).toEqualTypeOf<"admin" | "user" | undefined>();
  }
  const tags = new Set(["a", "b"]);
  expectTypeOf(tags).toEqualTypeOf<Set<string>>();
  assert.equal(r, "admin");
});

test("JSON.parse returns any; annotate it as unknown and narrow", () => {
  const raw: unknown = JSON.parse('{"n": 1}');
  // @ts-expect-error — cannot use unknown without narrowing
  void raw.n;
  if (typeof raw === "object" && raw !== null && "n" in raw && typeof raw.n === "number") {
    expectTypeOf(raw.n).toEqualTypeOf<number>();
    assert.equal(raw.n, 1);
  }
});

test("async functions return Promise<T>; Promise.all keeps tuple positions", async () => {
  async function score(): Promise<number> {
    return 42;
  }
  expectTypeOf(score).returns.toEqualTypeOf<Promise<number>>();
  expectTypeOf<Awaited<ReturnType<typeof score>>>().toEqualTypeOf<number>();
  const [n, s] = await Promise.all([score(), Promise.resolve("x")]);
  expectTypeOf(n).toEqualTypeOf<number>();
  expectTypeOf(s).toEqualTypeOf<string>();
  const settled = await Promise.allSettled([score(), Promise.reject(new Error("boom"))]);
  const first = settled[0];
  if (first?.status === "fulfilled") expectTypeOf(first.value).toEqualTypeOf<number>();
  assert.equal(settled[1]?.status, "rejected");
});

test("catch variables are unknown under strict (useUnknownInCatchVariables)", () => {
  try {
    throw new Error("x");
  } catch (e) {
    expectTypeOf(e).toEqualTypeOf<unknown>();
    assert.ok(e instanceof Error);
  }
});

test("built-in iterators: IteratorObject, iterator helpers and generator types", () => {
  function* ids(): Generator<number, "done", undefined> {
    yield 1;
    yield 2;
    return "done";
  }
  const it = ids();
  const first = it.next();
  if (!first.done) expectTypeOf(first.value).toEqualTypeOf<number>();
  else expectTypeOf(first.value).toEqualTypeOf<"done">();

  const doubled = [1, 2, 3].values().map((x) => x * 2).filter((x) => x > 2);
  expectTypeOf(doubled).toEqualTypeOf<IteratorObject<number, undefined, unknown>>();
  assert.deepEqual(doubled.toArray(), [4, 6]);
});
