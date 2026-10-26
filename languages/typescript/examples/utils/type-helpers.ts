import { deepStrictEqual } from "node:assert/strict";

/**
 * Total TypeScript Type Testing & Utility Helpers
 *
 * Essential compile-time test primitives and type manipulation utilities
 * popularized by Matt Pocock in Total TypeScript.
 */

// ============================================================================
// 1. Compile-Time Type Testing Utilities
// ============================================================================

/**
 * Expect validates that a condition evaluates to true at compile time.
 * If T is false or any other type, TypeScript will emit a type error.
 *
 * @example
 * type test = Expect<Equal<string, string>>; // OK
 * // @ts-expect-error
 * type fail = Expect<Equal<string, number>>; // Type 'false' does not satisfy constraint 'true'
 */
export type Expect<T extends true> = T;

/**
 * Equal checks structural and nominal equality between two types.
 *
 * Uses the canonical conditional type assignability trick:
 * `<T>() => T extends X ? 1 : 2`
 * This accurately differentiates:
 * - `any` from `unknown`
 * - `{ a: string }` from `{ readonly a: string }`
 * - `true` from `boolean`
 * - `never` from other types
 */
export type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false;

/**
 * NotEqual checks that two types are NOT strictly equal.
 */
export type NotEqual<X, Y> = Equal<X, Y> extends true ? false : true;

/**
 * Extends checks if X is assignable to Y.
 */
export type Extends<X, Y> = X extends Y ? true : false;

// ============================================================================
// 2. Structural & Utility Types
// ============================================================================

/**
 * Prettify forces TypeScript to expand and flatten intersection and mapped types
 * into an inspectable object literal representation in IDE tooltips.
 *
 * @example
 * type Messy = { a: string } & { b: number };
 * type Clean = Prettify<Messy>; // { a: string; b: number }
 */
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

/**
 * StrictOmit enforces that keys to omit MUST exist on the target type T.
 * Unlike TypeScript's standard Omit<T, K extends keyof any>, which permits invalid keys.
 *
 * @example
 * type User = { id: string; name: string };
 * type WithoutId = StrictOmit<User, "id">; // OK
 * // @ts-expect-error - "foo" is not in keyof User
 * type BadOmit = StrictOmit<User, "foo">;
 */
export type StrictOmit<T, K extends keyof T> = Omit<T, K>;

/**
 * JsonPrimitive and recursive Serializable helper for client/server serialization boundaries.
 */
export type JsonPrimitive = string | number | boolean | null | undefined | bigint;

export type Serializable<T> = T extends (...args: any[]) => any
  ? never
  : T extends symbol
  ? never
  : T extends JsonPrimitive | Date
  ? T
  : T extends (infer U)[]
  ? Serializable<U>[]
  : T extends readonly (infer U)[]
  ? readonly Serializable<U>[]
  : T extends object
  ? { [K in keyof T]: Serializable<T[K]> }
  : never;

/**
 * DeepPartial recursively makes all properties of an object and nested objects optional.
 */
export type DeepPartial<T> = T extends Function
  ? T
  : T extends Array<infer U>
  ? _DeepPartialArray<U>
  : T extends object
  ? _DeepPartialObject<T>
  : T;

type _DeepPartialArray<T> = Array<DeepPartial<T>>;
type _DeepPartialObject<T> = { [P in keyof T]?: DeepPartial<T[P]> };

/**
 * DeepReadonly recursively marks all properties of an object and nested arrays as readonly.
 */
export type DeepReadonly<T> = T extends Function
  ? T
  : T extends Array<infer U>
  ? ReadonlyArray<DeepReadonly<U>>
  : T extends object
  ? { readonly [P in keyof T]: DeepReadonly<T[P]> }
  : T;

/**
 * UnionToIntersection converts a union type `A | B` to an intersection `A & B`.
 * Relies on the contravariance of function argument positions.
 */
export type UnionToIntersection<U> = (
  U extends any ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;

// ============================================================================
// 3. Runtime Assertion Helpers (for runnable test execution)
// ============================================================================

/**
 * Assert that a runtime condition is truthy.
 */
export function assert(condition: boolean, message = "Assertion failed"): asserts condition {
  if (!condition) {
    throw new Error(`[Assertion Error] ${message}`);
  }
}

/**
 * Assert strict primitive equality (===).
 */
export function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(
      `[Assertion Error] ${message ?? `Expected ${String(expected)}, got ${String(actual)}`}`
    );
  }
}

/**
 * Assert structural deep equality using Node.js native assert/strict.
 */
export function assertDeepEqual<T>(actual: T, expected: T, message?: string): void {
  try {
    deepStrictEqual(actual, expected);
  } catch (err: unknown) {
    if (message) {
      throw new Error(`[Assertion Error] ${message}: ${(err as Error).message}`);
    }
    throw err;
  }
}
