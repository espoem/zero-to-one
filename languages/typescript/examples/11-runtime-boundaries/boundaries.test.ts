/**
 * Module 11 — Runtime boundaries: Zod 4 and Standard Schema.
 *
 * Runtime assertions run under `node --test`; type assertions (expectTypeOf, @ts-expect-error)
 * are checked by `npm run typecheck`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { expectTypeOf } from "expect-type";

// ---------------------------------------------------------------------------
// 1. The boundary: JSON.parse returns any; treat it as unknown and parse
// ---------------------------------------------------------------------------

const User = z.object({
  id: z.uuid(),
  email: z.email(),
  age: z.number().int().nonnegative(),
});
type User = z.infer<typeof User>;

test("JSON.parse output is unknown until a schema parses it", () => {
  const raw: unknown = JSON.parse('{"id":"8b6f3c1e-1d2a-4c5b-9e7f-0a1b2c3d4e5f","email":"a@example.com","age":36}');
  const user = User.parse(raw);
  expectTypeOf(user).toEqualTypeOf<{ id: string; email: string; age: number }>();
  assert.equal(user.age, 36);
});

test("a cast is not a check: `as User` lets a bad payload through", () => {
  const raw: unknown = JSON.parse('{"id":42}');
  const lied = raw as User; // compiles
  assert.equal(typeof lied.email, "undefined"); // the crash happens later, far from the cause
  assert.throws(() => User.parse(raw), z.ZodError);
});

// ---------------------------------------------------------------------------
// 2. Input vs output types: transforms, defaults, prefaults, coercion
// ---------------------------------------------------------------------------

const Settings = z.object({
  theme: z.enum(["light", "dark"]).default("light"),
  pageSize: z.coerce.number().int().min(1),
  tags: z.string().transform((s) => s.split(",").filter(Boolean)),
  retries: z.number().prefault(3),
});

test("z.input and z.output differ wherever a transform, default or coercion sits", () => {
  type In = z.input<typeof Settings>;
  type Out = z.output<typeof Settings>;
  expectTypeOf<In["theme"]>().toEqualTypeOf<"light" | "dark" | undefined>();
  expectTypeOf<Out["theme"]>().toEqualTypeOf<"light" | "dark">();
  expectTypeOf<In["tags"]>().toEqualTypeOf<string>();
  expectTypeOf<Out["tags"]>().toEqualTypeOf<string[]>();
  expectTypeOf<In["pageSize"]>().toEqualTypeOf<unknown>();
  expectTypeOf<z.infer<typeof Settings>>().toEqualTypeOf<Out>();

  const out = Settings.parse({ pageSize: "25", tags: "a,b" });
  assert.deepEqual(out, { theme: "light", pageSize: 25, tags: ["a", "b"], retries: 3 });
});

test(".default short-circuits; .prefault is parsed like input", () => {
  const WithDefault = z.string().transform((s) => s.length).default(99);
  const WithPrefault = z.string().transform((s) => s.length).prefault("abc");
  assert.equal(WithDefault.parse(undefined), 99); // default is an *output* value
  assert.equal(WithPrefault.parse(undefined), 3); // prefault is an *input* value, then transformed
});

// ---------------------------------------------------------------------------
// 3. safeParse narrows on `success`; errors are structured
// ---------------------------------------------------------------------------

test("safeParse returns a discriminated union", () => {
  const result = User.safeParse({ id: "nope", email: "x", age: -1 });
  if (result.success) {
    expectTypeOf(result.data).toEqualTypeOf<User>();
    assert.fail("should not parse");
  } else {
    expectTypeOf(result.error).toEqualTypeOf<z.ZodError<User>>();
    const flat = z.flattenError(result.error);
    assert.deepEqual(Object.keys(flat.fieldErrors).sort(), ["age", "email", "id"]);
  }
});

test("custom messages use the unified `error` parameter", () => {
  const Name = z.string().min(3, { error: "name too short" });
  const r = Name.safeParse("ab");
  assert.equal(r.success, false);
  assert.equal(r.error?.issues[0]?.message, "name too short");
});

// ---------------------------------------------------------------------------
// 4. Unknown keys: strip (default), strict, loose
// ---------------------------------------------------------------------------

test("z.object strips unknown keys; z.strictObject rejects them; z.looseObject keeps them", () => {
  const Shape = { a: z.string() };
  assert.deepEqual(z.object(Shape).parse({ a: "x", b: 1 }), { a: "x" });
  const strict = z.strictObject(Shape).safeParse({ a: "x", b: 1 });
  assert.equal(strict.error?.issues[0]?.code, "unrecognized_keys");
  assert.deepEqual(z.looseObject(Shape).parse({ a: "x", b: 1 }), { a: "x", b: 1 });
});

// ---------------------------------------------------------------------------
// 5. Discriminated unions, brands and narrowing refinements
// ---------------------------------------------------------------------------

const Payment = z.discriminatedUnion("method", [
  z.object({ method: z.literal("card"), last4: z.string().length(4) }),
  z.object({ method: z.literal("bank"), iban: z.string().min(15) }),
]);

test("discriminated unions infer a TS discriminated union", () => {
  const p = Payment.parse({ method: "card", last4: "4242" });
  if (p.method === "card") expectTypeOf(p.last4).toEqualTypeOf<string>();
  assert.equal(Payment.safeParse({ method: "cash" }).success, false);
});

const UserId = z.uuid().brand<"UserId">();
type UserId = z.infer<typeof UserId>;

function loadUser(id: UserId): string {
  return `user:${id}`;
}

test("branded outputs are produced only by parsing", () => {
  const id = UserId.parse("8b6f3c1e-1d2a-4c5b-9e7f-0a1b2c3d4e5f");
  assert.equal(loadUser(id), "user:8b6f3c1e-1d2a-4c5b-9e7f-0a1b2c3d4e5f");
  // @ts-expect-error — a plain string is not a UserId
  loadUser("8b6f3c1e-1d2a-4c5b-9e7f-0a1b2c3d4e5f");
  // Brands are static only: the runtime value is still a string.
  assert.equal(typeof id, "string");
});

test("refine with a type predicate narrows the output type", () => {
  const isNonEmpty = (xs: string[]): xs is [string, ...string[]] => xs.length > 0;
  const NonEmpty = z.array(z.string()).refine(isNonEmpty, { error: "empty" });
  const xs = NonEmpty.parse(["a"]);
  // Zod intersects the predicate's type with the schema's output.
  expectTypeOf(xs).toEqualTypeOf<string[] & [string, ...string[]]>();
  // The practical win under noUncheckedIndexedAccess: the first element is not `| undefined`.
  expectTypeOf(xs[0]).toEqualTypeOf<string>();
  assert.equal(NonEmpty.safeParse([]).success, false);
});

test("superRefine reports several issues with paths", () => {
  const Signup = z
    .object({ password: z.string(), confirm: z.string() })
    .superRefine((v, ctx) => {
      if (v.password.length < 8) ctx.addIssue({ code: "custom", message: "too short", path: ["password"] });
      if (v.password !== v.confirm) ctx.addIssue({ code: "custom", message: "mismatch", path: ["confirm"] });
    });
  const r = Signup.safeParse({ password: "abc", confirm: "abd" });
  assert.deepEqual(r.error?.issues.map((i) => i.path.join(".")), ["password", "confirm"]);
});

// ---------------------------------------------------------------------------
// 6. Standard Schema: a library-neutral contract
// ---------------------------------------------------------------------------

/** A consumer that accepts *any* Standard Schema (Zod, Valibot, ArkType, or hand-written). */
async function parseWith<S extends StandardSchemaV1>(schema: S, value: unknown): Promise<StandardSchemaV1.InferOutput<S>> {
  let result = schema["~standard"].validate(value);
  if (result instanceof Promise) result = await result;
  if (result.issues) {
    throw new Error(result.issues.map((i) => i.message).join("; "));
  }
  return result.value;
}

/** A hand-written Standard Schema, to show the contract has no library dependency. */
const PositiveInt: StandardSchemaV1<unknown, number> = {
  "~standard": {
    version: 1,
    vendor: "zero-to-one",
    validate: (value) =>
      Number.isInteger(value) && (value as number) > 0
        ? { value: value as number }
        : { issues: [{ message: "expected a positive integer" }] },
  },
};

test("one consumer works with Zod and with a hand-written schema", async () => {
  const user = await parseWith(User, { id: "8b6f3c1e-1d2a-4c5b-9e7f-0a1b2c3d4e5f", email: "a@example.com", age: 1 });
  expectTypeOf(user).toEqualTypeOf<User>();
  const n = await parseWith(PositiveInt, 5);
  expectTypeOf(n).toEqualTypeOf<number>();
  await assert.rejects(parseWith(PositiveInt, -1), /positive integer/);
  assert.equal(User["~standard"].vendor, "zod");
});

// ---------------------------------------------------------------------------
// 7. Typed fetch and environment loading
// ---------------------------------------------------------------------------

async function fetchJson<S extends z.ZodType>(
  input: string,
  schema: S,
  fetchImpl: (input: string) => Promise<Response> = fetch,
): Promise<z.output<S>> {
  const res = await fetchImpl(input);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return schema.parse(await res.json());
}

test("fetchJson returns the schema's output type and rejects drifted payloads", async () => {
  const fake = async () => Response.json({ id: "8b6f3c1e-1d2a-4c5b-9e7f-0a1b2c3d4e5f", email: "a@example.com", age: 2 });
  const user = await fetchJson("https://api.example.com/user", User, fake);
  expectTypeOf(user).toEqualTypeOf<User>();
  const drifted = async () => Response.json({ id: 1 });
  await assert.rejects(fetchJson("https://api.example.com/user", User, drifted), z.ZodError);
});

const Env = z.object({
  PORT: z.coerce.number().int().default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]),
  DEBUG: z.stringbool().default(false),
});

test("environment variables are strings until coerced", () => {
  const env = Env.parse({ NODE_ENV: "test", DEBUG: "yes" });
  assert.deepEqual(env, { PORT: 3000, NODE_ENV: "test", DEBUG: true });
  assert.equal(Env.safeParse({ NODE_ENV: "staging" }).success, false);
});
