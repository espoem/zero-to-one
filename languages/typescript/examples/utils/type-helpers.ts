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
 * ExpectTrue is an alias for Expect.
 */
export type ExpectTrue<T extends true> = T;

/**
 * ExpectFalse validates that a condition evaluates to false at compile time.
 */
export type ExpectFalse<T extends false> = T;

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

/**
 * IsAny tests if a type is the `any` type.
 */
export type IsAny<T> = 0 extends 1 & T ? true : false;

/**
 * IsNever tests if a type is `never`.
 */
export type IsNever<T> = [T] extends [never] ? true : false;

/**
 * IsUnknown tests if a type is `unknown` (and not `any`).
 */
export type IsUnknown<T> = IsAny<T> extends true
  ? false
  : [unknown] extends [T]
  ? true
  : false;

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
 * Maybe represents a value that could be null or undefined.
 */
export type Maybe<T> = T | null | undefined;

/**
 * NonEmptyArray guarantees at least one element in an array at compile time.
 */
export type NonEmptyArray<T> = [T, ...T[]];

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
 * Assert structural deep equality via JSON serialization.
 */
export function assertDeepEqual<T>(actual: T, expected: T, message?: string): void {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(
      `[Assertion Error] ${message ?? `Expected deep equality:\n  Expected: ${expectedStr}\n  Actual:   ${actualStr}`}`
    );
  }
}
