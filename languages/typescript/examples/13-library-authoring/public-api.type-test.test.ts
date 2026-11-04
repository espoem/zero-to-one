/**
 * Module 13 — a type-test suite for a small public API, written the way a library would.
 * The runtime part runs under node --test; the type assertions run under `npm run typecheck`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { expectTypeOf } from "expect-type";

// --- The "library" under test ------------------------------------------------
export interface Ok<T> { readonly ok: true; readonly value: T }
export interface Err<E> { readonly ok: false; readonly error: E }
export type Result<T, E = Error> = Ok<T> | Err<E>;

export function ok<const T>(value: T): Ok<T> {
  return { ok: true, value };
}
export function err<const E>(error: E): Err<E> {
  return { ok: false, error };
}
export function map<T, U, E>(r: Result<T, E>, f: (value: T) => U): Result<U, E> {
  return r.ok ? ok(f(r.value)) : r;
}
export function unwrapOr<T, E, D>(r: Result<T, E>, fallback: D): T | D {
  return r.ok ? r.value : fallback;
}

// --- Type tests: what consumers rely on ----------------------------------------
test("inference: literals are preserved by const type parameters", () => {
  expectTypeOf(ok(1)).toEqualTypeOf<Ok<1>>();
  expectTypeOf(err("NOT_FOUND")).toEqualTypeOf<Err<"NOT_FOUND">>();
});

// Pitfall for type tests: `const r: Result<number, "E1"> = ok(2)` is *narrowed by assignment*
// to Ok<number>, so it does not test the union at all. Use `declare const` (type-only, no runtime value).
declare const anyResult: Result<number, "E1">;

test("assignment narrowing would silently weaken a type test", () => {
  const narrowed: Result<number, "E1"> = ok(2);
  expectTypeOf(narrowed).toEqualTypeOf<Ok<number>>(); // the declared union is filtered to the Ok member
  expectTypeOf(map(narrowed, String)).toEqualTypeOf<Result<string, unknown>>(); // E lost
});

test("map changes the value type and keeps the error type", () => {
  const typeOnly = () => {
    expectTypeOf(map(anyResult, (n) => String(n))).toEqualTypeOf<Result<string, "E1">>();
    // The callback parameter is contextually typed from the Result.
    map(anyResult, (n) => expectTypeOf(n).toEqualTypeOf<number>());
  };
  void typeOnly; // never called: `anyResult` has no runtime value
  assert.deepEqual(map(ok(2), (n) => n * 2), { ok: true, value: 4 });
});

test("unwrapOr returns a union of value and fallback types", () => {
  const typeOnly = () => expectTypeOf(unwrapOr(anyResult, null)).toEqualTypeOf<number | null>();
  void typeOnly;
  assert.equal(unwrapOr(err("E1"), null), null);
});

test("misuse is rejected (negative type tests)", () => {
  const typeOnly = () => {
    // @ts-expect-error — `value` only exists after narrowing on `ok`
    void anyResult.value;
    if (anyResult.ok) expectTypeOf(anyResult.value).toEqualTypeOf<number>();
    // @ts-expect-error — the mapper receives a number, not a string
    map(anyResult, (s: string) => s);
  };
  void typeOnly;
  // A public type that must stay assignable to its documented shape:
  expectTypeOf<Ok<1>>().toExtend<{ ok: true; value: number }>();
  expectTypeOf<Result<number>>().not.toEqualTypeOf<Ok<number>>();
});
