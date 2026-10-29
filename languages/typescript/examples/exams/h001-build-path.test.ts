/**
 * Hands-on H-001 (exams/certificates-dev-typescript.md): typed path builder.
 * Task: implement `PathParams<P>` and `buildPath(pattern, params)` so that the
 * parameters object is derived from the pattern literal. This file holds the
 * reference solution and the verification (type + runtime) tests.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { expectTypeOf } from "expect-type";

export type PathParams<P extends string> = P extends `${string}:${infer Name}/${infer Rest}`
  ? { [K in Name | keyof PathParams<`/${Rest}`>]: string | number }
  : P extends `${string}:${infer Name}`
    ? { [K in Name]: string | number }
    : Record<never, never>;

export function buildPath<const P extends string>(pattern: P, params: PathParams<P>): string {
  const values = params as Record<string, string | number>;
  return pattern.replace(/:([A-Za-z0-9_]+)/g, (_, name: string) => {
    const v = values[name];
    if (v === undefined) throw new Error(`missing param ${name}`);
    return encodeURIComponent(String(v));
  });
}

test("H-001 types: params are derived from the pattern", () => {
  expectTypeOf<PathParams<"/users/:id/posts/:postId">>().toEqualTypeOf<{ id: string | number; postId: string | number }>();
  expectTypeOf<PathParams<"/health">>().toEqualTypeOf<Record<never, never>>();
  assert.throws(
    // @ts-expect-error — postId is missing
    () => buildPath("/users/:id/posts/:postId", { id: 1 }),
    /missing param postId/,
  );
  // @ts-expect-error — unknown param
  buildPath("/users/:id", { id: 1, extra: 2 });
});

test("H-001 runtime: values are substituted and encoded", () => {
  assert.equal(buildPath("/users/:id/posts/:postId", { id: 7, postId: "a b" }), "/users/7/posts/a%20b");
  assert.equal(buildPath("/health", {}), "/health");
});
