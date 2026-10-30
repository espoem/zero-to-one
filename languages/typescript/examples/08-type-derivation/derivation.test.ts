/**
 * Module 08 — Deriving types from values: typeof, keyof, indexed access, utility types,
 * template literal types, and the `string & {}` autocompletion trick.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { expectTypeOf } from "expect-type";

const config = {
  port: 3000,
  routes: ["/", "/users"],
  db: { host: "localhost", pool: 5 },
} as const;

test("typeof lifts a value into type space; keyof and indexed access slice it", () => {
  type Config = typeof config;
  expectTypeOf<keyof Config>().toEqualTypeOf<"port" | "routes" | "db">();
  expectTypeOf<Config["db"]["pool"]>().toEqualTypeOf<5>();
  expectTypeOf<Config["routes"][number]>().toEqualTypeOf<"/" | "/users">();
  expectTypeOf<Config[keyof Config]>().toEqualTypeOf<3000 | readonly ["/", "/users"] | { readonly host: "localhost"; readonly pool: 5 }>();
  assert.equal(config.db.pool, 5);
});

test("keyof of an index signature and of a union", () => {
  expectTypeOf<keyof Record<string, number>>().toEqualTypeOf<string>();
  expectTypeOf<keyof { [k: string]: unknown }>().toEqualTypeOf<string | number>(); // numeric keys are strings in JS
  type A = { a: 1; shared: 1 };
  type B = { b: 2; shared: 2 };
  expectTypeOf<keyof (A | B)>().toEqualTypeOf<"shared">(); // only common keys
  // A & B is `never`: `shared` would be 1 & 2, and an object intersection with a
  // conflicting literal property reduces to never (TS 3.9+). keyof never is every key.
  expectTypeOf<A & B>().toEqualTypeOf<never>();
  expectTypeOf<keyof (A & B)>().toEqualTypeOf<string | number | symbol>();
  type C = { c: 3; shared: 1 };
  expectTypeOf<keyof (A & C)>().toEqualTypeOf<"a" | "c" | "shared">();
});

test("function utility types", async () => {
  async function load(id: string, opts?: { cache: boolean }) {
    return { id, cached: opts?.cache ?? false };
  }
  expectTypeOf<Parameters<typeof load>>().toEqualTypeOf<[id: string, opts?: { cache: boolean }]>();
  expectTypeOf<Awaited<ReturnType<typeof load>>>().toEqualTypeOf<{ id: string; cached: boolean }>();
  assert.deepEqual(await load("x"), { id: "x", cached: false });
});

test("Extract/Exclude filter unions; Omit is not distributive over unions", () => {
  type Ev = { type: "a"; x: 1 } | { type: "b"; y: 2 };
  expectTypeOf<Extract<Ev, { type: "a" }>>().toEqualTypeOf<{ type: "a"; x: 1 }>();
  type O = Omit<Ev, "x">; // keyof (Ev) is only "type": the union collapses
  expectTypeOf<O>().toEqualTypeOf<{ type: "a" | "b" }>();
  type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
  expectTypeOf<DistributiveOmit<Ev, "x">>().toEqualTypeOf<{ type: "a" } | { type: "b"; y: 2 }>();
});

test("template literal types: patterns, cross products and intrinsics", () => {
  type Size = "sm" | "lg";
  type Color = "red" | "blue";
  expectTypeOf<`${Size}-${Color}`>().toEqualTypeOf<"sm-red" | "sm-blue" | "lg-red" | "lg-blue">();
  type EventName<K extends string> = `on${Capitalize<K>}`;
  expectTypeOf<EventName<"click">>().toEqualTypeOf<"onClick">();
  const isPx = (s: string): s is `${number}px` => /^\d+(\.\d+)?px$/.test(s);
  assert.equal(isPx("12px"), true);
  assert.equal(isPx("12em"), false);
});

test("`string & {}` keeps literal autocompletion while accepting any string", () => {
  type Loose = "primary" | "secondary" | string; // collapses to string: no completions
  type Suggest = "primary" | "secondary" | (string & {});
  expectTypeOf<Loose>().toEqualTypeOf<string>();
  expectTypeOf<"custom">().toExtend<Suggest>();
  expectTypeOf<Suggest>().not.toEqualTypeOf<string>(); // the literals survive
});
