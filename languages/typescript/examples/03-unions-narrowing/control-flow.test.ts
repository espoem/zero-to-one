/**
 * Module 03 — Control-flow analysis: narrowing rules, their limits, and exhaustiveness.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { expectTypeOf } from "expect-type";

type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "square"; side: number }
  | { kind: "rect"; w: number; h: number };

function assertNever(x: never): never {
  throw new Error(`unhandled: ${JSON.stringify(x)}`);
}

function area(s: Shape): number {
  switch (s.kind) {
    case "circle":
      return Math.PI * s.radius ** 2;
    case "square":
      return s.side ** 2;
    case "rect":
      return s.w * s.h;
    default:
      return assertNever(s); // compile error here if a member is unhandled
  }
}

test("discriminated union switch is exhaustive", () => {
  assert.equal(area({ kind: "square", side: 3 }), 9);
  // Runtime guard still catches data that bypassed the types:
  assert.throws(() => area({ kind: "hexagon" } as unknown as Shape), /unhandled/);
});

test("switch (true) narrows on each case expression", () => {
  function describe(x: string | number | string[]): string {
    switch (true) {
      case typeof x === "string":
        expectTypeOf(x).toEqualTypeOf<string>();
        return `s:${x}`;
      case Array.isArray(x):
        expectTypeOf(x).toEqualTypeOf<string[]>();
        return `a:${x.length}`;
      default:
        expectTypeOf(x).toEqualTypeOf<number>();
        return `n:${x}`;
    }
  }
  assert.deepEqual([describe("a"), describe(["a", "b"]), describe(1)], ["s:a", "a:2", "n:1"]);
});

test("truthiness narrowing drops 0 and '' as well as null", () => {
  function label(n: number | null): string {
    if (n) return `#${n}`; // 0 falls through: a classic bug
    return "none";
  }
  assert.equal(label(0), "none");
  const fixed = (n: number | null) => (n !== null ? `#${n}` : "none");
  assert.equal(fixed(0), "#0");
});

test("typeof null is 'object': narrow null out explicitly", () => {
  function keys(x: object | null | string): string[] {
    if (typeof x === "object") {
      expectTypeOf(x).toEqualTypeOf<object | null>();
      return x === null ? [] : Object.keys(x);
    }
    return [x];
  }
  assert.deepEqual(keys(null), []);
});

test("destructured discriminated unions narrow when destructured from a parameter or const", () => {
  type Msg = { kind: "n"; payload: number } | { kind: "s"; payload: string };
  function size({ kind, payload }: Msg): number {
    if (kind === "n") {
      expectTypeOf(payload).toEqualTypeOf<number>();
      return payload;
    }
    return payload.length;
  }
  function sizeLet(m: Msg): number {
    let { kind, payload } = m; // `let` breaks the correlation
    if (kind === "n") {
      // @ts-expect-error — payload is still number | string
      const n: number = payload;
      return n;
    }
    kind = "s";
    return String(payload).length;
  }
  assert.equal(size({ kind: "s", payload: "abc" }), 3);
  assert.equal(sizeLet({ kind: "n", payload: 4 }), 4);
});

test("closures keep narrowing only after the last assignment (TS 5.4+)", () => {
  let stable: string | null = Math.random() > 2 ? null : "abc";
  let reassigned: string | null = "x";
  const out: string[] = [];
  if (stable !== null) {
    const f = () => out.push(stable.toUpperCase()); // ok: no assignment after this point
    f();
  }
  if (reassigned !== null) {
    // @ts-expect-error — TS18047: a later assignment exists, so the closure sees string | null
    const g = () => out.push(reassigned.toUpperCase());
    void g;
  }
  reassigned = null;
  assert.deepEqual(out, ["ABC"]);
});

test("inferred type predicates (TS 5.5+): filter narrows without an explicit `x is T`", () => {
  const mixed = [1, "a", 2, null];
  const nums = mixed.filter((x) => typeof x === "number");
  expectTypeOf(nums).toEqualTypeOf<number[]>();
  const present = mixed.filter((x) => x !== null);
  expectTypeOf(present).toEqualTypeOf<(string | number)[]>();
  assert.deepEqual(nums, [1, 2]);
});

test("`in` narrowing and `instanceof` narrowing", () => {
  type Fish = { swim(): string };
  type Bird = { fly(): string };
  const move = (a: Fish | Bird) => ("swim" in a ? a.swim() : a.fly());
  assert.equal(move({ fly: () => "up" }), "up");
  const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
  assert.equal(msg(new TypeError("t")), "t");
});
