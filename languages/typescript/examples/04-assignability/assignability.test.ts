/**
 * Module 04 — Objects, assignability and the "weird parts".
 * Each soundness hole is shown twice: the compiler accepts it, and the runtime breaks.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { expectTypeOf } from "expect-type";
import { fixture, runTsc } from "../utils/tsc.ts";

interface Point {
  x: number;
  y: number;
}

test("structural typing: any value with the right shape is a Point", () => {
  const p3 = { x: 1, y: 2, z: 3 };
  const p: Point = p3; // not fresh: extra property allowed (width subtyping)
  assert.equal(Object.keys(p).length, 3);
  // @ts-expect-error — fresh object literal: excess property check (TS2353)
  const q: Point = { x: 1, y: 2, z: 3 };
  void q;
});

test("Object.keys returns string[] because objects may carry extra keys", () => {
  const p: Point = { x: 1, y: 2, z: 3 } as Point; // subtype value hiding behind Point
  const keys = Object.keys(p);
  expectTypeOf(keys).toEqualTypeOf<string[]>();
  // The tempting cast is unsound: it claims "z" cannot occur.
  const typed = Object.keys(p) as (keyof Point)[];
  const sum = typed.reduce((acc, k) => acc + p[k], 0);
  assert.equal(sum, 6); // includes z: the cast lied
});

test("{} accepts every non-nullish value; object rejects primitives; unknown accepts all", () => {
  const a: {} = "a string";
  const b: {} = 0;
  // @ts-expect-error — primitives are not `object`
  const c: object = "a string";
  // @ts-expect-error — null is not assignable to {}
  const d: {} = null;
  const e: unknown = null;
  void [a, b, c, d, e];
});

interface Animal {
  name: string;
}
interface Dog extends Animal {
  bark(): string;
}

// Method shorthand: parameters are checked bivariantly even under strictFunctionTypes.
interface HandlerMethod {
  handle(a: Animal): string;
}
// Function property: parameters are checked contravariantly under strictFunctionTypes.
interface HandlerProp {
  handle: (a: Animal) => string;
}

test("method-shorthand parameters are bivariant: an unsound handler gets through", () => {
  const dogOnly = { handle: (d: Dog) => d.bark() };
  const viaMethod: HandlerMethod = dogOnly; // accepted (bivariance)
  // @ts-expect-error — rejected for a function-typed property (contravariance)
  const viaProp: HandlerProp = dogOnly;
  void viaProp;
  assert.throws(() => viaMethod.handle({ name: "cat" }), TypeError); // d.bark is not a function
});

test("arrays are covariant (and therefore unsound for writes)", () => {
  const dogs: Dog[] = [{ name: "rex", bark: () => "woof" }];
  const animals: Animal[] = dogs; // allowed: arrays are treated covariantly
  animals.push({ name: "cat" });
  assert.throws(() => dogs.map((d) => d.bark()), TypeError);
  // readonly arrays remove the write that made this unsound
  const safe: readonly Animal[] = dogs;
  // @ts-expect-error — no push on readonly arrays
  safe.push({ name: "cat" });
});

test("fewer parameters are fine: callbacks may ignore arguments", () => {
  const xs = [1, 2, 3].map(() => 0);
  assert.deepEqual(xs, [0, 0, 0]);
  // @ts-expect-error — but a callback may not require *more* parameters than provided
  [1, 2, 3].forEach((value: number, index: number, array: number[], extra: string) => void extra);
});

test("satisfies checks and keeps the inferred type; annotation replaces it; as skips the check", () => {
  const routes = { home: "/", user: "/users/:id" } satisfies Record<string, `/${string}`>;
  // The contextual type `/${string}` keeps the literals: no widening to string...
  expectTypeOf<typeof routes.user>().toEqualTypeOf<"/users/:id">();
  // ...whereas a plain object literal widens its string values.
  const plain = { user: "/users/:id" };
  expectTypeOf<typeof plain.user>().toEqualTypeOf<string>();
  expectTypeOf<keyof typeof routes>().toEqualTypeOf<"home" | "user">();
  const literalRoutes = { home: "/", user: "/users/:id" } as const satisfies Record<string, `/${string}`>;
  expectTypeOf(literalRoutes).toEqualTypeOf<{ readonly home: "/"; readonly user: "/users/:id" }>(); // + readonly
  const annotated: Record<string, `/${string}`> = { home: "/" };
  expectTypeOf(annotated.missing).toEqualTypeOf<`/${string}` | undefined>(); // noUncheckedIndexedAccess
  // @ts-expect-error — satisfies still checks: "users" does not start with "/"
  const bad = { users: "users" } satisfies Record<string, `/${string}`>;
  const lie = { users: "users" } as unknown as Record<string, `/${string}`>; // double assertion: unchecked
  void [bad, lie];
});

test("noUncheckedIndexedAccess adds undefined to index reads", () => {
  const scores: Record<string, number> = { ada: 1 };
  const s = scores["bob"];
  expectTypeOf(s).toEqualTypeOf<number | undefined>();
  assert.equal(s, undefined);
});

test("exactOptionalPropertyTypes distinguishes absent from undefined (TS2375)", () => {
  const r = runTsc(["-p", "."], fixture(import.meta.url, "exact-optional"));
  assert.deepEqual(r.codes, ["TS2375"]);
});

test("interface extends reports conflicts; intersections silently produce never", () => {
  type A = { id: string };
  type B = { id: number };
  type AB = A & B;
  expectTypeOf<AB["id"]>().toEqualTypeOf<never>();
  // `interface C extends A, B {}` would be error TS2320 at the declaration instead.
});
