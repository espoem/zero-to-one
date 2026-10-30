# Module 11: Runtime Boundaries — Validation, Zod 4 & Standard Schema

> Examples and tests: [`examples/11-runtime-boundaries/boundaries.test.ts`](../examples/11-runtime-boundaries/boundaries.test.ts) (Zod 4.6.7, `@standard-schema/spec` 1.1.0), [`advanced-schemas.test.ts`](../examples/11-runtime-boundaries/advanced-schemas.test.ts) (async refinements, recursion, codecs, JSON Schema, error functions, union diagnostics) and the older walkthrough [`zod-schema-validation.test.ts`](../examples/11-runtime-boundaries/zod-schema-validation.test.ts).
> Run: `mise exec -- node --test examples/11-runtime-boundaries/`

Types are erased ([Module 01](./01-toolchain-and-compiler-model.md)). Everything the type checker proved stops at the edge of the program: HTTP bodies, `JSON.parse`, `localStorage`, environment variables, message queues, files, `postMessage`, and the arguments of server functions. This module is about that edge: how to turn `unknown` into a typed value *with evidence*, how a schema library derives its static types, and how to stay library-neutral with Standard Schema.

---

## 1. The boundary problem, stated precisely

A **trust boundary** is a point where a value enters the program from a source the type checker did not see. At such a point the only sound static type is `unknown`. A **validator** is a function `v: unknown → T | Failure` such that whenever `v(x)` returns a `T`, the runtime value `x` (or a transformed copy of it) really inhabits `T`. A **schema** is a value from which both a validator and the type `T` are derived, so that the two cannot drift apart.

Three ways to cross a boundary, in increasing order of honesty:

| Technique | Static type after | Runtime evidence | Failure mode |
|---|---|---|---|
| `JSON.parse(text) as User` | `User` | None | A wrong payload crashes later, far from the cause (`undefined is not a function` in an unrelated module) |
| Hand-written predicate `isUser(x): x is User` | `User` | As good as the predicate | The predicate and the type drift apart silently ([Module 10](./10-type-safe-api-design-patterns.md)) |
| Schema `User.parse(x)` with `type User = z.infer<typeof User>` | `User` | Full | Cost of parsing; schema must be kept at the edge |

The test `a cast is not a check` shows the first row: `raw as User` compiles, `lied.email` is `undefined`, and `User.parse(raw)` throws a `ZodError` immediately.

### 1.1 Parse, don't validate

"Parse, don't validate" (Alexis King, 2019) says: a check that returns `boolean` throws away what it learned, so the rest of the program must either re-check or trust. A **parser** returns a *more precise type* that records the evidence: `string → Email`, `unknown → User`, `number[] → NonEmptyArray<number>`. Downstream code takes the precise type as a parameter and cannot be called with unchecked data.

In TypeScript, the "more precise type" is either a structural type (the parsed object), a branded type (`string & { __brand: "Email" }`, [Module 10](./10-type-safe-api-design-patterns.md)), or a tuple type that encodes an invariant (`[T, ...T[]]`).

```mermaid
flowchart LR
    NET["HTTP body / env / storage<br/>(unknown)"] --> P["schema.parse()<br/>boundary"]
    P -->|success| CORE["Typed core<br/>User, UserId, Settings"]
    P -->|failure| ERR["Structured error<br/>400 / log / retry"]
    CORE --> OUT["serialize → unknown again<br/>at the next boundary"]
```

Keep the parse at the edge (controller, loader, message handler) and pass typed values inward. Parsing deep inside the core means every caller must handle failure.

---

## 2. How a schema library computes static types

A Zod schema is a value whose *type* carries two phantom type parameters: the **input** type (what `parse` accepts without failing) and the **output** type (what it returns). In Zod 4 they live under `schema._zod.input` / `schema._zod.output` and are read with:

```ts
type In  = z.input<typeof Schema>;
type Out = z.output<typeof Schema>;   // z.infer is an alias of z.output
```

Each combinator computes its result type from its arguments:

| Combinator | Input type | Output type |
|---|---|---|
| `z.string()` | `string` | `string` |
| `z.object({ a: A, b: B })` | `{ a: In<A>; b: In<B> }` (optional where `In` includes `undefined`) | `{ a: Out<A>; b: Out<B> }` |
| `A.optional()` | `In<A> \| undefined` | `Out<A> \| undefined` |
| `A.transform(f)` | `In<A>` | `ReturnType<f>` (awaited) |
| `A.default(v)` | `In<A> \| undefined` | `Out<A>` (no `undefined`) |
| `A.prefault(v)` | `In<A> \| undefined` | `Out<A>` |
| `z.coerce.number()` | `unknown` | `number` |
| `A.refine(pred)` with a type predicate `(x) => x is R` | `In<A>` | `Out<A> & R` |
| `A.brand<"B">()` | `In<A>` | `Out<A> & z.$brand<"B">` |

The test `z.input and z.output differ wherever a transform, default or coercion sits` asserts each row for a small `Settings` schema. **Failure mode:** typing a form's state or an HTTP *request* type with `z.infer` (the output) when the client sends the *input*: `{ theme?: "light" | "dark" }` is valid input, but `z.infer` claims `theme` is always present.

### 2.1 `.default` vs `.prefault` (Zod 4 semantics)

In Zod 4, `.default(v)` **short-circuits**: if the input is `undefined`, `v` is returned as the *output* without running the inner schema, so `v` must be assignable to the output type. `.prefault(v)` substitutes `v` as *input* and parses it, so `v` must be assignable to the input type. The test shows `z.string().transform(s => s.length).default(99)` returning `99`, while `.prefault("abc")` returns `3`.

### Then vs now: Zod 3 → Zod 4

| Concern | Zod 3 | Zod 4 (4.6.7) | Migration |
|---|---|---|---|
| String formats | `z.string().email()`, `.uuid()`, `.url()` | Top-level `z.email()`, `z.uuid()`, `z.url()`, `z.iso.datetime()`; method forms are `@deprecated` | Search-and-replace; method forms still work |
| Error customisation | `message`, `errorMap`, `invalid_type_error`, `required_error` | One `error` parameter (string or function of the issue); `message` deprecated; the two `*_error` params removed | Rewrite messages to `{ error: … }` |
| `.default()` | Applied to input, then parsed | Short-circuits with an output value; old behaviour is `.prefault()` | Check defaults on schemas with transforms |
| Object strictness | `.strict()`, `.passthrough()` | `z.strictObject()`, `z.looseObject()` (methods still available) | Optional |
| Object merging | `A.merge(B)` | `A.extend(B.shape)`; `.merge` deprecated | Replace |
| Enums | `z.nativeEnum(E)` | `z.enum(E)` accepts enum-like objects; `nativeEnum` deprecated | Replace |
| `z.record` | One argument allowed | Key and value schemas required | Add `z.string()` key |
| Refinements/transforms | Wrapped in `ZodEffects` | Refinements live inside the schema; `.transform()` returns a `ZodPipe` | Type references to `ZodEffects` break |
| `.superRefine` | Available | Still available and not deprecated in 4.6.7's typings; `.check()` is the lower-level alternative | None |
| `.deepPartial()` | Deprecated | Removed | Write a recursive partial schema |

Mixing pitfall: Zod 3 and Zod 4 schema *types* are not interchangeable. A library typed against `ZodType` from v3 rejects v4 schemas. This is exactly the coupling Standard Schema removes (§4).

---

## 3. Parsing APIs and error handling

```ts
const user = User.parse(raw);            // throws ZodError
const result = User.safeParse(raw);      // { success: true; data } | { success: false; error }
const user2 = await User.parseAsync(raw);// required if any refinement/transform is async
```

`safeParse` returns a discriminated union on `success`, so narrowing gives `data: User` or `error: ZodError<User>` (asserted in the tests). Formatting helpers:

- `z.flattenError(err)` → `{ formErrors: string[]; fieldErrors: { [key]: string[] } }` for flat forms.
- `z.treeifyError(err)` → a nested tree mirroring the schema.
- `z.prettifyError(err)` → a human-readable multi-line string for logs.

**Unknown keys.** `z.object` strips unknown keys (the output omits them), `z.strictObject` fails with `unrecognized_keys`, `z.looseObject` keeps them. Stripping is the safe default for inbound data: it prevents mass-assignment of fields such as `isAdmin` that the client should not control.

### 3.1 Refinements and their type effects

- `.refine(fn, { error })` adds a check; the output type is unchanged, unless `fn` is a **type predicate**, in which case the output is intersected with the predicate's type. With a non-empty-array predicate the parsed value's `xs[0]` is `string` even under `noUncheckedIndexedAccess`.
- `.superRefine((value, ctx) => ctx.addIssue({...}))` adds several issues with paths (cross-field validation such as password confirmation). The test asserts two issues at `password` and `confirm`.
- Async refinements force `parseAsync`; calling `parse` on such a schema throws.

---

## 4. Standard Schema: a library-neutral contract

Standard Schema (`@standard-schema/spec`, 1.1.0) is a small interface implemented by Zod (3.24+ and 4), Valibot, ArkType and others. A schema exposes one property, `~standard`:

```ts
interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: unknown) =>
      | { value: Output; issues?: undefined }
      | { issues: ReadonlyArray<{ message: string; path?: ReadonlyArray<PropertyKey | { key: PropertyKey }> }> }
      | Promise</* same */>;
    readonly types?: { readonly input: Input; readonly output: Output };
  };
}
```

Two design points:
1. **Types travel in a phantom property.** `types` is optional and never read at runtime; `StandardSchemaV1.InferOutput<S>` reads it at the type level. That is the same phantom-type technique Zod uses internally.
2. **The `~` prefix** sorts the property last in autocompletion and makes collisions with user-defined keys unlikely.

A consumer (a form library, a router's search-param parser, a server-function framework, an env loader) depends only on the interface:

```ts
async function parseWith<S extends StandardSchemaV1>(schema: S, value: unknown): Promise<StandardSchemaV1.InferOutput<S>> {
  let result = schema["~standard"].validate(value);
  if (result instanceof Promise) result = await result;
  if (result.issues) throw new Error(result.issues.map((i) => i.message).join("; "));
  return result.value;
}
```

The test uses the same function with a Zod schema and with a hand-written `PositiveInt` schema that has no dependency at all. TanStack Form/Router and Solid's server functions accept Standard Schema, so application code can switch validators without touching those libraries.

**When to depend on what.** Applications pick one library and use its full API (`z.infer`, error formatting, JSON Schema export). Libraries that *accept* user schemas type their parameters as `StandardSchemaV1` and never import a validator.

---

## 5. Patterns at the boundary

### 5.1 Typed `fetch`

```ts
async function fetchJson<S extends z.ZodType>(input: string, schema: S, fetchImpl = fetch): Promise<z.output<S>> {
  const res = await fetchImpl(input);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return schema.parse(await res.json());
}
```

`res.json()` is typed `Promise<any>` in the DOM lib; passing it straight into `parse` is the one place `any` is acceptable, because the schema immediately turns it into a checked type. Never write `fetchJson<T>(url): Promise<T>` without a schema: that is a cast with a generic disguise (a "useless generic", [Module 07](./07-generics-and-inference.md)).

### 5.2 Environment variables

Every environment variable is `string | undefined`. Parse them once at start-up and export the typed object:

```ts
const Env = z.object({
  PORT: z.coerce.number().int().default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]),
  DEBUG: z.stringbool().default(false),   // "true"/"yes"/"1" → true
});
export const env = Env.parse(process.env);
```

`z.coerce.number()` turns `""` into `0`; prefer `z.string().regex(/^\d+$/).transform(Number)` where an empty value must fail.

### 5.3 Branded outputs

`z.uuid().brand<"UserId">()` produces `string & z.$brand<"UserId">`. Functions that take a `UserId` can only be called with a parsed value; a plain string is a compile error (tested). Brands are static only: the runtime value is still a string, so serialising and re-reading it requires parsing again.

### 5.4 Server functions and RPC

Arguments of `"use server"` functions (React) or server functions (Solid) are attacker-controlled. The static parameter types are erased; parse them inside the function with a schema. The type-level serializability constraint is in [Module 12](./12-typing-ui-frameworks.md); the security model is owned by the react and solidjs tracks.

---

## 6. Beyond the basics: async, recursion, codecs and contracts

### 6.1 Async refinements and the colour of `parse`

A refinement or transform that returns a promise makes the whole schema **async**: `parse`/`safeParse` throw (`$ZodAsyncError`: "Encountered Promise during synchronous parse. Use .parseAsync() instead.") and you must call `parseAsync`/`safeParseAsync`. The test proves both. The static type does not record this, so the error appears only at runtime, often in a code path that previously used a sync schema. Keep I/O-bound checks (uniqueness in a database, remote lookups) *out* of shared schemas: put them in the handler after the synchronous parse, where their latency and failure modes are visible.

### 6.2 Recursive schemas

A schema cannot reference itself in its own initializer (TDZ at runtime, and TS7022 "implicitly has type 'any'" at compile time). Zod 4 uses a **getter** on the shape, which defers the reference until the property is read:

```ts
const Category = z.object({
  name: z.string(),
  get children() { return z.array(Category); },
});
type Category = z.infer<typeof Category>;   // { name: string; children: Category[] }
```

The getter is the runtime deferral; on the type side, TypeScript can type the getter's return without evaluating it eagerly, so the inferred type is properly recursive (the test asserts `Category["children"][number]` is `Category`). Zod 3 needed `z.lazy(() => …)` plus a hand-written interface, because inference could not see through the cycle.

### 6.3 Codecs: decode and encode

A boundary is bidirectional: you decode wire data into domain values and encode them back. A **codec** pairs an input schema with an output schema and two functions:

```ts
const IsoDate = z.codec(z.iso.datetime(), z.date(), {
  decode: (s) => new Date(s),
  encode: (d) => d.toISOString(),
});
IsoDate.decode("2026-01-01T00:00:00.000Z"); // Date
IsoDate.encode(new Date());                  // string
```

`z.input<typeof IsoDate>` is `string` and `z.output` is `Date`. A one-way `.transform` cannot be reversed, which is why APIs that both read and write (forms, caches, URL state) drift into two hand-maintained schemas without codecs.

### 6.4 Schemas as contracts for other tools

`z.toJSONSchema(schema)` emits JSON Schema (draft 2020-12), so one TypeScript source of truth can feed OpenAPI documents, other-language clients, and LLM tool definitions. The test checks `required`, and that `.int()` becomes `"type": "integer"`. Not every Zod feature has a JSON Schema equivalent (transforms, refinements with arbitrary code, codecs): those are either dropped or reported depending on options, so treat the export as the *structural* contract and keep semantic checks server-side.

### 6.5 Error messages that help users

The unified `error` option accepts a function of the issue, which can tell "missing" from "wrong type":

```ts
z.string({ error: (issue) => (issue.input === undefined ? "required" : "must be text") });
```

For localisation, set a global error map with `z.config(...)` and keep messages out of schemas. For APIs, return `z.flattenError` (flat forms) or `z.treeifyError` (nested data) rather than the raw issue list, and never echo `issue.input` back for secrets.

### 6.6 Unions: diagnostics and cost

`z.union([A, B])` tries each member and, if all fail, reports an `invalid_union` issue containing every member's errors: correct, but hard to read and O(members) work per value. `z.discriminatedUnion("kind", [A, B])` reads the discriminant first and validates only the matching member, so errors point at the actual field (`["n"]` in the test) and cost is O(1) member validations. Use discriminated unions whenever the data has a tag, which is also what TypeScript narrows best ([Module 03](./03-unions-narrowing-and-control-flow.md)).

### 6.7 What parsing returns

`parse` builds a **new** value (objects and arrays are copied, unknown keys stripped), so later mutation of the input does not affect the parsed output (asserted in the test). Two consequences: parsing large payloads allocates; and identity checks (`parsed === input`) are false, which matters for caches keyed by object identity. Branded outputs (§5.3) are the same runtime values as their unbranded inputs; only the type changes.

### 6.8 Choosing a validator

| Concern | Zod 4 | Valibot | ArkType | Hand-written predicate |
|---|---|---|---|---|
| Static inference | Yes | Yes | Yes (from string DSL) | Manual type |
| Standard Schema | Yes | Yes | Yes | Implement `~standard` yourself (§4) |
| Bundle size | Medium (Zod Mini for tree-shaking) | Small (functional, tree-shakeable) | Medium | Minimal |
| JSON Schema export | Built in | Via package | Built in | — |
| When to choose | Default for apps; ecosystem | Size-sensitive frontends | Very large schemas, terse syntax | One tiny boundary, no dependency |

Bundle-size and feature notes for Valibot and ArkType come from their documentation, not from tests in this track (unverified here). The decision that matters more than the library: **one schema per boundary, parsed once, at the edge**, and libraries that accept schemas typed as `StandardSchemaV1`.

---

## 7. Production failure modes

1. **`as` / `!` / `JSON.parse` at the boundary.** The crash appears far from its cause. Parse at the edge.
2. **`z.infer` used as a request type.** Input and output differ under defaults/transforms; use `z.input` for what clients send.
3. **Parsing in the hot path of the core** (every function re-validates). Parse once at the edge and pass branded or parsed types.
4. **`.default()` behaviour changed on upgrade to Zod 4** (short-circuit). Schemas with a transform after a default return different values.
5. **Library code typed against a specific Zod major.** Accept `StandardSchemaV1` instead.
6. **`z.object` strips a field you needed** (silently missing in the output). Use `z.looseObject` or add the field; use `z.strictObject` to make drift loud.
7. **Coercion accepts junk** (`z.coerce.number()` maps `""` to `0`, `z.coerce.boolean()` maps `"false"` to `true`). Use `z.stringbool()` and explicit regexes.
8. **Async refinement + `parse`** throws at runtime (`$ZodAsyncError`). Use `parseAsync`, or keep I/O checks out of schemas.
9. **Self-referencing schema without a getter**: TS7022 at compile time and a TDZ `ReferenceError` at runtime. Use the getter form.
10. **Plain `z.union` on tagged data**: unreadable errors and wasted work. Use `z.discriminatedUnion`.
11. **Hand-maintained read and write schemas drift**. Use a codec for bidirectional fields (dates, money, IDs).

---

## Exercises

Reference solutions with tests: [`examples/11-runtime-boundaries/exercises.test.ts`](../examples/11-runtime-boundaries/exercises.test.ts). Try each before reading the solution.

### Exercise 11.1: Checkout schema with a cross-field rule

Write a `Checkout` schema with an email, an optional company (`name`, optional `vatId`), and a discriminated `payment` union (`card` with a token, `bank` with an IBAN, `invoice` with `dueDays` coerced from a string and defaulting to 14). Invoices require a company VAT id. Derive the form type and the service type.

<details><summary>Solution and explanation</summary>

```ts
export const Checkout = z
  .object({
    email: z.email(),
    company: z.object({ name: z.string().min(1), vatId: z.string().regex(/^[A-Z]{2}\d{8,12}$/).optional() }).optional(),
    payment: z.discriminatedUnion("method", [
      z.object({ method: z.literal("card"), token: z.string().min(1) }),
      z.object({ method: z.literal("bank"), iban: z.string().min(15) }),
      z.object({ method: z.literal("invoice"), dueDays: z.coerce.number().int().default(14) }),
    ]),
  })
  .superRefine((v, ctx) => {
    if (v.payment.method === "invoice" && !v.company?.vatId) {
      ctx.addIssue({ code: "custom", message: "invoice requires a company VAT id", path: ["company", "vatId"] });
    }
  });
export type CheckoutForm = z.input<typeof Checkout>;
export type CheckoutCommand = z.output<typeof Checkout>;
```

- The cross-field rule lives in `superRefine` on the *parent*, because neither field alone can decide it; the issue's `path` points at the field the user must fix, so form libraries display it in the right place.
- Inside `superRefine`, `v` is already the output type, so `v.payment.method === "invoice"` narrows like ordinary TypeScript.
- `dueDays` is `unknown` in the form type (coercion accepts anything) and `number` in the command type. Using `z.infer` for the form would wrongly require `dueDays`.
</details>

### Exercise 11.2: Search params through Standard Schema

Write `parseSearchParams<S extends StandardSchemaV1>(schema: S, params: URLSearchParams)` that turns repeated keys into arrays and validates with any Standard Schema.

<details><summary>Solution and explanation</summary>

```ts
export async function parseSearchParams<S extends StandardSchemaV1>(schema: S, params: URLSearchParams): Promise<StandardSchemaV1.InferOutput<S>> {
  const raw: Record<string, string | string[]> = {};
  for (const key of new Set(params.keys())) {
    const all = params.getAll(key);
    raw[key] = all.length > 1 ? all : (all[0] ?? "");
  }
  let result = schema["~standard"].validate(raw);
  if (result instanceof Promise) result = await result;
  if (result.issues) throw new Error(result.issues.map((i) => i.message).join("; "));
  return result.value;
}
```

The function knows nothing about Zod; coercion (`page: "2"` → `2`) is the schema's job. The shape decision (single value vs array) is the only boundary logic, and the schema can accept both (`z.union([z.string(), z.array(z.string())])`).
</details>

### Exercise 11.3: Migrating a Zod 3 default

A Zod 3 schema `z.string().default("abc").transform(s => s.length)` returned `3` for `undefined`. Write the Zod 4 equivalent and a test proving it.

<details><summary>Solution and explanation</summary>

Zod 4's `.default(v)` short-circuits with an *output* value, so the Zod 3 meaning ("substitute this input, then parse it") is `.prefault("abc")`: `z.string().transform((s) => s.length).prefault("abc").parse(undefined) === 3`, while `.default(0)` returns `0` without running the transform.
</details>

---

## Interview Drill

<details><summary>1. Why is <code>JSON.parse(text) as User</code> dangerous, and what does "parse, don't validate" propose instead?</summary>

The cast has no runtime effect: a wrong payload is typed as `User` and fails later wherever a missing field is used. "Parse, don't validate" means turning `unknown` into a more precise type with a function that either fails or returns evidence (`User`, a branded `Email`), so downstream code cannot receive unchecked data and never re-checks.
</details>

<details><summary>2. When do <code>z.input</code> and <code>z.output</code> differ? Give three causes.</summary>

Transforms (`string` → `string[]`), defaults/prefaults (input allows `undefined`, output does not), and coercion (`z.coerce.number()` input is `unknown`). Also predicate refinements and brands, which change only the output.
</details>

<details><summary>3. What is Standard Schema and why should a library accept it instead of a Zod schema?</summary>

A minimal interface (`~standard.validate`, `vendor`, `version`, phantom `types`) implemented by Zod, Valibot, ArkType and others. A library typed against it works with any validator and is not broken by a validator's major-version change (Zod 3 vs 4 types are incompatible).
</details>

<details><summary>4. How does Zod compute the static type of <code>z.object({ a: z.string().default("x") })</code>?</summary>

Each schema type carries phantom input/output types. `z.object` maps over its shape: input `{ a?: string | undefined }` (the key is optional because its input includes `undefined`), output `{ a: string }`. `z.infer` reads the output.
</details>

<details><summary>5. What changed about <code>.default()</code> in Zod 4?</summary>

It short-circuits: on `undefined` input it returns the default as the output value without running the inner schema, so the default must match the output type. The Zod 3 behaviour (substitute then parse) is `.prefault()`.
</details>

<details><summary>6. Your server action has typed parameters. Why must it still validate them?</summary>

Types are erased and the action is a public HTTP endpoint; any client can send any payload. Validate with a schema, then authorize.
</details>

<details><summary>7. How do you define a recursive schema in Zod 4, and why does it type-check?</summary>

Put the self-reference in a getter on the object shape (`get children() { return z.array(Category); }`). At runtime the getter defers evaluation until after `Category` is initialised; at compile time the getter's return type is resolved lazily, so inference produces a properly recursive type instead of TS7022.
</details>

<details><summary>8. <code>z.union</code> vs <code>z.discriminatedUnion</code>?</summary>

A plain union tries every member and, on failure, reports an `invalid_union` with all members' errors. A discriminated union reads the tag and validates one member: O(1) member checks and errors that point at the real field.
</details>


<details><summary>9. When do you need a codec instead of a transform?</summary>

When the same boundary is crossed in both directions (API reads and writes, form state, URL state, caches). A transform is one-way; a codec (`z.codec(wire, domain, { decode, encode })`) keeps decoding and encoding in one definition, with `z.input` as the wire type and `z.output` as the domain type, so the two directions cannot drift.
</details>

<details><summary>10. A schema shared by many handlers gains an async uniqueness check. What breaks, and what is the better design?</summary>

Every synchronous `parse`/`safeParse` call now throws at runtime ("Encountered Promise during synchronous parse"), and nothing in the static types warns you. Keep schemas synchronous and structural; run I/O-bound checks in the handler after parsing, where latency, retries and error mapping are explicit.
</details>
