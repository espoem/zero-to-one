import { deepStrictEqual } from "node:assert/strict";

/**
 * Compile-Time Type Assertion & Runtime Verification Helpers
 */

export type Expect<T extends true> = T;

export type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2)
    ? true
    : false;

export function assert(condition: boolean, message: string = "Assertion failed"): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (!Object.is(actual, expected)) {
    throw new Error(
      `${message ?? "assertEqual failed"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

export function assertDeepEqual<T>(actual: T, expected: T, message?: string): void {
  try {
    deepStrictEqual(actual, expected);
  } catch (err: unknown) {
    if (message) {
      throw new Error(`${message}: ${(err as Error).message}`);
    }
    throw err;
  }
}

export async function assertThrowsAsync(
  fn: () => Promise<unknown> | unknown,
  expectedMatch?: string | RegExp | (new (...args: any[]) => Error)
): Promise<unknown> {
  let threw = false;
  let caught: unknown;
  try {
    await fn();
  } catch (err) {
    threw = true;
    caught = err;
  }
  if (!threw) {
    throw new Error("Expected function to throw, but it succeeded.");
  }
  if (expectedMatch) {
    if (typeof expectedMatch === "string") {
      const msg = caught instanceof Error ? caught.message : String(caught);
      if (!msg.includes(expectedMatch)) {
        throw new Error(`Expected error containing "${expectedMatch}", got "${msg}"`);
      }
    } else if (expectedMatch instanceof RegExp) {
      const msg = caught instanceof Error ? caught.message : String(caught);
      if (!expectedMatch.test(msg)) {
        throw new Error(`Expected error matching ${expectedMatch}, got "${msg}"`);
      }
    } else if (typeof expectedMatch === "function") {
      if (!(caught instanceof expectedMatch)) {
        throw new Error(`Expected instance of ${expectedMatch.name}, got ${String(caught)}`);
      }
    }
  }
  return caught;
}
