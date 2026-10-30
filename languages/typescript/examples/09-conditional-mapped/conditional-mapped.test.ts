/**
 * Module 09 — Conditional, mapped and recursive types (the dedicated example for this module).
 *
 * Type-level assertions are checked by `npm run typecheck`; the runtime functions whose
 * signatures use these types are exercised by `node --test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { expectTypeOf } from "expect-type";
import type { Equal, Expect } from "../utils/type-helpers.ts";

// ---------------------------------------------------------------------------
// 1. Distribution over unions, and how to stop it
// ---------------------------------------------------------------------------

type ToArray<T> = T extends unknown ? T[] : never; // distributive (naked T)
type ToArrayNonDist<T> = [T] extends [unknown] ? T[] : never; // non-distributive

export type _dist = Expect<Equal<ToArray<string | number>, string[] | number[]>>;
export type _nondist = Expect<Equal<ToArrayNonDist<string | number>, (string | number)[]>>;

// never is the empty union: a distributive conditional over never is never.
type IsNeverWrong<T> = T extends never ? true : false;
type IsNever<T> = [T] extends [never] ? true : false;
export type _never1 = Expect<Equal<IsNeverWrong<never>, never>>;
export type _never2 = Expect<Equal<IsNever<never>, true>>;
export type _never3 = Expect<Equal<IsNever<string>, false>>;

// Distribution happens only for a *naked type parameter* in the check position.
type Wrapped<T> = { v: T } extends { v: string } ? "yes" : "no";
export type _wrapped = Expect<Equal<Wrapped<string | number>, "no">>;

// ---------------------------------------------------------------------------
// 2. infer, including `infer X extends C` constraints
// ---------------------------------------------------------------------------

type ElementOf<T> = T extends readonly (infer E)[] ? E : never;
export type _el = Expect<Equal<ElementOf<readonly ["a", 1]>, "a" | 1>>;

type FirstNumber<T> = T extends [infer H extends number, ...unknown[]] ? H : never;
export type _first1 = Expect<Equal<FirstNumber<[1, "x"]>, 1>>;
export type _first2 = Expect<Equal<FirstNumber<["x", 1]>, never>>;

// Parse a numeric literal out of a string literal type.
type ToNumber<S extends string> = S extends `${infer N extends number}` ? N : never;
export type _num = Expect<Equal<ToNumber<"42">, 42>>;

// Overloaded functions: infer matches the *last* signature.
declare function over(x: string): string;
declare function over(x: number): number;
export type _over = Expect<Equal<Parameters<typeof over>, [x: number]>>;

// ---------------------------------------------------------------------------
// 3. Template literal pattern matching and TS 7's code-point inference
// ---------------------------------------------------------------------------

type HeadTail<S extends string> = S extends `${infer H}${infer T}` ? [H, T] : never;
// TS 7.0: an astral character is one code point; TS <= 6 split it into two UTF-16 halves.
export type _emoji = Expect<Equal<HeadTail<"😀abc">, ["😀", "abc"]>>;

type Length<S extends string, Acc extends unknown[] = []> = S extends `${string}${infer Rest}`
  ? Length<Rest, [...Acc, 0]>
  : Acc["length"];
export type _len = Expect<Equal<Length<"a😀b">, 3>>;

// Route parameters: "/users/:id/posts/:postId" -> { id: string; postId: string }
type RouteParams<P extends string> = P extends `${string}:${infer Param}/${infer Rest}`
  ? { [K in Param | keyof RouteParams<`/${Rest}`>]: string }
  : P extends `${string}:${infer Param}`
    ? { [K in Param]: string }
    : {};

export type _route = Expect<Equal<RouteParams<"/users/:id/posts/:postId">, { id: string; postId: string }>>;

function matchRoute<P extends string>(pattern: P, path: string): RouteParams<P> | null {
  const pp = pattern.split("/");
  const xs = path.split("/");
  if (pp.length !== xs.length) return null;
  const out: Record<string, string> = {};
  for (let i = 0; i < pp.length; i++) {
    const seg = pp[i] ?? "";
    const val = xs[i] ?? "";
    if (seg.startsWith(":")) out[seg.slice(1)] = decodeURIComponent(val);
    else if (seg !== val) return null;
  }
  return out as RouteParams<P>; // one audited cast at the implementation boundary
}

test("matchRoute returns params typed from the pattern literal", () => {
  const m = matchRoute("/users/:id/posts/:postId", "/users/7/posts/42");
  expectTypeOf(m).toEqualTypeOf<{ id: string; postId: string } | null>();
  assert.deepEqual(m, { id: "7", postId: "42" });
  assert.equal(matchRoute("/users/:id", "/teams/7"), null);
  // @ts-expect-error — `slug` is not a parameter of this pattern
  void m?.slug;
});

// ---------------------------------------------------------------------------
// 4. Mapped types: modifiers, homomorphism, key remapping
// ---------------------------------------------------------------------------

interface Profile {
  readonly id: string;
  name?: string;
  age: number;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type Concrete<T> = { [K in keyof T]-?: T[K] };
export type _mut = Expect<Equal<Mutable<Profile>, { id: string; name?: string; age: number }>>;
export type _conc = Expect<Equal<Concrete<Profile>, { readonly id: string; name: string; age: number }>>;

// Homomorphic mapped types (over keyof T) preserve modifiers and map tuples to tuples.
type Boxed<T> = { [K in keyof T]: { value: T[K] } };
export type _tuple = Expect<Equal<Boxed<[string, number]>, [{ value: string }, { value: number }]>>;

// Key remapping with `as`, and filtering with `as never`.
type Getters<T> = { [K in keyof T & string as `get${Capitalize<K>}`]: () => T[K] };
export type _get = Expect<Equal<Getters<{ a: 1; b: "x" }>, { getA: () => 1; getB: () => "x" }>>;

type PickByValue<T, V> = { [K in keyof T as T[K] extends V ? K : never]: T[K] };
export type _pbv = Expect<Equal<PickByValue<{ a: 1; b: "x"; c: 2 }, number>, { a: 1; c: 2 }>>;

function mapValues<T extends object, R>(obj: T, fn: <K extends keyof T>(value: T[K], key: K) => R): { [K in keyof T]: R } {
  const out = {} as { [K in keyof T]: R };
  for (const key of Object.keys(obj) as (keyof T)[]) out[key] = fn(obj[key], key);
  return out;
}

test("mapValues keeps the key set and changes the value type", () => {
  const lengths = mapValues({ a: "xx", b: "yyy" }, (v) => String(v).length);
  expectTypeOf(lengths).toEqualTypeOf<{ a: number; b: number }>();
  assert.deepEqual(lengths, { a: 2, b: 3 });
});

// ---------------------------------------------------------------------------
// 5. Unions <-> maps, recursive types
// ---------------------------------------------------------------------------

type Event =
  | { type: "click"; x: number; y: number }
  | { type: "key"; code: string }
  | { type: "focus" };

type EventMap = { [E in Event as E["type"]]: Omit<E, "type"> };
export type _emap = Expect<
  Equal<EventMap, { click: { x: number; y: number }; key: { code: string }; focus: {} }>
>;

type Handlers = { [K in keyof EventMap]: (payload: EventMap[K]) => string };

function dispatch(e: Event, handlers: Handlers): string {
  switch (e.type) {
    case "click":
      return handlers.click(e);
    case "key":
      return handlers.key(e);
    case "focus":
      return handlers.focus(e);
  }
}

test("a handler map derived from a union stays exhaustive", () => {
  const handlers: Handlers = {
    click: (p) => `click@${p.x},${p.y}`,
    key: (p) => `key:${p.code}`,
    focus: () => "focus",
  };
  assert.equal(dispatch({ type: "click", x: 1, y: 2 }, handlers), "click@1,2");
  // @ts-expect-error — a missing handler is a compile error
  const partial: Handlers = { click: () => "", key: () => "" };
  void partial;
});

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

test("DeepReadonly is enforced statically, not at runtime", () => {
  const cfg: DeepReadonly<{ db: { hosts: string[] } }> = { db: { hosts: ["a"] } };
  // @ts-expect-error — nested readonly array
  cfg.db.hosts.push("b");
  // @ts-expect-error — nested readonly property
  cfg.db = { hosts: [] };
  assert.equal(Object.isFrozen(cfg), false); // erasure: nothing is frozen
});
